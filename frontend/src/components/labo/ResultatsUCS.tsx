"use client";

// Vue « Résultats UCS » du Labo : résistance en compression uniaxiale
// MESURÉE (ASTM C39/C39M), en fonction de l'âge de cure ou d'un paramètre de
// formulation. Aucune valeur prédite ni modélisée.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Gachee } from "@/lib/gachee";
import { parametresEffectifs } from "@/lib/gachee";
import { agregerParAge } from "@/lib/eprouvette";
import {
  AXES_FORMULATION, axeMeta, agesDisponibles, nuageUcs, lignesCsvNuage, lignesProvenanceLabo,
  type AxeFormulation,
} from "@/lib/ucs-formulation";
import { telechargerTexte, celluleCsv, nomFichier } from "@/lib/export-fig";
import type { Recipe } from "@/lib/types";
import { TIRET, libelleAvecUnite } from "@/lib/format";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import Segmente from "@/components/ui/Segmente";
import CourbeUCS, { type SerieUCS } from "./CourbeUCS";

const fmtParam = (v: number | undefined, suffixe = "") => (v != null ? `${v.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}${suffixe}` : TIRET);

// Palette étendue (au-delà des 4 couleurs de recette) pour distinguer plus de
// gâchées sur la même courbe.
const COULEURS_SERIE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f"];

