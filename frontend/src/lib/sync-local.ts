// frontend/src/lib/sync-local.ts
// Dépôt local du moteur de synchronisation : le stockage du navigateur, vu
// comme une liste de documents (résultats sauvegardés, gâchées).
//
// Trois règles, chacune pour une raison :
// - On lit et écrit le stockage PERSISTÉ, jamais l'état mémoire. Si une
//   écriture locale a échoué (stockage plein), la version relue au
//   rechargement ne doit pas passer pour une modification et écraser en ligne
//   une version plus récente. D'où aussi : une écriture refusée rend « echec »,
//   et le moteur n'avance pas.
// - Forme CANONIQUE = ce qui part en ligne. Sans `ownerId` (information locale)
//   ni les courbes de presse (lourdes : elles restent sur l'appareil, dans la
//   gâchée ou dans IndexedDB — `courbe` ou sa référence `courbeInfo`). Écrire
//   une version serveur RÉATTACHE ces champs locaux, sinon chaque
//   synchronisation effacerait les courbes.
// - Un résultat estampillé au nom d'un AUTRE compte (ancienne fusion de la v1
//   chez l'enseignant, sauvegarde importée) n'est jamais envoyé : il reste
//   local, invisible pour le moteur.
//
// Les accès au stockage sont INJECTÉS (SourcesLocales) : ce module se teste en
// node, sans navigateur ni magasin zustand.

import type { SavedResult } from "./store";
import type { Gachee } from "./gachee";
import type { PointCourbe } from "./presse-urstm";
import { empreinte } from "./sync-empreinte";
import {
  cleDoc,
  type DepotLocal, type DocLocal, type IssueOperation, type Kind, type OperationLocale,
} from "./sync-moteur";

/** Même règle que la contrainte user_docs_id_ck de supabase/schema.sql. */
export const RE_ID_DOC = /^[A-Za-z0-9_.:-]{1,100}$/;

export interface SourcesLocales {
  /** Compte auquel le stockage est lié (null = aucun). */
  uid: () => string | null;
  lireResultats: () => SavedResult[];
  ecrireResultats: (items: SavedResult[]) => boolean;
  lireGachees: () => Gachee[];
  ecrireGachees: (items: Gachee[]) => boolean;
  /** Appelé après une écriture réussie : recharger le magasin (l'écran). */
  apresEcriture: (kinds: ReadonlySet<Kind>) => void;
}

/* ── Forme canonique ─────────────────────────────────────────────────────── */

export function canoniqueResultat(r: SavedResult): unknown {
  const reste = { ...r };
  delete reste.ownerId;
  return reste;
}

const aChampsLocaux = (e: { essai?: { courbe?: unknown; courbeInfo?: unknown } }) =>
  e.essai?.courbe !== undefined || e.essai?.courbeInfo !== undefined;

export function canoniqueGachee(g: Gachee): unknown {
  if (!(g.eprouvettes ?? []).some(aChampsLocaux)) return g;
  return {
    ...g,
    eprouvettes: g.eprouvettes.map((e) => {
      if (!e.essai || !aChampsLocaux(e)) return e;
      const essai = { ...e.essai };
      delete essai.courbe;
      delete essai.courbeInfo;
      return { ...e, essai };
    }),
  };
}

/** Champs locaux de courbe (courbe ou référence) par id d'éprouvette. */
type ChampsCourbe = { courbe?: PointCourbe[]; courbeInfo?: { nbPoints: number } };
function courbesDe(g: Gachee | undefined): Map<string, ChampsCourbe> {
  const m = new Map<string, ChampsCourbe>();
  for (const e of g?.eprouvettes ?? []) {
    if (e.essai?.courbe) m.set(e.id, { courbe: e.essai.courbe });
    else if (e.essai?.courbeInfo) m.set(e.id, { courbeInfo: e.essai.courbeInfo });
  }
  return m;
}

/** Réattache les champs locaux de courbe aux éprouvettes (même id) d'une gâchée reçue. */
function avecCourbes(g: Gachee, courbes: Map<string, ChampsCourbe>): Gachee {
  if (courbes.size === 0 || !Array.isArray(g.eprouvettes)) return g;
  return {
    ...g,
    eprouvettes: g.eprouvettes.map((e) => {
      const c = courbes.get(e.id);
      return c && e.essai && !aChampsLocaux(e) ? { ...e, essai: { ...e.essai, ...c } } : e;
    }),
  };
}

function eligible(x: { id?: unknown } | null | undefined): x is { id: string } {
  return !!x && typeof x.id === "string" && RE_ID_DOC.test(x.id);
}

