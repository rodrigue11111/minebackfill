import { describe, expect, it } from "vitest";
import { empreinte, jsonCanonique } from "./sync-empreinte";

describe("sync-empreinte — JSON canonique", () => {
  it("l'ordre des clés ne compte pas, à tous les niveaux", () => {
    const a = { b: 1, a: { d: [1, { y: 2, x: 1 }], c: "t" } };
    const b = { a: { c: "t", d: [1, { x: 1, y: 2 }] }, b: 1 };
    expect(jsonCanonique(a)).toBe(jsonCanonique(b));
    expect(empreinte(a)).toBe(empreinte(b));
  });

  it("l'ordre des tableaux compte", () => {
    expect(empreinte([1, 2])).not.toBe(empreinte([2, 1]));
  });

  it("mêmes règles que JSON.stringify pour les feuilles (comme jsonb)", () => {
    // undefined disparaît d'un objet : jsonb ne le stocke pas.
    expect(jsonCanonique({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(jsonCanonique([undefined, NaN, Infinity])).toBe("[null,null,null]");
    expect(jsonCanonique(new Date("2026-09-28T12:00:00.000Z"))).toBe('"2026-09-28T12:00:00.000Z"');
    expect(jsonCanonique(undefined)).toBe("null");
    expect(jsonCanonique(1.0)).toBe(jsonCanonique(1));
  });

  it("un contenu relu depuis le serveur garde son empreinte", () => {
    const doc = { id: "g1", eprouvettes: [{ id: "e1", essai: { chargeKn: 2.5 } }], note: "é" };
    const relu = JSON.parse(JSON.stringify(doc));
    expect(empreinte(relu)).toBe(empreinte(doc));
  });

  it("une modification change l'empreinte", () => {
    expect(empreinte({ a: 1 })).not.toBe(empreinte({ a: 2 }));
    expect(empreinte({ a: 1 })).toMatch(/^[0-9a-f]{14}$/);
  });
});
