// Onglet « Comptes » : tous les comptes, nommer ou retirer un enseignant,
// bloquer ou débloquer un étudiant. La suppression définitive n'a pas de
// bouton : irréversible, elle reste une procédure SQL (docs/OPERATIONS.md).

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { bloquerCompte, definirRole, lireComptes, messageErreurClasse, type CompteClasse } from "@/lib/classe-reseau";
import { dateCourte, Pastille, td, th } from "./commun";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import { TIRET } from "@/lib/format";

const nomDe = (c: CompteClasse) => c.nom?.trim() || c.courriel || `Compte ${c.id.slice(0, 8)}`;

/** Ce que chaque action fait, dit AVANT de la faire. */
export function confirmationAction(action: "nommer" | "retirer" | "bloquer" | "debloquer", nom: string): string {
  switch (action) {
    case "nommer":
      return `Nommer ${nom} enseignant ?\n\nIl verra le travail de tous les étudiants, pourra commenter, publier les catalogues et gérer les comptes. Son propre travail ne figurera plus dans la liste des étudiants. Réversible.`;
    case "retirer":
      return `Retirer le rôle d'enseignant à ${nom} ?\n\nIl redevient étudiant. Le serveur applique le changement tout de suite ; son menu se met à jour à sa prochaine connexion (au plus tard dans l'heure).`;
    case "bloquer":
      return `Bloquer ${nom} ?\n\nSa connexion est refusée ; s'il est connecté, il est déconnecté au plus tard dans l'heure. Rien n'est effacé : son travail en ligne reste visible pour vous, et celui de son navigateur y reste aussi. Réversible (« Débloquer »).`;
    case "debloquer":
      return `Débloquer ${nom} ? Il pourra de nouveau se connecter.`;
  }
}

export default function OngletComptes({ moi, onChangement }: {
  moi: string;
  /** Un rôle a changé : la classe doit être relue (un étudiant nommé la quitte). */
  onChangement: () => void;
}) {
  const [comptes, setComptes] = useState<CompteClasse[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setEtat("chargement");
    try {
      setComptes(await lireComptes(sb));
      setEtat("pret");
    } catch (e) {
      setErreur(messageErreurClasse(e));
      setEtat("erreur");
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const agir = async (c: CompteClasse, action: "nommer" | "retirer" | "bloquer" | "debloquer") => {
    const sb = getSupabase();
    if (!sb || !window.confirm(confirmationAction(action, nomDe(c)))) return;
    setOccupe(c.id);
    try {
      if (action === "nommer" || action === "retirer") {
        await definirRole(sb, c.id, action === "nommer" ? "prof" : "etudiant");
        onChangement();
      } else {
        await bloquerCompte(sb, c.id, action === "bloquer");
      }
      await charger();
    } catch (e) {
      window.alert(`Action impossible : ${messageErreurClasse(e)}.`);
    } finally {
      setOccupe(null);
    }
  };

  const bouton = (c: CompteClasse, action: "nommer" | "retirer" | "bloquer" | "debloquer", libelle: string, desactive = false) => (
    <button type="button" className="btn-secondary" style={{ fontSize: 13, minHeight: 30, padding: "0 12px" }}
      disabled={occupe !== null || desactive} onClick={() => void agir(c, action)}>{libelle}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className="classe-intro">
        Tous les comptes inscrits. Un enseignant voit le travail de toute la classe : ne nommez que des
        personnes de confiance. Bloquer refuse la connexion sans rien effacer.
      </p>
      {etat === "erreur" && (
        <Bandeau ton="danger" role="alert">Lecture des comptes impossible : {erreur}.</Bandeau>
      )}
      {etat === "chargement" && <p className="classe-rien">Lecture des comptes…</p>}
      {etat === "pret" && (
        <Carte titre="Comptes" aside={`${comptes.length}`} sansMarge>
          <div className="classe-tableau">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr>{["Nom", "Courriel", "Rôle", "Inscrit le", "Dernière connexion", "Travail en ligne", "Dernière activité", "État", ""].map((t, i) => <th key={i} style={th}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {comptes.map((c) => {
                const soi = c.id === moi;
                const bloque = c.bloqueJusquA !== null;
                return (
                  <tr key={c.id} style={{ background: bloque ? "var(--danger-pale)" : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.nom?.trim() || TIRET}</td>
                    <td style={td}>{c.courriel ?? TIRET}</td>
                    <td style={td}>{c.role === "prof" ? <Pastille ton="bleu">enseignant</Pastille> : "étudiant"}</td>
                    <td style={td}>{dateCourte(c.creeLe)}</td>
                    <td style={td}>{dateCourte(c.derniereConnexion)}</td>
                    <td style={td}>{c.nbResultats} résultat{c.nbResultats > 1 ? "s" : ""} · {c.nbGachees} gâchée{c.nbGachees > 1 ? "s" : ""}</td>
                    <td style={td}>{dateCourte(c.derniereActivite)}</td>
                    <td style={td}>{bloque ? <Pastille ton="rouge">bloqué</Pastille> : "actif"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {soi ? <span style={{ color: "var(--texte-3)", fontSize: 13 }}>vous</span> : (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          {c.role === "prof"
                            ? bouton(c, "retirer", "Retirer le rôle enseignant")
                            : <>
                                {bouton(c, "nommer", "Nommer enseignant", bloque)}
                                {bloque ? bouton(c, "debloquer", "Débloquer") : bouton(c, "bloquer", "Bloquer")}
                              </>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Carte>
      )}
      <p className="classe-intro">
        Supprimer définitivement un compte et son travail est irréversible : ce n&apos;est pas un bouton, mais une
        procédure SQL à suivre pas à pas (docs/OPERATIONS.md, « Effacer le compte d&apos;un étudiant »). Le même blocage existe dans
        Supabase Studio (Authentication → Users → « Ban user ») ; un compte bloqué là apparaît bloqué ici.
      </p>
    </div>
  );
}
