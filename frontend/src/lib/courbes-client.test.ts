import { beforeEach, describe, expect, it } from "vitest";
import { creerMagasinMemoire, encoderCourbe } from "./courbes";
import {
  balayerCourbesOrphelines, chargerEtatCourbes, marquerCourbeEnLigne, sauverEtatCourbes, SYNC_COURBES_KEY,
} from "./courbes-client";

// Environnement node : window + localStorage en mémoire (comme store-persistence.test.ts).
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

const X = "2026-10-01T10:00:00.000Z";

describe("état d'envoi des courbes : un par compte (version 2)", () => {
  it("v1 lu : compte repris, anciennes entrées (par éprouvette) abandonnées sans erreur", () => {
    localStorage.setItem(SYNC_COURBES_KEY, JSON.stringify({ v: 1, data: {
      v: 1, uid: "u1", envoyees: { e1: { rev: 7, signature: "x|2" } }, bloquees: { e2: "x|2" },
    } }));
    expect(chargerEtatCourbes("u1")).toEqual({ envoyees: {}, bloquees: {} });
    expect(chargerEtatCourbes("u2")).toEqual({ envoyees: {}, bloquees: {} });
  });

  it("v2 : relu tel quel ; chaque compte garde le sien ; clé illisible : état vide", () => {
    expect(sauverEtatCourbes("u1", { envoyees: { [`e1:${X}`]: { rev: 7 } }, bloquees: {} })).toBe(true);
    sauverEtatCourbes("u2", { envoyees: {}, bloquees: { [`e9:${X}`]: "53400" } });
    expect(chargerEtatCourbes("u1")).toEqual({ envoyees: { [`e1:${X}`]: { rev: 7 } }, bloquees: {} });
    expect(chargerEtatCourbes("u2").bloquees).toEqual({ [`e9:${X}`]: "53400" });
    expect(JSON.parse(localStorage.getItem(SYNC_COURBES_KEY)!).v).toBe(2);
    marquerCourbeEnLigne("u2", `e3:${X}`, 12);
    expect(chargerEtatCourbes("u2").envoyees).toEqual({ [`e3:${X}`]: { rev: 12 } });
    expect(chargerEtatCourbes("u1").envoyees).toEqual({ [`e1:${X}`]: { rev: 7 } });
    localStorage.setItem(SYNC_COURBES_KEY, "{pas du json");
    expect(chargerEtatCourbes("u1")).toEqual({ envoyees: {}, bloquees: {} });
    localStorage.setItem(SYNC_COURBES_KEY, JSON.stringify({ v: 2, data: { comptes: { u1: { envoyees: null } } } }));
    expect(chargerEtatCourbes("u1")).toEqual({ envoyees: {}, bloquees: {} });
  });
});

describe("balayage des courbes orphelines", () => {
  const gachee = (courbeInfo: Record<string, unknown>) => ({
    id: "g1", code: "G", creeLe: "x", statut: "terminee", formulationLabel: "M", categorie: "RPC", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [],
    eprouvettes: [{ id: "e1", code: "E1", couleLe: "x", ageJours: 7, statut: "ecrase", essai: { sourcePresse: { fichier: "p", echantillon: "1", importeLe: X }, courbeInfo } }],
  });
  const c = encoderCourbe([{ tempsS: 0, chargeN: 0, deplacementMm: 0, contrainteKpa: 0, deformationPct: 0 }]);

  it("retire ce qu'aucune gâchée ne désigne (ancienne clé après réimport), garde le reste", async () => {
    const m = creerMagasinMemoire();
    await m.ecrire([[`e1:${X}`, c], ["e1", c], ["perdue", c]]);
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee({ nbPoints: 1, importeLe: X })] }));
    expect(await balayerCourbesOrphelines(m)).toBe(2);
    expect([...m.contenu.keys()]).toEqual([`e1:${X}`]);
  });

  it("prudent : stockage illisible ou migration en échec (liste vide pour des données présentes) : rien n'est effacé", async () => {
    const m = creerMagasinMemoire();
    await m.ecrire([[`e1:${X}`, c]]);
    expect(await balayerCourbesOrphelines(m)).toBe(0); // clé absente
    localStorage.setItem("minebackfill_gachees", "{illisible");
    expect(await balayerCourbesOrphelines(m)).toBe(0);
    // Migration en échec : la lecture versionnée rend [] (loadVersioned avale
    // l'exception) alors que le brut a des gâchées. Ce vide ne prouve rien.
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee({ nbPoints: 1, importeLe: X })] }));
    const getItem = localStorage.getItem.bind(localStorage);
    let appels = 0;
    (localStorage as unknown as { getItem: (k: string) => string | null }).getItem = (k: string) => {
      if (k !== "minebackfill_gachees") return getItem(k);
      appels++;
      return appels === 1 ? getItem(k) : "{brisé"; // la seconde lecture (versionnée) échoue
    };
    expect(await balayerCourbesOrphelines(m)).toBe(0);
    expect([...m.contenu.keys()]).toEqual([`e1:${X}`]);
    // Travail d'un autre compte mis de côté, illisible : prudence aussi.
    (localStorage as unknown as { getItem: (k: string) => string | null }).getItem = getItem;
    localStorage.setItem("minebackfill_compte_u2", "{brisé");
    await m.ecrire([["perdue", c]]);
    expect(await balayerCourbesOrphelines(m)).toBe(0);
  });
});
