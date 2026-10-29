// frontend/src/lib/analyse-source.ts
// Source d'une analyse : un CALCUL SAUVEGARDÉ (Mes calculs) et une de ses
// recettes. Transformations PURES, testables sans DOM.
//
// Pourquoi (2026-10-25) : l'Analyse lisait le formulaire en cours « Dosage
// selon Cw » de Calculs. Après un calcul selon E/L, par le modèle prédictif ou
// en essai-erreur, elle montrait donc d'autres valeurs que le résultat obtenu.
// Elle part désormais d'un calcul sauvegardé, quelle que soit sa méthode
// d'origine, pour un balayage selon la méthode Cw.
//
// Contexte préservé STRICTEMENT : rien n'est repris du formulaire en cours ni
// des matériaux actuels. Les constantes et les liants viennent de l'instantané
// du calcul ; une valeur absente n'est jamais remplacée en silence : elle est
// reconstituée ET signalée, ou le calcul est refusé avec sa raison. En
// particulier, aucune convention n'est imposée (pas de completerConstantes) et
// aucun liant ne reçoit le Gs par défaut de rpc_payload.ts.

import type { BaseAnalyse, LiantResolu, MateriauxAnalyse, ValeursRecette } from "./analyse-corps";
import type { InstantaneAnalyse } from "./analyse-instantane";
import { CONVENTION_GS_ESSAI, CONVENTION_PACKS, REGLE_LIANT_ESSAI, essaiConventionRevisee, etatVersion, libelleVersion, packById, solverVersionActive } from "./conventions";
import { nombreFr } from "./format";
import { methodLabel } from "./method-registry";
import { trouverLiant } from "./rpc_payload";
import { lireBinders, type ConstantesCalcul, type ConventionPackId, type LiantCatalogueItem, type SavedResult } from "./store";
import { dateHeureSauvegarde } from "@/components/labo/outils";

/** Calculs analysables : RPC ou RPG avec au moins une recette, du plus récent au plus ancien. */
export function calculsAnalysables(saved: SavedResult[]): SavedResult[] {
  return saved
    .filter((s) => (s.category === "RPC" || s.category === "RPG") && Array.isArray(s.recipes) && s.recipes.some(Boolean))
    .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
}

/**
 * Calcul retenu : celui demandé s'il est analysable, sinon le plus récent.
 * `introuvable` : un calcul était demandé (lien, choix précédent) mais n'existe
 * plus ou n'est pas analysable.
 */
export function choisirCalcul(analysables: SavedResult[], demande: string | null | undefined): { calcul: SavedResult | null; introuvable: boolean } {
  const trouve = demande ? analysables.find((s) => s.id === demande) : undefined;
  if (trouve) return { calcul: trouve, introuvable: false };
  return { calcul: analysables[0] ?? null, introuvable: !!demande };
}

/** « Mon calcul · RPC · Selon E/L · 2026-10-25, 14 h 03 ». */
export function libelleCalcul(sr: SavedResult): string {
  const morceaux = [sr.label || "Sans nom", sr.category, methodLabel(sr.category, sr.method), dateHeureSauvegarde(sr.savedAt)];
  return morceaux.join(" · ") + (sr.conflit ? " (copie de conflit)" : "");
}

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Formulaire d'où viennent les matériaux : celui de la méthode, ou la base de l'essai-erreur. */
function entreesMateriaux(sr: SavedResult): Record<string, unknown> | null {
  const inputs = sr.inputs;
  if (!inputs || typeof inputs !== "object") return null;
  const e = inputs as Record<string, unknown>;
  if (sr.method !== "essai") return e;
  const base = e[e.base_method === "wb" ? "base_wb" : "base_cw"];
  return base && typeof base === "object" ? (base as Record<string, unknown>) : null;
}

export type LectureRecette = { ok: true; valeurs: ValeursRecette } | { ok: false; raison: string };

