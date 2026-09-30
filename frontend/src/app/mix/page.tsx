// src/app/mix/page.tsx
// Page Calculs (maquette A) : un seul défilement, grand en-tête, choix de la
// catégorie et de la méthode en contrôles segmentés, puis la carte
// « Paramètres » (formulaire de la méthode) et la carte « Résultats ».
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore, type Category, type RpcMethod } from "@/lib/store";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Bandeau } from "@/components/ui/Bandeau";
import Segmente from "@/components/ui/Segmente";
import ResultsPanel from "@/src/components/mix/ResultsPanel";
import CwForm from "@/src/components/mix/rpc/CwForm";
import WbForm from "@/src/components/mix/rpc/WbForm";
import SlumpForm from "@/src/components/mix/rpc/SlumpForm";
import EssaiForm from "@/src/components/mix/rpc/EssaiForm";
import RpgCwForm from "@/src/components/mix/rpg/RpgCwForm";
import RpgWbForm from "@/src/components/mix/rpg/RpgWbForm";
import RpgEssaiForm from "@/src/components/mix/rpg/RpgEssaiForm";
import RrcForm from "@/src/components/mix/rrc/RrcForm";
import {
  CATEGORY_INFO, descriptorFor, methodeApresChangementCategorie, methodsFor, methodLabel, type MethodStateKey,
} from "@/lib/method-registry";

// Rendu des formulaires : la seule connaissance locale est « quelle tranche
// d'état correspond à quel composant » — tout le reste vient du registre.
const FORM_BY_STATE_KEY: Record<MethodStateKey, React.ComponentType> = {
  cw: CwForm,
  wb: WbForm,
  slump: SlumpForm,
  essai: EssaiForm,
  rpgCw: RpgCwForm,
  rpgWb: RpgWbForm,
  rpgEssai: RpgEssaiForm,
  rrc: RrcForm,
};

export default function MixPage() {
  const { category, method, general, setCategory, setMethod, loadGeneral, fillTestData } = useStore();
  const [pleinEcran, setPleinEcran] = useState(false);
  const [testCharge, setTestCharge] = useState(false);

  // Relit les informations du projet (elles se modifient sur la page
  // Informations) : comportement historique du panneau de gauche.
  useEffect(() => {
    loadGeneral();
  }, [loadGeneral]);

  // Dimensions du contenant : requises par tous les calculs, saisies sur
  // la page Informations. Sans elles, l'API renvoie une erreur de validation.
  const dimensionsManquantes = (() => {
    const g = general || {};
    if (!g.container_type) return true;
    if (g.container_type === "volume") return !g.container_volume_m3;
    if (g.container_type === "section_hauteur") return !g.container_section || !g.container_height;
    if (g.container_type === "rayon_hauteur") return !g.container_radius || !g.container_height;
    return !g.container_length || !g.container_width || !g.container_height;
  })();

  const changerCategorie = (c: Category) => {
    setCategory(c);
    const suivante = methodeApresChangementCategorie(c, method);
    if (suivante !== method) setMethod(suivante);
  };

  const chargerValeursTest = () => {
    try {
      fillTestData();
      setTestCharge(true);
      setTimeout(() => setTestCharge(false), 2000);
    } catch (err) {
      console.error("[fillTestData] error:", err);
    }
  };

  const infoCategorie = CATEGORY_INFO.find((c) => c.id === category);
  const methodes = methodsFor(category);
  const d = descriptorFor(category, method);
  const Formulaire = d ? FORM_BY_STATE_KEY[d.stateKey] : null;
  const projet = [general?.project_name, general?.residue_id && `résidu ${general.residue_id}`, general?.operator_name]
    .filter(Boolean).join(" · ");

  return (
    <Page>
      <EnTetePage
        surtitre={infoCategorie?.desc ?? "Remblais miniers cimentés"}
        titre="Calculs"
        sousTitre={
          <>
            {projet || "Aucune information de projet"} · <Link href="/">Modifier les informations</Link>
          </>
        }
        actions={
          <>
            <button type="button" className="btn-discret" onClick={chargerValeursTest} aria-live="polite">
              {testCharge ? "Valeurs chargées" : "Valeurs de test"}
            </button>
            <Link href="/reglages" className="btn-discret">Réglages</Link>
          </>
        }
      />

      <div className="mix-choix">
        <Segmente
          ariaLabel="Catégorie de remblai"
          valeur={category}
          onChange={changerCategorie}
          options={CATEGORY_INFO.map((c) => ({ valeur: c.id, libelle: c.label, title: c.desc }))}
        />
        {category === "RRC" ? (
          <span className="mix-methode-unique">
            Méthode unique : dosage selon Bw (ciment / roches stériles) et le rapport E/L du coulis
          </span>
        ) : (
          <Segmente
            ariaLabel="Méthode de calcul"
            valeur={method}
            onChange={(m) => setMethod(m as RpcMethod)}
            options={methodes.map((m) => ({ valeur: m.method, libelle: m.labels.court, libelleCourt: m.labels.telephone, title: `${m.labels.long} — ${m.description}` }))}
          />
        )}
      </div>

      <div className={pleinEcran ? "mix-grille mix-grille-plein" : "mix-grille"}>
        {!pleinEcran && (
          <Carte titre="Paramètres" aside={methodLabel(category, method, "long")} className="mix-carte-parametres" aria-label="Paramètres">
            {dimensionsManquantes && category !== "RRC" && (
              <Bandeau ton="alerte" titre="Dimensions du contenant manquantes.">
                Renseignez le type et les dimensions du moule sur la page{" "}
                <Link href="/" style={{ color: "inherit", fontWeight: 600 }}>Informations</Link> avant de lancer un calcul.
              </Bandeau>
            )}
            {Formulaire ? (
              <Formulaire />
            ) : category === "RPG" && method === "slump" ? (
              // Combinaison inexistante (ex. modèle prédictif en RPG) : message dédié.
              <Bandeau ton="alerte" titre="Méthode non disponible pour le RPG">
                Le modèle prédictif (affaissement) est calé sur le <strong>RPC</strong>.
                Utilisez la <strong>méthode essai-erreur</strong> pour entrer les ajouts réels en RPG.
              </Bandeau>
            ) : (
              <p className="mix-vide">Choisissez une catégorie et une méthode ci-dessus.</p>
            )}
          </Carte>
        )}
        <ResultsPanel pleinEcran={pleinEcran} onBasculerPleinEcran={() => setPleinEcran((v) => !v)} />
      </div>
    </Page>
  );
}
