"use client";

import type { CSSProperties } from "react";
import { useStore } from "@/lib/store";
import type { MaterialKind, MaterialItem } from "@/lib/materials";

const SLICE = {
  residus: "catalogue_residus",
  granulats: "catalogue_granulats",
  retardateurs: "catalogue_retardateurs",
} as const;

const LABEL: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#374151", marginBottom: 4 };

/**
 * Liste déroulante de préréglages de matériaux : remplit les champs du
 * formulaire (via `onPick`) et mémorise l'id choisi (traçabilité, snapshoté
 * dans le résultat sauvegardé). « — personnalisé — » = saisie libre.
 */
export default function MaterialPresetSelect({ kind, role, label, onPick }: {
  kind: MaterialKind;
  role: "residueId" | "aggregateId" | "retarderId";
  label?: string;
  onPick: (m: MaterialItem) => void;
}) {
  const store = useStore();
  const items = store[SLICE[kind]] as MaterialItem[];
  const selectedId = store.selectedMaterials[role] ?? "";
  return (
    <div>
      <label style={LABEL}>{label ?? "Préréglage"}</label>
      <select
        className="field-input"
        style={{ cursor: "pointer" }}
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          store.setSelectedMaterial(role, id || undefined);
          const m = items.find((x) => x.id === id);
          if (m) onPick(m);
        }}
      >
        <option value="">— personnalisé —</option>
        {items.map((m) => {
          const prov = "provenance" in m && m.provenance ? ` (${m.provenance})` : "";
          return <option key={m.id} value={m.id}>{m.nom}{prov}</option>;
        })}
      </select>
    </div>
  );
}
