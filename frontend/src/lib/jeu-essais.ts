// frontend/src/lib/jeu-essais.ts
// Jeu d'essais PSEUDONYMISÉ : la base de données des essais, exportée par
// l'enseignant pour la recherche et les modèles. Module PUR (testé en node).
//
// Trois tables et un manifeste :
//   - essais    : une ligne par éprouvette (conditions de la gâchée répétées,
//                 pour qu'une ligne se suffise à elle-même) ;
//   - gachees   : une ligne par gâchée ;
//   - materiaux : une ligne par résidu, granulat ou liant référencé, joint au
//                 catalogue de l'enseignant quand il le connaît.
// Chaque colonne est décrite dans COLONNES_* (le dictionnaire des données) ;
// docs/DICTIONNAIRE_DONNEES.md en est la version lisible, gardée par
// jeu-essais.test.ts (une colonne absente du document fait échouer le test).
//
// Pseudonymisation : aucun nom ni courriel. L'opérateur est un pseudonyme
// stable (pseudonyme.ts). Sont retirés aussi les textes qui nomment souvent
// quelqu'un : libellé de la formulation, observations, opérateur, fichier et
// commentaires de la presse. Les étudiants sont parcourus dans l'ordre de leur
// pseudonyme, jamais de leur nom (l'ordre alphabétique trahirait l'identité).
//
// AUCUNE FORMULE NOUVELLE : on recopie des mesures et des sorties déjà
// calculées (contrainteKpa, parametresEffectifs, essaiValide, completude).
// Copies de conflit exclues, comme partout dans la classe.

import { ageReelJours, contrainteKpa, dateCoulee, libelleMoule, type Eprouvette } from "./eprouvette";
import { horsTolerance, parametresEffectifs, type Gachee, type MateriauxGachee, type ParametresFormulation } from "./gachee";
import { essaiValide, gacheesRetenues, type EtudiantClasse } from "./classe";
import { sessionEffective, type Session } from "./sessions";
import { completudeGachee } from "./completude";
import { materiauxDepuisFormulation } from "./gachee-materiaux";
import { securiserCsv, type CelluleCsv, type RevueDe } from "./classe-csv";
import type { InfoRevue } from "./revues";
import { fmtDate } from "./echeance-affichage";
import { CARACTERISATION_GRANULAT, CARACTERISATION_RESIDU, type ChampCaracterisation, type GranulatItem, type ResiduItem } from "./materials";
import type { LiantCatalogueItem } from "./store";

/** Version du format du jeu d'essais (structure du JSON). */
export const JEU_ESSAIS_VERSION = 1;
/** Version du dictionnaire : à incrémenter quand une colonne change de sens. */
export const DICTIONNAIRE_VERSION = 1;

export type TypeColonne = "texte" | "texte libre" | "code" | "nombre" | "entier" | "date" | "booléen";
export type Valeur = string | number | boolean | null;

export interface Colonne<C> {
  cle: string;
  libelle: string;
  unite?: string;
  type: TypeColonne;
  description: string;
  val: (c: C) => Valeur;
}

interface CtxGachee {
  operateur: string;
  session: string;
  g: Gachee;
  p: ParametresFormulation | undefined;
  m: MateriauxGachee;
  materiauxSource: "fiche" | "formulation" | "";
  completude: number;
  /** Le résidu dans le catalogue de l'enseignant (sa caractérisation), s'il y est. */
  residuCatalogue?: ResiduItem;
  /** Décision de l'enseignant sur la gâchée, s'il y en a une. */
  revue?: InfoRevue;
}
interface CtxEssai extends CtxGachee {
  ep: Eprouvette;
}
export interface LigneMateriau {
  type: "residu" | "granulat" | "liant";
  ref: string;
  source: "catalogue" | "instantane";
  nom?: string;
  code?: string;
  gs?: number;
  w0Pct?: number;
  humiditePct?: number;
  provenance?: string;
  /** Entrée du catalogue (caractérisation), pour un matériau « catalogue ». */
  caracterisation?: object;
  nbGachees: number;
}

const num = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const txt = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);
const jour = (iso: string | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : fmtDate(d);
};

/**
 * Référence d'un matériau, commune aux tables essais et materiaux (jointure) :
 * pour un liant son code (colonnes liantN_code) ; pour un résidu ou un
 * granulat l'identifiant du catalogue ; sinon une clé construite depuis
 * l'instantané.
 */
export function refMateriau(type: LigneMateriau["type"], m: { id?: string; nom?: string; code?: string } | undefined): string | null {
  if (!m) return null;
  if (type === "liant" && txt(m.code)) return txt(m.code);
  if (m.id) return m.id;
  const nom = txt(m.code) ?? txt(m.nom);
  return nom ? `instantane:${type}:${nom}` : null;
}

