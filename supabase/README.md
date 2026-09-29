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
| `profiles` | rôle (`prof`/`etudiant`) et nom affiché par utilisateur | chacun lit le sien, le prof lit tout ; **rôle modifiable en SQL uniquement** ; nom via `definir_nom()` |
| `official_catalogs` | catalogues officiels (`liants`, `residus`, `granulats`, `retardateurs`, `constantes`, `sessions`), `data` = enveloppe `{v,data}` comme `persisted.ts` | lecture publique ; écriture **prof** |
| `user_docs` (v2) | travail des utilisateurs : `resultat`, `gachee` (puis `courbe`) ; clé (utilisateur, type, id), révision, suppression tracée | chacun écrit les siens ; le prof lit tout, n'écrit rien chez autrui ; **aucune suppression physique** |
| `user_usage` (v2) | volume en ligne par compte (quota de 25 Mo) | chacun lit le sien, le prof lit tout ; tenu par trigger |
| `annotations` (v2) | commentaires de l'enseignant sur un résultat ou une gâchée | l'étudiant lit celles sur SON travail ; seul le prof écrit |
| `saved_results` (v1) | résultats de la v1, **gelés en lecture seule** après reprise dans `user_docs` | lecture seule ; à supprimer un an après l'activation de la v2 |

Écritures et lectures du travail passent par des fonctions (RPC) :
`ecrire_doc` (écriture conditionnelle à la révision vue), `lire_docs` (lecture
incrémentale par curseur), `lire_docs_classe` (enseignant), `lire_annotations`.
Le pourquoi de chaque choix : `docs/HISTORIQUE_EXTENSIBILITE.md`, section
« Synchronisation v2 ».

## Passage à la v2 (une fois par projet)

1. **D'abord sur un projet de préproduction** (second projet gratuit) :
   SQL Editor → coller et exécuter `schema.sql`. Le script est ré-exécutable.
2. Contrôles, dans SQL Editor :
   ```sql
   -- résultats v1 non repris (id hors format) : doit être 0
   select count(*) from public.saved_results s where not exists (
     select 1 from public.user_docs d where d.user_id = s.user_id
       and d.kind = 'resultat' and d.id = s.id);
   ```
   puis **Advisors → Security** : aucune alerte sur les nouvelles tables.
3. Puis sur le projet de production. **Laisser le mode test actif** tant que
   l'application n'utilise pas la v2 : la synchronisation v1 ne peut plus
   écrire (table gelée), c'est voulu.

## Limites connues (v1)

- **Pas de tombstones de suppression** : supprimer un résultat hors-ligne peut
  le voir réapparaître à la fusion suivante (le localStorage reste la vérité UI,
  donc jamais de perte de données). Cas particulier : quand l'**enseignant**
  supprime de son Historique le résultat d'un étudiant, la suppression est
  locale seulement (la RLS interdit de toucher aux lignes d'autrui) — il
  réapparaîtra à la synchronisation suivante.
- **`production_log` (journal industrie) n'est pas synchronisé** : valeur cloud
  faible ; la mécanique `saved_results` se généralisera si le besoin se confirme.
- La couche cloud est **local-first** : toute écriture réussit d'abord en
  localStorage ; l'échec réseau est silencieux (jamais bloquant).

## Garde-fous de synchronisation

- **L'enseignant est la source des catalogues officiels** : chez lui, la
  synchronisation ne ré-applique PAS la copie cloud (ses modifications locales
  non encore publiées sont préservées, y compris au rafraîchissement de jeton
  ~1 h) ; « Publier » reste le seul canal de diffusion.
- **Publications invalides ignorées** : une ligne de catalogue vide, malformée
  ou écrite par une version PLUS RÉCENTE de l'application n'est pas appliquée
  par les clients (validation + migration par version de l'enveloppe `{v,data}`).
- **Anti-réattribution** : chaque résultat porte son propriétaire (`ownerId`) ;
  un résultat appartenant à quelqu'un d'autre (navigateur partagé, import de
  sauvegarde, revue de l'enseignant) n'est jamais poussé sous le compte courant.
- **Lecture bornée à 5 000 résultats** par synchronisation (PostgREST tronque
  silencieusement à 1 000 sans limite explicite).

## Vérification manuelle (checklist)

La CI est hermétique (aucune env Supabase → tous les chemins cloud sont morts,
`pnpm build` prouve le mode 100 % local à chaque exécution). Les scénarios
réseau ci-dessous se vérifient à la main contre un projet Supabase réel :

1. **Sans env** → l'application est strictement identique à aujourd'hui (lien
   « Compte » masqué, aucun appel réseau).
2. **Inscription étudiant** → sauvegarder un résultat → il apparaît dans
   *Table Editor → saved_results*.
3. **Second navigateur** (autre session) → connexion → les résultats du premier
   apparaissent (fusion), et inversement.
4. **Publication enseignant** : éditer un liant officiel dans Réglages →
   « Publier en ligne » → un étudiant recharge → catalogue à jour, ses entrées
   perso intactes.
5. **RLS** : un étudiant tente un `update` sur `official_catalogs` via la console
   JS (`supabase.from('official_catalogs').update(...)`) → 0 ligne affectée.
6. **Suppression** d'un résultat → disparu localement ET dans `saved_results`.
7. **Déconnexion** → les données locales restent intactes (mode local intégral).

Non testable en CI (auth réelle, effectivité des politiques RLS, délivrabilité
email, pause du projet) : couvert par cette checklist.

## Ce qui est testé automatiquement (vitest, sans réseau)

- `schema-sql.test.ts` : **`schema.sql` exécuté pour de vrai** dans PostgreSQL
  (PGlite, Postgres compilé en WebAssembly), avec un environnement Supabase
  minimal (rôles `anon` / `authenticated`, `auth.uid()`). Couvre : écriture
  conditionnelle et révisions, suppressions, contraintes et quota, **RLS**
  (un étudiant ne voit ni ne touche le travail d'un autre, aucun rôle lu dans
  les métadonnées, anonyme sans accès), lecture par curseur, lecture de la
  classe, annotations, reprise de `saved_results`, ré-exécution du script. Et
  le **moteur de synchronisation contre ce vrai SQL** (deux navigateurs, puis
  150 opérations aléatoires sur trois). Hors de portée : PostgREST lui-même
  (format JSON, `max_rows`), couvert par le faux serveur des tests du moteur.
- `supabase.test.ts` : sans env → `getSupabase()` renvoie `null`.
- `cloud.test.ts` : `fusionnerResultats` (dédup par id, priorité locale, tri,
  `aPousser`) et les fonctions à client injecté (faux client en mémoire).
