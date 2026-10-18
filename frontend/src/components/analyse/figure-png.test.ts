import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FigurePng from "./FigurePng";

describe("figure d'Analyse : export PNG", () => {
  it("à jour : bouton actif ; périmée : figure estompée, bouton désactivé avec le motif", () => {
    const svg = createElement("svg", null);
    const ajour = renderToStaticMarkup(createElement(FigurePng, { nom: "f" }, svg));
    expect(ajour).toContain('class="ui-figure"');
    expect(ajour).not.toContain("disabled");
    const perimee = renderToStaticMarkup(createElement(FigurePng, { nom: "f", desactive: true, motif: "Entrées modifiées" }, svg));
    expect(perimee).toContain("ui-figure-perime");
    expect(perimee).toContain('disabled=""');
    expect(perimee).toContain('title="Entrées modifiées"');
  });
});
