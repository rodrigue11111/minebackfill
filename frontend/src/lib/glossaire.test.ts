import { describe, expect, it } from "vitest";
import { ESSAIS_NORMALISES, GLOSSAIRE, NORMES_REF, T, glossaireParCategorie, libelle } from "./glossaire";

describe("glossaire — structure", () => {
  it("clés uniques, et chaque entrée cite sa source", () => {
    const cles = GLOSSAIRE.map((e) => e.cle);
    expect(new Set(cles).size).toBe(cles.length);
    for (const e of GLOSSAIRE) {
      expect(e.terme.length).toBeGreaterThan(0);
      expect(e.definition.length).toBeGreaterThan(10);
      expect(e.source.length).toBeGreaterThan(0);
    }
  });

  it("toutes les entrées sont rangées dans une catégorie affichée", () => {
    const affichees = glossaireParCategorie().flatMap((g) => g.entrees);
    expect(affichees.length).toBe(GLOSSAIRE.length);
  });

  it("pas d'emoji, et le français est accentué (aucun « Degre », « Methode »…)", () => {
    const texte = JSON.stringify({ GLOSSAIRE, ESSAIS_NORMALISES, T });
    expect(/\p{Extended_Pictographic}/u.test(texte)).toBe(false);
    for (const faute of ["Degre ", "Methode", "Categorie", "parametre", "Reglage"]) {
      expect(texte.includes(faute)).toBe(false);
    }
  });
});

describe("glossaire — normes des essais", () => {
  it("l'UCS renvoie à ASTM C39/C39M et l'affaissement à ASTM C143/C143M", () => {
    const ucs = ESSAIS_NORMALISES.find((e) => e.essai.includes("UCS"));
    expect(ucs?.normes.map((n) => n.code)).toContain("ASTM C39/C39M");
    const affaissement = ESSAIS_NORMALISES.find((e) => e.essai.startsWith("Affaissement"));
    expect(affaissement?.normes.map((n) => n.code)).toContain("ASTM C143/C143M");
  });

  it("chaque norme a un code et un titre", () => {
    for (const n of Object.values(NORMES_REF)) {
      expect(n.code).toMatch(/^(ASTM|CSA|ISO) /);
      expect(n.titre.length).toBeGreaterThan(5);
    }
  });

  it("la vitesse de chargement de l'UCS reste à valider par l'enseignant", () => {
    const ucs = ESSAIS_NORMALISES.find((e) => e.essai.includes("UCS"));
    expect(ucs?.usage).toContain("à valider par l'enseignant");
  });
});

describe("glossaire — libellés répétés", () => {
  it("nom complet suivi du symbole", () => {
    expect(libelle("el")).toBe("Rapport eau/liant E/L");
    expect(libelle("bw")).toBe("Taux massique de liant Bw");
    expect(libelle("cw")).toBe("Pourcentage solide massique Cw");
    expect(libelle("gs")).toBe("Densité relative des grains Gs");
  });
});
