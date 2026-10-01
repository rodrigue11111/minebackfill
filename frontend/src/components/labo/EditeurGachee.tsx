"use client";

// Éditeur d'une gâchée (maquette A améliorée). Piloté par ses propriétés : la
// page Labo le relie au magasin, les tests le rendent sans navigateur.
// Colonne principale : frise de cure, pesées sur bande de tolérance (notes de
// l'enseignant en contexte), ajustements, éprouvettes, observations, protocole
// figé. Colonne de droite : résistance mesurée, matériaux et pâte fraîche,
// échanges. Téléphone : un segmenté Pesées | Éprouvettes | Échanges n'affiche
// qu'une partie (CSS seulement, attribut data-vue).

import { useState } from "react";
import { MODES_CURE, TYPES_EAU, UNITES_DOSAGE_ADJUVANT, type Ajustement, type CureGachee, type Gachee, type MateriauxGachee } from "@/lib/gachee";
import { completudeGachee, listeManquants } from "@/lib/completude";
import type { Annotation } from "@/lib/annotations";
import { agregerParAge } from "@/lib/eprouvette";
import { ancresGachee, repartirAnnotations } from "@/lib/ancres";
import { EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { Bandeau } from "@/components/ui/Bandeau";
import { LIBELLE_DECISION, libelleRevue, type Revue } from "@/lib/revues";
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
import { TIRET } from "@/lib/format";
import type { GranulatItem, ResiduItem } from "@/lib/materials";

type VueTelephone = "pesees" | "eprouvettes" | "echanges";

/** Identité d'un matériau de la fiche (le reste de l'instantané, Gs et w₀ du
 *  calcul, n'est jamais touché par un choix dans la bibliothèque). */
type IdentiteMateriau = { id?: string; nom?: string; provenance?: string; catalogue?: "officiel" | "perso" };

/**
 * Choix d'un matériau dans la bibliothèque (officiel et personnel), ou saisie
 * libre (« Autre »). `null` efface l'identité (« Non précisé »).
 */
function LignesMateriau({ id, libelle, detail, items, snap, onChange }: {
  id: string;
  libelle: string;
  detail: string;
  items: (ResiduItem | GranulatItem)[];
  snap: IdentiteMateriau | undefined;
  onChange: (identite: IdentiteMateriau | null) => void;
}) {
  // « Autre » choisi avant d'avoir tapé un nom : sans cet état, la liste
  // reviendrait aussitôt à « Non précisé ».
  const [libre, setLibre] = useState(false);
  const connu = !!snap?.id && items.some((m) => m.id === snap.id);
  const choix = connu && !libre ? snap!.id! : libre || snap?.nom ? "autre" : "";
  return (
    <>
      <LigneListe libelle={libelle} detail={detail} htmlFor={`${id}-choix`}>
        <select id={`${id}-choix`} className="field-input labo-champ-texte" value={choix}
          onChange={(e) => {
            const v = e.target.value;
            setLibre(v === "autre");
            if (v === "") onChange(null);
            // La provenance venait de l'entrée du catalogue : elle part avec elle.
            else if (v === "autre") onChange({ id: undefined, catalogue: undefined, provenance: undefined });
            else {
              const m = items.find((x) => x.id === v);
              if (m) onChange({ id: m.id, nom: m.nom, provenance: m.provenance, catalogue: m.origine });
            }
          }}>
          <option value="">Non précisé</option>
          {items.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.origine === "perso" ? " (personnel)" : ""}</option>)}
          <option value="autre">Autre (saisie libre)</option>
        </select>
      </LigneListe>
      {choix === "autre" && (
        <LigneListe libelle={`Nom (${libelle.toLowerCase()})`} htmlFor={`${id}-nom`}>
          <input id={`${id}-nom`} className="field-input labo-champ-texte" value={snap?.nom ?? ""}
            onChange={(e) => onChange({ nom: e.target.value })} />
        </LigneListe>
      )}
    </>
  );
}

/** L'instantané sans son identité (« Non précisé ») ; undefined s'il ne reste rien. */
function sansIdentite<T extends IdentiteMateriau>(snap: T | undefined): T | undefined {
  if (!snap) return undefined;
  const reste = { ...snap, id: undefined, nom: undefined, provenance: undefined, catalogue: undefined };
  return Object.values(reste).some((v) => v !== undefined && v !== "") ? reste : undefined;
}

const TYPES_AJOUT: { valeur: Ajustement["type"]; libelle: string }[] = [
  { valeur: "eau", libelle: "Eau" }, { valeur: "residu", libelle: "Résidu" },
  { valeur: "granulat", libelle: "Granulat" }, { valeur: "liant", libelle: "Liant" },
];

