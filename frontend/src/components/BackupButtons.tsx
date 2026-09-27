"use client";

import React, { useRef, useState } from "react";
import { exporterDonnees, importerDonnees } from "@/lib/backup";
import { useStore } from "@/lib/store";

/**
 * Boutons « Exporter / Importer les données (.json) » — sauvegarde de tout
 * le contenu localStorage (résultats, prix des liants, journal, unités).
 *
 * ATTENTION, écart volontaire : depuis le 2026-09-27, ni l'infobulle du
 * bouton ni le texte de la page Réglages ne nomment plus les prix des liants
 * et le journal de production, le module Industrie ayant été retiré de la
 * navigation. Les deux textes décrivent désormais l'ensemble de façon
 * générale. L'export, lui, CONTIENT toujours ces données — ne pas
 * « corriger » exporterDonnees() pour le faire coïncider avec les textes :
 * ce sont les données des utilisateurs, et rien d'autre n'en garde copie
 * (voir supabase/README.md : production_log n'est pas synchronisé).
 */
export default function BackupButtons() {
  const {
    loadSavedResults, loadBinderPrices, loadProductionLog, loadUnits,
    loadCatalogue, loadConstantes, loadGeneral, loadMaterials,
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
    }
    setTimeout(() => setMessage(null), 6000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn-secondary"
        style={{ padding: "7px 14px", fontSize: 12.5 }}
        onClick={() => exporterDonnees()}
        title="Télécharge un fichier JSON contenant toutes vos données locales : résultats sauvegardés, réglages et unités"
      >
        Exporter les données (.json)
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ padding: "7px 14px", fontSize: 12.5 }}
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
        <span style={{ fontSize: 12, fontWeight: 600, color: message.ok ? "#16a34a" : "#dc2626" }}>
          {message.texte}
        </span>
      )}
    </div>
  );
}
