"use client";

import { useEffect, useState } from "react";
import { PROJETS, type Projet } from "@/lib/projects";
import { getSupabase, authConfiguree } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";

// Traduction des erreurs Supabase courantes (même table que MineBackfill).
function messageErreur(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login")) return "Courriel ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ce courriel a déjà un compte. Connectez-vous.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("email") && m.includes("invalid")) return "Courriel invalide.";
  if (m.includes("confirm")) return "Compte à confirmer (voir la configuration « Confirm email »).";
  return brut;
}

interface SessionInfo {
  email: string | null;
}

function CarteProjet({ p }: { p: Projet }) {
  return (
    <a className="carte-projet" href={p.url} target="_blank" rel="noopener noreferrer">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "var(--navy)" }}>{p.nom}</h2>
        {p.statut && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 9px",
              borderRadius: 999,
              color: p.statut === "stable" ? "var(--success)" : "var(--warning)",
              background: p.statut === "stable" ? "#f0fdf4" : "#fef3c7",
              border: `1px solid ${p.statut === "stable" ? "#bbf7d0" : "#fcd34d"}`,
              whiteSpace: "nowrap",
            }}
          >
            {p.statut}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)", flex: 1 }}>
        {p.description}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {p.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--primary)",
                background: "var(--primary-light)",
                border: "1px solid var(--primary-mid)",
                borderRadius: 6,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
          Ouvrir →
        </span>
      </div>
    </a>
  );
}

export default function PortailPage() {
  const monte = useHydrated();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [pret, setPret] = useState(false); // session initiale résolue
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const configuree = monte && authConfiguree();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return; // non configuré : « prêt » est dérivé plus bas
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s?.user ? { email: s.user.email ?? null } : null);
      setPret(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sans configuration, il n'y a pas de session initiale à attendre.
  const pretAffichage = configuree ? pret : monte;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    setErreur(null);
    setInfo(null);
    try {
      if (mode === "inscription") {
        const { error } = await sb.auth.signUp({ email, password: motDePasse });
        if (error) throw error;
        setInfo("Compte créé. Vous pouvez vous connecter.");
        setMode("connexion");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: motDePasse });
        if (error) throw error;
        setMotDePasse("");
      }
    } catch (err) {
      setErreur(messageErreur(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const deconnexion = async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
  };

  // Accès aux projets : mode ouvert si la connexion n'est pas configurée,
  // sinon réservé aux comptes connectés (mêmes comptes que MineBackfill).
  const accesProjets = monte && (!configuree || session !== null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Bandeau ── */}
      <header style={{ background: "var(--navy)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "34px 24px 26px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            Recherche et enseignement
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>
              Progiciel Belem
            </h1>
            {monte && configuree && session && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>{session.email}</span>
                <button
                  type="button"
                  onClick={deconnexion}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "#fff",
                    borderRadius: 7,
                    padding: "6px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
          <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.7)", marginTop: 8, maxWidth: 640, lineHeight: 1.5 }}>
            Portail des outils du programme : remblais miniers en pâte, optimisation
            de recettes, et les projets à venir.
          </p>
        </div>
        <div style={{ height: 4, background: "var(--primary)" }} />
      </header>

      {/* ── Contenu ── */}
      <main style={{ flex: 1, maxWidth: 1080, width: "100%", margin: "0 auto", padding: "34px 24px 60px" }}>
        {!monte || !pretAffichage ? null : accesProjets ? (
          <>
            {!configuree && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  color: "var(--warning)",
                  fontSize: 12.5,
                }}
              >
                Mode ouvert : la connexion n&apos;est pas configurée sur cette instance
                (variables Supabase absentes). Voir le README pour l&apos;activer.
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
              {PROJETS.map((p) => (
                <CarteProjet key={p.id} p={p} />
              ))}
            </div>
            <p style={{ marginTop: 28, fontSize: 12.5, color: "var(--muted)" }}>
              {PROJETS.length} projet{PROJETS.length > 1 ? "s" : ""} — chaque application
              s&apos;ouvre dans un nouvel onglet.
            </p>
          </>
        ) : (
          /* ── Porte de connexion ── */
          <div
            style={{
              maxWidth: 440,
              margin: "24px auto 0",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "28px 26px",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Accès réservé</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18, lineHeight: 1.5 }}>
              Connectez-vous avec votre compte du programme (le même que MineBackfill).
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(["connexion", "inscription"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setErreur(null);
                    setInfo(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    border: `1.5px solid ${mode === m ? "var(--primary)" : "var(--border)"}`,
                    background: mode === m ? "var(--primary)" : "#fff",
                    color: mode === m ? "#fff" : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {m === "connexion" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
            <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>
                  Courriel
                </label>
                <input
                  type="email"
                  required
                  className="field-input"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.ca"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  className="field-input"
                  value={motDePasse}
                  autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {erreur && (
                <div style={{ fontSize: 12.5, color: "var(--danger)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 12px" }}>
                  {erreur}
                </div>
              )}
              {info && (
                <div style={{ fontSize: 12.5, color: "var(--success)", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "8px 12px" }}>
                  {info}
                </div>
              )}
              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ── Pied ── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "#fff" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Progiciel Belem — portail des projets
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Programme de M. Belem
          </span>
        </div>
      </footer>
    </div>
  );
}
