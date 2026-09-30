"use client";

// Menu déroulant sur l'API Popover du navigateur : fermeture par Échap et par
// clic extérieur, couche supérieure (jamais rogné par un conteneur défilant),
// sans état React. La position sous le bouton est calculée à l'ouverture.

import Link from "next/link";
import { useId } from "react";

export interface ElementMenu {
  libelle: React.ReactNode;
  /** Action ; le menu se ferme ensuite. */
  onSelect?: () => void;
  /** Lien interne (ou externe si `externe`). */
  href?: string;
  externe?: boolean;
  desactive?: boolean;
  /** Détail discret sous le libellé. */
  detail?: React.ReactNode;
}

export default function Menu({ declencheur, elements, className = "btn-secondary", ariaLabel, aligner = "droite", titre }: {
  declencheur: React.ReactNode;
  elements: (ElementMenu | "separateur")[];
  className?: string;
  ariaLabel?: string;
  aligner?: "gauche" | "droite";
  /** Petit titre en tête du menu. */
  titre?: React.ReactNode;
}) {
  const id = `menu-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fermer = () => document.getElementById(id)?.hidePopover();
  return (
    <>
      <button
        type="button"
        className={className}
        popoverTarget={id}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        data-menu-bouton={id}
      >
        {declencheur}
      </button>
      <div
        id={id}
        popover="auto"
        role="menu"
        className="ui-menu"
        onBeforeToggle={(e) => {
          if (e.newState !== "open") return;
          const bouton = document.querySelector<HTMLElement>(`[data-menu-bouton="${id}"]`);
          const menu = e.currentTarget;
          if (!bouton) return;
          const r = bouton.getBoundingClientRect();
          const largeur = Math.max(menu.offsetWidth || 220, 220);
          const gauche = aligner === "droite" ? r.right - largeur : r.left;
          menu.style.top = `${Math.round(r.bottom + 6)}px`;
          menu.style.left = `${Math.round(Math.max(8, Math.min(gauche, window.innerWidth - largeur - 8)))}px`;
        }}
      >
        {titre && <div className="ui-menu-titre">{titre}</div>}
        {elements.map((el, i) => {
          if (el === "separateur") return <div key={i} className="ui-menu-separateur" role="separator" />;
          const contenu = (
            <>
              <span>{el.libelle}</span>
              {el.detail && <span className="ui-menu-detail">{el.detail}</span>}
            </>
          );
          if (el.href) {
            return el.externe
              ? <a key={i} role="menuitem" className="ui-menu-element" href={el.href} onClick={fermer}>{contenu}</a>
              : <Link key={i} role="menuitem" className="ui-menu-element" href={el.href} onClick={fermer}>{contenu}</Link>;
          }
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="ui-menu-element"
              disabled={el.desactive}
              onClick={() => { fermer(); el.onSelect?.(); }}
            >
              {contenu}
            </button>
          );
        })}
      </div>
    </>
  );
}
