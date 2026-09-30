"use client";

// Barre d'onglets du téléphone (≤ 720 px, affichée par CSS) : quatre onglets
// selon le rôle, puis « Plus » qui ouvre une feuille avec le reste, le compte,
// le portail et la version.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME_VERSION, MODULE_ID, PORTAIL_URL } from "@/lib/branding";
import { estActif, LIEN_COMPTE, ongletsTelephone } from "@/lib/navigation";
import { useCompte } from "./BarreHaut";
import Feuille from "./Feuille";
import { Icone } from "./Icones";

export default function BarreOnglets() {
  const pathname = usePathname();
  const { session, afficher, synchro, pastille } = useCompte();
  const [plus, setPlus] = useState(false);
  const { onglets, plus: autres } = ongletsTelephone(session?.role);
  const nonLues = synchro.reponsesNonLues ?? 0;
  const plusActif = autres.some((l) => estActif(pathname, l.href)) || estActif(pathname, LIEN_COMPTE.href);

  return (
    <>
      <nav className="ui-onglets" aria-label="Navigation principale">
        {onglets.map((l) => (
          <Link key={l.href} href={l.href} className="ui-onglet" aria-current={estActif(pathname, l.href) ? "page" : undefined}>
            <Icone nom={l.icone} taille={24} epaisseur={estActif(pathname, l.href) ? 2 : 1.8} />
            {l.label}
            {l.href === "/classe" && nonLues > 0 && <span className="ui-badge-compteur">{nonLues}</span>}
          </Link>
        ))}
        <button type="button" className="ui-onglet" aria-current={plusActif ? "page" : undefined} aria-haspopup="dialog" onClick={() => setPlus(true)}>
          <Icone nom="plus" taille={24} epaisseur={2} />
          Plus
        </button>
      </nav>

      <Feuille ouverte={plus} onFermer={() => setPlus(false)} titre="Plus">
        <div className="ui-liste ui-plus-liens">
          {autres.map((l) => (
            <Link key={l.href} href={l.href} className="ui-ligne ui-ligne-lien" onClick={() => setPlus(false)}
              aria-current={estActif(pathname, l.href) ? "page" : undefined}>
              <span className="ui-ligne-gauche"><Icone nom={l.icone} taille={20} /><span className="ui-ligne-libelle">{l.label}</span></span>
              <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
            </Link>
          ))}
          {afficher && (
            <Link href={LIEN_COMPTE.href} className="ui-ligne ui-ligne-lien" onClick={() => setPlus(false)}>
              <span className="ui-ligne-gauche">
                <Icone nom="compte" taille={20} />
                <span className="ui-ligne-textes">
                  <span className="ui-ligne-libelle">{session ? (session.displayName || session.email || "Compte") : "Se connecter"}</span>
                  {pastille && <span className="ui-ligne-detail">{pastille.libelle}</span>}
                </span>
              </span>
              <span className="ui-ligne-droite">
                {pastille && <span className={`ui-point ui-point-${pastille.ton}`} />}
                <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
              </span>
            </Link>
          )}
          <a href={PORTAIL_URL} className="ui-ligne ui-ligne-lien">
            <span className="ui-ligne-gauche"><Icone nom="portail" taille={20} /><span className="ui-ligne-libelle">Portail des projets</span></span>
            <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
          </a>
        </div>
        <p className="ui-plus-version">{APP_NAME_VERSION} · {MODULE_ID}</p>
      </Feuille>
    </>
  );
}
