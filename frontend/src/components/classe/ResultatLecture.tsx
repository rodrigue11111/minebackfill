// Résultat sauvegardé d'un étudiant, INTÉGRAL et en lecture seule (vue
// enseignant) : chiffres clés de la recette 1, toutes les sections du rapport
// (report-schema.ts, même source que la page Calculs et les exports Excel/PDF),
// et les exports existants.

import { lireBinders, type SavedResult } from "@/lib/store";
import { nomLiant } from "@/lib/liants";
import { estVersionCourante } from "@/lib/conventions";
import { methodLabel } from "@/lib/method-registry";
import type { ReportCtx } from "@/lib/report-schema";
import { DENSITY_LABELS, fromStoreMass, MASS_LABELS, VOLUME_LABELS, type UnitPreferences } from "@/lib/units";
import { exporterResultat } from "@/lib/exports-resultat";
import { SectionsRapport, TableauRrc } from "@/components/mix/SectionsRapport";
import { chiffresRecette, chiffresRrc } from "@/components/mix/CarteResultats";
import { Carte } from "@/components/ui/Carte";
import { TuilesChiffres } from "@/components/ui/Chiffres";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import { Pastille } from "./commun";

export default function ResultatLecture({ resultat: sr, units }: { resultat: SavedResult; units: UnitPreferences }) {
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const toMass = (kg: number | null | undefined) => fromStoreMass(kg, units.mass);
  // Nom du liant n : le catalogue FIGÉ avec le résultat (celui de l'étudiant
  // au moment du calcul), sinon le code, sinon « Liant n ».
  const binders = lireBinders(sr.general);
  const binderName = nomLiant(sr.general, sr.catalogue_liants ?? []);
  const ctx: ReportCtx = {
    units, massLabel, volLabel: VOLUME_LABELS[units.volume] ?? "L", densLabel: DENSITY_LABELS[units.density] ?? "g/cm3",
    binderName, isEssai: sr.method === "essai", isRpg: sr.category === "RPG", bcount: binders.length,
  };
  const g = sr.general;
  const recettes = (sr.recipes ?? []).filter(Boolean);
  const rrc = sr.category === "RRC" ? sr.rrc?.result.recipes ?? [] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Carte
        titre={methodLabel(sr.category, sr.method, "long")}
        aside={sr.solverVersion ? `formules ${sr.solverVersion}` : undefined}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-contour" onClick={() => void exporterResultat(sr, "excel", units)}>Excel</button>
            <button type="button" className="btn-contour" onClick={() => void exporterResultat(sr, "pdf", units)}>PDF</button>
            {sr.category !== "RRC" && (
              <button type="button" className="btn-contour" onClick={() => void exporterResultat(sr, "feuille", units)}>Feuille labo</button>
            )}
          </div>
        }
      >
        {!estVersionCourante(sr.solverVersion) && (
          <div>
            <Pastille ton="ambre" title="Calculé avec une version antérieure des formules : les masses peuvent être incorrectes.">anciennes formules</Pastille>
          </div>
        )}
        {(g.operator_name || g.project_name || g.residue_id) && (
          <ListeGroupee>
            {g.operator_name && <LigneListe libelle="Opérateur" valeur={g.operator_name} />}
            {g.project_name && <LigneListe libelle="Projet" valeur={g.project_name} />}
            {g.residue_id && <LigneListe libelle="Résidu" valeur={g.residue_id} />}
          </ListeGroupee>
        )}
      </Carte>

      {sr.category === "RRC" ? (
        sr.rrc ? (
          <Carte titre="Résultats">
            <TuilesChiffres ariaLabel="Chiffres clés, recette 1" chiffres={chiffresRrc(rrc[0], massLabel, toMass)} />
            <TableauRrc recipes={rrc} massLabel={massLabel} toMass={toMass} />
          </Carte>
        ) : (
          <p className="mix-vide">Résultat RRC sans recettes enregistrées.</p>
        )
      ) : recettes.length === 0 ? (
        <p className="mix-vide">Aucune recette enregistrée.</p>
      ) : (
        <Carte titre="Résultats" aside={`${recettes.length} recette${recettes.length > 1 ? "s" : ""} · chiffres clés de la recette 1 · masses en ${massLabel}`}>
          <TuilesChiffres ariaLabel="Chiffres clés, recette 1" chiffres={chiffresRecette(recettes[0], ctx)} />
          <SectionsRapport recipes={recettes} ctx={ctx} />
        </Carte>
      )}
    </div>
  );
}
