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
    <label className="ui-filtre">
      Session
      <select value={valeur} onChange={(e) => onChange(e.target.value)} className="ui-pilule-select">
        <option value="toutes">Toutes</option>
        {[...sessions].reverse().map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        <option value="sans">Sans session</option>
      </select>
      {compte && <span>{compte}</span>}
    </label>
  );
}
