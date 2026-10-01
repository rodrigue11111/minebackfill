// Onglet « Échéancier » : les éprouvettes de toute la classe à écraser.

import { useState } from "react";
import type { EcheanceClasse } from "@/lib/classe-echeancier";
import { COULEUR_ECHEANCE, fmtDate } from "@/lib/echeance-affichage";
import { lienBouton, td, th, type RefDoc } from "./commun";
import { Carte } from "@/components/ui/Carte";
import { TIRET } from "@/lib/format";

const SECTIONS: { cle: EcheanceClasse["classe"]; titre: string; vide: string }[] = [
  { cle: "retard", titre: "En retard", vide: "Aucune éprouvette en retard." },
  { cle: "aujourdhui", titre: "À écraser aujourd'hui", vide: "Rien à écraser aujourd'hui." },
  { cle: "proche", titre: "Dans les 7 prochains jours", vide: "Rien dans les 7 prochains jours." },
  { cle: "planifie", titre: "Plus tard", vide: "Rien de prévu plus tard." },
];
const PLUS_TARD_VISIBLES = 20;

function texteEtat(x: EcheanceClasse): string {
  return x.classe === "retard" ? `en retard de ${-x.joursRestants} j`
    : x.classe === "aujourdhui" ? "aujourd'hui" : `dans ${x.joursRestants} j`;
}

export default function OngletEcheancier({ echeances, onOuvrir, onIcs, onCsv }: {
  echeances: EcheanceClasse[];
  onOuvrir: (ref: RefDoc) => void;
  onIcs: () => void;
  onCsv: () => void;
}) {
  const [toutPlusTard, setToutPlusTard] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <p className="classe-intro">
          Les éprouvettes encore en cure de tous les étudiants (documents de la session affichée), classées par
          date d&apos;écrasement prévue. Copies de conflit exclues.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onIcs} disabled={echeances.length === 0}>Calendrier (.ics)</button>
          <button type="button" className="btn-secondary" onClick={onCsv} disabled={echeances.length === 0}>Liste (CSV)</button>
        </div>
      </div>
      {SECTIONS.map((s) => {
        const tous = echeances.filter((x) => x.classe === s.cle);
        const liste = s.cle === "planifie" && !toutPlusTard ? tous.slice(0, PLUS_TARD_VISIBLES) : tous;
        return (
          <Carte key={s.cle} titre={`${s.titre} (${tous.length})`} aria-label={s.titre}
            actions={<span className="ui-point" style={{ background: COULEUR_ECHEANCE[s.cle] }} aria-hidden="true" />}>
            {tous.length === 0 ? (
              <p className="classe-rien">{s.vide}</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead><tr>{["Échéance", "État", "Étudiant", "Éprouvette", "Âge", "Gâchée", "Formulation"].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
                  <tbody>
                    {liste.map((x) => (
                      <tr key={`${x.etudiantId}:${x.eprouvetteId}`}>
                        <td style={td}>{fmtDate(x.echeance)}</td>
                        <td style={{ ...td, fontWeight: 700, color: COULEUR_ECHEANCE[x.classe], whiteSpace: "nowrap" }}>{texteEtat(x)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{x.etudiant}</td>
                        <td style={td}>{x.eprouvetteCode}</td>
                        <td style={td}>{x.ageJours} j</td>
                        <td style={td}>
                          <button type="button" style={lienBouton} onClick={() => onOuvrir({ etudiantId: x.etudiantId, kind: "gachee", id: x.gacheeId })}>{x.gacheeCode}</button>
                        </td>
                        <td style={td}>{x.formulation || TIRET}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tous.length > liste.length && (
                  <button type="button" style={{ ...lienBouton, margin: "10px 0 0" }} onClick={() => setToutPlusTard(true)}>
                    Afficher les {tous.length - liste.length} autres
                  </button>
                )}
              </div>
            )}
          </Carte>
        );
      })}
      <p className="classe-intro">Échéance = jour de coulée + âge de cure visé (au jour près).</p>
    </div>
  );
}
