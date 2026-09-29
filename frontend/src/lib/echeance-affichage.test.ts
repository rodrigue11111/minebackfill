import { describe, expect, it } from "vitest";
import { badgeEcheance, COULEUR_ECHEANCE, fmtDate } from "./echeance-affichage";
import type { Eprouvette } from "./eprouvette";

// Coulée le 1er septembre à midi local, 28 j de cure : échéance le 29 septembre.
const ep = (p: Partial<Eprouvette> = {}): Eprouvette => ({
  id: "e1", code: "G-1-E01", couleLe: new Date(2026, 8, 1, 12).toISOString(), ageJours: 28, statut: "en_cure", ...p,
});

describe("affichage des échéances", () => {
  it("date locale AAAA-MM-JJ", () => {
    expect(fmtDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("libellés et couleurs selon l'échéance", () => {
    expect(badgeEcheance(ep(), new Date(2026, 8, 29, 8))).toEqual({ texte: "à écraser aujourd'hui", couleur: COULEUR_ECHEANCE.aujourdhui });
    expect(badgeEcheance(ep(), new Date(2026, 9, 2))).toEqual({ texte: "en retard de 3 j", couleur: COULEUR_ECHEANCE.retard });
    expect(badgeEcheance(ep(), new Date(2026, 8, 25))).toEqual({ texte: "dans 4 j", couleur: COULEUR_ECHEANCE.proche });
    expect(badgeEcheance(ep(), new Date(2026, 8, 2))).toEqual({ texte: "dans 27 j", couleur: COULEUR_ECHEANCE.planifie });
    expect(badgeEcheance(ep({ statut: "ecrase" }), new Date(2026, 9, 30))).toEqual({ texte: "écrasée", couleur: COULEUR_ECHEANCE.fait });
  });
});