const liant = (c: CtxGachee, i: number) => c.m.liants?.[i];
const typeDe = (ch: ChampCaracterisation): TypeColonne => (ch.type === "nombre" ? "nombre" : ch.type === "date" ? "date" : "texte libre");
const valeurDe = (item: object | undefined, cle: string): Valeur => {
  const v = (item as Record<string, unknown> | undefined)?.[cle];
  return typeof v === "number" ? num(v) : typeof v === "string" ? txt(v) : null;
};
const PSEUDONYMISATION =
  "operateur = « op- » suivi des 12 premiers caractères hexadécimaux du SHA-256 de l'identifiant du compte. " +
  "Pseudonymisation et non anonymisation : la correspondance peut être refaite par qui détient la liste des comptes.";
const CHAMPS_RETIRES = [
  "nom et courriel de l'étudiant", "libellé de la formulation", "observations de la gâchée",
  "opérateur, nom de fichier et commentaires de la presse", "nom de l'opérateur de la formulation",
];

// ── Colonnes de la gâchée (communes aux tables essais et gachees) ──
const COLONNES_GACHEE: Colonne<CtxGachee>[] = [
  { cle: "operateur", libelle: "Opérateur (pseudonyme)", type: "texte", val: (c) => c.operateur,
    description: "Pseudonyme stable du compte étudiant (voir le manifeste). Le même étudiant garde le même pseudonyme d'un export à l'autre." },
  { cle: "session", libelle: "Session", type: "texte", val: (c) => c.session,
    description: "Session de cours de la gâchée : celle déclarée à la création, sinon celle qui contient sa date." },
  { cle: "gachee_code", libelle: "Gâchée", type: "texte", val: (c) => c.g.code,
    description: "Code de la gâchée (G-AAAAMMJJ-NN), unique chez un même opérateur." },
  { cle: "gachee_date", libelle: "Date de gâchée", type: "date", val: (c) => jour(c.g.creeLe),
    description: "Jour de création de la gâchée (AAAA-MM-JJ)." },
  { cle: "gachee_statut", libelle: "Statut de la gâchée", type: "code", val: (c) => c.g.statut ?? null,
    description: "brouillon : en cours de saisie ; terminee : déclarée terminée par l'étudiant." },
  { cle: "categorie", libelle: "Catégorie de remblai", type: "code", val: (c) => c.g.categorie ?? null,
    description: "RPC : remblai en pâte cimenté ; RPG : remblai en pâte avec granulat ; RRC : remblai rocheux cimenté." },
  { cle: "formulation_ref", libelle: "Formulation (référence)", type: "texte", val: (c) => txt(c.g.formulationId),
    description: "Identifiant aléatoire de la formulation d'origine chez l'opérateur : regroupe les gâchées d'une même formulation. Vide si la gâchée n'en a pas." },
  { cle: "recette", libelle: "Recette", type: "entier", val: (c) => (typeof c.g.recetteIndex === "number" ? c.g.recetteIndex + 1 : null),
    description: "Numéro de la recette dans la formulation (1, 2, …)." },
  { cle: "solveur_version", libelle: "Version des formules", type: "texte", val: (c) => txt(c.g.solverVersion),
    description: "Version des formules de l'application qui ont calculé la recette." },
  { cle: "cw_pct", libelle: "Pourcentage solide massique Cw visé", unite: "%", type: "nombre", val: (c) => num(c.p?.cwPct),
    description: "Cw de la recette calculée (instantané de la gâchée, sinon relu dans la formulation d'origine)." },
  { cle: "el_ratio", libelle: "Rapport eau/liant E/L visé", type: "nombre", val: (c) => num(c.p?.wcRatio),
    description: "Rapport massique eau/liant de la recette calculée. Sans unité." },
  { cle: "bw_pct", libelle: "Taux massique de liant Bw visé", unite: "%", type: "nombre", val: (c) => num(c.p?.bwPct),
    description: "Masse de liant / masse sèche de résidu (et de granulat en RPG), de la recette calculée." },
  { cle: "w_pct", libelle: "Teneur en eau w visée", unite: "%", type: "nombre", val: (c) => num(c.p?.wPct),
    description: "Teneur en eau massique de la recette calculée." },
  { cle: "materiaux_source", libelle: "Origine des matériaux", type: "code", val: (c) => c.materiauxSource || null,
    description: "fiche : matériaux de la fiche d'essai de la gâchée ; formulation : déduits de la formulation d'origine (gâchée antérieure à la fiche d'essai) ; vide : inconnus." },
  { cle: "residu_ref", libelle: "Résidu (référence)", type: "texte", val: (c) => refMateriau("residu", c.m.residu),
    description: "Identifiant du résidu dans le catalogue, sinon « instantane:residu:<nom> ». Jointure avec la table materiaux." },
  { cle: "residu_nom", libelle: "Résidu", type: "texte libre", val: (c) => txt(c.m.residu?.nom),
    description: "Nom du résidu, tel que saisi ou repris du catalogue." },
  { cle: "residu_gs", libelle: "Densité relative des grains Gs du résidu", type: "nombre", val: (c) => num(c.m.residu?.gs),
    description: "Gs du résidu entré dans le calcul de la recette. Sans unité." },
  { cle: "residu_w0_pct", libelle: "Teneur en eau initiale w₀ du résidu (calcul)", unite: "%", type: "nombre", val: (c) => num(c.m.residu?.w0Pct),
    description: "w₀ du résidu entré dans le calcul de la recette (la valeur mesurée le jour de la gâchée est w0_mesure_pct)." },
  // Caractérisation du résidu (catalogue de l'enseignant, jointure par l'id) :
  // répétée ici pour que le CSV des essais se suffise à lui-même.
  ...CARACTERISATION_RESIDU.filter((ch) => ch.type === "nombre").map((ch): Colonne<CtxGachee> => ({
    cle: `residu_${ch.cle}`, libelle: `${ch.libelle} du résidu`, unite: ch.unite, type: "nombre", val: (c) => valeurDe(c.residuCatalogue, ch.cle),
    description: `${ch.description} Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée.`,
  })),
  { cle: "granulat_ref", libelle: "Granulat (référence)", type: "texte", val: (c) => refMateriau("granulat", c.m.granulat),
    description: "Identifiant du granulat dans le catalogue, sinon « instantane:granulat:<nom> ». RPG seulement." },
  { cle: "granulat_nom", libelle: "Granulat", type: "texte libre", val: (c) => txt(c.m.granulat?.nom),
    description: "Nom du granulat, tel que saisi. RPG seulement." },
  { cle: "granulat_gs", libelle: "Densité relative des grains Gs du granulat", type: "nombre", val: (c) => num(c.m.granulat?.gs),
    description: "Gs du granulat entré dans le calcul. Sans unité. RPG seulement." },
  { cle: "nb_liants", libelle: "Nombre de composants du liant", type: "entier", val: (c) => (c.m.liants ? c.m.liants.length : null),
    description: "Nombre de composants du liant (ciment, laitier, cendres…). Les trois premiers ont leurs colonnes ; tous figurent dans « liants »." },
  ...[1, 2, 3].flatMap((n): Colonne<CtxGachee>[] => [
    { cle: `liant${n}_code`, libelle: `Liant, composant ${n}`, type: "code", val: (c) => txt(liant(c, n - 1)?.code) ?? txt(liant(c, n - 1)?.nom),
      description: `Code du composant ${n} du liant dans le catalogue des liants (ex. CP10, SLAG).` },
    { cle: `liant${n}_pct`, libelle: `Proportion du composant ${n} dans le liant`, unite: "%", type: "nombre", val: (c) => num(liant(c, n - 1)?.fractionPct),
      description: `Part massique du composant ${n} dans le liant.` },
  ]),
  { cle: "liants", libelle: "Composition du liant", type: "texte", description: "Tous les composants, « code proportion % » séparés par « + ».",
    val: (c) => (c.m.liants?.length
      ? c.m.liants.map((l) => `${l.code ?? l.nom ?? "?"}${l.fractionPct != null ? ` ${l.fractionPct.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} %` : ""}`).join(" + ")
      : null) },
  { cle: "lot_residu", libelle: "Lot de résidu", type: "texte libre", val: (c) => txt(c.g.lotResidu), description: "Lot du résidu employé, tel que saisi." },
  { cle: "lot_granulat", libelle: "Lot de granulat", type: "texte libre", val: (c) => txt(c.g.lotGranulat), description: "Lot du granulat employé, tel que saisi." },
  { cle: "lot_liant", libelle: "Lot de liant", type: "texte libre", val: (c) => txt(c.g.lotLiant), description: "Lot du liant employé, tel que saisi." },
  { cle: "eau_type", libelle: "Eau de gâchage", type: "code", val: (c) => c.m.eau?.type ?? null,
    description: "robinet, procede (eau de procédé), distillee ou autre." },
  { cle: "adjuvant_nom", libelle: "Adjuvant", type: "texte libre", val: (c) => txt(c.m.adjuvant?.nom), description: "Nom du produit adjuvant, s'il y en a un." },
  { cle: "adjuvant_dosage", libelle: "Dosage de l'adjuvant", type: "nombre", val: (c) => num(c.m.adjuvant?.dosage),
    description: "Dosage de l'adjuvant, dans l'unité de adjuvant_unite." },
  { cle: "adjuvant_unite", libelle: "Unité du dosage de l'adjuvant", type: "code", val: (c) => (c.m.adjuvant?.dosage != null ? c.m.adjuvant.dosageUnite ?? null : null),
    description: "ml/100 kg, % liant ou autre." },
  { cle: "malaxage_min", libelle: "Durée de malaxage", unite: "min", type: "nombre", val: (c) => num(c.g.malaxageDureeMin),
    description: "Durée de malaxage de la pâte." },
  { cle: "w0_mesure_pct", libelle: "Teneur en eau w₀ mesurée", unite: "%", type: "nombre", val: (c) => num(c.g.w0MesurePct),
    description: "Humidité réelle du résidu, mesurée le jour de la gâchée." },
  { cle: "affaissement_mm", libelle: "Affaissement mesuré", unite: "mm", type: "nombre", val: (c) => num(c.g.slumpMesureMm),
    description: "Affaissement au cône d'Abrams (ASTM C143/C143M)." },
  { cle: "temperature_pate_c", libelle: "Température de la pâte", unite: "°C", type: "nombre", val: (c) => num(c.g.temperatureC),
    description: "Température de la pâte fraîche." },
  { cle: "w_mesure_pct", libelle: "Teneur en eau w mesurée", unite: "%", type: "nombre", val: (c) => num(c.g.wMesurePct),
    description: "Teneur en eau de la pâte, mesurée." },
  { cle: "cw_mesure_pct", libelle: "Cw mesuré", unite: "%", type: "nombre", val: (c) => num(c.g.cwMesurePct),
    description: "Pourcentage solide massique de la pâte, mesuré." },
  { cle: "cure_mode", libelle: "Mode de cure", type: "code", val: (c) => c.g.cure?.mode ?? null,
    description: "chambre_humide, immersion, ambiante (air ambiant), scellee (sac ou film) ou autre." },
  { cle: "cure_temperature_c", libelle: "Température de cure", unite: "°C", type: "nombre", val: (c) => num(c.g.cure?.temperatureC),
    description: "Température de la cure des éprouvettes." },
  { cle: "cure_humidite_pct", libelle: "Humidité relative de cure", unite: "%", type: "nombre", val: (c) => num(c.g.cure?.humiditePct),
    description: "Humidité relative pendant la cure." },
  { cle: "pesees_hors_tolerance", libelle: "Pesées hors tolérance", type: "entier",
    val: (c) => (c.g.composants.length === 0 ? null : c.g.composants.filter((x) => horsTolerance(x, c.g.tolerancePct)).length),
    description: "Nombre de composants pesés hors de la tolérance de la gâchée. Vide si aucune pesée n'est enregistrée." },
  { cle: "completude_pct", libelle: "Complétude de la fiche d'essai", unite: "%", type: "entier", val: (c) => c.completude,
    description: "Part des informations descriptives renseignées (lib/completude.ts). Rien n'est obligatoire pour l'étudiant : une valeur basse signale une gâchée moins documentée." },
  { cle: "revue", libelle: "Revue de l'enseignant", type: "code", val: (c) => c.revue?.decision ?? null,
    description: "acceptee ou refusee : décision de l'enseignant sur la gâchée ; vide si elle n'a pas été revue." },
  { cle: "revue_perimee", libelle: "Modifiée depuis la revue", type: "booléen", val: (c) => (c.revue ? c.revue.perimee : null),
    description: "L'étudiant a modifié la gâchée après la décision de l'enseignant (la décision porte sur une version antérieure). Vide sans revue." },
];

