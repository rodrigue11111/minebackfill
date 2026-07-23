// frontend/src/lib/branding.ts
// Identité de l'application, définie une seule fois. Avant, « MineBackfill »,
// la version et « Module 1 » étaient réécrits en dur dans le layout, la NavBar,
// le guide et les pieds de page des 3 exports — sources de dérive.

export const APP_NAME = "MineBackfill";
export const APP_VERSION = "1.0";
export const APP_NAME_VERSION = `${APP_NAME} v${APP_VERSION}`;
export const MODULE_ID = "Module 1";
export const MODULE_LABEL = "Dimensionnement des mélanges";

/** Pied de page court des exports (« MineBackfill v1.0 — Module 1 »). */
export const EXPORT_FOOTER = `${APP_NAME_VERSION} — ${MODULE_ID}`;

/**
 * Portail des projets du programme (annuaire : MineBackfill, CPB Cockpit,
 * futurs). C'est LA porte de bascule entre applications — on ne liste pas les
 * autres applications ici : ajouter un projet se fait UNIQUEMENT dans
 * portail/src/lib/projects.ts, et ce lien-ci n'a jamais besoin de changer.
 */
export const PORTAIL_URL = "https://progicielbelem.com";
export const PORTAIL_LABEL = "Portail";
