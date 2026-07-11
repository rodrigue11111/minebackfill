"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";

// Traduction des messages d'erreur Supabase les plus courants.
function messageErreur(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login")) return "Courriel ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ce courriel a déjà un compte. Connectez-vous.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("email") && m.includes("invalid")) return "Courriel invalide.";
  if (m.includes("confirm")) return "Compte à confirmer (vérifiez la configuration « Confirm email »).";
  return brut;
}

export default function ComptePage() {
  const session = useStore((s) => s.session);
  const monte = useHydrated();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Anti-mismatch d'hydratation : on ne décide de l'affichage qu'après
  // l'hydratation client (configuré ou non, connecté ou non).
  const configure = monte && cloudConfigure();

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
        // La session/rôle sont renseignés par CloudSync (onAuthStateChange).
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
    setLoading(true);
    await sb.auth.signOut();
    setLoading(false);
  };

  const card: React.CSSProperties = {
    maxWidth: 460, margin: "0 auto", background: "#fff",
    border: "1px solid var(--border)", borderRadius: 12, padding: "28px 26px",
  };

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Compte</h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, marginBottom: 24 }}>
          La synchronisation en ligne est optionnelle. Sans compte, MineBackfill
          fonctionne entièrement en local dans votre navigateur.
        </p>

        {!monte ? null : !configure ? (
          <div style={card}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Synchronisation en ligne non configurée
            </p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Cette instance n&apos;a pas de connexion Supabase. Toutes vos données
              restent enregistrées localement. Voir <code>supabase/README.md</code>{" "}
              pour l&apos;activer.
            </p>
            <Link href="/" style={{ display: "inline-block", marginTop: 16, color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>
              ← Retour
            </Link>
          </div>
        ) : session ? (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Connecté
            </div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{session.email}</p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              Rôle : {session.role === "prof" ? "Enseignant" : "Étudiant"}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 14, lineHeight: 1.5 }}>
              Vos résultats sauvegardés sont synchronisés en ligne et visibles par
              l&apos;enseignant. Les catalogues officiels publiés par l&apos;enseignant
              sont appliqués automatiquement (vos matériaux personnels sont conservés).
            </p>
            <button type="button" className="btn-secondary" onClick={deconnexion} disabled={loading} style={{ marginTop: 18 }}>
              {loading ? "…" : "Se déconnecter"}
            </button>
          </div>
        ) : (
          <div style={card}>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(["connexion", "inscription"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setErreur(null); setInfo(null); }}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${mode === m ? "var(--primary)" : "var(--border)"}`,
                    background: mode === m ? "var(--primary)" : "#fff",
                    color: mode === m ? "#fff" : "#374151", cursor: "pointer",
                  }}
                >
                  {m === "connexion" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
            <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>Courriel</label>
                <input type="email" required className="field-input" value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.ca" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>Mot de passe</label>
                <input type="password" required className="field-input" value={motDePasse}
                  autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                  onChange={(e) => setMotDePasse(e.target.value)} placeholder="••••••••" />
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
      </div>
    </div>
  );
}
