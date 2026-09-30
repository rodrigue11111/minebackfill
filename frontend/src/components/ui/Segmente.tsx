"use client";

// Contrôle segmenté (pilule grise, segment actif blanc). Deux rôles :
// - « radiogroup » : choix d'une valeur (catégorie, méthode) ;
// - « tablist » : onglets d'une page (les panneaux portent role="tabpanel").
// Clavier : flèches gauche/droite (et haut/bas), Début, Fin ; un seul arrêt de
// tabulation (tabindex mobile). Aucun hook : l'état vit chez l'appelant.

export interface OptionSegment<V extends string> {
  valeur: V;
  libelle: React.ReactNode;
  /** Compteur ou point à droite du libellé. */
  badge?: React.ReactNode;
  desactive?: boolean;
  /** Infobulle (ex. pourquoi l'option est désactivée). */
  title?: string;
  /** Id du panneau contrôlé (rôle tablist). */
  controle?: string;
  id?: string;
}

export default function Segmente<V extends string>({ options, valeur, onChange, role = "radiogroup", ariaLabel, taille = "normal", pleineLargeur = false }: {
  options: OptionSegment<V>[];
  valeur: V;
  onChange: (v: V) => void;
  role?: "radiogroup" | "tablist";
  ariaLabel: string;
  taille?: "normal" | "compact";
  pleineLargeur?: boolean;
}) {
  const actives = options.filter((o) => !o.desactive);
  const choisir = (v: V, conteneur: HTMLElement | null) => {
    onChange(v);
    // Le focus suit la sélection (tabindex mobile).
    const cible = conteneur?.querySelector<HTMLButtonElement>(`[data-valeur="${CSS.escape(v)}"]`);
    cible?.focus();
  };
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`ui-segmente${taille === "compact" ? " ui-segmente-compact" : ""}${pleineLargeur ? " ui-segmente-plein" : ""}`}
      onKeyDown={(e) => {
        const i = actives.findIndex((o) => o.valeur === valeur);
        let j = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % actives.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + actives.length) % actives.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = actives.length - 1;
        if (j < 0 || actives.length === 0) return;
        e.preventDefault();
        choisir(actives[j].valeur, e.currentTarget);
      }}
    >
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            id={o.id}
            type="button"
            data-valeur={o.valeur}
            role={role === "tablist" ? "tab" : "radio"}
            aria-checked={role === "radiogroup" ? actif : undefined}
            aria-selected={role === "tablist" ? actif : undefined}
            aria-controls={o.controle}
            tabIndex={actif ? 0 : -1}
            disabled={o.desactive}
            title={o.title}
            className={actif ? "ui-segment ui-segment-actif" : "ui-segment"}
            onClick={() => onChange(o.valeur)}
          >
            {o.libelle}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}
