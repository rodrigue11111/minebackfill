// src/app/guide/page.tsx
import Link from "next/link";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";
import SectionGlossaire from "@/components/guide/SectionGlossaire";

// Section « Sauvegarde en ligne » : seulement quand les comptes sont OUVERTS.
// Page rendue au build, comme ces variables : la section apparaît au
// redéploiement qui ouvre les comptes (MAINTENANCE.md, recette 9), jamais
// avant — on ne décrit pas aux étudiants une fonction qu'ils n'ont pas.
const COMPTES_OUVERTS = !MODE_TEST_SANS_COMPTE && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/* ── Reusable primitives ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 18,
        fontWeight: 800,
        color: "var(--navy)",
        margin: "0 0 16px",
        letterSpacing: "-0.01em",
        borderBottom: "2px solid var(--primary-mid)",
        paddingBottom: 10,
      }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: "var(--navy)",
        margin: "20px 0 8px",
      }}
    >
      {children}
    </h3>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65, margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        padding: "22px 24px",
        marginBottom: 16,
        boxShadow: "0 1px 4px rgba(12,30,66,0.06)",
        ...(accent ? { borderLeft: "4px solid var(--primary)" } : {}),
      }}
    >
      {children}
    </div>
  );
}

function InfoBox({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const styles = {
    info: { bg: "var(--primary-light)", border: "var(--primary-mid)", color: "var(--primary)" },
    warning: { bg: "var(--warning-light)", border: "#fcd34d", color: "var(--warning)" },
    tip: { bg: "var(--success-light)", border: "#6ee7b7", color: "var(--success)" },
  }[type];
  return (
    <div
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 8,
        padding: "11px 16px",
        marginBottom: 14,
        fontSize: 13,
        color: styles.color,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

/* ── Step block ── */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="guide-step" style={{ marginBottom: 20 }}>
      <div className="guide-step-number">{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Method block ── */
function Method({
  badge,
  title,
  when,
  inputs,
  formula,
}: {
  badge: string;
  title: string;
  when: string;
  inputs: string[];
  formula?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          background: "var(--primary-light)",
          borderBottom: "1px solid var(--primary-mid)",
          padding: "11px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span className="guide-method-badge">{badge}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{title}</span>
      </div>
      <div style={{ padding: "14px 18px" }}>
        <Para><strong>Quand l&apos;utiliser :</strong> {when}</Para>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Paramètres requis :
        </div>
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {inputs.map((inp, i) => (
            <li key={i} style={{ fontSize: 13, color: "#475569", marginBottom: 3, lineHeight: 1.5 }}>
              {inp}
            </li>
          ))}
        </ul>
        {formula && (
          <div
            style={{
              background: "var(--primary-light)",
              border: "1px solid var(--primary-mid)",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12.5,
              color: "var(--primary)",
              fontFamily: "monospace",
            }}
          >
            {formula}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function GuidePage() {
  const sections: [string, string][] = [
    ["1", "Vue d'ensemble"],
    ["2", "Flux de travail"],
    ["3", "Catégories de remblai"],
    ["4", "Méthodes de calcul"],
    ["5", "Référence des paramètres"],
    ["6", "Lecture des résultats"],
    ["7", "Export Excel"],
    ["8", "Page Formules"],
    ["9", "Glossaire et essais normalisés"],
    ...(COMPTES_OUVERTS ? [["10", "Sauvegarde en ligne et compte"] as [string, string]] : []),
  ];
  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>

      {/* ── Hero ── */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--navy) 0%, #1a3a8a 100%)",
          padding: "32px 0 28px",
          borderBottom: "3px solid var(--primary)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Documentation
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#fff",
              margin: "0 0 10px",
              letterSpacing: "-0.01em",
            }}
          >
            Guide d&apos;utilisation — MineBackfill
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, maxWidth: 560, margin: 0 }}>
            Outil de calcul des mélanges de remblais miniers cimentés, pour l&apos;enseignement et le
            laboratoire. Ce guide explique chaque étape, méthode et paramètre.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Link
              href="/"
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                background: "var(--primary)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Commencer — Informations
            </Link>
            <Link
              href="/mix"
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.8)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
                background: "rgba(255,255,255,0.07)",
              }}
            >
              Aller aux calculs
            </Link>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* ── Table of contents ── */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Table des matières
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
            {sections.map(([num, title]) => (
              <div key={num} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", minWidth: 18 }}>{num}.</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{title}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 1. Vue d'ensemble */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>1. Vue d&apos;ensemble</SectionTitle>
          <Para>
            <strong>MineBackfill</strong> calcule les mélanges de remblai en pâte cimenté (RPC), de remblai
            en pâte granulaire (RPG) et de remblai rocheux cimenté (RRC). Il reprend les formules du cours
            et du programme de calcul de M. Belem (Université du Québec en Abitibi-Témiscamingue) et
            permet de :
          </Para>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "Calculer les masses et les volumes de chaque constituant du remblai (résidu, granulat, liant, eau) pour 1 à 4 recettes en parallèle.",
              "Déterminer les paramètres géotechniques : indice des vides, porosité, degré de saturation, masses et poids volumiques humides et secs.",
              "Corriger une recette par la méthode essai-erreur (ajouts réels de résidu, de granulat, d'eau ou de liant).",
              "Suivre les gâchées et les essais de compression uniaxiale (UCS) au laboratoire.",
              "Exporter les résultats en Excel (.xlsx) et en PDF, et consulter les formules avec leur rendu mathématique.",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 6, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
          <InfoBox type="info">
            <strong>Module 1 — Contexte :</strong> les calculs couvrent le dosage selon Cw, le dosage selon
            E/L, le modèle prédictif de l&apos;affaissement, la méthode essai-erreur, le remblai en pâte
            granulaire et le remblai rocheux cimenté. Les modules suivants (transport, mise en place)
            viendront dans des versions futures.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 2. Flux de travail */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>2. Flux de travail</SectionTitle>
          <Para>
            L&apos;application s&apos;organise en quelques pages accessibles depuis la barre de navigation.
            Suivez l&apos;ordre ci-dessous pour obtenir des résultats valides.
          </Para>

          <Step n={1} title="Configurer les informations générales (page Informations)">
            Renseignez l&apos;identification du projet (opérateur, nom, résidu, date), la géométrie du
            contenant de moulage (section, rayon ou dimensions) et l&apos;agent liant : un ou plusieurs
            composants (ciment Portland, laitier, cendres volantes…) avec leurs fractions massiques. Ces
            informations apparaissent dans l&apos;en-tête des exports.
          </Step>

          <Step n={2} title="Vérifier les réglages (page Réglages — facultatif)">
            La page Réglages permet de modifier les constantes physiques (masse volumique de l&apos;eau,
            gravité, constantes du modèle prédictif) et les catalogues de matériaux (densité relative Gs
            de chaque liant, résidu ou granulat). Les valeurs par défaut sont celles des feuilles de
            calcul de l&apos;enseignant.
          </Step>

          <Step n={3} title="Choisir la catégorie et la méthode (page Calculs)">
            Sélectionnez la catégorie de remblai (<strong>RPC</strong>, <strong>RPG</strong> ou{" "}
            <strong>RRC</strong>) puis la méthode de calcul. Le formulaire se met à jour automatiquement.
          </Step>

          <Step n={4} title="Renseigner les paramètres et lancer le calcul">
            Complétez le formulaire (propriétés du résidu, Cw, Bw, Sr, nombre de moules, facteur de perte
            κ, etc.) puis lancez le calcul. Les résultats s&apos;affichent aussitôt.
          </Step>

          <Step n={5} title="Analyser et exporter les résultats">
            Le rapport complet compte six sections : données du mélange, paramètres géotechniques, masses
            et poids volumiques, indice des vides et structure, volumes, résultats complets. Les boutons
            Excel et PDF téléchargent le rapport ; la feuille labo imprime les masses à peser.
          </Step>

          <Step n={6} title="Explorer les courbes de réponse (page Analyse)">
            La page <strong>Calculs</strong> répond à « quelle recette pour ces valeurs ? ». La page{" "}
            <strong>Analyse</strong> répond à une autre question : « et si je faisais varier un
            paramètre, que devient le reste ? ». Choisissez un paramètre à balayer — Bw, Cw, Sr ou
            la fraction massique de granulat — une plage, et l&apos;application calcule une recette
            complète à chaque point. Aucune formule n&apos;est approchée : chaque point est une vraie
            résolution par les mêmes solveurs que la page Calculs, donc une courbe ne peut pas diverger
            du calculateur. Le tableau <strong>« Tenu fixe / ce qui varie »</strong> sous le graphique
            dit exactement ce que le balayage laisse constant. Un second mode montre la{" "}
            <strong>composition du mélange</strong> en barres, en diagramme ternaire et en
            échantillon. Exports CSV, JSON et PNG, chacun accompagné de son bloc de provenance.
          </Step>

          <Step n={7} title="Suivre les gâchées et les essais UCS (page Labo)">
            La page <strong>Labo</strong> accompagne la séance : enregistrez la{" "}
            <strong>gâchée réelle</strong> (masses cibles contre masses réellement pesées, lots de
            matériaux, ajouts versés après le premier malaxage), moulez des{" "}
            <strong>éprouvettes</strong> avec leur âge de cure, suivez l&apos;échéancier des
            écrasements — exportable en calendrier .ics — puis saisissez la charge à la rupture ou
            importez le fichier de la presse. L&apos;application calcule la contrainte, agrège par âge
            (moyenne, écart-type, CV) et trace la courbe <strong>UCS mesurée en fonction de
            l&apos;âge</strong>. Aucune valeur n&apos;est prédite : seules vos mesures sont tracées. Les
            protocoles sont éditables et chaque gâchée en fige un instantané, de sorte qu&apos;une
            mesure reste interprétable même si la procédure change ensuite.
          </Step>

          <InfoBox type="tip">
            <strong>Astuce :</strong> le mode Plein écran des résultats affiche les tableaux sur deux
            colonnes, plus lisibles avec plusieurs recettes.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 3. Catégories */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>3. Catégories de remblai</SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 16 }}>
            {[
              {
                code: "RPC", nom: "Remblai en pâte cimenté", couleur: "var(--primary)", fond: "var(--primary-light)", bord: "var(--primary-mid)",
                texte: "Résidus miniers épaissis, agent liant et eau, mis en place sous forme de pâte. Toutes les méthodes sont disponibles.",
                methodes: "Selon Cw · selon E/L · modèle prédictif · essai-erreur",
              },
              {
                code: "RPG", nom: "Remblai en pâte granulaire", couleur: "#16a34a", fond: "#f0fdf4", bord: "#bbf7d0",
                texte: "Remblai en pâte auquel on ajoute un granulat (roche concassée, sable). Deux paramètres de plus : la fraction massique de granulat Am et la densité relative Gs du granulat. Le modèle prédictif, calé sur le RPC, n'est pas proposé.",
                methodes: "Selon Cw · selon E/L · essai-erreur",
              },
              {
                code: "RRC", nom: "Remblai rocheux cimenté", couleur: "#b45309", fond: "#fffbeb", bord: "#fde68a",
                texte: "Roches stériles liées par un coulis de ciment, souvent avec un retardateur de prise. Dosage selon Bw (ciment / roches stériles) et le rapport E/L du coulis.",
                methodes: "Selon Bw et E/L du coulis",
              },
            ].map((c) => (
              <div key={c.code} style={{ background: c.fond, border: `1.5px solid ${c.bord}`, borderRadius: 9, padding: "16px 18px" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.couleur, marginBottom: 6 }}>{c.code}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>{c.nom}</div>
                <Para>{c.texte}</Para>
                <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, background: c.couleur, color: "#fff", fontSize: 11.5, fontWeight: 600 }}>
                  {c.methodes}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 4. Méthodes */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>4. Méthodes de calcul</SectionTitle>
          <Para>
            Chaque méthode produit le même ensemble de sorties (masses, volumes, paramètres
            géotechniques) à partir de données d&apos;entrée différentes. Choisissez-la selon les
            données dont vous disposez au laboratoire.
          </Para>

          <Method
            badge="Dosage selon Cw"
            title="Dosage selon le pourcentage solide massique Cw"
            when="Vous fixez le pourcentage solide massique Cw du mélange. C'est la méthode la plus courante en pratique."
            inputs={[
              "Cw — pourcentage solide massique (%)",
              "Sr — degré de saturation visé (%)",
              "Bw — taux massique de liant de chaque recette (%)",
              "Gs et w₀ du résidu",
              "Agent liant (composants, fractions massiques et Gs)",
              "Géométrie du moule, nombre de moules, facteur de perte κ",
            ]}
            formula="Cw = Ms / (Ms + Mw) × 100   |   e = w × Gs / Sr"
          />

          <Method
            badge="Dosage selon E/L"
            title="Dosage selon le rapport eau/liant E/L"
            when="Vous imposez un rapport eau/liant E/L (noté aussi E/C ou W/C), par exemple tiré d'essais de résistance antérieurs."
            inputs={[
              "Bw — taux massique de liant de chaque recette (%)",
              "E/L — rapport eau/liant de chaque recette (ex. : 4,0 ; 6,5)",
              "Sr — degré de saturation visé (%)",
              "Gs et w₀ du résidu",
              "Agent liant",
            ]}
            formula="Cw calculé à partir de : Cw = (1 + Bw) / (1 + Bw + E/L × Bw)"
          />

          <Method
            badge="Modèle prédictif (RPC seulement)"
            title="Cw prédit à partir de l'affaissement visé"
            when="Vous visez un affaissement donné au cône d'Abrams (ASTM C143/C143M) et voulez en déduire le Cw. Modèle empirique calé sur le RPC."
            inputs={[
              "Affaissement visé S (mm)",
              "Type de cône : petit cône (non normalisé, converti par le facteur 2,335) ou cône d'Abrams de 300 mm",
              "Sr, Bw, agent liant",
            ]}
            formula="Cw (%) ≈ 4,95×10⁶·(1 + Bw) / ( S·(1 + Bw)/Gs résidu + 235,5122 )²   (Bw en %, S en mm au cône d'Abrams)"
          />

          <Method
            badge="Essai-erreur"
            title="Correction d'une recette de base par les ajouts réels"
            when="Vous avez une recette de base (dosage selon Cw ou selon E/L) et avez fait des ajouts après la mesure de l'affaissement : résidu sec, résidu humide, eau (et granulat en RPG)."
            inputs={[
              "Méthode de base : dosage selon Cw ou selon E/L (avec tous ses paramètres)",
              "Pour chaque recette : masse de résidu sec ajoutée",
              "Pour chaque recette : masse de résidu humide ajoutée",
              "Pour chaque recette : masse d'eau ajoutée",
            ]}
            formula="Mr total = Mr base + ajout sec + part sèche de l'ajout humide   |   Mb-ad = Mb visé − Mb base"
          />

          <Method
            badge="RRC"
            title="Dosage selon Bw et le rapport E/L du coulis"
            when="Remblai rocheux cimenté : vous connaissez la quantité à produire (volume du chantier ou masse totale) et visez un Bw et un E/L du coulis."
            inputs={[
              "Volume du chantier et masse volumique humide, ou masse totale de RRC",
              "Bw (ciment / roches stériles) et rapport E/L du coulis de chaque recette",
              "Densité relative Gs du ciment (ASTM C188)",
              "Dosage en retardateur de prise D0 (ml/100 kg de ciment)",
            ]}
            formula="MWR + Mc + M* = masse totale de RRC   (M* = eau + retardateur)"
          />
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 5. Paramètres */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>5. Référence des paramètres d&apos;entrée</SectionTitle>
          <Para>
            Définition de chaque paramètre des formulaires, avec son unité et une plage de valeurs
            typiques pour les remblais en pâte miniers.
          </Para>

          <div style={{ overflowX: "auto" }}>
            <table className="guide-param-table">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Paramètre</th>
                  <th style={{ width: "8%" }}>Unité</th>
                  <th style={{ width: "16%" }}>Plage typique</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gs du résidu", "—", "2,6 – 4,0", "Densité relative des grains (Gs = ρs/ρw), sans unité. Mesurée au pycnomètre (ASTM D854). Valeur typique : 2,85 – 3,20 pour des résidus de mines métalliques."],
                  ["w₀", "%", "0 – 35 %", "Teneur en eau massique du résidu tel que reçu (ASTM D2216). Elle réduit l'eau à ajouter."],
                  ["Cw", "%", "65 – 85 %", "Pourcentage solide massique : masse des solides / masse totale du remblai frais. Plus il est élevé, plus la pâte est épaisse. Usuel : 72 – 80 % pour un RPC."],
                  ["Bw", "%", "3 – 12 %", "Taux massique de liant : masse de liant / masse sèche de résidu (et de granulat en RPG). Bw = 5 % : 5 kg de liant pour 100 kg de résidu sec."],
                  ["Sr", "%", "80 – 100 %", "Degré de saturation : volume d'eau / volume des vides. Sr = 100 % : pâte saturée, sans air. Généralement 100 % pour un RPC."],
                  ["E/L (W/C)", "—", "3 – 10", "Rapport eau/liant : masse d'eau / masse de liant. Plus il est élevé, plus la pâte est fluide et moins elle est résistante."],
                  ["Gs du liant", "—", "2,6 – 3,2", "Densité relative de l'agent liant (ASTM C188), calculée comme moyenne harmonique pondérée de ses composants."],
                  ["Am (RPG)", "%", "10 – 60 %", "Fraction massique de granulat dans les solides hors liant. Am = 30 % : 30 g de granulat pour 100 g de (résidu + granulat)."],
                  ["Gs du granulat (RPG)", "—", "2,50 – 2,80", "Densité relative du granulat (sable ou roche concassée). Valeur typique d'un sable siliceux : 2,65."],
                  ["S", "mm", "150 – 250", "Affaissement au cône d'Abrams (ASTM C143/C143M). 178 mm (7 po) sert de référence de consistance."],
                  ["Nombre de moules", "—", "1 – 200+", "Nombre de moules par recette. Détermine le volume total à préparer."],
                  ["κ (facteur de perte)", "—", "1,0 – 1,25", "Multiplie les masses pour compenser les pertes au malaxage et au moulage. κ = 1 : aucun surplus ; le cours retient souvent 1,25. Appelé « facteur de sécurité » dans les feuilles de calcul."],
                ].map(([param, unit, range, desc]) => (
                  <tr key={param as string}>
                    <td><strong style={{ color: "var(--navy)", fontSize: 12.5 }}>{param}</strong></td>
                    <td style={{ color: "var(--primary)", fontWeight: 600, fontSize: 12.5 }}>{unit}</td>
                    <td style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{range}</td>
                    <td style={{ fontSize: 13, color: "#374151" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 6. Résultats */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>6. Lecture des résultats</SectionTitle>
          <Para>
            Le rapport complet est divisé en six sections. Les valeurs sont calculées pour chaque recette
            indépendamment, dans les unités choisies dans Réglages.
          </Para>

          {[
            {
              color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe",
              title: "Données du mélange",
              desc: "Masse de chaque constituant : résidu sec, résidu humide, granulat (RPG), liant total, eau totale, eau à ajouter, et la masse de chaque composant du liant (Mc1, Mc2…). En méthode essai-erreur, les masses à ajouter ou à retirer (Mb-ad, Mc1-ad…).",
            },
            {
              color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0",
              title: "Paramètres géotechniques",
              desc: "Taux massique de liant Bw, pourcentages solides massique Cw et volumique Cv, teneur en eau massique w, rapport eau/liant E/L et degré de saturation Sr.",
            },
            {
              color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff",
              title: "Masses et poids volumiques",
              desc: "Masses volumiques humide ρh, sèche ρd et des grains ρs ; poids volumiques humide γh, sec γd et des grains γs, en kN/m³.",
            },
            {
              color: "#b45309", bg: "#fffbeb", border: "#fde68a",
              title: "Indice des vides et structure",
              desc: "Indice des vides e, porosité n, teneur en eau volumique θ, densités relatives Gs du remblai et du liant.",
            },
            {
              color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc",
              title: "Volumes",
              desc: "Volume du moule, volume total VT, volumes des solides Vs, des vides Vv, du résidu Vr, du liant Vb, de l'eau Vw et du granulat Vg (RPG).",
            },
            {
              color: "#1d4ed8", bg: "#f8fafc", border: "#bfdbfe",
              title: "Résultats complets",
              desc: "Bilan des masses : masse sèche de résidu (et de granulat), masse totale des solides Ms, masse totale d'eau Mw, masse totale du remblai, eau contenue dans le résidu, eau à ajouter, volume d'air, et Cw, Cv recalculés à partir des masses et des volumes.",
            },
          ].map(({ color, bg, border, title, desc }) => (
            <div
              key={title}
              style={{
                display: "flex",
                gap: 14,
                marginBottom: 10,
                padding: "12px 16px",
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 4,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
                  {title}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 7. Export Excel */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>7. Export Excel</SectionTitle>
          <Para>
            Le bouton <strong>Excel</strong> des résultats génère un fichier{" "}
            <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, fontSize: 12.5 }}>.xlsx</code>{" "}
            directement dans le navigateur, sans passer par le serveur.
          </Para>

          <SubTitle>Contenu du fichier exporté</SubTitle>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "En-tête : opérateur, projet, résidu, date, catégorie, méthode.",
              "Données du mélange : Bw, Bv et toutes les masses (Mr, Ma, Mb, Mw, Mw-aj, Mc1, Mc2…, ajouts de l'essai-erreur).",
              "Paramètres géotechniques : Bw, Cw, Cv, w, E/L, Sr.",
              "Masses et poids volumiques : ρh, ρd, ρs, γh, γd, γs.",
              "Indice des vides et structure : e, n, θ, Gs du remblai, Gs du liant.",
              "Volumes : moule, VT, Vs, Vv, Vr, Vb, Vw.",
              "Résultats complets : bilan des masses, volume d'air, Cw et Cv recalculés.",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 5, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
          <InfoBox type="tip">
            <strong>Nommage automatique :</strong> le fichier porte la catégorie, la méthode et la date,
            par exemple
            <code style={{ margin: "0 4px", padding: "1px 5px", background: "#d1fae5", borderRadius: 3, fontSize: 12 }}>
              MineBackfill_RPC_dosage-Cw_2026-03-15.xlsx
            </code>
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 8. Formules */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>8. Page Formules</SectionTitle>
          <Para>
            La page <strong>Formules</strong> répertorie les équations employées par le logiciel, avec leur
            rendu mathématique complet.
          </Para>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "Recherche instantanée par mot-clé ou par symbole.",
              "Un clic sur une formule ouvre un panneau latéral : description, variables, hypothèses et références.",
              "Le panneau latéral peut passer en plein écran pour une lecture confortable.",
              "Les formules sont groupées par section du cours.",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 5, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/formulas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 7,
              background: "var(--primary)",
              color: "#fff",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            Ouvrir la page Formules
          </Link>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 9. Glossaire et essais normalisés */}
        {/* ─────────────────────────────────────────── */}
        <div id="glossaire" style={{ scrollMarginTop: 16 }}>
          <Card accent>
            <SectionTitle>9. Glossaire et essais normalisés</SectionTitle>
            <SectionGlossaire />
          </Card>
        </div>

        {COMPTES_OUVERTS && (
          <Card>
            <SectionTitle>10. Sauvegarde en ligne et compte</SectionTitle>
            <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0 }}>
                Avec un compte, <strong>tout votre travail est sauvegardé en ligne</strong> : résultats
                sauvegardés et gâchées du laboratoire. Vous le retrouvez sur un autre appareil, d&apos;une
                session à l&apos;autre, et l&apos;enseignant peut le consulter et le commenter.
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>
                  Page <Link href="/compte" style={{ color: "var(--primary)" }}>Compte</Link> → Inscription, avec
                  votre <strong>prénom et nom</strong> : c&apos;est sous ce nom que l&apos;enseignant voit votre travail.
                </li>
                <li>
                  À la première connexion, si l&apos;appareil contient déjà du travail fait sans compte, un
                  bandeau propose de le <strong>rattacher</strong> à votre compte : acceptez pour le sauvegarder.
                </li>
                <li>
                  Ensuite, rien à faire : chaque modification part quelques secondes plus tard. La pastille
                  du bouton Compte indique l&apos;état — <strong>verte</strong> : à jour ; <strong>jaune</strong> : en
                  attente ; <strong>grise</strong> : hors ligne (tout partira au retour du réseau).
                </li>
              </ol>
              <p style={{ margin: 0 }}>
                <strong>Deux appareils modifient la même chose en même temps ?</strong> Les deux versions sont
                gardées ; la vôtre est marquée « copie de conflit » et n&apos;entre pas dans les figures. Gardez
                la bonne, supprimez l&apos;autre.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Échanges avec l&apos;enseignant</strong> : ses commentaires apparaissent sous le
                résultat (Historique) ou la gâchée (Labo) concernés, visibles de vous seul, avec une
                pastille « commentaire non lu » dans la liste. Vous pouvez y <strong>répondre</strong> ;
                chacun voit si l&apos;autre a lu (« vu le … »).
              </p>
              <p style={{ margin: 0 }}>
                <strong>Compte suspendu ?</strong> L&apos;enseignant peut bloquer un compte : la connexion
                est refusée, mais le travail enregistré dans votre navigateur y reste.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Les courbes de presse restent sur l&apos;appareil</strong> (elles sont volumineuses) :
                exportez régulièrement une sauvegarde locale (Réglages → Données locales).
              </p>
              <p style={{ margin: 0 }}>
                <strong>Mot de passe oublié ?</strong> Page Compte → « Mot de passe oublié ? » : un lien
                arrive par courriel. Votre travail n&apos;est pas en danger : il est dans votre navigateur
                et dans votre compte.
              </p>
            </div>
          </Card>
        )}

        {/* ── Footer ── */}
        <div
          style={{
            marginTop: 16,
            padding: "16px 20px",
            background: "var(--primary-light)",
            border: "1px solid var(--primary-mid)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
              Prêt à commencer ?
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
              Renseignez les informations du projet, puis lancez vos premiers calculs de mélange.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>
              Commencer
            </Link>
            <Link href="/mix" className="btn-secondary" style={{ textDecoration: "none" }}>
              Calculs
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
