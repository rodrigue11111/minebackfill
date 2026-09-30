"use client";

// Pesées d'une gâchée sur bande de tolérance (maquette A améliorée) : pour
// chaque composant, la piste (cible au milieu, bande claire ± tolérance, point
// à la masse pesée), la saisie de la masse pesée et l'écart ; les notes de
// l'enseignant ancrées sur la pesée s'affichent juste dessous.

import type { Gachee } from "@/lib/gachee";
import type { Annotation } from "@/lib/annotations";
import { geometrieBande, libelleEcart } from "@/lib/bande-tolerance";
import { ancrePesee } from "@/lib/ancres";
import { fmt } from "@/lib/format";
import { Carte } from "@/components/ui/Carte";
import ChampNombre from "@/components/ui/ChampNombre";
import { FilEtudiant } from "@/components/AnnotationsDoc";

export function BandeTolerance({ position, bande, hors }: {
  position: number | null;
  bande: { debut: number; largeur: number };
  hors: boolean;
}) {
  return (
    <div className="labo-bande" aria-hidden="true">
      <div className="labo-bande-piste" />
      <div className="labo-bande-tolerance" style={{ left: `${bande.debut * 100}%`, width: `${bande.largeur * 100}%` }} />
      <div className="labo-bande-cible" />
      {position !== null && <div className={hors ? "labo-bande-point labo-bande-hors" : "labo-bande-point"} style={{ left: `${position * 100}%` }} />}
    </div>
  );
}

export default function Pesees({ gachee: g, onPesee, onTolerance, notes, connecte = false, lectureSeule = false }: {
  gachee: Gachee;
  onPesee?: (cle: string, peseeKg: number | undefined) => void;
  onTolerance?: (pct: number) => void;
  /** Notes ancrées « Pesée : <composant> ». */
  notes?: Map<string, Annotation[]>;
  connecte?: boolean;
  lectureSeule?: boolean;
}) {
  // Gâchée très ancienne : la tolérance peut manquer (lecture enseignant).
  const tol = typeof g.tolerancePct === "number" && Number.isFinite(g.tolerancePct) ? g.tolerancePct : null;
  return (
    <Carte
      titre="Pesées"
      aria-label="Pesées"
      data-section="pesees"
      aside={tol === null ? "Tolérance non renseignée" : `La bande claire est la tolérance de ± ${tol.toLocaleString("fr-CA")} % autour de la cible`}
      actions={!lectureSeule && onTolerance ? (
        <label className="labo-tolerance">
          Tolérance ±
          <ChampNombre className="field-input labo-tolerance-champ" ariaLabel="Tolérance en pour cent" value={tol ?? undefined} onChange={(n) => onTolerance(n ?? 0)} />
          %
        </label>
      ) : undefined}
    >
      {(g.composants ?? []).length === 0 ? (
        <p className="labo-vide">Aucune pesée enregistrée.</p>
      ) : (
        <div className="labo-pesees">
          {g.composants.map((c) => {
            const geo = geometrieBande(c, tol ?? 0);
            const notesC = notes?.get(ancrePesee(c.label)) ?? [];
            return (
              <div key={c.cle} className="labo-pesee">
                <div className="labo-pesee-ligne">
                  <span className="labo-pesee-nom">
                    {c.label}
                    <span className="labo-pesee-cible">cible {fmt(c.cibleKg, 1)} kg</span>
                  </span>
                  <BandeTolerance position={geo.position} bande={geo.bande} hors={geo.horsTolerance} />
                  {lectureSeule ? (
                    <span className="labo-pesee-valeur">{c.peseeKg === undefined ? "—" : `${fmt(c.peseeKg, 1)} kg`}</span>
                  ) : (
                    <span className="labo-pesee-saisie">
                      <ChampNombre ariaLabel={`Masse pesée : ${c.label} (kg)`} placeholder="kg" value={c.peseeKg} onChange={(n) => onPesee?.(c.cle, n)} />
                    </span>
                  )}
                  <span className={geo.horsTolerance ? "labo-pesee-ecart labo-hors" : "labo-pesee-ecart"}>
                    {libelleEcart(geo)}
                    {geo.horsEchelle && <span className="labo-hors-echelle"> (hors échelle)</span>}
                  </span>
                </div>
                {notesC.length > 0 && (
                  <FilEtudiant kind="gachee" id={g.id} liste={notesC} connecte={connecte} ancre={ancrePesee(c.label)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Carte>
  );
}
