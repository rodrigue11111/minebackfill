// frontend/src/lib/formules-calculateur.ts
// Fiches « calculateur » des Résultats (2026-10-30, demande de l'utilisateur :
// toute valeur des Résultats doit pouvoir montrer la formule qui la donne).
//
// Le cours (formulas-data.ts, F001 à F104) couvre la plupart des lignes ; les
// autres (volumes de chaque phase, volume du moule, masse de chaque liant,
// eau contenue dans le résidu, volume d'air…) n'y ont pas de fiche. Ces
// fiches-ci disent EXACTEMENT ce que le calculateur fait, avec l'endroit du
// code (`source`) ; elles sont marquées « hors cours » partout où elles
// paraissent, pour ne jamais passer pour une page du cours.
//
// Chacune est vérifiée par formules-lignes.test.ts : évaluée avec les valeurs
// d'un résultat, elle redonne la valeur affichée (recettes du vrai
// calculateur). Les deux fiches de l'essai-erreur (C02, C03) dépendent
// d'entrées qui ne sont pas dans le résultat : elles sont vérifiées contre le
// code du serveur (mix_pipeline.py), pas numériquement.

import type { Formula } from "./formulas-data";

export interface FicheCalculateur {
  /** « C01 », « C02 »… */
  id: string;
  title: string;
  equationLatex: string;
  equationPlainText: string;
  variables: Formula["variables"];
  contextSnippet: string;
  /** Où le calculateur fait ce calcul. */
  source: string;
}

export const MENTION_HORS_COURS = "Formule du calculateur MineBackfill (hors cours)";

