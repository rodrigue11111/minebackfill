"use client";

// Tableau de bord de la classe (enseignant) : le travail de chaque étudiant,
// la figure UCS de la classe, les commentaires, et l'export de la classe.
//
// Tout est lu EN MÉMOIRE à l'ouverture (lire_docs_classe, projection allégée,
// filtrée par session) : rien n'est versé dans le stockage local de
// l'enseignant, qui garde son propre travail intact. Un document ouvert en
// entier est relu à la demande (lireDocComplet).
//
// Démonstration (/classe?demo=1, 2026-10-26) : la même page sur une classe
// FICTIVE en mémoire (lib/classe-demo.ts), sans compte, sans appel réseau ni
// rien d'enregistré. Toutes les lectures et écritures passent par une
// SourceClasse (lib/classe-source.ts) : Supabase, ou la démonstration. Le
// tableau de bord est monté sous une clé de mode, et un contrôleur de
// chargement ignore toute réponse dépassée (lib/classe-chargement.ts).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { getSupabase, cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { useAujourdhui } from "@/lib/use-aujourdhui";
import { sessionActive, type FiltreSession as FiltreSessionValeur } from "@/lib/sessions";
import FiltreSession from "@/components/FiltreSession";
import {
  avecFormulationsDeToutesSessions, cleLigne, eprouvettesAvecCourbe, exportClasse, regrouper, remplacerLigne,
  type EtudiantClasse, type LigneClasse, type ProfilClasse,
} from "@/lib/classe";
import { estReponse, messageErreurClasse, type LigneAnnotation } from "@/lib/classe-reseau";
import { sourceSupabase, type SourceClasse } from "@/lib/classe-source";
import { chargerClasse, creerControleur } from "@/lib/classe-chargement";
import { classeDemo, marquerCsvDemo, marquerJsonDemo, marquerRapportDemo, MENTION_DEMO, sourceDemo } from "@/lib/classe-demo";
import { decoderCourbe } from "@/lib/courbes";
import { mentionHorsFenetre } from "@/lib/eprouvette";
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

// useSearchParams dans une page prérendue exige une frontière Suspense.
export default function ClassePage() {
  return (
    <Suspense fallback={null}>
      <ClasseSelonMode />
    </Suspense>
  );
}

/** Une instance par mode : passer de la classe réelle à la démonstration remonte tout l'état. */
function ClasseSelonMode() {
  const demo = useSearchParams().get("demo") === "1";
  return <TableauClasse key={demo ? "demo" : "reel"} demo={demo} />;
}