// ── Colonnes propres à l'éprouvette et à son essai ──
const COLONNES_EPROUVETTE: Colonne<CtxEssai>[] = [
  { cle: "eprouvette_code", libelle: "Éprouvette", type: "texte", val: (c) => c.ep.code, description: "Code de l'éprouvette (code de la gâchée suivi de -ENN)." },
  { cle: "coulee_le", libelle: "Coulée le", type: "date", val: (c) => { const d = dateCoulee(c.ep); return Number.isNaN(d.getTime()) ? null : fmtDate(d); }, description: "Jour du moulage de l'éprouvette." },
  { cle: "age_cible_j", libelle: "Âge de cure visé", unite: "j", type: "entier", val: (c) => num(c.ep.ageJours),
    description: "Âge de cure prévu à l'écrasement. Les moyennes de l'application sont faites par âge visé." },
  { cle: "statut", libelle: "Statut de l'éprouvette", type: "code", val: (c) => c.ep.statut, description: "en_cure ou ecrase." },
  { cle: "essai_le", libelle: "Date d'essai", type: "date", val: (c) => (c.ep.statut === "ecrase" ? jour(c.ep.essai?.date) : null), description: "Jour de l'écrasement." },
  { cle: "age_reel_j", libelle: "Temps de cure réel", unite: "j", type: "nombre", val: (c) => (c.ep.statut === "ecrase" ? num(ageReelJours(c.ep)) : null),
    description: "Relevé par la presse s'il existe, sinon de la coulée au jour de l'essai." },
  { cle: "moule", libelle: "Moule", type: "texte", val: (c) => txt(libelleMoule(c.ep)), description: "Moule nominal (« Cylindre 50 × 100 mm ») ou texte libre." },
  { cle: "moule_diametre_mm", libelle: "Diamètre du moule", unite: "mm", type: "nombre", val: (c) => num(c.ep.mouleDiametreMm),
    description: "Diamètre nominal du moule choisi parmi les moules proposés. Vide pour un moule saisi en texte libre." },
  { cle: "moule_hauteur_mm", libelle: "Hauteur du moule", unite: "mm", type: "nombre", val: (c) => num(c.ep.mouleHauteurMm), description: "Hauteur nominale du moule." },
  { cle: "charge_kn", libelle: "Charge à la rupture", unite: "kN", type: "nombre", val: (c) => num(c.ep.essai?.chargeKn), description: "Force maximale appliquée par la presse." },
  { cle: "diametre_mm", libelle: "Diamètre de l'éprouvette", unite: "mm", type: "nombre", val: (c) => num(c.ep.essai?.diametreMm),
    description: "Diamètre retenu pour le calcul F / A (mesuré, ou prérempli depuis le moule)." },
  { cle: "hauteur_mm", libelle: "Hauteur de l'éprouvette", unite: "mm", type: "nombre", val: (c) => num(c.ep.essai?.hauteurMm), description: "Hauteur de l'éprouvette (presse ou saisie)." },
  { cle: "masse_g", libelle: "Masse de l'éprouvette", unite: "g", type: "nombre", val: (c) => num(c.ep.essai?.masseG), description: "Masse de l'éprouvette (presse ou pesée)." },
  { cle: "ucs_kpa", libelle: "Résistance en compression uniaxiale (UCS)", unite: "kPa", type: "nombre", val: (c) => (c.ep.statut === "ecrase" ? num(contrainteKpa(c.ep.essai)) : null),
    description: "Contrainte retenue par l'application (ASTM C39/C39M) : la contrainte directe (presse ou saisie) si elle existe, sinon F / A avec A = π·d²/4." },
  { cle: "ucs_source", libelle: "Origine de l'UCS", type: "code", description: "presse : contrainte importée du fichier de la presse ; saisie : contrainte saisie directement ; calcul_fa : déduite de la charge et du diamètre ; vide : pas de mesure.",
    val: (c) => {
      const es = c.ep.essai;
      if (c.ep.statut !== "ecrase" || contrainteKpa(es) === null) return null;
      if (es?.contrainteKpaSaisie != null && es.contrainteKpaSaisie > 0) return es.sourcePresse ? "presse" : "saisie";
      return "calcul_fa";
    } },
  { cle: "retenu", libelle: "Essai retenu", type: "booléen", val: (c) => essaiValide(c.ep),
    description: "L'essai entre dans les moyennes de l'application : éprouvette écrasée, mesure exploitable, non exclue (règle essaiValide)." },
  { cle: "exclu", libelle: "Exclu par l'étudiant", type: "booléen", val: (c) => !!c.ep.essai?.exclu, description: "L'étudiant a écarté cette valeur de la moyenne (valeur aberrante)." },
  { cle: "exclusion_motif", libelle: "Motif de l'exclusion", type: "texte libre", val: (c) => (c.ep.essai?.exclu ? txt(c.ep.essai.justificationExclusion) : null),
    description: "Justification de l'exclusion, telle que saisie." },
  { cle: "rupture_code", libelle: "Type de rupture", type: "code", val: (c) => c.ep.essai?.modeRuptureCode ?? null,
    description: "D'après ASTM C39/C39M : cone (cônes aux deux extrémités), cone_fendage (cône et fendage), colonnaire (fissures verticales), diagonale (cisaillement), extremites (rupture aux extrémités), autre." },
  { cle: "rupture_texte", libelle: "Rupture (texte libre)", type: "texte libre", val: (c) => txt(c.ep.essai?.modeRupture),
    description: "Précision libre du mode de rupture (« autre », ou saisie antérieure à la liste)." },
  { cle: "module_young_kpa", libelle: "Module de Young", unite: "kPa", type: "nombre", val: (c) => num(c.ep.essai?.moduleYoungKpa), description: "Donné par la presse." },
  { cle: "deformation_max_pct", libelle: "Déformation maximale", unite: "%", type: "nombre", val: (c) => num(c.ep.essai?.deformationMaxPct), description: "Donnée par la presse." },
  { cle: "deflexion_max_mm", libelle: "Déflexion maximale", unite: "mm", type: "nombre", val: (c) => num(c.ep.essai?.deflexionMaxMm), description: "Donnée par la presse." },
  { cle: "vitesse_chargement", libelle: "Vitesse de chargement", type: "nombre", val: (c) => num(c.ep.essai?.vitesseChargement?.valeur),
    description: "Vitesse de chargement appliquée, dans l'unité de vitesse_unite (le fichier de la presse ne la donne pas)." },
  { cle: "vitesse_unite", libelle: "Unité de la vitesse", type: "code", val: (c) => c.ep.essai?.vitesseChargement?.unite ?? null, description: "mm/min, kN/s ou kPa/s." },
  { cle: "presse", libelle: "Presse", type: "texte libre", val: (c) => txt(c.ep.essai?.presse), description: "Presse employée, telle que saisie." },
  { cle: "import_presse", libelle: "Importé de la presse", type: "booléen", val: (c) => !!c.ep.essai?.sourcePresse,
    description: "Les mesures viennent d'un fichier de presse importé (et non d'une saisie)." },
  { cle: "eprouvette_ecartee", libelle: "Écartée par l'enseignant", type: "booléen", val: (c) => (c.revue ? c.revue.ecartees.includes(c.ep.id) : null),
    description: "L'enseignant a écarté cette éprouvette lors de sa revue (la gâchée de l'étudiant n'est pas modifiée). Vide sans revue." },
];

