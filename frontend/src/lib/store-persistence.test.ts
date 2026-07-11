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
    // Drapeaux complétés aux défauts intra2017, pack DÉTECTÉ (valeurs = pack).
    expect(c.essai_gs_convention).toBe("base");
    expect(c.essai_binder_rule).toBe("solides_totaux");
    expect(c.pack_id).toBe("intra2017");
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
    // Part du pack intra2017 (défauts).
    useStore.getState().loadConstantes();
    expect(useStore.getState().constantes.pack_id).toBe("intra2017");
    // Dévie…
    useStore.getState().setConstantes({ gravite_m_s2: 9.79 });
    expect(useStore.getState().constantes.pack_id).toBe("personnalise");
    // …puis revient exactement à la valeur du pack : re-détecté.
    useStore.getState().setConstantes({ gravite_m_s2: 9.81 });
    expect(useStore.getState().constantes.pack_id).toBe("intra2017");
  });

  it("retaper la même valeur (édition sans effet) conserve l'étiquette du pack", () => {
    useStore.getState().loadConstantes();
    useStore.getState().setConstantes({ gravite_m_s2: 9.81 }); // no-op
    expect(useStore.getState().constantes.pack_id).toBe("intra2017");
  });
});
