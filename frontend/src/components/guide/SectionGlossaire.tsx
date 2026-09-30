// Section « Glossaire et essais normalisés » du Guide. Composant SANS hook :
// le Guide est un composant serveur. Tout le contenu vient de lib/glossaire.ts,
// la même source que les libellés de l'application.

import { ESSAIS_NORMALISES, glossaireParCategorie } from "@/lib/glossaire";

export default function SectionGlossaire() {
  return (
    <div className="lecture-pile">
      <p>
        Les termes employés dans l&apos;application sont ceux du cours (chapitre 4) et des feuilles de
        calcul de l&apos;enseignant ; chaque entrée indique sa source (« dia » = numéro de diapositive).
        Le cours ne cite pas de norme d&apos;essai : celles indiquées ici sont les normes usuelles de la
        pratique nord-américaine (ASTM, CSA) et restent à confirmer par l&apos;enseignant pour le
        laboratoire.
      </p>

      <div>
        <h3 className="lecture-sous-titre">Essais normalisés</h3>
        <div className="mix-tableau-defilant">
          <table className="result-table lecture-table">
            <thead>
              <tr><th>Essai</th><th>Norme</th><th>Dans l&apos;application</th></tr>
            </thead>
            <tbody>
              {ESSAIS_NORMALISES.map((e) => (
                <tr key={e.essai}>
                  <td style={{ fontWeight: 600 }}>{e.essai}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {e.normes.map((n) => <div key={n.code} title={n.titre}>{n.code}</div>)}
                  </td>
                  <td>{e.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {glossaireParCategorie().map(({ categorie, entrees }) => (
        <div key={categorie}>
          <h3 className="lecture-sous-titre">{categorie}</h3>
          <dl className="lecture-glossaire">
            {entrees.map((e) => (
              <div key={e.cle} id={`glossaire-${e.cle}`}>
                <dt>
                  {e.terme}
                  {e.symbole && <span className="lecture-discret"> · {e.symbole}</span>}
                  {e.unite && <span className="lecture-discret"> ({e.unite})</span>}
                </dt>
                <dd>
                  {e.definition}
                  {e.synonymes && e.synonymes.length > 0 && (
                    <span className="lecture-discret"> Aussi : {e.synonymes.join(", ")}.</span>
                  )}
                  {e.normes && e.normes.length > 0 && (
                    <span className="lecture-discret"> Norme : {e.normes.map((n) => n.code).join(", ")}.</span>
                  )}
                  <span className="lecture-source">Source : {e.source}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
