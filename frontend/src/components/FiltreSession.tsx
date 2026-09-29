"use client";

import type { FiltreSession as Filtre, Session } from "@/lib/sessions";

/**
 * Sélecteur « Session : toutes / Automne 2026 / … / sans session ». N'apparaît
 * que si l'enseignant a défini des sessions : sans elles, il n'y a rien à
 * filtrer.
 */
export default function FiltreSession({ sessions, valeur, onChange, compte }: {
  sessions: Session[];
  valeur: Filtre;
  onChange: (v: Filtre) => void;
  /** Texte facultatif affiché à droite (« 12 sur 30 »). */
  compte?: string;
}) {
  if (sessions.length === 0) return null;
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#475569" }}>
      Session :
      <select value={valeur} onChange={(e) => onChange(e.target.value)}
        style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5, background: "#fff" }}>
        <option value="toutes">Toutes</option>
        {[...sessions].reverse().map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        <option value="sans">Sans session</option>
      </select>
      {compte && <span style={{ color: "#94a3b8" }}>{compte}</span>}
    </label>
  );
}
