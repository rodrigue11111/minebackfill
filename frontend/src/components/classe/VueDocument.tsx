// Un document d'étudiant ouvert EN ENTIER (lecture seule), avec ses
// commentaires. Remplace le contenu de l'onglet ; « Retour » ramène à la classe.

import type { SavedResult } from "@/lib/store";
import type { UnitPreferences } from "@/lib/units";
import { normaliserGachee, type EtudiantClasse } from "@/lib/classe";
import type { DocComplet, LigneAnnotation } from "@/lib/classe-reseau";
import GacheeLecture from "./GacheeLecture";
import ResultatLecture from "./ResultatLecture";
import FilCommentaires from "./FilCommentaires";
import type { NouvelleAnnotation } from "./DetailEtudiant";
import { dateCourte, dateHeure, Pastille, type RefDoc } from "./commun";

export type EtatDoc =
  | { ref: RefDoc; etat: "chargement" }
  | { ref: RefDoc; etat: "pret"; doc: DocComplet }
  | { ref: RefDoc; etat: "absent" }
  | { ref: RefDoc; etat: "erreur"; message: string };

export default function VueDocument({ doc, etudiant, annotations, onAnnoter, onRetirer, onRetour, maintenant, units }: {
  doc: EtatDoc;
  etudiant: EtudiantClasse | undefined;
  annotations: LigneAnnotation[];
  onAnnoter: (a: NouvelleAnnotation) => Promise<void>;
  onRetirer: (id: string) => Promise<void>;
  onRetour: () => void;
  maintenant: Date;
  units: UnitPreferences;
}) {
  const { ref } = doc;
  const contenu = doc.etat === "pret" && !doc.doc.supprime ? doc.doc.contenu : null;
  const gachee = contenu && ref.kind === "gachee" ? normaliserGachee(contenu) : null;
  const resultat = contenu && ref.kind === "resultat" ? (contenu as SavedResult) : null;
  const titre = gachee ? gachee.code : resultat ? resultat.label : ref.kind === "gachee" ? "Gâchée" : "Résultat";
  const conflit = gachee?.conflit ?? resultat?.conflit;
  const commentaires = annotations.filter((a) => a.owner_id === ref.etudiantId && a.target_kind === ref.kind && a.target_id === ref.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={onRetour}>← Retour à la classe</button>
      </div>
      <div className="form-card">
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {ref.kind === "gachee" ? "Gâchée" : "Résultat sauvegardé"} de {etudiant?.nom ?? "l’étudiant"} · lecture seule
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 6px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {titre}
          {conflit && <Pastille ton="ambre" title={`Copie de conflit du ${dateCourte(conflit.le)}`}>copie de conflit</Pastille>}
          {gachee && <Pastille ton={gachee.statut === "terminee" ? "vert" : "gris"}>{gachee.statut === "terminee" ? "terminée" : "brouillon"}</Pastille>}
        </h2>
        <div style={{ fontSize: 12.5, color: "#64748b" }}>
          {gachee && <>Créée le {dateCourte(gachee.creeLe)} · </>}
          {resultat && <>Sauvegardé le {dateCourte(resultat.savedAt)} · </>}
          {doc.etat === "pret" && <>version en ligne du {dateHeure(doc.doc.maj)}</>}
        </div>
      </div>

      {doc.etat === "chargement" && <p style={{ fontSize: 13, color: "#64748b" }}>Lecture du document…</p>}
      {doc.etat === "erreur" && (
        <p role="alert" style={{ fontSize: 13, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
          Lecture impossible : {doc.message}.
        </p>
      )}
      {(doc.etat === "absent" || (doc.etat === "pret" && doc.doc.supprime)) && (
        <p style={{ fontSize: 13, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
          Ce document n&apos;existe plus en ligne : l&apos;étudiant l&apos;a supprimé.
        </p>
      )}

      {gachee && (
        <GacheeLecture gachee={gachee} maintenant={maintenant}
          formulations={(etudiant?.resultats ?? []).map((r) => ({ id: r.id, recipes: r.recipes ?? [] }))} />
      )}
      {resultat && <ResultatLecture resultat={resultat} units={units} />}

      {contenu !== null && (
        <div className="form-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Commentaires</h3>
          <FilCommentaires liste={commentaires} onRetirer={onRetirer}
            ancres={gachee ? gachee.eprouvettes.map((e) => e.code) : []}
            onAjouter={(texte, ancre) => onAnnoter({ kind: ref.kind, id: ref.id, rev: doc.etat === "pret" ? doc.doc.rev : null, ancre, texte })} />
        </div>
      )}
    </div>
  );
}
