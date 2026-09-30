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
            fontSize: 14, lineHeight: 1.45, borderRadius: 14, padding: "10px 14px", marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8,
            color: "var(--texte)",
            background: reponse ? (nouvelle ? "var(--alerte-pale)" : "var(--accent-pale)") : "var(--fond)",
            marginLeft: reponse ? 24 : 0,
          }}>
            <span style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                {auteur}{nouvelle && <span style={{ color: "var(--alerte-texte)" }}> · nouvelle réponse</span>}
              </span>
              {a.ancre ? <strong>{a.ancre} — </strong> : null}{a.texte}
              <span style={{ display: "block", fontSize: 12.5, color: "var(--texte-2)", marginTop: 3 }}>
                {dateHeure(a.created_at ?? a.updated_at)}
                {!reponse && a.lu_le !== undefined && (a.lu_le ? ` · vu par l'étudiant le ${dateHeure(a.lu_le)}` : " · pas encore vu")}
              </span>
            </span>
            {!reponse && a.auteur_id === moi && (
              <button type="button" onClick={() => void onRetirer(a.id)}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontFamily: "inherit", flexShrink: 0, alignSelf: "flex-start" }}>
                Retirer
              </button>
            )}
          </div>
        );
      })}
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)}
          className="btn-discret" style={{ marginTop: 8 }}>
          + Commenter
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {ancres.length > 0 && (
            <select value={ancre} onChange={(e) => setAncre(e.target.value)} aria-label="Endroit visé par le commentaire"
              className="field-input" style={{ alignSelf: "flex-start", width: "auto", minHeight: 36, padding: "4px 34px 4px 12px", fontSize: 14 }}>
              <option value="">Toute la gâchée (fil général)</option>
              {ancres.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} rows={3}
            placeholder="Votre commentaire (visible par cet étudiant seulement ; il pourra y répondre)"
            className="field-input" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" disabled={occupe || !texte.trim()}
              onClick={async () => {
                setOccupe(true);
                const ok = await onAjouter(texte.trim(), ancre || null);
                setOccupe(false);
                // En cas d'échec, le texte reste : rien n'est perdu.
                if (ok) { setTexte(""); setAncre(""); setOuvert(false); }
              }}>
              {occupe ? "…" : "Publier le commentaire"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
