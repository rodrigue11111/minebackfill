"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import MesuresLabo from "@/components/mix/MesuresLabo";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import { fromStoreMass, toStoreMass, MASS_LABELS } from "@/lib/units";
import { num } from "@/lib/format";
import { Field, CardSection, GrilleChamps, ChoixOptions, PiedFormulaire, PointRecette } from "@/components/mix/champs";
import { Bandeau } from "@/components/ui/Bandeau";

export default function RpgEssaiForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgCw,
    rpgWb,
    rpgEssai,
    setRpgEssai,
    setRpgEssaiAjustement,
    setRpgEssaiResult,
    rpgEssaiResult,
    units,
  } = useStore();
  const massLabel = MASS_LABELS[units.mass as keyof typeof MASS_LABELS] ?? "kg";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const binder_system = construireSystemeLiant(general, catalogue_liants);
      const general_payload = construireGeneralPayload(general);
      const constantes_payload = construireConstantesPayload(constantes);
      const base_method = rpgEssai.base_method;

      const base_inputs_cw =
        base_method === "dosage_cw"
          ? {
              category: "RPG",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: rpgCw.residue_sg || 0, moisture_mass_pct: rpgCw.residue_w_pct || 0 },
              binder_system,
              num_recipes: rpgCw.num_recipes,
              containers_per_recipe: rpgCw.desired_qty,
              safety_factor: rpgCw.safety_factor,
              solids_mass_pct: rpgCw.solid_mass_pct,
              saturation_pct: rpgCw.saturation_pct,
              binder_mass_pct_recipes: (rpgCw.binder_pct || []).slice(0, rpgCw.num_recipes),
              aggregate_fraction_pct: rpgCw.aggregate_fraction_pct,
              aggregate_specific_gravity: rpgCw.aggregate_sg,
            }
          : null;

      const base_inputs_wb =
        base_method === "wb"
          ? {
              category: "RPG",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: rpgWb.residue_sg || 0, moisture_mass_pct: rpgWb.residue_w_pct || 0 },
              binder_system,
              num_recipes: rpgWb.num_recipes,
              containers_per_recipe: rpgWb.desired_qty,
              safety_factor: rpgWb.safety_factor,
              saturation_pct: rpgWb.saturation_pct,
              binder_mass_pct_recipes: (rpgWb.binder_pct || []).slice(0, rpgWb.num_recipes),
              wc_ratio_recipes: (rpgWb.wc_ratio || []).slice(0, rpgWb.num_recipes),
              aggregate_fraction_pct: rpgWb.aggregate_fraction_pct,
              aggregate_specific_gravity: rpgWb.aggregate_sg,
            }
          : null;

      const activeBase = base_method === "dosage_cw" ? rpgCw : rpgWb;

      const payload = {
        category: "RPG",
        general: general_payload,
        constants: constantes_payload,
        residue: {
          specific_gravity: activeBase.residue_sg || 0,
          moisture_mass_pct: activeBase.residue_w_pct || 0,
        },
        binder_system,
        num_recipes: activeBase.num_recipes,
        containers_per_recipe: activeBase.desired_qty,
        safety_factor: activeBase.safety_factor,
        base_method,
        base_inputs_cw,
        base_inputs_wb,
        // Tronqué au nombre de recettes ACTIF : un ajustement résiduel d'une
        // recette retirée (p. ex. case W/C cochée puis nombre réduit) ne doit
        // ni partir au serveur ni déclencher sa validation.
        adjustments: (rpgEssai.ajustements || []).slice(0, activeBase.num_recipes || 1).map((a) => ({
          added_dry_residue_mass: a.ajout_residu_sec || 0,
          added_wet_residue_mass: a.ajout_residu_humide || 0,
          added_aggregate_mass: a.ajout_agregat || 0,
          aggregate_moisture_mass_pct: a.w0_agregat || 0,
          added_water_mass: a.ajout_eau || 0,
          dose_binder_by_wc: a.dose_liant_wc || false,
        })),
      };

      const res = await fetch(`${API}/rpg/essai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setRpgEssaiResult(data);
    } catch (e) {
      if (e instanceof TypeError) {
        setError(messageErreurReseau());
      } else {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  const baseMethod = rpgEssai.base_method || "dosage_cw";
  const numRecipes = baseMethod === "dosage_cw" ? (rpgCw.num_recipes || 1) : (rpgWb.num_recipes || 1);

  return (
    <div className="mix-formulaire">
      <Bandeau ton="succes">
        <strong>RPG, méthode essai-erreur :</strong> reprend les données de la méthode RPG de base (dosage selon Cw ou selon E/L).
        L&apos;ajout de granulat modifie Am. Le liant ajouté ne suit que le résidu ajouté :
        un ajout de granulat n&apos;ajoute pas de liant, et dilue donc le Bw atteint.
        L&apos;option « doser le liant selon le rapport E/L » (par recette, ci-dessous) fait plutôt suivre
        le liant à l&apos;eau ajoutée, comme le recommandent Belem et al. 2018 (§3.2.3) quand on
        augmente l&apos;affaissement avec de l&apos;eau.
      </Bandeau>

      <CardSection title="Méthode de base" subtitle="Les paramètres (Gs du granulat, Am, Bw…) sont repris du formulaire RPG correspondant">
        <ChoixOptions
          libelle="Recette de base"
          valeur={baseMethod}
          onChange={(v) => setRpgEssai({ base_method: v })}
          options={[
            { valeur: "dosage_cw", libelle: "Dosage selon Cw", detail: `${rpgCw.num_recipes || 1} recette${(rpgCw.num_recipes || 1) > 1 ? "s" : ""} dans le dosage selon Cw` },
            { valeur: "wb", libelle: "Dosage selon E/L", detail: `${rpgWb.num_recipes || 1} recette${(rpgWb.num_recipes || 1) > 1 ? "s" : ""} dans le dosage selon E/L` },
          ]}
        />
      </CardSection>

      <CardSection title="Ajouts par recette" subtitle={`Quantités ajoutées après le premier malaxage (${massLabel})`}>
        {Array.from({ length: numRecipes }).map((_, i) => {
          const aj = rpgEssai.ajustements?.[i] || {};
          return (
            <div key={i} className="mix-recette">
              <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
              <GrilleChamps>
                <Field label="Résidu sec" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0"
                    value={fromStoreMass(aj.ajout_residu_sec, units.mass) ?? ""}
                    onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_residu_sec: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
                <Field label="Résidu humide" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0"
                    value={fromStoreMass(aj.ajout_residu_humide, units.mass) ?? ""}
                    onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_residu_humide: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
                <Field label="Granulat sec" unit={massLabel} hint="Modifie Am et recalcule le Gs du remblai">
                  <input type="number" step="any" className="field-input" placeholder="0"
                    value={fromStoreMass(aj.ajout_agregat, units.mass) ?? ""}
                    onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_agregat: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
                <Field label="Teneur en eau du granulat ajouté" unit="%" hint="Teneur en eau massique du granulat, tel qu'ajouté">
                  <input type="number" step="any" className="field-input" placeholder="0"
                    value={aj.w0_agregat ?? ""}
                    onChange={(e) => setRpgEssaiAjustement(i, { ...aj, w0_agregat: num(e.target.value) })} />
                </Field>
                <Field label="Eau" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0"
                    value={fromStoreMass(aj.ajout_eau, units.mass) ?? ""}
                    onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_eau: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
              </GrilleChamps>
              <label className="mix-case">
                <input
                  type="checkbox"
                  checked={aj.dose_liant_wc || false}
                  onChange={(e) => setRpgEssaiAjustement(i, { ...aj, dose_liant_wc: e.target.checked })}
                />
                <span>
                  <strong>Doser le liant selon le rapport E/L de conception</strong> : le liant suit
                  l&apos;eau ajoutée (Mb = eau totale / E/L de base) au lieu du pourcentage de masse sèche.
                  Le Bw atteint dérive alors et est affiché tel quel. Exige un Bw &gt; 0 sur la
                  recette de base. Référence : Belem et al. 2018, §3.2.3.
                </span>
              </label>
            </div>
          );
        })}
      </CardSection>

      {/* ── Affaissement visé (protocole essai-erreur, Belem et al. 2018 §2.3) ── */}
      <CardSection title="Affaissement visé" subtitle="Cône d'Abrams normalisé (300 mm, ASTM C143/C143M) ; cible usuelle 178 mm (7 po)">
        <GrilleChamps>
          <Field label="Affaissement visé S" unit="mm" hint="La comparaison s'affiche sous « Affaissement mesuré » ci-dessous ; vider le champ rétablit 178">
            <input type="number" step="any" className="field-input" placeholder="178"
              value={rpgEssai.slump_cible_mm ?? 178}
              onChange={(e) => {
                const v = num(e.target.value);
                setRpgEssai({ slump_cible_mm: v > 0 ? v : undefined });
              }} />
          </Field>
          <p className="mix-note" style={{ alignSelf: "end" }}>
            Affaissement mesuré <strong>sous</strong> la cible : ajouter de l&apos;eau.
            {" "}<strong>Au-dessus</strong> : ajouter résidu et granulat (le liant suit la règle active).
          </p>
        </GrilleChamps>
      </CardSection>

      <MesuresLabo
        numRecipes={numRecipes}
        recipes={rpgEssaiResult?.recipes}
        slumpCibleMm={rpgEssai.slump_cible_mm ?? 178}
      />

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setRpgEssai({ base_method: "dosage_cw", ajustements: [], slump_cible_mm: undefined }); setRpgEssaiResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
