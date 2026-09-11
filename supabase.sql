-- ===================================================================
-- COMPTARAPIDE — Dossiers de création de société
-- À coller en une seule fois dans Supabase → SQL Editor → Run.
-- ===================================================================

-- 1. TABLE ----------------------------------------------------------
create table if not exists public.dossiers (
  id               uuid primary key,
  created_at       timestamptz not null default now(),
  reference        text not null,
  denomination     text,
  forme            text,
  formule          text,
  dirigeant_nom    text,
  dirigeant_email  text,
  dirigeant_tel    text,
  lang             text default 'fr',
  autorisation     boolean default false,
  usage_textes     boolean default false,
  nb_photos        int default 0,
  reponses         jsonb not null default '{}'::jsonb,
  photos           jsonb not null default '[]'::jsonb,
  -- champs de suivi, réservés à l'administrateur
  lu               boolean not null default false,
  statut           text not null default 'nouveau',
  notes            text
);

create index if not exists dossiers_created_idx on public.dossiers (created_at desc);
create index if not exists dossiers_lu_idx      on public.dossiers (lu);

-- Garde-fous : le formulaire est ouvert à toute personne ayant le lien,
-- ces limites empêchent qu'un dépôt malveillant sature la base.
alter table public.dossiers drop constraint if exists dossiers_taille;
alter table public.dossiers add  constraint dossiers_taille check (
  pg_column_size(reponses) < 300000
  and pg_column_size(photos) < 40000
  and coalesce(nb_photos,0) between 0 and 40
  and length(coalesce(reference,'')) between 4 and 40
  and length(coalesce(denomination,'')) < 200
  and length(coalesce(dirigeant_nom,'')) < 200
  and length(coalesce(dirigeant_email,'')) < 200
  and length(coalesce(dirigeant_tel,'')) < 60
  and length(coalesce(forme,'')) < 20
  and length(coalesce(formule,'')) < 4
  and length(coalesce(lang,'')) < 4
);

-- 2. SÉCURITÉ DE LA TABLE -------------------------------------------
-- Le projet a été créé SANS exposition automatique des tables : aucun
-- rôle n'a de droit par défaut. On accorde ici le strict nécessaire,
-- table par table. C'est la première des deux barrières ; la RLS
-- ci-dessous est la seconde.
grant usage on schema public to anon, authenticated;
revoke all on public.dossiers from anon, authenticated;
grant insert                 on public.dossiers to anon;           -- déposer, rien d'autre
grant select, update, delete on public.dossiers to authenticated;  -- vous


-- anon  : peut UNIQUEMENT insérer (déposer son dossier).
-- authenticated (vous) : lecture, modification, suppression.
alter table public.dossiers enable row level security;

drop policy if exists "depot anonyme"      on public.dossiers;
drop policy if exists "admin lecture"      on public.dossiers;
drop policy if exists "admin modification" on public.dossiers;
drop policy if exists "admin suppression"  on public.dossiers;

create policy "depot anonyme"      on public.dossiers for insert to anon          with check (true);
create policy "admin lecture"      on public.dossiers for select to authenticated using (true);
create policy "admin modification" on public.dossiers for update to authenticated using (true) with check (true);
create policy "admin suppression"  on public.dossiers for delete to authenticated using (true);

-- Empêche un déposant de se déclarer « déjà lu » ou de laisser des notes.
create or replace function public.dossiers_depot_propre()
returns trigger language plpgsql as $$
begin
  new.lu := false;
  new.statut := 'nouveau';
  new.notes := null;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists dossiers_depot_propre_trg on public.dossiers;
create trigger dossiers_depot_propre_trg
  before insert on public.dossiers
  for each row execute function public.dossiers_depot_propre();

-- 3. STOCKAGE DES PHOTOS --------------------------------------------
-- Bucket PRIVÉ : personne ne peut deviner une URL et lire une pièce
-- d'identité. L'espace admin passe par des liens signés temporaires.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dossiers', 'dossiers', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "envoi anonyme photos"   on storage.objects;
drop policy if exists "admin lecture photos"   on storage.objects;
drop policy if exists "admin suppression photos" on storage.objects;

create policy "envoi anonyme photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'dossiers');

create policy "admin lecture photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'dossiers');

create policy "admin suppression photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dossiers');

-- 4. VÉRIFICATION ----------------------------------------------------
-- Doit renvoyer rowsecurity = true et 4 policies sur la table.
select relrowsecurity as rls_active
  from pg_class where oid = 'public.dossiers'::regclass;
select policyname, cmd, roles
  from pg_policies where schemaname='public' and tablename='dossiers'
  order by policyname;
select id, public as bucket_public, file_size_limit
  from storage.buckets where id='dossiers';
-- Droits SQL effectifs : anon ne doit avoir QUE INSERT.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name='dossiers'
   and grantee in ('anon','authenticated')
 order by grantee, privilege_type;

-- ===================================================================
-- ENSUITE, une seule fois, dans Supabase → Authentication → Users :
--   « Add user » → votre e-mail + un mot de passe → « Auto Confirm ».
--   C'est ce compte qui ouvre admin.html.
-- Puis Authentication → Providers → Email : désactivez
--   « Enable Sign Up » pour que personne d'autre ne puisse s'inscrire.
-- ===================================================================