export const COLONNES_ESSAIS: Colonne<CtxEssai>[] = [...COLONNES_GACHEE, ...COLONNES_EPROUVETTE];

export const COLONNES_GACHEES: Colonne<CtxGachee>[] = [
  ...COLONNES_GACHEE,
  { cle: "nb_eprouvettes", libelle: "Éprouvettes", type: "entier", val: (c) => c.g.eprouvettes.length, description: "Nombre d'éprouvettes moulées." },
  { cle: "nb_ecrasees", libelle: "Éprouvettes écrasées", type: "entier", val: (c) => c.g.eprouvettes.filter((e) => e.statut === "ecrase").length,
    description: "Nombre d'éprouvettes écrasées." },
  { cle: "nb_retenues", libelle: "Essais retenus", type: "entier", val: (c) => c.g.eprouvettes.filter(essaiValide).length,
    description: "Nombre d'essais retenus (voir la colonne retenu de la table essais)." },
];

export const COLONNES_MATERIAUX: Colonne<LigneMateriau>[] = [
  { cle: "type", libelle: "Type de matériau", type: "code", val: (m) => m.type, description: "residu, granulat ou liant." },
  { cle: "ref", libelle: "Référence", type: "texte", val: (m) => m.ref, description: "Clé de jointure avec la table essais : residu_ref, granulat_ref, ou pour un liant son code (liant1_code, liant2_code…)." },
  { cle: "source", libelle: "Source de la description", type: "code", val: (m) => m.source,
    description: "catalogue : décrit par le catalogue de l'enseignant au moment de l'export ; instantane : décrit par l'instantané de la gâchée (matériau personnel ou retiré du catalogue)." },
  { cle: "nom", libelle: "Nom", type: "texte libre", val: (m) => txt(m.nom), description: "Nom du matériau." },
  { cle: "code", libelle: "Code", type: "code", val: (m) => txt(m.code), description: "Code du liant (liants seulement)." },
  { cle: "gs", libelle: "Densité relative des grains Gs", type: "nombre", val: (m) => num(m.gs), description: "Sans unité." },
  { cle: "w0_pct", libelle: "Teneur en eau initiale w₀", unite: "%", type: "nombre", val: (m) => num(m.w0Pct), description: "Résidus seulement." },
  { cle: "humidite_pct", libelle: "Humidité", unite: "%", type: "nombre", val: (m) => num(m.humiditePct), description: "Granulats seulement." },
  { cle: "provenance", libelle: "Provenance", type: "texte libre", val: (m) => txt(m.provenance), description: "Provenance (mine, site) du matériau." },
  // Caractérisation : seulement pour un matériau décrit par le catalogue.
  ...CARACTERISATION_RESIDU.map((ch): Colonne<LigneMateriau> => ({
    cle: ch.cle, libelle: ch.libelle, unite: ch.unite, type: typeDe(ch), val: (m) => (m.type === "residu" ? valeurDe(m.caracterisation, ch.cle) : null),
    description: `${ch.description} Résidus seulement, depuis le catalogue.`,
  })),
  ...CARACTERISATION_GRANULAT.map((ch): Colonne<LigneMateriau> => ({
    cle: ch.cle, libelle: `${ch.libelle} (granulat)`, unite: ch.unite, type: typeDe(ch), val: (m) => (m.type === "granulat" ? valeurDe(m.caracterisation, ch.cle) : null),
    description: `${ch.description} Granulats seulement, depuis le catalogue.`,
  })),
  { cle: "nb_gachees", libelle: "Gâchées", type: "entier", val: (m) => m.nbGachees, description: "Nombre de gâchées du jeu qui emploient ce matériau." },
];

