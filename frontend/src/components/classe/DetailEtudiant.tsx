// Détail d'un étudiant : ses calculs, chacun avec les gâchées qui en sont
// tirées, à ouvrir en entier.
//
// 2026-10-26 (demandes de l'utilisateur) :
//  - la fiche est rangée PAR CALCUL (lib/classe-detail.ts) : avec plusieurs
//    recettes et gâchées, l'enseignant ne fait plus lui-même le lien entre une
//    gâchée et son calcul ; chaque calcul est un bloc repliable, ouvert
//    d'emblée s'il demande une action (gâchée « À examiner » ou « À
//    réexaminer », réponse non lue) ;
//  - on ne commente plus d'ici : sans la gâchée sous les yeux, une ancre
//    « E01 » ou « Pesée : Liant » ne disait rien, ni la valeur pesée ni la
//    mesure. Chaque document affiche ses commentaires (nombre, réponses non
//    lues) ; « Ouvrir » mène au document entier, où le fil complet, avec ses
//    ancres, se lit et se nourrit (VueDocument).

import { useState } from "react";
import { agregerParAge } from "@/lib/eprouvette";
import { essaiValide, type EtudiantClasse } from "@/lib/classe";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { methodLabel } from "@/lib/method-registry";
import { regrouperParCalcul } from "@/lib/classe-detail";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icones";
import { dateCourte, lienBouton, Pastille, td, th, tdNum, type RefDoc } from "./commun";
import { aideEtatRevue, aRevoir, etatRevue, LIBELLE_DECISION, LIBELLE_ETAT_REVUE, type InfoRevue } from "@/lib/revues";
import type { Gachee } from "@/lib/gachee";
import type { SavedResult } from "@/lib/store";

export type NouvelleAnnotation = { kind: "resultat" | "gachee"; id: string; rev: number | null; ancre: string | null; texte: string };

/** Ce que le fil de commentaires de l'enseignant doit savoir (document ouvert, VueDocument). */
export interface ContexteFil {
  moi: string;
  nouvelles: Set<string>;
  /** Réponses d'étudiants affichées : accusé de lecture. */
  onLire: (ids: string[]) => void;
  onRetirer: (id: string) => Promise<void>;
}

/** Réponses d'étudiants pas encore lues dans une liste d'annotations. */
export const reponsesNonLues = (liste: LigneAnnotation[]): string[] =>
  liste.filter((a) => estReponse(a) && !a.lu_le).map((a) => a.id);

/**
 * État de revue d'une gâchée dans la liste de l'enseignant (même règle que la
 * tuile « Gâchées à examiner »). 2026-10-29 : « À examiner » (jamais décidée)
 * et « À réexaminer » (modifiée depuis la décision), au lieu d'« À revoir »,
 * avec une infobulle qui dit pourquoi.
 */
