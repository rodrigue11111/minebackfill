// Figure UCS de la classe : un point par gâchée, une couleur par étudiant.

import { useMemo, useState } from "react";
import { Carte } from "@/components/ui/Carte";
import Segmente from "@/components/ui/Segmente";
import CourbeUCS, { type SerieUCS } from "@/components/labo/CourbeUCS";
import { AXES_FORMULATION, axeMeta, type AxeFormulation } from "@/lib/ucs-formulation";
import { agesClasse, nuageClasse, type EtudiantClasse } from "@/lib/classe";
import { COULEURS } from "./commun";

export default function FigureClasse({ etudiants, couleurDe }: { etudiants: EtudiantClasse[]; couleurDe: Map<string, string> }) {
  const [axe, setAxe] = useState<AxeFormulation>("bwPct");
  const [ageVoulu, setAgeVoulu] = useState<number | null>(null);
  const ages = useMemo(() => agesClasse(etudiants), [etudiants]);
  const age = ageVoulu !== null && ages.includes(ageVoulu) ? ageVoulu : (ages.includes(28) ? 28 : (ages[0] ?? 28));
  const nuage = useMemo(() => nuageClasse(etudiants, axe, age), [etudiants, axe, age]);
  const series: SerieUCS[] = etudiants
    .map((e) => ({
      cle: e.id, label: e.nom, couleur: couleurDe.get(e.id) ?? COULEURS[0],
      points: nuage.points.filter((p) => p.etudiantId === e.id)
        .map((p) => ({ x: p.x, moyenne: p.moyenneKpa, ecartType: p.ecartTypeKpa, n: p.n })),
    }))
    .filter((s) => s.points.length > 0);

  return (
    <Carte titre="UCS mesurée de la classe">
      <p className="classe-intro">
        Un point par gâchée : son paramètre de formulation en abscisse, l&apos;UCS moyenne mesurée
        à l&apos;âge choisi en ordonnée. Une couleur par étudiant. Les copies de conflit sont exclues.
      </p>
      <div className="labo-axes">
        <Segmente
          ariaLabel="Abscisse"
          taille="compact"
          valeur={axe}
          onChange={setAxe}
          options={AXES_FORMULATION.map((a) => ({ valeur: a.cle, libelle: a.label }))}
        />
        {ages.length > 0 && (
          <label className="ui-filtre">
            Âge
            <select value={age} onChange={(ev) => setAgeVoulu(Number(ev.target.value))} className="ui-pilule-select">
              {ages.map((x) => <option key={x} value={x}>{x} j</option>)}
            </select>
          </label>
        )}
      </div>
      <CourbeUCS series={series} relier={false} ticksX="rondes"
        xLabel={(() => { const m = axeMeta(axe); return m ? `${m.label}${m.unite !== "—" ? ` (${m.unite})` : ""}` : axe; })()}
        formatX={(x) => x.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}
        messageVide="Aucune gâchée de la classe n'a de mesure exploitable à cet âge." />
      {nuage.ecartees.length > 0 && (
        <details className="classe-seuils">
          <summary>{nuage.ecartees.length} gâchée(s) absente(s) de cette figure</summary>
          <ul>
            {nuage.ecartees.map((x, i) => <li key={i}>{x.etudiant} — {x.code} : {x.raison}</li>)}
          </ul>
        </details>
      )}
    </Carte>
  );
}
