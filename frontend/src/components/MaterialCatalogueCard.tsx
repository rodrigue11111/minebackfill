"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import { estOfficiel, type MaterialKind, type MaterialItem } from "@/lib/materials";
import { materialsVersJson, materialsVersCsv, materialsDepuisFichier } from "@/lib/materials-io";

export interface MaterialColumn {
  key: string;
  label: string;
  type: "text" | "number";
  flex?: number;
}

const SLICE = {
  residus: "catalogue_residus",
  granulats: "catalogue_granulats",
  retardateurs: "catalogue_retardateurs",
} as const;

/**
 * Carte de gestion d'une bibliothèque de matériaux (résidus, granulats,
 * retardateurs). Pilotée par une liste de colonnes pour ne pas dupliquer le
 * rendu. Les entrées « officiel » sont en lecture seule (badge, champs
 * désactivés) ; l'utilisateur ajoute des entrées « perso » modifiables.
 */
export default function MaterialCatalogueCard({ kind, title, sub, columns }: {
  kind: MaterialKind;
  title: string;
  sub?: string;
  columns: MaterialColumn[];
}) {
  const store = useStore();
  const items = store[SLICE[kind]] as MaterialItem[];
  const fileRef = useRef<HTMLInputElement>(null);
  const gridCols = columns.map((c) => `${c.flex ?? 1}fr`).join(" ") + " auto";

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const imported = await materialsDepuisFichier(kind, f);
      store.importMaterials(kind, imported);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  return (
    <div className="form-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => materialsVersCsv(kind, items)}>
            Export CSV
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => materialsVersJson(kind, items)}>
            Export JSON
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
            Importer…
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => store.restoreOfficialMaterials(kind)}>
            Restaurer valeurs officielles
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => store.addMaterial(kind)}>
            + Ajouter
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      </div>
      {sub && <p style={{ color: "var(--muted-foreground)", fontSize: 12.5, margin: "0 0 12px" }}>{sub}</p>}

      {/* Défilement horizontal sur écran étroit : les colonnes gardent une
          largeur lisible au lieu d'écraser les champs. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
        {items.map((item, index) => {
          const verrou = estOfficiel(item);
          const rec = item as unknown as Record<string, unknown>;
          return (
            <div
              key={item.id}
              style={{
                display: "grid", gridTemplateColumns: gridCols, gap: 8, alignItems: "end",
                border: "1px solid var(--border)", borderRadius: 8, padding: 10,
                background: verrou ? "#f8fafc" : "#fff",
                minWidth: 120 * columns.length + 90,
              }}
            >
              {columns.map((col) => (
                <div key={col.key}>
                  <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>{col.label}</label>
                  <input
                    className="field-input"
                    type={col.type === "number" ? "number" : "text"}
                    step={col.type === "number" ? "any" : undefined}
                    disabled={verrou}
                    value={(rec[col.key] as string | number) ?? ""}
                    onChange={(e) =>
                      store.updateMaterial(kind, index, {
                        [col.key]: col.type === "number" ? Number(e.target.value || 0) : e.target.value,
                      } as Partial<MaterialItem>)
                    }
                  />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingBottom: 2 }}>
                {verrou ? (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-mid)", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    officiel
                  </span>
                ) : (
                  <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => store.deleteMaterial(kind, index)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p style={{ fontSize: 12.5, color: "#94a3b8", margin: 0 }}>Aucune entrée.</p>}
      </div>
    </div>
  );
}
