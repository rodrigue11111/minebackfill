// frontend/src/lib/sync-courbes.ts
// Envoi des courbes de presse en ligne, À PART du moteur de synchronisation.
// Module PUR : l'écriture et le magasin sont injectés.
//
// Pourquoi à part : le moteur (sync-moteur.ts) ne connaît que les résultats
// et les gâchées, et son dépôt local est synchrone ; les courbes vivent dans
// IndexedDB (asynchrone) et ne redescendent jamais par lire_docs. Elles sont
// donc envoyées ici, après chaque cycle, et relues à la demande.
//
// Règles :
//   - UN DOCUMENT PAR IMPORT : document « courbe », id = clé de la courbe
//     `<idEprouvette>:<importeLe>` (courbes.ts, cleCourbe), contenu = colonnes
//     + rattachement { eprouvetteId, gacheeId, importeLe }. Un document n'est
//     jamais réécrit par un autre import : deux appareils qui envoient des
//     imports différents écrivent deux documents, et les lecteurs prennent
//     celui que la gâchée désigne ;
//   - seule part une courbe d'origine vérifiée (courbeInfo.importeLe égal à
//     sourcePresse.importeLe) : une courbe d'origine inconnue reste locale ;
//   - une courbe part quand la version en ligne connue de sa gâchée est la
//     version locale (même empreinte) : sinon le nettoyage serveur, qui retire
//     les courbes qu'aucune gâchée en ligne ne désigne, pourrait la retirer.
//     Simple économie : la protection contre les écrasements vient de
//     l'identifiant par import ;
//   - la forme canonique des gâchées ne change pas : `courbeInfo` reste
//     local, jamais synchronisé (sinon deux appareils se réécriraient) ;
//   - au plus `budget` envois par cycle (quota de l'offre gratuite) ; une
//     courbe absente du magasin ne compte pas.

import type { Gachee } from "./gachee";
import { cleCourbe, origineVerifiee, type CourbeColonnes } from "./courbes";
import { cleDoc, ErreurSync, type EtatSync, type LigneServeur } from "./sync-moteur";
import { empreinte } from "./sync-empreinte";
import { canoniqueGachee, RE_ID_DOC } from "./sync-local";

/** État de l'envoi des courbes d'UN compte (stockage local, HORS sauvegarde). */
export interface EtatCourbes {
  /** Documents « courbe » confirmés en ligne, par identifiant : révision serveur. */
  envoyees: Record<string, { rev: number }>;
  /** Refusés par le serveur (taille, quota), par identifiant : code d'erreur.
   *  Pas de nouvel essai avant la prochaine connexion. */
  bloquees: Record<string, string>;
}

export function etatCourbesInitial(): EtatCourbes {
  return { envoyees: {}, bloquees: {} };
}

export interface CourbeAEnvoyer {
  /** Identifiant du document en ligne (clé de la courbe). */
  cle: string;
  eprouvetteId: string;
  gacheeId: string;
  importeLe: string;
}

/**
 * Courbes à envoyer, dans l'ordre des gâchées, copies de conflit comprises :
 * chaque gâchée à jour en ligne propose ses courbes d'origine vérifiée ; une
 * clé n'est proposée qu'une fois (un original et sa copie du même import
 * partagent la courbe). Un original avec l'import Y et sa copie avec
 * l'import X proposent deux courbes.
 */
export function planifierCourbes(
  gachees: Gachee[],
  etatSync: Pick<EtatSync, "docs">,
  etat: EtatCourbes,
): CourbeAEnvoyer[] {
  const r: CourbeAEnvoyer[] = [];
  const vues = new Set<string>();
  for (const g of gachees) {
    const candidates = (g.eprouvettes ?? []).filter((e) => origineVerifiee(e.essai));
    if (candidates.length === 0) continue;
    const enLigne = etatSync.docs[cleDoc("gachee", g.id)];
    if (enLigne?.rev == null || enLigne.empreinte !== empreinte(canoniqueGachee(g))) continue;
    for (const e of candidates) {
      const cle = cleCourbe(e);
      if (vues.has(cle) || !RE_ID_DOC.test(cle)) continue;
      vues.add(cle);
      if (etat.envoyees[cle] || etat.bloquees[cle] !== undefined) continue;
      r.push({ cle, eprouvetteId: e.id, gacheeId: g.id, importeLe: e.essai!.courbeInfo!.importeLe! });
    }
  }
  return r;
}

