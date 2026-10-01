// Rendu des vues de l'enseignant sur des données d'exemple (sans navigateur :
// ces pages exigent une connexion enseignant). Vérifie qu'elles s'affichent
// sans erreur, y compris sur des documents incomplets, et montrent l'essentiel.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_UNITS } from "@/lib/units";
import { regrouper, type LigneClasse, type ProfilClasse } from "@/lib/classe";
import type { LigneAnnotation } from "@/lib/classe-reseau";
import GacheeLecture from "./GacheeLecture";
import ResultatLecture from "./ResultatLecture";
import VueDocument from "./VueDocument";
import TableauEtudiants from "./TableauEtudiants";
import DetailEtudiant from "./DetailEtudiant";
import FigureClasse from "./FigureClasse";
import OngletComparaison from "./OngletComparaison";
import { comparerClasse } from "@/lib/classe-comparaison";
import { alertesClasse } from "@/lib/classe-alertes";
import CarteAlertes from "./CarteAlertes";
import OngletEcheancier from "./OngletEcheancier";
import { echeancierClasse } from "@/lib/classe-echeancier";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const profils: ProfilClasse[] = [{ id: A, email: "alice@x.ca", display_name: "Alice Tremblay", role: "etudiant" }];
const recette = {
  bw_mass_pct: 5, solids_mass_pct: 75, wc_ratio: 7.1, w_mass_pct: 33.3, void_ratio: 1.1, porosity: 0.52, saturation_pct: 100,
  components: { residue_dry_mass_kg: 100, binder_total_mass_kg: 5, water_total_mass_kg: 35 },
};
const resultat = {
  id: "r1", savedAt: "2026-09-10T12:00:00.000Z", label: "Formule A", category: "RPC", method: "dosage_cw",
  general: { operator_name: "Alice", binders: [{ code: "GU", fraction: 1 }] }, recipes: [recette], solverVersion: "gramme-1.0",
};
const gachee = {
  id: "g1", code: "G-20260910-01", creeLe: "2026-09-10T12:00:00.000Z", statut: "terminee", formulationLabel: "Formule A",
  formulationId: "r1", categorie: "RPC", recetteIndex: 0, tolerancePct: 2,
  composants: [{ cle: "liant", label: "Liant", cibleKg: 5, peseeKg: 5.4 }, { cle: "eau", label: "Eau", cibleKg: 20 }],
  ajustements: [{ id: "a1", type: "eau", masseKg: 0.5, note: "trop sec" }],
  lotLiant: "L-42", observations: "Pâte homogène.",
  protocolesSnapshot: [{ titre: "Malaxage", contenu: "5 min" }],
  eprouvettes: [
    { id: "e1", code: "G-20260910-01-E01", couleLe: "2026-09-10T12:00:00.000Z", ageJours: 7, statut: "ecrase",
      essai: { date: "2026-09-17T16:00:00.000Z", contrainteKpaSaisie: 410, modeRupture: "cône" } },
    { id: "e2", code: "G-20260910-01-E02", couleLe: "2026-09-10T12:00:00.000Z", ageJours: 7, statut: "ecrase",
      essai: { contrainteKpaSaisie: 900, exclu: true, justificationExclusion: "fissure au démoulage",
        sourcePresse: { fichier: "presse.xlsx", echantillon: "S2", importeLe: "2026-09-17T16:00:00.000Z" }, moduleYoungKpa: 52000, tempsDeCureReelJours: 8 } },
    { id: "e3", code: "G-20260910-01-E03", couleLe: "2026-09-10T12:00:00.000Z", ageJours: 28, statut: "en_cure" },
  ],
};
const ligne = (kind: "resultat" | "gachee", contenu: { id: string }): LigneClasse =>
  ({ proprietaire: A, kind, id: contenu.id, rev: 7, maj: "2026-09-18T10:00:00.000000+00:00", cree: "x", supprime: false, contenu });
