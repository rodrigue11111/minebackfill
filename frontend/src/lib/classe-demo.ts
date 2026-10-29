// frontend/src/lib/classe-demo.ts
// Démonstration de la page Classe (/classe?demo=1) : une classe FICTIVE de 6
// étudiants, construite en mémoire, et sa source de données (SourceClasse) qui
// répond sans réseau et n'enregistre rien.
//
// Pourquoi (2026-10-26) : montrer au professeur ce que permet le tableau de
// bord, surtout la comparaison, sans créer de faux comptes dans la base réelle
// (ils se mêleraient aux vrais étudiants).
//
// Ce qui est réel et ce qui ne l'est pas :
// - les RECETTES viennent du calculateur MineBackfill (classe-demo-recettes.json,
//   produit par backend/scripts/recettes_demo_classe.py et vérifié par
//   backend/app/tests/test_demo_classe.py) ;
// - les MESURES UCS sont inventées par un modèle simple (UCS28 et FACTEUR_AGE
//   ci-dessous), avec une dispersion pseudo-aléatoire à graine fixe : elles
//   illustrent les fonctions et n'ont aucune valeur expérimentale.
// Tout est déterministe pour une date donnée ; les dates sont relatives à
// aujourd'hui, pour que l'échéancier ait des échéances passées et à venir.

import type { LigneClasse, ProfilClasse } from "./classe";
import type { CompteClasse, DocComplet, LigneAnnotation } from "./classe-reseau";
import type { SourceClasse } from "./classe-source";
import { packById } from "./conventions";
import { genererCodeEprouvette, MOULES_PROPOSES, type CodeRupture, type Eprouvette } from "./eprouvette";
import { composantsDepuisRecette, genererCode, parametresDepuisRecette, type Gachee } from "./gachee";
import { materiauxDepuisFormulation } from "./gachee-materiaux";
import { nomLiant } from "./liants";
import { granulatsDefaut, residusDefaut } from "./materials";
import { protocolesDefaut, snapshotProtocoles } from "./protocole";
import type { RevueClasse } from "./revues";
import type { Session } from "./sessions";
import type { GeneralInfo, LiantCatalogueItem, SavedResult } from "./store";
import type { Recipe } from "./types";
import RECETTES from "./classe-demo-recettes.json";

/** Mention portée par l'écran et par chaque export de la démonstration. */
export const MENTION_DEMO =
  "Données fictives de démonstration : recettes calculées par le calculateur MineBackfill ; "
  + "mesures UCS inventées pour illustrer les fonctions, sans valeur expérimentale.";

export const ID_PROF_DEMO = "demo-enseignant";
const ID_SESSION_DEMO = "demo-session";

type CleFormulation = keyof typeof RECETTES.formulations;
type Formulation = (typeof RECETTES.formulations)[CleFormulation];

/** UCS à 28 j (kPa) de chaque formulation : modèle fictif, croissant avec Bw et Cw. */
const UCS28: Record<CleFormulation, number> = {
  laronde_bw5: 1000, laronde_bw3: 560, laronde_rpg: 1080, casa_bw6: 820, laronde_el: 900,
};
/** Part de la résistance à 28 j atteinte à chaque âge (modèle fictif). */
const FACTEUR_AGE: Record<number, number> = { 7: 0.42, 14: 0.65, 28: 1, 56: 1.22 };

const MOULE = MOULES_PROPOSES[1]; // cylindre 76,2 x 152,4 mm
const SECTION_M2 = Math.PI * (MOULE.diametreMm / 1000) ** 2 / 4;

const LIANTS_CATALOGUE: LiantCatalogueItem[] = [
  { id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.1543, origine: "officiel" },
  { id: "liant_slag", code: "SLAG", nom: "Laitier de haut fourneau (GGBFS)", gs: 2.8426, origine: "officiel" },
];

/* ── Hasard reproductible ─────────────────────────────────────────────── */

