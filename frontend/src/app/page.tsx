"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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

const CONTAINER_TYPES = [
  { value: "section_hauteur", label: "Section et hauteur", court: "Section" },
  { value: "rayon_hauteur", label: "Rayon et hauteur", court: "Rayon" },
  { value: "longueur_largeur_hauteur", label: "Longueur × largeur × hauteur", court: "L × l × h" },
  { value: "volume", label: "Volume direct", court: "Volume" },
] as const;

export default function GeneralInfoPage() {
  const router = useRouter();
  const { general, setGeneral, catalogue_liants, fillTestData, units, setUnits, loadUnits } = useStore();
  const [testLoaded, setTestLoaded] = useState(false);
  // Texte exact en cours de saisie par champ de dimension. Tant qu'un champ
  // est dans cette table, on affiche ce que l'utilisateur tape (sans re-passer
  // par la conversion d'unité), ce qui évite le bruit d'arrondi du type
  // 310 po -> 787,4 cm -> 309,9999... et laisse saisir les décimales.
  const [draftNum, setDraftNum] = useState<Record<string, string>>({});

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
    router.push("/mix");
  };

  const lengthLabel = LENGTH_LABELS[units.length as keyof typeof LENGTH_LABELS] ?? "cm";
  const areaLabel = AREA_LABELS[units.area as keyof typeof AREA_LABELS] ?? "cm\u00B2";
  // Unité de volume (saisie du contenant ET affichage des résultats) : une
  // seule préférence globale, aussi modifiable dans Réglages.
  const volumeUnit = units.volume as VolumeUnit;

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
    if (value === "") {
      setGeneral({ [field]: undefined });
    } else if (field === "container_section") {
      setGeneral({ [field]: toStoreArea(Number(value), units.area) });
    } else if (field === "container_volume_m3") {
      setGeneral({ [field]: toStoreVolume(Number(value), volumeUnit) });
    } else if (dimFields.has(field)) {
      setGeneral({ [field]: toStoreLength(Number(value), units.length) });
    } else {
      setGeneral({ [field]: Number(value) });
    }
  };

  // Valeur affichée dans un champ de dimension : le brouillon en cours s'il
  // existe, sinon la valeur canonique du store nettoyée à 12 chiffres
  // significatifs (efface le bruit de conversion sans perdre de précision utile).
  const showNum = (field: string, canonical: number | null | undefined): string => {
    if (field in draftNum) return draftNum[field];
    if (canonical === null || canonical === undefined || Number.isNaN(canonical)) return "";
    return String(Number(canonical.toPrecision(12)));
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

  const fractionOk = Math.abs(fractionTotal - 100) < 0.01;
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
    updateBinder(i, { fraction_pct: raw === "" ? undefined : Number(raw) });
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
        sousTitre="Identification du projet, contenant de moulage et agent liant. Ces informations apparaissent dans les exports."
        actions={
          <>
            <Link href="/guide" className="btn-discret">Guide d&apos;utilisation</Link>
            <Link href="/mix" className="btn-discret">Passer aux calculs</Link>
          </>
        }
      />

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

        {/* ── 2. Contenant ── */}
        <Carte titre="Contenant de moulage">
          {/* Unité de mesure — un seul choix pour tout le contenant. L'aire
              (section) est son carré et le volume (saisie directe ET résultats)
              son cube : aucune unité de volume à choisir séparément. */}
          <div className="info-unite">
            <Champ libelle="Unité de mesure"
              aide={<>Un seul choix pour tout le contenant : les dimensions en {lengthLabel}, la section en{" "}
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
              ariaLabel="Géométrie du contenant"
              valeur={general.container_type ?? ""}
              onChange={(v) => setGeneral({ container_type: v as (typeof CONTAINER_TYPES)[number]["value"] })}
              options={CONTAINER_TYPES.map((ct) => ({ valeur: ct.value, libelle: ct.label, libelleCourt: ct.court }))}
            />
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
                champDim("container_volume_m3", "Volume du contenant", VOLUME_LABELS[volumeUnit], fromStoreVolume(general.container_volume_m3, volumeUnit), "Ex. : 1.65")}
            </div>
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
                            {liant.nom} ({liant.code}), Gs {Number(liant.gs).toFixed(4)}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Fraction massique" unite="%">
                      <input type="number" step="any" min={0} max={100} className="field-input"
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
              Total des fractions : <strong>{fractionTotal.toFixed(1)} %</strong>
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
            onClick={() => { try { fillTestData(); setTestLoaded(true); setTimeout(() => setTestLoaded(false), 2500); } catch (e) { console.error("[fillTestData] error:", e); } }}
            title="Charge les valeurs du classeur de référence Intra 2017"
          >
            {testLoaded ? "Valeurs Intra 2017 chargées" : "Exemple Intra 2017"}
          </button>
          <button type="submit" className="btn-primary">
            Enregistrer et continuer
          </button>
        </div>
      </form>
    </Page>
  );
}
