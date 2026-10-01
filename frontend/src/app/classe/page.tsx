"use client";

// Tableau de bord de la classe (enseignant) : le travail de chaque étudiant,
// la figure UCS de la classe, les commentaires, et l'export de la classe.
//
// Tout est lu EN MÉMOIRE à l'ouverture (lire_docs_classe, projection allégée,
// filtrée par session) : rien n'est versé dans le stockage local de
// l'enseignant, qui garde son propre travail intact. Un document ouvert en
// entier est relu à la demande (lireDocComplet).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import { sessionActive, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import FiltreSession from "@/components/FiltreSession";
import { cleLigne, exportClasse, regrouper, type EtudiantClasse, type LigneClasse, type ProfilClasse } from "@/lib/classe";
import {
  ajouterAnnotation, estReponse, lireAnnotationsClasse, lireClasse, lireDocComplet, lireProfils, lireRevuesClasse, marquerAnnotationsLues,
  messageErreurClasse, poserRevue, retirerAnnotation, retirerRevue, type LigneAnnotation,
} from "@/lib/classe-reseau";
import { cleRevue, indexerRevues, infoRevue, type RevueClasse } from "@/lib/revues";
import type { ActionsRevue } from "@/components/classe/CarteRevue";
import { rafraichirReponsesNonLues } from "@/lib/sync-client";
import { nomFichier, telechargerBlob, telechargerTexte, versCsv } from "@/lib/export-fig";
import { lignesCsvEprouvettes, lignesCsvSynthese } from "@/lib/classe-csv";
import { construireJeuEssais, jeuEssaisJson, lignesCsvDictionnaire, lignesCsvTable } from "@/lib/jeu-essais";
import { pseudonymes } from "@/lib/pseudonyme";
import { documentRapportClasse, documentRapportEtudiant, type ContexteRapport, type DocumentRapport } from "@/lib/rapport-classe";
import { COULEURS, type RefDoc } from "@/components/classe/commun";
import TableauEtudiants from "@/components/classe/TableauEtudiants";
import DetailEtudiant, { reponsesNonLues, type ContexteFil, type NouvelleAnnotation } from "@/components/classe/DetailEtudiant";
import FigureClasse from "@/components/classe/FigureClasse";
import VueDocument, { type EtatDoc } from "@/components/classe/VueDocument";
import Onglets from "@/components/classe/Onglets";
import OngletComparaison from "@/components/classe/OngletComparaison";
import { comparerClasse } from "@/lib/classe-comparaison";
import { alertesClasse } from "@/lib/classe-alertes";
import { echeancierClasse, icsClasse, lignesCsvEcheancier } from "@/lib/classe-echeancier";
import OngletEcheancier from "@/components/classe/OngletEcheancier";
import OngletComptes from "@/components/classe/OngletComptes";
import CarteAlertes from "@/components/classe/CarteAlertes";
import { resumeClasse } from "@/lib/classe-resume";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import { BandeChiffres } from "@/components/ui/Chiffres";
import Menu from "@/components/ui/Menu";
import { Icone } from "@/components/ui/Icones";

type CleOnglet = "etudiants" | "echeancier" | "comparaison" | "comptes";

