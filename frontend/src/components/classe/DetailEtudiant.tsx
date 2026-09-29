// Détail d'un étudiant : ses documents (à ouvrir en entier) et les
// commentaires de l'enseignant.

import { agregerParAge } from "@/lib/eprouvette";
import { essaiValide, type EtudiantClasse, type LigneClasse } from "@/lib/classe";
import type { LigneAnnotation } from "@/lib/classe-reseau";
import FilCommentaires from "./FilCommentaires";
import { dateCourte, lienBouton, Pastille, type RefDoc } from "./commun";

export type NouvelleAnnotation = { kind: "resultat" | "gachee"; id: string; rev: number | null; ancre: string | null; texte: string };

export function revDe(lignes: LigneClasse[], proprietaire: string, kind: "resultat" | "gachee", id: string): number | null {
  return lignes.find((l) => l.proprietaire === proprietaire && l.kind === kind && l.id === id)?.rev ?? null;
}

export default function DetailEtudiant({ etudiant, annotations, onAnnoter, onRetirer, lignes, onOuvrir }: {
  etudiant: EtudiantClasse;
  annotations: LigneAnnotation[];
  onAnnoter: (a: NouvelleAnnotation) => Promise<void>;
  onRetirer: (id: string) => Promise<void>;
  lignes: LigneClasse[];
  onOuvrir: (ref: RefDoc) => void;
}) {
  const commentaires = (kind: "resultat" | "gachee", id: string) =>
    annotations.filter((a) => a.owner_id === etudiant.id && a.target_kind === kind && a.target_id === id);

  return (
    <div className="form-card">
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>{etudiant.nom}</h2>

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
              <FilCommentaires liste={commentaires("gachee", g.id)} onRetirer={onRetirer}
                ancres={g.eprouvettes.map((e) => e.code)}
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
                {r.label} <span style={{ fontWeight: 400, color: "#64748b" }}>· {r.category} · {r.method} · {(r.recipes ?? []).length} recette(s) · {dateCourte(r.savedAt)}</span>
                {r.conflit && <> <Pastille ton="ambre">copie de conflit</Pastille></>}
              </div>
              <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: etudiant.id, kind: "resultat", id: r.id })}>Ouvrir</button>
            </div>
            <FilCommentaires liste={commentaires("resultat", r.id)} onRetirer={onRetirer} ancres={[]}
              onAjouter={(texte) => onAnnoter({ kind: "resultat", id: r.id, rev: revDe(lignes, etudiant.id, "resultat", r.id), ancre: null, texte })} />
          </div>
        ))}
      </div>
    </div>
  );
}
