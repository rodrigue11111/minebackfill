"use client";

import Link from "next/link";
import { confirmerExemple, LIBELLE_EXEMPLE } from "@/lib/exemple";
import { equivalentM3, parametresVolume, volumeMouleM3, volumeTotalM3, LIBELLES_CONTENANT } from "@/lib/contenant";
import { chiffresSignificatifs, fmt } from "@/lib/format";
import Parcours from "@/components/ui/Parcours";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { geometrieDe, memeGeometrie, moulesUsuels, nomPropose, patchMoule } from "@/lib/moules";
import { useStore, lireBinders, patchBinders, MAX_BINDERS } from "@/lib/store";
import type { BinderRef, LiantCatalogueItem } from "@/lib/store";
import {
  fromStoreLength, toStoreLength,
  fromStoreArea, toStoreArea,
  fromStoreVolume, toStoreVolume,
  LENGTH_LABELS, AREA_LABELS, VOLUME_LABELS,
  LENGTH_UNIT_OPTIONS, unitsForLength,
  type VolumeUnit, type LengthUnit,
} from "@/lib/units";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { Icone } from "@/components/ui/Icones";
import Segmente from "@/components/ui/Segmente";
import { lireNombre } from "@/components/ui/ChampNombre";
import { fractionsCompletes } from "@/lib/liants";

const CONTAINER_TYPES = [
  { value: "section_hauteur", label: LIBELLES_CONTENANT.section_hauteur, court: "Section" },
  { value: "rayon_hauteur", label: LIBELLES_CONTENANT.rayon_hauteur, court: "Rayon" },
  { value: "longueur_largeur_hauteur", label: LIBELLES_CONTENANT.longueur_largeur_hauteur, court: "L × l × h" },
  { value: "volume", label: "Volume direct", court: "Volume" },
] as const;

