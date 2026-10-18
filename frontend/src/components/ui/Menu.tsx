"use client";

// Menu déroulant sur l'API Popover du navigateur : fermeture par Échap et par
// clic extérieur, couche supérieure (jamais rogné par un conteneur défilant),
// sans état React. La position sous le bouton est calculée à l'ouverture.
// Clavier : le focus entre sur le premier élément à l'ouverture ; flèches,
// Début et Fin passent d'un élément à l'autre ; Échap ferme et rend le focus
// au bouton (en plus de la fermeture native, pour ne dépendre d'aucun navigateur).

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
  const elementsActifs = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = elementsActifs(e.currentTarget);
    const i = items.indexOf(document.activeElement as HTMLElement);
    let j: number | null = null;
    if (e.key === "ArrowDown") j = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === "ArrowUp") j = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = items.length - 1;
    else if (e.key === "Escape") {
      e.preventDefault();
      fermer();
      document.querySelector<HTMLElement>(`[data-menu-bouton="${id}"]`)?.focus();
      return;
    }
    if (j !== null && items.length > 0) { e.preventDefault(); items[j].focus(); }
  };
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
        onKeyDown={surTouche}
        onToggle={(e) => {
          if (e.newState !== "open") return;
          const menu = e.currentTarget;
          requestAnimationFrame(() => elementsActifs(menu)[0]?.focus());
        }}
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
