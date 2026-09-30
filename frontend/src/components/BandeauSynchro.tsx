"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import type { Avis } from "@/lib/sync-moteur";
import { nonLuesDeLEnseignant } from "@/lib/annotations";
import {
  abonnerSync, annulerSuppressions, confirmerSuppressions, fermerBandeauCommentaires, instantaneSync, instantaneSyncServeur,
  rattacher, reporterRattachement, retirerAvis,
} from "@/lib/sync-client";

/**
 * Ce que la synchronisation doit dire à l'étudiant, sous la barre de
 * navigation : rattacher les données créées sans compte, un navigateur lié à
 * un autre compte, et les avis des derniers cycles (conflit, document gardé,
 * suppression annulée ou suspendue, refus du serveur).
 */

const MESSAGES_REFUS: Record<string, string> = {
  "53400": "l'espace en ligne de votre compte est plein (25 Mo)",
  "23514": "le document est trop volumineux ou son identifiant est invalide",
  "42501": "le serveur a refusé l'écriture (droits insuffisants)",
  "22001": "un champ dépasse la longueur permise",
};

/** Nom lisible d'un document, et accord (« modifié » / « modifiée »). */
function useNomDoc(): (kind: "resultat" | "gachee", id: string) => { nom: string; e: string; il: string } {
  const resultats = useStore((s) => s.savedResults);
  const gachees = useStore((s) => s.gachees);
  return (kind, id) => kind === "resultat"
    ? { nom: `Le résultat « ${resultats.find((r) => r.id === id)?.label ?? id} »`, e: "", il: "Il" }
    : { nom: `La gâchée ${gachees.find((g) => g.id === id)?.code ?? id}`, e: "e", il: "Elle" };
}

// Bandeaux pleine largeur sous la barre haute : fond pâle, filet discret.
const boite = (fond: string, texte: string): React.CSSProperties => ({
  background: fond, borderBottom: "1px solid rgba(0, 0, 0, 0.05)", color: texte,
  fontSize: 13.5, lineHeight: 1.5, padding: "10px max(24px, env(safe-area-inset-left))",
  display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
});

const bouton: React.CSSProperties = { fontSize: 13, minHeight: 30, padding: "0 14px" };

