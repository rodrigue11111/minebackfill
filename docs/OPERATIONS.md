# OPÉRATIONS — guide de l'enseignant (sans jargon)

Ce guide couvre les gestes courants et les pannes probables, **sans écrire de
code**. Pour la mise en place initiale de la synchronisation en ligne, voir
`supabase/README.md`. Pour la maintenance du code, `docs/MAINTENANCE.md`.

## Les trois services

| Quoi | Où | Rôle | Si ça tombe |
|---|---|---|---|
| Application (site) | Vercel | pages + calculs relayés | rien ne s'affiche |
| Calculateur (backend) | Vercel (mêmes déploiements) | formules RPC/RPG/RRC | « erreur réseau » au calcul |
| Synchronisation (optionnelle) | Supabase | comptes, catalogues et sessions publiés, travail des étudiants en ligne (résultats, gâchées), commentaires de l'enseignant | l'app FONCTIONNE quand même (mode local) : chaque étudiant garde son travail dans son navigateur |

## Symptôme → action

### « Le site ne s'ouvre pas »
Vercel est en panne (rare) ou le projet a été suspendu. Aller sur
vercel.com → le projet → onglet Deployments → « Redeploy » sur le dernier
déploiement vert.

### « Erreur réseau » quand un étudiant lance un calcul
1. Demander à l'étudiant d'ouvrir la page `/diagnostic` du site et de cliquer
   « Copier le diagnostic », puis de vous l'envoyer.
2. Si le diagnostic dit « Backend injoignable » : vercel.com → Redeploy.
3. Sinon, le problème est local à l'étudiant (réseau du campus, extension de
   navigateur) — essayer un autre navigateur.

### « Impossible de se connecter » (comptes)
Le projet Supabase gratuit se met **en pause après ~7 jours sans activité**.
supabase.com → le projet → bouton « Restore » / « Resume ». Deux minutes plus
tard tout refonctionne. (Une tâche automatique hebdomadaire réduit ce risque —
voir « Anti-pause » plus bas — mais le réflexe reste bon.)

### Nommer un enseignant (rôle prof)
**Le plus simple, une fois un premier enseignant en place** : page **Classe →
Comptes** → « Nommer enseignant » sur la ligne de la personne. Il verra tout le
travail des étudiants : ne nommer que des personnes de confiance. « Retirer le
rôle enseignant » fait l'inverse (jamais sur soi-même : il reste toujours un
enseignant).

**Le premier enseignant, automatiquement, avec un code** : supabase.com → SQL Editor →
```sql
select public.definir_code_enseignant('UN_CODE_DIFFICILE_A_DEVINER');
```
puis la personne s'inscrit (page « Compte » → Inscription → « Je suis
l'enseignant ») avec ce code : son compte est « prof » d'emblée. Le code ne
sert qu'**une fois** ; pour un nouvel enseignant, en poser un nouveau. Ne
jamais l'écrire dans le dépôt GitHub (public), ni un code qui se devine (nom
de l'enseignant, du cours) : quiconque le trouve avant l'enseignant lirait
tout le travail des étudiants.

**Compte déjà créé** : SQL Editor →
```sql
update public.profiles set role = 'prof' where email = 'SON_EMAIL';
```
Elle se déconnecte/reconnecte. (Le rôle ne se change QUE par ce SQL, un code
vérifié par le serveur, ou un enseignant dans Classe → Comptes — aucun
étudiant ne peut se promouvoir.)

### Bloquer un compte
Page **Classe → Comptes** → « Bloquer » : la connexion est refusée (message
« compte suspendu ») ; si la personne est connectée, elle est déconnectée au
plus tard dans l'heure. **Rien n'est effacé** ; « Débloquer » rétablit tout.
Un enseignant ne se bloque pas lui-même et ne bloque pas un autre enseignant
(lui retirer d'abord le rôle).

C'est le même blocage que Supabase Studio (Authentication → Users → l'étudiant
→ « Ban user ») : un compte bloqué d'un côté apparaît bloqué de l'autre.

