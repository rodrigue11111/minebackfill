"use client";

import React from "react";
import { useStore } from "@/lib/store";
import type { IndustrieCostResult } from "@/lib/store";
import { fromStoreMass, MASS_LABELS, fromStoreVolume, VOLUME_LABELS } from "@/lib/units";
import dynamic from "next/dynamic";

const RechartsLineChart = dynamic(
  () => import("recharts").then((mod) => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = mod;
    return function TrendChart({ data }: { data: { date: string; cost_per_m3: number }[] }) {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(2)} $/m3`, "Cout"]}
            />
            <Line type="monotone" dataKey="cost_per_m3" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} />
          </LineChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chargement du graphique...</div> }
);

const fmt = (v: number | undefined | null, digits = 2) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

const SECTION_BORDER = "#e2e8f0";

export default function CostDashboard() {
  const store = useStore() as any;
  const { industrieResults, productionLog, units } = store;
  const results: IndustrieCostResult[] = industrieResults || [];

  const massLabel = MASS_LABELS[units?.mass as keyof typeof MASS_LABELS] ?? "kg";
  const volLabel = VOLUME_LABELS[units?.volume as keyof typeof VOLUME_LABELS] ?? "L";

  if (results.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: "0 auto 14px" }} aria-hidden="true">
          <rect x="4" y="20" width="8" height="18" rx="2" fill="#cbd5e1" />
          <rect x="18" y="12" width="8" height="26" rx="2" fill="#94a3b8" />
          <rect x="32" y="6" width="8" height="32" rx="2" fill="#64748b" />
        </svg>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
          Aucun resultat
        </p>
        <p style={{ fontSize: 13, maxWidth: 320, margin: "0 auto" }}>
          Renseignez les parametres de production et cliquez sur <strong>Calculer les couts</strong> pour afficher la comparaison.
        </p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => a.cost_per_m3 - b.cost_per_m3);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  const savings = mostExpensive.cost_per_m3 - cheapest.cost_per_m3;

  // Trend data from production log
  const trendData = (productionLog || [])
    .slice()
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((e: any) => ({ date: e.date, cost_per_m3: e.cost_per_m3 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bw% optimal</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{fmt(cheapest.bw_pct, 1)} %</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Cout le plus bas</div>
        </div>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cout minimal</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{fmt(cheapest.cost_per_m3)} $/m3</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>a Bw% = {fmt(cheapest.bw_pct, 1)} %</div>
        </div>
        <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Economies potentielles</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706", marginTop: 4 }}>{fmt(savings)} $/m3</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>vs Bw% = {fmt(mostExpensive.bw_pct, 1)} %</div>
        </div>
      </div>

      {/* Cost table */}
      <div style={{ background: "#fff", border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${SECTION_BORDER}`, background: "#f8fafc" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#374151" }}>Comparaison des couts par Bw%</span>
        </div>
        <table className="result-table" style={{ background: "#fff" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Bw%</th>
              <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Liant Mb ({massLabel})</th>
              <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Cout liant ($)</th>
              <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Cout/m3 ($/m3)</th>
              <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Cout/t ($/t)</th>
              <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>E/C</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isCheapest = r.bw_pct === cheapest.bw_pct;
              return (
                <tr key={i} style={{ background: isCheapest ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "8px 14px", fontSize: 14, fontWeight: isCheapest ? 700 : 500, color: isCheapest ? "#16a34a" : "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(r.bw_pct, 1)} %
                    {isCheapest && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginLeft: 6, background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>OPTIMAL</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(fromStoreMass(r.recipe?.components?.binder_total_mass_kg, units?.mass), 3)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums", fontWeight: isCheapest ? 700 : 500, color: isCheapest ? "#16a34a" : "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(r.binder_cost, 2)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums", fontWeight: isCheapest ? 700 : 500, color: isCheapest ? "#16a34a" : "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(r.cost_per_m3, 2)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(r.cost_per_tonne, 2)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#0f172a", borderBottom: "1px solid #f1f5f9" }}>
                    {fmt(r.recipe?.wc_ratio, 3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Trend chart */}
      {trendData.length >= 2 && (
        <div style={{ background: "#fff", border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${SECTION_BORDER}`, background: "#f8fafc" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#374151" }}>Evolution des couts dans le temps</span>
          </div>
          <div style={{ padding: 16 }}>
            <RechartsLineChart data={trendData} />
          </div>
        </div>
      )}
    </div>
  );
}
