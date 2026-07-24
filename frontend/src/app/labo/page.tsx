"use client";

// Onglet « Labo » — gâchées RÉELLES. Chaque gâchée part d'une formulation
// sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a vraiment été fait :
// masses cibles vs pesées (écart kg/%), lots, humidité mesurée, mesures fraîches
// (slump, température, w, Cw — persistées) et ajustements de l'essai-erreur.
// Auto-sauvegarde : chaque saisie est persistée immédiatement (localStorage).

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { fmt } from "@/lib/format";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import {
  ecart, nbHorsTolerance, genererCode, composantsDepuisRecette,
  type Gachee, type Ajustement,
} from "@/lib/gachee";
import {
  AGES_CURE_DEFAUT, dateCoulee, dateEcheance, joursRestants, classeEcheance,
  genererCodeEprouvette, construireIcs, etiquettesHtml,
  type Eprouvette, type ClasseEcheance, type EvenementIcs, type EtiquetteEprouvette,
} from "@/lib/eprouvette";

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

/** Imprime un document HTML autonome via une iframe cachée (isole les styles). */
function imprimerHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const w = iframe.contentWindow;
  const doc = w?.document;
  if (!w || !doc) { iframe.remove(); return; }
  const nettoyer = () => setTimeout(() => iframe.remove(), 800);
  w.onafterprint = nettoyer;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch { nettoyer(); }
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
  const retirer = (id: string) => onChange(gachee.eprouvettes.filter((e) => e.id !== id));

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
                <div key={e.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{e.code}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>
                      {e.ageJours} j · échéance {fmtDate(dateEcheance(e))} · <span style={{ fontWeight: 700, color: b.couleur }}>{b.texte}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => majEprouvette(e.id, { statut: e.statut === "ecrase" ? "en_cure" : "ecrase" })}
                      className="btn-secondary" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                      {e.statut === "ecrase" ? "Remettre en cure" : "Marquer écrasée"}
                    </button>
                    <button type="button" onClick={() => retirer(e.id)} className="btn-secondary" style={{ fontSize: 11.5, color: "var(--danger)" }}>Retirer</button>
                  </div>
                </div>
              );
            })}
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
    telecharger("echeances-labo.ics", "text/calendar", construireIcs(evenements, maintenant));
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

export default function LaboPage() {
  const monte = useHydrated();
  const { gachees, ajouterGachee, modifierGachee, supprimerGachee, savedResults } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);

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
    };
    ajouterGachee(g);
    setNouvelle(false);
    setSelId(g.id);
  }

  if (!monte) return null;
  // Après hydratation uniquement (pas de mismatch SSR) : « aujourd'hui » pour
  // l'échéancier et les badges d'échéance.
  const maintenant = new Date();

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

          <CarteEprouvettes gachee={g} maintenant={maintenant} onChange={(eprouvettes) => maj({ eprouvettes })} />

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
          <button type="button" onClick={() => setNouvelle((v) => !v)} className="btn-primary">Nouvelle gâchée</button>
        </div>

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
      </div>
    </div>
  );
}