export const TABLES = { essais: COLONNES_ESSAIS, gachees: COLONNES_GACHEES, materiaux: COLONNES_MATERIAUX } as const;
export type NomTable = keyof typeof TABLES;

export interface EntreesJeuEssais {
  etudiants: EtudiantClasse[];
  sessions: Session[];
  /** Libellé de la session exportée (« Automne 2026 », « Toutes les sessions »…). */
  sessionLibelle: string;
  /** Identifiant de compte -> pseudonyme (pseudonymes() de pseudonyme.ts). */
  pseudonymes: Map<string, string>;
  /** Catalogues de l'enseignant : jointure des matériaux, et repli pour les anciennes gâchées. */
  catalogues: { residus: ResiduItem[]; granulats: GranulatItem[]; liants: LiantCatalogueItem[] };
  maintenant: Date;
  /** Revue de l'enseignant par gâchée (absent : revues indisponibles). */
  revueDe?: RevueDe;
  /** Seulement les gâchées ACCEPTÉES par l'enseignant et non modifiées depuis. */
  seulementAcceptees?: boolean;
}

export type Ligne = Record<string, Valeur>;

export interface JeuEssais {
  manifeste: {
    application: "MineBackfill";
    type: "jeu-essais";
    version: number;
    dictionnaire_version: number;
    exporte_le: string;
    session: string;
    selection: string;
    nb_operateurs: number;
    nb_gachees: number;
    nb_eprouvettes: number;
    nb_essais_retenus: number;
    nb_materiaux: number;
    versions_solveur: string[];
    pseudonymisation: string;
    champs_retires: string[];
    textes_libres: string[];
  };
  essais: Ligne[];
  gachees: Ligne[];
  materiaux: Ligne[];
}

