import { describe, expect, it } from "vitest";
import { regrouper, type LigneClasse, type ProfilClasse } from "./classe";
import { EN_TETES_EPROUVETTES, EN_TETES_SYNTHESE, lignesCsvEprouvettes, lignesCsvSynthese, texteCsvSur } from "./classe-csv";
import { versCsv } from "./export-fig";

const A = "a";
const profils: ProfilClasse[] = [{ id: A, email: "=HYPERLINK(\"x\")", display_name: "=1+1", role: "etudiant" }];
const sessions = [{ id: "A2026", nom: "Automne 2026", debut: "2026-09-01", fin: "2026-12-23" }];

function gachee(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: new Date(2026, 8, 10, 12).toISOString(), statut: "terminee", formulationLabel: "-Formule", categorie: "RPC",
    recetteIndex: 0, tolerancePct: 2, ajustements: [], sessionId: "A2026",
    parametres: { cwPct: 75.5, bwPct: 5, wcRatio: 7.25, wPct: 32.4 },
    composants: [{ cle: "liant", label: "Liant", cibleKg: 5, peseeKg: 5.3 }, { cle: "eau", label: "Eau", cibleKg: 20, peseeKg: 20.1 }],
    eprouvettes: [
      { id: `${id}-1`, code: `G-${id}-E01`, couleLe: new Date(2026, 8, 10, 12).toISOString(), ageJours: 28, statut: "ecrase",
        essai: { date: new Date(2026, 9, 8, 12).toISOString(), chargeKn: 1.2345, diametreMm: 50, contrainteKpaSaisie: 1234.56 } },
      { id: `${id}-2`, code: `G-${id}-E02`, couleLe: new Date(2026, 8, 10, 12).toISOString(), ageJours: 28, statut: "ecrase",
        essai: { contrainteKpaSaisie: 999, exclu: true, justificationExclusion: "@fissure", tempsDeCureReelJours: 29 } },
      { id: `${id}-3`, code: `G-${id}-E03`, couleLe: new Date(2026, 8, 10, 12).toISOString(), ageJours: 56, statut: "en_cure" },
    ],
    ...extra,
  };
}
const ligne = (contenu: { id: string }): LigneClasse =>
  ({ proprietaire: A, kind: "gachee", id: contenu.id, rev: 1, maj: "m", cree: "c", supprime: false, contenu });

