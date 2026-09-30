"use client";

// Éditeur d'une gâchée (maquette A améliorée). Piloté par ses propriétés : la
// page Labo le relie au magasin, les tests le rendent sans navigateur.
// Colonne principale : frise de cure, pesées sur bande de tolérance (notes de
// l'enseignant en contexte), ajustements, éprouvettes, observations, protocole
// figé. Colonne de droite : résistance mesurée, matériaux et pâte fraîche,
// échanges. Téléphone : un segmenté Pesées | Éprouvettes | Échanges n'affiche
// qu'une partie (CSS seulement, attribut data-vue).

import { useState } from "react";
import type { Ajustement, Gachee } from "@/lib/gachee";
import type { Annotation } from "@/lib/annotations";
import { agregerParAge } from "@/lib/eprouvette";
import { ancresGachee, repartirAnnotations } from "@/lib/ancres";
import { EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import { Icone } from "@/components/ui/Icones";
import ChampNombre from "@/components/ui/ChampNombre";
import Segmente from "@/components/ui/Segmente";
import { FilEtudiant } from "@/components/AnnotationsDoc";
import { CarteProtocolesFiges } from "./Carte";
import FriseCure from "./FriseCure";
import Pesees from "./Pesees";
import CarteEprouvettes from "./CarteEprouvettes";
import { dateLongue, nouvelId } from "./outils";

type VueTelephone = "pesees" | "eprouvettes" | "echanges";

const TYPES_AJOUT: { valeur: Ajustement["type"]; libelle: string }[] = [
  { valeur: "eau", libelle: "Eau" }, { valeur: "residu", libelle: "Résidu" },
  { valeur: "granulat", libelle: "Granulat" }, { valeur: "liant", libelle: "Liant" },
];

export default function EditeurGachee({ gachee: g, maintenant, annotations, connecte, onMaj, onRetour, onSupprimer }: {
  gachee: Gachee;
  maintenant: Date;
  /** Fil de cette gâchée (commentaires de l'enseignant, réponses). */
  annotations: Annotation[];
  connecte: boolean;
  onMaj: (patch: Partial<Gachee>) => void;
  onRetour: () => void;
  onSupprimer: () => void;
}) {
  const [vue, setVue] = useState<VueTelephone>("pesees");
  const [inviterAjout, setInviterAjout] = useState(false);
  const idImport = `import-presse-${g.id}`;

  const { parAncre, general } = repartirAnnotations(annotations, ancresGachee(g));
  const nonLues = annotations.filter((a) => a.auteur === "enseignant" && a.luLe === null).length;

  const majComposant = (cle: string, peseeKg: number | undefined) =>
    onMaj({ composants: g.composants.map((c) => (c.cle === cle ? { ...c, peseeKg } : c)) });
  const ajouterAjustement = () =>
    onMaj({ ajustements: [...g.ajustements, { id: nouvelId(), type: "eau", masseKg: 0 }] });
  const majAjustement = (id: string, patch: Partial<Ajustement>) =>
    onMaj({ ajustements: g.ajustements.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const retirerAjustement = (id: string) =>
    onMaj({ ajustements: g.ajustements.filter((a) => a.id !== id) });

  const parAge = agregerParAge(g.eprouvettes).filter((a) => a.moyenneKpa !== null);
  const coulee = g.eprouvettes.length > 0
    ? new Date(Math.min(...g.eprouvettes.map((e) => new Date(e.couleLe).getTime())))
    : null;

  return (
    <div className="labo-editeur" data-vue={vue}>
      <EnTetePage
        retour={{ onClick: onRetour, libelle: "Gâchées" }}
        taille="moyen"
        titre={g.code}
        pastille={g.statut === "terminee" ? <Pastille ton="succes">Terminée</Pastille> : <Pastille ton="alerte">Brouillon</Pastille>}
        sousTitre={[
          g.formulationLabel, g.categorie, `recette ${(g.recetteIndex ?? 0) + 1}`,
          coulee ? `coulée le ${dateLongue(coulee)}` : `créée le ${dateLongue(new Date(g.creeLe))}`,
          g.solverVersion ? `formules ${g.solverVersion}` : null,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            {g.eprouvettes.length > 0 ? (
              <label htmlFor={idImport} className="btn-secondary" role="button" tabIndex={0}
                onClick={() => setVue("eprouvettes")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById(idImport)?.click(); } }}>
                <Icone nom="telecharger" taille={15} epaisseur={2.2} />
                Importer un fichier de presse
              </label>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => {
                setInviterAjout(true);
                setVue("eprouvettes");
                document.getElementById("eprouvettes")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                <Icone nom="telecharger" taille={15} epaisseur={2.2} />
                Importer un fichier de presse
              </button>
            )}
            <button type="button" className="btn-sombre" onClick={() => onMaj({ statut: g.statut === "terminee" ? "brouillon" : "terminee" })}>
              {g.statut === "terminee" ? "Rouvrir" : "Marquer terminée"}
            </button>
          </>
        }
      />

      {/* Téléphone : trois parties, une seule affichée (CSS, data-vue). */}
      <div className="labo-vues-tel">
        <Segmente
          ariaLabel="Parties de la gâchée"
          role="tablist"
          taille="compact"
          pleineLargeur
          valeur={vue}
          onChange={setVue}
          options={[
            { valeur: "pesees", libelle: "Pesées" },
            { valeur: "eprouvettes", libelle: "Éprouvettes" },
            { valeur: "echanges", libelle: "Échanges", badge: nonLues > 0 ? <span className="ui-point ui-point-accent" aria-label="Commentaire non lu" /> : undefined },
          ]}
        />
      </div>

      <FriseCure eprouvettes={g.eprouvettes} maintenant={maintenant} />

      <div className="labo-grille">
        <div className="labo-colonne">
          <Pesees
            gachee={g}
            onPesee={majComposant}
            onTolerance={(pct) => onMaj({ tolerancePct: pct })}
            notes={parAncre}
            connecte={connecte}
          />

          <Carte titre="Ajustements (essai-erreur)" aria-label="Ajustements" data-section="pesees"
            aside={g.ajustements.length === 0 ? undefined : `${g.ajustements.length} ajout${g.ajustements.length > 1 ? "s" : ""}`}
            actions={<button type="button" onClick={ajouterAjustement} className="btn-discret"><Icone nom="ajouter" taille={14} epaisseur={2.4} />Nouvel ajout</button>}>
            {g.ajustements.length === 0 ? (
              <p className="labo-vide">Aucun ajustement. Ajoute ce que tu as versé après le premier malaxage (eau, résidu, granulat, liant).</p>
            ) : (
              <div className="ui-liste">
                {g.ajustements.map((a) => (
                  <div key={a.id} className="labo-ajustement">
                    <select className="field-input" aria-label="Type d'ajout" value={a.type} onChange={(e) => majAjustement(a.id, { type: e.target.value as Ajustement["type"] })}>
                      {TYPES_AJOUT.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                    </select>
                    <span className="ui-champ-saisie ui-champ-avec-unite">
                      <ChampNombre ariaLabel="Masse ajoutée (kg)" placeholder="0" value={a.masseKg || undefined} onChange={(n) => majAjustement(a.id, { masseKg: n ?? 0 })} />
                      <span className="ui-champ-unite" aria-hidden="true">kg</span>
                    </span>
                    <input className="field-input" aria-label="Note" placeholder="Note (facultatif)" value={a.note ?? ""} onChange={(e) => majAjustement(a.id, { note: e.target.value })} />
                    <button type="button" onClick={() => retirerAjustement(a.id)} className="ui-bouton-icone" aria-label="Retirer cet ajout"><Icone nom="fermer" taille={15} epaisseur={2} /></button>
                  </div>
                ))}
              </div>
            )}
          </Carte>

          <div data-section="eprouvettes">
            <CarteEprouvettes key={g.id} gachee={g} maintenant={maintenant} onChange={(eprouvettes) => onMaj({ eprouvettes })}
              idImport={idImport} inviterAjout={inviterAjout} notes={parAncre} connecte={connecte} />
          </div>

          <Carte titre="Observations" aria-label="Observations" data-section="pesees">
            <textarea className="field-input" rows={3}
              placeholder="Remarques sur la gâchée, la consistance, les incidents…"
              value={g.observations ?? ""} onChange={(e) => onMaj({ observations: e.target.value })} />
          </Carte>

          <div data-section="pesees">
            <CarteProtocolesFiges snapshot={g.protocolesSnapshot} />
          </div>
        </div>

        <aside className="labo-colonne labo-colonne-droite">
          <Carte titre="Résistance mesurée" aria-label="Résistance mesurée" data-section="eprouvettes"
            aside="UCS, ASTM C39/C39M">
            {parAge.length === 0 ? (
              <p className="labo-vide">Aucune éprouvette écrasée pour l&apos;instant.</p>
            ) : (
              <ListeGroupee>
                {parAge.map((a) => (
                  <LigneListe key={a.ageJours}
                    libelle={`${a.ageJours} jours`}
                    detail={`n = ${a.n}${a.ecartTypeKpa !== null ? ` · ± ${Math.round(a.ecartTypeKpa).toLocaleString("fr-CA")} kPa` : ""}${a.cvPct !== null ? ` · CV ${a.cvPct.toFixed(1)} %` : ""}${a.nExclus > 0 ? ` · ${a.nExclus} exclue(s)` : ""}`}
                    valeur={<strong className="labo-ucs">{Math.round(a.moyenneKpa as number).toLocaleString("fr-CA")} kPa</strong>} />
                ))}
              </ListeGroupee>
            )}
          </Carte>

          <Carte titre="Matériaux et pâte fraîche" aria-label="Matériaux et pâte fraîche" data-section="pesees" sansMarge>
            <div className="labo-liste-champs">
              <ListeGroupee>
                <LigneListe libelle="Lot de résidu" htmlFor="lot-residu"><input id="lot-residu" className="field-input" value={g.lotResidu ?? ""} onChange={(e) => onMaj({ lotResidu: e.target.value })} /></LigneListe>
                <LigneListe libelle="Lot de granulat" htmlFor="lot-granulat"><input id="lot-granulat" className="field-input" value={g.lotGranulat ?? ""} onChange={(e) => onMaj({ lotGranulat: e.target.value })} /></LigneListe>
                <LigneListe libelle="Lot de liant" htmlFor="lot-liant"><input id="lot-liant" className="field-input" value={g.lotLiant ?? ""} onChange={(e) => onMaj({ lotLiant: e.target.value })} /></LigneListe>
                <LigneListe libelle="w₀ mesuré (%)" detail="Teneur en eau du résidu, mesure du jour" htmlFor="w0-mesure"><ChampNombre id="w0-mesure" placeholder="—" value={g.w0MesurePct} onChange={(n) => onMaj({ w0MesurePct: n })} /></LigneListe>
                <LigneListe libelle="Affaissement mesuré (mm)" detail="Cône d'Abrams, ASTM C143/C143M" htmlFor="affaissement"><ChampNombre id="affaissement" placeholder="—" value={g.slumpMesureMm} onChange={(n) => onMaj({ slumpMesureMm: n })} /></LigneListe>
                <LigneListe libelle="Température (°C)" htmlFor="temperature"><ChampNombre id="temperature" placeholder="—" value={g.temperatureC} onChange={(n) => onMaj({ temperatureC: n })} /></LigneListe>
                <LigneListe libelle="w mesuré (%)" htmlFor="w-mesure"><ChampNombre id="w-mesure" placeholder="—" value={g.wMesurePct} onChange={(n) => onMaj({ wMesurePct: n })} /></LigneListe>
                <LigneListe libelle="Cw mesuré (%)" htmlFor="cw-mesure"><ChampNombre id="cw-mesure" placeholder="—" value={g.cwMesurePct} onChange={(n) => onMaj({ cwMesurePct: n })} /></LigneListe>
              </ListeGroupee>
            </div>
          </Carte>

          <Carte titre="Échanges" aria-label="Échanges" data-section="echanges">
            {general.length > 0 ? (
              <FilEtudiant kind="gachee" id={g.id} liste={general} connecte={connecte} />
            ) : (
              <p className="labo-vide">
                {annotations.length > 0
                  ? "Les notes de l'enseignant sont affichées sous la pesée ou l'éprouvette qu'elles visent."
                  : "Aucun échange pour l'instant. Les commentaires de l'enseignant apparaîtront ici ou sous la pesée qu'ils visent."}
              </p>
            )}
          </Carte>

          <div data-section="echanges" className="labo-supprimer">
            <button type="button" onClick={onSupprimer} className="btn-discret btn-danger">Supprimer cette gâchée</button>
            <button type="button" onClick={onRetour} className="btn-discret">Toutes les gâchées</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
