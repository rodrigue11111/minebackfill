// frontend/src/lib/gachee.ts
// Modèle « gâchée réelle » : ce que l'étudiant a VRAIMENT préparé au laboratoire
// (pesées réelles, lots, humidité mesurée, mesures fraîches, ajustements), relié
// à une formulation théorique. C'est le maillon manquant entre la recette
// calculée et les éprouvettes/essais (phases suivantes). Types + helpers PURS.

import type { Recipe } from "./types";
import { dateEcheance, type Eprouvette } from "./eprouvette";
import type { ProtocoleFige } from "./protocole";

export type StatutGachee = "brouillon" | "terminee";

/**
 * Instantané des paramètres de la formulation d'origine (traçabilité et axes
 * des résultats UCS mesurés). Capturé à la création de la gâchée pour rester
 * stable même si la formulation source est modifiée ou supprimée.
 */
/** Pesées de l'essai de teneur en eau de la pâte (g, tare incluse). */
export interface EtuvePate {
  tareG?: number;
  /** Tare + pâte humide. */
  mhG?: number;
  /** Tare + pâte sèche, après étuvage. */
  msG?: number;
}

export interface ParametresFormulation {
  cwPct?: number; // concentration solide Cw (solids_mass_pct)
  wcRatio?: number; // rapport eau/liant (wc_ratio)
  bwPct?: number; // dosage en liant Bw (bw_mass_pct)
  wPct?: number; // teneur en eau w (w_mass_pct)
  /** Fraction de granulat A_m (aggregate_mass_pct), % des solides hors liant ; 0 en RPC.
   *  Ajoutée le 2026-10-20 : absente des gâchées plus anciennes. */
  amPct?: number;
}

/** Un composant à peser : masse CIBLE (théorique) vs masse RÉELLEMENT pesée. */
export interface ComposantPese {
  cle: string; // "residu" | "granulat" | "liant" | "liant:0" | "eau"
  label: string;
  cibleKg: number;
  peseeKg?: number;
}

export interface Ajustement {
  id: string;
  type: "eau" | "residu" | "granulat" | "liant";
  masseKg: number;
  note?: string;
}

/** Eau de gâchage. */
export type TypeEau = "robinet" | "procede" | "distillee" | "autre";

/** Mode de cure des éprouvettes. */
export type ModeCure = "chambre_humide" | "immersion" | "ambiante" | "scellee" | "autre";

/** Listes fermées de la fiche d'essai (libellés à valider par le professeur). */
export const TYPES_EAU: { valeur: TypeEau; libelle: string }[] = [
  { valeur: "robinet", libelle: "Eau du robinet" },
  { valeur: "procede", libelle: "Eau de procédé" },
  { valeur: "distillee", libelle: "Eau distillée" },
  { valeur: "autre", libelle: "Autre" },
];
export const MODES_CURE: { valeur: ModeCure; libelle: string }[] = [
  { valeur: "chambre_humide", libelle: "Chambre humide" },
  { valeur: "immersion", libelle: "Immersion" },
  { valeur: "ambiante", libelle: "Air ambiant" },
  { valeur: "scellee", libelle: "Scellée (sac ou film)" },
  { valeur: "autre", libelle: "Autre" },
];
export const UNITES_DOSAGE_ADJUVANT = ["ml/100 kg", "% liant", "autre"] as const;

/**
 * Instantané des MATÉRIAUX réellement employés (fiche d'essai). Rempli à la
 * création depuis la formulation (lib/gachee-materiaux.ts), modifiable ensuite.
 * Il porte l'identité et les valeurs entrées dans le calcul (Gs, w₀), pas la
 * caractérisation du résidu (granulométrie, chimie) : celle-ci vit une seule
 * fois dans le catalogue et se joint par `id` à l'export. Tout est facultatif.
 */
export interface MateriauxGachee {
  residu?: { id?: string; nom?: string; provenance?: string; gs?: number; w0Pct?: number; catalogue?: "officiel" | "perso" };
  granulat?: { id?: string; nom?: string; provenance?: string; gs?: number; humiditePct?: number };
  liants?: { id?: string; code?: string; nom?: string; gs?: number; fractionPct?: number }[];
  eau?: { type?: TypeEau; note?: string };
  adjuvant?: { nom?: string; dosage?: number; dosageUnite?: "ml/100 kg" | "% liant" | "autre"; note?: string };
}

