# Progiciel Belem — portail des projets

Porte d'entree unique vers les outils du programme : l'utilisateur se connecte
(ou pas, selon la configuration) puis choisit un projet — MineBackfill,
CPB Cockpit, et les suivants.

## Ajouter un projet (le point important)

Une seule chose a faire : ajouter une entree dans
[`src/lib/projects.ts`](src/lib/projects.ts) —

```ts
{
  id: "mon-projet",
  nom: "Mon projet",
  description: "Une phrase qui dit ce que fait l'outil.",
  url: "https://mon-projet.vercel.app",
  tags: ["Article 5"],
  statut: "beta",
},
```

puis `git push` : Vercel redeploie automatiquement. Chaque application reste
deployee independamment (le portail n'est qu'un annuaire, aucun couplage).

## Connexion (optionnelle)

Le portail reutilise LE MEME projet Supabase que MineBackfill : un seul compte
ouvre le portail et MineBackfill.

- Sans variables d'environnement : mode ouvert (la liste des projets est
  visible sans connexion, un bandeau l'indique).
- Avec `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (les memes
  valeurs que MineBackfill, voir son `supabase/README.md`) : l'acces aux
  projets exige un compte. Inscription possible depuis le portail.

Nota : la connexion protege le PORTAIL (l'annuaire). Les applications elles-
memes restent accessibles par leur URL directe — MineBackfill gere sa propre
session avec les memes comptes.

Connexion unique (SSO) entre sous-domaines : la session Supabase est stockee
dans un cookie pose sur le domaine parent `.progicielbelem.com` (voir
`src/lib/supabase.ts` — adaptateur de stockage cookie identique cote
MineBackfill, meme cle `pb_auth`). Se connecter au portail vaut donc aussi pour
MineBackfill, et inversement. En local / preview (hors `*.progicielbelem.com`)
le cookie reste sur l'hote courant : chaque app garde sa propre session, le SSO
ne s'active qu'en production.

## Developpement local

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # verification production
```

## Emplacement

Le portail vit dans le sous-dossier `portail/` du depot **minebackfill** (pas
de depot separe : un seul depot a gerer, la CI et l'IA mainteneuse @claude le
couvrent deja). C'est une application Next.js INDEPENDANTE, deployee comme un
projet Vercel distinct.

## Deploiement (une fois)

1. vercel.com -> Add New Project -> importer le depot **minebackfill**.
2. Dans les reglages du projet, mettre **Root Directory = `portail`** (c'est
   ce qui distingue ce deploiement de celui de MineBackfill, qui pointe sur
   `frontend`). Framework : Next.js (detecte automatiquement).
3. Deploy.
4. (Optionnel) Ajouter les 2 variables Supabase dans Vercel -> Settings ->
   Environment Variables, puis redeployer.

## Domaines (le portail devient la porte d'entree, SANS coupure)

Aujourd'hui `progicielbelem.com` sert MineBackfill. On veut que l'apex serve le
PORTAIL et que MineBackfill vive sur `minebackfill.progicielbelem.com`. Suivre
cet ordre pour ne jamais rendre MineBackfill injoignable :

1. **D'abord** : projet Vercel de MineBackfill -> Settings -> Domains -> ajouter
   `minebackfill.progicielbelem.com`. Si le DNS du domaine est gere par Vercel,
   c'est automatique ; sinon ajouter un enregistrement CNAME
   `minebackfill` -> `cname.vercel-dns.com` chez le registraire. Verifier que
   https://minebackfill.progicielbelem.com affiche bien MineBackfill (l'apex
   continue de le servir aussi, temporairement — c'est normal).
2. **Ensuite** : deployer le portail (etapes ci-dessus).
3. **Enfin** : deplacer `progicielbelem.com` (et `www`) du projet MineBackfill
   vers le projet Portail — dans Vercel, retirer le domaine du projet
   MineBackfill puis l'ajouter au projet Portail (Vercel propose souvent
   directement de le reassigner).

Resultat : `progicielbelem.com` = portail (page de choix) ;
`minebackfill.progicielbelem.com` = MineBackfill ; CPB sur son URL.
