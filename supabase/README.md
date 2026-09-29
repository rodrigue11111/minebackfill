# Synchronisation en ligne (Supabase) — optionnelle

MineBackfill fonctionne **à 100 % en local** sans aucune configuration : tout
est enregistré dans le navigateur (localStorage). Cette couche Supabase ajoute,
**si elle est configurée**, des comptes étudiants, des catalogues officiels
publiés par l'enseignant, et la sauvegarde en ligne du travail de chaque
étudiant (résultats et gâchées), lisible par l'enseignant.

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
5. **SQL Editor** — poser le **code enseignant** (jamais écrit dans le dépôt,
   qui est public : seule son empreinte est gardée en base) :
   ```sql
   select public.definir_code_enseignant('UN_CODE_DIFFICILE_A_DEVINER');
   ```
   Il ne sert qu'**une fois** (2e argument pour plus, ex. `, 2`).
6. L'enseignant s'inscrit sur la page `/compte` → Inscription → « Je suis
   l'enseignant » → saisit le code : son compte est « prof » d'emblée. Un
   mauvais code donne simplement un compte étudiant. Compte déjà créé sans
   le code :
   ```sql
   update public.profiles set role = 'prof' where email = 'VOTRE_EMAIL';
   ```
   puis se déconnecter/reconnecter.
7. **Réglages** → publier les catalogues officiels et les constantes (seed
   initial ; en l'absence de ligne cloud, chaque client garde ses défauts).

## Mot de passe oublié : serveur de courriel (une fois)

L'application propose « Mot de passe oublié ? » (page Compte, et depuis le
portail) : un courriel envoie un lien vers `/compte/nouveau-mot-de-passe`, où
l'on choisit un nouveau mot de passe. Deux réglages Supabase sont requis :

1. **Serveur de courriel (SMTP).** Le serveur intégré de Supabase n'écrit
   qu'aux membres de l'équipe du projet : sans SMTP, l'application affiche
   « L'envoi de courriels n'est pas encore configuré ». Exemple avec Resend
   (gratuit jusqu'à 100 courriels/jour) :
   - resend.com → Domains → ajouter `progicielbelem.com` → recopier les
     enregistrements DNS proposés dans Vercel (Domains → progicielbelem.com →
     DNS Records) → attendre « Verified » ;
   - Resend → API Keys → créer une clé (droit « Sending access ») ;
   - Supabase → Authentication → Emails → **SMTP Settings** → activer :
     hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe =
     la clé API, expéditeur `no-reply@progicielbelem.com`, nom `MineBackfill` ;
   - Authentication → **Rate Limits** : « emails sent per hour » à 30 (au
     lieu de 2).
2. **Adresse de retour autorisée.** Authentication → **URL Configuration** :
   - Site URL : `https://minebackfill.progicielbelem.com`
   - Redirect URLs : ajouter
     `https://minebackfill.progicielbelem.com/compte/nouveau-mot-de-passe`
   Sans cela, le lien du courriel renvoie vers la Site URL et l'étudiant ne
   voit pas le formulaire.
3. **Modèle du courriel — OBLIGATOIRE** : Authentication → Emails →
   Templates → **Reset Password**. Le lien par défaut de Supabase consomme le
   jeton dès qu'il est OUVERT ; or les messageries universitaires
   (Microsoft 365, « Safe Links ») ouvrent chaque lien pour l'analyser : le
   lien arrivait « expiré » chez l'étudiant. Ce modèle mène à la page de
   l'application, qui ne vérifie le jeton qu'au clic sur « Enregistrer » :
   - Sujet : `MineBackfill — choisir un nouveau mot de passe`
   - Message :
     ```html
     <h2>Nouveau mot de passe</h2>
     <p>Vous avez demandé à changer le mot de passe de votre compte MineBackfill.</p>
     <p><a href="https://minebackfill.progicielbelem.com/compte/nouveau-mot-de-passe?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
     <p>Ce lien ne sert qu'une fois et expire dans une heure. Si vous n'avez rien
     demandé, ignorez ce courriel : votre mot de passe ne change pas.</p>
     ```
   Avec ce modèle, l'étape 2 (adresse de retour) n'est plus indispensable,
   mais elle ne nuit pas.

Vérifier : page Compte → « Mot de passe oublié ? » → votre courriel → le
courriel arrive → le lien ouvre « Nouveau mot de passe » → enregistrer → vous
êtes connecté.

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

## Synchronisation du travail (v2) — comportement

- **Local d'abord** : tout s'enregistre d'abord dans le navigateur ; la
  synchronisation rapproche ensuite local et serveur, sans jamais bloquer la
  saisie. Envoi 5 s après la dernière modification (30 s au plus), tout de
  suite quand on quitte l'onglet ; une lecture au retour sur l'onglet et
  toutes les 10 minutes.
- **Toujours sauvegardé pour le compte connecté** : à la première connexion,
  les données créées sans compte sont rattachées **sur confirmation**
  (bandeau « Rattacher »). Un autre compte se connecte dans le même
  navigateur : le travail du compte précédent quitte l'écran (déjà en ligne ;
  s'il reste des modifications non envoyées ou des courbes de presse, il est
  **mis de côté** sur l'appareil, clé `minebackfill_compte_<uid>`, et retrouvé
  à sa prochaine connexion ici), et celui du nouveau compte revient.
  Jamais le travail d'un compte n'est envoyé sous un autre.
