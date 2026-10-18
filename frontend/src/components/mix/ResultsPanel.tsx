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
import { resultatPerime } from "@/lib/resultat-perime";
import { eauARetirer } from "@/lib/avis-recette";
import { Bandeau } from "@/components/ui/Bandeau";

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

  // Mesures au laboratoire de l'essai-erreur : dans les rapports PDF et Excel.
  const mesuresEssai = isEssai ? (isRpg ? rpgEssai : essai).mesures : undefined;

  const methodeQty = isEssai ? (isRpg ? rpgEssai : essai).base_method : method;
  const dQty = descriptorFor(category, methodeQty);
  const desiredQty = dQty ? (store[dQty.stateKey] as { desired_qty?: number }).desired_qty : undefined;

  // Entrées modifiées depuis le calcul : le résultat affiché ne leur
  // correspond plus. Ni sauvegarde ni export tant qu'on n'a pas recalculé.
  const cleResultat = category === "RRC" ? "rrcResult" as const : descriptor?.resultKey;
  const perime = cleResultat ? resultatPerime(store as unknown as Record<string, unknown>, cleResultat, store.empreintesCalcul[cleResultat]) : false;
  const avisPerime = perime ? (
    <Bandeau ton="alerte" role="status" titre="Résultats périmés.">
      Les entrées ont changé depuis ce calcul : ces résultats ne leur correspondent plus. Cliquez sur
      <strong> Calculer</strong> pour les mettre à jour avant de les sauvegarder ou de les exporter.
    </Bandeau>
  ) : undefined;

  const pleinEcranMenu = onBasculerPleinEcran
    ? { libelle: pleinEcran ? "Quitter le plein écran" : "Plein écran", detail: pleinEcran ? undefined : "Rapport complet sur deux colonnes", onSelect: onBasculerPleinEcran }
    : null;

  /* ── RRC : formules du RRC, pas de MixState ── */
  if (category === "RRC") {
    const rrcRecipes = store.rrcResult?.recipes ?? [];
    const vide = rrcRecipes.length === 0 || perime;
    const donnees: DonneesResultats | null = rrcRecipes.length === 0 ? null : { genre: "rrc", recipes: rrcRecipes, massLabel, toMass };
    return (
      <CarteResultats
        avis={avisPerime}
        sousTitre={rrcRecipes.length === 0 ? "Remblai rocheux cimenté" : `${rrcRecipes.length} recette${rrcRecipes.length > 1 ? "s" : ""} · ${methodLabel("RRC", "rrc", "long")} · masses en ${massLabel}`}
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
  // Eau à RETIRER (valeur négative du calcul) : impossible à faire dans une
  // gâchée ; on dit pourquoi et quoi changer, sans formule nouvelle.
  const retraits = eauARetirer(recipes);
  const avisEau = retraits.length > 0 ? (
    <Bandeau ton="alerte" titre="Eau à retirer.">
      {retraits.map((x) => `Recette ${x.recette} : il faudrait RETIRER ${(toMass(x.kg) ?? 0).toLocaleString("fr-CA", { maximumFractionDigits: 3 })} ${massLabel} d'eau`).join(" ; ")}.
      {" "}Le résidu apporte déjà plus d&apos;eau que la recette n&apos;en contient : visez un Cw plus bas, ou séchez le résidu.
    </Bandeau>
  ) : null;
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
        avis={avisPerime || avisEau ? <>{avisPerime}{avisEau}</> : undefined}
        actions={
          <>
            <button type="button" className="btn-contour" disabled={vide || perime}
              onClick={async () => { const { exportToExcel } = await import("@/lib/excel-report"); exportToExcel(recipes, general, binderName, category, method, units, mesuresEssai); }}>
              Excel
            </button>
            <button type="button" className="btn-contour" disabled={vide || perime}
              onClick={async () => { const { exportToPdf } = await import("@/lib/pdf-report"); exportToPdf(recipes, general, binderName, category, method, units, mesuresEssai); }}>
              PDF
            </button>
            <Sauvegarder desactive={vide || perime} onSave={(nom) => store.saveCurrentResult(nom)} nomParDefaut={`${category} ${methodLabel(category, method)} du ${dateDuJour}`} />
            <Menu
              className="ui-bouton-icone"
              ariaLabel="Autres actions"
              declencheur={<Icone nom="plus" taille={18} epaisseur={2} />}
              elements={[
                {
                  libelle: "Feuille labo (PDF)",
                  detail: "Masses à peser, cases à cocher, mesures après la gâchée",
                  desactive: vide || perime,
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
