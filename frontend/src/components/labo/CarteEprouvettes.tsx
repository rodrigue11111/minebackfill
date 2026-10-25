"use client";

// Carte « Éprouvettes » d'une gâchée (maquette A améliorée) : une ligne par
// éprouvette (rond coché quand elle est écrasée, code, âge, échéance, UCS) ;
// la ligne s'ouvre sur l'essai. Ajout d'éprouvettes, import de presse,
// étiquettes. Mise en cure et écrasement selon ASTM C192/C192M et C39/C39M.

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  AGES_CURE_DEFAUT, MOULES_PROPOSES, contrainteKpa, dateCoulee, dateEcheance, ecrasementPrecoce, etiquettesHtml, genererCodeEprouvette,
  libelleMoule, type Eprouvette, type EssaiUCS, type EtiquetteEprouvette,
} from "@/lib/eprouvette";
import type { Gachee } from "@/lib/gachee";
import type { Annotation } from "@/lib/annotations";
import { badgeEcheance, fmtDate } from "@/lib/echeance-affichage";
import {
  appliquerImportPresse, cleAffectation, clesCourbesEprouvette, courbesAOublier, decoderCourbe, origineNonVerifiee, type CourbeAffichee,
} from "@/lib/courbes";
import { enregistrerCourbes, lireCourbeLocale, marquerCourbeEnLigne, oublierCourbes, rangerCourbe } from "@/lib/courbes-client";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { Icone } from "@/components/ui/Icones";
import ChampNombre from "@/components/ui/ChampNombre";
import Segmente from "@/components/ui/Segmente";
import { FilEtudiant } from "@/components/AnnotationsDoc";
import ImportPresse from "./ImportPresse";
import FormEssaiUCS from "./FormEssaiUCS";
import { lireCourbe } from "@/lib/classe-reseau";
import { getSupabase } from "@/lib/supabase";
import { dateCourteFr, imprimerHtml, isoJourMidi, isoVersDateInput, nouvelId } from "./outils";

