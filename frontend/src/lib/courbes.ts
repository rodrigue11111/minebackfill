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
import type { Eprouvette, EssaiUCS } from "./eprouvette";
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

/** Stockage des courbes, par clé de courbe (voir cleCourbe). */
export interface MagasinCourbes {
  lire(cle: string): Promise<CourbeColonnes | null>;
  /** Écrit toutes les entrées d'un coup (une transaction) ; rejette en cas d'échec. */
  ecrire(entrees: [string, CourbeColonnes][]): Promise<void>;
  supprimer(cles: string[]): Promise<void>;
  /** Clés de toutes les courbes rangées (balayage des orphelines). */
  lister(): Promise<string[]>;
}

/* ── Identité d'une courbe : l'import dont elle vient ─────────────────────
 * Une courbe est identifiée par l'IMPORT de presse qui l'a produite :
 * `sourcePresse.importeLe` de l'éprouvette, qui voyage avec la gâchée et vaut
 * donc la même chose sur tous les appareils (une identité, jamais un ordre
 * entre dates). La clé locale (IndexedDB) et l'identifiant du document en
 * ligne sont `<idEprouvette>:<importeLe>` : deux imports n'ont jamais la même
 * clé, donc aucune écriture ne peut remplacer la courbe d'un autre import.
 *
 * Une courbe sans `courbeInfo.importeLe` (rangée avant le 2026-10-18, ou
 * encore DANS la gâchée) est d'origine INCONNUE : l'ancienne réattache des
 * courbes a pu la poser sur une éprouvette réimportée ailleurs. Elle reste
 * lisible ici, sous l'ancienne clé `<idEprouvette>`, mais n'est jamais
 * envoyée ; seul un nouvel import établit son identité. */

type EssaiCourbe = { courbe?: unknown[]; courbeInfo?: { nbPoints: number; importeLe?: string }; sourcePresse?: { importeLe?: string } };
type EprouvetteCourbe = { id: string; essai?: EssaiCourbe };

/** Identifiant d'une courbe d'import connu : `<idEprouvette>:<importeLe>`. */
export const cleImport = (eprouvetteId: string, importeLe: string): string => `${eprouvetteId}:${importeLe}`;

/**
 * Clé de la courbe d'une éprouvette, dans le magasin local comme en ligne :
 * par import quand il est connu, sinon l'ancienne clé (id de l'éprouvette).
 */
export function cleCourbe(e: EprouvetteCourbe): string {
  const i = e.essai?.courbeInfo?.importeLe;
  return i ? cleImport(e.id, i) : e.id;
}

/** L'éprouvette garde une courbe sur cet appareil (rangée, ou dans la gâchée). */
export function aCourbeLocale(essai: EssaiCourbe | undefined): boolean {
  return !!essai?.courbeInfo || !!essai?.courbe?.length;
}

/** La courbe rangée ici vient de l'import que la gâchée désigne aujourd'hui. */
export function origineVerifiee(essai: EssaiCourbe | undefined): boolean {
  const i = essai?.courbeInfo?.importeLe;
  return !!i && i === essai?.sourcePresse?.importeLe;
}

/** Courbe locale d'origine non vérifiée : lisible, jamais envoyée. */
export function origineNonVerifiee(essai: EssaiCourbe | undefined): boolean {
  return aCourbeLocale(essai) && !origineVerifiee(essai);
}

/** Une courbe à afficher, et ce qu'on sait de son origine. */
export interface CourbeAffichee {
  points: PointCourbe[];
  /** Courbe d'un import antérieur : rien ne prouve qu'elle est celle de l'import affiché. */
  origineNonVerifiee: boolean;
}

/** Clés des courbes qu'une éprouvette garde sur cet appareil (0 ou 1). */
export function clesCourbesEprouvette(e: EprouvetteCourbe): string[] {
  return aCourbeLocale(e.essai) ? [cleCourbe(e)] : [];
}

/** Clés des courbes d'une gâchée (magasin, ou encore dans la gâchée). */
export function clesCourbes(g: Gachee): string[] {
  return (g.eprouvettes ?? []).flatMap(clesCourbesEprouvette);
}

/** Une affectation de l'import de presse : l'essai lu pour une éprouvette. */
export interface AffectationPresse {
  eprouvetteId: string;
  essai: Partial<EssaiUCS>;
}

/** Clé de la courbe d'une affectation : par import (l'import pose toujours `sourcePresse`). */
export function cleAffectation(a: AffectationPresse): string {
  const i = a.essai.sourcePresse?.importeLe;
  return i ? cleImport(a.eprouvetteId, i) : a.eprouvetteId;
}

/**
 * Applique un import de presse aux éprouvettes. Une courbe enregistrée dans
 * le magasin (`enregistrees`, par clé) ne laisse qu'une référence qui nomme
 * son import ; sinon elle reste dans la gâchée. Un nouvel import REMPLACE la
 * courbe du précédent : l'éprouvette ne garde jamais la courbe, ni la
 * référence, d'un autre import (case « Conserver la courbe » décochée
 * comprise). Rend les éprouvettes et les clés de courbe devenues inutiles
 * (à passer par courbesAOublier avant de les retirer du magasin).
 */
