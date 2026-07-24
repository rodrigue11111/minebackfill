import { describe, it, expect } from "vitest";
import {
  dateEcheance, joursRestants, classeEcheance, genererCodeEprouvette,
  construireIcs, etiquettesHtml,
  type Eprouvette,
} from "./eprouvette";

function ep(p: Partial<Eprouvette>): Eprouvette {
  return { id: "e1", code: "G-20260724-01-E01", couleLe: "2026-07-24T09:00:00", ageJours: 28, statut: "en_cure", ...p };
}

describe("dateEcheance", () => {
  it("coulée + âge en jours", () => {
    const d = dateEcheance(ep({ couleLe: "2026-07-24T09:00:00", ageJours: 28 }));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // août (0-indexé)
    expect(d.getDate()).toBe(21); // 24 juillet + 28 j = 21 août
  });
});

describe("joursRestants / classeEcheance", () => {
  const ref = new Date(2026, 7, 21); // 21 août 2026, minuit local
  it("0 le jour de l'échéance", () => {
    const e = ep({ couleLe: "2026-07-24T00:00:00", ageJours: 28 });
    expect(joursRestants(e, ref)).toBe(0);
    expect(classeEcheance(e, ref)).toBe("aujourdhui");
  });
  it("négatif quand l'échéance est passée -> retard", () => {
    const e = ep({ couleLe: "2026-07-24T00:00:00", ageJours: 28 });
    expect(joursRestants(e, new Date(2026, 7, 25))).toBe(-4);
    expect(classeEcheance(e, new Date(2026, 7, 25))).toBe("retard");
  });
  it("dans les 7 jours -> proche, au-delà -> planifié", () => {
    expect(classeEcheance(ep({ couleLe: "2026-08-01T00:00:00", ageJours: 25 }), ref)).toBe("proche"); // 26 août = +5
    expect(classeEcheance(ep({ couleLe: "2026-08-01T00:00:00", ageJours: 56 }), ref)).toBe("planifie");
  });
  it("écrasée -> toujours « fait » même en retard", () => {
    const e = ep({ couleLe: "2026-07-24T00:00:00", ageJours: 28, statut: "ecrase" });
    expect(classeEcheance(e, new Date(2026, 8, 30))).toBe("fait");
  });
});

describe("genererCodeEprouvette", () => {
  it("incrémente le suffixe -ENN", () => {
    expect(genererCodeEprouvette("G-20260724-01", [])).toBe("G-20260724-01-E01");
    const ex = [ep({ code: "G-20260724-01-E01" }), ep({ code: "G-20260724-01-E02" })];
    expect(genererCodeEprouvette("G-20260724-01", ex)).toBe("G-20260724-01-E03");
  });
  it("ignore les codes d'une autre gâchée", () => {
    const ex = [ep({ code: "G-20260724-02-E05" })];
    expect(genererCodeEprouvette("G-20260724-01", ex)).toBe("G-20260724-01-E01");
  });
});

describe("construireIcs", () => {
  const ics = construireIcs(
    [{ uid: "e1@minebackfill", date: new Date(2026, 7, 21), titre: "Écraser G-20260724-01-E01", description: "28 j" }],
    new Date(Date.UTC(2026, 6, 24, 12, 0, 0)),
  );
  it("enveloppe VCALENDAR/VEVENT valide", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:e1@minebackfill");
  });
  it("événement toute la journée : DTSTART le jour, DTEND le lendemain", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260821");
    expect(ics).toContain("DTEND;VALUE=DATE:20260822");
    expect(ics).toContain("DTSTAMP:20260724T120000Z");
  });
  it("lignes séparées par CRLF", () => {
    expect(ics.includes("\r\n")).toBe(true);
  });
  it("échappe les caractères spéciaux du texte", () => {
    const s = construireIcs([{ uid: "x", date: new Date(2026, 0, 1), titre: "a; b, c\\d" }], new Date(Date.UTC(2026, 0, 1)));
    expect(s).toContain("SUMMARY:a\\; b\\, c\\\\d");
  });
});

describe("etiquettesHtml", () => {
  const html = etiquettesHtml(
    [{ codeEprouvette: "G-01-E01", codeGachee: "G-01", formulation: "Essai <A>", categorie: "RPG", couleLe: "24/07/2026", echeance: "21/08/2026", ageJours: 28, moule: "cyl. 50×100" }],
    "Étiquettes",
  );
  it("document HTML autonome", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("G-01-E01");
  });
  it("échappe le HTML des valeurs", () => {
    expect(html).toContain("Essai &lt;A&gt;");
    expect(html).not.toContain("Essai <A>");
  });
});
