// Rendu des fiches de l'enseignant (2026-10-29), sans navigateur.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FORMULAS } from "@/lib/formulas-data";
import type { ContenuFiche, PublicationFormules } from "@/lib/formules-enseignant";
import FormulaLibraryPage from "@/app/formulas/page";
import FormulaPopover from "@/components/mix/FormulaPopover";
import EditeurFiche from "./EditeurFiche";
import BarreFormules from "./BarreFormules";

const fiche = (p: Partial<ContenuFiche> = {}): ContenuFiche => ({
  title: "Cw selon l'enseignant", section: "Paramètres", equationLatex: "C_w = 1 - w_{ens}", equationPlainText: "",
  variables: [{ symbol: "w_{ens}", description: "Teneur de l'enseignant", unit: null }], contextSnippet: "", keywords: [], ...p,
});
const publication = (p: Partial<PublicationFormules> = {}): PublicationFormules => ({
  couche: { modifiees: { F009: fiche() }, ajoutees: [{ id: "E001", ...fiche({ title: "Fiche ajoutée" }) }] },
  publieeLe: "2026-10-29T20:30:00.000Z", publieePar: "Prof", ...p,
});
const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

// Rendu serveur : zustand lit l'état INITIAL du magasin, pas celui posé par
// le test. La vue des formules (useFormules) est donc fournie par le test,
// calculée par la VRAIE fonction vueFormules.
const etat = vi.hoisted(() => ({
  brouillons: {} as Record<string, unknown>,
  publication: null as unknown,
  proprietaire: "local" as string | null,
}));
vi.mock("@/lib/use-formules", async () => {
  const { vueFormules } = await import("@/lib/formules-enseignant");
  return {
    useFormules: () => ({
      ...vueFormules(etat.brouillons as never, etat.publication as never, etat.proprietaire),
      proprietaire: etat.proprietaire,
    }),
  };
});
const poser = (o: { brouillons?: Record<string, unknown>; publication?: PublicationFormules | null; proprietaire?: string | null }) => {
  etat.brouillons = o.brouillons ?? {};
  etat.publication = o.publication ?? null;
  etat.proprietaire = o.proprietaire === undefined ? "local" : o.proprietaire;
};
beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { innerWidth: 1200, innerHeight: 900 };
  poser({});
});

describe("fiche fx des Calculs : toujours la formule du cours", () => {
  const popover = () => rendu(createElement(FormulaPopover, {
    formulaIds: ["F009"],
    ancre: { getBoundingClientRect: () => ({ top: 0, left: 10, bottom: 20 }), isConnected: true } as unknown as HTMLElement,
    onClose: () => {},
  }));

  it("fiche du cours seule : aucun avis", () => {
    const html = popover();
    expect(html).toContain(FORMULAS.find((f) => f.id === "F009")!.title.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("modifiée par l&#x27;enseignant");
  });

  it("fiche modifiée et publiée : titre du cours, avis, version de l'enseignant à part", () => {
    poser({ publication: publication(), proprietaire: null });
    const html = popover();
    expect(html).toContain(FORMULAS.find((f) => f.id === "F009")!.title.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("Cw selon l&#x27;enseignant");
    expect(html).toContain("Cette fiche a été modifiée par l&#x27;enseignant dans la bibliothèque Formules. Le calcul utilise la version ci-dessus.");
    expect(html).toContain("Voir la version de l&#x27;enseignant");
    expect(html).toContain("Teneur de l&#x27;enseignant");
  });
});

describe("page Formules", () => {
  it("étudiant : fiches publiées avec leur pastille, aucun bouton d'édition", () => {
    poser({ publication: publication(), proprietaire: null });
    const html = rendu(createElement(FormulaLibraryPage));
    expect(html).toContain("Cw selon l&#x27;enseignant");
    expect(html).toContain("modifiée par l&#x27;enseignant");
    expect(html).toContain("Fiche ajoutée");
    expect(html).toContain("ajoutée par l&#x27;enseignant");
    expect(html).toContain(`>${FORMULAS.length + 1}<`);
    expect(html).not.toContain("Ajouter une formule");
    expect(html).not.toContain("Publier en ligne");
  });

  it("une fiche ajoutée n'a pas de numéro de page", () => {
    poser({ publication: publication(), proprietaire: null });
    const html = rendu(createElement(FormulaLibraryPage));
    expect(html).toMatch(/>E001<\/span>/);
    expect(html).not.toMatch(/E001 · p\./);
  });

  it("vue enseignant sans compte : barre, état, publication impossible sans compte", () => {
    poser({ brouillons: { local: { modifiees: { F009: fiche() }, ajoutees: [] } } });
    const html = rendu(createElement(BarreFormules, { onAjouter: () => {}, onOuvrir: () => {} }));
    expect(html).toContain("Modifications non publiées");
    expect(html).toContain("Aucune fiche publiée : les étudiants voient les formules du cours.");
    expect(html).toContain("Ajouter une formule");
    expect(html).toContain("Publication impossible sans compte enseignant connecté");
    expect(html).toContain("Abandonner mes modifications");
  });

  it("à jour : date et auteur de la dernière publication", () => {
    const p = publication();
    poser({ publication: p, brouillons: { local: p.couche } });
    const html = rendu(createElement(BarreFormules, { onAjouter: () => {}, onOuvrir: () => {} }));
    expect(html).toContain("À jour");
    expect(html).toMatch(/Dernière publication : .*2026.*, par Prof/);
  });
});

describe("éditeur d'une fiche", () => {
  it("nouvelle fiche : champs vides, erreurs, enregistrement désactivé, avertissement", () => {
    const html = rendu(createElement(EditeurFiche, { titre: "Nouvelle formule", sections: ["Paramètres"], onEnregistrer: () => {}, onAnnuler: () => {} }));
    expect(html).toContain("Modifier une fiche ne change pas les calculs du site");
    expect(html).toContain("obligatoire");
    expect(html).toMatch(/<button type="submit" class="btn-primary" disabled="">Enregistrer<\/button>/);
    expect(html).toContain("Aperçu de l&#x27;équation");
  });

  it("fiche existante : valeurs reprises, aperçu de l'équation, enregistrement possible", () => {
    const html = rendu(createElement(EditeurFiche, { titre: "Modifier F009", initial: fiche(), sections: ["Paramètres"], onEnregistrer: () => {}, onAnnuler: () => {} }));
    expect(html).toContain('value="Cw selon l&#x27;enseignant"');
    // L'aperçu KaTeX se dessine après le montage (navigateur) : ici, son cadre.
    expect(html).toContain('aria-label="Aperçu de l&#x27;équation"');
    expect(html).not.toContain("Aperçu de l&#x27;équation</span>");
    expect(html).toMatch(/<button type="submit" class="btn-primary">Enregistrer<\/button>/);
  });
});
