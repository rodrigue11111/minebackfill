// frontend/src/lib/auth-messages.ts
// Messages d'erreur de Supabase Auth, traduits pour les étudiants. Module PUR.
// Supabase répond en anglais ; un message non reconnu est rendu tel quel
// plutôt que remplacé par un texte vague (il aide au dépannage).

export function messageErreurAuth(brut: string, code?: string | null): string {
  const m = brut.toLowerCase();
  const c = (code ?? "").toLowerCase();
  if (m.includes("invalid login")) return "Courriel ou mot de passe incorrect.";
  if (c === "user_banned" || m.includes("user is banned") || m.includes("user banned"))
    return "Ce compte est suspendu. Adressez-vous à l'enseignant. Le travail enregistré dans ce navigateur y reste.";
  if (m.includes("already registered") || m.includes("already been registered") || c === "user_already_exists")
    return "Ce courriel a déjà un compte. Connectez-vous (ou « Mot de passe oublié ? »).";
  if (m.includes("password should be at least") || c === "weak_password")
    return "Mot de passe trop court ou trop simple (6 caractères au moins).";
  if (m.includes("signups not allowed") || m.includes("signups are disabled") || c === "signup_disabled" || c === "email_provider_disabled")
    return "Les inscriptions par courriel sont désactivées sur le serveur. Prévenez l'enseignant.";
  if (c === "email_address_not_authorized" || (m.includes("email address") && m.includes("not authorized")))
    return "L'envoi de courriels n'est pas encore configuré sur le serveur. Adressez-vous à l'enseignant.";
  if (c === "over_email_send_rate_limit" || c === "over_request_rate_limit" || m.includes("rate limit") || m.includes("for security purposes"))
    return "Trop de demandes rapprochées. Patientez une minute, puis réessayez.";
  if (c === "same_password" || m.includes("should be different"))
    return "Le nouveau mot de passe doit différer de l'ancien.";
  if (c === "otp_expired" || m.includes("expired") || m.includes("invalid or has expired"))
    return "Ce lien a expiré ou a déjà servi. Redemandez un lien depuis la page Compte.";
  if (m.includes("email") && m.includes("invalid")) return "Courriel invalide.";
  if (m.includes("confirm")) return "Compte à confirmer (vérifiez la configuration « Confirm email »).";
  return brut;
}
