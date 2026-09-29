"use client";

// Page d'arrivée du lien « Mot de passe oublié ». Le lien du courriel ramène
// ici avec un jeton que le client Supabase lit dans l'adresse (fragment #…) :
// l'utilisateur est alors connecté le temps de choisir un nouveau mot de passe.
// Un lien expiré ou déjà utilisé revient avec #error=… : message en français.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { messageErreurAuth } from "@/lib/auth-messages";

/** Erreur renvoyée par Supabase dans le fragment de l'adresse (lien expiré…). */
function erreurDuLien(): string | null {
  if (typeof window === "undefined") return null;
  const h = new URLSearchParams(window.location.hash.slice(1));
  const q = new URLSearchParams(window.location.search);
  const erreur = h.get("error") ?? q.get("error");
  if (!erreur) return null;
  return messageErreurAuth(h.get("error_description") ?? q.get("error_description") ?? erreur,
    h.get("error_code") ?? q.get("error_code"));
}

export default function NouveauMotDePassePage() {
  const monte = useHydrated();
  // Lu au premier rendu client ; cette partie n'est affichée qu'après
  // l'hydratation, donc sans décalage avec le rendu serveur.
  const [erreurLien] = useState<string | null>(erreurDuLien);
  const [etat, setEtat] = useState<"verification" | "pret" | "sansSession" | "fait">("verification");
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (erreurLien) return;
    const sb = getSupabase();
    if (!sb) return;
    // getSession() attend que le client ait lu le jeton du lien.
    void sb.auth.getSession().then(({ data }) => setEtat(data.session ? "pret" : "sansSession"));
  }, [erreurLien]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) { setErreur("Au moins 8 caractères."); return; }
    if (mdp !== confirmation) { setErreur("Les deux saisies ne correspondent pas."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setOccupe(true);
    const { error } = await sb.auth.updateUser({ password: mdp });
    setOccupe(false);
    if (error) { setErreur(messageErreurAuth(error.message, error.code)); return; }
    setMdp(""); setConfirmation("");
    setEtat("fait");
  };

  const carte: React.CSSProperties = {
    maxWidth: 460, margin: "0 auto", background: "#fff",
    border: "1px solid var(--border)", borderRadius: 12, padding: "28px 26px",
  };
  const lienCompte = (
    <Link href="/compte?oubli=1" style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>
      Redemander un lien
    </Link>
  );

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Nouveau mot de passe</h1>
        {!monte ? null : (
          <div style={carte}>
            {erreurLien ? (
              <>
                <p style={{ fontSize: 13.5, color: "#991b1b", marginTop: 0 }}>{erreurLien}</p>
                {lienCompte}
              </>
            ) : !getSupabase() ? (
              <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: 0 }}>
                Les comptes ne sont pas activés sur ce site.
              </p>
            ) : etat === "verification" ? (
              <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: 0 }}>Vérification du lien…</p>
            ) : etat === "sansSession" ? (
              <>
                <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
                  Ce lien n&apos;est plus valable (il ne sert qu&apos;une fois, pendant une heure),
                  ou la page a été ouverte sans passer par le courriel.
                </p>
                {lienCompte}
              </>
            ) : etat === "fait" ? (
              <>
                <p style={{ fontSize: 13.5, color: "var(--success)", marginTop: 0 }}>
                  Mot de passe changé. Vous êtes connecté.
                </p>
                <Link href="/compte" style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>Aller à mon compte</Link>
              </>
            ) : (
              <form onSubmit={soumettre} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="password" className="field-input" placeholder="Nouveau mot de passe (8 caractères au moins)"
                  autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
                <input type="password" className="field-input" placeholder="Confirmer le nouveau mot de passe"
                  autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
                {erreur && (
                  <div style={{ fontSize: 12.5, color: "var(--danger)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 12px" }}>
                    {erreur}
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={occupe}>{occupe ? "…" : "Enregistrer le mot de passe"}</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