export default function ClassePage() {
  const monte = useHydrated();
  const session = useStore((s) => s.session);
  const sessions = useStore((s) => s.sessions);
  const units = useStore((s) => s.units);
  const loadUnits = useStore((s) => s.loadUnits);
  // Catalogues de l'enseignant : décrivent les matériaux du jeu d'essais.
  const catalogueResidus = useStore((s) => s.catalogue_residus);
  const catalogueGranulats = useStore((s) => s.catalogue_granulats);
  const catalogueLiants = useStore((s) => s.catalogue_liants);
  const ajouterMateriauOfficiel = useStore((s) => s.ajouterMateriauOfficiel);
  const maintenant = useAujourdhui();
  const [filtre, setFiltre] = useState<FiltreSessionValeur | null>(null);
  const [lignes, setLignes] = useState<LigneClasse[]>([]);
  const [profils, setProfils] = useState<ProfilClasse[]>([]);
  const [annotations, setAnnotations] = useState<LigneAnnotation[]>([]);
  // Revues des gâchées (décisions de l'enseignant). null : base pas à jour,
  // la classe s'affiche quand même, sans revues.
  const [revues, setRevues] = useState<Map<string, RevueClasse> | null>(new Map());
  // Réponses non lues au chargement : restent en évidence pendant la visite,
  // même une fois marquées lues.
  const [nouvelles, setNouvelles] = useState<Set<string>>(() => new Set());
  const [etat, setEtat] = useState<"attente" | "chargement" | "pret" | "erreur">("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [doc, setDoc] = useState<EtatDoc | null>(null);
  const [onglet, setOnglet] = useState<CleOnglet>("etudiants");
  const jetonDoc = useRef(0);

  const estProf = session?.role === "prof";
  // Par défaut : la session active (sinon toutes). Choisi une fois les
  // sessions connues ; ensuite, c'est l'enseignant qui décide.
  const enCours = sessionActive(sessions, maintenant);
  const filtreEffectif: FiltreSessionValeur = filtre ?? (enCours?.id ?? "toutes");
  const sessionServeur = filtreEffectif === "toutes" || filtreEffectif === "sans" ? null : filtreEffectif;

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const charger = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setEtat("chargement");
    setErreur(null);
    try {
      const [l, p, a, r] = await Promise.all([
        lireClasse(sb, { complet: false, session: sessionServeur }),
        lireProfils(sb),
        lireAnnotationsClasse(sb),
        lireRevuesClasse(sb),
      ]);
      setLignes(l);
      setProfils(p);
      setAnnotations(a);
      setRevues(r === null ? null : indexerRevues(r));
      setNouvelles(new Set(a.filter((x) => estReponse(x) && !x.lu_le).map((x) => x.id)));
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
  const revs = useMemo(() => new Map(lignes.map((l) => [cleLigne(l), l.rev])), [lignes]);
  const revueDe = revues
    ? (ownerId: string, gacheeId: string) => infoRevue(revues, (o, id) => revs.get(cleLigne({ proprietaire: o, kind: "gachee", id })), ownerId, gacheeId)
    : undefined;
  const comparaison = useMemo(() => comparerClasse(etudiants), [etudiants]);
  const alertes = useMemo(() => alertesClasse(etudiants, {
    maintenant, comparaison,
    sessionActiveAffichee: enCours !== null && filtreEffectif === enCours.id,
    debutSessionActive: enCours?.debut ?? null,
  }), [etudiants, maintenant, comparaison, enCours, filtreEffectif]);
  const echeances = useMemo(() => echeancierClasse(etudiants, maintenant), [etudiants, maintenant]);
  const alertesParEtudiant = new Map<string, number>();
  for (const a of alertes) alertesParEtudiant.set(a.etudiantId, (alertesParEtudiant.get(a.etudiantId) ?? 0) + 1);

  /** Réponses d'étudiants affichées : accusé de lecture (l'étudiant voit « vu »). */
  const marquerLues = (ids: string[]) => {
    const sb = getSupabase();
    if (!sb || ids.length === 0) return;
    marquerAnnotationsLues(sb, ids)
      .then((lus) => {
        const m = new Map(lus.map((x) => [x.id, x.luLe]));
        if (m.size > 0) setAnnotations((l) => l.map((a) => (m.has(a.id) ? { ...a, lu_le: m.get(a.id) } : a)));
        void rafraichirReponsesNonLues();
      })
      .catch(() => { /* base pas à jour ou réseau : sans conséquence, réessayé à la prochaine ouverture */ });
  };

  /** Ouvre un document en entier : relu en ligne (la classe est allégée). */
  const ouvrirDoc = (ref: RefDoc) => {
    const sb = getSupabase();
    if (!sb) return;
    marquerLues(reponsesNonLues(annotations.filter((a) =>
      a.owner_id === ref.etudiantId && a.target_kind === ref.kind && a.target_id === ref.id)));
    const jeton = ++jetonDoc.current;
    setDoc({ ref, etat: "chargement" });
    document.querySelector(".ui-page")?.scrollTo({ top: 0 });
    lireDocComplet(sb, ref.etudiantId, ref.kind, ref.id)
      .then((d) => { if (jeton === jetonDoc.current) setDoc(d ? { ref, etat: "pret", doc: d } : { ref, etat: "absent" }); })
      .catch((e) => { if (jeton === jetonDoc.current) setDoc({ ref, etat: "erreur", message: messageErreurClasse(e) }); });
  };
  const fermerDoc = () => { jetonDoc.current++; setDoc(null); };

  const annoter = (proprietaire: string) => async (a: NouvelleAnnotation): Promise<boolean> => {
    const sb = getSupabase();
    if (!sb || !session) return false;
    try {
      const cree = await ajouterAnnotation(sb, { ...a, ownerId: proprietaire, auteurId: session.userId });
      setAnnotations((l) => [...l, cree]);
      return true;
    } catch (e) {
      window.alert(`Commentaire non enregistré : ${messageErreurClasse(e)}. Votre texte est conservé.`);
      return false;
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

  const ctx: ContexteFil = { moi: session?.userId ?? "", nouvelles, onLire: marquerLues, onRetirer: retirer };

  const libelleSession = filtreEffectif === "toutes" ? "Toutes les sessions" : filtreEffectif === "sans" ? "Sans session"
    : sessions.find((x) => x.id === filtreEffectif)?.nom ?? filtreEffectif;

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

  /** CSV depuis la classe déjà lue (valeurs mesurées ; copies de conflit exclues). */
  const exporterCsv = (quoi: "eprouvettes" | "synthese") => {
    const lignesCsv = quoi === "eprouvettes" ? lignesCsvEprouvettes(etudiants, sessions, revueDe) : lignesCsvSynthese(etudiants, sessions, revueDe);
    telechargerTexte(versCsv(lignesCsv), nomFichier(`MineBackfill_classe_${quoi}_${filtreEffectif}`, "csv"), "text/csv;charset=utf-8");
  };

  /**
   * Jeu d'essais PSEUDONYMISÉ (recherche, modèles) depuis la classe déjà lue :
   * ni nom ni courriel (voir lib/jeu-essais.ts et docs/DICTIONNAIRE_DONNEES.md).
   */
  const exporterJeuEssais = async (format: "csv" | "json", seulementAcceptees = false) => {
    try {
      const jeu = construireJeuEssais({
        etudiants, sessions, sessionLibelle: libelleSession,
        pseudonymes: await pseudonymes(etudiants.map((e) => e.id)),
        catalogues: { residus: catalogueResidus, granulats: catalogueGranulats, liants: catalogueLiants },
        maintenant: new Date(), revueDe, seulementAcceptees,
      });
      const nom = nomFichier(`MineBackfill_jeu-essais${seulementAcceptees ? "-acceptees" : ""}_${filtreEffectif}`, format);
      if (format === "json") {
        telechargerBlob(new Blob([JSON.stringify(jeuEssaisJson(jeu), null, 2)], { type: "application/json" }), nom);
      } else {
        telechargerTexte(versCsv(lignesCsvTable(jeu, "essais")), nom, "text/csv;charset=utf-8");
      }
    } catch (e) {
      window.alert(`Export impossible : ${messageErreurClasse(e)}`);
    }
  };
  /** Décision de l'enseignant sur une gâchée : écrite par RPC, jamais dans la gâchée. */
  const actionsRevue = (ref: RefDoc, rev: number | null): ActionsRevue => ({
    disponible: revues !== null,
    onPoser: async (d) => {
      const sb = getSupabase();
      if (!sb) return false;
      try {
        const r = await poserRevue(sb, { ownerId: ref.etudiantId, id: ref.id, rev, ...d });
        setRevues((m) => new Map(m ?? []).set(cleRevue(r.ownerId, r.id), r));
        return true;
      } catch (e) {
        window.alert(`Revue non enregistrée : ${messageErreurClasse(e)}`);
        return false;
      }
    },
    onRetirer: async () => {
      const sb = getSupabase();
      if (!sb) return false;
      try {
        await retirerRevue(sb, ref.etudiantId, ref.id);
        setRevues((m) => {
          const n = new Map(m ?? []);
          n.delete(cleRevue(ref.etudiantId, ref.id));
          return n;
        });
        return true;
      } catch (e) {
        window.alert(`Retrait impossible : ${messageErreurClasse(e)}`);
        return false;
      }
    },
  });

  const exporterDictionnaire = () =>
    telechargerTexte(versCsv(lignesCsvDictionnaire()), nomFichier("MineBackfill_dictionnaire-donnees", "csv"), "text/csv;charset=utf-8");

  const exporterIcs = () => {
    // Horodatage réel de l'export (dans un gestionnaire : pas de gel par le compilateur).
    telechargerBlob(new Blob([icsClasse(echeances, new Date())], { type: "text/calendar;charset=utf-8" }),
      nomFichier(`MineBackfill_classe_echeances_${filtreEffectif}`, "ics"));
  };
  const exporterCsvEcheancier = () =>
    telechargerTexte(versCsv(lignesCsvEcheancier(echeances)), nomFichier(`MineBackfill_classe_echeances_${filtreEffectif}`, "csv"), "text/csv;charset=utf-8");

  /** Rapport PDF (jsPDF chargé à la demande) : la classe, ou un étudiant. */
  const exporterPdf = async (e?: EtudiantClasse) => {
    const ctxRapport: ContexteRapport = {
      session: libelleSession,
      genereLe: new Date(), alertes, comparaison, annotations, moi: session?.userId ?? "",
    };
    const d: DocumentRapport = e ? documentRapportEtudiant(e, ctxRapport) : documentRapportClasse(etudiants, ctxRapport);
    try {
      const { telechargerRapportPdf } = await import("@/lib/rapport-classe-pdf");
      await telechargerRapportPdf(d, nomFichier(e ? `MineBackfill_rapport_${e.nom}` : `MineBackfill_rapport_classe_${filtreEffectif}`, "pdf"));
    } catch (err) {
      window.alert(`Rapport impossible : ${messageErreurClasse(err)}`);
    }
  };

  if (!monte) return null;
  if (!cloudConfigure() || !estProf) {
    return (
      <Page>
        <EnTetePage titre="Classe" />
        <Carte>
          <p className="classe-rien">
            Ce tableau de bord est réservé à l&apos;enseignant connecté.{" "}
            <Link href="/compte">Se connecter</Link>
          </p>
        </Carte>
      </Page>
    );
  }

  const sel = etudiants.find((e) => e.id === selId) ?? null;
  const resume = resumeClasse(etudiants, echeances, annotations, revueDe);

  return (
    <Page>
      {doc ? (
        <VueDocument doc={doc} etudiant={etudiants.find((e) => e.id === doc.ref.etudiantId)}
          annotations={annotations} onAnnoter={annoter(doc.ref.etudiantId)} ctx={ctx}
          onRetour={fermerDoc} maintenant={maintenant} units={units}
          catalogue={{ residus: catalogueResidus, granulats: catalogueGranulats, onAjouter: ajouterMateriauOfficiel }}
          revue={doc.ref.kind === "gachee" ? revues?.get(cleRevue(doc.ref.etudiantId, doc.ref.id)) : undefined}
          actionsRevue={doc.ref.kind === "gachee" ? actionsRevue(doc.ref, doc.etat === "pret" ? doc.doc.rev : null) : undefined} />
      ) : (
        <>
          <EnTetePage
            titre="Classe"
            sousTitre="Le travail sauvegardé en ligne par chaque étudiant, en lecture seule. Vos commentaires apparaissent chez l'étudiant concerné, et chez lui seulement."
            actions={
              <>
                <FiltreSession sessions={sessions} valeur={filtreEffectif} onChange={(v) => { setFiltre(v); setSelId(null); }} />
                <Menu
                  className="btn-secondary"
                  declencheur={<>{exportEnCours ? "Export…" : "Exporter"} <span className="ui-chevron-bas"><Icone nom="chevron" taille={11} epaisseur={2.4} /></span></>}
                  titre="Données d'étudiants : à ranger hors de GitHub"
                  elements={[
                    { libelle: "Éprouvettes (CSV)", detail: "Une ligne par éprouvette (valeurs mesurées), pour Excel", desactive: etat !== "pret", onSelect: () => exporterCsv("eprouvettes") },
                    { libelle: "Synthèse (CSV)", detail: "Par gâchée et par âge : n, moyenne, écart-type, CV", desactive: etat !== "pret", onSelect: () => exporterCsv("synthese") },
                    { libelle: "Classe (JSON)", detail: "Copie de sauvegarde (Supabase gratuit n'en fait aucune)", desactive: exportEnCours || etat !== "pret", onSelect: () => void exporter() },
                    "separateur",
                    { libelle: "Jeu d'essais (CSV)", detail: "Pseudonymisé : sans nom ni courriel. Une ligne par éprouvette, pour la recherche et les modèles", desactive: etat !== "pret", onSelect: () => void exporterJeuEssais("csv") },
                    { libelle: "Jeu d'essais (JSON)", detail: "Pseudonymisé : essais, gâchées, matériaux, manifeste et dictionnaire", desactive: etat !== "pret", onSelect: () => void exporterJeuEssais("json") },
                    { libelle: "Jeu d'essais, gâchées acceptées (CSV)", detail: "Seulement les gâchées que vous avez acceptées, non modifiées depuis", desactive: etat !== "pret" || revues === null, onSelect: () => void exporterJeuEssais("csv", true) },
                    { libelle: "Jeu d'essais, gâchées acceptées (JSON)", detail: "Même sélection, avec le manifeste et le dictionnaire", desactive: etat !== "pret" || revues === null, onSelect: () => void exporterJeuEssais("json", true) },
                    { libelle: "Dictionnaire des données (CSV)", detail: "Le sens et l'unité de chaque colonne du jeu d'essais", onSelect: exporterDictionnaire },
                  ]}
                />
                <button type="button" className="btn-sombre" onClick={() => void exporterPdf()} disabled={etat !== "pret"}
                  title="Synthèse de la classe puis un chapitre par étudiant (documents de la session affichée). Contient des données d'étudiants : à ranger hors de GitHub.">
                  Rapport de session
                </button>
                <button type="button" className="btn-discret" onClick={() => void charger()} disabled={etat === "chargement"}>
                  <Icone nom="actualiser" taille={14} epaisseur={2.2} />
                  {etat === "chargement" ? "Lecture…" : "Actualiser"}
                </button>
              </>
            }
          />

          {etat === "erreur" && (
            <Bandeau ton="danger" role="alert">
              Lecture de la classe impossible : {erreur}. Rien n&apos;est affiché plutôt qu&apos;une classe vide trompeuse ; réessayez avec « Actualiser ».
            </Bandeau>
          )}
          {etat === "chargement" && lignes.length === 0 && <p className="classe-rien">Lecture de la classe…</p>}

          {etat === "pret" && (
            <>
              <Onglets<CleOnglet> actif={onglet} onChoisir={setOnglet} onglets={[
                { cle: "etudiants", label: "Étudiants", compte: alertes.length || null },
                { cle: "echeancier", label: "Échéancier", compte: echeances.filter((x) => x.classe === "retard" || x.classe === "aujourdhui").length || null },
                { cle: "comparaison", label: "Comparaison", compte: comparaison.groupes.length || null },
                { cle: "comptes", label: "Comptes" },
              ]} />
              {onglet === "etudiants" && (
                <>
                  <BandeChiffres ariaLabel="Résumé de la classe" chiffres={[
                    { libelle: "Essais valides", valeur: resume.essaisValides },
                    { libelle: "Gâchées", valeur: resume.gachees },
                    { libelle: "À écraser aujourd'hui", valeur: resume.aEcraser, ton: resume.enRetard > 0 ? "danger" : "normal",
                      detail: resume.enRetard > 0 ? `dont ${resume.enRetard} en retard` : undefined },
                    { libelle: "Réponses non lues", valeur: resume.reponsesNonLues, ton: resume.reponsesNonLues > 0 ? "accent" : "normal" },
                    ...(resume.aRevoir !== null ? [{ libelle: "Gâchées à revoir", valeur: resume.aRevoir, ton: resume.aRevoir > 0 ? "alerte" as const : "normal" as const,
                      detail: "terminées, sans décision ou modifiées depuis" }] : []),
                  ]} />
                  <div className="classe-grille">
                    <CarteAlertes alertes={alertes} onOuvrir={ouvrirDoc} />
                    <div className="classe-colonne">
                      <TableauEtudiants etudiants={etudiants} annotations={annotations} selId={selId} onChoisir={setSelId}
                        couleurDe={couleurDe} alertesParEtudiant={alertesParEtudiant} />
                      {sel && (
                        <DetailEtudiant etudiant={sel} annotations={annotations} lignes={lignes}
                          onAnnoter={annoter(sel.id)} ctx={ctx} onOuvrir={ouvrirDoc} onRapport={() => void exporterPdf(sel)}
                          revueDe={revueDe ? (id) => revueDe(sel.id, id) : undefined} />
                      )}
                    </div>
                  </div>
                  <FigureClasse etudiants={etudiants} couleurDe={couleurDe} />
                </>
              )}
              {onglet === "echeancier" && (
                <OngletEcheancier echeances={echeances} onOuvrir={ouvrirDoc} onIcs={exporterIcs} onCsv={exporterCsvEcheancier} />
              )}
              {onglet === "comparaison" && <OngletComparaison comparaison={comparaison} onOuvrir={ouvrirDoc} />}
              {onglet === "comptes" && <OngletComptes moi={session.userId} onChangement={() => void charger()} />}
            </>
          )}
        </>
      )}
    </Page>
  );
}