/** Contenu du document « courbe ». */
export function contenuCourbe(p: Pick<CourbeAEnvoyer, "eprouvetteId" | "gacheeId" | "importeLe">, c: CourbeColonnes): Record<string, unknown> {
  return { v: 1, eprouvetteId: p.eprouvetteId, gacheeId: p.gacheeId, importeLe: p.importeLe, t: c.t, f: c.f, d: c.d, s: c.s, e: c.e };
}

/** Écriture d'un document « courbe » (ecrire_doc), injectée. */
export type EcrireCourbe = (id: string, contenu: unknown, baseRev: number | null) =>
  Promise<{ ok: true; rev: number } | { ok: false; ligne: Pick<LigneServeur, "rev" | "supprime" | "contenu"> | null }>;

/**
 * Envoie UNE courbe. Rend la révision serveur, ou null (à réessayer plus
 * tard). Cas traités :
 *   - création acceptée ;
 *   - le document existe déjà en ligne (réponse perdue, autre appareil) :
 *     c'est le même import (même identifiant), on retient sa révision SANS
 *     réécrire, même si le contenu diffère ;
 *   - le document a été retiré (nettoyage serveur) : on le recrée.
 * Les erreurs (ErreurSync) remontent.
 */
export async function envoyerCourbe(ecrire: EcrireCourbe, p: Pick<CourbeAEnvoyer, "cle">, contenu: unknown): Promise<number | null> {
  const r = await ecrire(p.cle, contenu, null);
  if (r.ok) return r.rev;
  if (r.ligne === null) return null;
  if (!r.ligne.supprime) return r.ligne.rev;
  const s = await ecrire(p.cle, contenu, r.ligne.rev);
  return s.ok ? s.rev : null;
}

/**
 * Un cycle d'envoi : planifie, lit chaque courbe dans le magasin, l'envoie,
 * et rend le nouvel état. Une erreur passagère arrête le cycle (on reprendra
 * au suivant) ; un refus définitif bloque la courbe. `reste` : courbes encore
 * à envoyer (budget épuisé, erreur, réponse à reprendre) ; `budgetEpuise` :
 * relancer bientôt.
 */
export async function cycleCourbes(args: {
  gachees: Gachee[];
  etatSync: Pick<EtatSync, "docs">;
  etat: EtatCourbes;
  lire: (cle: string) => Promise<CourbeColonnes | null>;
  ecrire: EcrireCourbe;
  budget?: number;
}): Promise<{ etat: EtatCourbes; envoyees: number; reste: number; budgetEpuise: boolean }> {
  const budget = args.budget ?? 10;
  const etat: EtatCourbes = { envoyees: { ...args.etat.envoyees }, bloquees: { ...args.etat.bloquees } };
  const plan = planifierCourbes(args.gachees, args.etatSync, etat);
  let envoyees = 0;
  let reglees = 0;
  let i = 0;
  for (; i < plan.length && envoyees < budget; i++) {
    const p = plan[i];
    const courbe = await args.lire(p.cle);
    if (!courbe) { reglees++; continue; } // pas (ou plus) dans le magasin de cet appareil
    try {
      envoyees++;
      const rev = await envoyerCourbe(args.ecrire, p, contenuCourbe(p, courbe));
      if (rev === null) continue;
      etat.envoyees[p.cle] = { rev };
      delete etat.bloquees[p.cle];
      reglees++;
    } catch (e) {
      if (e instanceof ErreurSync && e.nature === "permanente") {
        etat.bloquees[p.cle] = e.code;
        reglees++;
        continue;
      }
      break; // passagère ou session : on reprendra au prochain cycle
    }
  }
  return { etat, envoyees, reste: plan.length - reglees, budgetEpuise: envoyees >= budget && i < plan.length };
}

/** Le nettoyage serveur a retiré ces documents : ils ne sont plus en ligne. */
export function oublierPurgees(etat: EtatCourbes, ids: string[]): EtatCourbes {
  if (ids.length === 0) return etat;
  const envoyees = { ...etat.envoyees };
  for (const id of ids) delete envoyees[id];
  return { ...etat, envoyees };
}
