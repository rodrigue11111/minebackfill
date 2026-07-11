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
 *
 * `matches` (optionnel) : prédicat « les champs du formulaire correspondent
 * encore à ce matériau ». S'il est fourni et faux, le sélecteur affiche
 * « — personnalisé — » : une sélection périmée (valeurs modifiées à la main,
 * ou faite depuis un autre formulaire) n'est pas présentée comme active.
 */
export default function MaterialPresetSelect({ kind, role, label, onPick, matches }: {
  kind: MaterialKind;
  role: "residueId" | "aggregateId" | "retarderId";
  label?: string;
  onPick: (m: MaterialItem) => void;
  matches?: (m: MaterialItem) => boolean;
}) {
  const store = useStore();
  const items = store[SLICE[kind]] as MaterialItem[];
  const rawSelectedId = store.selectedMaterials[role] ?? "";
  const selectedItem = rawSelectedId ? items.find((m) => m.id === rawSelectedId) : undefined;
  const selectedId = selectedItem && (!matches || matches(selectedItem)) ? rawSelectedId : "";
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
