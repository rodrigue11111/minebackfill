import { describe, expect, it } from "vitest";
import { regrouperParCalcul } from "./classe-detail";
import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";

const calcul = (id: string, savedAt: string) => ({ id, label: `Calcul ${id}`, savedAt, category: "RPC", method: "dosage_cw", recipes: [] }) as unknown as SavedResult;
const gachee = (id: string, creeLe: string, formulationId?: string) =>
  ({ id, code: `G-${id}`, creeLe, formulationId, eprouvettes: [], composants: [] }) as unknown as Gachee;

describe("fiche de l'étudiant rangée par calcul (2026-10-26)", () => {
  const resultats = [calcul("r1", "2026-10-01T10:00:00Z"), calcul("r2", "2026-10-05T10:00:00Z"), calcul("r3", "2026-10-20T10:00:00Z")];
  const gachees = [
    gachee("a", "2026-10-02T10:00:00Z", "r1"),
    gachee("b", "2026-10-22T10:00:00Z", "r1"),
    gachee("c", "2026-10-06T10:00:00Z", "r2"),
    gachee("d", "2026-10-07T10:00:00Z", "autre-session"),
    gachee("e", "2026-10-08T10:00:00Z"),
  ];
  const f = regrouperParCalcul({ resultats, gachees });

  it("chaque gâchée sous son calcul, la plus récente d'abord", () => {
    expect(f.blocs.map((b) => [b.resultat.id, b.gachees.map((g) => g.id)])).toEqual([["r1", ["b", "a"]], ["r2", ["c"]]]);
  });

  it("calculs actifs en tête : r1 (gâchée du 22) avant r2", () => {
    expect(f.blocs[0].resultat.id).toBe("r1");
  });

  it("calcul sans gâchée et gâchées sans calcul retrouvé, à part", () => {
    expect(f.calculsSansGachee.map((r) => r.id)).toEqual(["r3"]);
    expect(f.gacheesSansCalcul.map((g) => g.id)).toEqual(["e", "d"]);
  });

  it("rien n'est perdu ni compté deux fois", () => {
    const toutes = [...f.blocs.flatMap((b) => b.gachees), ...f.gacheesSansCalcul].map((g) => g.id).sort();
    expect(toutes).toEqual(["a", "b", "c", "d", "e"]);
    expect(f.blocs.length + f.calculsSansGachee.length).toBe(resultats.length);
  });

  it("étudiant sans rien : trois listes vides", () => {
    expect(regrouperParCalcul({ resultats: [], gachees: [] })).toEqual({ blocs: [], calculsSansGachee: [], gacheesSansCalcul: [] });
  });
});
