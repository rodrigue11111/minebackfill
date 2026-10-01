"use client";

// Saisie de l'essai de compression uniaxiale (UCS, ASTM C39/C39M) d'une
// éprouvette écrasée : charge et diamètre (contrainte F / A), ou contrainte
// mesurée directe, avec ce que la presse apporte à l'import.

import { useState } from "react";
import type { Eprouvette, EssaiUCS, UniteVitesse } from "@/lib/eprouvette";
import { TYPES_RUPTURE, UNITES_VITESSE, contrainteKpa } from "@/lib/eprouvette";
import { nbPointsCourbe } from "@/lib/courbes";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import ChampNombre from "@/components/ui/ChampNombre";
import { isoVersDateInput } from "./outils";

export default function FormEssaiUCS({ eprouvette, onChange, onVitessePourToutes }: {
  eprouvette: Eprouvette;
  onChange: (patch: Partial<EssaiUCS>) => void;
  /** Recopie la vitesse de chargement sur toutes les éprouvettes écrasées de la gâchée. */
  onVitessePourToutes?: (v: EssaiUCS["vitesseChargement"]) => void;
}) {
  const es = eprouvette.essai ?? {};
  // Unité choisie avant de saisir la valeur (la vitesse n'est enregistrée
  // qu'avec une valeur).
  const [uniteVitesse, setUniteVitesse] = useState<UniteVitesse>(es.vitesseChargement?.unite ?? "mm/min");
  const unite = es.vitesseChargement?.unite ?? uniteVitesse;
  const idVitesse = `vitesse-${eprouvette.id}`;
  const calculee = contrainteKpa({ chargeKn: es.chargeKn, diametreMm: es.diametreMm });
  const retenue = contrainteKpa(es);
  // Une contrainte directe renseignée l'emporte sur F/A (voir contrainteKpa).
  const directePrime = es.contrainteKpaSaisie != null && es.contrainteKpaSaisie > 0;
  // Écart entre les deux voies, pour que l'étudiant VOIE si elles concordent.
  // Simple différence relative affichée : aucun modèle, aucune correction.
  const ecartPct = directePrime && calculee !== null && calculee > 0
    ? ((es.contrainteKpaSaisie! - calculee) / calculee) * 100
    : null;
  return (
    <div className="labo-essai">
      <div className="labo-grille-essai">
        <Champ libelle="Date d'essai">
          <input type="date" className="field-input" value={es.date ? isoVersDateInput(es.date) : ""}
            onChange={(e) => onChange({ date: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })} />
        </Champ>
        <Champ libelle="Charge à la rupture" unite="kN"><ChampNombre value={es.chargeKn} onChange={(n) => onChange({ chargeKn: n })} /></Champ>
        <Champ libelle="Diamètre" unite="mm"><ChampNombre value={es.diametreMm} onChange={(n) => onChange({ diametreMm: n })} /></Champ>
      </div>

      <div className="labo-grille-essai">
        <Champ libelle="Masse de l'éprouvette" unite="g"><ChampNombre value={es.masseG} onChange={(n) => onChange({ masseG: n })} /></Champ>
        <Champ libelle="Vitesse de chargement" htmlFor={idVitesse}>
          <span className="labo-champ-unite-libre">
            <ChampNombre id={idVitesse} value={es.vitesseChargement?.valeur}
              onChange={(n) => onChange({ vitesseChargement: n === undefined ? undefined : { valeur: n, unite } })} />
            <select className="field-input" aria-label="Unité de la vitesse" value={unite}
              onChange={(e) => {
                const u = e.target.value as UniteVitesse;
                setUniteVitesse(u);
                if (es.vitesseChargement) onChange({ vitesseChargement: { ...es.vitesseChargement, unite: u } });
              }}>
              {UNITES_VITESSE.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </span>
        </Champ>
        <Champ libelle="Presse"><input className="field-input" placeholder="Nom ou numéro" value={es.presse ?? ""} onChange={(e) => onChange({ presse: e.target.value || undefined })} /></Champ>
      </div>

      <div className="labo-grille-essai">
        <Champ libelle="Mode de rupture">
          <select className="field-input" value={es.modeRuptureCode ?? ""}
            onChange={(e) => onChange({ modeRuptureCode: (e.target.value || undefined) as EssaiUCS["modeRuptureCode"] })}>
            <option value="">Non précisé</option>
            {TYPES_RUPTURE.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
          </select>
        </Champ>
        {/* Texte libre : pour « Autre », et pour les essais saisis avant la liste. */}
        {(es.modeRuptureCode === "autre" || es.modeRupture) && (
          <Champ libelle="Rupture (précision)"><input className="field-input" placeholder="ex. cône" value={es.modeRupture ?? ""} onChange={(e) => onChange({ modeRupture: e.target.value || undefined })} /></Champ>
        )}
      </div>
      {onVitessePourToutes && es.vitesseChargement && (
        <div>
          <button type="button" className="btn-discret" onClick={() => onVitessePourToutes(es.vitesseChargement)}>
            Appliquer cette vitesse à toutes les éprouvettes écrasées
          </button>
        </div>
      )}

      <div className="labo-ligne-contrainte">
        <div style={{ maxWidth: 240 }}>
          <Champ libelle="ou contrainte mesurée directe" unite="kPa" aide="Si la presse donne directement la contrainte (prioritaire sur le calcul).">
            <ChampNombre value={es.contrainteKpaSaisie} onChange={(n) => onChange({ contrainteKpaSaisie: n })} />
          </Champ>
        </div>
        <div className="labo-ucs-retenue">
          {retenue !== null ? (
            <>UCS retenue : <strong>{Math.round(retenue).toLocaleString("fr-CA")} kPa</strong>
              {es.contrainteKpaSaisie != null && es.contrainteKpaSaisie > 0 ? " (saisie directe)" : calculee !== null ? " (déduite de F / A)" : ""}</>
          ) : <span style={{ color: "var(--texte-2)" }}>Saisis une charge + un diamètre, ou une contrainte directe.</span>}
        </div>
      </div>

      {directePrime && (
        // Sans ce bloc, modifier la charge ou le diamètre après un import
        // n'aurait AUCUN effet visible : la contrainte directe prime sur le
        // calcul F/A. Le champ accepterait la saisie et l'écran resterait figé
        // — le genre de silence qui fait croire à une panne.
        <Bandeau ton="alerte" actions={
          <button type="button" className="btn-secondary" onClick={() => onChange({ contrainteKpaSaisie: undefined })}>
            Effacer la contrainte directe et revenir au calcul F / A
          </button>
        }>
          La <strong>contrainte directe prime</strong> : modifier la charge ou le diamètre ne changera
          pas l&apos;UCS retenue tant qu&apos;elle est renseignée.
          {calculee !== null && (
            <>
              {" "}Votre calcul F / A donnerait{" "}
              <strong>{Math.round(calculee).toLocaleString("fr-CA")} kPa</strong>
              {ecartPct !== null && (
                <>, soit un écart de <strong>{ecartPct.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} %</strong>
                  {Math.abs(ecartPct) < 0.5 ? " (les deux concordent)" : ""}</>
              )}.
            </>
          )}
        </Bandeau>
      )}

      {es.sourcePresse && (
        // Ce que la presse apporte en plus de la contrainte, et qui était
        // perdu avant l'import : module de Young, déformation maximale, et
        // le temps de cure RÉEL (à distinguer de l'âge cible, sur lequel les
        // moyennes sont faites).
        <Bandeau ton="info">
          <strong>Importé de la presse</strong> : fichier « {es.sourcePresse.fichier} », échantillon {es.sourcePresse.echantillon}
          {es.sourcePresse.operateur ? `, opérateur ${es.sourcePresse.operateur}` : ""}
          {es.sourcePresse.commentaires ? `, commentaire « ${es.sourcePresse.commentaires} »` : ""}.
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 18px", marginTop: 4 }}>
            {es.moduleYoungKpa !== undefined && (
              <span>Module de Young : <strong>{Math.round(es.moduleYoungKpa).toLocaleString("fr-CA")} kPa</strong></span>
            )}
            {es.deformationMaxPct !== undefined && (
              <span>Déformation max : <strong>{es.deformationMaxPct.toLocaleString("fr-CA", { maximumFractionDigits: 3 })} %</strong></span>
            )}
            {es.deflexionMaxMm !== undefined && (
              <span>Déflexion max : <strong>{es.deflexionMaxMm.toLocaleString("fr-CA", { maximumFractionDigits: 3 })} mm</strong></span>
            )}
            {es.tempsDeCureReelJours !== undefined && (
              <span>
                Cure réelle : <strong>{es.tempsDeCureReelJours} j</strong>
                {es.tempsDeCureReelJours !== eprouvette.ageJours && (
                  <span style={{ color: "var(--alerte-texte)" }}> (âge cible {eprouvette.ageJours} j ; les moyennes suivent la cible)</span>
                )}
              </span>
            )}
            {nbPointsCourbe(es) > 0 && (
              <span>Courbe conservée : <strong>{nbPointsCourbe(es)} points</strong></span>
            )}
          </div>
        </Bandeau>
      )}

      <label className="mix-case">
        <input type="checkbox" checked={!!es.exclu} onChange={(e) => onChange({ exclu: e.target.checked || undefined })} />
        Exclure cette éprouvette de la moyenne (valeur aberrante)
      </label>
      {es.exclu && (
        <Champ libelle="Justification de l'exclusion (obligatoire)"
          erreur={!es.justificationExclusion ? "Exclusion non documentée : la valeur est déjà écartée de la moyenne, mais indique pourquoi (rigueur scientifique)." : undefined}>
          <input className="field-input" placeholder="ex. défaut de surfaçage, rupture prématurée sur bulle…"
            value={es.justificationExclusion ?? ""} onChange={(e) => onChange({ justificationExclusion: e.target.value || undefined })} />
        </Champ>
      )}
    </div>
  );
}
