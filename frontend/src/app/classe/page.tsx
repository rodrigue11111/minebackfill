"use client";

// Tableau de bord de la classe (enseignant) : le travail de chaque étudiant,
// la figure UCS de la classe, les commentaires, et l'export de la classe.
//
// Tout est lu EN MÉMOIRE à l'ouverture (lire_docs_classe, projection allégée,
// filtrée par session) : rien n'est versé dans le stockage local de
// l'enseignant, qui garde son propre travail intact.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { sessionActive, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import FiltreSession from "@/components/FiltreSession";
import CourbeUCS, { type SerieUCS } from "@/components/labo/CourbeUCS";
import { AXES_FORMULATION, axeMeta, type AxeFormulation } from "@/lib/ucs-formulation";
import { agregerParAge, contrainteKpa } from "@/lib/eprouvette";
import {
  agesClasse, exportClasse, nuageClasse, regrouper,
  type EtudiantClasse, type LigneClasse, type ProfilClasse,
} from "@/lib/classe";
import {
  ajouterAnnotation, lireAnnotationsClasse, lireClasse, lireProfils, retirerAnnotation,
  type LigneAnnotation,
} from "@/lib/classe-reseau";
import { nomFichier, telechargerBlob } from "@/lib/export-fig";

const COULEURS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f", "#0f766e", "#9333ea"];

function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-CA");
}

