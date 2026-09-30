// Onglet « Comparaison » : les étudiants qui ont gâché la même formulation,
// une ligne par gâchée. La médiane n'est qu'un repère de dispersion
// (voir lib/classe-comparaison.ts).

import { useState } from "react";
import { libelleGroupe, MIN_GACHEES_REPERE, type Comparaison, type GroupeComparaison } from "@/lib/classe-comparaison";
import { SEUILS_ALERTES } from "@/lib/classe-alertes";
import { dateCourte, lienBouton, nombre, td, tdNum, th, type RefDoc } from "./commun";

function CarteGroupe({ groupe, onOuvrir }: { groupe: GroupeComparaison; onOuvrir: (ref: RefDoc) => void }) {
  const ages = groupe.parAge.map((a) => a.ageJours);
  const defaut = ages.includes(28) ? 28 : ages[ages.length - 1];
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : defaut;
  const bloc = groupe.parAge.find((a) => a.ageJours === age);

  return (
    <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{libelleGroupe(groupe)}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{groupe.nbGachees} gâchées de {groupe.nbEtudiants} étudiants</div>
        </div>
        {ages.length > 0 && (
          <label style={{ fontSize: 12.5, color: "#475569" }}>
            Âge :{" "}
            <select value={age} onChange={(e) => setAgeVoulu(Number(e.target.value))}
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5 }}>
              {ages.map((x) => <option key={x} value={x}>{x} j</option>)}
            </select>
          </label>
        )}
      </div>
      {!bloc ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", padding: "12px 16px", margin: 0 }}>Aucun essai valide dans ce groupe pour l&apos;instant.</p>
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
                  <td style={tdNum}>{l.n}{l.nExclus > 0 && <span style={{ color: "#94a3b8" }}> (+{l.nExclus} exclue{l.nExclus > 1 ? "s" : ""})</span>}</td>
                  <td style={tdNum}>{l.cvPct === null ? "—" : `${nombre(l.cvPct, 1)} %`}</td>
                  <td style={{ ...tdNum, color: l.ecartMedianePct === null ? "#cbd5e1" : Math.abs(l.ecartMedianePct) > SEUILS_ALERTES.ecartMedianePct ? "#dc2626" : "#334155" }}>
                    {l.ecartMedianePct === null ? "—" : `${l.ecartMedianePct > 0 ? "+" : ""}${nombre(l.ecartMedianePct, 0)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0, padding: "10px 16px" }}>
            {bloc.repere
              ? <>Repère de dispersion à {bloc.ageJours} j : médiane {nombre(bloc.repere.medianeKpa, 0)} kPa, étendue {nombre(bloc.repere.minKpa, 0)} – {nombre(bloc.repere.maxKpa, 0)} kPa ({bloc.repere.nGachees} gâchées).</>
              : <>Moins de {MIN_GACHEES_REPERE} gâchées à cet âge : pas de repère de dispersion.</>}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OngletComparaison({ comparaison, onOuvrir }: { comparaison: Comparaison; onOuvrir: (ref: RefDoc) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.55, maxWidth: 820 }}>
        Même formulation = même catégorie, avec Cw et Bw arrondis au demi-point. Chaque ligne est une gâchée :
        aucune moyenne n&apos;est faite entre gâchées (lots, opérateurs et protocoles différents). La médiane,
        à partir de {MIN_GACHEES_REPERE} gâchées, est un <strong>repère de dispersion entre opérateurs</strong>,
        pas l&apos;UCS de la formulation. Seuls les essais valides comptent ; copies de conflit exclues.
      </p>
      {comparaison.groupes.length === 0 ? (
        <div className="form-card">
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Aucune formulation n&apos;a encore été gâchée par au moins deux étudiants.
          </p>
        </div>
      ) : comparaison.groupes.map((g) => <CarteGroupe key={g.cle} groupe={g} onOuvrir={onOuvrir} />)}
      {comparaison.sansParametres.length > 0 && (
        <details style={{ fontSize: 12.5, color: "#475569" }}>
          <summary style={{ cursor: "pointer" }}>{comparaison.sansParametres.length} gâchée(s) sans Cw ou Bw connu, non classée(s)</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {comparaison.sansParametres.map((x) => <li key={`${x.etudiantId}:${x.gacheeId}`}>{x.etudiant} — {x.code}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