const ligne = <C>(colonnes: Colonne<C>[], c: C): Ligne => Object.fromEntries(colonnes.map((k) => [k.cle, k.val(c)]));

/** Construit le jeu d'essais de la classe affichée (copies de conflit exclues). */
export function construireJeuEssais(x: EntreesJeuEssais): JeuEssais {
  const { catalogues } = x;
  const ctxs: CtxGachee[] = [];
  const operateurs = x.etudiants
    .filter((e) => gacheesRetenues(e).length > 0)
    .map((e) => {
      const operateur = x.pseudonymes.get(e.id);
      // Jamais de repli sur le nom : sans pseudonyme, pas d'export.
      if (!operateur) throw new Error("Pseudonyme manquant pour un compte : export annulé.");
      return { e, operateur };
    })
    .sort((a, b) => a.operateur.localeCompare(b.operateur));

  for (const { e, operateur } of operateurs) {
    const formulations = e.resultats.map((r) => ({ id: r.id, recipes: r.recipes ?? [] }));
    const gachees = [...gacheesRetenues(e)].sort((a, b) => (a.creeLe ?? "").localeCompare(b.creeLe ?? "") || a.code.localeCompare(b.code));
    for (const g of gachees) {
      let m: MateriauxGachee = g.materiaux ?? {};
      let materiauxSource: CtxGachee["materiauxSource"] = Object.keys(m).length > 0 ? "fiche" : "";
      if (!materiauxSource) {
        // Gâchée antérieure à la fiche d'essai : matériaux relus dans sa
        // formulation d'origine (au moment de l'export, rien n'est écrit).
        const form = g.formulationId ? e.resultats.find((r) => r.id === g.formulationId) : undefined;
        if (form?.general) {
          m = materiauxDepuisFormulation(form, { residus: catalogues.residus, granulats: catalogues.granulats });
          if (Object.keys(m).length > 0) materiauxSource = "formulation";
        }
      }
      const revue = x.revueDe?.(e.id, g.id);
      if (x.seulementAcceptees && !(revue?.decision === "acceptee" && !revue.perimee)) continue;
      ctxs.push({
        operateur, g, m, materiauxSource, revue,
        residuCatalogue: m.residu?.id ? catalogues.residus.find((x) => x.id === m.residu?.id) : undefined,
        session: sessionEffective({ sessionId: g.sessionId, date: g.creeLe }, x.sessions)?.nom ?? "Sans session",
        p: parametresEffectifs(g, formulations),
        completude: completudeGachee(g).pct,
      });
    }
  }

  const essais: Ligne[] = [];
  for (const c of ctxs) {
    for (const ep of [...c.g.eprouvettes].sort((a, b) => a.code.localeCompare(b.code))) essais.push(ligne(COLONNES_ESSAIS, { ...c, ep }));
  }
  const materiaux = materiauxDuJeu(ctxs, catalogues);

  return {
    manifeste: {
      application: "MineBackfill",
      type: "jeu-essais",
      version: JEU_ESSAIS_VERSION,
      dictionnaire_version: DICTIONNAIRE_VERSION,
      exporte_le: x.maintenant.toISOString(),
      session: x.sessionLibelle,
      selection: x.seulementAcceptees
        ? "gâchées acceptées par l'enseignant et non modifiées depuis"
        : "toutes les gâchées (copies de conflit exclues)",
      nb_operateurs: new Set(ctxs.map((c) => c.operateur)).size,
      nb_gachees: ctxs.length,
      nb_eprouvettes: essais.length,
      nb_essais_retenus: essais.filter((l) => l.retenu === true).length,
      nb_materiaux: materiaux.length,
      versions_solveur: [...new Set(ctxs.map((c) => c.g.solverVersion).filter((v): v is string => !!v))].sort(),
      pseudonymisation: PSEUDONYMISATION,
      champs_retires: CHAMPS_RETIRES,
      textes_libres: Object.values(TABLES).flatMap((t) => (t as Colonne<never>[]).filter((k) => k.type === "texte libre").map((k) => k.cle))
        .filter((k, i, tous) => tous.indexOf(k) === i),
    },
    essais,
    gachees: ctxs.map((c) => ligne(COLONNES_GACHEES, c)),
    materiaux: materiaux.map((m) => ligne(COLONNES_MATERIAUX, m)),
  };
}

