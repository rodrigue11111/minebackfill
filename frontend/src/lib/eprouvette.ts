// frontend/src/lib/eprouvette.ts
// Modèle « éprouvette » : un cylindre moulé à partir d'une gâchée réelle, mis en
// cure et destiné à être écrasé à un âge donné (essai UCS — phase suivante).
// C'est le maillon Gâchée -> Éprouvette du modèle. Types + helpers PURS
// (échéances, échéancier, export .ics, étiquettes imprimables).

export type StatutEprouvette = "en_cure" | "ecrase";

/**
 * Essai de résistance en compression uniaxiale (UCS) sur une éprouvette écrasée.
 * On MESURE une contrainte à la rupture ; le programme n'affiche AUCUNE valeur
 * calculée/prédite (aucun modèle de prédiction validé n'existe ici).
 * La contrainte est soit saisie directement (contrainteKpaSaisie, si la presse
 * la donne), soit calculée depuis la charge et le diamètre (voir contrainteKpa).
 */
export interface EssaiUCS {
  date?: string; // ISO — date de l'essai (écrasement)
  chargeKn?: number; // charge à la rupture (kN)
  diametreMm?: number; // diamètre de l'éprouvette (pour la section)
  hauteurMm?: number; // hauteur (traçabilité ; élancement)
  contrainteKpaSaisie?: number; // contrainte mesurée saisie directement (kPa)
  modeRupture?: string;
  exclu?: boolean; // exclu de la moyenne (aberrant) — justification requise
  justificationExclusion?: string;
}

export interface Eprouvette {
  id: string;
  code: string; // « G-AAAAMMJJ-NN-E01 »
  couleLe: string; // ISO — date de moulage
  ageJours: number; // âge de cure cible (jours) -> échéance = couleLe + ageJours
  moule?: string; // type/dimensions, ex. « cylindre 50 × 100 mm »
  statut: StatutEprouvette;
  essai?: EssaiUCS; // renseigné une fois l'éprouvette écrasée
}

/** Âges de cure usuels pour les remblais en pâte (jours). */
export const AGES_CURE_DEFAUT = [7, 14, 28, 56, 91] as const;

/**
 * Contrainte UCS mesurée (kPa) : la saisie directe prime ; sinon on la déduit
 * de la charge (kN) et du diamètre (mm) — σ = F / A, A = π·d²/4. Renvoie null si
 * l'essai n'est pas exploitable (ni contrainte ni charge+diamètre valides).
 */
export function contrainteKpa(essai: EssaiUCS | undefined): number | null {
  if (!essai) return null;
  const directe = essai.contrainteKpaSaisie;
  if (directe != null && Number.isFinite(directe)) return directe;
  const { chargeKn, diametreMm } = essai;
  if (chargeKn != null && Number.isFinite(chargeKn) && diametreMm != null && diametreMm > 0) {
    const aireMm2 = (Math.PI * diametreMm * diametreMm) / 4;
    // (kN·1000 = N) / mm² = MPa ; ×1000 -> kPa
    return ((chargeKn * 1000) / aireMm2) * 1000;
  }
  return null;
}

/** Moyenne arithmétique, ou null si vide. */
export function moyenne(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Écart-type d'échantillon (dénominateur n−1), ou null si moins de 2 valeurs. */
export function ecartTypeEch(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = moyenne(xs) as number;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export interface AgregatAge {
  ageJours: number;
  valeurs: number[]; // contraintes RETENUES (kPa), hors exclusions
  n: number; // nb retenu
  nExclus: number;
  moyenneKpa: number | null;
  ecartTypeKpa: number | null;
  cvPct: number | null; // coefficient de variation (%)
}

/**
 * Agrège les essais UCS par âge de cure : moyenne, écart-type et CV des
 * éprouvettes RETENUES (les éprouvettes marquées « exclues » sont comptées à
 * part, jamais dans la moyenne). N'inclut que les âges ayant au moins un essai
 * exploitable. Trié par âge croissant.
 */
export function agregerParAge(eprouvettes: Eprouvette[]): AgregatAge[] {
  const parAge = new Map<number, { retenus: number[]; exclus: number }>();
  for (const e of eprouvettes) {
    const c = contrainteKpa(e.essai);
    if (c === null) continue;
    const slot = parAge.get(e.ageJours) ?? { retenus: [], exclus: 0 };
    if (e.essai?.exclu) slot.exclus += 1;
    else slot.retenus.push(c);
    parAge.set(e.ageJours, slot);
  }
  return [...parAge.entries()]
    .map(([ageJours, { retenus, exclus }]) => {
      const m = moyenne(retenus);
      const sd = ecartTypeEch(retenus);
      return {
        ageJours,
        valeurs: retenus,
        n: retenus.length,
        nExclus: exclus,
        moyenneKpa: m,
        ecartTypeKpa: sd,
        cvPct: m !== null && m !== 0 && sd !== null ? (sd / m) * 100 : null,
      };
    })
    .sort((a, b) => a.ageJours - b.ageJours);
}

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

const encodeurUtf8 = new TextEncoder();
const octets = (s: string): number => encodeurUtf8.encode(s).length;

/**
 * Pliage RFC 5545 §3.1 : aucune ligne physique ne dépasse 75 octets. Les lignes
 * de continuation débutent par une espace (CRLF + espace). Le découpage se fait
 * sur les points de code (jamais au milieu d'un octet UTF-8 multi-octets) ; le
 * dépliage par le lecteur restaure le contenu exact, y compris les séquences
 * échappées coupées en deux.
 */
function plierLigneIcs(ligne: string): string {
  if (octets(ligne) <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let taille = 0;
  let premier = true;
  for (const ch of ligne) {
    const t = octets(ch);
    const limite = premier ? 75 : 74; // 1 octet réservé à l'espace de continuation
    if (taille + t > limite) {
      morceaux.push(courant);
      premier = false;
      courant = "";
      taille = 0;
    }
    courant += ch;
    taille += t;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
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
  return lignes.map(plierLigneIcs).join("\r\n") + "\r\n";
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
