// frontend/src/lib/courbes.ts
// Courbes contrainte-déformation des essais de presse, hors de localStorage.
//
// Pourquoi : une courbe réduite (150 points) pèse ~19 Ko en JSON, dont 59 % de
// noms de clés répétés ; une gâchée de 15 éprouvettes, ~300 Ko. Le stockage
// local plafonne vers 5 Mo : une quinzaine de gâchées suffisait à le remplir.
// Les courbes vont donc dans IndexedDB (bien plus vaste), en COLONNES (une
// liste de nombres par grandeur, sans clés répétées). L'éprouvette ne garde
// qu'une référence légère : `essai.courbeInfo`.
//
// Module PUR : le magasin est une interface (MagasinCourbes). L'adaptateur
// IndexedDB vit dans courbes-idb.ts ; les tests utilisent un magasin en
// mémoire. Règle de sûreté : une courbe ne quitte l'éprouvette QU'APRÈS que le
// magasin a confirmé son écriture. Magasin absent ou en échec : rien ne bouge.

import type { Gachee } from "./gachee";
import type { PointCourbe } from "./presse-urstm";

/** Une courbe en colonnes : mêmes points, mêmes valeurs, sans clés répétées. */
export interface CourbeColonnes {
  v: 1;
  t: number[];
  f: number[];
  d: number[];
  s: number[];
  e: number[];
}

export function encoderCourbe(points: PointCourbe[]): CourbeColonnes {
  return {
    v: 1,
    t: points.map((p) => p.tempsS),
    f: points.map((p) => p.chargeN),
    d: points.map((p) => p.deplacementMm),
    s: points.map((p) => p.contrainteKpa),
    e: points.map((p) => p.deformationPct),
  };
}

export function decoderCourbe(c: CourbeColonnes): PointCourbe[] {
  const n = Math.min(c.t.length, c.f.length, c.d.length, c.s.length, c.e.length);
  const r: PointCourbe[] = [];
  for (let i = 0; i < n; i++) {
    r.push({ tempsS: c.t[i], chargeN: c.f[i], deplacementMm: c.d[i], contrainteKpa: c.s[i], deformationPct: c.e[i] });
  }
  return r;
}

export function estCourbeColonnes(x: unknown): x is CourbeColonnes {
  const c = x as CourbeColonnes;
  return !!c && c.v === 1 && [c.t, c.f, c.d, c.s, c.e].every(Array.isArray);
}

/** Stockage des courbes, par id d'éprouvette. */
export interface MagasinCourbes {
  lire(id: string): Promise<CourbeColonnes | null>;
  /** Écrit toutes les entrées d'un coup (une transaction) ; rejette en cas d'échec. */
  ecrire(entrees: [string, CourbeColonnes][]): Promise<void>;
  supprimer(ids: string[]): Promise<void>;
  /** Ids de toutes les courbes rangées (balayage des orphelines). */
  lister(): Promise<string[]>;
}

/**
 * Courbe lue en ligne (document « courbe ») : les colonnes, sans les champs de
 * rattachement (eprouvetteId, gacheeId). null si le contenu n'en est pas une.
 */
export function courbeDepuisContenu(x: unknown): CourbeColonnes | null {
  if (!estCourbeColonnes(x)) return null;
  return { v: 1, t: x.t, f: x.f, d: x.d, s: x.s, e: x.e };
}

/**
 * Courbes du magasin qu'aucune gâchée ne référence plus (gâchées du compte,
 * copies de conflit et travail d'autres comptes mis de côté compris).
 */
export function courbesOrphelines(idsMagasin: string[], gacheesReferencees: Gachee[]): string[] {
  const encore = new Set(gacheesReferencees.flatMap(idsCourbes));
  return idsMagasin.filter((id) => !encore.has(id));
}

/** Lignes CSV d'une courbe (en-tête compris) : t_s ; f_n ; d_mm ; s_kpa ; e_pct. */
export function lignesCsvCourbe(points: PointCourbe[]): (string | number)[][] {
  return [
    ["t_s", "f_n", "d_mm", "s_kpa", "e_pct"],
    ...points.map((p) => [p.tempsS, p.chargeN, p.deplacementMm, p.contrainteKpa, p.deformationPct]),
  ];
}

/** Ids des éprouvettes dont la courbe est rangée dans le magasin. */
export function idsCourbes(g: Gachee): string[] {
  return (g.eprouvettes ?? []).filter((e) => e.essai?.courbeInfo || e.essai?.courbe?.length).map((e) => e.id);
}

