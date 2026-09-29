// frontend/src/lib/classe-comparaison.ts
// Comparer les étudiants qui ont gâché la MÊME formulation. Module PUR.
//
// « Même formulation » (décision de l'enseignant, 2026-09) : même catégorie,
// et mêmes Cw % et Bw % arrondis au demi-point. Les paramètres viennent de
// l'instantané figé sur la gâchée, sinon de la formulation d'origine cherchée
// parmi les résultats de SON auteur (les ids ne valent que chez lui).
//
// Ce qui est refusé, et pourquoi (même règle que ucs-formulation.ts) :
//   - AUCUNE moyenne inter-gâchées : ce serait présenter comme « l'UCS de la
//     formulation » un mélange de lots, d'opérateurs et de protocoles. On
//     montre UNE LIGNE PAR GÂCHÉE ;
//   - la médiane du groupe n'est qu'un REPÈRE de dispersion entre opérateurs,
//     et seulement à partir de 3 gâchées : avec 2, elle serait leur moyenne
//     déguisée. Jamais tracée, jamais exportée (CSV, PDF).

import { agregerParAge } from "./eprouvette";
import { parametresEffectifs, type ParametresFormulation } from "./gachee";
import { gacheesRetenues, type EtudiantClasse } from "./classe";

/** Nombre de gâchées à partir duquel la médiane sert de repère. */
export const MIN_GACHEES_REPERE = 3;
/** Un groupe n'a d'intérêt que s'il réunit au moins deux étudiants. */
export const MIN_ETUDIANTS_GROUPE = 2;

export const arrondiDemiPoint = (x: number): number => Math.round(x * 2) / 2;

/** Clé « catégorie|Cw|Bw » (demi-points), ou null si Cw ou Bw est inconnu. */
export function cleFormulation(categorie: string, p: ParametresFormulation | undefined): string | null {
  const cw = p?.cwPct, bw = p?.bwPct;
  if (typeof cw !== "number" || typeof bw !== "number" || !Number.isFinite(cw) || !Number.isFinite(bw)) return null;
  return `${categorie}|${arrondiDemiPoint(cw)}|${arrondiDemiPoint(bw)}`;
}

export function mediane(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 === 1 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export interface LigneComparaison {
  etudiantId: string;
  etudiant: string;
  gacheeId: string;
  gacheeCode: string;
  creeLe: string;
  cwPct: number;
  bwPct: number;
  wcRatio?: number;
  ageJours: number;
  n: number;
  nExclus: number;
  moyenneKpa: number;
  ecartTypeKpa: number | null;
  cvPct: number | null;
  /** Écart à la médiane du groupe (%), null sans repère. */
  ecartMedianePct: number | null;
}

export interface RepereGroupe {
  medianeKpa: number;
  minKpa: number;
  maxKpa: number;
  nGachees: number;
}

export interface AgeGroupe {
  ageJours: number;
  lignes: LigneComparaison[];
  repere: RepereGroupe | null;
}

export interface GroupeComparaison {
  cle: string;
  categorie: string;
  cwArrondi: number;
  bwArrondi: number;
  nbEtudiants: number;
  nbGachees: number;
  parAge: AgeGroupe[];
}

export interface Comparaison {
  groupes: GroupeComparaison[];
  /** Gâchées impossibles à classer (Cw ou Bw inconnu). */
  sansParametres: { etudiantId: string; etudiant: string; gacheeId: string; code: string }[];
}

interface Membre {
  etudiantId: string;
  etudiant: string;
  gachee: EtudiantClasse["gachees"][number];
  p: ParametresFormulation;
}

export function comparerClasse(etudiants: EtudiantClasse[]): Comparaison {
  const parCle = new Map<string, Membre[]>();
  const sansParametres: Comparaison["sansParametres"] = [];
  for (const e of etudiants) {
    const formulations = e.resultats.map((r) => ({ id: r.id, recipes: r.recipes ?? [] }));
    for (const g of gacheesRetenues(e)) {
      const p = parametresEffectifs(g, formulations);
      const cle = cleFormulation(g.categorie, p);
      if (!cle || !p) {
        sansParametres.push({ etudiantId: e.id, etudiant: e.nom, gacheeId: g.id, code: g.code });
        continue;
      }
      const l = parCle.get(cle) ?? [];
      l.push({ etudiantId: e.id, etudiant: e.nom, gachee: g, p });
      parCle.set(cle, l);
    }
  }

  const groupes: GroupeComparaison[] = [];
  for (const [cle, membres] of parCle) {
    const nbEtudiants = new Set(membres.map((m) => m.etudiantId)).size;
    if (nbEtudiants < MIN_ETUDIANTS_GROUPE) continue;
    const parAgeMap = new Map<number, LigneComparaison[]>();
    for (const m of membres) {
      for (const a of agregerParAge(m.gachee.eprouvettes ?? [])) {
        if (a.moyenneKpa === null) continue;
        const l = parAgeMap.get(a.ageJours) ?? [];
        l.push({
          etudiantId: m.etudiantId, etudiant: m.etudiant, gacheeId: m.gachee.id, gacheeCode: m.gachee.code,
          creeLe: m.gachee.creeLe, cwPct: m.p.cwPct as number, bwPct: m.p.bwPct as number, wcRatio: m.p.wcRatio,
          ageJours: a.ageJours, n: a.n, nExclus: a.nExclus, moyenneKpa: a.moyenneKpa,
          ecartTypeKpa: a.ecartTypeKpa, cvPct: a.cvPct, ecartMedianePct: null,
        });
        parAgeMap.set(a.ageJours, l);
      }
    }
    const parAge: AgeGroupe[] = [...parAgeMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ageJours, lignes]) => {
        const valeurs = lignes.map((l) => l.moyenneKpa);
        const med = lignes.length >= MIN_GACHEES_REPERE ? mediane(valeurs) : null;
        const repere = med === null ? null
          : { medianeKpa: med, minKpa: Math.min(...valeurs), maxKpa: Math.max(...valeurs), nGachees: lignes.length };
        const avecEcart = lignes.map((l) => ({
          ...l, ecartMedianePct: med !== null && med !== 0 ? ((l.moyenneKpa - med) / med) * 100 : null,
        }));
        avecEcart.sort((a, b) => b.moyenneKpa - a.moyenneKpa || a.gacheeCode.localeCompare(b.gacheeCode));
        return { ageJours, lignes: avecEcart, repere };
      });
    const [categorie, cw, bw] = cle.split("|");
    groupes.push({
      cle, categorie, cwArrondi: Number(cw), bwArrondi: Number(bw),
      nbEtudiants, nbGachees: membres.length, parAge,
    });
  }
  groupes.sort((a, b) => b.nbEtudiants - a.nbEtudiants || b.nbGachees - a.nbGachees
    || a.categorie.localeCompare(b.categorie) || a.cwArrondi - b.cwArrondi || a.bwArrondi - b.bwArrondi);
  return { groupes, sansParametres };
}

/** Libellé d'un groupe : « RPC · Cw 75,5 % · Bw 5 % ». */
export function libelleGroupe(g: Pick<GroupeComparaison, "categorie" | "cwArrondi" | "bwArrondi">): string {
  const n = (x: number) => x.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
  return `${g.categorie} · Cw ${n(g.cwArrondi)} % · Bw ${n(g.bwArrondi)} %`;
}
