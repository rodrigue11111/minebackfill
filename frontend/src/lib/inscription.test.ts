import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { donneesInscription } from "./inscription";

describe("inscription : plus de code enseignant (2026-10-26)", () => {
  it("étudiant : le nom seul ; enseignant : la demande « oui », valeur lue par le serveur", () => {
    expect(donneesInscription("  Alice Tremblay ", false)).toEqual({ display_name: "Alice Tremblay" });
    expect(donneesInscription("Prof", true)).toEqual({ display_name: "Prof", enseignant: "oui" });
    const schema = readFileSync(fileURLToPath(new URL("../../../supabase/schema.sql", import.meta.url)), "utf8");
    expect(schema).toContain("new.raw_user_meta_data ->> 'enseignant', '') = 'oui'");
  });

  it("ni la page Compte ni le portail ne demandent encore un code ; tous deux permettent de revenir à « étudiant »", () => {
    for (const chemin of ["../app/compte/page.tsx", "../../../portail/src/app/page.tsx"]) {
      const source = readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8");
      expect(source, chemin).not.toContain("code_enseignant");
      expect(source, chemin).not.toMatch(/libelle(?:=|: )"Code enseignant|>Code enseignant</);
      expect(source, chemin).toContain("Je suis étudiant");
      expect(source, chemin).toContain("setEnseignant(false)");
    }
  });
});
