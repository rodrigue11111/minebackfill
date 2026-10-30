import { describe, expect, it } from "vitest";
import { dateSession } from "./SessionsCard";

describe("carte des sessions : dates lisibles (2026-10-29)", () => {
  it("« 1er septembre 2026 », « 20 décembre 2026 » ; une date illisible reste telle quelle", () => {
    expect(dateSession("2026-09-01")).toBe("1er septembre 2026");
    expect(dateSession("2026-12-20")).toBe("20 décembre 2026");
    expect(dateSession("2026-1-5")).toBe("2026-1-5");
  });
});
