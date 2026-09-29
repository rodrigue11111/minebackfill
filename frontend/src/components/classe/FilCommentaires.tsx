// Commentaires de l'enseignant sur un document d'étudiant.

import { useState } from "react";
import type { LigneAnnotation } from "@/lib/classe-reseau";

export default function FilCommentaires({ liste, onAjouter, onRetirer, ancres }: {
  liste: LigneAnnotation[];
  onAjouter: (texte: string, ancre: string | null) => Promise<void>;
  onRetirer: (id: string) => Promise<void>;
  ancres: string[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [ancre, setAncre] = useState("");
  const [occupe, setOccupe] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      {liste.map((a) => (
        <div key={a.id} style={{ fontSize: 12.5, color: "#3730a3", background: "#eef2ff", borderRadius: 6, padding: "6px 9px", marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{a.ancre ? <strong>{a.ancre} — </strong> : null}{a.texte}</span>
          <button type="button" onClick={() => void onRetirer(a.id)}
            style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
            Retirer
          </button>
        </div>
      ))}
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)}
          style={{ marginTop: 6, background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 12.5, padding: 0 }}>
          + Commenter
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {ancres.length > 0 && (
            <select value={ancre} onChange={(e) => setAncre(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5, alignSelf: "flex-start" }}>
              <option value="">Toute la gâchée</option>
              {ancres.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} rows={3}
            placeholder="Votre commentaire (visible par cet étudiant seulement)"
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} disabled={occupe || !texte.trim()}
              onClick={async () => {
                setOccupe(true);
                await onAjouter(texte.trim(), ancre || null);
                setOccupe(false);
                setTexte(""); setAncre(""); setOuvert(false);
              }}>
              {occupe ? "…" : "Publier le commentaire"}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => { setOuvert(false); setTexte(""); }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
