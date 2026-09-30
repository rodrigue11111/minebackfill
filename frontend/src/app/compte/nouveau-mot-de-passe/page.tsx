"use client";

// Page d'arrivée du lien « Mot de passe oublié ».
//
// Lien recommandé (modèle de courriel, supabase/README.md) :
//   /compte/nouveau-mot-de-passe?token_hash=…&type=recovery
// Le jeton n'est vérifié QU'AU CLIC sur « Enregistrer ». Pourquoi : les
// messageries universitaires (Microsoft 365, « Safe Links ») ouvrent chaque
// lien d'un courriel pour l'analyser. Un lien qui consomme le jeton dès
// l'ouverture arrivait donc « expiré » chez l'étudiant ; un analyseur, lui,
// ne remplit jamais de formulaire.
//
// Ancien lien (jeton déjà vérifié par Supabase, session dans le fragment #…)
// encore accepté ; un lien expiré revient avec #error=… : message en français.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { messageErreurAuth } from "@/lib/auth-messages";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";

/** Erreur renvoyée par Supabase dans l'adresse (lien expiré…). */
function erreurDuLien(): string | null {
  if (typeof window === "undefined") return null;
  const h = new URLSearchParams(window.location.hash.slice(1));
  const q = new URLSearchParams(window.location.search);
  const erreur = h.get("error") ?? q.get("error");
  if (!erreur) return null;
  return messageErreurAuth(h.get("error_description") ?? q.get("error_description") ?? erreur,
    h.get("error_code") ?? q.get("error_code"));
}

/** Jeton du lien recommandé (?token_hash=…&type=recovery), ou null. */
function jetonDuLien(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const t = q.get("token_hash");
  return t && (q.get("type") ?? "recovery") === "recovery" ? t : null;
}

export default function NouveauMotDePassePage() {
  const monte = useHydrated();
  // Lus au premier rendu client ; cette partie n'est affichée qu'après
  // l'hydratation, donc sans décalage avec le rendu serveur.
  const [erreurLien] = useState<string | null>(erreurDuLien);
  const [jeton] = useState<string | null>(jetonDuLien);
  const [etat, setEtat] = useState<"verification" | "pret" | "sansSession" | "fait">(() =>
    jetonDuLien() ? "pret" : "verification");
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Le jeton ne sert qu'une fois : vérifié, on ne le renvoie plus (un
  // nouvel essai de mot de passe réutilise la session obtenue).
  const jetonVerifie = useRef(false);

  useEffect(() => {
    if (erreurLien || jeton) return;
    const sb = getSupabase();
    if (!sb) return;
    // Ancien lien : getSession() attend que le client ait lu la session du fragment.
    void sb.auth.getSession().then(({ data }) => setEtat(data.session ? "pret" : "sansSession"));
  }, [erreurLien, jeton]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) { setErreur("Au moins 8 caractères."); return; }
    if (mdp !== confirmation) { setErreur("Les deux saisies ne correspondent pas."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setOccupe(true);
    try {
      if (jeton && !jetonVerifie.current) {
        const { error } = await sb.auth.verifyOtp({ token_hash: jeton, type: "recovery" });
        if (error) { setErreur(messageErreurAuth(error.message, error.code)); return; }
        jetonVerifie.current = true;
        // Le jeton n'a plus rien à faire dans l'adresse (historique, partage).
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { error } = await sb.auth.updateUser({ password: mdp });
      if (error) { setErreur(messageErreurAuth(error.message, error.code)); return; }
      setMdp(""); setConfirmation("");
      setEtat("fait");
    } finally {
      setOccupe(false);
    }
  };

  const lienCompte = (
    <Link href="/compte?oubli=1" className="btn-discret" style={{ alignSelf: "flex-start" }}>
      Redemander un lien
    </Link>
  );

  return (
    <Page etroite>
      <EnTetePage titre="Nouveau mot de passe" />
      {!monte ? null : (
        <div className="compte-formulaire">
          <Carte>
            {erreurLien ? (
              <>
                <Bandeau ton="danger" role="alert">{erreurLien}</Bandeau>
                {lienCompte}
              </>
            ) : !getSupabase() ? (
              <p className="classe-rien">
                Les comptes ne sont pas activés sur ce site.
              </p>
            ) : etat === "verification" ? (
              <p className="classe-rien">Vérification du lien…</p>
            ) : etat === "sansSession" ? (
              <>
                <p className="classe-rien">
                  Ce lien n&apos;est plus valable (il ne sert qu&apos;une fois, pendant une heure),
                  ou la page a été ouverte sans passer par le courriel.
                </p>
                {lienCompte}
              </>
            ) : etat === "fait" ? (
              <>
                <Bandeau ton="succes" role="status">
                  Mot de passe changé. Vous êtes connecté.
                </Bandeau>
                <Link href="/compte" className="btn-primary" style={{ alignSelf: "flex-start" }}>Aller à mon compte</Link>
              </>
            ) : (
              <form onSubmit={soumettre} className="compte-pile">
                <Champ libelle="Nouveau mot de passe" aide="8 caractères au moins.">
                  <input type="password" className="field-input"
                    autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
                </Champ>
                <Champ libelle="Confirmer le nouveau mot de passe">
                  <input type="password" className="field-input"
                    autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
                </Champ>
                {erreur && (
                  <Bandeau ton="danger" role="alert" actions={/expiré/.test(erreur) ? lienCompte : undefined}>
                    {erreur}
                  </Bandeau>
                )}
                <button type="submit" className="btn-primary compte-soumettre" disabled={occupe}>{occupe ? "…" : "Enregistrer le mot de passe"}</button>
              </form>
            )}
          </Carte>
        </div>
      )}
    </Page>
  );
}