export default function EditeurGachee({ gachee: g, maintenant, annotations, connecte, onMaj, onRetour, onSupprimer, bibliotheque, revue }: {
  gachee: Gachee;
  maintenant: Date;
  /** Décision de l'enseignant sur cette gâchée (lue en ligne), s'il y en a une. */
  revue?: Revue;
  /** Bibliothèque de matériaux (officiels et personnels) : choix du résidu et
   *  du granulat. Sans elle, le résidu se saisit en texte libre. */
  bibliotheque?: { residus: ResiduItem[]; granulats: GranulatItem[] };
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
  // Groupes imbriqués de la fiche d'essai : toujours une copie complète du
  // groupe (le magasin fusionne au premier niveau seulement).
  const majMateriaux = (patch: Partial<MateriauxGachee>) => onMaj({ materiaux: { ...g.materiaux, ...patch } });
  const majCure = (patch: Partial<CureGachee>) => onMaj({ cure: { ...g.cure, ...patch } });

  const fiche = completudeGachee(g);
  const manquants = listeManquants(fiche);
  const liants = (g.materiaux?.liants ?? [])
    .map((l) => `${l.nom ?? l.code ?? "Liant"}${l.fractionPct != null ? ` ${l.fractionPct.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} %` : ""}`)
    .join(", ");
  // Éprouvettes écartées par l'enseignant, par leur code (l'id reste interne).
  const ecarteesCodes = (revue?.ecartees ?? []).map((id) => g.eprouvettes.find((e) => e.id === id)?.code).filter((c): c is string => !!c);
  const residuSnap = g.materiaux?.residu;
  const granulatSnap = g.materiaux?.granulat;
  const detailGranulat = [
    granulatSnap?.gs != null ? `Gs ${granulatSnap.gs.toLocaleString("fr-CA", { maximumFractionDigits: 3 })}` : null,
    granulatSnap?.provenance ?? null,
  ].filter(Boolean).join(" · ");
  const detailResidu = [
    residuSnap?.gs != null ? `Gs ${residuSnap.gs.toLocaleString("fr-CA", { maximumFractionDigits: 3 })}` : null,
    residuSnap?.w0Pct != null ? `w₀ ${residuSnap.w0Pct.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} %` : null,
    residuSnap?.provenance ?? null,
  ].filter(Boolean).join(" · ");

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
        pastille={<>
          {g.statut === "terminee" ? <Pastille ton="succes">Terminée</Pastille> : <Pastille ton="alerte">Brouillon</Pastille>}
          {revue && (
            <Pastille ton={revue.decision === "acceptee" ? "succes" : "danger"} title={revue.motif ?? undefined}>{libelleRevue(revue)}</Pastille>
          )}
          <Pastille ton="neutre" title="Champs descriptifs renseignés. Rien n'est obligatoire : la fiche sert à la réutilisation des essais.">
            Fiche : {fiche.renseignes}/{fiche.total}
          </Pastille>
        </>}
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

      {revue && (revue.motif || ecarteesCodes.length > 0) && (
        <Bandeau ton="neutre" titre={`Revue de l'enseignant : gâchée ${LIBELLE_DECISION[revue.decision]}.`}>
          {revue.motif && <>Motif : {revue.motif}</>}
          {ecarteesCodes.length > 0 && (
            <>{revue.motif ? " " : ""}Éprouvette{ecarteesCodes.length > 1 ? "s" : ""} écartée{ecarteesCodes.length > 1 ? "s" : ""} par l&apos;enseignant : {ecarteesCodes.join(", ")}.</>
          )}
        </Bandeau>
      )}

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
                <LigneListe libelle="w₀ mesuré (%)" detail="Teneur en eau du résidu, mesure du jour" htmlFor="w0-mesure"><ChampNombre id="w0-mesure" placeholder={TIRET} value={g.w0MesurePct} onChange={(n) => onMaj({ w0MesurePct: n })} /></LigneListe>
                <LigneListe libelle="Affaissement mesuré (mm)" detail="Cône d'Abrams, ASTM C143/C143M" htmlFor="affaissement"><ChampNombre id="affaissement" placeholder={TIRET} value={g.slumpMesureMm} onChange={(n) => onMaj({ slumpMesureMm: n })} /></LigneListe>
                <LigneListe libelle="Température (°C)" htmlFor="temperature"><ChampNombre id="temperature" placeholder={TIRET} value={g.temperatureC} onChange={(n) => onMaj({ temperatureC: n })} /></LigneListe>
                <LigneListe libelle="w mesuré (%)" htmlFor="w-mesure"><ChampNombre id="w-mesure" placeholder={TIRET} value={g.wMesurePct} onChange={(n) => onMaj({ wMesurePct: n })} /></LigneListe>
                <LigneListe libelle="Cw mesuré (%)" htmlFor="cw-mesure"><ChampNombre id="cw-mesure" placeholder={TIRET} value={g.cwMesurePct} onChange={(n) => onMaj({ cwMesurePct: n })} /></LigneListe>
                {bibliotheque ? (
                  <LignesMateriau id="residu" libelle="Résidu" detail={detailResidu || "Choisi dans la bibliothèque, ou saisi librement"}
                    items={bibliotheque.residus} snap={residuSnap}
                    onChange={(identite) => majMateriaux({ residu: identite === null ? sansIdentite(residuSnap) : { ...residuSnap, ...identite } })} />
                ) : (
                  <LigneListe libelle="Résidu" detail={detailResidu || "Nom ou provenance du résidu employé"} htmlFor="residu-nom">
                    <input id="residu-nom" className="field-input labo-champ-texte" value={residuSnap?.nom ?? ""}
                      onChange={(e) => majMateriaux({ residu: { ...residuSnap, nom: e.target.value } })} />
                  </LigneListe>
                )}
                {bibliotheque && (g.categorie === "RPG" || g.materiaux?.granulat) && (
                  <LignesMateriau id="granulat" libelle="Granulat" detail={detailGranulat || "Choisi dans la bibliothèque, ou saisi librement"}
                    items={bibliotheque.granulats} snap={g.materiaux?.granulat}
                    onChange={(identite) => majMateriaux({ granulat: identite === null ? sansIdentite(g.materiaux?.granulat) : { ...g.materiaux?.granulat, ...identite } })} />
                )}
                {liants && <LigneListe libelle="Agent liant" valeur={liants} />}
                <LigneListe libelle="Eau de gâchage" htmlFor="eau-type">
                  <select id="eau-type" className="field-input labo-champ-texte" value={g.materiaux?.eau?.type ?? ""}
                    onChange={(e) => majMateriaux({ eau: { ...g.materiaux?.eau, type: (e.target.value || undefined) as NonNullable<MateriauxGachee["eau"]>["type"] } })}>
                    <option value="">Non précisée</option>
                    {TYPES_EAU.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                  </select>
                </LigneListe>
                <LigneListe libelle="Adjuvant" detail="Nom du produit, s'il y en a un" htmlFor="adjuvant-nom">
                  <input id="adjuvant-nom" className="field-input labo-champ-texte" value={g.materiaux?.adjuvant?.nom ?? ""}
                    onChange={(e) => majMateriaux({ adjuvant: { ...g.materiaux?.adjuvant, nom: e.target.value } })} />
                </LigneListe>
                {g.materiaux?.adjuvant?.nom?.trim() && (
                  <>
                    <LigneListe libelle="Dosage de l'adjuvant" htmlFor="adjuvant-dosage">
                      <ChampNombre id="adjuvant-dosage" placeholder={TIRET} value={g.materiaux?.adjuvant?.dosage}
                        onChange={(n) => majMateriaux({ adjuvant: { ...g.materiaux?.adjuvant, dosage: n, dosageUnite: g.materiaux?.adjuvant?.dosageUnite ?? "ml/100 kg" } })} />
                    </LigneListe>
                    <LigneListe libelle="Unité du dosage" htmlFor="adjuvant-unite">
                      <select id="adjuvant-unite" className="field-input" value={g.materiaux?.adjuvant?.dosageUnite ?? "ml/100 kg"}
                        onChange={(e) => majMateriaux({ adjuvant: { ...g.materiaux?.adjuvant, dosageUnite: e.target.value as (typeof UNITES_DOSAGE_ADJUVANT)[number] } })}>
                        {UNITES_DOSAGE_ADJUVANT.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </LigneListe>
                  </>
                )}
                <LigneListe libelle="Durée de malaxage (min)" htmlFor="malaxage"><ChampNombre id="malaxage" placeholder={TIRET} value={g.malaxageDureeMin} onChange={(n) => onMaj({ malaxageDureeMin: n })} /></LigneListe>
              </ListeGroupee>
              <ListeGroupee titre="Cure des éprouvettes"
                pied={manquants ? `À compléter si vous les connaissez : ${manquants}. Rien n'est obligatoire.` : "Fiche d'essai complète."}>
                <LigneListe libelle="Mode de cure" htmlFor="cure-mode">
                  <select id="cure-mode" className="field-input labo-champ-texte" value={g.cure?.mode ?? ""}
                    onChange={(e) => majCure({ mode: (e.target.value || undefined) as CureGachee["mode"] })}>
                    <option value="">Non précisé</option>
                    {MODES_CURE.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
                  </select>
                </LigneListe>
                <LigneListe libelle="Température de cure (°C)" htmlFor="cure-temperature"><ChampNombre id="cure-temperature" placeholder={TIRET} value={g.cure?.temperatureC} onChange={(n) => majCure({ temperatureC: n })} /></LigneListe>
                <LigneListe libelle="Humidité relative (%)" htmlFor="cure-humidite"><ChampNombre id="cure-humidite" placeholder={TIRET} value={g.cure?.humiditePct} onChange={(n) => majCure({ humiditePct: n })} /></LigneListe>
                <LigneListe libelle="Précision" htmlFor="cure-note"><input id="cure-note" className="field-input labo-champ-texte" value={g.cure?.note ?? ""} onChange={(e) => majCure({ note: e.target.value })} /></LigneListe>
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
