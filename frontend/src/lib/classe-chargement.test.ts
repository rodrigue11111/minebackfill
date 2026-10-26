import { describe, expect, it } from "vitest";
import { chargerClasse, creerControleur } from "./classe-chargement";
import type { SourceClasse } from "./classe-source";
import type { LigneClasse } from "./classe";

/** Source dont la lecture de la classe attend qu'on la libère (requête lente). */
function sourceLente(nom: string) {
  let liberer: () => void = () => {};
  const attente = new Promise<void>((r) => { liberer = r; });
  const ligne = { proprietaire: nom, kind: "resultat", id: nom, rev: 1, maj: "", cree: "", supprime: false, contenu: {} } as LigneClasse;
  const source = {
    demonstration: nom === "demo",
    lireClasse: async () => { await attente; return [ligne]; },
    lireProfils: async () => [],
    lireAnnotationsClasse: async () => [],
    lireRevuesClasse: async () => [],
  } as unknown as SourceClasse;
  return { source, liberer };
}

describe("chargement de la classe : aucune réponse égarée entre deux sources", () => {
  it("un chargement courant est accepté", async () => {
    const c = creerControleur();
    const { source, liberer } = sourceLente("reel");
    const p = chargerClasse(source, { session: null }, c);
    liberer();
    expect((await p)?.lignes[0].id).toBe("reel");
  });

  it("réel lent, puis bascule vers la démonstration : la réponse réelle tardive est ignorée", async () => {
    const c = creerControleur();
    const reel = sourceLente("reel"), demo = sourceLente("demo");
    const pReel = chargerClasse(reel.source, { session: null }, c);
    c.invalider(); // changement de source
    const pDemo = chargerClasse(demo.source, { session: null }, c);
    demo.liberer();
    expect((await pDemo)?.lignes[0].id).toBe("demo");
    reel.liberer();
    expect(await pReel).toBeNull();
  });

  it("l'inverse : démonstration lente, puis retour au réel", async () => {
    const c = creerControleur();
    const reel = sourceLente("reel"), demo = sourceLente("demo");
    const pDemo = chargerClasse(demo.source, { session: null }, c);
    c.invalider();
    const pReel = chargerClasse(reel.source, { session: null }, c);
    reel.liberer();
    demo.liberer();
    expect(await pDemo).toBeNull();
    expect((await pReel)?.lignes[0].id).toBe("reel");
  });

  it("l'échec d'un chargement dépassé ne remonte pas ; celui d'un chargement courant, si", async () => {
    const c = creerControleur();
    const enEchec = { ...sourceLente("x").source, lireClasse: async () => { throw new Error("réseau"); } } as SourceClasse;
    const p = chargerClasse(enEchec, { session: null }, c);
    c.invalider();
    expect(await p).toBeNull();
    await expect(chargerClasse(enEchec, { session: null }, c)).rejects.toThrow("réseau");
  });

  it("une erreur des revues n'empêche pas le reste", async () => {
    const c = creerControleur();
    const s = { ...sourceLente("x").source, lireClasse: async () => [], lireRevuesClasse: async () => { throw new Error("revues"); } } as SourceClasse;
    const r = await chargerClasse(s, { session: null }, c);
    expect(r?.revues).toBeNull();
    expect((r?.erreurRevues as Error).message).toBe("revues");
  });
});
