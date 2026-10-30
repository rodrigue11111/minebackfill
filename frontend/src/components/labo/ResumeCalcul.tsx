// Repères du calcul choisi dans « Nouvelle gâchée » (2026-10-30, demande de
// l'utilisateur) : au Labo, on ne se rappelle plus quelle recette est
// laquelle, ni ce que contenait le calcul. Sans hook : rendu testable.

import type { SavedResult, LiantCatalogueItem } from "@/lib/store";
import { lireBinders } from "@/lib/store";
import { nomLiant } from "@/lib/liants";
import { descriptorFor } from "@/lib/method-registry";
import { moulesPrevus, parametresDepuisRecette, resumeParametres } from "@/lib/gachee";
import { lienDocument } from "@/lib/liens-commentaires";
import { dateHeureSauvegarde } from "@/components/labo/outils";

export default function ResumeCalcul({ calcul, recetteIndex, catalogue }: {
  calcul: SavedResult;
  recetteIndex: number;
  catalogue: LiantCatalogueItem[];
}) {
  const general = calcul.general ?? ({} as SavedResult["general"]);
  const recette = calcul.recipes[Math.min(recetteIndex, calcul.recipes.length - 1)];
  const methode = descriptorFor(calcul.category, calcul.method)?.labels.long;
  const nom = nomLiant(general, catalogue);
  const liants = lireBinders(general)
    .map((b, i) => (b.code || b.id ? `${nom(i + 1)}${typeof b.fraction_pct === "number" ? ` ${b.fraction_pct.toLocaleString("fr-CA")} %` : ""}` : null))
    .filter(Boolean)
    .join(" · ");
  const moules = moulesPrevus(calcul);
  const repere = recette ? resumeParametres(parametresDepuisRecette(recette)) : "";

  return (
    <div className="labo-resume-calcul" aria-label="Repères du calcul choisi">
      <p>
        <strong>{calcul.label}</strong>
        {[calcul.category, methode, `sauvegardé le ${dateHeureSauvegarde(calcul.savedAt)}`].filter(Boolean).map((x) => ` · ${x}`).join("")}
      </p>
      <dl>
        {general.project_name && <><dt>Projet</dt><dd>{general.project_name}</dd></>}
        {general.residue_id && <><dt>Résidu</dt><dd>{general.residue_id}</dd></>}
        {liants && <><dt>Liants</dt><dd>{liants}</dd></>}
        {moules !== undefined && <><dt>Moules</dt><dd>{moules} par recette</dd></>}
        {repere && <><dt>Recette {Math.min(recetteIndex, calcul.recipes.length - 1) + 1}</dt><dd>{repere}</dd></>}
      </dl>
      <a href={lienDocument("resultat", calcul.id)} target="_blank" rel="noopener">Ouvrir le calcul dans un nouvel onglet</a>
    </div>
  );
}
