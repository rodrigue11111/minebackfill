// Masses et poids volumiques du catalogue (F023, F024, F027, F094) : les
// expressions PUBLIÉES (LaTeX affiché et texte de « Copier texte brut ») sont
// évaluées telles quelles, puis comparées à deux références indépendantes :
//  - les relations de phases (masse totale 1 kg : Ms = Cw, Mw = 1 − Cw,
//    Vs = Ms/(Gs·ρw), Vv = Vw/Sr, ρh = 1/VT, ρd = Ms/VT) ;
//  - les valeurs du classeur du professeur, « Mélange 1 », mises en cache dans
//    backend/app/tests/excel_twin.py (CACHED : rho_h0, rho_d0, rho_hf,
//    gamma_hf, rho_df, gamma_df ; ρw = 1 t/m³, d'où le × 1000 vers kg/m³).
// Avant 2026-10, F023 et la première forme de F024 portaient un facteur Cw de
// trop (elles donnaient ρd sous le nom ρh), et F027 et F094 écrivaient
// γ = 9,81 · ρ [kN/m³] avec ρ en kg/m³ (des N/m³, mille fois trop).

import { describe, expect, it } from "vitest";
import { FORMULA_MAP } from "./formulas-data";

// ── Évaluateur d'une expression publiée (test seulement) ──

const SYMBOLES: [string, string][] = [
  ["\\rho_w", "rho_w"], ["\\rho_h", "rho_h"], ["\\rho_d", "rho_d"],
  ["\\gamma_h", "gamma_h"], ["\\gamma_d", "gamma_d"],
  ["G_s", "Gs"], ["C_w", "Cw"], ["S_r", "Sr"],
];
const IDENTIFIANTS = new Set(["rho_w", "rho_h", "rho_d", "gamma_h", "gamma_d", "Gs", "Cw", "Sr", "g"]);

/** Contenu du groupe {…} qui commence à `debut`, accolades appariées. */
function groupe(s: string, debut: number): { contenu: string; fin: number } {
  if (s[debut] !== "{") throw new Error(`accolade attendue en ${debut} : ${s}`);
  let profondeur = 0;
  for (let j = debut; j < s.length; j++) {
    if (s[j] === "{") profondeur++;
    else if (s[j] === "}" && --profondeur === 0) return { contenu: s.slice(debut + 1, j), fin: j };
  }
  throw new Error(`accolade non fermée : ${s}`);
}

/** \frac{A}{B} -> ((A)/(B)), de l'intérieur vers l'extérieur. */
function sansFrac(s: string): string {
  let i: number;
  while ((i = s.lastIndexOf("\\frac{")) >= 0) {
    const a = groupe(s, i + 5);
    const b = groupe(s, a.fin + 1);
    s = `${s.slice(0, i)}((${a.contenu})/(${b.contenu}))${s.slice(b.fin + 1)}`;
  }
  return s;
}

/** Une expression écrite avec les seuls identifiants connus, chiffres et opérateurs. */
function verifiee(expr: string): string {
  if (!/^[0-9.+\-*/()A-Za-z_]+$/.test(expr)) throw new Error(`reste non traduit : ${expr}`);
  for (const id of expr.match(/[A-Za-z_]+/g) ?? []) {
    if (!IDENTIFIANTS.has(id)) throw new Error(`identifiant inconnu « ${id} » dans ${expr}`);
  }
  return expr;
}

/** Membres de droite d'une équation LaTeX publiée, en JavaScript. */
function membresLatex(latex: string): string[] {
  const sansUnite = latex.replace(/\\quad.*$/, "");
  return sansUnite.split("=").slice(1).map((membre) => {
    let s = sansFrac(membre);
    for (const [l, j] of SYMBOLES) s = s.split(l).join(j);
    return verifiee(s.replace(/\\cdot/g, "*").replace(/\\,/g, "").replace(/\s+/g, ""));
  });
}

/** Membres de droite du texte brut publié (annotation entre crochets retirée). */
function membresTexte(texte: string): string[] {
  return texte.replace(/\[.*\]/, "").split("=").slice(1).map((m) => verifiee(m.replace(/\s+/g, "")));
}

function evaluer(expr: string, v: Record<string, number>): number {
  const noms = Object.keys(v);
  return new Function(...noms, `return ${expr};`)(...noms.map((n) => v[n])) as number;
}

/** Toutes les écritures publiées d'une formule (chaque membre du LaTeX, puis du texte brut). */
function ecritures(id: string): string[] {
  const f = FORMULA_MAP.get(id);
  if (!f) throw new Error(`formule ${id} absente du catalogue`);
  return [...membresLatex(f.equationLatex), ...membresTexte(f.equationPlainText)];
}

// ── Références indépendantes ──

