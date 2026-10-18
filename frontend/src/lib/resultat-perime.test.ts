import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { empreinteEntrees, resultatPerime } from "./resultat-perime";

const etat = () => ({
  general: { project_name: "P" }, constantes: { gravite_m_s2: 9.81 }, catalogue_liants: [{ id: "l1", gs: 3.15 }],
  cw: { residue_sg: 3.4, solid_mass_pct: 78 }, wb: { residue_sg: 3.1 },
  essai: { base_method: "dosage_cw", ajustements: [] },
}) as Record<string, unknown>;

describe("résultats périmés", () => {
  it("l'empreinte suit les entrées de la méthode, les informations, les constantes et les liants ; pas les autres méthodes", () => {
    const a = etat();
    const e = empreinteEntrees(a, "cwResult");
    expect(empreinteEntrees({ ...a, wb: { residue_sg: 9 } }, "cwResult")).toBe(e);
    expect(empreinteEntrees({ ...a, cw: { residue_sg: 3.5, solid_mass_pct: 78 } }, "cwResult")).not.toBe(e);
    expect(empreinteEntrees({ ...a, general: { project_name: "Q" } }, "cwResult")).not.toBe(e);
    expect(empreinteEntrees({ ...a, constantes: { gravite_m_s2: 9.8 } }, "cwResult")).not.toBe(e);
  });

  it("essai-erreur : la méthode de base compte aussi", () => {
    const a = etat();
    const e = empreinteEntrees(a, "essaiResult");
    expect(empreinteEntrees({ ...a, cw: { residue_sg: 3.5 } }, "essaiResult")).not.toBe(e);
    expect(empreinteEntrees({ ...a, wb: { residue_sg: 9 } }, "essaiResult")).toBe(e);
  });

  it("périmé seulement si une empreinte a été prise et diffère", () => {
    const a = etat();
    const e = empreinteEntrees(a, "cwResult");
    expect(resultatPerime(a, "cwResult", e)).toBe(false);
    expect(resultatPerime({ ...a, cw: { residue_sg: 1 } }, "cwResult", e)).toBe(true);
    expect(resultatPerime({ ...a, cw: { residue_sg: 1 } }, "cwResult", undefined)).toBe(false);
  });
});

describe("résultats périmés : mesures au laboratoire", () => {
  it("saisir des mesures après le calcul ne rend pas le résultat périmé", () => {
    const a = { ...etat(), essai: { base_method: "dosage_cw", ajustements: [] } } as Record<string, unknown>;
    const e = empreinteEntrees(a, "essaiResult");
    const b = { ...a, essai: { base_method: "dosage_cw", ajustements: [], mesures: [{ tare: 1, mh: 3, ms: 2 }] } };
    expect(empreinteEntrees(b, "essaiResult")).toBe(e);
  });
});

describe("résultats périmés : empreinte prise au départ du calcul", () => {
  // Garde de source : chaque formulaire de Calculs prend l'empreinte AVANT la
  // requête et la rend avec la réponse. Prise à l'arrivée, une saisie faite
  // pendant l'attente passerait pour celle du résultat (revue du 2026-10-18).
  const FORMULAIRES = ["rpc/CwForm.tsx", "rpc/WbForm.tsx", "rpc/SlumpForm.tsx", "rpc/EssaiForm.tsx",
    "rpg/RpgCwForm.tsx", "rpg/RpgWbForm.tsx", "rpg/RpgEssaiForm.tsx", "rrc/RrcForm.tsx"];

  it.each(FORMULAIRES)("%s : empreinte prise avant le fetch et rendue avec la réponse", (rel) => {
    const source = readFileSync(fileURLToPath(new URL(`../components/mix/${rel}`, import.meta.url)), "utf8");
    const depart = source.search(/const empreinte = empreinteAuDepart\("\w+Result"\);/);
    const requete = source.search(/await fetch\(/);
    expect(depart).toBeGreaterThan(-1);
    expect(depart).toBeLessThan(requete);
    expect(source).toMatch(/set\w+Result\(data, empreinte\);/);
    expect(source).not.toMatch(/set\w+Result\(data\);/);
  });
});
