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

/** Le fil lui-même, à partir de données simples (testable sans magasin). */
export function FilEtudiant({ kind, id, liste, connecte }: {
  kind: "resultat" | "gachee";
  id: string;
  liste: Annotation[];
  connecte: boolean;
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
    const e = await repondreCommentaire(kind, id, texte);
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
    <div style={{ marginTop: 12, border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#3730a3", marginBottom: 6 }}>Échanges avec l&apos;enseignant</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {liste.map((a) => {
          const moi = a.auteur === "moi";
          return (
            <div key={a.id} style={{
              fontSize: 13, color: "#1e1b4b", lineHeight: 1.5,
              ...(moi ? { background: "#fff", border: "1px solid #e0e7ff", borderRadius: 6, padding: "6px 9px", marginLeft: 18 } : {}),
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: moi ? "#475569" : "#3730a3" }}>{moi ? "Vous" : "Enseignant"}</div>
              {a.ancre && <span style={{ fontWeight: 700 }}>{a.ancre} — </span>}
              <span style={{ whiteSpace: "pre-wrap" }}>{a.texte}</span>
              <div style={{ fontSize: 11.5, color: "#6366f1", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span>
                  {dateHeure(a.creeLe)}
                  {!moi && a.cibleRev !== null && revActuelle !== null && revActuelle > a.cibleRev
                    ? " · écrit sur une version antérieure, modifiée depuis" : ""}
                  {moi && (a.luLe ? ` · vu par l'enseignant le ${dateHeure(a.luLe)}` : " · pas encore lu par l'enseignant")}
                </span>
                {moi && (
                  <button type="button" onClick={() => void retirer(a.id)}
                    style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 11.5, padding: 0 }}>
                    Retirer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!connecte ? (
        <p style={{ fontSize: 12, color: "#6366f1", margin: "8px 0 0" }}>Connectez-vous (page Compte) pour répondre.</p>
      ) : !ouvert ? (
        <button type="button" onClick={() => setOuvert(true)}
          style={{ marginTop: 8, background: "none", border: "none", color: "#3730a3", cursor: "pointer", fontSize: 12.5, padding: 0, fontWeight: 600 }}>
          Répondre
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} rows={3}
            placeholder="Votre réponse (visible par l'enseignant)"
            style={{ border: "1px solid #c7d2fe", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", background: "#fff" }} />
          {erreur && <div role="alert" style={{ fontSize: 12, color: "#991b1b" }}>Réponse non envoyée : {erreur}. Votre texte est conservé.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} disabled={occupe || !texte.trim()} onClick={() => void envoyer()}>
              {occupe ? "…" : "Envoyer la réponse"}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => { setOuvert(false); setErreur(null); }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
