"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { messageErreurAuth } from "@/lib/auth-messages";
import {
  abonnerSync, delier, instantaneSync, instantaneSyncServeur, synchroniserMaintenant,
  type InstantaneSync,
} from "@/lib/sync-client";

const LIBELLES_STATUT: Record<InstantaneSync["statut"], string> = {
  inactif: "Inactive",
  a_jour: "À jour",
  en_attente: "Modifications en attente d'envoi",
  en_cours: "Synchronisation en cours…",
  hors_ligne: "Hors ligne — nouvel essai automatique",
  erreur: "Erreur",
  pause: "En pause (activité anormale) — reprise automatique dans 10 min",
};

/**
 * Changer son mot de passe, connecté. (« Mot de passe oublié » exige un
 * serveur de courriel configuré dans Supabase : le serveur intégré n'écrit
 * qu'aux membres de l'équipe du projet. Voir docs/OPERATIONS.md.)
 */
function ChangerMotDePasse() {
  const [ouvert, setOuvert] = useState(false);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEtat(null);
    if (mdp.length < 8) { setEtat({ type: "erreur", texte: "Au moins 8 caractères." }); return; }
    if (mdp !== confirmation) { setEtat({ type: "erreur", texte: "Les deux saisies ne correspondent pas." }); return; }
    const sb = getSupabase();
    if (!sb) return;
    setOccupe(true);
    const { error } = await sb.auth.updateUser({ password: mdp });
    setOccupe(false);
    if (error) {
      const m = error.message.toLowerCase();
      setEtat({
        type: "erreur",
        texte: m.includes("reauthentication") || m.includes("recent")
          ? "Par sécurité, reconnectez-vous puis réessayez."
          : m.includes("different") || m.includes("same")
            ? "Le nouveau mot de passe doit différer de l'ancien."
            : messageErreur(error.message),
      });
      return;
    }
    setMdp(""); setConfirmation("");
    setEtat({ type: "ok", texte: "Mot de passe changé." });
  };

  if (!ouvert) {
    return (
      <button type="button" className="btn-secondary" style={{ fontSize: 12.5, marginTop: 10 }} onClick={() => setOuvert(true)}>
        Changer le mot de passe
      </button>
    );
  }
  return (
    <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <input type="password" className="field-input" placeholder="Nouveau mot de passe" autoComplete="new-password"
        value={mdp} onChange={(e) => setMdp(e.target.value)} />
      <input type="password" className="field-input" placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password"
        value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      {etat && (
        <div style={{ fontSize: 12.5, color: etat.type === "ok" ? "var(--success)" : "var(--danger)" }}>{etat.texte}</div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-primary" style={{ fontSize: 12.5 }} disabled={occupe}>{occupe ? "…" : "Enregistrer"}</button>
        <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => { setOuvert(false); setEtat(null); }}>Annuler</button>
      </div>
    </form>
  );
}

/** Nom affiché, modifiable (via definir_nom : cette colonne et rien d'autre). */
function NomAffiche() {
  const session = useStore((s) => s.session);
  const setSession = useStore((s) => s.setSession);
  const [edition, setEdition] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!session) return null;

  const enregistrer = async () => {
    const sb = getSupabase();
    if (!sb || edition === null) return;
    const valeur = edition.trim();
    if (valeur.length > 80) { setErreur("80 caractères au plus."); return; }
    const { error } = await sb.rpc("definir_nom", { p_nom: valeur });
    if (error) { setErreur(`Enregistrement impossible (${error.code ?? error.message}).`); return; }
    setSession({ ...session, displayName: valeur || null });
    setEdition(null);
    setErreur(null);
  };

  if (edition === null) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{session.displayName || "Nom non renseigné"}</p>
        <button type="button" onClick={() => setEdition(session.displayName ?? "")}
          style={{ fontSize: 12, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Modifier
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="text" className="field-input" style={{ flex: "1 1 180px" }} maxLength={80} value={edition}
        onChange={(e) => setEdition(e.target.value)} placeholder="Prénom Nom" autoComplete="name" />
      <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} onClick={() => void enregistrer()}>Enregistrer</button>
      <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => { setEdition(null); setErreur(null); }}>Annuler</button>
      {erreur && <div style={{ fontSize: 12.5, color: "var(--danger)", width: "100%" }}>{erreur}</div>}
    </div>
  );
}

