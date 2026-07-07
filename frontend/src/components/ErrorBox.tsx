"use client";

import React, { useEffect, useRef } from "react";

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
      style={{
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 7,
        padding: "10px 14px",
        fontSize: 13,
        color: "#dc2626",
      }}
    >
      {message}
    </div>
  );
}
