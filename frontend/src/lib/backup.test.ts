import { afterEach, beforeEach, describe, expect, it } from "vitest";

// backup.ts n'avait aucun test jusqu'ici. Le schéma 4 ajoute les deux clés du
// laboratoire, qui sont les seules à porter des mesures irremplaçables (essais
// UCS) et les seules stockées en enveloppe versionnée {v,data} — d'où un
// chemin d'import distinct, qu'il faut couvrir.

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

import { exporterDonnees, importerDonnees } from "./backup";

type Global = Record<string, unknown>;
const g = globalThis as unknown as Global;

let texteExporte = "";
let urlOriginale: unknown;
let documentOriginal: unknown;
let blobOriginal: unknown;

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = new MemStorage();

  // L'export passe par Blob + URL.createObjectURL + <a>.click(), absents en
  // environnement node : on les remplace par le minimum qui capture le JSON.
  texteExporte = "";
  blobOriginal = g.Blob;
  urlOriginale = g.URL;
  documentOriginal = g.document;
  g.Blob = class { constructor(parts: string[]) { texteExporte = parts.join(""); } };
  g.URL = { createObjectURL: () => "blob:test", revokeObjectURL: () => {} };
  g.document = { createElement: () => ({ href: "", download: "", click() {} }) };
});

afterEach(() => {
  g.Blob = blobOriginal;
  g.URL = urlOriginale;
  g.document = documentOriginal;
});

function gachee(id: string) {
  return {
    id, code: `G-${id}`, creeLe: "2026-09-27T12:00:00.000Z", statut: "terminee",
    formulationLabel: "Mélange 1", categorie: "RPC", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [],
    eprouvettes: [{
      id: `e-${id}`, code: `G-${id}-E01`, couleLe: "2026-09-27T12:00:00.000Z",
      ageJours: 28, statut: "ecrase",
      essai: { date: "2026-10-25T12:00:00.000Z", chargeKn: 2.5, diametreMm: 50 },
    }],
  };
}

function fichier(objet: unknown): File {
  return new File([JSON.stringify(objet)], "sauvegarde.json", { type: "application/json" });
}

function exporte(): { schema: number; data: Record<string, unknown> } {
  exporterDonnees();
  return JSON.parse(texteExporte);
}

describe("backup — export du laboratoire (schéma 4)", () => {
  it("le fichier porte les gâchées et les protocoles", () => {
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee("g1")] }));
    const b = exporte();
    expect(b.schema).toBe(4);
    expect(Array.isArray(b.data.gachees)).toBe(true);
    expect((b.data.gachees as { id: string }[])[0].id).toBe("g1");
    // Les protocoles sont semés par défaut quand la clé est absente.
    expect(Array.isArray(b.data.protocoles)).toBe(true);
  });

  it("les gâchées sont écrites en tableau nu, pas en enveloppe", () => {
    // C'est le point technique du schéma 4 : lire() rendrait l'enveloppe
    // {v,data}, ce qui rendrait la fusion par id impossible à la relecture.
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee("g1")] }));
    const b = exporte();
    expect(b.data.gachees).not.toHaveProperty("v");
    expect(b.data.gachees).not.toHaveProperty("data");
  });

  it("une gâchée v1 sans éprouvettes est exportée migrée", () => {
    localStorage.setItem(
      "minebackfill_gachees",
      JSON.stringify({ v: 1, data: [{ id: "vieille", code: "G-1", statut: "terminee" }] }),
    );
    const b = exporte();
    expect((b.data.gachees as { eprouvettes: unknown[] }[])[0].eprouvettes).toEqual([]);
  });
});

describe("backup — import du laboratoire", () => {
  it("restaure une gâchée avec son essai UCS", async () => {
    const res = await importerDonnees(fichier({
      application: "MineBackfill", schema: 4, exportedAt: "2026-09-27T12:00:00.000Z",
      data: { gachees: [gachee("g1")] },
    }));
    expect(res.ok).toBe(true);
    const brut = JSON.parse(localStorage.getItem("minebackfill_gachees")!);
    expect(brut.v).toBe(2);
    expect(brut.data[0].eprouvettes[0].essai.chargeKn).toBe(2.5);
  });

  it("fusionne par id sans créer de doublon (le local gagne)", async () => {
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee("g1")] }));
    const f = { application: "MineBackfill", schema: 4, exportedAt: "x", data: { gachees: [gachee("g1"), gachee("g2")] } };
    await importerDonnees(fichier(f));
    let brut = JSON.parse(localStorage.getItem("minebackfill_gachees")!);
    expect(brut.data.map((x: { id: string }) => x.id).sort()).toEqual(["g1", "g2"]);
    // Réimporter le MÊME fichier ne doit rien ajouter.
    await importerDonnees(fichier(f));
    brut = JSON.parse(localStorage.getItem("minebackfill_gachees")!);
    expect(brut.data).toHaveLength(2);
  });

  it("accepte une enveloppe {v,data} en entrée (sauvegarde bricolée à la main)", async () => {
    await importerDonnees(fichier({
      application: "MineBackfill", schema: 4, exportedAt: "x",
      data: { gachees: { v: 2, data: [gachee("g9")] } },
    }));
    const brut = JSON.parse(localStorage.getItem("minebackfill_gachees")!);
    expect(brut.data[0].id).toBe("g9");
  });

  it("un fichier schéma 3 laisse les gâchées locales intactes", async () => {
    localStorage.setItem("minebackfill_gachees", JSON.stringify({ v: 2, data: [gachee("local")] }));
    const res = await importerDonnees(fichier({
      application: "MineBackfill", schema: 3, exportedAt: "x",
      data: { unit_prefs: { masse: "kg" } },
    }));
    expect(res.ok).toBe(true);
    const brut = JSON.parse(localStorage.getItem("minebackfill_gachees")!);
    expect(brut.data[0].id).toBe("local");
  });

  it("les protocoles sont remplacés, pas fusionnés", async () => {
    await importerDonnees(fichier({
      application: "MineBackfill", schema: 4, exportedAt: "x",
      data: { protocoles: [{ id: "seul", titre: "Unique", contenu: "Texte." }] },
    }));
    const brut = JSON.parse(localStorage.getItem("minebackfill_protocoles")!);
    expect(brut.data).toHaveLength(1);
    expect(brut.data[0].id).toBe("seul");
  });

  it("refuse une sauvegarde d'un schéma plus récent", async () => {
    const res = await importerDonnees(fichier({
      application: "MineBackfill", schema: 99, exportedAt: "x", data: {},
    }));
    expect(res.ok).toBe(false);
    expect(res.message).toContain("99");
  });

  it("refuse un fichier qui n'est pas une sauvegarde MineBackfill", async () => {
    const res = await importerDonnees(fichier({ application: "Autre", schema: 4, data: {} }));
    expect(res.ok).toBe(false);
  });

  it("stockage plein : l'échec des gâchées est rapporté, pas « Import réussi »", async () => {
    // Avant, persistGachees avalait l'erreur de quota et l'import annonçait
    // un succès alors que rien n'avait été enregistré.
    const plein = new MemStorage();
    plein.setItem = (k: string) => { if (k === "minebackfill_gachees") throw new Error("QuotaExceededError"); };
    g.localStorage = plein;
    const res = await importerDonnees(fichier({
      application: "MineBackfill", schema: 4, exportedAt: "x",
      data: { gachees: [gachee("g1")] },
    }));
    expect(res.ok).toBe(false);
    expect(res.message).toContain("quota");
  });
});