export function PastilleRevue({ gachee, info }: { gachee: EtudiantClasse["gachees"][number]; info: InfoRevue | undefined }) {
  const etat = etatRevue(gachee, info);
  const pastilleEtat = etat ? <> <Pastille ton={etat === "a_reexaminer" ? "ambre" : "bleu"} title={aideEtatRevue(etat, info)}>{LIBELLE_ETAT_REVUE[etat]}</Pastille></> : null;
  if (info) {
    return (
      <>
        {" "}<Pastille ton={info.decision === "acceptee" ? "vert" : "rouge"} title={info.motif ?? undefined}>Revue : {LIBELLE_DECISION[info.decision]}</Pastille>
        {pastilleEtat}
      </>
    );
  }
  return pastilleEtat;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** « 2 commentaires · 1 nouvelle réponse » : un clic ouvre le document, où le fil se lit en entier. */
function Commentaires({ liste, onOuvrir }: { liste: LigneAnnotation[]; onOuvrir: () => void }) {
  if (liste.length === 0) return <span style={{ color: "var(--texte-2)" }}>aucun</span>;
  const nouvelles = reponsesNonLues(liste).length;
  return (
    <button type="button" style={{ ...lienBouton, color: nouvelles > 0 ? "var(--alerte-texte)" : "var(--accent)", fontWeight: nouvelles > 0 ? 600 : 500, textAlign: "left" }}
      onClick={onOuvrir} title="Ouvrir le document pour lire et répondre">
      {pluriel(liste.length, "commentaire")}
      {nouvelles > 0 ? ` · ${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""} réponse${nouvelles > 1 ? "s" : ""}` : ""}
    </button>
  );
}

/** Bloc repliable de la fiche (un calcul, ou un groupe à part). */
function Bloc({ ouvert, onBasculer, titre, detail, aside, children }: {
  ouvert: boolean;
  onBasculer: () => void;
  titre: React.ReactNode;
  detail?: React.ReactNode;
  /** À droite de l'en-tête (« Ouvrir le calcul ») : hors du bouton qui replie. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="classe-bloc">
      <div className="classe-bloc-tete">
        <button type="button" className="classe-bloc-bascule" aria-expanded={ouvert} onClick={onBasculer}>
          <span className="ui-ligne-chevron" style={{ transform: ouvert ? "rotate(90deg)" : undefined }}><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
          <span className="classe-bloc-titre">{titre}</span>
          {detail && <span className="classe-bloc-detail">{detail}</span>}
        </button>
        {aside}
      </div>
      {ouvert && <div className="classe-bloc-corps">{children}</div>}
    </section>
  );
}

export default function DetailEtudiant({ etudiant, annotations, onOuvrir, onRapport, revueDe }: {
  etudiant: EtudiantClasse;
  annotations: LigneAnnotation[];
  onOuvrir: (ref: RefDoc) => void;
  /** Rapport PDF de cet étudiant. */
  onRapport?: () => void;
  /** Revue d'une gâchée de cet étudiant (absent : base pas à jour, rien n'est affiché). */
  revueDe?: (gacheeId: string) => InfoRevue | undefined;
}) {
  const [choix, setChoix] = useState<Record<string, boolean>>({});
  const fiche = regrouperParCalcul(etudiant);
  const fil = (kind: "resultat" | "gachee", id: string) =>
    annotations.filter((a) => a.owner_id === etudiant.id && a.target_kind === kind && a.target_id === id);
  const ouvrir = (kind: "resultat" | "gachee", id: string) => () => onOuvrir({ etudiantId: etudiant.id, kind, id });
  const aRevoirIci = (g: Gachee) => (revueDe ? aRevoir(g, revueDe(g.id)) : false);
  const nonLues = (kind: "resultat" | "gachee", id: string) => reponsesNonLues(fil(kind, id)).length;

  const nbGroupes = fiche.blocs.length + (fiche.calculsSansGachee.length > 0 ? 1 : 0) + (fiche.gacheesSansCalcul.length > 0 ? 1 : 0);
  const demandeAction = (gachees: Gachee[], resultat?: SavedResult) =>
    gachees.some((g) => aRevoirIci(g) || nonLues("gachee", g.id) > 0) || (resultat ? nonLues("resultat", resultat.id) > 0 : false);
  const ouvert = (cle: string, parDefaut: boolean) => choix[cle] ?? (nbGroupes === 1 || parDefaut);
  const basculer = (cle: string, actuel: boolean) => () => setChoix((c) => ({ ...c, [cle]: !actuel }));

  const nbARevoir = etudiant.gachees.filter(aRevoirIci).length;
  const nbNonLues = reponsesNonLues(annotations.filter((a) => a.owner_id === etudiant.id)).length;
  const synthese = [
    pluriel(etudiant.resultats.length, "calcul"),
    pluriel(etudiant.gachees.length, "gâchée"),
    revueDe && nbARevoir > 0 ? `${nbARevoir} à examiner` : null,
    nbNonLues > 0 ? `${nbNonLues} réponse${nbNonLues > 1 ? "s" : ""} non lue${nbNonLues > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  const tableGachees = (gachees: Gachee[], avecCalcul: boolean) => (
    <div className="classe-tableau-bloc">
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>
            <th style={th}>Gâchée</th>
            {avecCalcul && <th style={th}>Calcul</th>}
            <th style={th}>Recette</th>
            <th style={th}>Revue</th>
            <th style={{ ...th, textAlign: "right" }}>Essais valides</th>
            <th style={th}>UCS moyenne par âge</th>
            <th style={th}>Commentaires</th>
            <th style={th}><span className="sr-only">Ouvrir</span></th>
          </tr>
        </thead>
        <tbody>
          {gachees.map((g) => {
            const parAge = agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null);
            const valides = g.eprouvettes.filter(essaiValide).length;
            return (
              <tr key={g.id}>
                <td style={td}>
                  <strong>{g.code}</strong>
                  <div style={{ fontSize: 12.5, color: "var(--texte-2)" }}>{dateCourte(g.creeLe)} · {g.categorie}</div>
                  {g.conflit && <Pastille ton="ambre">copie de conflit</Pastille>}
                </td>
                {avecCalcul && <td style={td}>{g.formulationLabel || "Sans nom"}</td>}
                <td style={tdNum}>{(g.recetteIndex ?? 0) + 1}</td>
                <td style={td}>{revueDe ? <PastilleRevue gachee={g} info={revueDe(g.id)} /> : null}</td>
                <td style={tdNum}>{valides}/{g.eprouvettes.length}</td>
                <td style={td}>
                  {parAge.length === 0 ? <span style={{ color: "var(--texte-2)" }}>aucun essai</span> : (
                    <span className="classe-ucs-ages">
                      {parAge.map((a) => (
                        <span key={a.ageJours} className="classe-ucs-age" title={a.nHorsFenetre > 0 ? `${a.nHorsFenetre} écrasée(s) hors de la fenêtre d'âge` : undefined}>
                          {a.ageJours} j : {Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")} kPa (n={a.n})
                          {a.nHorsFenetre > 0 && <span style={{ color: "var(--alerte-texte)" }}> · {a.nHorsFenetre} hors fenêtre</span>}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td style={td}><Commentaires liste={fil("gachee", g.id)} onOuvrir={ouvrir("gachee", g.id)} /></td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button type="button" style={lienBouton} onClick={ouvrir("gachee", g.id)} aria-label={`Ouvrir la gâchée ${g.code}`}>Ouvrir</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const titreCalcul = (r: SavedResult) => (
    <>
      <strong>{r.label}</strong>
      <span style={{ fontWeight: 400, color: "var(--texte-2)" }}> · {r.category} · {methodLabel(r.category, r.method)} · {pluriel((r.recipes ?? []).length, "recette")} · {dateCourte(r.savedAt)}</span>
      {r.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
    </>
  );

  return (
    <Carte titre={etudiant.nom} aria-label={`Détail de ${etudiant.nom}`}
      actions={onRapport ? <button type="button" className="btn-secondary" onClick={onRapport}>Rapport PDF</button> : undefined}>
      <p className="classe-synthese">{synthese}</p>
      {nbGroupes === 0 && <p className="classe-rien">Aucun calcul ni gâchée.</p>}

      {fiche.blocs.map((b) => {
        const cle = `calcul:${b.resultat.id}`;
        const o = ouvert(cle, demandeAction(b.gachees, b.resultat));
        const aRevoirBloc = b.gachees.filter(aRevoirIci).length;
        return (
          <Bloc key={cle} ouvert={o} onBasculer={basculer(cle, o)}
            titre={titreCalcul(b.resultat)}
            detail={<>
              {pluriel(b.gachees.length, "gâchée")}
              {aRevoirBloc > 0 && <> <Pastille ton="bleu">{aRevoirBloc} à examiner</Pastille></>}
            </>}
            aside={
              <span className="classe-bloc-actions">
                <Commentaires liste={fil("resultat", b.resultat.id)} onOuvrir={ouvrir("resultat", b.resultat.id)} />
                <button type="button" style={lienBouton} onClick={ouvrir("resultat", b.resultat.id)}>Ouvrir le calcul</button>
              </span>
            }>
            {tableGachees(b.gachees, false)}
          </Bloc>
        );
      })}

      {fiche.calculsSansGachee.length > 0 && (() => {
        const cle = "calculs-sans-gachee";
        const o = ouvert(cle, fiche.calculsSansGachee.some((r) => nonLues("resultat", r.id) > 0));
        return (
          <Bloc ouvert={o} onBasculer={basculer(cle, o)} titre={<strong>Calculs sans gâchée ({fiche.calculsSansGachee.length})</strong>}>
            <div className="classe-documents">
              {fiche.calculsSansGachee.map((r) => (
                <div key={r.id} className="classe-document classe-document-ligne">
                  <span>{titreCalcul(r)}</span>
                  <span className="classe-bloc-actions">
                    <Commentaires liste={fil("resultat", r.id)} onOuvrir={ouvrir("resultat", r.id)} />
                    <button type="button" style={lienBouton} onClick={ouvrir("resultat", r.id)}>Ouvrir</button>
                  </span>
                </div>
              ))}
            </div>
          </Bloc>
        );
      })()}

      {fiche.gacheesSansCalcul.length > 0 && (() => {
        const cle = "gachees-sans-calcul";
        const o = ouvert(cle, demandeAction(fiche.gacheesSansCalcul));
        return (
          <Bloc ouvert={o} onBasculer={basculer(cle, o)}
            titre={<strong>Gâchées sans calcul retrouvé ({fiche.gacheesSansCalcul.length})</strong>}
            detail="calcul d'une autre session, supprimé, ou sans lien">
            {tableGachees(fiche.gacheesSansCalcul, true)}
          </Bloc>
        );
      })()}
    </Carte>
  );
}