export default function ResultatsUCS({ gachees, formulations }: {
  gachees: Gachee[];
  formulations: { id: string; recipes: Recipe[] }[];
}) {
  // « age » = la courbe historique ; les autres valeurs = le nuage UCS vs
  // paramètre de formulation.
  const [axe, setAxe] = useState<"age" | AxeFormulation>("age");
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  // On mémorise les gâchées MASQUÉES, pas les affichées : une gâchée créée
  // après coup apparaît ainsi d'office, au lieu de rester invisible jusqu'à ce
  // qu'on pense à la cocher.
  const [masquees, setMasquees] = useState<Set<string>>(new Set());

  const donnees = gachees
    .map((g) => ({ g, ages: agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null) }))
    .filter((d) => d.ages.length > 0);

  // Couleur attachée à la GÂCHÉE, calculée sur la liste complète. Si on la
  // calculait sur la liste filtrée, masquer une gâchée recolorierait toutes
  // les suivantes — et un étudiant croirait avoir perdu la sienne.
  const couleurDe = new Map(donnees.map((d, i) => [d.g.id, COULEURS_SERIE[i % COULEURS_SERIE.length]]));

  const visibles = donnees.filter((d) => !masquees.has(d.g.id));
  const nbMasquees = donnees.length - visibles.length;

  const basculer = (id: string) => setMasquees((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const series: SerieUCS[] = visibles.map((d) => ({
    cle: d.g.id,
    label: d.g.code,
    couleur: couleurDe.get(d.g.id) ?? COULEURS_SERIE[0],
    points: d.ages.map((a) => ({ x: a.ageJours, moyenne: a.moyenneKpa as number, ecartType: a.ecartTypeKpa, n: a.n })),
  }));

  // Dérivé en useMemo, PAS synchronisé par un effet : un setState dans un
  // useEffect est une erreur de lint (React Compiler). L'âge choisi est borné
  // AU RENDU, de sorte que supprimer la dernière éprouvette d'un âge ne laisse
  // pas l'écran sur un âge qui n'existe plus.
  const ages = useMemo(() => agesDisponibles(gachees), [gachees]);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : (ages[0] ?? 0);

  // Les gâchées masquées sont retirées AVANT le calcul du nuage : elles ne
  // doivent pas apparaître dans « Gâchées absentes de cette figure », qui
  // signale des problèmes de DONNÉES (pas d'éprouvette à cet âge, toutes
  // exclues). Y mêler un masquage volontaire rendrait cette liste illisible.
  const gacheesRetenues = gachees.filter((g) => !masquees.has(g.id));
  const metaAxe = axe !== "age" ? axeMeta(axe) : undefined;
  const nuage = axe !== "age" ? nuageUcs(gacheesRetenues, formulations, axe, age) : null;

  const seriesNuage: SerieUCS[] = nuage
    ? nuage.points.map((p) => ({
        cle: p.id, label: p.code, couleur: couleurDe.get(p.id) ?? COULEURS_SERIE[0],
        points: [{ x: p.x, moyenne: p.moyenneKpa, ecartType: p.ecartTypeKpa, n: p.n }],
      }))
    : [];

  function exporterCsvMesures() {
    if (!nuage || axe === "age") return;
    // L'export porte exactement ce que la figure montre.
    const meta = lignesProvenanceLabo(gacheesRetenues, axe, age).map((l) => "# " + l);
    const corps = lignesCsvNuage(nuage, axe);
    telechargerTexte(
      [...meta, "", ...corps.map((r) => r.map(celluleCsv).join(";"))].join("\r\n"),
      nomFichier(`labo-ucs-${axe}-${age}j`, "csv"),
    );
  }

  return (
    <>
      {/* Ce que la page MONTRE d'abord. Les précautions méthodologiques
          viennent après, et seulement quand il y a des mesures. */}
      <Bandeau ton="info">
        <strong>UCS</strong> = résistance en compression uniaxiale (essai ASTM C39/C39M) : on écrase une éprouvette, on note la charge
        à la rupture, et on la rapporte à la section du cylindre. Cette vue trace la résistance que vous avez{" "}
        <strong>mesurée</strong>, en fonction de l&apos;âge de cure ou du dosage du mélange. Pour les grandeurs{" "}
        <strong>calculées</strong> et leurs courbes de réponse, voir{" "}
        <Link href="/analyse" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>Analyse</Link>.
      </Bandeau>

      {donnees.length === 0 ? (
        <Carte titre="Aucune mesure UCS pour l'instant">
          <p className="labo-vide" style={{ margin: 0 }}>C&apos;est normal tant qu&apos;aucune éprouvette n&apos;a été écrasée. Pour remplir cette vue :</p>
          <ol className="labo-etapes">
            <li>vue <strong>Gâchées</strong> → <strong>Nouvelle gâchée</strong>, à partir d&apos;une formulation
              sauvegardée dans Calculs ;</li>
            <li>dans la gâchée, carte <strong>« Éprouvettes »</strong> → <strong>Ajouter des éprouvettes</strong> : un âge de cure
              et un nombre de réplicats ;</li>
            <li>le jour de l&apos;essai, cocher l&apos;éprouvette (<strong>« Marquer écrasée »</strong>) ;</li>
            <li>saisir <strong>« Charge à la rupture »</strong> et <strong>« Diamètre »</strong> —
              la résistance est calculée automatiquement.</li>
          </ol>
          <p className="labo-vide" style={{ margin: 0 }}>
            Si votre laboratoire fournit un classeur de presse, le bouton{" "}
            <strong>« Importer un fichier de presse »</strong> de la gâchée remplit ces essais sans
            ressaisie. <strong>La saisie à la main reste possible dans tous les cas</strong> — et
            les deux voies donnent le même résultat. Le graphique apparaît dès la première éprouvette écrasée.
          </p>
        </Carte>
      ) : (
        <>
          <Carte titre="Gâchées affichées" aside={`${visibles.length} sur ${donnees.length}`}
            actions={
              <span style={{ display: "flex", gap: 12 }}>
                <button type="button" className="btn-discret" onClick={() => setMasquees(new Set())}>Tout afficher</button>
                <button type="button" className="btn-discret" onClick={() => setMasquees(new Set(donnees.map((d) => d.g.id)))}>Tout masquer</button>
              </span>
            }>
            <div className="labo-series">
              {donnees.map((d) => (
                <label key={d.g.id} className="labo-serie">
                  <input type="checkbox" checked={!masquees.has(d.g.id)} onChange={() => basculer(d.g.id)} />
                  <span className="labo-serie-trait" style={{ background: couleurDe.get(d.g.id) }} />
                  <span style={{ color: masquees.has(d.g.id) ? "var(--texte-3)" : "var(--texte)" }}>{d.g.code}</span>
                </label>
              ))}
            </div>
            <p className="ui-liste-pied" style={{ margin: 0 }}>
              La couleur reste attachée à la gâchée : en masquer une ne change pas la couleur des autres.
              La palette compte {COULEURS_SERIE.length} couleurs et se répète au-delà — raison de plus pour
              n&apos;afficher que les gâchées qui vous intéressent.
            </p>
          </Carte>

          {visibles.length === 0 && (
            <Bandeau ton="alerte">Toutes les gâchées sont masquées : cochez-en au moins une ci-dessus.</Bandeau>
          )}

          <Carte titre={axe === "age" ? "UCS mesurée en fonction de l'âge de cure" : `UCS mesurée à ${age} j en fonction de ${metaAxe?.label ?? axe}`}>
            <div className="labo-axes">
              <Segmente
                ariaLabel="Abscisse"
                taille="compact"
                valeur={axe}
                onChange={setAxe}
                options={[{ valeur: "age" as const, libelle: "Âge de cure" }, ...AXES_FORMULATION.map((a) => ({ valeur: a.cle, libelle: a.label }))]}
              />
              {axe !== "age" && (
                <label className="labo-age-choix">
                  à l&apos;âge de
                  <select className="field-input" value={age} onChange={(e) => setAgeVoulu(Number(e.target.value))}>
                    {ages.map((a) => <option key={a} value={a}>{a} j</option>)}
                  </select>
                </label>
              )}
            </div>
            {axe !== "age" && (
              <p className="ui-liste-pied" style={{ margin: 0 }}>
                Un point par gâchée. Les points ne sont <strong>pas reliés</strong> : joindre deux gâchées
                suggérerait une tendance, qui n&apos;est pas mesurée.
              </p>
            )}
            {axe === "age" ? (
              <CourbeUCS series={series} />
            ) : (
              <>
                <CourbeUCS
                  series={seriesNuage}
                  relier={false}
                  ticksX="rondes"
                  xLabel={metaAxe ? libelleAvecUnite(metaAxe.label, metaAxe.unite) : axe}
                  formatX={(x) => x.toLocaleString("fr-CA", { maximumFractionDigits: 3 })}
                  messageVide={`Aucune gâchée ne porte à la fois une mesure à ${age} j et un paramètre de formulation connu.`}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={exporterCsvMesures} className="btn-contour">Export CSV (mesures)</button>
                </div>
                {nuage && nuage.ecartees.length > 0 && (
                  // Dire ce qui n'est PAS sur la figure : c'est ce qui sépare une
                  // figure défendable d'un graphe trompeur.
                  <div className="ui-liste-bloc">
                    <div className="ui-liste-titre" style={{ color: "var(--alerte-texte)" }}>Gâchées absentes de cette figure ({nuage.ecartees.length})</div>
                    <ul className="labo-etapes" style={{ fontSize: 13 }}>
                      {nuage.ecartees.map((e) => (
                        <li key={e.code}><strong>{e.code}</strong> — {e.raison}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Carte>

          {/* Les précautions méthodologiques, à leur place : SOUS la figure. */}
          <Bandeau ton="neutre">
            <strong>Comment lire ces graphiques.</strong> Les points sont les{" "}
            <strong>moyennes</strong> des éprouvettes retenues et les barres verticales valent ± un écart-type.
            Aucune valeur n&apos;est <strong>prédite ni modélisée</strong> — le programme ne dispose d&apos;aucun
            modèle de prédiction validé. Aucune <strong>droite d&apos;ajustement</strong> n&apos;est tracée et aucune
            valeur n&apos;est <strong>interpolée</strong> : seuls des âges réellement mesurés sont proposés.
            {nbMasquees > 0 && (
              <>
                {" "}<span style={{ color: "var(--alerte-texte)" }}>
                  {nbMasquees} gâchée{nbMasquees > 1 ? "s sont masquées" : " est masquée"} : les figures, la table
                  et l&apos;export ne portent que les gâchées cochées.
                </span>
              </>
            )}
          </Bandeau>

          <Carte titre="Détail des mesures">
            <div className="mix-tableau-defilant">
              <table className="result-table" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th>Gâchée</th>
                    <th>Cw</th>
                    <th>E/L</th>
                    <th>Bw</th>
                    <th>Âge</th>
                    <th>UCS moyenne (kPa)</th>
                    <th>± σ</th>
                    <th>n</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.flatMap((d) =>
                    d.ages.map((a, j) => (
                      <tr key={`${d.g.id}-${a.ageJours}`}>
                        <td style={{ fontWeight: j === 0 ? 600 : 400 }}>{j === 0 ? d.g.code : ""}</td>
                        <td>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.cwPct, " %") : ""}</td>
                        <td>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.wcRatio) : ""}</td>
                        <td>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.bwPct, " %") : ""}</td>
                        <td>{a.ageJours} j</td>
                        <td style={{ fontWeight: 600 }}>{Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")}</td>
                        <td>{a.ecartTypeKpa !== null ? Math.round(a.ecartTypeKpa).toLocaleString("fr-CA") : TIRET}</td>
                        <td>{a.n}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Carte>
        </>
      )}
    </>
  );
}
