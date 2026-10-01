// Gâchée d'un étudiant, INTÉGRALE et en lecture seule (vue enseignant).
// Aucune saisie : l'enseignant ne modifie jamais le travail d'un étudiant.

import type React from "react";
import { Carte, CarteProtocolesFiges } from "@/components/labo/Carte";
import { MODES_CURE, TYPES_EAU, parametresEffectifs, type Gachee } from "@/lib/gachee";
import { completudeGachee, listeManquants } from "@/lib/completude";
import Pesees from "@/components/labo/Pesees";
import {
  agregerParAge, ageReelJours, contrainteKpa, dateCoulee, dateEcheance, libelleMoule, libelleRupture, libelleVitesse,
} from "@/lib/eprouvette";
import { badgeEcheance, fmtDate } from "@/lib/echeance-affichage";
import { fmt, TIRET } from "@/lib/format";
import type { Recipe } from "@/lib/types";
import { nombre, Pastille, td, tdNum, th } from "./commun";

function Info({ label, valeur }: { label: string; valeur: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--texte-2)" }}>{label}</div>
      <div style={{ fontSize: 15, color: "var(--texte)", marginTop: 2 }}>{valeur ?? TIRET}</div>
    </div>
  );
}

/** Nombre court à la française (sans zéros inutiles). */
const court = (v: number, decimales: number) => v.toLocaleString("fr-CA", { maximumFractionDigits: decimales });
const grille: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 };
const TYPES_AJUSTEMENT: Record<string, string> = { eau: "Eau", residu: "Résidu", granulat: "Granulat", liant: "Liant" };

