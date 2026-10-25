// Formulaire du modèle prédictif (sans navigateur) : pas de plage usuelle
// sous l'affaissement visé. Avec ce modèle, 150 à 250 mm donnent un Cw sous la
// plage usuelle d'un RPC pour la plupart des résidus : les deux rappels se
// contredisaient (retour d'utilisation du 25 octobre 2026).

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SlumpForm from "./rpc/SlumpForm";
import { PLAGES } from "@/lib/plages";

describe("SlumpForm : affaissement visé", () => {
  it("aucune plage usuelle d'affaissement ; les autres champs gardent la leur", () => {
    const html = renderToStaticMarkup(createElement(SlumpForm));
    expect(html).toContain("Affaissement visé S");
    expect(html).not.toContain(PLAGES.slump.texte);
    expect(html).toContain(`Plage usuelle : ${PLAGES.sr.texte}.`);
  });
});
