// Section « Glossaire et essais normalisés » du Guide. Composant SANS hook :
// le Guide est un composant serveur. Tout le contenu vient de lib/glossaire.ts,
// la même source que les libellés de l'application.

import { ESSAIS_NORMALISES, glossaireParCategorie } from "@/lib/glossaire";

const th: React.CSSProperties = { textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6e6e73", padding: "8px 10px", borderBottom: "1px solid #e5e5ea" };
const td: React.CSSProperties = { fontSize: 13, color: "#1d1d1f", padding: "9px 10px", borderBottom: "1px solid #f0f0f3", verticalAlign: "top", lineHeight: 1.55 };

export default function SectionGlossaire() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65, margin: 0 }}>
        Les termes employés dans l&apos;application sont ceux du cours (chapitre 4) et des feuilles de
        calcul de l&apos;enseignant ; chaque entrée indique sa source (« dia » = numéro de diapositive).
        Le cours ne cite pas de norme d&apos;essai : celles indiquées ici sont les normes usuelles de la
        pratique nord-américaine (ASTM, CSA) et restent à confirmer par l&apos;enseignant pour le
        laboratoire.
      </p>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Essais normalisés</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>Essai</th><th style={th}>Norme</th><th style={th}>Dans l&apos;application</th></tr>
            </thead>
            <tbody>
              {ESSAIS_NORMALISES.map((e) => (
                <tr key={e.essai}>
                  <td style={{ ...td, fontWeight: 600 }}>{e.essai}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {e.normes.map((n) => <div key={n.code} title={n.titre}>{n.code}</div>)}
                  </td>
                  <td style={td}>{e.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {glossaireParCategorie().map(({ categorie, entrees }) => (
        <div key={categorie}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>{categorie}</h3>
          <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {entrees.map((e) => (
              <div key={e.cle} id={`glossaire-${e.cle}`}>
                <dt style={{ fontSize: 13.5, fontWeight: 600, color: "#1d1d1f" }}>
                  {e.terme}
                  {e.symbole && <span style={{ fontWeight: 400, color: "#6e6e73" }}> · {e.symbole}</span>}
                  {e.unite && <span style={{ fontWeight: 400, color: "#6e6e73" }}> ({e.unite})</span>}
                </dt>
                <dd style={{ margin: "2px 0 0", fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
                  {e.definition}
                  {e.synonymes && e.synonymes.length > 0 && (
                    <span style={{ color: "#6e6e73" }}> Aussi : {e.synonymes.join(", ")}.</span>
                  )}
                  {e.normes && e.normes.length > 0 && (
                    <span style={{ color: "#6e6e73" }}> Norme : {e.normes.map((n) => n.code).join(", ")}.</span>
                  )}
                  <span style={{ display: "block", fontSize: 12, color: "#86868b", marginTop: 2 }}>Source : {e.source}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
