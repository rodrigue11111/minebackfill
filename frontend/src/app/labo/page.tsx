"use client";

// Onglet « Labo » — gâchées RÉELLES. Chaque gâchée part d'une formulation
// sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a vraiment été fait :
// masses cibles vs pesées (écart kg/%), lots, humidité mesurée, mesures fraîches
// (slump, température, w, Cw — persistées) et ajustements de l'essai-erreur.
// Auto-sauvegarde : chaque saisie est persistée immédiatement (localStorage).

import React, { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import FiltreSession from "@/components/FiltreSession";
import { correspond, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import { useHydrated } from "@/lib/use-hydrated";
import { fmt } from "@/lib/format";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import {
  ecart, nbHorsTolerance, genererCode, composantsDepuisRecette, parametresDepuisRecette,
  parametresEffectifs,
  type Gachee, type Ajustement,
} from "@/lib/gachee";
import {
  AXES_FORMULATION, axeMeta, agesDisponibles, nuageUcs, lignesCsvNuage, lignesProvenanceLabo,
  type AxeFormulation,
} from "@/lib/ucs-formulation";
import { telechargerTexte, celluleCsv, nomFichier } from "@/lib/export-fig";
import type { Recipe } from "@/lib/types";
import {
  AGES_CURE_DEFAUT, dateCoulee, dateEcheance, classeEcheance,
  genererCodeEprouvette, construireIcs, etiquettesHtml,
  contrainteKpa, agregerParAge,
  type Eprouvette, type EssaiUCS, type EvenementIcs, type EtiquetteEprouvette,
} from "@/lib/eprouvette";
import { snapshotProtocoles, type Protocole } from "@/lib/protocole";
import { Carte, CarteProtocolesFiges } from "@/components/labo/Carte";
import { badgeEcheance, fmtDate } from "@/lib/echeance-affichage";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import CourbeUCS, { type SerieUCS } from "@/components/labo/CourbeUCS";
import ImportPresse from "@/components/labo/ImportPresse";
import AnnotationsDoc from "@/components/AnnotationsDoc";
import { courbesAOublier, idsCourbes, nbPointsCourbe } from "@/lib/courbes";
import { enregistrerCourbes, oublierCourbes } from "@/lib/courbes-client";

const inputStyle: React.CSSProperties = {
  width: "100%", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 11px",
  background: "#fff", fontSize: 14, outline: "none",
};

/**
 * Champ numérique robuste. Pendant la frappe, on affiche la chaîne RÉELLEMENT
 * saisie (brouillon local) au lieu de la re-dériver du nombre stocké : sans
 * cela, « 12,05 » ou « 0,5 » se feraient tronquer, car la persistance immédiate
 * (auto-sauvegarde) force un re-render qui réécrit la valeur normalisée. Hors
 * frappe, on affiche la valeur canonique. Accepte la virgule décimale.
 * onChange reçoit `undefined` quand le champ est vidé (le 0 n'est plus imposé).
 */
function NumInput({
  value, onChange, style, placeholder,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon !== null ? brouillon : value ?? "";
  return (
    <input
      type="text"
      inputMode="decimal"
      style={style}
      placeholder={placeholder}
      value={affiche}
      onFocus={() => setBrouillon(value === undefined ? "" : String(value))}
      onBlur={() => setBrouillon(null)}
      onChange={(e) => {
        const brut = e.target.value;
        setBrouillon(brut);
        const t = brut.trim().replace(/\s/g, "").replace(",", ".");
        if (t === "") { onChange(undefined); return; }
        const n = Number(t);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function Champ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function nouvelId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** ISO -> valeur d'un <input type="date"> (AAAA-MM-JJ, date LOCALE). */
function isoVersDateInput(iso: string): string {
  return fmtDate(new Date(iso));
}

/** ISO au midi LOCAL d'un jour (évite tout décalage de date fuseau/heure d'été). */
function isoJourMidi(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
}

/** Déclenche le téléchargement d'un fichier texte (sans dépendance). */
function telecharger(nom: string, type: string, contenu: string): void {
  const blob = new Blob([contenu], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Imprime un document HTML autonome via une iframe hors-écran (isole les styles). */
function imprimerHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Hors-écran mais de taille NON nulle : certains moteurs ignorent l'impression
  // d'une iframe 0 × 0 (format ~A4 à 96 dpi).
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(iframe);
  const w = iframe.contentWindow;
  const doc = w?.document;
  if (!w || !doc) { iframe.remove(); return; }
  let retire = false;
  const nettoyer = () => {
    if (retire) return;
    retire = true;
    setTimeout(() => iframe.remove(), 300);
  };
  w.onafterprint = nettoyer;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch { nettoyer(); }
    // Filet de sécurité : retire l'iframe même si onafterprint ne se déclenche
    // pas (Safari iOS, certains webviews) — sinon fuite DOM à chaque impression.
    setTimeout(nettoyer, 60_000);
  }, 200);
}

/** Saisie de l'essai UCS d'une éprouvette écrasée (contrainte mesurée). */
function FormEssaiUCS({ eprouvette, onChange }: {
  eprouvette: Eprouvette;
  onChange: (patch: Partial<EssaiUCS>) => void;
}) {
  const es = eprouvette.essai ?? {};
  const calculee = contrainteKpa({ chargeKn: es.chargeKn, diametreMm: es.diametreMm });
  const retenue = contrainteKpa(es);
  // Une contrainte directe renseignee l'emporte sur F/A (voir contrainteKpa).
  const directePrime = es.contrainteKpaSaisie != null && es.contrainteKpaSaisie > 0;
  // Ecart entre les deux voies, pour que l'etudiant VOIE si elles concordent.
  // Simple difference relative affichee : aucun modele, aucune correction.
  const ecartPct = directePrime && calculee !== null && calculee > 0
    ? ((es.contrainteKpaSaisie! - calculee) / calculee) * 100
    : null;
  return (
    <div style={{ marginTop: 8, padding: "12px 12px 4px", background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 8, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <Champ label="Date d'essai">
          <input type="date" style={inputStyle} value={es.date ? isoVersDateInput(es.date) : ""}
            onChange={(e) => onChange({ date: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })} />
        </Champ>
        <Champ label="Charge à la rupture (kN)"><NumInput style={inputStyle} value={es.chargeKn} onChange={(n) => onChange({ chargeKn: n })} /></Champ>
        <Champ label="Diamètre (mm)"><NumInput style={inputStyle} value={es.diametreMm} onChange={(n) => onChange({ diametreMm: n })} /></Champ>
        <Champ label="Mode de rupture (optionnel)"><input style={inputStyle} placeholder="ex. cône" value={es.modeRupture ?? ""} onChange={(e) => onChange({ modeRupture: e.target.value || undefined })} /></Champ>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <Champ label="ou contrainte mesurée directe (kPa)" hint="Si la presse donne directement la contrainte (prioritaire sur le calcul).">
          <NumInput style={{ ...inputStyle, maxWidth: 200 }} value={es.contrainteKpaSaisie} onChange={(n) => onChange({ contrainteKpaSaisie: n })} />
        </Champ>
        <div style={{ fontSize: 13, color: "#334155", paddingBottom: 9 }}>
          {retenue !== null ? (
            <>UCS retenue : <strong style={{ fontSize: 15, color: "#0f172a" }}>{Math.round(retenue).toLocaleString("fr-CA")} kPa</strong>
              {es.contrainteKpaSaisie != null && es.contrainteKpaSaisie > 0 ? " (saisie directe)" : calculee !== null ? " (déduite de F / A)" : ""}</>
          ) : <span style={{ color: "#64748b" }}>Saisis une charge + un diamètre, ou une contrainte directe.</span>}
        </div>
      </div>

      {directePrime && (
        // Sans ce bloc, modifier la charge ou le diametre apres un import
        // n'aurait AUCUN effet visible : la contrainte directe prime sur le
        // calcul F/A. Le champ accepterait la saisie et l'ecran resterait fige
        // — le genre de silence qui fait croire a une panne.
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 7, padding: "8px 11px", fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          La <strong>contrainte directe prime</strong> : modifier la charge ou le diamètre ne changera
          pas l&apos;UCS retenue tant qu&apos;elle est renseignée.
          {calculee !== null && (
            <>
              {" "}Votre calcul F / A donnerait{" "}
              <strong>{Math.round(calculee).toLocaleString("fr-CA")} kPa</strong>
              {ecartPct !== null && (
                <> — soit un écart de <strong>{ecartPct.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} %</strong>
                  {Math.abs(ecartPct) < 0.5 ? " (les deux concordent)" : ""}</>
              )}.
            </>
          )}
          <div style={{ marginTop: 6 }}>
            <button type="button" className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 10px" }}
              onClick={() => onChange({ contrainteKpaSaisie: undefined })}>
              Effacer la contrainte directe et revenir au calcul F / A
            </button>
          </div>
        </div>
      )}

      {es.sourcePresse && (
        // Ce que la presse apporte en plus de la contrainte, et qui était
        // perdu avant l'import : module de Young, déformation maximale, et
        // le temps de cure REEL (à distinguer de l'âge cible, sur lequel les
        // moyennes sont faites).
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "8px 11px", fontSize: 12, color: "#1e3a8a", lineHeight: 1.7 }}>
          <strong>Importé de la presse</strong> — fichier « {es.sourcePresse.fichier} », échantillon {es.sourcePresse.echantillon}
          {es.sourcePresse.operateur ? `, opérateur ${es.sourcePresse.operateur}` : ""}
          {es.sourcePresse.commentaires ? `, commentaire « ${es.sourcePresse.commentaires} »` : ""}.
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 18px", marginTop: 4, color: "#1e40af" }}>
            {es.moduleYoungKpa !== undefined && (
              <span>Module de Young : <strong>{Math.round(es.moduleYoungKpa).toLocaleString("fr-CA")} kPa</strong></span>
            )}
            {es.deformationMaxPct !== undefined && (
              <span>Déformation max : <strong>{es.deformationMaxPct.toLocaleString("fr-CA", { maximumFractionDigits: 3 })} %</strong></span>
            )}
            {es.tempsDeCureReelJours !== undefined && (
              <span>
                Cure réelle : <strong>{es.tempsDeCureReelJours} j</strong>
                {es.tempsDeCureReelJours !== eprouvette.ageJours && (
                  <span style={{ color: "#b45309" }}> (âge cible {eprouvette.ageJours} j — les moyennes suivent la cible)</span>
                )}
              </span>
            )}
            {nbPointsCourbe(es) > 0 && (
              <span>Courbe conservée : <strong>{nbPointsCourbe(es)} points</strong></span>
            )}
          </div>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#374151", cursor: "pointer" }}>
        <input type="checkbox" checked={!!es.exclu} onChange={(e) => onChange({ exclu: e.target.checked || undefined })} />
        Exclure cette éprouvette de la moyenne (valeur aberrante)
      </label>
      {es.exclu && (
        <div>
          <Champ label="Justification de l'exclusion (obligatoire)">
            <input style={{ ...inputStyle, borderColor: es.justificationExclusion ? "#cbd5e1" : "#f59e0b" }}
              placeholder="ex. défaut de surfaçage, rupture prématurée sur bulle…"
              value={es.justificationExclusion ?? ""} onChange={(e) => onChange({ justificationExclusion: e.target.value || undefined })} />
          </Champ>
          {!es.justificationExclusion && (
            <p style={{ fontSize: 11.5, color: "#b45309", marginTop: 4 }}>
              Exclusion non documentée : la valeur est déjà écartée de la moyenne, mais indique pourquoi (rigueur scientifique).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Carte « Éprouvettes » de l'éditeur d'une gâchée (mise en cure, écrasement). */
function CarteEprouvettes({ gachee, maintenant, onChange }: {
  gachee: Gachee;
  maintenant: Date;
  onChange: (eprouvettes: Eprouvette[]) => void;
}) {
  const [couleLe, setCouleLe] = useState(() => isoVersDateInput(gachee.creeLe));
  const [age, setAge] = useState<number | undefined>(28);
  const [nb, setNb] = useState<number | undefined>(1);
  const [moule, setMoule] = useState("");

  const eprouvettes = [...gachee.eprouvettes].sort(
    (a, b) => dateEcheance(a).getTime() - dateEcheance(b).getTime(),
  );

  const ajouter = () => {
    const n = Math.max(1, Math.round(nb ?? 1));
    const a = Math.max(0, Math.round(age ?? 0));
    // Coulée à midi LOCAL : évite tout décalage de jour (fuseau/heure d'été).
    const iso = couleLe ? new Date(`${couleLe}T12:00:00`).toISOString() : gachee.creeLe;
    const nouvelles: Eprouvette[] = [];
    for (let i = 0; i < n; i++) {
      const code = genererCodeEprouvette(gachee.code, [...gachee.eprouvettes, ...nouvelles]);
      nouvelles.push({ id: nouvelId(), code, couleLe: iso, ageJours: a, moule: moule.trim() || undefined, statut: "en_cure" });
    }
    onChange([...gachee.eprouvettes, ...nouvelles]);
  };

  const majEprouvette = (id: string, patch: Partial<Eprouvette>) =>
    onChange(gachee.eprouvettes.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const majEssai = (id: string, patch: Partial<EssaiUCS>) =>
    onChange(gachee.eprouvettes.map((e) => (e.id === id ? { ...e, essai: { ...(e.essai ?? {}), ...patch } } : e)));
  const retirer = (id: string) => {
    onChange(gachee.eprouvettes.filter((e) => e.id !== id));
    oublierCourbes(courbesAOublier([id], useStore.getState().gachees.filter((x) => x.id !== gachee.id)));
  };

  // Bascule cure <-> écrasée : à l'écrasement, on initialise la date d'essai au jour même.
  const basculerStatut = (e: Eprouvette) =>
    majEprouvette(e.id, e.statut === "ecrase"
      ? { statut: "en_cure" }
      : { statut: "ecrase", essai: { date: isoJourMidi(new Date()), ...(e.essai ?? {}) } });

  const agr = agregerParAge(gachee.eprouvettes);

  const imprimer = () => {
    if (gachee.eprouvettes.length === 0) return;
    const etiquettes: EtiquetteEprouvette[] = eprouvettes.map((e) => ({
      codeEprouvette: e.code, codeGachee: gachee.code,
      formulation: gachee.formulationLabel, categorie: gachee.categorie,
      couleLe: fmtDate(dateCoulee(e)), echeance: fmtDate(dateEcheance(e)),
      ageJours: e.ageJours, moule: e.moule,
    }));
    imprimerHtml(etiquettesHtml(etiquettes, `Étiquettes — gâchée ${gachee.code}`));
  };

  return (
    <Carte titre="Éprouvettes (cure et écrasement)" extra={
      gachee.eprouvettes.length > 0
        ? <button type="button" onClick={imprimer} className="btn-secondary" style={{ fontSize: 12 }}>Imprimer les étiquettes</button>
        : undefined
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {gachee.eprouvettes.length > 0 && (
          <ImportPresse
            eprouvettes={gachee.eprouvettes}
            onAppliquer={async (affectations) => {
              // Les courbes vont D'ABORD dans IndexedDB ; l'éprouvette n'en
              // garde qu'une référence. Si l'enregistrement échoue (ou si le
              // navigateur n'a pas IndexedDB), la courbe reste dans la gâchée,
              // comme avant : aucune perte.
              const enregistrees = await enregistrerCourbes(
                affectations.filter((a) => a.essai.courbe?.length).map((a) => [a.eprouvetteId, a.essai.courbe!]));
              // Un seul onChange pour toutes les affectations : appeler
              // majEssai en boucle repartirait de l'état d'avant et
              // n'en garderait que la dernière.
              const parId = new Map(affectations.map((a) => {
                if (!enregistrees.has(a.eprouvetteId) || !a.essai.courbe) return [a.eprouvetteId, a.essai];
                const essai = { ...a.essai, courbeInfo: { nbPoints: a.essai.courbe.length } };
                delete essai.courbe;
                return [a.eprouvetteId, essai];
              }));
              onChange(gachee.eprouvettes.map((e) => {
                const patch = parId.get(e.id);
                return patch ? { ...e, statut: "ecrase" as const, essai: { ...(e.essai ?? {}), ...patch } } : e;
              }));
            }}
          />
        )}
        {/* Ajout d'éprouvettes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
          <Champ label="Date de coulée"><input type="date" style={inputStyle} value={couleLe} onChange={(e) => setCouleLe(e.target.value)} /></Champ>
          <Champ label="Âge de cure (j)"><NumInput style={inputStyle} value={age} onChange={setAge} /></Champ>
          <Champ label="Nombre (réplicats)"><NumInput style={inputStyle} value={nb} onChange={setNb} /></Champ>
          <Champ label="Moule (optionnel)"><input style={inputStyle} placeholder="cylindre 50 × 100 mm" value={moule} onChange={(e) => setMoule(e.target.value)} /></Champ>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Âges usuels :</span>
          {AGES_CURE_DEFAUT.map((a) => (
            <button key={a} type="button" onClick={() => setAge(a)}
              style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${age === a ? "#2563eb" : "#cbd5e1"}`, background: age === a ? "#eff6ff" : "#fff", color: age === a ? "#1d4ed8" : "#475569" }}>
              {a} j
            </button>
          ))}
          <button type="button" onClick={ajouter} className="btn-secondary" style={{ marginLeft: "auto", fontSize: 12.5 }}>+ Ajouter</button>
        </div>

        {/* Liste des éprouvettes */}
        {eprouvettes.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune éprouvette. Choisis un âge de cure et un nombre de réplicats, puis « Ajouter ».</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eprouvettes.map((e) => {
              const b = badgeEcheance(e, maintenant);
              return (
                <div key={e.id} style={{ padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{e.code}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>
                        {e.ageJours} j · échéance {fmtDate(dateEcheance(e))} · <span style={{ fontWeight: 700, color: b.couleur }}>{b.texte}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => basculerStatut(e)}
                        className="btn-secondary" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                        {e.statut === "ecrase" ? "Remettre en cure" : "Marquer écrasée"}
                      </button>
                      <button type="button" onClick={() => retirer(e.id)} className="btn-secondary" style={{ fontSize: 11.5, color: "var(--danger)" }}>Retirer</button>
                    </div>
                  </div>
                  {e.statut === "ecrase" && <FormEssaiUCS eprouvette={e} onChange={(patch) => majEssai(e.id, patch)} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Résumé UCS mesurée par âge (moyenne des éprouvettes retenues) */}
        {agr.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 6 }}>
              UCS mesurée par âge (moyenne des éprouvettes retenues)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Âge</th>
                    <th style={{ padding: "4px 8px" }}>n</th>
                    <th style={{ padding: "4px 8px" }}>Moyenne (kPa)</th>
                    <th style={{ padding: "4px 8px" }}>± écart-type</th>
                    <th style={{ padding: "4px 8px" }}>CV</th>
                    <th style={{ padding: "4px 8px" }}>Exclues</th>
                  </tr>
                </thead>
                <tbody>
                  {agr.map((a) => (
                    <tr key={a.ageJours} style={{ borderTop: "1px solid #f1f5f9", textAlign: "right" }}>
                      <td style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{a.ageJours} j</td>
                      <td style={{ padding: "4px 8px" }}>{a.n}</td>
                      <td style={{ padding: "4px 8px", fontWeight: 700, color: "#0f172a" }}>{a.moyenneKpa !== null ? Math.round(a.moyenneKpa).toLocaleString("fr-CA") : "—"}</td>
                      <td style={{ padding: "4px 8px" }}>{a.ecartTypeKpa !== null ? Math.round(a.ecartTypeKpa).toLocaleString("fr-CA") : "—"}</td>
                      <td style={{ padding: "4px 8px" }}>{a.cvPct !== null ? `${a.cvPct.toFixed(1)} %` : "—"}</td>
                      <td style={{ padding: "4px 8px", color: a.nExclus > 0 ? "#b45309" : "#94a3b8" }}>{a.nExclus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Carte>
  );
}

/** Une ligne cliquable de l'échéancier (ouvre la gâchée parente). */
function LigneEcheancier({ x, maintenant, onOuvrir }: {
  x: { e: Eprouvette; g: Gachee };
  maintenant: Date;
  onOuvrir: (gacheeId: string) => void;
}) {
  const b = badgeEcheance(x.e, maintenant);
  return (
    <button type="button" onClick={() => onOuvrir(x.g.id)}
      style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
        background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${b.couleur}`, borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{x.e.code}</div>
        <div style={{ fontSize: 11.5, color: "#64748b" }}>{x.g.formulationLabel} · échéance {fmtDate(dateEcheance(x.e))}</div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: b.couleur, whiteSpace: "nowrap" }}>{b.texte}</span>
    </button>
  );
}

/** Échéancier global : ce qu'il faut écraser, sur toutes les gâchées. */
function Echeancier({ gachees, maintenant, onOuvrir }: {
  gachees: Gachee[];
  maintenant: Date;
  onOuvrir: (gacheeId: string) => void;
}) {
  // Copies de conflit exclues : elles gardent les éprouvettes de l'original
  // (mêmes ids) — chaque éprouvette serait sinon listée deux fois.
  const toutes = gachees.filter((g) => !g.conflit).flatMap((g) => g.eprouvettes.map((e) => ({ e, g })));
  if (toutes.length === 0) return null;
  const enCure = toutes.filter((x) => x.e.statut !== "ecrase");
  const parEcheance = (a: { e: Eprouvette }, b: { e: Eprouvette }) => dateEcheance(a.e).getTime() - dateEcheance(b.e).getTime();
  const aEcraser = enCure.filter((x) => ["retard", "aujourdhui"].includes(classeEcheance(x.e, maintenant))).sort(parEcheance);
  const aVenir = enCure.filter((x) => ["proche", "planifie"].includes(classeEcheance(x.e, maintenant))).sort(parEcheance);

  const exporterIcs = () => {
    const evenements: EvenementIcs[] = enCure.map((x) => ({
      uid: `${x.e.id}@minebackfill`,
      date: dateEcheance(x.e),
      titre: `Écraser ${x.e.code}`,
      description: `Gâchée ${x.g.code} · ${x.g.formulationLabel} · ${x.e.ageJours} j de cure`,
    }));
    if (evenements.length === 0) return;
    // Horodatage réel de l'export (dans un handler : pas de gel par le compilateur).
    telecharger("echeances-labo.ics", "text/calendar", construireIcs(evenements, new Date()));
  };

  return (
    <Carte titre="Échéancier — à écraser" extra={
      <button type="button" onClick={exporterIcs} className="btn-secondary" style={{ fontSize: 12 }} disabled={enCure.length === 0}>Exporter le calendrier (.ics)</button>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 8 }}>
            À écraser maintenant {aEcraser.length > 0 ? `(${aEcraser.length})` : ""}
          </div>
          {aEcraser.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Rien à écraser aujourd&apos;hui. Bon travail.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aEcraser.map((x) => <LigneEcheancier key={x.e.id} x={x} maintenant={maintenant} onOuvrir={onOuvrir} />)}
            </div>
          )}
        </div>
        {aVenir.length > 0 && (
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 8 }}>
              Prochaines échéances
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aVenir.slice(0, 8).map((x) => <LigneEcheancier key={x.e.id} x={x} maintenant={maintenant} onOuvrir={onOuvrir} />)}
            </div>
            {aVenir.length > 8 && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>+ {aVenir.length - 8} autre{aVenir.length - 8 > 1 ? "s" : ""}…</p>}
          </div>
        )}
      </div>
    </Carte>
  );
}

const fmtParam = (v: number | undefined, suffixe = "") => (v != null ? `${v.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}${suffixe}` : "—");

// Palette étendue (au-delà des 4 couleurs de recette) pour distinguer plus de
// gâchées sur la même courbe.
const COULEURS_SERIE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f"];

/** Vue « Résultats UCS » : UCS MESURÉE (aucune valeur prédite). */
function ResultatsUCS({ gachees, formulations }: {
  gachees: Gachee[];
  formulations: { id: string; recipes: Recipe[] }[];
}) {
  // « age » = la courbe historique ; les autres valeurs = le nuage UCS vs
  // paramètre de formulation.
  const [axe, setAxe] = React.useState<"age" | AxeFormulation>("age");
  const [ageVoulu, setAgeVoulu] = React.useState<number | null>(null);
  // On mémorise les gâchées MASQUÉES, pas les affichées : une gâchée créée
  // après coup apparaît ainsi d'office, au lieu de rester invisible jusqu'à ce
  // qu'on pense à la cocher.
  const [masquees, setMasquees] = React.useState<Set<string>>(new Set());

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
  const ages = React.useMemo(() => agesDisponibles(gachees), [gachees]);
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

  const boutonAxe = (actif: boolean): React.CSSProperties => ({
    padding: "5px 11px", fontSize: 12, borderRadius: 6, cursor: "pointer",
    border: `1px solid ${actif ? "#1d4ed8" : "#cbd5e1"}`,
    background: actif ? "#dbeafe" : "#fff",
    color: actif ? "#1e3a8a" : "#475569", fontWeight: actif ? 700 : 500,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Ce que la page MONTRE d'abord. Les précautions méthodologiques
          viennent après, et seulement quand il y a des mesures : sur un écran
          vide, quatre refus alignés avant la moindre explication décourageaient
          plus qu'ils n'informaient. */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#1e3a8a" }}>
        <strong>UCS</strong> = résistance en compression uniaxiale : on écrase une éprouvette, on note la charge
        à la rupture, et on la rapporte à la section du cylindre. Cet onglet trace la résistance que vous avez{" "}
        <strong>mesurée</strong>, en fonction de l&apos;âge de cure ou du dosage du mélange. Pour les grandeurs{" "}
        <strong>calculées</strong> et leurs courbes de réponse, voir{" "}
        <Link href="/analyse" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "underline" }}>Analyse</Link>.
      </div>

      {donnees.length === 0 ? (
        <div style={{ padding: "18px 4px", color: "#475569", fontSize: 13.5, lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#0f172a" }}>
            Aucune mesure UCS pour l&apos;instant — c&apos;est normal tant qu&apos;aucune éprouvette n&apos;a été écrasée.
          </p>
          <p style={{ margin: "0 0 6px" }}>Pour remplir cet onglet :</p>
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            <li>onglet <strong>Gâchées</strong> → <strong>Nouvelle gâchée</strong>, à partir d&apos;une formulation
              sauvegardée dans Calculs ;</li>
            <li>dans la gâchée, carte <strong>« Éprouvettes (cure et écrasement) »</strong> → choisir un âge de cure
              et un nombre d&apos;éprouvettes, puis <strong>Ajouter</strong> ;</li>
            <li>le jour de l&apos;essai, sur une éprouvette : <strong>« Marquer écrasée »</strong> ;</li>
            <li>saisir <strong>« Charge à la rupture (kN) »</strong> et <strong>« Diamètre (mm) »</strong> —
              la résistance est calculée automatiquement.</li>
          </ol>
          <p style={{ margin: "10px 0 0" }}>
            Si votre laboratoire fournit un classeur de presse, le bouton{" "}
            <strong>« Importer un fichier de presse (.xlsx) »</strong> remplit ces essais sans
            ressaisie. <strong>La saisie à la main reste possible dans tous les cas</strong> — et
            les deux voies donnent le même résultat.
          </p>
          <p style={{ margin: "10px 0 0" }}>
            Le graphique apparaît dès la première éprouvette écrasée.
          </p>
        </div>
      ) : (
        <>
          <Carte titre={`Gâchées affichées (${visibles.length} sur ${donnees.length})`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {donnees.map((d) => (
                <label key={d.g.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={!masquees.has(d.g.id)} onChange={() => basculer(d.g.id)} />
                  <span style={{ width: 12, height: 3, background: couleurDe.get(d.g.id), borderRadius: 2 }} />
                  <span style={{ color: masquees.has(d.g.id) ? "#94a3b8" : "#0f172a" }}>{d.g.code}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setMasquees(new Set())}
                style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>
                Tout afficher
              </button>
              <button type="button" onClick={() => setMasquees(new Set(donnees.map((d) => d.g.id)))}
                style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>
                Tout masquer
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", margin: "10px 0 0", lineHeight: 1.5 }}>
              La couleur reste attachée à la gâchée : en masquer une ne change pas la couleur des autres.
              La palette compte {COULEURS_SERIE.length} couleurs et se répète au-delà — raison de plus pour
              n&apos;afficher que les gâchées qui vous intéressent.
            </p>
          </Carte>

          {visibles.length === 0 && (
            <p style={{ fontSize: 13, color: "#b45309", textAlign: "center", padding: "12px 0" }}>
              Toutes les gâchées sont masquées : cochez-en au moins une ci-dessus.
            </p>
          )}

          <Carte titre="Abscisse">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" style={boutonAxe(axe === "age")} onClick={() => setAxe("age")}>
                Âge de cure
              </button>
              {AXES_FORMULATION.map((a) => (
                <button key={a.cle} type="button" style={boutonAxe(axe === a.cle)} onClick={() => setAxe(a.cle)}>
                  {a.label}
                </button>
              ))}
              {axe !== "age" && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, fontSize: 12.5, color: "#475569" }}>
                  à l&apos;âge de
                  <select value={age} onChange={(e) => setAgeVoulu(Number(e.target.value))}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5 }}>
                    {ages.map((a) => <option key={a} value={a}>{a} j</option>)}
                  </select>
                </span>
              )}
            </div>
            {axe !== "age" && (
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "10px 0 0", lineHeight: 1.5 }}>
                Un point par gâchée. Les points ne sont <strong>pas reliés</strong> : joindre deux gâchées
                suggérerait une tendance, qui n&apos;est pas mesurée.
              </p>
            )}
          </Carte>

          {axe === "age" ? (
            <Carte titre="UCS mesurée vs âge de cure">
              <CourbeUCS series={series} />
            </Carte>
          ) : (
            <Carte titre={`UCS mesurée à ${age} j vs ${metaAxe?.label ?? axe}`}>
              <CourbeUCS
                series={seriesNuage}
                relier={false}
                ticksX="rondes"
                xLabel={`${metaAxe?.label ?? axe}${metaAxe && metaAxe.unite !== "—" ? ` (${metaAxe.unite})` : ""}`}
                formatX={(x) => x.toLocaleString("fr-CA", { maximumFractionDigits: 3 })}
                messageVide={`Aucune gâchée ne porte à la fois une mesure à ${age} j et un paramètre de formulation connu.`}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={exporterCsvMesures}
                  style={{ padding: "5px 11px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>
                  Export CSV (mesures)
                </button>
              </div>
              {nuage && nuage.ecartees.length > 0 && (
                // Dire ce qui n'est PAS sur la figure : c'est ce qui sépare une
                // figure défendable d'un graphe trompeur.
                <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#b45309", marginBottom: 4 }}>
                    Gâchées absentes de cette figure ({nuage.ecartees.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#64748b", lineHeight: 1.6 }}>
                    {nuage.ecartees.map((e) => (
                      <li key={e.code}><strong>{e.code}</strong> — {e.raison}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Carte>
          )}

          {/* Les précautions méthodologiques, à leur place : SOUS la figure,
              quand il y a quelque chose à interpréter. Elles restent
              indispensables — elles empêchent de lire un nuage de mesures
              comme une loi physique. */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            <strong style={{ color: "#0f172a" }}>Comment lire ces graphiques.</strong> Les points sont les{" "}
            <strong>moyennes</strong> des éprouvettes retenues et les barres verticales valent ± un écart-type.
            Aucune valeur n&apos;est <strong>prédite ni modélisée</strong> — le programme ne dispose d&apos;aucun
            modèle de prédiction validé. Aucune <strong>droite d&apos;ajustement</strong> n&apos;est tracée et aucune
            valeur n&apos;est <strong>interpolée</strong> : seuls des âges réellement mesurés sont proposés.
            {nbMasquees > 0 && (
              <>
                {" "}<span style={{ color: "#b45309" }}>
                  {nbMasquees} gâchée{nbMasquees > 1 ? "s sont masquées" : " est masquée"} : les figures, la table
                  et l&apos;export ne portent que les gâchées cochées.
                </span>
              </>
            )}
          </div>

          <Carte titre="Détail des mesures">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 620 }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "5px 8px" }}>Gâchée</th>
                    <th style={{ padding: "5px 8px" }}>Cw</th>
                    <th style={{ padding: "5px 8px" }}>W/C</th>
                    <th style={{ padding: "5px 8px" }}>Bw</th>
                    <th style={{ padding: "5px 8px" }}>Âge</th>
                    <th style={{ padding: "5px 8px" }}>UCS moyenne (kPa)</th>
                    <th style={{ padding: "5px 8px" }}>± σ</th>
                    <th style={{ padding: "5px 8px" }}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.flatMap((d) =>
                    d.ages.map((a, j) => (
                      <tr key={`${d.g.id}-${a.ageJours}`} style={{ borderTop: "1px solid #f1f5f9", textAlign: "right" }}>
                        <td style={{ textAlign: "left", padding: "5px 8px", fontWeight: j === 0 ? 700 : 400, color: j === 0 ? "#0f172a" : "#94a3b8" }}>
                          {j === 0 ? d.g.code : ""}
                        </td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.cwPct, " %") : ""}</td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.wcRatio) : ""}</td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(parametresEffectifs(d.g, formulations)?.bwPct, " %") : ""}</td>
                        <td style={{ padding: "5px 8px" }}>{a.ageJours} j</td>
                        <td style={{ padding: "5px 8px", fontWeight: 700, color: "#0f172a" }}>{Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")}</td>
                        <td style={{ padding: "5px 8px" }}>{a.ecartTypeKpa !== null ? Math.round(a.ecartTypeKpa).toLocaleString("fr-CA") : "—"}</td>
                        <td style={{ padding: "5px 8px" }}>{a.n}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}

/** Édition des protocoles de laboratoire (procédures maintenues par le prof). */
function ProtocolesEditeur({ protocoles, onAjouter, onModifier, onSupprimer, onReinitialiser }: {
  protocoles: Protocole[];
  onAjouter: (p: Protocole) => void;
  onModifier: (id: string, patch: Partial<Protocole>) => void;
  onSupprimer: (id: string) => void;
  onReinitialiser: () => void;
}) {
  const ajouter = () => onAjouter({ id: nouvelId(), titre: "Nouveau protocole", contenu: "", majLe: new Date().toISOString() });
  const reinitialiser = () => {
    if (window.confirm("Remplacer les protocoles actuels par les procédures de départ ? Les gâchées déjà créées ne sont pas touchées.")) onReinitialiser();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#475569" }}>
        Ces procédures sont éditables. Chaque nouvelle gâchée en <strong>fige une copie</strong> : modifier un protocole ici
        ne change jamais celui d&apos;une gâchée déjà créée (traçabilité).
      </div>
      {protocoles.map((p) => (
        <Carte key={p.id} titre={p.titre || "Protocole"} extra={
          <button type="button" onClick={() => { if (window.confirm(`Supprimer le protocole « ${p.titre || "sans titre"} » ?`)) onSupprimer(p.id); }}
            className="btn-secondary" style={{ fontSize: 12, color: "var(--danger)" }}>Supprimer</button>
        }>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Champ label="Titre">
              <input style={inputStyle} value={p.titre}
                onChange={(e) => onModifier(p.id, { titre: e.target.value, majLe: new Date().toISOString() })} />
            </Champ>
            <Champ label="Contenu">
              <textarea style={{ ...inputStyle, minHeight: 130, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                value={p.contenu} onChange={(e) => onModifier(p.id, { contenu: e.target.value, majLe: new Date().toISOString() })} />
            </Champ>
            {p.majLe && <p style={{ fontSize: 11, color: "#94a3b8" }}>Modifié le {new Date(p.majLe).toLocaleDateString("fr-CA")}</p>}
          </div>
        </Carte>
      ))}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={ajouter} className="btn-secondary">+ Ajouter un protocole</button>
        <button type="button" onClick={reinitialiser} className="btn-secondary" style={{ color: "#64748b" }}>Réinitialiser aux procédures par défaut</button>
      </div>
    </div>
  );
}

export default function LaboPage() {
  const monte = useHydrated();
  const { gachees, ajouterGachee, modifierGachee, supprimerGachee, savedResults,
    protocoles, ajouterProtocole, modifierProtocole, supprimerProtocole, reinitialiserProtocoles } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);
  const [vue, setVue] = useState<"gachees" | "resultats" | "protocoles">("gachees");
  // Filtre de session : la liste et les figures. L'échéancier, lui, montre
  // TOUTES les éprouvettes à écraser — on ne doit en manquer aucune.
  const sessions = useStore((s) => s.sessions);
  const [filtreSession, setFiltreSession] = useState<FiltreSessionValeur>("toutes");
  const gacheesSession = gachees.filter((g) =>
    correspond({ sessionId: g.sessionId, date: g.creeLe }, sessions, filtreSession));

  // « Aujourd'hui » pour l'échéancier et les badges (voir use-aujourdhui.ts).
  const maintenant = useAujourdhui();

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
      composants: composantsDepuisRecette(recette, (i) => `Ciment ${i}`),
      tolerancePct: 2,
      ajustements: [],
      eprouvettes: [],
      parametres: parametresDepuisRecette(recette),
      protocolesSnapshot: snapshotProtocoles(protocoles),
    };
    ajouterGachee(g);
    setNouvelle(false);
    setSelId(g.id);
  }

  if (!monte) return null;

  // ── Éditeur d'une gâchée ──
  if (selection) {
    const g = selection;
    const maj = (patch: Partial<Gachee>) => modifierGachee(g.id, patch);
    const majComposant = (cle: string, peseeKg: number | undefined) =>
      maj({ composants: g.composants.map((c) => (c.cle === cle ? { ...c, peseeKg } : c)) });
    const ajouterAjustement = () =>
      maj({ ajustements: [...g.ajustements, { id: nouvelId(), type: "eau", masseKg: 0 }] });
    const majAjustement = (id: string, patch: Partial<Ajustement>) =>
      maj({ ajustements: g.ajustements.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
    const retirerAjustement = (id: string) =>
      maj({ ajustements: g.ajustements.filter((a) => a.id !== id) });

    return (
      <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 18px 64px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setSelId(null)} className="btn-secondary">← Toutes les gâchées</button>
            <div style={{ display: "flex", gap: 8 }}>
              {(["brouillon", "terminee"] as const).map((st) => {
                const actif = g.statut === st;
                return (
                  <button key={st} type="button" onClick={() => maj({ statut: st })}
                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: `1.5px solid ${actif ? "#16a34a" : "#e2e8f0"}`, background: actif ? "#16a34a" : "#fff", color: actif ? "#fff" : "#374151" }}>
                    {st === "brouillon" ? "Brouillon" : "Terminée"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Gâchée {g.code}</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              Formulation : <strong>{g.formulationLabel}</strong> · {g.categorie}
              {g.solverVersion ? ` · solveur ${g.solverVersion}` : ""}
            </p>
            <AnnotationsDoc kind="gachee" id={g.id} />
          </div>

          {/* Pesées cibles vs réelles */}
          <Carte titre="Pesées : cible vs réelle" extra={
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
              Tolérance ±
              <NumInput style={{ ...inputStyle, width: 64, padding: "4px 8px" }}
                value={g.tolerancePct} onChange={(n) => maj({ tolerancePct: n ?? 0 })} /> %
            </span>
          }>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)", gap: 8, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                <span>Composant</span><span>Cible (kg)</span><span>Pesée (kg)</span><span>Écart</span>
              </div>
              {g.composants.map((c) => {
                const e = ecart(c);
                const hors = e !== null && Math.abs(e.pct) > g.tolerancePct;
                return (
                  <div key={c.cle} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{c.label}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{fmt(c.cibleKg, 1)}</span>
                    <NumInput style={inputStyle} placeholder="—"
                      value={c.peseeKg} onChange={(n) => majComposant(c.cle, n)} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: e === null ? "#cbd5e1" : hors ? "#dc2626" : "#16a34a" }}>
                      {e === null ? "—" : `${e.kg >= 0 ? "+" : ""}${fmt(e.kg, 1)} kg (${e.pct >= 0 ? "+" : ""}${fmt(e.pct, 1)} %)`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Carte>

          {/* Lots + humidité */}
          <Carte titre="Matériaux utilisés">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <Champ label="Lot de résidu"><input style={inputStyle} value={g.lotResidu ?? ""} onChange={(e) => maj({ lotResidu: e.target.value })} /></Champ>
              <Champ label="Lot de granulat"><input style={inputStyle} value={g.lotGranulat ?? ""} onChange={(e) => maj({ lotGranulat: e.target.value })} /></Champ>
              <Champ label="Lot de liant"><input style={inputStyle} value={g.lotLiant ?? ""} onChange={(e) => maj({ lotLiant: e.target.value })} /></Champ>
              <Champ label="Humidité mesurée du résidu w₀ (%)" hint="Mesure du jour (peut différer de la valeur de la recette)">
                <NumInput style={inputStyle} placeholder="—"
                  value={g.w0MesurePct} onChange={(n) => maj({ w0MesurePct: n })} />
              </Champ>
            </div>
          </Carte>

          {/* Mesures fraîches */}
          <Carte titre="Mesures sur pâte fraîche">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              <Champ label="Slump mesuré (mm)"><NumInput style={inputStyle} value={g.slumpMesureMm} onChange={(n) => maj({ slumpMesureMm: n })} /></Champ>
              <Champ label="Température (°C)"><NumInput style={inputStyle} value={g.temperatureC} onChange={(n) => maj({ temperatureC: n })} /></Champ>
              <Champ label="w mesuré (%)"><NumInput style={inputStyle} value={g.wMesurePct} onChange={(n) => maj({ wMesurePct: n })} /></Champ>
              <Champ label="Cw mesuré (%)"><NumInput style={inputStyle} value={g.cwMesurePct} onChange={(n) => maj({ cwMesurePct: n })} /></Champ>
            </div>
          </Carte>

          {/* Ajustements essai-erreur */}
          <Carte titre="Ajustements (essai-erreur)" extra={
            <button type="button" onClick={ajouterAjustement} className="btn-secondary" style={{ fontSize: 12 }}>+ Ajouter</button>
          }>
            {g.ajustements.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucun ajustement. Ajoute ce que tu as versé après le premier malaxage (eau, résidu, granulat, liant).</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {g.ajustements.map((a) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,2fr) auto", gap: 8, alignItems: "center" }}>
                    <select style={inputStyle} value={a.type} onChange={(e) => majAjustement(a.id, { type: e.target.value as Ajustement["type"] })}>
                      <option value="eau">Eau</option><option value="residu">Résidu</option>
                      <option value="granulat">Granulat</option><option value="liant">Liant</option>
                    </select>
                    <NumInput style={inputStyle} placeholder="kg" value={a.masseKg || undefined} onChange={(n) => majAjustement(a.id, { masseKg: n ?? 0 })} />
                    <input style={inputStyle} placeholder="Note (optionnel)" value={a.note ?? ""} onChange={(e) => majAjustement(a.id, { note: e.target.value })} />
                    <button type="button" onClick={() => retirerAjustement(a.id)} className="btn-secondary" style={{ fontSize: 12 }}>Retirer</button>
                  </div>
                ))}
              </div>
            )}
          </Carte>

          <CarteEprouvettes key={g.id} gachee={g} maintenant={maintenant} onChange={(eprouvettes) => maj({ eprouvettes })} />

          <CarteProtocolesFiges snapshot={g.protocolesSnapshot} />

          <Carte titre="Observations">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Remarques sur la gâchée, la consistance, les incidents…"
              value={g.observations ?? ""} onChange={(e) => maj({ observations: e.target.value })} />
          </Carte>

          <div>
            <button type="button" onClick={() => { if (window.confirm(`Supprimer la gâchée ${g.code} ?`)) { oublierCourbes(courbesAOublier(idsCourbes(g), gachees.filter((x) => x.id !== g.id))); supprimerGachee(g.id); setSelId(null); } }}
              className="btn-secondary" style={{ color: "var(--danger)" }}>Supprimer cette gâchée</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Liste des gâchées ──
  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 18px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Laboratoire — gâchées</h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.5 }}>
              Enregistre ce que tu as VRAIMENT préparé : pesées réelles, lots, mesures. Une gâchée
              part d&apos;une formulation sauvegardée dans Calculs.
            </p>
          </div>
          {vue === "gachees" && (
            <button type="button" onClick={() => setNouvelle((v) => !v)} className="btn-primary">Nouvelle gâchée</button>
          )}
        </div>

        {vue !== "protocoles" && (
          <FiltreSession sessions={sessions} valeur={filtreSession} onChange={setFiltreSession}
            compte={filtreSession === "toutes" ? undefined : `${gacheesSession.length} gâchée(s) sur ${gachees.length}`} />
        )}

        {/* Sélecteur de vue */}
        <div style={{ display: "flex", gap: 6, background: "#eef2f7", padding: 4, borderRadius: 10, alignSelf: "flex-start", flexWrap: "wrap" }}>
          {([["gachees", "Gâchées"], ["resultats", "Résultats UCS"], ["protocoles", "Protocoles"]] as const).map(([cle, label]) => {
            const actif = vue === cle;
            return (
              <button key={cle} type="button" onClick={() => setVue(cle)}
                style={{ padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  background: actif ? "#fff" : "transparent", color: actif ? "#1d4ed8" : "#64748b",
                  boxShadow: actif ? "0 1px 3px rgba(15,23,42,0.12)" : "none" }}>
                {label}
              </button>
            );
          })}
        </div>

        {vue === "resultats" ? (
          <>
            {/* Une copie de conflit est la MÊME gâchée en deux versions : la
                compter dans les figures doublerait sa mesure. */}
            {gacheesSession.some((g) => g.conflit) && (
              <p style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", margin: "0 0 12px" }}>
                {gacheesSession.filter((g) => g.conflit).length} copie(s) de conflit exclue(s) des figures : gardez la bonne
                version de chaque gâchée et supprimez l&apos;autre.
              </p>
            )}
            <ResultatsUCS gachees={gacheesSession.filter((g) => !g.conflit)} formulations={formulations} />
          </>
        ) : vue === "protocoles" ? (
          <ProtocolesEditeur protocoles={protocoles} onAjouter={ajouterProtocole} onModifier={modifierProtocole} onSupprimer={supprimerProtocole} onReinitialiser={reinitialiserProtocoles} />
        ) : (
        <>
        {nouvelle && (
          <Carte titre="Nouvelle gâchée">
            {formulations.length === 0 ? (
              <p style={{ fontSize: 13, color: "#b45309" }}>
                Aucune formulation sauvegardée. Va dans <strong>Calculs</strong>, lance un calcul RPC/RPG, puis clique
                <strong> « Sauvegarder »</strong> dans le panneau de résultats. Reviens ensuite ici.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Champ label="Formulation">
                  <select style={inputStyle} value={formId || formulations[0].id} onChange={(e) => { setFormId(e.target.value); setRecIndex(0); }}>
                    {formulations.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.category}</option>)}
                  </select>
                </Champ>
                {(() => {
                  const form = formulations.find((s) => s.id === (formId || formulations[0].id)) ?? formulations[0];
                  return form.recipes.length > 1 ? (
                    <Champ label="Recette">
                      <select style={inputStyle} value={recIndex} onChange={(e) => setRecIndex(Number(e.target.value))}>
                        {form.recipes.map((_, i) => <option key={i} value={i}>Recette {i + 1}</option>)}
                      </select>
                    </Champ>
                  ) : null;
                })()}
                <button type="button" onClick={creer} className="btn-primary" style={{ alignSelf: "flex-start" }}>Créer la gâchée</button>
              </div>
            )}
          </Carte>
        )}

        <Echeancier gachees={gachees} maintenant={maintenant} onOuvrir={(id) => setSelId(id)} />

        {gacheesSession.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
            {gachees.length === 0 ? "Aucune gâchée pour l'instant." : "Aucune gâchée dans cette session."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gacheesSession.map((g, i) => {
              const hors = nbHorsTolerance(g);
              return (
                <button key={g.id} type="button" onClick={() => setSelId(g.id)}
                  style={{ textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${RECIPE_COLORS[i % 4] ?? "#2563eb"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>{g.code}</div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                      {g.formulationLabel} · {g.categorie} · {new Date(g.creeLe).toLocaleDateString("fr-CA")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {g.conflit && (
                      <span title={`Version gardée lors d'un conflit de synchronisation (${new Date(g.conflit.le).toLocaleString("fr-CA")}). Exclue des figures.`}
                        style={{ fontSize: 11.5, fontWeight: 700, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 999, padding: "3px 9px" }}>
                        Copie de conflit
                      </span>
                    )}
                    {hors > 0 && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 999, padding: "3px 9px" }}>
                        {hors} écart{hors > 1 ? "s" : ""} hors tolérance
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: g.statut === "terminee" ? "var(--success)" : "#d97706", background: g.statut === "terminee" ? "#f0fdf4" : "#fffbeb", border: `1px solid ${g.statut === "terminee" ? "#bbf7d0" : "#fcd34d"}`, borderRadius: 999, padding: "3px 9px" }}>
                      {g.statut === "terminee" ? "Terminée" : "Brouillon"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
