"use client";

import { useStore } from "@/lib/store";

/* ── helpers ── */
const fmt = (v: number | undefined | null, digits = 3) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
};

const toGcm3 = (rho?: number | null) =>
  rho === undefined || rho === null || Number.isNaN(rho) ? null : rho / 1000;

/** Convert m³ → litres for display */
const toLiters = (v?: number | null) =>
  v === undefined || v === null || Number.isNaN(v) ? null : v * 1000;

const toGrams = (kg?: number | null) =>
  kg === undefined || kg === null || Number.isNaN(kg) ? null : kg * 1000;

type RecetteAffichage = {
  components?: {
    residue_dry_mass_kg?: number | null;
    residue_wet_mass_kg?: number | null;
    aggregate_dry_mass_kg?: number | null;
    binder_total_mass_kg?: number | null;
    water_total_mass_kg?: number | null;
  } | null;
  solid_volume_m3?: number | null;
  total_backfill_volume_m3?: number | null;
  void_volume_m3?: number | null;
  water_volume_m3?: number | null;
};

const val = (x: number | null | undefined, fallback = 0) =>
  x === undefined || x === null || Number.isNaN(x) ? fallback : x;

const masseRejetSecTotaleKg = (r: RecetteAffichage) =>
  val(r?.components?.residue_dry_mass_kg) + val(r?.components?.aggregate_dry_mass_kg);

const masseSolidesTotaleKg = (r: RecetteAffichage) =>
  masseRejetSecTotaleKg(r) + val(r?.components?.binder_total_mass_kg);

const masseRemblaiTotaleKg = (r: RecetteAffichage) =>
  masseSolidesTotaleKg(r) + val(r?.components?.water_total_mass_kg);

const masseEauDansResidusKg = (r: RecetteAffichage) =>
  val(r?.components?.residue_wet_mass_kg) - val(r?.components?.residue_dry_mass_kg);

const volumeAirM3 = (r: RecetteAffichage) =>
  val(r?.void_volume_m3) - val(r?.water_volume_m3);

const cwCalculePct = (r: RecetteAffichage) => {
  const ms = masseSolidesTotaleKg(r);
  const mw = val(r?.components?.water_total_mass_kg);
  const mt = ms + mw;
  if (mt <= 0) return null;
  return (ms / mt) * 100;
};

const cvCalculePct = (r: RecetteAffichage) => {
  const vs = val(r?.solid_volume_m3);
  const vt = val(r?.total_backfill_volume_m3);
  if (vt <= 0) return null;
  return (vs / vt) * 100;
};

/* ── Section colours ── */
const SECTIONS = {
  mix: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    headerBg: "#dbeafe",
    headerText: "#1d4ed8",
    accent: "#2563eb",
  },
  geo1: {
    bg: "#f0fdf4",
    border: "#bbf7d0",
    headerBg: "#dcfce7",
    headerText: "#15803d",
    accent: "#16a34a",
  },
  geo2: {
    bg: "#faf5ff",
    border: "#e9d5ff",
    headerBg: "#f3e8ff",
    headerText: "#7c3aed",
    accent: "#7c3aed",
  },
  geo3: {
    bg: "#fffbeb",
    border: "#fde68a",
    headerBg: "#fef3c7",
    headerText: "#b45309",
    accent: "#d97706",
  },
  vols: {
    bg: "#ecfeff",
    border: "#a5f3fc",
    headerBg: "#cffafe",
    headerText: "#0e7490",
    accent: "#0891b2",
  },
} as const;

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

function SectionHeader({
  title,
  sub,
  color,
}: {
  title: string;
  sub?: string;
  color: (typeof SECTIONS)[keyof typeof SECTIONS];
}) {
  return (
    <div
      style={{
        background: color.headerBg,
        borderBottom: `1px solid ${color.border}`,
        padding: "9px 14px",
        display: "flex",
        alignItems: "baseline",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: color.headerText }}>
        {title}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: color.headerText, opacity: 0.65 }}>
          — {sub}
        </span>
      )}
    </div>
  );
}

