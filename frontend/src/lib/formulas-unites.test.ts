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
// Même méthode, 20 octobre 2026, pour indice des vides, porosité, Cv et Sr
// (F005, F007, F012, F031, F032, F095, F096), contre les diapositives 33 et 34
// du cours : Cv = ρd/ρs = 1/(1+e) ; ρd = ρs/(1+e) = ρh·Cw ; e = w·Gs/Sr ;
// Sr = w·ρs·ρd / (ρw(ρs − ρd)). Le classeur (CACHED : e0, ef, nf, Cvf) sert
// de seconde référence.

import { describe, expect, it } from "vitest";
import { FORMULA_MAP } from "./formulas-data";

// ── Évaluateur d'une expression publiée (test seulement) ──

const SYMBOLES: [string, string][] = [
  ["\\rho_w", "rho_w"], ["\\rho_h", "rho_h"], ["\\rho_d", "rho_d"], ["\\rho_s", "rho_s"],
  ["\\gamma_h", "gamma_h"], ["\\gamma_d", "gamma_d"],
  ["G_s", "Gs"], ["C_w", "Cw"], ["S_r", "Sr"],
  ["M_d", "Md"], ["V_T", "VT"], ["V_v", "Vv"],
];
const IDENTIFIANTS = new Set([
  "rho_w", "rho_h", "rho_d", "rho_s", "gamma_h", "gamma_d", "Gs", "Cw", "Sr", "g",
  "Md", "VT", "Vv", "e", "w",
]);

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
  return {
    rho_h: 1 / VT, rho_d: Ms / VT, rho_s: Gs * rho_w,
    Ms, Vv, VT, w: Mw / Ms, e: Vv / Vs, n: Vv / VT, Cv: Vs / VT,
  };
}