/** Valeurs d'une recette sauvegardée, vérifiées contre les bornes de la méthode Cw. */
export function lireValeursRecette(sr: SavedResult, index: number): LectureRecette {
  const n = index + 1;
  const r = sr.recipes?.[index];
  if (!r) return { ok: false, raison: `La recette ${n} est absente de ce calcul.` };
  const cw = r.solids_mass_pct, bw = r.bw_mass_pct, vol = r.total_backfill_volume_m3;
  let sr_ = r.saturation_pct;
  if (!fini(cw) || !fini(sr_) || !fini(bw)) return { ok: false, raison: `Recette ${n} : Cw, Sr ou Bw manquent dans la sauvegarde.` };
  if (!(cw > 0 && cw < 100)) return { ok: false, raison: `Recette ${n} : Cw (${nombreFr(cw, 2)} %) doit être compris entre 0 et 100 %.` };
  // Bruit d'arrondi d'un Sr calculé à saturation (100,000000000001 %).
  if (sr_ > 100 && sr_ <= 100 + 1e-6) sr_ = 100;
  if (!(sr_ > 0 && sr_ <= 100)) return { ok: false, raison: `Recette ${n} : Sr (${nombreFr(sr_, 2)} %) doit être supérieur à 0 et au plus 100 %.` };
  if (!(bw >= 0 && bw <= 100)) return { ok: false, raison: `Recette ${n} : Bw (${nombreFr(bw, 2)} %) doit être compris entre 0 et 100 %.` };
  if (!fini(vol) || vol <= 0) return { ok: false, raison: `Recette ${n} : le volume total du remblai manque dans la sauvegarde.` };
  const valeurs: ValeursRecette = { cwPct: cw, srPct: sr_, bwPct: bw, volumeM3: vol };
  if (sr.category === "RPG") {
    let am = r.aggregate_mass_pct;
    // Sauvegardes d'avant juillet 2026 : Am absent de la recette. Hors
    // essai-erreur, il vaut l'entrée du formulaire (même définition) ; après
    // des ajouts de granulat, l'Am final n'est nulle part : refus.
    if (!fini(am) && sr.method !== "essai") {
      const brut = entreesMateriaux(sr)?.aggregate_fraction_pct;
      if (fini(brut)) am = brut;
    }
    if (!fini(am) || am < 0 || am > 100) return { ok: false, raison: `Recette ${n} : la part de granulat Am manque dans la sauvegarde.` };
    valeurs.amPct = am;
  }
  return { ok: true, valeurs };
}

const NOMS_CONSTANTES: [keyof ConstantesCalcul & string, string][] = [
  ["masse_volumique_eau_kg_m3", "masse volumique de l'eau"],
  ["gravite_m_s2", "gravité"],
  ["facteur_petit_cone_vers_grand_cone", "facteur du petit cône"],
  ["coefficient_modele_slump", "coefficient du dosage selon le slump"],
  ["constante_modele_slump", "constante du dosage selon le slump"],
];

/**
 * Constantes du calcul, telles qu'enregistrées : rien n'est imposé. Une
 * constante absente ou invalide (sauvegarde ancienne) prend la valeur par
 * défaut et figure dans `reconstituees`. Seules la masse volumique de l'eau
 * et la gravité agissent sur un calcul selon Cw.
 */
export function constantesDuCalcul(sr: Pick<SavedResult, "constantes">): { constantes: ConstantesCalcul; reconstituees: string[] } {
  const brut = (sr.constantes ?? {}) as Partial<ConstantesCalcul>;
  const defaut = packById("gramme")!.constantes;
  const c: ConstantesCalcul = { ...defaut };
  const reconstituees: string[] = [];
  for (const [cle, nom] of NOMS_CONSTANTES) {
    const v = brut[cle];
    if (fini(v) && v > 0) (c as unknown as Record<string, number>)[cle] = v;
    else reconstituees.push(nom);
  }
  // Drapeaux de l'essai-erreur : sans effet sur un calcul selon Cw, repris
  // tels quels pour la provenance.
  c.essai_gs_convention = brut.essai_gs_convention === "base" || brut.essai_gs_convention === "recalcule" ? brut.essai_gs_convention : CONVENTION_GS_ESSAI;
  c.essai_binder_rule = brut.essai_binder_rule === "solides_totaux" || brut.essai_binder_rule === "residu_ajoute" ? brut.essai_binder_rule : REGLE_LIANT_ESSAI;
  const packs: ConventionPackId[] = [...CONVENTION_PACKS.map((p) => p.id), "personnalise"];
  c.pack_id = brut.pack_id && packs.includes(brut.pack_id) ? brut.pack_id : "personnalise";
  return { constantes: c, reconstituees };
}

