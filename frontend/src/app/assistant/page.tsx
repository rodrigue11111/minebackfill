"use client";

// Assistant IA — chat sur le site, RÉSERVÉ au compte enseignant.
// Façade : chaque message part dans une issue GitHub @claude ; l'IA
// mainteneuse travaille en Pull Request (tests + aperçu Vercel) et ses
// réponses sont réaffichées ici. Rien ne part en production sans « Merge ».

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";

interface MessageAffiche {
  auteur: string;
  corps: string;
  date: string;
}

const CLE_CONVERSATION = "minebackfill_assistant_issue";

export default function AssistantPage() {
  const monte = useHydrated();
  const session = useStore((s) => s.session);
  const isProf = session?.role === "prof";

  const [issue, setIssue] = useState<number | null>(null);
  const [urlIssue, setUrlIssue] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageAffiche[]>([]);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nonConfigure, setNonConfigure] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // Reprend la conversation en cours après un rechargement.
  useEffect(() => {
    if (!monte) return;
    const brut = localStorage.getItem(CLE_CONVERSATION);
    const n = brut ? Number(brut) : NaN;
    if (Number.isInteger(n) && n > 0) setIssue(n);
  }, [monte]);

  const jeton = useCallback(async (): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const rafraichir = useCallback(async (numero: number) => {
    const t = await jeton();
    if (!t) return;
    try {
      const r = await fetch(`/api/assistant?issue=${numero}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.status === 503) { setNonConfigure(true); return; }
      if (!r.ok) return;
      const data = (await r.json()) as {
        titre: string; etat: string; url: string; messages: MessageAffiche[];
      };
      setMessages(data.messages);
      setEtat(data.etat);
      setUrlIssue(data.url);
    } catch {
      /* réseau : on retentera au prochain cycle */
    }
  }, [jeton]);

  // Rafraîchissement périodique tant qu'une conversation est ouverte
  // (l'IA répond en quelques minutes — pas un chat instantané).
  useEffect(() => {
    if (!issue || !isProf) return;
    rafraichir(issue);
    const id = setInterval(() => rafraichir(issue), 20000);
    return () => clearInterval(id);
  }, [issue, isProf, rafraichir]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = saisie.trim();
    if (!message || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const t = await jeton();
      if (!t) throw new Error("Session expirée — reconnectez-vous.");
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(issue ? { message, issue } : { message }),
      });
      const data = (await r.json().catch(() => ({}))) as { issue?: number; erreur?: string };
      if (r.status === 503) { setNonConfigure(true); return; }
      if (!r.ok) throw new Error(data.erreur ?? `Erreur (HTTP ${r.status}).`);
      setSaisie("");
      if (!issue && data.issue) {
        setIssue(data.issue);
        localStorage.setItem(CLE_CONVERSATION, String(data.issue));
      }
      if (data.issue ?? issue) rafraichir(data.issue ?? issue!);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnvoi(false);
    }
  };

  const nouvelleConversation = () => {
    setIssue(null);
    setUrlIssue(null);
    setEtat(null);
    setMessages([]);
    setErreur(null);
    localStorage.removeItem(CLE_CONVERSATION);
  };

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const card: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
  };

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Assistant IA</h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
          Décrivez la modification souhaitée comme à un assistant humain. L&apos;IA
          travaille dans le dépôt du projet et ouvre une <strong>Pull Request</strong> —
          tests automatiques et aperçu cliquable — <strong>rien ne part en
          production sans votre validation</strong>. Comptez quelques minutes par
          réponse.
        </p>

        {!monte ? null : !cloudConfigure() || !session ? (
          <div style={{ ...card, padding: "24px 22px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Accès réservé</p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Cette page est réservée au compte enseignant.{" "}
              <Link href="/compte" style={{ color: "var(--primary)", fontWeight: 600 }}>
                Se connecter
              </Link>
            </p>
          </div>
        ) : !isProf ? (
          <div style={{ ...card, padding: "24px 22px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Accès réservé à l&apos;enseignant</p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Votre compte ({session.email}) n&apos;a pas le rôle enseignant.
            </p>
          </div>
        ) : nonConfigure ? (
          <div style={{ ...card, padding: "24px 22px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Assistant non configuré</p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Les variables serveur <code>ASSISTANT_GITHUB_TOKEN</code> et{" "}
              <code>ASSISTANT_GITHUB_REPO</code> ne sont pas définies sur cette
              instance. Voir docs/OPERATIONS.md, section « assistant sur le site ».
            </p>
          </div>
        ) : (
          <>
            {/* ── Conversation ── */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                  {issue ? `Conversation n° ${issue}${etat === "closed" ? " (fermée)" : ""}` : "Nouvelle demande"}
                </span>
                <span style={{ display: "flex", gap: 10 }}>
                  {urlIssue && (
                    <a href={urlIssue} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>
                      Ouvrir dans GitHub
                    </a>
                  )}
                  {issue && (
                    <button type="button" onClick={nouvelleConversation} style={{ border: "none", background: "transparent", color: "var(--muted-foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Nouvelle demande
                    </button>
                  )}
                </span>
              </div>

              <div style={{ maxHeight: 420, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.length === 0 && (
                  <p style={{ fontSize: 13, color: "#94a3b8", padding: "18px 4px" }}>
                    {issue ? "Chargement de la conversation..." : "Exemples : « Ajoute le liant GUb-SF (Gs 2,95) aux liants officiels. » — « Le bouton d'export PDF affiche une erreur, corrige-le. »"}
                  </p>
                )}
                {messages.map((m, i) => {
                  const estIa = /\[bot\]|claude|github-actions/i.test(m.auteur);
                  return (
                    <div key={i} style={{
                      alignSelf: estIa ? "flex-start" : "flex-end",
                      maxWidth: "85%",
                      background: estIa ? "#f1f5f9" : "var(--primary-light)",
                      border: `1px solid ${estIa ? "var(--border)" : "var(--primary-mid)"}`,
                      borderRadius: 10, padding: "8px 12px",
                    }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: estIa ? "#64748b" : "var(--primary)", marginBottom: 3 }}>
                        {estIa ? "Assistant" : "Vous"} — {new Date(m.date).toLocaleString("fr-CA")}
                      </div>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#0f172a", wordBreak: "break-word" }}>
                        {m.corps}
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>

              <form onSubmit={envoyer} style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                <textarea
                  className="field-input"
                  style={{ flex: 1, minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Décrivez la modification souhaitée..."
                  value={saisie}
                  maxLength={4000}
                  onChange={(e) => setSaisie(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={envoi || !saisie.trim()} style={{ alignSelf: "flex-end" }}>
                  {envoi ? "Envoi..." : "Envoyer"}
                </button>
              </form>
            </div>

            {erreur && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--danger)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 12px" }}>
                {erreur}
              </div>
            )}

            <p style={{ marginTop: 14, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
              Chaque demande devient une issue GitHub traitée par l&apos;IA mainteneuse
              du dépôt. La modification arrive sous forme de Pull Request avec tests
              et aperçu — c&apos;est votre clic « Merge » (dans GitHub) qui met en ligne.
              L&apos;actualisation ici est automatique (20 s).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
