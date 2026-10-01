import { describe, expect, it } from "vitest";
import { WINANSI_EXTRA, assainirTextePdf, nombrePdf, pourPdf } from "./texte-pdf";
import { pourPdf as pourPdfHistorique } from "./rapport-classe";
import { TIRET } from "./format";

// WinAnsi = Latin-1 plus quelques signes : tout caractère au-delà rendrait la
// chaîne illisible dans le PDF.
const WINANSI = new Set([...WINANSI_EXTRA]);
const toutWinAnsi = (s: string) => [...s].every((c) => c.codePointAt(0)! <= 0xff || WINANSI.has(c));

describe("pourPdf — symboles du cours", () => {
  it("écrit les lettres grecques en toutes lettres, indice séparé par « _ »", () => {
    expect(pourPdf("Masse volumique humide ρh")).toBe("Masse volumique humide rho_h");
    expect(pourPdf("Poids volumique sec γd")).toBe("Poids volumique sec gamma_d");
    expect(pourPdf("Teneur en eau volumique θ")).toBe("Teneur en eau volumique theta");
    expect(pourPdf("Facteur de perte κ")).toBe("Facteur de perte kappa");
    expect(pourPdf("Gs = ρs/ρw")).toBe("Gs = rho_s/rho_w");
  });

  it("garde σ → s (écart-type) et µ en signe micro", () => {
    expect(pourPdf("σ = 3")).toBe("s = 3");
    expect(pourPdf("20 μm")).toBe("20 µm");
  });

  it("corrige le signe moins et les indices de la feuille labo", () => {
    expect(pourPdf("w mesuré = (m_h − m_s) / (m_s − tare)")).toBe("w mesuré = (m_h - m_s) / (m_s - tare)");
    expect(pourPdf("w₀")).toBe("w0");
  });

  it("la valeur absente TIRET passe telle quelle dans un PDF", () => {
    expect(pourPdf(TIRET)).toBe(TIRET);
    expect(nombrePdf(null)).toBe(TIRET);
  });

  it("le résultat est toujours dans la table WinAnsi", () => {
    expect(toutWinAnsi(pourPdf("ρh γh θ κ Δ Ω ≥ − → 漢 😀 « é » œ"))).toBe(true);
  });

  it("rapport-classe réexporte la même fonction", () => {
    expect(pourPdfHistorique).toBe(pourPdf);
    expect(nombrePdf(1234.5, 1)).toBe("1 234,5");
  });
});

describe("assainirTextePdf", () => {
  it("fait passer chaque doc.text par pourPdf (chaîne et tableau)", () => {
    const traces: unknown[] = [];
    const doc = { text: (t: string | string[], x: number, y: number) => { traces.push([t, x, y]); return doc; } };
    assainirTextePdf(doc);
    doc.text("ρh = 1,9", 10, 20);
    doc.text(["γd", "θ"], 1, 2);
    expect(traces).toEqual([["rho_h = 1,9", 10, 20], [["gamma_d", "theta"], 1, 2]]);
  });
});
