// « À surveiller » : les alertes de la classe, groupées par étudiant.

import { useState } from "react";
import { LIBELLES_ALERTES, libellesSeuils, type Alerte } from "@/lib/classe-alertes";
import { lienBouton, type RefDoc } from "./commun";

const VISIBLES = 12;

export default function CarteAlertes({ alertes, onOuvrir }: { alertes: Alerte[]; onOuvrir: (ref: RefDoc) => void }) {
  const [tout, setTout] = useState(false);
  const affichees = tout ? alertes : alertes.slice(0, VISIBLES);
  const parEtudiant = new Map<string, Alerte[]>();
  for (const a of affichees) parEtudiant.set(a.etudiantId, [...(parEtudiant.get(a.etudiantId) ?? []), a]);

  return (
    <div className="form-card" style={{ borderLeft: `4px solid ${alertes.length > 0 ? "#d97706" : "#16a34a"}` }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>À surveiller ({alertes.length})</h2>
      {alertes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#166534", margin: 0 }}>Rien à signaler selon les seuils ci-dessous.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...parEtudiant.values()].map((liste) => (
            <div key={liste[0].etudiantId}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>{liste[0].etudiant}</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                {liste.map((a) => (
                  <li key={a.cle} style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.45 }}>
                    <strong style={{ color: "#92400e" }}>{LIBELLES_ALERTES[a.type]}</strong>
                    {a.cible && <> · {a.cible.code}</>} — {a.message}{" "}
                    {a.cible && (
                      <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: a.etudiantId, kind: a.cible!.kind, id: a.cible!.id })}>Ouvrir</button>
                    )}
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
      <details style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
        <summary style={{ cursor: "pointer" }}>Seuils utilisés (valeurs par défaut, à valider par l&apos;enseignant)</summary>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
          {libellesSeuils().map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p style={{ margin: "6px 0 0" }}>Seuls les essais valides comptent ; les copies de conflit sont ignorées.</p>
      </details>
    </div>
  );
}
