"use client";

// Éditeur d'une fiche de formule de l'enseignant (2026-10-29, demande n° 23) :
// titre, section, équation LaTeX avec aperçu en direct, texte brut,
// variables, contexte, mots-clés. Les erreurs viennent de la même validation
// que la publication (formules-enseignant.ts) : ce qui s'enregistre ici se
// publie. Modifier une fiche ne change aucun calcul du site.

import { useId, useState } from "react";
import { KaTeX } from "./KaTeXRenderer";
import { BORNES, erreursContenu, type ContenuFiche } from "@/lib/formules-enseignant";

const vide = (): ContenuFiche => ({
  title: "", section: "", equationLatex: "", equationPlainText: "", variables: [], contextSnippet: "", keywords: [],
});

export default function EditeurFiche({ titre, initial, sections, onEnregistrer, onAnnuler }: {
  titre: string;
  initial?: ContenuFiche;
  /** Sections existantes, proposées (une nouvelle peut être saisie). */
  sections: string[];
  onEnregistrer: (c: ContenuFiche) => void;
  onAnnuler: () => void;
}) {
  const id = useId();
  const [c, setC] = useState<ContenuFiche>(() => initial ? JSON.parse(JSON.stringify(initial)) : vide());
  const [motsCles, setMotsCles] = useState(() => (initial?.keywords ?? []).join(", "));
  const fiche: ContenuFiche = { ...c, keywords: motsCles.split(",").map((k) => k.trim()).filter(Boolean) };
  const erreurs = erreursContenu(fiche);
  const ok = Object.keys(erreurs).length === 0;
  const maj = (p: Partial<ContenuFiche>) => setC((x) => ({ ...x, ...p }));
  const majVariable = (i: number, p: Partial<ContenuFiche["variables"][number]>) =>
    maj({ variables: c.variables.map((v, j) => (j === i ? { ...v, ...p } : v)) });

  const champ = (cle: keyof ContenuFiche, libelle: string, enfant: React.ReactNode, aide?: string) => (
    <label className="ui-champ ui-champ-etiquette">
      <span className="ui-champ-libelle">{libelle}</span>
      {enfant}
      {erreurs[cle] && <span className="ui-champ-erreur" role="alert">{erreurs[cle]}</span>}
      {aide && !erreurs[cle] && <span className="ui-champ-aide">{aide}</span>}
    </label>
  );

  return (
    <form className="frm-editeur" aria-label={titre}
      onSubmit={(e) => { e.preventDefault(); if (ok) onEnregistrer(fiche); }}>
      <h2 className="frm-editeur-titre">{titre}</h2>
      <p className="frm-editeur-avis" role="note">
        Modifier une fiche ne change pas les calculs du site : la fiche fx d&apos;un résultat montre toujours la formule utilisée par le calculateur.
      </p>

      {champ("title", "Titre", <input className="field-input" maxLength={BORNES.titre} value={c.title} onChange={(e) => maj({ title: e.target.value })} />)}
      {champ("section", "Section",
        <>
          <input className="field-input" list={`${id}-sections`} maxLength={BORNES.section} value={c.section} onChange={(e) => maj({ section: e.target.value })} />
          <datalist id={`${id}-sections`}>{sections.map((s) => <option key={s} value={s} />)}</datalist>
        </>,
        "Choisissez une section existante, ou saisissez-en une nouvelle.")}
      {champ("equationLatex", "Équation (LaTeX)",
        <textarea className="field-input frm-editeur-latex" rows={3} maxLength={BORNES.equation} value={c.equationLatex}
          onChange={(e) => maj({ equationLatex: e.target.value })} placeholder="M_b = B_w \cdot M_t" />)}
      <div className="frm-editeur-apercu" aria-label="Aperçu de l'équation">
        {c.equationLatex.trim() ? <KaTeX tex={c.equationLatex} displayMode /> : <span className="classe-rien">Aperçu de l&apos;équation</span>}
      </div>
      {champ("equationPlainText", "Équation en texte brut (facultatif)",
        <input className="field-input" maxLength={BORNES.texte} value={c.equationPlainText} onChange={(e) => maj({ equationPlainText: e.target.value })} />)}

      <fieldset className="frm-editeur-variables">
        <legend className="ui-champ-libelle">Variables</legend>
        {c.variables.map((v, i) => (
          <div key={i} className="frm-editeur-variable">
            <input className="field-input" aria-label={`Symbole de la variable ${i + 1} (LaTeX)`} placeholder="B_w" maxLength={BORNES.symbole}
              value={v.symbol} onChange={(e) => majVariable(i, { symbol: e.target.value })} />
            <input className="field-input" aria-label={`Description de la variable ${i + 1}`} placeholder="Taux massique de liant" maxLength={BORNES.description}
              value={v.description} onChange={(e) => majVariable(i, { description: e.target.value })} />
            <input className="field-input" aria-label={`Unité de la variable ${i + 1}`} placeholder="unité" maxLength={BORNES.unite}
              value={v.unit ?? ""} onChange={(e) => majVariable(i, { unit: e.target.value || null })} />
            <button type="button" className="btn-discret btn-danger" onClick={() => maj({ variables: c.variables.filter((_, j) => j !== i) })}>Retirer</button>
          </div>
        ))}
        {erreurs.variables && <span className="ui-champ-erreur" role="alert">{erreurs.variables}</span>}
        {c.variables.length < BORNES.variables && (
          <button type="button" className="btn-secondary" onClick={() => maj({ variables: [...c.variables, { symbol: "", description: "", unit: null }] })}>
            Ajouter une variable
          </button>
        )}
      </fieldset>

      {champ("contextSnippet", "Explication (facultatif)",
        <textarea className="field-input" rows={4} maxLength={BORNES.contexte} value={c.contextSnippet} onChange={(e) => maj({ contextSnippet: e.target.value })} />)}
      {champ("keywords", "Mots-clés (facultatif)",
        <input className="field-input" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} placeholder="liant, dosage" />,
        "Séparés par des virgules ; ils servent à la recherche.")}

      <div className="frm-editeur-actions">
        <button type="submit" className="btn-primary" disabled={!ok}>Enregistrer</button>
        <button type="button" className="btn-secondary" onClick={onAnnuler}>Annuler</button>
        {!ok && <span className="ui-champ-erreur">Corrigez les champs signalés.</span>}
      </div>
    </form>
  );
}
