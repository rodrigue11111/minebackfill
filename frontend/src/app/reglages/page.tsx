"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useStore, CATALOGUE_VERSION, CONSTANTES_VERSION, MATERIALS_VERSION } from "@/lib/store";
import { UNIT_CATEGORIES, unitsForLength, type LengthUnit } from "@/lib/units";
import type { LiantCatalogueItem } from "@/lib/store";
import type { MaterialKind } from "@/lib/materials";
import { getSupabase } from "@/lib/supabase";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";
import { publierCatalogue, type CatalogueCloudId } from "@/lib/cloud";
import { estOfficiel } from "@/lib/materials";
import MaterialCatalogueCard from "@/components/MaterialCatalogueCard";
import BackupButtons from "@/components/BackupButtons";
import SessionsCard from "@/components/SessionsCard";
import type { Session } from "@/lib/sessions";
import { APP_NAME_VERSION, MODULE_ID, MODULE_LABEL } from "@/lib/branding";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Pastille } from "@/components/ui/Pastille";
import Segmente from "@/components/ui/Segmente";

export default function ReglagesPage() {
  const {
    constantes,
    setConstantes,
    catalogue_liants,
    ajouterLiant,
    modifierLiant,
    supprimerLiant,
    restaurerLiantsOfficiels,
    units,
    setUnits,
    loadUnits,
  } = useStore();
  const session = useStore((s) => s.session);
  // isProf = vrai compte prof connecté (requis pour PUBLIER en ligne).
  const isProf = session?.role === "prof";
  // vueAdmin = affichage/édition enseignant. En mode test sans compte, tout le
  // monde y a droit (édition LOCALE des catalogues officiels) ; la publication
  // en ligne, elle, reste conditionnée à isProf (impossible sans compte).
  const vueAdmin = MODE_TEST_SANS_COMPTE || isProf;

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  // Publication d'un catalogue officiel (enseignant). N'envoie que la couche
  // « officielle » ; la couche perso reste locale à chaque utilisateur.
  const publierMateriaux = async (kind: MaterialKind, id: CatalogueCloudId, version: number) => {
    const sb = getSupabase();
    if (!sb || !session) return;
    const items = (useStore.getState()[`catalogue_${kind}` as const] as { origine?: string }[])
      .filter((m) => m.origine === "officiel");
    const { error } = await publierCatalogue(sb, id, { v: version, data: items }, session.userId);
    window.alert(error ? `Publication impossible : ${error}` : "Catalogue publié en ligne.");
  };
  const publierLiants = async () => {
    const sb = getSupabase();
    if (!sb || !session) return;
    const items = catalogue_liants.filter((l) => l.origine === "officiel");
    const { error } = await publierCatalogue(sb, "liants", { v: CATALOGUE_VERSION, data: items }, session.userId);
    window.alert(error ? `Publication impossible : ${error}` : "Catalogue de liants publié en ligne.");
  };
  const publierSessions = async (sessions: Session[]) => {
    const sb = getSupabase();
    if (!sb || !session) return;
    const { error } = await publierCatalogue(sb, "sessions", { v: 1, data: sessions }, session.userId);
    window.alert(error ? `Publication impossible : ${error}` : "Sessions publiées en ligne.");
  };
  const publierConstantes = async () => {
    const sb = getSupabase();
    if (!sb || !session) return;
    const { error } = await publierCatalogue(sb, "constantes", { v: CONSTANTES_VERSION, data: constantes }, session.userId);
    window.alert(error ? `Publication impossible : ${error}` : "Constantes publiées en ligne.");
  };

  const codesDupliques = useMemo(() => {
    const map = new Map<string, number>();
    for (const liant of catalogue_liants) {
      const code = String(liant.code ?? "").trim();
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return new Set(
      [...map.entries()].filter(([, n]) => n > 1).map(([code]) => code)
    );
  }, [catalogue_liants]);

  const champConstante = (libelle: string, unite: string | undefined, valeur: number, onChange: (n: number) => void, aide?: string) => (
    <Champ libelle={libelle} unite={unite} aide={aide}>
      <input type="number" step="any" className="field-input" value={valeur}
        onChange={(e) => onChange(Number(e.target.value || 0))} />
    </Champ>
  );

  return (
    <Page>
      <EnTetePage
        titre="Réglages"
        sousTitre="Constantes de calcul, catalogues de matériaux, sessions de cours, unités et données locales."
      />

      <Carte titre="Constantes de calcul"
        actions={isProf ? <button type="button" className="btn-primary" onClick={publierConstantes}>Publier les constantes</button> : undefined}>
        <p className="classe-intro">
          Ces valeurs sont globales ; elles servent au dosage selon Cw, au dosage selon E/L, au modèle prédictif et à la méthode essai-erreur.
        </p>
        <div className="grille-2">
          {champConstante("Masse volumique de l'eau ρw", "kg/m³", constantes.masse_volumique_eau_kg_m3, (n) => setConstantes({ masse_volumique_eau_kg_m3: n }))}
          {champConstante("Accélération de la pesanteur g", "m/s²", constantes.gravite_m_s2, (n) => setConstantes({ gravite_m_s2: n }))}
          {champConstante("Facteur petit cône vers cône d'Abrams", undefined, constantes.facteur_petit_cone_vers_grand_cone, (n) => setConstantes({ facteur_petit_cone_vers_grand_cone: n }),
            "Convertit l'affaissement lu au petit cône (non normalisé) en affaissement au cône d'Abrams (ASTM C143/C143M).")}
          {champConstante("Coefficient du modèle prédictif (affaissement)", undefined, constantes.coefficient_modele_slump, (n) => setConstantes({ coefficient_modele_slump: n }))}
          {champConstante("Constante du modèle prédictif (affaissement)", undefined, constantes.constante_modele_slump, (n) => setConstantes({ constante_modele_slump: n }))}
        </div>
      </Carte>

      <Carte titre="Catalogue des liants"
        actions={
          <span className="regl-actions">
            <button type="button" className="btn-discret" onClick={restaurerLiantsOfficiels}>Restaurer valeurs officielles</button>
            <button type="button" className="btn-secondary" onClick={ajouterLiant}>Ajouter un liant</button>
            {isProf && <button type="button" className="btn-primary" onClick={publierLiants}>Publier en ligne</button>}
          </span>
        }>
        <p className="classe-intro">
          Ciment Portland (CSA A3001) et ajouts cimentaires (laitier, ASTM C989 ; cendres volantes, ASTM C618). La densité relative Gs se mesure selon ASTM C188.
        </p>
        <div className="regl-lignes">
          {catalogue_liants.map((liant: LiantCatalogueItem, index: number) => {
            const code = String(liant.code ?? "");
            const duplique = code && codesDupliques.has(code);
            // En vue enseignant, les liants officiels sont éditables.
            const verrou = estOfficiel(liant) && !vueAdmin;
            return (
              <div key={liant.id} className={duplique ? "regl-ligne regl-liant regl-duplique" : "regl-ligne regl-liant"}>
                <Champ libelle="Code">
                  <input className="field-input" value={liant.code} disabled={verrou}
                    onChange={(e) => modifierLiant(index, { code: String(e.target.value || "").trim().toUpperCase() }, vueAdmin)} />
                </Champ>
                <Champ libelle="Nom">
                  <input className="field-input" value={liant.nom} disabled={verrou}
                    onChange={(e) => modifierLiant(index, { nom: e.target.value }, vueAdmin)} />
                </Champ>
                <Champ libelle="Densité relative Gs">
                  <input type="number" step="any" className="field-input" value={liant.gs} disabled={verrou}
                    onChange={(e) => modifierLiant(index, { gs: Number(e.target.value || 0) }, vueAdmin)} />
                </Champ>
                <div className="regl-ligne-fin">
                  {estOfficiel(liant) && <Pastille ton="accent">officiel</Pastille>}
                  {!verrou && (
                    <button type="button" className="btn-discret btn-danger"
                      onClick={() => supprimerLiant(index, vueAdmin)} disabled={catalogue_liants.length <= 1}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {codesDupliques.size > 0 && (
          <p className="ui-champ-erreur" style={{ margin: 0 }}>Les codes de liants doivent être uniques.</p>
        )}
        <div className="regl-actions" style={{ justifyContent: "flex-end" }}>
          <Link href="/" className="btn-discret">Retour aux informations</Link>
          <Link href="/mix" className="btn-primary">Aller aux calculs</Link>
        </div>
      </Carte>

      {/* ── Bibliothèques de matériaux ── */}
      <MaterialCatalogueCard
        kind="residus"
        title="Bibliothèque de résidus"
        sub="Résidus miniers réutilisables : sélectionnez-les dans les formulaires pour remplir Gs et w₀ (ASTM D854, ASTM D2216)."
        adminMode={vueAdmin}
        onPublish={isProf ? () => publierMateriaux("residus", "residus", MATERIALS_VERSION) : undefined}
        columns={[
          { key: "nom", label: "Nom", type: "text", flex: 2 },
          { key: "gs", label: "Gs", type: "number" },
          { key: "w0_pct", label: "w₀ (%)", type: "number" },
          { key: "provenance", label: "Provenance", type: "text", flex: 1.5 },
        ]}
      />
      <MaterialCatalogueCard
        kind="granulats"
        title="Bibliothèque de granulats"
        sub="Granulats pour le remblai en pâte granulaire (RPG)."
        adminMode={vueAdmin}
        onPublish={isProf ? () => publierMateriaux("granulats", "granulats", MATERIALS_VERSION) : undefined}
        columns={[
          { key: "nom", label: "Nom", type: "text", flex: 2 },
          { key: "gs", label: "Gs", type: "number" },
          { key: "humidite_pct", label: "Teneur en eau (%)", type: "number" },
          { key: "fraction_defaut_pct", label: "Am par défaut (%)", type: "number" },
          { key: "provenance", label: "Provenance", type: "text", flex: 1.5 },
        ]}
      />
      <MaterialCatalogueCard
        kind="retardateurs"
        title="Bibliothèque de retardateurs de prise"
        sub="Retardateurs de prise pour le coulis du remblai rocheux cimenté (RRC)."
        adminMode={vueAdmin}
        onPublish={isProf ? () => publierMateriaux("retardateurs", "retardateurs", MATERIALS_VERSION) : undefined}
        columns={[
          { key: "nom", label: "Nom", type: "text", flex: 2 },
          { key: "densite_g_ml", label: "Masse volumique (g/ml)", type: "number" },
          { key: "dosage_d0_ml_100kg", label: "Dosage D0 (ml/100 kg)", type: "number" },
        ]}
      />

      <SessionsCard vueAdmin={vueAdmin} peutPublier={isProf} onPublier={publierSessions} />

      {/* ── Unités ── */}
      <Carte titre="Unités de mesure">
        <p className="classe-intro">
          Choisissez les unités d&apos;affichage pour les entrées et les résultats. L&apos;aire et le
          volume suivent automatiquement l&apos;unité de longueur (son carré et son cube).
        </p>
        <div className="regl-unites">
          {UNIT_CATEGORIES.filter((cat) => cat.key !== "area" && cat.key !== "volume").map((cat) => (
            <div key={cat.key} className="ui-champ">
              <span className="ui-champ-libelle" style={{ marginBottom: 6 }}>
                {cat.key === "length" ? "Longueur (aire et volume suivent)" : cat.label}
              </span>
              <Segmente
                ariaLabel={cat.label}
                taille="compact"
                valeur={String(units[cat.key])}
                onChange={(opt) => (cat.key === "length"
                  ? setUnits(unitsForLength(opt as LengthUnit))
                  : setUnits({ [cat.key]: opt }))}
                options={cat.options.map((opt) => ({ valeur: opt, libelle: cat.labels[opt] ?? opt }))}
              />
            </div>
          ))}
        </div>
      </Carte>

      <Carte titre="Données locales">
        <p className="classe-intro">
          Vos résultats sauvegardés, vos mesures de laboratoire (gâchées, éprouvettes, essais
          UCS) et vos réglages sont stockés dans ce navigateur uniquement. Exportez-les
          régulièrement pour ne rien perdre, ou pour les transférer sur un autre poste.
        </p>
        <BackupButtons />
      </Carte>

      {/* La barre d'état du bas a été retirée (refonte) : la version vit ici
          et dans la feuille « Plus » du téléphone. */}
      <Carte titre="À propos">
        <ListeGroupee>
          <LigneListe libelle="Application" valeur={APP_NAME_VERSION} />
          <LigneListe libelle="Module" valeur={`${MODULE_ID} : ${MODULE_LABEL}`} />
          <LigneListe libelle="Glossaire et essais normalisés" href="/guide#glossaire" />
          <LigneListe libelle="Diagnostic technique" href="/diagnostic" />
          {/* Lien réservé à un VRAI compte enseignant (isProf), pas à vueAdmin :
              en mode test tout le monde a la vue enseignant, étudiants compris.
              En mode test, la page reste ouverte par son adresse /assistant. */}
          {isProf && <LigneListe libelle="Assistant IA (modifications)" href="/assistant" />}
        </ListeGroupee>
      </Carte>
    </Page>
  );
}
