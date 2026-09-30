// Pastille (statut, compteur). Sans hook.

export type TonPastille = "neutre" | "accent" | "succes" | "alerte" | "danger" | "violet" | "sombre";

export function Pastille({ children, ton = "neutre", title, point = false }: {
  children?: React.ReactNode;
  ton?: TonPastille;
  title?: string;
  /** Simple point de couleur (non lu, synchronisation). */
  point?: boolean;
}) {
  if (point) return <span className={`ui-point ui-point-${ton}`} title={title} aria-label={title} role={title ? "img" : undefined} />;
  return <span className={`ui-pastille ui-pastille-${ton}`} title={title}>{children}</span>;
}
