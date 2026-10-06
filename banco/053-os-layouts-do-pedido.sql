-- ===========================================================================
-- 053: OS LAYOUTS DO PEDIDO
--
-- A quarta parte da pagina Fichas tecnicas (wireframe de 05/10/2026, pranchas
-- 57, 62 e 64): o Movimento (as pecas feitas, orcamento por orcamento) e as
-- Estatisticas (o que mais vende). As duas precisam saber, de cada pedido, que
-- pecas ele tem: a referencia, a grade e a tecnica de cada layout.
--
-- ESSA RESPOSTA SO EXISTIA DENTRO DO `corpo` DA COTACAO, que e um documento
-- inteiro, com as imagens das artes dentro (regra 9 das convencoes: a lista
-- nunca pede o corpo). Uma view por cima do corpo abriria o documento de todos
-- os pedidos a cada leitura: com cem pedidos sao cem documentos com imagem
-- para somar pecas.
--
-- ENTAO O LAYOUT E COPIADO PARA UMA TABELA NA HORA EM QUE O PEDIDO NASCE, por
-- gatilho, e de novo se o corpo da cotacao aprovada mudar. E copia, e nao
-- conta: o que ela guarda e o que o orcamento diz (referencia, nome, grade,
-- tecnicas). Somar por referencia, por mes e por tamanho e do aplicativo
-- (regra 11: uma regra, uma linguagem).
--
-- O QUE ENTRA:
--   1. a tabela dos layouts do pedido
--   2. a funcao que copia, e os dois gatilhos que a chamam
--   3. a view que a tela le: o layout com o pedido, o cliente e a referencia
--   4. os layouts dos pedidos que ja existem
-- ===========================================================================


-- ---------- 1. a tabela -------------------------------------------------------
create table if not exists public.layout_do_pedido (
  pedido_id  uuid not null references public.pedido (id) on delete cascade,
  /* a posicao do layout no orcamento, comecando em 1 */
  ordem      int  not null,
  /* o numero que a folha mostra (L-01) */
  layout     int  not null,
  /* o codigo como esta no orcamento: FT-010-000M, ou vazio quando a peca foi
     escolhida so pelo nome */
  referencia text not null default '',
  nome       text not null default '',
  genero     text not null default '',
  faixa      text not null default '',
  arte       text not null default '',
  /* tamanho para pecas, so os tamanhos com peca */
  grade      jsonb not null default '{}'::jsonb,
  pecas      int  not null default 0,
  /* as tecnicas de producao do layout, na ordem da fabrica */
  tecnicas   text[] not null default '{}',

  primary key (pedido_id, ordem),
  constraint layout_do_pedido_grade_e_objeto check (jsonb_typeof(grade) = 'object'),
  constraint layout_do_pedido_tem_peca check (pecas > 0)
);

comment on table public.layout_do_pedido is
  'Copia do que o orcamento aprovado diz de cada layout (referencia, grade, tecnicas), feita por gatilho. Serve ao Movimento e as Estatisticas das Fichas tecnicas';

create index if not exists layout_do_pedido_por_referencia on public.layout_do_pedido (referencia);

alter table public.layout_do_pedido enable row level security;
drop policy if exists "quem foi aprovado le os layouts" on public.layout_do_pedido;
create policy "quem foi aprovado le os layouts" on public.layout_do_pedido
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.layout_do_pedido to authenticated;


