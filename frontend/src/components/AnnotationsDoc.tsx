"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { annotationsDe, type Annotation } from "@/lib/annotations";
import { chargerEtatSync } from "@/lib/sync-etat";
import { cleDoc } from "@/lib/sync-moteur";
import { marquerCommentairesLus, repondreCommentaire, retirerMaReponse } from "@/lib/sync-client";

const dateHeure = (iso: string) => new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });

/**
 * Échanges avec l'enseignant sur un document de l'étudiant : ses
 * commentaires, et les réponses de l'étudiant (fil par document). Affichés,
 * les commentaires de l'enseignant sont marqués LUS (l'enseignant voit
 * « vu le … »). Signale un commentaire écrit sur une version ANTÉRIEURE :
 * l'étudiant a modifié le document depuis.
 */
export default function AnnotationsDoc({ kind, id }: { kind: "resultat" | "gachee"; id: string }) {
  const toutes = useStore((s) => s.annotations);
  const connecte = useStore((s) => s.session !== null);
  return <FilEtudiant kind={kind} id={id} liste={annotationsDe(toutes, kind, id)} connecte={connecte} />;
}

/**
 * Le fil lui-même, à partir de données simples (testable sans magasin).
 * `ancre` : fil d'une note EN CONTEXTE (une pesée, une éprouvette) — la
 * réponse part sous cette note, et le cadre est allégé.
 */
export function FilEtudiant({ kind, id, liste, connecte, ancre = null }: {
  kind: "resultat" | "gachee";
  id: string;
  liste: Annotation[];
  connecte: boolean;
  ancre?: string | null;
}) {
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Accusé de lecture des commentaires de l'enseignant affichés ici.
  const aMarquer = liste.filter((a) => a.auteur === "enseignant" && a.luLe === null).map((a) => a.id).join(",");
  useEffect(() => {
    if (aMarquer) void marquerCommentairesLus(aMarquer.split(","));
  }, [aMarquer]);

  if (liste.length === 0) return null;
  const revActuelle = chargerEtatSync().docs[cleDoc(kind, id)]?.rev ?? null;
  const envoyer = async () => {
    setOccupe(true);
    setErreur(null);
    const e = await repondreCommentaire(kind, id, texte, ancre);
    setOccupe(false);
    // Texte gardé en cas d'échec : rien n'est perdu.
    if (e) { setErreur(e); return; }
    setTexte("");
    setOuvert(false);
  };
  const retirer = async (idA: string) => {
    if (!window.confirm("Retirer votre réponse ? L'enseignant ne la verra plus.")) return;
    const e = await retirerMaReponse(idA);
    if (e) window.alert(`Retrait impossible : ${e}.`);
  };

  return (
    <div className={ancre ? "fil fil-contexte" : "fil"}>
      {!ancre && <div className="fil-titre">Échanges avec l&apos;enseignant</div>}
      <div className="fil-liste">
        {liste.map((a) => {
          const moi = a.auteur === "moi";
          return (
            <div key={a.id} className={moi ? "fil-message fil-moi" : "fil-message"}>
              <span className={moi ? "fil-avatar fil-avatar-moi" : "fil-avatar"} aria-hidden="true">{moi ? "V" : "E"}</span>
              <div className="fil-bulle">
                <div className="fil-auteur">
                  <strong>{moi ? "Vous" : "Enseignant"}</strong>
                  <span className="fil-date"> · {dateHeure(a.creeLe)}</span>
                </div>
                <div className="fil-texte">
                  {a.ancre && !ancre && <strong>{a.ancre} : </strong>}
                  <span style={{ whiteSpace: "pre-wrap" }}>{a.texte}</span>
                </div>
                <div className="fil-pied">
                  <span>
                    {!moi && a.cibleRev !== null && revActuelle !== null && revActuelle > a.cibleRev
                      ? "écrit sur une version antérieure, modifiée depuis" : ""}
                    {moi && (a.luLe ? `vu par l'enseignant le ${dateHeure(a.luLe)}` : "pas encore lu par l'enseignant")}
                  </span>
                  {moi && (
                    <button type="button" className="fil-lien" onClick={() => void retirer(a.id)}>
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!connecte ? (
        <p className="fil-note">Connectez-vous (page Compte) pour répondre.</p>
      ) : !ouvert ? (
        <button type="button" className="btn-discret fil-repondre" onClick={() => setOuvert(true)}>
          Répondre
        </button>
      ) : (
        <div className="fil-formulaire">
          <textarea className="field-input" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} rows={3}
            placeholder="Votre réponse (visible par l'enseignant)" />
          {erreur && <div role="alert" className="ui-champ-erreur">Réponse non envoyée : {erreur}. Votre texte est conservé.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" disabled={occupe || !texte.trim()} onClick={() => void envoyer()}>
              {occupe ? "…" : "Envoyer la réponse"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setOuvert(false); setErreur(null); }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
