"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { messageErreurAuth } from "@/lib/auth-messages";
import {
  abonnerSync, instantaneSync, instantaneSyncServeur, type InstantaneSync,
} from "@/lib/sync-client";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { Pastille, type TonPastille } from "@/components/ui/Pastille";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import Segmente from "@/components/ui/Segmente";

// La sauvegarde est AUTOMATIQUE : quelques secondes après chaque modification,
// tout de suite en quittant l'onglet, et toutes les 10 minutes. On n'affiche
// donc qu'un état, sans bouton : un bouton laisserait croire qu'il faut agir.
const LIBELLES_STATUT: Record<InstantaneSync["statut"], string> = {
  inactif: "Inactive",
  a_jour: "À jour",
  en_attente: "Envoi dans quelques secondes",
  en_cours: "Envoi en cours…",
  hors_ligne: "Hors ligne : tout partira au retour du réseau",
  erreur: "Erreur",
  pause: "En pause (activité anormale) : reprise automatique dans 10 min",
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
      <button type="button" className="btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setOuvert(true)}>
        Changer le mot de passe
      </button>
    );
  }
  return (
    <form onSubmit={soumettre} className="compte-pile">
      <Champ libelle="Nouveau mot de passe">
        <input type="password" className="field-input" autoComplete="new-password"
          value={mdp} onChange={(e) => setMdp(e.target.value)} />
      </Champ>
      <Champ libelle="Confirmer le nouveau mot de passe">
        <input type="password" className="field-input" autoComplete="new-password"
          value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      </Champ>
      {etat && (
        <Bandeau ton={etat.type === "ok" ? "succes" : "danger"} role={etat.type === "ok" ? "status" : "alert"}>{etat.texte}</Bandeau>
      )}
      <div className="regl-actions">
        <button type="submit" className="btn-primary" disabled={occupe}>{occupe ? "…" : "Enregistrer"}</button>
        <button type="button" className="btn-discret" onClick={() => { setOuvert(false); setEtat(null); }}>Annuler</button>
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
      <LigneListe libelle="Nom affiché" detail="Visible par l'enseignant">
        <span className="ui-ligne-valeur">{session.displayName || "Nom non renseigné"}</span>
        <button type="button" className="btn-discret" onClick={() => setEdition(session.displayName ?? "")}>
          Modifier
        </button>
      </LigneListe>
    );
  }
  return (
    <div className="compte-nom-edition">
      <input type="text" className="field-input" style={{ flex: "1 1 180px" }} maxLength={80} value={edition}
        aria-label="Nom affiché"
        onChange={(e) => setEdition(e.target.value)} placeholder="Prénom Nom" autoComplete="name" />
      <button type="button" className="btn-primary" onClick={() => void enregistrer()}>Enregistrer</button>
      <button type="button" className="btn-discret" onClick={() => { setEdition(null); setErreur(null); }}>Annuler</button>
      {erreur && <div className="ui-champ-erreur" style={{ width: "100%" }}>{erreur}</div>}
    </div>
  );
}

