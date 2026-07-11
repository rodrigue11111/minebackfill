-- MineBackfill — schéma Supabase (multi-utilisateur).
-- Idempotent autant que possible : à exécuter dans SQL Editor du projet.
-- Sécurité = RLS Postgres (l'anon key est publique par conception).
-- Voir supabase/README.md pour la marche à suivre complète.

-- ======================================================================
--  profils : rôle par utilisateur, créé automatiquement au signup
-- ======================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'etudiant' check (role in ('prof', 'etudiant')),
  created_at timestamptz not null default now()
);

-- PIÈGE : une politique sur profiles qui interroge profiles boucle (récursion
-- RLS). Solution canonique : fonction security definer (contourne la RLS).
create or replace function public.is_prof() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'prof') $$;

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
     insert into public.profiles (id, email) values (new.id, new.email)
     on conflict (id) do nothing;
     return new;
   end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ======================================================================
--  catalogues officiels : une ligne par catalogue, data = enveloppe {v,data}
--  (IDENTIQUE au format persisted.ts côté frontend : réutilise ses migrations)
-- ======================================================================
create table if not exists public.official_catalogs (
  id         text primary key check (id in ('liants','residus','granulats','retardateurs','constantes')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ======================================================================
--  résultats : id = l'id client `sr_...` (clé de fusion dédupliquée existante)
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
--  Row Level Security
-- ======================================================================
alter table public.profiles          enable row level security;
alter table public.official_catalogs enable row level security;
alter table public.saved_results     enable row level security;

-- profiles : chacun lit le sien ; le prof lit tout (afficher qui a produit quoi).
-- AUCUNE politique insert/update/delete -> rôle modifiable UNIQUEMENT en SQL
-- (anti-escalade : un étudiant ne peut pas se promouvoir prof).
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

-- résultats : l'étudiant CRUD les siens ; le prof lit tout (revue pédagogique),
-- ne modifie pas ceux des autres.
drop policy if exists results_select on public.saved_results;
create policy results_select on public.saved_results for select
  to authenticated using (user_id = auth.uid() or public.is_prof());
drop policy if exists results_insert on public.saved_results;
create policy results_insert on public.saved_results for insert
  to authenticated with check (user_id = auth.uid());
drop policy if exists results_update on public.saved_results;
create policy results_update on public.saved_results for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists results_delete on public.saved_results;
create policy results_delete on public.saved_results for delete
  to authenticated using (user_id = auth.uid());

-- ======================================================================
--  BOOTSTRAP PROF (one-off, après création du compte via /compte) :
--    update public.profiles set role = 'prof' where email = 'prof@exemple.ca';
-- ======================================================================
