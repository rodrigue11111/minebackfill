"use client";

// Feuille qui monte du bas (téléphone) ou boîte centrée (bureau), sur
// l'élément <dialog> natif : focus piégé, Échap, fond assombri, sans
// bibliothèque. Ouverture pilotée par la propriété `ouverte`.

import { useEffect, useRef } from "react";
import { Icone } from "./Icones";

export default function Feuille({ ouverte, onFermer, titre, children, large = false }: {
  ouverte: boolean;
  onFermer: () => void;
  titre: React.ReactNode;
  children: React.ReactNode;
  /** Presque tout l'écran : une figure agrandie (Analyse, 2026-10-30). */
  large?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);
  return (
    <dialog
      ref={ref}
      className={large ? "ui-feuille ui-feuille-large" : "ui-feuille"}
      aria-label={typeof titre === "string" ? titre : undefined}
      onClose={onFermer}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <div className="ui-feuille-corps">
        <div className="ui-feuille-tete">
          <h2 className="ui-feuille-titre">{titre}</h2>
          <button type="button" className="ui-bouton-icone" aria-label="Fermer" onClick={onFermer}>
            <Icone nom="fermer" taille={18} epaisseur={2} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
