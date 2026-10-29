"use client";

// Pesées d'une gâchée sur bande de tolérance (maquette A améliorée) : pour
// chaque composant, la piste (cible au milieu, bande claire ± tolérance, point
// à la masse pesée), la saisie de la masse pesée et l'écart ; les notes de
// l'enseignant ancrées sur la pesée s'affichent juste dessous.
//
// Unité de saisie au choix (g ou kg, mémorisée dans les préférences d'unités) :
// la cible, la tolérance et le champ la suivent ; la gâchée garde ses masses
// en kg. Une masse négative est refusée.
//
// Lecture seule (enseignant, 2026-10-26) : les pesées sont FACULTATIVES. Sans
// aucune pesée saisie, une seule ligne le dit et seules les cibles restent ;
// une pesée manquante se lit « non saisie », jamais « pas encore pesé » (qui
// laissait croire à un oubli de l'étudiant).

import { useState } from "react";
import { cibleLisible, masseLisible, peseeVersSaisie, plageTolerance, saisieVersPesee, type Gachee, type UnitePesee } from "@/lib/gachee";
import { useStore } from "@/lib/store";
import Segmente from "@/components/ui/Segmente";
import type { Annotation } from "@/lib/annotations";
import { geometrieBande, libelleEcart } from "@/lib/bande-tolerance";
import { ancrePesee } from "@/lib/ancres";
import { TIRET } from "@/lib/format";
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
  const unite: UnitePesee = useStore((s) => s.units.masseLabo) ?? "g";
  const setUnits = useStore((s) => s.setUnits);
  // Message de la saisie refusée en cours, par composant.
  const [refus, setRefus] = useState<Record<string, string | null>>({});
  const [refusTolerance, setRefusTolerance] = useState<string | null>(null);
  // Enseignant : aucune pesée saisie, les cibles seules (les pesées sont facultatives).
  const aucunePesee = lectureSeule && (g.composants ?? []).length > 0 && g.composants.every((c) => c.peseeKg === undefined);
  const choixUnite = (
    <Segmente ariaLabel="Unité des pesées" taille="compact" valeur={unite}
      onChange={(u) => setUnits({ masseLabo: u })}
      options={[{ valeur: "g", libelle: "g" }, { valeur: "kg", libelle: "kg" }]} />
  );
  return (
    <Carte
      titre="Pesées"
      aria-label="Pesées"
      data-section="pesees"
      aside={tol === null ? "Tolérance non renseignée" : `La bande claire est la tolérance de ± ${tol.toLocaleString("fr-CA")} % autour de la cible`}
      actions={!lectureSeule ? (
        <span className="labo-pesees-actions">
          {choixUnite}
          {onTolerance && (
            <label className="labo-tolerance">
              Tolérance ±
              <ChampNombre className="field-input labo-tolerance-champ" ariaLabel="Tolérance en pour cent" value={tol ?? undefined} onChange={(n) => onTolerance(n ?? 0)}
                min={0} messageRefus="Une tolérance ne peut pas être négative." onRefus={setRefusTolerance} />
              %
              {refusTolerance && <span className="ui-champ-erreur" role="alert">{refusTolerance}</span>}
            </label>
          )}
        </span>
      ) : undefined}
    >
      {(g.composants ?? []).length === 0 ? (
        <p className="labo-vide">Aucune pesée enregistrée.</p>
      ) : aucunePesee ? (
        <div className="labo-pesees">
          <p className="labo-vide">Aucune pesée saisie (les pesées sont facultatives). Masses cibles :</p>
          {g.composants.map((c) => {
            const notesC = notes?.get(ancrePesee(c.label)) ?? [];
            return (
              <div key={c.cle} className="labo-pesee">
                <div className="labo-pesee-ligne labo-pesee-cible-seule">
                  <span className="labo-pesee-nom">
                    {c.label}
                    <span className="labo-pesee-cible">
                      cible {masseLisible(c.cibleKg)}
                      {tol ? <> ; tolérance {plageTolerance(c.cibleKg, tol, Math.abs(c.cibleKg) < 1 ? "g" : "kg")}</> : null}
                    </span>
                  </span>
                </div>
                {notesC.length > 0 && (
                  <FilEtudiant kind="gachee" id={g.id} liste={notesC} connecte={connecte} ancre={ancrePesee(c.label)} />
                )}
              </div>
            );
          })}
        </div>
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
                    <span className="labo-pesee-cible">
                      cible {lectureSeule ? masseLisible(c.cibleKg) : cibleLisible(c.cibleKg, unite)}
                      {tol ? <> ; tolérance {plageTolerance(c.cibleKg, tol, lectureSeule ? (Math.abs(c.cibleKg) < 1 ? "g" : "kg") : unite)}</> : null}
                    </span>
                  </span>
                  <BandeTolerance position={geo.position} bande={geo.bande} hors={geo.horsTolerance} />
                  {lectureSeule ? (
                    <span className="labo-pesee-valeur">{c.peseeKg === undefined ? "non saisie" : masseLisible(c.peseeKg)}</span>
                  ) : (
                    <span className="labo-pesee-saisie">
                      <ChampNombre ariaLabel={`Masse pesée : ${c.label} (${unite})`} placeholder={unite}
                        min={0} messageRefus="Une masse ne peut pas être négative."
                        value={peseeVersSaisie(c.peseeKg, unite)}
                        onChange={(n) => onPesee?.(c.cle, n === undefined ? undefined : saisieVersPesee(n, unite))}
                        onRefus={(msg) => setRefus((r) => ({ ...r, [c.cle]: msg }))} />
                      <span className="labo-pesee-unite" aria-hidden="true">{unite}</span>
                    </span>
                  )}
                  <span className={geo.horsTolerance ? "labo-pesee-ecart labo-hors" : "labo-pesee-ecart"}>
                    {lectureSeule && !geo.ecart ? TIRET : libelleEcart(geo)}
                    {geo.horsEchelle && <span className="labo-hors-echelle"> (hors échelle)</span>}
                  </span>
                </div>
                {refus[c.cle] && <p className="ui-champ-erreur labo-pesee-refus" role="alert">{refus[c.cle]}</p>}
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
