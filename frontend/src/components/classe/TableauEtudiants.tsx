// Tableau des étudiants de la classe (onglet « Étudiants »).

import type { EtudiantClasse } from "@/lib/classe";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { dateCourte, th } from "./commun";

export default function TableauEtudiants({ etudiants, annotations, selId, onChoisir, couleurDe, alertesParEtudiant }: {
  etudiants: EtudiantClasse[];
  alertesParEtudiant: Map<string, number>;
  annotations: LigneAnnotation[];
  selId: string | null;
  onChoisir: (id: string | null) => void;
  couleurDe: Map<string, string>;
}) {
  const colonnes = ["Étudiant", "Résultats", "Gâchées", "Essais valides", "Alertes", "Dernière activité", "Commentaires"];
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
        <thead>
          <tr>
            {colonnes.map((t) => (
              <th key={t} style={{ ...th, padding: "10px 12px", fontSize: 11.5 }}
                title={t === "Essais valides" ? "Éprouvettes écrasées, mesurées, non exclues ; copies de conflit non comptées" : undefined}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etudiants.length === 0 ? (
            <tr><td colSpan={colonnes.length} style={{ padding: 16, color: "#94a3b8" }}>Aucun compte étudiant pour l&apos;instant.</td></tr>
          ) : etudiants.map((e) => {
            const siens = annotations.filter((a) => a.owner_id === e.id);
            const nbNonLues = siens.filter((a) => estReponse(a) && !a.lu_le).length;
            const copies = e.gachees.filter((g) => g.conflit).length;
            const actif = e.id === selId;
            return (
              <tr key={e.id} onClick={() => onChoisir(actif ? null : e.id)}
                style={{ cursor: "pointer", background: actif ? "#eff6ff" : undefined, borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "9px 12px", fontWeight: 600 }}>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: couleurDe.get(e.id), marginRight: 8 }} />
                  {e.nom}
                  {e.email && e.email !== e.nom && <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {e.email}</span>}
                </td>
                <td style={{ padding: "9px 12px" }}>{e.resultats.length}</td>
                <td style={{ padding: "9px 12px" }}>
                  {e.gachees.length - copies}
                  {copies > 0 && <span style={{ color: "#92400e", fontSize: 12 }}> (+{copies} copie{copies > 1 ? "s" : ""} de conflit)</span>}
                </td>
                <td style={{ padding: "9px 12px" }}>{e.nbEssais}</td>
                <td style={{ padding: "9px 12px", color: alertesParEtudiant.get(e.id) ? "#b45309" : undefined, fontWeight: alertesParEtudiant.get(e.id) ? 700 : 400 }}>
                  {alertesParEtudiant.get(e.id) || "—"}
                </td>
                <td style={{ padding: "9px 12px" }}>{dateCourte(e.derniereActivite)}</td>
                <td style={{ padding: "9px 12px" }}>
                  {siens.length || "—"}
                  {nbNonLues > 0 && <span style={{ color: "#b45309", fontWeight: 700 }}> · {nbNonLues} réponse{nbNonLues > 1 ? "s" : ""} non lue{nbNonLues > 1 ? "s" : ""}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
