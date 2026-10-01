import { describe, expect, it } from "vitest";
import { messageErreurApi } from "./api-error";

describe("messageErreurApi", () => {
  it("rend tel quel un message du serveur (texte)", () => {
    expect(messageErreurApi({ detail: "Volume du contenant requis." }, 422)).toBe("Volume du contenant requis.");
  });

  it("liste les erreurs de validation après « Entrée invalide : », champ en français", () => {
    const m = messageErreurApi({ detail: [{ loc: ["body", "specific_gravity"], msg: "doit être positif" }] }, 422);
    expect(m).toBe("Entrée invalide : Gs : doit être positif");
  });

  it("au-delà de trois erreurs, annonce le reste", () => {
    const erreur = { loc: ["body", "x"], msg: "requis" };
    const m = messageErreurApi({ detail: [erreur, erreur, erreur, erreur, erreur] }, 422);
    expect(m).toContain("(et 2 autre(s))");
  });

  it("sans détail exploitable, donne le code HTTP", () => {
    expect(messageErreurApi(null, 500)).toBe("Erreur API (500)");
  });
});
