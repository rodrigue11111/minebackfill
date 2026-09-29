-- MineBackfill — schéma Supabase (multi-utilisateur).
-- Idempotent : à exécuter (et ré-exécuter) dans SQL Editor du projet.
-- Sécurité = RLS Postgres (l'anon key est publique par conception).
-- Voir supabase/README.md pour la marche à suivre complète.
--
-- v2 (2026-09) : le travail des étudiants (résultats ET gâchées) vit dans
-- `user_docs`, avec révisions, suppressions explicites et écriture à contrôle
-- de version. `saved_results` (v1) est repris une fois puis GELÉ en lecture
-- seule. Pourquoi v1 ne suffisait pas : docs/HISTORIQUE_EXTENSIBILITE.md.

-- ======================================================================
--  profils : rôle par utilisateur, créé automatiquement au signup
-- ======================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  role         text not null default 'etudiant' check (role in ('prof', 'etudiant')),
  created_at   timestamptz not null default now(),
  display_name text
);
-- Projets créés avant la v2 : la colonne n'existe pas encore.
alter table public.profiles add column if not exists display_name text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_display_name_ck'
                  and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_display_name_ck
      check (display_name is null or char_length(display_name) between 1 and 80);
  end if;
end $$;

-- PIÈGE : une politique sur profiles qui interroge profiles boucle (récursion
-- RLS). Solution canonique : fonction security definer (contourne la RLS).
create or replace function public.is_prof() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'prof') $$;

-- ----------------------------------------------------------------------
--  Code enseignant : un compte créé avec ce code devient « prof » tout seul.
--  Le code n'est JAMAIS écrit dans ce dépôt (il est public) : seule son
--  EMPREINTE (bcrypt) vit dans la base, posée depuis SQL Editor par
--    select public.definir_code_enseignant('LE_CODE');
--  Par défaut il ne sert qu'UNE fois : après l'inscription de l'enseignant,
--  il ne fonctionne plus (plus rien à deviner). Tables invisibles par l'API.
-- ----------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.code_enseignant (
  id                     boolean primary key default true check (id),
  empreinte              text    not null,
  utilisations_restantes integer not null default 1 check (utilisations_restantes >= 0),
  maj                    timestamptz not null default now()
);
create table if not exists public.prof_a_promouvoir (user_id uuid primary key);
alter table public.code_enseignant   enable row level security;
alter table public.prof_a_promouvoir enable row level security;
revoke all on public.code_enseignant, public.prof_a_promouvoir from anon, authenticated;

-- À exécuter dans SQL Editor (jamais depuis l'application).
create or replace function public.definir_code_enseignant(p_code text, p_utilisations integer default 1)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(p_code, '')) < 8 then
    raise exception 'code enseignant : 8 caractères au moins' using errcode = '22023';
  end if;
  insert into public.code_enseignant (id, empreinte, utilisations_restantes, maj)
  values (true, extensions.crypt(p_code, extensions.gen_salt('bf', 10)), greatest(p_utilisations, 0), now())
  on conflict (id) do update
    set empreinte = excluded.empreinte, utilisations_restantes = excluded.utilisations_restantes, maj = now();
end $$;
revoke execute on function public.definir_code_enseignant(text, integer) from public, anon, authenticated;

-- AVANT l'insertion du compte : vérifie le code, puis le RETIRE des
-- métadonnées (il ne doit pas rester stocké avec le compte).
create or replace function public.verifier_code_enseignant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_code text := new.raw_user_meta_data ->> 'code_enseignant';
begin
  if v_code is not null then
    new.raw_user_meta_data := new.raw_user_meta_data - 'code_enseignant';
    update public.code_enseignant c
       set utilisations_restantes = c.utilisations_restantes - 1, maj = now()
     where c.utilisations_restantes > 0
       and c.empreinte = extensions.crypt(v_code, c.empreinte);
    if found then
      insert into public.prof_a_promouvoir (user_id) values (new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_code on auth.users;
create trigger on_auth_user_code
  before insert on auth.users
  for each row execute function public.verifier_code_enseignant();

-- Création automatique du profil à l'inscription.
-- raw_user_meta_data est SAISI PAR L'UTILISATEUR : on n'en lit QUE le nom
-- affiché, jamais un rôle. Le rôle « prof » ne vient que d'un code vérifié
-- par le serveur (ci-dessus), ou de la commande SQL de l'enseignant.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$ declare v_prof boolean;
   begin
     delete from public.prof_a_promouvoir where user_id = new.id returning true into v_prof;
     insert into public.profiles (id, email, display_name, role)
     values (new.id, new.email,
             nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''),
             case when coalesce(v_prof, false) then 'prof' else 'etudiant' end)
     on conflict (id) do nothing;
     return new;
   end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nom affiché modifiable par l'utilisateur — et RIEN d'autre : il n'existe
