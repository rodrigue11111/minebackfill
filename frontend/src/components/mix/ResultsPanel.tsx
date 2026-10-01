"use client";

// Contrôleur de la carte « Résultats » de la page Calculs : lit le magasin
// (méthode active, résultat, unités, liants), construit le contexte du schéma
// de rapport et les actions (Excel, PDF, feuille labo, sauvegarde, plein
// écran). La présentation est dans CarteResultats.

import { useCallback, useState } from "react";
import { useStore, lireBinders } from "@/lib/store";
import type { Category, LiantCatalogueItem } from "@/lib/store";
import { fromStoreMass, MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS, type UnitPreferences } from "@/lib/units";
import FormulaPopover from "@/components/mix/FormulaPopover";
import CarteResultats, { type DonneesResultats } from "@/components/mix/CarteResultats";
import Sauvegarder from "@/components/mix/Sauvegarder";
import Menu from "@/components/ui/Menu";
import { Icone } from "@/components/ui/Icones";
import { nomLiant } from "@/lib/liants";
import { descriptorFor, methodLabel } from "@/lib/method-registry";
import type { ReportCtx } from "@/lib/report-schema";
import type { MixResult, Recipe } from "@/lib/types";

const UNITES_DEFAUT: UnitPreferences = { length: "cm", area: "cm2", mass: "kg", volume: "L", density: "g/cm3", slump: "mm" };

