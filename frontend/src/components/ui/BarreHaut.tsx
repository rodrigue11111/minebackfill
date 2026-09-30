"use client";

// Barre haute (52 px) : marque à gauche, liens centrés en petit texte, portail
// et pastille du compte à droite. Sous 1080 px, les liens secondaires passent
// dans le menu « Plus » ; sous 720 px, la barre d'onglets du bas prend le
// relais (BarreOnglets). Les survols sont en CSS.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { APP_NAME, PORTAIL_LABEL, PORTAIL_URL } from "@/lib/branding";
import { useStore } from "@/lib/store";
import { cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";
import { abonnerSync, instantaneSync, instantaneSyncServeur, type InstantaneSync } from "@/lib/sync-client";
import { estActif, initiales, LIEN_COMPTE, liensNavigation, prenom } from "@/lib/navigation";
import { Icone, Marque } from "./Icones";
import Menu from "./Menu";
import type { TonPastille } from "./Pastille";

/** Liens gardés dans la barre sous 1080 px ; les autres vont dans « Plus ». */
const PRINCIPAUX = new Set(["/", "/mix", "/labo", "/classe", "/historique"]);

/** Pastille de la sauvegarde en ligne : ton et libellé (infobulle). */
export function pastilleSynchro(s: InstantaneSync): { ton: TonPastille; libelle: string } | null {
  if (s.liaison !== "synchroniser") return null;
  switch (s.statut) {
    case "a_jour": return { ton: "succes", libelle: "Sauvegarde en ligne : à jour" };
    case "en_cours": return { ton: "accent", libelle: "Sauvegarde en ligne : en cours" };
    case "en_attente": return { ton: "alerte", libelle: `Sauvegarde en ligne : ${s.enAttente} modification(s) en attente` };
    case "hors_ligne": return { ton: "neutre", libelle: "Hors ligne : vos modifications partiront au retour du réseau" };
    case "pause": return { ton: "danger", libelle: "Sauvegarde en ligne en pause (activité anormale), reprise automatique" };
    case "erreur": return { ton: "danger", libelle: "Sauvegarde en ligne : erreur — voir la page Compte" };
    default: return null;
  }
}

/** Pastille du compte (barre haute et feuille « Plus »). */
export function useCompte() {
  const session = useStore((s) => s.session);
  // Anti-mismatch d'hydratation : le compte n'est rendu qu'après
  // l'hydratation, et seulement si la synchronisation est configurée.
  const afficher = useHydrated() && cloudConfigure();
  const synchro = useSyncExternalStore(abonnerSync, instantaneSync, instantaneSyncServeur);
  const pastille = session ? pastilleSynchro(synchro) : null;
  return { session, afficher, synchro, pastille };
}

export default function BarreHaut() {
  const pathname = usePathname();
  const { session, afficher, synchro, pastille } = useCompte();
  const liens = liensNavigation(session?.role);
  const nonLues = synchro.reponsesNonLues ?? 0;
  const secondaires = liens.filter((l) => !PRINCIPAUX.has(l.href));

  return (
    <header className="ui-barre-haut">
      <Link href="/" className="ui-barre-marque" aria-label={`${APP_NAME}, accueil`}>
        <Marque />
        {APP_NAME}
      </Link>

      <nav className="ui-barre-liens" aria-label="Navigation principale">
        {liens.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={estActif(pathname, l.href) ? "page" : undefined}
            className={PRINCIPAUX.has(l.href) ? "ui-barre-lien" : "ui-barre-lien ui-barre-lien-secondaire"}
          >
            {l.label}
            {l.href === "/classe" && nonLues > 0 && (
              <span className="ui-badge-compteur" title="Réponses d'étudiants pas encore lues">{nonLues}</span>
            )}
          </Link>
        ))}
        <span className="ui-barre-plus">
          <Menu
            className="ui-barre-lien"
            declencheur={<>Plus <Icone nom="chevron" taille={11} epaisseur={2.4} /></>}
            aligner="gauche"
            elements={secondaires.map((l) => ({ libelle: l.label, href: l.href }))}
          />
        </span>
      </nav>

      <div className="ui-barre-droite">
        <a className="ui-barre-portail" href={PORTAIL_URL} title="Portail des projets — basculer vers une autre application">
          <Icone nom="portail" taille={16} />
          <span className="ui-barre-portail-libelle">{PORTAIL_LABEL}</span>
        </a>
        {afficher && (
          <Link
            href={LIEN_COMPTE.href}
            className="ui-compte"
            aria-current={estActif(pathname, LIEN_COMPTE.href) ? "page" : undefined}
            title={session
              ? `${session.displayName || session.email} (${session.role === "prof" ? "Enseignant" : "Étudiant"})${pastille ? ` — ${pastille.libelle}` : ""}`
              : "Se connecter"}
          >
            <span className={`ui-compte-initiales${session ? (session.role === "prof" ? " ui-compte-initiales-prof" : "") : " ui-compte-initiales-vide"}`}>
              {session ? initiales(session.displayName, session.email) : <Icone nom="compte" taille={13} epaisseur={2.2} />}
            </span>
            <span className="ui-compte-prenom">
              {session ? prenom(session.displayName, session.role === "prof" ? "Enseignant" : "Compte") : "Se connecter"}
            </span>
            {pastille && <span className={`ui-point ui-point-${pastille.ton}`} aria-label={pastille.libelle} role="img" />}
          </Link>
        )}
      </div>
    </header>
  );
}
