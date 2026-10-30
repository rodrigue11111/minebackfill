// frontend/src/lib/formules-enseignant.ts
// Fiches de formules de l'enseignant (2026-10-29, demande n° 23) : une COUCHE
// par-dessus le catalogue figé du cours (formulas-data.ts), jamais une
// modification de celui-ci. Module PUR : modèle, fusion, validation,
// comparaison.
//
// Trois choses distinctes, à ne jamais confondre :
//  - la fiche pédagogique, éditable par l'enseignant (ce module) ;
//  - la publication reçue par les étudiants (store, minebackfill_formules_publiees) ;
//  - l'équation qu'utilise le calculateur : celle du COURS. La fiche fx d'un
//    résultat (FormulaPopover) montre toujours la version du cours ; modifier
//    une fiche ne change aucun calcul (règle du CLAUDE.md, recette 6).

import { FORMULAS, type Formula, type FormulaVariable } from "./formulas-data";

/** Champs qu'un enseignant peut écrire sur une fiche. */
export interface ContenuFiche {
  title: string;
  section: string;
  equationLatex: string;
  equationPlainText: string;
  variables: FormulaVariable[];
  contextSnippet: string;
  keywords: string[];
}

/** Fiche ajoutée par l'enseignant : id « E001 », « E002 »… (jamais F###). */
export interface FicheAjoutee extends ContenuFiche {
  id: string;
}

export interface CoucheFormules {
  /** Fiches du cours modifiées, par id du cours (« F009 »). */
  modifiees: Record<string, ContenuFiche>;
  ajoutees: FicheAjoutee[];
}

export type OrigineFiche = "cours" | "modifiee" | "ajoutee";

/** Fiche affichée : une fiche du cours, modifiée ou ajoutée. Une fiche ajoutée n'a pas de page de cours. */
export type FormuleAffichee = Omit<Formula, "pageNumber"> & {
  pageNumber: number | null;
  origine: OrigineFiche;
  /** Fiche du cours d'origine (fiche modifiée) : version de référence, liens de dérivation. */
  cours?: Formula;
};

export const coucheVide = (): CoucheFormules => ({ modifiees: {}, ajoutees: [] });

export const coucheEstVide = (c: CoucheFormules): boolean =>
  Object.keys(c.modifiees).length === 0 && c.ajoutees.length === 0;

/** Bornes de validation (aussi affichées par l'éditeur). */
export const BORNES = {
  titre: 200, section: 120, equation: 2000, texte: 2000, contexte: 4000,
  variables: 40, symbole: 100, description: 300, unite: 40,
  motsCles: 30, motCle: 60, ajoutees: 300, octets: 256 * 1024,
} as const;

export const FORMAT_ID_AJOUTEE = /^E\d{3}$/;

/* ── Fusion ────────────────────────────────────────────────────────────── */

const LIENS_VIDES = { derivedFrom: [], derivesInto: [], derivationNote: null };

/**
 * Catalogue affiché : les fiches du cours dans leur ordre (remplacées par leur
 * version modifiée s'il y en a une), puis les fiches ajoutées. Une fiche
 * modifiée garde son id, sa page et ses liens de dérivation (ceux du cours :
 * l'écran les présente comme tels).
 */
export function fusionnerFormules(base: Formula[], couche: CoucheFormules): FormuleAffichee[] {
  const cours = base.map((f): FormuleAffichee => {
    const m = couche.modifiees[f.id];
    return m ? { ...f, ...m, origine: "modifiee", cours: f } : { ...f, origine: "cours" };
  });
  const ajoutees = couche.ajoutees.map((a): FormuleAffichee => ({
    ...a,
    subtitle: "",
    chapter: "Ajoutée par l'enseignant",
    pageNumber: null,
    derivationLinks: LIENS_VIDES,
    origine: "ajoutee",
  }));
  return [...cours, ...ajoutees];
}

/** Sections dans l'ordre d'apparition (les nouvelles à la fin). */
export const sectionsDe = (liste: Pick<Formula, "section">[]): string[] => [...new Set(liste.map((f) => f.section))];

/** Variables (symboles) dans l'ordre d'apparition. */
export const variablesDe = (liste: Pick<Formula, "variables">[]): string[] =>
  [...new Set(liste.flatMap((f) => f.variables.map((v) => v.symbol)))];

/** Prochain id de fiche ajoutée : « E001 », puis le plus grand numéro + 1. */
export function prochainIdAjoute(couche: CoucheFormules): string {
  const max = couche.ajoutees.reduce((m, a) => (FORMAT_ID_AJOUTEE.test(a.id) ? Math.max(m, Number(a.id.slice(1))) : m), 0);
  return `E${String(max + 1).padStart(3, "0")}`;
}

