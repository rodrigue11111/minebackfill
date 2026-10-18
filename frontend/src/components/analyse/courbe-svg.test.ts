import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CourbeSvg from "./CourbeSvg";

describe("courbe d'Analyse : jamais « -0 »", () => {
  it("une série quasi nulle (bruit de calcul) ne fait écrire aucun « -0 » sur les axes ni dans les valeurs", () => {
    const html = renderToStaticMarkup(createElement(CourbeSvg, {
      x: [1, 2, 3], xLabel: "Bw", xSymbole: "Bw",
      series: [{ cle: "ecart", label: "Écart", couleur: "#000", unite: "kg", valeurs: [-1e-9, 0, 1e-9] }],
    }));
    expect(html).not.toMatch(/>-0(?:,0+)?</);
    expect(html).not.toMatch(/-0(?:,0+)?\s*kg/);
  });
});
