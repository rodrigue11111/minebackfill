"use client";

import React, { useRef, useState } from "react";
import { exporterDonnees, importerDonnees } from "@/lib/backup";
import { useStore } from "@/lib/store";

/**
 * Boutons « Exporter / Importer les données (.json) » — sauvegarde de tout
 * le contenu localStorage : résultats, prix des liants, journal, unités,
 * catalogues, et depuis le schéma 4 les GÂCHÉES (éprouvettes et essais UCS
 * compris) et les PROTOCOLES de laboratoire.
 *
 * ATTENTION, écart volontaire : depuis le 2026-09-27, ni l'infobulle du
 * bouton ni le texte de la page Réglages ne nomment plus les prix des liants
 * et le journal de production, le module Industrie ayant été retiré de la
 * navigation. Les deux textes décrivent le reste explicitement. L'export, lui,
 * CONTIENT toujours ces données — ne pas « corriger » exporterDonnees() pour
 * le faire coïncider avec les textes : ce sont les données des utilisateurs,
 * et rien d'autre n'en garde copie (voir supabase/README.md : ni
 * production_log ni les mesures de labo ne sont synchronisés).
 */
export default function BackupButtons() {
  const {
    loadSavedResults, loadBinderPrices, loadProductionLog, loadUnits,
    loadCatalogue, loadConstantes, loadGeneral, loadMaterials,
    loadGachees, loadProtocoles,
  } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    const res = await importerDonnees(f);
    setMessage({ ok: res.ok, texte: res.message });
    if (res.ok) {
      loadSavedResults();
      loadBinderPrices();
      loadProductionLog();
      loadUnits();
      loadCatalogue();
      loadConstantes();
      loadGeneral();
      loadMaterials();
      // Sans ces deux appels l'import réussit mais la page Labo reste vide
      // jusqu'au prochain rechargement complet.
      loadGachees();
      loadProtocoles();
    }
    setTimeout(() => setMessage(null), 6000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => exporterDonnees()}
        title="Télécharge un fichier JSON contenant toutes vos données locales : résultats sauvegardés, mesures de laboratoire (gâchées, éprouvettes, essais UCS), protocoles, réglages et unités"
      >
        Exporter les données (.json)
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => fileRef.current?.click()}
        title="Restaure une sauvegarde : les entrées sont fusionnées, les réglages remplacés"
      >
        Importer…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          onImport(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && (
        <span role={message.ok ? "status" : "alert"} style={{ fontSize: 13.5, fontWeight: 600, color: message.ok ? "var(--succes-texte)" : "var(--danger-texte)" }}>
          {message.texte}
        </span>
      )}
    </div>
  );
}
