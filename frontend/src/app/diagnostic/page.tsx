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

const ligneStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: "7px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 13.5,
};
const etiquetteStyle: React.CSSProperties = { color: "var(--muted-foreground)" };
const valeurStyle: React.CSSProperties = {
  fontWeight: 600,
  textAlign: "right",
  wordBreak: "break-word",
};

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <div style={ligneStyle}>
      <span style={etiquetteStyle}>{etiquette}</span>
      <span style={valeurStyle}>{valeur}</span>
    </div>
  );
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
  const backendCouleur =
    etatBackend === "verification"
      ? "var(--muted-foreground)"
      : etatBackend === "operationnel"
        ? "#15803d"
        : "#b91c1c";

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
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div className="form-card">
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            Diagnostic technique
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, margin: 0 }}>
            Cette page rassemble les informations utiles au dépannage à distance.
            Cliquez sur « Copier le diagnostic » puis collez le résultat dans votre
            message à l&apos;enseignant ou à l&apos;assistant.
          </p>
        </div>

        {/* ── Application ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Application</h2>
          <Ligne etiquette="Application" valeur={`${APP_NAME_VERSION} — ${MODULE_ID}`} />
          <Ligne etiquette="Solveur (référence)" valeur={SOLVER_VERSION} />
          <Ligne
            etiquette="Pack de convention actif"
            valeur={hydrated ? `${packLabel} (${constantes.pack_id})` : "…"}
          />
          <Ligne etiquette="Estampille du solveur actif" valeur={hydrated ? estampille : "…"} />
        </div>

        {/* ── Backend ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Backend</h2>
          <div style={{ ...ligneStyle, borderBottom: "none" }}>
            <span style={etiquetteStyle}>État du serveur de calcul</span>
            <span style={{ ...valeurStyle, color: backendCouleur }}>{backendTexte}</span>
          </div>
          <p style={{ color: "var(--muted-foreground)", fontSize: 12.5, margin: "6px 0 0" }}>
            La vérification envoie une requête vide au serveur de calcul : toute
            réponse (même une erreur de validation) confirme qu&apos;il est joignable.
          </p>
        </div>

        {/* ── Stockage local ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Stockage local</h2>
          {!hydrated ? (
            <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Lecture…</p>
          ) : stockage.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: 0 }}>
              Aucune donnée MineBackfill dans ce navigateur.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Clé", "Taille (Ko)", "Version", "Éléments"].map((titre, i) => (
                      <th
                        key={titre}
                        style={{
                          textAlign: i === 0 ? "left" : "right",
                          padding: "6px 8px",
                          borderBottom: "2px solid var(--border)",
                          color: "var(--muted-foreground)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {titre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockage.map((e) => (
                    <tr key={e.cle}>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12 }}>
                        {e.cle}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                        {e.taille_ko.toFixed(1)}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                        {e.version}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                        {e.nb_elements ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Navigateur ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Navigateur</h2>
          <Ligne etiquette="Agent utilisateur" valeur={navigateur ? navigateur.user_agent : "…"} />
          <Ligne etiquette="Langue" valeur={navigateur ? navigateur.langue : "…"} />
        </div>

        {/* ── Copie ── */}
        <div className="form-card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" onClick={copierDiagnostic}>
              {copie ? "Copié" : "Copier le diagnostic"}
            </button>
            <Link href="/reglages" className="btn-secondary" style={{ textDecoration: "none" }}>
              Retour aux réglages
            </Link>
          </div>
          <p style={{ color: "var(--muted-foreground)", fontSize: 12.5, margin: "10px 0 0" }}>
            Rien n&apos;est envoyé : ces informations restent sur votre machine tant que
            vous ne les partagez pas.
          </p>
        </div>
      </div>
    </div>
  );
}
