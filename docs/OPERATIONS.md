# OPÉRATIONS — guide de l'enseignant (sans jargon)

Ce guide couvre les gestes courants et les pannes probables, **sans écrire de
code**. Pour la mise en place initiale de la synchronisation en ligne, voir
`supabase/README.md`. Pour la maintenance du code, `docs/MAINTENANCE.md`.

## Les trois services

| Quoi | Où | Rôle | Si ça tombe |
|---|---|---|---|
| Application (site) | Vercel | pages + calculs relayés | rien ne s'affiche |
| Calculateur (backend) | Vercel (mêmes déploiements) | formules RPC/RPG/RRC | « erreur réseau » au calcul |
| Synchronisation (optionnelle) | Supabase | comptes, catalogues publiés, résultats en ligne | l'app FONCTIONNE quand même (mode local) |

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

### Nommer un autre enseignant (rôle prof)
La personne crée d'abord son compte via la page « Compte » du site, puis :
supabase.com → SQL Editor →
```sql
update public.profiles set role = 'prof' where email = 'SON_EMAIL';
```
Elle se déconnecte/reconnecte. (Le rôle n'est modifiable QUE par ce SQL —
c'est voulu, aucun étudiant ne peut se promouvoir.)

### Publier des matériaux/constantes à la classe
Connecté avec un compte enseignant : Réglages → modifier les entrées
officielles → « Publier en ligne » sur chaque carte. Les étudiants reçoivent
la mise à jour à leur prochaine connexion (leurs entrées personnelles sont
conservées).

### Changer une variable d'environnement (URL Supabase, etc.)
vercel.com → projet → Settings → Environment Variables → modifier → **puis
Redeploy** (les variables sont figées au moment du build).

### Sauvegarde des données en ligne (recommandé 1 fois/mois)
supabase.com → Table Editor → `saved_results` puis `official_catalogs` →
« Export CSV ». Conserver les fichiers. (L'offre gratuite n'a pas de
restauration automatique.) Chaque étudiant peut aussi exporter SA sauvegarde
locale : Réglages → Sauvegarde.

## Anti-pause Supabase (automatique)

Le dépôt contient `.github/workflows/supabase-keepalive.yml` : deux fois par
semaine, GitHub interroge la base pour la maintenir active. À activer une
fois : GitHub → dépôt → Settings → Secrets and variables → Actions → ajouter
`SUPABASE_URL` et `SUPABASE_ANON_KEY` (les mêmes valeurs que dans Vercel).
Sans ces secrets, la tâche s'ignore poliment.

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
directement `/assistant`). On y écrit la demande comme dans un chat ; chaque
message devient, en coulisses, une issue GitHub `@claude`, et les réponses de
l'IA s'affichent dans la page (actualisation ~20 s — comptez quelques minutes
par réponse). Le lien « Ouvrir dans GitHub » mène à la Pull Request et à son
aperçu ; **le clic « Merge » reste la seule mise en production**.

Sécurité : page et API refusent tout compte non-enseignant (vérification du
rôle CÔTÉ SERVEUR) ; le jeton GitHub utilisé ne sait QUE créer des issues
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
