"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useStore } from "@/lib/store";

const CONTAINER_TYPES = [
  { value: "section_hauteur", label: "Section + hauteur" },
  { value: "rayon_hauteur", label: "Rayon + hauteur" },
  { value: "longueur_largeur_hauteur", label: "Longueur × largeur × hauteur" },
] as const;

export default function GeneralInfoPage() {
  const router = useRouter();
  const {
    general,
    setGeneral,
    catalogue_liants,
  } = useStore() as any;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    router.push("/mix");
  };

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
    setGeneral({ [field]: value === "" ? undefined : Number(value) });
  };

  const fractionTotal =
    (general.binder1_fraction_pct ?? 0) +
    (general.binder2_fraction_pct ?? 0) +
    (general.binder3_fraction_pct ?? 0);

  const fractionOk = Math.abs(fractionTotal - 100) < 0.01;

  const liantsValides = catalogue_liants.filter((l: any) => String(l.code ?? "").trim() !== "");

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            Informations générales
          </h1>
          <p style={{ color: "var(--muted-foreground)", marginTop: 4, fontSize: 13.5 }}>
            Renseignez les paramètres du projet et du liant. Les constantes sont sur la page{" "}
            <Link href="/reglages" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>Réglages</Link>.
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="form-card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>1 — Identification du projet</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Nom de l'opérateur
                </label>
                <input
                  type="text"
                  className="field-input"
                  value={general.operator_name ?? ""}
                  onChange={(e) => setGeneral({ operator_name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Nom du projet
                </label>
                <input
                  type="text"
                  className="field-input"
                  value={general.project_name ?? ""}
                  onChange={(e) => setGeneral({ project_name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Identification du résidu
                </label>
                <input
                  type="text"
                  className="field-input"
                  value={general.residue_id ?? ""}
                  onChange={(e) => setGeneral({ residue_id: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Date de mélange
                </label>
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

          <div className="form-card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>2 — Contenant pour le moulage</h2>

            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              {CONTAINER_TYPES.map((ct) => {
                const active = general.container_type === ct.value;
                return (
                  <label
                    key={ct.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
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
                    {ct.label}
                  </label>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 16px" }}>
              {general.container_type === "section_hauteur" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Section (cm2)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_section ?? ""}
                      onChange={(e) => numChange("container_section", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Hauteur (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_height ?? ""}
                      onChange={(e) => numChange("container_height", e.target.value)}
                    />
                  </div>
                </>
              )}

              {general.container_type === "rayon_hauteur" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Rayon (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_radius ?? ""}
                      onChange={(e) => numChange("container_radius", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Hauteur (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_height ?? ""}
                      onChange={(e) => numChange("container_height", e.target.value)}
                    />
                  </div>
                </>
              )}

              {general.container_type === "longueur_largeur_hauteur" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Longueur (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_length ?? ""}
                      onChange={(e) => numChange("container_length", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Largeur (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_width ?? ""}
                      onChange={(e) => numChange("container_width", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                      Hauteur (cm)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={general.container_height ?? ""}
                      onChange={(e) => numChange("container_height", e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>3 — Système liant hydraulique</h2>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
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
                        height: 36,
                        borderRadius: 7,
                        border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary)" : "#fff",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 14,
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

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((idx) => {
                if (idx > (general.binder_count ?? 1)) return null;
                const typeKey = `binder${idx}_type` as any;
                const fracKey = `binder${idx}_fraction_pct` as any;
                return (
                  <div key={idx} style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10 }}>Ciment {idx}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                          Type de liant
                        </label>
                        <select
                          className="field-input"
                          value={general[typeKey] ?? ""}
                          onChange={(e) => setGeneral({ [typeKey]: e.target.value || null })}
                        >
                          <option value="">Sélectionner...</option>
                          {liantsValides.map((liant: any) => (
                            <option key={liant.id} value={liant.code}>
                              {liant.nom} ({liant.code}) - Gs {Number(liant.gs).toFixed(4)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                          Fraction (%)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          className="field-input"
                          value={general[fracKey] ?? ""}
                          onChange={(e) => numChange(fracKey, e.target.value)}
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
                  marginTop: 14,
                  padding: "9px 14px",
                  borderRadius: 7,
                  background: fractionOk ? "#ecfdf5" : "#fffbeb",
                  border: `1px solid ${fractionOk ? "#6ee7b7" : "#fcd34d"}`,
                  fontSize: 12.5,
                  color: fractionOk ? "#047857" : "#b45309",
                  fontWeight: 500,
                }}
              >
                Total des fractions : <strong>{fractionTotal.toFixed(1)} %</strong>
                {!fractionOk && " — doit être égal à 100 %"}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 12.5 }}>
                Pour modifier les constantes et le catalogue des liants, ouvrez la page dédiée.
              </p>
              <Link
                href="/reglages"
                className="btn-secondary"
                style={{ textDecoration: "none", whiteSpace: "nowrap" }}
              >
                Réglages des constantes
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 8,
            }}
          >
            <Link
              href="/mix"
              style={{
                padding: "9px 18px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                fontSize: 13.5,
                fontWeight: 500,
                color: "#374151",
                textDecoration: "none",
                background: "#fff",
              }}
            >
              Ignorer et aller aux calculs
            </Link>
            <button type="submit" className="btn-primary" style={{ padding: "9px 24px" }}>
              Enregistrer et continuer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
