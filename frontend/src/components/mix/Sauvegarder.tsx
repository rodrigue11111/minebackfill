"use client";

// Bouton « Sauvegarder » et sa feuille de nommage, partagés par les résultats
// RPC/RPG et RRC (avant : deux copies divergentes dans ResultsPanel).

import { useState } from "react";
import Link from "next/link";
import Feuille from "@/components/ui/Feuille";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { nomDejaPris } from "@/lib/nom-sauvegarde";

export default function Sauvegarder({ onSave, nomParDefaut, desactive = false, nomsExistants }: {
  /** Enregistre sous ce nom (`remplacer` : met à jour l'homonyme) ; faux si le stockage local a refusé l'écriture. */
  onSave: (nom: string, remplacer?: boolean) => boolean;
  nomParDefaut: string;
  desactive?: boolean;
  /** Noms des résultats déjà sauvegardés : un nom déjà pris demande « Remplacer l'ancien » ou « Garder les deux ». */
  nomsExistants?: () => string[];
}) {
  const [ouverte, setOuverte] = useState(false);
  const [nom, setNom] = useState("");
  const [issue, setIssue] = useState<"ok" | "remplace" | "erreur" | null>(null);
  const [existants, setExistants] = useState<string[]>([]);
  const doublon = nomDejaPris(nom.trim() || nomParDefaut, existants);

  const ouvrir = () => { setNom(""); setIssue(null); setExistants(nomsExistants?.() ?? []); setOuverte(true); };
  const enregistrer = (remplacer = false) =>
    setIssue(onSave(nom.trim() || nomParDefaut, remplacer) ? (remplacer ? "remplace" : "ok") : "erreur");

  return (
    <>
      <button type="button" className="btn-sombre" onClick={ouvrir} disabled={desactive}>
        Sauvegarder
      </button>
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre="Sauvegarder le résultat">
        {issue ? (
          <>
            <Bandeau ton={issue === "erreur" ? "danger" : "succes"} role={issue === "erreur" ? "alert" : "status"}>
              {issue === "ok"
                ? "Sauvegarde effectuée : le résultat est dans Mes calculs."
                : issue === "remplace"
                  ? "Résultat remplacé : l'entrée de même nom de Mes calculs est mise à jour."
                  : "Sauvegarde locale impossible (stockage plein ou bloqué). Exportez vos données depuis Réglages."}
            </Bandeau>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {issue !== "erreur" && <Link href="/historique" className="btn-discret">Ouvrir Mes calculs</Link>}
              <button type="button" className="btn-secondary" onClick={() => setOuverte(false)}>Fermer</button>
            </div>
          </>
        ) : (
          <form
            // Nom déjà pris : Entrée seule n'enregistre rien, il faut choisir.
            onSubmit={(e) => { e.preventDefault(); if (!doublon) enregistrer(); }}
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
            {doublon && (
              <Bandeau ton="alerte" role="status" titre="Un résultat porte déjà ce nom.">
                Remplacer l&apos;ancien met à jour cette entrée de Mes calculs ; garder les deux en ajoute une seconde.
                Ou changez le nom.
              </Bandeau>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" onClick={() => setOuverte(false)}>Annuler</button>
              {doublon ? (
                <>
                  <button type="button" className="btn-secondary" onClick={() => enregistrer(false)}>Garder les deux</button>
                  <button type="button" className="btn-primary" onClick={() => enregistrer(true)}>Remplacer l&apos;ancien</button>
                </>
              ) : (
                <button type="submit" className="btn-primary">Enregistrer</button>
              )}
            </div>
          </form>
        )}
      </Feuille>
    </>
  );
}