export type LectureLiants =
  | { ok: true; liants: LiantResolu[]; reprisActuels: string[] }
  | { ok: false; raison: string };

/**
 * Liants du calcul, résolus comme le calcul d'origine (même filtre, même ordre,
 * même normalisation que construireSystemeLiant) dans SON instantané du
 * catalogue. Absent de l'instantané mais présent dans le catalogue actuel :
 * repris et signalé. Introuvable : refus, jamais le Gs par défaut.
 */
export function liantsDuCalcul(sr: Pick<SavedResult, "general" | "catalogue_liants">, catalogueCourant: LiantCatalogueItem[]): LectureLiants {
  if (!sr.general) return { ok: false, raison: "Ce calcul ne contient pas ses informations générales (liant) : rechargez-le dans Calculs, recalculez et sauvegardez." };
  const refs = lireBinders(sr.general)
    .map((b) => ({ code: b.code ?? "", id: b.id ?? null, frac: Number(b.fraction_pct ?? 0) }))
    .filter((b) => !!b.code && b.frac > 0);
  if (refs.length === 0) return { ok: false, raison: "Ce calcul ne précise pas son agent liant : rechargez-le dans Calculs, choisissez le liant dans Informations, recalculez et sauvegardez." };
  const instantane = sr.catalogue_liants ?? [];
  const valide = (l: LiantCatalogueItem | undefined) => !!l && fini(l.gs) && l.gs > 0;
  const total = refs.reduce((s, b) => s + b.frac, 0) || 1;
  const liants: LiantResolu[] = [];
  const reprisActuels: string[] = [];
  for (const b of refs) {
    const duCalcul = trouverLiant(b.code, instantane, b.id);
    if (valide(duCalcul)) {
      liants.push({ code: b.code, nom: duCalcul!.nom || b.code, gs: duCalcul!.gs, fraction: b.frac / total, origine: "calcul" });
      continue;
    }
    const actuel = trouverLiant(b.code, catalogueCourant, b.id);
    if (valide(actuel)) {
      liants.push({ code: b.code, nom: actuel!.nom || b.code, gs: actuel!.gs, fraction: b.frac / total, origine: "catalogue_actuel" });
      reprisActuels.push(`${actuel!.nom || b.code} (Gs ${nombreFr(actuel!.gs, 2)})`);
      continue;
    }
    return { ok: false, raison: `Le liant « ${b.code} » de ce calcul est introuvable, dans la sauvegarde comme dans le catalogue actuel : son Gs est inconnu.` };
  }
  return { ok: true, liants, reprisActuels };
}

/** Ce que l'écran et la provenance disent du calcul analysé. */
export interface InfoSource {
  id: string;
  libelle: string;
  sauveLe: string;
  /** Méthode d'origine (clé et libellé long). */
  methodeCle: string;
  methode: string;
  /** Recette analysée (1 à N) et nombre de recettes du calcul. */
  recette: number;
  nbRecettes: number;
  /** Version des formules du calcul d'origine. */
  versionCalcul?: string;
  /** Valeurs absentes de la sauvegarde et reconstituées (signalées). */
  reconstitutions: string[];
}

export type LectureSource =
  | { ok: true; base: BaseAnalyse; source: InfoSource }
  | { ok: false; raison: string };