**Avant la première utilisation** (ou si le bouton répond « le serveur refuse
de modifier les comptes de connexion »), vérifier que la base peut écrire dans
les comptes de connexion — SQL Editor, sans aucun effet :
```sql
begin;
update auth.users set banned_until = banned_until where id = '00000000-0000-0000-0000-000000000000';
delete from auth.sessions where user_id = '00000000-0000-0000-0000-000000000000';
rollback;
```
Aucune erreur → le bouton fonctionne. « permission denied » → Supabase a
retiré ce droit : bloquer par « Ban user » dans Studio (le reste de la page
Comptes fonctionne).

### Un étudiant a oublié son mot de passe
**Il se débrouille seul** : page Compte → « Mot de passe oublié ? » → il reçoit
un courriel avec un lien pour en choisir un nouveau. Condition : le serveur de
courriel (SMTP) configuré dans Supabase, une fois pour toutes (voir
`supabase/README.md`, « Mot de passe oublié ») ; sans lui, l'application
annonce que l'envoi n'est pas configuré. Connecté, chacun change aussi son mot
de passe depuis la page Compte.

Dépannage sans courriel (SMTP pas encore en place, adresse erronée) :
supabase.com → SQL Editor →
```sql
update auth.users
   set encrypted_password = extensions.crypt('MotDePasseTemporaire-2026', extensions.gen_salt('bf'))
 where email = 'COURRIEL_DE_L_ETUDIANT';
```
Communiquer ce mot de passe temporaire en personne ; l'étudiant le change
aussitôt depuis « Compte ». **Son travail n'est jamais en danger** : il reste
dans son navigateur, et en ligne dans son compte.

### Publier des matériaux/constantes à la classe
Connecté avec un compte enseignant : Réglages → modifier les entrées
officielles → « Publier en ligne » sur chaque carte. Les étudiants reçoivent
la mise à jour à leur prochaine connexion (leurs entrées personnelles sont
conservées).

**Caractériser un résidu ou un granulat** (granulométrie, soufre,
minéralogie…) : Réglages → carte du matériau → « Caractérisation » sous son
entrée. Tout est facultatif ; le compteur (« 4/10 ») montre ce qui est
renseigné. Ces valeurs entrent dans le jeu d'essais à chaque export. Un
matériau qu'un étudiant a saisi lui-même se reprend depuis la page Classe :
ouvrir sa gâchée → « Ajouter au catalogue officiel », puis le compléter et
le publier depuis Réglages.

### Changer une variable d'environnement (URL Supabase, etc.)
vercel.com → projet → Settings → Environment Variables → modifier → **puis
Redeploy** (les variables sont figées au moment du build).

### Sauvegarde des données en ligne (1 fois par mois, et en fin de session)
**L'offre gratuite de Supabase ne fait AUCUNE sauvegarde** : la base elle-même
est la seule copie en ligne. Deux gestes, à faire vous-même :

1. **Chaque mois** : MineBackfill → **Classe** → session « Toutes » →
   « Exporter la classe (JSON) ». Le fichier contient le travail de tous les
   étudiants (résultats et gâchées, documents complets).
2. **En fin de session**, en plus : supabase.com → Table Editor →
   `user_docs`, `annotations`, `profiles`, `official_catalogs` → « Export
   CSV » pour chacune.

3. **Chaque mois, aussi** : même menu « Exporter » → **« Jeu d'essais
   (JSON) »**, session « Toutes ». C'est la base des essais, pseudonymisée
   (ni nom ni courriel), documentée colonne par colonne dans
   `docs/DICTIONNAIRE_DONNEES.md` (aussi téléchargeable : « Dictionnaire des
   données (CSV) »).

