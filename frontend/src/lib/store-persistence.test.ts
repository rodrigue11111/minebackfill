import { beforeEach, describe, expect, it } from "vitest";

// Environnement node : on fournit window + localStorage en mémoire AVANT
// d'exercer les actions du store (les helpers sont SSR-safe via `typeof window`).
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

import { useStore } from "./store";
import { chargerEtatSync, sauverEtatSync } from "./sync-etat";
import { etatInitial } from "./sync-moteur";

function resetTout() {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  const s = useStore.getState();
  // Repartir des valeurs par défaut du stockage (vide) pour chaque test.
  s.loadCatalogue();
  s.loadConstantes();
  void s.loadGeneral();
  useStore.setState({
    savedResults: [],
    binderPrices: [],
    category: "RPC",
    method: "dosage_cw",
    cwResult: null,
    rrcResult: null,
  });
}

beforeEach(resetTout);

function seedResultatRpc() {
  useStore.setState({
    category: "RPC",
    method: "dosage_cw",
    cwResult: { category: "RPC", method: "dosage_cw", recipes: [{ bw_mass_pct: 4.5 }] },
  });
}

describe("store — régression écrasement d'historique (P0.1)", () => {
  it("sauvegarder en session fraîche n'efface pas l'historique existant", () => {
    seedResultatRpc();
    expect(useStore.getState().saveCurrentResult("A")).toBe(true);

    // Simule une session fraîche : la mémoire est vide mais le stockage a « A ».
    useStore.setState({ savedResults: [] });
    seedResultatRpc();
    expect(useStore.getState().saveCurrentResult("B")).toBe(true);

    useStore.getState().loadSavedResults();
    const labels = useStore.getState().savedResults.map((r) => r.label);
    expect(labels).toContain("A");
    expect(labels).toContain("B");
    expect(labels.length).toBe(2);
  });

  it("pas de doublon d'id lors de la fusion", () => {
    seedResultatRpc();
    useStore.getState().saveCurrentResult("A");
    useStore.getState().loadSavedResults();
    const ids = useStore.getState().savedResults.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("store — persistance des réglages (P0.2)", () => {
  it("un liant ajouté survit au rechargement", () => {
    const avant = useStore.getState().catalogue_liants.length;
    useStore.getState().ajouterLiant();
    expect(useStore.getState().catalogue_liants.length).toBe(avant + 1);

    // Vider la mémoire, recharger depuis le stockage.
    useStore.setState({ catalogue_liants: [] });
    useStore.getState().loadCatalogue();
    expect(useStore.getState().catalogue_liants.length).toBe(avant + 1);
  });

  it("une constante modifiée survit au rechargement", () => {
    useStore.getState().setConstantes({ gravite_m_s2: 9.9 });
    useStore.setState({ constantes: { ...useStore.getState().constantes, gravite_m_s2: 0 } });
    useStore.getState().loadConstantes();
    expect(useStore.getState().constantes.gravite_m_s2).toBe(9.9);
  });

  it("une constante persistée à 0 (champ vidé) revient au défaut au rechargement", () => {
    // Vider un champ dans Réglages persiste 0 ; sans assainissement, tous les
    // calculs resteraient durablement en erreur (rho_eau = 0 -> 422).
    useStore.getState().setConstantes({ masse_volumique_eau_kg_m3: 0 });
    useStore.getState().loadConstantes();
    expect(useStore.getState().constantes.masse_volumique_eau_kg_m3).toBe(1000.0);
    // Les autres constantes valides ne sont pas touchées.
    useStore.getState().setConstantes({ gravite_m_s2: 9.9, coefficient_modele_slump: 0 });
    useStore.getState().loadConstantes();
    expect(useStore.getState().constantes.gravite_m_s2).toBe(9.9);
    expect(useStore.getState().constantes.coefficient_modele_slump).toBe(4.95e6);
  });

  it("les infos générales survivent au rechargement", async () => {
    useStore.getState().setGeneral({ project_name: "Projet Test" });
    useStore.setState({ general: { ...useStore.getState().general, project_name: null } });
    await useStore.getState().loadGeneral();
    expect(useStore.getState().general.project_name).toBe("Projet Test");
  });
});

describe("store — instantané par résultat (P0.3)", () => {
  it("le résultat sauvegardé embarque catalogue et constantes", () => {
    useStore.getState().setConstantes({ gravite_m_s2: 9.7 });
    seedResultatRpc();
    useStore.getState().saveCurrentResult("Snap");
    const entry = useStore.getState().savedResults[0];
    expect(entry.constantes?.gravite_m_s2).toBe(9.7);
    expect(entry.catalogue_liants?.length).toBeGreaterThan(0);
  });
});

describe("store — RRC sauvegardable/restaurable (P0.4)", () => {
  it("sauvegarde puis restauration d'un résultat RRC", () => {
    useStore.setState({
      category: "RRC",
      rrc: { ...useStore.getState().rrc, volume_m3: 1234 },
      rrcResult: { recipes: [{ bw_mass_pct: 5, wc_ratio: 1 }] },
    });
    expect(useStore.getState().saveCurrentResult("RRC 1")).toBe(true);

    const entry = useStore.getState().savedResults[0];
    expect(entry.category).toBe("RRC");
    expect(entry.method).toBe("rrc");
    expect(entry.rrc?.inputs.volume_m3).toBe(1234);
    expect(entry.rrc?.result.recipes.length).toBe(1);

    // Changer l'état, puis restaurer.
    useStore.setState({
      category: "RPC",
      rrc: { ...useStore.getState().rrc, volume_m3: 0 },
      rrcResult: null,
    });
    expect(useStore.getState().restoreSavedResult(entry.id)).toBe(true);
    expect(useStore.getState().category).toBe("RRC");
    expect(useStore.getState().rrc.volume_m3).toBe(1234);
    expect(useStore.getState().rrcResult?.recipes.length).toBe(1);
  });
});

describe("store — constantes pré-P4 complétées (revue P3-P5)", () => {
  it("restaurer un snapshot pré-P4 (sans drapeaux) complète pack/drapeaux", () => {
    seedResultatRpc();
    expect(useStore.getState().saveCurrentResult("avec drapeaux")).toBe(true);
    const entry = useStore.getState().savedResults[0];
    // Simule un snapshot d'AVANT P4 : seulement les 5 nombres (défauts).
    const ancien = {
      ...entry,
      id: "sr_ancien_prep4",
      constantes: {
        masse_volumique_eau_kg_m3: 1000.0,
        gravite_m_s2: 9.81,
        facteur_petit_cone_vers_grand_cone: 2.335,
        coefficient_modele_slump: 4.95e6,
        constante_modele_slump: 235.5122,
      },
    } as unknown as (typeof entry);
    useStore.setState({ savedResults: [ancien, entry] });

    expect(useStore.getState().restoreSavedResult("sr_ancien_prep4")).toBe(true);
    const c = useStore.getState().constantes;
    // Drapeaux complétés : la feuille gramme, seule convention de l'application.
    expect(c.essai_gs_convention).toBe("base");
    expect(c.essai_binder_rule).toBe("residu_ajoute");
    expect(c.pack_id).toBe("gramme");
  });

  it("un snapshot pré-P4 PERSONNALISÉ est détecté « personnalise », pas « intra2017 »", () => {
    seedResultatRpc();
    expect(useStore.getState().saveCurrentResult("x")).toBe(true);
    const entry = useStore.getState().savedResults[0];
    const ancien = {
      ...entry,
      id: "sr_ancien_custom",
      constantes: {
        masse_volumique_eau_kg_m3: 998.2, // personnalisé
        gravite_m_s2: 9.79,
        facteur_petit_cone_vers_grand_cone: 2.335,
        coefficient_modele_slump: 4.95e6,
        constante_modele_slump: 235.5122,
      },
    } as unknown as (typeof entry);
    useStore.setState({ savedResults: [ancien] });

    expect(useStore.getState().restoreSavedResult("sr_ancien_custom")).toBe(true);
    const c = useStore.getState().constantes;
    expect(c.masse_volumique_eau_kg_m3).toBe(998.2); // valeurs du snapshot gardées
    expect(c.pack_id).toBe("personnalise");          // pas de fausse étiquette
  });

  it("chargement v1 (pré-P4) avec nombres personnalisés -> pack « personnalise »", () => {
    // Écrit une enveloppe v1 telle qu'avant P4 (5 nombres seulement, custom).
    localStorage.setItem("minebackfill_constantes", JSON.stringify({
      v: 1,
      data: {
        masse_volumique_eau_kg_m3: 1000.0,
        gravite_m_s2: 9.5, // personnalisé
        facteur_petit_cone_vers_grand_cone: 2.335,
        coefficient_modele_slump: 4.95e6,
        constante_modele_slump: 235.5122,
      },
    }));
    useStore.getState().loadConstantes();
    const c = useStore.getState().constantes;
    expect(c.gravite_m_s2).toBe(9.5);
    expect(c.pack_id).toBe("personnalise");
  });
});

describe("store — détection de pack dans setConstantes (revue P4)", () => {
  it("éditer un nombre puis revenir à la valeur du pack ne colle pas « personnalise »", () => {
    // Part de la feuille gramme (défauts).
    useStore.getState().loadConstantes();
    expect(useStore.getState().constantes.pack_id).toBe("gramme");
    // Dévie…
    useStore.getState().setConstantes({ gravite_m_s2: 9.79 });
    expect(useStore.getState().constantes.pack_id).toBe("personnalise");
    // …puis revient exactement à la valeur du pack : re-détecté.
    useStore.getState().setConstantes({ gravite_m_s2: 9.81 });
    expect(useStore.getState().constantes.pack_id).toBe("gramme");
  });

  it("retaper la même valeur (édition sans effet) conserve l'étiquette du pack", () => {
    useStore.getState().loadConstantes();
    useStore.getState().setConstantes({ gravite_m_s2: 9.81 }); // no-op
    expect(useStore.getState().constantes.pack_id).toBe("gramme");
  });
});

describe("store — la feuille gramme est la seule convention (2026-09-29)", () => {
  it("des réglages enregistrés sous la feuille tonne passent à la règle gramme au chargement", () => {
    localStorage.setItem("minebackfill_constantes", JSON.stringify({ v: 2, data: {
      masse_volumique_eau_kg_m3: 1000.0, gravite_m_s2: 9.81, facteur_petit_cone_vers_grand_cone: 2.335,
      coefficient_modele_slump: 4.95e6, constante_modele_slump: 235.5122,
      essai_gs_convention: "base", essai_binder_rule: "solides_totaux", pack_id: "intra2017",
    } }));
    useStore.getState().loadConstantes();
    const c = useStore.getState().constantes;
    expect(c.essai_binder_rule).toBe("residu_ajoute");
    expect(c.pack_id).toBe("gramme");
  });

  it("aucune modification ne remet la règle de la feuille tonne", () => {
    useStore.getState().loadConstantes();
    useStore.getState().setConstantes({ essai_binder_rule: "solides_totaux", pack_id: "intra2017" });
    expect(useStore.getState().constantes.essai_binder_rule).toBe("residu_ajoute");
    expect(useStore.getState().constantes.pack_id).toBe("gramme");
  });
});

describe("store — gâchées et protocoles (persistance labo)", () => {
  // Ces deux clés n'avaient AUCUN test de persistance : elles sont pourtant
  // les seules à porter des mesures irremplaçables (essais UCS), et elles
  // étaient absentes de backup.ts jusqu'au schéma 4.

  function gacheeAvecEssai() {
    return {
      id: "g1", code: "G-20260927-01", creeLe: "2026-09-27T12:00:00.000Z",
      statut: "terminee" as const,
      formulationLabel: "Mélange 1", categorie: "RPC", recetteIndex: 0,
      composants: [], tolerancePct: 2, ajustements: [],
      eprouvettes: [{
        id: "e1", code: "G-20260927-01-E01", couleLe: "2026-09-27T12:00:00.000Z",
        ageJours: 28, statut: "ecrase" as const,
        essai: { date: "2026-10-25T12:00:00.000Z", chargeKn: 2.5, diametreMm: 50 },
      }],
    };
  }

  it("une gâchée avec éprouvette et essai UCS survit au rechargement", () => {
    const s = useStore.getState();
    s.ajouterGachee(gacheeAvecEssai());
    useStore.setState({ gachees: [] });
    useStore.getState().loadGachees();
    const g = useStore.getState().gachees;
    expect(g).toHaveLength(1);
    expect(g[0].eprouvettes[0].essai?.chargeKn).toBe(2.5);
    expect(g[0].eprouvettes[0].ageJours).toBe(28);
  });

  it("une gâchée v1 (sans registre d'éprouvettes) est migrée vers []", () => {
    // v1 = avant la phase 2 du labo. migrerGachees doit poser le tableau vide
    // plutôt que de laisser `undefined`, qui ferait planter agregerParAge.
    localStorage.setItem(
      "minebackfill_gachees",
      JSON.stringify({ v: 1, data: [{ id: "vieille", code: "G-1", statut: "terminee" }] }),
    );
    useStore.getState().loadGachees();
    const g = useStore.getState().gachees;
    expect(g).toHaveLength(1);
    expect(g[0].eprouvettes).toEqual([]);
  });

  it("les protocoles absents sont semés avec les procédures par défaut", () => {
    useStore.getState().loadProtocoles();
    const p = useStore.getState().protocoles;
    expect(p.length).toBeGreaterThan(0);
    expect(p.map((x) => x.id)).toContain("essai-ucs");
  });

  it("une édition de protocole survit au rechargement", () => {
    useStore.getState().loadProtocoles();
    const id = useStore.getState().protocoles[0].id;
    useStore.getState().modifierProtocole(id, { contenu: "Procédure révisée 2026." });
    useStore.setState({ protocoles: [] });
    useStore.getState().loadProtocoles();
    expect(useStore.getState().protocoles.find((x) => x.id === id)?.contenu)
      .toBe("Procédure révisée 2026.");
  });
});

describe("store — suppressions transmises à la synchronisation v2", () => {
  it("compte lié : supprimer un résultat ou une gâchée pose une suppression explicite", () => {
    sauverEtatSync({ ...etatInitial(), uid: "u1" });
    seedResultatRpc();
    useStore.getState().saveCurrentResult("A");
    const id = useStore.getState().savedResults[0].id;
    useStore.getState().deleteSavedResult(id);
    useStore.getState().ajouterGachee({ id: "g1", code: "G-1", creeLe: "x", statut: "brouillon", formulationLabel: "", categorie: "RPC", recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [], eprouvettes: [] });
    useStore.getState().supprimerGachee("g1");
    expect(chargerEtatSync().suppressions).toEqual({ [`resultat:${id}`]: true, "gachee:g1": true });
  });

  it("sans compte lié : supprimer reste purement local", () => {
    seedResultatRpc();
    useStore.getState().saveCurrentResult("A");
    useStore.getState().deleteSavedResult(useStore.getState().savedResults[0].id);
    expect(chargerEtatSync().suppressions).toEqual({});
  });
});

describe("store — sessions de cours", () => {
  it("un nouveau résultat et une nouvelle gâchée portent la session active", () => {
    const auj = new Date();
    const jour = (d: Date) => d.toISOString().slice(0, 10);
    const debut = new Date(auj.getTime() - 30 * 86400000);
    const fin = new Date(auj.getTime() + 30 * 86400000);
    useStore.getState().definirSessions([{ id: "S1", nom: "Session test", debut: jour(debut), fin: jour(fin) }]);
    seedResultatRpc();
    useStore.getState().saveCurrentResult("A");
    expect(useStore.getState().savedResults[0].sessionId).toBe("S1");
    useStore.getState().ajouterGachee({ id: "g9", code: "G-9", creeLe: auj.toISOString(), statut: "brouillon", formulationLabel: "", categorie: "RPC", recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [], eprouvettes: [] });
    expect(useStore.getState().gachees[0].sessionId).toBe("S1");
  });

  it("sans session active : aucun champ ajouté", () => {
    useStore.getState().definirSessions([]);
    seedResultatRpc();
    useStore.getState().saveCurrentResult("B");
    expect(useStore.getState().savedResults[0].sessionId).toBeUndefined();
  });
});
