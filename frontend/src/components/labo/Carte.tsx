// Cartes de présentation du Labo, partagées avec la vue enseignant (/classe).

import type React from "react";
import type { ProtocoleFige } from "@/lib/protocole";

export function Carte({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>{titre}</span>
        {extra}
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

/** Protocole FIGÉ d'une gâchée (lecture seule) : la procédure réellement suivie. */
export function CarteProtocolesFiges({ snapshot }: { snapshot: ProtocoleFige[] | undefined }) {
  if (!snapshot || snapshot.length === 0) return null;
  return (
    <Carte titre="Protocole suivi (figé à la création)">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {snapshot.map((p, i) => (
          <div key={i}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>{p.titre}</div>
            <div style={{ fontSize: 12.5, color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{p.contenu}</div>
          </div>
        ))}
      </div>
    </Carte>
  );
}
