// Tableau des étudiants de la classe (onglet « Étudiants ») : une ligne par
// étudiant, un chevron ; la ligne choisie ouvre son détail dessous.

import type { EtudiantClasse } from "@/lib/classe";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icones";
import { dateCourte } from "./commun";
import { TIRET } from "@/lib/format";

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
    <Carte titre="Étudiants" aside={`${etudiants.length}`} sansMarge aria-label="Étudiants">
      <div className="classe-tableau">
        <table className="result-table classe-table">
          <thead>
            <tr>
              {colonnes.map((t) => (
                <th key={t} scope="col"
                  title={t === "Essais valides" ? "Éprouvettes écrasées, mesurées, non exclues ; copies de conflit non comptées" : undefined}>{t}</th>
              ))}
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {etudiants.length === 0 ? (
              <tr><td colSpan={colonnes.length + 1} className="classe-rien">Aucun compte étudiant pour l&apos;instant.</td></tr>
            ) : etudiants.map((e) => {
              const siens = annotations.filter((a) => a.owner_id === e.id);
              const nbNonLues = siens.filter((a) => estReponse(a) && !a.lu_le).length;
              const copies = e.gachees.filter((g) => g.conflit).length;
              const actif = e.id === selId;
              return (
                <tr key={e.id} onClick={() => onChoisir(actif ? null : e.id)} aria-selected={actif}
                  className={actif ? "classe-ligne classe-ligne-active" : "classe-ligne"}>
                  <td className="classe-nom">
                    <span className="classe-pastille-couleur" style={{ background: couleurDe.get(e.id) }} />
                    {e.nom}
                    {e.email && e.email !== e.nom && <span className="classe-courriel">{e.email}</span>}
                  </td>
                  <td>{e.resultats.length}</td>
                  <td>
                    {e.gachees.length - copies}
                    {copies > 0 && <span className="classe-note-alerte"> (+{copies} copie{copies > 1 ? "s" : ""} de conflit)</span>}
                  </td>
                  <td>{e.nbEssais}</td>
                  <td className={alertesParEtudiant.get(e.id) ? "classe-alerte" : undefined}>
                    {alertesParEtudiant.get(e.id) || TIRET}
                  </td>
                  <td>{dateCourte(e.derniereActivite)}</td>
                  <td>
                    {siens.length || TIRET}
                    {nbNonLues > 0 && <span className="classe-note-alerte"> · {nbNonLues} réponse{nbNonLues > 1 ? "s" : ""} non lue{nbNonLues > 1 ? "s" : ""}</span>}
                  </td>
                  <td className="classe-chevron" aria-hidden="true">
                    <span style={{ display: "inline-flex", transform: actif ? "rotate(90deg)" : undefined }}><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}
