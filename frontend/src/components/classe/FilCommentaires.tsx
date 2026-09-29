// Fil de commentaires sur un document d'étudiant, côté enseignant : ses
// commentaires (avec « vu le … » quand l'étudiant les a lus) et les réponses
// de l'étudiant (en évidence tant qu'elles étaient nouvelles à l'ouverture).

import { useState } from "react";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { dateHeure } from "./commun";

export default function FilCommentaires({ liste, moi, nomEtudiant, nouvelles, onAjouter, onRetirer, ancres }: {
  liste: LigneAnnotation[];
  /** Id de l'enseignant connecté : « Retirer » n'apparaît que sur SES messages. */
  moi: string;
  nomEtudiant: string;
  /** Réponses non lues à l'ouverture de la page : gardées en évidence pendant la visite. */
  nouvelles: Set<string>;
  /** Rend vrai si le commentaire est enregistré (sinon le texte reste dans le champ). */
  onAjouter: (texte: string, ancre: string | null) => Promise<boolean>;
  onRetirer: (id: string) => Promise<void>;
  ancres: string[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [ancre, setAncre] = useState("");
  const [occupe, setOccupe] = useState(false);
  const fil = [...liste].sort((a, b) => (a.created_at ?? a.updated_at).localeCompare(b.created_at ?? b.updated_at));

  return (
    <div style={{ marginTop: 8 }}>
      {fil.map((a) => {
        const reponse = estReponse(a);
        const nouvelle = reponse && nouvelles.has(a.id);
        const auteur = reponse ? nomEtudiant : a.auteur_id === moi ? "Vous" : "Autre enseignant";
        return (
          <div key={a.id} style={{
            fontSize: 12.5, borderRadius: 6, padding: "6px 9px", marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8,
            color: reponse ? "#0f172a" : "#3730a3",
            background: reponse ? (nouvelle ? "#fffbeb" : "#fff") : "#eef2ff",
            border: reponse ? `1px solid ${nouvelle ? "#fcd34d" : "#e2e8f0"}` : "1px solid transparent",
            marginLeft: reponse ? 18 : 0,
          }}>
            <span style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: reponse ? "#475569" : "#4338ca" }}>
                {auteur}{nouvelle && <span style={{ color: "#b45309" }}> · nouvelle réponse</span>}
              </span>
              {a.ancre ? <strong>{a.ancre} — </strong> : null}{a.texte}
              <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {dateHeure(a.created_at ?? a.updated_at)}
                {!reponse && a.lu_le !== undefined && (a.lu_le ? ` · vu par l'étudiant le ${dateHeure(a.lu_le)}` : " · pas encore vu")}
              </span>
            </span>
            {!reponse && a.auteur_id === moi && (
              <button type="button" onClick={() => void onRetirer(a.id)}
                style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12, flexShrink: 0, alignSelf: "flex-start" }}>
                Retirer
              </button>
            )}
          </div>
        );
      })}
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
            placeholder="Votre commentaire (visible par cet étudiant seulement ; il pourra y répondre)"
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} disabled={occupe || !texte.trim()}
              onClick={async () => {
                setOccupe(true);
                const ok = await onAjouter(texte.trim(), ancre || null);
                setOccupe(false);
                // En cas d'échec, le texte reste : rien n'est perdu.
                if (ok) { setTexte(""); setAncre(""); setOuvert(false); }
              }}>
              {occupe ? "…" : "Publier le commentaire"}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