/* ── Validation ────────────────────────────────────────────────────────── */

export interface Rejet { id: string; raison: string }

const estTexte = (x: unknown, max: number, requis: boolean): string | null => {
  if (typeof x !== "string") return "texte attendu";
  if (requis && x.trim() === "") return "obligatoire";
  if (x.length > max) return `${max} caractères au plus`;
  return null;
};

/** Erreurs d'un contenu de fiche, par champ (vide : contenu valide). L'éditeur affiche ces messages sous les champs. */
export function erreursContenu(x: unknown): Partial<Record<keyof ContenuFiche, string>> {
  const e: Partial<Record<keyof ContenuFiche, string>> = {};
  if (!x || typeof x !== "object") return { title: "fiche illisible" };
  const c = x as Record<string, unknown>;
  const t = (champ: keyof ContenuFiche, max: number, requis: boolean) => {
    const m = estTexte(c[champ], max, requis);
    if (m) e[champ] = m;
  };
  t("title", BORNES.titre, true);
  t("section", BORNES.section, true);
  t("equationLatex", BORNES.equation, true);
  t("equationPlainText", BORNES.texte, false);
  t("contextSnippet", BORNES.contexte, false);
  if (!Array.isArray(c.variables)) e.variables = "liste attendue";
  else if (c.variables.length > BORNES.variables) e.variables = `${BORNES.variables} variables au plus`;
  else {
    const fautive = c.variables.findIndex((v) => {
      if (!v || typeof v !== "object") return true;
      const w = v as Record<string, unknown>;
      return estTexte(w.symbol, BORNES.symbole, true) !== null
        || estTexte(w.description, BORNES.description, false) !== null
        || !(w.unit === null || estTexte(w.unit, BORNES.unite, false) === null);
    });
    if (fautive >= 0) e.variables = `variable ${fautive + 1} : symbole obligatoire (${BORNES.symbole} car.), description ${BORNES.description} car., unité ${BORNES.unite} car.`;
  }
  if (!Array.isArray(c.keywords)) e.keywords = "liste attendue";
  else if (c.keywords.length > BORNES.motsCles) e.keywords = `${BORNES.motsCles} mots-clés au plus`;
  else if (c.keywords.some((k) => estTexte(k, BORNES.motCle, true) !== null)) e.keywords = `mots-clés non vides, ${BORNES.motCle} caractères au plus`;
  return e;
}

/** Copie propre d'un contenu valide (sans champ en trop). */
const contenu = (c: ContenuFiche): ContenuFiche => ({
  title: c.title, section: c.section, equationLatex: c.equationLatex, equationPlainText: c.equationPlainText,
  variables: c.variables.map((v) => ({ symbol: v.symbol, description: v.description, unit: v.unit ?? null })),
  contextSnippet: c.contextSnippet, keywords: [...c.keywords],
});

const tailleOctets = (x: unknown): number => new TextEncoder().encode(JSON.stringify(x)).length;

/**
 * Couche valide et liste des rejets. Une fiche fautive est écartée de la
 * couche rendue et nommée dans les rejets : l'enseignant ne publie pas tant
 * qu'il en reste, et une publication reçue avec un seul rejet est refusée en
 * bloc (la dernière version valide est gardée).
 */
export function validerCouche(x: unknown, idsCours: ReadonlySet<string> = IDS_COURS): { couche: CoucheFormules; rejets: Rejet[] } {
  const rejets: Rejet[] = [];
  const couche = coucheVide();
  if (!x || typeof x !== "object") return { couche, rejets: [{ id: "*", raison: "couche illisible" }] };
  const brut = x as { modifiees?: unknown; ajoutees?: unknown };
  if (tailleOctets(x) > BORNES.octets) rejets.push({ id: "*", raison: `plus de ${BORNES.octets / 1024} Ko au total` });

  if (brut.modifiees !== undefined && (typeof brut.modifiees !== "object" || brut.modifiees === null || Array.isArray(brut.modifiees))) {
    rejets.push({ id: "*", raison: "fiches modifiées illisibles" });
  } else {
    for (const [id, c] of Object.entries((brut.modifiees ?? {}) as Record<string, unknown>)) {
      if (!idsCours.has(id)) { rejets.push({ id, raison: "pas une fiche du cours" }); continue; }
      const e = erreursContenu(c);
      if (Object.keys(e).length > 0) { rejets.push({ id, raison: Object.entries(e).map(([k, v]) => `${k} : ${v}`).join(" ; ") }); continue; }
      couche.modifiees[id] = contenu(c as ContenuFiche);
    }
  }

  if (brut.ajoutees !== undefined && !Array.isArray(brut.ajoutees)) {
    rejets.push({ id: "*", raison: "fiches ajoutées illisibles" });
  } else {
    const vus = new Set<string>();
    const liste = (brut.ajoutees ?? []) as unknown[];
    if (liste.length > BORNES.ajoutees) rejets.push({ id: "*", raison: `${BORNES.ajoutees} fiches ajoutées au plus` });
    for (const a of liste.slice(0, BORNES.ajoutees)) {
      const id = a && typeof a === "object" ? (a as { id?: unknown }).id : undefined;
      if (typeof id !== "string" || !FORMAT_ID_AJOUTEE.test(id)) { rejets.push({ id: String(id ?? "?"), raison: "identifiant attendu de la forme E001" }); continue; }
      if (vus.has(id)) { rejets.push({ id, raison: "identifiant en double" }); continue; }
      vus.add(id);
      const e = erreursContenu(a);
      if (Object.keys(e).length > 0) { rejets.push({ id, raison: Object.entries(e).map(([k, v]) => `${k} : ${v}`).join(" ; ") }); continue; }
      couche.ajoutees.push({ id, ...contenu(a as ContenuFiche) });
    }
  }
  return { couche, rejets };
}

