"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { LiantCatalogueItem } from "@/lib/store";
import type { MaterialItem, MaterialKind } from "@/lib/materials";
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
      // 1) Profil / rôle.
      const { data: profil } = await sb
        .from("profiles").select("role").eq("id", userId).maybeSingle();
      const role = ((profil as { role?: UserRole } | null)?.role ?? "etudiant") as UserRole;
      if (annule) return;
      useStore.getState().setSession({ userId, email, role });

      // 2) Catalogues officiels : remplacent la couche officielle locale.
      const liants = await fetchCatalogueOfficiel(sb, "liants");
      if (!annule && liants?.data) {
        useStore.getState().hydraterLiantsOfficielsCloud(liants.data as LiantCatalogueItem[]);
      }
      for (const { id, kind } of MATERIAL_KINDS) {
        const env = await fetchCatalogueOfficiel(sb, id);
        if (!annule && env?.data) {
          useStore.getState().hydraterMateriauxOfficielsCloud(kind, env.data as MaterialItem[]);
        }
      }
      // Constantes : PAS d'écrasement automatique (éditables) — un bandeau
      // « Appliquer » dans Réglages est prévu (v1.1) ; ici on ne touche à rien.

      // 3) Résultats : fusion locale+cloud, puis pousser les manquants.
      const cloud = await listerResultatsCloud(sb);
      if (annule) return;
      const locaux = useStore.getState().savedResults;
      const { fusionnes, aPousser } = fusionnerResultats(locaux, cloud);
      useStore.getState().remplacerResultats(fusionnes);
      for (const entry of aPousser) {
        upsertResultatCloud(sb, userId, entry).catch(() => {});
      }
    };

    const { data: sub } = sb.auth.onAuthStateChange((event, sessionSb) => {
      if (event === "SIGNED_OUT") {
        useStore.getState().setSession(null);
        return;
      }
      const u = sessionSb?.user;
      if (u && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        synchroniser(u.id, u.email ?? null).catch(() => {});
      }
    });

    return () => { annule = true; sub.subscription.unsubscribe(); };
  }, []);

  return null;
}