/** Une ligne par matériau référencé : catalogue de l'enseignant d'abord, instantané sinon. */
function materiauxDuJeu(ctxs: CtxGachee[], cat: EntreesJeuEssais["catalogues"]): LigneMateriau[] {
  const parRef = new Map<string, LigneMateriau>();
  // `vues` : un matériau ne compte qu'une fois par gâchée.
  const ajouter = (ref: string | null, fabrique: () => Omit<LigneMateriau, "ref" | "nbGachees">, vues: Set<string>) => {
    if (!ref || vues.has(ref)) return;
    vues.add(ref);
    const deja = parRef.get(ref);
    if (deja) { deja.nbGachees += 1; return; }
    parRef.set(ref, { ...fabrique(), ref, nbGachees: 1 });
  };
  for (const c of ctxs) {
    const vues = new Set<string>();
    const r = c.m.residu;
    ajouter(refMateriau("residu", r), () => {
      const item = r?.id ? cat.residus.find((x) => x.id === r.id) : undefined;
      return item
        ? { type: "residu", source: "catalogue", nom: item.nom, gs: item.gs, w0Pct: item.w0_pct, provenance: item.provenance, caracterisation: item }
        : { type: "residu", source: "instantane", nom: r?.nom, gs: r?.gs, w0Pct: r?.w0Pct, provenance: r?.provenance };
    }, vues);
    const gr = c.m.granulat;
    ajouter(refMateriau("granulat", gr), () => {
      const item = gr?.id ? cat.granulats.find((x) => x.id === gr.id) : undefined;
      return item
        ? { type: "granulat", source: "catalogue", nom: item.nom, gs: item.gs, humiditePct: item.humidite_pct, provenance: item.provenance, caracterisation: item }
        : { type: "granulat", source: "instantane", nom: gr?.nom, gs: gr?.gs, humiditePct: gr?.humiditePct, provenance: gr?.provenance };
    }, vues);
    for (const l of c.m.liants ?? []) {
      ajouter(refMateriau("liant", l), () => {
        const item = (l.id ? cat.liants.find((x) => x.id === l.id) : undefined) ?? (l.code ? cat.liants.find((x) => x.code === l.code) : undefined);
        return item
          ? { type: "liant", source: "catalogue", nom: item.nom, code: item.code, gs: item.gs }
          : { type: "liant", source: "instantane", nom: l.nom, code: l.code, gs: l.gs };
      }, vues);
    }
  }
  const ordre = { residu: 0, granulat: 1, liant: 2 };
  return [...parRef.values()].sort((a, b) => ordre[a.type] - ordre[b.type] || a.ref.localeCompare(b.ref));
}

