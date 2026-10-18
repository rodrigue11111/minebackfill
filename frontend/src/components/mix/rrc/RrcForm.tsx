"use client";

import { useState } from "react";
import { empreinteAuDepart, useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import ChampNombre from "@/components/ui/ChampNombre";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { RetardateurItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import { construireConstantesPayload } from "@/lib/rpc_payload";
import { Field, CardSection, GrilleChamps, ChoixNombreRecettes, ChoixOptions, PiedFormulaire, PointRecette } from "@/components/mix/champs";
/**
 * Formulaire RRC — remblai rocheux cimenté.
 * Méthode unique du cours (Dias 66-70) : dosage par Bw (liant / roches
 * stériles) et rapport E/L du coulis (fluide = eau + retardateur de prise).
 */

export default function RrcForm() {
  const { API, general, constantes, rrc, setRrc, setRrcRecipe, setRrcResult, reinitialiserMethode } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const numRecipes = rrc.num_recipes || 1;
  const modeVolume = rrc.quantity_mode === "volume";

  async function handleCompute() {
    // Empreinte des entrées AVANT la requête : la réponse lui est associée, et
    // une saisie faite pendant l'attente rend le résultat périmé.
    const empreinte = empreinteAuDepart("rrcResult");
    setError(null);
    setLoading(true);
    try {
      const payload = {
        category: "RRC",
        general: { ...general },
        num_recipes: rrc.num_recipes,
        quantity_mode: rrc.quantity_mode,
        volume_m3: modeVolume ? rrc.volume_m3 ?? null : null,
        wet_density_kg_m3: rrc.wet_density_kg_m3 ?? null,
        total_mass_kg: !modeVolume ? rrc.total_mass_kg ?? null : null,
        binder_mass_pct_recipes: (rrc.binder_pct || []).slice(0, numRecipes),
        wc_ratio_recipes: (rrc.wc_ratio || []).slice(0, numRecipes),
        cement_specific_gravity: rrc.cement_sg ?? 3.15,
        retarder_dosage_ml_per_100kg: rrc.retarder_d0 ?? 0,
        retarder_density_g_ml: rrc.retarder_density ?? 1.2,
        constants: construireConstantesPayload(constantes),
      };
      const res = await fetch(`${API}/rrc/dosage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(messageErreurApi(data, res.status));
      }
      setRrcResult(data, empreinte);
    } catch (err) {
      // Une erreur ne laisse jamais l'ancien résultat à l'écran (ni sauvegardable).
      setRrcResult(null);
      if (err instanceof TypeError) {
        setError(messageErreurReseau());
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mix-formulaire">
      <CardSection title="Quantité de remblai rocheux cimenté" subtitle="Volume du chantier à remblayer, ou masse totale directe">
        <ChoixOptions
          libelle="Quantité"
          valeur={rrc.quantity_mode === "masse" ? "masse" : "volume"}
          onChange={(v) => setRrc({ quantity_mode: v })}
          options={[
            { valeur: "volume", libelle: "Par volume", detail: "V × masse volumique humide" },
            { valeur: "masse", libelle: "Par masse", detail: "Masse totale de RRC" },
          ]}
        />
        <GrilleChamps>
          {modeVolume ? (
            <>
              <Field label="Volume du chantier à remblayer" unit="m³">
                <ChampNombre placeholder="ex : 1000" value={rrc.volume_m3} onChange={(n) => setRrc({ volume_m3: n })} />
              </Field>
              <Field label="Masse volumique humide" unit="kg/m³" hint="Masse volumique humide du RRC en place (typ. 1800 à 2400)">
                <ChampNombre placeholder="ex : 2200" value={rrc.wet_density_kg_m3} onChange={(n) => setRrc({ wet_density_kg_m3: n })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Masse totale de RRC" unit="kg">
                <ChampNombre placeholder="ex : 2200000" value={rrc.total_mass_kg} onChange={(n) => setRrc({ total_mass_kg: n })} />
              </Field>
              <Field label="Masse volumique humide" unit="kg/m³" hint="Facultative : sert au calcul du volume équivalent">
                <ChampNombre placeholder="ex : 2200" value={rrc.wet_density_kg_m3} onChange={(n) => setRrc({ wet_density_kg_m3: n })} />
              </Field>
            </>
          )}
        </GrilleChamps>
      </CardSection>

      <CardSection title="Coulis de ciment et retardateur de prise"
        subtitle="Le fluide du coulis = eau + retardateur ; dosage D0 recommandé : 50 à 260 ml/100 kg de ciment">
        <GrilleChamps>
          <div className="mix-pleine">
            <MaterialPresetSelect
              kind="retardateurs"
              role="retarderId"
              label="Retardateur (bibliothèque)"
              onPick={(m) => { const r = m as RetardateurItem; setRrc({ retarder_density: r.densite_g_ml, retarder_d0: r.dosage_d0_ml_100kg ?? rrc.retarder_d0 }); }}
              matches={(m) => (m as RetardateurItem).densite_g_ml === rrc.retarder_density}
            />
          </div>
          <Field plage="gsLiant" valeur={rrc.cement_sg} label="Densité relative du ciment Gs" hint="Pour le volume du coulis (ASTM C188)">
            <ChampNombre placeholder="ex : 3.15" value={rrc.cement_sg} onChange={(n) => setRrc({ cement_sg: n })} />
          </Field>
          <Field label="Dosage en retardateur D0" unit="ml/100 kg" hint="Par 100 kg de ciment ; 0 = aucun retardateur">
            <ChampNombre placeholder="ex : 100" value={rrc.retarder_d0} onChange={(n) => setRrc({ retarder_d0: n })} />
          </Field>
          <Field label="Masse volumique du retardateur" unit="g/ml">
            <ChampNombre placeholder="ex : 1.2" value={rrc.retarder_density} onChange={(n) => setRrc({ retarder_density: n })} />
          </Field>
        </GrilleChamps>
      </CardSection>

      <CardSection title="Taux massique de liant Bw et rapport E/L du coulis par recette"
        subtitle="Bw = Mc / MWR (ciment / roches stériles) ; E/L = fluide / ciment">
        <ChoixNombreRecettes valeur={numRecipes} onChange={(n) => setRrc({ num_recipes: n })} />
        {Array.from({ length: numRecipes }).map((_, i) => (
          <div key={i} className="mix-recette">
            <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
            <GrilleChamps>
              <Field plage="bw" valeur={rrc.binder_pct?.[i]} label="Taux massique de liant Bw" unit="%">
                <ChampNombre placeholder="ex : 5" value={rrc.binder_pct?.[i]} onChange={(n) => setRrcRecipe(i, { binder_pct: n })} />
              </Field>
              <Field label="Rapport E/L du coulis" hint="Noté aussi W/C">
                <ChampNombre placeholder="ex : 1.0" value={rrc.wc_ratio?.[i]} onChange={(n) => setRrcRecipe(i, { wc_ratio: n })} />
              </Field>
            </GrilleChamps>
          </div>
        ))}
      </CardSection>

      <PiedFormulaire
        loading={loading}
        onCalculer={handleCompute}
        onReinitialiser={() => { reinitialiserMethode("rrc"); setRrcResult(null); setError(null); }}
      />
      <ErrorBox message={error} />
    </div>
  );
}
