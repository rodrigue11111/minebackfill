import { describe, it, expect } from "vitest";
import { lireArtefact } from "./analyse-artefact";
import type { InstantaneAnalyse } from "./analyse-instantane";

const instantane: InstantaneAnalyse = {
  date: "2026-09-27T12:00:00.000Z", categorie: "RPC", methode: "Cw%",
  parametre: { label: "Bw", min: 2, max: 10, points: 5 },
  recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5 },
  liants: [], versionSolveur: "intra2017-1",
  constantes: {
    packLabel: "Intra 2017", masseVolEau: 1000, gravite: 9.81,
    facteurCone: 2.335, coeffSlump: 4950000, constSlump: 235.5122,
    conventionGs: "base", regleLiant: "solides_totaux",
  },
};

const balayage = {
  category: "RPC", param: "binder_mass_pct",
  x: [2, 6, 10], series: { wc_ratio: [17, 5.9, 3.7] },
};

const j = (o: unknown) => JSON.stringify(o);

describe("analyse-artefact — lireArtefact", () => {
  it("accepte le format /1 (un seul résultat)", () => {
    const r = lireArtefact(j({ format: "minebackfill-analyse-courbes/1", instantane, resultat: balayage }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artefact.resultats).toHaveLength(1);
    expect(r.artefact.resultats[0].x).toEqual([2, 6, 10]);
    expect(r.artefact.variantes).toEqual([]);
  });

  it("accepte le format /2 (plusieurs variantes)", () => {
    const r = lireArtefact(j({
      format: "minebackfill-analyse-courbes/2", instantane,
      resultats: [balayage, balayage], variantes: ["Bw 3 %", "Bw 5 %"],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artefact.resultats).toHaveLength(2);
    expect(r.artefact.variantes).toEqual(["Bw 3 %", "Bw 5 %"]);
  });

  it("refuse un JSON tronqué avec un message clair", () => {
    const r = lireArtefact('{"format": "minebackfill');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("JSON");
  });

  it("refuse un fichier d'un autre outil", () => {
    const r = lireArtefact(j({ format: "autre-chose/1", data: [] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("MineBackfill");
  });

  it("refuse une version future plutôt que de deviner", () => {
    const r = lireArtefact(j({ format: "minebackfill-analyse-courbes/99", instantane, resultats: [balayage] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("99");
  });

  it("refuse un balayage sans provenance", () => {
    // Sans instantané, la figure ne serait pas reproductible : la recharger
    // donnerait un graphique dont on ne saurait plus d'où il vient.
    const r = lireArtefact(j({ format: "minebackfill-analyse-courbes/1", resultat: balayage }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("provenance");
  });

  it("refuse un balayage dont les séries sont absentes", () => {
    const r = lireArtefact(j({ format: "minebackfill-analyse-courbes/1", instantane, resultat: { x: [1, 2] } }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("séries");
  });
});
