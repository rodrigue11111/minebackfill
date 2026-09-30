import { describe, expect, it } from "vitest";
import { CATEGORY_INFO, descriptorFor, methodeApresChangementCategorie, methodLabel, methodsFor } from "./method-registry";

describe("method-registry — changement de catégorie", () => {
  it("garde la méthode quand la nouvelle catégorie la propose", () => {
    expect(methodeApresChangementCategorie("RPG", "wb")).toBe("wb");
    expect(methodeApresChangementCategorie("RPC", "essai")).toBe("essai");
  });

  it("le modèle prédictif n'existe pas en RPG : retour au dosage selon Cw", () => {
    expect(methodeApresChangementCategorie("RPG", "slump")).toBe("dosage_cw");
  });

  it("RRC garde la méthode (aller-retour RPC -> RRC -> RPC sans perte)", () => {
    expect(methodeApresChangementCategorie("RRC", "slump")).toBe("slump");
    expect(methodeApresChangementCategorie("RPC", "slump")).toBe("slump");
  });
});

describe("method-registry — libellés", () => {
  it("noms des méthodes du programme du professeur", () => {
    expect(methodLabel("RPC", "slump", "long")).toBe("Modèle prédictif (affaissement)");
    expect(methodLabel("RPC", "wb", "long")).toBe("Dosage selon E/L");
    expect(methodLabel("RRC", "rrc", "long")).toBe("Dosage selon Bw et E/L du coulis");
  });

  it("fragment de nom de fichier : ASCII sans espace", () => {
    for (const cat of CATEGORY_INFO) {
      for (const d of cat.id === "RRC" ? [descriptorFor("RRC", "rrc")!] : methodsFor(cat.id)) {
        expect(d.labels.fichier).toMatch(/^[A-Za-z0-9-]+$/);
      }
    }
  });

  it("valeur inconnue (vieille sauvegarde) : la chaîne brute", () => {
    expect(methodLabel("RPC", "inconnue")).toBe("inconnue");
  });
});
