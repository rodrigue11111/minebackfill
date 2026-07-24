import { describe, it, expect } from "vitest";
import {
  dateEcheance, joursRestants, classeEcheance, genererCodeEprouvette,
  construireIcs, etiquettesHtml,
  contrainteKpa, moyenne, ecartTypeEch, agregerParAge,
  type Eprouvette, type EssaiUCS,
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
  it("plie les lignes > 75 octets (RFC 5545) sans dépasser 75 octets par ligne physique", () => {
    const longue = "Gâchée G-20260724-01 · Essai RPG méthode Cw — résidu Westwood 78 % très détaillé · 91 j de cure";
    const s = construireIcs(
      [{ uid: "x@minebackfill", date: new Date(2026, 7, 21), titre: "Écraser", description: longue }],
      new Date(Date.UTC(2026, 6, 24)),
    );
    const enc = new TextEncoder();
    for (const ligne of s.split("\r\n")) {
      expect(enc.encode(ligne).length).toBeLessThanOrEqual(75);
    }
    // Le dépliage (retrait de « CRLF + espace ») restaure la description exacte.
    const deplie = s.replace(/\r\n /g, "");
    expect(deplie).toContain(`DESCRIPTION:${longue}`);
  });
});

describe("contrainteKpa", () => {
  it("calcule σ = F / A depuis charge (kN) et diamètre (mm)", () => {
    // d = 50 mm -> A = π·625 ≈ 1963,5 mm² ; F = 10 kN = 10000 N
    // σ = 10000 / 1963,5 = 5,093 MPa = 5093 kPa
    const v = contrainteKpa({ chargeKn: 10, diametreMm: 50 })!;
    expect(v).toBeCloseTo(5092.96, 0);
  });
  it("la saisie directe prime sur le calcul", () => {
    expect(contrainteKpa({ chargeKn: 10, diametreMm: 50, contrainteKpaSaisie: 1200 })).toBe(1200);
  });
  it("null si ni contrainte ni charge+diamètre exploitables", () => {
    expect(contrainteKpa(undefined)).toBeNull();
    expect(contrainteKpa({ chargeKn: 10 })).toBeNull(); // diamètre manquant
    expect(contrainteKpa({ chargeKn: 10, diametreMm: 0 })).toBeNull();
  });
});

describe("moyenne / ecartTypeEch", () => {
  it("moyenne, et écart-type d'échantillon (n−1)", () => {
    expect(moyenne([2, 4, 6])).toBe(4);
    expect(ecartTypeEch([2, 4, 6])).toBeCloseTo(2, 10); // var = ((4+0+4)/2)=4 -> sd=2
  });
  it("écart-type null si moins de 2 valeurs", () => {
    expect(ecartTypeEch([5])).toBeNull();
    expect(moyenne([])).toBeNull();
  });
});

describe("agregerParAge", () => {
  const e = (p: Partial<Eprouvette> & { essai?: EssaiUCS }): Eprouvette =>
    ({ id: Math.random().toString(), code: "c", couleLe: "2026-07-24T12:00:00", ageJours: 28, statut: "ecrase", ...p });
  it("moyenne par âge, exclut les éprouvettes marquées exclues", () => {
    const eps = [
      e({ ageJours: 28, essai: { contrainteKpaSaisie: 1000 } }),
      e({ ageJours: 28, essai: { contrainteKpaSaisie: 1200 } }),
      e({ ageJours: 28, essai: { contrainteKpaSaisie: 5000, exclu: true } }), // aberrante -> exclue
      e({ ageJours: 7, essai: { contrainteKpaSaisie: 400 } }),
      e({ ageJours: 7, essai: {} }), // pas de mesure -> ignorée
    ];
    const agr = agregerParAge(eps);
    expect(agr.map((a) => a.ageJours)).toEqual([7, 28]); // trié
    const a28 = agr.find((a) => a.ageJours === 28)!;
    expect(a28.n).toBe(2);
    expect(a28.moyenneKpa).toBe(1100);
    expect(a28.nExclus).toBe(1);
    const a7 = agr.find((a) => a.ageJours === 7)!;
    expect(a7.n).toBe(1);
    expect(a7.moyenneKpa).toBe(400);
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
