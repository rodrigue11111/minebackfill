import { describe, expect, it } from "vitest";
import { messageErreurApi, traduireMessagePydantic } from "./api-error";

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

describe("messages Pydantic traduits", () => {
  it("bornes, obligatoire, nombre, liste, choix ; un message inconnu reste tel quel", () => {
    expect(traduireMessagePydantic("Input should be greater than 0")).toBe("doit être supérieur à 0");
    expect(traduireMessagePydantic("Input should be greater than or equal to 0.5")).toBe("doit être supérieur ou égal à 0,5");
    expect(traduireMessagePydantic("Input should be less than or equal to 100")).toBe("doit être inférieur ou égal à 100");
    expect(traduireMessagePydantic("Input should be less than 100")).toBe("doit être inférieur à 100");
    expect(traduireMessagePydantic("Field required")).toBe("valeur obligatoire");
    expect(traduireMessagePydantic("Input should be a valid number, unable to parse string as a number")).toBe("doit être un nombre");
    expect(traduireMessagePydantic("List should have at least 1 item after validation, not 0")).toBe("doit contenir au moins 1 élément");
    expect(traduireMessagePydantic("Input should be 'mini' or 'abrams'")).toBe("doit valoir 'mini' ou 'abrams'");
    expect(traduireMessagePydantic("Value error, la somme des fractions doit être 100 %")).toBe("la somme des fractions doit être 100 %");
    expect(traduireMessagePydantic("Something new")).toBe("Something new");
  });

  it("le champ d'une liste dit sa recette ; le message est en français de bout en bout", () => {
    const m = messageErreurApi({ detail: [{ loc: ["body", "binder_mass_pct_recipes", 1], msg: "Input should be greater than 0" }] }, 422);
    expect(m).toBe("Entrée invalide : taux massique de liant Bw des recettes (recette 2) : doit être supérieur à 0");
  });
});
