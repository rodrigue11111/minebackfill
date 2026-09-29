// Rendu du fil de commentaires côté étudiant (sans navigateur).

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Annotation } from "@/lib/annotations";
import { FilEtudiant } from "./AnnotationsDoc";

const a = (id: string, p: Partial<Annotation>): Annotation => ({
  id, cibleKind: "gachee", cibleId: "g1", cibleRev: null, ancre: null, texte: "t", supprime: false,
  maj: "2026-09-20T10:00:00Z", auteur: "enseignant", creeLe: "2026-09-20T10:00:00Z", luLe: null, ...p,
});

describe("fil de commentaires de l'étudiant", () => {
  it("commentaires de l'enseignant, réponses de l'étudiant avec leur lecture, bouton Répondre", () => {
    const liste = [
      a("1", { texte: "Pourquoi 31 j ?", ancre: "E02" }),
      a("2", { texte: "La presse était en panne.", auteur: "moi", creeLe: "2026-09-21T10:00:00Z", luLe: "2026-09-22T10:00:00Z" }),
      a("3", { texte: "Merci.", auteur: "moi", creeLe: "2026-09-23T10:00:00Z" }),
    ];
    const html = renderToStaticMarkup(createElement(FilEtudiant, { kind: "gachee", id: "g1", liste, connecte: true }));
    expect(html).toContain("Échanges avec l&#x27;enseignant");
    expect(html).toContain("Pourquoi 31 j ?");
    expect(html).toContain("vu par l&#x27;enseignant le");
    expect(html).toContain("pas encore lu par l&#x27;enseignant");
    expect(html).toContain("Répondre");
    expect(html.indexOf("Pourquoi 31 j ?")).toBeLessThan(html.indexOf("La presse était en panne."));
  });

  it("sans compte connecté : pas de réponse possible ; sans commentaire : rien", () => {
    expect(renderToStaticMarkup(createElement(FilEtudiant, { kind: "gachee", id: "g1", liste: [a("1", {})], connecte: false }))).toContain("Connectez-vous");
    expect(renderToStaticMarkup(createElement(FilEtudiant, { kind: "gachee", id: "g1", liste: [], connecte: true }))).toBe("");
  });
});
