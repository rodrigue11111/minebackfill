// frontend/src/lib/navigation.ts
// Liens de navigation, en UN seul endroit : la barre haute (bureau), la barre
// d'onglets et la feuille « Plus » (téléphone) les lisent ici. Module pur.
//
// Le module Industrie (« /industrie ») a été retiré de la navigation le
// 2026-09-27, à la demande de l'enseignant ; la page répond toujours à l'URL
// directe (retrait réversible : remettre une entrée ci-dessous).

import type { UserRole } from "./supabase";

export type IconeNav =
  | "informations" | "calculs" | "analyse" | "labo" | "classe"
  | "formules" | "historique" | "guide" | "reglages" | "compte";

export interface LienNav {
  href: string;
  label: string;
  icone: IconeNav;
}

const INFORMATIONS: LienNav = { href: "/", label: "Informations", icone: "informations" };
const CALCULS: LienNav = { href: "/mix", label: "Calculs", icone: "calculs" };
const ANALYSE: LienNav = { href: "/analyse", label: "Analyse", icone: "analyse" };
const LABO: LienNav = { href: "/labo", label: "Labo", icone: "labo" };
const CLASSE: LienNav = { href: "/classe", label: "Classe", icone: "classe" };
const FORMULES: LienNav = { href: "/formulas", label: "Formules", icone: "formules" };
const HISTORIQUE: LienNav = { href: "/historique", label: "Historique", icone: "historique" };
const GUIDE: LienNav = { href: "/guide", label: "Guide", icone: "guide" };
const REGLAGES: LienNav = { href: "/reglages", label: "Réglages", icone: "reglages" };
export const LIEN_COMPTE: LienNav = { href: "/compte", label: "Compte", icone: "compte" };

/** Liens de la barre haute, dans l'ordre du travail. Classe : enseignant seulement. */
export function liensNavigation(role: UserRole | null | undefined): LienNav[] {
  return [
    INFORMATIONS, CALCULS, ANALYSE, LABO,
    ...(role === "prof" ? [CLASSE] : []),
    FORMULES, HISTORIQUE, GUIDE, REGLAGES,
  ];
}

/**
 * Téléphone : quatre onglets selon le rôle, le reste dans la feuille « Plus ».
 * L'étudiant commence par Informations ; l'enseignant n'en a pas besoin au
 * quotidien et voit Classe à la place.
 */
export function ongletsTelephone(role: UserRole | null | undefined): { onglets: LienNav[]; plus: LienNav[] } {
  const onglets = role === "prof"
    ? [CALCULS, LABO, CLASSE, HISTORIQUE]
    : [INFORMATIONS, CALCULS, LABO, HISTORIQUE];
  const dedans = new Set(onglets.map((l) => l.href));
  return { onglets, plus: liensNavigation(role).filter((l) => !dedans.has(l.href)) };
}

/** Le lien est-il celui de la page courante ? « / » exact ; sinon la section. */
export function estActif(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/" || pathname === "/informations";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Initiales d'un nom affiché (« Alice Tremblay » -> « AT »), repli sur le courriel. */
export function initiales(nom: string | null | undefined, courriel?: string | null): string {
  const mots = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  if (mots.length >= 2) return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (courriel?.[0] ?? "?").toUpperCase();
}

/** Prénom affiché dans la pastille du compte. */
export function prenom(nom: string | null | undefined, repli: string): string {
  const premier = (nom ?? "").trim().split(/\s+/)[0];
  return premier || repli;
}