describe("export CSV de la classe", () => {
  const etudiants = regrouper([ligne(gachee("g1")), ligne(gachee("g1c", { conflit: { de: "g1", le: "x" } }))], profils, sessions, "toutes");

  it("neutralise les formules dans les cellules texte, jamais les nombres", () => {
    expect(texteCsvSur("=1+1")).toBe("'=1+1");
    expect(texteCsvSur("-Formule")).toBe("'-Formule");
    expect(texteCsvSur("@x")).toBe("'@x");
    expect(texteCsvSur("Alice")).toBe("Alice");
    // versCsv seul ne touche à rien : la garde est posée par classe-csv, sur le texte.
    expect(versCsv([["-3", -3]])).toBe("-3;-3");
  });

  it("éprouvettes : une ligne chacune, copies de conflit exclues, valeurs brutes", () => {
    const l = lignesCsvEprouvettes(etudiants, sessions);
    expect(l[0]).toEqual(EN_TETES_EPROUVETTES);
    expect(l).toHaveLength(1 + 3);
    const col = (nom: string) => EN_TETES_EPROUVETTES.indexOf(nom);
    const [e1, e2, e3] = l.slice(1);
    expect(e1[col("Étudiant")]).toBe("'=1+1");
    expect(e1[col("Courriel")]).toBe("'=HYPERLINK(\"x\")");
    expect(e1[col("Formulation")]).toBe("'-Formule");
    expect(e1[col("Session")]).toBe("Automne 2026");
    expect(e1[col("Date de gâchée")]).toBe("2026-09-10");
    expect(e1[col("Échéance")]).toBe("2026-10-08");
    expect(e1[col("Âge réel (j)")]).toBe(28);
    expect(e1[col("UCS (kPa)")]).toBe(1234.56);
    expect(e1[col("Valide")]).toBe("oui");
    expect(e2[col("Valide")]).toBe("non");
    expect(e2[col("Exclue")]).toBe("oui");
    expect(e2[col("Justification")]).toBe("'@fissure");
    expect(e2[col("Âge réel (j)")]).toBe(29);
    expect(e3[col("Statut")]).toBe("en cure");
    expect(e3[col("UCS (kPa)")]).toBeNull();
    // Virgule décimale et séparateur « ; » à l'écriture.
    expect(versCsv([e1])).toContain(";1234,56;oui;");
  });

  it("éprouvettes : fiche d'essai en colonnes ajoutées à la fin, anciennes colonnes inchangées", () => {
    // Les classeurs de l'enseignant pointent sur ces positions : elles ne bougent pas.
    expect(EN_TETES_EPROUVETTES.slice(0, 32)).toEqual([
      "Étudiant", "Courriel", "Session", "Gâchée", "Date de gâchée", "Catégorie", "Formulation", "Cw (%)", "E/L", "Bw (%)", "w (%)",
      "Éprouvette", "Coulée le", "Âge cible (j)", "Échéance", "Statut", "Date d'essai", "Âge réel (j)",
      "Charge (kN)", "Diamètre (mm)", "Hauteur (mm)", "UCS (kPa)", "Valide", "Exclue", "Justification", "Mode de rupture",
      "Module de Young (kPa)", "Déformation max (%)", "Fichier de presse", "Résidu", "Liants", "Eau de gâchage",
    ]);
    const g = gachee("g3", {
      materiaux: { residu: { nom: "Résidus LaRonde" }, liants: [{ code: "CP10", nom: "Ciment GU", fractionPct: 80 }, { code: "SLAG", fractionPct: 20 }], eau: { type: "robinet" } },
      cure: { mode: "chambre_humide", temperatureC: 23 }, malaxageDureeMin: 5,
      eprouvettes: [{ id: "x", code: "G-g3-E01", couleLe: new Date(2026, 8, 10, 12).toISOString(), ageJours: 28, statut: "ecrase", mouleDiametreMm: 50, mouleHauteurMm: 100,
        essai: { contrainteKpaSaisie: 800, masseG: 412.5, vitesseChargement: { valeur: 1, unite: "mm/min" }, modeRuptureCode: "cone", deflexionMaxMm: 0.8 } }],
    });
    const [e] = regrouper([ligne(g)], profils, sessions, "toutes");
    const [, l] = lignesCsvEprouvettes([e], sessions);
    const col = (nom: string) => EN_TETES_EPROUVETTES.indexOf(nom);
    expect(l[col("Résidu")]).toBe("Résidus LaRonde");
    expect(l[col("Liants")]).toBe("Ciment GU 80 %, SLAG 20 %");
    expect(l[col("Eau de gâchage")]).toBe("Eau du robinet");
    expect(l[col("Mode de cure")]).toBe("Chambre humide");
    expect(l[col("Température de cure (°C)")]).toBe(23);
    expect(l[col("Moule")]).toBe("Cylindre 50 × 100 mm");
    expect(l[col("Diamètre du moule (mm)")]).toBe(50);
    expect(l[col("Masse (g)")]).toBe(412.5);
    expect(l[col("Vitesse de chargement")]).toBe(1);
    expect(l[col("Unité de vitesse")]).toBe("mm/min");
    expect(l[col("Mode de rupture")]).toBe("Cônes aux deux extrémités");
    expect(l[col("Code de rupture")]).toBe("cone");
    expect(l[col("Déflexion max (mm)")]).toBe(0.8);
    expect(typeof l[col("Complétude de la fiche (%)")]).toBe("number");
    // Gâchée sans fiche : cellules vides, pas d'erreur.
    const [, vide] = lignesCsvEprouvettes(etudiants, sessions);
    expect(vide[col("Résidu")]).toBe("");
    expect(vide[col("Masse (g)")]).toBeNull();
  });

  it("synthèse : une ligne par gâchée et par âge mesuré, pesées hors tolérance comptées", () => {
    const l = lignesCsvSynthese(etudiants, sessions);
    expect(l[0]).toEqual(EN_TETES_SYNTHESE);
    expect(l).toHaveLength(2); // seul l'âge 28 j a un essai ; la copie de conflit est exclue
    const col = (nom: string) => EN_TETES_SYNTHESE.indexOf(nom);
    expect(l[1][col("Âge (j)")]).toBe(28);
    expect(l[1][col("n")]).toBe(1);
    expect(l[1][col("Exclues")]).toBe(1);
    expect(l[1][col("UCS moyenne (kPa)")]).toBe(1234.6);
    expect(l[1][col("Pesées hors tolérance")]).toBe(1); // liant +6 %, eau +0,5 %
    expect(EN_TETES_SYNTHESE.at(-1)).toBe("Complétude de la fiche (%)");
    expect(l[1]).toHaveLength(EN_TETES_SYNTHESE.length);
  });

  it("synthèse : gâchée sans mesure ni pesée → une ligne, pesées inconnues", () => {
    const [e] = regrouper([ligne(gachee("g2", { eprouvettes: [], composants: undefined }))], profils, sessions, "toutes");
    const l = lignesCsvSynthese([e], sessions);
    expect(l).toHaveLength(2);
    expect(l[1][EN_TETES_SYNTHESE.indexOf("Pesées hors tolérance")]).toBeNull();
  });
});