export default function GacheeLecture({ gachee: g, formulations, maintenant }: {
  gachee: Gachee;
  /** Résultats de CET étudiant (les ids de formulation ne valent que chez lui). */
  formulations: { id: string; recipes: Recipe[] }[];
  maintenant: Date;
}) {
  const p = parametresEffectifs(g, formulations);
  const parAge = agregerParAge(g.eprouvettes);
  const eprouvettes = [...g.eprouvettes].sort((a, b) => dateEcheance(a).getTime() - dateEcheance(b).getTime());
  const nbCourbes = g.eprouvettes.filter((e) => e.essai?.sourcePresse).length;
  const fiche = completudeGachee(g);
  const manquants = listeManquants(fiche);
  const m = g.materiaux;
  const residu = m?.residu
    ? [m.residu.nom, m.residu.gs != null ? `Gs ${court(m.residu.gs, 3)}` : null, m.residu.w0Pct != null ? `w₀ ${court(m.residu.w0Pct, 1)} %` : null]
      .filter(Boolean).join(" · ")
    : "";
  const liants = (m?.liants ?? [])
    .map((l) => `${l.nom ?? l.code ?? "Liant"}${l.fractionPct != null ? ` ${court(l.fractionPct, 1)} %` : ""}`).join(", ");
  const adjuvant = m?.adjuvant?.nom
    ? `${m.adjuvant.nom}${m.adjuvant.dosage != null ? ` (${court(m.adjuvant.dosage, 2)} ${m.adjuvant.dosageUnite ?? ""})`.replace(" )", ")") : ""}`
    : "";
  const eau = m?.eau?.type ? TYPES_EAU.find((t) => t.valeur === m.eau?.type)?.libelle : undefined;
  const cure = g.cure?.mode ? MODES_CURE.find((c) => c.valeur === g.cure?.mode)?.libelle : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Carte titre="Formulation">
        <div style={grille}>
          <Info label="Formulation" valeur={g.formulationLabel || TIRET} />
          <Info label="Catégorie" valeur={g.categorie} />
          <Info label="Recette" valeur={`R${(g.recetteIndex ?? 0) + 1}`} />
          <Info label="Cw (%)" valeur={nombre(p?.cwPct, 2)} />
          <Info label="E/L" valeur={nombre(p?.wcRatio, 3)} />
          <Info label="Bw (%)" valeur={nombre(p?.bwPct, 2)} />
          <Info label="w (%)" valeur={nombre(p?.wPct, 2)} />
          <Info label="Version des formules" valeur={g.solverVersion ?? TIRET} />
        </div>
        {!p && (
          <p style={{ fontSize: 12, color: "var(--alerte-texte)", margin: "10px 0 0" }}>
            Paramètres de formulation inconnus : la formulation d&apos;origine n&apos;est plus dans les résultats de l&apos;étudiant.
          </p>
        )}
      </Carte>

      <Pesees gachee={g} lectureSeule />

      <Carte titre="Matériaux et pâte fraîche" extra={<Pastille ton="gris" title="Champs descriptifs renseignés par l'étudiant (rien n'est obligatoire).">Fiche : {fiche.renseignes}/{fiche.total}</Pastille>}>
        <div style={grille}>
          <Info label="Résidu" valeur={residu || TIRET} />
          <Info label="Agent liant" valeur={liants || TIRET} />
          <Info label="Eau de gâchage" valeur={eau ?? TIRET} />
          <Info label="Adjuvant" valeur={adjuvant || TIRET} />
          <Info label="Lot de résidu" valeur={g.lotResidu || TIRET} />
          <Info label="Lot de granulat" valeur={g.lotGranulat || TIRET} />
          <Info label="Lot de liant" valeur={g.lotLiant || TIRET} />
          <Info label="w₀ mesuré (%)" valeur={nombre(g.w0MesurePct, 2)} />
          <Info label="Affaissement (mm)" valeur={nombre(g.slumpMesureMm, 0)} />
          <Info label="Température (°C)" valeur={nombre(g.temperatureC, 1)} />
          <Info label="w mesuré (%)" valeur={nombre(g.wMesurePct, 2)} />
          <Info label="Cw mesuré (%)" valeur={nombre(g.cwMesurePct, 2)} />
          <Info label="Durée de malaxage (min)" valeur={nombre(g.malaxageDureeMin, 0)} />
          <Info label="Mode de cure" valeur={cure ? `${cure}${g.cure?.note ? ` (${g.cure.note})` : ""}` : (g.cure?.note || TIRET)} />
          <Info label="Température de cure (°C)" valeur={nombre(g.cure?.temperatureC, 1)} />
          <Info label="Humidité de cure (%)" valeur={nombre(g.cure?.humiditePct, 0)} />
        </div>
        {manquants && (
          <p style={{ fontSize: 12, color: "var(--texte-2)", margin: "10px 0 0" }}>
            Non renseigné : {manquants}.
          </p>
        )}
      </Carte>

      <Carte titre="Ajustements (essai-erreur)">
        {g.ajustements.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--texte-3)", margin: 0 }}>Aucun ajustement.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Ajout</th><th style={{ ...th, textAlign: "right" }}>Masse (kg)</th><th style={th}>Note</th></tr></thead>
            <tbody>
              {g.ajustements.map((a) => (
                <tr key={a.id}><td style={td}>{TYPES_AJUSTEMENT[a.type] ?? a.type}</td><td style={tdNum}>{fmt(a.masseKg, 2)}</td><td style={td}>{a.note || TIRET}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Carte>

      <Carte titre={`Éprouvettes (${g.eprouvettes.length})`}>
        {eprouvettes.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--texte-3)", margin: 0 }}>Aucune éprouvette.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  {["Éprouvette", "Âge cible", "Coulée", "Échéance", "Essai", "Âge réel", "Charge (kN)", "Diam. (mm)", "Masse (g)", "Vitesse", "UCS (kPa)", "Rupture"].map((t, i) => (
                    <th key={t} style={i >= 5 && i <= 10 ? { ...th, textAlign: "right" } : th}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eprouvettes.map((e) => {
                  const b = badgeEcheance(e, maintenant);
                  const es = e.essai;
                  const ucs = e.statut === "ecrase" ? contrainteKpa(es) : null;
                  const reel = e.statut === "ecrase" ? ageReelJours(e) : null;
                  return (
                    <tr key={e.id}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {e.code}
                        {libelleMoule(e) && <div style={{ fontSize: 11, color: "var(--texte-3)", fontWeight: 400 }}>{libelleMoule(e)}</div>}
                      </td>
                      <td style={td}>{e.ageJours} j</td>
                      <td style={td}>{fmtDate(dateCoulee(e))}</td>
                      <td style={td}>{fmtDate(dateEcheance(e))}<div style={{ fontSize: 11.5, fontWeight: 700, color: b.couleur }}>{b.texte}</div></td>
                      <td style={td}>{es?.date ? fmtDate(new Date(es.date)) : TIRET}</td>
                      <td style={tdNum}>{reel === null ? TIRET : `${nombre(reel, 0)} j`}</td>
                      <td style={tdNum}>{nombre(es?.chargeKn, 2)}</td>
                      <td style={tdNum}>{nombre(es?.diametreMm, 1)}</td>
                      <td style={tdNum}>{nombre(es?.masseG, 1)}</td>
                      <td style={tdNum}>{libelleVitesse(es?.vitesseChargement) || TIRET}</td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>
                        {ucs === null ? TIRET : nombre(ucs, 0)}
                        {es?.exclu && <div><Pastille ton="ambre" title={es.justificationExclusion}>exclue</Pastille></div>}
                      </td>
                      <td style={td}>{libelleRupture(es) || TIRET}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {eprouvettes.some((e) => e.essai?.exclu || e.essai?.sourcePresse) && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--texte-2)", display: "flex", flexDirection: "column", gap: 3 }}>
                {eprouvettes.filter((e) => e.essai?.exclu).map((e) => (
                  <li key={`x-${e.id}`}><strong>{e.code}</strong> exclue de la moyenne : {e.essai?.justificationExclusion || "sans justification"}</li>
                ))}
                {eprouvettes.filter((e) => e.essai?.sourcePresse).map((e) => {
                  const es = e.essai!;
                  const src = es.sourcePresse!;
                  return (
                    <li key={`p-${e.id}`}>
                      <strong>{e.code}</strong> importée de la presse ({src.fichier}, échantillon {src.echantillon}
                      {src.operateur ? `, opérateur ${src.operateur}` : ""})
                      {es.moduleYoungKpa !== undefined && ` · E = ${nombre(es.moduleYoungKpa, 0)} kPa`}
                      {es.deformationMaxPct !== undefined && ` · déformation max ${nombre(es.deformationMaxPct, 2)} %`}
                      {es.deflexionMaxMm !== undefined && ` · déflexion max ${nombre(es.deflexionMaxMm, 2)} mm`}
                      {es.presse ? ` · presse ${es.presse}` : ""}
                      {es.tempsDeCureReelJours !== undefined && ` · cure réelle ${nombre(es.tempsDeCureReelJours, 0)} j`}
                      {src.commentaires ? ` · « ${src.commentaires} »` : ""}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {nbCourbes > 0 && (
          <p style={{ fontSize: 11.5, color: "var(--texte-3)", margin: "10px 0 0" }}>
            Les courbes contrainte-déformation restent sur l&apos;appareil de l&apos;étudiant : elles ne sont pas sauvegardées en ligne.
          </p>
        )}
      </Carte>

      <Carte titre="UCS par âge (moyenne des essais retenus)">
        {parAge.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--texte-3)", margin: 0 }}>Aucun essai exploitable.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Âge", "n", "Moyenne (kPa)", "± écart-type", "CV", "Exclues"].map((t, i) => <th key={t} style={i > 0 ? { ...th, textAlign: "right" } : th}>{t}</th>)}</tr></thead>
            <tbody>
              {parAge.map((a) => (
                <tr key={a.ageJours}>
                  <td style={td}>{a.ageJours} j</td>
                  <td style={tdNum}>{a.n}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{nombre(a.moyenneKpa, 0)}</td>
                  <td style={tdNum}>{nombre(a.ecartTypeKpa, 0)}</td>
                  <td style={tdNum}>{a.cvPct === null ? TIRET : `${nombre(a.cvPct, 1)} %`}</td>
                  <td style={tdNum}>{a.nExclus || TIRET}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Carte>

      <CarteProtocolesFiges snapshot={g.protocolesSnapshot} />

      {g.observations && (
        <Carte titre="Observations">
          <p style={{ fontSize: 13, color: "var(--texte)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{g.observations}</p>
        </Carte>
      )}
    </div>
  );
}