// Classeur du professeur, Mélange 1 (excel_twin.py, CACHED et self_validate) :
// Gs de la pâte 3,0454…, Cw = 0,70 ; masses volumiques en t/m³ (× 1000 -> kg/m³).
const CLASSEUR = {
  Gs: 3.0454060859946805, Cw: 0.7,
  rho_h0: 1.887310915919127, rho_d0: 1.321117641143389, e0: 1.3051740368548632,
  rho_hf: 1.8872705854379703, gamma_hf: 18.51412444314649,
  rho_df: 1.3210575930709763, gamma_df: 12.959574988026278,
  ef: 1.3052788174929026, nf: 0.5662129923669943, Cvf: 0.43378700763300565,
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

describe("Indice des vides, porosité, Cv et Sr (Dia. 33 et 34)", () => {
  // Chaque formule : ses variables tirées des relations de phases, la valeur attendue,
  // et le nombre d'écritures publiées (membres du LaTeX puis du texte brut).
  const cas = (Sr: number): { id: string; v: Record<string, number>; attendu: number; n: number }[] => {
    const p = phases(3.05, 0.75, Sr);
    return [
      { id: "F005", v: { Vv: p.Vv, VT: p.VT, e: p.e }, attendu: p.n, n: 4 },
      { id: "F007", v: { Md: p.Ms, VT: p.VT, rho_s: p.rho_s, e: p.e }, attendu: p.rho_d, n: 4 },
      { id: "F012", v: { w: p.w, rho_d: p.rho_d, rho_h: p.rho_h }, attendu: 0.75, n: 4 },
      { id: "F031", v: { Gs: 3.05, Sr, Cw: 0.75 }, attendu: p.e, n: 2 },
      { id: "F032", v: { w: p.w, Gs: 3.05, e: p.e, rho_s: p.rho_s, rho_d: p.rho_d, rho_w: 1000 }, attendu: Sr, n: 4 },
      { id: "F095", v: { rho_d: p.rho_d, rho_s: p.rho_s, e: p.e }, attendu: p.Cv, n: 4 },
      { id: "F096", v: { w: p.w, rho_s: p.rho_s, rho_d: p.rho_d, rho_w: 1000 }, attendu: Sr, n: 2 },
    ];
  };

  it.each([1, 0.9])("Sr = %s : chaque écriture publiée redonne la valeur des relations de phases", (Sr) => {
    for (const c of cas(Sr)) {
      const ecr = ecritures(c.id);
      expect([c.id, ecr.length]).toEqual([c.id, c.n]);
      for (const e of ecr) expect([c.id, evaluer(e, c.v)]).toEqual([c.id, expect.closeTo(c.attendu, 8)]);
    }
  });

  it("les anciennes écritures s'en écartaient", () => {
    const p = phases(3.05, 0.75, 0.9);
    const ancienne = (texte: string, v: Record<string, number>) => evaluer(membresTexte(texte).at(-1)!, v);
    // F095 : 1 − ρd/ρs est la porosité, pas Cv.
    expect(ancienne("Cv = 1 - rho_d/rho_s", p)).toBeCloseTo(p.n, 10);
    expect(ancienne("Cv = 1 - rho_d/rho_s", p)).not.toBeCloseTo(p.Cv, 2);
    // F012 : ρd/ρs est Cv, pas Cw.
    expect(ancienne("Cw = 1/(1+w) = rho_d/rho_s", p)).toBeCloseTo(p.Cv, 10);
    // F007 : Md/Vs (Vs, volume des grains) est ρs, pas ρd.
    expect(evaluer("Md/Vs", { Md: p.Ms, Vs: p.VT - p.Vv })).toBeCloseTo(p.rho_s, 6);
    // F031 : le facteur ρw multipliait e par 1000.
    expect(ancienne("e = rho_w*Gs/Sr * (1-Cw)/Cw", { rho_w: 1000, Gs: 3.05, Sr: 0.9, Cw: 0.75 })).toBeCloseTo(1000 * p.e, 6);
    // F096 : sans ρs/ρw (= Gs), Sr était divisé par Gs.
    expect(ancienne("Sr = (w*rho_d)/(rho_s-rho_d)", p)).toBeCloseTo(0.9 / 3.05, 10);
  });

  it("classeur du professeur (Mélange 1) : e initial, ρd initial, n et Cv finaux", () => {
    const { Gs, Cw, e0, ef } = CLASSEUR;
    const w = (1 - Cw) / Cw;
    // État initial, saturé (Sr = 1), volume des grains pris égal à 1 m³.
    for (const e of ecritures("F031")) expect(evaluer(e, { Gs, Sr: 1, Cw })).toBeCloseTo(e0, 10);
    for (const e of ecritures("F007")) {
      expect(evaluer(e, { Md: Gs * 1000, VT: 1 + e0, rho_s: Gs * 1000, e: e0 })).toBeCloseTo(CLASSEUR.rho_d0 * 1000, 6);
    }
    for (const e of ecritures("F012")) {
      expect(evaluer(e, { w, rho_d: CLASSEUR.rho_d0 * 1000, rho_h: CLASSEUR.rho_h0 * 1000 })).toBeCloseTo(Cw, 10);
    }
    const sat = { w, Gs, e: e0, rho_s: Gs * 1000, rho_d: CLASSEUR.rho_d0 * 1000, rho_w: 1000 };
    for (const id of ["F032", "F096"]) for (const e of ecritures(id)) expect(evaluer(e, sat)).toBeCloseTo(1, 8);
    // État final : n et Cv du classeur à partir de son indice des vides.
    for (const e of ecritures("F005")) expect(evaluer(e, { Vv: ef, VT: 1 + ef, e: ef })).toBeCloseTo(CLASSEUR.nf, 10);
    for (const e of ecritures("F095")) {
      expect(evaluer(e, { rho_s: 3000, rho_d: 3000 / (1 + ef), e: ef })).toBeCloseTo(CLASSEUR.Cvf, 10);
    }
  });
});
