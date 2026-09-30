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
import { fromStoreSlump, toStoreSlump, SLUMP_LABELS } from "@/lib/units";
import { num } from "@/lib/format";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, ChoixOptions, PiedFormulaire, PointRecette } from "@/components/mix/champs";

const KAPPA_AIDE = "1 = aucun surplus ; 1,05 = +5 %. Appelé « facteur de sécurité » dans les feuilles de calcul (FS % = FS/100 + 1).";

export default function SlumpForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    slump,
    setSlump,
    setSlumpRecipe,
    setSlumpResult,
    units,
  } = useStore();
  const slumpLabel = SLUMP_LABELS[units.slump as keyof typeof SLUMP_LABELS] ?? "mm";
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
        residue: { specific_gravity: slump.residue_sg || 0, moisture_mass_pct: slump.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: slump.num_recipes,
        containers_per_recipe: slump.desired_qty,
        safety_factor: slump.safety_factor,
        cone_type: slump.cone_type,
        slump_mm: slump.slump_mm,
        saturation_pct: slump.saturation_pct,
        binder_mass_pct_recipes: (slump.binder_pct || []).slice(0, slump.num_recipes),
      };
      const res = await fetch(`${API}/rpc/slump`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = messageErreurApi(data, res.status);
        throw new Error(detail);
      }
      setSlumpResult(data);
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

  const numRecipes = slump.num_recipes || 1;
  const coneType = slump.cone_type ?? "mini";

  return (
    <div className="mix-formulaire">
      <CardSection title="Affaissement visé" subtitle="Essai au cône d'Abrams, ASTM C143/C143M ; le petit cône n'est pas normalisé et sa lecture est convertie (Réglages).">
        <ChoixOptions
          libelle="Type de cône"
          valeur={coneType}
          onChange={(t) => setSlump({ cone_type: t })}
          options={[
            { valeur: "mini", libelle: "Petit cône" },
            { valeur: "grand", libelle: "Cône d'Abrams (300 mm)" },
          ]}
        />
        <GrilleChamps>
          <Field label="Affaissement visé S" unit={slumpLabel}>
            <input type="number" step="any" className="field-input" placeholder="ex : 180" value={fromStoreSlump(slump.slump_mm, units.slump) ?? ""} onChange={(e) => setSlump({ slump_mm: toStoreSlump(num(e.target.value), units.slump) ?? undefined })} />
          </Field>
          <Field label="Degré de saturation Sr" unit="%" hint="100 % = pâte saturée">
            <input type="number" step="any" className="field-input" placeholder="ex : 100" value={slump.saturation_pct ?? ""} onChange={(e) => setSlump({ saturation_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Résidu">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect kind="residus" role="residueId" label="Résidu (bibliothèque)"
              onPick={(m) => { const r = m as ResiduItem; setSlump({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
              matches={(m) => { const r = m as ResiduItem; return r.gs === slump.residue_sg && r.w0_pct === slump.residue_w_pct; }} />
          </div>
          <Field label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <input type="number" step="any" className="field-input" placeholder="ex : 3.4" value={slump.residue_sg ?? ""} onChange={(e) => setSlump({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau massique du résidu w₀" unit="%">
            <input type="number" step="any" className="field-input" placeholder="ex : 23.8" value={slump.residue_w_pct ?? ""} onChange={(e) => setSlump({ residue_w_pct: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1} value={slump.desired_qty ?? 1} onChange={(e) => setSlump({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <input type="number" step="any" className="field-input" min={1} value={slump.safety_factor ?? 1} onChange={(e) => setSlump({ safety_factor: num(e.target.value) })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setSlump({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={<><PointRecette i={i} />Recette {i + 1} — Bw</>} unit="%">
              <input type="number" step="any" className="field-input" placeholder="ex : 4.5"
                value={slump.binder_pct?.[i] ?? ""} onChange={(e) => setSlumpRecipe(i, { binder_pct: num(e.target.value) })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { setSlump({ cone_type: "mini", slump_mm: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0] }); setSlumpResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
