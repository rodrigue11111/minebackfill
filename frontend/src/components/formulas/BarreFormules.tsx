"use client";

// Barre de l'enseignant sur la page Formules (2026-10-29) : état du brouillon
// (« Modifications non publiées » ou « À jour »), date de la dernière
// publication, et les actions : ajouter une fiche, publier, revenir aux
// formules du cours. Publication : formules-publication.ts.

import { useState } from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { publierCatalogue } from "@/lib/cloud";
import { publierFormules } from "@/lib/formules-publication";
import { coucheVide, proprietaireFormules, type Rejet } from "@/lib/formules-enseignant";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";
import { useFormules } from "@/lib/use-formules";
import { Bandeau } from "@/components/ui/Bandeau";

export const dateHeurePublication = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
};

export default function BarreFormules({ onAjouter, onOuvrir }: {
  onAjouter: () => void;
  /** Ouvre une fiche (rejet à corriger). */
  onOuvrir: (id: string) => void;
}) {
  const { proprietaire, brouillon, publication, nonPubliees } = useFormules();
  const session = useStore((s) => s.session);
  const definirPubliees = useStore((s) => s.definirFormulesPubliees);
  const abandonner = useStore((s) => s.abandonnerBrouillon);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [rejets, setRejets] = useState<Rejet[]>([]);
  if (!proprietaire) return null;

  const peutPublier = session?.role === "prof" && getSupabase() !== null;

  const publier = async (versCours: boolean) => {
    const sb = getSupabase();
    if (!sb || !session) return;
    setOccupe(true);
    setMessage(null);
    setRejets([]);
    const r = await publierFormules({
      brouillon: versCours ? coucheVide() : brouillon ?? publication?.couche ?? coucheVide(),
      proprietaire,
      publieePar: session.displayName ?? session.email ?? null,
      maintenant: new Date(),
      envoyer: (env) => publierCatalogue(sb, "formules", env, session.userId),
      definirPubliees,
      proprietaireCourant: () => proprietaireFormules(useStore.getState().session, MODE_TEST_SANS_COMPTE),
    });
    setOccupe(false);
    if (r.etat === "refusee") { setRejets(r.rejets); return; }
    if (r.etat === "erreur") { setMessage({ ton: "danger", texte: `Publication impossible : ${r.message}` }); return; }
    if (!r.pourCeCompte) return;
    if (versCours) abandonner(proprietaire);
    setMessage({ ton: "succes", texte: versCours ? "Les étudiants voient de nouveau les formules du cours." : "Fiches publiées : les étudiants les voient à leur prochaine connexion." });
  };

  return (
    <div className="frm-barre" aria-label="Fiches de l'enseignant">
      <div className="frm-barre-etat">
        <strong>{nonPubliees ? "Modifications non publiées" : "À jour"}</strong>
        <span>
          {publication
            ? <> · Dernière publication : {dateHeurePublication(publication.publieeLe)}{publication.publieePar ? `, par ${publication.publieePar}` : ""}</>
            : " · Aucune fiche publiée : les étudiants voient les formules du cours."}
        </span>
      </div>
      <div className="frm-barre-actions">
        <button type="button" className="btn-secondary" onClick={onAjouter}>Ajouter une formule</button>
        {peutPublier ? (
          <>
            <button type="button" className="btn-primary" disabled={occupe || !nonPubliees} onClick={() => void publier(false)}>
              {occupe ? "Publication…" : "Publier en ligne"}
            </button>
            {publication && (publication.couche.ajoutees.length > 0 || Object.keys(publication.couche.modifiees).length > 0) && (
              <button type="button" className="btn-discret btn-danger" disabled={occupe}
                onClick={() => {
                  if (window.confirm("Revenir aux formules du cours ? Vos fiches modifiées et ajoutées seront retirées, pour vous et pour les étudiants.")) void publier(true);
                }}>
                Revenir aux formules du cours
              </button>
            )}
          </>
        ) : (
          <span className="frm-barre-note">Publication impossible sans compte enseignant connecté : vos fiches restent sur cet appareil.</span>
        )}
        {brouillon && nonPubliees && (
          <button type="button" className="btn-discret" disabled={occupe}
            onClick={() => {
              if (window.confirm(publication ? "Abandonner vos modifications et revenir à la version publiée ?" : "Abandonner vos modifications et revenir aux formules du cours ?")) abandonner(proprietaire);
            }}>
            Abandonner mes modifications
          </button>
        )}
      </div>
      {rejets.length > 0 && (
        <Bandeau ton="danger" role="alert" titre="Rien n'a été publié : corrigez d'abord ces fiches.">
          <ul className="frm-barre-rejets">
            {rejets.map((r, i) => (
              <li key={i}>
                {r.id !== "*" ? <button type="button" className="btn-discret" onClick={() => onOuvrir(r.id)}>{r.id}</button> : "Ensemble"} : {r.raison}
              </li>
            ))}
          </ul>
        </Bandeau>
      )}
      {message && <Bandeau ton={message.ton} role="status">{message.texte}</Bandeau>}
    </div>
  );
}
