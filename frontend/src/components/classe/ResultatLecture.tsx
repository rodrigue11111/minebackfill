// Résultat sauvegardé d'un étudiant, INTÉGRAL et en lecture seule (vue
// enseignant) : toutes les sections du rapport (report-schema.ts, même source
// que la page Calculs et les exports Excel/PDF), et les exports existants.

import { lireBinders, type SavedResult } from "@/lib/store";
import { estVersionCourante } from "@/lib/conventions";
import { methodLabel } from "@/lib/method-registry";
import type { ReportCtx } from "@/lib/report-schema";
import { DENSITY_LABELS, fromStoreMass, MASS_LABELS, VOLUME_LABELS, type UnitPreferences } from "@/lib/units";
import { exporterResultat } from "@/lib/exports-resultat";
import { SectionsRapport, TableauRrc } from "@/components/mix/SectionsRapport";
import { Pastille } from "./commun";

export default function ResultatLecture({ resultat: sr, units }: { resultat: SavedResult; units: UnitPreferences }) {
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  // Nom du liant n : le catalogue FIGÉ avec le résultat (celui de l'étudiant
  // au moment du calcul), sinon le code, sinon « Ciment n ».
  const binders = lireBinders(sr.general);
  const catalogue = sr.catalogue_liants ?? [];
  const binderName = (n: number): string => {
    const ref = binders[n - 1];
    if (!ref?.code && !ref?.id) return `Ciment ${n}`;
    const item = (ref.id ? catalogue.find((l) => l.id === ref.id) : undefined) ?? catalogue.find((l) => l.code === ref.code);
    return item?.nom ?? ref.code ?? `Ciment ${n}`;
  };
  const ctx: ReportCtx = {
    units, massLabel, volLabel: VOLUME_LABELS[units.volume] ?? "L", densLabel: DENSITY_LABELS[units.density] ?? "g/cm3",
    binderName, isEssai: sr.method === "essai", isRpg: sr.category === "RPG", bcount: binders.length,
  };
  const g = sr.general;
  const recettes = (sr.recipes ?? []).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="form-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: "#334155" }}>
          <strong>{methodLabel(sr.category, sr.method, "long")}</strong>
          {!estVersionCourante(sr.solverVersion) && (
            <Pastille ton="ambre" title="Calculé avec une version antérieure des formules : les masses peuvent être incorrectes.">anciennes formules</Pastille>
          )}
          {sr.solverVersion && <span style={{ color: "#94a3b8", fontSize: 12 }}>formules {sr.solverVersion}</span>}
        </div>
        {(g.operator_name || g.project_name || g.residue_id) && (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, color: "#374151" }}>
            {g.operator_name && <span><span style={{ color: "var(--muted-foreground)" }}>Opérateur : </span>{g.operator_name}</span>}
            {g.project_name && <span><span style={{ color: "var(--muted-foreground)" }}>Projet : </span>{g.project_name}</span>}
            {g.residue_id && <span><span style={{ color: "var(--muted-foreground)" }}>Résidu : </span>{g.residue_id}</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void exporterResultat(sr, "excel", units)}>Excel</button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void exporterResultat(sr, "pdf", units)}>PDF</button>
          {sr.category !== "RRC" && (
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void exporterResultat(sr, "feuille", units)}>Feuille labo</button>
          )}
        </div>
      </div>

      {sr.category === "RRC" ? (
        sr.rrc ? (
          <TableauRrc recipes={sr.rrc.result.recipes} massLabel={massLabel} toMass={(kg) => fromStoreMass(kg, units.mass)} />
        ) : (
          <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Résultat RRC sans recettes enregistrées.</p>
        )
      ) : recettes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune recette enregistrée.</p>
      ) : (
        <SectionsRapport recipes={recettes} ctx={ctx} padding="0" />
      )}
    </div>
  );
}
