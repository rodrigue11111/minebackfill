"use client";

import { useState } from "react";
import { empreinteAuDepart, useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import ChampNombre from "@/components/ui/ChampNombre";
import { KAPPA_AIDE } from "@/lib/contenant";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import { viderPreselection, type ResiduItem, type GranulatItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import ChampFractionGranulat from "./ChampFractionGranulat";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, PiedFormulaire, PointRecette } from "@/components/mix/champs";
import { Bandeau } from "@/components/ui/Bandeau";


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
    reinitialiserMethode,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    // Empreinte des entrées AVANT la requête : la réponse lui est associée, et
    // une saisie faite pendant l'attente rend le résultat périmé.
    const empreinte = empreinteAuDepart("rpgCwResult");
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPG",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: rpgCw.residue_sg, moisture_mass_pct: rpgCw.residue_w_pct },
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
      setRpgCwResult(data, empreinte);
    } catch (err) {
      // Une erreur ne laisse jamais l'ancien résultat à l'écran (ni sauvegardable).
      setRpgCwResult(null);
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
              matches={(m) => (m as GranulatItem).gs === rpgCw.aggregate_sg}
              onPersonnalise={(m) => setRpgCw(viderPreselection("granulats", m, rpgCw))} />
          </div>
          <Field plage="gsGranulat" valeur={rpgCw.aggregate_sg} label="Densité relative du granulat Gs" hint="Sans unité : Gs = ρs/ρw">
            <ChampNombre placeholder="ex : 2.65" value={rpgCw.aggregate_sg} onChange={(n) => setRpgCw({ aggregate_sg: n })} />
          </Field>
          <ChampFractionGranulat
            amPct={rpgCw.aggregate_fraction_pct}
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
              matches={(m) => { const r = m as ResiduItem; return r.gs === rpgCw.residue_sg && r.w0_pct === rpgCw.residue_w_pct; }}
              onPersonnalise={(m) => setRpgCw(viderPreselection("residus", m, rpgCw))} />
          </div>
          <Field plage="gs" valeur={rpgCw.residue_sg} label="Densité relative des grains du résidu Gs" hint="Sans unité : Gs = ρs/ρw (ASTM D854)">
            <ChampNombre placeholder="ex : 3.4" value={rpgCw.residue_sg} onChange={(n) => setRpgCw({ residue_sg: n })} />
          </Field>
          <Field plage="w0" valeur={rpgCw.residue_w_pct} label="Teneur en eau massique du résidu w₀" unit="%">
            <ChampNombre placeholder="ex : 23.8" value={rpgCw.residue_w_pct} onChange={(n) => setRpgCw({ residue_w_pct: n })} />
          </Field>
          <Field plage="cw" valeur={rpgCw.solid_mass_pct} label="Pourcentage solide massique Cw" unit="%" hint="Masse des solides / masse totale du remblai">
            <ChampNombre placeholder="ex : 78" value={rpgCw.solid_mass_pct} onChange={(n) => setRpgCw({ solid_mass_pct: n })} />
          </Field>
          <Field plage="sr" valeur={rpgCw.saturation_pct} label="Degré de saturation Sr" unit="%">
            <ChampNombre placeholder="ex : 100" value={rpgCw.saturation_pct} onChange={(n) => setRpgCw({ saturation_pct: n })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Paramètres du mélange">
        <GrilleChamps>
          <Field label="Nombre de moules par recette">
            {/* ChampNombre, pas <input type="number"> : vidé puis retapé, ce
                champ affichait « 03 » (2026-10-26). Vide ou 0 : rien n'est écrit. */}
            <ChampNombre placeholder="1" min={1} messageRefus="Au moins un moule par recette."
              value={rpgCw.desired_qty ?? 1} onChange={(n) => { if (n !== undefined) setRpgCw({ desired_qty: n }); }} />
          </Field>
          <Field plage="kappa" valeur={rpgCw.safety_factor} label="Facteur de perte κ" hint={KAPPA_AIDE}>
            <ChampNombre placeholder="1" value={rpgCw.safety_factor} onChange={(n) => setRpgCw({ safety_factor: n })} />
          </Field>
        </GrilleChamps>
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setRpgCw({ num_recipes: n })} />
      </CardSection>

      <CardSection title="Taux massique de liant Bw par recette" subtitle="Bw = Mb / (Mr + Ma) × 100, masses sèches">
        <GrilleChamps une={numRecipes === 1}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} plage="bw" valeur={rpgCw.binder_pct?.[i]} label={<><PointRecette i={i} />Recette {i + 1} : Bw</>} unit="%">
              <ChampNombre placeholder="ex : 5" value={rpgCw.binder_pct?.[i]} onChange={(n) => setRpgCwRecipe(i, { binder_pct: n })} />
            </Field>
          ))}
        </GrilleChamps>
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { reinitialiserMethode("rpgCw"); setRpgCwResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
