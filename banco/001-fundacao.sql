-- ============================================================
-- Fourtime OS - 001 fundacao
-- pessoa (quem usa o sistema) e cliente (a base do Bling)
-- ============================================================

-- ---------- o que o Postgres precisa ter ligado ---------------
-- unaccent tira o acento. E dele que sai a trava do nome do cliente.
create extension if not exists unaccent with schema extensions;

-- ---------- quem usa o sistema -------------------------------
create type public.papel as enum ('dono', 'vendedor', 'producao');

create table public.pessoa (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null default '',
  papel      public.papel not null default 'producao',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

alter table public.pessoa enable row level security;

-- O papel de quem esta pedindo. E security definer de proposito: se a policy
-- da tabela pessoa consultasse a propria tabela pessoa, ela entraria em
-- recursao e ninguem leria nada.
create or replace function public.meu_papel()
returns public.papel
language sql
stable
security definer
set search_path = public
as $$ select papel from public.pessoa where id = auth.uid() and ativo $$;

create policy "pessoa le o proprio cadastro, dono le todos"
  on public.pessoa for select to authenticated
  using (id = auth.uid() or public.meu_papel() = 'dono');

create policy "so o dono mexe em pessoa"
  on public.pessoa for all to authenticated
  using (public.meu_papel() = 'dono')
  with check (public.meu_papel() = 'dono');

-- Conta criada no painel do Supabase ja nasce com a linha em pessoa.
create or replace function public.ao_criar_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pessoa (id, nome)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger conta_nova
  after insert on auth.users
  for each row execute function public.ao_criar_conta();

-- ---------- o cliente ----------------------------------------
create type public.segmento as enum
  ('escola','academia','time','empresa','orgao','igreja','evento','outros');

create type public.tipo_de_pessoa as enum ('F','J');

create table public.cliente (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  fantasia         text not null default '',
  tipo             public.tipo_de_pessoa not null default 'J',
  documento        text not null default '',
  contato          text not null default '',
  telefone         text not null default '',
  celular          text not null default '',
  email            text not null default '',
  endereco         text not null default '',
  complemento      text not null default '',
  bairro           text not null default '',
  cidade           text not null default '',
  uf               text not null default '',
  cep              text not null default '',
  tipo_de_contato  text not null default 'Cliente',
  segmento         public.segmento not null default 'outros',
  vendedor         text not null default '',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  constraint cliente_nome_nao_vazio check (btrim(nome) <> ''),
  constraint cliente_uf_com_duas_letras check (uf = '' or uf ~ '^[A-Z]{2}$')
);

-- A TRAVA. O nome e a identidade do cliente, e por isso ele nao pode repetir.
-- Sem acento e sem caixa, porque "Escola Sao Jose" e "ESCOLA SAO JOSE" com
-- acento sao o mesmo cliente. Foi a falta disso que virou 225 clientes em 900.
--
-- A funcao precisa ser immutable para servir de indice. Por isso ela chama a
-- forma de dois argumentos do unaccent, que e a immutable: a de um argumento
-- procura o dicionario toda vez e o Postgres nao aceita num indice.
create or replace function public.chave_do_nome(t text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(btrim(extensions.unaccent('extensions.unaccent'::regdictionary, t)))
$$;

create unique index cliente_nome_unico
  on public.cliente (public.chave_do_nome(nome));

create index cliente_por_documento on public.cliente (documento)
  where documento <> '';
create index cliente_por_cidade on public.cliente (cidade);

alter table public.cliente enable row level security;

create policy "todo mundo que entrou le cliente"
  on public.cliente for select to authenticated using (true);

create policy "dono e vendedor cadastram cliente"
  on public.cliente for insert to authenticated
  with check (public.meu_papel() in ('dono','vendedor'));

create policy "dono e vendedor editam cliente"
  on public.cliente for update to authenticated
  using (public.meu_papel() in ('dono','vendedor'))
  with check (public.meu_papel() in ('dono','vendedor'));

create policy "so o dono apaga cliente"
  on public.cliente for delete to authenticated
  using (public.meu_papel() = 'dono');

-- ---------- o carimbo de atualizacao -------------------------
create or replace function public.carimbar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

create trigger cliente_carimbo
  before update on public.cliente
  for each row execute function public.carimbar_atualizacao();

-- ---------- quem enxerga a tabela pela API -------------------
-- O projeto foi criado com "expor tabela nova" desligado, entao cada tabela
-- precisa da liberacao escrita na mao. Quem decide o que a pessoa ve continua
-- sendo a policy la em cima: isto aqui so abre a porta da sala.
grant select on public.pessoa to authenticated;
grant select, insert, update, delete on public.cliente to authenticated;