function RecipeHeaders({ activeCount }: { activeCount: number }) {
  return (
    <>
      <th
        className="result-table"
        style={{
          padding: "6px 10px",
          textAlign: "left",
          fontSize: 11,
          fontWeight: 600,
          color: "#64748b",
          width: "42%",
        }}
      >
        Paramètre
      </th>
      {Array.from({ length: activeCount }).map((_, i) => (
        <th
          key={i}
          style={{
            padding: "6px 8px",
            textAlign: "right",
            fontSize: 11,
            fontWeight: 700,
            color: RECIPE_COLORS[i],
            whiteSpace: "nowrap",
          }}
        >
          R{i + 1}
        </th>
      ))}
    </>
  );
}

function DataRow({
  label,
  unit,
  getter,
  recipes,
  digits = 3,
  bold = false,
}: {
  label: string;
  unit?: string;
  getter: (r: any) => number | undefined | null;
  recipes: any[];
  digits?: number;
  bold?: boolean;
}) {
  return (
    <tr style={{ borderTop: "1px solid #f1f5f9" }}>
      <td
        style={{
          padding: "6px 10px",
          fontSize: 12,
          color: "#475569",
          fontWeight: bold ? 600 : 400,
          lineHeight: 1.4,
        }}
      >
        {label}
        {unit && (
          <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 3 }}>
            ({unit})
          </span>
        )}
      </td>
      {recipes.map((r, i) => (
        <td
          key={i}
          style={{
            padding: "6px 8px",
            textAlign: "right",
            fontSize: 12.5,
            fontVariantNumeric: "tabular-nums",
            fontWeight: bold ? 700 : 400,
            color: bold ? RECIPE_COLORS[i] : "#0f172a",
          }}
        >
          {fmt(getter(r), digits)}
        </td>
      ))}
    </tr>
  );
}

