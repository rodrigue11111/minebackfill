import { describe, expect, it } from "vitest";
import { placerPopover, type PlacementPopover, type Vue } from "./placer-popover";

const VUE: Vue = { largeur: 1280, hauteur: 800 };
const ancre = (top: number, left = 600, h = 24) => ({ top, bottom: top + h, left });

/** La fiche tient entière dans l'écran, marges comprises. */
function tient(p: PlacementPopover, vue: Vue): boolean {
  const haut = p.top ?? vue.hauteur - (p.bottom as number) - p.maxHeight;
  const bas = haut + p.maxHeight;
  return haut >= 8 - 1e-9 && bas <= vue.hauteur - 8 + 1e-9 && p.left >= 8 && p.left + p.width <= vue.largeur - 8;
}

describe("fiche de formule : toujours entière à l'écran (2026-10-26)", () => {
  it("valeur en haut de l'écran : sous la valeur, avec toute la place restante", () => {
    const p = placerPopover(ancre(100), VUE);
    expect(p.cote).toBe("dessous");
    expect(p.top).toBe(130);
    expect(p.maxHeight).toBe(800 - 8 - 130);
    expect(tient(p, VUE)).toBe(true);
  });

  it("valeur en bas de l'écran : au-dessus, accrochée par le bas", () => {
    const p = placerPopover(ancre(720), VUE);
    expect(p.cote).toBe("dessus");
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(800 - 720 + 6);
    expect(p.maxHeight).toBe(720 - 6 - 8);
    expect(tient(p, VUE)).toBe(true);
  });

  it("petit écran (téléphone couché) : hauteur bornée, du côté le plus grand", () => {
    const vue = { largeur: 640, hauteur: 360 };
    for (const top of [10, 100, 170, 250, 330]) {
      const p = placerPopover(ancre(top, 500), vue);
      expect(tient(p, vue)).toBe(true);
      expect(p.maxHeight).toBeGreaterThanOrEqual(120);
    }
  });

  it("valeur sortie de l'écran (défilement) : la fiche reste visible", () => {
    for (const top of [-400, -30, 900, 2000]) {
      const p = placerPopover(ancre(top), VUE);
      expect(tient(p, VUE)).toBe(true);
      expect(p.maxHeight).toBeGreaterThanOrEqual(120);
    }
  });

  it("valeur près du bord droit, écran étroit : la fiche ne déborde pas", () => {
    const vue = { largeur: 360, hauteur: 740 };
    const p = placerPopover(ancre(200, 340), vue);
    expect(p.width).toBe(360 - 24);
    expect(tient(p, vue)).toBe(true);
  });
});