/** Base d'analyse tirée d'une recette d'un calcul sauvegardé, ou la raison du refus. */
export function baseDepuisCalcul(sr: SavedResult, index: number, catalogueCourant: LiantCatalogueItem[]): LectureSource {
  if (sr.category !== "RPC" && sr.category !== "RPG") {
    return { ok: false, raison: "Les calculs RRC ne sont pas analysables : leur calcul est à part (roches, ciment, coulis)." };
  }
  if (essaiConventionRevisee(sr)) {
    return { ok: false, raison: "Cet essai-erreur a été calculé avec l'ancienne convention (Gs de départ) : rechargez-le dans Calculs, recalculez-le et sauvegardez-le pour l'analyser." };
  }
  const entrees = entreesMateriaux(sr);
  if (!entrees) {
    return {
      ok: false,
      raison: sr.method === "essai"
        ? "Cet essai-erreur a été sauvegardé sans sa recette de base (avant octobre 2026) : rechargez-le dans Calculs, recalculez et sauvegardez."
        : "Ce calcul a été sauvegardé sans ses entrées : rechargez-le dans Calculs, recalculez et sauvegardez.",
    };
  }
  const gs = entrees.residue_sg, w0 = entrees.residue_w_pct;
  if (!fini(gs) || gs <= 0) return { ok: false, raison: "Le Gs du résidu manque dans ce calcul." };
  if (!fini(w0) || w0 < 0 || w0 > 100) return { ok: false, raison: "La teneur en eau w₀ du résidu manque dans ce calcul." };
  const materiaux: MateriauxAnalyse = { gsResidu: gs, w0Pct: w0 };
  if (sr.category === "RPG") {
    const gsG = entrees.aggregate_sg;
    if (!fini(gsG) || gsG <= 0) return { ok: false, raison: "Le Gs du granulat manque dans ce calcul." };
    materiaux.gsGranulat = gsG;
  }
  const lus = liantsDuCalcul(sr, catalogueCourant);
  if (!lus.ok) return lus;
  const valeurs = lireValeursRecette(sr, index);
  if (!valeurs.ok) return valeurs;
  const { constantes, reconstituees } = constantesDuCalcul(sr);

  const reconstitutions: string[] = [];
  if (reconstituees.length) reconstitutions.push(`Constantes absentes de la sauvegarde, valeurs par défaut : ${reconstituees.join(", ")}.`);
  for (const l of lus.reprisActuels) reconstitutions.push(`Gs du liant ${l} repris du catalogue actuel : absent de la sauvegarde.`);

  return {
    ok: true,
    base: {
      categorie: sr.category,
      general: sr.general,
      constantes,
      liants: lus.liants,
      materiaux,
      recette: valeurs.valeurs,
      cleSource: `${sr.id}#${index}`,
    },
    source: {
      id: sr.id,
      libelle: sr.label || "Sans nom",
      sauveLe: sr.savedAt,
      methodeCle: sr.method,
      methode: methodLabel(sr.category, sr.method, "long"),
      recette: index + 1,
      nbRecettes: sr.recipes.length,
      versionCalcul: sr.solverVersion,
      reconstitutions,
    },
  };
}

/** Symboles des entrées de la méthode Cw, dans l'ordre d'affichage. */
const ENTREES_CW: { param: string; symbole: string; rpg?: boolean }[] = [
  { param: "solids_mass_pct", symbole: "Cw" },
  { param: "saturation_pct", symbole: "Sr" },
  { param: "binder_mass_pct", symbole: "Bw" },
  { param: "aggregate_fraction_pct", symbole: "Am", rpg: true },
];

export interface Note { ton: "info" | "alerte"; texte: string }

/**
 * Ce que l'analyse garde fixe et ce qu'elle ne maintient plus, selon la méthode
 * d'origine ET le paramètre balayé : un calcul selon E/L devient une base pour
 * un balayage selon Cw, où E/L n'est plus imposé. Jamais « à Cw constant »
 * quand l'axe est Cw.
 */
