import { describe, it, expect } from "vitest";
import { getSuggestions, normalise } from "./formula-search";
import { FORMULA_MAP } from "./formulas-data";

// formula-search.ts n'avait aucun test. Ceux-ci portent sur le défaut
// corrigé : une suggestion de variable livrait un seul libellé où le symbole
// LaTeX était noyé, ce qui forçait l'écran à afficher « \%P_{80\,\mu\text{m}} »
// tel quel — alors que les pastilles de variables et la ligne « Aperçu » le
// rendent toutes deux correctement.

describe("formula-search — suggestions de variables", () => {
  it("livre le symbole et la description séparément", () => {
    const s = getSuggestions("solide").find((x) => x.type === "variable");
    expect(s).toBeDefined();
    expect(s!.symbol).toBeTruthy();
    expect(s!.description).toBeTruthy();
    // Le libellé concaténé reste fourni : les autres consommateurs et le repli
    // de l'écran s'appuient dessus.
    expect(s!.label).toContain(s!.symbol!);
    expect(s!.label).toContain(s!.description!);
  });

  it("le symbole est le LaTeX brut, propre à être rendu par KaTeX", () => {
    const s = getSuggestions("solide").find((x) => x.type === "variable");
    // Le symbole est exactement celui d'une variable de la formule : l'écran
    // le rend tel quel, sans découper le libellé.
    expect(FORMULA_MAP.get(s!.formulaId!)?.variables.map((v) => v.symbol)).toContain(s!.symbol);
  });

  it("les suggestions non variables ne portent pas ces champs", () => {
    for (const s of getSuggestions("remblai")) {
      if (s.type !== "variable") {
        expect(s.symbol).toBeUndefined();
        expect(s.description).toBeUndefined();
      }
    }
  });

  it("ne suggère rien sous deux caractères", () => {
    expect(getSuggestions("a")).toEqual([]);
    expect(getSuggestions(" ")).toEqual([]);
  });
});

describe("formula-search — normalise", () => {
  it("dépouille le LaTeX, de sorte qu'une saisie humaine retrouve un symbole", () => {
    // C'est ce qui permet de chercher « mu » ou « 80 » sans taper la commande
    // LaTeX complète.
    const n = normalise("\\%P_{80\\,\\mu\\text{m}}");
    expect(n).not.toContain("\\");
    expect(n).not.toContain("{");
    expect(n).toContain("80");
  });

  it("est insensible à la casse et aux espaces superflus", () => {
    expect(normalise("  Cw   POURCENT ")).toBe(normalise("cw pourcent"));
  });

  it("le signe moins « − » du catalogue se retrouve avec le « - » tapé", () => {
    expect(normalise("n = 1 − Cv")).toBe(normalise("n = 1 - Cv"));
  });
});
