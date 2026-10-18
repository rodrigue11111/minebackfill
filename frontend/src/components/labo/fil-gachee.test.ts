import { describe, expect, it } from "vitest";
import { libelleSauvegarde } from "./FilGachee";

describe("état de la sauvegarde d'une gâchée, en clair", () => {
  it("compte ou cet ordinateur seulement", () => {
    expect(libelleSauvegarde(false, { liaison: null, statut: "inactif" })).toMatch(/^Sur cet ordinateur seulement/);
    expect(libelleSauvegarde(true, { liaison: "synchroniser", statut: "a_jour" })).toBe("Sauvegardée dans votre compte.");
    expect(libelleSauvegarde(true, { liaison: "synchroniser", statut: "en_attente" })).toBe("Envoi vers votre compte en cours.");
    expect(libelleSauvegarde(true, { liaison: "synchroniser", statut: "hors_ligne" })).toMatch(/au retour du réseau/);
    expect(libelleSauvegarde(true, { liaison: "synchroniser", statut: "erreur" })).toMatch(/interrompue/);
    expect(libelleSauvegarde(true, { liaison: "rattacher", statut: "inactif" } as never)).toMatch(/^Sur cet ordinateur seulement/);
  });
});
