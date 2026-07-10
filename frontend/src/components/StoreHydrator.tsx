"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Hydrate l'état du store depuis localStorage une fois, au montage global de
 * l'application. Sans cela, le catalogue de liants, les constantes et les
 * infos de projet — qui n'étaient rechargés nulle part — repartaient de leurs
 * valeurs par défaut à chaque rechargement de page. Composant sans rendu.
 */
export default function StoreHydrator() {
  const {
    loadGeneral,
    loadConstantes,
    loadCatalogue,
    loadUnits,
    loadSavedResults,
    loadBinderPrices,
    loadProductionLog,
  } = useStore();

  useEffect(() => {
    loadGeneral();
    loadConstantes();
    loadCatalogue();
    loadUnits();
    loadSavedResults();
    loadBinderPrices();
    loadProductionLog();
  }, [
    loadGeneral,
    loadConstantes,
    loadCatalogue,
    loadUnits,
    loadSavedResults,
    loadBinderPrices,
    loadProductionLog,
  ]);

  return null;
}