/** Conditions de cure des éprouvettes de la gâchée (facultatif). */
export interface CureGachee {
  mode?: ModeCure;
  temperatureC?: number;
  humiditePct?: number;
  note?: string;
}

/**
 * Un groupe de la fiche d'essai sans valeur vide : les clés undefined ou ""
 * disparaissent, un sous-groupe vide aussi, et un groupe vide devient
 * undefined. Saisir puis effacer un champ redonne donc la gâchée d'avant
 * (même empreinte : rien à envoyer, pas de « modifiée depuis la revue »).
 */
export function groupeSansVide<T extends object>(o: T | undefined): T | undefined {
  if (!o) return undefined;
  const r = Object.fromEntries(Object.entries(o).filter(([, v]) =>
    v !== undefined && v !== "" && !(typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)));
  return Object.keys(r).length > 0 ? (r as T) : undefined;
}

/** Matériaux de la fiche nettoyés (groupeSansVide à chaque niveau) ; un
 *  adjuvant sans nom ne garde ni dosage ni unité. */
export function materiauxSansVide(m: MateriauxGachee | undefined): MateriauxGachee | undefined {
  if (!m) return undefined;
  let adjuvant = m.adjuvant;
  if (adjuvant && !adjuvant.nom?.trim()) {
    adjuvant = { ...adjuvant };
    delete adjuvant.dosage;
    delete adjuvant.dosageUnite;
  }
  return groupeSansVide({
    ...m,
    residu: groupeSansVide(m.residu), granulat: groupeSansVide(m.granulat),
    eau: groupeSansVide(m.eau), adjuvant: groupeSansVide(adjuvant),
  });
}

export interface Gachee {
  id: string;
  code: string; // auto « G-AAAAMMJJ-NN »
  creeLe: string; // ISO
  statut: StatutGachee;

  // Formulation d'origine (instantané minimal — traçabilité).
  formulationLabel: string;
  formulationId?: string; // id d'un SavedResult, si issu d'une sauvegarde
  categorie: string; // RPC | RPG | RRC
  recetteIndex: number; // n° de recette dans la formulation (0-indexé)
  solverVersion?: string;

  // Pesées cibles vs réelles + seuil de tolérance (%).
  composants: ComposantPese[];
  tolerancePct: number;

  // Lots de matériaux (traçabilité).
  lotResidu?: string;
  lotGranulat?: string;
  lotLiant?: string;

  // Mesures au labo.
  w0MesurePct?: number; // humidité réelle du résidu
  slumpMesureMm?: number;
  temperatureC?: number;
  wMesurePct?: number;
  cwMesurePct?: number;
  /**
   * Teneur en eau de la pâte à l'étuve (ASTM D2216), masses en grammes, tare
   * incluse (2026-10-30). Saisie avant dans Calculs (essai-erreur) ; m_s ne
   * se mesure qu'après environ 24 h d'étuve, quand la gâchée existe déjà.
   * Complètes et cohérentes, elles fixent cwMesurePct (majEtuve).
   */
  etuvePate?: EtuvePate;

  // Essai-erreur : ce qui a été ajouté après le premier malaxage.
  ajustements: Ajustement[];
  observations?: string;

  // Éprouvettes moulées à partir de cette gâchée (mise en cure, écrasement).
  eprouvettes: Eprouvette[];

  // Instantané des paramètres de la recette (Cw, E/L, Bw, w) — traçabilité.
  parametres?: ParametresFormulation;

  // Instantané FIGÉ des protocoles suivis (procédures au moment de la gâchée).
  protocolesSnapshot?: ProtocoleFige[];

  // Copie de conflit (synchronisation v2) : modifiée ici pendant qu'un autre
  // appareil la modifiait aussi. Les deux versions sont gardées ; celle-ci est
  // EXCLUE des figures (sinon la même gâchée compterait deux fois).
  conflit?: { de: string; le: string };

  // Session de cours active à la création (sessions publiées par l'enseignant).
  sessionId?: string;

