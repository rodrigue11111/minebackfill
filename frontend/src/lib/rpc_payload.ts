import type {
  ConstantesCalcul,
  GeneralInfo,
  LiantCatalogueItem,
} from "@/lib/store";

export const gsParDefaut = 3.15;

export function trouverLiant(
  code: string | null | undefined,
  catalogue: LiantCatalogueItem[]
): LiantCatalogueItem | undefined {
  if (!code) return undefined;
  return catalogue.find((item) => item.code === code);
}

export function gsLiant(
  code: string | null | undefined,
  catalogue: LiantCatalogueItem[]
): number {
  const liant = trouverLiant(code, catalogue);
  if (!liant || !Number.isFinite(liant.gs) || liant.gs <= 0) return gsParDefaut;
  return liant.gs;
}

export function construireSystemeLiant(
  general: GeneralInfo,
  catalogue: LiantCatalogueItem[]
) {
  const f1 = Number(general.binder1_fraction_pct ?? 0);
  const f2 = Number(general.binder2_fraction_pct ?? 0);
  const f3 = Number(general.binder3_fraction_pct ?? 0);

  const brut: { fracPct: number; type: string }[] = [];
  if (general.binder1_type && f1 > 0) {
    brut.push({ fracPct: f1, type: general.binder1_type });
  }
  if (general.binder2_type && f2 > 0) {
    brut.push({ fracPct: f2, type: general.binder2_type });
  }
  if (general.binder3_type && f3 > 0) {
    brut.push({ fracPct: f3, type: general.binder3_type });
  }

  if (brut.length === 0) {
    const typeFallback = general.binder1_type ?? catalogue[0]?.code ?? "CP50";
    return {
      components: [
        {
          type: typeFallback,
          specific_gravity: gsLiant(typeFallback, catalogue),
          mass_fraction: 1.0,
        },
      ],
    };
  }

  const totalFrac = brut.reduce((acc, item) => acc + item.fracPct, 0) || 1;

  return {
    components: brut.map((item) => ({
      type: item.type,
      specific_gravity: gsLiant(item.type, catalogue),
      mass_fraction: item.fracPct / totalFrac,
    })),
  };
}

export function construireGeneralPayload(general: GeneralInfo) {
  return {
    operator_name: general.operator_name ?? null,
    project_name: general.project_name ?? null,
    residue_id: general.residue_id ?? null,
    mix_date: general.mix_date ?? null,
    container_type: general.container_type ?? null,
    container_section: general.container_section ?? null,
    container_height: general.container_height ?? null,
    container_radius: general.container_radius ?? null,
    container_length: general.container_length ?? null,
    container_width: general.container_width ?? null,
    binder_count: general.binder_count ?? null,
    binder1_type: general.binder1_type ?? null,
    binder2_type: general.binder2_type ?? null,
    binder3_type: general.binder3_type ?? null,
    binder1_fraction_pct: general.binder1_fraction_pct ?? null,
    binder2_fraction_pct: general.binder2_fraction_pct ?? null,
    binder3_fraction_pct: general.binder3_fraction_pct ?? null,
  };
}

export function construireConstantesPayload(constantes: ConstantesCalcul) {
  return {
    water_density: constantes.masse_volumique_eau_kg_m3,
    gravity: constantes.gravite_m_s2,
    slump_small_to_large_factor:
      constantes.facteur_petit_cone_vers_grand_cone,
    slump_model_coeff: constantes.coefficient_modele_slump,
    slump_model_offset: constantes.constante_modele_slump,
  };
}
