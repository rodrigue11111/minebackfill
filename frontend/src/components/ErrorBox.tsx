"use client";

import { useEffect, useRef } from "react";

/**
 * Boîte d'erreur des formulaires de calcul. Sur les longs formulaires
 * (essai-erreur notamment) l'erreur apparaissait sous le bouton, hors
 * écran : ce composant se fait défiler dans la vue dès qu'un message
 * arrive, pour que l'échec ne passe jamais inaperçu.
 */
export default function ErrorBox({ message }: { message: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [message]);

  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className="ui-bandeau ui-bandeau-danger"
    >
      {message}
    </div>
  );
}