export const FICHES_CALCULATEUR: FicheCalculateur[] = [
  {
    id: "C01",
    title: "Masse de chaque liant",
    equationLatex: "M_{c,i} = x_i \\, M_b",
    equationPlainText: "Mc,i = xi * Mb",
    variables: [
      { symbol: "M_{c,i}", description: "Masse du liant i (ligne affichée)", unit: "kg" },
      { symbol: "x_i", description: "Part du liant i dans l'agent liant (page Informations)", unit: null },
      { symbol: "M_b", description: "Masse totale de liant", unit: "kg" },
    ],
    contextSnippet: "La masse de liant se répartit entre les ciments selon les parts choisies dans Informations (Agent liant).",
    source: "backend/app/core/rpc_solver.py et rpg_solver.py : masse de liant × part de chaque ciment",
  },
  {
    id: "C02",
    title: "Liant à ajouter ou à retirer (essai-erreur)",
    equationLatex:
      "M_{b\\text{-ad}} = \\begin{cases} B_{w,\\text{visé}}\\,\\Delta M_t & \\text{liant pour le résidu ajouté (par défaut)} \\\\ B_{w,\\text{visé}}\\,(M_t + M_{ag}) - M_{b,\\text{base}} & \\text{Bw maintenu sur tous les grains} \\\\ 0 & \\text{aucun liant ajouté} \\\\ M_w / (E/L)_{\\text{base}} - M_{b,\\text{base}} & \\text{liant dosé par le rapport E/L} \\end{cases}",
    equationPlainText: "Mb-ad selon la règle : Bw_vise*dMt ; Bw_vise*(Mt+Mag) - Mb_base ; 0 ; Mw/(E/L)_base - Mb_base",
    variables: [
      { symbol: "M_{b\\text{-ad}}", description: "Liant à ajouter (négatif : à retirer)", unit: "kg" },
      { symbol: "B_{w,\\text{visé}}", description: "Taux de liant visé de la recette de base", unit: null },
      { symbol: "\\Delta M_t", description: "Résidu sec ajouté, résidu humide ajouté compris (M / (1 + w₀))", unit: "kg" },
      { symbol: "M_{b,\\text{base}}", description: "Liant de la recette de base", unit: "kg" },
      { symbol: "(E/L)_{\\text{base}}", description: "Rapport eau/liant de la recette de base", unit: null },
    ],
    contextSnippet: "La règle se choisit dans le formulaire essai-erreur. Le Bw affiché est ensuite celui ATTEINT, recalculé sur le mélange final.",
    source: "backend/app/core/mix_pipeline.py, apply_essai_adjustments (règles du liant)",
  },
  {
    id: "C03",
    title: "Chaque liant à ajouter (essai-erreur)",
    equationLatex: "M_{c,i\\text{-ad}} = x_i \\, M_{b\\text{-ad}}",
    equationPlainText: "Mc,i-ad = xi * Mb-ad",
    variables: [
      { symbol: "M_{c,i\\text{-ad}}", description: "Liant i à ajouter (ligne affichée)", unit: "kg" },
      { symbol: "x_i", description: "Part du liant i dans l'agent liant (page Informations)", unit: null },
      { symbol: "M_{b\\text{-ad}}", description: "Liant total à ajouter", unit: "kg" },
    ],
    contextSnippet: "Le liant ajouté se répartit entre les ciments comme le liant de la recette.",
    source: "backend/app/core/rpc_solver.py et rpg_solver.py (essai-erreur) : liant ajouté × part de chaque ciment",
  },
  {
    id: "C04",
    title: "Part massique de granulat",
    equationLatex: "A_m = \\frac{M_{ag}}{M_t + M_{ag}}",
    equationPlainText: "Am = Mag / (Mt + Mag)",
    variables: [
      { symbol: "A_m", description: "Part massique de granulat dans les grains hors liant", unit: null },
      { symbol: "M_{ag}", description: "Masse de granulat sec", unit: "kg" },
      { symbol: "M_t", description: "Masse de résidu sec", unit: "kg" },
    ],
    contextSnippet: "Affichée en % dans les Résultats.",
    source: "backend/app/core/rpg_solver.py : aggregate_mass_pct = Mag / (Mag + Mt) × 100",
  },
  {
    id: "C05",
    title: "Part volumique de granulat dans le remblai",
    equationLatex: "A_{v,T} = \\frac{V_{ag}}{V_T}",
    equationPlainText: "Av,T = Vag / VT",
    variables: [
      { symbol: "A_{v,T}", description: "Part du volume total occupée par le granulat", unit: null },
      { symbol: "V_{ag}", description: "Volume des grains de granulat", unit: "m³" },
      { symbol: "V_T", description: "Volume total de remblai", unit: "m³" },
    ],
    contextSnippet: "Affichée en % dans les Résultats.",
    source: "backend/app/core/rpg_solver.py : aggregate_vol_pct_of_backfill = Vag / VT × 100",
  },
  {
    id: "C06",
    title: "Masse volumique des grains du remblai",
    equationLatex: "\\rho_s = G_s \\, \\rho_w = \\rho_d \\, (1 + e)",
    equationPlainText: "rho_s = Gs * rho_w = rho_d * (1 + e)",
    variables: [
      { symbol: "\\rho_s", description: "Masse volumique des grains (résidu, granulat et liant)", unit: "kg/m³" },
      { symbol: "G_s", description: "Densité relative des grains du remblai", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "e", description: "Indice des vides", unit: null },
    ],
    contextSnippet: "La seconde forme vient de ρd = ρs / (1 + e) (F007).",
    source: "frontend/src/lib/derived.ts, rhoSolideKgM3 = ρd (1 + e)",
  },
  {
    id: "C07",
    title: "Poids volumique des grains",
    equationLatex: "\\gamma_s = \\frac{g \\, \\rho_s}{1000}",
    equationPlainText: "gamma_s = g * rho_s / 1000",
    variables: [
      { symbol: "\\gamma_s", description: "Poids volumique des grains", unit: "kN/m³" },
      { symbol: "g", description: "Accélération de la pesanteur", unit: "m/s²" },
      { symbol: "\\rho_s", description: "Masse volumique des grains", unit: "kg/m³" },
    ],
    contextSnippet: "Même relation que γd (F094), appliquée aux grains.",
    source: "frontend/src/lib/derived.ts, gammaSolideKNM3",
  },
  {
    id: "C08",
    title: "Volume d'un moule",
    equationLatex: "V_{moule} = \\pi\\, r^2\\, h \\quad \\text{(ou } S\\,h,\\ \\text{ou } L\\,l\\,h,\\ \\text{ou le volume saisi)}",
    equationPlainText: "Vmoule = pi * r^2 * h (ou S*h, L*l*h, volume saisi)",
    variables: [
      { symbol: "V_{moule}", description: "Volume d'un moule", unit: "m³" },
      { symbol: "r", description: "Rayon du moule (page Informations)", unit: "m" },
      { symbol: "h", description: "Hauteur du moule", unit: "m" },
    ],
    contextSnippet: "Selon la géométrie choisie dans Informations : rayon et hauteur, section et hauteur, longueur × largeur × hauteur, ou volume direct.",
    source: "backend/app/core/rpc_solver.py, compute_container_volume_m3",
  },
  {
    id: "C09",
    title: "Volume total à préparer",
    equationLatex: "V_T = N_c \\, V_{moule} \\, \\kappa",
    equationPlainText: "VT = Nc * Vmoule * kappa",
    variables: [
      { symbol: "V_T", description: "Volume total de remblai de la recette", unit: "m³" },
      { symbol: "N_c", description: "Nombre de moules par recette", unit: null },
      { symbol: "V_{moule}", description: "Volume d'un moule", unit: "m³" },
      { symbol: "\\kappa", description: "Facteur de perte (κ ≥ 1)", unit: null },
    ],
    contextSnippet: "En essai-erreur, V_T est celui de la recette de base, plus le volume de chaque ajout.",
    source: "backend/app/core/rpc_solver.py et rpg_solver.py (V_T) ; mix_pipeline.py, apply_essai_adjustments (ajouts)",
  },
  {
    id: "C10",
    title: "Volume des grains de résidu",
    equationLatex: "V_t = \\frac{M_t}{G_{s,t}\\,\\rho_w}",
    equationPlainText: "Vt = Mt / (Gs,t * rho_w)",
    variables: [
      { symbol: "V_t", description: "Volume des grains de résidu", unit: "m³" },
      { symbol: "M_t", description: "Masse de résidu sec", unit: "kg" },
      { symbol: "G_{s,t}", description: "Densité relative des grains du résidu", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
    ],
    contextSnippet: "Volume d'une phase = masse / masse volumique de ses grains.",
    source: "backend/app/core/mix_pipeline.py, solve_recipe : vr = mr_sec / (gs_r × rho_w)",
  },
  {
    id: "C11",
    title: "Volume des grains de liant",
    equationLatex: "V_b = \\frac{M_b}{G_{s,b}\\,\\rho_w}",
    equationPlainText: "Vb = Mb / (Gs,b * rho_w)",
    variables: [
      { symbol: "V_b", description: "Volume des grains de liant", unit: "m³" },
      { symbol: "M_b", description: "Masse totale de liant", unit: "kg" },
      { symbol: "G_{s,b}", description: "Densité relative des grains du liant", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
    ],
    contextSnippet: "Volume d'une phase = masse / masse volumique de ses grains.",
    source: "backend/app/core/mix_pipeline.py, solve_recipe : vb = mb / (gs_binder × rho_w)",
  },
  {
    id: "C12",
    title: "Volume d'eau",
    equationLatex: "V_w = \\frac{M_w}{\\rho_w}",
    equationPlainText: "Vw = Mw / rho_w",
    variables: [
      { symbol: "V_w", description: "Volume d'eau", unit: "m³" },
      { symbol: "M_w", description: "Masse d'eau totale", unit: "kg" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
    ],
    contextSnippet: "Avec θ = V_w / V_T (F002) et S_r = V_w / V_v (F003).",
    source: "backend/app/core/mix_pipeline.py, solve_recipe : vw = mw_total / rho_w",
  },
  {
    id: "C13",
    title: "Volume des grains de granulat",
    equationLatex: "V_{ag} = \\frac{M_{ag}}{G_{s,ag}\\,\\rho_w}",
    equationPlainText: "Vag = Mag / (Gs,ag * rho_w)",
    variables: [
      { symbol: "V_{ag}", description: "Volume des grains de granulat", unit: "m³" },
      { symbol: "M_{ag}", description: "Masse de granulat sec", unit: "kg" },
      { symbol: "G_{s,ag}", description: "Densité relative des grains du granulat", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
    ],
    contextSnippet: "Volume d'une phase = masse / masse volumique de ses grains.",
    source: "backend/app/core/mix_pipeline.py, solve_recipe : vg = mg_sec / (gs_g × rho_w)",
  },
  {
    id: "C14",
    title: "Eau contenue dans le résidu",
    equationLatex: "M_{w\\text{-rés}} = M_{t\\text{-hum}} - M_t = w_0 \\, M_t",
    equationPlainText: "Mw-res = Mt-hum - Mt = w0 * Mt",
    variables: [
      { symbol: "M_{w\\text{-rés}}", description: "Eau apportée par le résidu humide", unit: "kg" },
      { symbol: "M_{t\\text{-hum}}", description: "Masse de résidu humide", unit: "kg" },
      { symbol: "M_t", description: "Masse de résidu sec", unit: "kg" },
      { symbol: "w_0", description: "Teneur en eau du résidu tel que reçu", unit: null },
    ],
    contextSnippet: "C'est l'eau déjà présente : l'eau à ajouter est l'eau totale moins celle-ci (F043).",
    source: "backend/app/core/mix_pipeline.py, solve_recipe : mw_in_residue = w0 × mr_sec",
  },
  {
    id: "C15",
    title: "Volume d'air",
    equationLatex: "V_a = V_v - V_w = V_v \\, (1 - S_r)",
    equationPlainText: "Va = Vv - Vw = Vv * (1 - Sr)",
    variables: [
      { symbol: "V_a", description: "Volume d'air", unit: "m³" },
      { symbol: "V_v", description: "Volume des vides", unit: "m³" },
      { symbol: "V_w", description: "Volume d'eau", unit: "m³" },
      { symbol: "S_r", description: "Degré de saturation", unit: null },
    ],
    contextSnippet: "Nul pour une pâte saturée (S_r = 100 %).",
    source: "frontend/src/lib/derived.ts, volumeAirM3",
  },
  {
    id: "C16",
    title: "Masse sèche de résidu et de granulat",
    equationLatex: "M_{t+ag} = M_t + M_{ag}",
    equationPlainText: "Mt+ag = Mt + Mag",
    variables: [
      { symbol: "M_{t+ag}", description: "Grains secs hors liant", unit: "kg" },
      { symbol: "M_t", description: "Masse de résidu sec", unit: "kg" },
      { symbol: "M_{ag}", description: "Masse de granulat sec (0 en RPC)", unit: "kg" },
    ],
    contextSnippet: "C'est la masse sur laquelle se rapporte le taux de liant B_w.",
    source: "frontend/src/lib/derived.ts, masseRejetSecTotaleKg",
  },
];

export const FICHE_CALCULATEUR_MAP = new Map(FICHES_CALCULATEUR.map((f) => [f.id, f]));