/** État de la sauvegarde en ligne du travail, et ses deux commandes. */
function EtatSynchro() {
  const s = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);
  const [message, setMessage] = useState<string | null>(null);

  if (s.liaison === "autre_compte") {
    return (
      <p style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px", marginTop: 14, lineHeight: 1.5 }}>
        La sauvegarde en ligne n&apos;a pas pu démarrer : le stockage du navigateur est plein
        (le travail de l&apos;autre compte n&apos;a pas pu être mis de côté). Rien n&apos;est perdu ;
        libérez de la place, puis rechargez la page.
      </p>
    );
  }
  if (s.liaison !== "synchroniser") return null;

  const faireDelier = () => {
    if (!window.confirm(
      "Délier ce navigateur retire de cet appareil les résultats et gâchées déjà sauvegardés en ligne " +
      "(ils restent dans votre compte), puis arrête la synchronisation ici. Utile avant de changer de compte. Continuer ?",
    )) return;
    const r = delier();
    setMessage(r.ok ? "Navigateur délié. Vous pouvez vous déconnecter et vous connecter avec un autre compte." : r.raison);
  };

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Sauvegarde en ligne du travail</div>
      <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0 }}>
        {LIBELLES_STATUT[s.statut]}
        {s.statut === "en_attente" && s.enAttente > 0 ? ` (${s.enAttente})` : ""}
        {s.derniereReussite ? ` · dernière réussite à ${new Date(s.derniereReussite).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : ""}
        {s.erreur && s.statut !== "a_jour" ? ` · code ${s.erreur.code}` : ""}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => synchroniserMaintenant()}>
          Synchroniser maintenant
        </button>
        <button type="button" className="btn-secondary" style={{ fontSize: 12.5, color: "#64748b" }} onClick={faireDelier}>
          Délier ce navigateur
        </button>
      </div>
      {message && <p style={{ fontSize: 12.5, color: "#334155", marginTop: 8 }}>{message}</p>}
    </div>
  );
}

// Traduction des messages d'erreur de Supabase (auth-messages.ts, testé).
function messageErreur(brut: string, code?: string | null): string {
  return messageErreurAuth(brut, code);
}

export default function ComptePage() {
  const session = useStore((s) => s.session);
  const monte = useHydrated();
  // « oubli » : demande d'un lien de réinitialisation. Le portail y renvoie
  // avec ?oubli=1 (mêmes comptes). Lu au premier rendu CLIENT : cette partie
  // de la page n'est affichée qu'après l'hydratation, pas de décalage serveur.
  const [mode, setMode] = useState<"connexion" | "inscription" | "oubli">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("oubli") ? "oubli" : "connexion");
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [enseignant, setEnseignant] = useState(false);
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Changer de mode efface les messages, et retire ?oubli=1 de l'adresse en
  // quittant ce mode (sinon l'adresse annonce « oubli » sur une autre vue).
  const changerMode = (m: "connexion" | "inscription" | "oubli") => {
    setMode(m);
    setErreur(null);
    setInfo(null);
    if (m !== "oubli" && window.location.search.includes("oubli")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

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
      if (mode === "oubli") {
        // Le lien ramène sur une page de l'application, où l'on choisit le
        // nouveau mot de passe. Même réponse qu'un compte existe ou non : on
        // ne révèle pas quelles adresses ont un compte.
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/compte/nouveau-mot-de-passe`,
        });
        if (error) throw error;
        setInfo("Si un compte existe pour cette adresse, un courriel vient d'être envoyé avec un lien pour choisir un nouveau mot de passe. Pensez à regarder dans les courriels indésirables.");
      } else if (mode === "inscription") {
        // Le nom part dans les métadonnées d'inscription ; le serveur n'en lit
        // QUE ce champ (handle_new_user), jamais un rôle.
        // Code enseignant : vérifié par le SERVEUR (empreinte en base), puis
        // retiré du compte. Un mauvais code donne simplement un compte étudiant.
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
        // La session/rôle sont renseignés par CloudSync (onAuthStateChange).
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? null;
      setErreur(messageErreur(err instanceof Error ? err.message : String(err), code));
    } finally {
      setLoading(false);
    }
  };

  const deconnexion = async () => {
    const sb = getSupabase();
    if (!sb) return;
    // On ne bloque jamais la déconnexion : les modifications en attente restent
    // sur cet appareil et partiront à la prochaine connexion ici.
    const attente = instantaneSync().enAttente;
    if (attente > 0 && !window.confirm(
      `${attente} modification${attente > 1 ? "s ne sont" : " n'est"} pas encore en ligne. ` +
      "Elles restent sur cet appareil et partiront à votre prochaine connexion ici. Se déconnecter quand même ?",
    )) return;
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
            <NomAffiche />
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{session.email}</p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              Rôle : {session.role === "prof" ? "Enseignant" : "Étudiant"}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 14, lineHeight: 1.5 }}>
              Vos résultats sauvegardés et vos gâchées sont sauvegardés en ligne et
              visibles par l&apos;enseignant ; les courbes de presse restent sur cet
              appareil. Les catalogues officiels publiés par l&apos;enseignant sont
              appliqués automatiquement (vos matériaux personnels sont conservés).
            </p>
            <EtatSynchro />
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <ChangerMotDePasse />
            </div>
            <button type="button" className="btn-secondary" onClick={deconnexion} disabled={loading} style={{ marginTop: 18 }}>
              {loading ? "…" : "Se déconnecter"}
            </button>
          </div>
        ) : (
          <div style={card}>
            {mode === "oubli" ? (
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>Mot de passe oublié</h2>
            ) : (
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(["connexion", "inscription"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changerMode(m)}
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
            )}
            <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "oubli" && (
                <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Indiquez le courriel de votre compte : vous recevrez un lien pour choisir un
                  nouveau mot de passe. Votre travail n&apos;est pas touché.
                </p>
              )}
              {mode === "inscription" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                    Prénom et nom (visible par l&apos;enseignant)
                  </label>
                  <input type="text" required maxLength={80} className="field-input" value={nom}
                    autoComplete="name" onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" />
                  {!enseignant ? (
                    <button type="button" onClick={() => setEnseignant(true)}
                      style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--primary)", cursor: "pointer" }}>
                      Je suis l&apos;enseignant
                    </button>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
                        Code enseignant (fourni par l&apos;administrateur du site)
                      </label>
                      <input type="password" className="field-input" value={code} autoComplete="off"
                        onChange={(e) => setCode(e.target.value)} placeholder="Code enseignant" />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>Courriel</label>
                <input type="email" required className="field-input" value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.ca" />
              </div>
              {mode !== "oubli" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>Mot de passe</label>
                  <input type="password" required className="field-input" value={motDePasse}
                    autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                    onChange={(e) => setMotDePasse(e.target.value)} placeholder="••••••••" />
                  {mode === "connexion" && (
                    <button type="button" onClick={() => changerMode("oubli")}
                      style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--primary)", cursor: "pointer" }}>
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
              )}
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
                {loading ? "…" : mode === "connexion" ? "Se connecter" : mode === "oubli" ? "Envoyer le lien" : "Créer le compte"}
              </button>
              {mode === "oubli" && (
                <button type="button" onClick={() => changerMode("connexion")}
                  style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--primary)", cursor: "pointer" }}>
                  ← Retour à la connexion
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
