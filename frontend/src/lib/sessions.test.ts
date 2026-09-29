import { describe, expect, it } from "vitest";
import {
  correspond, erreursSession, jourDe, sessionActive, sessionEffective, validerSessions, type Session,
} from "./sessions";

const A26: Session = { id: "A2026", nom: "Automne 2026", debut: "2026-09-01", fin: "2026-12-23" };
const H27: Session = { id: "H2027", nom: "Hiver 2027", debut: "2027-01-05", fin: "2027-04-30" };

describe("sessions — validation", () => {
  it("écarte les entrées malformées et les doublons, trie par début", () => {
    const l = validerSessions([
      H27, A26, { ...A26, nom: "doublon" }, { id: "x y", nom: "n", debut: "2026-01-01", fin: "2026-02-01" },
      { id: "Z", nom: "fin avant début", debut: "2026-05-01", fin: "2026-04-01" }, null, "texte",
    ]);
    expect(l.map((s) => s.id)).toEqual(["A2026", "H2027"]);
    expect(l[0].nom).toBe("Automne 2026");
    expect(validerSessions({ pas: "un tableau" })).toEqual([]);
  });

  it("messages d'erreur en français", () => {
    expect(erreursSession(A26)).toEqual([]);
    expect(erreursSession({ id: "", nom: " ", debut: "2026-13-01", fin: "x" })).toHaveLength(4);
  });
});

describe("sessions — rattachement d'un document", () => {
  const sessions = [A26, H27];

  it("la session portée par le document prime", () => {
    expect(sessionEffective({ sessionId: "H2027", date: "2026-10-01T12:00:00Z" }, sessions)?.id).toBe("H2027");
  });

  it("sans session portée : déduite de la date, bornes incluses", () => {
    expect(sessionEffective({ date: "2026-09-01T12:00:00" }, sessions)?.id).toBe("A2026");
    expect(sessionEffective({ date: "2026-12-23T12:00:00" }, sessions)?.id).toBe("A2026");
    expect(sessionEffective({ date: "2027-02-10T12:00:00" }, sessions)?.id).toBe("H2027");
  });

  it("hors de toute session, ou session retirée : « Sans session »", () => {
    expect(sessionEffective({ date: "2026-07-23T12:00:00" }, sessions)).toBeNull();
    expect(sessionEffective({ sessionId: "E2026" }, sessions)).toBeNull();
    expect(sessionEffective({}, sessions)).toBeNull();
  });

  it("session active aujourd'hui, pour les nouveaux documents", () => {
    expect(sessionActive(sessions, new Date("2026-10-15T12:00:00"))?.id).toBe("A2026");
    expect(sessionActive(sessions, new Date("2026-12-30T12:00:00"))).toBeNull();
  });

  it("filtre : toutes, une session, sans session", () => {
    const doc = { date: "2026-10-01T12:00:00" };
    expect(correspond(doc, sessions, "toutes")).toBe(true);
    expect(correspond(doc, sessions, "A2026")).toBe(true);
    expect(correspond(doc, sessions, "H2027")).toBe(false);
    expect(correspond({ date: "2026-07-01T12:00:00" }, sessions, "sans")).toBe(true);
  });

  it("jour local d'un instant", () => {
    expect(jourDe("2026-09-28T12:00:00")).toBe("2026-09-28");
    expect(jourDe("pas une date")).toBeNull();
  });
});