-- toujours AUCUNE politique UPDATE sur profiles (anti-escalade du rôle).
create or replace function public.definir_nom(p_nom text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nom text := nullif(btrim(coalesce(p_nom, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'non authentifié' using errcode = '28000';
  end if;
  if char_length(v_nom) > 80 then
    raise exception 'nom trop long (80 caractères au plus)' using errcode = '22001';
  end if;
  update public.profiles set display_name = v_nom where id = (select auth.uid());
end $$;

-- ======================================================================
--  catalogues officiels : une ligne par catalogue, data = enveloppe {v,data}
--  (IDENTIQUE au format persisted.ts côté frontend : réutilise ses migrations)
--  'sessions' (v2) : la liste des sessions publiée par l'enseignant.
-- ======================================================================
create table if not exists public.official_catalogs (
  id         text primary key check (id in ('liants','residus','granulats','retardateurs','constantes','sessions')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
-- Projets créés avant la v2 : la contrainte (nom par défaut de Postgres pour
-- un CHECK de colonne) ne connaît pas 'sessions'.
alter table public.official_catalogs drop constraint if exists official_catalogs_id_check;
alter table public.official_catalogs add constraint official_catalogs_id_check
  check (id in ('liants','residus','granulats','retardateurs','constantes','sessions'));

-- ======================================================================
--  résultats v1 : GELÉS (lecture seule). Repris dans user_docs plus bas.
--  À supprimer un an après l'activation de la v2 (docs/OPERATIONS.md).
-- ======================================================================
create table if not exists public.saved_results (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_results_user_idx
  on public.saved_results (user_id, created_at desc);

-- ======================================================================
--  documents des utilisateurs (v2) : résultats, gâchées, courbes
-- ======================================================================
-- rev : tirée d'une séquence GLOBALE par le trigger ci-dessous. Elle sert au
-- contrôle de version (« j'écris par-dessus la révision que j'ai vue »), pas
-- à l'ordre de lecture, qui suit updated_at.
create sequence if not exists public.user_docs_rev_seq;

create table if not exists public.user_docs (
  -- restrict : supprimer un compte n'emporte JAMAIS son travail par accident
  -- (procédure d'effacement volontaire : docs/OPERATIONS.md).
  user_id    uuid        not null references auth.users(id) on delete restrict,
  kind       text        not null,
  id         text        not null,
  rev        bigint      not null default nextval('public.user_docs_rev_seq'),
  deleted    boolean     not null default false,
  payload    jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  -- Clé PAR UTILISATEUR : deux étudiants ne peuvent plus entrer en collision
  -- sur un id client (v1 : clé globale sur des ids « sr_<ms>_<4 car.> »).
  primary key (user_id, kind, id),
  constraint user_docs_kind_ck   check (kind in ('resultat', 'gachee', 'courbe')),
  constraint user_docs_id_ck     check (id ~ '^[A-Za-z0-9_.:-]{1,100}$'),
  -- Une suppression EFFACE le contenu (payload null) : supprimer, c'est
  -- vraiment supprimer. Seule la trace « supprimé » reste, pour que les
  -- autres appareils l'apprennent.
  constraint user_docs_etat_ck   check (deleted = (payload is null)),
  constraint user_docs_taille_ck check (payload is null or octet_length(payload::text) <= 262144)
);
create index if not exists user_docs_tirage_idx on public.user_docs (user_id, updated_at, kind, id);
create index if not exists user_docs_classe_idx on public.user_docs (updated_at, user_id, kind, id);

-- Invariants posés par le SERVEUR, quel que soit le chemin d'écriture (RPC ou
-- PostgREST direct) : clé immuable, rev et horodatage attribués ici.
-- clock_timestamp() et non now() : deux écritures d'une même transaction
-- doivent recevoir des instants distincts, sinon la pagination les confond.
create or replace function public.user_docs_normaliser() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.user_id, new.kind, new.id) is distinct from (old.user_id, old.kind, old.id) then
      raise exception 'clé de document immuable' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := clock_timestamp();
  end if;
  new.rev        := nextval('public.user_docs_rev_seq');
  new.updated_at := clock_timestamp();
  if new.deleted then new.payload := null; end if;
  return new;
end $$;
drop trigger if exists user_docs_normaliser on public.user_docs;
create trigger user_docs_normaliser before insert or update on public.user_docs
  for each row execute function public.user_docs_normaliser();

-- Quota par utilisateur : l'inscription est ouverte, un compte ne doit pas
-- pouvoir remplir seul les 500 Mo de l'offre gratuite. 25 Mo par compte, soit
-- des années de travail d'un étudiant sans les courbes de presse.
create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nb_docs integer not null default 0,
  octets  bigint  not null default 0
);
create or replace function public.user_docs_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_delta bigint := coalesce(octet_length(new.payload::text), 0)
                  - case when tg_op = 'UPDATE' then coalesce(octet_length(old.payload::text), 0) else 0 end;
  v_total bigint;
begin
  insert into public.user_usage as u (user_id, nb_docs, octets)
  values (new.user_id, case when tg_op = 'INSERT' then 1 else 0 end, v_delta)
  on conflict (user_id) do update
     set nb_docs = u.nb_docs + excluded.nb_docs, octets = u.octets + excluded.octets
  returning u.octets into v_total;
  if v_delta > 0 and v_total > 25 * 1024 * 1024 then
    raise exception 'quota de stockage en ligne atteint' using errcode = '53400';
  end if;
  return null;
end $$;
drop trigger if exists user_docs_quota on public.user_docs;
create trigger user_docs_quota after insert or update on public.user_docs
  for each row execute function public.user_docs_quota();

-- ======================================================================
--  annotations : écrites par l'enseignant, lues par le propriétaire du travail.
--  Depuis 2026-10, l'étudiant RÉPOND (fil par document, via
--  repondre_annotation) et chacun voit si l'autre a lu (lu_le).
-- ======================================================================
create table if not exists public.annotations (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete restrict,
  target_kind text        not null check (target_kind in ('resultat', 'gachee')),
  target_id   text        not null,
  -- Révision du document au moment de l'annotation : permet d'afficher
  -- « annoté sur une version antérieure » si l'étudiant a modifié depuis.
  target_rev  bigint,
  -- Endroit précis dans le document (ex. une éprouvette), texte libre borné.
  ancre       text        check (ancre is null or char_length(ancre) <= 200),
  auteur_id   uuid        not null references auth.users(id) on delete restrict,
  texte       text        not null check (char_length(texte) between 1 and 4000),
  deleted     boolean     not null default false,
  created_at  timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default clock_timestamp()
);
create index if not exists annotations_tirage_idx on public.annotations (owner_id, updated_at, id);
-- Accusé de lecture : posé par le DESTINATAIRE (étudiant pour un commentaire
-- de l'enseignant, enseignant pour une réponse), seulement par
-- marquer_annotations_lues — personne ne l'écrit directement (droits de
-- colonne plus bas).
alter table public.annotations add column if not exists lu_le timestamptz;

create or replace function public.annotations_normaliser() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.owner_id, new.target_kind, new.target_id, new.auteur_id, new.created_at)
       is distinct from (old.owner_id, old.target_kind, old.target_id, old.auteur_id, old.created_at) then
      raise exception 'annotation : seuls le texte et le retrait sont modifiables' using errcode = '42501';
    end if;
    -- Un texte modifié n'a pas encore été lu.
    if new.texte is distinct from old.texte then new.lu_le := null; end if;
  else
    new.created_at := clock_timestamp();
    new.lu_le := null;
  end if;
  -- Aussi quand l'accusé de lecture change : il voyage par les curseurs.
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists annotations_normaliser on public.annotations;
create trigger annotations_normaliser before insert or update on public.annotations
  for each row execute function public.annotations_normaliser();

-- ======================================================================
--  Row Level Security
-- ======================================================================
alter table public.profiles          enable row level security;
alter table public.official_catalogs enable row level security;
alter table public.saved_results     enable row level security;
alter table public.user_docs         enable row level security;
alter table public.user_usage        enable row level security;
alter table public.annotations       enable row level security;

-- profiles : chacun lit le sien ; le prof lit tout (afficher qui a produit quoi).
-- AUCUNE politique insert/update/delete -> le rôle ne change qu'en SQL, ou par
-- definir_role() (réservée à un enseignant, contrôlée plus bas) : un étudiant
-- ne peut jamais se promouvoir. Le nom affiché passe par definir_nom(), qui ne
-- touche que cette colonne.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  to authenticated using (id = auth.uid() or public.is_prof());

-- catalogues : lecture anon + authenticated ; écriture réservée au prof.
-- (upsert = insert + update : les DEUX politiques sont requises.)
drop policy if exists catalogs_read on public.official_catalogs;
create policy catalogs_read on public.official_catalogs for select
  to anon, authenticated using (true);
drop policy if exists catalogs_ins on public.official_catalogs;
create policy catalogs_ins on public.official_catalogs for insert
  to authenticated with check (public.is_prof());
drop policy if exists catalogs_upd on public.official_catalogs;
create policy catalogs_upd on public.official_catalogs for update
  to authenticated using (public.is_prof()) with check (public.is_prof());

-- résultats v1 : lecture seule (le prof lit tout, chacun lit les siens).
-- Les politiques d'écriture de la v1 sont retirées : la table est gelée.
drop policy if exists results_select on public.saved_results;
create policy results_select on public.saved_results for select
  to authenticated using (user_id = auth.uid() or public.is_prof());
drop policy if exists results_insert on public.saved_results;
drop policy if exists results_update on public.saved_results;
drop policy if exists results_delete on public.saved_results;

-- documents v2 : chacun écrit les siens ; le prof lit tout mais n'écrit rien
-- chez autrui. AUCUNE politique DELETE : effacer = poser une suppression
-- (deleted = true), que les autres appareils doivent pouvoir lire.
drop policy if exists user_docs_select on public.user_docs;
create policy user_docs_select on public.user_docs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_prof()));
drop policy if exists user_docs_insert on public.user_docs;
create policy user_docs_insert on public.user_docs for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists user_docs_update on public.user_docs;
create policy user_docs_update on public.user_docs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists usage_select on public.user_usage;
create policy usage_select on public.user_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_prof()));

