-- ===========================================================================
-- 068: AS TABELAS DE PRECO
--
-- Pedido do Henrique em 12/10/2026, pranchas 134 a 138 aprovadas ("adorei os
-- wireframes de tabela de preco, pode implementar todas"): varias tabelas
-- salvas no banco (Atacado, Varejo, Licitacao, a de um parceiro), cada uma
-- com as referencias e os kits da ficha tecnica e o preco por FAIXA DE
-- QUANTIDADE; a cotacao e cada layout escolhem a tabela; a tabela imprime.
--
-- UMA LINHA POR TABELA, com os itens dentro (jsonb). Uma tabela tem dezenas
-- de itens, e ela e lida e gravada inteira: a tela edita a grade e salva de
-- uma vez. Espalhar em duas tabelas seria a mesma tabela em dois lugares
-- para ninguem ganhar nada.
--
--   faixas: [{"de":10,"ate":20},{"de":21,"ate":50},...] (ate null = ou mais)
--   regras: {"passo_pct":-10,"arredondar":"90","plus_reais":6,
--            "infantil_pct":-10,"kit_pct":-8}
--   itens:  [{"codigo":"CT02","tipo":"referencia","base":54.9,
--             "precos":[null,48.9,null,null]}]
--     base   = o preco da primeira faixa, escrito por alguem;
--     precos = o que foi escrito a mao em cada faixa (null = a regra).
--   A conta (regra, arredondamento, plus, infantil, kit) e do sistema, em
--   src/dominio/preco: o banco guarda so o que alguem escreveu.
--
-- QUEM MEXE: le quem foi aprovado; cria, muda e arquiva o admin e o gerente.
-- Apagar de vez so o admin (a cotacao guarda o nome e os valores, e nao
-- depende da tabela continuar existindo).
--
-- A TABELA PADRAO: no maximo uma, e ela nao pode estar arquivada.
-- ===========================================================================

create table if not exists public.tabela_de_preco (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  situacao       text not null default 'rascunho',
  padrao         boolean not null default false,
  vale_ate       date,
  /* true: na cotacao, so admin e gerente escolhem esta tabela */
  so_gerente     boolean not null default false,
  faixas         jsonb not null default '[{"de":10,"ate":20},{"de":21,"ate":50},{"de":51,"ate":100},{"de":101,"ate":null}]'::jsonb,
  regras         jsonb not null default '{"passo_pct":-10,"arredondar":"90","plus_reais":6,"infantil_pct":-10,"kit_pct":-8}'::jsonb,
  itens          jsonb not null default '[]'::jsonb,
  observacao     text not null default '',
  teste          boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.pessoa (id) on delete set null,
  constraint tabela_de_preco_nome check (length(btrim(nome)) between 1 and 60),
  constraint tabela_de_preco_situacao check (situacao in ('rascunho', 'ativa', 'arquivada')),
  constraint tabela_de_preco_faixas_lista check (jsonb_typeof(faixas) = 'array' and jsonb_array_length(faixas) between 1 and 8),
  constraint tabela_de_preco_regras_objeto check (jsonb_typeof(regras) = 'object'),
  constraint tabela_de_preco_itens_lista check (jsonb_typeof(itens) = 'array'),
  constraint tabela_de_preco_padrao_ativa check (not padrao or situacao <> 'arquivada')
);

create unique index if not exists tabela_de_preco_nome_unico
  on public.tabela_de_preco (lower(btrim(nome)));
create unique index if not exists tabela_de_preco_uma_padrao
  on public.tabela_de_preco (padrao) where padrao;

comment on table public.tabela_de_preco is
  'As tabelas de preco da casa (068): faixas de quantidade, regras e os itens (referencias e kits) com o que alguem escreveu. A conta mora em src/dominio/preco';

alter table public.tabela_de_preco enable row level security;

drop policy if exists "quem foi aprovado le as tabelas de preco" on public.tabela_de_preco;
create policy "quem foi aprovado le as tabelas de preco" on public.tabela_de_preco
  for select to authenticated
  using (public.meu_papel() is not null);

drop policy if exists "admin e gerente criam tabela de preco" on public.tabela_de_preco;
create policy "admin e gerente criam tabela de preco" on public.tabela_de_preco
  for insert to authenticated
  with check (public.meu_papel() in ('admin', 'gerente'));

drop policy if exists "admin e gerente mudam tabela de preco" on public.tabela_de_preco;
create policy "admin e gerente mudam tabela de preco" on public.tabela_de_preco
  for update to authenticated
  using (public.meu_papel() in ('admin', 'gerente'))
  with check (public.meu_papel() in ('admin', 'gerente'));

drop policy if exists "o admin apaga tabela de preco" on public.tabela_de_preco;
create policy "o admin apaga tabela de preco" on public.tabela_de_preco
  for delete to authenticated
  using (public.meu_papel() = 'admin');

grant select, insert, update, delete on public.tabela_de_preco to authenticated;

/* quem mexeu e quando, gravado pelo banco e nao pela tela */
create or replace function public.anotar_a_tabela_de_preco()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists anotar_a_tabela_de_preco on public.tabela_de_preco;
create trigger anotar_a_tabela_de_preco
  before insert or update on public.tabela_de_preco
  for each row execute function public.anotar_a_tabela_de_preco();

/* TROCAR A PADRAO NUMA CHAMADA SO: a velha deixa de ser, a nova passa a ser.
   Pela tela seriam dois updates, e entre os dois o indice da padrao unica
   recusaria o segundo. */
create or replace function public.tabela_de_preco_padrao(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.meu_papel() not in ('admin', 'gerente') then
    raise exception 'Seu acesso não permite mudar a tabela padrão.' using errcode = '42501';
  end if;
  update public.tabela_de_preco set padrao = false where padrao and id <> p_id;
  update public.tabela_de_preco set padrao = true, situacao = 'ativa' where id = p_id;
  if not found then
    raise exception 'Tabela não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.tabela_de_preco_padrao(uuid) from public, anon;
grant execute on function public.tabela_de_preco_padrao(uuid) to authenticated;


-- ---------- conferencia ----------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'tabela_de_preco') then
    raise exception 'tabela_de_preco nao ficou de pe';
  end if;
  if not has_table_privilege('authenticated', 'public.tabela_de_preco', 'select') then
    raise exception 'tabela_de_preco sem leitura para authenticated';
  end if;
  if has_function_privilege('anon', 'public.tabela_de_preco_padrao(uuid)', 'execute') then
    raise exception 'tabela_de_preco_padrao aberta para anon';
  end if;
  raise notice '068 ok: as tabelas de preco';
end $$;
