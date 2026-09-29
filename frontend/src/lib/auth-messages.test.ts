import { describe, expect, it } from "vitest";
import { messageErreurAuth } from "./auth-messages";

describe("messages d'erreur Supabase Auth, en français", () => {
  it("cas courants", () => {
    expect(messageErreurAuth("Invalid login credentials")).toBe("Courriel ou mot de passe incorrect.");
    expect(messageErreurAuth("User already registered")).toMatch(/déjà un compte/);
    expect(messageErreurAuth("Email signups are disabled", "email_provider_disabled")).toMatch(/inscriptions par courriel sont désactivées/);
    expect(messageErreurAuth("Signups not allowed for this instance")).toMatch(/désactivées/);
  });

  it("mot de passe oublié : envoi non configuré, limite de fréquence, lien expiré", () => {
    expect(messageErreurAuth('Email address "a@b.ca" not authorized', "email_address_not_authorized")).toMatch(/pas encore configuré/);
    expect(messageErreurAuth("For security purposes, you can only request this after 42 seconds.")).toMatch(/Patientez/);
    expect(messageErreurAuth("email rate limit exceeded", "over_email_send_rate_limit")).toMatch(/Patientez/);
    expect(messageErreurAuth("Email link is invalid or has expired", "otp_expired")).toMatch(/expiré/);
    expect(messageErreurAuth("New password should be different from the old password.", "same_password")).toMatch(/différer/);
  });

  it("message inconnu : rendu tel quel", () => {
    expect(messageErreurAuth("Something unexpected")).toBe("Something unexpected");
  });
});
