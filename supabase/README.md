# Synchronisation en ligne (Supabase) — optionnelle

MineBackfill fonctionne **à 100 % en local** sans aucune configuration : tout
est enregistré dans le navigateur (localStorage). Cette couche Supabase ajoute,
**si elle est configurée**, des comptes étudiants, des catalogues officiels
publiés par l'enseignant, et la sauvegarde des résultats en ligne.

Sans les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, l'application est strictement identique à
aujourd'hui (le lien « Compte » est masqué, aucun appel réseau).

## Architecture

- `@supabase/supabase-js` parle directement à `https://<ref>.supabase.co` depuis
  le navigateur. La sécurité est assurée par les **politiques RLS** de Postgres
  (l'anon key est publique par conception).
- **Le backend FastAPI ne change pas** : il reste un calculateur pur. Aucun
  secret serveur, aucune nouvelle route.
- Frontière assumée : « seul le prof édite les officiels » vit dans les
  politiques RLS (le modèle est minuscule : 3 tables).

## Mise en place (enseignant, une seule fois)

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. **SQL Editor** → coller et exécuter [`schema.sql`](./schema.sql).
3. **Authentication → Providers → Email** : **désactiver « Confirm email »**
   (sinon chaque étudiant attend un courriel, or le SMTP intégré est limité à
   ~2 courriels/heure — inutilisable pour une classe).
4. **Settings → API** : copier `Project URL` et `anon public key`, puis les
   placer dans :
   - `frontend/.env.local` (développement) — voir `frontend/.env.example` ;
   - les variables d'environnement du projet Vercel (production), **puis
     redéployer** : les `NEXT_PUBLIC_*` sont inlinées au build.
5. Créer le **compte enseignant** via la page `/compte` (inscription normale).
6. **SQL Editor** (one-off) — promouvoir ce compte :
   ```sql
   update public.profiles set role = 'prof' where email = 'VOTRE_EMAIL';
   ```
   Se déconnecter/reconnecter pour rafraîchir le rôle.
7. **Réglages** → publier les catalogues officiels et les constantes (seed
   initial ; en l'absence de ligne cloud, chaque client garde ses défauts).

## Quotas & pièges de l'offre gratuite

- **Le projet est mis en pause après ~7 jours d'inactivité** — l'enseignant le
  réveille depuis le tableau de bord Supabase (piège n°1 en usage semestriel).
- 500 Mo de base et 50 000 utilisateurs actifs/mois : très au-delà du besoin.
- L'anon key est **publique** (elle apparaît dans le bundle) : c'est normal, la
  sécurité repose entièrement sur la RLS.
- Les `NEXT_PUBLIC_*` sont **inlinées au build** : changer l'env exige un
  redéploiement.

## Modèle de données

| Table | Contenu | RLS |
|---|---|---|
| `profiles` | rôle (`prof`/`etudiant`) par utilisateur | chacun lit le sien, le prof lit tout ; **rôle modifiable en SQL uniquement** |
| `official_catalogs` | catalogues officiels (`liants`, `residus`, `granulats`, `retardateurs`, `constantes`), `data` = enveloppe `{v,data}` comme `persisted.ts` | lecture publique ; écriture **prof** |
| `saved_results` | résultats sauvegardés (`id` = id client `sr_...`) | l'étudiant CRUD les siens ; le prof lit tout (revue) |

## Limites connues (v1)

- **Pas de tombstones de suppression** : supprimer un résultat hors-ligne peut
  le voir réapparaître à la fusion suivante (le localStorage reste la vérité UI,
  donc jamais de perte de données).
- **`production_log` (journal industrie) n'est pas synchronisé** : valeur cloud
  faible ; la mécanique `saved_results` se généralisera si le besoin se confirme.
- La couche cloud est **local-first** : toute écriture réussit d'abord en
  localStorage ; l'échec réseau est silencieux (jamais bloquant).

## Vérification manuelle (checklist)

Voir la checklist des 7 scénarios en fin de ce document une fois la couche
implémentée : (1) sans env → app inchangée ; (2) inscription + sauvegarde
visibles dans Table Editor ; (3) 2ᵉ navigateur → fusion ; (4) publication prof →
réception étudiant ; (5) tentative d'`update` RLS refusée en console ; (6)
suppression bilatérale ; (7) déconnexion → local intact.