export const IDS_COURS: ReadonlySet<string> = new Set(FORMULAS.map((f) => f.id));

/* ── Publication ───────────────────────────────────────────────────────── */

/** Contenu d'une publication (enveloppe {v: 1, data}) et de sa copie locale. */
export interface PublicationFormules {
  couche: CoucheFormules;
  publieeLe: string;
  publieePar: string | null;
}

export const FORMAT_PUBLICATION = 1;

/**
 * Lecture d'une publication reçue. null : version inconnue, contenu illisible
 * ou une seule fiche rejetée (tout ou rien : on ne montre jamais aux étudiants
 * une partie de ce que l'enseignant a publié).
 */
export function lirePublication(env: unknown): PublicationFormules | null {
  if (!env || typeof env !== "object") return null;
  const { v, data } = env as { v?: unknown; data?: unknown };
  if (v !== FORMAT_PUBLICATION || !data || typeof data !== "object") return null;
  const d = data as { couche?: unknown; publieeLe?: unknown; publieePar?: unknown };
  if (typeof d.publieeLe !== "string" || !(d.publieePar === null || typeof d.publieePar === "string")) return null;
  const { couche, rejets } = validerCouche(d.couche);
  return rejets.length > 0 ? null : { couche, publieeLe: d.publieeLe, publieePar: d.publieePar };
}

/* ── Comparaison ───────────────────────────────────────────────────────── */

const stable = (x: unknown): unknown => {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable((x as Record<string, unknown>)[k])]));
  }
  return x;
};

/** Même contenu, quel que soit l'ordre des clés (« Modifications non publiées »). */
export const memeCouche = (a: CoucheFormules, b: CoucheFormules): boolean =>
  JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** Copie profonde (brouillon de départ, copie figée envoyée à la publication). */
export const copierCouche = (c: CoucheFormules): CoucheFormules => JSON.parse(JSON.stringify(c));

/* ── Ce que voit chacun ────────────────────────────────────────────────── */

/**
 * Propriétaire du brouillon de la personne connectée : l'enseignant (son
 * uid), « local » en mode sans compte (tout le monde a la vue enseignant), et
 * personne sinon : un étudiant n'a jamais de brouillon.
 */
export function proprietaireFormules(session: { userId: string; role: string } | null, modeSansCompte: boolean): string | null {
  if (session?.role === "prof") return session.userId;
  if (!session && modeSansCompte) return "local";
  return null;
}

export interface VueFormules {
  liste: FormuleAffichee[];
  carte: Map<string, FormuleAffichee>;
  sections: string[];
  variables: string[];
  /** Brouillon du propriétaire (null : pas de brouillon, ou pas d'enseignant). */
  brouillon: CoucheFormules | null;
  publication: PublicationFormules | null;
  /** Le brouillon diffère de la publication. */
  nonPubliees: boolean;
}

/**
 * Catalogue montré : le brouillon de SON propriétaire, sinon la publication
 * reçue, sinon le cours. Un brouillon d'un autre compte n'est jamais montré.
 */
export function vueFormules(
  brouillons: Record<string, CoucheFormules>,
  publication: PublicationFormules | null,
  proprietaire: string | null,
): VueFormules {
  const brouillon = proprietaire ? brouillons[proprietaire] ?? null : null;
  const active = brouillon ?? publication?.couche ?? coucheVide();
  const liste = fusionnerFormules(FORMULAS, active);
  return {
    liste,
    carte: new Map(liste.map((f) => [f.id, f])),
    sections: sectionsDe(liste),
    variables: variablesDe(liste),
    brouillon,
    publication,
    nonPubliees: brouillon !== null && !memeCouche(brouillon, publication?.couche ?? coucheVide()),
  };
}
