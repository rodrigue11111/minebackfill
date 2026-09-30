"use client";

// Assistant IA — chat sur le site, RÉSERVÉ au compte enseignant.
// Façade : chaque message part dans une issue GitHub @claude ; l'IA
// mainteneuse travaille en Pull Request (tests + aperçu Vercel) et ses
// réponses sont réaffichées ici. Rien ne part en production sans « Merge ».
//
// MODE TEST SANS COMPTE (mode-test.ts, temporaire) : les comptes étant
// désactivés, la page est ouverte sans connexion (bandeau explicite) et les
// requêtes partent sans jeton — la route serveur saute la vérification du
// rôle dans ce mode uniquement.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";
import { useHydrated } from "@/lib/use-hydrated";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";

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
    if (!t && !MODE_TEST_SANS_COMPTE) return;
    try {
      const r = await fetch(`/api/assistant?issue=${numero}`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
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
  const accesChat = isProf || MODE_TEST_SANS_COMPTE;
  useEffect(() => {
    if (!issue || !accesChat) return;
    rafraichir(issue);
    const id = setInterval(() => rafraichir(issue), 20000);
    return () => clearInterval(id);
  }, [issue, accesChat, rafraichir]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = saisie.trim();
    if (!message || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const t = await jeton();
      if (!t && !MODE_TEST_SANS_COMPTE) throw new Error("Session expirée — reconnectez-vous.");
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
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

  return (
    <Page etroite>
      <EnTetePage
        titre="Assistant IA"
        sousTitre={<>Décrivez la modification souhaitée comme à un assistant humain. L&apos;IA
          travaille dans le dépôt du projet et ouvre une <strong>Pull Request</strong> —
          tests automatiques et aperçu cliquable — <strong>rien ne part en
          production sans votre validation</strong>. Comptez quelques minutes par
          réponse.</>}
      />

      {!monte ? null : !MODE_TEST_SANS_COMPTE && (!cloudConfigure() || !session) ? (
        <Carte titre="Accès réservé">
          <p className="classe-rien">
            Cette page est réservée au compte enseignant.
          </p>
          <Link href="/compte" className="btn-primary" style={{ alignSelf: "flex-start" }}>
            Se connecter
          </Link>
        </Carte>
      ) : !accesChat ? (
        <Carte titre="Accès réservé à l'enseignant">
          <p className="classe-rien">
            Votre compte ({session?.email ?? "?"}) n&apos;a pas le rôle enseignant.
          </p>
        </Carte>
      ) : nonConfigure ? (
        <Carte titre="Assistant non configuré">
          <p className="classe-rien">
            Les variables serveur <code>ASSISTANT_GITHUB_TOKEN</code> et{" "}
            <code>ASSISTANT_GITHUB_REPO</code> ne sont pas définies sur cette
            instance. Voir docs/OPERATIONS.md, section « assistant sur le site ».
          </p>
        </Carte>
      ) : (
        <>
          {MODE_TEST_SANS_COMPTE && (
            <Bandeau ton="alerte">
              Mode test : accès temporairement ouvert sans compte (phase
              d&apos;évaluation). Les demandes sont publiées dans le dépôt GitHub
              du projet. À la fin du projet, cette page redeviendra réservée au
              compte enseignant.
            </Bandeau>
          )}
          {/* ── Conversation ── */}
          <Carte
            sansMarge
            titre={issue ? `Conversation n° ${issue}${etat === "closed" ? " (fermée)" : ""}` : "Nouvelle demande"}
            actions={
              <span className="regl-actions">
                {urlIssue && (
                  <a href={urlIssue} target="_blank" rel="noopener noreferrer" className="btn-discret">
                    Ouvrir dans GitHub
                  </a>
                )}
                {issue && (
                  <button type="button" className="btn-discret" onClick={nouvelleConversation}>
                    Nouvelle demande
                  </button>
                )}
              </span>
            }
          >
            <div className="assistant-fil">
              {messages.length === 0 && (
                <p className="classe-rien" style={{ padding: "18px 4px" }}>
                  {issue ? "Chargement de la conversation..." : "Exemples : « Ajoute le liant GUb-SF (Gs 2,95) aux liants officiels. » — « Le bouton d'export PDF affiche une erreur, corrige-le. »"}
                </p>
              )}
              {messages.map((m, i) => {
                const estIa = /\[bot\]|claude|github-actions/i.test(m.auteur);
                return (
                  <div key={i} className={estIa ? "assistant-bulle assistant-bulle-ia" : "assistant-bulle assistant-bulle-moi"}>
                    <div className="assistant-bulle-tete">
                      {estIa ? "Assistant" : "Vous"} — {new Date(m.date).toLocaleString("fr-CA")}
                    </div>
                    <div className="assistant-bulle-corps">
                      {m.corps}
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>

            <form onSubmit={envoyer} className="assistant-saisie">
              <textarea
                className="field-input"
                style={{ flex: 1, minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Décrivez la modification souhaitée..."
                aria-label="Message à l'assistant"
                value={saisie}
                maxLength={4000}
                onChange={(e) => setSaisie(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={envoi || !saisie.trim()} style={{ alignSelf: "flex-end" }}>
                {envoi ? "Envoi..." : "Envoyer"}
              </button>
            </form>
          </Carte>

          {erreur && <Bandeau ton="danger" role="alert">{erreur}</Bandeau>}

          <p className="ui-liste-pied">
            Chaque demande devient une issue GitHub traitée par l&apos;IA mainteneuse
            du dépôt. La modification arrive sous forme de Pull Request avec tests
            et aperçu — c&apos;est votre clic « Merge » (dans GitHub) qui met en ligne.
            L&apos;actualisation ici est automatique (20 s).
          </p>
        </>
      )}
    </Page>
  );
}