-- ---------- 2. a copia --------------------------------------------------------
-- Le o corpo da cotacao do pedido e refaz as linhas dele. Sem acesso de fora:
-- quem chama sao os gatilhos e a carga do fim deste arquivo.
create or replace function public.copiar_layouts_do_pedido(p_pedido uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  doc jsonb;
  n   int;
begin
  select c.corpo into doc
    from public.pedido p join public.cotacao c on c.id = p.cotacao_id
   where p.id = p_pedido;

  delete from public.layout_do_pedido where pedido_id = p_pedido;
  if doc is null or jsonb_typeof(doc -> 'produtos') is distinct from 'array' then
    return 0;
  end if;

  insert into public.layout_do_pedido
    (pedido_id, ordem, layout, referencia, nome, genero, faixa, arte, grade, pecas, tecnicas)
  select p_pedido, t.ordem, t.layout, t.referencia, t.nome, t.genero, t.faixa, t.arte, t.grade,
         (select coalesce(sum(v::int), 0)::int from jsonb_each_text(t.grade) as g(k, v)),
         t.tecnicas
    from (
      select
        prod.ordem::int as ordem,
        case when b ->> 'n' ~ '^\d{1,6}$' then (b ->> 'n')::int else prod.ordem::int end as layout,
        btrim(coalesce(b ->> 'referencia', '')) as referencia,
        btrim(coalesce(b ->> 'nomeDaReferencia', '')) as nome,
        coalesce(b ->> 'genero', '') as genero,
        coalesce(b ->> 'faixa', '') as faixa,
        btrim(coalesce(b ->> 'arte', '')) as arte,
        /* a grade limpa: so numero inteiro maior que zero */
        coalesce((
          select jsonb_object_agg(g.k, g.v::int)
            from jsonb_each_text(case when jsonb_typeof(b -> 'grade') = 'object' then b -> 'grade' else '{}'::jsonb end) as g(k, v)
           where g.v ~ '^\d{1,6}$' and g.v::int > 0
        ), '{}'::jsonb) as grade,
        /* so as tecnicas que viram trabalho na fabrica, na ordem dela. Gola,
           ribana e etiqueta sao acabamento, e nao entram */
        array(
          select tec
            from unnest(array['subli', 'dtf', 'silk', 'bordado', 'patch']) with ordinality as o(tec, i)
           where exists (
             select 1
               from jsonb_array_elements(case when jsonb_typeof(b -> 'design') = 'array' then b -> 'design' else '[]'::jsonb end) as d
              where d ->> 'tecnica' = o.tec)
           order by o.i
        ) as tecnicas
      from jsonb_array_elements(doc -> 'produtos') with ordinality as prod(valor, ordem)
      cross join lateral (select prod.valor -> 'bloco' as b) as x
      where jsonb_typeof(x.b) = 'object'
        /* o modulo de informacoes e anexo do pedido, e nao peca */
        and not coalesce((x.b ->> 'informacoes') = 'true', false)
    ) as t
   where t.grade <> '{}'::jsonb;

  get diagnostics n = row_count;
  return n;
end $$;

/* ninguem chama de fora: nem quem esta logado, nem quem nao esta */
revoke all on function public.copiar_layouts_do_pedido(uuid) from public, anon, authenticated;

/* o pedido nasceu: copia os layouts dele. A COPIA NUNCA DERRUBA A VENDA: se
   um documento torto fizer a copia falhar, o pedido nasce do mesmo jeito e
   fica sem layouts, com um aviso no registro do banco (como a reserva, que
   tambem nao derruba a aprovacao) */
create or replace function public.pedido_copia_os_layouts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.copiar_layouts_do_pedido(new.id);
  exception when others then
    raise warning 'Os layouts do pedido % nao foram copiados: %', new.numero, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists pedido_copia_os_layouts on public.pedido;
create trigger pedido_copia_os_layouts
  after insert on public.pedido
  for each row execute function public.pedido_copia_os_layouts();

/* o corpo de uma cotacao que ja virou pedido mudou: a copia acompanha. O
   gatilho so dispara quando o update escreve a coluna corpo, e so trabalha se
   a cotacao tem pedido: salvar um rascunho nao custa nada aqui */
create or replace function public.cotacao_recopia_os_layouts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ped uuid;
begin
  for ped in select id from public.pedido where cotacao_id = new.id loop
    begin
      perform public.copiar_layouts_do_pedido(ped);
    exception when others then
      raise warning 'Os layouts do pedido % nao foram copiados: %', ped, sqlerrm;
    end;
  end loop;
  return null;
end $$;

drop trigger if exists cotacao_recopia_os_layouts on public.cotacao;
create trigger cotacao_recopia_os_layouts
  after update of corpo on public.cotacao
  for each row execute function public.cotacao_recopia_os_layouts();


-- ---------- 3. a view que a tela le --------------------------------------------
-- O layout com o que a tela precisa do pedido e a referencia que ele aponta.
-- Pedido cancelado fica de fora: peca de pedido cancelado nao foi vendida.
drop view if exists public.layout_na_fabrica;
create view public.layout_na_fabrica
with (security_invoker = true) as
select
  l.pedido_id,
  p.numero,
  p.nome as pedido_nome,
  coalesce(cl.nome, c.cliente_nome, '') as cliente,
  p.estado,
  p.etapa,
  p.etapa_em,
  p.aprovado_em,
  p.fechado_em,
  p.teste,
  l.ordem,
  l.layout,
  l.referencia,
  l.nome,
  l.genero,
  l.faixa,
  l.arte,
  l.grade,
  l.pecas,
  l.tecnicas,
  r.id as referencia_id,
  coalesce(r.grupo = 'KIT', false) as kit
from public.layout_do_pedido l
join public.pedido p on p.id = l.pedido_id
join public.cotacao c on c.id = p.cotacao_id
left join public.cliente cl on cl.id = p.cliente_id
/* a referencia do catalogo: pelo codigo, e pelo nome quando o orcamento nao
   guardou o codigo (o mesmo criterio da reserva, 026) */
left join lateral (
  select x.id, x.grupo
    from public.referencia x
   where (l.referencia <> '' and x.cod = l.referencia)
      or (l.referencia = '' and l.nome <> '' and x.nome = l.nome)
   order by x.ativo desc, x.cod
   limit 1
) r on true
where p.estado <> 'cancelado';

grant select on public.layout_na_fabrica to authenticated;


-- ---------- 4. os pedidos que ja existem ----------------------------------------
-- Um documento antigo e torto nao segura a migracao: o pedido dele fica sem
-- layouts, com um aviso, e os outros entram.
do $$
declare
  ped uuid;
begin
  for ped in select id from public.pedido loop
    begin
      perform public.copiar_layouts_do_pedido(ped);
    exception when others then
      raise warning 'Os layouts do pedido % nao foram copiados: %', ped, sqlerrm;
    end;
  end loop;
end $$;
