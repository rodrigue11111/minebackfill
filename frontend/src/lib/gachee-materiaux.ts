// frontend/src/lib/gachee-materiaux.ts
// Instantané des MATÉRIAUX d'une gâchée (fiche d'essai), construit à la création
// depuis la formulation sauvegardée. Module PUR, testé.
//
// Ce qui est figé : l'identité des matériaux et les valeurs entrées dans le
// calcul (Gs, w₀, fractions du liant). La caractérisation du résidu
// (granulométrie, chimie) n'est PAS copiée : elle vit une seule fois dans le
// catalogue et se joint par `id` à l'export, ce qui permet au professeur de la
// corriger sans réécrire chaque gâchée.

import type { GranulatItem, ResiduItem } from "./materials";
import { lireBinders, type LiantCatalogueItem, type SavedResult } from "./store";
import { nomLiant } from "./liants";
import type { MateriauxGachee } from "./gachee";

/** Valeurs numériques lues avec prudence dans un instantané `inputs` (type inconnu). */
function nombre(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Gs et w₀ du résidu (et Gs du granulat) réellement entrés dans le calcul,
 * d'après l'instantané du formulaire. La méthode essai-erreur range la méthode
 * de base dans `base_cw` / `base_wb` : on y regarde aussi.
 */
function valeursFormulaire(inputs: unknown): { residuGs?: number; residuW0?: number; granulatGs?: number; granulatW?: number } {
  if (!inputs || typeof inputs !== "object") return {};
  const sources = [inputs, (inputs as Record<string, unknown>).base_cw, (inputs as Record<string, unknown>).base_wb]
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object");
  const premier = (cle: string) => {
    for (const s of sources) {
      const n = nombre(s[cle]);
      if (n !== undefined) return n;
    }
    return undefined;
  };
  return {
    residuGs: premier("residue_sg"),
    residuW0: premier("residue_w_pct"),
    granulatGs: premier("aggregate_sg"),
    granulatW: premier("aggregate_w_pct"),
  };
}

/** Retire les clés valant undefined (instantané plus lisible, empreinte stable). */
function sansVides<T extends Record<string, unknown>>(o: T): T | undefined {
  const r = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;
  return Object.keys(r).length > 0 ? r : undefined;
}

export function materiauxDepuisFormulation(
  form: Pick<SavedResult, "category" | "general" | "catalogue_liants" | "selectedMaterials" | "inputs">,
  bibliotheque: { residus: ResiduItem[]; granulats: GranulatItem[] },
): MateriauxGachee {
  const catalogue: LiantCatalogueItem[] = form.catalogue_liants ?? [];
  const nom = nomLiant(form.general, catalogue);
  const liants = lireBinders(form.general)
    .map((b, i) => {
      const item = (b.id ? catalogue.find((l) => l.id === b.id) : undefined) ?? catalogue.find((l) => l.code === b.code);
      return sansVides({
        id: b.id ?? item?.id ?? undefined,
        code: b.code ?? item?.code ?? undefined,
        nom: nom(i + 1),
        gs: item?.gs,
        fractionPct: nombre(b.fraction_pct),
      });
    })
    .filter((l): l is NonNullable<typeof l> => !!l && !!(l.code || l.id));

  const vals = valeursFormulaire(form.inputs);
  const res = form.selectedMaterials?.residueId
    ? bibliotheque.residus.find((r) => r.id === form.selectedMaterials?.residueId)
    : undefined;
  const residu = res
    ? sansVides({ id: res.id, nom: res.nom, provenance: res.provenance, gs: res.gs, w0Pct: res.w0_pct, catalogue: res.origine })
    : sansVides({ nom: form.general.residue_id?.trim() || undefined, gs: vals.residuGs, w0Pct: vals.residuW0 });

  let granulat: MateriauxGachee["granulat"];
  if (form.category === "RPG") {
    const agg = form.selectedMaterials?.aggregateId
      ? bibliotheque.granulats.find((a) => a.id === form.selectedMaterials?.aggregateId)
      : undefined;
    granulat = agg
      ? sansVides({ id: agg.id, nom: agg.nom, provenance: agg.provenance, gs: agg.gs, humiditePct: agg.humidite_pct })
      : sansVides({ gs: vals.granulatGs, humiditePct: vals.granulatW });
  }

  return sansVides({ residu, granulat, liants: liants.length > 0 ? liants : undefined }) ?? {};
}
