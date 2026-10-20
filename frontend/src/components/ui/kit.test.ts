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
import Menu from "./Menu";
import ConfirmationEnLigne from "./ConfirmationEnLigne";
import ChampNombre, { lireNombre, refusNombre } from "./ChampNombre";

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

describe("kit — saisie numérique commune (ChampNombre)", () => {
  it("lecture : 0 reste 0, vide et illisible = undefined, « 1, » lu 1, virgule, signe moins typographique", () => {
    expect(lireNombre("0")).toBe(0);
    expect(lireNombre("1,")).toBe(1);
    expect(lireNombre("75,5")).toBe(75.5);
    expect(lireNombre("-5")).toBe(-5);
    expect(lireNombre("−5")).toBe(-5);
    expect(lireNombre(" ")).toBeUndefined();
  });

  it("refus sous la borne : min inclus ou exclu ; sans borne, rien n'est refusé", () => {
    expect(refusNombre(-5, {})).toBeNull();
    expect(refusNombre(0, { min: 0 })).toBeNull();
    expect(refusNombre(-5, { min: 0 })).toBe("Une valeur négative est impossible.");
    expect(refusNombre(0, { min: 0, minExclusif: true })).toBe("La valeur doit être strictement positive.");
    expect(refusNombre(0.1, { min: 0, minExclusif: true })).toBeNull();
  });

  it("rendu : champ texte décimal ; vide affiché vide, 0 affiché « 0 » ; attributs d'accessibilité transmis à l'input", () => {
    const vide = renderToStaticMarkup(createElement(ChampNombre, { value: undefined, onChange: () => {} }));
    expect(vide).toContain('type="text"');
    expect(vide).toContain('inputMode="decimal"');
    expect(vide).toContain('value=""');
    expect(vide).not.toContain("aria-invalid");
    const zero = renderToStaticMarkup(createElement(ChampNombre, { value: 0, onChange: () => {}, ariaInvalid: true, ariaDescribedby: "msg-1" }));
    expect(zero).toContain('value="0"');
    expect(zero).toContain('aria-invalid="true"');
    expect(zero).toContain('aria-describedby="msg-1"');
  });
});

describe("kit — champ en erreur : message annoncé et relié à la saisie (accessibilité)", () => {
  const idDe = (html: string, motif: RegExp) => html.match(motif)?.[1];

  it("ChampNombre : aria-invalid et aria-describedby arrivent jusqu'à l'<input>, égal à l'id du message role=alert", () => {
    const html = renderToStaticMarkup(createElement(Champ, { libelle: "Diamètre", erreur: "Le diamètre doit être strictement positif." },
      createElement(ChampNombre, { value: 0, onChange: () => {} })));
    const decrit = idDe(html, /<input[^>]*aria-describedby="([^"]+)"/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(decrit).toBeTruthy();
    expect(html).toContain(`id="${decrit}" class="ui-champ-erreur" role="alert"`);
  });

  it("input natif (Réglages) : mêmes attributs ; sans erreur : aucun", () => {
    const enErreur = renderToStaticMarkup(createElement(Champ, { libelle: "ρw", erreur: "Valeur strictement positive attendue" },
      createElement("input", { className: "field-input", defaultValue: "0" })));
    expect(enErreur).toMatch(/<input[^>]*aria-invalid="true"[^>]*aria-describedby="[^"]+"/);
    const correct = renderToStaticMarkup(createElement(Champ, { libelle: "ρw" }, createElement("input", { className: "field-input", defaultValue: "998" })));
    expect(correct).not.toContain("aria-invalid");
    expect(correct).not.toContain('role="alert"');
  });
});

describe("kit — menu : rôles pour les lecteurs d'écran", () => {
  it("menu et éléments de menu", () => {
    const html = renderToStaticMarkup(createElement(Menu, { declencheur: "Plus", ariaLabel: "Autres actions", elements: [{ libelle: "Feuille labo" }, { libelle: "Plein écran" }] }));
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('role="menu"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
  });
});

describe("kit — bornes haute et basse, menu ouvert ou fermé", () => {
  it("refusNombre : au-delà de max, refus", () => {
    expect(refusNombre(201, { min: 2, max: 200 })).toBe("La valeur doit être au plus 200.");
    expect(refusNombre(200, { min: 2, max: 200 })).toBeNull();
    expect(refusNombre(1, { min: 2, max: 200 })).toBe("La valeur doit être au moins 2.");
  });

  it("menu : aria-expanded (fermé au rendu) et aria-controls vers le menu", () => {
    const html = renderToStaticMarkup(createElement(Menu, { declencheur: "Plus", ariaLabel: "Plus", elements: [{ libelle: "Guide" }] }));
    expect(html).toContain('aria-expanded="false"');
    const id = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });
});

describe("kit : confirmation en ligne (sans window.confirm)", () => {
  it("au rendu : un seul bouton, aucune action ni question tant qu'on n'a pas cliqué", () => {
    let appels = 0;
    const html = renderToStaticMarkup(createElement(ConfirmationEnLigne, {
      libelle: "Retirer", question: "L'étudiant ne le verra plus.", libelleConfirmer: "Confirmer le retrait",
      onConfirmer: () => { appels++; },
    }));
    expect(html).toBe('<button type="button">Retirer</button>');
    expect(appels).toBe(0);
  });
});
