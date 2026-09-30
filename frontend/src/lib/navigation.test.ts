import { describe, expect, it } from "vitest";
import { estActif, initiales, liensNavigation, ongletsTelephone, prenom } from "./navigation";

describe("navigation — liens", () => {
  it("Classe n'apparaît que pour l'enseignant, après Labo", () => {
    const etudiant = liensNavigation("etudiant").map((l) => l.label);
    const prof = liensNavigation("prof").map((l) => l.label);
    expect(etudiant).not.toContain("Classe");
    expect(prof.indexOf("Classe")).toBe(prof.indexOf("Labo") + 1);
    expect(liensNavigation(null)).toEqual(liensNavigation("etudiant"));
  });

  it("Industrie reste hors de la navigation", () => {
    expect(liensNavigation("prof").some((l) => l.href === "/industrie")).toBe(false);
  });
});

describe("navigation — téléphone", () => {
  it("étudiant : Informations, Calculs, Labo, Historique ; le reste dans Plus", () => {
    const { onglets, plus } = ongletsTelephone("etudiant");
    expect(onglets.map((l) => l.label)).toEqual(["Informations", "Calculs", "Labo", "Historique"]);
    expect(plus.map((l) => l.label)).toEqual(["Analyse", "Formules", "Guide", "Réglages"]);
  });

  it("enseignant : Calculs, Labo, Classe, Historique ; Informations passe dans Plus", () => {
    const { onglets, plus } = ongletsTelephone("prof");
    expect(onglets.map((l) => l.label)).toEqual(["Calculs", "Labo", "Classe", "Historique"]);
    expect(plus.map((l) => l.label)).toContain("Informations");
  });

  it("aucun lien perdu ni doublé entre onglets et Plus", () => {
    for (const role of ["etudiant", "prof"] as const) {
      const { onglets, plus } = ongletsTelephone(role);
      const tous = [...onglets, ...plus].map((l) => l.href).sort();
      expect(tous).toEqual(liensNavigation(role).map((l) => l.href).sort());
    }
  });
});

describe("navigation — page active", () => {
  it("« / » exact, les autres par section", () => {
    expect(estActif("/", "/")).toBe(true);
    expect(estActif("/mix", "/")).toBe(false);
    expect(estActif("/compte/nouveau-mot-de-passe", "/compte")).toBe(true);
    expect(estActif("/classement", "/classe")).toBe(false);
    expect(estActif(null, "/mix")).toBe(false);
  });

  it("initiales et prénom de la pastille du compte", () => {
    expect(initiales("Alice Tremblay")).toBe("AT");
    expect(initiales("Jean-Luc Picard de la Barre")).toBe("JB");
    expect(initiales("", "bruno@exemple.ca")).toBe("B");
    expect(initiales(null, null)).toBe("?");
    expect(prenom("Alice Tremblay", "Compte")).toBe("Alice");
    expect(prenom("  ", "Compte")).toBe("Compte");
  });
});
