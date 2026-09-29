"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { clesEnEchecDEcriture, ecouterEchecsDEcriture } from "@/lib/persisted";

/**
 * Bandeau affiché tant qu'une écriture dans le stockage du navigateur a échoué.
 *
 * Pourquoi : un stockage plein faisait échouer l'enregistrement EN SILENCE.
 * L'écran montrait la modification, le rechargement la perdait. Le bandeau
 * disparaît de lui-même dès qu'une écriture réussit à nouveau sur la même clé
 * (voir persisted.ts).
 */
const LIBELLES: Record<string, string> = {
  minebackfill_saved_results: "résultats sauvegardés",
  minebackfill_gachees: "gâchées du laboratoire",
  minebackfill_protocoles: "protocoles",
  minebackfill_general: "informations du projet",
  minebackfill_constantes: "constantes de calcul",
  minebackfill_catalogue_liants: "catalogue de liants",
  minebackfill_catalogue_residus: "catalogue de résidus",
  minebackfill_catalogue_granulats: "catalogue de granulats",
  minebackfill_catalogue_retardateurs: "catalogue de retardateurs",
  minebackfill_unit_prefs: "préférences d'unités",
  minebackfill_production_log: "journal de production",
  minebackfill_binder_prices: "prix des liants",
};

const AUCUNE: readonly string[] = [];

export default function AlerteStockage() {
  const cles = useSyncExternalStore(ecouterEchecsDEcriture, clesEnEchecDEcriture, () => AUCUNE);
  if (cles.length === 0) return null;

  const quoi = cles.map((c) => LIBELLES[c] ?? c).join(", ");
  return (
    <div
      role="alert"
      style={{
        background: "#fef2f2",
        borderBottom: "1px solid #fecaca",
        color: "#991b1b",
        fontSize: 13,
        lineHeight: 1.5,
        padding: "10px 16px",
      }}
    >
      <strong>Enregistrement impossible : le stockage du navigateur est plein ou bloqué.</strong>{" "}
      Vos dernières modifications ({quoi}) seront perdues au rechargement de la page.
      Exportez une sauvegarde depuis les{" "}
      <Link href="/reglages" style={{ color: "#991b1b", fontWeight: 700 }}>Réglages</Link>
      , puis consultez le{" "}
      <Link href="/diagnostic" style={{ color: "#991b1b", fontWeight: 700 }}>Diagnostic</Link>
      {" "}pour voir ce qui occupe la place.
    </div>
  );
}
