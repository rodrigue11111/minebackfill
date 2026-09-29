"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import type { Avis } from "@/lib/sync-moteur";
import {
  abonnerSync, annulerSuppressions, confirmerSuppressions, instantaneSync, instantaneSyncServeur,
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

const boite = (fond: string, bord: string, texte: string): React.CSSProperties => ({
  background: fond, borderBottom: `1px solid ${bord}`, color: texte,
  fontSize: 13, lineHeight: 1.5, padding: "10px 16px",
  display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
});

const bouton: React.CSSProperties = { fontSize: 12.5, padding: "4px 12px" };

export default function BandeauSynchro() {
  const s = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);
  const email = useStore((st) => st.session?.email);
  const nomDoc = useNomDoc();

  const elements: React.ReactNode[] = [];

  if (s.liaison === "proposer_rattachement" && !s.reporte) {
    const { resultats, gachees } = s.anonymes;
    const quoi = [
      resultats > 0 ? `${resultats} résultat${resultats > 1 ? "s" : ""}` : null,
      gachees > 0 ? `${gachees} gâchée${gachees > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" et ");
    elements.push(
      <div key="rattacher" role="status" style={boite("#eff6ff", "#bfdbfe", "#1e3a8a")}>
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
    elements.push(
      <div key="autre" role="status" style={boite("#fffbeb", "#fde68a", "#92400e")}>
        <span>
          Ce navigateur est lié à un <strong>autre compte</strong> : la sauvegarde en ligne est désactivée
          ici pour {email ?? "ce compte"}. Vos données locales ne sont pas touchées. Pour changer de compte :
          reconnectez-vous avec le compte d&apos;origine, puis « Délier ce navigateur » dans{" "}
          <Link href="/compte" style={{ color: "inherit", fontWeight: 700 }}>Compte</Link>.
        </span>
      </div>,
    );
  }

  if (s.erreur?.nature === "session") {
    elements.push(
      <div key="session" role="alert" style={boite("#fef2f2", "#fecaca", "#991b1b")}>
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
      <div key={`avis-${i}`} role="status" style={boite(grave ? "#fef2f2" : "#f8fafc", grave ? "#fecaca" : "#e2e8f0", grave ? "#991b1b" : "#334155")}>
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
