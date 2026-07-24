// frontend/src/lib/eprouvette.ts
// Modèle « éprouvette » : un cylindre moulé à partir d'une gâchée réelle, mis en
// cure et destiné à être écrasé à un âge donné (essai UCS — phase suivante).
// C'est le maillon Gâchée -> Éprouvette du modèle. Types + helpers PURS
// (échéances, échéancier, export .ics, étiquettes imprimables).

export type StatutEprouvette = "en_cure" | "ecrase";

export interface Eprouvette {
  id: string;
  code: string; // « G-AAAAMMJJ-NN-E01 »
  couleLe: string; // ISO — date de moulage
  ageJours: number; // âge de cure cible (jours) -> échéance = couleLe + ageJours
  moule?: string; // type/dimensions, ex. « cylindre 50 × 100 mm »
  statut: StatutEprouvette;
}

/** Âges de cure usuels pour les remblais en pâte (jours). */
export const AGES_CURE_DEFAUT = [7, 14, 28, 56, 91] as const;

const MS_JOUR = 86_400_000;

/** Ramène une date à minuit local (granularité « jour », insensible à l'heure). */
function jourLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Date de moulage (jour local). */
export function dateCoulee(e: Eprouvette): Date {
  return jourLocal(new Date(e.couleLe));
}

/** Date d'échéance = coulée + âge de cure (jour local, sûr vis-à-vis du DST). */
export function dateEcheance(e: Eprouvette): Date {
  const d = dateCoulee(e);
  d.setDate(d.getDate() + Math.round(e.ageJours));
  return d;
}

/** Jours restants avant l'échéance (négatif = en retard), relatif à `ref`. */
export function joursRestants(e: Eprouvette, ref: Date): number {
  return Math.round((dateEcheance(e).getTime() - jourLocal(ref).getTime()) / MS_JOUR);
}

export type ClasseEcheance = "fait" | "retard" | "aujourdhui" | "proche" | "planifie";

/**
 * Classe d'échéance pour l'échéancier. « proche » = dans les 7 jours.
 * Une éprouvette écrasée est toujours « fait », quelle que soit la date.
 */
export function classeEcheance(e: Eprouvette, ref: Date): ClasseEcheance {
  if (e.statut === "ecrase") return "fait";
  const j = joursRestants(e, ref);
  if (j < 0) return "retard";
  if (j === 0) return "aujourdhui";
  if (j <= 7) return "proche";
  return "planifie";
}

/**
 * Code d'éprouvette « <codeGâchée>-E<NN> » : NN incrémente parmi les éprouvettes
 * existantes de la gâchée (déduit des codes présents).
 */
export function genererCodeEprouvette(codeGachee: string, existantes: Eprouvette[]): string {
  const prefixe = `${codeGachee}-E`;
  const max = existantes
    .map((e) => (e.code.startsWith(prefixe) ? parseInt(e.code.slice(prefixe.length), 10) : NaN))
    .filter((n) => Number.isInteger(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefixe}${String(max + 1).padStart(2, "0")}`;
}

// ── Export iCalendar (.ics) ──

export interface EvenementIcs {
  uid: string;
  date: Date; // jour de l'échéance (événement « toute la journée »)
  titre: string;
  description?: string;
}

function echapperIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** « YYYYMMDD » en date locale (pour un événement toute la journée). */
function dateIcs(d: Date): string {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
}

/** « YYYYMMDDTHHMMSSZ » en UTC (pour DTSTAMP). */
function horodatageIcs(d: Date): string {
  return (
    `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`
  );
}

/**
 * Construit un fichier iCalendar (événements « toute la journée ») pour les
 * échéances d'écrasement. Compatible Google Agenda / Outlook / Apple Calendar.
 */
export function construireIcs(evenements: EvenementIcs[], horodatage: Date): string {
  const stamp = horodatageIcs(horodatage);
  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MineBackfill//Labo//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const ev of evenements) {
    const fin = new Date(ev.date);
    fin.setDate(fin.getDate() + 1); // DTEND exclusif pour un événement d'un jour
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateIcs(ev.date)}`,
      `DTEND;VALUE=DATE:${dateIcs(fin)}`,
      `SUMMARY:${echapperIcs(ev.titre)}`,
    );
    if (ev.description) lignes.push(`DESCRIPTION:${echapperIcs(ev.description)}`);
    lignes.push("END:VEVENT");
  }
  lignes.push("END:VCALENDAR");
  return lignes.join("\r\n") + "\r\n";
}

// ── Étiquettes imprimables ──

function echapperHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EtiquetteEprouvette {
  codeEprouvette: string;
  codeGachee: string;
  formulation: string;
  categorie: string;
  couleLe: string; // affiché
  echeance: string; // affiché
  ageJours: number;
  moule?: string;
}

/**
 * Document HTML autonome (styles inclus) pour imprimer une planche d'étiquettes
 * d'éprouvettes. Rendu dans une iframe cachée puis imprimé (voir la page Labo).
 */
export function etiquettesHtml(etiquettes: EtiquetteEprouvette[], titre: string): string {
  const cartes = etiquettes
    .map(
      (e) => `<div class="et">
      <div class="code">${echapperHtml(e.codeEprouvette)}</div>
      <div class="ligne"><span>Gâchée</span><b>${echapperHtml(e.codeGachee)}</b></div>
      <div class="ligne"><span>Formulation</span><b>${echapperHtml(e.formulation)} · ${echapperHtml(e.categorie)}</b></div>
      <div class="ligne"><span>Coulée</span><b>${echapperHtml(e.couleLe)}</b></div>
      <div class="ligne"><span>Âge / échéance</span><b>${e.ageJours} j · ${echapperHtml(e.echeance)}</b></div>
      ${e.moule ? `<div class="ligne"><span>Moule</span><b>${echapperHtml(e.moule)}</b></div>` : ""}
    </div>`,
    )
    .join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapperHtml(titre)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 12mm; color: #0f172a; }
  h1 { font-size: 14px; margin: 0 0 8mm; }
  .planche { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
  .et { border: 1px solid #94a3b8; border-radius: 3mm; padding: 4mm 5mm; page-break-inside: avoid; }
  .code { font-size: 16px; font-weight: 800; letter-spacing: 0.02em; margin-bottom: 2mm; }
  .ligne { display: flex; justify-content: space-between; gap: 4mm; font-size: 11px; padding: 0.6mm 0; }
  .ligne span { color: #64748b; }
  @media print { body { margin: 8mm; } }
</style></head><body>
<h1>${echapperHtml(titre)}</h1>
<div class="planche">
${cartes}
</div>
</body></html>`;
}
