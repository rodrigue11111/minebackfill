// frontend/src/lib/glossaire.ts
// Vocabulaire UNIQUE de l'application : les termes des remblais miniers
// cimentés tels que le cours les emploie (GNM1002, H2026, chapitre 4 — PDF à
// la racine du dépôt), les classeurs du professeur (Data/) et son programme
// historique, avec les normes des essais. Module PUR, sans dépendance : les
// écrans, les exports et le Guide le lisent tous.
//
// Règle : un libellé qui revient à plusieurs endroits vient de `T` ; toute
// entrée du glossaire cite sa source. Les numéros de diapositive (« dia N »)
// sont ceux imprimés sur les diapositives, égaux à la page du PDF ; ils ont été
// vérifiés dans le PDF le 2026-09-30. Le cours NE CITE AUCUNE NORME d'essai :
// les normes (ASTM, CSA) viennent de la pratique nord-américaine et attendent
// la confirmation de l'enseignant.

export type Organisme = "ASTM" | "CSA" | "ISO";

export interface Norme {
  code: string;
  titre: string;
  organisme: Organisme;
}

export type CategorieGlossaire = "Remblais" | "Mélange" | "Liants" | "Matériaux" | "Essais" | "Méthodes";

export interface EntreeGlossaire {
  cle: string;
  terme: string;
  symbole?: string;
  unite?: string;
  definition: string;
  /** Autres noms rencontrés (anglais, anciens noms) : repères, pas des libellés. */
  synonymes?: string[];
  normes?: Norme[];
  source: string;
  categorie: CategorieGlossaire;
}

/* ── Normes ───────────────────────────────────────────────────────────────── */

export const NORMES_REF = {
  C143: { code: "ASTM C143/C143M", organisme: "ASTM", titre: "Standard Test Method for Slump of Hydraulic-Cement Concrete" },
  A23_5C: { code: "CSA A23.2-5C", organisme: "CSA", titre: "Affaissement et étalement du béton" },
  C39: { code: "ASTM C39/C39M", organisme: "ASTM", titre: "Standard Test Method for Compressive Strength of Cylindrical Concrete Specimens" },
  C192: { code: "ASTM C192/C192M", organisme: "ASTM", titre: "Standard Practice for Making and Curing Concrete Test Specimens in the Laboratory" },
  C470: { code: "ASTM C470/C470M", organisme: "ASTM", titre: "Standard Specification for Molds for Forming Concrete Test Cylinders Vertically" },
  C511: { code: "ASTM C511", organisme: "ASTM", titre: "Standard Specification for Mixing Rooms, Moist Cabinets, Moist Rooms, and Water Storage Tanks Used in the Testing of Hydraulic Cements and Concretes" },
  D2216: { code: "ASTM D2216", organisme: "ASTM", titre: "Standard Test Methods for Laboratory Determination of Water (Moisture) Content of Soil and Rock by Mass" },
  D854: { code: "ASTM D854", organisme: "ASTM", titre: "Standard Test Methods for Specific Gravity of Soil Solids by the Water Displacement Method" },
  C188: { code: "ASTM C188", organisme: "ASTM", titre: "Standard Test Method for Density of Hydraulic Cement" },
  A3001: { code: "CSA A3001", organisme: "CSA", titre: "Liants utilisés dans le béton (types GU, GUL, HE, HS…)" },
  C989: { code: "ASTM C989/C989M", organisme: "ASTM", titre: "Standard Specification for Slag Cement for Use in Concrete and Mortars" },
  C618: { code: "ASTM C618", organisme: "ASTM", titre: "Standard Specification for Coal Fly Ash and Raw or Calcined Natural Pozzolan for Use in Concrete" },
  C494: { code: "ASTM C494/C494M", organisme: "ASTM", titre: "Standard Specification for Chemical Admixtures for Concrete (type B : retardateur)" },
  D6913: { code: "ASTM D6913/D6913M", organisme: "ASTM", titre: "Standard Test Methods for Particle-Size Distribution (Gradation) of Soils Using Sieve Analysis" },
  D7928: { code: "ASTM D7928", organisme: "ASTM", titre: "Standard Test Method for Particle-Size Distribution (Gradation) of Fine-Grained Soils Using the Sedimentation (Hydrometer) Analysis" },
} satisfies Record<string, Norme>;

