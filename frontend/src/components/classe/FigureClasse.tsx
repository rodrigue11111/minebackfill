// Figure UCS de la classe : un point par gâchée, une couleur par étudiant.

import { useMemo, useState } from "react";
import CourbeUCS, { type SerieUCS } from "@/components/labo/CourbeUCS";
import { AXES_FORMULATION, axeMeta, type AxeFormulation } from "@/lib/ucs-formulation";
import { agesClasse, nuageClasse, type EtudiantClasse } from "@/lib/classe";
import { COULEURS } from "./commun";

export default function FigureClasse({ etudiants, couleurDe }: { etudiants: EtudiantClasse[]; couleurDe: Map<string, string> }) {
  const [axe, setAxe] = useState<AxeFormulation>("bwPct");
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  const ages = useMemo(() => agesClasse(etudiants), [etudiants]);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : (ages.includes(28) ? 28 : (ages[0] ?? 28));
  const nuage = useMemo(() => nuageClasse(etudiants, axe, age), [etudiants, axe, age]);
  const series: SerieUCS[] = etudiants
    .map((e) => ({
      cle: e.id, label: e.nom, couleur: couleurDe.get(e.id) ?? COULEURS[0],
      points: nuage.points.filter((p) => p.etudiantId === e.id)
        .map((p) => ({ x: p.x, moyenne: p.moyenneKpa, ecartType: p.ecartTypeKpa, n: p.n })),
    }))
    .filter((s) => s.points.length > 0);

  return (
    <div className="form-card">
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>UCS mesurée de la classe</h2>
      <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 10px", lineHeight: 1.5 }}>
        Un point par gâchée : son paramètre de formulation en abscisse, l&apos;UCS moyenne mesurée
        à l&apos;âge choisi en ordonnée. Une couleur par étudiant. Les copies de conflit sont exclues.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {AXES_FORMULATION.map((a) => (
          <button key={a.cle} type="button" onClick={() => setAxe(a.cle)}
            style={{ padding: "5px 11px", fontSize: 12, borderRadius: 6, cursor: "pointer",
              border: `1px solid ${axe === a.cle ? "#1d4ed8" : "#cbd5e1"}`, background: axe === a.cle ? "#dbeafe" : "#fff",
              color: axe === a.cle ? "#1e3a8a" : "#475569", fontWeight: axe === a.cle ? 700 : 500 }}>
            {a.label}
          </button>
        ))}
        {ages.length > 0 && (
          <label style={{ fontSize: 12.5, color: "#475569", marginLeft: 8 }}>
            Âge :{" "}
            <select value={age} onChange={(ev) => setAgeVoulu(Number(ev.target.value))}
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5 }}>
              {ages.map((x) => <option key={x} value={x}>{x} j</option>)}
            </select>
          </label>
        )}
      </div>
      <CourbeUCS series={series} relier={false} ticksX="rondes"
        xLabel={(() => { const m = axeMeta(axe); return m ? `${m.label}${m.unite !== "—" ? ` (${m.unite})` : ""}` : axe; })()}
        formatX={(x) => x.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}
        messageVide="Aucune gâchée de la classe n'a de mesure exploitable à cet âge." />
      {nuage.ecartees.length > 0 && (
        <details style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
          <summary style={{ cursor: "pointer" }}>{nuage.ecartees.length} gâchée(s) absente(s) de cette figure</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {nuage.ecartees.map((x, i) => <li key={i}>{x.etudiant} — {x.code} : {x.raison}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
