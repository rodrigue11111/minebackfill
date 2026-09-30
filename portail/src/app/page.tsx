"use client";

import { useEffect, useState } from "react";
import { PROJETS, type Projet } from "@/lib/projects";
import { getSupabase, authConfiguree } from "@/lib/supabase";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";
import { useHydrated } from "@/lib/use-hydrated";

// Traduction des erreurs Supabase courantes (même table que MineBackfill).
function messageErreur(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login")) return "Courriel ou mot de passe incorrect.";
  if (m.includes("user is banned") || m.includes("user banned"))
    return "Ce compte est suspendu. Adressez-vous à l'enseignant.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ce courriel a déjà un compte. Connectez-vous (ou « Mot de passe oublié ? »).";
  if (m.includes("signups not allowed") || m.includes("signups are disabled"))
    return "Les inscriptions par courriel sont désactivées sur le serveur. Prévenez l'enseignant.";
  if (m.includes("rate limit") || m.includes("for security purposes"))
    return "Trop de demandes rapprochées. Patientez une minute, puis réessayez.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("email") && m.includes("invalid")) return "Courriel invalide.";
  if (m.includes("confirm")) return "Compte à confirmer (voir la configuration « Confirm email »).";
  return brut;
}

interface SessionInfo {
  email: string | null;
}

function Chevron({ taille = 14 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function Marque() {
  return (
    <span className="p-marque-pastille" aria-hidden="true">
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    </span>
  );
}

function CarteProjet({ p }: { p: Projet }) {
  return (
    <a className="carte-projet" href={p.url} target="_blank" rel="noopener noreferrer">
      <div className="carte-projet-tete">
        <h2 className="carte-projet-nom">{p.nom}</h2>
        {p.statut && (
          <span className={p.statut === "stable" ? "p-pastille p-pastille-succes" : "p-pastille p-pastille-alerte"}>
            {p.statut === "stable" ? "Stable" : "Bêta"}
          </span>
        )}
      </div>
      <p className="carte-projet-description">{p.description}</p>
      <div className="carte-projet-pied">
        <div className="carte-projet-etiquettes">
          {p.tags.map((t) => (
            <span key={t} className="p-etiquette">{t}</span>
          ))}
        </div>
        <span className="carte-projet-ouvrir">
          Ouvrir <Chevron />
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
  const [nom, setNom] = useState("");
  const [enseignant, setEnseignant] = useState(false);
  const [code, setCode] = useState("");
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
        // Même compte que MineBackfill : le nom affiché est celui que voit
        // l'enseignant. Le serveur ne lit QUE ce champ des métadonnées.
        // Code enseignant : vérifié par le SERVEUR, jamais conservé sur le compte.
        const donnees: Record<string, string> = { display_name: nom.trim() };
        if (enseignant && code.trim()) donnees.code_enseignant = code.trim();
        const { error } = await sb.auth.signUp({ email, password: motDePasse, options: { data: donnees } });
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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* ── Barre haute ── */}
      <header className="p-barre">
        <div className="p-barre-contenu">
          <span className="p-marque">
            <Marque />
            Progiciel Belem
          </span>
          {monte && configuree && session && (
            <div className="p-compte">
              <span className="p-compte-courriel">{session.email}</span>
              <button type="button" className="btn-discret" onClick={deconnexion}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="p-page" style={{ flex: 1, width: "100%" }}>
        <div className="p-entete">
          <p className="p-surtitre">Recherche et enseignement</p>
          <h1 className="p-titre">Projets</h1>
          <p className="p-sous-titre">
            Portail des outils du programme : remblais miniers en pâte, optimisation
            de recettes, et les projets à venir.
          </p>
        </div>

        {!monte || !pretAffichage ? null : accesProjets ? (
          <>
            {!configuree && !MODE_TEST_SANS_COMPTE && (
              <div className="p-bandeau p-bandeau-alerte">
                Mode ouvert : la connexion n&apos;est pas configurée sur cette instance
                (variables Supabase absentes). Voir le README pour l&apos;activer.
              </div>
            )}
            <div className="p-projets">
              {PROJETS.map((p) => (
                <CarteProjet key={p.id} p={p} />
              ))}
            </div>
            <p className="p-note">
              {PROJETS.length} projet{PROJETS.length > 1 ? "s" : ""}{" "}— chaque application
              s&apos;ouvre dans un nouvel onglet.
            </p>
          </>
        ) : (
          /* ── Porte de connexion ── */
          <section className="p-connexion" aria-labelledby="titre-connexion">
            <div>
              <h2 id="titre-connexion" className="p-connexion-titre">Accès réservé</h2>
              <p className="p-note" style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>
                Connectez-vous avec votre compte du programme (le même que MineBackfill).
              </p>
            </div>
            <div className="p-segmente" role="radiogroup" aria-label="Connexion ou inscription">
              {(["connexion", "inscription"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  className="p-segment"
                  onClick={() => {
                    setMode(m);
                    setErreur(null);
                    setInfo(null);
                  }}
                >
                  {m === "connexion" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
            <form onSubmit={soumettre} className="p-formulaire">
              <div className="p-liste">
                {mode === "inscription" && (
                  <label className="p-ligne">
                    <span className="p-ligne-libelle">Nom complet</span>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={nom}
                      autoComplete="name"
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Prénom Nom"
                    />
                  </label>
                )}
                {mode === "inscription" && enseignant && (
                  <label className="p-ligne">
                    <span className="p-ligne-libelle">Code enseignant</span>
                    <input
                      type="password"
                      value={code}
                      autoComplete="off"
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Requis"
                    />
                  </label>
                )}
                <label className="p-ligne">
                  <span className="p-ligne-libelle">Courriel</span>
                  <input
                    type="email"
                    required
                    value={email}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ca"
                  />
                </label>
                <label className="p-ligne">
                  <span className="p-ligne-libelle">Mot de passe</span>
                  <input
                    type="password"
                    required
                    value={motDePasse}
                    autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder="Requis"
                  />
                </label>
              </div>
              {mode === "inscription" && (
                <p className="p-note">
                  Le prénom et le nom sont visibles par l&apos;enseignant.{" "}
                  {enseignant && "Le code enseignant est fourni par l'administrateur du site."}
                  {!enseignant && (
                    <button type="button" className="btn-discret" style={{ padding: 0, fontSize: 13 }} onClick={() => setEnseignant(true)}>
                      Je suis l&apos;enseignant
                    </button>
                  )}
                </p>
              )}
              {erreur && <div className="p-bandeau p-bandeau-danger" role="alert">{erreur}</div>}
              {info && <div className="p-bandeau p-bandeau-succes" role="status">{info}</div>}
              <button type="submit" className="btn-primary p-soumettre" disabled={loading}>
                {loading ? "…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
              </button>
              {mode === "connexion" && (
                // Mêmes comptes que MineBackfill : la réinitialisation s'y fait
                // (une seule page, un seul lien de retour à autoriser dans Supabase).
                <a className="btn-discret" style={{ alignSelf: "center" }}
                  href={`${PROJETS.find((p) => p.id === "minebackfill")?.url ?? ""}/compte?oubli=1`}>
                  Mot de passe oublié ?
                </a>
              )}
            </form>
          </section>
        )}
      </main>

      {/* ── Pied ── */}
      <footer className="p-pied">
        <div className="p-pied-contenu">
          <span>Progiciel Belem — portail des projets</span>
          <span>Programme de M. Belem</span>
        </div>
      </footer>
    </div>
  );
}
