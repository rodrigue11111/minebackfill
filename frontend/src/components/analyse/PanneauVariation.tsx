"use client";

import React from "react";
import { statsSerie, indexProche } from "@/lib/courbe-analyse";
import { sortiesPour, type CategorieAnalyse } from "@/lib/analyse-series";
import { tenuFixe, type ParamCle } from "@/lib/analyse-fixe";
import type { InstantaneAnalyse } from "@/lib/analyse-instantane";

/**
 * « Ce qui est tenu fixe » / « Ce qui varie sur la plage ».
 *
 * Répond à la question que la page laissait sans réponse : en balayant Bw,
 * Cw ne bouge pas — c'est une ENTRÉE du dosage selon Cw, et le balayage ne
 * remplace que le paramètre choisi. Ce qui change, c'est la répartition
 * résidu/liant.
 *
 * Le tableau de droite couvre TOUTES les grandeurs de la catégorie, pas
 * seulement celles qui sont cochées : le backend les renvoie déjà toutes à
 * chaque appel, et c'est précisément la grandeur qu'on n'a pas pensé à cocher
 * qui renseigne.
 *
 * Parti pris, à ne pas « améliorer » : aucun classement par sensibilité,
 * aucune coloration, aucun seuil du type « constant si Δ < 1 % ». Tout cela
 * exigerait une normalisation ou une dérivée adimensionnelle, c'est-à-dire une
 * formule nouvelle déguisée en affichage. On affiche Δ brut, dans l'ordre de
 * SORTIES, et on laisse les nombres parler.
 */
export default function PanneauVariation({
  instantane, param, categorie, x, series, reference, fmt,
}: {
  instantane: InstantaneAnalyse;
  param: ParamCle;
  categorie: CategorieAnalyse;
  x: number[];
  /** Toutes les séries renvoyées par le backend, clé -> valeurs. */
  series: Record<string, (number | null)[]>;
  /** Valeur du paramètre pour la recette de base, si elle est dans la plage. */
  reference?: number;
  fmt: (v: number, unite: string) => string;
}) {
  const fixe = tenuFixe(instantane, param);
  const iRef = reference !== undefined && x.length ? indexProche(x, reference) : null;

  const lignes = sortiesPour(categorie).map((meta) => {
    const valeurs = series[meta.cle];
    if (!valeurs) return null;
    const s = statsSerie(x, valeurs);
    if (!s) return null;
    const vRef = iRef !== null ? valeurs[iRef] : null;
    return { meta, stats: s, vRef };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  const th: React.CSSProperties = {
    textAlign: "right", padding: "4px 6px", fontWeight: 500, color: "var(--texte-2)",
    borderBottom: "1px solid var(--filet-fort)", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { textAlign: "right", padding: "4px 6px", whiteSpace: "nowrap", borderTop: "1px solid var(--filet)" };

  return (
    <div className="analyse-variation">
      <div>
        <div className="analyse-figure-titre" style={{ marginBottom: 6 }}>
          Tenu fixe pendant le balayage
        </div>
        <p className="ui-champ-aide" style={{ margin: "0 0 8px" }}>
          Cw, Sr, Bw et Am sont des <strong>entrées</strong> de la méthode Cw&nbsp;% :
          le balayage ne remplace que le paramètre choisi, les autres gardent la
          valeur de la recette de base.
        </p>
        <div className="mix-tableau-defilant">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {fixe.map((l) => (
              <tr key={l.label}>
                <td style={{ padding: "4px 6px", color: "var(--texte-2)", borderTop: "1px solid var(--filet)" }}>{l.label}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: "var(--texte)" }}>{l.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div>
        <div className="analyse-figure-titre" style={{ marginBottom: 6 }}>
          Ce qui varie sur la plage
        </div>
        <p className="ui-champ-aide" style={{ margin: "0 0 8px" }}>
          Toutes les grandeurs calculées, cochées ou non. Δ est l&apos;écart brut entre
          le premier et le dernier point ; aucune grandeur n&apos;est normalisée ni classée.
        </p>
        <div className="mix-tableau-defilant">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Grandeur</th>
              <th style={th}>À la référence</th>
              <th style={th}>min</th>
              <th style={th}>max</th>
              <th style={th}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ meta, stats, vRef }) => (
              <tr key={meta.cle}>
                <td style={{ padding: "4px 6px", color: meta.couleur, fontWeight: 600, borderTop: "1px solid var(--filet)" }}>{meta.label}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                  {vRef !== null && vRef !== undefined && Number.isFinite(vRef) ? fmt(vRef, meta.unite) : "—"}
                </td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{fmt(stats.min, meta.unite)}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{fmt(stats.max, meta.unite)}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--texte)" }}>
                  {fmt(stats.variation, meta.unite)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {iRef === null && (
          <p style={{ fontSize: 12.5, color: "var(--alerte-texte)", margin: "8px 0 0" }}>
            La valeur de la recette de base est hors de la plage balayée : la colonne
            « à la référence » reste vide plutôt que d&apos;afficher un point arbitraire.
          </p>
        )}
      </div>
    </div>
  );
}