-- annotations : l'étudiant lit celles qui portent sur SON travail ; seul le
-- prof écrit, en son nom, sur un document qui existe.
drop policy if exists annotations_select on public.annotations;
create policy annotations_select on public.annotations for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_prof()));
drop policy if exists annotations_insert on public.annotations;
create policy annotations_insert on public.annotations for insert to authenticated
  with check ((select public.is_prof()) and auteur_id = (select auth.uid())
    and exists (select 1 from public.user_docs d where d.user_id = annotations.owner_id
                  and d.kind = annotations.target_kind and d.id = annotations.target_id));
drop policy if exists annotations_update on public.annotations;
create policy annotations_update on public.annotations for update to authenticated
  using ((select public.is_prof()) and auteur_id = (select auth.uid()))
  with check ((select public.is_prof()) and auteur_id = (select auth.uid()));
-- L'étudiant retire SA réponse (sur SON travail). La réponse elle-même
-- s'écrit par repondre_annotation (security definer) : une politique INSERT
-- qui interrogerait `annotations` ferait échouer TOUTE insertion en
-- « infinite recursion detected in policy » (42P17), celle de l'enseignant
-- comprise — la politique SELECT contient des sous-requêtes.
drop policy if exists annotations_reponse_update on public.annotations;
create policy annotations_reponse_update on public.annotations for update to authenticated
  using (owner_id = (select auth.uid()) and auteur_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and auteur_id = (select auth.uid()));