- **Suppressions explicites** : supprimer un résultat ou une gâchée pose une
  suppression transmise en ligne. Un document simplement absent (clé vidée,
  import partiel) n'est JAMAIS pris pour une suppression : il est restauré.
  Plus de 10 suppressions d'un coup (et plus de 20 % des documents) : elles
  attendent une confirmation.
- **Conflits** : modifié sur deux appareils en même temps → les **deux
  versions** sont gardées ; la copie porte une marque « copie de conflit » et
  est **exclue des figures** du Labo.
- **Courbes de presse** : restent sur l'appareil (lourdes). Une version venue
  d'un autre appareil ne les efface pas.
- **Déconnexion** : les données locales restent ; les modifications en
  attente partiront à la prochaine connexion sur cet appareil.
- **Interrupteur de secours** : `NEXT_PUBLIC_SYNCHRO_V2=false` (Vercel, puis
  redéployer) coupe la synchronisation du travail sans rien perdre : les
  données restent sur chaque appareil.
- **Hors synchronisation** : réglages, constantes, unités, protocoles, journal
  de production (chaque résultat fige déjà son contexte, chaque gâchée ses
  protocoles).

## Garde-fous des catalogues officiels

- **L'enseignant est la source des catalogues officiels** : chez lui, la
  synchronisation ne ré-applique PAS la copie cloud (ses modifications locales
  non encore publiées sont préservées, y compris au rafraîchissement de jeton
  ~1 h) ; « Publier » reste le seul canal de diffusion.
- **Publications invalides ignorées** : une ligne de catalogue vide, malformée
  ou écrite par une version PLUS RÉCENTE de l'application n'est pas appliquée
  par les clients (validation + migration par version de l'enveloppe `{v,data}`).

## Vérification manuelle (checklist, sur la préproduction)

La CI est hermétique (aucune env Supabase → tous les chemins cloud sont morts,
`pnpm build` prouve le mode 100 % local à chaque exécution). Le moteur et le
SQL sont testés automatiquement (ci-dessous) ; restent à vérifier à la main,
contre le projet de préproduction, avec un aperçu Vercel où
`NEXT_PUBLIC_MODE_TEST_SANS_COMPTE=false` :

1. **Sans env** → l'application est strictement identique (lien « Compte »
   masqué, aucun appel réseau).
2. **Rattachement** : créer un résultat et une gâchée sans compte, puis se
   connecter → bandeau « Rattacher » → ils apparaissent dans *Table Editor →
   user_docs*.
3. **Deux navigateurs, même compte** : une modification faite dans l'un
   apparaît dans l'autre (au retour sur l'onglet ou via « Synchroniser
   maintenant »).
4. **Conflit** : couper le réseau des deux côtés (outils de développement →
   Network → Offline), modifier la même gâchée, rétablir → deux versions,
   l'une marquée « copie de conflit », absente des figures du Labo.
5. **Suppression** : supprimer d'un côté → disparaît de l'autre ; jamais de
   retour.
6. **Hors ligne** : pastille grise, puis rattrapage au retour du réseau.
7. **Changement de compte** dans le même navigateur : le travail du premier
   compte disparaît de l'écran, celui du second apparaît ; revenir au premier
   le fait réapparaître. Rien ne passe d'un compte à l'autre (Table Editor).
8. **Publication enseignant** : éditer un liant officiel dans Réglages →
   « Publier en ligne » → un étudiant recharge → catalogue à jour.
9. **RLS** (SQL Editor, voir `schema-sql.test.ts` pour la liste complète) :
   Advisors → Security sans alerte.
10. **Déconnexion** → les données locales restent intactes.

Non testable en CI : auth réelle, délivrabilité email, pause du projet.

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
- `sync-moteur.test.ts` : le moteur de synchronisation contre un faux serveur
  qui reproduit `schema.sql` (conflits, suppressions, réponses perdues,
  pagination, propriété sur 300 opérations aléatoires).
- `sync-local.test.ts`, `sync-supabase.test.ts`, `sync-planificateur.test.ts`,
  `sync-etat.test.ts` : stockage local (courbes gardées), appels RPC et
  classement des erreurs, calendrier des cycles, état persistant.
- `cloud.test.ts` : catalogues officiels (lecture, publication).