const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const maintenant = new Date(2026, 8, 29, 9);
const PROF = "pppppppp-0000-4000-8000-00000000000f";
const annotations: LigneAnnotation[] = [
  { id: "n1", owner_id: A, auteur_id: PROF, target_kind: "gachee", target_id: "g1", target_rev: 7, ancre: "G-20260910-01-E02",
    texte: "Pourquoi exclue ?", deleted: false, created_at: "2026-09-19T10:00:00Z", updated_at: "2026-09-20T08:00:00Z", lu_le: "2026-09-20T08:00:00Z" },
  { id: "n2", owner_id: A, auteur_id: A, target_kind: "gachee", target_id: "g1", target_rev: 7, ancre: null,
    texte: "Fissure au démoulage.", deleted: false, created_at: "2026-09-20T09:00:00Z", updated_at: "2026-09-20T09:00:00Z", lu_le: null },
  { id: "n3", owner_id: A, auteur_id: "autre-prof", target_kind: "gachee", target_id: "g1", target_rev: 7, ancre: null,
    texte: "Voir aussi E01.", deleted: false, created_at: "2026-09-21T09:00:00Z", updated_at: "2026-09-21T09:00:00Z", lu_le: null },
];
const ctx = { moi: PROF, nouvelles: new Set(["n2"]), onLire: () => {}, onRetirer: async () => {} };

