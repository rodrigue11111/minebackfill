// Un document d'étudiant ouvert EN ENTIER (lecture seule), avec ses
// commentaires. Remplace le contenu de l'onglet ; « Retour » ramène à la classe.

import type { SavedResult } from "@/lib/store";
import { ancresGachee } from "@/lib/ancres";
import type { UnitPreferences } from "@/lib/units";
import { normaliserGachee, type EtudiantClasse } from "@/lib/classe";
import type { DocComplet, LigneAnnotation } from "@/lib/classe-reseau";
import GacheeLecture, { type CatalogueEnseignant } from "./GacheeLecture";
import CarteRevue, { type ActionsRevue } from "./CarteRevue";
import { revuePerimee, type RevueClasse } from "@/lib/revues";
import ResultatLecture from "./ResultatLecture";
import FilCommentaires from "./FilCommentaires";
import { EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import type { ContexteFil, NouvelleAnnotation } from "./DetailEtudiant";
import { dateCourte, dateHeure, Pastille, type RefDoc } from "./commun";

export type EtatDoc =
  | { ref: RefDoc; etat: "chargement" }
  | { ref: RefDoc; etat: "pret"; doc: DocComplet }
  | { ref: RefDoc; etat: "absent" }
  | { ref: RefDoc; etat: "erreur"; message: string };

export default function VueDocument({ doc, etudiant, annotations, onAnnoter, ctx, onRetour, maintenant, units, catalogue, revue, actionsRevue }: {
  doc: EtatDoc;
  etudiant: EtudiantClasse | undefined;
  annotations: LigneAnnotation[];
  onAnnoter: (a: NouvelleAnnotation) => Promise<boolean>;
  /** Les réponses de ce document sont marquées lues à l'ouverture (par la page). */
  ctx: ContexteFil;
  onRetour: () => void;
  maintenant: Date;
  units: UnitPreferences;
  /** Catalogue de l'enseignant (ajout d'un matériau au catalogue officiel). */
  catalogue?: CatalogueEnseignant;
  /** Revue de cette gâchée (décision de l'enseignant), et ses actions. */
  revue?: RevueClasse;
  actionsRevue?: ActionsRevue;
}) {
  const { ref } = doc;
  const contenu = doc.etat === "pret" && !doc.doc.supprime ? doc.doc.contenu : null;
  const gachee = contenu && ref.kind === "gachee" ? normaliserGachee(contenu) : null;
  const resultat = contenu && ref.kind === "resultat" ? (contenu as SavedResult) : null;
  const titre = gachee ? gachee.code : resultat ? resultat.label : ref.kind === "gachee" ? "Gâchée" : "Résultat";
  const conflit = gachee?.conflit ?? resultat?.conflit;
  const commentaires = annotations.filter((a) => a.owner_id === ref.etudiantId && a.target_kind === ref.kind && a.target_id === ref.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <EnTetePage
        retour={{ onClick: onRetour, libelle: "Retour à la classe" }}
        taille="moyen"
        surtitre={`${ref.kind === "gachee" ? "Gâchée" : "Résultat sauvegardé"} de ${etudiant?.nom ?? "l’étudiant"} · lecture seule`}
        titre={titre}
        pastille={<>
          {conflit && <Pastille ton="ambre" title={`Copie de conflit du ${dateCourte(conflit.le)}`}>copie de conflit</Pastille>}
          {gachee && <Pastille ton={gachee.statut === "terminee" ? "vert" : "gris"}>{gachee.statut === "terminee" ? "terminée" : "brouillon"}</Pastille>}
        </>}
        sousTitre={<>
          {gachee && <>Créée le {dateCourte(gachee.creeLe)} · </>}
          {resultat && <>Sauvegardé le {dateCourte(resultat.savedAt)} · </>}
          {doc.etat === "pret" && <>version en ligne du {dateHeure(doc.doc.maj)}</>}
        </>}
      />

      {doc.etat === "chargement" && <p className="classe-rien">Lecture du document…</p>}
      {doc.etat === "erreur" && (
        <Bandeau ton="danger" role="alert">Lecture impossible : {doc.message}.</Bandeau>
      )}
      {(doc.etat === "absent" || (doc.etat === "pret" && doc.doc.supprime)) && (
        <Bandeau ton="neutre">Ce document n&apos;existe plus en ligne : l&apos;étudiant l&apos;a supprimé.</Bandeau>
      )}

      {gachee && (
        <GacheeLecture gachee={gachee} maintenant={maintenant} catalogue={catalogue}
          formulations={(etudiant?.resultats ?? []).map((r) => ({ id: r.id, recipes: r.recipes ?? [] }))} />
      )}
      {gachee && actionsRevue && (
        // « Modifiée depuis la revue » : comparée à la révision du document ouvert.
        <CarteRevue key={gachee.id} gachee={gachee} actions={actionsRevue}
          revue={revue ? { ...revue, perimee: revuePerimee(revue, doc.etat === "pret" ? doc.doc.rev : null) } : undefined} />
      )}
      {resultat && <ResultatLecture resultat={resultat} units={units} />}

      {contenu !== null && (
        <Carte titre="Commentaires" aside="visibles par cet étudiant seulement">
          <FilCommentaires liste={commentaires} moi={ctx.moi} nomEtudiant={etudiant?.nom ?? "Étudiant"} nouvelles={ctx.nouvelles}
            onRetirer={ctx.onRetirer} ancres={gachee ? ancresGachee(gachee) : []}
            onAjouter={(texte, ancre) => onAnnoter({ kind: ref.kind, id: ref.id, rev: doc.etat === "pret" ? doc.doc.rev : null, ancre, texte })} />
        </Carte>
      )}
    </div>
  );
}
