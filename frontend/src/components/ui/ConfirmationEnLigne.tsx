"use client";

// Action à confirmer EN LIGNE, sans la boîte native confirm() : certains
// navigateurs intégrés la bloquent (l'action est alors impossible), et elle
// sort du style du site. Premier clic : la question et deux boutons
// apparaissent à la place ; seul « Confirmer… » agit. Le focus va sur
// « Annuler », le choix sans conséquence.

import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function ConfirmationEnLigne({ libelle, question, libelleConfirmer, onConfirmer, className, style }: {
  /** Bouton de départ (« Retirer »). */
  libelle: string;
  /** Conséquence en clair (« L'étudiant ne le verra plus. »). */
  question: string;
  /** Bouton qui agit (« Confirmer le retrait »). */
  libelleConfirmer: string;
  onConfirmer: () => void | Promise<void>;
  className?: string;
  style?: CSSProperties;
}) {
  const [demande, setDemande] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const annuler = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (demande) annuler.current?.focus(); }, [demande]);

  if (!demande) {
    return <button type="button" className={className} style={style} onClick={() => setDemande(true)}>{libelle}</button>;
  }
  const confirmer = async () => {
    setOccupe(true);
    try { await onConfirmer(); } finally { setOccupe(false); setDemande(false); }
  };
  return (
    <span role="group" aria-label={`${libelle} : ${question}`} style={{ display: "inline-flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--texte-2)" }}>{question}</span>
      <button type="button" className={className} style={{ ...style, color: "var(--danger-texte)", fontWeight: 600 }}
        disabled={occupe} onClick={() => void confirmer()}>
        {libelleConfirmer}
      </button>
      <button type="button" ref={annuler} className={className} style={style} disabled={occupe} onClick={() => setDemande(false)}>
        Annuler
      </button>
    </span>
  );
}
