"use client";

// Catalogue de formules affiché (cours + couche de l'enseignant), pour la
// page Formules et la fiche fx. Voir lib/formules-enseignant.ts.

import { useMemo } from "react";
import { useStore } from "./store";
import { MODE_TEST_SANS_COMPTE } from "./mode-test";
import { proprietaireFormules, vueFormules, type VueFormules } from "./formules-enseignant";

export function useFormules(): VueFormules & { proprietaire: string | null } {
  const brouillons = useStore((s) => s.formulesBrouillons);
  const publication = useStore((s) => s.formulesPubliees);
  const session = useStore((s) => s.session);
  const proprietaire = proprietaireFormules(session, MODE_TEST_SANS_COMPTE);
  return useMemo(
    () => ({ ...vueFormules(brouillons, publication, proprietaire), proprietaire }),
    [brouillons, publication, proprietaire],
  );
}
