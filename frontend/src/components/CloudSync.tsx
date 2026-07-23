"use client";

import { useEffect } from "react";
import { useStore, migrerCatalogueLiantsCloud, migrerMateriauxCloud } from "@/lib/store";
import type { MaterialKind } from "@/lib/materials";
import { getSupabase, type UserRole } from "@/lib/supabase";
import {
  fetchCatalogueOfficiel, listerResultatsCloud, upsertResultatCloud,
  fusionnerResultats, type CatalogueCloudId,
} from "@/lib/cloud";

const MATERIAL_KINDS: { id: CatalogueCloudId; kind: MaterialKind }[] = [
  { id: "residus", kind: "residus" },
  { id: "granulats", kind: "granulats" },
  { id: "retardateurs", kind: "retardateurs" },
];

/**
 * Composant sans rendu, monté dans le layout. Gère la session Supabase et la
 * synchronisation (catalogues officiels + résultats) après connexion. Inerte si
 * la synchronisation n'est pas configurée (getSupabase() -> null).
 */
export default function CloudSync() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let annule = false;

    const synchroniser = async (userId: string, email: string | null) => {
      // 1) Profil / rôle. En cas d'échec de lecture on retombe sur
      // « etudiant » (jamais d'escalade), mais on le SIGNALE en console :
      // un échec silencieux ici a déjà coûté un long diagnostic.
      const { data: profil, error: erreurProfil } = await sb
        .from("profiles").select("role").eq("id", userId).maybeSingle();
      if (erreurProfil) {
        console.warn("MineBackfill : lecture du profil impossible —", erreurProfil.message);
      }
      const role = ((profil as { role?: UserRole } | null)?.role ?? "etudiant") as UserRole;
      if (annule) return;
      useStore.getState().setSession({ userId, email, role });

      // 2) Catalogues officiels : remplacent la couche officielle locale.
      // - PAS pour le prof : il est la SOURCE des officiels — ré-appliquer la
      //   copie cloud écraserait ses modifications non encore publiées (le
      //   sync se déclenche aussi au rafraîchissement de jeton, ~1 h).
      // - Enveloppes validées/migrées par version (migrer*Cloud) : une ligne
      //   malformée, vide ou publiée par un client plus récent est ignorée.
      // - Étape isolée : son échec ne doit jamais empêcher la synchronisation
      //   des résultats (étape 3).
      if (role !== "prof") {
        try {
          const liants = migrerCatalogueLiantsCloud(await fetchCatalogueOfficiel(sb, "liants"));
          if (annule) return;
          if (liants) useStore.getState().hydraterLiantsOfficielsCloud(liants);
          for (const { id, kind } of MATERIAL_KINDS) {
            const items = migrerMateriauxCloud(await fetchCatalogueOfficiel(sb, id));
            if (annule) return;
            if (items) useStore.getState().hydraterMateriauxOfficielsCloud(kind, items);
          }
        } catch {
          /* catalogue illisible : on continue — les résultats restent synchronisés */
        }
      }
      // Constantes : PAS d'écrasement automatique (éditables) — un bandeau
      // « Appliquer » dans Réglages est prévu (v1.1) ; ici on ne touche à rien.

      // 3) Résultats : fusion locale+cloud, puis pousser les manquants.
      try {
        const cloud = await listerResultatsCloud(sb);
        if (annule) return;
        // Défensif : re-hydrate depuis localStorage juste avant la fusion. Le
        // StoreHydrator l'a normalement déjà fait (montage synchrone avant tout
        // callback réseau), mais la fusion ÉCRASE le stockage local — on ne
        // prend aucun risque d'ordre d'initialisation (perte de données sinon).
        useStore.getState().loadSavedResults();
        const locaux = useStore.getState().savedResults;
        const { fusionnes, aPousser } = fusionnerResultats(locaux, cloud);
        useStore.getState().remplacerResultats(fusionnes);
        // Anti-réattribution : ne jamais pousser sous SON compte un résultat
        // appartenant à quelqu'un d'autre (navigateur partagé, import de
        // sauvegarde, résultats d'étudiants fusionnés chez le prof).
        for (const entry of aPousser.filter((r) => !r.ownerId || r.ownerId === userId)) {
          upsertResultatCloud(sb, userId, { ...entry, ownerId: userId }).catch(() => {});
        }
      } catch {
        /* échec réseau : le localStorage reste la vérité, on réessaiera */
      }
    };

    const { data: sub } = sb.auth.onAuthStateChange((event, sessionSb) => {
      if (event === "SIGNED_OUT") {
        useStore.getState().setSession(null);
        return;
      }
      const u = sessionSb?.user;
      if (u && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        // Recommandation officielle Supabase : ne pas awaiter d'appels
        // supabase-js DANS ce callback (verrou interne auth-js, risque de
        // blocage dans le navigateur) — on diffère d'un tick.
        setTimeout(() => {
          synchroniser(u.id, u.email ?? null).catch(() => {});
        }, 0);
      }
    });

    return () => { annule = true; sub.subscription.unsubscribe(); };
  }, []);

  return null;
}