/**
 * Courbes à retirer du magasin quand des éprouvettes disparaissent : sauf
 * celles qu'une AUTRE gâchée référence encore (une copie de conflit garde les
 * ids d'éprouvette de l'original — retirer la copie ne doit pas effacer la
 * courbe de l'original).
 */
export function courbesAOublier(ids: string[], gacheesRestantes: Gachee[]): string[] {
  const encore = new Set(gacheesRestantes.flatMap(idsCourbes));
  return ids.filter((id) => !encore.has(id));
}

/** Courbes encore stockées DANS les gâchées (avant déplacement). */
export function courbesEnLigne(gachees: Gachee[]): [string, PointCourbe[]][] {
  const r: [string, PointCourbe[]][] = [];
  for (const g of gachees) for (const e of g.eprouvettes ?? []) {
    if (e.essai?.courbe && e.essai.courbe.length > 0) r.push([e.id, e.essai.courbe]);
  }
  return r;
}

/** Remplace les courbes déplacées par leur référence légère. */
export function remplacerParReferences(gachees: Gachee[], deplacees: ReadonlySet<string>): Gachee[] {
  return gachees.map((g) => {
    if (!(g.eprouvettes ?? []).some((e) => deplacees.has(e.id) && e.essai?.courbe)) return g;
    return {
      ...g,
      eprouvettes: g.eprouvettes.map((e) => {
        if (!deplacees.has(e.id) || !e.essai?.courbe) return e;
        const essai = { ...e.essai, courbeInfo: { nbPoints: e.essai.courbe.length } };
        delete essai.courbe;
        return { ...e, essai };
      }),
    };
  });
}

/**
 * Déplace dans le magasin les courbes encore stockées dans les gâchées.
 * Renvoie les gâchées allégées, ou null s'il n'y avait rien à déplacer.
 * Si l'écriture échoue, l'exception remonte et les gâchées restent intactes.
 */
export async function deplacerCourbes(
  gachees: Gachee[],
  magasin: MagasinCourbes,
): Promise<{ gachees: Gachee[]; deplacees: number } | null> {
  const aDeplacer = courbesEnLigne(gachees);
  if (aDeplacer.length === 0) return null;
  await magasin.ecrire(aDeplacer.map(([id, pts]) => [id, encoderCourbe(pts)]));
  const ids = new Set(aDeplacer.map(([id]) => id));
  return { gachees: remplacerParReferences(gachees, ids), deplacees: ids.size };
}

/** Nombre de points d'une courbe d'éprouvette, où qu'elle soit stockée. */
export function nbPointsCourbe(essai: { courbe?: unknown[]; courbeInfo?: { nbPoints: number } } | undefined): number {
  return essai?.courbeInfo?.nbPoints ?? essai?.courbe?.length ?? 0;
}

/** Magasin en mémoire (tests, et secours sans IndexedDB dans les tests). */
export function creerMagasinMemoire(): MagasinCourbes & { contenu: Map<string, CourbeColonnes> } {
  const contenu = new Map<string, CourbeColonnes>();
  return {
    contenu,
    async lire(id) { return contenu.get(id) ?? null; },
    async ecrire(entrees) { for (const [id, c] of entrees) contenu.set(id, JSON.parse(JSON.stringify(c))); },
    async supprimer(ids) { for (const id of ids) contenu.delete(id); },
    async lister() { return [...contenu.keys()]; },
  };
}

/**
 * Gâchées importées d'une sauvegarde : leurs références de courbe pointent
 * vers le fichier. Si le magasin a pu enregistrer une courbe, la référence
 * reste ; sinon la courbe est remise DANS la gâchée (rien ne se perd) ; et une
 * référence sans courbe dans le fichier est retirée (elle mentirait).
 */
export function resoudreCourbesImportees(
  gachees: Gachee[],
  courbesFichier: Record<string, CourbeColonnes>,
  enregistrees: ReadonlySet<string>,
): Gachee[] {
  return gachees.map((g) => {
    if (!(g.eprouvettes ?? []).some((e) => e.essai?.courbeInfo)) return g;
    return {
      ...g,
      eprouvettes: g.eprouvettes.map((e) => {
        if (!e.essai?.courbeInfo || enregistrees.has(e.id)) return e;
        const essai = { ...e.essai };
        delete essai.courbeInfo;
        const c = courbesFichier[e.id];
        if (c) essai.courbe = decoderCourbe(c);
        return { ...e, essai };
      }),
    };
  });
}