function graine(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire (mulberry32) : même clé, même suite. */
function hasard(cle: string): () => number {
  let a = graine(cle);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Facteur aléatoire dans [1 - amplitude, 1 + amplitude]. */
const autour = (alea: () => number, amplitude: number) => 1 + (alea() * 2 - 1) * amplitude;

/* ── Dates relatives à aujourd'hui ────────────────────────────────────── */

/** Midi local, `decalage` jours après (ou avant) `maintenant`, en ISO. */
function jour(maintenant: Date, decalage: number): string {
  return new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + decalage, 12, 0, 0).toISOString();
}
function dateCourte(maintenant: Date, decalage: number): string {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── Classe fictive ───────────────────────────────────────────────────── */

const ETUDIANTS = [
  { id: "demo-etu-alice", nom: "Alice Tremblay", courriel: "alice.tremblay@demo.invalid" },
  { id: "demo-etu-bruno", nom: "Bruno Gagnon", courriel: "bruno.gagnon@demo.invalid" },
  { id: "demo-etu-chloe", nom: "Chloé Roy", courriel: "chloe.roy@demo.invalid" },
  { id: "demo-etu-david", nom: "David Côté", courriel: "david.cote@demo.invalid" },
  { id: "demo-etu-emilie", nom: "Émilie Bouchard", courriel: "emilie.bouchard@demo.invalid" },
  { id: "demo-etu-felix", nom: "Félix Gauthier", courriel: "felix.gauthier@demo.invalid" },
  // 2026-10-26 : un étudiant plus chargé (2 calculs, 5 gâchées), pour voir la
  // fiche rangée par calcul ; ses gâchées, tirées de la formulation selon E/L
  // que personne d'autre ne gâche, ne forment aucun groupe de comparaison.
  { id: "demo-etu-gabriel", nom: "Gabriel Lavoie", courriel: "gabriel.lavoie@demo.invalid" },
] as const;
type IdEtudiant = (typeof ETUDIANTS)[number]["id"];

const LIBELLES: Record<CleFormulation, string> = {
  laronde_bw5: "LaRonde, Cw 75 %, Bw 5 %",
  laronde_bw3: "LaRonde, Cw 75 %, Bw 3 %",
  laronde_rpg: "RPG LaRonde, granulat 30 %, Bw 4 %",
  casa_bw6: "Casa Berardi, Cw 70 %, Bw 6 %",
  laronde_el: "LaRonde selon E/L",
};

/** Un calcul sauvegardé de l'étudiant, à partir d'une formulation figée (variante : un 2e calcul de la même formulation). */
function resultatDemo(etu: IdEtudiant, cle: CleFormulation, savedAt: string, variante?: string): SavedResult {
  const f: Formulation = RECETTES.formulations[cle];
  const liants = f.liants.map((l) => ({ id: l.id, code: l.code, fraction_pct: l.fraction_pct }));
  const general: GeneralInfo = {
    operator_name: ETUDIANTS.find((e) => e.id === etu)!.nom,
    project_name: "Démonstration",
    container_type: "rayon_hauteur",
    container_radius: f.moule.container_radius,
    container_height: f.moule.container_height,
    binders: liants,
    binder_count: liants.length,
    binder1_id: liants[0]?.id ?? null, binder1_type: liants[0]?.code ?? null, binder1_fraction_pct: liants[0]?.fraction_pct,
    binder2_id: liants[1]?.id ?? null, binder2_type: liants[1]?.code ?? null, binder2_fraction_pct: liants[1]?.fraction_pct,
    binder3_id: null, binder3_type: null,
  };
  const inputs: Record<string, unknown> = {
    residue_sg: f.residu.gs, residue_w_pct: f.residu.w0_pct, saturation_pct: 100,
    num_recipes: f.bw_pct.length, desired_qty: f.nb_moules, safety_factor: f.kappa,
    binder_pct: [...f.bw_pct, undefined, undefined, undefined, undefined].slice(0, 4),
  };
  if (f.cw_pct !== null) inputs.solid_mass_pct = f.cw_pct;
  if (f.el) inputs.wc_ratio = f.el;
  if (f.granulat) { inputs.aggregate_fraction_pct = f.granulat.am_pct; inputs.aggregate_sg = f.granulat.gs; }
  return {
    id: `demo-${etu}-${cle}${variante ? `-${variante}` : ""}`,
    savedAt,
    label: variante ? `${LIBELLES[cle]} (${variante})` : LIBELLES[cle],
    category: f.categorie as SavedResult["category"],
    method: f.methode as SavedResult["method"],
    general,
    recipes: f.recettes as unknown as Recipe[],
    inputs,
    solverVersion: "gramme-1.1",
    catalogue_liants: LIANTS_CATALOGUE.filter((l) => f.liants.some((x) => x.id === l.id)),
    constantes: packById("gramme")!.constantes,
    selectedMaterials: { residueId: f.residu.id, ...(f.granulat ? { aggregateId: f.granulat.id } : {}) },
    sessionId: ID_SESSION_DEMO,
  };
}

/** Âge visé et ce qui arrive à ses réplicats. */
interface AgeDemo {
  age: number;
  /** Écrasées si leur échéance est passée (sauf `retard`). */
  retard?: boolean;
  /** Facteurs propres à chaque réplicat (dispersion voulue, CV élevé). */
  facteurs?: number[];
  /** Index d'un réplicat écrasé 3 jours après l'âge visé (hors fenêtre d'âge). */
  horsFenetre?: number;
  /** Index d'un réplicat aberrant, exclu de la moyenne avec sa justification. */
  aberrant?: number;
}

interface GacheeDemoSpec {
  etu: IdEtudiant;
  cle: CleFormulation;
  /** Calcul d'une variante (RESULTATS.variante) ; absent : le calcul principal. */
  variante?: string;
  /** Recette du calcul (index) ; 0 par défaut. */
  recette?: number;
  /** Jours avant aujourd'hui (négatif) de la coulée. */
  coulee: number;
  ages: AgeDemo[];
  statut: Gachee["statut"];
  /** Facteur de la gâchée sur la résistance (1 = la formulation telle que prévue). */
  facteur?: number;
  peseeHorsTolerance?: boolean;
  observations?: string;
  ficheIncomplete?: boolean;
}

const SPECS: GacheeDemoSpec[] = [
  // Groupe 1 : RPC LaRonde, Cw 75 %, Bw 5 % (4 étudiants, médiane de repère).
  { etu: "demo-etu-alice", cle: "laronde_bw5", coulee: -60, statut: "terminee", ages: [{ age: 7 }, { age: 28 }, { age: 56 }] },
  { etu: "demo-etu-bruno", cle: "laronde_bw5", coulee: -58, statut: "terminee", ages: [{ age: 7 }, { age: 28, horsFenetre: 2 }, { age: 56 }],
    observations: "Écrasement de E06 décalé : presse indisponible." },
  { etu: "demo-etu-chloe", cle: "laronde_bw5", coulee: -45, statut: "brouillon", ages: [{ age: 7, aberrant: 1 }, { age: 28 }, { age: 56 }] },
  // Facteur 0,6 : environ 35 % sous la médiane du groupe (alerte « écart au groupe », seuil 30 %).
  { etu: "demo-etu-david", cle: "laronde_bw5", coulee: -40, statut: "terminee", facteur: 0.6, ages: [{ age: 7 }, { age: 28 }],
    observations: "Malaxage écourté : 3 minutes au lieu de 5." },
  // Groupe 2 : RPC LaRonde, Cw 75 %, Bw 3 % (3 étudiants).
  { etu: "demo-etu-alice", cle: "laronde_bw3", coulee: -30, statut: "terminee", ages: [{ age: 7 }, { age: 28 }] },
  { etu: "demo-etu-chloe", cle: "laronde_bw3", coulee: -29, statut: "brouillon", ages: [{ age: 7 }, { age: 28, retard: true }] },
  { etu: "demo-etu-emilie", cle: "laronde_bw3", coulee: -28, statut: "brouillon", ages: [{ age: 7 }, { age: 28 }] },
  // Groupe 3 : RPG LaRonde, granulat 30 %, Cw 78 %, Bw 4 % (2 étudiants).
  { etu: "demo-etu-bruno", cle: "laronde_rpg", coulee: -25, statut: "terminee", ages: [{ age: 7 }, { age: 28 }] },
  { etu: "demo-etu-felix", cle: "laronde_rpg", coulee: -30, statut: "brouillon", ages: [{ age: 7, facteurs: [0.75, 1, 1.3] }, { age: 56 }] },
  // Hors groupe : Casa Berardi, Cw 70 %, Bw 6 %.
  { etu: "demo-etu-emilie", cle: "casa_bw6", coulee: -35, statut: "terminee", peseeHorsTolerance: true, ficheIncomplete: true, ages: [{ age: 7 }, { age: 28 }] },
  // Étudiant chargé : 2 calculs selon E/L, 5 gâchées (hors groupe : seul à les gâcher).
  { etu: "demo-etu-gabriel", cle: "laronde_el", coulee: -48, statut: "terminee", ages: [{ age: 7 }, { age: 28 }] },
  { etu: "demo-etu-gabriel", cle: "laronde_el", recette: 1, coulee: -47, statut: "terminee", ages: [{ age: 7 }, { age: 28 }] },
  { etu: "demo-etu-gabriel", cle: "laronde_el", coulee: -40, statut: "brouillon", ages: [{ age: 7 }, { age: 28 }, { age: 56 }] },
  { etu: "demo-etu-gabriel", cle: "laronde_el", variante: "reprise", coulee: -18, statut: "brouillon", ages: [{ age: 7 }, { age: 28 }] },
  { etu: "demo-etu-gabriel", cle: "laronde_el", variante: "reprise", recette: 1, coulee: -15, statut: "brouillon", ages: [{ age: 7 }, { age: 28 }] },
];

/** Calculs sauvegardés (jours avant aujourd'hui), dont un sans gâchée (selon E/L). */
const RESULTATS: { etu: IdEtudiant; cle: CleFormulation; jour: number; variante?: string }[] = [
  { etu: "demo-etu-alice", cle: "laronde_bw5", jour: -62 },
  { etu: "demo-etu-alice", cle: "laronde_bw3", jour: -32 },
  { etu: "demo-etu-bruno", cle: "laronde_bw5", jour: -60 },
  { etu: "demo-etu-bruno", cle: "laronde_rpg", jour: -27 },
  { etu: "demo-etu-chloe", cle: "laronde_bw5", jour: -47 },
  { etu: "demo-etu-chloe", cle: "laronde_bw3", jour: -31 },
  { etu: "demo-etu-david", cle: "laronde_bw5", jour: -42 },
  { etu: "demo-etu-emilie", cle: "laronde_bw3", jour: -30 },
  { etu: "demo-etu-emilie", cle: "casa_bw6", jour: -37 },
  { etu: "demo-etu-felix", cle: "laronde_rpg", jour: -32 },
  { etu: "demo-etu-felix", cle: "laronde_el", jour: -40 },
  { etu: "demo-etu-gabriel", cle: "laronde_el", jour: -50 },
  { etu: "demo-etu-gabriel", cle: "laronde_el", jour: -20, variante: "reprise" },
];

const RUPTURES: CodeRupture[] = ["cone", "cone_fendage", "colonnaire", "diagonale"];

function gachee(maintenant: Date, s: GacheeDemoSpec, res: SavedResult, existantes: Gachee[]): { g: Gachee; maj: string; rev: number } {
  const alea = hasard(`${s.etu}|${s.cle}|${s.coulee}`);
  const recette = res.recipes[s.recette ?? 0];
  const couleLe = jour(maintenant, s.coulee);
  const code = genererCode(existantes, new Date(couleLe));
  const facteurGachee = (s.facteur ?? 1) * autour(alea, 0.08);
  const composants = composantsDepuisRecette(recette, nomLiant(res.general, res.catalogue_liants ?? []))
    .map((c) => ({
      ...c,
      peseeKg: Math.round(c.cibleKg * (s.peseeHorsTolerance && c.cle.startsWith("liant") ? 1.045 : autour(alea, 0.006)) * 100000) / 100000,
    }));
  const masseG = Math.round((recette.bulk_density_kg_m3 ?? 2000) * SECTION_M2 * (MOULE.hauteurMm / 1000) * 1000 * autour(alea, 0.01) * 10) / 10;
  const eprouvettes: Eprouvette[] = [];
  let maj = couleLe;
  let ecrasees = 0;
  for (const a of s.ages) {
    for (let i = 0; i < 3; i++) {
      const echeance = s.coulee + a.age;
      const ep: Eprouvette = {
        id: `${res.id}-${code}-e${eprouvettes.length + 1}`,
        code: genererCodeEprouvette(code, eprouvettes),
        couleLe,
        ageJours: a.age,
        statut: "en_cure",
        mouleDiametreMm: MOULE.diametreMm,
        mouleHauteurMm: MOULE.hauteurMm,
      };
      const facteurReplicat = a.facteurs ? a.facteurs[i] : autour(alea, 0.05);
      const aberrant = a.aberrant === i;
      const decalage = a.horsFenetre === i ? 3 : 0;
      // Écrasée si sa date d'essai est passée ; « aujourd'hui » et l'éprouvette
      // en retard restent en cure (échéancier).
      if (!a.retard && echeance + decalage < 0) {
        const kpa = UCS28[s.cle] * (FACTEUR_AGE[a.age] ?? 1) * facteurGachee * facteurReplicat * (aberrant ? 2.1 : 1);
        const date = jour(maintenant, echeance + decalage);
        ep.statut = "ecrase";
        ep.essai = {
          date,
          chargeKn: Math.round(kpa * SECTION_M2 * 1000) / 1000,
          diametreMm: MOULE.diametreMm,
          hauteurMm: MOULE.hauteurMm,
          masseG,
          vitesseChargement: { valeur: 1, unite: "mm/min" },
          presse: "Presse du laboratoire",
          modeRuptureCode: aberrant ? "extremites" : RUPTURES[Math.floor(alea() * RUPTURES.length)],
          ...(aberrant ? { exclu: true, justificationExclusion: "Éprouvette mal surfacée : rupture aux extrémités, valeur aberrante." } : {}),
        };
        ecrasees++;
        if (date > maj) maj = date;
      }
      eprouvettes.push(ep);
    }
  }
  const complet = !s.ficheIncomplete;
  // Id : la 1re gâchée d'un calcul garde la forme d'origine (tests, revues).
  const deCeCalcul = existantes.filter((x) => x.formulationId === res.id).length;
  const g: Gachee = {
    id: deCeCalcul === 0 ? `${res.id}-gachee` : `${res.id}-gachee-${deCeCalcul + 1}`,
    code,
    creeLe: couleLe,
    statut: s.statut,
    formulationLabel: res.label,
    formulationId: res.id,
    categorie: res.category,
    recetteIndex: s.recette ?? 0,
    solverVersion: res.solverVersion,
    composants,
    tolerancePct: 2,
    lotResidu: complet ? (res.selectedMaterials?.residueId === "res_casa_berardi" ? "CB-2026-07" : "LR-2026-08") : undefined,
    lotLiant: complet ? "GU-2231 / GGBFS-118" : undefined,
    ...(res.category === "RPG" ? { lotGranulat: "CL-2026-03" } : {}),
    w0MesurePct: Math.round(((res.inputs as { residue_w_pct: number }).residue_w_pct + (alea() - 0.5)) * 10) / 10,
    slumpMesureMm: complet ? Math.round(180 + alea() * 30) : undefined,
    temperatureC: 21,
    cwMesurePct: Math.round(((recette.solids_mass_pct ?? 75) + (alea() - 0.5) * 0.8) * 10) / 10,
    ajustements: [],
    observations: s.observations,
    eprouvettes,
    parametres: parametresDepuisRecette(recette),
    protocolesSnapshot: snapshotProtocoles(protocolesDefaut()),
    sessionId: ID_SESSION_DEMO,
    materiaux: { ...materiauxDepuisFormulation(res, { residus: residusDefaut, granulats: granulatsDefaut }), eau: { type: "robinet" } },
    cure: { mode: "chambre_humide", temperatureC: 23, humiditePct: 95 },
    malaxageDureeMin: s.observations?.startsWith("Malaxage") ? 3 : 5,
  };
  return { g, maj, rev: 3 + ecrasees };
}

export interface DonneesDemo {
  lignes: LigneClasse[];
  profils: ProfilClasse[];
  annotations: LigneAnnotation[];
  revues: RevueClasse[];
  sessions: Session[];
  comptes: CompteClasse[];
  /** Identifiant de l'enseignant de démonstration (auteur des commentaires). */
  moi: string;
}

/** La classe fictive, à la date `maintenant` (déterministe pour une date donnée). */
export function classeDemo(maintenant: Date): DonneesDemo {
  const lignes: LigneClasse[] = [];
  const resultats = new Map<string, SavedResult>();
  for (const r of RESULTATS) {
    const sr = resultatDemo(r.etu, r.cle, jour(maintenant, r.jour), r.variante);
    resultats.set(`${r.etu}|${r.cle}|${r.variante ?? ""}`, sr);
    lignes.push({ proprietaire: r.etu, kind: "resultat", id: sr.id, rev: 1, maj: sr.savedAt, cree: sr.savedAt, supprime: false, contenu: sr });
  }
  const gachees = new Map<string, Gachee[]>();
  const revs = new Map<string, number>();
  for (const s of SPECS) {
    const res = resultats.get(`${s.etu}|${s.cle}|${s.variante ?? ""}`)!;
    const deja = gachees.get(s.etu) ?? [];
    const { g, maj, rev } = gachee(maintenant, s, res, deja);
    gachees.set(s.etu, [...deja, g]);
    revs.set(g.id, rev);
    lignes.push({ proprietaire: s.etu, kind: "gachee", id: g.id, rev, maj, cree: g.creeLe, supprime: false, contenu: g });
  }
  const idGachee = (etu: IdEtudiant, cle: CleFormulation) => `demo-${etu}-${cle}-gachee`;

  // Revues : une acceptée, une refusée, une périmée (gâchée modifiée depuis).
  const revues: RevueClasse[] = [
    { ownerId: "demo-etu-alice", kind: "gachee", id: idGachee("demo-etu-alice", "laronde_bw5"), rev: revs.get(idGachee("demo-etu-alice", "laronde_bw5")) ?? null,
      decision: "acceptee", motif: null, ecartees: [], maj: jour(maintenant, -3) },
    { ownerId: "demo-etu-david", kind: "gachee", id: idGachee("demo-etu-david", "laronde_bw5"), rev: revs.get(idGachee("demo-etu-david", "laronde_bw5")) ?? null,
      decision: "refusee", motif: "Malaxage trop court : refaites la gâchée en respectant les 5 minutes du protocole.", ecartees: [], maj: jour(maintenant, -6) },
    { ownerId: "demo-etu-alice", kind: "gachee", id: idGachee("demo-etu-alice", "laronde_bw3"), rev: (revs.get(idGachee("demo-etu-alice", "laronde_bw3")) ?? 3) - 2,
      decision: "acceptee", motif: null, ecartees: [], maj: jour(maintenant, -8) },
  ];

  // Commentaires : une remarque de l'enseignant et la réponse, non lue, de l'étudiant.
  const gB = idGachee("demo-etu-bruno", "laronde_bw5");
  const annotations: LigneAnnotation[] = [
    { id: "demo-note-1", owner_id: "demo-etu-bruno", auteur_id: ID_PROF_DEMO, target_kind: "gachee", target_id: gB, target_rev: revs.get(gB) ?? null,
      ancre: null, texte: "Une éprouvette à 28 j a été écrasée à 31 j : notez la raison dans les observations.",
      deleted: false, created_at: jour(maintenant, -4), updated_at: jour(maintenant, -4), lu_le: jour(maintenant, -3) },
    { id: "demo-note-2", owner_id: "demo-etu-bruno", auteur_id: "demo-etu-bruno", target_kind: "gachee", target_id: gB, target_rev: revs.get(gB) ?? null,
      ancre: null, texte: "C'est fait : la presse était en maintenance cette semaine-là.",
      deleted: false, created_at: jour(maintenant, -2), updated_at: jour(maintenant, -2), lu_le: null },
    { id: "demo-note-3", owner_id: "demo-etu-david", auteur_id: ID_PROF_DEMO, target_kind: "gachee", target_id: idGachee("demo-etu-david", "laronde_bw5"),
      target_rev: revs.get(idGachee("demo-etu-david", "laronde_bw5")) ?? null, ancre: null,
      texte: "Vos résistances sont environ un tiers sous celles du groupe : comparez votre protocole de malaxage.",
      deleted: false, created_at: jour(maintenant, -6), updated_at: jour(maintenant, -6), lu_le: jour(maintenant, -5) },
  ];

  const profils: ProfilClasse[] = [
    { id: ID_PROF_DEMO, email: "enseignant@demo.invalid", display_name: "Enseignant (démonstration)", role: "prof" },
    ...ETUDIANTS.map((e) => ({ id: e.id, email: e.courriel, display_name: e.nom, role: "etudiant" })),
  ];

  const derniere = (etu: string) => lignes.filter((l) => l.proprietaire === etu).map((l) => l.maj).sort().at(-1) ?? null;
  const comptes: CompteClasse[] = [
    { id: ID_PROF_DEMO, courriel: "enseignant@demo.invalid", nom: "Enseignant (démonstration)", role: "prof", creeLe: jour(maintenant, -90),
      derniereConnexion: jour(maintenant, 0), bloqueJusquA: null, nbResultats: 0, nbGachees: 0, derniereActivite: null },
    ...ETUDIANTS.map((e) => ({
      id: e.id, courriel: e.courriel, nom: e.nom, role: "etudiant" as const, creeLe: jour(maintenant, -80),
      derniereConnexion: derniere(e.id), bloqueJusquA: null,
      nbResultats: lignes.filter((l) => l.proprietaire === e.id && l.kind === "resultat").length,
      nbGachees: lignes.filter((l) => l.proprietaire === e.id && l.kind === "gachee").length,
      derniereActivite: derniere(e.id),
    })),
  ];

  const sessions: Session[] = [{ id: ID_SESSION_DEMO, nom: "Session de démonstration", debut: dateCourte(maintenant, -75), fin: dateCourte(maintenant, 60) }];
  return { lignes, profils, annotations, revues, sessions, comptes, moi: ID_PROF_DEMO };
}

/* ── Source en mémoire ────────────────────────────────────────────────── */

/** Projection allégée, comme lire_docs_classe (supabase/schema.sql) : sans protocoles, ajustements ni entrées. */
function allege(l: LigneClasse): LigneClasse {
  const c = { ...(l.contenu as Record<string, unknown>) };
  if (l.kind === "gachee") { delete c.protocolesSnapshot; delete c.ajustements; } else { delete c.catalogue_liants; delete c.constantes; delete c.inputs; }
  return { ...l, contenu: c };
}

const INDISPONIBLE = "Démonstration : action non disponible.";

/**
 * Source de la démonstration : lit la classe fictive et SIMULE en mémoire les
 * revues, les commentaires et les accusés de lecture. Aucun appel réseau, rien
 * n'est enregistré ; une nouvelle source repart des données d'origine. Les
 * courbes de presse ne sont pas incluses ; rôles et blocage sont refusés.
 */
export function sourceDemo(donnees: DonneesDemo): SourceClasse {
  let annotations = donnees.annotations.map((a) => ({ ...a }));
  let revues = donnees.revues.map((r) => ({ ...r }));
  let numero = 0;
  const maintenantIso = () => new Date().toISOString();
  return {
    demonstration: true,
    lireClasse: async ({ complet, session }) => donnees.lignes
      .filter((l) => session === null || ((l.contenu as { sessionId?: string }).sessionId ?? session) === session)
      .map((l) => (complet ? l : allege(l))),
    lireProfils: async () => donnees.profils.map((p) => ({ ...p })),
    lireAnnotationsClasse: async () => annotations.filter((a) => !a.deleted).map((a) => ({ ...a })),
    lireRevuesClasse: async () => revues.map((r) => ({ ...r })),
    lireDocComplet: async (proprietaire, kind, id): Promise<DocComplet | null> => {
      const l = donnees.lignes.find((x) => x.proprietaire === proprietaire && x.kind === kind && x.id === id);
      return l ? { contenu: l.contenu, rev: l.rev, maj: l.maj, supprime: false } : null;
    },
    lireCourbe: async () => null,
    lireCourbesClasse: async () => [],
    ajouterAnnotation: async (a) => {
      const t = maintenantIso();
      const ligne: LigneAnnotation = {
        id: `demo-note-ajout-${++numero}`, owner_id: a.ownerId, auteur_id: a.auteurId, target_kind: a.kind, target_id: a.id,
        target_rev: a.rev, ancre: a.ancre, texte: a.texte, deleted: false, created_at: t, updated_at: t, lu_le: null,
      };
      annotations = [...annotations, ligne];
      return { ...ligne };
    },
    retirerAnnotation: async (id) => {
      const a = annotations.find((x) => x.id === id && !x.deleted);
      if (!a || a.auteur_id !== donnees.moi) throw new Error("Ce message n'a pas été retiré (il n'est pas de vous, ou n'existe plus).");
      annotations = annotations.map((x) => (x.id === id ? { ...x, deleted: true } : x));
    },
    marquerAnnotationsLues: async (ids) => {
      const t = maintenantIso();
      const lus: { id: string; luLe: string }[] = [];
      annotations = annotations.map((x) => {
        if (!ids.includes(x.id) || x.auteur_id !== x.owner_id || x.lu_le) return x;
        lus.push({ id: x.id, luLe: t });
        return { ...x, lu_le: t };
      });
      return lus;
    },
    poserRevue: async (r) => {
      const revue: RevueClasse = { ownerId: r.ownerId, kind: "gachee", id: r.id, rev: r.rev, decision: r.decision,
        motif: r.motif?.trim() || null, ecartees: r.ecartees, maj: maintenantIso() };
      revues = [...revues.filter((x) => !(x.ownerId === r.ownerId && x.id === r.id)), revue];
      return { ...revue };
    },
    retirerRevue: async (ownerId, id) => {
      const avant = revues.length;
      revues = revues.filter((x) => !(x.ownerId === ownerId && x.id === id));
      return revues.length < avant;
    },
    lireComptes: async () => donnees.comptes.map((c) => ({ ...c })),
    definirRole: async () => { throw new Error(INDISPONIBLE); },
    bloquerCompte: async () => { throw new Error(INDISPONIBLE); },
  };
}

/* ── Exports marqués dans leur contenu ────────────────────────────────── */

/** CSV de la démonstration : la mention en première ligne, en commentaire. */
export function marquerCsvDemo<T>(lignes: T[][]): (T | string)[][] {
  return [[`# ${MENTION_DEMO}`], ...lignes];
}

/** JSON de la démonstration : propriété explicite `demonstration`. */
export function marquerJsonDemo<T extends object>(o: T): T & { demonstration: { fictif: true; note: string } } {
  return { ...o, demonstration: { fictif: true, note: MENTION_DEMO } };
}

/** Rapport PDF de la démonstration : titre (repris en pied de chaque page) et mention en tête. */
export function marquerRapportDemo<D extends { titre: string; blocs: unknown[] }>(d: D): D {
  return { ...d, titre: `${d.titre} (démonstration)`, blocs: [{ type: "texte", texte: MENTION_DEMO }, ...d.blocs] };
}
