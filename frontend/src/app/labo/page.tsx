"use client";

// Page « Labo » — gâchées RÉELLES (maquette A améliorée). Chaque gâchée part
// d'une formulation sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a
// vraiment été fait : masses cibles contre pesées, lots, mesures fraîches
// (affaissement, température, w, Cw), ajustements de l'essai-erreur,
// éprouvettes et essais UCS. Auto-sauvegarde : chaque saisie est persistée
// immédiatement (localStorage). Les parties sont dans components/labo.
//
// Démonstration (/labo?demo=1, 2026-10-30) : des gâchées de simulation
// (labo-demo.ts) gardées en mémoire ; rien n'est enregistré ni synchronisé.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { laboDemo, MENTION_DEMO_LABO } from "@/lib/labo-demo";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { nomLiant } from "@/lib/liants";
import { materiauxDepuisFormulation } from "@/lib/gachee-materiaux";
import FiltreSession from "@/components/FiltreSession";
import { correspond, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import { useHydrated } from "@/lib/use-hydrated";
import { genererCode, composantsDepuisRecette, parametresDepuisRecette, parametresEffectifs, nbHorsTolerance, messageSuppressionGachee, moulesPrevus, resumeParametres, etatGachee, TON_ETAT_GACHEE, type Gachee } from "@/lib/gachee";
import { snapshotProtocoles } from "@/lib/protocole";
import { mouleDepuisContenant } from "@/lib/eprouvette";
import { volumeHorsLabo } from "@/lib/contenant";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import { annotationsDe, docsAvecNonLus } from "@/lib/annotations";
import { vuePourNonLues } from "@/lib/liens-commentaires";
import { libelleRevue } from "@/lib/revues";
import { clesCourbes, courbesAOublier } from "@/lib/courbes";
import { oublierCourbes } from "@/lib/courbes-client";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { Pastille } from "@/components/ui/Pastille";
import { Icone } from "@/components/ui/Icones";
import Segmente from "@/components/ui/Segmente";
import EditeurGachee from "@/components/labo/EditeurGachee";
import ResumeCalcul from "@/components/labo/ResumeCalcul";
import { lienDocument } from "@/lib/liens-commentaires";
import { chargerEtatSync } from "@/lib/sync-etat";
import { cleDoc } from "@/lib/sync-moteur";
import Echeancier from "@/components/labo/Echeancier";
import ResultatsUCS from "@/components/labo/ResultatsUCS";
import ProtocolesEditeur from "@/components/labo/ProtocolesEditeur";
import { dateHeureSauvegarde, dateLongue, nouvelId } from "@/components/labo/outils";

type Vue = "gachees" | "resultats" | "protocoles";

// useSearchParams exige une frontière Suspense (comme app/analyse/page.tsx).
export default function LaboPage() {
  return <Suspense fallback={null}><LaboContenu /></Suspense>;
}

function LaboContenu() {
  const monte = useHydrated();
  const { gachees: gacheesMagasin, ajouterGachee: ajouterMagasin, modifierGachee: modifierMagasin, supprimerGachee: supprimerMagasin, savedResults,
    protocoles, ajouterProtocole, modifierProtocole, supprimerProtocole, reinitialiserProtocoles } = useStore();
  const annotationsMagasin = useStore((s) => s.annotations);
  const connecte = useStore((s) => s.session !== null);
  const params = useSearchParams();
  // Démonstration : les gâchées de simulation remplacent celles du magasin,
  // et chaque modification reste en mémoire (rien n'est écrit).
  const demo = params.get("demo") === "1";
  const demoInitiale = useMemo(() => (demo ? laboDemo(new Date()) : null), [demo]);
  const [demoGachees, setDemoGachees] = useState<Gachee[] | null>(null);
  const gachees = demoInitiale ? (demoGachees ?? demoInitiale.gachees) : gacheesMagasin;
  const majDemo = (f: (l: Gachee[]) => Gachee[]) => setDemoGachees((avant) => f(avant ?? demoInitiale?.gachees ?? []));
  const ajouterGachee = (g: Gachee) => (demoInitiale ? majDemo((l) => [g, ...l]) : ajouterMagasin(g));
  const modifierGachee = (id: string, patch: Partial<Gachee>) =>
    (demoInitiale ? majDemo((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))) : modifierMagasin(id, patch));
  const supprimerGachee = (id: string) => (demoInitiale ? majDemo((l) => l.filter((x) => x.id !== id)) : supprimerMagasin(id));
  const annotations = demo ? [] : annotationsMagasin;
  // Gâchée ouverte : choisie dans la page, sinon demandée par l'adresse
  // (?gachee=, lien direct du bandeau des commentaires). undefined : pas
  // encore de choix, l'adresse décide ; null : la liste.
  const demande = params.get("gachee");
  const [selId, setSelId] = useState<string | null | undefined>(undefined);
  const actif = selId === undefined ? demande : selId;
  const viaLien = selId === undefined && demande !== null;
  // Revenir à la liste retire ?gachee= : recharger la page ne rouvre pas la gâchée.
  const fermer = () => {
    setSelId(null);
    if (demande !== null) window.history.replaceState(null, "", "/labo");
  };
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);
  const [vue, setVue] = useState<Vue>("gachees");
  // Filtre de session : la liste et les figures. L'échéancier, lui, montre
  // TOUTES les éprouvettes à écraser — on ne doit en manquer aucune.
  const sessions = useStore((s) => s.sessions);
  const revuesMagasin = useStore((s) => s.revues);
  const revues = demo ? [] : revuesMagasin;
  const revueDe = new Map(revues.map((r) => [r.id, r]));
  const catalogueResidus = useStore((s) => s.catalogue_residus);
  const catalogueGranulats = useStore((s) => s.catalogue_granulats);
  const catalogueLiants = useStore((s) => s.catalogue_liants);
  const [filtreSession, setFiltreSession] = useState<FiltreSessionValeur>("toutes");
  const gacheesSession = gachees.filter((g) =>
    correspond({ sessionId: g.sessionId, date: g.creeLe }, sessions, filtreSession));

  // « Aujourd'hui » pour l'échéancier et les badges (voir use-aujourdhui.ts).
  const maintenant = useAujourdhui();

  const nonLus = docsAvecNonLus(annotations);
  const formulations = demoInitiale ? demoInitiale.formulations : savedResults.filter((s) => (s.recipes?.length ?? 0) > 0);
  const selection = gachees.find((g) => g.id === actif) ?? null;

  function creer() {
    const trouvee = formulations.find((s) => s.id === formId) ?? formulations[0];
    if (!trouvee) return;
    // Une sauvegarde importée peut n'avoir aucun `general` : rien à lire, mais
    // la gâchée se crée quand même.
    const form = { ...trouvee, general: trouvee.general ?? ({} as typeof trouvee.general) };
    const recette = form.recipes[Math.min(recIndex, form.recipes.length - 1)];
    if (!recette) return;
    const g: Gachee = {
      id: nouvelId(),
      code: genererCode(gachees, new Date()),
      creeLe: new Date().toISOString(),
      statut: "brouillon",
      formulationLabel: form.label,
      formulationId: form.id,
      categorie: form.category,
      recetteIndex: Math.min(recIndex, form.recipes.length - 1),
      solverVersion: form.solverVersion,
      composants: composantsDepuisRecette(recette, nomLiant(form.general, form.catalogue_liants ?? [])),
      tolerancePct: 2,
      ajustements: [],
      eprouvettes: [],
      parametres: parametresDepuisRecette(recette),
      protocolesSnapshot: snapshotProtocoles(protocoles),
      // Fiche d'essai : matériaux de la formulation (modifiables ensuite).
      materiaux: materiauxDepuisFormulation(form, { residus: catalogueResidus, granulats: catalogueGranulats }),
    };
    ajouterGachee(g);
    setNouvelle(false);
    setSelId(g.id);
  }

  if (!monte) return null;

  // Révision de chaque gâchée connue en ligne : une revue posée sur une
  // version antérieure le dit (« sur une version antérieure »).
  const docsEnLigne = chargerEtatSync().docs;
  const revEnLigne = (id: string) => docsEnLigne[cleDoc("gachee", id)]?.rev ?? null;

  // ── Éditeur d'une gâchée ──
  if (selection) {
    const g = selection;
    return (
      <Page>
        {demo && <BandeauDemo />}
        <EditeurGachee
          key={g.id}
          gachee={g}
          vueInitiale={viaLien ? vuePourNonLues(annotationsDe(annotations, "gachee", g.id), g.eprouvettes.map((e) => e.code)) : undefined}
          allerAuNonLu={viaLien}
          parametres={parametresEffectifs(g, formulations)}
          mouleFormulation={mouleDepuisContenant(formulations.find((f) => f.id === g.formulationId)?.general)}
          moulesPrevus={moulesPrevus(formulations.find((f) => f.id === g.formulationId))}
          lienCalcul={g.formulationId && formulations.some((f) => f.id === g.formulationId) ? lienDocument("resultat", g.formulationId) : undefined}
          maintenant={maintenant}
          annotations={annotationsDe(annotations, "gachee", g.id)}
          connecte={connecte}
          onMaj={(patch) => modifierGachee(g.id, patch)}
          bibliotheque={{ residus: catalogueResidus, granulats: catalogueGranulats }}
          revue={revueDe.get(g.id)}
          revEnLigne={revEnLigne(g.id)}
          onRetour={fermer}
          onSupprimer={() => {
            if (window.confirm(messageSuppressionGachee(g))) {
              if (!demo) oublierCourbes(courbesAOublier(clesCourbes(g), gachees.filter((x) => x.id !== g.id)));
              supprimerGachee(g.id);
              fermer();
            }
          }}
        />
      </Page>
    );
  }

  const formChoisie = formulations.find((s) => s.id === (formId || formulations[0]?.id)) ?? formulations[0];
  // Volume total de la recette choisie, s'il est de taille chantier (avis, jamais un blocage).
  const recetteChoisie = formChoisie?.recipes[Math.min(recIndex, formChoisie.recipes.length - 1)];
  const volumeChantier = volumeHorsLabo(recetteChoisie?.total_backfill_volume_m3)
    ? (recetteChoisie?.total_backfill_volume_m3 as number) : null;

  // ── Liste des gâchées ──
  return (
    <Page>
      <EnTetePage
        titre="Laboratoire"
        sousTitre="Ce que vous avez réellement préparé : pesées, lots, mesures, éprouvettes et essais UCS. Une gâchée part d'une formulation sauvegardée dans Calculs."
        actions={<>
          {demo
            ? <Link href="/labo" className="btn-discret">Quitter la démonstration</Link>
            : <Link href="/labo?demo=1" className="btn-discret">Voir une démonstration</Link>}
          {vue === "gachees" && (
            <button type="button" onClick={() => setNouvelle((v) => !v)} className="btn-primary" aria-expanded={nouvelle}>
              <Icone nom="ajouter" taille={15} epaisseur={2.4} />
              Nouvelle gâchée
            </button>
          )}
        </>}
      />
      {demo && <BandeauDemo />}

      <div className="labo-barre-vue">
        <Segmente
          ariaLabel="Vue du laboratoire"
          role="tablist"
          valeur={vue}
          onChange={setVue}
          options={[
            { valeur: "gachees", libelle: "Gâchées" },
            { valeur: "resultats", libelle: "Résultats UCS", libelleCourt: "UCS" },
            { valeur: "protocoles", libelle: "Protocoles" },
          ]}
        />
        {vue !== "protocoles" && (
          <FiltreSession sessions={sessions} valeur={filtreSession} onChange={setFiltreSession}
            compte={filtreSession === "toutes" ? undefined : `${gacheesSession.length} gâchée(s) sur ${gachees.length}`} />
        )}
      </div>

      {vue === "resultats" ? (
        <>
          {/* Une copie de conflit est la MÊME gâchée en deux versions : la
              compter dans les figures doublerait sa mesure. */}
          {gacheesSession.some((g) => g.conflit) && (
            <Bandeau ton="alerte">
              {gacheesSession.filter((g) => g.conflit).length} copie(s) de conflit exclue(s) des figures : gardez la bonne
              version de chaque gâchée et supprimez l&apos;autre.
            </Bandeau>
          )}
          <ResultatsUCS gachees={gacheesSession.filter((g) => !g.conflit)} formulations={formulations} />
        </>
      ) : vue === "protocoles" ? (
        <ProtocolesEditeur protocoles={protocoles} onAjouter={ajouterProtocole} onModifier={modifierProtocole} onSupprimer={supprimerProtocole} onReinitialiser={reinitialiserProtocoles} />
      ) : (
        <>
          {nouvelle && (
            <Carte titre="Nouvelle gâchée">
              {!formChoisie ? (
                <Bandeau ton="alerte">
                  Aucune formulation sauvegardée. Allez dans <strong>Calculs</strong>, lancez un calcul RPC ou RPG, puis cliquez sur
                  <strong> « Sauvegarder »</strong> dans les résultats. Revenez ensuite ici.
                </Bandeau>
              ) : (
                <>
                  <div className="grille-2">
                    <Champ libelle="Formulation">
                      <select className="field-input" value={formChoisie.id} onChange={(e) => { setFormId(e.target.value); setRecIndex(0); }}>
                        {formulations.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.category}, {dateHeureSauvegarde(s.savedAt)})</option>)}
                      </select>
                    </Champ>
                    {formChoisie.recipes.length > 1 && (
                      <Champ libelle="Recette">
                        <select className="field-input" value={recIndex} onChange={(e) => setRecIndex(Number(e.target.value))}>
                          {formChoisie.recipes.map((r, i) => {
                            const repere = resumeParametres(parametresDepuisRecette(r));
                            return <option key={i} value={i}>Recette {i + 1}{repere ? ` : ${repere}` : ""}</option>;
                          })}
                        </select>
                      </Champ>
                    )}
                  </div>
                  <ResumeCalcul calcul={formChoisie} recetteIndex={recIndex} catalogue={catalogueLiants} />
                  {volumeChantier !== null && (
                    <Bandeau ton="alerte" role="status">
                      Cette recette vise {volumeChantier.toLocaleString("fr-CA", { maximumFractionDigits: 3 })} m³ de remblai, un volume
                      de chantier : une gâchée de laboratoire en fait quelques litres (moules de 0,2 à 1,6 L). Refaites le calcul avec le
                      volume de vos moules (Informations, Dimensions des moules), ou créez quand même.
                    </Bandeau>
                  )}
                  <div>
                    <button type="button" onClick={creer} className="btn-primary">
                      {volumeChantier !== null ? "Créer quand même" : "Créer la gâchée"}
                    </button>
                  </div>
                </>
              )}
            </Carte>
          )}

          <Echeancier gachees={gachees} maintenant={maintenant} onOuvrir={(id) => setSelId(id)} />

          {gacheesSession.length === 0 ? (
            <p className="labo-vide" style={{ textAlign: "center", padding: "24px 0" }}>
              {gachees.length === 0 ? "Aucune gâchée pour l'instant." : "Aucune gâchée dans cette session."}
            </p>
          ) : (
            <Carte titre="Gâchées" aside={`${gacheesSession.length}`} sansMarge>
              <div className="ui-liste labo-liste-gachees">
                {gacheesSession.map((g) => {
                  const hors = nbHorsTolerance(g);
                  return (
                    <button key={g.id} type="button" onClick={() => setSelId(g.id)} className="ui-ligne ui-ligne-lien labo-ligne-bouton">
                      <span className="ui-ligne-textes">
                        <span className="ui-ligne-libelle" style={{ fontWeight: 600 }}>{g.code}</span>
                        <span className="ui-ligne-detail">{g.formulationLabel} · {g.categorie} · {dateLongue(new Date(g.creeLe))}</span>
                      </span>
                      <span className="ui-ligne-droite labo-pastilles">
                        {nonLus.has(`gachee:${g.id}`) && (
                          <span title="L'enseignant a commenté cette gâchée : ouvrez-la pour lire et répondre.">
                            <Pastille ton="violet">Commentaire non lu</Pastille>
                          </span>
                        )}
                        {g.conflit && (
                          <span title={`Version gardée lors d'un conflit de synchronisation (${new Date(g.conflit.le).toLocaleString("fr-CA")}). Exclue des figures.`}>
                            <Pastille ton="alerte">Copie de conflit</Pastille>
                          </span>
                        )}
                        {hors > 0 && <Pastille ton="danger">{hors} écart{hors > 1 ? "s" : ""} hors tolérance</Pastille>}
                        {revueDe.get(g.id) && (
                          <Pastille ton={revueDe.get(g.id)!.decision === "acceptee" ? "succes" : "danger"} title={revueDe.get(g.id)!.motif ?? undefined}>
                            {libelleRevue(revueDe.get(g.id)!, revEnLigne(g.id))}
                          </Pastille>
                        )}
                        {(() => {
                          const e = etatGachee(g);
                          return <Pastille ton={TON_ETAT_GACHEE[e.etat]} title={e.detail}>{e.libelle}</Pastille>;
                        })()}
                        <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Carte>
          )}
        </>
      )}
    </Page>
  );
}

/** Bandeau de la démonstration : ce qui est réel, ce qui ne l'est pas, rien n'est enregistré. */
function BandeauDemo() {
  return (
    <Bandeau ton="info" titre="Démonstration : gâchées de simulation." role="status">
      {MENTION_DEMO_LABO}
    </Bandeau>
  );
}
