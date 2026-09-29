"use client";

// Tableau de bord de la classe (enseignant) : le travail de chaque étudiant,
// la figure UCS de la classe, les commentaires, et l'export de la classe.
//
// Tout est lu EN MÉMOIRE à l'ouverture (lire_docs_classe, projection allégée,
// filtrée par session) : rien n'est versé dans le stockage local de
// l'enseignant, qui garde son propre travail intact. Un document ouvert en
// entier est relu à la demande (lireDocComplet).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import { sessionActive, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import FiltreSession from "@/components/FiltreSession";
import { exportClasse, regrouper, type LigneClasse, type ProfilClasse } from "@/lib/classe";
import {
  ajouterAnnotation, lireAnnotationsClasse, lireClasse, lireDocComplet, lireProfils, messageErreurClasse,
  retirerAnnotation, type LigneAnnotation,
} from "@/lib/classe-reseau";
import { nomFichier, telechargerBlob } from "@/lib/export-fig";
import { COULEURS, type RefDoc } from "@/components/classe/commun";
import TableauEtudiants from "@/components/classe/TableauEtudiants";
import DetailEtudiant, { type NouvelleAnnotation } from "@/components/classe/DetailEtudiant";
import FigureClasse from "@/components/classe/FigureClasse";
import VueDocument, { type EtatDoc } from "@/components/classe/VueDocument";

export default function ClassePage() {
  const monte = useHydrated();
  const session = useStore((s) => s.session);
  const sessions = useStore((s) => s.sessions);
  const units = useStore((s) => s.units);
  const loadUnits = useStore((s) => s.loadUnits);
  const maintenant = useAujourdhui();
  const [filtre, setFiltre] = useState<FiltreSessionValeur | null>(null);
  const [lignes, setLignes] = useState<LigneClasse[]>([]);
  const [profils, setProfils] = useState<ProfilClasse[]>([]);
  const [annotations, setAnnotations] = useState<LigneAnnotation[]>([]);
  const [etat, setEtat] = useState<"attente" | "chargement" | "pret" | "erreur">("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [doc, setDoc] = useState<EtatDoc | null>(null);
  const jetonDoc = useRef(0);
  const defilement = useRef<HTMLDivElement>(null);

  const estProf = session?.role === "prof";
  // Par défaut : la session active (sinon toutes). Choisi une fois les
  // sessions connues ; ensuite, c'est l'enseignant qui décide.
  const filtreEffectif: FiltreSessionValeur = filtre ?? (sessionActive(sessions, new Date())?.id ?? "toutes");
  const sessionServeur = filtreEffectif === "toutes" || filtreEffectif === "sans" ? null : filtreEffectif;

  useEffect(() => { loadUnits(); }, [loadUnits]);

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
      setErreur(messageErreurClasse(e));
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
  const couleurDe = new Map(etudiants.map((e, i) => [e.id, COULEURS[i % COULEURS.length]]));

  /** Ouvre un document en entier : relu en ligne (la classe est allégée). */
  const ouvrirDoc = (ref: RefDoc) => {
    const sb = getSupabase();
    if (!sb) return;
    const jeton = ++jetonDoc.current;
    setDoc({ ref, etat: "chargement" });
    defilement.current?.scrollTo({ top: 0 });
    lireDocComplet(sb, ref.etudiantId, ref.kind, ref.id)
      .then((d) => { if (jeton === jetonDoc.current) setDoc(d ? { ref, etat: "pret", doc: d } : { ref, etat: "absent" }); })
      .catch((e) => { if (jeton === jetonDoc.current) setDoc({ ref, etat: "erreur", message: messageErreurClasse(e) }); });
  };
  const fermerDoc = () => { jetonDoc.current++; setDoc(null); };

  const annoter = (proprietaire: string) => async (a: NouvelleAnnotation) => {
    const sb = getSupabase();
    if (!sb || !session) return;
    try {
      const cree = await ajouterAnnotation(sb, { ...a, ownerId: proprietaire, auteurId: session.userId });
      setAnnotations((l) => [...l, cree]);
    } catch (e) {
      window.alert(`Commentaire non enregistré : ${messageErreurClasse(e)}`);
    }
  };
  const retirer = async (id: string) => {
    const sb = getSupabase();
    if (!sb || !window.confirm("Retirer ce commentaire ? L'étudiant ne le verra plus.")) return;
    try {
      await retirerAnnotation(sb, id);
      setAnnotations((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      window.alert(`Retrait impossible : ${messageErreurClasse(e)}`);
    }
  };

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
      window.alert(`Export impossible : ${messageErreurClasse(e)}`);
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
    <div ref={defilement} style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={conteneur}>
        {doc ? (
          <VueDocument doc={doc} etudiant={etudiants.find((e) => e.id === doc.ref.etudiantId)}
            annotations={annotations} onAnnoter={annoter(doc.ref.etudiantId)} onRetirer={retirer}
            onRetour={fermerDoc} maintenant={maintenant} units={units} />
        ) : (
          <>
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
                <TableauEtudiants etudiants={etudiants} annotations={annotations} selId={selId} onChoisir={setSelId} couleurDe={couleurDe} />
                {sel && (
                  <DetailEtudiant etudiant={sel} annotations={annotations} lignes={lignes}
                    onAnnoter={annoter(sel.id)} onRetirer={retirer} onOuvrir={ouvrirDoc} />
                )}
                <FigureClasse etudiants={etudiants} couleurDe={couleurDe} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
