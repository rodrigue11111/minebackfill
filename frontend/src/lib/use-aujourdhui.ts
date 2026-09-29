// frontend/src/lib/use-aujourdhui.ts
// « Aujourd'hui » pour les échéanciers et les badges. En état (pas en plein
// rendu) : le React Compiler figerait un `new Date()` de rendu au premier
// appel et l'horloge ne changerait jamais de jour. On ne re-rend qu'au
// changement de jour (échéances au jour près), au focus et au retour d'onglet.

import { useEffect, useState } from "react";

export function useAujourdhui(): Date {
  const [maintenant, setMaintenant] = useState<Date>(() => new Date());
  useEffect(() => {
    const tick = () =>
      setMaintenant((prev) => {
        const n = new Date();
        return n.toDateString() === prev.toDateString() ? prev : n;
      });
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return maintenant;
}