  // Fiche d'essai (tout est FACULTATIF : rien ne bloque la saisie ni le calcul).
  // Groupes imbriqués : les modifier par une copie complète du groupe
  // (`onMaj({ cure: { ...g.cure, mode } })`), car la mise à jour du magasin
  // fusionne au premier niveau seulement. Ne jamais leur donner de valeur par
  // défaut au chargement : l'empreinte de chaque gâchée changerait et toute la
  // classe serait renvoyée en ligne.
  materiaux?: MateriauxGachee;
  cure?: CureGachee;
  malaxageDureeMin?: number;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Écart pesée − cible (kg et %), ou null si rien de pesé. */
export function ecart(c: ComposantPese): { kg: number; pct: number } | null {
  if (c.peseeKg === undefined || !Number.isFinite(c.peseeKg)) return null;
  const kg = c.peseeKg - c.cibleKg;
  const pct = c.cibleKg !== 0 ? (kg / Math.abs(c.cibleKg)) * 100 : 0;
  return { kg, pct };
}

/** Vrai si l'écart d'un composant dépasse la tolérance (en valeur absolue). */
export function horsTolerance(c: ComposantPese, tolerancePct: number): boolean {
  const e = ecart(c);
  return e !== null && Math.abs(e.pct) > tolerancePct;
}

const nombreFr = (v: number, d: number) => v.toLocaleString("fr-CA", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Masse lisible d'une pesée : sous 1 kg en grammes (« 47,5 g »), sinon en
 * kilogrammes à trois décimales (« 1,234 kg »). Arrondir 0,047 kg à 0,1 kg
 * affichait « 0,0 kg » pour le ciment d'une petite gâchée.
 */
export function masseLisible(kg: number): string {
  return Math.abs(kg) < 1 ? `${nombreFr(kg * 1000, 1)} g` : `${nombreFr(kg, 3)} kg`;
}

/** Unité de saisie des pesées, choisie par l'étudiant (Réglages ou en tête des pesées). */
export type UnitePesee = "g" | "kg";

/** Décimales affichées d'une masse dans l'unité de saisie (kg : 4 sous 1 kg, sinon 3). */
const decimalesPesee = (kg: number, unite: UnitePesee) => (unite === "g" ? 1 : Math.abs(kg) < 1 ? 4 : 3);

/**
 * Valeur d'une pesée dans le champ de saisie (la gâchée garde des kg).
 * Arrondie au milligramme : 0,0543 kg s'affiche 54,3 et non 54,300000000000004.
 */
export function peseeVersSaisie(kg: number | undefined, unite: UnitePesee): number | undefined {
  if (kg === undefined || !Number.isFinite(kg)) return undefined;
  return unite === "g" ? Math.round(kg * 1e6) / 1e3 : Math.round(kg * 1e6) / 1e6;
}

/** Masse saisie, rangée en kg. */
export function saisieVersPesee(n: number, unite: UnitePesee): number {
  return unite === "g" ? n / 1000 : n;
}

/**
 * Cible d'une pesée dans l'unité de saisie : « 54,3 g », « 1 234,5 g » ;
 * en kg, « 0,0543 kg (54,3 g) » sous 1 kg, sinon « 1,235 kg ». Avant, le champ
 * était toujours en kg alors que la cible s'affichait en grammes : taper « 54 »
 * pour 54,3 g donnait un écart de +99 000 %.
 */
export function cibleLisible(kg: number, unite: UnitePesee): string {
  if (unite === "g") return `${nombreFr(kg * 1000, 1)} g`;
  return Math.abs(kg) < 1 ? `${nombreFr(kg, 4)} kg (${masseLisible(kg)})` : `${nombreFr(kg, 3)} kg`;
}

/** Plage acceptée par la tolérance, dans l'unité de saisie (« 53,3 à 55,4 g »). */
export function plageTolerance(cibleKg: number, tolerancePct: number, unite: UnitePesee): string {
  const bas = cibleKg * (1 - tolerancePct / 100);
  const haut = cibleKg * (1 + tolerancePct / 100);
  const d = decimalesPesee(cibleKg, unite);
  return unite === "g"
    ? `${nombreFr(bas * 1000, d)} à ${nombreFr(haut * 1000, d)} g`
    : `${nombreFr(bas, d)} à ${nombreFr(haut, d)} kg`;
}

/** Nombre de composants pesés hors tolérance. */
export function nbHorsTolerance(g: Gachee): number {
  return g.composants.filter((c) => horsTolerance(c, g.tolerancePct)).length;
}

/**
 * Code de gâchée « G-AAAAMMJJ-NN » : NN incrémente parmi les gâchées du même
 * jour (déduit des codes existants), pour rester lisible et unique localement.
 */
export function genererCode(existantes: Gachee[], date: Date): string {
  // Date LOCALE (2026-10-30) : en UTC, une gâchée créée le 29 octobre après
  // 20 h, heure de l'Est, recevait le code du 30. Les codes déjà donnés ne
  // changent pas : ils sont imprimés sur les étiquettes des éprouvettes.
  const jour = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const prefixe = `G-${jour}-`;
  const max = existantes
    .filter((g) => g.code.startsWith(prefixe))
    .map((g) => parseInt(g.code.slice(prefixe.length), 10))
    .filter((n) => Number.isInteger(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefixe}${String(max + 1).padStart(2, "0")}`;
}

/**
 * Composants à peser déduits d'une recette calculée : résidu HUMIDE (ce qu'on
 * pèse réellement), granulat sec, liant(s) — détaillés si plusieurs ciments —,
 * et eau à ajouter. Les composants nuls sont omis.
 */
export function composantsDepuisRecette(r: Recipe, nomLiant: (i: number) => string): ComposantPese[] {
  const c = r.components ?? {};
  const out: ComposantPese[] = [];

  const rh = num(c.residue_wet_mass_kg);
  if (rh > 0) out.push({ cle: "residu", label: "Résidu humide", cibleKg: rh });

  const g = num(c.aggregate_dry_mass_kg);
  if (g > 0) out.push({ cle: "granulat", label: "Granulat", cibleKg: g });

  const masses = (c.binder_masses_kg ?? []).map(num);
  if (masses.filter((m) => m > 0).length > 1) {
    // Détail par ciment. On garde l'indice RÉEL dans le système de liant : ne
    // pas ré-indexer après avoir sauté les masses nulles, sinon l'étiquette et
    // la clé se décalent par rapport au vrai liant.
    masses.forEach((m, i) => {
      if (m > 0) out.push({ cle: `liant:${i}`, label: nomLiant(i + 1), cibleKg: m });
    });
  } else {
    const b = num(c.binder_total_mass_kg);
    if (b > 0) out.push({ cle: "liant", label: "Liant", cibleKg: b });
  }

  // Eau : uniquement ce qu'il faut AJOUTER. Une valeur négative signifie « eau à
  // retirer » (résidu livré plus humide que le Cw cible) — ce n'est pas une
  // pesée, on l'omet donc de la liste des composants à peser.
  const eau = num(c.water_to_add_mass_kg);
  if (eau > 0) out.push({ cle: "eau", label: "Eau à ajouter", cibleKg: eau });

  return out;
}

/**
 * État AFFICHÉ d'une gâchée (2026-10-30, demande de l'utilisateur) : une
 * gâchée dont les éprouvettes sont en cure n'est plus un « Brouillon »,
 * l'opérateur y revient à 7, 28 ou 56 jours pour les écraser. Le statut
 * enregistré ne change pas (brouillon ou terminée, posé par « Marquer
 * terminée ») : seul le libellé se déduit des éprouvettes.
 */
export type EtatGachee = "brouillon" | "en_cure" | "ecrasee" | "terminee";

/** Ton de la pastille de chaque état (kit du site). */
export const TON_ETAT_GACHEE = { brouillon: "neutre", en_cure: "accent", ecrasee: "alerte", terminee: "succes" } as const;

export function etatGachee(g: Pick<Gachee, "statut" | "eprouvettes">): { etat: EtatGachee; libelle: string; detail?: string } {
  if (g.statut === "terminee") return { etat: "terminee", libelle: "Terminée" };
  const eprouvettes = g.eprouvettes ?? [];
  if (eprouvettes.length === 0) return { etat: "brouillon", libelle: "Brouillon" };
  const enCure = eprouvettes.filter((e) => e.statut !== "ecrase");
  if (enCure.length === 0) {
    return { etat: "ecrasee", libelle: "Écrasements faits", detail: "Toutes les éprouvettes sont écrasées : marquez la gâchée terminée quand sa fiche est complète." };
  }
  const prochaine = new Date(Math.min(...enCure.map((e) => dateEcheance(e).getTime())));
  const jour = prochaine.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  return { etat: "en_cure", libelle: "En attente d'écrasement", detail: `Prochain écrasement le ${jour} (${enCure.length} éprouvette${enCure.length > 1 ? "s" : ""} en cure).` };
}

/** Instantané des paramètres (Cw, E/L, Bw, w) d'une recette calculée. */
export function parametresDepuisRecette(r: Recipe): ParametresFormulation {
  const val = (v: number | null | undefined): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  return {
    cwPct: val(r.solids_mass_pct),
    wcRatio: val(r.wc_ratio),
    bwPct: val(r.bw_mass_pct),
    wPct: val(r.w_mass_pct),
    amPct: val(r.aggregate_mass_pct),
  };
}

const nombreCourt = (v: number) => v.toLocaleString("fr-CA", { maximumFractionDigits: 2 });

/**
 * Repère court d'une recette, pour la reconnaître au Labo (2026-10-30) :
 * « Cw 70 % · Bw 4,5 % · E/L 14,71 », avec « Am 30 % » en RPG. Les valeurs
 * absentes sont omises ; rien d'affichable : chaîne vide.
 */
export function resumeParametres(p: ParametresFormulation | undefined): string {
  if (!p) return "";
  return [
    p.cwPct !== undefined ? `Cw ${nombreCourt(p.cwPct)} %` : null,
    p.bwPct !== undefined ? `Bw ${nombreCourt(p.bwPct)} %` : null,
    p.wcRatio !== undefined ? `E/L ${nombreCourt(p.wcRatio)}` : null,
    p.amPct ? `Am ${nombreCourt(p.amPct)} %` : null,
  ].filter(Boolean).join(" · ");
}

/**
 * Paramètres de formulation d'une gâchée, avec repli sur la formulation
 * d'origine.
 *
 * `Gachee.parametres` est optionnel et n'a jamais été rempli rétroactivement :
 * les gâchées créées avant son introduction affichent « — » et sont
 * intraçables. Plutôt qu'une migration de la clé localStorage — qui ne
 * s'exécute qu'une fois et doit deviner le bon moment — on résout
 * PARESSEUSEMENT à la lecture, via `formulationId` + `recetteIndex`.
 *
 * Ces deux champs étaient jusqu'ici écrits puis jamais relus. Ils servent
 * enfin.
 *
 * Aucune formule nouvelle : `parametresDepuisRecette` recopie des sorties de
 * solveur déjà calculées.
 *
 * Type structurel minimal en second paramètre, pour ne pas importer le store
 * ici (ce module doit rester pur et testable sans DOM).
 */
export function parametresEffectifs(
  g: Gachee,
  formulations: { id: string; recipes: Recipe[] }[],
): ParametresFormulation | undefined {
  if (g.parametres) return g.parametres;
  if (!g.formulationId) return undefined;
  const form = formulations.find((f) => f.id === g.formulationId);
  if (!form || !form.recipes?.length) return undefined;
  const i = Math.min(Math.max(g.recetteIndex ?? 0, 0), form.recipes.length - 1);
  return parametresDepuisRecette(form.recipes[i]);
}

/** Une étape du fil d'une gâchée (Labo). */
export interface EtapeGachee {
  n: number;
  libelle: string;
  etat: "faite" | "en_cours" | "a_venir";
}

/**
 * Fil d'une gâchée, du malaxage à l'UCS : où en est l'étudiant, déduit de ce
 * qu'il a déjà saisi (rien n'est demandé en plus). 1 Gâchée : pesées
 * saisies ; 2 Moulage : éprouvettes moulées ; 3 Cure : éprouvettes en cure ;
 * 4 Écrasement : au moins une écrasée ; 5 UCS : au moins une mesure.
 */
export function etapesGachee(g: Pick<Gachee, "composants" | "eprouvettes">, ucsMesuree: (e: Gachee["eprouvettes"][number]) => boolean): EtapeGachee[] {
  const pesee = (g.composants ?? []).some((c) => c.peseeKg !== undefined);
  const moulees = (g.eprouvettes ?? []).length > 0;
  const ecrasees = (g.eprouvettes ?? []).filter((e) => e.statut === "ecrase");
  const enCure = (g.eprouvettes ?? []).some((e) => e.statut !== "ecrase");
  const mesure = ecrasees.some(ucsMesuree);
  // Faite ou pas ; la première étape pas encore faite est « en cours ». La
  // cure n'est faite que quand plus aucune éprouvette n'y est (des
  // éprouvettes de 7 j écrasées pendant que celles de 28 j durcissent : cure
  // en cours, écrasement et UCS déjà faits).
  const faites = [pesee || moulees, moulees, moulees && !enCure, ecrasees.length > 0, mesure];
  const libelles = ["Gâchée", "Moulage", "Cure", "Écrasement", "UCS"];
  const courante = faites.findIndex((f) => !f);
  return libelles.map((libelle, i) => ({ n: i + 1, libelle, etat: faites[i] ? "faite" : i === courante ? "en_cours" : "a_venir" }));
}

/**
 * Confirmation avant de supprimer une gâchée (2026-10-26 : le bouton est
 * désormais en tête de l'éditeur, il doit dire ce qui part avec elle).
 */
export function messageSuppressionGachee(g: Pick<Gachee, "code" | "eprouvettes">): string {
  const n = g.eprouvettes.length;
  const ce = n === 0 ? "" : ` Ses ${n} éprouvette${n > 1 ? "s" : ""} et leurs mesures seront supprimées, aussi en ligne si votre compte est relié.`;
  return `Supprimer la gâchée ${g.code} ?${ce} Action définitive.`;
}

/* ── Moules prévus par le calcul (2026-10-29) ─────────────────────────────
   Une éprouvette = un moule rempli. Le calcul sauvegardé dit combien de
   moules la pâte préparée devait remplir (« Nombre de moules par recette ») ;
   le Labo le rappelle et prévient au-delà, sans jamais bloquer : les
   dimensions des moules réels peuvent différer, le nombre seul ne prouve pas
   un manque de pâte. */

/** Moules par recette du calcul sauvegardé ; en essai-erreur, ceux de la méthode de base. undefined : inconnu (ancien calcul). */
export function moulesPrevus(sr: { method?: string; inputs?: unknown } | undefined): number | undefined {
  const i = sr?.inputs as { desired_qty?: unknown; base_cw?: { desired_qty?: unknown }; base_wb?: { desired_qty?: unknown } } | undefined;
  if (!i) return undefined;
  const brut = sr?.method === "essai" ? (i.base_cw?.desired_qty ?? i.base_wb?.desired_qty) : i.desired_qty;
  return typeof brut === "number" && Number.isFinite(brut) && brut >= 1 ? Math.round(brut) : undefined;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Rappel sous « Ajouter des éprouvettes » : « 9 moules prévus par le calcul, 6 déjà utilisés. » */
export function rappelMoules(prevus: number, utilises: number): string {
  return `${pluriel(prevus, "moule")} prévu${prevus > 1 ? "s" : ""} par le calcul, ${utilises} déjà utilisé${utilises > 1 ? "s" : ""}.`;
}

/** Avis (jamais un blocage) quand les éprouvettes demandées dépassent les moules prévus ; null sinon. */
export function avisMoules(prevus: number, existantes: number, ajout: number): string | null {
  const total = existantes + ajout;
  if (ajout <= 0 || total <= prevus) return null;
  // Le total seul (« 12 éprouvettes sont demandées ») se lisait comme le
  // nombre saisi dans le formulaire (2026-10-30) : on sépare ce qui existe
  // de ce qui s'ajoute.
  const verifiez = "Vérifiez leurs dimensions et le volume de pâte disponible.";
  if (existantes === 0) return `Le calcul prévoyait ${pluriel(prevus, "moule")} ; vous ajoutez ${pluriel(ajout, "éprouvette")}. ${verifiez}`;
  return `Le calcul prévoyait ${pluriel(prevus, "moule")}. La gâchée a déjà ${pluriel(existantes, "éprouvette")} ; `
    + `avec ${ajout > 1 ? `ces ${ajout}` : "celle-ci"}, elle en aura ${total}. ${verifiez}`;
}