export default function GeneralInfoPage() {
  const router = useRouter();
  const store = useStore();
  const { general, setGeneral, catalogue_liants, fillTestData, units, setUnits, loadUnits } = store;
  const [testLoaded, setTestLoaded] = useState(false);
  // Texte exact en cours de saisie par champ de dimension. Tant qu'un champ
  // est dans cette table, on affiche ce que l'utilisateur tape (sans re-passer
  // par la conversion d'unité), ce qui évite le bruit d'arrondi du type
  // 310 po -> 787,4 cm -> 309,9999... et laisse saisir les décimales.
  const [draftNum, setDraftNum] = useState<Record<string, string>>({});

  // Moules enregistrés (2026-10-26) : choisir un moule remplit ses dimensions ;
  // « Enregistrer ces dimensions » garde celles affichées sous un nom.
  const { moules, enregistrerMoule, retirerMoule } = store;
  const usuels = useMemo(() => moulesUsuels(), []);
  const tousLesMoules = [...usuels, ...moules];
  const geoActuelle = geometrieDe(general);
  const mouleAffiche = tousLesMoules.find((m) => memeGeometrie(m.geometrie, geoActuelle));
  const mouleAffichePerso = mouleAffiche && moules.some((m) => m.id === mouleAffiche.id) ? mouleAffiche : undefined;
  const [nomNouveau, setNomNouveau] = useState<string | null>(null);
  const enregistrerNouveau = () => {
    if (nomNouveau === null || !geoActuelle) return;
    enregistrerMoule(nomNouveau, geoActuelle);
    setNomNouveau(null);
  };

  useEffect(() => { loadUnits(); }, [loadUnits]);

  // Le volume suit toujours le cube de l'unité de longueur choisie (m -> m³,
  // cm -> cm³...). On garde donc units.volume synchronisé, y compris pour
  // d'anciennes préférences enregistrées avec une unité de volume distincte.
  useEffect(() => {
    const want = unitsForLength(units.length as LengthUnit).volume;
    if (units.volume !== want) setUnits({ volume: want });
  }, [units.length, units.volume, setUnits]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!fractionsOk) return;
    router.push("/mix");
  };

  const lengthLabel = LENGTH_LABELS[units.length as keyof typeof LENGTH_LABELS] ?? "cm";
  const areaLabel = AREA_LABELS[units.area as keyof typeof AREA_LABELS] ?? "cm\u00B2";
  // Unité de volume (saisie du contenant ET affichage des résultats) : une
  // seule préférence globale, aussi modifiable dans Réglages.
  const volumeUnit = units.volume as VolumeUnit;
  const volumeMoule = volumeMouleM3(general);
  // Volume total par recette, avec les moules et le κ de la méthode active de Calculs.
  const paramVolume = parametresVolume(store as unknown as Parameters<typeof parametresVolume>[0]);
  const volumeTotal = volumeTotalM3(volumeMoule, paramVolume?.moules, paramVolume?.kappa);
  const vol = (m3: number) => (fromStoreVolume(m3, volumeUnit) ?? 0).toLocaleString("fr-CA", { maximumSignificantDigits: 6 });

  const dimFields = new Set(["container_height", "container_radius", "container_length", "container_width"]);

  const numChange = (
    field:
      | "container_section"
      | "container_height"
      | "container_radius"
      | "container_length"
      | "container_width"
      | "container_volume_m3"
      | "binder1_fraction_pct"
      | "binder2_fraction_pct"
      | "binder3_fraction_pct",
    value: string
  ) => {
    if (value.trim() === "") {
      setGeneral({ [field]: undefined });
      return;
    }
    // Virgule acceptée (« 20,5 ») ; une saisie illisible n'écrit rien (le
    // texte tapé reste affiché, la valeur gardée revient en quittant le champ).
    const n = lireNombre(value);
    if (n === undefined) return;
    if (field === "container_section") {
      setGeneral({ [field]: toStoreArea(n, units.area) });
    } else if (field === "container_volume_m3") {
      setGeneral({ [field]: toStoreVolume(n, volumeUnit) });
    } else if (dimFields.has(field)) {
      setGeneral({ [field]: toStoreLength(n, units.length) });
    } else {
      setGeneral({ [field]: n });
    }
  };

  // Valeur affichée dans un champ de dimension : le brouillon en cours s'il
  // existe, sinon la valeur canonique du store nettoyée à 12 chiffres
  // significatifs (efface le bruit de conversion sans perdre de précision utile).
  const showNum = (field: string, canonical: number | null | undefined): string => {
    if (field in draftNum) return draftNum[field];
    if (canonical === null || canonical === undefined || Number.isNaN(canonical)) return "";
    return chiffresSignificatifs(canonical, 6);
  };

  const editNum = (field: Parameters<typeof numChange>[0], raw: string) => {
    setDraftNum((d) => ({ ...d, [field]: raw }));
    numChange(field, raw);
  };

  const commitNum = (field: string) => {
    setDraftNum((d) => {
      if (!(field in d)) return d;
      const next = { ...d };
      delete next[field];
      return next;
    });
  };

  // Composants du liant (liste N-aire, repli legacy via lireBinders).
  const binders = lireBinders(general);
  const fractionTotal = binders.reduce((s, b) => s + (b.fraction_pct ?? 0), 0);

  const fractionOk = fractionsCompletes(fractionTotal);
  // Plusieurs composants : leurs fractions doivent faire 100 % (le calcul les
  // refuse sinon, et le Labo afficherait « 60 %, 60 % »).
  const fractionsOk = binders.length < 2 || fractionOk;
  const liantsValides = catalogue_liants.filter((l: LiantCatalogueItem) => String(l.code ?? "").trim() !== "");

  const setBinders = (next: BinderRef[]) => setGeneral(patchBinders(next));
  const updateBinder = (i: number, patch: Partial<BinderRef>) =>
    setBinders(binders.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addBinder = () => setBinders([...binders, { id: null, code: null, fraction_pct: undefined }]);
  const removeBinder = (i: number) => setBinders(binders.filter((_, j) => j !== i));
  // Fraction d'un composant : brouillon de saisie (évite le clignotement des
  // décimales) keyé par index, comme les dimensions.
  const editBinderFrac = (i: number, raw: string) => {
    setDraftNum((d) => ({ ...d, [`binder_frac_${i}`]: raw }));
    if (raw.trim() === "") { updateBinder(i, { fraction_pct: undefined }); return; }
    const n = lireNombre(raw);
    if (n !== undefined) updateBinder(i, { fraction_pct: n });
  };

  const champDim = (field: Parameters<typeof numChange>[0], libelle: string, unite: string, valeur: number | null | undefined, placeholder?: string) => (
    <Champ libelle={libelle} unite={unite}>
      <input type="text" inputMode="decimal" className="field-input" value={showNum(field, valeur)}
        onChange={(e) => editNum(field, e.target.value)} onBlur={() => commitNum(field)} placeholder={placeholder} />
    </Champ>
  );

  return (
    <Page>
      <EnTetePage
        surtitre="Étape 1 : configuration du projet"
        titre="Informations"
        sousTitre="Identification du projet, dimensions des moules et agent liant. Ces informations apparaissent dans les exports."
        actions={
          <>
            <Link href="/guide" className="btn-discret">Guide d&apos;utilisation</Link>
            <Link href="/mix" className="btn-discret">Passer aux calculs</Link>
          </>
        }
      />
      <Parcours courante={1} />

      <form onSubmit={handleSave} className="info-formulaire">
        {/* ── 1. Identification ── */}
        <Carte titre="Identification du projet">
          <div className="grille-2">
            <Champ libelle="Nom de l'opérateur">
              <input type="text" className="field-input" value={general.operator_name ?? ""}
                onChange={(e) => setGeneral({ operator_name: e.target.value })} placeholder="Ex. : J. Dupont" />
            </Champ>
            <Champ libelle="Nom du projet">
              <input type="text" className="field-input" value={general.project_name ?? ""}
                onChange={(e) => setGeneral({ project_name: e.target.value })} placeholder="Ex. : Mine LaRonde" />
            </Champ>
            <Champ libelle="Identification du résidu">
              <input type="text" className="field-input" value={general.residue_id ?? ""}
                onChange={(e) => setGeneral({ residue_id: e.target.value })} placeholder="Ex. : R-2024-A" />
            </Champ>
            <Champ libelle="Date de mélange">
              <input type="date" className="field-input" value={general.mix_date ?? ""}
                onChange={(e) => setGeneral({ mix_date: e.target.value })} />
            </Champ>
          </div>
        </Carte>

        {/* ── 2. Dimensions des moules ── */}
        <Carte titre="Dimensions des moules">
          {/* Unité de mesure — un seul choix pour tout le moule. L'aire
              (section) est son carré et le volume (saisie directe ET résultats)
              son cube : aucune unité de volume à choisir séparément. */}
          <div className="info-unite">
            <Champ libelle="Unité de mesure"
              aide={<>Un seul choix pour tout le moule : les dimensions en {lengthLabel}, la section en{" "}
                {areaLabel}, et le volume (saisie directe comme résultats) automatiquement en{" "}
                {VOLUME_LABELS[volumeUnit]}.</>}>
              <select className="field-input" value={units.length}
                onChange={(e) => setUnits(unitsForLength(e.target.value as LengthUnit))}>
                {LENGTH_UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{LENGTH_LABELS[u]}</option>
                ))}
              </select>
            </Champ>
          </div>

          <div className="ui-champ">
            <span className="ui-champ-libelle" style={{ marginBottom: 6 }}>Géométrie</span>
            <Segmente
              ariaLabel="Géométrie du moule"
              valeur={general.container_type ?? ""}
              onChange={(v) => setGeneral({ container_type: v as (typeof CONTAINER_TYPES)[number]["value"] })}
              options={CONTAINER_TYPES.map((ct) => ({ valeur: ct.value, libelle: ct.label, libelleCourt: ct.court }))}
            />
          </div>

          <div className="info-moules">
            <Champ libelle="Moules enregistrés sur cet appareil"
              aide="Choisir un moule remplit ses dimensions. Vos moules restent dans ce navigateur, et la sauvegarde de Mes calculs les garde.">
              <select className="field-input" value={mouleAffiche?.id ?? ""}
                onChange={(e) => {
                  const m = tousLesMoules.find((x) => x.id === e.target.value);
                  if (!m) return;
                  setDraftNum({});
                  setGeneral(patchMoule(m));
                }}>
                <option value="">Choisir un moule…</option>
                <optgroup label="Moules usuels">
                  {usuels.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </optgroup>
                {moules.length > 0 && (
                  <optgroup label="Mes moules">
                    {moules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </optgroup>
                )}
              </select>
            </Champ>
            <div className="info-moules-actions">
              {nomNouveau === null ? (
                <>
                  <button type="button" className="btn-secondary" disabled={!geoActuelle || !!mouleAffiche}
                    title={!geoActuelle ? "Saisissez d'abord toutes les dimensions." : mouleAffiche ? `Déjà enregistré : ${mouleAffiche.nom}` : undefined}
                    onClick={() => geoActuelle && setNomNouveau(nomPropose(geoActuelle))}>
                    Enregistrer ces dimensions
                  </button>
                  {mouleAffichePerso && (
                    <button type="button" className="btn-discret btn-danger"
                      onClick={() => {
                        if (window.confirm(`Retirer le moule « ${mouleAffichePerso.nom} » de la liste ? Les calculs et les éprouvettes qui ont ces dimensions les gardent.`)) {
                          retirerMoule(mouleAffichePerso.id);
                        }
                      }}>
                      Retirer ce moule
                    </button>
                  )}
                </>
              ) : (
                <>
                  <input className="field-input" aria-label="Nom du moule" maxLength={60} value={nomNouveau} autoFocus
                    onChange={(e) => setNomNouveau(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enregistrerNouveau(); } if (e.key === "Escape") setNomNouveau(null); }} />
                  <button type="button" className="btn-primary" onClick={enregistrerNouveau}>Enregistrer</button>
                  <button type="button" className="btn-discret" onClick={() => setNomNouveau(null)}>Annuler</button>
                </>
              )}
            </div>
          </div>

          {!general.container_type ? (
            <Bandeau ton="info">Sélectionnez une géométrie ci-dessus pour saisir les dimensions.</Bandeau>
          ) : (
            <div className="grille-auto">
              {general.container_type === "section_hauteur" && (
                <>
                  {champDim("container_section", "Section", areaLabel, fromStoreArea(general.container_section, units.area), "Ex. : 80.45")}
                  {champDim("container_height", "Hauteur", lengthLabel, fromStoreLength(general.container_height, units.length), "Ex. : 20.5")}
                </>
              )}
              {general.container_type === "rayon_hauteur" && (
                <>
                  {champDim("container_radius", "Rayon", lengthLabel, fromStoreLength(general.container_radius, units.length), "Ex. : 5.0625")}
                  {champDim("container_height", "Hauteur", lengthLabel, fromStoreLength(general.container_height, units.length), "Ex. : 20.5")}
                </>
              )}
              {general.container_type === "longueur_largeur_hauteur" && (
                <>
                  {champDim("container_length", "Longueur", lengthLabel, fromStoreLength(general.container_length, units.length))}
                  {champDim("container_width", "Largeur", lengthLabel, fromStoreLength(general.container_width, units.length))}
                  {champDim("container_height", "Hauteur", lengthLabel, fromStoreLength(general.container_height, units.length))}
                </>
              )}
              {general.container_type === "volume" &&
                champDim("container_volume_m3", "Volume d'un moule", VOLUME_LABELS[volumeUnit], fromStoreVolume(general.container_volume_m3, volumeUnit), "Ex. : 1.65")}
            </div>
          )}
          {volumeMoule !== null && (
            // Même géométrie que le calcul : l'étudiant voit tout de suite
            // ce qu'un moule contient (et repère une dimension mal saisie).
            <p className="ui-liste-pied" style={{ margin: 0 }}>
              Volume d&apos;un moule : <strong>{vol(volumeMoule)} {VOLUME_LABELS[volumeUnit]}</strong>{equivalentM3(volumeMoule, volumeUnit)}.
              {volumeTotal !== null && paramVolume && (
                <>
                  {" "}Volume total à préparer par recette : VT = {vol(volumeMoule)} × {paramVolume.moules} moule{paramVolume.moules! > 1 ? "s" : ""} × κ {paramVolume.kappa!.toLocaleString("fr-CA")} = <strong>{vol(volumeTotal)} {VOLUME_LABELS[volumeUnit]}</strong>{equivalentM3(volumeTotal, volumeUnit)}
                  . Le nombre de moules par recette et le facteur de perte κ se règlent dans la page Calculs.
                </>
              )}
              {store.category === "RRC" && " En RRC, la quantité vient de la page Calculs (volume du chantier ou masse totale), pas du moule."}
            </p>
          )}
        </Carte>

        {/* ── 3. Agent liant ── */}
        <Carte titre="Agent liant" aside="Ciment Portland et ajouts cimentaires, en fractions massiques">
          <div className="info-composants">
            {binders.map((b, idx) => {
              // Sélection par id (identité stable) ; repli par code pour les
              // états enregistrés avant l'introduction des binderN_id.
              const selectedLiantId =
                b.id ??
                liantsValides.find((l: LiantCatalogueItem) => l.code === b.code)?.id ??
                "";
              return (
                <div key={idx} className="info-composant">
                  <div className="info-composant-tete">
                    <span>Composant {idx + 1}</span>
                    {binders.length > 1 && (
                      <button type="button" onClick={() => removeBinder(idx)} className="btn-discret"
                        aria-label={`Retirer le composant ${idx + 1}`}>
                        Retirer
                      </button>
                    )}
                  </div>
                  <div className="info-composant-champs">
                    <Champ libelle="Liant">
                      <select className="field-input" value={selectedLiantId}
                        onChange={(e) => {
                          const item = liantsValides.find((l: LiantCatalogueItem) => l.id === e.target.value);
                          updateBinder(idx, { id: item?.id ?? null, code: item?.code ?? null });
                        }}>
                        <option value="">Sélectionner…</option>
                        {liantsValides.map((liant: LiantCatalogueItem) => (
                          <option key={liant.id} value={liant.id}>
                            {liant.nom} ({liant.code}), Gs {fmt(Number(liant.gs), 4)}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Fraction massique" unite="%">
                      <input type="text" inputMode="decimal" className="field-input"
                        value={showNum(`binder_frac_${idx}`, b.fraction_pct)}
                        onChange={(e) => editBinderFrac(idx, e.target.value)}
                        onBlur={() => commitNum(`binder_frac_${idx}`)}
                        placeholder={`Ex. : ${idx === 0 ? 60 : 40}`} />
                    </Champ>
                  </div>
                </div>
              );
            })}
          </div>

          {binders.length < MAX_BINDERS && (
            <button type="button" onClick={addBinder} className="btn-discret" style={{ alignSelf: "flex-start" }}>
              <Icone nom="ajouter" taille={14} epaisseur={2.4} />
              Ajouter un composant
            </button>
          )}

          {binders.length >= 2 && (
            <Bandeau ton={fractionOk ? "succes" : "alerte"}>
              Total des fractions : <strong>{fractionTotal.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</strong>
              {!fractionOk && ". La somme doit être égale à 100 %."}
            </Bandeau>
          )}

          <p className="ui-liste-pied" style={{ margin: 0 }}>
            Catalogue des liants (densités relatives Gs) et constantes physiques : <Link href="/reglages">Réglages</Link>.
          </p>
        </Carte>

        {/* ── Actions ── */}
        <div className="info-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              // L'exemple remplace le projet : jamais sans l'accord de l'étudiant.
              if (!confirmerExemple()) return;
              try { fillTestData(); setTestLoaded(true); setTimeout(() => setTestLoaded(false), 4000); } catch (e) { console.error("[fillTestData] error:", e); }
            }}
            title="Charge un exemple complet à l'échelle du laboratoire (après confirmation)"
          >
            {testLoaded ? "Exemple chargé" : LIBELLE_EXEMPLE}
          </button>
          <button type="submit" className="btn-primary" disabled={!fractionsOk}
            title={fractionsOk ? undefined : "La somme des fractions du liant doit être égale à 100 %"}>
            Enregistrer et continuer
          </button>
        </div>
      </form>
    </Page>
  );
}
