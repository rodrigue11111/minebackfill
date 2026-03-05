"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect } from "react";
import { useStore } from "@/lib/store";
import {
  fromStoreLength, toStoreLength,
  fromStoreArea, toStoreArea,
  LENGTH_LABELS, AREA_LABELS,
} from "@/lib/units";

const CONTAINER_TYPES = [
  { value: "section_hauteur", label: "Section + hauteur" },
  { value: "rayon_hauteur", label: "Rayon + hauteur" },
  { value: "longueur_largeur_hauteur", label: "Longueur x largeur x hauteur" },
] as const;

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
};

export default function GeneralInfoPage() {
  const router = useRouter();
  const { general, setGeneral, catalogue_liants, fillTestData, units, loadUnits } = useStore() as any;

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    router.push("/mix");
  };

  const lengthLabel = LENGTH_LABELS[units.length as keyof typeof LENGTH_LABELS] ?? "cm";
  const areaLabel = AREA_LABELS[units.area as keyof typeof AREA_LABELS] ?? "cm\u00B2";

  const dimFields = new Set(["container_height", "container_radius", "container_length", "container_width"]);

  const numChange = (
    field:
      | "container_section"
      | "container_height"
      | "container_radius"
      | "container_length"
      | "container_width"
      | "binder1_fraction_pct"
      | "binder2_fraction_pct"
      | "binder3_fraction_pct",
    value: string
  ) => {
    if (value === "") {
      setGeneral({ [field]: undefined });
    } else if (field === "container_section") {
      setGeneral({ [field]: toStoreArea(Number(value), units.area) });
    } else if (dimFields.has(field)) {
      setGeneral({ [field]: toStoreLength(Number(value), units.length) });
    } else {
      setGeneral({ [field]: Number(value) });
    }
  };

  const fractionTotal =
    (general.binder1_fraction_pct ?? 0) +
    (general.binder2_fraction_pct ?? 0) +
    (general.binder3_fraction_pct ?? 0);

  const fractionOk = Math.abs(fractionTotal - 100) < 0.01;
  const liantsValides = catalogue_liants.filter((l: any) => String(l.code ?? "").trim() !== "");

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>

      {/* ── Hero banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--navy) 0%, #1a3a8a 100%)",
          padding: "28px 0 24px",
          borderBottom: "3px solid var(--primary)",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Etape 01 — Configuration du projet
              </div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Informations generales
              </h1>
              <p
                style={{
                  color: "rgba(255,255,255,0.6)",
                  marginTop: 6,
                  fontSize: 13.5,
                  maxWidth: 520,
                }}
              >
                Renseignez l&apos;identification du projet, la geometrie du contenant de moulage
                et le systeme liant. Ces informations apparaitront dans l&apos;export Excel.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <Link
                href="/guide"
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.25)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.8)",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                Guide d&apos;utilisation
              </Link>
              <Link
                href="/mix"
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                Ignorer
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 24px 64px" }}>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── 1. Identification ── */}
          <div className="form-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                Identification du projet
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
              <div>
                <label style={LABEL}>Nom de l&apos;operateur</label>
                <input
                  type="text"
                  className="field-input"
                  value={general.operator_name ?? ""}
                  onChange={(e) => setGeneral({ operator_name: e.target.value })}
                  placeholder="Ex. : J. Dupont"
                />
              </div>
              <div>
                <label style={LABEL}>Nom du projet</label>
                <input
                  type="text"
                  className="field-input"
                  value={general.project_name ?? ""}
                  onChange={(e) => setGeneral({ project_name: e.target.value })}
                  placeholder="Ex. : Mine LaRonde"
                />
              </div>
              <div>
                <label style={LABEL}>Identification du residu</label>
                <input
                  type="text"
                  className="field-input"
                  value={general.residue_id ?? ""}
                  onChange={(e) => setGeneral({ residue_id: e.target.value })}
                  placeholder="Ex. : R-2024-A"
                />
              </div>
              <div>
                <label style={LABEL}>Date de melange</label>
                <input
                  type="date"
                  className="field-input"
                  style={{ maxWidth: 220 }}
                  value={general.mix_date ?? ""}
                  onChange={(e) => setGeneral({ mix_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ── 2. Container ── */}
          <div className="form-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                Contenant pour le moulage
              </h2>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {CONTAINER_TYPES.map((ct) => {
                const active = general.container_type === ct.value;
                return (
                  <label
                    key={ct.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 7,
                      border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      background: active ? "var(--primary-light)" : "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--primary)" : "#374151",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="container_type"
                      value={ct.value}
                      checked={active}
                      onChange={() => setGeneral({ container_type: ct.value })}
                      style={{ display: "none" }}
                    />
                    {/* Custom radio dot */}
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: `2px solid ${active ? "var(--primary)" : "#cbd5e1"}`,
                        background: active ? "var(--primary)" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#fff",
                            display: "block",
                          }}
                        />
                      )}
                    </span>
                    {ct.label}
                  </label>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 16px" }}>
              {general.container_type === "section_hauteur" && (
                <>
                  <div>
                    <label style={LABEL}>Section ({areaLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreArea(general.container_section, units.area) ?? ""} onChange={(e) => numChange("container_section", e.target.value)} placeholder="Ex. : 80.45" />
                  </div>
                  <div>
                    <label style={LABEL}>Hauteur ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_height, units.length) ?? ""} onChange={(e) => numChange("container_height", e.target.value)} placeholder="Ex. : 20.5" />
                  </div>
                </>
              )}
              {general.container_type === "rayon_hauteur" && (
                <>
                  <div>
                    <label style={LABEL}>Rayon ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_radius, units.length) ?? ""} onChange={(e) => numChange("container_radius", e.target.value)} placeholder="Ex. : 5.0625" />
                  </div>
                  <div>
                    <label style={LABEL}>Hauteur ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_height, units.length) ?? ""} onChange={(e) => numChange("container_height", e.target.value)} placeholder="Ex. : 20.5" />
                  </div>
                </>
              )}
              {general.container_type === "longueur_largeur_hauteur" && (
                <>
                  <div>
                    <label style={LABEL}>Longueur ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_length, units.length) ?? ""} onChange={(e) => numChange("container_length", e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL}>Largeur ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_width, units.length) ?? ""} onChange={(e) => numChange("container_width", e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL}>Hauteur ({lengthLabel})</label>
                    <input type="number" step="any" className="field-input" value={fromStoreLength(general.container_height, units.length) ?? ""} onChange={(e) => numChange("container_height", e.target.value)} />
                  </div>
                </>
              )}
              {!general.container_type && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "12px 16px",
                    borderRadius: 7,
                    background: "var(--primary-light)",
                    border: "1px solid var(--primary-mid)",
                    fontSize: 13,
                    color: "var(--primary)",
                  }}
                >
                  Selectionnez un type de contenant ci-dessus pour saisir les dimensions.
                </div>
              )}
            </div>
          </div>

          {/* ── 3. Binder system ── */}
          <div className="form-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                Systeme liant hydraulique
              </h2>
            </div>

            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                Nombre de composants du liant
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3].map((n) => {
                  const active = general.binder_count === n;
                  return (
                    <label
                      key={n}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 38,
                        borderRadius: 7,
                        border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary)" : "#fff",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 15,
                        color: active ? "#fff" : "#374151",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="radio"
                        name="binder_count"
                        value={n}
                        checked={active}
                        onChange={() => setGeneral({ binder_count: n as 1 | 2 | 3 })}
                        style={{ display: "none" }}
                      />
                      {n}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((idx) => {
                if (idx > (general.binder_count ?? 1)) return null;
                const typeKey = `binder${idx}_type` as any;
                const fracKey = `binder${idx}_fraction_pct` as any;
                return (
                  <div
                    key={idx}
                    style={{
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-mid)",
                      borderRadius: 8,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--primary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 10,
                      }}
                    >
                      Composant {idx}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ ...LABEL, color: "#374151" }}>Type de liant</label>
                        <select
                          className="field-input"
                          value={general[typeKey] ?? ""}
                          onChange={(e) => setGeneral({ [typeKey]: e.target.value || null })}
                        >
                          <option value="">Selectionner...</option>
                          {liantsValides.map((liant: any) => (
                            <option key={liant.id} value={liant.code}>
                              {liant.nom} ({liant.code}) — Gs {Number(liant.gs).toFixed(4)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL}>Fraction (%)</label>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          className="field-input"
                          value={general[fracKey] ?? ""}
                          onChange={(e) => numChange(fracKey, e.target.value)}
                          placeholder={`Ex. : ${idx === 1 ? 60 : 40}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(general.binder_count ?? 1) >= 2 && (
              <div
                style={{
                  marginTop: 12,
                  padding: "9px 14px",
                  borderRadius: 7,
                  background: fractionOk ? "var(--success-light)" : "var(--warning-light)",
                  border: `1px solid ${fractionOk ? "#6ee7b7" : "#fcd34d"}`,
                  fontSize: 12.5,
                  color: fractionOk ? "var(--success)" : "var(--warning)",
                  fontWeight: 500,
                }}
              >
                Total des fractions : <strong>{fractionTotal.toFixed(1)} %</strong>
                {!fractionOk && " — la somme doit etre egale a 100 %"}
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 12.5 }}>
                Catalogue des liants et constantes physiques : page Reglages.
              </p>
              <Link href="/reglages" className="btn-secondary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                Reglages des constantes
              </Link>
            </div>
          </div>

          {/* ── Actions ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { fillTestData(); router.push("/mix"); }}
              style={{ padding: "10px 20px", fontSize: 14 }}
            >
              Valeurs de test
            </button>
            <button type="submit" className="btn-primary" style={{ padding: "10px 28px", fontSize: 14 }}>
              Enregistrer et continuer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
