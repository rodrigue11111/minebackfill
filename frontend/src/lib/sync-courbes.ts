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
//   - une courbe part quand sa gâchée est déjà connue en ligne (sinon le
//     nettoyage serveur, qui retire les courbes sans gâchée, pourrait la
//     prendre pour une orpheline) ;
//   - document « courbe », id = id de l'éprouvette, contenu = colonnes +
//     rattachement { eprouvetteId, gacheeId } ;
//   - la forme canonique des gâchées ne change pas : `courbeInfo` reste
//     local, jamais synchronisé (sinon deux appareils se réécriraient) ;
//   - au plus `budget` courbes par cycle (quota de l'offre gratuite).

import type { Gachee } from "./gachee";
import type { CourbeColonnes } from "./courbes";
import { cleDoc, ErreurSync, type EtatSync, type LigneServeur } from "./sync-moteur";
import { empreinte } from "./sync-empreinte";

/** État de l'envoi des courbes (stockage local, HORS sauvegarde). */
export interface EtatCourbes {
  v: 1;
  /** Compte auquel cet état se rapporte ; un autre compte repart de zéro. */
  uid: string | null;
  /** Courbes confirmées en ligne : révision serveur et signature envoyée. */
  envoyees: Record<string, { rev: number; signature: string }>;
  /** Refusées par le serveur (taille, quota) : pas de nouvel essai tant que
   *  la courbe ne change pas. */
  bloquees: Record<string, string>;
}

export function etatCourbesInitial(uid: string | null): EtatCourbes {
  return { v: 1, uid, envoyees: {}, bloquees: {} };
}

/**
 * Signature d'une courbe locale, sans lire IndexedDB : un nouvel import de
 * presse change `sourcePresse.importeLe` (et souvent le nombre de points).
 */
export function signatureCourbe(essai: { sourcePresse?: { importeLe?: string }; courbeInfo?: { nbPoints: number } } | undefined): string {
  return `${essai?.sourcePresse?.importeLe ?? ""}|${essai?.courbeInfo?.nbPoints ?? 0}`;
}

export interface CourbeAEnvoyer {
  eprouvetteId: string;
  gacheeId: string;
  signature: string;
  /** Révision connue en ligne (renvoi après un nouvel import), sinon null. */
  baseRev: number | null;
}

/** Courbes à envoyer ce cycle, dans l'ordre des gâchées. */
export function planifierCourbes(
  gachees: Gachee[],
  etatSync: Pick<EtatSync, "docs">,
  etat: EtatCourbes,
  budget = 10,
): CourbeAEnvoyer[] {
  const r: CourbeAEnvoyer[] = [];
  const vus = new Set<string>();
  for (const g of gachees) {
    // Une copie de conflit garde les ids d'éprouvette de l'original : sa
    // courbe est celle de l'original, envoyée avec lui.
    if (g.conflit) continue;
    if (etatSync.docs[cleDoc("gachee", g.id)]?.rev == null) continue;
    for (const e of g.eprouvettes ?? []) {
      if (!e.essai?.courbeInfo || vus.has(e.id)) continue;
      vus.add(e.id);
      const signature = signatureCourbe(e.essai);
      const deja = etat.envoyees[e.id];
      if (deja?.signature === signature || etat.bloquees[e.id] === signature) continue;
      r.push({ eprouvetteId: e.id, gacheeId: g.id, signature, baseRev: deja?.rev ?? null });
      if (r.length >= budget) return r;
    }
  }
  return r;
}

/** Contenu du document « courbe ». */
export function contenuCourbe(p: Pick<CourbeAEnvoyer, "eprouvetteId" | "gacheeId">, c: CourbeColonnes): Record<string, unknown> {
  return { v: 1, eprouvetteId: p.eprouvetteId, gacheeId: p.gacheeId, t: c.t, f: c.f, d: c.d, s: c.s, e: c.e };
}

/** Écriture d'un document « courbe » (ecrire_doc), injectée. */
export type EcrireCourbe = (id: string, contenu: unknown, baseRev: number | null) =>
  Promise<{ ok: true; rev: number } | { ok: false; ligne: Pick<LigneServeur, "rev" | "supprime" | "contenu"> | null }>;

/**
 * Envoie UNE courbe. Rend la révision serveur, ou null (à réessayer plus
 * tard). Cas traités :
 *   - création acceptée ;
 *   - la courbe existe déjà en ligne (réponse perdue, autre appareil) : même
 *     contenu, on retient sa révision ; contenu différent ou retiré, on la
 *     réécrit sur la révision lue (l'import de cet appareil fait foi) ;
 *   - renvoi après un nouvel import, sur une révision qui a bougé : idem.
 * Les erreurs (ErreurSync) remontent.
 */
export async function envoyerCourbe(ecrire: EcrireCourbe, p: CourbeAEnvoyer, contenu: unknown): Promise<number | null> {
  const r = await ecrire(p.eprouvetteId, contenu, p.baseRev);
  if (r.ok) return r.rev;
  if (r.ligne === null) {
    // Plus rien en ligne (renvoi) : on recrée.
    const c = await ecrire(p.eprouvetteId, contenu, null);
    return c.ok ? c.rev : null;
  }
  if (!r.ligne.supprime && empreinte(r.ligne.contenu) === empreinte(contenu)) return r.ligne.rev;
  const s = await ecrire(p.eprouvetteId, contenu, r.ligne.rev);
  return s.ok ? s.rev : null;
}

/**
 * Un cycle d'envoi : planifie, lit chaque courbe dans le magasin, l'envoie,
 * et rend le nouvel état. Une erreur passagère arrête le cycle (on reprendra
 * au suivant) ; un refus définitif bloque la courbe jusqu'à ce qu'elle change.
 */
export async function cycleCourbes(args: {
  gachees: Gachee[];
  etatSync: Pick<EtatSync, "docs">;
  etat: EtatCourbes;
  lire: (id: string) => Promise<CourbeColonnes | null>;
  ecrire: EcrireCourbe;
  budget?: number;
}): Promise<{ etat: EtatCourbes; envoyees: number }> {
  const etat: EtatCourbes = { ...args.etat, envoyees: { ...args.etat.envoyees }, bloquees: { ...args.etat.bloquees } };
  let envoyees = 0;
  for (const p of planifierCourbes(args.gachees, args.etatSync, etat, args.budget)) {
    const courbe = await args.lire(p.eprouvetteId);
    if (!courbe) continue; // pas (ou plus) dans le magasin de cet appareil
    try {
      const rev = await envoyerCourbe(args.ecrire, p, contenuCourbe(p, courbe));
      if (rev === null) continue;
      etat.envoyees[p.eprouvetteId] = { rev, signature: p.signature };
      delete etat.bloquees[p.eprouvetteId];
      envoyees++;
    } catch (e) {
      if (e instanceof ErreurSync && e.nature === "permanente") {
        etat.bloquees[p.eprouvetteId] = p.signature;
        continue;
      }
      break; // passagère ou session : on reprendra au prochain cycle
    }
  }
  return { etat, envoyees };
}
