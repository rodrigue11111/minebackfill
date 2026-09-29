// frontend/src/lib/rapport-classe.ts
// Rapport de fin de session (enseignant) : une SYNTHÈSE de la classe, puis un
// chapitre par étudiant — ou le chapitre d'un seul étudiant. Module PUR : il
// produit une suite de blocs (titres, textes, tableaux) que
// rapport-classe-pdf.ts dessine avec jsPDF. Testable sans navigateur.
//
// Même règle que l'écran (classe-comparaison.ts) : aucune moyenne entre
// gâchées, et pas de médiane dans un document qui circule — on n'imprime que
// des valeurs par gâchée et l'étendue min – max.

import { agregerParAge } from "./eprouvette";
import { horsTolerance, parametresEffectifs } from "./gachee";
import { gacheesRetenues, type EtudiantClasse } from "./classe";
import { libelleGroupe, type Comparaison } from "./classe-comparaison";
import { LIBELLES_ALERTES, libellesSeuils, type Alerte, type TypeAlerte } from "./classe-alertes";
import { estReponse, type LigneAnnotation } from "./classe-reseau";
import { fmtDate } from "./echeance-affichage";

export type BlocRapport =
  | { type: "titre"; texte: string; niveau: 1 | 2 }
  | { type: "texte"; texte: string; discret?: boolean }
  | { type: "tableau"; colonnes: { titre: string; largeur: number; alignement?: "g" | "d" }[]; lignes: string[][] }
  | { type: "saut" };

export interface DocumentRapport {
  titre: string;
  sousTitre: string;
  blocs: BlocRapport[];
}

export interface ContexteRapport {
  /** Libellé du filtre affiché (« Automne 2026 », « Toutes les sessions »…). */
  session: string;
  genereLe: Date;
  alertes: Alerte[];
  comparaison: Comparaison;
  annotations: LigneAnnotation[];
  /** Id de l'enseignant qui génère (ses commentaires sont signés « Vous »). */
  moi: string;
}

/* ── Texte compatible avec la police intégrée de jsPDF ─────────────────────
 * Helvetica intégrée = encodage WinAnsi (CP1252) : Latin-1 plus quelques
 * signes (’ « » œ – — … €). Un SEUL caractère hors de cette table fait passer
 * toute la chaîne en UCS-2, rendue illisible. On ramène donc chaque caractère
 * hors table à un équivalent sûr. */
