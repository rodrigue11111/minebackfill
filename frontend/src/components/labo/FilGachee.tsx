"use client";

// Fil d'une gâchée (Gâchée, Moulage, Cure, Écrasement, UCS) et l'état de sa
// sauvegarde, sous l'en-tête de l'éditeur. Rien n'est demandé en plus : tout
// se déduit de ce que l'étudiant a déjà saisi (lib/gachee.ts, etapesGachee).

import { useSyncExternalStore } from "react";
import { contrainteKpa } from "@/lib/eprouvette";
import { etapesGachee, type Gachee } from "@/lib/gachee";
import { abonnerSync, instantaneSync, instantaneSyncServeur, type InstantaneSync } from "@/lib/sync-client";

/** Où vit la gâchée, en clair : dans le compte, ou sur cet ordinateur seulement. */
export function libelleSauvegarde(connecte: boolean, s: Pick<InstantaneSync, "liaison" | "statut">): string {
  if (!connecte || s.liaison !== "synchroniser") return "Sur cet ordinateur seulement : connectez-vous pour la sauvegarder dans votre compte.";
  switch (s.statut) {
    case "a_jour": return "Sauvegardée dans votre compte.";
    case "hors_ligne": return "Sur cet ordinateur pour l'instant : elle partira dans votre compte au retour du réseau.";
    case "erreur":
    case "pause": return "Sur cet ordinateur : la sauvegarde en ligne est interrompue (voir la page Compte).";
    default: return "Envoi vers votre compte en cours.";
  }
}

export default function FilGachee({ gachee, connecte }: { gachee: Gachee; connecte: boolean }) {
  const sync = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);
  const etapes = etapesGachee(gachee, (e) => contrainteKpa(e.essai) !== null);
  return (
    <div className="labo-fil">
      <nav aria-label="Étapes de la gâchée" className="parcours">
        <ol>
          {etapes.map((e) => (
            <li key={e.n} className={e.etat === "en_cours" ? "parcours-actuelle" : e.etat === "faite" ? "parcours-faite" : "parcours-a-venir"}>
              <span className="parcours-etape" aria-current={e.etat === "en_cours" ? "step" : undefined}>
                <span className="parcours-n" aria-hidden="true">{e.n}</span>
                {e.libelle}
                {e.etat === "faite" && <span className="sr-only"> (faite)</span>}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <p className="labo-sauvegarde" role="status">{libelleSauvegarde(connecte, sync)}</p>
    </div>
  );
}
