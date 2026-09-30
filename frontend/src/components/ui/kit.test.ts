// Rendu du kit d'interface (sans navigateur) : rôles ARIA, structure et
// absence d'erreur pour les composants partagés.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Segmente from "./Segmente";
import { Champ } from "./Champ";
import { BandeChiffres, TuilesChiffres } from "./Chiffres";
import { ListeGroupee, LigneListe } from "./Liste";
import { EnTetePage, Page } from "./Page";
import { Carte } from "./Carte";
import { Pastille } from "./Pastille";
import { Bandeau } from "./Bandeau";
import { lireNombre } from "./ChampNombre";

const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("kit — Segmente", () => {
  const options = [{ valeur: "RPC", libelle: "RPC" }, { valeur: "RPG", libelle: "RPG" }, { valeur: "RRC", libelle: "RRC", desactive: true }];

  it("radiogroup : un seul segment coché et un seul arrêt de tabulation", () => {
    const html = rendu(createElement(Segmente, { options, valeur: "RPG", onChange: () => {}, ariaLabel: "Catégorie" }));
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Catégorie"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain("disabled");
  });

  it("tablist : aria-selected et aria-controls", () => {
    const html = rendu(createElement(Segmente, {
      options: [{ valeur: "a", libelle: "A", controle: "panneau-a" }, { valeur: "b", libelle: "B", controle: "panneau-b" }],
      valeur: "a", onChange: () => {}, ariaLabel: "Vues", role: "tablist",
    }));
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="panneau-b"');
  });
});

describe("kit — composants sans état", () => {
  it("Champ : libellé, unité hors du texte lu, aide", () => {
    const html = rendu(createElement(Champ, { libelle: "Pourcentage solide massique Cw", unite: "%", aide: "Masse des solides / masse totale" },
      createElement("input", { className: "field-input" })));
    expect(html).toContain("<label");
    expect(html).toContain("Pourcentage solide massique Cw");
    expect(html).toContain('aria-hidden="true">%</span>');
    expect(html).toContain("Masse des solides / masse totale");
  });

  it("BandeChiffres et TuilesChiffres : une liste de définitions", () => {
    const chiffres = [{ libelle: "Essais valides", valeur: 186 }, { libelle: "Liant", valeur: "52,3", unite: "kg", ton: "accent" as const }];
    const bande = rendu(createElement(BandeChiffres, { chiffres, ariaLabel: "Résumé" }));
    expect(bande).toContain("<dl");
    expect(bande).toContain("<dt");
    expect(bande).toContain("186");
    const tuiles = rendu(createElement(TuilesChiffres, { chiffres }));
    expect(tuiles).toContain("ui-ton-accent");
    expect(tuiles).toContain("kg");
  });

  it("ListeGroupee : une ligne avec href devient un lien à chevron", () => {
    const html = rendu(createElement(ListeGroupee, { titre: "Projet" },
      createElement(LigneListe, { libelle: "Opérateur", valeur: "Alice" }),
      createElement(LigneListe, { libelle: "Glossaire", href: "/guide#glossaire" })));
    expect(html).toContain('href="/guide#glossaire"');
    expect(html).toContain("Alice");
    expect(html).toContain("ui-ligne-chevron");
  });

  it("Page, EnTetePage, Carte, Pastille, Bandeau se rendent sans erreur", () => {
    const html = rendu(createElement(Page, null,
      createElement(EnTetePage, { surtitre: "Remblai en pâte cimenté", titre: "Calculs", retour: { href: "/labo", libelle: "Gâchées" }, pastille: createElement(Pastille, { ton: "alerte" }, "Brouillon") }),
      createElement(Carte, { titre: "Paramètres", aside: "Recette 1" }, createElement(Bandeau, { ton: "alerte", titre: "Contenant manquant" }))));
    expect(html).toContain("<h1");
    expect(html).toContain("Calculs");
    expect(html).toContain("Remblai en pâte cimenté");
    expect(html).toContain('href="/labo"');
    expect(html).toContain("<h2");
    expect(html).toContain("ui-pastille-alerte");
    expect(html).toContain("ui-bandeau-alerte");
  });
});

describe("kit — lireNombre", () => {
  it("virgule ou point, espaces ignorées, vide = undefined", () => {
    expect(lireNombre("1,5")).toBe(1.5);
    expect(lireNombre(" 1 234,5 ")).toBe(1234.5);
    expect(lireNombre("")).toBeUndefined();
    expect(lireNombre("abc")).toBeUndefined();
  });
});
