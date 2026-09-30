// Bandeau d'information ou d'alerte, pâle et arrondi. Sans hook.

export type TonBandeau = "info" | "alerte" | "succes" | "danger" | "neutre";

export function Bandeau({ ton = "info", titre, children, actions, role }: {
  ton?: TonBandeau;
  titre?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** « alert » pour une erreur annoncée aux lecteurs d'écran. */
  role?: "alert" | "status";
}) {
  return (
    <div className={`ui-bandeau ui-bandeau-${ton}`} role={role}>
      <div className="ui-bandeau-texte">
        {titre && <strong className="ui-bandeau-titre">{titre}</strong>}
        {children && <div>{children}</div>}
      </div>
      {actions && <div className="ui-bandeau-actions">{actions}</div>}
    </div>
  );
}
