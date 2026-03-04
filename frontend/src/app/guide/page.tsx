// src/app/guide/page.tsx
import Link from "next/link";

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
          Parametres requis :
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
            Outil de dimensionnement des melanges de remblai cimente en pate pour l&apos;industrie miniere.
            Ce guide explique chaque etape, methode et parametre.
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
            Table des matieres
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
            {[
              ["1", "Vue d'ensemble"],
              ["2", "Flux de travail"],
              ["3", "Categories de remblai"],
              ["4", "Methodes de calcul"],
              ["5", "Reference des parametres"],
              ["6", "Lecture des resultats"],
              ["7", "Export Excel"],
              ["8", "Page Formules"],
            ].map(([num, title]) => (
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
            <strong>MineBackfill</strong> est un outil de dimensionnement de melanges de remblai cimente en pate
            (RCP) et de remblai pate granulaire (RPG) destine aux laboratoires et bureaux d&apos;etudes miniers.
            Il implemente les formules du <strong>Module 1</strong> du programme de calcul de M. Belem
            (Universite du Quebec en Abitibi-Temiscamingue) et permet de :
          </Para>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "Calculer les masses et volumes de chaque composant du remblai (residu, liant, eau) pour 1 a 4 recettes en parallele.",
              "Determiner les parametres geotechniques fondamentaux : indice des vides, porosite, degre de saturation, densites humide et seche.",
              "Ajuster les recettes par methode essai-erreur (ajout de residu, d'eau ou de liant).",
              "Exporter l'integralite des resultats au format Excel (.xlsx).",
              "Consulter les formules mathematiques avec rendu LaTeX interactif.",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 6, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
          <InfoBox type="info">
            <strong>Module 1 — Contexte :</strong> Les calculs couvrent les sections 1 (Dosage Cw%), 2 (Rapport E/C),
            3 (Essai-erreur) et 4-5 (RPG). Les modules superieurs (soutenance, transport) seront integres
            dans des versions futures.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 2. Flux de travail */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>2. Flux de travail</SectionTitle>
          <Para>
            L&apos;application est organisee en deux etapes principales accessibles depuis la barre de navigation.
            Suivez l&apos;ordre ci-dessous pour obtenir des resultats valides.
          </Para>

          <Step n={1} title="Configurer les informations generales (page Informations)">
            Renseignez l&apos;identification du projet (operateur, nom, residu, date), la geometrie du contenant
            de moulage (section, rayon ou dimensions), et le systeme liant (1 a 3 ciments avec leurs
            fractions massiques). Ces informations apparaissent dans l&apos;en-tete de l&apos;export Excel.
          </Step>

          <Step n={2} title="Verifier les reglages (page Reglages — optionnel)">
            La page Reglages vous permet de modifier les constantes physiques (masse volumique de l&apos;eau,
            gravite) et le catalogue des liants (Gs de chaque type de ciment). Les valeurs par defaut sont
            conformes aux standards industriels et ne necessitent generalement pas de modification.
          </Step>

          <Step n={3} title="Choisir la categorie et la methode (page Calculs, panneau gauche)">
            Selectionnez la categorie de remblai (<strong>RPC</strong> ou <strong>RPG</strong>) puis la
            methode de calcul souhaitee. Le formulaire central se met a jour automatiquement.
          </Step>

          <Step n={4} title="Renseigner les parametres et lancer le calcul">
            Completez le formulaire (proprietes du residu, Cw%, Bw%, Sr%, nombre de moules, facteur de
            securite, etc.) puis cliquez sur <strong>Lancer le calcul</strong>. Le panneau de droite affiche
            instantanement les resultats.
          </Step>

          <Step n={5} title="Analyser et exporter les resultats">
            Consultez les six sections du panneau de resultats : masses, parametres geotechniques,
            densites, indices des vides, volumes et resultats detailles. Cliquez sur{" "}
            <strong>Exporter Excel</strong> pour telecharger un fichier .xlsx complet.
          </Step>

          <InfoBox type="tip">
            <strong>Astuce :</strong> Utilisez le bouton plein ecran (icone en haut a droite du panneau
            de resultats) pour afficher les tableaux en disposition a deux colonnes, plus lisible avec
            plusieurs recettes.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 3. Categories */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>3. Categories de remblai</SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div
              style={{
                background: "var(--primary-light)",
                border: "1.5px solid var(--primary-mid)",
                borderRadius: 9,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>RPC</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>
                Remblai en Pate Cimente
              </div>
              <Para>
                Compose uniquement de residu filtre (taille &lt; 20 mm), de liant et d&apos;eau. Le residu
                constitue la fraction solide principale. Toutes les methodes de calcul sont disponibles :
                Cw%, E/C, slump et essai-erreur.
              </Para>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                Methodes : Cw% / E/C / Slump / Essai-erreur
              </div>
            </div>

            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                borderRadius: 9,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>RPG</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>
                Remblai Pate Granulaire (PAF)
              </div>
              <Para>
                Ajoute une fraction d&apos;agregat grossier (sable, gravier) au remblai en pate. Necessite
                deux parametres supplementaires : fraction massique d&apos;agregat (A_m%) et poids
                specifique de l&apos;agregat (Gs_agr). La methode slump n&apos;est pas applicable.
              </Para>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: "#16a34a",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                Methodes : Cw% / E/C / Essai-erreur
              </div>
            </div>
          </div>

          <InfoBox type="warning">
            <strong>RRC (Remblai Rocheux Cimente) :</strong> Cette categorie sera disponible dans une
            prochaine version du logiciel. Elle utilisera des formules specifiques aux remblais a
            granulometrie grossiere.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 4. Methodes */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>4. Methodes de calcul</SectionTitle>
          <Para>
            Chaque methode determine le meme ensemble de sorties (masses, volumes, parametres geotechniques)
            mais a partir de variables d&apos;entree differentes. Choisissez la methode en fonction des
            donnees disponibles en laboratoire.
          </Para>

          <Method
            badge="Dosage Cw%"
            title="Dosage selon la teneur en solides massique"
            when="Vous connaissez le pourcentage massique de solides desire dans le melange (Cw%). C'est la methode la plus courante en pratique industrielle."
            inputs={[
              "Cw% — teneur massique en solides (%)",
              "Sr% — degre de saturation cible (%)",
              "Bw% — pourcentage massique de liant pour chaque recette (%)",
              "Gs du residu, w0 du residu humide",
              "Systeme liant (1 a 3 ciments, fractions et Gs)",
              "Geometrie du moule, nombre de moules, facteur de securite",
            ]}
            formula="Cw = Ms / (Ms + Mw) × 100   |   e = (w/100) × Gs_bkf / Sr"
          />

          <Method
            badge="Rapport E/C"
            title="Dosage par rapport eau / ciment"
            when="Vous imposez un rapport eau/ciment (E/C) specifique, par exemple issu d'essais de resistance mecanique precedents."
            inputs={[
              "Bw% — pourcentage massique de liant pour chaque recette (%)",
              "E/C — rapport eau sur ciment pour chaque recette (ex. : 4.0, 6.5)",
              "Sr% — degre de saturation cible (%)",
              "Gs du residu, w0 du residu",
              "Systeme liant",
            ]}
            formula="Cw calcule a partir de : Cw = (1 + Bw) / (1 + Bw + E/C × Bw)"
          />

          <Method
            badge="Slump (RPC uniquement)"
            title="Ajustement par mesure d'affaissement"
            when="Vous avez mesure l'affaissement (slump) au cone d'Abrams et souhaitez en deduire Cw% optimal. Methode empirique, specifique RPC."
            inputs={[
              "Slump cible en mm",
              "Type de cone : mini ou grand (facteur de conversion 2.335)",
              "Sr%, Bw%, systeme liant",
            ]}
            formula="Cw = f(slump) via modele predictif : Cw = 4.95×10^6 / (slump - 235.5122)"
          />

          <Method
            badge="Essai-erreur"
            title="Ajustements manuels a partir d'une recette de base"
            when="Vous disposez d'une recette de base (Cw% ou E/C) et souhaitez simuler l'effet d'ajouts de residu sec, de residu humide ou d'eau supplementaire."
            inputs={[
              "Methode de base : Cw% ou E/C (avec tous ses parametres)",
              "Pour chaque recette : masse de residu sec ajoute (kg)",
              "Pour chaque recette : masse de residu humide ajoute (kg)",
              "Pour chaque recette : masse d'eau ajoutee (kg)",
            ]}
            formula="Mr_sec_tot = Mr_base + delta_sec + sec_from_wet   |   Mb_ad = max(Mb_cible - Mb_base, 0)"
          />
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 5. Parametres */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>5. Reference des parametres d&apos;entree</SectionTitle>
          <Para>
            Voici la definition de chaque parametre utilise dans les formulaires, avec les unites et plages
            de valeurs typiques pour les remblais en pate miniers.
          </Para>

          <div style={{ overflowX: "auto" }}>
            <table className="guide-param-table">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Parametre</th>
                  <th style={{ width: "8%" }}>Unite</th>
                  <th style={{ width: "16%" }}>Plage typique</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gs residu", "—", "2.6 – 4.0", "Poids specifique (densite relative) du residu sec. Determine par pycnometre. Valeur typique : 2.85 – 3.20 pour tailings metalliques."],
                  ["w0 (humidite)", "%", "0 – 35 %", "Teneur en eau massique du residu tel que livre (humide). Influence la masse d'eau a ajouter."],
                  ["Cw%", "%", "65 – 85 %", "Pourcentage massique de solides dans le remblai frais. Valeur plus elevee = melange plus epais. Recommande : 72 – 80 % pour RPC."],
                  ["Bw%", "%", "3 – 12 %", "Pourcentage massique de liant rapporte a la masse de residu sec. Ex. : Bw = 5 % signifie 5 kg de liant pour 100 kg de residu sec."],
                  ["Sr%", "%", "80 – 100 %", "Degre de saturation : fraction des vides occupee par l'eau. Sr = 100 % correspond a un melange sature (aucun air). Generalement fixe a 100 % pour RPC."],
                  ["E/C (W/B)", "—", "3 – 10", "Rapport masse d'eau / masse de liant. Valeur elevee = melange plus fluide et moins resistant."],
                  ["Gs liant", "—", "2.80 – 3.20", "Poids specifique du systeme liant (calcule automatiquement comme moyenne harmonique des composants)."],
                  ["A_m% (RPG)", "%", "10 – 60 %", "Fraction massique d'agregat dans les solides non-liant. Ex. : A_m = 30 % signifie 30 g d'agregat pour 100 g de (residu + agregat)."],
                  ["Gs agregat (RPG)", "—", "2.50 – 2.80", "Poids specifique de l'agregat utilise en RPG (sable ou gravier). Valeur typique pour sable siliceux : 2.65."],
                  ["N moules", "—", "1 – 200+", "Nombre de contenants de moulage par recette. Determine le volume total a preparer."],
                  ["Facteur securite (FS)", "—", "1.0 – 1.15", "Multiplie le volume total pour compenser les pertes lors du coulage. FS = 1 signifie pas de supplement."],
                ].map(([param, unit, range, desc]) => (
                  <tr key={param as string}>
                    <td><strong style={{ color: "var(--navy)", fontFamily: "monospace", fontSize: 12.5 }}>{param}</strong></td>
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
        {/* 6. Resultats */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>6. Lecture des resultats</SectionTitle>
          <Para>
            Le panneau de resultats (a droite) est divise en six sections, chacune codee par couleur.
            Les valeurs sont calculees pour chaque recette independamment.
          </Para>

          {[
            {
              color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe",
              title: "Donnees du melange",
              desc: "Masses en kilogrammes de chaque composant : residu sec, residu humide, liant total, eau totale, eau a ajouter et masses individuelles de chaque ciment (Mc1, Mc2, Mc3). Pour la methode essai-erreur, affiche egalement les masses a rajouter (Mb-ad, Mc1-ad...).",
            },
            {
              color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0",
              title: "Parametres geotechniques",
              desc: "Cw% (teneur en solides), Cv% (fraction volumique de solides), w% (teneur en eau massique), E/C (rapport eau/ciment effectif) et Sr% (saturation finale).",
            },
            {
              color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff",
              title: "Masses volumiques",
              desc: "Densite humide rho_h et seche rho_d en g/cm3, poids volumiques humide gamma_h et sec gamma_d en kN/m3.",
            },
            {
              color: "#b45309", bg: "#fffbeb", border: "#fde68a",
              title: "Indices des vides et structure",
              desc: "Indice des vides e, porosite n, teneur en eau volumique theta, poids specifique du remblai (Gs_backfill) et du liant (Gs liant).",
            },
            {
              color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc",
              title: "Volumes",
              desc: "Tous les volumes en litres : volume du moule (V_moule), volume total (V_T), volume solide (V_s), volume des vides (V_v), volume du residu (V_r), volume du liant (V_b) et volume de l'eau (V_w).",
            },
            {
              color: "#1d4ed8", bg: "#f8fafc", border: "#bfdbfe",
              title: "Resultats complets",
              desc: "Recapitulatif complet style Excel : masses totales (Mr_sec_tot, Ms, Mt), eau dans le residu, eau a ajouter, masse totale en grammes, volume d'air, Cw% et Cv% calcules a partir des masses et volumes.",
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
            Le bouton <strong>Exporter Excel</strong> (barre verte en haut du panneau de resultats)
            genere un fichier <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, fontSize: 12.5 }}>.xlsx</code> directement dans le navigateur, sans connexion serveur.
          </Para>

          <SubTitle>Contenu du fichier exporte</SubTitle>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "En-tete : operateur, projet, residu, date, categorie, methode.",
              "Section Donnees du melange : toutes les masses (Bw%, Bv%, Mr, Ma, Mb, Mw, Mw-aj, Mc1/2/3, ajouts essai-erreur).",
              "Section Parametres geotechniques : Cw%, Cv%, w%, E/C, Sr%.",
              "Section Masses volumiques : rho_h, rho_d, gamma_h, gamma_d.",
              "Section Indices des vides : e, n, theta, Gs_backfill, Gs_liant.",
              "Section Volumes : V_moule, V_T, V_s, V_v, V_r, V_b, V_w (en litres).",
              "Section Resultats complets : masses totales detaillees, volume d'air, Cw% et Cv% recalcules.",
            ].map((item, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 5, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
          <InfoBox type="tip">
            <strong>Nommage automatique :</strong> Le fichier est nomme selon le format
            <code style={{ margin: "0 4px", padding: "1px 5px", background: "#d1fae5", borderRadius: 3, fontSize: 12 }}>
              minebackfill_RPC_dosage_cw_2024-03-15.xlsx
            </code>
            avec la categorie, la methode et la date du calcul.
          </InfoBox>
        </Card>

        {/* ─────────────────────────────────────────── */}
        {/* 8. Formules */}
        {/* ─────────────────────────────────────────── */}
        <Card accent>
          <SectionTitle>8. Page Formules</SectionTitle>
          <Para>
            La page <strong>Formules</strong> (accessible depuis la navigation) repertorie toutes les
            equations implementees dans le logiciel, avec leur rendu mathematique complet (LaTeX).
          </Para>
          <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
            {[
              "Recherche en temps reel par mot-cle ou symbole.",
              "Cliquer sur une formule ouvre un panneau lateral avec description complete, variables, hypotheses et references.",
              "Le panneau lateral peut etre mis en plein ecran pour une lecture confortable.",
              "Toutes les formules sont groupees par section (1 = Cw, 2 = E/C, 3 = Essai-erreur, 4-5 = RPG).",
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
              Pret a commencer ?
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
              Renseignez les informations du projet, puis lancez vos premiers calculs de melange.
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