export default function ClassePage() {
  const monte = useHydrated();
  const session = useStore((s) => s.session);
  const sessions = useStore((s) => s.sessions);
  const [filtre, setFiltre] = useState<FiltreSessionValeur | null>(null);
  const [lignes, setLignes] = useState<LigneClasse[]>([]);
  const [profils, setProfils] = useState<ProfilClasse[]>([]);
  const [annotations, setAnnotations] = useState<LigneAnnotation[]>([]);
  const [etat, setEtat] = useState<"attente" | "chargement" | "pret" | "erreur">("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [axe, setAxe] = useState<AxeFormulation>("bwPct");
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const estProf = session?.role === "prof";
  // Par défaut : la session active (sinon toutes). Choisi une fois les
  // sessions connues ; ensuite, c'est l'enseignant qui décide.
  const filtreEffectif: FiltreSessionValeur = filtre ?? (sessionActive(sessions, new Date())?.id ?? "toutes");
  const sessionServeur = filtreEffectif === "toutes" || filtreEffectif === "sans" ? null : filtreEffectif;

  const charger = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setEtat("chargement");
    setErreur(null);
    try {
      const [l, p, a] = await Promise.all([
        lireClasse(sb, { complet: false, session: sessionServeur }),
        lireProfils(sb),
        lireAnnotationsClasse(sb),
      ]);
      setLignes(l);
      setProfils(p);
      setAnnotations(a);
      setEtat("pret");
    } catch (e) {
      // Une lecture en échec n'est JAMAIS montrée comme une classe vide.
      setErreur(e instanceof Error ? e.message : String(e));
      setEtat("erreur");
    }
  }, [sessionServeur]);

  useEffect(() => {
    if (monte && estProf) void charger();
  }, [monte, estProf, charger]);

  const etudiants = useMemo(
    () => regrouper(lignes, profils, sessions, filtreEffectif),
    [lignes, profils, sessions, filtreEffectif],
  );
  const ages = useMemo(() => agesClasse(etudiants), [etudiants]);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : (ages.includes(28) ? 28 : (ages[0] ?? 28));
  const nuage = useMemo(() => nuageClasse(etudiants, axe, age), [etudiants, axe, age]);
  const couleurDe = new Map(etudiants.map((e, i) => [e.id, COULEURS[i % COULEURS.length]]));
  const series: SerieUCS[] = etudiants
    .map((e) => ({
      cle: e.id, label: e.nom, couleur: couleurDe.get(e.id) ?? COULEURS[0],
      points: nuage.points.filter((p) => p.etudiantId === e.id)
        .map((p) => ({ x: p.x, moyenne: p.moyenneKpa, ecartType: p.ecartTypeKpa, n: p.n })),
    }))
    .filter((s) => s.points.length > 0);

  const exporter = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setExportEnCours(true);
    try {
      const complet = await lireClasse(sb, { complet: true, session: sessionServeur });
      const donnees = exportClasse(regrouper(complet, profils, sessions, filtreEffectif), filtreEffectif, new Date());
      telechargerBlob(new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" }),
        nomFichier(`MineBackfill_classe_${filtreEffectif}`, "json"));
    } catch (e) {
      window.alert(`Export impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExportEnCours(false);
    }
  };

  const conteneur: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "28px 18px 64px", display: "flex", flexDirection: "column", gap: 16 };

  if (!monte) return null;
  if (!cloudConfigure() || !estProf) {
    return (
      <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
        <div style={conteneur}>
          <div className="form-card">
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Classe</h1>
            <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: 0 }}>
              Ce tableau de bord est réservé à l&apos;enseignant connecté.{" "}
              <Link href="/compte" style={{ color: "var(--primary)" }}>Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sel = etudiants.find((e) => e.id === selId) ?? null;

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={conteneur}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Classe</h1>
            <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
              Le travail sauvegardé en ligne par chaque étudiant, en lecture seule. Vos commentaires
              apparaissent chez l&apos;étudiant concerné, et chez lui seulement.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void charger()} disabled={etat === "chargement"}>
              {etat === "chargement" ? "Lecture…" : "Actualiser"}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void exporter()} disabled={exportEnCours || etat !== "pret"}
              title="Copie de sauvegarde de la classe (JSON). L'offre gratuite de Supabase n'en fait aucune. À ranger hors de GitHub : elle contient des données d'étudiants.">
              {exportEnCours ? "Export…" : "Exporter la classe (JSON)"}
            </button>
          </div>
        </div>

        <FiltreSession sessions={sessions} valeur={filtreEffectif} onChange={(v) => { setFiltre(v); setSelId(null); }} />

        {etat === "erreur" && (
          <p role="alert" style={{ fontSize: 13, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
            Lecture de la classe impossible : {erreur}. Rien n&apos;est affiché plutôt qu&apos;une classe vide trompeuse ; réessayez avec « Actualiser ».
          </p>
        )}

        {etat === "pret" && (
          <>
            {/* ── Étudiants ── */}
            <div className="form-card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {["Étudiant", "Résultats", "Gâchées", "Essais UCS", "Dernière activité", "Commentaires"].map((t) => (
                      <th key={t} style={{ padding: "10px 12px", borderBottom: "2px solid var(--border)" }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etudiants.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 16, color: "#94a3b8" }}>Aucun compte étudiant pour l&apos;instant.</td></tr>
                  ) : etudiants.map((e) => {
                    const nbComm = annotations.filter((a) => a.owner_id === e.id).length;
                    const actif = e.id === selId;
                    return (
                      <tr key={e.id} onClick={() => setSelId(actif ? null : e.id)}
                        style={{ cursor: "pointer", background: actif ? "#eff6ff" : undefined, borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 600 }}>
                          <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: couleurDe.get(e.id), marginRight: 8 }} />
                          {e.nom}
                          {e.email && e.email !== e.nom && <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {e.email}</span>}
                        </td>
                        <td style={{ padding: "9px 12px" }}>{e.resultats.length}</td>
                        <td style={{ padding: "9px 12px" }}>{e.gachees.length}</td>
                        <td style={{ padding: "9px 12px" }}>{e.nbEssais}</td>
                        <td style={{ padding: "9px 12px" }}>{dateCourte(e.derniereActivite)}</td>
                        <td style={{ padding: "9px 12px" }}>{nbComm || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sel && (
              <DetailEtudiant etudiant={sel} annotations={annotations}
                onAnnoter={async (a) => {
                  const sb = getSupabase();
                  if (!sb || !session) return;
                  try {
                    const cree = await ajouterAnnotation(sb, { ...a, ownerId: sel.id, auteurId: session.userId });
                    setAnnotations((l) => [...l, cree]);
                  } catch (e) {
                    window.alert(`Commentaire non enregistré : ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
                onRetirer={async (id) => {
                  const sb = getSupabase();
                  if (!sb || !window.confirm("Retirer ce commentaire ? L'étudiant ne le verra plus.")) return;
                  try {
                    await retirerAnnotation(sb, id);
                    setAnnotations((l) => l.filter((x) => x.id !== id));
                  } catch (e) {
                    window.alert(`Retrait impossible : ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
                lignes={lignes}
              />
            )}

            {/* ── Figure de la classe ── */}
            <div className="form-card">
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>UCS mesurée de la classe</h2>
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 10px", lineHeight: 1.5 }}>
                Un point par gâchée : son paramètre de formulation en abscisse, l&apos;UCS moyenne mesurée
                à l&apos;âge choisi en ordonnée. Une couleur par étudiant. Les copies de conflit sont exclues.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {AXES_FORMULATION.map((a) => (
                  <button key={a.cle} type="button" onClick={() => setAxe(a.cle)}
                    style={{ padding: "5px 11px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                      border: `1px solid ${axe === a.cle ? "#1d4ed8" : "#cbd5e1"}`, background: axe === a.cle ? "#dbeafe" : "#fff",
                      color: axe === a.cle ? "#1e3a8a" : "#475569", fontWeight: axe === a.cle ? 700 : 500 }}>
                    {a.label}
                  </button>
                ))}
                {ages.length > 0 && (
                  <label style={{ fontSize: 12.5, color: "#475569", marginLeft: 8 }}>
                    Âge :{" "}
                    <select value={age} onChange={(ev) => setAgeVoulu(Number(ev.target.value))}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5 }}>
                      {ages.map((x) => <option key={x} value={x}>{x} j</option>)}
                    </select>
                  </label>
                )}
              </div>
              <CourbeUCS series={series} relier={false} ticksX="rondes"
                xLabel={(() => { const m = axeMeta(axe); return m ? `${m.label}${m.unite !== "—" ? ` (${m.unite})` : ""}` : axe; })()}
                formatX={(x) => x.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}
                messageVide="Aucune gâchée de la classe n'a de mesure exploitable à cet âge." />
              {nuage.ecartees.length > 0 && (
                <details style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
                  <summary style={{ cursor: "pointer" }}>{nuage.ecartees.length} gâchée(s) absente(s) de cette figure</summary>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {nuage.ecartees.map((x, i) => <li key={i}>{x.etudiant} — {x.code} : {x.raison}</li>)}
                  </ul>
                </details>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Détail d'un étudiant : ses documents, et les commentaires de l'enseignant. */
function DetailEtudiant({ etudiant, annotations, onAnnoter, onRetirer, lignes }: {
  etudiant: EtudiantClasse;
  annotations: LigneAnnotation[];
  onAnnoter: (a: { kind: "resultat" | "gachee"; id: string; rev: number | null; ancre: string | null; texte: string }) => Promise<void>;
  onRetirer: (id: string) => Promise<void>;
  lignes: LigneClasse[];
}) {
  const revDe = (kind: "resultat" | "gachee", id: string) =>
    lignes.find((l) => l.proprietaire === etudiant.id && l.kind === kind && l.id === id)?.rev ?? null;
  const commentaires = (kind: "resultat" | "gachee", id: string) =>
    annotations.filter((a) => a.owner_id === etudiant.id && a.target_kind === kind && a.target_id === id);

  return (
    <div className="form-card">
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>{etudiant.nom}</h2>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 8px" }}>Gâchées ({etudiant.gachees.length})</h3>
      {etudiant.gachees.length === 0 && <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune gâchée.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {etudiant.gachees.map((g) => {
          const parAge = agregerParAge(g.eprouvettes ?? []).filter((a) => a.moyenneKpa !== null);
          const mesurees = (g.eprouvettes ?? []).filter((e) => contrainteKpa(e.essai) !== null).length;
          return (
            <div key={g.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                {g.code} <span style={{ fontWeight: 400, color: "#64748b" }}>· {g.formulationLabel} · {g.categorie} · {dateCourte(g.creeLe)}</span>
                {g.conflit && <span style={{ marginLeft: 8, fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 999, padding: "1px 7px" }}>copie de conflit</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "#475569", marginTop: 3 }}>
                {mesurees}/{(g.eprouvettes ?? []).length} éprouvette(s) mesurée(s)
                {parAge.length > 0 && " · UCS : " + parAge.map((a) => `${a.ageJours} j = ${Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")} kPa (n=${a.n})`).join(" ; ")}
              </div>
              <Commentaires liste={commentaires("gachee", g.id)} onRetirer={onRetirer}
                ancres={(g.eprouvettes ?? []).map((e) => e.code)}
                onAjouter={(texte, ancre) => onAnnoter({ kind: "gachee", id: g.id, rev: revDe("gachee", g.id), ancre, texte })} />
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 8px" }}>Résultats sauvegardés ({etudiant.resultats.length})</h3>
      {etudiant.resultats.length === 0 && <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucun résultat.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {etudiant.resultats.map((r) => (
          <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {r.label} <span style={{ fontWeight: 400, color: "#64748b" }}>· {r.category} · {r.method} · {(r.recipes ?? []).length} recette(s) · {dateCourte(r.savedAt)}</span>
            </div>
            <Commentaires liste={commentaires("resultat", r.id)} onRetirer={onRetirer} ancres={[]}
              onAjouter={(texte) => onAnnoter({ kind: "resultat", id: r.id, rev: revDe("resultat", r.id), ancre: null, texte })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Commentaires({ liste, onAjouter, onRetirer, ancres }: {
  liste: LigneAnnotation[];
  onAjouter: (texte: string, ancre: string | null) => Promise<void>;
  onRetirer: (id: string) => Promise<void>;
  ancres: string[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [ancre, setAncre] = useState("");
  const [occupe, setOccupe] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      {liste.map((a) => (
        <div key={a.id} style={{ fontSize: 12.5, color: "#3730a3", background: "#eef2ff", borderRadius: 6, padding: "6px 9px", marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{a.ancre ? <strong>{a.ancre} — </strong> : null}{a.texte}</span>
          <button type="button" onClick={() => void onRetirer(a.id)}
            style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
            Retirer
          </button>
        </div>
      ))}
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)}
          style={{ marginTop: 6, background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 12.5, padding: 0 }}>
          + Commenter
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {ancres.length > 0 && (
            <select value={ancre} onChange={(e) => setAncre(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 12.5, alignSelf: "flex-start" }}>
              <option value="">Toute la gâchée</option>
              {ancres.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} rows={3}
            placeholder="Votre commentaire (visible par cet étudiant seulement)"
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" style={{ fontSize: 12.5 }} disabled={occupe || !texte.trim()}
              onClick={async () => {
                setOccupe(true);
                await onAjouter(texte.trim(), ancre || null);
                setOccupe(false);
                setTexte(""); setAncre(""); setOuvert(false);
              }}>
              {occupe ? "…" : "Publier le commentaire"}
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => { setOuvert(false); setTexte(""); }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
