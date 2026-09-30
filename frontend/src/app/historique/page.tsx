"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FiltreSession from "@/components/FiltreSession";
import AnnotationsDoc from "@/components/AnnotationsDoc";
import { docsAvecNonLus } from "@/lib/annotations";
import { correspond, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import { useStore, type SavedResult } from "@/lib/store";
import { estVersionCourante } from "@/lib/conventions";
import { exporterResultat } from "@/lib/exports-resultat";
import { fromStoreMass, MASS_LABELS } from "@/lib/units";
import type { Recipe } from "@/lib/types";
import BackupButtons from "@/components/BackupButtons";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { Icone } from "@/components/ui/Icones";

import { methodLabel } from "@/lib/method-registry";
import { fmt } from "@/lib/format";

/** Nombre de recettes, RPC/RPG comme RRC (dont les recettes vivent dans `rrc`). */
const nbRecettes = (sr: SavedResult) =>
  sr.category === "RRC" ? sr.rrc?.result.recipes.length ?? 0 : sr.recipes.length;

export default function HistoriquePage() {
  const router = useRouter();
  const { savedResults, loadSavedResults, deleteSavedResult, restoreSavedResult, units, loadUnits } = useStore();

  const recharger = (sr: SavedResult) => {
    if (restoreSavedResult(sr.id)) router.push("/mix");
  };
  const exporterExcel = (sr: SavedResult) => exporterResultat(sr, "excel", units);
  const exporterPdf = (sr: SavedResult) => exporterResultat(sr, "pdf", units);
  const exporterFeuilleLabo = (sr: SavedResult) => exporterResultat(sr, "feuille", units);
  const massLabel = MASS_LABELS[units?.mass as keyof typeof MASS_LABELS] ?? "kg";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sessions = useStore((s) => s.sessions);
  const nonLus = docsAvecNonLus(useStore((s) => s.annotations));
  const [filtreSession, setFiltreSession] = useState<FiltreSessionValeur>("toutes");
  const visibles = savedResults.filter((sr) =>
    correspond({ sessionId: sr.sessionId, date: sr.savedAt }, sessions, filtreSession));

  useEffect(() => {
    loadSavedResults();
    loadUnits();
  }, [loadSavedResults, loadUnits]);

  const handleDelete = (id: string) => {
    deleteSavedResult(id);
    setConfirmDeleteId(null);
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <Page>
      <EnTetePage
        titre="Historique"
        sousTitre={`${savedResults.length} résultat${savedResults.length !== 1 ? "s" : ""} sauvegardé${savedResults.length !== 1 ? "s" : ""} sur cet appareil — pensez à exporter vos données (navigateur uniquement).`}
        actions={<Link href="/mix" className="btn-discret">Retour aux calculs</Link>}
      />

      <div className="hist-outils">
        <BackupButtons />
        {savedResults.length > 0 && (
          <FiltreSession sessions={sessions} valeur={filtreSession} onChange={setFiltreSession}
            compte={filtreSession === "toutes" ? undefined : `${visibles.length} sur ${savedResults.length}`} />
        )}
      </div>

      {savedResults.length === 0 ? (
        <Carte>
          <div className="hist-vide">
            <Icone nom="historique" taille={40} epaisseur={1.5} />
            <p className="hist-vide-titre">Aucune sauvegarde</p>
            <p className="classe-rien">
              Après un calcul, cliquez sur <strong>Sauvegarder</strong> dans la carte Résultats pour retrouver le résultat ici.
            </p>
          </div>
        </Carte>
      ) : (
        <Carte sansMarge aria-label="Résultats sauvegardés">
          <div className="hist-liste">
            {visibles.map((sr: SavedResult) => {
              const isExpanded = expandedId === sr.id;
              const date = new Date(sr.savedAt);
              const dateStr = date.toLocaleDateString("fr-CA");
              const timeStr = date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={sr.id} className={isExpanded ? "hist-element hist-ouvert" : "hist-element"}>
                  <div className="hist-ligne">
                    <button type="button" className="hist-ligne-bouton" aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : sr.id)}>
                      <span className="ui-ligne-textes">
                        <span className="hist-nom">
                          {sr.label}
                          {!estVersionCourante(sr.solverVersion) && (
                            <span title="Résultat calculé avec une version antérieure des formules. Rechargez et relancez le calcul pour des valeurs à jour.">
                              <Pastille ton="alerte">anciennes formules</Pastille>
                            </span>
                          )}
                          {nonLus.has(`resultat:${sr.id}`) && (
                            <span title="L'enseignant a commenté ce résultat : dépliez-le pour lire et répondre.">
                              <Pastille ton="violet">commentaire non lu</Pastille>
                            </span>
                          )}
                          {sr.conflit && (
                            <span title={`Version gardée lors d'un conflit de synchronisation (${new Date(sr.conflit.le).toLocaleString("fr-CA")}) : ce résultat avait été modifié sur deux appareils. Gardez la bonne version et supprimez l'autre.`}>
                              <Pastille ton="alerte">copie de conflit</Pastille>
                            </span>
                          )}
                        </span>
                        <span className="ui-ligne-detail">
                          {sr.category} · {methodLabel(sr.category, sr.method)} · {nbRecettes(sr)} recette{nbRecettes(sr) > 1 ? "s" : ""} · {dateStr} {timeStr}
                        </span>
                      </span>
                      <span className="ui-ligne-chevron" style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}>
                        <Icone nom="chevron" taille={14} epaisseur={2.2} />
                      </span>
                    </button>
                    <span className="hist-actions-ligne">
                      <button type="button" className="btn-discret" onClick={() => setExpandedId(isExpanded ? null : sr.id)}>
                        {isExpanded ? "Réduire" : "Voir"}
                      </button>
                      {confirmDeleteId === sr.id ? (
                        <button type="button" className="btn-discret btn-danger" onClick={() => handleDelete(sr.id)}>
                          Confirmer
                        </button>
                      ) : (
                        <button type="button" className="btn-discret hist-supprimer" onClick={() => setConfirmDeleteId(sr.id)}>
                          Supprimer
                        </button>
                      )}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="hist-detail">
                      <AnnotationsDoc kind="resultat" id={sr.id} />
                      <div className="hist-boutons">
                        <button className="btn-primary" onClick={() => recharger(sr)}
                          title="Recharge la catégorie, la méthode, les entrées et les résultats dans la page Calculs">
                          Recharger dans Calculs
                        </button>
                        <button className="btn-contour" onClick={() => exporterExcel(sr)}>
                          Excel
                        </button>
                        <button className="btn-contour" onClick={() => exporterPdf(sr)}>
                          PDF
                        </button>
                        {/* RRC : la feuille labo est le même PDF (rrc-export) — un seul bouton. */}
                        {sr.category !== "RRC" && (
                          <button className="btn-contour" onClick={() => exporterFeuilleLabo(sr)}>
                            Feuille labo
                          </button>
                        )}
                        {/* Les entrées RRC portent leurs entrées dans `rrc`, pas `inputs`. */}
                        {!sr.inputs && !sr.rrc && (
                          <span className="ui-liste-pied">
                            (sauvegarde ancienne : rechargement des résultats seulement, sans les entrées)
                          </span>
                        )}
                      </div>

                      {(sr.general.operator_name || sr.general.project_name || sr.general.residue_id) && (
                        <div className="hist-infos">
                          {sr.general.operator_name && <span><span className="hist-etiquette">Opérateur : </span>{sr.general.operator_name}</span>}
                          {sr.general.project_name && <span><span className="hist-etiquette">Projet : </span>{sr.general.project_name}</span>}
                          {sr.general.residue_id && <span><span className="hist-etiquette">Résidu : </span>{sr.general.residue_id}</span>}
                        </div>
                      )}

                      {/* Tableau récapitulatif RPC/RPG. Le RRC n'a pas de
                          recettes MixState : on renvoie vers Recharger/Excel. */}
                      {sr.category === "RRC" ? (
                        <p className="classe-rien">
                          Résultat RRC ({nbRecettes(sr)} recette{nbRecettes(sr) > 1 ? "s" : ""}).
                          Utilisez « Recharger dans Calculs » pour le détail complet, ou « Excel » / « Feuille labo » pour l&apos;export.
                        </p>
                      ) : (
                        <div className="mix-tableau-defilant">
                          <table className="result-table">
                            <thead>
                              <tr>
                                <th>Paramètre</th>
                                {sr.recipes.map((_: Recipe, i: number) => <th key={i}>R{i + 1}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: "Bw (%)", getter: (r: Recipe) => r.bw_mass_pct, digits: 2 },
                                { label: "Cw (%)", getter: (r: Recipe) => r.solids_mass_pct, digits: 2 },
                                { label: "e (indice des vides)", getter: (r: Recipe) => r.void_ratio, digits: 4 },
                                { label: "n (porosité)", getter: (r: Recipe) => r.porosity, digits: 4 },
                                { label: "w (%)", getter: (r: Recipe) => r.w_mass_pct, digits: 2 },
                                { label: "E/L", getter: (r: Recipe) => r.wc_ratio, digits: 3 },
                                { label: "Sr (%)", getter: (r: Recipe) => r.saturation_pct, digits: 1 },
                                { label: `Résidu sec (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.residue_dry_mass_kg, units?.mass), digits: 3 },
                                { label: `Liant (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.binder_total_mass_kg, units?.mass), digits: 3 },
                                { label: `Eau totale (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.water_total_mass_kg, units?.mass), digits: 3 },
                              ].map((row, ri) => (
                                <tr key={ri}>
                                  <td>{row.label}</td>
                                  {sr.recipes.map((r: Recipe, ci: number) => <td key={ci}>{fmt(row.getter(r), row.digits)}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Carte>
      )}
    </Page>
  );
}
