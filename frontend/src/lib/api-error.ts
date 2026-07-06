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
  solids_mass_pct: "Cw%",
  saturation_pct: "saturation Sr",
  binder_mass_pct_recipes: "Bw% des recettes",
  wc_ratio_recipes: "rapport E/C des recettes",
  aggregate_fraction_pct: "fraction de granulat",
  aggregate_specific_gravity: "Gs du granulat",
  specific_gravity: "Gs",
  moisture_mass_pct: "teneur en eau",
};

export function messageErreurApi(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const items = detail.slice(0, 3).map((e) => {
      const loc = Array.isArray(e?.loc) ? e.loc.filter((p: unknown) => p !== "body") : [];
      const brut = loc.length ? String(loc[loc.length - 1]) : "";
      const champ = NOMS_CHAMPS[brut] || loc.join(".");
      const msg = typeof e?.msg === "string" ? e.msg : "valeur invalide";
      return champ ? `${champ} : ${msg}` : msg;
    });
    const suite = detail.length > 3 ? ` (et ${detail.length - 3} autre(s))` : "";
    return `Entrée invalide — ${items.join(" ; ")}${suite}`;
  }
  return `Erreur API (${status})`;
}

export function messageErreurReseau(): string {
  return "Impossible de joindre le serveur de calcul. Vérifiez votre connexion (ou que le backend est démarré en local).";
}
