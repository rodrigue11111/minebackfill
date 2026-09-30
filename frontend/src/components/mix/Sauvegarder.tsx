"use client";

// Bouton « Sauvegarder » et sa feuille de nommage, partagés par les résultats
// RPC/RPG et RRC (avant : deux copies divergentes dans ResultsPanel).

import { useState } from "react";
import Feuille from "@/components/ui/Feuille";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";

export default function Sauvegarder({ onSave, nomParDefaut, desactive = false }: {
  /** Enregistre sous ce nom ; faux si le stockage local a refusé l'écriture. */
  onSave: (nom: string) => boolean;
  nomParDefaut: string;
  desactive?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [nom, setNom] = useState("");
  const [issue, setIssue] = useState<"ok" | "erreur" | null>(null);

  const ouvrir = () => { setNom(""); setIssue(null); setOuverte(true); };
  const enregistrer = () => setIssue(onSave(nom.trim() || nomParDefaut) ? "ok" : "erreur");

  return (
    <>
      <button type="button" className="btn-sombre" onClick={ouvrir} disabled={desactive}>
        Sauvegarder
      </button>
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre="Sauvegarder le résultat">
        {issue ? (
          <>
            <Bandeau ton={issue === "ok" ? "succes" : "danger"} role={issue === "ok" ? "status" : "alert"}>
              {issue === "ok"
                ? "Sauvegarde effectuée : le résultat est dans l'Historique."
                : "Sauvegarde locale impossible (stockage plein ou bloqué) — exportez vos données depuis Réglages."}
            </Bandeau>
            <button type="button" className="btn-secondary" onClick={() => setOuverte(false)}>Fermer</button>
          </>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); enregistrer(); }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <Champ libelle="Nom de la sauvegarde" aide="Laissé vide, le nom proposé est utilisé.">
              <input
                type="text"
                className="field-input"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={nomParDefaut}
                autoFocus
              />
            </Champ>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary" onClick={() => setOuverte(false)}>Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        )}
      </Feuille>
    </>
  );
}
