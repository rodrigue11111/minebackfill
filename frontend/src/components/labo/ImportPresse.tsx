"use client";

import React from "react";
import { lireClasseurPresse } from "@/lib/presse-fichier";
import type { EssaiPresse, PointCourbe } from "@/lib/presse-urstm";
import type { Eprouvette, EssaiUCS } from "@/lib/eprouvette";

/**
 * Import d'un classeur de presse (URSTM) dans les éprouvettes d'une gâchée.
 *
 * Pourquoi : la presse calcule déjà la contrainte à la rupture, et
 * l'application demandait de ressaisir charge et diamètre pour la recalculer.
 * Vérifié sur un export réel — la presse applique sigma = F/A avec un moule de
 * 76,20 mm, et la formule de l'application redonne sa valeur au chiffre près.
 * La ressaisie était donc du travail en double, et un risque de transcription.
 *
 * L'affectation reste MANUELLE. Le fichier ne porte aucun identifiant
 * d'éprouvette : il a un numéro d'échantillon propre à la presse et un champ
 * de commentaires libre. Deviner la correspondance placerait une mesure sur
 * la mauvaise éprouvette sans que personne ne s'en aperçoive.
 */
export default function ImportPresse({ eprouvettes, onAppliquer }: {
  eprouvettes: Eprouvette[];
  onAppliquer: (affectations: { eprouvetteId: string; essai: Partial<EssaiUCS> }[]) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [essais, setEssais] = React.useState<EssaiPresse[] | null>(null);
  const [courbes, setCourbes] = React.useState<Map<string, PointCourbe[]>>(new Map());
  const [origine, setOrigine] = React.useState<Map<string, number>>(new Map());
  const [nomFichier, setNomFichier] = React.useState("");
  const [cible, setCible] = React.useState<Record<string, string>>({});
  const [garderCourbe, setGarderCourbe] = React.useState(true);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [occupe, setOccupe] = React.useState(false);

  async function choisir(f: File | undefined) {
    if (!f) return;
    setOccupe(true); setErreur(null);
    const r = await lireClasseurPresse(f);
    setOccupe(false);
    if (!r.ok) { setErreur(r.erreur); setEssais(null); return; }
    setNomFichier(f.name);
    setEssais(r.classeur.essais);
    setCourbes(r.classeur.courbes);
    setOrigine(r.classeur.pointsOrigine);
    // Pré-affectation : on propose les éprouvettes encore sans mesure, dans
    // l'ordre. C'est une SUGGESTION, pas une déduction — elle reste modifiable.
    const libres = eprouvettes.filter((e) => e.essai?.contrainteKpaSaisie === undefined && e.essai?.chargeKn === undefined);
    const pre: Record<string, string> = {};
    r.classeur.essais.forEach((e, i) => { pre[e.echantillon] = libres[i]?.id ?? ""; });
    setCible(pre);
  }

  function appliquer() {
    if (!essais) return;
    const vus = new Set<string>();
    const aff: { eprouvetteId: string; essai: Partial<EssaiUCS> }[] = [];
    for (const e of essais) {
      const id = cible[e.echantillon];
      if (!id || vus.has(id)) continue;
      vus.add(id);
      const courbe = garderCourbe ? courbes.get(e.echantillon) : undefined;
      aff.push({
        eprouvetteId: id,
        essai: {
          // La contrainte de la presse va dans le champ SAISI : contrainteKpa()
          // le préfère déjà au calcul F/A, donc rien à changer en aval.
          contrainteKpaSaisie: e.contrainteKpa ?? undefined,
          // La charge est convertie en kN, l'unité du formulaire.
          chargeKn: e.chargeN !== null ? e.chargeN / 1000 : undefined,
          hauteurMm: e.hauteurMm ?? undefined,
          date: e.dateEssai ?? undefined,
          moduleYoungKpa: e.moduleYoungKpa ?? undefined,
          deformationMaxPct: e.deformationMaxPct ?? undefined,
          tempsDeCureReelJours: e.tempsDeCureJours ?? undefined,
          sourcePresse: {
            fichier: nomFichier, echantillon: e.echantillon,
            importeLe: new Date().toISOString(),
            operateur: e.operateur || undefined,
            commentaires: e.commentaires || undefined,
          },
          ...(courbe && courbe.length > 0 ? { courbe } : {}),
        },
      });
    }
    onAppliquer(aff);
    setEssais(null); setCible({}); setNomFichier("");
  }

  const nbAffectes = essais ? new Set(Object.values(cible).filter(Boolean)).size : 0;
  const td: React.CSSProperties = { padding: "4px 6px", fontSize: 12, whiteSpace: "nowrap" };

  return (
    <div>
      <button type="button" className="btn-secondary" style={{ fontSize: 12 }}
        disabled={occupe || eprouvettes.length === 0}
        onClick={() => ref.current?.click()}
        title="Lit un classeur de presse et remplit les essais, sans ressaisie">
        {occupe ? "Lecture…" : "Importer un fichier de presse (.xlsx)"}
      </button>
      <input ref={ref} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={(e) => { void choisir(e.target.files?.[0]); e.target.value = ""; }} />

      {erreur && (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "#b91c1c" }}>{erreur}</p>
      )}

      {essais && (
        <div style={{ marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e3a8a", marginBottom: 8 }}>
            {essais.length} essai{essais.length > 1 ? "s" : ""} lu{essais.length > 1 ? "s" : ""} dans « {nomFichier} »
          </div>
          <p style={{ fontSize: 11.5, color: "#1e40af", margin: "0 0 10px", lineHeight: 1.5 }}>
            Le fichier ne porte aucun code d&apos;éprouvette : choisissez vous-même à quelle
            éprouvette chaque essai correspond. Les propositions ci-dessous ne sont qu&apos;un
            ordre de remplissage, pas une déduction.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569" }}>
                  <th style={td}>Échantillon</th>
                  <th style={td}>Contrainte</th>
                  <th style={td}>Module E</th>
                  <th style={td}>Cure réelle</th>
                  <th style={td}>Commentaire</th>
                  <th style={td}>Éprouvette</th>
                </tr>
              </thead>
              <tbody>
                {essais.map((e) => (
                  <tr key={e.echantillon} style={{ borderTop: "1px solid #dbeafe" }}>
                    <td style={td}>{e.echantillon}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {e.contrainteKpa !== null ? `${Math.round(e.contrainteKpa).toLocaleString("fr-CA")} kPa` : "—"}
                    </td>
                    <td style={td}>
                      {e.moduleYoungKpa !== null ? `${Math.round(e.moduleYoungKpa).toLocaleString("fr-CA")} kPa` : "—"}
                    </td>
                    <td style={td}>{e.tempsDeCureJours !== null ? `${e.tempsDeCureJours} j` : "—"}</td>
                    <td style={td}>{e.commentaires || "—"}</td>
                    <td style={td}>
                      <select value={cible[e.echantillon] ?? ""}
                        onChange={(ev) => setCible((c) => ({ ...c, [e.echantillon]: ev.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12, maxWidth: 190 }}>
                        <option value="">— ne pas importer —</option>
                        {eprouvettes.map((ep) => (
                          <option key={ep.id} value={ep.id}>
                            {ep.code} ({ep.ageJours} j){ep.essai?.contrainteKpaSaisie !== undefined || ep.essai?.chargeKn !== undefined ? " — déjà mesurée" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {courbes.size > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "#1e40af" }}>
              <input type="checkbox" checked={garderCourbe} onChange={(ev) => setGarderCourbe(ev.target.checked)} />
              Conserver la courbe contrainte-déformation
              <span style={{ color: "#475569" }}>
                ({[...courbes.entries()].map(([k, v]) => `${origine.get(k)?.toLocaleString("fr-CA")} points réduits à ${v.length}`).join(" · ")})
              </span>
            </label>
          )}
          <p style={{ fontSize: 11, color: "#475569", margin: "6px 0 0", lineHeight: 1.5 }}>
            La courbe complète pèse plusieurs mégaoctets : seule une sélection de points
            <strong> réellement mesurés</strong> est conservée, dont le point de contrainte maximale.
            Aucune valeur n&apos;est moyennée ni interpolée.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" style={{ fontSize: 12.5 }}
              disabled={nbAffectes === 0} onClick={appliquer}>
              Importer {nbAffectes} essai{nbAffectes > 1 ? "s" : ""}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }}
              onClick={() => { setEssais(null); setCible({}); }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
