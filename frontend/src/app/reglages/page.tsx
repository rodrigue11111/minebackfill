"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { UNIT_CATEGORIES, unitsForLength, type LengthUnit } from "@/lib/units";
import type { LiantCatalogueItem } from "@/lib/store";
import { estOfficiel } from "@/lib/materials";
import MaterialCatalogueCard from "@/components/MaterialCatalogueCard";
import BackupButtons from "@/components/BackupButtons";

export default function ReglagesPage() {
  const {
    constantes,
    setConstantes,
    catalogue_liants,
    ajouterLiant,
    modifierLiant,
    supprimerLiant,
    restaurerLiantsOfficiels,
    units,
    setUnits,
    loadUnits,
  } = useStore();

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const codesDupliques = useMemo(() => {
    const map = new Map<string, number>();
    for (const liant of catalogue_liants) {
      const code = String(liant.code ?? "").trim();
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return new Set(
      [...map.entries()].filter(([, n]) => n > 1).map(([code]) => code)
    );
  }, [catalogue_liants]);

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div className="form-card">
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            Réglage des constantes
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, marginBottom: 16 }}>
            Ces valeurs sont globales et sont utilisées dans les méthodes Cw%, E/C, Slump et essai-erreur.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gap: "12px 16px",
              marginBottom: 18,
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                Masse volumique de l&apos;eau (kg/m³)
              </label>
              <input
                type="number"
                step="any"
                className="field-input"
                value={constantes.masse_volumique_eau_kg_m3}
                onChange={(e) =>
                  setConstantes({ masse_volumique_eau_kg_m3: Number(e.target.value || 0) })
                }
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                Gravité g (m/s²)
              </label>
              <input
                type="number"
                step="any"
                className="field-input"
                value={constantes.gravite_m_s2}
                onChange={(e) => setConstantes({ gravite_m_s2: Number(e.target.value || 0) })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                Facteur petit cône vers grand cône
              </label>
              <input
                type="number"
                step="any"
                className="field-input"
                value={constantes.facteur_petit_cone_vers_grand_cone}
                onChange={(e) =>
                  setConstantes({
                    facteur_petit_cone_vers_grand_cone: Number(e.target.value || 0),
                  })
                }
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                Coefficient modèle slump
              </label>
              <input
                type="number"
                step="any"
                className="field-input"
                value={constantes.coefficient_modele_slump}
                onChange={(e) =>
                  setConstantes({ coefficient_modele_slump: Number(e.target.value || 0) })
                }
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                Constante modèle slump
              </label>
              <input
                type="number"
                step="any"
                className="field-input"
                value={constantes.constante_modele_slump}
                onChange={(e) =>
                  setConstantes({ constante_modele_slump: Number(e.target.value || 0) })
                }
              />
            </div>
          </div>
        </div>

        <div className="form-card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Catalogue des liants</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={restaurerLiantsOfficiels}>
                Restaurer valeurs officielles
              </button>
              <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={ajouterLiant}>
                + Ajouter un liant
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catalogue_liants.map((liant: LiantCatalogueItem, index: number) => {
              const code = String(liant.code ?? "");
              const duplique = code && codesDupliques.has(code);
              const verrou = estOfficiel(liant);
              return (
                <div
                  key={liant.id}
                  style={{
                    border: `1px solid ${duplique ? "#fecaca" : "var(--border)"}`,
                    background: duplique ? "#fef2f2" : verrou ? "#f8fafc" : "#fff",
                    borderRadius: 8,
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: "1.2fr 2fr 1fr auto",
                    gap: 8,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>
                      Code
                    </label>
                    <input
                      className="field-input"
                      value={liant.code}
                      disabled={verrou}
                      onChange={(e) =>
                        modifierLiant(index, {
                          code: String(e.target.value || "").trim().toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>
                      Nom
                    </label>
                    <input
                      className="field-input"
                      value={liant.nom}
                      disabled={verrou}
                      onChange={(e) => modifierLiant(index, { nom: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>
                      Gs
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={liant.gs}
                      disabled={verrou}
                      onChange={(e) => modifierLiant(index, { gs: Number(e.target.value || 0) })}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 }}>
                    {verrou ? (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-mid)", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        officiel
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => supprimerLiant(index)}
                        disabled={catalogue_liants.length <= 1}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {codesDupliques.size > 0 && (
            <p style={{ marginTop: 8, color: "#b91c1c", fontSize: 12.5 }}>
              Les codes de liants doivent être uniques.
            </p>
          )}

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>
              Retour Informations
            </Link>
            <Link href="/mix" className="btn-primary" style={{ textDecoration: "none" }}>
              Aller aux calculs
            </Link>
          </div>
        </div>

        {/* ── Bibliothèques de matériaux ── */}
        <MaterialCatalogueCard
          kind="residus"
          title="Bibliothèque de résidus"
          sub="Résidus miniers réutilisables : sélectionnez-les dans les formulaires pour remplir Gs et w0."
          columns={[
            { key: "nom", label: "Nom", type: "text", flex: 2 },
            { key: "gs", label: "Gs", type: "number" },
            { key: "w0_pct", label: "w0 (%)", type: "number" },
            { key: "provenance", label: "Provenance", type: "text", flex: 1.5 },
          ]}
        />
        <MaterialCatalogueCard
          kind="granulats"
          title="Bibliothèque de granulats"
          sub="Granulats pour le remblai en pâte granulaire (RPG)."
          columns={[
            { key: "nom", label: "Nom", type: "text", flex: 2 },
            { key: "gs", label: "Gs", type: "number" },
            { key: "humidite_pct", label: "Humidité (%)", type: "number" },
            { key: "fraction_defaut_pct", label: "Xg défaut (%)", type: "number" },
            { key: "provenance", label: "Provenance", type: "text", flex: 1.5 },
          ]}
        />
        <MaterialCatalogueCard
          kind="retardateurs"
          title="Bibliothèque de retardateurs"
          sub="Retardateurs de prise pour le remblai rocheux cimenté (RRC)."
          columns={[
            { key: "nom", label: "Nom", type: "text", flex: 2 },
            { key: "densite_g_ml", label: "Densité (g/ml)", type: "number" },
            { key: "dosage_d0_ml_100kg", label: "Dosage D0 (ml/100 kg)", type: "number" },
          ]}
        />

        {/* ── Unit preferences ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>
            Unités de mesure
          </h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, marginBottom: 16 }}>
            Choisissez les unités d&apos;affichage pour les entrées et les résultats. L&apos;aire et le
            volume suivent automatiquement l&apos;unité de longueur (son carré et son cube).
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: "14px 20px",
            }}
          >
            {UNIT_CATEGORIES.filter((cat) => cat.key !== "area" && cat.key !== "volume").map((cat) => (
              <div key={cat.key}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                  {cat.key === "length" ? "Longueur (aire et volume suivent)" : cat.label}
                </label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {cat.options.map((opt) => {
                    const active = units[cat.key] === opt;
                    const displayLabel = cat.labels[opt] ?? opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          cat.key === "length"
                            ? setUnits(unitsForLength(opt as LengthUnit))
                            : setUnits({ [cat.key]: opt })
                        }
                        style={{
                          padding: "5px 12px",
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 500,
                          border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                          borderRadius: 6,
                          background: active ? "var(--primary-light)" : "#fff",
                          color: active ? "var(--primary)" : "#374151",
                          cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 8 }}>Données locales</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, marginBottom: 14 }}>
            Les résultats sauvegardés, les prix des liants et le journal de production sont stockés
            dans ce navigateur uniquement. Exportez-les régulièrement pour ne rien perdre, ou pour
            les transférer sur un autre poste.
          </p>
          <BackupButtons />
        </div>
      </div>
    </div>
  );
}
