import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FormulaPopover from "./FormulaPopover";

beforeAll(() => {
  // La fiche se place dans la fenêtre : dimensions minimales pour le rendu serveur.
  (globalThis as unknown as { window: unknown }).window = { innerWidth: 1200, innerHeight: 900 };
});

describe("fiche de formule : dialogue accessible", () => {
  it("role=dialog nommé par la formule, focusable, bouton Fermer", () => {
    const html = renderToStaticMarkup(createElement(FormulaPopover, {
      formulaIds: ["F009"], ancre: { getBoundingClientRect: () => ({ top: 0, left: 10, bottom: 20 }), isConnected: true } as unknown as HTMLElement, onClose: () => {},
    }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="false"');
    expect(html).toMatch(/aria-label="Formule F009 : [^"]+"/);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-label="Fermer la fiche de formule"');
  });
});