-- Droits de table explicites (défense en profondeur : Supabase accorde tout à
-- anon par défaut, et seule la RLS le retenait).
revoke all on public.user_docs, public.user_usage, public.annotations from anon;
revoke delete, truncate on public.user_docs, public.annotations from authenticated;
grant select, insert, update on public.user_docs to authenticated;
grant select on public.user_usage to authenticated;
grant select, insert on public.annotations to authenticated;
-- Mise à jour limitée au texte et au retrait : lu_le ne s'écrit que par
-- marquer_annotations_lues. L'ordre compte : un REVOKE de table retire aussi
-- les droits de colonne ; il doit donc précéder le GRANT par colonne.
revoke update on public.annotations from authenticated;
grant update (texte, deleted) on public.annotations to authenticated;
grant usage on sequence public.user_docs_rev_seq to authenticated;

-- ======================================================================
--  RPC : lecture et écriture des documents
-- ======================================================================

-- Écriture à contrôle de version. p_base_rev null = création.
-- En conflit (quelqu'un a écrit depuis), rien n'est écrit et la ligne serveur
-- est RENDUE, pour que le client décide sans relire.
-- p_attendu = l'utilisateur que le client croit être : si la session a changé
-- entre-temps, rien ne s'écrit sous le mauvais compte (28000).
-- Colonnes de sortie nommées autrement que la table (ambiguïté plpgsql).
create or replace function public.ecrire_doc(
  p_attendu uuid, p_kind text, p_id text, p_payload jsonb, p_base_rev bigint,
  p_supprime boolean default false
) returns table (ok boolean, rev_serveur bigint, maj_serveur timestamptz,
                 supprime_serveur boolean, contenu_serveur jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sup boolean := coalesce(p_supprime, false);
  v_rev bigint;
  v_maj timestamptz;
begin
  if v_uid is null or p_attendu is distinct from v_uid then
    raise exception 'session inattendue' using errcode = '28000';
  end if;
  if p_base_rev is null then
    insert into public.user_docs as d (user_id, kind, id, payload, deleted)
    values (v_uid, p_kind, p_id, case when v_sup then null else p_payload end, v_sup)
    on conflict (user_id, kind, id) do nothing
    returning d.rev, d.updated_at into v_rev, v_maj;
  else
    update public.user_docs as d
       set payload = case when v_sup then null else p_payload end, deleted = v_sup
     where d.user_id = v_uid and d.kind = p_kind and d.id = p_id and d.rev = p_base_rev
    returning d.rev, d.updated_at into v_rev, v_maj;
  end if;
  if v_rev is not null then
    return query select true, v_rev, v_maj, v_sup, null::jsonb;
  else
    -- Conflit : rend la ligne actuelle (aucune ligne si le document n'existe pas).
    return query select false, d.rev, d.updated_at, d.deleted, d.payload
      from public.user_docs d where d.user_id = v_uid and d.kind = p_kind and d.id = p_id;
  end if;
end $$;

-- Lecture incrémentale de SES documents (courbes exclues : lues à la demande).
-- Le curseur (p_apres_*) est rendu TEL QUEL par le client, jamais converti en
-- date JavaScript (troncature à la milliseconde -> page relue sans fin).
-- p_recul_s : relit les N dernières secondes, pour rattraper une écriture
-- validée APRÈS une lecture mais horodatée AVANT (transaction lente).
create or replace function public.lire_docs(
  p_attendu uuid, p_apres_maj timestamptz, p_apres_kind text, p_apres_id text,
  p_recul_s integer default 0, p_limite integer default 100
) returns table (doc_kind text, doc_id text, doc_rev bigint, maj_serveur timestamptz,
                 supprime boolean, contenu jsonb)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_attendu is distinct from v_uid then
    raise exception 'session inattendue' using errcode = '28000';
  end if;
  return query
    select d.kind, d.id, d.rev, d.updated_at, d.deleted, d.payload
      from public.user_docs d
     where d.user_id = v_uid and d.kind <> 'courbe'
       and (d.updated_at, d.kind, d.id) >
           (coalesce(p_apres_maj, '-infinity'::timestamptz)
              - make_interval(secs => greatest(coalesce(p_recul_s, 0), 0)),
            coalesce(p_apres_kind, ''), coalesce(p_apres_id, ''))
     order by d.updated_at, d.kind, d.id
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $$;

-- Lecture de la classe (enseignant). Projection ALLÉGÉE par défaut : garde ce
-- qu'affiche le tableau de bord (dont `recipes` et `parametres`, requis par
-- parametresEffectifs, et `composants` — les pesées, pour les alertes de
-- tolérance) ; p_complet = document intégral (export de la classe).
-- p_session : documents de cette session, plus ceux qui n'en portent pas
-- (antérieurs aux sessions : le client les classe d'après leurs dates).
create or replace function public.lire_docs_classe(
  p_apres_maj timestamptz, p_apres_user uuid, p_apres_kind text, p_apres_id text,
  p_recul_s integer default 0, p_limite integer default 100,
  p_complet boolean default false, p_session text default null
) returns table (proprietaire uuid, doc_kind text, doc_id text, doc_rev bigint,
                 maj_serveur timestamptz, cree_serveur timestamptz, supprime boolean, contenu jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_prof() then
    raise exception 'réservé à l''enseignant' using errcode = '42501';
  end if;
  return query
    select d.user_id, d.kind, d.id, d.rev, d.updated_at, d.created_at, d.deleted,
           case
             when p_complet           then d.payload
             when d.kind = 'gachee'   then d.payload - 'protocolesSnapshot' - 'ajustements'
             when d.kind = 'resultat' then d.payload - 'catalogue_liants' - 'constantes' - 'inputs'
           end
      from public.user_docs d
     where (p_complet or d.kind in ('gachee', 'resultat'))
       and (p_session is null or d.payload ->> 'sessionId' is null
            or d.payload ->> 'sessionId' = p_session)
       and (d.updated_at, d.user_id, d.kind, d.id) >
           (coalesce(p_apres_maj, '-infinity'::timestamptz)
              - make_interval(secs => greatest(coalesce(p_recul_s, 0), 0)),
            coalesce(p_apres_user, '00000000-0000-0000-0000-000000000000'::uuid),
            coalesce(p_apres_kind, ''), coalesce(p_apres_id, ''))
     order by d.updated_at, d.user_id, d.kind, d.id
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $$;

-- Annotations portant sur SON travail, par curseur (mêmes règles que lire_docs).
-- Sans les réponses de l'étudiant lui-même : un site resté en cache (antérieur
-- aux réponses) les afficherait comme des commentaires de l'enseignant. Le
-- site actuel lit lire_fil_annotations.
create or replace function public.lire_annotations(
  p_attendu uuid, p_apres_maj timestamptz, p_apres_id uuid,
  p_recul_s integer default 0, p_limite integer default 100
) returns table (annotation_id uuid, cible_kind text, cible_id text, cible_rev bigint,
                 ancre text, texte text, supprime boolean, maj_serveur timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_attendu is distinct from v_uid then
    raise exception 'session inattendue' using errcode = '28000';
  end if;
  return query
    select a.id, a.target_kind, a.target_id, a.target_rev, a.ancre,
           case when a.deleted then null else a.texte end, a.deleted, a.updated_at
      from public.annotations a
     where a.owner_id = v_uid and a.auteur_id <> a.owner_id
       and (a.updated_at, a.id) >
           (coalesce(p_apres_maj, '-infinity'::timestamptz)
              - make_interval(secs => greatest(coalesce(p_recul_s, 0), 0)),
            coalesce(p_apres_id, '00000000-0000-0000-0000-000000000000'::uuid))
     order by a.updated_at, a.id
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $$;

-- Le FIL de commentaires sur SON travail : ceux de l'enseignant et ses propres
-- réponses, avec l'auteur (de_moi), la date de création (ordre du fil) et
-- l'accusé de lecture. Même curseur que lire_annotations.
create or replace function public.lire_fil_annotations(
  p_attendu uuid, p_apres_maj timestamptz, p_apres_id uuid,
  p_recul_s integer default 0, p_limite integer default 100
) returns table (annotation_id uuid, cible_kind text, cible_id text, cible_rev bigint,
                 ancre text, texte text, supprime boolean, maj_serveur timestamptz,
                 de_moi boolean, cree_serveur timestamptz, lu_serveur timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_attendu is distinct from v_uid then
    raise exception 'session inattendue' using errcode = '28000';
  end if;
  return query
    select a.id, a.target_kind, a.target_id, a.target_rev, a.ancre,
           case when a.deleted then null else a.texte end, a.deleted, a.updated_at,
           a.auteur_id = v_uid, a.created_at, a.lu_le
      from public.annotations a
     where a.owner_id = v_uid
       and (a.updated_at, a.id) >
           (coalesce(p_apres_maj, '-infinity'::timestamptz)
              - make_interval(secs => greatest(coalesce(p_recul_s, 0), 0)),
            coalesce(p_apres_id, '00000000-0000-0000-0000-000000000000'::uuid))
     order by a.updated_at, a.id
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $$;

-- L'étudiant RÉPOND sur SON document, là où l'enseignant a commenté. Toutes
-- les vérifications sont ici (security definer : la RLS ne s'applique pas).
-- Plafond de 500 réponses par compte : l'inscription est ouverte (même
-- logique que le quota de user_docs).
create or replace function public.repondre_annotation(
  p_attendu uuid, p_kind text, p_id text, p_rev bigint, p_texte text
) returns table (annotation_id uuid, cree_serveur timestamptz, maj_serveur timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_texte text := btrim(coalesce(p_texte, ''));
begin
  if v_uid is null or p_attendu is distinct from v_uid then
    raise exception 'session inattendue' using errcode = '28000';
  end if;
  if char_length(v_texte) not between 1 and 4000 then
    raise exception 'réponse vide ou trop longue (4000 caractères au plus)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_docs d
                  where d.user_id = v_uid and d.kind = p_kind and d.id = p_id and not d.deleted) then
    raise exception 'document introuvable en ligne' using errcode = '42501';
  end if;
  if not exists (select 1 from public.annotations a
                  where a.owner_id = v_uid and a.target_kind = p_kind and a.target_id = p_id
                    and a.auteur_id <> v_uid and not a.deleted) then
    raise exception 'aucun commentaire de l''enseignant à qui répondre' using errcode = '42501';
  end if;
  if (select count(*) from public.annotations a where a.owner_id = v_uid and a.auteur_id = v_uid) >= 500 then
    raise exception 'nombre maximal de réponses atteint' using errcode = '53400';
  end if;
  return query
    insert into public.annotations as a (owner_id, target_kind, target_id, target_rev, ancre, auteur_id, texte)
    values (v_uid, p_kind, p_id, p_rev, null, v_uid, v_texte)
    returning a.id, a.created_at, a.updated_at;
end $$;

-- Accusé de lecture, posé par le DESTINATAIRE seulement : l'étudiant pour les
-- messages d'autrui sur SON travail, l'enseignant pour les réponses des
-- étudiants. Jamais sur ses propres messages. Un accusé déjà posé reste.
create or replace function public.marquer_annotations_lues(p_ids uuid[])
returns table (annotation_id uuid, lu_serveur timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prof boolean := public.is_prof();
begin
  if v_uid is null then
    raise exception 'non authentifié' using errcode = '28000';
  end if;
  if coalesce(cardinality(p_ids), 0) > 500 then
    raise exception 'trop de commentaires à la fois (500 au plus)' using errcode = '22023';
  end if;
  return query
    update public.annotations a set lu_le = clock_timestamp()
     where a.id = any(p_ids) and a.lu_le is null and not a.deleted
       and a.auteur_id <> v_uid
       and (a.owner_id = v_uid or (v_prof and a.auteur_id = a.owner_id))
    returning a.id, a.lu_le;
end $$;

-- Réponses d'étudiants pas encore lues (pastille « Classe » de l'enseignant).
create or replace function public.nb_reponses_non_lues() returns integer
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_prof() then
    raise exception 'réservé à l''enseignant' using errcode = '42501';
  end if;
  return (select count(*)::integer from public.annotations a
           where a.auteur_id = a.owner_id and a.lu_le is null and not a.deleted);
end $$;

-- ======================================================================
--  Comptes (enseignant) : lister, nommer ou retirer un enseignant, bloquer.
--  Security definer : ces fonctions lisent auth.users et changent un rôle,
--  ce qu'aucune politique ne permet. Chacune revérifie l'appelant.
--  La suppression définitive d'un compte reste une procédure SQL
--  (docs/OPERATIONS.md) : irréversible, elle n'a pas de bouton.
-- ======================================================================

-- Tous les comptes, avec de quoi décider : inscription, dernière connexion,
-- blocage, volume de travail en ligne. Colonnes de sortie nommées autrement
-- que celles des tables (ambiguïté plpgsql).
create or replace function public.lister_comptes()
returns table (compte_id uuid, courriel text, nom_affiche text, compte_role text, cree_le timestamptz,
               derniere_connexion timestamptz, bloque_jusqu_a timestamptz,
               nb_resultats integer, nb_gachees integer, derniere_activite timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_prof() then
    raise exception 'réservé à l''enseignant' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.display_name, coalesce(p.role, 'etudiant'), u.created_at, u.last_sign_in_at,
           case when u.banned_until > now() then u.banned_until end,
           coalesce(d.nb_r, 0), coalesce(d.nb_g, 0), d.derniere
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join lateral (select (count(*) filter (where x.kind = 'resultat' and not x.deleted))::integer as nb_r,
                                (count(*) filter (where x.kind = 'gachee' and not x.deleted))::integer as nb_g,
                                max(x.updated_at) as derniere
                           from public.user_docs x where x.user_id = u.id) d on true
     order by coalesce(p.role, 'etudiant') desc, coalesce(p.display_name, u.email::text);
end $$;

-- Nommer (p_role = 'prof') ou retirer (p_role = 'etudiant') un enseignant.
-- Jamais son propre rôle : l'appelant reste enseignant, la classe en garde
-- donc toujours un. Verrou commun avec bloquer_compte : deux enseignants qui
-- se retirent l'un l'autre en même temps passent l'un après l'autre, et le
-- second, revérifié APRÈS le verrou, n'est plus enseignant.
create or replace function public.definir_role(p_compte uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_role is null or p_role not in ('prof', 'etudiant') then
    raise exception 'rôle inconnu' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('minebackfill.comptes'));
  if (select auth.uid()) is null or not public.is_prof() then
    raise exception 'réservé à l''enseignant' using errcode = '42501';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'on ne change pas son propre rôle' using errcode = '42501';
  end if;
  if p_role = 'prof' and exists (select 1 from auth.users u where u.id = p_compte and u.banned_until > now()) then
    raise exception 'compte bloqué : débloquez-le avant de le nommer enseignant' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_compte;
  if not found then
    raise exception 'compte introuvable' using errcode = 'P0002';
  end if;
end $$;

-- Bloquer (connexion refusée) ou débloquer un compte étudiant. Même mécanisme
-- que « Ban user » de Supabase Studio (auth.users.banned_until) : un compte
-- bloqué d'un côté apparaît bloqué de l'autre. Durée : 876000 h (100 ans),
-- comme le « ban » de l'API d'administration — jamais 'infinity', que le
-- serveur d'authentification ne sait pas lire. Ses sessions sont supprimées :
-- il est déconnecté au plus tard à l'expiration de son jeton (1 h). Rien de
-- son travail n'est touché.
create or replace function public.bloquer_compte(p_compte uuid, p_bloquer boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_jusqu timestamptz := case when p_bloquer then now() + interval '876000 hours' end;
begin
  perform pg_advisory_xact_lock(hashtext('minebackfill.comptes'));
  if (select auth.uid()) is null or not public.is_prof() then
    raise exception 'réservé à l''enseignant' using errcode = '42501';
  end if;
  if p_compte = (select auth.uid()) then
    raise exception 'on ne se bloque pas soi-même' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_compte and p.role = 'prof') then
    raise exception 'retirez d''abord le rôle d''enseignant' using errcode = '42501';
  end if;
  update auth.users set banned_until = v_jusqu where id = p_compte;
  if not found then
    raise exception 'compte introuvable' using errcode = 'P0002';
  end if;
  if p_bloquer then
    delete from auth.sessions where user_id = p_compte; -- jetons de rafraîchissement : en cascade
  end if;
  return v_jusqu;
end $$;

-- Droits d'exécution : Supabase accorde EXECUTE à anon par défaut.
revoke execute on function public.ecrire_doc(uuid, text, text, jsonb, bigint, boolean) from public, anon;
revoke execute on function public.lire_docs(uuid, timestamptz, text, text, integer, integer) from public, anon;
revoke execute on function public.lire_docs_classe(timestamptz, uuid, text, text, integer, integer, boolean, text) from public, anon;
revoke execute on function public.lire_annotations(uuid, timestamptz, uuid, integer, integer) from public, anon;
revoke execute on function public.definir_nom(text) from public, anon;
revoke execute on function public.lire_fil_annotations(uuid, timestamptz, uuid, integer, integer) from public, anon;
revoke execute on function public.repondre_annotation(uuid, text, text, bigint, text) from public, anon;
revoke execute on function public.marquer_annotations_lues(uuid[]) from public, anon;
revoke execute on function public.nb_reponses_non_lues() from public, anon;
revoke execute on function public.lister_comptes() from public, anon;
revoke execute on function public.definir_role(uuid, text) from public, anon;
revoke execute on function public.bloquer_compte(uuid, boolean) from public, anon;
grant execute on function public.ecrire_doc(uuid, text, text, jsonb, bigint, boolean) to authenticated;
grant execute on function public.lire_docs(uuid, timestamptz, text, text, integer, integer) to authenticated;
grant execute on function public.lire_docs_classe(timestamptz, uuid, text, text, integer, integer, boolean, text) to authenticated;
grant execute on function public.lire_annotations(uuid, timestamptz, uuid, integer, integer) to authenticated;
grant execute on function public.definir_nom(text) to authenticated;
grant execute on function public.lire_fil_annotations(uuid, timestamptz, uuid, integer, integer) to authenticated;
grant execute on function public.repondre_annotation(uuid, text, text, bigint, text) to authenticated;
grant execute on function public.marquer_annotations_lues(uuid[]) to authenticated;
grant execute on function public.nb_reponses_non_lues() to authenticated;
grant execute on function public.lister_comptes() to authenticated;
grant execute on function public.definir_role(uuid, text) to authenticated;
grant execute on function public.bloquer_compte(uuid, boolean) to authenticated;

-- ======================================================================
--  Reprise unique de saved_results (v1) dans user_docs. Ré-exécutable : un
--  document déjà repris (ou supprimé depuis par l'étudiant) n'est pas touché.
-- ======================================================================
insert into public.user_docs (user_id, kind, id, payload)
select s.user_id, 'resultat', s.id, s.payload - 'ownerId'
  from public.saved_results s
 where s.id ~ '^[A-Za-z0-9_.:-]{1,100}$'
on conflict (user_id, kind, id) do nothing;

-- ======================================================================
--  COMPTE ENSEIGNANT — automatique : AVANT que l'enseignant s'inscrive,
--    select public.definir_code_enseignant('LE_CODE');
--  puis il s'inscrit (page Compte → Inscription → « Je suis l'enseignant »)
--  avec ce code : son compte est « prof » d'emblée. Le code ne sert qu'une
--  fois (2e argument pour plus : definir_code_enseignant('LE_CODE', 2)).
--  Compte déjà créé sans le code :
--    update public.profiles set role = 'prof' where email = 'prof@exemple.ca';
--  Ensuite, un enseignant nomme les autres depuis l'application (Classe →
--  Comptes), sans SQL.
--
--  CONTRÔLES après exécution (voir supabase/README.md) :
--    -- résultats v1 non repris (id hors format) : doit être 0
--    select count(*) from public.saved_results s where not exists (
--      select 1 from public.user_docs d where d.user_id = s.user_id
--        and d.kind = 'resultat' and d.id = s.id);
--    -- volume réel, à relancer chaque session
--    select kind, count(*), pg_size_pretty(sum(pg_column_size(payload)))
--      from public.user_docs group by kind;
-- ======================================================================
