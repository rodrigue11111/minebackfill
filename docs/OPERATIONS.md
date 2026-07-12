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

Le dépôt est prévu pour être maintenu **avec un assistant IA** (Claude Code ou
équivalent) : donner à l'assistant l'accès au dépôt et lui faire lire, dans
l'ordre, `CONTEXTE_PROJET_IA.md` puis `docs/MAINTENANCE.md`. Les garde-fous
(oracles Excel intouchables, 700+ tests, CI) l'empêchent de casser les
formules sans que ce soit détecté.
