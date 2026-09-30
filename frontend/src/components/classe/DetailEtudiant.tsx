// Détail d'un étudiant : ses documents (à ouvrir en entier) et les
// commentaires de l'enseignant.

import { useState } from "react";
import { agregerParAge } from "@/lib/eprouvette";
import { essaiValide, type EtudiantClasse, type LigneClasse } from "@/lib/classe";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { methodLabel } from "@/lib/method-registry";
import { ancresGachee } from "@/lib/ancres";
import FilCommentaires from "./FilCommentaires";
import { Carte } from "@/components/ui/Carte";
import { dateCourte, lienBouton, Pastille, type RefDoc } from "./commun";

export type NouvelleAnnotation = { kind: "resultat" | "gachee"; id: string; rev: number | null; ancre: string | null; texte: string };

/** Ce que le fil de commentaires de l'enseignant doit savoir. */
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

/** Fil replié d'un document : l'ouvrir marque les réponses lues. */
function FilReplie({ liste, nomEtudiant, ctx, ancres, onAjouter }: {
  liste: LigneAnnotation[];
  nomEtudiant: string;
  ctx: ContexteFil;
  ancres: string[];
  onAjouter: (texte: string, ancre: string | null) => Promise<boolean>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const nouvelles = liste.filter((a) => ctx.nouvelles.has(a.id)).length;
  const basculer = () => {
    if (!ouvert) {
      const ids = reponsesNonLues(liste);
      if (ids.length > 0) ctx.onLire(ids);
    }
    setOuvert(!ouvert);
  };
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" onClick={basculer} aria-expanded={ouvert}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13.5, padding: 0, fontFamily: "inherit", color: nouvelles > 0 ? "var(--alerte-texte)" : "var(--accent)", fontWeight: nouvelles > 0 ? 600 : 500 }}>
        {ouvert ? "▾" : "▸"} Commentaires ({liste.length}{nouvelles > 0 ? ` · ${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""} réponse${nouvelles > 1 ? "s" : ""}` : ""})
      </button>
      {ouvert && (
        <FilCommentaires liste={liste} moi={ctx.moi} nomEtudiant={nomEtudiant} nouvelles={ctx.nouvelles}
          onAjouter={onAjouter} onRetirer={ctx.onRetirer} ancres={ancres} />
      )}
    </div>
  );
}

export function revDe(lignes: LigneClasse[], proprietaire: string, kind: "resultat" | "gachee", id: string): number | null {
  return lignes.find((l) => l.proprietaire === proprietaire && l.kind === kind && l.id === id)?.rev ?? null;
}

export default function DetailEtudiant({ etudiant, annotations, onAnnoter, ctx, lignes, onOuvrir, onRapport }: {
  etudiant: EtudiantClasse;
  annotations: LigneAnnotation[];
  onAnnoter: (a: NouvelleAnnotation) => Promise<boolean>;
  ctx: ContexteFil;
  lignes: LigneClasse[];
  onOuvrir: (ref: RefDoc) => void;
  /** Rapport PDF de cet étudiant. */
  onRapport?: () => void;
}) {
  const commentaires = (kind: "resultat" | "gachee", id: string) =>
    annotations.filter((a) => a.owner_id === etudiant.id && a.target_kind === kind && a.target_id === id);

  return (
    <Carte titre={etudiant.nom} aria-label={`Détail de ${etudiant.nom}`}
      actions={onRapport ? <button type="button" className="btn-secondary" onClick={onRapport}>Rapport PDF</button> : undefined}>
      <h3 className="classe-sous-titre">Gâchées ({etudiant.gachees.length})</h3>
      {etudiant.gachees.length === 0 && <p className="classe-rien">Aucune gâchée.</p>}
      <div className="classe-documents">
        {etudiant.gachees.map((g) => {
          const parAge = agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null);
          const valides = g.eprouvettes.filter(essaiValide).length;
          return (
            <div key={g.id} className="classe-document">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {g.code} <span style={{ fontWeight: 400, color: "var(--texte-2)" }}>· {g.formulationLabel} · {g.categorie} · {dateCourte(g.creeLe)}</span>
                  {g.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
                </div>
                <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: etudiant.id, kind: "gachee", id: g.id })}>Ouvrir</button>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--texte-2)", marginTop: 3 }}>
                {valides}/{g.eprouvettes.length} essai(s) valide(s)
                {parAge.length > 0 && " · UCS : " + parAge.map((a) => `${a.ageJours} j = ${Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")} kPa (n=${a.n})`).join(" ; ")}
              </div>
              <FilReplie liste={commentaires("gachee", g.id)} nomEtudiant={etudiant.nom} ctx={ctx}
                ancres={ancresGachee(g)}
                onAjouter={(texte, ancre) => onAnnoter({ kind: "gachee", id: g.id, rev: revDe(lignes, etudiant.id, "gachee", g.id), ancre, texte })} />
            </div>
          );
        })}
      </div>

      <h3 className="classe-sous-titre">Résultats sauvegardés ({etudiant.resultats.length})</h3>
      {etudiant.resultats.length === 0 && <p className="classe-rien">Aucun résultat.</p>}
      <div className="classe-documents">
        {etudiant.resultats.map((r) => (
          <div key={r.id} className="classe-document">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {r.label} <span style={{ fontWeight: 400, color: "var(--texte-2)" }}>· {r.category} · {methodLabel(r.category, r.method)} · {(r.recipes ?? []).length} recette(s) · {dateCourte(r.savedAt)}</span>
                {r.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
              </div>
              <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: etudiant.id, kind: "resultat", id: r.id })}>Ouvrir</button>
            </div>
            <FilReplie liste={commentaires("resultat", r.id)} nomEtudiant={etudiant.nom} ctx={ctx} ancres={[]}
              onAjouter={(texte) => onAnnoter({ kind: "resultat", id: r.id, rev: revDe(lignes, etudiant.id, "resultat", r.id), ancre: null, texte })} />
          </div>
        ))}
      </div>
    </Carte>
  );
}
