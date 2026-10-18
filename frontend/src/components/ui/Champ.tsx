// Champ de formulaire : libellé au-dessus, saisie grise arrondie, unité à
// droite dans le champ, aide dessous. Le contrôle est fourni en enfant
// (input, select, ChampNombre). En erreur, le message est annoncé
// (role="alert") et relié à la saisie : `aria-invalid` et `aria-describedby`
// sont posés sur l'enfant direct (input, select, textarea ou ChampNombre).

import { cloneElement, isValidElement, useId } from "react";
import ChampNombre from "./ChampNombre";

const SAISIES_NATIVES = new Set(["input", "select", "textarea"]);

/** L'enfant direct, avec les attributs d'erreur quand c'est une saisie connue. */
function saisieEnErreur(enfant: React.ReactNode, idMessage: string): React.ReactNode {
  if (!isValidElement(enfant)) return enfant;
  if (enfant.type === ChampNombre) {
    return cloneElement(enfant as React.ReactElement<{ ariaInvalid?: boolean; ariaDescribedby?: string }>, { ariaInvalid: true, ariaDescribedby: idMessage });
  }
  if (typeof enfant.type === "string" && SAISIES_NATIVES.has(enfant.type)) {
    return cloneElement(enfant as React.ReactElement<Record<string, unknown>>, { "aria-invalid": true, "aria-describedby": idMessage });
  }
  return enfant;
}

export function Champ({ libelle, unite, aide, children, htmlFor, erreur, avis }: {
  libelle: React.ReactNode;
  unite?: React.ReactNode;
  aide?: React.ReactNode;
  children?: React.ReactNode;
  /** Id du contrôle (sinon l'étiquette l'enveloppe). */
  htmlFor?: string;
  erreur?: React.ReactNode;
  /** Avis doux (valeur inhabituelle), jamais un blocage. */
  avis?: React.ReactNode;
}) {
  const idMessage = useId();
  const corps = (
    <>
      <span className="ui-champ-libelle">{libelle}</span>
      <span className={unite ? "ui-champ-saisie ui-champ-avec-unite" : "ui-champ-saisie"}>
        {erreur ? saisieEnErreur(children, idMessage) : children}
        {unite && <span className="ui-champ-unite" aria-hidden="true">{unite}</span>}
      </span>
      {erreur && <span id={idMessage} className="ui-champ-erreur" role="alert">{erreur}</span>}
      {!erreur && avis && <span className="ui-champ-avis" role="status">{avis}</span>}
      {aide && <span className="ui-champ-aide">{aide}</span>}
    </>
  );
  return htmlFor
    ? <div className="ui-champ"><label htmlFor={htmlFor} className="ui-champ-etiquette">{corps}</label></div>
    : <label className="ui-champ ui-champ-etiquette">{corps}</label>;
}
