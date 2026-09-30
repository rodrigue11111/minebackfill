"use client";

// Page « Diagnostic technique » : un instantané local (application, backend,
// stockage, navigateur) que l'étudiant copie et colle dans un courriel ou un
// clavardage. Rien n'est transmis automatiquement — le débogage à distance se
// fait sans accès à la machine.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { APP_NAME_VERSION, MODULE_ID } from "@/lib/branding";
import { SOLVER_VERSION, useStore } from "@/lib/store";
import { packById, solverVersionActive } from "@/lib/conventions";
import { useHydrated } from "@/lib/use-hydrated";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import { Pastille, type TonPastille } from "@/components/ui/Pastille";

type EtatBackend = "verification" | "operationnel" | "injoignable";

interface EntreeStockage {
  cle: string;
  taille_ko: number;
  /** Version d'enveloppe {v, data}, ou « brut » si le contenu n'est pas enveloppé. */
  version: string;
  /** Nombre d'éléments si `data` est un tableau, sinon null. */
  nb_elements: number | null;
}

/** Inventaire des clés localStorage de l'application (préfixe minebackfill_). */
function lireStockageLocal(): EntreeStockage[] {
  const entrees: EntreeStockage[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i);
    if (!cle || !cle.startsWith("minebackfill_")) continue;
    const brut = localStorage.getItem(cle) ?? "";
    const tailleKo = Math.round((new Blob([brut]).size / 1024) * 10) / 10;
    let version = "brut";
    let nbElements: number | null = null;
    try {
      const parse: unknown = JSON.parse(brut);
      if (
        parse !== null &&
        typeof parse === "object" &&
        "v" in parse &&
        "data" in parse
      ) {
        const enveloppe = parse as { v: unknown; data: unknown };
        version = String(enveloppe.v);
        if (Array.isArray(enveloppe.data)) nbElements = enveloppe.data.length;
      }
    } catch {
      // Contenu non JSON : reste « brut ».
    }
    entrees.push({ cle, taille_ko: tailleKo, version, nb_elements: nbElements });
  }
  entrees.sort((a, b) => a.cle.localeCompare(b.cle));
  return entrees;
}