/* ── Excel export ── */
async function exportToExcel(
  recipes: any[],
  general: any,
  binderName: (n: 1 | 2 | 3) => string,
  category: string,
  method: string
) {
  const xlsx = await import("xlsx");

  const headers = ["Paramètre", "Unité", ...recipes.map((_, i) => `Recette ${i + 1}`)];

  const row = (label: string, unit: string, getter: (r: any) => number | null | undefined, digits = 3) =>
    [label, unit, ...recipes.map((r) => {
      const v = getter(r);
      return v === null || v === undefined || Number.isNaN(v) ? "" : parseFloat(v.toFixed(digits));
    })];

  const sep = (title: string) => [title, "", ...recipes.map(() => "")];

  const bcount = general.binder_count ?? 1;
  const isEssai = method === "essai";
  const isRpg = category === "RPG";

  const rows = [
    headers,
    sep("=== INFORMATIONS GÉNÉRALES ==="),
    ["Opérateur", "", general.operator_name ?? ""],
    ["Projet", "", general.project_name ?? ""],
    ["Résidu", "", general.residue_id ?? ""],
    ["Date", "", general.mix_date ?? ""],
    ["Catégorie", "", category],
    ["Méthode", "", method],

    sep("=== DONNÉES DU MÉLANGE (masses) ==="),
    row(isEssai ? "Bw% cible" : "Liant Bw%", "%", (r) => r.bw_mass_pct, 2),
    row("Liant Bv%", "% vol.", (r) => r.bv_vol_pct, 2),
    row(isEssai ? "Résidu sec (tot.)" : "Résidu sec Mr", "kg", (r) => r.components?.residue_dry_mass_kg),
    ...(isRpg ? [row("Agrégat sec Ma", "kg", (r) => r.components?.aggregate_dry_mass_kg)] : []),
    row(isEssai ? "Liant (tot.)" : "Liant Mb", "kg", (r) => r.components?.binder_total_mass_kg),
    row("Résidu humide Mr-hum", "kg", (r) => r.components?.residue_wet_mass_kg),
    row("Eau totale Mw", "kg", (r) => r.components?.water_total_mass_kg),
    row("Eau à ajouter Mw-aj", "kg", (r) => r.components?.water_to_add_mass_kg),
    ...(bcount >= 1 ? [row(`${binderName(1)} Mc1`, "kg", (r) => r.components?.binder_c1_mass_kg)] : []),
    ...(bcount >= 2 ? [row(`${binderName(2)} Mc2`, "kg", (r) => r.components?.binder_c2_mass_kg)] : []),
    ...(bcount >= 3 ? [row(`${binderName(3)} Mc3`, "kg", (r) => r.components?.binder_c3_mass_kg)] : []),
    ...(isEssai ? [
      row("Liant à rajouter Mb-ad", "kg", (r) => r.components?.binder_to_add_mass_kg),
      row(`${binderName(1)} à rajouter Mc1-ad`, "kg", (r) => r.components?.binder_c1_to_add_mass_kg),
      ...(bcount >= 2 ? [row(`${binderName(2)} à rajouter Mc2-ad`, "kg", (r) => r.components?.binder_c2_to_add_mass_kg)] : []),
      ...(bcount >= 3 ? [row(`${binderName(3)} à rajouter Mc3-ad`, "kg", (r) => r.components?.binder_c3_to_add_mass_kg)] : []),
    ] : []),

    sep("=== PARAMÈTRES GÉOTECHNIQUES ==="),
    row("Liant Bw%", "%", (r) => r.bw_mass_pct, 2),
    row("Solides Cw%", "% mass.", (r) => r.solids_mass_pct, 2),
    row("Solides Cv%", "% vol.", (r) => r.cv_vol_pct, 2),
    row("Teneur en eau w", "%", (r) => r.w_mass_pct, 2),
    row("Rapport E/C", "", (r) => r.wc_ratio, 3),
    row("Saturation Sr", "%", (r) => r.saturation_pct, 1),

    sep("=== MASSES VOLUMIQUES ==="),
    row("ρ humide ρ_h", "g/cm³", (r) => toGcm3(r.bulk_density_kg_m3)),
    row("ρ sèche ρ_d", "g/cm³", (r) => toGcm3(r.dry_density_kg_m3)),
    row("γ humide γ_h", "kN/m³", (r) => r.bulk_unit_weight_kN_m3, 2),
    row("γ sèche γ_d", "kN/m³", (r) => r.dry_unit_weight_kN_m3, 2),

    sep("=== INDICES DES VIDES & STRUCTURE ==="),
    row("Indice des vides e", "", (r) => r.void_ratio),
    row("Porosité n", "", (r) => r.porosity),
    row("Teneur eau vol. θ", "%", (r) => r.theta_pct, 2),
    row("Gs remblai", "", (r) => r.gs_backfill),
    row("Gs liant", "", (r) => r.gs_binder),

    sep("=== VOLUMES ==="),
    row("Volume moule V_moule", "L", (r) => toLiters(r.container_volume_m3), 4),
    row("Volume total V_T", "L", (r) => toLiters(r.total_backfill_volume_m3), 4),
    row("Volume solide V_s", "L", (r) => toLiters(r.solid_volume_m3), 4),
    row("Volume vides V_v", "L", (r) => toLiters(r.void_volume_m3), 4),
    row("Volume r?sidu V_r", "L", (r) => toLiters(r.residue_volume_m3), 4),
    row("Volume liant V_b", "L", (r) => toLiters(r.binder_volume_m3), 4),
    row("Volume eau V_w", "L", (r) => toLiters(r.water_volume_m3), 4),

    sep("=== FULL RESULTS / RESULTATS COMPLETS ==="),
    row("Masse rejet sec totale M_r_sec_tot", "kg", (r) => masseRejetSecTotaleKg(r), 6),
    row("Masse solides totale M_s", "kg", (r) => masseSolidesTotaleKg(r), 6),
    row("Masse remblai totale M_t", "kg", (r) => masseRemblaiTotaleKg(r), 6),
    row("Eau contenue dans residu M_w-res", "kg", (r) => masseEauDansResidusKg(r), 6),
    row("Masse eau a ajouter/retirer M_w-aj", "kg", (r) => r.components?.water_to_add_mass_kg, 6),
    row("Masse remblai totale M_t", "g", (r) => toGrams(masseRemblaiTotaleKg(r)), 2),
    row("Volume air V_air", "L", (r) => toLiters(volumeAirM3(r)), 4),
    row("Cw calcule (depuis masses)", "%", (r) => cwCalculePct(r), 4),
    row("Cv calcule (depuis volumes)", "%", (r) => cvCalculePct(r), 4),
  ];

  const ws = xlsx.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [{ wch: 32 }, { wch: 10 }, ...recipes.map(() => ({ wch: 16 }))];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Résultats");

  const filename = `minebackfill_${category}_${method}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  xlsx.writeFile(wb, filename);
}

export default function ResultsPanel({ isMaximized = false }: { isMaximized?: boolean }) {
  const store = useStore() as any;
  const { category, method, general = {}, cw = {}, wb = {}, slump = {}, essai = {}, rpgCw = {}, rpgWb = {}, rpgEssai = {} as any } = store;
  const catalogue_liants: any[] = store.catalogue_liants ?? [];

  const binderName = (n: 1 | 2 | 3): string => {
    const code = general[`binder${n}_type`];
    if (!code) return `Ciment ${n}`;
    return catalogue_liants.find((l) => l.code === code)?.nom ?? `Ciment ${n}`;
  };

  const cwResult = store.cwResult;
  const wbResult = store.wbResult;
  const slumpResult = store.slumpResult;
  const essaiResult = store.essaiResult;
  const rpgCwResult = store.rpgCwResult;
  const rpgWbResult = store.rpgWbResult;
  const rpgEssaiResult = store.rpgEssaiResult;

  const isRpg = category === "RPG";
  const isEssai = method === "essai";

  const result = isRpg
    ? method === "wb" ? rpgWbResult : method === "essai" ? rpgEssaiResult : rpgCwResult
    : method === "wb"
    ? wbResult
    : method === "slump"
    ? slumpResult
    : method === "essai"
    ? essaiResult
    : cwResult;

  const allRecipes: any[] = Array.isArray(result?.recipes) ? result.recipes : [];
  const recipes = allRecipes.filter(Boolean);

  const desiredQty = isRpg
    ? method === "wb"
      ? rpgWb.desired_qty
      : method === "essai"
      ? (rpgEssai.base_method === "wb" ? rpgWb.desired_qty : rpgCw.desired_qty)
      : rpgCw.desired_qty
    : method === "wb"
    ? wb.desired_qty
    : method === "slump"
    ? slump.desired_qty
    : method === "essai"
    ? essai.base_method === "dosage_cw"
      ? cw.desired_qty
      : wb.desired_qty
    : cw.desired_qty;

  /* ── Empty state ── */
  if (recipes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 32,
          textAlign: "center",
          gap: 14,
          color: "var(--muted-foreground)",
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="20" width="8" height="18" rx="2" fill="#cbd5e1" />
          <rect x="18" y="12" width="8" height="26" rx="2" fill="#94a3b8" />
          <rect x="32" y="6" width="8" height="32" rx="2" fill="#64748b" />
        </svg>
        <div>
          <p style={{ fontWeight: 600, fontSize: 14, color: "#374151", margin: 0 }}>
            Résultats de calcul
          </p>
          <p style={{ fontSize: 12.5, maxWidth: 220, marginTop: 6, lineHeight: 1.5 }}>
            Renseignez les paramètres et cliquez sur{" "}
            <strong>Lancer le calcul</strong> pour afficher les résultats ici.
          </p>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  return (
    <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Project Banner ── */}
      <div style={{ padding: "0 14px 0" }}>
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--muted-foreground)",
              marginBottom: 6,
            }}
          >
            {isRpg ? "RPG (PAF)" : "RPC"} — {recipes.length} recette{recipes.length > 1 ? "s" : ""}
            {isEssai ? " (ajustées)" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
            {general.residue_id && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Résidu : </span>
                {general.residue_id}
              </span>
            )}
            {general.operator_name && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Opérateur : </span>
                {general.operator_name}
              </span>
            )}
            {desiredQty !== undefined && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Qté : </span>
                {desiredQty} moule{desiredQty > 1 ? "s" : ""}
              </span>
            )}
            {general.mix_date && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Date : </span>
                {general.mix_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Recipe summary pills ── */}
      <div style={{ padding: "0 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {recipes.map((r, i) => (
          <div
            key={i}
            style={{
              border: `1.5px solid ${RECIPE_COLORS[i]}`,
              borderRadius: 7,
              padding: "5px 12px",
              background: `${RECIPE_COLORS[i]}10`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: RECIPE_COLORS[i],
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Recette {i + 1}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              Bw {fmt(r.bw_mass_pct, 1)} %
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Cw {fmt(r.solids_mass_pct, 1)} % · e {fmt(r.void_ratio, 3)}
            </div>
          </div>
        ))}

        {/* ── Export button ── */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <button
            onClick={() => exportToExcel(recipes, general, binderName, category, method)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              border: "1px solid #16a34a",
              borderRadius: 7,
              background: "#f0fdf4",
              color: "#15803d",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v8M3 6l3.5 3.5L10 6M2 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Exporter Excel
          </button>
        </div>
      </div>

      {/* ── Sections 1–5 : grid when maximized, flex column otherwise ── */}
      <div
        style={
          isMaximized
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 14px" }
            : { display: "flex", flexDirection: "column", gap: 12, padding: "0 14px" }
        }
      >
        {/* ── 1. Données du mélange ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.mix.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.mix.bg,
          }}
        >
          <SectionHeader
            title={isEssai ? "Données du mélange ajusté" : "Données du mélange"}
            sub="masses en kg"
            color={SECTIONS.mix}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.mix.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label={isEssai ? "Bw% cible" : "Liant Bw%"}
                unit="%"
                getter={(r) => r.bw_mass_pct}
                recipes={recipes}
                digits={2}
                bold
              />
              <DataRow
                label="Liant Bv%"
                unit="% vol."
                getter={(r) => r.bv_vol_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label={isEssai ? "Résidu sec (tot.)" : "Résidu sec Mr"}
                unit="kg"
                getter={(r) => r.components?.residue_dry_mass_kg}
                recipes={recipes}
                bold
              />
              {isRpg && (
                <DataRow
                  label="Agrégat sec Ma"
                  unit="kg"
                  getter={(r) => r.components?.aggregate_dry_mass_kg}
                  recipes={recipes}
                  bold
                />
              )}
              <DataRow
                label={isEssai ? "Liant (tot.)" : "Liant Mb"}
                unit="kg"
                getter={(r) => r.components?.binder_total_mass_kg}
                recipes={recipes}
                bold
              />
              <DataRow
                label="Résidu humide Mr-hum"
                unit="kg"
                getter={(r) => r.components?.residue_wet_mass_kg}
                recipes={recipes}
              />
              <DataRow
                label="Eau totale Mw"
                unit="kg"
                getter={(r) => r.components?.water_total_mass_kg}
                recipes={recipes}
              />
              <DataRow
                label="Eau à ajouter Mw-aj"
                unit="kg"
                getter={(r) => r.components?.water_to_add_mass_kg}
                recipes={recipes}
              />
              {(general.binder_count ?? 1) >= 1 && (
                <DataRow
                  label={`${binderName(1)} Mc1`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c1_mass_kg}
                  recipes={recipes}
                />
              )}
              {(general.binder_count ?? 1) >= 2 && (
                <DataRow
                  label={`${binderName(2)} Mc2`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c2_mass_kg}
                  recipes={recipes}
                />
              )}
              {(general.binder_count ?? 1) >= 3 && (
                <DataRow
                  label={`${binderName(3)} Mc3`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c3_mass_kg}
                  recipes={recipes}
                />
              )}
              {isEssai && (
                <>
                  <DataRow
                    label="Liant à rajouter Mb-ad"
                    unit="kg"
                    getter={(r) => r.components?.binder_to_add_mass_kg}
                    recipes={recipes}
                  />
                  <DataRow
                    label={`${binderName(1)} — à rajouter`}
                    unit="kg"
                    getter={(r) => r.components?.binder_c1_to_add_mass_kg}
                    recipes={recipes}
                  />
                  {(general.binder_count ?? 1) >= 2 && (
                    <DataRow
                      label={`${binderName(2)} — à rajouter`}
                      unit="kg"
                      getter={(r) => r.components?.binder_c2_to_add_mass_kg}
                      recipes={recipes}
                    />
                  )}
                  {(general.binder_count ?? 1) >= 3 && (
                    <DataRow
                      label={`${binderName(3)} — à rajouter`}
                      unit="kg"
                      getter={(r) => r.components?.binder_c3_to_add_mass_kg}
                      recipes={recipes}
                    />
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 2. Géotechnique 1 : Cw, Cv, w, w/c, Sr ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo1.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo1.bg,
          }}
        >
          <SectionHeader
            title="Paramètres géotechniques"
            sub="pourcentages & rapports"
            color={SECTIONS.geo1}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo1.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label="Liant Bw%"
                unit="%"
                getter={(r) => r.bw_mass_pct}
                recipes={recipes}
                digits={2}
                bold
              />
              <DataRow
                label="Solides Cw%"
                unit="% mass."
                getter={(r) => r.solids_mass_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="Solides Cv%"
                unit="% vol."
                getter={(r) => r.cv_vol_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="Teneur en eau w"
                unit="%"
                getter={(r) => r.w_mass_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="Rapport E/C"
                getter={(r) => r.wc_ratio}
                recipes={recipes}
                digits={3}
              />
              <DataRow
                label="Saturation Sr"
                unit="%"
                getter={(r) => r.saturation_pct}
                recipes={recipes}
                digits={1}
              />
            </tbody>
          </table>
        </div>

        {/* ── 3. Masses volumiques ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo2.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo2.bg,
          }}
        >
          <SectionHeader
            title="Masses volumiques"
            sub="densités et poids volumiques"
            color={SECTIONS.geo2}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo2.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label="ρ humide ρ_h"
                unit="g/cm³"
                getter={(r) => toGcm3(r.bulk_density_kg_m3)}
                recipes={recipes}
                bold
              />
              <DataRow
                label="ρ sèche ρ_d"
                unit="g/cm³"
                getter={(r) => toGcm3(r.dry_density_kg_m3)}
                recipes={recipes}
                bold
              />
              <DataRow
                label="γ humide γ_h"
                unit="kN/m³"
                getter={(r) => r.bulk_unit_weight_kN_m3}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="γ sèche γ_d"
                unit="kN/m³"
                getter={(r) => r.dry_unit_weight_kN_m3}
                recipes={recipes}
                digits={2}
              />
            </tbody>
          </table>
        </div>

        {/* ── 4. Indices des vides & structure ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo3.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo3.bg,
          }}
        >
          <SectionHeader
            title="Indices des vides & structure"
            sub="indice des vides, porosité, Gs"
            color={SECTIONS.geo3}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo3.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label="Indice des vides e"
                getter={(r) => r.void_ratio}
                recipes={recipes}
                bold
              />
              <DataRow
                label="Porosité n"
                getter={(r) => r.porosity}
                recipes={recipes}
              />
              <DataRow
                label="Teneur eau vol. θ"
                unit="%"
                getter={(r) => r.theta_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="Gs remblai"
                getter={(r) => r.gs_backfill}
                recipes={recipes}
              />
              <DataRow
                label="Gs liant"
                getter={(r) => r.gs_binder}
                recipes={recipes}
              />
            </tbody>
          </table>
        </div>

        {/* ── 5. Volumes ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.vols.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.vols.bg,
            ...(isMaximized ? { gridColumn: "1 / -1" } : {}),
          }}
        >
          <SectionHeader
            title="Volumes"
            sub="en litres (L)"
            color={SECTIONS.vols}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.vols.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label="Volume moule V_moule"
                unit="L"
                getter={(r) => toLiters(r.container_volume_m3)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Volume total V_T"
                unit="L"
                getter={(r) => toLiters(r.total_backfill_volume_m3)}
                recipes={recipes}
                digits={4}
                bold
              />
              <DataRow
                label="Volume solide V_s"
                unit="L"
                getter={(r) => toLiters(r.solid_volume_m3)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Volume vides V_v"
                unit="L"
                getter={(r) => toLiters(r.void_volume_m3)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Volume résidu V_r"
                unit="L"
                getter={(r) => toLiters(r.residue_volume_m3)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Volume liant V_b"
                unit="L"
                getter={(r) => toLiters(r.binder_volume_m3)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Volume eau V_w"
                unit="L"
                getter={(r) => toLiters(r.water_volume_m3)}
                recipes={recipes}
                digits={4}
              />
            </tbody>
          </table>
        </div>

        {/* â”€â”€ 6. Full Results / RÃ©sultats complets â”€â”€ */}
        <div
          style={{
            border: `1px solid ${SECTIONS.mix.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: "#f8fafc",
            ...(isMaximized ? { gridColumn: "1 / -1" } : {}),
          }}
        >
          <SectionHeader
            title="Full Results / Resultats complets"
            sub="masses et volumes detailles (style Excel)"
            color={SECTIONS.mix}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.mix.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label="Masse rejet sec totale M_r_sec_tot"
                unit="kg"
                getter={(r) => masseRejetSecTotaleKg(r)}
                recipes={recipes}
                digits={6}
                bold
              />
              <DataRow
                label="Masse solides totale M_s"
                unit="kg"
                getter={(r) => masseSolidesTotaleKg(r)}
                recipes={recipes}
                digits={6}
                bold
              />
              <DataRow
                label="Masse eau totale M_w"
                unit="kg"
                getter={(r) => r.components?.water_total_mass_kg}
                recipes={recipes}
                digits={6}
              />
              <DataRow
                label="Masse remblai totale M_t"
                unit="kg"
                getter={(r) => masseRemblaiTotaleKg(r)}
                recipes={recipes}
                digits={6}
              />
              <DataRow
                label="Masse eau dans residu M_w-res"
                unit="kg"
                getter={(r) => masseEauDansResidusKg(r)}
                recipes={recipes}
                digits={6}
              />
              <DataRow
                label="Masse eau a ajouter / retirer M_w-aj"
                unit="kg"
                getter={(r) => r.components?.water_to_add_mass_kg}
                recipes={recipes}
                digits={6}
              />
              <DataRow
                label="Masse remblai totale M_t"
                unit="g"
                getter={(r) => toGrams(masseRemblaiTotaleKg(r))}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label="Volume air V_air"
                unit="L"
                getter={(r) => toLiters(volumeAirM3(r))}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Cw calcule (depuis masses)"
                unit="%"
                getter={(r) => cwCalculePct(r)}
                recipes={recipes}
                digits={4}
              />
              <DataRow
                label="Cv calcule (depuis volumes)"
                unit="%"
                getter={(r) => cvCalculePct(r)}
                recipes={recipes}
                digits={4}
              />
            </tbody>
          </table>
        </div>

      </div> {/* end sections wrapper */}

      {/* bottom padding */}
      <div style={{ height: 16 }} />
    </div>
  );
}
