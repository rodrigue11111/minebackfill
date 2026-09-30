// frontend/src/components/mix/SectionsRapport.tsx
// Rendu à l'écran du schéma de rapport unique (report-schema.ts) — même source
// que les exports Excel et PDF. Partagé par la page Calculs (rapport complet)
// et la lecture d'un résultat d'étudiant par l'enseignant (/classe).
// Présentation « à filets » : titres de section, tableaux sans cadre.

import { REPORT_SECTIONS, rowsForSection, RRC_ROWS, type ReportCtx, type ReportRow } from "@/lib/report-schema";
import { fmt } from "@/lib/format";
import type { Recipe, RrcRecipe } from "@/lib/types";

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mix-rapport-tete">
      <h3 className="mix-rapport-titre">{title}</h3>
      {sub && <span className="mix-rapport-sous-titre">{sub}</span>}
    </div>
  );
}

/** En-têtes « Paramètre | Recette 1 | Recette 2… » ; la recette choisie en accent. */
export function RecipeHeaders({ activeCount, choisie }: { activeCount: number; choisie?: number }) {
  return (
    <>
      <th scope="col" className="mix-col-parametre">Paramètre</th>
      {Array.from({ length: activeCount }).map((_, i) => (
        <th key={i} scope="col" className={i === choisie ? "mix-col-choisie" : undefined}>
          Recette {i + 1}
        </th>
      ))}
    </>
  );
}

export function DataRow({
  label,
  unit,
  getter,
  recipes,
  digits = 3,
  bold = false,
  formulaIds,
  onFormulaClick,
  choisie,
}: {
  label: string;
  unit?: string;
  getter: (r: Recipe) => number | undefined | null;
  recipes: Recipe[];
  digits?: number;
  bold?: boolean;
  formulaIds?: string[];
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
  /** Colonne de la recette choisie (mise en valeur). */
  choisie?: number;
}) {
  const hasFormula = formulaIds && formulaIds.length > 0 && onFormulaClick;
  return (
    <tr className={bold ? "mix-ligne-forte" : undefined}>
      <td>
        {label}
        {unit && <span className="mix-unite"> ({unit})</span>}
        {hasFormula && (
          <span className="mix-fx" title="Cliquez sur une valeur pour voir la formule">fx</span>
        )}
      </td>
      {recipes.map((r, i) => (
        <td
          key={i}
          className={[hasFormula ? "mix-valeur-formule" : "", i === choisie ? "mix-col-choisie" : ""].filter(Boolean).join(" ") || undefined}
          onClick={hasFormula ? (e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onFormulaClick!(formulaIds!, r, rect);
          } : undefined}
        >
          {fmt(getter(r), digits)}
        </td>
      ))}
    </tr>
  );
}

/** Tableau d'une liste de lignes du schéma (résumé ou section). */
export function TableauLignes({ lignes, recipes, ctx, choisie, onFormulaClick }: {
  lignes: ReportRow[];
  recipes: Recipe[];
  ctx: ReportCtx;
  choisie?: number;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
}) {
  return (
    <div className="mix-tableau-defilant">
      <table className="result-table">
        <thead><tr><RecipeHeaders activeCount={recipes.length} choisie={choisie} /></tr></thead>
        <tbody>
          {lignes.map((row) => (
            <DataRow
              key={row.label(ctx)}
              label={row.label(ctx)}
              unit={row.unit(ctx) || undefined}
              getter={(r) => row.getter(r, ctx)}
              recipes={recipes}
              digits={row.digits}
              bold={row.bold}
              formulaIds={row.formulaIds}
              onFormulaClick={row.formulaIds ? onFormulaClick : undefined}
              choisie={choisie}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Les sections du rapport RPC/RPG, en colonne ou en grille (plein écran). */
export function SectionsRapport({ recipes, ctx, grille = false, onFormulaClick, choisie }: {
  recipes: Recipe[];
  ctx: ReportCtx;
  grille?: boolean;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
  choisie?: number;
}) {
  return (
    <div className={grille ? "mix-rapport mix-rapport-grille" : "mix-rapport"}>
      {REPORT_SECTIONS.map((section) => (
        <section key={section.id} className={grille && section.id >= 5 ? "mix-rapport-section mix-rapport-large" : "mix-rapport-section"}>
          <SectionHeader title={section.title(ctx)} sub={section.sub(ctx)} />
          <TableauLignes lignes={rowsForSection(section.id, ctx)} recipes={recipes} ctx={ctx} choisie={choisie} onFormulaClick={onFormulaClick} />
        </section>
      ))}
    </div>
  );
}

/** Tableau des résultats RRC (lignes du schéma unique RRC_ROWS). */
export function TableauRrc({ recipes, massLabel, toMass, choisie }: {
  recipes: RrcRecipe[];
  massLabel: string;
  toMass: (kg: number | null | undefined) => number | null;
  choisie?: number;
}) {
  return (
    <section className="mix-rapport-section">
      <SectionHeader title="Remblai rocheux cimenté (RRC)" sub="masses, retardateur de prise et coulis de ciment — cours, dia 65 à 70" />
      <div className="mix-tableau-defilant">
        <table className="result-table">
          <thead>
            <tr><RecipeHeaders activeCount={recipes.length} choisie={choisie} /></tr>
          </thead>
          <tbody>
            {RRC_ROWS.map((row, ri) => (
              <tr key={ri} className={row.bold ? "mix-ligne-forte" : undefined}>
                <td>{row.label(massLabel)}</td>
                {recipes.map((r, ci) => (
                  <td key={ci} className={ci === choisie ? "mix-col-choisie" : undefined}>
                    {fmt(row.getter(r, toMass), row.digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
