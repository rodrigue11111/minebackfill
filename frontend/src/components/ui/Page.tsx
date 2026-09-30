// Cadre d'une page : conteneur défilant (un défilement par page, sous la barre
// haute) et en-tête à grand titre. Sans hook : utilisable par le Guide.

import Link from "next/link";
import { Icone } from "./Icones";

/**
 * Conteneur défilant d'une page, contenu centré (1160 px au plus).
 * `large` retire la largeur maximale (tableaux très larges).
 */
export function Page({ children, large = false, etroite = false }: {
  children: React.ReactNode;
  large?: boolean;
  /** Pages de lecture (Guide, Compte) : 900 px. */
  etroite?: boolean;
}) {
  return (
    <div className="ui-page">
      <div className={`ui-page-contenu${large ? " ui-page-large" : ""}${etroite ? " ui-page-etroite" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export function EnTetePage({ surtitre, titre, sousTitre, actions, retour, pastille, taille = "grand" }: {
  surtitre?: React.ReactNode;
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  /** Boutons à droite du titre (passent sous le titre sur téléphone). */
  actions?: React.ReactNode;
  /** Lien de retour au-dessus du titre (« ‹ Gâchées »). */
  retour?: { href: string; libelle: string };
  /** Pastille collée au titre (statut). */
  pastille?: React.ReactNode;
  /** « moyen » : titre de 44 px (page de détail). */
  taille?: "grand" | "moyen";
}) {
  return (
    <header className="ui-entete">
      {retour && (
        <Link href={retour.href} className="ui-retour">
          <Icone nom="retour" taille={14} epaisseur={2.4} />
          {retour.libelle}
        </Link>
      )}
      <div className="ui-entete-ligne">
        <div className="ui-entete-texte">
          {surtitre && <div className="ui-surtitre">{surtitre}</div>}
          <div className="ui-entete-titre">
            <h1 className={taille === "moyen" ? "ui-titre-page ui-titre-moyen" : "ui-titre-page"}>{titre}</h1>
            {pastille}
          </div>
          {sousTitre && <p className="ui-sous-titre">{sousTitre}</p>}
        </div>
        {actions && <div className="ui-entete-actions">{actions}</div>}
      </div>
    </header>
  );
}
