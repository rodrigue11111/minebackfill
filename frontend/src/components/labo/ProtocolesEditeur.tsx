"use client";

// Édition des protocoles de laboratoire (procédures maintenues par le prof).
// Chaque nouvelle gâchée en fige une copie (traçabilité).

import type { Protocole } from "@/lib/protocole";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { nouvelId } from "./outils";

export default function ProtocolesEditeur({ protocoles, onAjouter, onModifier, onSupprimer, onReinitialiser }: {
  protocoles: Protocole[];
  onAjouter: (p: Protocole) => void;
  onModifier: (id: string, patch: Partial<Protocole>) => void;
  onSupprimer: (id: string) => void;
  onReinitialiser: () => void;
}) {
  const ajouter = () => onAjouter({ id: nouvelId(), titre: "Nouveau protocole", contenu: "", majLe: new Date().toISOString() });
  const reinitialiser = () => {
    if (window.confirm("Remplacer les protocoles actuels par les procédures de départ ? Les gâchées déjà créées ne sont pas touchées.")) onReinitialiser();
  };
  return (
    <>
      <Bandeau ton="neutre">
        Ces procédures sont éditables. Chaque nouvelle gâchée en <strong>fige une copie</strong> : modifier un protocole ici
        ne change jamais celui d&apos;une gâchée déjà créée (traçabilité).
      </Bandeau>
      {protocoles.map((p) => (
        <Carte key={p.id} titre={p.titre || "Protocole"}
          aside={p.majLe ? `Modifié le ${new Date(p.majLe).toLocaleDateString("fr-CA")}` : undefined}
          actions={
            <button type="button" onClick={() => { if (window.confirm(`Supprimer le protocole « ${p.titre || "sans titre"} » ?`)) onSupprimer(p.id); }}
              className="btn-discret btn-danger">Supprimer</button>
          }>
          <Champ libelle="Titre">
            <input className="field-input" value={p.titre}
              onChange={(e) => onModifier(p.id, { titre: e.target.value, majLe: new Date().toISOString() })} />
          </Champ>
          <Champ libelle="Contenu">
            <textarea className="field-input" rows={7}
              value={p.contenu} onChange={(e) => onModifier(p.id, { contenu: e.target.value, majLe: new Date().toISOString() })} />
          </Champ>
        </Carte>
      ))}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={ajouter} className="btn-secondary">Ajouter un protocole</button>
        <button type="button" onClick={reinitialiser} className="btn-discret">Réinitialiser aux procédures par défaut</button>
      </div>
    </>
  );
}