**Où ranger ces fichiers : PAS sur GitHub** (le dépôt est public, ce sont des
données d'étudiants). Un espace de stockage de l'établissement convient. Les
courbes de presse ne sont pas en ligne : chaque étudiant les garde dans son
navigateur et dans SA sauvegarde locale (Réglages → Données locales → Exporter).

**Conservation des jeux d'essais.** Le but est un historique sur plusieurs
années : garder chaque jeu daté, sans écraser le précédent (le nom du fichier
porte la date). Un jeu pseudonymisé peut être transmis pour la recherche,
selon les règles de l'établissement ; ce n'est pas un jeu anonyme (qui a la
liste des comptes peut refaire la correspondance), et ses colonnes en texte
libre (liste dans le manifeste, `textes_libres`) sont à relire avant toute
diffusion publique. Les copies nominatives (« Classe (JSON) », CSV de la
classe, rapports PDF) restent dans l'espace de l'établissement.

### Début et fin de session
- **Début** : Réglages → **Sessions de cours** → ajouter la session (ex.
  « Automne 2027 », du 1er septembre au 23 décembre) → Enregistrer →
  « Publier en ligne ». Tout ce qui sera créé pendant cette session la
  portera. Si le projet Supabase est en pause (été), le restaurer d'abord
  (voir « Impossible de se connecter »).
- **Fin** : faire les deux sauvegardes ci-dessus, puis, page **Classe** filtrée
  sur la session : « Rapport de session (PDF) » (synthèse + un chapitre par
  étudiant) et « Éprouvettes (CSV) » / « Synthèse (CSV) » pour Excel. À ranger
  avec les sauvegardes, hors de GitHub (données d'étudiants). Rien à effacer :
  l'historique pluriannuel est le but ; le tableau de bord se filtre par session.

### Surveiller le volume (une fois par session)
supabase.com → le projet → **Usage** : « Database size » (limite gratuite :
500 Mo) et « Egress » (5 Go par mois). Mesure détaillée, SQL Editor :
```sql
select kind, count(*), pg_size_pretty(sum(pg_column_size(payload)))
  from public.user_docs group by kind;
```
Chaque compte est plafonné à 25 Mo en ligne (un étudiant qui l'atteint voit
un avis ; son travail reste sur son appareil).

### Effacer le compte d'un étudiant (sur demande)
Le travail d'un étudiant n'est jamais effacé par accident : supprimer son
compte est **refusé** tant que son travail existe (c'est voulu). Pour une
simple mise à l'écart, **bloquer** suffit (réversible, voir plus haut). Pour un
effacement demandé — vérifier d'abord le bon compte dans Classe → Comptes
(courriel, volume de travail) :
1. Exporter d'abord la classe (au cas où) ;
2. SQL Editor, en remplaçant le courriel :
```sql
with u as (select id from auth.users where email = 'COURRIEL_DE_L_ETUDIANT')
delete from public.annotations where owner_id in (select id from u);
with u as (select id from auth.users where email = 'COURRIEL_DE_L_ETUDIANT')
delete from public.user_docs where user_id in (select id from u);
with u as (select id from auth.users where email = 'COURRIEL_DE_L_ETUDIANT')
delete from public.saved_results where user_id in (select id from u);
```
3. Authentication → Users → l'étudiant → « Delete user ».
Ses copies locales restent dans SON navigateur : c'est à lui de les effacer.

### Un an après l'ouverture des comptes : retirer l'ancienne table
La table `saved_results` (synchronisation v1) est gelée en lecture seule et
reprise dans `user_docs`. Un an après l'ouverture des comptes aux étudiants,
vérifier le contrôle « résultats v1 non repris = 0 » (supabase/README.md),
puis : `drop table public.saved_results;`

## Anti-pause Supabase (automatique)

Le dépôt contient `.github/workflows/supabase-keepalive.yml` : deux fois par
semaine, GitHub interroge la base pour la maintenir active. À activer une
fois : GitHub → dépôt → Settings → Secrets and variables → Actions → ajouter
`SUPABASE_URL` et `SUPABASE_ANON_KEY` (les mêmes valeurs que dans Vercel).

**Sans ces secrets, la tâche échoue** (croix rouge dans l'onglet Actions, et
GitHub envoie un courriel). C'est voulu : jusqu'en septembre 2026 elle
s'ignorait « poliment » — 22 exécutions vertes, aucune n'avait touché la base.
Elle échoue aussi si la clé est refusée (HTTP 4xx) ou si le projet est en
pause.

**Vérifier qu'elle tourne vraiment** : GitHub → Actions → « Supabase
keep-alive » → dernière exécution → étape « Requete de maintien d'activite » :
elle doit afficher `HTTP 200`. Bouton « Run workflow » pour la lancer à la
main.

**Limite de GitHub à connaître** : dans un dépôt public, GitHub **désactive**
les tâches planifiées après **60 jours sans activité** sur le dépôt (aucun
commit). Typiquement l'été. GitHub prévient par courriel ; pour réactiver :
Actions → « Supabase keep-alive » → « Enable workflow ». Sinon, en début de
session : supabase.com → le projet → « Restore » (un projet en pause reste
restaurable pendant un an).

## Faire évoluer l'application sans développeur attitré

### Demander une modification à l'IA du dépôt (cas extrême, zéro installation)

Le dépôt embarque une **IA mainteneuse** (`.github/workflows/claude.yml`) que
l'on sollicite en écrivant, comme à un assistant :

1. GitHub → le dépôt → **Issues** → **New issue**.
2. Décrire la demande **en français, comme à un humain** — par exemple :
   « @claude ajoute le liant GUb-SF (Gs 2,95) aux liants officiels par
   défaut » ou « @claude le bouton d'export PDF affiche une erreur, corrige ».
   Le mot **@claude** doit apparaître dans le texte.
3. Quelques minutes plus tard, l'IA répond dans l'issue et ouvre une
   **Pull Request** : les tests (dont les 700+ qui verrouillent les formules)
   tournent automatiquement, et Vercel fournit un **aperçu cliquable** de
   l'application modifiée.
4. Tester l'aperçu ; si c'est bon, cliquer **Merge** — c'est CE clic, et lui
   seul, qui met en production. Sinon, répondre dans la PR (« @claude ce
   n'est pas ça, plutôt... ») et l'IA corrige.

Ce que l'IA **ne peut pas** faire : pousser directement en production
(PR obligatoire), modifier les oracles Excel (interdits et surveillés par la
CI), être déclenchée par un inconnu (seuls le propriétaire et les
collaborateurs du dépôt le peuvent).

**Activation (une fois)** : créer une clé sur console.anthropic.com
(facturation à l'usage — de l'ordre de quelques dizaines de cents à quelques
dollars par demande selon la taille), puis GitHub → Settings → Secrets and
variables → Actions → ajouter `ANTHROPIC_API_KEY`.

### Variante : l'assistant directement SUR le site (page /assistant)

Même pipeline, sans quitter l'application : connecté avec le compte
enseignant, ouvrir **Réglages → « Assistant IA (modifications) »** (ou
directement `/assistant`). Le lien n'apparaît qu'avec un compte enseignant :
en mode test sans compte, ouvrir directement l'adresse `/assistant`. On y écrit la demande comme dans un chat ; chaque
message devient, en coulisses, une issue GitHub `@claude`, et les réponses de
l'IA s'affichent dans la page (actualisation ~20 s — comptez quelques minutes
par réponse). Le lien « Ouvrir dans GitHub » mène à la Pull Request et à son
aperçu ; **le clic « Merge » reste la seule mise en production**.

Sécurité : hors mode test, page et API refusent tout compte non-enseignant
(vérification du rôle CÔTÉ SERVEUR) ; en mode test sans compte, la page est
ouverte à qui connaît son adresse (docs/MAINTENANCE.md, recette 9) ; le jeton GitHub utilisé ne sait QUE créer des issues
(aucune écriture de code possible avec lui).

**Activation (une fois, en plus du secret ANTHROPIC_API_KEY ci-dessus)** :
1. GitHub → Settings (votre profil) → Developer settings → Fine-grained
   tokens → générer un jeton limité au dépôt, permission « Issues : Read and
   write » uniquement.
2. Vercel → projet → Settings → Environment Variables → ajouter
   `ASSISTANT_GITHUB_TOKEN` (le jeton) et `ASSISTANT_GITHUB_REPO`
   (ex. `rodrigue11111/minebackfill`) → Redeploy.

### Avec un assistant IA local (développeur ou étudiant outillé)

Donner l'accès au dépôt et faire lire, dans l'ordre, `CONTEXTE_PROJET_IA.md`
puis `docs/MAINTENANCE.md`. Les garde-fous (oracles Excel intouchables,
700+ tests, CI hermétique) empêchent de casser les formules sans détection.
