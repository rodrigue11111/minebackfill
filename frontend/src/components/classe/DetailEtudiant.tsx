// Détail d'un étudiant : ses documents (à ouvrir en entier) et les
// commentaires de l'enseignant.

import { useState } from "react";
import { agregerParAge } from "@/lib/eprouvette";
import { essaiValide, type EtudiantClasse, type LigneClasse } from "@/lib/classe";
import { estReponse, type LigneAnnotation } from "@/lib/classe-reseau";
import { methodLabel } from "@/lib/method-registry";
import { ancresGachee } from "@/lib/ancres";
import FilCommentaires from "./FilCommentaires";
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
      <button type="button" onClick={basculer}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, padding: 0, color: nouvelles > 0 ? "#b45309" : "var(--primary)", fontWeight: nouvelles > 0 ? 700 : 500 }}>
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
    <div className="form-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{etudiant.nom}</h2>
        {onRapport && <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={onRapport}>Rapport PDF</button>}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 8px" }}>Gâchées ({etudiant.gachees.length})</h3>
      {etudiant.gachees.length === 0 && <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune gâchée.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {etudiant.gachees.map((g) => {
          const parAge = agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null);
          const valides = g.eprouvettes.filter(essaiValide).length;
          return (
            <div key={g.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {g.code} <span style={{ fontWeight: 400, color: "#64748b" }}>· {g.formulationLabel} · {g.categorie} · {dateCourte(g.creeLe)}</span>
                  {g.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
                </div>
                <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: etudiant.id, kind: "gachee", id: g.id })}>Ouvrir</button>
              </div>
              <div style={{ fontSize: 12.5, color: "#475569", marginTop: 3 }}>
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

      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 8px" }}>Résultats sauvegardés ({etudiant.resultats.length})</h3>
      {etudiant.resultats.length === 0 && <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucun résultat.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {etudiant.resultats.map((r) => (
          <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                {r.label} <span style={{ fontWeight: 400, color: "#64748b" }}>· {r.category} · {methodLabel(r.category, r.method)} · {(r.recipes ?? []).length} recette(s) · {dateCourte(r.savedAt)}</span>
                {r.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
              </div>
              <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: etudiant.id, kind: "resultat", id: r.id })}>Ouvrir</button>
            </div>
            <FilReplie liste={commentaires("resultat", r.id)} nomEtudiant={etudiant.nom} ctx={ctx} ancres={[]}
              onAjouter={(texte) => onAnnoter({ kind: "resultat", id: r.id, rev: revDe(lignes, etudiant.id, "resultat", r.id), ancre: null, texte })} />
          </div>
        ))}
      </div>
    </div>
  );
}
