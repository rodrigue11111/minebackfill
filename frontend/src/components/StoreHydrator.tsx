"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { balayerCourbesOrphelines, deplacerCourbesStockees } from "@/lib/courbes-client";
import { loadVersioned, persistVersioned } from "@/lib/persisted";
import { BROUILLON_KEY, BROUILLON_VERSION, brouillonModifie, extraireBrouillon, migrerBrouillon, patchDepuisBrouillon } from "@/lib/brouillon-calculs";

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
    loadMaterials,
    loadUnits,
    loadSavedResults,
    loadBinderPrices,
    loadProductionLog,
    loadGachees,
    loadProtocoles,
    loadSessions,
    loadAnnotations,
    loadRevues,
    loadMoules,
    loadFormules,
  } = useStore();

  useEffect(() => {
    loadGeneral();
    loadConstantes();
    loadCatalogue();
    loadMaterials();
    loadUnits();
    loadSavedResults();
    loadBinderPrices();
    loadProductionLog();
    loadGachees();
    loadProtocoles();
    loadSessions();
    loadAnnotations();
    loadRevues();
    loadMoules();
    loadFormules();
    // Courbes de presse encore rangées dans les gâchées (imports antérieurs) :
    // déplacées dans IndexedDB, ce qui libère le stockage local. Sans effet
    // si elles le sont déjà, ou si le navigateur n'a pas IndexedDB.
    // Puis les courbes qu'aucune gâchée ne référence plus (gâchée supprimée
    // sur un autre appareil) : balayage prudent, rien si le doute existe.
    void deplacerCourbesStockees().then(() => balayerCourbesOrphelines());
  }, [
    loadGeneral,
    loadConstantes,
    loadCatalogue,
    loadMaterials,
    loadUnits,
    loadSavedResults,
    loadBinderPrices,
    loadProductionLog,
    loadGachees,
    loadProtocoles,
    loadSessions,
    loadAnnotations,
    loadRevues,
    loadMoules,
    loadFormules,
  ]);

  // Brouillon des formulaires de Calculs (brouillon-calculs.ts) : relu une
  // fois au démarrage, puis rangé après chaque modification (courte pause, et
  // tout de suite quand la page se ferme). Avant, un rechargement vidait tout.
  useEffect(() => {
    const brut = loadVersioned<unknown>(BROUILLON_KEY, BROUILLON_VERSION, migrerBrouillon, null);
    if (brut) useStore.setState(patchDepuisBrouillon(useStore.getState() as never, brut) as never);
    let minuteur: number | undefined;
    const ranger = () => {
      window.clearTimeout(minuteur);
      minuteur = undefined;
      persistVersioned(BROUILLON_KEY, BROUILLON_VERSION, extraireBrouillon(useStore.getState() as never));
    };
    const desabonner = useStore.subscribe((etat, avant) => {
      if (!brouillonModifie(etat as never, avant as never)) return;
      window.clearTimeout(minuteur);
      minuteur = window.setTimeout(ranger, 400);
    });
    const surFermeture = () => { if (minuteur !== undefined) ranger(); };
    window.addEventListener("pagehide", surFermeture);
    return () => { desabonner(); window.removeEventListener("pagehide", surFermeture); window.clearTimeout(minuteur); };
  }, []);

  // Synchronisation multi-onglets : l'événement `storage` ne se déclenche que
  // dans les AUTRES onglets. Quand l'un écrit une clé, les autres ré-hydratent
  // la clé concernée (sinon deux onglets ouverts s'écrasent mutuellement).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      switch (e.key) {
        case "minebackfill_saved_results": loadSavedResults(); break;
        case "minebackfill_gachees": loadGachees(); break;
        case "minebackfill_protocoles": loadProtocoles(); break;
        case "minebackfill_moules": loadMoules(); break;
        case "minebackfill_formules_brouillons":
        case "minebackfill_formules_publiees": loadFormules(); break;
        case "minebackfill_sessions": loadSessions(); break;
        case "minebackfill_annotations": loadAnnotations(); break;
        case "minebackfill_revues": loadRevues(); break;
        case "minebackfill_binder_prices": loadBinderPrices(); break;
        case "minebackfill_production_log": loadProductionLog(); break;
        case "minebackfill_unit_prefs": loadUnits(); break;
        case "minebackfill_catalogue_liants": loadCatalogue(); break;
        case "minebackfill_constantes": loadConstantes(); break;
        case "minebackfill_general": void loadGeneral(); break;
        case "minebackfill_catalogue_residus":
        case "minebackfill_catalogue_granulats":
        case "minebackfill_catalogue_retardateurs": loadMaterials(); break;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [
    loadGeneral,
    loadConstantes,
    loadCatalogue,
    loadMaterials,
    loadUnits,
    loadSavedResults,
    loadBinderPrices,
    loadProductionLog,
    loadGachees,
    loadProtocoles,
    loadSessions,
    loadAnnotations,
    loadRevues,
    loadMoules,
    loadFormules,
  ]);

  return null;
}
