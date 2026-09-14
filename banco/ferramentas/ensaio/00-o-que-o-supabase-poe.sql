create schema if not exists auth;
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
-- O Supabase abre os dois schemas para quem entrou, e isto NAO e detalhe.
-- Sem a linha do extensions, a trava do nome do cliente (que chama unaccent)
-- recusa todo insert de cliente, e o ensaio reprova codigo que esta certo.
-- Conferido no projeto de verdade em 14/09/2026: has_schema_privilege
-- ('authenticated','extensions','USAGE') devolve true la.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- O Storage. So a casca: a 006 cria o balde do avatar e as regras dele, e sem
-- estas duas tabelas o arquivo inteiro para na primeira linha.
create schema if not exists storage;
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[] language sql immutable
as $$ select (select array_agg(x) from unnest(string_to_array(name,'/')) with ordinality t(x, i)
               where i < array_length(string_to_array(name,'/'), 1)) $$;
