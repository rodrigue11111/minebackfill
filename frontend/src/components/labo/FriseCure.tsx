// Frise de cure d'une gâchée (maquette A améliorée) : piste de la coulée à la
// dernière échéance, un jalon par âge, la position d'aujourd'hui. Échelle en
// racine carrée (lib/frise-cure.ts). Sans hook.

import { friseCure, resumeFrise, type EtatJalon } from "@/lib/frise-cure";
import type { Eprouvette } from "@/lib/eprouvette";
import { Carte } from "@/components/ui/Carte";
import { dateCourteFr } from "./outils";

const LIBELLE_ETAT: Record<EtatJalon, string> = {
  fait: "écrasées",
  retard: "en retard",
  aujourdhui: "à écraser aujourd'hui",
  a_venir: "à venir",
};

export default function FriseCure({ eprouvettes, maintenant }: { eprouvettes: Eprouvette[]; maintenant: Date }) {
  const f = friseCure(eprouvettes, maintenant);
  if (!f) return null;
  const pct = (p: number) => `${(p * 100).toFixed(2)}%`;
  return (
    <Carte titre="Cure" aside={resumeFrise(f)} aria-label="Cure" className="labo-frise-carte" data-section="eprouvettes">
      <div className="labo-frise" role="img" aria-label={`Frise de cure : ${resumeFrise(f)}`}>
        <div className="labo-frise-piste" />
        <div className="labo-frise-progres" style={{ width: pct(f.positionAujourdhui) }} />
        <div className="labo-frise-point labo-frise-coulee" style={{ left: 0 }} />
        {f.jalons.map((j) => (
          <div key={j.ageJours} className={`labo-frise-point labo-frise-${j.etat}`} style={{ left: pct(j.position) }} title={`${j.ageJours} j · ${LIBELLE_ETAT[j.etat]}`} />
        ))}
        {f.positionAujourdhui > 0 && f.positionAujourdhui < 1 && (
          <div className="labo-frise-maintenant" style={{ left: pct(f.positionAujourdhui) }} />
        )}
      </div>
      <ol className="labo-frise-legende">
        <li><strong>Coulée</strong> · {dateCourteFr(f.coulee)}</li>
        {f.jalons.map((j) => (
          <li key={j.ageJours} className={`labo-legende-${j.etat}`}>
            <strong>{j.ageJours} jours</strong> · {dateCourteFr(j.date)} · {j.nbEcrasees}/{j.nbEprouvettes} {LIBELLE_ETAT[j.etat]}
          </li>
        ))}
      </ol>
    </Carte>
  );
}
