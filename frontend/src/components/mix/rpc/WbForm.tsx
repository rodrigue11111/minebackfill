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

export default function WbForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    wb,
    setWb,
    setWbRecipe,
    setWbResult,
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
        residue: { specific_gravity: wb.residue_sg || 0, moisture_mass_pct: wb.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: wb.num_recipes,
        containers_per_recipe: wb.desired_qty,
        safety_factor: wb.safety_factor,
        saturation_pct: wb.saturation_pct,
        binder_mass_pct_recipes: (wb.binder_pct || []).slice(0, wb.num_recipes),
        wc_ratio_recipes: (wb.wc_ratio || []).slice(0, wb.num_recipes),
      };
      const res = await fetch(`${API}/rpc/wb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setWbResult(data);
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

  const numRecipes = wb?.num_recipes || 1;

  return (
    <div className="mix-formulaire">
      <CardSection title="Résidu et saturation">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="residus" role="residueId" label="Résidu (bibliothèque)"
              onPick={(m) => { const r = m as ResiduItem; setWb({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
              matches={(m) => { const r = m as ResiduItem; return r.gs === wb.residue_sg && r.w0_pct === wb.residue_w_pct; }} />
          </div>
          <Field label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <input type="number" step="any" className="field-input" placeholder="ex : 3.4" value={wb?.residue_sg ?? ""} onChange={(e) => setWb({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau massique du résidu w₀" unit="%" hint="Résidu tel que reçu (ASTM D2216)">
            <input type="number" step="any" className="field-input" placeholder="ex : 23.8" value={wb?.residue_w_pct ?? ""} onChange={(e) => setWb({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Degré de saturation Sr" unit="%" hint="100 % = pâte saturée">
            <input type="number" step="any" className="field-input" placeholder="ex : 100" value={wb?.saturation_pct ?? ""} onChange={(e) => setWb({ saturation_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1} value={wb?.desired_qty ?? 1} onChange={(e) => setWb({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <input type="number" step="any" className="field-input" min={1} value={wb?.safety_factor ?? 1} onChange={(e) => setWb({ safety_factor: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setWb({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw et rapport eau/liant E/L par recette" subtitle="E/L = masse d'eau / masse de liant (noté aussi W/C)">
        {Array.from({ length: numRecipes }).map((_, i) => (
          <div key={i} className="mix-recette">
            <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
            <GrilleChamps>
              <Field label="Taux massique de liant Bw" unit="%" hint="Masse de liant / masse sèche de résidu">
                <input type="number" step="any" className="field-input" placeholder="ex : 4.5"
                  value={wb?.binder_pct?.[i] ?? ""} onChange={(e) => setWbRecipe(i, { binder_pct: num(e.target.value) })} />
              </Field>
              <Field label="Rapport eau/liant E/L" hint="Ex. : 4 à 8">
                <input type="number" step="any" className="field-input" placeholder="ex : 6.0"
                  value={wb?.wc_ratio?.[i] ?? ""} onChange={(e) => setWbRecipe(i, { wc_ratio: num(e.target.value) })} />
              </Field>
            </GrilleChamps>
          </div>
        ))}
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setWb({ saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0], wc_ratio: [0, 0, 0, 0] }); setWbResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
