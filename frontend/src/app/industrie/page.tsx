"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import ProductionForm from "@/components/industrie/ProductionForm";
import CostDashboard from "@/components/industrie/CostDashboard";
import ProductionLog from "@/components/industrie/ProductionLog";

type Tab = "params" | "couts" | "journal";

const TABS: { id: Tab; label: string }[] = [
  { id: "params", label: "Parametres de production" },
  { id: "couts", label: "Comparaison des couts" },
  { id: "journal", label: "Journal de production" },
];

export default function IndustriePage() {
  const { general, fillTestData, loadBinderPrices, loadProductionLog, loadUnits } = useStore() as any;
  const [activeTab, setActiveTab] = useState<Tab>("params");
  const [testLoaded, setTestLoaded] = useState(false);

  useEffect(() => {
    loadBinderPrices();
    loadProductionLog();
    loadUnits();
  }, [loadBinderPrices, loadProductionLog, loadUnits]);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--background)" }}>
      {/* Hero banner */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--navy) 0%, #1a3a8a 100%)",
          padding: "24px 0 20px",
          borderBottom: "3px solid var(--primary)",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
              }}>
                Tableau de bord production
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                Industrie
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)", marginTop: 4, fontSize: 13 }}>
                {general.project_name ? `Projet : ${general.project_name}` : "Optimisation des couts et suivi de production"}
                {general.operator_name ? ` — ${general.operator_name}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  fillTestData();
                  loadBinderPrices();
                  setTestLoaded(true);
                  setTimeout(() => setTestLoaded(false), 2000);
                } catch (e) {
                  console.error("[fillTestData] industrie error:", e);
                }
              }}
              style={{
                padding: "8px 18px", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.25)",
                background: testLoaded ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                color: testLoaded ? "#86efac" : "rgba(255,255,255,0.7)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {testLoaded ? "Valeurs chargees" : "Valeurs de test"}
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", display: "flex", gap: 0 }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "12px 20px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#2563eb" : "#64748b",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.13s",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 24px 64px" }}>
        {activeTab === "params" && <ProductionForm />}
        {activeTab === "couts" && <CostDashboard />}
        {activeTab === "journal" && <ProductionLog />}
      </div>
    </div>
  );
}