export function notesSource(categorie: "RPC" | "RPG", source: InfoSource, param: string): Note[] {
  const fixes = ENTREES_CW.filter((e) => e.param !== param && (!e.rpg || categorie === "RPG")).map((e) => e.symbole);
  const notes: Note[] = [{
    ton: "info",
    texte: `Analyse : balayage selon la méthode Cw. Chaque point garde fixes ${fixes.join(", ")}, les matériaux et le volume ; seul le paramètre balayé change.`,
  }];
  if (source.methodeCle === "wb") {
    notes.push({ ton: "info", texte: "Calcul d'origine selon E/L : E/L n'est pas imposé pendant le balayage, il est recalculé à chaque point." });
  } else if (source.methodeCle === "slump") {
    notes.push({ ton: "info", texte: "Calcul d'origine selon le slump : l'affaissement visé n'est pas maintenu pendant le balayage, la courbe ne repasse pas par ce modèle." });
  } else if (source.methodeCle === "essai") {
    notes.push({ ton: "info", texte: "Calcul d'origine en essai-erreur : les ajouts ne sont pas rejoués. L'analyse part de la composition finale (Cw, Sr, Bw atteint" + (categorie === "RPG" ? ", Am" : "") + ") et du volume final de l'essai." });
  }
  if (etatVersion(source.versionCalcul, source.methodeCle) === "obsolete") {
    notes.push({ ton: "alerte", texte: `Calcul enregistré avec d'anciennes formules (version ${source.versionCalcul ? libelleVersion(source.versionCalcul) : "inconnue"}) : la courbe utilise les formules actuelles, ses valeurs peuvent différer de celles enregistrées.` });
  }
  for (const r of source.reconstitutions) notes.push({ ton: "alerte", texte: r });
  return notes;
}

/** Volume lisible : litres sous 1 m³, mètres cubes au-delà. */
export function texteVolume(m3: number): string {
  return m3 < 1 ? `${nombreFr(m3 * 1000, 3)} L` : `${nombreFr(m3, 3)} m³`;
}

/**
 * Instantané de provenance d'une analyse partie d'un calcul sauvegardé : la
 * méthode d'origine et la méthode d'analyse sont distinctes, comme la version
 * du calcul source et celle du balayage.
 */
export function instantaneDepuisSource(base: BaseAnalyse, source: InfoSource, o: {
  mode: "courbes" | "composition";
  date: string;
  parametre?: InstantaneAnalyse["parametre"];
  sorties?: string[];
  variantes?: string[];
}): InstantaneAnalyse {
  const c = base.constantes;
  const v = base.recette;
  return {
    date: o.date,
    categorie: base.categorie,
    methode: o.mode === "courbes" ? "Balayage selon la méthode Cw" : "Recettes sauvegardées, sans recalcul",
    parametre: o.parametre,
    recette: {
      gsResidu: base.materiaux.gsResidu, w0Pct: base.materiaux.w0Pct,
      cwPct: v.cwPct, srPct: v.srPct, bwPct: v.bwPct,
      amPct: base.categorie === "RPG" ? v.amPct : undefined,
      gsAgregat: base.categorie === "RPG" ? base.materiaux.gsGranulat : undefined,
    },
    liants: base.liants.map((l) => ({ code: l.nom || l.code, gs: l.gs, fractionPct: l.fraction * 100 })),
    constantes: {
      packLabel: packById(c.pack_id)?.label ?? "personnalisé",
      masseVolEau: c.masse_volumique_eau_kg_m3,
      gravite: c.gravite_m_s2,
      facteurCone: c.facteur_petit_cone_vers_grand_cone,
      coeffSlump: c.coefficient_modele_slump,
      constSlump: c.constante_modele_slump,
      conventionGs: c.essai_gs_convention,
      regleLiant: c.essai_binder_rule,
    },
    // Courbes : calculées aujourd'hui, avec les constantes du calcul. Composition :
    // les recettes sauvegardées, donc la version du calcul.
    versionSolveur: o.mode === "courbes" ? solverVersionActive(c) : (source.versionCalcul ?? "inconnue"),
    sorties: o.sorties,
    variantes: o.variantes,
    volumeM3: o.mode === "courbes" ? v.volumeM3 : undefined,
    source: {
      id: source.id, libelle: source.libelle, sauveLe: source.sauveLe, methode: source.methode,
      recette: o.mode === "courbes" ? source.recette : undefined,
      nbRecettes: source.nbRecettes, versionCalcul: source.versionCalcul,
      reconstitutions: source.reconstitutions.length ? source.reconstitutions : undefined,
    },
  };
}
