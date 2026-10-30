// frontend/src/lib/mesures-pate.ts
// Mesures du jour d'une gâchée (Labo) comparées aux valeurs VISÉES par le
// calcul. Transformations PURES, testables sans DOM.
//
// Pourquoi (2026-10-26) : le Labo demandait w₀, w et Cw mesurés sans dire à
// quoi les comparer, et w et Cw sont la même mesure sous deux formes (F012 :
// Cw = 1 / (1 + w)) : deux saisies indépendantes pouvaient se contredire. On
// garde la saisie de w₀ et de Cw, chacune avec sa valeur visée et l'écart ;
// w de la pâte est déduit de Cw. Les gâchées plus anciennes gardent leur w
// saisi, affiché quand Cw manque.

import type { EtuvePate, Gachee } from "./gachee";
import { nombreFr } from "./format";
import { calculeMesures } from "./mesures";

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Teneur en eau massique w (%) de la pâte déduite de Cw (%), formule F012
 * (Cw = 1 / (1 + w)) : w = (100 − Cw) / Cw × 100. Indéfinie hors de (0, 100].
 */
export function wDepuisCwPct(cwPct: number | undefined): number | undefined {
  return fini(cwPct) && cwPct > 0 && cwPct <= 100 ? ((100 - cwPct) / cwPct) * 100 : undefined;
}

/** w de la pâte d'une gâchée : déduit de Cw mesuré, sinon la saisie d'avant le 2026-10-26. */
export function wPateMesuree(g: Pick<Gachee, "cwMesurePct" | "wMesurePct">): { valeur: number; source: "deduit" | "saisi" } | undefined {
  const deduit = wDepuisCwPct(g.cwMesurePct);
  if (deduit !== undefined) return { valeur: deduit, source: "deduit" };
  return fini(g.wMesurePct) ? { valeur: g.wMesurePct, source: "saisi" } : undefined;
}

/**
 * Teneur en eau de la pâte à l'étuve (2026-10-30) : w et Cw (%) des masses,
 * mêmes formules que la feuille Intra 2017 (calculeMesures, mesures.ts) ;
 * null tant qu'une masse manque ou si m_h > m_s > tare n'est pas vrai.
 */
export function mesuresEtuve(e: EtuvePate | undefined): { w: number | null; cw: number | null } {
  return calculeMesures({ tare: e?.tareG, mh: e?.mhG, ms: e?.msG });
}

/** Les trois masses sont saisies mais incohérentes (on attend m_h > m_s > tare). */
export function etuveIncoherente(e: EtuvePate | undefined): boolean {
  return fini(e?.tareG) && fini(e?.mhG) && fini(e?.msG) && mesuresEtuve(e).cw === null;
}

/**
 * Patch d'une gâchée quand une masse de l'étuve change. Masses complètes et
 * cohérentes : Cw mesuré prend leur valeur. Si elles cessent de l'être, le Cw
 * qu'elles avaient fixé s'efface (il ne décrirait plus rien) ; un Cw saisi
 * directement, lui, reste.
 */
export function majEtuve(g: Pick<Gachee, "etuvePate" | "cwMesurePct">, patch: Partial<EtuvePate>): Pick<Gachee, "etuvePate" | "cwMesurePct"> {
  const etuvePate = { ...g.etuvePate, ...patch };
  const avant = mesuresEtuve(g.etuvePate).cw;
  const apres = mesuresEtuve(etuvePate).cw;
  if (apres !== null) return { etuvePate, cwMesurePct: apres };
  if (avant !== null && g.cwMesurePct === avant) return { etuvePate, cwMesurePct: undefined };
  return { etuvePate, cwMesurePct: g.cwMesurePct };
}

/** Écart mesuré − visé, en points de % ; undefined si l'un des deux manque. */
export function ecartPoints(mesure: number | undefined, vise: number | undefined): number | undefined {
  return fini(mesure) && fini(vise) ? mesure - vise : undefined;
}

/** « +1,2 point », « −3,6 points » (signe moins typographique), « 0 point ». */
export function texteEcart(ecart: number): string {
  const a = Math.abs(ecart);
  const arrondi = Number(nombreFr(a, 1).replace(",", "."));
  const signe = arrondi === 0 ? "" : ecart > 0 ? "+" : "−";
  return `${signe}${nombreFr(a, 1)} point${arrondi >= 2 ? "s" : ""}`;
}

/**
 * Valeur visée et écart, sous le libellé d'une mesure : « Visé : 31,6 % ·
 * écart −3,6 points. » Vide si rien n'est visé.
 */
export function texteVise(vise: number | undefined, mesure: number | undefined): string {
  if (!fini(vise)) return "";
  const e = ecartPoints(mesure, vise);
  return `Visé : ${nombreFr(vise, 1)} %` + (e === undefined ? "" : ` · écart ${texteEcart(e)}`) + ".";
}

/**
 * Conséquence d'un w₀ du jour différent de celui du calcul, à eau ajoutée
 * égale : un résidu plus sec apporte moins d'eau, la pâte sort plus sèche (Cw
 * plus élevé) ; plus humide, elle sort plus fluide. Vide sous 0,05 point.
 */
export function effetEcartW0(ecart: number | undefined): string {
  if (ecart === undefined || Math.abs(ecart) < 0.05) return "";
  return ecart < 0
    ? "Plus sec que dans le calcul : à eau ajoutée égale, pâte plus sèche (Cw plus élevé)."
    : "Plus humide que dans le calcul : à eau ajoutée égale, pâte plus fluide (Cw plus bas).";
}
