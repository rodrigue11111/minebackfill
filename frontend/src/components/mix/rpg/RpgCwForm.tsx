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

export default function RpgCwForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgCw,
    setRpgCw,
    setRpgCwRecipe,
    setRpgCwResult,
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
        residue: { specific_gravity: rpgCw.residue_sg || 0, moisture_mass_pct: rpgCw.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: rpgCw.num_recipes,
        containers_per_recipe: rpgCw.desired_qty,
        safety_factor: rpgCw.safety_factor,
        solids_mass_pct: rpgCw.solid_mass_pct,
        saturation_pct: rpgCw.saturation_pct,
        binder_mass_pct_recipes: (rpgCw.binder_pct || []).slice(0, rpgCw.num_recipes),
        aggregate_fraction_pct: rpgCw.aggregate_fraction_pct,
        aggregate_specific_gravity: rpgCw.aggregate_sg,
      };
      const res = await fetch(`${API}/rpg/cw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setRpgCwResult(data);
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

  const numRecipes = rpgCw.num_recipes || 1;

  return (
    <div className="mix-formulaire">
      <Bandeau ton="succes">
        <strong>Remblai en pâte granulaire :</strong> formules du RPG actives. Le granulat est pris en compte dans le Gs équivalent et dans la répartition des masses.
      </Bandeau>

      <CardSection title="Granulat" subtitle="Paramètres propres au remblai en pâte granulaire">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="granulats" role="aggregateId" label="Granulat (bibliothèque)"
              onPick={(m) => { const g = m as GranulatItem; setRpgCw({ aggregate_sg: g.gs, aggregate_fraction_pct: g.fraction_defaut_pct ?? rpgCw.aggregate_fraction_pct }); }}
              matches={(m) => (m as GranulatItem).gs === rpgCw.aggregate_sg} />
          </div>
          <Field label="Densité relative du granulat Gs" hint="Sans unité : Gs = ρs/ρw">
            <input type="number" step="any" className="field-input" placeholder="ex : 2.65"
              value={rpgCw.aggregate_sg || ""}
              onChange={(e) => setRpgCw({ aggregate_sg: num(e.target.value) })} />
          </Field>
          <ChampFractionGranulat
            amPct={rpgCw.aggregate_fraction_pct || 0}
            gsResidu={rpgCw.residue_sg || 0}
            gsGranulat={rpgCw.aggregate_sg || 0}
            onChangeAm={(am) => setRpgCw({ aggregate_fraction_pct: am })}
          />
        </GrilleChamps>
      </CardSection>

      <CardSection title="Résidu">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="residus" role="residueId" label="Résidu (bibliothèque)"
              onPick={(m) => { const r = m as ResiduItem; setRpgCw({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
              matches={(m) => { const r = m as ResiduItem; return r.gs === rpgCw.residue_sg && r.w0_pct === rpgCw.residue_w_pct; }} />
          </div>
          <Field label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <input type="number" step="any" className="field-input" placeholder="ex : 3.4"
              value={rpgCw.residue_sg || ""} onChange={(e) => setRpgCw({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau massique du résidu w₀" unit="%">
            <input type="number" step="any" className="field-input" placeholder="ex : 23.8"
              value={rpgCw.residue_w_pct || ""} onChange={(e) => setRpgCw({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Pourcentage solide massique Cw" unit="%" hint="Masse des solides / masse totale du remblai">
            <input type="number" step="any" className="field-input" placeholder="ex : 78"
              value={rpgCw.solid_mass_pct || ""} onChange={(e) => setRpgCw({ solid_mass_pct: num(e.target.value) })} />
          </Field>
          <Field label="Degré de saturation Sr" unit="%">
            <input type="number" step="any" className="field-input" placeholder="ex : 100"
              value={rpgCw.saturation_pct || ""} onChange={(e) => setRpgCw({ saturation_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1}
              value={rpgCw.desired_qty ?? 1}
              onChange={(e) => setRpgCw({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <input type="number" step="any" className="field-input" min={1}
              value={rpgCw.safety_factor ?? 1}
              onChange={(e) => setRpgCw({ safety_factor: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setRpgCw({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette" subtitle="Bw = Mb / (Mr + Ma) × 100, masses sèches">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={<><PointRecette i={i} />Recette {i + 1} : Bw</>} unit="%">
              <input type="number" step="any" className="field-input" placeholder="ex : 5"
                value={rpgCw.binder_pct?.[i] ?? ""} onChange={(e) => setRpgCwRecipe(i, { binder_pct: num(e.target.value) })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setRpgCw({ solid_mass_pct: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, aggregate_fraction_pct: 0, aggregate_sg: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0] }); setRpgCwResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
