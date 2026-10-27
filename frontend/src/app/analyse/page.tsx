"use client";

// Onglet « Analyse » — deux modes :
//  • Courbes de réponse (balayage d'un paramètre, endpoint /analyse/balayage) ;
//  • Composition (barres de phases + ternaire + échantillon des recettes).
// Les deux partent d'un CALCUL SAUVEGARDÉ (Mes calculs), choisi sur la page
// ou par le lien « Analyser » de Mes calculs (?calcul=<id>) ; plus du
// formulaire en cours de Calculs (2026-10-25 : après un calcul selon E/L ou
// en essai-erreur, la page montrait d'autres valeurs que le résultat obtenu).
// Source : lib/analyse-source.ts ; requêtes : lib/analyse-corps.ts ; figure et
// requêtes concurrentes : lib/analyse-figure.ts. Aucun calcul n'est
// réimplémenté côté client ; la composition affiche les recettes sauvegardées
// telles quelles.

import React, { Suspense, useMemo, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EXEMPLES_ANALYSE, type ExempleAnalyse } from "@/lib/analyse-exemples";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import Segmente from "@/components/ui/Segmente";
import { loadSavedFromStorage, useStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import ErrorBox from "@/components/ErrorBox";
import CourbeSvg, { type SerieTrace } from "@/components/analyse/CourbeSvg";
import CompositionVue from "@/components/analyse/CompositionVue";
import CarteCalculAnalyse from "@/components/analyse/CarteCalculAnalyse";
import FigurePng from "@/components/analyse/FigurePng";
import { indexProche, ecartPct, statsSerie } from "@/lib/courbe-analyse";
import {
  paramsPour, sortiesPour, paramMeta, sortieMeta, type CategorieAnalyse,
} from "@/lib/analyse-series";
import PanneauVariation from "@/components/analyse/PanneauVariation";
import { estParamCle, valeurReference } from "@/lib/analyse-fixe";
import { bornerPoints, POINTS_MAX, POINTS_MIN, type BalayageArtefact } from "@/lib/analyse-artefact";
import { corpsBalayage, empreinteBalayage, type EntreesBalayage } from "@/lib/analyse-corps";
import {
  baseDepuisCalcul, calculsAnalysables, choisirCalcul, instantaneDepuisSource, lireValeursRecette, notesSource,
} from "@/lib/analyse-source";
import {
  artefactDepuisFigure, ETAT_FIGURE_INITIAL, figurePerimee, reduireFigure,
} from "@/lib/analyse-figure";
import {
  variantesDepuisRecettes, comparaisonPossible, construireTracesVariantes,
} from "@/lib/analyse-variantes";
import {
  instantanePourExport, lignesResume, lignesMetaCsv, type InstantaneAnalyse,
} from "@/lib/analyse-instantane";
import { telechargerTexte, versCsv, nomFichier } from "@/lib/export-fig";
import { phases, fractions, volumesIncomplets } from "@/lib/composition";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import { fmt, libelleAvecUnite, valeurAvecUnite, nombreFr } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import ChampNombre from "@/components/ui/ChampNombre";

type Mode = "courbes" | "composition";
const DEFAUT_SORTIES = ["wc_ratio", "void_ratio"];


function fmtStat(v: number, unite: string): string {
  // « kg » doit être branché ici : sans lui, une masse tombe dans la branche
  // par défaut et s'affiche avec 4 décimales (« 1 234,5678 kg »).
  const d = unite === "kg/m³" ? 1 : unite === "kg" ? 1 : unite === "%" ? 2 : 4;
  const s = nombreFr(v, d);
  return valeurAvecUnite(s, unite);
}

function PanneauProvenance({ meta, boutons, ouvert, onToggle }: {
  meta: InstantaneAnalyse;
  boutons: React.ReactNode;
  ouvert: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--filet)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {boutons}
        <button type="button" onClick={onToggle} className="btn-discret" aria-expanded={ouvert}>
          {ouvert ? "Masquer" : "Afficher"} la reproductibilité et la provenance
        </button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--texte-2)", lineHeight: 1.65, background: "var(--fond)", borderRadius: 12, padding: "10px 14px" }}>
          {lignesResume(meta).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

// useSearchParams dans une page prérendue exige une frontière Suspense
// (sinon le build échoue). Le paramètre est lu par le hook, et non par
// window.location : pendant une navigation client (lien « Analyser » de Mes
// calculs), window.location n'est mis à jour qu'après le rendu.
export default function AnalysePage() {
  return (
    <Suspense fallback={null}>
      <AnalyseContenu />
    </Suspense>
  );
}

function AnalyseContenu() {
  const { API, catalogue_liants, savedResults, restoreSavedResult } = useStore();
  const router = useRouter();
  const demande = useSearchParams().get("calcul");
  const monte = useHydrated();
  // Les calculs sauvegardés sont chargés dans le store APRÈS le premier rendu
  // (StoreHydrator) : on lit le stockage d'ici là, sans afficher un faux état vide.
  const sauvegardes = useMemo(
    () => (!monte ? [] : savedResults.length ? savedResults : loadSavedFromStorage()),
    [monte, savedResults],
  );
  const analysables = useMemo(() => calculsAnalysables(sauvegardes), [sauvegardes]);

  // Sélection DÉRIVÉE à chaque rendu (pas d'effet) : un calcul supprimé ou
  // remplacé ailleurs (autre onglet, synchronisation) fait retomber sur le plus récent.
  const [idChoisi, setIdChoisi] = useState<string | null>(null);
  const { calcul, introuvable } = choisirCalcul(analysables, idChoisi ?? demande);
  const [indexRecette, setIndexRecette] = useState(0);
  const index = Math.min(indexRecette, Math.max(0, (calcul?.recipes.length ?? 1) - 1));
  const lecture = calcul ? baseDepuisCalcul(calcul, index, catalogue_liants) : null;
  const categorie: CategorieAnalyse = calcul?.category === "RPG" ? "RPG" : "RPC";

  const [mode, setMode] = useState<Mode>("courbes");

  // Courbes
  const [param, setParam] = useState("binder_mass_pct");
  const paramsDispo = paramsPour(categorie);
  const paramActif = paramsDispo.some((p) => p.cle === param) ? param : paramsDispo[0].cle;
  const [xMin, setXMin] = useState(1);
  const [xMax, setXMax] = useState(10);
  const [steps, setSteps] = useState(40);
  // Points hors de 2 à 200 : refusés avec un message (avant : ramenés en silence).
  const [refusPoints, setRefusPoints] = useState<string | null>(null);
  const [sorties, setSorties] = useState<string[]>(DEFAUT_SORTIES);
  const sortiesDispo = sortiesPour(categorie);
  const sortiesControle = sorties.filter((k) => sortiesDispo.some((s) => s.cle === k));
  const [modeCourbe, setModeCourbe] = useState<"absolu" | "ecart">("absolu");
  // Comparer les recettes du calcul sur le même balayage.
  const [comparer, setComparer] = useState(false);
  const [detailsProv, setDetailsProv] = useState(false);

  // Figure et requêtes (lib/analyse-figure.ts) : une réponse tardive n'est
  // acceptée que si aucun changement de calcul, de recette ou de fichier n'est
  // survenu, et elle garde la provenance prise à son départ.
  const [etat, dispatch] = useReducer(reduireFigure, ETAT_FIGURE_INITIAL);
  const seq = useRef(0);

  const choisir = (id: string) => {
    setIdChoisi(id);
    setIndexRecette(0);
    dispatch({ type: "annuler", seq: ++seq.current });
    // L'adresse suit le choix : un rechargement de la page le retrouve.
    window.history.replaceState(null, "", `?calcul=${encodeURIComponent(id)}`);
  };
  const choisirRecette = (i: number) => {
    setIndexRecette(i);
    dispatch({ type: "annuler", seq: ++seq.current });
  };
  const rechargerDansCalculs = () => {
    if (calcul && restoreSavedResult(calcul.id)) router.push("/mix");
  };

  const changerParam = (cle: string) => {
    setParam(cle);
    const m = paramMeta(cle);
    if (m) { setXMin(m.defautMin); setXMax(m.defautMax); }
    dispatch({ type: "effacer", seq: ++seq.current });
  };

  // Exemple choisi : paramètre, plage et grandeurs réglés ; l'étudiant trace.
  const [exemple, setExemple] = useState<ExempleAnalyse | null>(null);
  const boutonTracer = useRef<HTMLButtonElement>(null);
  const appliquerExemple = (x: ExempleAnalyse) => {
    setExemple(x);
    setParam(x.param);
    setXMin(x.min);
    setXMax(x.max);
    setSorties(x.sorties.filter((k) => sortiesDispo.some((s) => s.cle === k)));
    dispatch({ type: "effacer", seq: ++seq.current });
    boutonTracer.current?.focus();
  };

  const basculerSortie = (cle: string) =>
    setSorties((prev) => (prev.includes(cle) ? prev.filter((k) => k !== cle) : [...prev, cle]));

  // Variantes = les recettes du calcul sauvegardé, la recette analysée d'abord.
  const lectures = calcul ? calcul.recipes.map((_, i) => lireValeursRecette(calcul, i)) : [];
  const { variantes, exclues } = variantesDepuisRecettes(lectures, index, paramActif);
  const garde = comparaisonPossible(paramActif, variantes);
  const comparaisonActive = comparer && garde.ok && lecture?.ok === true;
  const notes = lecture?.ok ? notesSource(lecture.base.categorie, lecture.source, paramActif) : [];

  // Entrées actuelles du balayage, et leur empreinte : une figure calculée avec
  // d'autres entrées (paramètre, plage, calcul, recette, variantes) est périmée.
  const entrees: EntreesBalayage | null = lecture?.ok
    ? { ...lecture.base, param: paramActif, xMin, xMax, steps, variantes: comparaisonActive ? variantes.map((v) => v.valeurs) : null }
    : null;
  const empreinteCourante = entrees ? empreinteBalayage(entrees) : null;
  const figure = etat.figure;
  const perime = figurePerimee(figure, empreinteCourante);
  const motifPerime = "Entrées modifiées : relancez « Tracer la courbe » avant d'exporter.";

  async function tracer() {
    const mien = ++seq.current;
    dispatch({ type: "depart", seq: mien });
    const echouer = (message: string) => dispatch({ type: "echec", seq: mien, message });
    if (!lecture) { echouer("Choisissez d'abord un calcul sauvegardé."); return; }
    if (!lecture.ok || !entrees) { echouer(lecture.ok ? "Choisissez d'abord un calcul sauvegardé." : lecture.raison); return; }
    if (!(xMax > xMin)) { echouer("La borne « à » doit être supérieure à la borne « de »."); return; }
    // Corps, empreinte et provenance AU DÉPART : un changement fait pendant
    // l'attente rend la figure périmée au lieu de passer pour la sienne.
    const corps = corpsBalayage(entrees);
    const empreinteDepart = empreinteBalayage(entrees);
    const variantesDepart = comparaisonActive
      ? variantes.map(({ recette, label, couleur, tirets }) => ({ recette, label, couleur, tirets }))
      : null;
    const instantane = instantaneDepuisSource(lecture.base, lecture.source, {
      mode: "courbes",
      date: new Date().toISOString(),
      parametre: { label: paramMeta(paramActif)?.label ?? paramActif, min: xMin, max: xMax, points: steps },
      // Les grandeurs tracées font partie de la provenance : sans elles, un CSV
      // exporté ne dit pas ce qu'il contient.
      sorties: sortiesControle.map((c) => sortieMeta(c)?.label ?? c),
      variantes: variantesDepart?.map((v) => v.label),
    });
    try {
      // Une requête par variante, en parallèle.
      const reponses = await Promise.all(corps.map(async (body) => {
        const r = await fetch(`${API}/analyse/balayage`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(messageErreurApi(data, r.status));
        return data as BalayageArtefact;
      }));
      dispatch({
        type: "reponse", seq: mien,
        figure: { resultats: reponses, variantes: variantesDepart, instantane, empreinte: empreinteDepart },
      });
    } catch (e) {
      echouer(e instanceof TypeError ? messageErreurReseau() : e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  // ── Figure affichée : ses libellés viennent d'ELLE (sa catégorie et son
  //    paramètre au départ de la requête), pas des contrôles. ──
  const res = figure?.resultats[0] ?? null;
  const figCategorie: CategorieAnalyse = res?.category === "RPG" ? "RPG" : "RPC";
  const figParam = res?.param ?? paramActif;
  const xLabel = paramMeta(figParam)?.label ?? figParam;
  const paramCourt = paramMeta(figParam)?.symbole ?? figParam;
  const sortiesFigure = sorties.filter((k) => sortiesPour(figCategorie).some((s) => s.cle === k));
  const variantesFigure = figure?.variantes && figure.resultats.length > 1 ? figure.variantes : null;

  const traces: SerieTrace[] = !res ? [] : sortiesFigure
    .map((cle) => {
      const m = sortieMeta(cle);
      const v = res.series[cle];
      return m && v ? { cle, label: m.label, couleur: m.couleur, unite: m.unite, valeurs: v } : null;
    })
    .filter((s): s is SerieTrace => s !== null);

  const toutNul =
    traces.length > 0 &&
    traces.every((t) => t.valeurs.every((v) => v === null || !Number.isFinite(v)));

  // Valeur du paramètre balayé POUR la recette analysée = point de référence,
  // lue dans l'instantané de la figure (jamais dans les contrôles).
  const referenceX: number | null =
    figure && estParamCle(figParam) ? valeurReference(figParam, figure.instantane.recette) : null;
  // La référence n'ancre l'écart % que si elle est DANS la plage balayée ;
  // sinon on ancre sur le 1er point et on le dit clairement.
  const refDansPlage =
    res !== null && referenceX !== null &&
    referenceX >= Math.min(...res.x) && referenceX <= Math.max(...res.x);
  const iRef = refDansPlage ? indexProche(res!.x, referenceX!) : 0;
  const tracesEcart: SerieTrace[] = traces.map((t) => ({
    ...t, unite: "%", valeurs: ecartPct(t.valeurs, iRef),
  }));
  const ecartToutNul =
    tracesEcart.length > 0 &&
    tracesEcart.every((t) => t.valeurs.every((v) => v === null || !Number.isFinite(v)));

  // ── Exports (les données brutes, pleine précision ; l'en-tête porte la
  //    provenance figée au calcul -> figure traçable et reproductible). ──

  function exporterCsvCourbes() {
    if (!figure || !res) return;
    // L'en-tête de provenance nomme les grandeurs RÉELLEMENT exportées.
    const meta = lignesMetaCsv(instantanePourExport(figure.instantane, traces.map((t) => t.label))).map((l) => [l] as (string | number | null)[]);
    // En comparaison : un GROUPE de colonnes par variante, l'en-tête portant
    // la recette pour que le fichier reste lisible seul.
    const colonnes = variantesFigure
      ? sortiesFigure.flatMap((cle) => {
          const m = sortieMeta(cle);
          if (!m) return [];
          return variantesFigure.map((v, i) => ({
            titre: `${libelleAvecUnite(m.label, m.unite)}, ${v.label}`,
            valeurs: figure.resultats[i]?.series[cle] ?? [],
          }));
        })
      : traces.map((t) => ({ titre: libelleAvecUnite(t.label, t.unite), valeurs: t.valeurs }));
    const entete: (string | number | null)[] = [xLabel, ...colonnes.map((c) => c.titre)];
    const donnees = res.x.map((xv, i) => [xv, ...colonnes.map((c) => c.valeurs[i] ?? null)] as (string | number | null)[]);
    telechargerTexte(versCsv([...meta, [], entete, ...donnees]), nomFichier(`analyse-${figCategorie}-courbes`, "csv"), "text/csv;charset=utf-8");
  }

  function exporterJsonCourbes() {
    if (!figure) return;
    telechargerTexte(JSON.stringify(artefactDepuisFigure(figure), null, 2), nomFichier(`analyse-${figCategorie}-courbes`, "json"), "application/json;charset=utf-8");
  }

  // ── Composition : les recettes sauvegardées telles quelles, sans recalcul. ──
  const recettesComp: { r: Recipe; n: number }[] = calcul
    ? calcul.recipes.flatMap((r, i) => (r ? [{ r, n: i + 1 }] : []))
    : [];
  const compMeta = lecture?.ok && calcul
    ? instantaneDepuisSource(lecture.base, lecture.source, { mode: "composition", date: calcul.savedAt })
    : null;

  function exporterCsvComposition() {
    if (!compMeta || recettesComp.length === 0) return;
    const meta = lignesMetaCsv(compMeta).map((l) => [l] as (string | number | null)[]);
    const entete = ["Recette", "Phase", "Volume (m³)", "Fraction volume (%)", "Masse (kg)", "Fraction masse (%)"];
    const lignes: (string | number | null)[][] = [];
    recettesComp.forEach(({ r, n }) => {
      const vol = fractions(phases(r, "volume"));
      const mas = phases(r, "masse");
      const totMas = mas.reduce((s, p) => s + p.valeur, 0);
      const parCle = new Map(mas.map((p) => [p.cle, p.valeur]));
      vol.forEach((p) => {
        const m = parCle.get(p.cle);
        lignes.push([`Recette ${n}`, p.label, p.valeur, p.frac * 100, m ?? null, m !== undefined && totMas > 0 ? (m / totMas) * 100 : null]);
      });
    });
    telechargerTexte(versCsv([...meta, [], entete, ...lignes]), nomFichier(`analyse-${categorie}-composition`, "csv"), "text/csv;charset=utf-8");
  }

  return (
    <Page>
      <EnTetePage
        titre="Analyse"
        sousTitre={<>Visualisez un calcul sauvegardé : <strong>courbes de réponse</strong> (faites varier un paramètre) ou <strong>composition</strong> (phases du mélange). Les courbes repartent du solveur, avec les mêmes formules que Calculs.</>}
      />

      <div className="mix-choix">
        <Segmente
          ariaLabel="Mode d'analyse"
          valeur={mode}
          onChange={(m) => { setMode(m); dispatch({ type: "message", erreur: null }); }}
          options={[{ valeur: "courbes" as const, libelle: "Courbes de réponse", libelleCourt: "Courbes" }, { valeur: "composition" as const, libelle: "Composition" }]}
        />
      </div>

      <CarteCalculAnalyse
        analysables={analysables}
        calcul={calcul}
        introuvable={introuvable}
        indexRecette={index}
        lecture={lecture}
        notes={mode === "courbes" ? notes : notes.filter((n) => n.ton === "alerte")}
        exclues={mode === "courbes" && comparer ? exclues : undefined}
        onChoisir={choisir}
        onRecette={choisirRecette}
        onRecharger={rechargerDansCalculs}
      />

        {mode === "courbes" ? (
          <>
            <Carte titre="Exemples à essayer">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXEMPLES_ANALYSE.map((x) => (
                  <button key={x.question} type="button" className="btn-secondary" onClick={() => appliquerExemple(x)}>{x.question}</button>
                ))}
              </div>
              {exemple && (
                <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--texte-2)" }} role="status">
                  <strong style={{ color: "var(--texte)" }}>{exemple.question}</strong> {exemple.aRegarder} Cliquez sur « Tracer la courbe ».
                </p>
              )}
            </Carte>

            <Carte titre="Paramètres de la courbe">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="analyse-plage">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Champ libelle="Paramètre à faire varier (X)">
                      <select className="field-input" value={paramActif} onChange={(e) => changerParam(e.target.value)}>
                        {paramsDispo.map((p) => <option key={p.cle} value={p.cle}>{p.label}</option>)}
                      </select>
                    </Champ>
                  </div>
                  <Champ libelle="De">
                    <ChampNombre value={xMin} onChange={(n) => { if (n !== undefined) setXMin(n); }} />
                  </Champ>
                  <Champ libelle="À">
                    <ChampNombre value={xMax} onChange={(n) => { if (n !== undefined) setXMax(n); }} />
                  </Champ>
                  <Champ libelle="Points" erreur={refusPoints ?? undefined}>
                    <ChampNombre value={steps} min={POINTS_MIN} max={POINTS_MAX}
                      messageRefus={`Entre ${POINTS_MIN} et ${POINTS_MAX} points : la valeur précédente est gardée.`}
                      onRefus={setRefusPoints} onChange={(n) => { if (n !== undefined) setSteps(bornerPoints(n)); }} />
                  </Champ>
                </div>

                <div>
                  <span className="ui-champ-libelle" style={{ display: "block", marginBottom: 8 }}>Grandeurs à tracer (Y)</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sortiesDispo.map((s) => {
                      const actif = sorties.includes(s.cle);
                      return (
                        <button key={s.cle} type="button" onClick={() => basculerSortie(s.cle)} aria-pressed={actif}
                          className={actif ? "analyse-sortie analyse-sortie-active" : "analyse-sortie"}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: actif ? s.couleur : "#C7C7CC" }} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--filet)", paddingTop: 14 }}>
                  <label className="mix-case" style={{ color: garde.ok ? "var(--texte)" : "var(--texte-3)", cursor: garde.ok ? "pointer" : "not-allowed" }}>
                    <input type="checkbox" checked={comparaisonActive} disabled={!garde.ok}
                      onChange={(e) => setComparer(e.target.checked)} />
                    Comparer les {variantes.length} recette{variantes.length > 1 ? "s" : ""} du calcul
                    {variantes.length > 1 && ` (${variantes.map((v) => v.label).join(" · ")})`}
                  </label>
                  {!garde.ok && (
                    // Dire POURQUOI c'est indisponible : une case grisée sans
                    // explication est plus frustrante qu'une case absente.
                    <p style={{ fontSize: 13, color: "var(--alerte-texte)", margin: "6px 0 0" }}>{garde.raison}</p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button ref={boutonTracer} type="button" onClick={tracer} disabled={etat.enCours || !lecture?.ok} className="btn-primary"
                    title={lecture && !lecture.ok ? lecture.raison : !lecture ? "Aucun calcul sauvegardé à analyser." : undefined}>
                    {etat.enCours ? "Calcul en cours…" : "Tracer la courbe"}
                  </button>
                </div>
              </div>
            </Carte>

            {figure && res && (
              <Carte titre="Courbe de réponse">
                {perime && (
                  <Bandeau ton="alerte" role="status" titre="Courbe périmée.">
                    Les entrées ont changé depuis ce tracé (paramètre, plage, calcul ou recette) :
                    relancez « Tracer la courbe ». Les exports sont désactivés en attendant.
                  </Bandeau>
                )}
                {toutNul ? (
                  <div style={{ padding: "28px 8px", textAlign: "center", color: "var(--alerte-texte)", fontSize: 14, lineHeight: 1.55 }}>
                    Aucun point n&apos;a pu être calculé sur cette plage. Vérifiez la plage choisie et le
                    calcul analysé (Sr, Gs…).
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <Segmente
                        ariaLabel="Affichage de la courbe"
                        taille="compact"
                        valeur={modeCourbe}
                        onChange={setModeCourbe}
                        options={[{ valeur: "absolu" as const, libelle: "Valeurs" }, { valeur: "ecart" as const, libelle: "Écart % vs référence" }]}
                      />
                      {referenceX !== null && (
                        refDansPlage ? (
                          <span style={{ fontSize: 13, color: "var(--alerte-texte)" }}>Référence (trait orange) : {paramCourt} = {fmt(referenceX, 2)}</span>
                        ) : (
                          <span style={{ fontSize: 13, color: "var(--texte-2)" }}>Référence ({paramCourt} = {fmt(referenceX, 2)}) hors de la plage balayée</span>
                        )
                      )}
                    </div>

                    {variantesFigure ? (
                      // Comparaison : une figure par grandeur, N courbes (une
                      // par recette). Un seul axe Y suffit puisqu'on compare la
                      // MÊME grandeur entre variantes.
                      <div className="analyse-figures">
                        {sortiesFigure.map((cle) => {
                          const meta = sortieMeta(cle);
                          if (!meta) return null;
                          const tv = construireTracesVariantes(figure.resultats, cle, variantesFigure)
                            .map((t, i) => ({ ...t, unite: meta.unite, tirets: variantesFigure[i]?.tirets }));
                          return (
                            <div key={cle} className="analyse-figure">
                              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--texte)", marginBottom: 4 }}>
                                {libelleAvecUnite(meta.label, meta.unite)}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                                {variantesFigure.map((v, i) => (
                                  <span key={`${v.recette ?? "p"}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--texte-2)" }}>
                                    <svg width={20} height={6} aria-hidden="true">
                                      <line x1={0} y1={3} x2={20} y2={3} stroke={v.couleur} strokeWidth={2}
                                        strokeDasharray={v.tirets || undefined} />
                                    </svg>
                                    {v.label}
                                  </span>
                                ))}
                              </div>
                              <FigurePng nom={`analyse-${figCategorie}-${cle}-variantes`} desactive={perime} motif={motifPerime}>
                                <CourbeSvg x={res.x} xLabel={xLabel} xSymbole={paramCourt} series={tv}
                                  reference={refDansPlage ? referenceX! : undefined} hauteur={300} />
                              </FigurePng>
                            </div>
                          );
                        })}
                      </div>
                    ) : modeCourbe === "absolu" ? (
                      <div className="analyse-figures">
                        {traces.map((t) => {
                          const s = statsSerie(res.x, t.valeurs);
                          return (
                            <div key={t.cle} className="analyse-figure">
                              <div style={{ fontSize: 14, fontWeight: 600, color: t.couleur, marginBottom: 2 }}>
                                {libelleAvecUnite(t.label, t.unite)}
                              </div>
                              <FigurePng nom={`analyse-${figCategorie}-${t.cle}`} desactive={perime} motif={motifPerime}>
                                <CourbeSvg x={res.x} xLabel={xLabel} xSymbole={paramCourt} series={[t]} reference={refDansPlage ? referenceX! : undefined} hauteur={300} />
                              </FigurePng>
                              {s && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12.5, color: "var(--texte-2)", marginTop: 2 }}>
                                  <span>min {fmtStat(s.min, t.unite)}</span>
                                  <span>max {fmtStat(s.max, t.unite)}</span>
                                  <span>Δ {fmtStat(s.variation, t.unite)}</span>
                                  <span>pente {fmtStat(s.pente, t.unite)}/{paramCourt}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : ecartToutNul ? (
                      <div style={{ padding: "24px 8px", textAlign: "center", color: "var(--alerte-texte)", fontSize: 14, lineHeight: 1.55 }}>
                        L&apos;écart % n&apos;est pas calculable ici : la valeur de référence est nulle pour les grandeurs sélectionnées.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 6 }}>
                          {traces.map((t) => (
                            <span key={t.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--texte)" }}>
                              <span style={{ width: 14, height: 3, background: t.couleur, borderRadius: 2 }} />
                              {t.label}
                            </span>
                          ))}
                        </div>
                        <FigurePng nom={`analyse-${figCategorie}-ecart`} desactive={perime} motif={motifPerime}>
                          <CourbeSvg x={res.x} xLabel={xLabel} xSymbole={paramCourt} series={tracesEcart} reference={refDansPlage ? referenceX! : undefined} />
                        </FigurePng>
                        <p className="ui-liste-pied" style={{ marginTop: 6 }}>
                          {refDansPlage
                            ? "Écart relatif (%) de chaque grandeur par rapport à sa valeur à la recette de référence (trait orange)."
                            : `Écart relatif (%) par rapport au 1er point balayé (${paramCourt} = ${fmt(res.x[0], 2)}). La recette de référence est hors de la plage.`}
                          {" "}Une grandeur quasi constante reste plate, contrairement à une normalisation min-max.
                        </p>
                      </>
                    )}

                    {estParamCle(figParam) && (
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--filet)" }}>
                        <PanneauVariation
                          instantane={figure.instantane}
                          param={figParam}
                          categorie={figCategorie}
                          x={res.x}
                          series={res.series}
                          reference={refDansPlage ? referenceX! : undefined}
                          fmt={fmtStat}
                        />
                      </div>
                    )}

                    <PanneauProvenance
                      meta={figure.instantane}
                      ouvert={detailsProv}
                      onToggle={() => setDetailsProv((v) => !v)}
                      boutons={
                        <>
                          <button type="button" onClick={exporterCsvCourbes} className="btn-contour" disabled={perime} title={perime ? motifPerime : undefined}>Export CSV</button>
                          <button type="button" onClick={exporterJsonCourbes} className="btn-contour" disabled={perime} title={perime ? motifPerime : undefined}>Export JSON</button>
                        </>
                      }
                    />
                  </>
                )}
              </Carte>
            )}
          </>
        ) : (
          <>
            {lecture?.ok && recettesComp.length > 0 && (
              <>
                {volumesIncomplets(recettesComp.map((x) => x.r)) && (
                  <Bandeau ton="alerte">
                    Ce calcul a été sauvegardé avant que tous les volumes de phases soient enregistrés : les vues
                    en volume peuvent être incomplètes, celles en masse restent justes. Rechargez-le dans Calculs,
                    recalculez et sauvegardez pour les compléter.
                  </Bandeau>
                )}
                <CompositionVue key={calcul?.id} recipes={recettesComp.map((x) => x.r)} />
                {compMeta && (
                  <Carte titre="Export">
                    <PanneauProvenance
                      meta={compMeta}
                      ouvert={detailsProv}
                      onToggle={() => setDetailsProv((v) => !v)}
                      boutons={<button type="button" onClick={exporterCsvComposition} className="btn-contour">Export CSV (phases)</button>}
                    />
                  </Carte>
                )}
              </>
            )}
          </>
        )}

        <ErrorBox message={etat.erreur} />
    </Page>
  );
}
