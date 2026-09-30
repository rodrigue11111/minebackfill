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
import { Field, CardSection, ChoixOptions, PiedFormulaire, PointRecette } from "@/components/mix/champs";
import { Bandeau } from "@/components/ui/Bandeau";

export default function EssaiForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    cw,
    wb,
    essai,
    setEssai,
    setEssaiAjustement,
    setEssaiResult,
    essaiResult,
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
      const base_method = essai.base_method;
      const base_inputs =
        base_method === "dosage_cw"
          ? {
              category: "RPC",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: cw.residue_sg || 0, moisture_mass_pct: cw.residue_w_pct || 0 },
              binder_system,
              num_recipes: cw.num_recipes,
              containers_per_recipe: cw.desired_qty,
              safety_factor: cw.safety_factor,
              solids_mass_pct: cw.solid_mass_pct,
              saturation_pct: cw.saturation_pct,
              binder_mass_pct_recipes: (cw.binder_pct || []).slice(0, cw.num_recipes),
            }
          : {
              category: "RPC",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: wb.residue_sg || 0, moisture_mass_pct: wb.residue_w_pct || 0 },
              binder_system,
              num_recipes: wb.num_recipes,
              containers_per_recipe: wb.desired_qty,
              safety_factor: wb.safety_factor,
              saturation_pct: wb.saturation_pct,
              binder_mass_pct_recipes: (wb.binder_pct || []).slice(0, wb.num_recipes),
              wc_ratio_recipes: (wb.wc_ratio || []).slice(0, wb.num_recipes),
            };

      const payload = {
        category: "RPC",
        general: general_payload,
        constants: constantes_payload,
        residue: { specific_gravity: (base_method === "dosage_cw" ? cw.residue_sg : wb.residue_sg) || 0, moisture_mass_pct: (base_method === "dosage_cw" ? cw.residue_w_pct : wb.residue_w_pct) || 0 },
        binder_system,
        num_recipes: base_method === "dosage_cw" ? cw.num_recipes : wb.num_recipes,
        containers_per_recipe: base_method === "dosage_cw" ? cw.desired_qty : wb.desired_qty,
        safety_factor: base_method === "dosage_cw" ? cw.safety_factor : wb.safety_factor,
        base_method,
        base_inputs_cw: base_method === "dosage_cw" ? base_inputs : null,
        base_inputs_wb: base_method === "wb" ? base_inputs : null,
        adjustments: (essai.ajustements || []).map((a) => ({
          added_dry_residue_mass: a.ajout_residu_sec || 0,
          added_wet_residue_mass: a.ajout_residu_humide || 0,
          added_water_mass: a.ajout_eau || 0,
        })),
      };

      const res = await fetch(`${API}/rpc/essai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setEssaiResult(data);
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

  const baseMethod = essai.base_method || "dosage_cw";
  const numRecipes = baseMethod === "dosage_cw" ? (cw.num_recipes || 1) : (wb.num_recipes || 1);

  return (
    <div className="mix-formulaire">
      <Bandeau ton="info">
        <strong>Méthode essai-erreur :</strong> reprend les données de la méthode de base (dosage selon Cw ou selon E/L) et permet d&apos;entrer, par recette, les ajouts réels faits après la mesure de l&apos;affaissement.
      </Bandeau>

      <CardSection title="Méthode de base" subtitle="Les paramètres sont repris du formulaire correspondant">
        <ChoixOptions
          libelle="Recette de base"
          valeur={baseMethod}
          onChange={(v) => setEssai({ base_method: v })}
          options={[
            { valeur: "dosage_cw", libelle: "Dosage selon Cw", detail: `${cw.num_recipes || 1} recette${(cw.num_recipes || 1) > 1 ? "s" : ""} dans le dosage selon Cw` },
            { valeur: "wb", libelle: "Dosage selon E/L", detail: `${wb.num_recipes || 1} recette${(wb.num_recipes || 1) > 1 ? "s" : ""} dans le dosage selon E/L` },
          ]}
        />
      </CardSection>

      <CardSection title="Ajouts par recette" subtitle={`Quantités ajoutées après le premier malaxage (${massLabel})`}>
        {Array.from({ length: numRecipes }).map((_, i) => {
          const aj = essai.ajustements?.[i] || {};
          return (
            <div key={i} className="mix-recette">
              <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
              <div className="mix-grille-3">
                <Field label="Résidu sec" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0" value={fromStoreMass(aj.ajout_residu_sec, units.mass) ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_residu_sec: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
                <Field label="Résidu humide" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0" value={fromStoreMass(aj.ajout_residu_humide, units.mass) ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_residu_humide: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
                <Field label="Eau" unit={massLabel}>
                  <input type="number" step="any" className="field-input" placeholder="0" value={fromStoreMass(aj.ajout_eau, units.mass) ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_eau: toStoreMass(num(e.target.value), units.mass) ?? undefined })} />
                </Field>
              </div>
            </div>
          );
        })}
      </CardSection>

      <MesuresLabo numRecipes={numRecipes} recipes={essaiResult?.recipes} />

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setEssai({ base_method: "dosage_cw", ajustements: [] }); setEssaiResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