describe("vues de l'enseignant — rendu", () => {
  const etudiants = regrouper([ligne("resultat", resultat), ligne("gachee", gachee)], profils, [], "toutes");

  it("gâchée intégrale : pesées, éprouvettes, exclusion, presse, synthèse, protocole", () => {
    const html = rendu(createElement(GacheeLecture, {
      gachee: etudiants[0].gachees[0], maintenant,
      formulations: [{ id: "r1", recipes: [recette] as never }],
    }));
    expect(html).toContain("hors tolérance"); // liant +8 %
    expect(html).toContain("G-20260910-01-E02");
    expect(html).toContain("fissure au démoulage");
    expect(html).toContain("presse.xlsx");
    expect(html).toContain("trop sec");
    expect(html).toContain("Malaxage");
    expect(html).toContain("410"); // seule la valeur retenue entre dans la moyenne à 7 j
    expect(html).toContain("7 j"); // âge réel de E01 (coulée le 10, écrasée le 17)
  });

  it("gâchée intégrale : fiche d'essai (matériaux, cure, conditions de l'essai, complétude)", () => {
    const fiche = {
      ...gachee, id: "gf",
      materiaux: { residu: { nom: "Résidus LaRonde", gs: 3.1 }, liants: [{ code: "CP10", nom: "Ciment GU", fractionPct: 80 }], eau: { type: "procede" } },
      cure: { mode: "chambre_humide", temperatureC: 23 }, malaxageDureeMin: 5,
      eprouvettes: [{ ...gachee.eprouvettes[0], mouleDiametreMm: 50, mouleHauteurMm: 100,
        essai: { ...gachee.eprouvettes[0].essai, masseG: 412.5, vitesseChargement: { valeur: 1, unite: "mm/min" }, modeRuptureCode: "cone" } }],
    };
    const [e] = regrouper([ligne("gachee", fiche)], profils, [], "toutes");
    const html = rendu(createElement(GacheeLecture, { gachee: e.gachees[0], maintenant, formulations: [] }));
    expect(html).toContain("Fiche : ");
    expect(html).toContain("Résidus LaRonde · Gs 3,1");
    expect(html).toContain("Ciment GU 80 %");
    expect(html).toContain("Eau de procédé");
    expect(html).toContain("Chambre humide");
    expect(html).toContain("Cylindre 50 × 100 mm");
    expect(html).toContain("1 mm/min");
    expect(html).toContain("Cônes aux deux extrémités : cône");
    expect(html).toContain("Non renseigné : ");
  });

  it("matériau absent du catalogue officiel : proposé à l'ajout (sans Gs, bouton désactivé)", () => {
    const catalogue = {
      residus: [{ id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, origine: "officiel" as const }],
      granulats: [], onAjouter: () => {},
    };
    const vue = (residu: Record<string, unknown>) => {
      const doc = { ...gachee, id: "gm", materiaux: { residu } };
      const [e] = regrouper([ligne("gachee", doc)], profils, [], "toutes");
      return rendu(createElement(GacheeLecture, { gachee: e.gachees[0], maintenant, formulations: [], catalogue }));
    };
    const inconnu = vue({ nom: "Résidus Goldex", gs: 2.9 });
    expect(inconnu).toContain("n&#x27;est pas dans le catalogue officiel");
    expect(inconnu).toMatch(/<button type="button" class="btn-discret"[^>]*>Ajouter au catalogue officiel<\/button>/);
    expect(vue({ nom: "résidus laronde", gs: 3.1 })).not.toContain("Ajouter au catalogue officiel"); // même nom
    expect(vue({ id: "res_laronde", nom: "LaRonde (lot 3)", gs: 3.1 })).not.toContain("Ajouter au catalogue officiel"); // même id
    expect(vue({ nom: "Sans Gs" })).toMatch(/<button[^>]*disabled=""[^>]*>Ajouter au catalogue officiel/);
    // Sans catalogue (autres usages de la vue) : rien n'est proposé.
    const sansCatalogue = { ...gachee, id: "gn", materiaux: { residu: { nom: "Résidus Goldex", gs: 2.9 } } };
    const [e] = regrouper([ligne("gachee", sansCatalogue)], profils, [], "toutes");
    expect(rendu(createElement(GacheeLecture, { gachee: e.gachees[0], maintenant, formulations: [] }))).not.toContain("catalogue officiel");
  });

  it("gâchée allégée ou très ancienne : aucun tableau manquant ne fait planter", () => {
    const [e] = regrouper([ligne("gachee", { id: "gx", code: "G-X", creeLe: "2026-09-01T12:00:00Z", categorie: "RPC" } as never)], profils, [], "toutes");
    const html = rendu(createElement(GacheeLecture, { gachee: e.gachees[0], maintenant, formulations: [] }));
    expect(html).toContain("Aucune pesée enregistrée");
    expect(html).toContain("Paramètres de formulation inconnus");
  });

  it("résultat intégral : sections du rapport et exports", () => {
    const html = rendu(createElement(ResultatLecture, { resultat: resultat as never, units: DEFAULT_UNITS }));
    expect(html).toContain("Recette 1");
    expect(html).toContain("Feuille labo");
    expect(html).toContain("Opérateur");
  });

  it("vue document : en-tête, document supprimé, commentaires", () => {
    const pret = rendu(createElement(VueDocument, {
      doc: { ref: { etudiantId: A, kind: "gachee", id: "g1" }, etat: "pret", doc: { contenu: gachee, rev: 7, maj: "2026-09-18T10:00:00Z", supprime: false } },
      etudiant: etudiants[0], annotations, onAnnoter: async () => true, ctx, onRetour: () => {}, maintenant, units: DEFAULT_UNITS,
    }));
    expect(pret).toContain("Alice Tremblay");
    expect(pret).toContain("Pourquoi exclue ?");
    // Fil : réponse de l'étudiante en évidence, « vu » sur le commentaire lu, « Retirer » sur SES messages seulement.
    expect(pret).toContain("Fissure au démoulage.");
    expect(pret).toContain("nouvelle réponse");
    expect(pret).toContain("vu par l&#x27;étudiant le");
    expect(pret).toContain("pas encore vu");
    expect(pret).toContain("Autre enseignant");
    expect(pret.match(/>Retirer</g)).toHaveLength(1);
    const supprime = rendu(createElement(VueDocument, {
      doc: { ref: { etudiantId: A, kind: "resultat", id: "r9" }, etat: "absent" },
      etudiant: etudiants[0], annotations: [], onAnnoter: async () => true, ctx, onRetour: () => {}, maintenant, units: DEFAULT_UNITS,
    }));
    expect(supprime).toContain("n&#x27;existe plus en ligne");
  });

  it("tableau, détail et figure de la classe", () => {
    const couleurDe = new Map([[A, "#2563eb"]]);
    const tableau = rendu(createElement(TableauEtudiants, { etudiants, annotations, selId: null, onChoisir: () => {}, couleurDe, alertesParEtudiant: new Map([[A, 2]]) }));
    expect(tableau).toContain("Essais valides");
    expect(tableau).toMatch(/<td[^>]*>1<\/td>/); // un seul essai valide (E02 est exclue)
    expect(tableau).toContain("1 réponse non lue");
    const detail = rendu(createElement(DetailEtudiant, { etudiant: etudiants[0], annotations, lignes: [], onAnnoter: async () => true, ctx, onOuvrir: () => {} }));
    expect(detail).toContain("Ouvrir");
    expect(detail).toContain("Commentaires (3 · 1 nouvelle réponse)"); // fil replié
    expect(detail).toContain("1/3 essai(s) valide(s)");
    expect(rendu(createElement(FigureClasse, { etudiants, couleurDe }))).toContain("UCS mesurée de la classe");
  });

  it("comparaison : une ligne par gâchée, repère étiqueté, sinon message", () => {
    const B = "bbbbbbbb-0000-4000-8000-000000000002";
    const g2 = { ...gachee, id: "g2", code: "G-20260911-01", parametres: { cwPct: 75.2, bwPct: 5 }, eprouvettes: [{ ...gachee.eprouvettes[0], id: "x1", code: "G-20260911-01-E01", essai: { contrainteKpaSaisie: 500 } }] };
    const classe = regrouper([ligne("resultat", resultat), ligne("gachee", gachee), { ...ligne("gachee", g2), proprietaire: B }],
      [...profils, { id: B, email: null, display_name: "Bruno", role: "etudiant" }], [], "toutes");
    const html = rendu(createElement(OngletComparaison, { comparaison: comparerClasse(classe), onOuvrir: () => {} }));
    expect(html).toContain("RPC · Cw 75 % · Bw 5 %");
    expect(html).toContain("G-20260911-01");
    expect(html).toContain("pas de repère de dispersion");
    const vide = rendu(createElement(OngletComparaison, { comparaison: comparerClasse(etudiants), onOuvrir: () => {} }));
    expect(vide).toContain("au moins deux étudiants");
  });

  it("alertes : groupées par étudiant, seuils affichés ; aucune : message", () => {
    const a = alertesClasse(etudiants, { maintenant: new Date(2026, 10, 20), comparaison: comparerClasse(etudiants), sessionActiveAffichee: false });
    const html = rendu(createElement(CarteAlertes, { alertes: a, onOuvrir: () => {} }));
    expect(html).toContain("À surveiller (");
    expect(html).toContain("Écrasement en retard"); // E03 (28 j) attendue le 8 octobre
    expect(html).toContain("Pesée hors tolérance");
    expect(html).toContain("valeurs par défaut, à valider");
    expect(rendu(createElement(CarteAlertes, { alertes: [], onOuvrir: () => {} }))).toContain("Rien à signaler");
  });

  it("échéancier : sections, éprouvette en cure listée avec l'étudiant", () => {
    const html = rendu(createElement(OngletEcheancier, { echeances: echeancierClasse(etudiants, maintenant), onOuvrir: () => {}, onIcs: () => {}, onCsv: () => {} }));
    expect(html).toContain("En retard (0)");
    expect(html).toContain("Plus tard (1)"); // E03 attendue le 8 octobre, dans 9 j
    expect(html).toContain("G-20260910-01-E03");
    expect(html).toContain("Alice Tremblay");
  });
});
