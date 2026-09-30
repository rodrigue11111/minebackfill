// « À surveiller » : les alertes de la classe, groupées par étudiant.

import { useState } from "react";
import { LIBELLES_ALERTES, libellesSeuils, type Alerte } from "@/lib/classe-alertes";
import { Carte } from "@/components/ui/Carte";
import { lienBouton, type RefDoc } from "./commun";

const VISIBLES = 12;

export default function CarteAlertes({ alertes, onOuvrir }: { alertes: Alerte[]; onOuvrir: (ref: RefDoc) => void }) {
  const [tout, setTout] = useState(false);
  const affichees = tout ? alertes : alertes.slice(0, VISIBLES);
  const parEtudiant = new Map<string, Alerte[]>();
  for (const a of affichees) parEtudiant.set(a.etudiantId, [...(parEtudiant.get(a.etudiantId) ?? []), a]);

  return (
    <Carte titre={`À surveiller (${alertes.length})`} aria-label="À surveiller" className="classe-alertes">
      {alertes.length === 0 ? (
        <p className="classe-rien">Rien à signaler selon les seuils ci-dessous.</p>
      ) : (
        <div className="classe-alertes-liste">
          {[...parEtudiant.values()].map((liste) => (
            <div key={liste[0].etudiantId} className="classe-alertes-etudiant">
              <div className="classe-alertes-nom">{liste[0].etudiant}</div>
              <ul>
                {liste.map((a) => (
                  <li key={a.cle}>
                    <span className="ui-point ui-point-danger" aria-hidden="true" />
                    <span>
                      <strong>{LIBELLES_ALERTES[a.type]}</strong>
                      {a.cible && <> · {a.cible.code}</>} — {a.message}{" "}
                      {a.cible && (
                        <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: a.etudiantId, kind: a.cible!.kind, id: a.cible!.id })}>Ouvrir</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {alertes.length > VISIBLES && (
            <button type="button" style={{ ...lienBouton, alignSelf: "flex-start" }} onClick={() => setTout(!tout)}>
              {tout ? "Réduire" : `Tout afficher (${alertes.length})`}
            </button>
          )}
        </div>
      )}
      <details className="classe-seuils">
        <summary>Seuils utilisés (valeurs par défaut, à valider par l&apos;enseignant)</summary>
        <ul>
          {libellesSeuils().map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p>Seuls les essais valides comptent ; les copies de conflit sont ignorées.</p>
      </details>
    </Carte>
  );
}
