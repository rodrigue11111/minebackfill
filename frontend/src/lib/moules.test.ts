import { beforeEach, describe, expect, it } from "vitest";
import {
  cylindreDe, fusionnerMoules, geometrieDe, memeGeometrie, moulesUsuels, moulesValides, nomPropose, patchMoule,
  type MouleEnregistre,
} from "./moules";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

import { loadMoulesFromStorage, useStore } from "./store";

const cyl = (id: string, rCm: number, hCm = 15.24): MouleEnregistre =>
  ({ id, nom: `Moule ${id}`, geometrie: { container_type: "rayon_hauteur", container_radius: rCm, container_height: hCm } });

describe("moules enregistrés : modèle (2026-10-26)", () => {
  it("géométrie complète : le type et ses seules dimensions ; incomplète : null", () => {
    expect(geometrieDe({ container_type: "rayon_hauteur", container_radius: 3.81, container_height: 15.24, container_length: 99 }))
      .toEqual({ container_type: "rayon_hauteur", container_radius: 3.81, container_height: 15.24 });
    expect(geometrieDe({ container_type: "rayon_hauteur", container_radius: 3.81 })).toBeNull();
    expect(geometrieDe({ container_type: "volume", container_volume_m3: 0 })).toBeNull();
    expect(geometrieDe({})).toBeNull();
  });

  it("mêmes dimensions à un millionième près, même type exigé", () => {
    expect(memeGeometrie(cyl("a", 3.81).geometrie, { container_type: "rayon_hauteur", container_radius: 3.8100000001, container_height: 15.24 })).toBe(true);
    expect(memeGeometrie(cyl("a", 3.81).geometrie, cyl("b", 3.82).geometrie)).toBe(false);
    expect(memeGeometrie(cyl("a", 3.81).geometrie, { container_type: "volume", container_volume_m3: 0.000695 })).toBe(false);
  });

  it("appliquer un moule écrit ses dimensions et vide les autres", () => {
    const p = patchMoule({ id: "p", nom: "Prisme", geometrie: { container_type: "longueur_largeur_hauteur", container_length: 10, container_width: 10, container_height: 20 } });
    expect(p).toMatchObject({ container_type: "longueur_largeur_hauteur", container_length: 10, container_width: 10, container_height: 20 });
    expect(p.container_radius).toBeUndefined();
    expect("container_radius" in p).toBe(true);
  });

  it("noms proposés par géométrie", () => {
    expect(nomPropose(cyl("a", 3.81).geometrie)).toBe("Cylindre 76,2 × 152,4 mm");
    expect(nomPropose({ container_type: "longueur_largeur_hauteur", container_length: 10, container_width: 10, container_height: 20 })).toBe("Prisme 10 × 10 × 20 cm");
    expect(nomPropose({ container_type: "section_hauteur", container_section: 45.6, container_height: 15.2 })).toBe("Section 45,6 cm² × 15,2 cm");
    expect(nomPropose({ container_type: "volume", container_volume_m3: 0.000695 })).toBe("Volume 0,695 L");
  });

  it("les trois cylindres usuels, en cm, et leur cylindre en mm pour le Labo", () => {
    const u = moulesUsuels();
    expect(u.map((m) => m.nom)).toEqual(["Cylindre 50 × 100 mm", "Cylindre 76,2 × 152,4 mm", "Cylindre 100 × 200 mm"]);
    expect(u[1].geometrie).toEqual({ container_type: "rayon_hauteur", container_radius: 3.81, container_height: 15.24 });
    expect(cylindreDe(u[1])).toEqual({ diametreMm: 76.2, hauteurMm: 152.4 });
    expect(cylindreDe({ id: "v", nom: "v", geometrie: { container_type: "volume", container_volume_m3: 0.001 } })).toBeUndefined();
  });

  it("fusion : le local gagne, les absents s'ajoutent, le mal formé est ignoré", () => {
    const f = fusionnerMoules([{ ...cyl("a", 3.81), nom: "Local" }], [{ ...cyl("a", 3.81), nom: "Fichier" }, cyl("b", 2.5), { id: "x" }, "texte"]);
    expect(f.moules.map((m) => [m.id, m.nom])).toEqual([["a", "Local"], ["b", "Moule b"]]);
    expect(f.ajoutes).toBe(1);
    expect(moulesValides("pas un tableau")).toEqual([]);
  });
});

describe("moules enregistrés : stockage, retrait sans effet sur les calculs", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
    useStore.setState({ moules: [] });
  });

  it("absence de clé : aucun moule ; enregistrer écrit l'enveloppe {v: 1, data}", () => {
    expect(loadMoulesFromStorage()).toEqual([]);
    const m = useStore.getState().enregistrerMoule("  Mon cylindre  ", cyl("x", 2.5).geometrie);
    expect(m.nom).toBe("Mon cylindre");
    const brut = JSON.parse(localStorage.getItem("minebackfill_moules")!);
    expect(brut).toEqual({ v: 1, data: [m] });
    expect(loadMoulesFromStorage()).toEqual([m]);
  });

  it("retirer un moule laisse intacts le projet, les calculs sauvegardés et les gâchées", () => {
    const s = useStore.getState();
    const m = s.enregistrerMoule("A retirer", cyl("x", 2.5).geometrie);
    s.setGeneral({ container_type: "rayon_hauteur", container_radius: 2.5, container_height: 15.24 });
    localStorage.setItem("minebackfill_saved_results", JSON.stringify([{ id: "sr1", general: { container_radius: 2.5 } }]));
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [{ id: "g1", eprouvettes: [{ id: "e1", mouleDiametreMm: 50 }] }] }));
    const avant = { general: JSON.stringify(useStore.getState().general), sr: localStorage.getItem("minebackfill_saved_results"), g: localStorage.getItem("minebackfill_gachees") };
    s.retirerMoule(m.id);
    expect(useStore.getState().moules).toEqual([]);
    expect(JSON.stringify(useStore.getState().general)).toBe(avant.general);
    expect(localStorage.getItem("minebackfill_saved_results")).toBe(avant.sr);
    expect(localStorage.getItem("minebackfill_gachees")).toBe(avant.g);
  });
});
