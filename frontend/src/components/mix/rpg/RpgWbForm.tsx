"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { ResiduItem, GranulatItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import { num } from "@/lib/format";
import ChampFractionGranulat from "./ChampFractionGranulat";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, PiedFormulaire, PointRecette } from "@/components/mix/champs";
import { Bandeau } from "@/components/ui/Bandeau";

const KAPPA_AIDE = "1 = aucun surplus ; 1,05 = +5 %. Appelé « facteur de sécurité » dans les feuilles de calcul (FS % = FS/100 + 1).";

export default function RpgWbForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgWb,
    setRpgWb,
    setRpgWbRecipe,
    setRpgWbResult,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPG",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: rpgWb.residue_sg || 0, moisture_mass_pct: rpgWb.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: rpgWb.num_recipes,
        containers_per_recipe: rpgWb.desired_qty,
        safety_factor: rpgWb.safety_factor,
        saturation_pct: rpgWb.saturation_pct,
        binder_mass_pct_recipes: (rpgWb.binder_pct || []).slice(0, rpgWb.num_recipes),
        wc_ratio_recipes: (rpgWb.wc_ratio || []).slice(0, rpgWb.num_recipes),
        aggregate_fraction_pct: rpgWb.aggregate_fraction_pct,
        aggregate_specific_gravity: rpgWb.aggregate_sg,
      };
      const res = await fetch(`${API}/rpg/wb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setRpgWbResult(data);
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

  const numRecipes = rpgWb.num_recipes || 1;

  return (
    <div className="mix-formulaire">
      <Bandeau ton="succes">
        <strong>Remblai en pâte granulaire :</strong> formules du RPG actives. Le Cw est déduit du rapport E/L et du Bw selon la relation du RPG.
      </Bandeau>

      <CardSection title="Granulat" subtitle="Paramètres propres au remblai en pâte granulaire">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="granulats" role="aggregateId" label="Granulat (bibliothèque)"
              onPick={(m) => { const g = m as GranulatItem; setRpgWb({ aggregate_sg: g.gs, aggregate_fraction_pct: g.fraction_defaut_pct ?? rpgWb.aggregate_fraction_pct }); }}
              matches={(m) => (m as GranulatItem).gs === rpgWb.aggregate_sg} />
          </div>
          <Field label="Densité relative du granulat Gs" hint="Sans unité : Gs = ρs/ρw">
            <input type="number" step="any" className="field-input" placeholder="ex : 2.65"
              value={rpgWb.aggregate_sg || ""}
              onChange={(e) => setRpgWb({ aggregate_sg: num(e.target.value) })} />
          </Field>
          <ChampFractionGranulat
            amPct={rpgWb.aggregate_fraction_pct || 0}
            gsResidu={rpgWb.residue_sg || 0}
            gsGranulat={rpgWb.aggregate_sg || 0}
            onChangeAm={(am) => setRpgWb({ aggregate_fraction_pct: am })}
          />
        </GrilleChamps>
      </CardSection>

      <CardSection title="Résidu et saturation">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="residus" role="residueId" label="Résidu (bibliothèque)"
              onPick={(m) => { const r = m as ResiduItem; setRpgWb({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
              matches={(m) => { const r = m as ResiduItem; return r.gs === rpgWb.residue_sg && r.w0_pct === rpgWb.residue_w_pct; }} />
          </div>
          <Field label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <input type="number" step="any" className="field-input" placeholder="ex : 3.4"
              value={rpgWb.residue_sg || ""} onChange={(e) => setRpgWb({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau massique du résidu w₀" unit="%">
            <input type="number" step="any" className="field-input" placeholder="ex : 23.8"
              value={rpgWb.residue_w_pct || ""} onChange={(e) => setRpgWb({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Degré de saturation Sr" unit="%">
            <input type="number" step="any" className="field-input" placeholder="ex : 100"
              value={rpgWb.saturation_pct || ""} onChange={(e) => setRpgWb({ saturation_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1}
              value={rpgWb.desired_qty ?? 1}
              onChange={(e) => setRpgWb({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <input type="number" step="any" className="field-input" min={1}
              value={rpgWb.safety_factor ?? 1}
              onChange={(e) => setRpgWb({ safety_factor: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setRpgWb({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw et rapport eau/liant E/L par recette" subtitle="Bw = Mb / (Mr + Ma) × 100  ·  E/L = Mw / Mb">
        {Array.from({ length: numRecipes }).map((_, i) => (
          <div key={i} className="mix-recette">
            <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
            <GrilleChamps>
              <Field label="Taux massique de liant Bw" unit="%" hint="Masse de liant / masse sèche de résidu et de granulat">
                <input type="number" step="any" className="field-input" placeholder="ex : 5"
                  value={rpgWb.binder_pct?.[i] ?? ""} onChange={(e) => setRpgWbRecipe(i, { binder_pct: num(e.target.value) })} />
              </Field>
              <Field label="Rapport eau/liant E/L" hint="Ex. : 4 à 8">
                <input type="number" step="any" className="field-input" placeholder="ex : 6.0"
                  value={rpgWb.wc_ratio?.[i] ?? ""} onChange={(e) => setRpgWbRecipe(i, { wc_ratio: num(e.target.value) })} />
              </Field>
            </GrilleChamps>
          </div>
        ))}
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setRpgWb({ saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, aggregate_fraction_pct: 0, aggregate_sg: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0], wc_ratio: [0, 0, 0, 0] }); setRpgWbResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
