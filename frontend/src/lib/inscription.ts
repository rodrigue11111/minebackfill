// frontend/src/lib/inscription.ts
// Métadonnées envoyées à l'inscription (page Compte ; le portail fait de même).
// Le serveur n'en lit que le nom affiché et, tant que l'inscription libre est
// ouverte, la demande « enseignant » (schema.sql, verifier_code_enseignant),
// puis retire cette demande du compte. Plus de code enseignant (2026-10-26).

export function donneesInscription(nom: string, enseignant: boolean): Record<string, string> {
  return enseignant ? { display_name: nom.trim(), enseignant: "oui" } : { display_name: nom.trim() };
}