function TableauClasse({ demo }: { demo: boolean }) {
  const monte = useHydrated();
  const session = useStore((s) => s.session);
  const sessionsStore = useStore((s) => s.sessions);
  const units = useStore((s) => s.units);
  const loadUnits = useStore((s) => s.loadUnits);
  // Catalogues de l'enseignant : décrivent les matériaux du jeu d'essais.
  const catalogueResidus = useStore((s) => s.catalogue_residus);
  const catalogueGranulats = useStore((s) => s.catalogue_granulats);
  const catalogueLiants = useStore((s) => s.catalogue_liants);
  const ajouterMateriauOfficiel = useStore((s) => s.ajouterMateriauOfficiel);
  const maintenant = useAujourdhui();
  // Démonstration : classe fictive et sa source en mémoire, créées une fois.
  const [demoEtat] = useState(() => {
    if (!demo) return null;
    const donnees = classeDemo(maintenant);
    return { donnees, source: sourceDemo(donnees) };
  });
  const sb = demoEtat ? null : getSupabase();
  const source: SourceClasse | null = useMemo(
    () => (demoEtat ? demoEtat.source : sb ? sourceSupabase(sb) : null),
    [demoEtat, sb],
  );
  const [controleur] = useState(creerControleur);
  // Une instance démontée (changement de mode) n'accepte plus aucune réponse.
  useEffect(() => () => controleur.invalider(), [controleur]);
  const sessions = demoEtat ? demoEtat.donnees.sessions : sessionsStore;
  const moi = demoEtat ? demoEtat.donnees.moi : session?.userId ?? "";
  const suffixe = demoEtat ? "_demo" : "";
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
  const [erreurRevues, setErreurRevues] = useState<string | null>(null);
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
    if (!source) return;
    setEtat("chargement");
    setErreur(null);
    setErreurRevues(null);
    try {
      // Revues en échec (autre chose qu'une base pas à jour, qui rend null) :
      // la classe s'affiche quand même, sans revues. Réponse dépassée : null.
      const r = await chargerClasse(source, { session: sessionServeur }, controleur);
      if (!r) return;
      if (r.erreurRevues) setErreurRevues(messageErreurClasse(r.erreurRevues));
      setLignes(r.lignes);
      setProfils(r.profils);
      setAnnotations(r.annotations);
      setRevues(r.revues === null ? null : indexerRevues(r.revues));
      setNouvelles(new Set(r.annotations.filter((x) => estReponse(x) && !x.lu_le).map((x) => x.id)));
      setEtat("pret");
    } catch (e) {
      // Une lecture en échec n'est JAMAIS montrée comme une classe vide.
      setErreur(messageErreurClasse(e));
      setEtat("erreur");
    }
  }, [source, sessionServeur, controleur]);

  useEffect(() => {
    if (monte && (demo || estProf)) void charger();
  }, [monte, demo, estProf, charger]);

  const etudiants = useMemo(
    () => regrouper(lignes, profils, sessions, filtreEffectif),
    [lignes, profils, sessions, filtreEffectif],
  );
  const couleurDe = new Map(etudiants.map((e, i) => [e.id, COULEURS[i % COULEURS.length]]));
  const revs = useMemo(() => new Map(lignes.map((l) => [cleLigne(l), l.rev])), [lignes]);
  /** Revue d'une gâchée, jugée sur les révisions de `rv` (la classe affichée, ou une lecture fraîche). */
  const revueSur = (rv: Map<string, number>) => revues
    ? (ownerId: string, gacheeId: string) => infoRevue(revues, (o, id) => rv.get(cleLigne({ proprietaire: o, kind: "gachee", id })), ownerId, gacheeId)
    : undefined;
  const revueDe = revueSur(revs);
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
    if (!source || ids.length === 0) return;
    source.marquerAnnotationsLues(ids)
      .then((lus) => {
        const m = new Map(lus.map((x) => [x.id, x.luLe]));
        if (m.size > 0) setAnnotations((l) => l.map((a) => (m.has(a.id) ? { ...a, lu_le: m.get(a.id) } : a)));
        // Compteur global de la barre : jamais en démonstration (rien de réel n'a changé).
        if (!source.demonstration) void rafraichirReponsesNonLues();
      })
      .catch(() => { /* base pas à jour ou réseau : sans conséquence, réessayé à la prochaine ouverture */ });
  };

  /** Ouvre un document en entier : relu en ligne (la classe est allégée). */
  const ouvrirDoc = (ref: RefDoc) => {
    if (!source) return;
    marquerLues(reponsesNonLues(annotations.filter((a) =>
      a.owner_id === ref.etudiantId && a.target_kind === ref.kind && a.target_id === ref.id)));
    const jeton = ++jetonDoc.current;
    setDoc({ ref, etat: "chargement" });
    document.querySelector(".ui-page")?.scrollTo({ top: 0 });
    source.lireDocComplet(ref.etudiantId, ref.kind, ref.id)
      .then((d) => {
        // La version relue remplace celle de la classe : la revue, les CSV
        // et l'export « gâchées acceptées » portent alors sur cette version
        // (sinon une revue posée ici semblerait porter sur l'ancienne).
        if (d && !d.supprime) {
          setLignes((ls) => remplacerLigne(ls, { proprietaire: ref.etudiantId, kind: ref.kind, id: ref.id, rev: d.rev, maj: d.maj,
            cree: ls.find((l) => cleLigne(l) === cleLigne({ proprietaire: ref.etudiantId, kind: ref.kind, id: ref.id }))?.cree ?? d.maj,
            supprime: false, contenu: d.contenu }));
        }
        if (jeton === jetonDoc.current) setDoc(d ? { ref, etat: "pret", doc: d } : { ref, etat: "absent" });
      })
      .catch((e) => { if (jeton === jetonDoc.current) setDoc({ ref, etat: "erreur", message: messageErreurClasse(e) }); });
  };
  const fermerDoc = () => { jetonDoc.current++; setDoc(null); };

  const annoter = (proprietaire: string) => async (a: NouvelleAnnotation): Promise<boolean> => {
    if (!source || !moi) return false;
    try {
      const cree = await source.ajouterAnnotation({ ...a, ownerId: proprietaire, auteurId: moi });
      setAnnotations((l) => [...l, cree]);
      return true;
    } catch (e) {
      window.alert(`Commentaire non enregistré : ${messageErreurClasse(e)}. Votre texte est conservé.`);
      return false;
    }
  };
  // Confirmé dans le fil (ConfirmationEnLigne), pas par window.confirm.
  const retirer = async (id: string) => {
    if (!source) return;
    try {
      await source.retirerAnnotation(id);
      setAnnotations((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      window.alert(`Retrait impossible : ${messageErreurClasse(e)}`);
    }
  };

  const ctx: ContexteFil = { moi, nouvelles, onLire: marquerLues, onRetirer: retirer };

  const libelleSession = filtreEffectif === "toutes" ? "Toutes les sessions" : filtreEffectif === "sans" ? "Sans session"
    : sessions.find((x) => x.id === filtreEffectif)?.nom ?? filtreEffectif;

  const exporter = async () => {
    if (!source) return;
    setExportEnCours(true);
    try {
      const exportes = regrouper(await source.lireClasse({ complet: true, session: sessionServeur }), profils, sessions, filtreEffectif);
      const courbes = await source.lireCourbesClasse(true, exportes.map((e) => e.id));
      const donnees = exportClasse(exportes, filtreEffectif, new Date(), courbes, revues ? [...revues.values()] : undefined);
      telechargerBlob(new Blob([JSON.stringify(demoEtat ? marquerJsonDemo(donnees as object) : donnees, null, 2)], { type: "application/json" }),
        nomFichier(`MineBackfill_classe${suffixe}_${filtreEffectif}`, "json"));
    } catch (e) {
      window.alert(`Export impossible : ${messageErreurClasse(e)}`);
    } finally {
      setExportEnCours(false);
    }
  };

  /** CSV depuis la classe déjà lue (valeurs mesurées ; copies de conflit exclues). */
  const exporterCsv = (quoi: "eprouvettes" | "synthese") => {
    const lignesCsv = quoi === "eprouvettes" ? lignesCsvEprouvettes(etudiants, sessions, revueDe) : lignesCsvSynthese(etudiants, sessions, revueDe);
    telechargerTexte(versCsv(demoEtat ? marquerCsvDemo(lignesCsv) : lignesCsv),
      nomFichier(`MineBackfill_classe${suffixe}_${quoi}_${filtreEffectif}`, "csv"), "text/csv;charset=utf-8");
  };

  /**
   * Jeu d'essais PSEUDONYMISÉ (recherche, modèles) : ni nom ni courriel (voir
   * lib/jeu-essais.ts et docs/DICTIONNAIRE_DONNEES.md). Relu EN ENTIER (la
   * classe affichée est allégée : sans les entrées du calcul), sur toutes les
   * sessions pour les formulations d'origine ; les revues sont jugées sur
   * cette lecture fraîche.
   */
  const exporterJeuEssais = async (format: "csv" | "json", seulementAcceptees = false) => {
    if (!source) return;
    setExportEnCours(true);
    try {
      const complet = await source.lireClasse({ complet: true, session: null });
      const exportes = avecFormulationsDeToutesSessions(
        regrouper(complet, profils, sessions, filtreEffectif), regrouper(complet, profils, sessions, "toutes"));
      // Qui a une courbe en ligne (colonne courbe_en_ligne) ; en échec, la
      // colonne reste vide plutôt que de bloquer l'export.
      const courbesEnLigne = await source.lireCourbesClasse(false, exportes.map((e) => e.id))
        .then((l) => eprouvettesAvecCourbe(exportes, l), () => undefined);
      const jeu = construireJeuEssais({
        etudiants: exportes, sessions, sessionLibelle: libelleSession, courbesEnLigne,
        pseudonymes: await pseudonymes(exportes.map((e) => e.id)),
        catalogues: { residus: catalogueResidus, granulats: catalogueGranulats, liants: catalogueLiants },
        maintenant: new Date(), revueDe: revueSur(new Map(complet.map((l) => [cleLigne(l), l.rev]))), seulementAcceptees,
      });
      const nom = nomFichier(`MineBackfill_jeu-essais${seulementAcceptees ? "-acceptees" : ""}${suffixe}_${filtreEffectif}`, format);
      if (format === "json") {
        const json = jeuEssaisJson(jeu) as object;
        telechargerBlob(new Blob([JSON.stringify(demoEtat ? marquerJsonDemo(json) : json, null, 2)], { type: "application/json" }), nom);
      } else {
        const lignesJeu = lignesCsvTable(jeu, "essais");
        telechargerTexte(versCsv(demoEtat ? marquerCsvDemo(lignesJeu) : lignesJeu), nom, "text/csv;charset=utf-8");
      }
    } catch (e) {
      window.alert(`Export impossible : ${messageErreurClasse(e)}`);
    } finally {
      setExportEnCours(false);
    }
  };
  /** Décision de l'enseignant sur une gâchée : écrite par RPC, jamais dans la gâchée. */
  const actionsRevue = (ref: RefDoc, rev: number | null): ActionsRevue => ({
    // revues null sans erreur : lireRevuesClasse a reconnu une base sans la
    // table des revues ; avec une erreur : autre panne, dite telle quelle.
    disponibilite: revues !== null ? { etat: "ok" } : erreurRevues ? { etat: "erreur", message: erreurRevues } : { etat: "base" },
    onPoser: async (d) => {
      if (!source) return false;
      try {
        const r = await source.poserRevue({ ownerId: ref.etudiantId, id: ref.id, rev, ...d });
        setRevues((m) => new Map(m ?? []).set(cleRevue(r.ownerId, r.id), r));
        return true;
      } catch (e) {
        window.alert(`Revue non enregistrée : ${messageErreurClasse(e)}`);
        return false;
      }
    },
    onRetirer: async () => {
      if (!source) return false;
      try {
        await source.retirerRevue(ref.etudiantId, ref.id);
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
    telechargerBlob(new Blob([icsClasse(echeances, new Date(), { demonstration: !!demoEtat })], { type: "text/calendar;charset=utf-8" }),
      nomFichier(`MineBackfill_classe${suffixe}_echeances_${filtreEffectif}`, "ics"));
  };
  const exporterCsvEcheancier = () => {
    // Même « maintenant » que l'écran : le fichier donne les mêmes jours restants, et le dit.
    const l = lignesCsvEcheancier(echeances, maintenant);
    telechargerTexte(versCsv(demoEtat ? marquerCsvDemo(l) : l),
      nomFichier(`MineBackfill_classe${suffixe}_echeances_${filtreEffectif}`, "csv", maintenant), "text/csv;charset=utf-8");
  };

  /** Rapport PDF (jsPDF chargé à la demande) : la classe, ou un étudiant. */
  const exporterPdf = async (e?: EtudiantClasse) => {
    const ctxRapport: ContexteRapport = {
      session: libelleSession,
      genereLe: new Date(), alertes, comparaison, annotations, moi,
    };
    const brut: DocumentRapport = e ? documentRapportEtudiant(e, ctxRapport) : documentRapportClasse(etudiants, ctxRapport);
    const d = demoEtat ? marquerRapportDemo(brut) : brut;
    try {
      const { telechargerRapportPdf } = await import("@/lib/rapport-classe-pdf");
      await telechargerRapportPdf(d, nomFichier(e ? `MineBackfill_rapport${suffixe}_${e.nom}` : `MineBackfill_rapport${suffixe}_classe_${filtreEffectif}`, "pdf"));
    } catch (err) {
      window.alert(`Rapport impossible : ${messageErreurClasse(err)}`);
    }
  };

  if (!monte) return null;
  if (!demo && (!cloudConfigure() || !estProf)) {
    return (
      <Page>
        <EnTetePage titre="Classe" />
        <Carte>
          <p className="classe-rien">
            Ce tableau de bord est réservé à l&apos;enseignant connecté.{" "}
            <Link href="/compte">Se connecter</Link>
          </p>
          <p className="classe-rien">
            Pour voir ce qu&apos;il permet sans compte :{" "}
            <Link href="/classe?demo=1">voir une démonstration (classe fictive)</Link>.
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
          catalogue={demoEtat ? undefined : { residus: catalogueResidus, granulats: catalogueGranulats, onAjouter: ajouterMateriauOfficiel }}
          demonstration={!!demoEtat}
          revue={doc.ref.kind === "gachee" ? revues?.get(cleRevue(doc.ref.etudiantId, doc.ref.id)) : undefined}
          chargerCourbe={async (e) => {
            const c = source ? await source.lireCourbe(doc.ref.etudiantId, e.id, e.essai?.sourcePresse?.importeLe) : null;
            return c ? { points: decoderCourbe(c.courbe), origineNonVerifiee: c.origineNonVerifiee } : null;
          }}
          actionsRevue={doc.ref.kind === "gachee" ? actionsRevue(doc.ref, doc.etat === "pret" ? doc.doc.rev : null) : undefined} />
      ) : (
        <>
          <EnTetePage
            titre="Classe"
            sousTitre={demoEtat
              ? "Démonstration sur une classe fictive : le tableau de bord tel que l'enseignant le voit."
              : "Le travail sauvegardé en ligne par chaque étudiant, en lecture seule. Vos commentaires apparaissent chez l'étudiant concerné, et chez lui seulement."}
            actions={
              <>
                <FiltreSession sessions={sessions} valeur={filtreEffectif} onChange={(v) => { setFiltre(v); setSelId(null); }} />
                <Menu
                  className="btn-secondary"
                  declencheur={<>{exportEnCours ? "Export…" : "Exporter"} <span className="ui-chevron-bas"><Icone nom="chevron" taille={11} epaisseur={2.4} /></span></>}
                  titre={demoEtat ? "Démonstration : chaque fichier porte la mention des données fictives" : "Données d'étudiants : à ranger hors de GitHub"}
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

          {demoEtat && (
            <Bandeau ton="info" titre="Démonstration : classe fictive de 7 étudiants.">
              {MENTION_DEMO} Rien n&apos;est enregistré : vos revues et commentaires disparaissent au rechargement.
              Non inclus : courbes de presse, changements de rôle et blocage de comptes, exports d&apos;un calcul.{" "}
              <Link href="/classe">Quitter la démonstration</Link>
            </Bandeau>
          )}
          {etat === "erreur" && (
            <Bandeau ton="danger" role="alert">
              Lecture de la classe impossible : {erreur}. Rien n&apos;est affiché plutôt qu&apos;une classe vide trompeuse ; réessayez avec « Actualiser ».
            </Bandeau>
          )}
          {etat === "pret" && erreurRevues && (
            <Bandeau ton="alerte" role="status">
              Revues indisponibles : {erreurRevues}. La classe s&apos;affiche sans elles ; « Actualiser » les relit.
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
                    { libelle: "Essais valides", valeur: resume.essaisValides, ton: resume.essaisHorsFenetre > 0 ? "alerte" : "normal",
                      detail: mentionHorsFenetre(resume.essaisHorsFenetre) || undefined },
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
                        <DetailEtudiant etudiant={sel} annotations={annotations}
                          onOuvrir={ouvrirDoc} onRapport={() => void exporterPdf(sel)}
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
              {onglet === "comptes" && <OngletComptes moi={moi} source={source} onChangement={() => void charger()} />}
            </>
          )}
        </>
      )}
    </Page>
  );
}
