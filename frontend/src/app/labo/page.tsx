"use client";

// Onglet « Labo » — gâchées RÉELLES. Chaque gâchée part d'une formulation
// sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a vraiment été fait :
// masses cibles vs pesées (écart kg/%), lots, humidité mesurée, mesures fraîches
// (slump, température, w, Cw — persistées) et ajustements de l'essai-erreur.
// Auto-sauvegarde : chaque saisie est persistée immédiatement (localStorage).

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { fmt } from "@/lib/format";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import {
  ecart, nbHorsTolerance, genererCode, composantsDepuisRecette, parametresDepuisRecette,
  type Gachee, type Ajustement,
} from "@/lib/gachee";
import {
  AGES_CURE_DEFAUT, dateCoulee, dateEcheance, joursRestants, classeEcheance,
  genererCodeEprouvette, construireIcs, etiquettesHtml,
  contrainteKpa, agregerParAge,
  type Eprouvette, type EssaiUCS, type ClasseEcheance, type EvenementIcs, type EtiquetteEprouvette,
} from "@/lib/eprouvette";
import CourbeUCS, { type SerieUCS } from "@/components/labo/CourbeUCS";

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

function Carte({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>{titre}</span>
        {extra}
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
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

const p2 = (n: number) => String(n).padStart(2, "0");

/** Date affichée AAAA-MM-JJ (non ambigu, local). */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
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

const COULEUR_ECHEANCE: Record<ClasseEcheance, string> = {
  retard: "#dc2626",
  aujourdhui: "#d97706",
  proche: "#2563eb",
  planifie: "#64748b",
  fait: "#16a34a",
};

/** Libellé + couleur de l'état d'échéance d'une éprouvette. */
function badgeEcheance(e: Eprouvette, ref: Date): { texte: string; couleur: string } {
  const c = classeEcheance(e, ref);
  const j = joursRestants(e, ref);
  const texte =
    c === "fait" ? "écrasée"
    : c === "aujourdhui" ? "à écraser aujourd'hui"
    : c === "retard" ? `en retard de ${-j} j`
    : `dans ${j} j`;
  return { texte, couleur: COULEUR_ECHEANCE[c] };
}

/** Saisie de l'essai UCS d'une éprouvette écrasée (contrainte mesurée). */
function FormEssaiUCS({ eprouvette, onChange }: {
  eprouvette: Eprouvette;
  onChange: (patch: Partial<EssaiUCS>) => void;
}) {
  const es = eprouvette.essai ?? {};
  const calculee = contrainteKpa({ chargeKn: es.chargeKn, diametreMm: es.diametreMm });
  const retenue = contrainteKpa(es);
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
          ) : <span style={{ color: "#94a3b8" }}>Saisis une charge + un diamètre, ou une contrainte directe.</span>}
        </div>
      </div>

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
  const retirer = (id: string) => onChange(gachee.eprouvettes.filter((e) => e.id !== id));

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
  const toutes = gachees.flatMap((g) => g.eprouvettes.map((e) => ({ e, g })));
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
function ResultatsUCS({ gachees }: { gachees: Gachee[] }) {
  const donnees = gachees
    .map((g) => ({ g, ages: agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null) }))
    .filter((d) => d.ages.length > 0);

  const series: SerieUCS[] = donnees.map((d, i) => ({
    cle: d.g.id,
    label: d.g.code,
    couleur: COULEURS_SERIE[i % COULEURS_SERIE.length],
    points: d.ages.map((a) => ({ age: a.ageJours, moyenne: a.moyenneKpa as number, ecartType: a.ecartTypeKpa, n: a.n })),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#1e3a8a" }}>
        Ces courbes montrent la résistance <strong>mesurée</strong> en laboratoire (UCS = charge à la rupture rapportée à la
        section). Aucune valeur <strong>prédite ou modélisée</strong> n&apos;est tracée : le programme ne dispose pas de modèle
        de prédiction validé. Les points sont les moyennes des éprouvettes retenues ; les barres verticales indiquent ± un écart-type.
      </div>

      {series.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>
          Aucune mesure UCS pour l&apos;instant. Dans une gâchée, marque une éprouvette « écrasée » et saisis sa charge (ou sa contrainte).
        </p>
      ) : (
        <>
          <Carte titre="UCS mesurée vs âge de cure">
            <CourbeUCS series={series} />
          </Carte>

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
                  {donnees.flatMap((d) =>
                    d.ages.map((a, j) => (
                      <tr key={`${d.g.id}-${a.ageJours}`} style={{ borderTop: "1px solid #f1f5f9", textAlign: "right" }}>
                        <td style={{ textAlign: "left", padding: "5px 8px", fontWeight: j === 0 ? 700 : 400, color: j === 0 ? "#0f172a" : "#94a3b8" }}>
                          {j === 0 ? d.g.code : ""}
                        </td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(d.g.parametres?.cwPct, " %") : ""}</td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(d.g.parametres?.wcRatio) : ""}</td>
                        <td style={{ padding: "5px 8px" }}>{j === 0 ? fmtParam(d.g.parametres?.bwPct, " %") : ""}</td>
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

export default function LaboPage() {
  const monte = useHydrated();
  const { gachees, ajouterGachee, modifierGachee, supprimerGachee, savedResults } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);
  const [vue, setVue] = useState<"gachees" | "resultats">("gachees");

  // « Aujourd'hui » pour l'échéancier et les badges. En état (pas en plein
  // rendu) : le React Compiler figerait un `new Date()` de rendu au premier
  // appel et l'horloge ne changerait jamais de jour. On ne re-rend qu'au
  // changement de jour (échéances au jour près), au focus et au retour d'onglet.
  const [maintenant, setMaintenant] = useState<Date>(() => new Date());
  useEffect(() => {
    const tick = () =>
      setMaintenant((prev) => {
        const n = new Date();
        return n.toDateString() === prev.toDateString() ? prev : n;
      });
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

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

          <Carte titre="Observations">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Remarques sur la gâchée, la consistance, les incidents…"
              value={g.observations ?? ""} onChange={(e) => maj({ observations: e.target.value })} />
          </Carte>

          <div>
            <button type="button" onClick={() => { if (window.confirm(`Supprimer la gâchée ${g.code} ?`)) { supprimerGachee(g.id); setSelId(null); } }}
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

        {/* Sélecteur de vue */}
        <div style={{ display: "flex", gap: 6, background: "#eef2f7", padding: 4, borderRadius: 10, alignSelf: "flex-start" }}>
          {([["gachees", "Gâchées"], ["resultats", "Résultats UCS"]] as const).map(([cle, label]) => {
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
          <ResultatsUCS gachees={gachees} />
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

        {gachees.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>Aucune gâchée pour l&apos;instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gachees.map((g, i) => {
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