/** État de la sauvegarde en ligne (automatique) du travail. */
function EtatSynchro() {
  const s = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);

  if (s.liaison === "autre_compte") {
    return (
      <Bandeau ton="alerte">
        La sauvegarde en ligne n&apos;a pas pu démarrer : le stockage du navigateur est plein
        (le travail de l&apos;autre compte n&apos;a pas pu être mis de côté). Rien n&apos;est perdu ;
        libérez de la place, puis rechargez la page.
      </Bandeau>
    );
  }
  if (s.liaison !== "synchroniser") return null;

  const ton: TonPastille = s.statut === "a_jour" ? "succes"
    : s.statut === "hors_ligne" ? "neutre"
      : s.statut === "erreur" || s.statut === "pause" ? "danger" : "alerte";
  return (
    <LigneListe
      libelle="Sauvegarde en ligne automatique"
      accent={<Pastille point ton={ton} />}
      detail={<>
        {LIBELLES_STATUT[s.statut]}
        {s.statut === "en_attente" && s.enAttente > 0 ? ` (${s.enAttente} modification${s.enAttente > 1 ? "s" : ""})` : ""}
        {s.derniereReussite ? ` · dernière sauvegarde à ${new Date(s.derniereReussite).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : ""}
        {s.erreur && s.statut === "erreur" ? ` · code ${s.erreur.code}` : ""}
      </>}
    />
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

  return (
    <Page etroite>
      <EnTetePage
        titre="Compte"
        pastille={monte && configure && session ? <Pastille ton="succes">Connecté</Pastille> : undefined}
        sousTitre="La synchronisation en ligne est optionnelle. Sans compte, MineBackfill fonctionne entièrement en local dans votre navigateur."
      />

      {!monte ? null : !configure ? (
        <Carte titre="Synchronisation en ligne non configurée">
          <p className="classe-rien">
            Cette instance n&apos;a pas de connexion Supabase. Toutes vos données
            restent enregistrées localement. Voir <code>supabase/README.md</code>{" "}
            pour l&apos;activer.
          </p>
          <Link href="/" className="btn-discret" style={{ alignSelf: "flex-start" }}>Retour aux informations</Link>
        </Carte>
      ) : session ? (
        <>
          <Carte titre="Profil">
            <ListeGroupee>
              <NomAffiche />
              <LigneListe libelle="Courriel" valeur={session.email} />
              <LigneListe libelle="Rôle" valeur={session.role === "prof" ? "Enseignant" : "Étudiant"} />
              <EtatSynchro />
            </ListeGroupee>
            <p className="classe-intro">
              Vos résultats sauvegardés et vos gâchées sont sauvegardés en ligne et
              visibles par l&apos;enseignant ; les courbes de presse restent sur cet
              appareil. Les catalogues officiels publiés par l&apos;enseignant sont
              appliqués automatiquement (vos matériaux personnels sont conservés).
            </p>
          </Carte>
          <Carte titre="Sécurité">
            <ChangerMotDePasse />
            <button type="button" className="btn-discret btn-danger" onClick={deconnexion} disabled={loading} style={{ alignSelf: "flex-start" }}>
              {loading ? "…" : "Se déconnecter"}
            </button>
          </Carte>
        </>
      ) : (
        <div className="compte-formulaire">
          <Carte titre={mode === "oubli" ? "Mot de passe oublié" : undefined}>
            {mode !== "oubli" && (
              <Segmente
                ariaLabel="Connexion ou inscription"
                pleineLargeur
                valeur={mode}
                onChange={(m) => changerMode(m)}
                options={[
                  { valeur: "connexion", libelle: "Connexion" },
                  { valeur: "inscription", libelle: "Inscription" },
                ]}
              />
            )}
            <form onSubmit={soumettre} className="compte-pile">
              {mode === "oubli" && (
                <p className="classe-rien">
                  Indiquez le courriel de votre compte : vous recevrez un lien pour choisir un
                  nouveau mot de passe. Votre travail n&apos;est pas touché.
                </p>
              )}
              {mode === "inscription" && (
                <>
                  <Champ libelle="Prénom et nom (visible par l'enseignant)">
                    <input type="text" required maxLength={80} className="field-input" value={nom}
                      autoComplete="name" onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" />
                  </Champ>
                  {!enseignant ? (
                    <button type="button" className="btn-discret" style={{ alignSelf: "flex-start" }} onClick={() => setEnseignant(true)}>
                      Je suis l&apos;enseignant
                    </button>
                  ) : (
                    <Champ libelle="Code enseignant (fourni par l'administrateur du site)">
                      <input type="password" className="field-input" value={code} autoComplete="off"
                        onChange={(e) => setCode(e.target.value)} placeholder="Code enseignant" />
                    </Champ>
                  )}
                </>
              )}
              <Champ libelle="Courriel">
                <input type="email" required className="field-input" value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.ca" />
              </Champ>
              {mode !== "oubli" && (
                <Champ libelle="Mot de passe">
                  <input type="password" required className="field-input" value={motDePasse}
                    autoComplete={mode === "inscription" ? "new-password" : "current-password"}
                    onChange={(e) => setMotDePasse(e.target.value)} placeholder="••••••••" />
                </Champ>
              )}
              {mode === "connexion" && (
                <button type="button" className="btn-discret" style={{ alignSelf: "flex-start" }} onClick={() => changerMode("oubli")}>
                  Mot de passe oublié ?
                </button>
              )}
              {erreur && <Bandeau ton="danger" role="alert">{erreur}</Bandeau>}
              {info && <Bandeau ton="succes" role="status">{info}</Bandeau>}
              <button type="submit" className="btn-primary compte-soumettre" disabled={loading}>
                {loading ? "…" : mode === "connexion" ? "Se connecter" : mode === "oubli" ? "Envoyer le lien" : "Créer le compte"}
              </button>
              {mode === "oubli" && (
                <button type="button" className="btn-discret" style={{ alignSelf: "center" }} onClick={() => changerMode("connexion")}>
                  Retour à la connexion
                </button>
              )}
            </form>
          </Carte>
        </div>
      )}
    </Page>
  );
}