/* ── Dépôt ───────────────────────────────────────────────────────────────── */

export function creerDepotLocal(s: SourcesLocales): DepotLocal {
  const autreCompte = (r: SavedResult) => {
    const uid = s.uid();
    return !!r.ownerId && !!uid && r.ownerId !== uid;
  };

  function lister(): Map<string, DocLocal> {
    const m = new Map<string, DocLocal>();
    for (const r of s.lireResultats()) {
      if (!eligible(r) || autreCompte(r)) continue;
      const contenu = canoniqueResultat(r);
      m.set(cleDoc("resultat", r.id), { kind: "resultat", id: r.id, contenu, empreinte: empreinte(contenu) });
    }
    for (const g of s.lireGachees()) {
      if (!eligible(g)) continue;
      const contenu = canoniqueGachee(g);
      m.set(cleDoc("gachee", g.id), { kind: "gachee", id: g.id, contenu, empreinte: empreinte(contenu) });
    }
    return m;
  }

  function appliquerKind<T extends { id: string }>(
    kind: Kind,
    ops: { op: OperationLocale; i: number }[],
    lire: () => T[],
    ecrire: (items: T[]) => boolean,
    canonique: (x: T) => unknown,
    fusionner: (recu: T, actuel: T | undefined) => T,
    issues: IssueOperation[],
  ): boolean {
    let items = lire();
    const appliquees: number[] = [];
    for (const { op, i } of ops) {
      const actuel = items.find((x) => x?.id === op.id);
      // Un document présent mais invisible pour le moteur (autre compte, id
      // hors format) a une empreinte non nulle : la garde le protège.
      const empActuelle = actuel ? empreinte(canonique(actuel)) : null;
      if (empActuelle !== op.attendu) { issues[i] = "ignoree"; continue; }
      if (op.type === "retirer") {
        items = items.filter((x) => x?.id !== op.id);
      } else {
        const neuf = fusionner(op.contenu as T, actuel);
        items = actuel ? items.map((x) => (x?.id === op.id ? neuf : x)) : [neuf, ...items];
      }
      appliquees.push(i);
    }
    if (appliquees.length === 0) return false;
    if (!ecrire(items)) {
      for (const i of appliquees) issues[i] = "echec";
      return false;
    }
    for (const i of appliquees) issues[i] = "appliquee";
    return true;
  }

  function appliquer(ops: OperationLocale[]): IssueOperation[] {
    const issues: IssueOperation[] = new Array(ops.length).fill("ignoree");
    const parKind: Record<Kind, { op: OperationLocale; i: number }[]> = { resultat: [], gachee: [] };
    ops.forEach((op, i) => parKind[op.kind].push({ op, i }));
    const ecrits = new Set<Kind>();

    if (parKind.resultat.length > 0 && appliquerKind<SavedResult>(
      "resultat", parKind.resultat, s.lireResultats, s.ecrireResultats,
      (r) => canoniqueResultat(r),
      // Reçu du serveur : c'est notre compte (le stockage lui est lié).
      (recu, actuel) => ({ ...recu, ownerId: actuel?.ownerId ?? s.uid() ?? undefined }),
      issues,
    )) ecrits.add("resultat");

    if (parKind.gachee.length > 0 && appliquerKind<Gachee>(
      "gachee", parKind.gachee, s.lireGachees, s.ecrireGachees,
      (g) => canoniqueGachee(g),
      (recu, actuel) => avecCourbes(recu, courbesDe(actuel)),
      issues,
    )) ecrits.add("gachee");

    if (ecrits.size > 0) s.apresEcriture(ecrits);
    return issues;
  }

  function copieDeConflit(kind: Kind, contenu: unknown, nouvelId: string, le: string): unknown {
    const source = contenu as { id: string };
    const copie = { ...(contenu as object), id: nouvelId, conflit: { de: source.id, le } };
    if (kind !== "gachee") return copie;
    // La copie garde les courbes de l'original local (elles ne sont pas en
    // ligne : sans cela, la version de l'étudiant les perdrait) — mais
    // seulement celles rangées DANS la gâchée : une référence au magasin
    // serait partagée avec l'original, et supprimer la copie l'effacerait.
    const original = s.lireGachees().find((g) => g?.id === source.id);
    const enLigne = new Map([...courbesDe(original)].filter(([, c]) => c.courbe));
    return avecCourbes(copie as unknown as Gachee, enLigne);
  }

  return { lister, appliquer, copieDeConflit };
}
