// Liste groupée façon réglages : lignes à filets, libellé à gauche, valeur ou
// champ à droite, chevron quand la ligne mène ailleurs. Sans hook.

import Link from "next/link";
import { Icone } from "./Icones";

export function ListeGroupee({ titre, pied, children, encadree = false }: {
  titre?: React.ReactNode;
  /** Note sous la liste. */
  pied?: React.ReactNode;
  children?: React.ReactNode;
  /** Dans son propre cadre blanc (hors d'une Carte). */
  encadree?: boolean;
}) {
  return (
    <div className="ui-liste-bloc">
      {titre && <div className="ui-liste-titre">{titre}</div>}
      <div className={encadree ? "ui-liste ui-liste-encadree" : "ui-liste"}>{children}</div>
      {pied && <div className="ui-liste-pied">{pied}</div>}
    </div>
  );
}

export function LigneListe({ libelle, detail, valeur, href, chevron, children, accent, htmlFor }: {
  libelle: React.ReactNode;
  /** Deuxième ligne discrète sous le libellé. */
  detail?: React.ReactNode;
  /** Valeur en lecture, à droite. */
  valeur?: React.ReactNode;
  /** La ligne entière mène à cette page. */
  href?: string;
  /** Chevron à droite (implicite avec href). */
  chevron?: boolean;
  /** Contrôle à droite (champ, interrupteur, bouton). */
  children?: React.ReactNode;
  /** Élément devant le libellé (pastille de couleur, icône). */
  accent?: React.ReactNode;
  /** Le libellé devient l'étiquette de ce champ. */
  htmlFor?: string;
}) {
  const gauche = (
    <span className="ui-ligne-gauche">
      {accent}
      <span className="ui-ligne-textes">
        {htmlFor ? <label htmlFor={htmlFor} className="ui-ligne-libelle">{libelle}</label> : <span className="ui-ligne-libelle">{libelle}</span>}
        {detail && <span className="ui-ligne-detail">{detail}</span>}
      </span>
    </span>
  );
  const droite = (
    <span className="ui-ligne-droite">
      {valeur !== undefined && <span className="ui-ligne-valeur">{valeur}</span>}
      {children}
      {(chevron || href) && <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>}
    </span>
  );
  if (href) {
    return <Link href={href} className="ui-ligne ui-ligne-lien">{gauche}{droite}</Link>;
  }
  return <div className="ui-ligne">{gauche}{droite}</div>;
}