const CP1252_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
const EQUIVALENTS: Record<string, string> = {
  " ": " ", " ": " ", " ": " ", "​": "", "−": "-", "‑": "-", "‐": "-",
  "≥": ">=", "≤": "<=", "≈": "~", "≠": "!=", "σ": "s", "→": "->", "←": "<-", "▸": ">", "▾": "v",
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

export function pourPdf(s: string): string {
  let r = "";
  for (const c of s.normalize("NFC")) {
    const code = c.codePointAt(0)!;
    if (code <= 0xff || CP1252_EXTRA.has(c)) r += c;
    else r += EQUIVALENTS[c] ?? "?";
  }
  return r;
}

/** Nombre à virgule décimale, milliers séparés par une espace ordinaire. */
export function nombrePdf(v: number | null | undefined, dec = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const [ent, frac] = Math.abs(v).toFixed(dec).split(".");
  const groupe = ent.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 && Number(Math.abs(v).toFixed(dec)) !== 0 ? "-" : ""}${groupe}${frac ? `,${frac}` : ""}`;
}

const jour = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmtDate(d);
};
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function ucsParAge(g: EtudiantClasse["gachees"][number]): string {
  const a = agregerParAge(g.eprouvettes);
  if (a.length === 0) return "—";
  return a.map((x) => `${x.ageJours} j : ${nombrePdf(x.moyenneKpa)}${x.ecartTypeKpa !== null ? ` ± ${nombrePdf(x.ecartTypeKpa)}` : ""} (n=${x.n}${x.nExclus ? `, ${x.nExclus} excl.` : ""})`).join(" ; ");
}

function chapitreEtudiant(e: EtudiantClasse, ctx: ContexteRapport): BlocRapport[] {
  const blocs: BlocRapport[] = [];
  const gachees = gacheesRetenues(e);
  const copies = e.gachees.length - gachees.length;
  const alertes = ctx.alertes.filter((a) => a.etudiantId === e.id);
  blocs.push({ type: "titre", texte: e.nom, niveau: 1 });
  blocs.push({ type: "texte", texte: [
    e.email ?? "courriel inconnu",
    pluriel(e.resultats.length, "résultat"),
    pluriel(gachees.length, "gâchée") + (copies > 0 ? ` (+ ${pluriel(copies, "copie")} de conflit, non comptée${copies > 1 ? "s" : ""})` : ""),
    pluriel(e.nbEssais, "essai") + " valide" + (e.nbEssais > 1 ? "s" : ""),
    `dernière activité en ligne : ${jour(e.derniereActivite)}`,
  ].join(" · ") });

  if (gachees.length === 0 && e.resultats.length === 0) {
    blocs.push({ type: "texte", texte: "Aucun document en ligne pour cette sélection.", discret: true });
    return blocs;
  }

  if (gachees.length > 0) {
    const formulations = e.resultats.map((r) => ({ id: r.id, recipes: r.recipes ?? [] }));
    blocs.push({ type: "titre", texte: "Gâchées", niveau: 2 });
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Gâchée", largeur: 26 }, { titre: "Date", largeur: 18 }, { titre: "Formulation", largeur: 34 },
        { titre: "Cw (%)", largeur: 13, alignement: "d" }, { titre: "Bw (%)", largeur: 13, alignement: "d" },
        { titre: "UCS par âge (kPa, moyenne ± écart-type)", largeur: 96 }, { titre: "En cure", largeur: 14, alignement: "d" },
        { titre: "Pesées hors tol.", largeur: 18, alignement: "d" },
      ],
      lignes: [...gachees].sort((a, b) => (a.creeLe ?? "").localeCompare(b.creeLe ?? "")).map((g) => {
        const p = parametresEffectifs(g, formulations);
        return [
          g.code, jour(g.creeLe), `${g.formulationLabel ?? ""} (${g.categorie})`,
          nombrePdf(p?.cwPct, 1), nombrePdf(p?.bwPct, 2), ucsParAge(g),
          String(g.eprouvettes.filter((x) => x.statut !== "ecrase").length),
          g.composants.length === 0 ? "—" : String(g.composants.filter((c) => horsTolerance(c, g.tolerancePct)).length),
        ];
      }),
    });
  }

  if (e.resultats.length > 0) {
    blocs.push({ type: "titre", texte: "Résultats sauvegardés", niveau: 2 });
    blocs.push({
      type: "tableau",
      colonnes: [{ titre: "Libellé", largeur: 90 }, { titre: "Catégorie", largeur: 22 }, { titre: "Méthode", largeur: 30 }, { titre: "Recettes", largeur: 18, alignement: "d" }, { titre: "Date", largeur: 22 }],
      lignes: e.resultats.map((r) => [
        r.label + (r.conflit ? " (copie de conflit)" : ""), r.category, r.method,
        String(r.category === "RRC" ? r.rrc?.result.recipes.length ?? 0 : (r.recipes ?? []).length), jour(r.savedAt),
      ]),
    });
  }

  if (alertes.length > 0) {
    blocs.push({ type: "titre", texte: "À surveiller", niveau: 2 });
    blocs.push({
      type: "tableau",
      colonnes: [{ titre: "Type", largeur: 44 }, { titre: "Document", largeur: 28 }, { titre: "Détail", largeur: 160 }],
      lignes: alertes.map((a) => [LIBELLES_ALERTES[a.type], a.cible?.code ?? "—", a.message]),
    });
  }

  const nomDoc = (a: LigneAnnotation) => a.target_kind === "gachee"
    ? e.gachees.find((g) => g.id === a.target_id)?.code ?? "gâchée"
    : e.resultats.find((r) => r.id === a.target_id)?.label ?? "résultat";
  const fil = ctx.annotations.filter((a) => a.owner_id === e.id)
    .sort((a, b) => nomDoc(a).localeCompare(nomDoc(b)) || (a.created_at ?? a.updated_at).localeCompare(b.created_at ?? b.updated_at));
  if (fil.length > 0) {
    blocs.push({ type: "titre", texte: "Commentaires et réponses", niveau: 2 });
    blocs.push({
      type: "tableau",
      colonnes: [{ titre: "Document", largeur: 30 }, { titre: "Auteur", largeur: 30 }, { titre: "Date", largeur: 20 }, { titre: "Texte", largeur: 132 }, { titre: "Lu le", largeur: 20 }],
      lignes: fil.map((a) => [
        nomDoc(a) + (a.ancre ? ` (${a.ancre})` : ""),
        estReponse(a) ? e.nom : a.auteur_id === ctx.moi ? "Vous" : "Enseignant",
        jour(a.created_at ?? a.updated_at), a.texte, a.lu_le ? jour(a.lu_le) : "—",
      ]),
    });
  }
  return blocs;
}

function enTete(ctx: ContexteRapport, titre: string): Pick<DocumentRapport, "titre" | "sousTitre"> {
  return {
    titre,
    sousTitre: `MineBackfill · ${ctx.session} · généré le ${fmtDate(ctx.genereLe)} · valeurs MESURÉES saisies par les étudiants ; essais valides seulement ; copies de conflit exclues`,
  };
}

/** Synthèse de la classe, puis un chapitre par étudiant (chacun sur une nouvelle page). */
export function documentRapportClasse(etudiants: EtudiantClasse[], ctx: ContexteRapport): DocumentRapport {
  const blocs: BlocRapport[] = [];
  const nbGachees = etudiants.reduce((n, e) => n + gacheesRetenues(e).length, 0);
  const nbResultats = etudiants.reduce((n, e) => n + e.resultats.length, 0);
  const nbEssais = etudiants.reduce((n, e) => n + e.nbEssais, 0);
  blocs.push({ type: "titre", texte: "Synthèse de la classe", niveau: 1 });
  blocs.push({ type: "texte", texte: `${pluriel(etudiants.length, "étudiant")} · ${pluriel(nbGachees, "gâchée")} · ${pluriel(nbResultats, "résultat")} · ${pluriel(nbEssais, "essai")} valide${nbEssais > 1 ? "s" : ""} · ${pluriel(ctx.alertes.length, "alerte")}` });

  blocs.push({
    type: "tableau",
    colonnes: [
      { titre: "Étudiant", largeur: 46 }, { titre: "Courriel", largeur: 56 }, { titre: "Résultats", largeur: 18, alignement: "d" },
      { titre: "Gâchées", largeur: 18, alignement: "d" }, { titre: "Essais valides", largeur: 22, alignement: "d" },
      { titre: "Dernière activité", largeur: 26 }, { titre: "Alertes", largeur: 16, alignement: "d" }, { titre: "Commentaires", largeur: 30, alignement: "d" },
    ],
    lignes: etudiants.map((e) => {
      const fil = ctx.annotations.filter((a) => a.owner_id === e.id);
      const reponses = fil.filter(estReponse).length;
      return [
        e.nom, e.email ?? "—", String(e.resultats.length), String(gacheesRetenues(e).length), String(e.nbEssais),
        jour(e.derniereActivite), String(ctx.alertes.filter((a) => a.etudiantId === e.id).length),
        `${fil.length - reponses}${reponses > 0 ? ` (+ ${pluriel(reponses, "réponse")})` : ""}`,
      ];
    }),
  });

  if (ctx.alertes.length > 0) {
    const parType = new Map<TypeAlerte, number>();
    for (const a of ctx.alertes) parType.set(a.type, (parType.get(a.type) ?? 0) + 1);
    blocs.push({ type: "titre", texte: "Alertes par type", niveau: 2 });
    blocs.push({
      type: "tableau",
      colonnes: [{ titre: "Type", largeur: 80 }, { titre: "Nombre", largeur: 20, alignement: "d" }],
      lignes: [...parType.entries()].map(([t, n]) => [LIBELLES_ALERTES[t], String(n)]),
    });
  }

  const lignesGroupes = ctx.comparaison.groupes.flatMap((g) => g.parAge.map((a) => {
    const v = a.lignes.map((l) => l.moyenneKpa);
    return [
      libelleGroupe(g), `${a.ageJours} j`, String(a.lignes.length), String(new Set(a.lignes.map((l) => l.etudiantId)).size),
      `${nombrePdf(Math.min(...v))} – ${nombrePdf(Math.max(...v))}`,
    ];
  }));
  if (lignesGroupes.length > 0) {
    blocs.push({ type: "titre", texte: "Formulations gâchées par plusieurs étudiants", niveau: 2 });
    blocs.push({ type: "texte", texte: "Même catégorie, Cw et Bw arrondis au demi-point. Étendue des UCS moyennes par gâchée ; aucune moyenne entre gâchées (lots, opérateurs et protocoles différents).", discret: true });
    blocs.push({
      type: "tableau",
      colonnes: [{ titre: "Formulation", largeur: 70 }, { titre: "Âge", largeur: 16 }, { titre: "Gâchées", largeur: 18, alignement: "d" }, { titre: "Étudiants", largeur: 18, alignement: "d" }, { titre: "UCS min – max (kPa)", largeur: 40, alignement: "d" }],
      lignes: lignesGroupes,
    });
  }

  blocs.push({ type: "texte", texte: `Seuils des alertes (valeurs par défaut) : ${libellesSeuils().join(" ")}`, discret: true });
  for (const e of etudiants) {
    blocs.push({ type: "saut" });
    blocs.push(...chapitreEtudiant(e, ctx));
  }
  return { ...enTete(ctx, "Rapport de session"), blocs };
}

/** Le chapitre d'un seul étudiant. */
export function documentRapportEtudiant(e: EtudiantClasse, ctx: ContexteRapport): DocumentRapport {
  return { ...enTete(ctx, `Rapport — ${e.nom}`), blocs: chapitreEtudiant(e, ctx) };
}
