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
 * Cw ne bouge pas — c'est une ENTRÉE de la méthode Cw%, et le balayage ne
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
    textAlign: "right", padding: "4px 6px", fontWeight: 600, color: "#475569",
    borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { textAlign: "right", padding: "3px 6px", whiteSpace: "nowrap" };

  return (
    <div className="panneau-variation" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(320px, 2fr)", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
          Tenu fixe pendant le balayage
        </div>
        <p style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5, margin: "0 0 8px" }}>
          Cw, Sr, Bw et Am sont des <strong>entrées</strong> de la méthode Cw&nbsp;% :
          le balayage ne remplace que le paramètre choisi, les autres gardent la
          valeur de la recette de base.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {fixe.map((l) => (
              <tr key={l.label}>
                <td style={{ padding: "3px 6px", color: "#64748b" }}>{l.label}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{l.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
          Ce qui varie sur la plage
        </div>
        <p style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5, margin: "0 0 8px" }}>
          Toutes les grandeurs calculées, cochées ou non. Δ est l&apos;écart brut entre
          le premier et le dernier point ; aucune grandeur n&apos;est normalisée ni classée.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
                <td style={{ padding: "3px 6px", color: meta.couleur, fontWeight: 600 }}>{meta.label}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                  {vRef !== null && vRef !== undefined && Number.isFinite(vRef) ? fmt(vRef, meta.unite) : "—"}
                </td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{fmt(stats.min, meta.unite)}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{fmt(stats.max, meta.unite)}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0f172a" }}>
                  {fmt(stats.variation, meta.unite)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {iRef === null && (
          <p style={{ fontSize: 11, color: "#b45309", margin: "8px 0 0" }}>
            La valeur de la recette de base est hors de la plage balayée : la colonne
            « à la référence » reste vide plutôt que d&apos;afficher un point arbitraire.
          </p>
        )}
      </div>
    </div>
  );
}
