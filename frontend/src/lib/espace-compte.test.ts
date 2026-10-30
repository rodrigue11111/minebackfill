import { beforeEach, describe, expect, it } from "vitest";
import { basculerEspace, cleEspace, CLES_ESPACE, lireEspace, type StockageEspace } from "./espace-compte";
import { BROUILLON_KEY } from "./brouillon-calculs";
import { GENERAL_KEY, useStore } from "./store";

class MemStorage {
  private m = new Map<string, string>();
  plein = false;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.plein) throw new Error("QuotaExceededError"); this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

let ls: MemStorage;
/** Le même accès que sync-client.ts, sur le stockage en mémoire. */
const stockage = (): StockageEspace => ({
  lire: (c) => ls.getItem(c),
  ecrire: (c, v) => { try { ls.setItem(c, v); return true; } catch { return false; } },
  supprimer: (c) => ls.removeItem(c),
});

/** Ce que sync-client.ts fait au changement de compte. */
function connexion(ancien: string, nouveau: string): boolean {
  const ok = basculerEspace(stockage(), ancien, nouveau);
  if (ok) useStore.getState().rechargerEspaceDeTravail();
  return ok;
}

const brouillon = (data: unknown, v = 2) => JSON.stringify({ v, data });

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  ls = new MemStorage();
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = ls;
  useStore.getState().rechargerEspaceDeTravail();
});

describe("saisies en cours qui suivent le compte (2026-10-30)", () => {
  it("les deux clés : la page Informations et le brouillon de Calculs", () => {
    expect([...CLES_ESPACE]).toEqual(["minebackfill_general", "minebackfill_brouillon_calculs"]);
  });

  it("A saisit, B se connecte : B part de formulaires vides ; B saisit ; A revient et retrouve les siennes", () => {
    const s = useStore.getState();
    s.setGeneral({ operator_name: "Rodrigue Yougbaré", project_name: "Master 1" });
    s.setCw({ solid_mass_pct: 76, residue_sg: 2.8 });
    s.setSelectedMaterial("residueId", "res_casa_berardi");
    ls.setItem(BROUILLON_KEY, brouillon({ category: "RPC", method: "dosage_cw", etats: { cw: useStore.getState().cw } }));

    expect(connexion("uA", "uB")).toBe(true);
    let e = useStore.getState();
    expect(e.general.operator_name).toBeUndefined();
    expect(e.general.project_name).toBeUndefined();
    expect(e.cw.solid_mass_pct).toBeUndefined();
    expect(e.cw.residue_sg).toBeUndefined();
    expect(e.selectedMaterials).toEqual({});
    expect(ls.getItem(GENERAL_KEY)).toBeNull();
    expect(ls.getItem(BROUILLON_KEY)).toBeNull();

    e.setGeneral({ operator_name: "Hadi" });
    expect(connexion("uB", "uA")).toBe(true);
    e = useStore.getState();
    expect(e.general.operator_name).toBe("Rodrigue Yougbaré");
    expect(e.general.project_name).toBe("Master 1");
    expect(e.cw.solid_mass_pct).toBe(76);
    expect(e.cw.residue_sg).toBe(2.8);
    // La mise de côté de A est consommée ; celle de B attend son retour.
    expect(ls.getItem(cleEspace("uA"))).toBeNull();
    expect(lireEspace(ls.getItem(cleEspace("uB")))?.[GENERAL_KEY]).toContain("Hadi");

    expect(connexion("uA", "uB")).toBe(true);
    expect(useStore.getState().general.operator_name).toBe("Hadi");
  });

  it("même compte : rien ne bouge", () => {
    useStore.getState().setGeneral({ operator_name: "Rodrigue" });
    expect(connexion("uA", "uA")).toBe(true);
    expect(useStore.getState().general.operator_name).toBe("Rodrigue");
    expect(ls.getItem(cleEspace("uA"))).toBeNull();
  });

  it("les résultats de calcul du compte précédent s'effacent, ses empreintes aussi", () => {
    useStore.setState({ cwResult: { recipes: [] } as never, empreintesCalcul: { cwResult: "x" } });
    connexion("uA", "uB");
    expect(useStore.getState().cwResult).toBeNull();
    expect(useStore.getState().empreintesCalcul).toEqual({});
  });

  it("les moules et les bibliothèques restent communs à l'appareil", () => {
    ls.setItem("minebackfill_moules", JSON.stringify({ v: 1, data: [] }));
    ls.setItem("minebackfill_catalogue_residus", JSON.stringify({ v: 1, data: [] }));
    connexion("uA", "uB");
    expect(ls.getItem("minebackfill_moules")).not.toBeNull();
    expect(ls.getItem("minebackfill_catalogue_residus")).not.toBeNull();
  });

  it("un brouillon v1 mis de côté passe par sa migration au retour (0 = non saisi)", () => {
    ls.setItem(cleEspace("uA"), JSON.stringify({ v: 1, data: {
      [GENERAL_KEY]: null,
      [BROUILLON_KEY]: brouillon({ category: "RPC", method: "dosage_cw", etats: { cw: { solid_mass_pct: 0, residue_sg: 3.1 } } }, 1),
    } }));
    connexion("uB", "uA");
    expect(useStore.getState().cw.solid_mass_pct).toBeUndefined();
    expect(useStore.getState().cw.residue_sg).toBe(3.1);
  });

  it("stockage plein à la mise de côté : rien ne bouge, rien n'est perdu", () => {
    useStore.getState().setGeneral({ operator_name: "Rodrigue" });
    const avant = ls.getItem(GENERAL_KEY);
    ls.plein = true;
    expect(connexion("uA", "uB")).toBe(false);
    expect(ls.getItem(GENERAL_KEY)).toBe(avant);
    expect(useStore.getState().general.operator_name).toBe("Rodrigue");
  });

  it("écriture refusée en cours de route : les saisies d'avant reviennent", () => {
    ls.setItem(GENERAL_KEY, JSON.stringify({ v: 1, data: { operator_name: "A" } }));
    ls.setItem(cleEspace("uB"), JSON.stringify({ v: 1, data: { [GENERAL_KEY]: JSON.stringify({ v: 1, data: { operator_name: "B" } }), [BROUILLON_KEY]: null } }));
    let ecritures = 0;
    const s = stockage();
    const capricieux: StockageEspace = { ...s, ecrire: (c, v) => (++ecritures === 2 ? false : s.ecrire(c, v)) };
    expect(basculerEspace(capricieux, "uA", "uB")).toBe(false);
    expect(JSON.parse(ls.getItem(GENERAL_KEY)!).data.operator_name).toBe("A");
    // La mise de côté de B n'est pas consommée : il la retrouvera.
    expect(ls.getItem(cleEspace("uB"))).not.toBeNull();
  });

  it("mise de côté illisible ou d'une version inconnue : formulaires vides, et elle n'est pas effacée", () => {
    ls.setItem(cleEspace("uB"), "{pas du json");
    expect(connexion("uA", "uB")).toBe(true);
    expect(ls.getItem(cleEspace("uB"))).toBe("{pas du json");
    expect(lireEspace(JSON.stringify({ v: 2, data: {} }))).toBeNull();
    expect(lireEspace(JSON.stringify({ v: 1, data: { [GENERAL_KEY]: 12 } }))).toBeNull();
    expect(lireEspace(JSON.stringify({ v: 1, data: {} }))).toEqual({ [GENERAL_KEY]: null, [BROUILLON_KEY]: null });
  });
});
