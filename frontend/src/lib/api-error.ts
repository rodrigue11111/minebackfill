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
};

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

/** Nom lisible d'un champ : « taux massique de liant Bw des recettes (recette 2) ». */
function nomDuChamp(loc: unknown[]): string {
  const idx = [...loc].reverse().find((p) => typeof p === "number");
  const nom = [...loc].reverse().find((p) => typeof p === "string");
  if (nom === undefined) return loc.join(".");
  const lisible = NOMS_CHAMPS[nom as string] ?? String(nom);
  return typeof idx === "number" ? `${lisible} (recette ${idx + 1})` : lisible;
}

export function messageErreurApi(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const items = detail.slice(0, 3).map((e) => {
      const loc = Array.isArray(e?.loc) ? e.loc.filter((p: unknown) => p !== "body") : [];
      const champ = loc.length ? nomDuChamp(loc) : "";
      const msg = typeof e?.msg === "string" ? traduireMessagePydantic(e.msg) : "valeur refusée";
      return champ ? `${champ} : ${msg}` : msg;
    });
    const suite = detail.length > 3 ? ` (et ${detail.length - 3} autre(s))` : "";
    return `Entrée invalide : ${items.join(" ; ")}${suite}`;
  }
  return `Erreur API (${status})`;
}

export function messageErreurReseau(): string {
  return "Impossible de joindre le serveur de calcul. Vérifiez votre connexion (ou que le backend est démarré en local).";
}
