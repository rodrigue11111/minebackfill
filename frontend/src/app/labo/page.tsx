"use client";

// Page « Labo » — gâchées RÉELLES (maquette A améliorée). Chaque gâchée part
// d'une formulation sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a
// vraiment été fait : masses cibles contre pesées, lots, mesures fraîches
// (affaissement, température, w, Cw), ajustements de l'essai-erreur,
// éprouvettes et essais UCS. Auto-sauvegarde : chaque saisie est persistée
// immédiatement (localStorage). Les parties sont dans components/labo.

import { useState } from "react";
import { useStore } from "@/lib/store";
import { nomLiant } from "@/lib/liants";
import { materiauxDepuisFormulation } from "@/lib/gachee-materiaux";
import FiltreSession from "@/components/FiltreSession";
import { correspond, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import { useHydrated } from "@/lib/use-hydrated";
import { genererCode, composantsDepuisRecette, parametresDepuisRecette, nbHorsTolerance, type Gachee } from "@/lib/gachee";
import { snapshotProtocoles } from "@/lib/protocole";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import { annotationsDe, docsAvecNonLus } from "@/lib/annotations";
import { courbesAOublier, idsCourbes } from "@/lib/courbes";
import { oublierCourbes } from "@/lib/courbes-client";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { Pastille } from "@/components/ui/Pastille";
import { Icone } from "@/components/ui/Icones";
import Segmente from "@/components/ui/Segmente";
import EditeurGachee from "@/components/labo/EditeurGachee";
import Echeancier from "@/components/labo/Echeancier";
import ResultatsUCS from "@/components/labo/ResultatsUCS";
import ProtocolesEditeur from "@/components/labo/ProtocolesEditeur";
import { dateLongue, nouvelId } from "@/components/labo/outils";

type Vue = "gachees" | "resultats" | "protocoles";

export default function LaboPage() {
  const monte = useHydrated();
  const { gachees, ajouterGachee, modifierGachee, supprimerGachee, savedResults,
    protocoles, ajouterProtocole, modifierProtocole, supprimerProtocole, reinitialiserProtocoles } = useStore();
  const annotations = useStore((s) => s.annotations);
  const connecte = useStore((s) => s.session !== null);
  const [selId, setSelId] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);
  const [vue, setVue] = useState<Vue>("gachees");
  // Filtre de session : la liste et les figures. L'échéancier, lui, montre
  // TOUTES les éprouvettes à écraser — on ne doit en manquer aucune.
  const sessions = useStore((s) => s.sessions);
  const catalogueResidus = useStore((s) => s.catalogue_residus);
  const catalogueGranulats = useStore((s) => s.catalogue_granulats);
  const [filtreSession, setFiltreSession] = useState<FiltreSessionValeur>("toutes");
  const gacheesSession = gachees.filter((g) =>
    correspond({ sessionId: g.sessionId, date: g.creeLe }, sessions, filtreSession));

  // « Aujourd'hui » pour l'échéancier et les badges (voir use-aujourdhui.ts).
  const maintenant = useAujourdhui();

  const nonLus = docsAvecNonLus(annotations);
  const formulations = savedResults.filter((s) => (s.recipes?.length ?? 0) > 0);
  const selection = gachees.find((g) => g.id === selId) ?? null;

  function creer() {
    const form = formulations.find((s) => s.id === formId) ?? formulations[0];
    if (!form) return;
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

  // ── Éditeur d'une gâchée ──
  if (selection) {
    const g = selection;
    return (
      <Page>
        <EditeurGachee
          gachee={g}
          maintenant={maintenant}
          annotations={annotationsDe(annotations, "gachee", g.id)}
          connecte={connecte}
          onMaj={(patch) => modifierGachee(g.id, patch)}
          bibliotheque={{ residus: catalogueResidus, granulats: catalogueGranulats }}
          onRetour={() => setSelId(null)}
          onSupprimer={() => {
            if (window.confirm(`Supprimer la gâchée ${g.code} ?`)) {
              oublierCourbes(courbesAOublier(idsCourbes(g), gachees.filter((x) => x.id !== g.id)));
              supprimerGachee(g.id);
              setSelId(null);
            }
          }}
        />
      </Page>
    );
  }

  const formChoisie = formulations.find((s) => s.id === (formId || formulations[0]?.id)) ?? formulations[0];

  // ── Liste des gâchées ──
  return (
    <Page>
      <EnTetePage
        titre="Laboratoire"
        sousTitre="Ce que vous avez réellement préparé : pesées, lots, mesures, éprouvettes et essais UCS. Une gâchée part d'une formulation sauvegardée dans Calculs."
        actions={vue === "gachees" ? (
          <button type="button" onClick={() => setNouvelle((v) => !v)} className="btn-primary" aria-expanded={nouvelle}>
            <Icone nom="ajouter" taille={15} epaisseur={2.4} />
            Nouvelle gâchée
          </button>
        ) : undefined}
      />

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
                        {formulations.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.category})</option>)}
                      </select>
                    </Champ>
                    {formChoisie.recipes.length > 1 && (
                      <Champ libelle="Recette">
                        <select className="field-input" value={recIndex} onChange={(e) => setRecIndex(Number(e.target.value))}>
                          {formChoisie.recipes.map((_, i) => <option key={i} value={i}>Recette {i + 1}</option>)}
                        </select>
                      </Champ>
                    )}
                  </div>
                  <div>
                    <button type="button" onClick={creer} className="btn-primary">Créer la gâchée</button>
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
                        {g.statut === "terminee" ? <Pastille ton="succes">Terminée</Pastille> : <Pastille ton="neutre">Brouillon</Pastille>}
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