/** Les essais du laboratoire et la norme qui les encadre. */
export const ESSAIS_NORMALISES: { essai: string; normes: Norme[]; usage: string }[] = [
  {
    essai: "Affaissement au cône d'Abrams",
    normes: [NORMES_REF.C143, NORMES_REF.A23_5C],
    usage: "Consistance de la pâte fraîche au cône d'Abrams (300 mm de haut selon la norme). Le petit cône n'est pas normalisé : sa lecture est convertie par le facteur des Réglages.",
  },
  {
    essai: "Résistance à la compression uniaxiale (UCS)",
    normes: [NORMES_REF.C39],
    usage: "Écrasement des éprouvettes cylindriques aux âges de cure visés. La vitesse de chargement propre au remblai reste à valider par l'enseignant.",
  },
  {
    essai: "Confection et cure des éprouvettes",
    normes: [NORMES_REF.C192, NORMES_REF.C470, NORMES_REF.C511],
    usage: "Moulage en couches, moules cylindriques, cure en chambre humide.",
  },
  {
    essai: "Teneur en eau massique",
    normes: [NORMES_REF.D2216],
    usage: "Séchage à l'étuve (110 ± 5 °C selon la norme). Pour un remblai cimenté, les feuilles de calcul du professeur indiquent 50 °C pendant 48 h ou 105 °C pendant 24 h.",
  },
  {
    essai: "Densité relative des grains du résidu (Gs)",
    normes: [NORMES_REF.D854],
    usage: "Pycnomètre à eau.",
  },
  {
    essai: "Masse volumique du liant",
    normes: [NORMES_REF.C188],
    usage: "Donne le Gs du ciment et des ajouts cimentaires.",
  },
  {
    essai: "Granulométrie des résidus",
    normes: [NORMES_REF.D6913, NORMES_REF.D7928],
    usage: "Tamisage et sédimentométrie (fractions fines P20 µm, P80 µm).",
  },
];

/* ── Libellés répétés ─────────────────────────────────────────────────────── */

export interface Libelle {
  /** Nom scientifique complet. */
  long: string;
  /** Symbole seul (colonnes, pastilles). */
  court: string;
}

export const T = {
  rpc: { long: "Remblai en pâte cimenté", court: "RPC" },
  rpg: { long: "Remblai en pâte granulaire", court: "RPG" },
  rrc: { long: "Remblai rocheux cimenté", court: "RRC" },
  cw: { long: "Pourcentage solide massique", court: "Cw" },
  cv: { long: "Pourcentage solide volumique", court: "Cv" },
  bw: { long: "Taux massique de liant", court: "Bw" },
  bv: { long: "Taux volumique de liant", court: "Bv" },
  el: { long: "Rapport eau/liant", court: "E/L" },
  gs: { long: "Densité relative des grains", court: "Gs" },
  w: { long: "Teneur en eau massique", court: "w" },
  w0: { long: "Teneur en eau massique du résidu", court: "w₀" },
  theta: { long: "Teneur en eau volumique", court: "θ" },
  sr: { long: "Degré de saturation", court: "Sr" },
  e: { long: "Indice des vides", court: "e" },
  n: { long: "Porosité", court: "n" },
  s: { long: "Affaissement", court: "S" },
  kappa: { long: "Facteur de perte", court: "κ" },
  ucs: { long: "Résistance à la compression uniaxiale", court: "UCS" },
  am: { long: "Fraction massique de granulat", court: "Am" },
} satisfies Record<string, Libelle>;

export type CleT = keyof typeof T;

/** « Pourcentage solide massique Cw » : nom complet suivi du symbole. */
export function libelle(cle: CleT): string {
  return `${T[cle].long} ${T[cle].court}`;
}

/* ── Glossaire ────────────────────────────────────────────────────────────── */

const COURS = "Cours GNM1002 (H2026), chapitre 4";