export default function BandeauSynchro() {
  const s = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);
  const email = useStore((st) => st.session?.email);
  const nomDoc = useNomDoc();
  const annotations = useStore((st) => st.annotations);
  const resultats = useStore((st) => st.savedResults);
  const gachees = useStore((st) => st.gachees);

  const elements: React.ReactNode[] = [];

  if (s.liaison === "proposer_rattachement" && !s.reporte) {
    const { resultats, gachees } = s.anonymes;
    const quoi = [
      resultats > 0 ? `${resultats} résultat${resultats > 1 ? "s" : ""}` : null,
      gachees > 0 ? `${gachees} gâchée${gachees > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" et ");
    elements.push(
      <div key="rattacher" role="status" style={boite("#E8F1FC", "#0B4F9C")}>
        <span>
          Cet appareil contient {quoi} {accordCree(resultats, gachees)} sans compte. Les
          rattacher à votre compte{email ? ` (${email})` : ""} pour les sauvegarder en ligne et les
          retrouver sur un autre appareil ?
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-primary" style={bouton} onClick={() => rattacher()}>Rattacher</button>
          <button type="button" className="btn-secondary" style={bouton} onClick={() => reporterRattachement()}>Plus tard</button>
        </span>
      </div>,
    );
  }

  if (s.liaison === "autre_compte") {
    // Ne survient plus qu'en cas d'échec du changement de compte : le
    // stockage du navigateur a refusé de mettre de côté l'autre compte.
    elements.push(
      <div key="autre" role="alert" style={boite("#FFF3DF", "#8A4B00")}>
        <span>
          La sauvegarde en ligne n&apos;a pas pu démarrer pour {email ?? "ce compte"} : le stockage du
          navigateur est plein, le travail de l&apos;autre compte n&apos;a pas pu être mis de côté. Rien
          n&apos;est perdu. Libérez de la place (voir le{" "}
          <Link href="/diagnostic" style={{ color: "inherit", fontWeight: 700 }}>Diagnostic</Link>), puis
          rechargez la page.
        </span>
      </div>,
    );
  }

  // Commentaires de l'enseignant pas encore lus, sur des documents présents
  // ici (sinon on ne pourrait jamais les afficher, donc jamais les marquer lus).
  const nonLues = nonLuesDeLEnseignant(annotations, (kind, id) =>
    kind === "resultat" ? resultats.some((r) => r.id === id) : gachees.some((g) => g.id === id))
    .filter((a) => !s.commentairesFermes.includes(a.id));
  if (nonLues.length > 0) {
    const n = nonLues.length;
    const docs = [...new Map(nonLues.map((a) => [`${a.cibleKind}:${a.cibleId}`, a])).values()];
    const noms = docs.slice(0, 3).map((a) =>
      a.cibleKind === "resultat"
        ? `le résultat « ${resultats.find((r) => r.id === a.cibleId)?.label ?? a.cibleId} »`
        : `la gâchée ${gachees.find((g) => g.id === a.cibleId)?.code ?? a.cibleId}`);
    const reste = docs.length - noms.length;
    if (reste > 0) noms.push(`${reste} autre${reste > 1 ? "s" : ""} document${reste > 1 ? "s" : ""}`);
    const liste = noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
    elements.push(
      <div key="annotations" role="status" style={boite("#F0ECFB", "#5B3CC4")}>
        <span>
          L&apos;enseignant a laissé {n} commentaire{n > 1 ? "s" : ""} non lu{n > 1 ? "s" : ""} sur{" "}
          {liste}.
          Ouvrez vos gâchées dans le <Link href="/labo" style={{ color: "inherit", fontWeight: 700 }}>Labo</Link>{" "}
          et vos résultats dans l&apos;<Link href="/historique" style={{ color: "inherit", fontWeight: 700 }}>Historique</Link> :
          vous pourrez y répondre.
        </span>
        <button type="button" className="btn-secondary" style={bouton} onClick={() => fermerBandeauCommentaires(nonLues.map((a) => a.id))}>Fermer</button>
      </div>,
    );
  }

  if (s.erreur?.nature === "session") {
    elements.push(
      <div key="session" role="alert" style={boite("#FDEDEC", "#B3261E")}>
        <span>Session inattendue : la sauvegarde en ligne est interrompue. Déconnectez-vous puis reconnectez-vous.</span>
      </div>,
    );
  }

  const texteAvis = (a: Avis): React.ReactNode => {
    if (a.type === "suppressions_suspendues") {
      return <>Vous avez supprimé <strong>{a.nombre} documents</strong>. Confirmez pour les supprimer aussi en ligne.</>;
    }
    const { nom, e, il } = nomDoc(a.kind, a.id);
    switch (a.type) {
      case "conflit":
        return <>{nom} a été modifié{e} sur deux appareils en même temps : les <strong>deux versions</strong> sont gardées. La vôtre est marquée « copie de conflit ».</>;
      case "ressuscite":
        return <>{nom} avait été supprimé{e} sur un autre appareil, mais vous l&apos;aviez modifié{e} ici : <strong>votre version est conservée</strong>.</>;
      case "suppression_annulee":
        return <>{nom} avait été modifié{e} sur un autre appareil : <strong>votre suppression a été annulée</strong>, pour ne pas perdre ce travail.</>;
      case "refuse":
        return <>{nom} n&apos;a pas pu être sauvegardé{e} en ligne : {MESSAGES_REFUS[a.code] ?? `refus du serveur (${a.code})`}. {il} reste enregistré{e} sur cet appareil.</>;
    }
  };

  s.avis.forEach((a, i) => {
    const grave = a.type === "refuse";
    elements.push(
      <div key={`avis-${i}`} role="status" style={boite(grave ? "#FDEDEC" : "#F5F5F7", grave ? "#B3261E" : "#3A3A3C")}>
        <span>{texteAvis(a)}</span>
        <span style={{ display: "flex", gap: 8 }}>
          {a.type === "suppressions_suspendues" ? (
            <>
              <button type="button" className="btn-primary" style={bouton}
                onClick={() => { retirerAvis((x) => x === a); confirmerSuppressions(); }}>Confirmer</button>
              <button type="button" className="btn-secondary" style={bouton}
                onClick={() => annulerSuppressions()}>Les restaurer</button>
            </>
          ) : (
            <button type="button" className="btn-secondary" style={bouton} onClick={() => retirerAvis((x) => x === a)}>Fermer</button>
          )}
        </span>
      </div>,
    );
  });

  return elements.length > 0 ? <div>{elements}</div> : null;
}

/** « créé », « créée », « créés », « créées » : le masculin l'emporte dès qu'il y a un résultat. */
function accordCree(resultats: number, gachees: number): string {
  const feminin = resultats === 0 ? "e" : "";
  return `créé${feminin}${resultats + gachees > 1 ? "s" : ""}`;
}
