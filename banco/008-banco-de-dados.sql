-- ============================================================
-- Fourtime OS - 008 o banco de dados da fabrica
-- ============================================================
-- As listas que alimentam os menus do orcamento e da ficha, vindas do editor
-- v3.375. Nao sao dados de exemplo: sao os codigos que a fabrica usa para se
-- entender, e por isso a regra numero um aqui e que CODIGO NAO MUDA.
--
--   Referencia   FT-GGG-NNNX     grupo de peca e genero no proprio codigo
--   Cor DTF      001 a 300       tres digitos, tabela fixa
--   Cor subli    S01 a S87       S e dois digitos, tabela fixa
--
-- O que muda e o nome. As cores de impressao nao tem nome nenhum hoje: quem
-- vende escreve "(157)" na observacao do orcamento, e o cliente le um numero.
-- A coluna nome existe para isso, e nasce vazia de proposito: nome inventado
-- em silencio no orcamento do cliente e pior que numero.

-- ---------- os grupos ----------------------------------------
create table public.grupo_de_referencia (
  cod   text primary key,
  nome  text not null,
  ordem int  not null
);

create table public.grupo_de_tecido (
  cod   text primary key,
  nome  text not null,
  ordem int  not null
);

create table public.grupo_de_cor (
  cod   text primary key,
  nome  text not null,
  ordem int  not null
);

-- ---------- referencia ---------------------------------------
-- O codigo NAO e a chave primaria, e isso doi de escrever.
--
-- Deveria ser: o codigo e a identidade da peca na fabrica. Mas na base de hoje
-- FT-110-002U e FT-110-003U apontam cada um para DUAS pecas diferentes, e
-- nove linhas nao tem codigo nenhum (duas delas sao tecido digitado na lista
-- errada). Se o codigo fosse a chave, a migracao recusaria essas linhas e o
-- problema sumiria de vista sem ter sido resolvido.
--
-- Entao entra tudo, com uma chave interna, e a tela mostra o conflito. Quando
-- o Henrique arrumar os dois, a trava vira indice unico de verdade.
create table public.referencia (
  id     uuid primary key default gen_random_uuid(),
  cod    text not null default '',
  nome   text not null,
  grupo  text references public.grupo_de_referencia (cod),
  /** M masculino, F feminino, C infantil, U unissex */
  genero text not null default '',
  ordem  int  not null default 0,
  ativo  boolean not null default true,
  criado_em timestamptz not null default now(),

  constraint referencia_nome_nao_vazio check (btrim(nome) <> '')
);

create index referencia_por_grupo on public.referencia (grupo, ordem);
create index referencia_por_cod on public.referencia (cod) where cod <> '';

/* Quem esta repetido ou sem codigo. A tela le daqui para mostrar o aviso, em
   vez de cada tela refazer a conta do seu jeito. */
create view public.referencia_com_problema
with (security_invoker = true) as
select r.id, r.cod, r.nome,
       case when r.cod = '' then 'sem codigo' else 'codigo repetido' end as problema
from public.referencia r
where r.cod = ''
   or exists (
     select 1 from public.referencia o
      where o.cod = r.cod and o.cod <> '' and o.id <> r.id
   );

-- ---------- tecido -------------------------------------------
create table public.tecido (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  grupo text references public.grupo_de_tecido (cod),
  ordem int not null default 0,
  ativo boolean not null default true
);

-- ---------- cor de tecido ------------------------------------
create table public.cor_de_tecido (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  hex   text not null,
  grupo text references public.grupo_de_cor (cod),
  ordem int not null default 0,
  ativo boolean not null default true,

  constraint cor_de_tecido_hex check (hex ~* '^#[0-9a-f]{6}$')
);

-- ---------- cor de impressao ---------------------------------
-- Tabela fixa da fabrica: ninguem acrescenta nem apaga cor de DTF pela tela,
-- porque o numero e o que o operador le na maquina. O que a tela edita e o
-- nome, e so ele.
create table public.cor_de_impressao (
  codigo  text primary key,
  tecnica text not null check (tecnica in ('dtf', 'sublimacao')),
  numero  int  not null,
  hex     text not null,
  /* vazio ate alguem nomear. E o nome que vai para o orcamento do cliente */
  nome    text not null default '',

  constraint cor_de_impressao_hex check (hex ~* '^#[0-9a-f]{6}$'),
  unique (tecnica, numero)
);

create index cor_de_impressao_por_tecnica on public.cor_de_impressao (tecnica, numero);

-- ---------- as listas do cabecalho ---------------------------
-- Cinco listas de texto solto com a mesma cara e o mesmo comportamento:
-- pagamento, entrega, embalagem, vendedor, departamento. Cinco tabelas iguais
-- seriam cinco lugares para esquecer de mexer.
create table public.lista_do_cabecalho (
  tipo  text not null check (
          tipo in ('pagamento', 'entrega', 'embalagem', 'vendedor', 'departamento')
        ),
  valor text not null,
  ordem int  not null default 0,
  ativo boolean not null default true,

  primary key (tipo, valor)
);

-- ---------- quem le e quem mexe ------------------------------
-- Todo mundo que entrou le: sem isso nenhuma tela de orcamento monta o menu.
-- Quem mexe e admin ou gerente, porque mudar o nome de uma referencia muda o
-- que sai impresso na ficha que vai para a mesa de corte.
do $$
declare t text;
begin
  foreach t in array array[
    'grupo_de_referencia','grupo_de_tecido','grupo_de_cor',
    'referencia','tecido','cor_de_tecido','cor_de_impressao','lista_do_cabecalho'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "quem entrou le %1$s" on public.%1$I for select to authenticated using (public.meu_papel() is not null)', t);

    execute format(
      'create policy "admin e gerente mexem em %1$s" on public.%1$I for all to authenticated '
      'using (public.meu_papel() in (''admin'',''gerente'')) '
      'with check (public.meu_papel() in (''admin'',''gerente''))', t);

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant select on public.referencia_com_problema to authenticated;