export const GLOSSAIRE: EntreeGlossaire[] = [
  // Remblais
  { cle: "rpc", categorie: "Remblais", terme: "Remblai en pâte cimenté", symbole: "RPC", definition: "Résidus miniers tout-venant mélangés à un agent liant et à de l'eau de mélange, mis en place sous forme de pâte.", synonymes: ["cemented paste backfill (CPB)"], source: `${COURS}, dia 5` },
  { cle: "rpg", categorie: "Remblais", terme: "Remblai en pâte granulaire", symbole: "RPG", definition: "Remblai en pâte cimenté auquel on ajoute un granulat (roche concassée) ; appelé aussi remblai mixte.", synonymes: ["remblai en pâte cimenté aux granulats", "paste aggregate fill (PAF)"], source: `${COURS}, dia 5, 54 et 55` },
  { cle: "rrc", categorie: "Remblais", terme: "Remblai rocheux cimenté", symbole: "RRC", definition: "Roches stériles concassées liées par un coulis de ciment, souvent avec un retardateur de prise.", synonymes: ["cemented rockfill (CRF)"], source: `${COURS}, dia 5, 65 et 71` },
  { cle: "roches-steriles", categorie: "Matériaux", terme: "Roches stériles", symbole: "RS", definition: "Roche extraite pour accéder au minerai, sans valeur économique ; concassée, elle forme le squelette du remblai rocheux. Sa masse est notée MWR.", synonymes: ["waste rock (WR)"], source: `${COURS}, dia 5, 6 et 65` },
  { cle: "coulis", categorie: "Matériaux", terme: "Coulis de ciment", definition: "Mélange de ciment, d'eau et de retardateur de prise qui enrobe les roches stériles du RRC.", synonymes: ["cement slurry"], source: `${COURS}, dia 70` },
  { cle: "retardateur", categorie: "Matériaux", terme: "Retardateur de prise", symbole: "SR", unite: "ml/100 kg de ciment", definition: "Adjuvant du coulis qui retarde la prise ; dosage de 50 à 260 ml par 100 kg de ciment. Ne pas confondre SR avec Sr, le degré de saturation.", normes: [NORMES_REF.C494], source: `${COURS}, dia 65 et 67` },

  // Mélange
  { cle: "cw", categorie: "Mélange", terme: "Pourcentage solide massique", symbole: "Cw", unite: "%", definition: "Masse des solides (résidu, granulat, liant) rapportée à la masse totale du remblai.", source: `${COURS}, dia 9` },
  { cle: "cv", categorie: "Mélange", terme: "Pourcentage solide volumique", symbole: "Cv", unite: "%", definition: "Volume des solides rapporté au volume total du remblai.", source: `${COURS}, dia 9` },
  { cle: "w", categorie: "Mélange", terme: "Teneur en eau massique", symbole: "w", unite: "%", definition: "Masse d'eau rapportée à la masse des solides secs.", normes: [NORMES_REF.D2216], source: `${COURS}, dia 8` },
  { cle: "w0", categorie: "Mélange", terme: "Teneur en eau massique des résidus", symbole: "w₀", unite: "%", definition: "Teneur en eau des résidus humides tels qu'ils arrivent au laboratoire ; elle réduit l'eau à ajouter. Notée aussi w_rés.", normes: [NORMES_REF.D2216], source: `${COURS}, dia 44 et 83` },
  { cle: "theta", categorie: "Mélange", terme: "Teneur en eau volumique", symbole: "θ", unite: "%", definition: "Volume d'eau rapporté au volume total.", source: `${COURS}, dia 8` },
  { cle: "sr", categorie: "Mélange", terme: "Degré de saturation", symbole: "Sr", unite: "%", definition: "Volume d'eau rapporté au volume des vides ; 100 % pour une pâte destinée à s'écouler dans un réseau de tuyauterie.", source: `${COURS}, dia 8 et 41` },
  { cle: "e", categorie: "Mélange", terme: "Indice des vides", symbole: "e", definition: "Volume des vides rapporté au volume des solides.", source: `${COURS}, dia 8` },
  { cle: "n", categorie: "Mélange", terme: "Porosité", symbole: "n", definition: "Volume des vides rapporté au volume total ; n = e / (1 + e).", source: `${COURS}, dia 8 et 35` },
  { cle: "rho", categorie: "Mélange", terme: "Masse volumique humide / sèche", symbole: "ρh, ρd", unite: "kg/m³", definition: "Masse (totale, ou des seuls solides) rapportée au volume total. Une masse volumique a une unité ; une densité relative n'en a pas.", source: `${COURS}, dia 8, 23 et 33` },
  { cle: "gamma", categorie: "Mélange", terme: "Poids volumique humide / sec", symbole: "γh, γd", unite: "kN/m³", definition: "Masse volumique multipliée par l'accélération de la pesanteur (γh = 9,81 × ρh).", source: `${COURS}, dia 28 et 33` },
  { cle: "gs", categorie: "Mélange", terme: "Densité relative des grains", symbole: "Gs", definition: "Gs = ρs / ρw : masse volumique des grains rapportée à celle de l'eau. Sans unité.", synonymes: ["Dr", "DR", "specific gravity (SG)"], normes: [NORMES_REF.D854], source: `${COURS}, dia 8, 22 et 23-24` },
  { cle: "am", categorie: "Mélange", terme: "Fraction massique de granulat", symbole: "Am", unite: "%", definition: "Masse sèche de granulat rapportée à la masse sèche de résidus et de granulat : Am = Ma / (Ma + Mt).", source: `${COURS}, dia 55 à 59` },

  // Liants
  { cle: "agent-liant", categorie: "Liants", terme: "Agent liant", definition: "Ciment Portland seul ou associé à des ajouts cimentaires (laitier, cendres volantes), décrit par la proportion massique de chaque composant.", synonymes: ["binder"], source: `${COURS}, dia 22, 25 et 37` },
  { cle: "bw", categorie: "Liants", terme: "Taux massique de liant", symbole: "Bw", unite: "%", definition: "Masse de liant rapportée à la masse sèche de résidus (et de granulat pour le RPG).", source: `${COURS}, dia 13, 49 et 50` },
  { cle: "bws", categorie: "Liants", terme: "Teneur massique de liant", symbole: "Bws", unite: "%", definition: "Masse de liant rapportée à la masse des solides (résidus et granulat, plus le liant). Notée aussi cc.", source: `${COURS}, dia 13-14` },
  { cle: "cb", categorie: "Liants", terme: "Pourcentage massique de liant", symbole: "Cb", unite: "%", definition: "Masse de liant rapportée à la masse totale du remblai (à ne pas confondre avec Bw).", source: `${COURS}, dia 13-14` },
  { cle: "bv", categorie: "Liants", terme: "Taux volumique de liant", symbole: "Bv", unite: "%", definition: "Volume de liant rapporté au volume de résidus (et de granulat pour le RPG).", source: `${COURS}, dia 16 à 18` },
  { cle: "el", categorie: "Liants", terme: "Rapport eau/liant", symbole: "E/L", definition: "Masse d'eau rapportée à la masse de liant. Le cours l'écrit aussi E/C (eau/ciment), W/C ou w/b ; « eau/liant » reste exact pour un liant composé.", synonymes: ["E/C", "W/C", "w/b"], source: `${COURS}, dia 29-30, 58 et 67 ; classeur Intra 2017 (« Eau/Liant initial ou W/C initial »)` },
  { cle: "gu", categorie: "Liants", terme: "Ciment Portland GU (usage général)", definition: "Ciment Portland courant ; l'ancien type 10 (« CP10 »).", normes: [NORMES_REF.A3001], source: `${COURS}, dia 37 et 42 ; feuilles de calcul (« (T10) GU »)` },
  { cle: "hs", categorie: "Liants", terme: "Ciment Portland HS (haute résistance aux sulfates)", definition: "L'ancien type 50 (« CP50 »).", normes: [NORMES_REF.A3001], source: `${COURS}, dia 37 et 42 ; feuilles de calcul (« (T50) HS »)` },
  { cle: "he", categorie: "Liants", terme: "Ciment Portland HE (haute résistance initiale)", definition: "L'ancien type 30.", normes: [NORMES_REF.A3001], source: `${COURS}, dia 42 ; feuilles de calcul (« (T30) HE »)` },
  { cle: "laitier", categorie: "Liants", terme: "Laitier de haut fourneau granulé broyé", definition: "Ajout cimentaire à hydratation latente, activé par le ciment Portland.", synonymes: ["slag", "GGBFS"], normes: [NORMES_REF.C989, NORMES_REF.A3001], source: `${COURS}, dia 37 et 42 (« Slag (GGBFS) »)` },
  { cle: "cendres", categorie: "Liants", terme: "Cendres volantes", definition: "Ajout cimentaire pouzzolanique (classes F et C).", synonymes: ["fly ash (FA)"], normes: [NORMES_REF.C618, NORMES_REF.A3001], source: `${COURS}, dia 37 et 42 (« FA (types C, F) »)` },

  // Essais
  { cle: "affaissement", categorie: "Essais", terme: "Affaissement", symbole: "S", unite: "mm", definition: "Abaissement de la pâte fraîche après retrait du cône d'Abrams ; indicateur de consistance. De 150 à 250 mm pour un remblai en pâte ; 178 mm (7 po) sert de référence de consistance.", synonymes: ["slump"], normes: [NORMES_REF.C143, NORMES_REF.A23_5C], source: `${COURS}, dia 37, 38, 40 et 77` },
  { cle: "ucs", categorie: "Essais", terme: "Résistance à la compression uniaxiale", symbole: "UCS", unite: "kPa", definition: "Contrainte maximale supportée par une éprouvette cylindrique non confinée, à un âge de cure donné.", synonymes: ["unconfined compressive strength"], normes: [NORMES_REF.C39], source: `${COURS}, dia 38 (« Résistance attendue (UCS) ») ; Belem et al. (2018)` },
  { cle: "eprouvette", categorie: "Essais", terme: "Éprouvette", definition: "Cylindre de remblai moulé, curé puis écrasé ; plusieurs répliques par âge.", normes: [NORMES_REF.C192, NORMES_REF.C470], source: "Protocoles du laboratoire" },
  { cle: "age-cure", categorie: "Essais", terme: "Âge de cure", symbole: "t", unite: "j", definition: "Durée entre la coulée et l'écrasement (7, 14, 28, 56, 91 jours usuels).", source: "Écrans du programme du professeur (« Durée de cure t »)" },
  { cle: "module-young", categorie: "Essais", terme: "Module de Young", symbole: "E", unite: "kPa", definition: "Pente de la partie linéaire de la courbe contrainte-déformation, relevée par la presse.", source: "Export de la presse URSTM" },
  { cle: "gachee", categorie: "Essais", terme: "Gâchée", definition: "Quantité de remblai préparée en une fois au laboratoire, dont on tire les éprouvettes.", synonymes: ["batch"], source: "Classeurs du professeur (« # Batch »)" },

  // Méthodes
  { cle: "dosage-cw", categorie: "Méthodes", terme: "Dosage selon Cw", definition: "Recette calculée pour un pourcentage solide massique fixé.", source: "Programme du professeur (onglet « Dosage selon Cw% »)" },
  { cle: "dosage-el", categorie: "Méthodes", terme: "Dosage selon E/L", definition: "Recette calculée pour un rapport eau/liant fixé.", source: "Programme du professeur (onglet « Dosage selon w/c »)" },
  { cle: "modele-predictif", categorie: "Méthodes", terme: "Modèle prédictif (affaissement)", definition: "Cw prédit à partir de l'affaissement visé, puis recette selon Cw.", source: "Programme du professeur (onglet « Modèle prédictif ») ; formule F103" },
  { cle: "essai-erreur", categorie: "Méthodes", terme: "Méthode essai-erreur", definition: "Recette de base corrigée par les ajouts réels (eau, résidu, liant) faits après mesure de l'affaissement.", source: "Programme du professeur (onglet « Méthode essai-erreur »)" },
  { cle: "kappa", categorie: "Méthodes", terme: "Facteur de perte", symbole: "κ", definition: "Multiplicateur des masses (supérieur à 1, souvent 1,25) qui compense les pertes au malaxage et au moulage. Appelé « facteur de sécurité » dans les feuilles de calcul.", source: `${COURS}, dia 39 et 41 ; feuilles de calcul, dia 47 et 63` },
];

/** Entrées d'une catégorie, dans l'ordre du glossaire. */
export function glossaireParCategorie(): { categorie: CategorieGlossaire; entrees: EntreeGlossaire[] }[] {
  const ordre: CategorieGlossaire[] = ["Remblais", "Mélange", "Liants", "Matériaux", "Essais", "Méthodes"];
  return ordre
    .map((categorie) => ({ categorie, entrees: GLOSSAIRE.filter((e) => e.categorie === categorie) }))
    .filter((g) => g.entrees.length > 0);
}
