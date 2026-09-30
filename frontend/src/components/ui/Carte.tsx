// Carte blanche (rayon 22, ombre douce, sans bordure). Sans hook.

export function Carte({ titre, aside, actions, children, className, sansMarge = false, id, ...aria }: {
  titre?: React.ReactNode;
  /** Texte discret à droite du titre. */
  aside?: React.ReactNode;
  /** Boutons à droite du titre. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Contenu collé aux bords (liste groupée, tableau pleine largeur). */
  sansMarge?: boolean;
  id?: string;
  "aria-label"?: string;
  "data-section"?: string;
}) {
  return (
    <section id={id} className={`ui-carte${sansMarge ? " ui-carte-sans-marge" : ""}${className ? ` ${className}` : ""}`} {...aria}>
      {(titre || aside || actions) && (
        <div className="ui-carte-tete">
          {titre && <h2 className="ui-carte-titre">{titre}</h2>}
          {(aside || actions) && (
            <div className="ui-carte-droite">
              {aside && <span className="ui-carte-aside">{aside}</span>}
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
