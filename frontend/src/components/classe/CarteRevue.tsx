"use client";

// Revue d'une gâchée par l'enseignant : accepter, refuser (motif obligatoire),
// écarter des éprouvettes, retirer la décision. La décision est écrite dans la
// table `revues`, jamais dans la gâchée de l'étudiant, qui la voit dans son
// Labo (pastille et bandeau).

import { useState } from "react";
import type { Gachee } from "@/lib/gachee";
import { contrainteKpa } from "@/lib/eprouvette";
import { LIBELLE_DECISION, type DecisionRevue, type InfoRevue } from "@/lib/revues";
import { Carte } from "@/components/labo/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import { Champ } from "@/components/ui/Champ";
import { dateCourte, nombre, Pastille } from "./commun";

export interface ActionsRevue {
  /** La base connaît les revues (sinon : exécuter supabase/schema.sql). */
  disponible: boolean;
  onPoser: (d: { decision: DecisionRevue; motif: string | null; ecartees: string[] }) => Promise<boolean>;
  onRetirer: () => Promise<boolean>;
}

export default function CarteRevue({ gachee: g, revue, actions }: {
  gachee: Gachee;
  revue: InfoRevue | undefined;
  actions: ActionsRevue;
}) {
  const [motif, setMotif] = useState(revue?.motif ?? "");
  const [ecartees, setEcartees] = useState<Set<string>>(() => new Set(revue?.ecartees ?? []));
  const [occupe, setOccupe] = useState(false);
  const idMotif = `revue-motif-${g.id}`;

  if (!actions.disponible) {
    return (
      <Carte titre="Revue de l'enseignant">
        <Bandeau ton="alerte">
          La revue n&apos;est pas encore disponible : la base de données n&apos;est pas à jour. Exécutez
          supabase/schema.sql dans SQL Editor (voir docs/OPERATIONS.md).
        </Bandeau>
      </Carte>
    );
  }

  const ecrasees = [...g.eprouvettes].filter((e) => e.statut === "ecrase").sort((a, b) => a.code.localeCompare(b.code));
  const motifOk = motif.trim().length > 0;
  const agir = async (f: () => Promise<boolean>) => {
    setOccupe(true);
    try { await f(); } finally { setOccupe(false); }
  };
  const poser = (decision: DecisionRevue) => agir(() => actions.onPoser({ decision, motif: motif.trim() || null, ecartees: [...ecartees] }));

  return (
    <Carte titre="Revue de l'enseignant">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {revue ? (
            <>
              <Pastille ton={revue.decision === "acceptee" ? "vert" : "rouge"}>Revue : {LIBELLE_DECISION[revue.decision]}</Pastille>
              <span style={{ color: "var(--texte-2)" }}>le {dateCourte(revue.maj)}</span>
              {revue.perimee && (
                <Pastille ton="ambre" title="L'étudiant a modifié la gâchée depuis votre décision : à revoir.">Modifiée depuis la revue</Pastille>
              )}
            </>
          ) : g.statut === "terminee" ? (
            <span>Gâchée marquée terminée par l&apos;étudiant : en attente de votre revue.</span>
          ) : (
            <span style={{ color: "var(--texte-2)" }}>Gâchée encore en brouillon : l&apos;étudiant ne l&apos;a pas marquée terminée.</span>
          )}
        </p>

        {ecrasees.length > 0 && (
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <legend style={{ fontSize: 13, color: "var(--texte-2)", marginBottom: 4 }}>
              Écarter des éprouvettes (signalées dans le jeu d&apos;essais ; la gâchée n&apos;est pas modifiée)
            </legend>
            {ecrasees.map((e) => {
              const ucs = contrainteKpa(e.essai);
              return (
                <label key={e.id} className="mix-case">
                  <input type="checkbox" checked={ecartees.has(e.id)} disabled={occupe}
                    onChange={(ev) => setEcartees((s) => {
                      const n = new Set(s);
                      if (ev.target.checked) n.add(e.id); else n.delete(e.id);
                      return n;
                    })} />
                  Écarter {e.code}{ucs !== null ? ` (${nombre(ucs, 0)} kPa)` : ""}
                </label>
              );
            })}
          </fieldset>
        )}

        <Champ libelle="Motif (obligatoire pour un refus)" htmlFor={idMotif} aide="Visible par l'étudiant, avec la décision.">
          <textarea id={idMotif} className="field-input" rows={3} maxLength={2000} value={motif} disabled={occupe}
            onChange={(e) => setMotif(e.target.value)} />
        </Champ>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn-primary" disabled={occupe} onClick={() => void poser("acceptee")}>
            Accepter la gâchée
          </button>
          <button type="button" className="btn-secondary" disabled={occupe || !motifOk}
            title={motifOk ? undefined : "Indiquez d'abord le motif du refus"} onClick={() => void poser("refusee")}>
            Refuser la gâchée
          </button>
          {revue && (
            <button type="button" className="btn-discret" disabled={occupe} onClick={() => void agir(actions.onRetirer)}>
              Retirer la revue
            </button>
          )}
        </div>
      </div>
    </Carte>
  );
}
