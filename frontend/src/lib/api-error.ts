// Traduction des erreurs de l'API en message lisible.
// Gère les trois formes de réponse FastAPI :
//  - detail: string            (handler ValueError du backend, HTTPException)
//  - detail: [{loc, msg, ...}] (erreur de validation Pydantic 422)
//  - autre / vide              (repli générique avec le code HTTP)

const NOMS_CHAMPS: Record<string, string> = {
  container_type: "type de contenant",
  container_section: "section du contenant",
  container_height: "hauteur du contenant",
  container_radius: "rayon du contenant",
  container_length: "longueur du contenant",
  container_width: "largeur du contenant",
  solids_mass_pct: "pourcentage solide massique Cw",
  saturation_pct: "saturation Sr",
  binder_mass_pct_recipes: "taux massique de liant Bw des recettes",
  wc_ratio_recipes: "rapport eau/liant E/L des recettes",
  aggregate_fraction_pct: "fraction de granulat",
  aggregate_specific_gravity: "Gs du granulat",
  specific_gravity: "Gs",
  moisture_mass_pct: "teneur en eau",
  container_volume_m3: "volume du contenant",
  containers_per_recipe: "nombre de moules par recette",
  safety_factor: "facteur de perte κ",
  num_recipes: "nombre de recettes",
  slump_mm: "affaissement visé",
  cone_type: "type de cône",
  components: "composants du liant",
  mass_fraction: "fraction massique",
  volume_m3: "volume du chantier",
  wet_density_kg_m3: "masse volumique humide",
  total_mass_kg: "masse totale de RRC",
  cement_specific_gravity: "Gs du ciment",
  retarder_dosage_ml_per_100kg: "dosage en retardateur D0",
  retarder_density_g_ml: "masse volumique du retardateur",
  adjustments: "ajouts",
  added_dry_residue_mass: "résidu séché ajouté",
  binder_rule: "choix du liant pendant les ajouts",
  added_wet_residue_mass: "résidu humide ajouté",
  added_water_mass: "eau ajoutée",
  added_aggregate_mass: "granulat ajouté",
  aggregate_moisture_mass_pct: "teneur en eau du granulat ajouté",
  x_min: "borne « de »",
  x_max: "borne « à »",
  steps: "nombre de points",
};

/** Le même champ, précisé par son parent (« Gs » du résidu ou d'un composant du liant). */
const NOMS_SOUS: Record<string, Record<string, string>> = {
  residue: { specific_gravity: "Gs du résidu", moisture_mass_pct: "teneur en eau du résidu w₀" },
};

/** Listes dont l'indice est une recette ; derrière `components`, c'est un composant du liant. */
const LISTES_RECETTES = new Set(["binder_mass_pct_recipes", "wc_ratio_recipes", "adjustments"]);

/**
 * Messages de validation Pydantic courants, en français. Un message inconnu
 * reste en anglais (mieux qu'un message faux).
 */
const MESSAGES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Input should be greater than or equal to (\S+)$/, (m) => `doit être supérieur ou égal à ${nombreFr(m[1])}`],
  [/^Input should be greater than (\S+)$/, (m) => `doit être supérieur à ${nombreFr(m[1])}`],
  [/^Input should be less than or equal to (\S+)$/, (m) => `doit être inférieur ou égal à ${nombreFr(m[1])}`],
  [/^Input should be less than (\S+)$/, (m) => `doit être inférieur à ${nombreFr(m[1])}`],
  [/^Field required$/, () => "valeur obligatoire"],
  [/^Input should be a valid number/, () => "doit être un nombre"],
  [/^Input should be a finite number/, () => "doit être un nombre fini"],
  [/^Input should be a valid integer/, () => "doit être un nombre entier"],
  [/^List should have at least (\d+) items? after validation/, (m) => `doit contenir au moins ${m[1]} élément${m[1] === "1" ? "" : "s"}`],
  [/^List should have at most (\d+) items? after validation/, (m) => `doit contenir au plus ${m[1]} élément${m[1] === "1" ? "" : "s"}`],
  [/^Input should be (.+)$/, (m) => `doit valoir ${m[1].replace(/ or /g, " ou ")}`],
  // Validateur du backend : son texte suit le préfixe.
  [/^Value error, (.+)$/s, (m) => m[1]],
];

/** « 0.5 » écrit à la française (« 0,5 ») ; un texte non numérique reste tel quel. */
function nombreFr(s: string): string {
  return /^-?\d+(\.\d+)?$/.test(s) ? s.replace(".", ",") : s;
}

export function traduireMessagePydantic(msg: string): string {
  for (const [motif, f] of MESSAGES) {
    const m = msg.match(motif);
    if (m) return f(m);
  }
  return msg;
}

/**
 * Nom lisible d'un champ : « taux massique de liant Bw des recettes (recette 2) »,
 * « Gs (composant 1 du liant) ». Un indice ne devient « recette n » que derrière
 * une liste de recettes (avant : tout nombre du chemin était une recette).
 */
function nomDuChamp(loc: unknown[]): string {
  const iNom = loc.map((p) => typeof p === "string").lastIndexOf(true);
  if (iNom < 0) return loc.join(".");
  const nom = loc[iNom] as string;
  const parent = loc.slice(0, iNom).reverse().find((p) => typeof p === "string") as string | undefined;
  const lisible = (parent && NOMS_SOUS[parent]?.[nom]) ?? NOMS_CHAMPS[nom] ?? nom;
  let precision = "";
  for (let i = 1; i < loc.length; i++) {
    const p = loc[i];
    const avant = loc[i - 1];
    if (typeof p !== "number" || typeof avant !== "string") continue;
    if (LISTES_RECETTES.has(avant)) precision = ` (recette ${p + 1})`;
    else if (avant === "components") precision = ` (composant ${p + 1} du liant)`;
  }
  return lisible + precision;
}

export function messageErreurApi(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const items = detail.slice(0, 3).map((e) => {
      const loc = Array.isArray(e?.loc) ? e.loc.filter((p: unknown) => p !== "body") : [];
      const champ = loc.length ? nomDuChamp(loc) : "";
      // Une case vide d'une liste part en null : « valeur obligatoire », pas « doit être un nombre ».
      const vide = e?.input === null && typeof e?.msg === "string" && /^Input should be a valid (number|integer)/.test(e.msg);
      const msg = vide ? "valeur obligatoire" : typeof e?.msg === "string" ? traduireMessagePydantic(e.msg) : "valeur refusée";
      return champ ? `${champ} : ${msg}` : msg;
    });
    const suite = detail.length > 3 ? ` (et ${detail.length - 3} autre(s))` : "";
    return `Entrée invalide : ${items.join(" ; ")}${suite}`;
  }
  if (status >= 500) {
    return `Le serveur de calcul a rencontré une erreur interne (${status}). Réessayez ; vos entrées sont conservées.`;
  }
  return `Erreur API (${status})`;
}

export function messageErreurReseau(): string {
  return "Impossible de joindre le serveur de calcul. Vérifiez votre connexion (ou que le backend est démarré en local).";
}