export default function ResultsPanel({ pleinEcran = false, onBasculerPleinEcran }: {
  pleinEcran?: boolean;
  onBasculerPleinEcran?: () => void;
}) {
  /* ── Fenêtre des formules (clic sur une valeur « fx ») ── */
  const [formulaPopover, setFormulaPopover] = useState<{
    formulaIds: string[];
    recipe: Recipe;
    anchorRect: DOMRect;
  } | null>(null);
  const handleFormulaClick = useCallback((formulaIds: string[], recipe: Recipe, rect: DOMRect) => {
    setFormulaPopover({ formulaIds, recipe, anchorRect: rect });
  }, []);

  const store = useStore();
  const { category, method, general, essai, rpgEssai } = store;
  const catalogue_liants: LiantCatalogueItem[] = store.catalogue_liants ?? [];
  const units: UnitPreferences = store.units ?? UNITES_DEFAUT;
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const volLabel = VOLUME_LABELS[units.volume] ?? "L";
  const densLabel = DENSITY_LABELS[units.density] ?? "g/cm3";
  const toMass = (kg: number | null | undefined) => fromStoreMass(kg, units.mass);
  const dateDuJour = new Date().toLocaleDateString("fr-CA");

  // Nom du composant n (1-indexé), pour un nombre N quelconque : lit la liste
  // N-aire des liants (repli legacy binder1/2/3 via lireBinders).
  const bindersGeneral = lireBinders(general);
  const binderName = nomLiant(general, catalogue_liants);

  const isRpg = category === "RPG";
  const isEssai = method === "essai";

  // Contexte du schéma de rapport (partagé écran/Excel/PDF).
  const reportCtx: ReportCtx = {
    units, massLabel, volLabel, densLabel, binderName,
    isEssai, isRpg, bcount: bindersGeneral.length,
  };

  // Tranches d'état/résultat de la méthode active — via le registre. Pour
  // l'essai, la quantité désirée vient de l'état de la méthode de BASE.
  const descriptor = descriptorFor(category, method);
  const result = descriptor ? (store[descriptor.resultKey] as MixResult | null) : null;
  const recipes: Recipe[] = (Array.isArray(result?.recipes) ? result.recipes : []).filter(Boolean);

  const methodeQty = isEssai ? (isRpg ? rpgEssai : essai).base_method : method;
  const dQty = descriptorFor(category, methodeQty);
  const desiredQty = dQty ? (store[dQty.stateKey] as { desired_qty?: number }).desired_qty : undefined;

  const pleinEcranMenu = onBasculerPleinEcran
    ? { libelle: pleinEcran ? "Quitter le plein écran" : "Plein écran", detail: pleinEcran ? undefined : "Rapport complet sur deux colonnes", onSelect: onBasculerPleinEcran }
    : null;

  /* ── RRC : formules du RRC, pas de MixState ── */
  if (category === "RRC") {
    const rrcRecipes = store.rrcResult?.recipes ?? [];
    const vide = rrcRecipes.length === 0;
    const donnees: DonneesResultats | null = vide ? null : { genre: "rrc", recipes: rrcRecipes, massLabel, toMass };
    return (
      <CarteResultats
        sousTitre={vide ? "Remblai rocheux cimenté" : `${rrcRecipes.length} recette${rrcRecipes.length > 1 ? "s" : ""} · ${methodLabel("RRC", "rrc", "long")} · masses en ${massLabel}`}
        donnees={donnees}
        pleinEcran={pleinEcran}
        actions={
          <>
            <button type="button" className="btn-contour" disabled={vide}
              onClick={async () => { const { exportRrcExcel } = await import("@/lib/rrc-export"); exportRrcExcel(rrcRecipes, general, units); }}>
              Excel
            </button>
            <button type="button" className="btn-contour" disabled={vide} title="Feuille de préparation : masses à charger, coulis, signature"
              onClick={async () => { const { exportRrcPdf } = await import("@/lib/rrc-export"); exportRrcPdf(rrcRecipes, general, units); }}>
              Feuille labo
            </button>
            <Sauvegarder desactive={vide} onSave={(nom) => store.saveCurrentResult(nom)} nomParDefaut={`RRC du ${dateDuJour}`} />
            {pleinEcranMenu && (
              <Menu className="ui-bouton-icone" ariaLabel="Autres actions" declencheur={<Icone nom="plus" taille={18} epaisseur={2} />} elements={[pleinEcranMenu]} />
            )}
          </>
        }
      />
    );
  }

  const vide = recipes.length === 0;
  const donnees: DonneesResultats | null = vide ? null : { genre: "rpc", recipes, ctx: reportCtx };
  const libelleMethode = methodLabel(category as Category, method, "long");
  const sousTitre = vide
    ? `${category} · ${libelleMethode}`
    : [
      `${recipes.length} recette${recipes.length > 1 ? "s" : ""}${isEssai ? " ajustée" + (recipes.length > 1 ? "s" : "") : ""}`,
      `${category} · ${libelleMethode}`,
      desiredQty !== undefined ? `${desiredQty} moule${desiredQty > 1 ? "s" : ""} par recette` : null,
      `masses en ${massLabel}`,
    ].filter(Boolean).join(" · ");

  return (
    <>
      <CarteResultats
        sousTitre={sousTitre}
        donnees={donnees}
        pleinEcran={pleinEcran}
        onFormulaClick={handleFormulaClick}
        actions={
          <>
            <button type="button" className="btn-contour" disabled={vide}
              onClick={async () => { const { exportToExcel } = await import("@/lib/excel-report"); exportToExcel(recipes, general, binderName, category, method, units); }}>
              Excel
            </button>
            <button type="button" className="btn-contour" disabled={vide}
              onClick={async () => { const { exportToPdf } = await import("@/lib/pdf-report"); exportToPdf(recipes, general, binderName, category, method, units); }}>
              PDF
            </button>
            <Sauvegarder desactive={vide} onSave={(nom) => store.saveCurrentResult(nom)} nomParDefaut={`${category} ${methodLabel(category, method)} du ${dateDuJour}`} />
            <Menu
              className="ui-bouton-icone"
              ariaLabel="Autres actions"
              declencheur={<Icone nom="plus" taille={18} epaisseur={2} />}
              elements={[
                {
                  libelle: "Feuille labo (PDF)",
                  detail: "Masses à peser, cases à cocher, mesures après la gâchée",
                  desactive: vide,
                  onSelect: async () => { const { exportPreparationPdf } = await import("@/lib/preparation-sheet"); exportPreparationPdf(recipes, general, binderName, category, method, units); },
                },
                ...(pleinEcranMenu ? [pleinEcranMenu] : []),
              ]}
            />
          </>
        }
      />
      {formulaPopover && (
        <FormulaPopover
          formulaIds={formulaPopover.formulaIds}
          recipe={formulaPopover.recipe}
          anchorRect={formulaPopover.anchorRect}
          onClose={() => setFormulaPopover(null)}
        />
      )}
    </>
  );
}