export function appliquerImportPresse(
  eprouvettes: Eprouvette[],
  affectations: AffectationPresse[],
  enregistrees: ReadonlySet<string>,
  complement: (e: Eprouvette, essai: EssaiUCS) => Partial<EssaiUCS> = () => ({}),
): { eprouvettes: Eprouvette[]; anciennes: string[] } {
  const parId = new Map(affectations.map((a): [string, Partial<EssaiUCS>] => {
    if (!enregistrees.has(cleAffectation(a)) || !a.essai.courbe) return [a.eprouvetteId, a.essai];
    const essai = { ...a.essai, courbeInfo: { nbPoints: a.essai.courbe.length, importeLe: a.essai.sourcePresse?.importeLe } };
    delete essai.courbe;
    return [a.eprouvetteId, essai];
  }));
  const anciennes: string[] = [];
  const r = eprouvettes.map((e): Eprouvette => {
    const patch = parId.get(e.id);
    if (!patch) return e;
    const fusion: EssaiUCS = { ...(e.essai ?? {}), ...patch };
    const essai: EssaiUCS = { ...fusion, ...complement(e, fusion) };
    if (!patch.courbe) delete essai.courbe;
    if (!patch.courbeInfo) delete essai.courbeInfo;
    const gardees = clesCourbesEprouvette({ ...e, essai });
    anciennes.push(...clesCourbesEprouvette(e).filter((cle) => !gardees.includes(cle)));
    return { ...e, statut: "ecrase", essai };
  });
  return { eprouvettes: r, anciennes };
}

/**
 * Courbes en ligne à retenir pour des éprouvettes (exports de la classe) :
 * pour chacune, le document de l'import qu'elle désigne ; à défaut, l'ancien
 * document sans import (écrit avant le 2026-10-18), marqué d'origine non
 * vérifiée. Les documents d'imports révolus sont écartés. Une copie de
 * conflit qui désigne un autre import que l'original retient le sien.
 */
export function courbesRetenues<T extends { proprietaire: string; eprouvetteId: string; importeLe: string | null }>(
  courbes: T[],
  eprouvettes: { proprietaire: string; eprouvetteId: string; importeLe?: string }[],
): (T & { origineNonVerifiee: boolean })[] {
  const cle = (proprietaire: string, eprouvetteId: string, importeLe: string | null | undefined) =>
    `${proprietaire}|${eprouvetteId}|${importeLe ?? ""}`;
  const index = new Map(courbes.map((c) => [cle(c.proprietaire, c.eprouvetteId, c.importeLe), c]));
  const retenues = new Map<string, T & { origineNonVerifiee: boolean }>();
  for (const e of eprouvettes) {
    const exacte = e.importeLe ? cle(e.proprietaire, e.eprouvetteId, e.importeLe) : null;
    const ancienne = cle(e.proprietaire, e.eprouvetteId, null);
    if (exacte && index.has(exacte)) {
      if (!retenues.has(exacte)) retenues.set(exacte, { ...index.get(exacte)!, origineNonVerifiee: false });
    } else if (index.has(ancienne) && !retenues.has(ancienne)) {
      retenues.set(ancienne, { ...index.get(ancienne)!, origineNonVerifiee: true });
    }
  }
  return [...retenues.values()];
}

/**
 * Courbe lue en ligne (document « courbe ») : les colonnes, sans les champs de
 * rattachement (eprouvetteId, gacheeId, importeLe). null si le contenu n'en
 * est pas une.
 */
export function courbeDepuisContenu(x: unknown): CourbeColonnes | null {
  if (!estCourbeColonnes(x)) return null;
  return { v: 1, t: x.t, f: x.f, d: x.d, s: x.s, e: x.e };
}

/**
 * Courbes du magasin qu'aucune gâchée ne référence plus (gâchées du compte,
 * copies de conflit et travail d'autres comptes mis de côté compris). Une
 * ancienne clé reste référencée tant que son éprouvette garde une courbe
 * d'origine inconnue ; après un nouvel import, elle devient orpheline.
 */
export function courbesOrphelines(clesMagasin: string[], gacheesReferencees: Gachee[]): string[] {
  const encore = new Set(gacheesReferencees.flatMap(clesCourbes));
  return clesMagasin.filter((cle) => !encore.has(cle));
}

/** Lignes CSV d'une courbe (en-tête compris) : t_s ; f_n ; d_mm ; s_kpa ; e_pct. */
export function lignesCsvCourbe(points: PointCourbe[]): (string | number)[][] {
  return [
    ["t_s", "f_n", "d_mm", "s_kpa", "e_pct"],
    ...points.map((p) => [p.tempsS, p.chargeN, p.deplacementMm, p.contrainteKpa, p.deformationPct]),
  ];
}

/**
 * Courbes à retirer du magasin quand des éprouvettes disparaissent ou
 * changent d'import : sauf celles qu'une AUTRE gâchée référence encore (une
 * copie de conflit du même import partage la clé de l'original : retirer la
 * copie ne doit pas effacer la courbe de l'original).
 */
export function courbesAOublier(cles: string[], gacheesRestantes: Gachee[]): string[] {
  const encore = new Set(gacheesRestantes.flatMap(clesCourbes));
  return cles.filter((cle) => !encore.has(cle));
}

/** Courbes encore stockées DANS les gâchées (avant déplacement), sous
 *  l'ancienne clé : leur origine n'est pas vérifiable. */
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
 * vers le fichier, sous la clé de courbe (cleCourbe). Un fichier écrit avant
 * le 2026-10-18 a des références sans import, donc l'ancienne clé, celle sous
 * laquelle il range ses courbes. Si le magasin a pu enregistrer une courbe, la
 * référence reste ; sinon la courbe est remise DANS la gâchée (rien ne se
 * perd) ; et une référence sans courbe dans le fichier est retirée (elle
 * mentirait).
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
        const cle = cleCourbe(e);
        if (!e.essai?.courbeInfo || enregistrees.has(cle)) return e;
        const essai = { ...e.essai };
        delete essai.courbeInfo;
        const c = courbesFichier[cle];
        if (c) essai.courbe = decoderCourbe(c);
        return { ...e, essai };
      }),
    };
  });
}
