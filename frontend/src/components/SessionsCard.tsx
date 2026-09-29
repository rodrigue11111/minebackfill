"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { erreursSession, sessionActive, type Session } from "@/lib/sessions";

/**
 * Carte « Sessions de cours » des Réglages. L'enseignant définit les sessions
 * (Automne 2026, Hiver 2027…) et les publie : chaque résultat et chaque gâchée
 * créés pendant une session la portent, ce qui range le travail d'une année
 * à l'autre. Les étudiants voient la liste publiée, sans la modifier.
 *
 * L'édition se fait sur un BROUILLON : une session à moitié saisie (id vide,
 * date incomplète) ne doit pas disparaître pendant qu'on tape.
 */
export default function SessionsCard({ vueAdmin, peutPublier, onPublier }: {
  vueAdmin: boolean;
  peutPublier: boolean;
  onPublier: (sessions: Session[]) => void;
}) {
  const sessions = useStore((s) => s.sessions);
  const definirSessions = useStore((s) => s.definirSessions);
  const [brouillon, setBrouillon] = useState<Session[] | null>(null);
  const liste = brouillon ?? sessions;
  const active = sessionActive(sessions, new Date());

  if (!vueAdmin && sessions.length === 0) return null;

  const modifier = (i: number, patch: Partial<Session>) =>
    setBrouillon(liste.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const ajouter = () => {
    const an = new Date().getFullYear();
    const jour = new Date().toISOString().slice(0, 10);
    setBrouillon([...liste, { id: `S${an}-${liste.length + 1}`, nom: `Session ${an}`, debut: jour, fin: jour }]);
  };
  const erreurs = liste.map(erreursSession);
  const valide = erreurs.every((e) => e.length === 0) && new Set(liste.map((s) => s.id)).size === liste.length;

  const champ: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 8px", fontSize: 12.5 };

  return (
    <div className="form-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Sessions de cours</h2>
        {vueAdmin && peutPublier && brouillon === null && sessions.length > 0 && (
          <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => onPublier(sessions)}>
            Publier en ligne
          </button>
        )}
      </div>
      <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, margin: "6px 0 14px" }}>
        Chaque résultat et chaque gâchée créés pendant une session la portent : l&apos;Historique,
        le Labo et le tableau de bord de la classe se filtrent par session, d&apos;une année à
        l&apos;autre. Le travail antérieur est rangé d&apos;après sa date ; hors de toute session, il
        apparaît « Sans session ».
        {active ? <> Session active aujourd&apos;hui : <strong>{active.nom}</strong>.</> : " Aucune session active aujourd'hui."}
      </p>

      {liste.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Aucune session définie.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {liste.map((s, i) => (
            <div key={i}>
              {vueAdmin ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input style={{ ...champ, width: 110 }} value={s.id} aria-label="Identifiant"
                    onChange={(e) => modifier(i, { id: e.target.value.trim() })} />
                  <input style={{ ...champ, flex: "1 1 160px" }} value={s.nom} aria-label="Nom"
                    onChange={(e) => modifier(i, { nom: e.target.value })} />
                  <label style={{ fontSize: 12, color: "#64748b" }}>du{" "}
                    <input type="date" style={champ} value={s.debut} onChange={(e) => modifier(i, { debut: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 12, color: "#64748b" }}>au{" "}
                    <input type="date" style={champ} value={s.fin} onChange={(e) => modifier(i, { fin: e.target.value })} />
                  </label>
                  <button type="button" className="btn-secondary" style={{ fontSize: 12, color: "#b91c1c" }}
                    onClick={() => setBrouillon(liste.filter((_, j) => j !== i))}>
                    Retirer
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 13.5 }}>
                  <strong>{s.nom}</strong> — du {s.debut} au {s.fin}
                </div>
              )}
              {erreurs[i].length > 0 && (
                <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 3 }}>{erreurs[i].join(" ")}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {vueAdmin && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={ajouter}>Ajouter une session</button>
          {brouillon !== null && (
            <>
              <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} disabled={!valide}
                onClick={() => { definirSessions(brouillon); setBrouillon(null); }}>
                Enregistrer
              </button>
              <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => setBrouillon(null)}>
                Annuler
              </button>
              {!valide && <span style={{ fontSize: 12, color: "#b91c1c" }}>Corrigez les erreurs (identifiants uniques).</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