export default function CarteEprouvettes({ gachee, maintenant, onChange, idImport, inviterAjout = false, notes, connecte = false }: {
  gachee: Gachee;
  maintenant: Date;
  onChange: (eprouvettes: Eprouvette[]) => void;
  /** Id du champ fichier de l'import de presse (le bouton de l'en-tête l'ouvre). */
  idImport: string;
  /** L'import a été demandé sans éprouvette : on invite à en ajouter d'abord. */
  inviterAjout?: boolean;
  /** Notes de l'enseignant ancrées sur une éprouvette (par code). */
  notes?: Map<string, Annotation[]>;
  connecte?: boolean;
}) {
  const [couleLe, setCouleLe] = useState(() => isoVersDateInput(gachee.creeLe));
  const [age, setAge] = useState<number | undefined>(28);
  const [nb, setNb] = useState<number | undefined>(1);
  // Âge de cure < 1 j ou aucun réplicat : refusés à la saisie (audit 2026-10-25).
  const [refusAjout, setRefusAjout] = useState<{ age?: string | null; nb?: string | null }>({});
  // Moule : un moule proposé (index), « autre » (texte libre) ou rien.
  const [mouleChoix, setMouleChoix] = useState<string>("");
  const [moule, setMoule] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const uid = useStore((s) => s.session?.userId ?? null);

  const eprouvettes = [...gachee.eprouvettes].sort(
    (a, b) => dateEcheance(a).getTime() - dateEcheance(b).getTime(),
  );

  const ajouter = () => {
    const n = Math.max(1, Math.round(nb ?? 1));
    const a = Math.max(0, Math.round(age ?? 0));
    // Coulée à midi LOCAL : évite tout décalage de jour (fuseau/heure d'été).
    const iso = couleLe ? new Date(`${couleLe}T12:00:00`).toISOString() : gachee.creeLe;
    const nouvelles: Eprouvette[] = [];
    for (let i = 0; i < n; i++) {
      const code = genererCodeEprouvette(gachee.code, [...gachee.eprouvettes, ...nouvelles]);
      const propose = mouleChoix !== "" && mouleChoix !== "autre" ? MOULES_PROPOSES[Number(mouleChoix)] : undefined;
      nouvelles.push({
        id: nouvelId(), code, couleLe: iso, ageJours: a, statut: "en_cure",
        ...(propose
          ? { mouleDiametreMm: propose.diametreMm, mouleHauteurMm: propose.hauteurMm }
          : { moule: mouleChoix === "autre" ? moule.trim() || undefined : undefined }),
      });
    }
    onChange([...gachee.eprouvettes, ...nouvelles]);
  };

  const majEprouvette = (id: string, patch: Partial<Eprouvette>) =>
    onChange(gachee.eprouvettes.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const majEssai = (id: string, patch: Partial<EssaiUCS>) =>
    onChange(gachee.eprouvettes.map((e) => (e.id === id ? { ...e, essai: { ...(e.essai ?? {}), ...patch } } : e)));

  // Courbe de presse : rangée ici (magasin, ou encore dans la gâchée), sinon
  // cherchée en ligne (envoyée depuis un autre appareil), puis rangée ici.
  const chargerCourbe = (e: Eprouvette) => async (): Promise<CourbeAffichee | null> => {
    const points = e.essai?.courbe?.length ? e.essai.courbe : await lireCourbeLocale(e);
    return points ? { points, origineNonVerifiee: origineNonVerifiee(e.essai) } : null;
  };
  const chercherEnLigne = (e: Eprouvette) => async (): Promise<CourbeAffichee | null> => {
    const sb = getSupabase();
    if (!sb || !uid) return null;
    const importeLe = e.essai?.sourcePresse?.importeLe;
    const lue = await lireCourbe(sb, uid, e.id, importeLe);
    if (!lue) return null;
    // Seule la courbe de l'import désigné est rangée ici ; un ancien document
    // (origine non vérifiée) est seulement affiché.
    if (!lue.origineNonVerifiee && importeLe && await rangerCourbe(lue.cle, lue.courbe)) {
      marquerCourbeEnLigne(uid, lue.cle, lue.rev);
      // Sur l'état FRAIS du magasin : la gâchée a pu changer pendant la
      // lecture (autre saisie, nouvel import). Rien n'est posé si
      // l'éprouvette désigne désormais un autre import.
      const actuelle = useStore.getState().gachees.find((x) => x.id === gachee.id);
      const ep = actuelle?.eprouvettes.find((x) => x.id === e.id);
      if (actuelle && ep?.essai && ep.essai.sourcePresse?.importeLe === importeLe && !ep.essai.courbeInfo && !ep.essai.courbe) {
        onChange(actuelle.eprouvettes.map((x) => (x.id === e.id
          ? { ...x, essai: { ...x.essai, courbeInfo: { nbPoints: lue.courbe.t.length, importeLe } } } : x)));
      }
    }
    return { points: decoderCourbe(lue.courbe), origineNonVerifiee: lue.origineNonVerifiee };
  };
  const retirer = (id: string) => {
    const e = gachee.eprouvettes.find((x) => x.id === id);
    onChange(gachee.eprouvettes.filter((x) => x.id !== id));
    if (e) oublierCourbes(courbesAOublier(clesCourbesEprouvette(e), useStore.getState().gachees.filter((x) => x.id !== gachee.id)));
  };

  // Diamètre du moule nominal, proposé comme diamètre de l'essai s'il manque
  // (F / A) : un écart avec la contrainte donnée par la presse devient visible.
  const diametreDuMoule = (e: Eprouvette, essai: EssaiUCS | undefined): Partial<EssaiUCS> =>
    e.mouleDiametreMm && !essai?.diametreMm ? { diametreMm: e.mouleDiametreMm } : {};

  // Bascule cure <-> écrasée : à l'écrasement, on initialise la date d'essai au
  // jour même (et le diamètre depuis le moule).
  const basculerStatut = (e: Eprouvette) => {
    majEprouvette(e.id, e.statut === "ecrase"
      ? { statut: "en_cure" }
      : { statut: "ecrase", essai: { date: isoJourMidi(new Date()), ...(e.essai ?? {}), ...diametreDuMoule(e, e.essai) } });
    if (e.statut !== "ecrase") setOuverte(e.id);
  };

  // La vitesse de chargement est la même pour une campagne : l'appliquer d'un coup.
  const vitessePourToutes = (v: EssaiUCS["vitesseChargement"]) =>
    onChange(gachee.eprouvettes.map((e) => (e.statut === "ecrase" ? { ...e, essai: { ...(e.essai ?? {}), vitesseChargement: v } } : e)));

  const imprimer = () => {
    if (gachee.eprouvettes.length === 0) return;
    const etiquettes: EtiquetteEprouvette[] = eprouvettes.map((e) => ({
      codeEprouvette: e.code, codeGachee: gachee.code,
      formulation: gachee.formulationLabel, categorie: gachee.categorie,
      couleLe: fmtDate(dateCoulee(e)), echeance: fmtDate(dateEcheance(e)),
      ageJours: e.ageJours, moule: libelleMoule(e) || undefined,
    }));
    imprimerHtml(etiquettesHtml(etiquettes, `Étiquettes de la gâchée ${gachee.code}`));
  };

  const agesUsuels = AGES_CURE_DEFAUT.map(String) as string[];

  return (
    <Carte
      id="eprouvettes"
      titre="Éprouvettes"
      aside={gachee.eprouvettes.length > 0 ? `${gachee.eprouvettes.filter((e) => e.statut === "ecrase").length} écrasée(s) sur ${gachee.eprouvettes.length}` : undefined}
      actions={gachee.eprouvettes.length > 0
        ? <button type="button" onClick={imprimer} className="btn-discret">Imprimer les étiquettes</button>
        : undefined}
    >
      {inviterAjout && gachee.eprouvettes.length === 0 && (
        <Bandeau ton="info" titre="Ajoutez d'abord les éprouvettes.">
          L&apos;import affecte chaque essai de la presse à une éprouvette de cette gâchée : créez-les ci-dessous, puis relancez l&apos;import.
        </Bandeau>
      )}

      <ImportPresse
        eprouvettes={gachee.eprouvettes}
        idEntree={idImport}
        sansBouton
        onAppliquer={async (affectations) => {
          // Les courbes vont D'ABORD dans IndexedDB, sous la clé de LEUR
          // import (idEprouvette:importeLe) ; l'éprouvette n'en garde qu'une
          // référence, qui nomme cet import. Si l'enregistrement échoue (ou si
          // le navigateur n'a pas IndexedDB), la courbe reste dans la gâchée,
          // comme avant : aucune perte.
          const enregistrees = await enregistrerCourbes(
            affectations.filter((a) => a.essai.courbe?.length).map((a) => [cleAffectation(a), a.essai.courbe!]));
          // Un seul onChange pour toutes les affectations : appeler
          // majEssai en boucle repartirait de l'état d'avant et
          // n'en garderait que la dernière. Un nouvel import remplace la
          // courbe du précédent ; l'ancienne est retirée du magasin, sauf si
          // une autre gâchée la désigne encore.
          const r = appliquerImportPresse(gachee.eprouvettes, affectations, enregistrees, diametreDuMoule);
          onChange(r.eprouvettes);
          oublierCourbes(courbesAOublier(r.anciennes, useStore.getState().gachees.filter((x) => x.id !== gachee.id)));
        }}
      />

      {eprouvettes.length === 0 ? (
        <p className="labo-vide">Aucune éprouvette. Choisissez un âge de cure et un nombre de réplicats, puis cliquez sur « Ajouter ».</p>
      ) : (
        <div className="ui-liste">
          {eprouvettes.map((e) => {
            const b = badgeEcheance(e, maintenant);
            const ucs = e.statut === "ecrase" ? contrainteKpa(e.essai) : null;
            const ouvert = ouverte === e.id;
            const notesE = notes?.get(e.code) ?? [];
            return (
              <div key={e.id} className="labo-eprouvette">
                <div className="labo-eprouvette-ligne">
                  <button type="button" className={e.statut === "ecrase" ? "labo-rond labo-rond-plein" : "labo-rond"}
                    aria-pressed={e.statut === "ecrase"}
                    aria-label={e.statut === "ecrase" ? `${e.code} écrasée : remettre en cure` : `Marquer ${e.code} écrasée`}
                    title={e.statut === "ecrase" ? "Remettre en cure" : "Marquer écrasée"}
                    onClick={() => basculerStatut(e)}>
                    {e.statut === "ecrase" && <Icone nom="coche" taille={12} epaisseur={3} />}
                  </button>
                  <button type="button" className="labo-eprouvette-corps" aria-expanded={ouvert} onClick={() => setOuverte(ouvert ? null : e.id)}>
                    <span className="labo-eprouvette-textes">
                      <span className="labo-eprouvette-code">{e.code}</span>
                      <span className="labo-eprouvette-detail">
                        {e.ageJours} j · échéance {dateCourteFr(dateEcheance(e))}
                        {libelleMoule(e) ? ` · ${libelleMoule(e)}` : ""}
                        {e.essai?.exclu ? " · exclue de la moyenne" : ""}
                      </span>
                    </span>
                    <span className="labo-eprouvette-droite">
                      {ucs !== null
                        ? <strong className="labo-ucs">{Math.round(ucs).toLocaleString("fr-CA")} kPa</strong>
                        : <span style={{ color: b.couleur, fontWeight: 600 }}>{b.texte}</span>}
                      {notesE.length > 0 && <span className="ui-point ui-point-accent" title="Note de l'enseignant" />}
                      <span className="ui-ligne-chevron" style={{ transform: ouvert ? "rotate(90deg)" : undefined }}><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
                    </span>
                  </button>
                </div>
                {notesE.length > 0 && (
                  <FilEtudiant kind="gachee" id={gachee.id} liste={notesE} connecte={connecte} ancre={e.code} />
                )}
                {ouvert && (
                  <div className="labo-eprouvette-ouverte">
                    {ecrasementPrecoce(e) && (
                      // Avis, jamais un blocage : la date d'essai peut être juste.
                      <Bandeau ton="alerte" titre="Écrasée avant l'échéance.">
                        Âge réel : {ecrasementPrecoce(e)!.ageReel} j pour un âge visé de {ecrasementPrecoce(e)!.ageVise} j. Les moyennes suivent l&apos;âge visé :
                        vérifiez la date d&apos;essai, ou notez la raison dans les observations.
                      </Bandeau>
                    )}
                    {e.statut === "ecrase" && (
                      <FormEssaiUCS eprouvette={e} onChange={(patch) => majEssai(e.id, patch)}
                        chargerCourbe={chargerCourbe(e)} chercherCourbeEnLigne={connecte && uid ? chercherEnLigne(e) : undefined}
                        idImport={idImport}
                        onVitessePourToutes={gachee.eprouvettes.filter((x) => x.statut === "ecrase").length > 1 ? vitessePourToutes : undefined} />
                    )}
                    <div className="labo-actions">
                      <button type="button" onClick={() => basculerStatut(e)} className="btn-secondary">
                        {e.statut === "ecrase" ? "Remettre en cure" : "Marquer écrasée"}
                      </button>
                      <button type="button" onClick={() => retirer(e.id)} className="btn-discret btn-danger">Retirer l&apos;éprouvette</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <details className="labo-ajout" open={gachee.eprouvettes.length === 0 || inviterAjout}>
        <summary>Ajouter des éprouvettes</summary>
        <div className="labo-ajout-corps">
          <div className="labo-grille-ajout">
            <Champ libelle="Date de coulée"><input type="date" className="field-input" value={couleLe} onChange={(e) => setCouleLe(e.target.value)} /></Champ>
            <Champ libelle="Âge de cure" unite="j" erreur={refusAjout.age ?? undefined}>
              <ChampNombre value={age} onChange={setAge} min={1} messageRefus="L'âge de cure est d'au moins 1 jour."
                onRefus={(m) => setRefusAjout((r) => ({ ...r, age: m }))} />
            </Champ>
            <Champ libelle="Nombre (réplicats)" erreur={refusAjout.nb ?? undefined}>
              <ChampNombre value={nb} onChange={setNb} min={1} messageRefus="Au moins une éprouvette."
                onRefus={(m) => setRefusAjout((r) => ({ ...r, nb: m }))} />
            </Champ>
            <Champ libelle="Moule (facultatif)">
              <select className="field-input" value={mouleChoix} onChange={(e) => setMouleChoix(e.target.value)}>
                <option value="">Non précisé</option>
                {MOULES_PROPOSES.map((m, i) => <option key={m.libelle} value={String(i)}>{m.libelle}</option>)}
                <option value="autre">Autre</option>
              </select>
            </Champ>
            {mouleChoix === "autre" && (
              <Champ libelle="Moule (précision)"><input className="field-input" placeholder="ex. cylindre 38 × 76 mm" value={moule} onChange={(e) => setMoule(e.target.value)} /></Champ>
            )}
          </div>
          <div className="labo-ages">
            <span className="ui-champ-libelle">Âges usuels</span>
            <Segmente
              ariaLabel="Âges de cure usuels"
              taille="compact"
              valeur={age !== undefined && agesUsuels.includes(String(age)) ? String(age) : ""}
              onChange={(v) => setAge(Number(v))}
              options={agesUsuels.map((a) => ({ valeur: a, libelle: `${a} j` }))}
            />
            <button type="button" onClick={ajouter} className="btn-primary">Ajouter les éprouvettes</button>
          </div>
        </div>
      </details>
    </Carte>
  );
}
