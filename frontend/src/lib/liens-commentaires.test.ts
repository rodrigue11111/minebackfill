import { describe, expect, it } from "vitest";
import { lienDocument, vueDepuisAncre, vuePourNonLues } from "./liens-commentaires";
import type { Annotation } from "./annotations";

const note = (p: Partial<Annotation>): Annotation => ({
  id: "n", cibleKind: "gachee", cibleId: "g1", cibleRev: null, ancre: null, texte: "t", supprime: false,
  maj: "2026-10-26T12:00:00Z", auteur: "enseignant", creeLe: "2026-10-26T12:00:00Z", luLe: null, ...p,
});

describe("liens directs vers le document commenté (2026-10-26)", () => {
  it("gâchée au Labo, résultat dans Mes calculs ; l'identifiant est encodé", () => {
    expect(lienDocument("gachee", "g1")).toBe("/labo?gachee=g1");
    expect(lienDocument("resultat", "sr 2/b")).toBe("/historique?resultat=sr%202%2Fb");
  });

  it("onglet selon l'ancre : pesée, éprouvette connue, sinon Échanges", () => {
    expect(vueDepuisAncre("Pesée : Résidu humide", ["E01"])).toBe("pesees");
    expect(vueDepuisAncre("E01", ["E01"])).toBe("eprouvettes");
    expect(vueDepuisAncre("E09", ["E01"])).toBe("echanges"); // éprouvette retirée : fil général
    expect(vueDepuisAncre(null, ["E01"])).toBe("echanges");
  });

  it("première note NON LUE de l'enseignant ; lues, retirées et réponses ignorées", () => {
    const liste = [
      note({ id: "a", ancre: "E01", luLe: "2026-10-26T13:00:00Z" }),
      note({ id: "b", ancre: "Pesée : Liant", supprime: true }),
      note({ id: "c", ancre: null, auteur: "moi" }),
      note({ id: "d", ancre: "E01" }),
    ];
    expect(vuePourNonLues(liste, ["E01"])).toBe("eprouvettes");
    expect(vuePourNonLues(liste.slice(0, 3), ["E01"])).toBeUndefined();
  });
});
