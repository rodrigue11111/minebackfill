// Champ de formulaire : libellé au-dessus, saisie grise arrondie, unité à
// droite dans le champ, aide dessous. Sans hook : le contrôle est fourni en
// enfant (input, select, ChampNombre).

export function Champ({ libelle, unite, aide, children, htmlFor, erreur }: {
  libelle: React.ReactNode;
  unite?: React.ReactNode;
  aide?: React.ReactNode;
  children: React.ReactNode;
  /** Id du contrôle (sinon l'étiquette l'enveloppe). */
  htmlFor?: string;
  erreur?: React.ReactNode;
}) {
  const corps = (
    <>
      <span className="ui-champ-libelle">{libelle}</span>
      <span className={unite ? "ui-champ-saisie ui-champ-avec-unite" : "ui-champ-saisie"}>
        {children}
        {unite && <span className="ui-champ-unite" aria-hidden="true">{unite}</span>}
      </span>
      {erreur && <span className="ui-champ-erreur">{erreur}</span>}
      {aide && <span className="ui-champ-aide">{aide}</span>}
    </>
  );
  return htmlFor
    ? <div className="ui-champ"><label htmlFor={htmlFor} className="ui-champ-etiquette">{corps}</label></div>
    : <label className="ui-champ ui-champ-etiquette">{corps}</label>;
}
