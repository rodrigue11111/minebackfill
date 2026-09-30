"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { ResiduItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import { num } from "@/lib/format";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, PiedFormulaire, PointRecette } from "@/components/mix/champs";

const KAPPA_AIDE = "1 = aucun surplus ; 1,05 = +5 %. Appelé « facteur de sécurité » dans les feuilles de calcul (FS % = FS/100 + 1).";

export default function CwForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    cw,
    setCw,
    setCwRecipe,
    setCwResult,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPC",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: cw.residue_sg || 0, moisture_mass_pct: cw.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: cw.num_recipes,
        containers_per_recipe: cw.desired_qty,
        safety_factor: cw.safety_factor,
        solids_mass_pct: cw.solid_mass_pct,
        saturation_pct: cw.saturation_pct,
        binder_mass_pct_recipes: (cw.binder_pct || []).slice(0, cw.num_recipes),
      };
      const res = await fetch(`${API}/rpc/cw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setCwResult(data);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(messageErreurReseau());
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  const numRecipes = cw.num_recipes || 1;

  return (
    <div className="mix-formulaire">
      <CardSection title="Résidu et eau de mélange">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect
              kind="residus"
              role="residueId"
              label="Résidu (bibliothèque)"
              onPick={(m) => { const r = m as ResiduItem; setCw({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
              matches={(m) => { const r = m as ResiduItem; return r.gs === cw.residue_sg && r.w0_pct === cw.residue_w_pct; }}
            />
          </div>
          <Field label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <input type="number" step="any" className="field-input" placeholder="ex : 3.4"
              value={cw.residue_sg ?? ""} onChange={(e) => setCw({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau massique du résidu w₀" unit="%" hint="Résidu tel que reçu (ASTM D2216)">
            <input type="number" step="any" className="field-input" placeholder="ex : 23.8"
              value={cw.residue_w_pct ?? ""} onChange={(e) => setCw({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Pourcentage solide massique Cw" unit="%" hint="Masse des solides / masse totale du remblai">
            <input type="number" step="any" className="field-input" placeholder="ex : 78"
              value={cw.solid_mass_pct ?? ""} onChange={(e) => setCw({ solid_mass_pct: num(e.target.value) })} />
          </Field>
          <Field label="Degré de saturation Sr" unit="%" hint="100 % = pâte saturée">
            <input type="number" step="any" className="field-input" placeholder="ex : 100"
              value={cw.saturation_pct ?? ""} onChange={(e) => setCw({ saturation_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1}
              value={cw.desired_qty ?? 1} onChange={(e) => setCw({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <input type="number" step="any" className="field-input" min={1}
              value={cw.safety_factor ?? 1} onChange={(e) => setCw({ safety_factor: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setCw({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette" subtitle="Masse de liant / masse sèche de résidu">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={<><PointRecette i={i} />Recette {i + 1} — Bw</>} unit="%">
              <input type="number" step="any" className="field-input" placeholder="ex : 4.5"
                value={cw.binder_pct?.[i] ?? ""} onChange={(e) => setCwRecipe(i, { binder_pct: num(e.target.value) })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => {
          setCw({ solid_mass_pct: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0] });
          setCwResult(null);
          setError(null);
        }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