/** Le dictionnaire des données : une entrée par colonne de chaque table. */
export function dictionnaire(): { table: NomTable; cle: string; libelle: string; unite: string; type: TypeColonne; description: string }[] {
  return (Object.keys(TABLES) as NomTable[]).flatMap((table) =>
    (TABLES[table] as Colonne<never>[]).map((k) => ({ table, cle: k.cle, libelle: k.libelle, unite: k.unite ?? "", type: k.type, description: k.description })));
}

/** Export JSON : manifeste, dictionnaire et les trois tables. */
export function jeuEssaisJson(j: JeuEssais): unknown {
  return { manifeste: j.manifeste, dictionnaire: dictionnaire(), essais: j.essais, gachees: j.gachees, materiaux: j.materiaux };
}

const versCellule = (v: Valeur): CelluleCsv => (typeof v === "boolean" ? (v ? "oui" : "non") : v);

/** CSV d'une table : en-tête = clés du dictionnaire ; booléens « oui » / « non ». */
export function lignesCsvTable(j: JeuEssais, table: NomTable): CelluleCsv[][] {
  const cles = (TABLES[table] as Colonne<never>[]).map((k) => k.cle);
  return securiserCsv([cles, ...j[table].map((l) => cles.map((k) => versCellule(l[k] ?? null)))]);
}

/** CSV du dictionnaire des données. */
export function lignesCsvDictionnaire(): CelluleCsv[][] {
  return securiserCsv([
    ["Table", "Clé", "Libellé", "Unité", "Type", "Description"],
    ...dictionnaire().map((d) => [d.table, d.cle, d.libelle, d.unite, d.type, d.description]),
  ]);
}