export default function DiagnosticPage() {
  const hydrated = useHydrated();
  const constantes = useStore((s) => s.constantes);
  const loadConstantes = useStore((s) => s.loadConstantes);

  // Comme StoreHydrator : recharge les constantes persistées au montage, sinon
  // la page afficherait le pack par défaut au lieu du pack réellement actif.
  useEffect(() => {
    loadConstantes();
  }, [loadConstantes]);

  // ── Vérification du backend ──
  // On envoie volontairement un corps vide à POST /rpc/cw (le proxy Next
  // réécrit /rpc vers FastAPI). FastAPI répond alors 422 (validation Pydantic),
  // ce qui est la réponse ATTENDUE : TOUTE réponse HTTP — 200, 422, même 500 —
  // prouve que le backend est joignable et répond. Seule une exception réseau
  // (serveur arrêté, proxy cassé) signifie « Backend injoignable ».
  const [etatBackend, setEtatBackend] = useState<EtatBackend>("verification");
  const [latenceMs, setLatenceMs] = useState<number | null>(null);
  useEffect(() => {
    const debut = performance.now();
    fetch("/rpc/cw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(() => {
        setLatenceMs(Math.round(performance.now() - debut));
        setEtatBackend("operationnel");
      })
      .catch(() => {
        setLatenceMs(null);
        setEtatBackend("injoignable");
      });
  }, []);

  // Lectures client-only (localStorage, navigator) : uniquement après
  // hydratation pour éviter tout mismatch serveur/client.
  const stockage = useMemo<EntreeStockage[]>(
    () => (hydrated ? lireStockageLocal() : []),
    [hydrated]
  );
  const totalKo = Math.round(stockage.reduce((t, e) => t + e.taille_ko, 0) * 10) / 10;
  const navigateur = useMemo(
    () =>
      hydrated
        ? { user_agent: navigator.userAgent, langue: navigator.language }
        : null,
    [hydrated]
  );

  const packActif = packById(constantes.pack_id);
  const packLabel = packActif ? packActif.label : "Personnalisé";
  const estampille = solverVersionActive(constantes);

  const backendTexte =
    etatBackend === "verification"
      ? "Vérification en cours…"
      : etatBackend === "operationnel"
        ? `Backend opérationnel${latenceMs !== null ? ` (${latenceMs} ms)` : ""}`
        : "Backend injoignable";
  const backendTon: TonPastille =
    etatBackend === "verification"
      ? "neutre"
      : etatBackend === "operationnel"
        ? "succes"
        : "danger";

  // ── Copie du diagnostic ──
  const [copie, setCopie] = useState(false);
  const copierDiagnostic = () => {
    const diagnostic = {
      date: new Date().toISOString(),
      application: {
        nom: APP_NAME_VERSION,
        module: MODULE_ID,
        solveur_reference: SOLVER_VERSION,
        pack_convention: constantes.pack_id,
        pack_label: packLabel,
        estampille_solveur: estampille,
      },
      backend: {
        etat: etatBackend,
        latence_ms: latenceMs,
      },
      stockage_local: stockage,
      stockage_total_ko: totalKo,
      navigateur,
    };
    navigator.clipboard
      .writeText(JSON.stringify(diagnostic, null, 2))
      .then(() => {
        setCopie(true);
        window.setTimeout(() => setCopie(false), 2000);
      })
      .catch(() => {
        window.alert(
          "Copie impossible dans ce navigateur. Sélectionnez et copiez le contenu de la page manuellement."
        );
      });
  };

  return (
    <Page etroite>
      <EnTetePage
        titre="Diagnostic technique"
        sousTitre={<>Cette page rassemble les informations utiles au dépannage à distance.
          Cliquez sur « Copier le diagnostic » puis collez le résultat dans votre
          message à l&apos;enseignant ou à l&apos;assistant.</>}
        actions={
          <>
            <Link href="/reglages" className="btn-discret">Retour aux réglages</Link>
            <button type="button" className="btn-primary" onClick={copierDiagnostic}>
              {copie ? "Copié" : "Copier le diagnostic"}
            </button>
          </>
        }
      />

      {/* ── Application ── */}
      <Carte titre="Application">
        <ListeGroupee>
          <LigneListe libelle="Application" valeur={`${APP_NAME_VERSION} — ${MODULE_ID}`} />
          <LigneListe libelle="Solveur (référence)" valeur={SOLVER_VERSION} />
          <LigneListe libelle="Estampille du solveur actif" valeur={hydrated ? estampille : "…"} />
        </ListeGroupee>
      </Carte>

      {/* ── Backend ── */}
      <Carte titre="Backend">
        <ListeGroupee
          pied="La vérification envoie une requête vide au serveur de calcul : toute réponse (même une erreur de validation) confirme qu'il est joignable."
        >
          <LigneListe libelle="État du serveur de calcul" accent={<Pastille point ton={backendTon} />} valeur={backendTexte} />
        </ListeGroupee>
      </Carte>

      {/* ── Stockage local ── */}
      <Carte titre="Stockage local">
        {!hydrated ? (
          <p className="classe-rien">Lecture…</p>
        ) : stockage.length === 0 ? (
          <p className="classe-rien">
            Aucune donnée MineBackfill dans ce navigateur.
          </p>
        ) : (
          <>
            <div className="mix-tableau-defilant">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Clé</th>
                    <th style={{ textAlign: "right" }}>Taille (Ko)</th>
                    <th style={{ textAlign: "right" }}>Version</th>
                    <th style={{ textAlign: "right" }}>Éléments</th>
                  </tr>
                </thead>
                <tbody>
                  {stockage.map((e) => (
                    <tr key={e.cle}>
                      <td style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5 }}>{e.cle}</td>
                      <td style={{ textAlign: "right" }}>{e.taille_ko.toFixed(1)}</td>
                      <td style={{ textAlign: "right" }}>{e.version}</td>
                      <td style={{ textAlign: "right" }}>{e.nb_elements ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ui-liste-pied" style={{ margin: 0 }}>
              Total : <strong>{totalKo.toFixed(1)} Ko</strong>. La plupart des navigateurs
              plafonnent vers 5 000 Ko par site ; au-delà, les modifications ne sont plus
              enregistrées et un bandeau rouge l&apos;annonce.
            </p>
          </>
        )}
      </Carte>

      {/* ── Navigateur ── */}
      <Carte titre="Navigateur">
        <ListeGroupee
          pied="Rien n'est envoyé : ces informations restent sur votre machine tant que vous ne les partagez pas."
        >
          <LigneListe libelle="Agent utilisateur" detail={navigateur ? navigateur.user_agent : "…"} />
          <LigneListe libelle="Langue" valeur={navigateur ? navigateur.langue : "…"} />
        </ListeGroupee>
      </Carte>
    </Page>
  );
}