function phases(Gs: number, Cw: number, Sr: number, rho_w = 1000) {
  const Ms = Cw;
  const Mw = 1 - Cw;
  const Vs = Ms / (Gs * rho_w);
  const Vv = Mw / rho_w / Sr;
  const VT = Vs + Vv;
  return { rho_h: 1 / VT, rho_d: Ms / VT };
}

// Classeur du professeur, Mélange 1 (excel_twin.py, CACHED et self_validate) :
// Gs de la pâte 3,0454…, Cw = 0,70 ; masses volumiques en t/m³ (× 1000 -> kg/m³).
const CLASSEUR = {
  Gs: 3.0454060859946805, Cw: 0.7,
  rho_h0: 1.887310915919127, rho_d0: 1.321117641143389,
  rho_hf: 1.8872705854379703, gamma_hf: 18.51412444314649,
  rho_df: 1.3210575930709763, gamma_df: 12.959574988026278,
};

const G = 9.81;

describe("F023 : masse volumique humide, tout Sr", () => {
  it.each([1, 0.9])("Sr = %s : chaque écriture publiée donne ρh des relations de phases", (Sr) => {
    const ref = phases(3.05, 0.75, Sr);
    const ecr = ecritures("F023");
    expect(ecr.length).toBeGreaterThanOrEqual(2);
    for (const e of ecr) expect(evaluer(e, { rho_w: 1000, Gs: 3.05, Cw: 0.75, Sr })).toBeCloseTo(ref.rho_h, 8);
  });

  it("l'ancienne écriture (facteur Cw au numérateur) donnait ρd, pas ρh", () => {
    const ancienne = membresLatex("\\rho_h = \\frac{\\rho_w \\, G_s \\, C_w \\, S_r}{S_r \\, C_w + G_s(1 - C_w)}".replace(/ \\, /g, " \\cdot ").replace("G_s(", "G_s \\cdot ("))[0];
    const ref = phases(3.05, 0.75, 1);
    const v = evaluer(ancienne, { rho_w: 1000, Gs: 3.05, Cw: 0.75, Sr: 1 });
    expect(v).toBeCloseTo(ref.rho_d, 8);
    expect(Math.abs(v - ref.rho_h)).toBeGreaterThan(400);
  });
});

describe("F024 : masse volumique humide, Sr = 1", () => {
  it("les deux écritures du LaTeX et le texte brut coïncident avec les phases", () => {
    const ref = phases(3.05, 0.75, 1);
    const ecr = ecritures("F024");
    expect(ecr).toHaveLength(3);
    for (const e of ecr) expect(evaluer(e, { rho_w: 1000, Gs: 3.05, Cw: 0.75 })).toBeCloseTo(ref.rho_h, 8);
  });

  it("classeur du professeur (Mélange 1) : ρh initial, et ρd = Cw · ρh", () => {
    for (const e of ecritures("F024")) {
      const rho_h = evaluer(e, { rho_w: 1000, Gs: CLASSEUR.Gs, Cw: CLASSEUR.Cw });
      expect(rho_h).toBeCloseTo(CLASSEUR.rho_h0 * 1000, 6);
      expect(CLASSEUR.Cw * rho_h).toBeCloseTo(CLASSEUR.rho_d0 * 1000, 6);
    }
  });
});

describe("F027 et F094 : poids volumiques en kN/m³, ρ en kg/m³", () => {
  it("F027 : γh du classeur à partir de ρh du classeur", () => {
    for (const e of ecritures("F027")) {
      expect(evaluer(e, { g: G, rho_h: CLASSEUR.rho_hf * 1000 })).toBeCloseTo(CLASSEUR.gamma_hf, 8);
    }
    // L'ancienne écriture, 9,81 · ρh avec ρh en kg/m³, était mille fois trop grande.
    expect(G * CLASSEUR.rho_hf * 1000).toBeCloseTo(CLASSEUR.gamma_hf * 1000, 4);
  });

  it("F094 : γd du classeur à partir de ρd du classeur", () => {
    for (const e of ecritures("F094")) {
      expect(evaluer(e, { g: G, rho_d: CLASSEUR.rho_df * 1000 })).toBeCloseTo(CLASSEUR.gamma_df, 8);
    }
  });

  it("unités déclarées : ρ en kg/m³, γ en kN/m³", () => {
    const unite = (id: string, symbole: string) => FORMULA_MAP.get(id)!.variables.find((v) => v.symbol === symbole)?.unit;
    expect(unite("F027", "\\rho_h")).toBe("kg/m³");
    expect(unite("F027", "\\gamma_h")).toBe("kN/m³");
    expect(unite("F094", "\\rho_d")).toBe("kg/m³");
    expect(unite("F094", "\\gamma_d")).toBe("kN/m³");
  });
});
