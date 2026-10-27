"use client";

import { useState } from "react";
import { empreinteAuDepart, useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import ChampNombre from "@/components/ui/ChampNombre";
import { KAPPA_AIDE } from "@/lib/contenant";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { ResiduItem, GranulatItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import ChampFractionGranulat from "./ChampFractionGranulat";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, PiedFormulaire, PointRecette } from "@/components/mix/champs";
import { Bandeau } from "@/components/ui/Bandeau";


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
    reinitialiserMethode,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    // Empreinte des entrées AVANT la requête : la réponse lui est associée, et
    // une saisie faite pendant l'attente rend le résultat périmé.
    const empreinte = empreinteAuDepart("rpgWbResult");
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPG",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: rpgWb.residue_sg, moisture_mass_pct: rpgWb.residue_w_pct },
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
      setRpgWbResult(data, empreinte);
    } catch (err) {
      // Une erreur ne laisse jamais l'ancien résultat à l'écran (ni sauvegardable).
      setRpgWbResult(null);
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
          <Field plage="gsGranulat" valeur={rpgWb.aggregate_sg} label="Densité relative du granulat Gs" hint="Sans unité : Gs = ρs/ρw">
            <ChampNombre placeholder="ex : 2.65" value={rpgWb.aggregate_sg} onChange={(n) => setRpgWb({ aggregate_sg: n })} />
          </Field>
          <ChampFractionGranulat
            amPct={rpgWb.aggregate_fraction_pct}
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
          <Field plage="gs" valeur={rpgWb.residue_sg} label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <ChampNombre placeholder="ex : 3.4" value={rpgWb.residue_sg} onChange={(n) => setRpgWb({ residue_sg: n })} />
          </Field>
          <Field plage="w0" valeur={rpgWb.residue_w_pct} label="Teneur en eau massique du résidu w₀" unit="%">
            <ChampNombre placeholder="ex : 23.8" value={rpgWb.residue_w_pct} onChange={(n) => setRpgWb({ residue_w_pct: n })} />
          </Field>
          <Field plage="sr" valeur={rpgWb.saturation_pct} label="Degré de saturation Sr" unit="%">
            <ChampNombre placeholder="ex : 100" value={rpgWb.saturation_pct} onChange={(n) => setRpgWb({ saturation_pct: n })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            {/* ChampNombre, pas <input type="number"> : vidé puis retapé, ce
                champ affichait « 03 » (2026-10-26). Vide ou 0 : rien n'est écrit. */}
            <ChampNombre placeholder="1" min={1} messageRefus="Au moins un moule par recette."
              value={rpgWb.desired_qty ?? 1} onChange={(n) => { if (n !== undefined) setRpgWb({ desired_qty: n }); }} />
          </Field>
          <Field plage="kappa" valeur={rpgWb.safety_factor} label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <ChampNombre placeholder="1" value={rpgWb.safety_factor} onChange={(n) => setRpgWb({ safety_factor: n })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setRpgWb({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw et rapport eau/liant E/L par recette" subtitle="Bw = Mb / (Mr + Ma) × 100  ·  E/L = Mw / Mb">
        {Array.from({ length: numRecipes }).map((_, i) => (
          <div key={i} className="mix-recette">
            <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
            <GrilleChamps>
              <Field plage="bw" valeur={rpgWb.binder_pct?.[i]} label="Taux massique de liant Bw" unit="%" hint="Masse de liant / masse sèche de résidu et de granulat">
                <ChampNombre placeholder="ex : 5" value={rpgWb.binder_pct?.[i]} onChange={(n) => setRpgWbRecipe(i, { binder_pct: n })} />
              </Field>
              <Field plage="el" valeur={rpgWb.wc_ratio?.[i]} label="Rapport eau/liant E/L" hint="Ex. : 4 à 8">
                <ChampNombre placeholder="ex : 6.0" value={rpgWb.wc_ratio?.[i]} onChange={(n) => setRpgWbRecipe(i, { wc_ratio: n })} />
              </Field>
            </GrilleChamps>
          </div>
        ))}
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { reinitialiserMethode("rpgWb"); setRpgWbResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
