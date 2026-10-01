// Onglet « Comparaison » : les étudiants qui ont gâché la même formulation,
// une ligne par gâchée. La médiane n'est qu'un repère de dispersion
// (voir lib/classe-comparaison.ts).

import { useState } from "react";
import { libelleGroupe, MIN_GACHEES_REPERE, type Comparaison, type GroupeComparaison } from "@/lib/classe-comparaison";
import { SEUILS_ALERTES } from "@/lib/classe-alertes";
import { dateCourte, lienBouton, nombre, td, tdNum, th, type RefDoc } from "./commun";
import { Carte } from "@/components/ui/Carte";
import { TIRET } from "@/lib/format";

function CarteGroupe({ groupe, onOuvrir }: { groupe: GroupeComparaison; onOuvrir: (ref: RefDoc) => void }) {
  const ages = groupe.parAge.map((a) => a.ageJours);
  const defaut = ages.includes(28) ? 28 : ages[ages.length - 1];
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : defaut;
  const bloc = groupe.parAge.find((a) => a.ageJours === age);

  return (
    <Carte titre={libelleGroupe(groupe)} aside={`${groupe.nbGachees} gâchées de ${groupe.nbEtudiants} étudiants`}
      actions={ages.length > 0 ? (
        <label className="ui-filtre">
          Âge
          <select value={age} onChange={(e) => setAgeVoulu(Number(e.target.value))} className="ui-pilule-select">
            {ages.map((x) => <option key={x} value={x}>{x} j</option>)}
          </select>
        </label>
      ) : undefined}>
      {!bloc ? (
        <p className="classe-rien">Aucun essai valide dans ce groupe pour l&apos;instant.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                {["Étudiant", "Gâchée", "Date", "Cw (%)", "Bw (%)", "E/L", "UCS (kPa)", "± écart-type", "n", "CV", "Écart à la médiane"].map((t, i) => (
                  <th key={t} style={i >= 3 ? { ...th, textAlign: "right" } : th}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloc.lignes.map((l) => (
                <tr key={l.gacheeId}>
                  <td style={{ ...td, fontWeight: 600 }}>{l.etudiant}</td>
                  <td style={td}>
                    <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: l.etudiantId, kind: "gachee", id: l.gacheeId })}>{l.gacheeCode}</button>
                  </td>
                  <td style={td}>{dateCourte(l.creeLe)}</td>
                  <td style={tdNum}>{nombre(l.cwPct, 2)}</td>
                  <td style={tdNum}>{nombre(l.bwPct, 2)}</td>
                  <td style={tdNum}>{nombre(l.wcRatio, 2)}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{nombre(l.moyenneKpa, 0)}</td>
                  <td style={tdNum}>{nombre(l.ecartTypeKpa, 0)}</td>
                  <td style={tdNum}>{l.n}{l.nExclus > 0 && <span style={{ color: "var(--texte-3)" }}> (+{l.nExclus} exclue{l.nExclus > 1 ? "s" : ""})</span>}</td>
                  <td style={tdNum}>{l.cvPct === null ? TIRET : `${nombre(l.cvPct, 1)} %`}</td>
                  <td style={{ ...tdNum, color: l.ecartMedianePct === null ? "var(--texte-3)" : Math.abs(l.ecartMedianePct) > SEUILS_ALERTES.ecartMedianePct ? "var(--hors-tolerance-texte)" : "var(--texte)" }}>
                    {l.ecartMedianePct === null ? TIRET : `${l.ecartMedianePct > 0 ? "+" : ""}${nombre(l.ecartMedianePct, 0)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="classe-intro" style={{ marginTop: 10 }}>
            {bloc.repere
              ? <>Repère de dispersion à {bloc.ageJours} j : médiane {nombre(bloc.repere.medianeKpa, 0)} kPa, étendue de {nombre(bloc.repere.minKpa, 0)} à {nombre(bloc.repere.maxKpa, 0)} kPa ({bloc.repere.nGachees} gâchées).</>
              : <>Moins de {MIN_GACHEES_REPERE} gâchées à cet âge : pas de repère de dispersion.</>}
          </p>
        </div>
      )}
    </Carte>
  );
}

export default function OngletComparaison({ comparaison, onOuvrir }: { comparaison: Comparaison; onOuvrir: (ref: RefDoc) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className="classe-intro">
        Même formulation = même catégorie, avec Cw et Bw arrondis au demi-point. Chaque ligne est une gâchée :
        aucune moyenne n&apos;est faite entre gâchées (lots, opérateurs et protocoles différents). La médiane,
        à partir de {MIN_GACHEES_REPERE} gâchées, est un <strong>repère de dispersion entre opérateurs</strong>,
        pas l&apos;UCS de la formulation. Seuls les essais valides comptent ; copies de conflit exclues.
      </p>
      {comparaison.groupes.length === 0 ? (
        <Carte>
          <p className="classe-rien">
            Aucune formulation n&apos;a encore été gâchée par au moins deux étudiants.
          </p>
        </Carte>
      ) : comparaison.groupes.map((g) => <CarteGroupe key={g.cle} groupe={g} onOuvrir={onOuvrir} />)}
      {comparaison.sansParametres.length > 0 && (
        <details className="classe-seuils">
          <summary style={{ cursor: "pointer" }}>{comparaison.sansParametres.length} gâchée(s) sans Cw ou Bw connu, non classée(s)</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {comparaison.sansParametres.map((x) => <li key={`${x.etudiantId}:${x.gacheeId}`}>{x.etudiant}, {x.code}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
