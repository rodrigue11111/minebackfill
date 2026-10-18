"use client";

import { useState } from "react";
import { empreinteAuDepart, useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import ChampNombre from "@/components/ui/ChampNombre";
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
    reinitialiserMethode,
  } = useStore();
  const slumpLabel = SLUMP_LABELS[units.slump as keyof typeof SLUMP_LABELS] ?? "mm";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    // Empreinte des entrées AVANT la requête : la réponse lui est associée, et
    // une saisie faite pendant l'attente rend le résultat périmé.
    const empreinte = empreinteAuDepart("slumpResult");
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPC",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: slump.residue_sg, moisture_mass_pct: slump.residue_w_pct },
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
      setSlumpResult(data, empreinte);
    } catch (err) {
      // Une erreur ne laisse jamais l'ancien résultat à l'écran (ni sauvegardable).
      setSlumpResult(null);
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
            <ChampNombre placeholder="ex : 180" value={fromStoreSlump(slump.slump_mm, units.slump)} onChange={(n) => setSlump({ slump_mm: toStoreSlump(n, units.slump) ?? undefined })} />
          </Field>
          <Field plage="sr" valeur={slump.saturation_pct} label="Degré de saturation Sr" unit="%" hint="100 % = pâte saturée">
            <ChampNombre placeholder="ex : 100" value={slump.saturation_pct} onChange={(n) => setSlump({ saturation_pct: n })} />
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
          <Field plage="gs" valeur={slump.residue_sg} label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <ChampNombre placeholder="ex : 3.4" value={slump.residue_sg} onChange={(n) => setSlump({ residue_sg: n })} />
          </Field>
          <Field plage="w0" valeur={slump.residue_w_pct} label="Teneur en eau massique du résidu w₀" unit="%">
            <ChampNombre placeholder="ex : 23.8" value={slump.residue_w_pct} onChange={(n) => setSlump({ residue_w_pct: n })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            <input type="number" className="field-input" min={1} value={slump.desired_qty ?? 1} onChange={(e) => setSlump({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field plage="kappa" valeur={slump.safety_factor} label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <ChampNombre placeholder="1" value={slump.safety_factor} onChange={(n) => setSlump({ safety_factor: n })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setSlump({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} plage="bw" valeur={slump.binder_pct?.[i]} label={<><PointRecette i={i} />Recette {i + 1} : Bw</>} unit="%">
              <ChampNombre placeholder="ex : 4.5" value={slump.binder_pct?.[i]} onChange={(n) => setSlumpRecipe(i, { binder_pct: n })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { reinitialiserMethode("slump"); setSlumpResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
