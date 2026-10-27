"use client";

import { useState } from "react";
import { empreinteAuDepart, useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import ChampNombre from "@/components/ui/ChampNombre";
import { KAPPA_AIDE } from "@/lib/contenant";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { ResiduItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, PiedFormulaire, PointRecette } from "@/components/mix/champs";


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
    reinitialiserMethode,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    // Empreinte des entrées AVANT la requête : la réponse lui est associée, et
    // une saisie faite pendant l'attente rend le résultat périmé.
    const empreinte = empreinteAuDepart("cwResult");
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPC",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: cw.residue_sg, moisture_mass_pct: cw.residue_w_pct },
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
      setCwResult(data, empreinte);
    } catch (err) {
      // Une erreur ne laisse jamais l'ancien résultat à l'écran (ni sauvegardable).
      setCwResult(null);
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
          <Field plage="gs" valeur={cw.residue_sg} label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <ChampNombre placeholder="ex : 3.4" value={cw.residue_sg} onChange={(n) => setCw({ residue_sg: n })} />
          </Field>
          <Field plage="w0" valeur={cw.residue_w_pct} label="Teneur en eau massique du résidu w₀" unit="%" hint="Résidu tel que reçu (ASTM D2216)">
            <ChampNombre placeholder="ex : 23.8" value={cw.residue_w_pct} onChange={(n) => setCw({ residue_w_pct: n })} />
          </Field>
          <Field plage="cw" valeur={cw.solid_mass_pct} label="Pourcentage solide massique Cw" unit="%" hint="Masse des solides / masse totale du remblai">
            <ChampNombre placeholder="ex : 78" value={cw.solid_mass_pct} onChange={(n) => setCw({ solid_mass_pct: n })} />
          </Field>
          <Field plage="sr" valeur={cw.saturation_pct} label="Degré de saturation Sr" unit="%" hint="100 % = pâte saturée">
            <ChampNombre placeholder="ex : 100" value={cw.saturation_pct} onChange={(n) => setCw({ saturation_pct: n })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            {/* ChampNombre, pas <input type="number"> : vidé puis retapé, ce
                champ affichait « 03 » (2026-10-26). Vide ou 0 : rien n'est écrit. */}
            <ChampNombre placeholder="1" min={1} messageRefus="Au moins un moule par recette."
              value={cw.desired_qty ?? 1} onChange={(n) => { if (n !== undefined) setCw({ desired_qty: n }); }} />
          </Field>
          <Field plage="kappa" valeur={cw.safety_factor} label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <ChampNombre placeholder="1" value={cw.safety_factor} onChange={(n) => setCw({ safety_factor: n })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setCw({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette" subtitle="Masse de liant / masse sèche de résidu">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} plage="bw" valeur={cw.binder_pct?.[i]} label={<><PointRecette i={i} />Recette {i + 1} : Bw</>} unit="%">
              <ChampNombre placeholder="ex : 4.5" value={cw.binder_pct?.[i]} onChange={(n) => setCwRecipe(i, { binder_pct: n })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => {
          reinitialiserMethode("cw");
          setCwResult(null);
          setError(null);
        }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
