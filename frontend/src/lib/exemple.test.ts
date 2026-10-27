import { beforeEach, describe, expect, it } from "vitest";

// Environnement node : window + localStorage en mémoire, comme
// store-persistence.test.ts, AVANT d'exercer l'action du store.
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
import { parametresVolume, volumeHorsLabo, volumeMouleM3, volumeTotalM3 } from "./contenant";
import { ANCIENS_NOMS_LIANTS_EXEMPLE, CONFIRMATION_EXEMPLE, NOMS_LIANTS_EXEMPLE } from "./exemple";

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  const s = useStore.getState();
  s.loadCatalogue();
  void s.loadGeneral();
  useStore.setState({ binderPrices: [], category: "RPC", method: "dosage_cw" });
});

describe("exemple complet à l'échelle du laboratoire (2026-10-26)", () => {
  it("moule cylindrique 76,2 × 152,4 mm, 9 moules, κ = 1,1 : environ 6,9 L par recette", () => {
    useStore.getState().fillTestData();
    const s = useStore.getState();
    expect(s.general.container_type).toBe("rayon_hauteur");
    const vMoule = volumeMouleM3(s.general);
    expect(vMoule).toBeCloseTo(Math.PI * 0.0381 ** 2 * 0.1524, 12);
    for (const methode of ["dosage_cw", "wb", "slump"]) {
      const p = parametresVolume({ ...s, category: "RPC", method: methode } as never)!;
      expect(p).toEqual({ moules: 9, kappa: 1.1 });
      const vt = volumeTotalM3(vMoule, p.moules, p.kappa)!;
      expect(vt * 1000).toBeCloseTo(6.88, 2);
      expect(volumeHorsLabo(vt)).toBe(false);
    }
    expect(s.rpgCw.desired_qty).toBe(9);
    expect(s.rpgWb.safety_factor).toBe(1.1);
  });

  it("rapports inchangés : ceux des tests d'or (Cw 70, Bw 4,5 %, Gs 3,05)", () => {
    useStore.getState().fillTestData();
    const s = useStore.getState();
    expect(s.cw.solid_mass_pct).toBe(70);
    expect(s.cw.binder_pct[0]).toBe(4.5);
    expect(s.cw.residue_sg).toBe(3.05);
  });

  it("aucun nom de classeur dans le projet ni dans les liants ajoutés", () => {
    useStore.getState().fillTestData();
    const s = useStore.getState();
    const textes = [s.general.operator_name, s.general.project_name, s.general.residue_id, ...s.catalogue_liants.map((l) => l.nom)];
    for (const t of textes) expect(t ?? "").not.toMatch(/Intra|classeur|feuille/i);
    expect(s.catalogue_liants.find((l) => l.code === "GU")?.nom).toBe(NOMS_LIANTS_EXEMPLE.GU);
    expect(CONFIRMATION_EXEMPLE).not.toMatch(/Intra|classeur|11 000/);
  });

  it("ancien nom de l'exemple renommé ; nom choisi par l'utilisateur gardé", () => {
    useStore.setState({
      catalogue_liants: [
        { id: "liant_gu", code: "GU", nom: ANCIENS_NOMS_LIANTS_EXEMPLE.GU, gs: 3.15 },
        { id: "liant_ggbfs", code: "GGBFS", nom: "Mon laitier", gs: 2.9 },
      ],
    });
    useStore.getState().fillTestData();
    const liants = useStore.getState().catalogue_liants;
    expect(liants.find((l) => l.code === "GU")?.nom).toBe(NOMS_LIANTS_EXEMPLE.GU);
    expect(liants.find((l) => l.code === "GGBFS")?.nom).toBe("Mon laitier");
    expect(liants.filter((l) => l.code === "GU")).toHaveLength(1);
  });
});
