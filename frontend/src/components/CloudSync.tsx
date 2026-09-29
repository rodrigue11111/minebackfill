"use client";

import { useEffect } from "react";
import { useStore, migrerCatalogueLiantsCloud, migrerMateriauxCloud } from "@/lib/store";
import type { MaterialKind } from "@/lib/materials";
import { getSupabase, type UserRole } from "@/lib/supabase";
import { fetchCatalogueOfficiel, type CatalogueCloudId } from "@/lib/cloud";
import { connecterSynchro, deconnecterSynchro } from "@/lib/sync-client";
import { validerSessions } from "@/lib/sessions";

const MATERIAL_KINDS: { id: CatalogueCloudId; kind: MaterialKind }[] = [
  { id: "residus", kind: "residus" },
  { id: "granulats", kind: "granulats" },
  { id: "retardateurs", kind: "retardateurs" },
];

/**
 * Composant sans rendu, monté dans le layout. Gère la session Supabase : rôle,
 * catalogues officiels, et démarrage de la synchronisation du travail (v2,
 * sync-client.ts). Inerte si Supabase n'est pas configuré ou si le mode test
 * est actif (getSupabase() -> null).
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
        .from("profiles").select("role, display_name").eq("id", userId).maybeSingle();
      if (erreurProfil) {
        console.warn("MineBackfill : lecture du profil impossible —", erreurProfil.message);
      }
      const p = profil as { role?: UserRole; display_name?: string | null } | null;
      const role = (p?.role ?? "etudiant") as UserRole;
      if (annule) return;
      useStore.getState().setSession({ userId, email, role, displayName: p?.display_name ?? null });

      // 2) Catalogues officiels : remplacent la couche officielle locale.
      // - PAS pour le prof : il est la SOURCE des officiels — ré-appliquer la
      //   copie cloud écraserait ses modifications non encore publiées (le
      //   sync se déclenche aussi au rafraîchissement de jeton, ~1 h).
      // - Enveloppes validées/migrées par version (migrer*Cloud) : une ligne
      //   malformée, vide ou publiée par un client plus récent est ignorée.
      // - Étape isolée : son échec ne doit jamais empêcher la synchronisation
      //   du travail (étape 3).
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
          // Sessions de cours : la liste publiée remplace la copie locale. Une
          // enveloppe d'une version inconnue (client plus récent) est ignorée.
          const sessions = await fetchCatalogueOfficiel(sb, "sessions");
          if (annule) return;
          if (sessions?.v === 1 && Array.isArray(sessions.data)) {
            useStore.getState().definirSessions(validerSessions(sessions.data));
          }
        } catch {
          /* catalogue illisible : on continue — le travail reste synchronisé */
        }
      }
      // Constantes : PAS d'écrasement automatique (éditables) — un bandeau
      // « Appliquer » dans Réglages est prévu (v1.1) ; ici on ne touche à rien.

      // 3) Travail (résultats, gâchées) : synchronisation v2. Elle décide
      // elle-même de la liaison du stockage local à ce compte, et ne fait rien
      // si elle tourne déjà (rafraîchissement de jeton). Chez l'enseignant, ce
      // sont SES documents : ceux de la classe se lisent ailleurs, en mémoire.
      connecterSynchro(sb, userId);
    };

    const { data: sub } = sb.auth.onAuthStateChange((event, sessionSb) => {
      if (event === "SIGNED_OUT") {
        // Les données locales restent : seule la synchronisation s'arrête.
        deconnecterSynchro();
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

    return () => { annule = true; sub.subscription.unsubscribe(); deconnecterSynchro(); };
  }, []);

  return null;
}
