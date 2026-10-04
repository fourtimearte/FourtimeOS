-- ===========================================================================
-- 046: A FOTO DO PRODUTO VENDIDO
--
-- O Henrique pediu a miniatura do produto ao lado de cada compra, na pagina do
-- parceiro (na loja) e na pagina Parceiros (no Fourtime OS). O aviso de pedido
-- da Shopify nao traz foto. Quem traz e a leitura dos produtos da colecao, que
-- o porteiro ja faz: ela passa a guardar tambem o endereco da foto principal.
--
--   produto_do_parceiro.imagem   o endereco da foto principal do produto na
--                                loja (cdn da Shopify), ou vazio
--   venda_do_parceiro.imagem     a mesma foto, em cada venda (coluna nova, no
--                                fim da view)
--   painel_do_parceiro           cada venda ganha o campo "imagem"
--
-- A foto e a de HOJE, e nao a do dia da venda. Produto que saiu da loja (ou
-- que esta em rascunho) fica sem foto, e a tela mostra um quadro vazio.
--
-- As funcoes partem do corpo que esta no banco hoje (registrar_produtos da
-- 043, painel da 045). As assinaturas nao mudam, entao os grants ficam.
-- ===========================================================================

alter table public.produto_do_parceiro
  add column if not exists imagem text not null default '';

alter table public.produto_do_parceiro
  drop constraint if exists produto_do_parceiro_imagem_e_endereco;
alter table public.produto_do_parceiro
  add constraint produto_do_parceiro_imagem_e_endereco check (imagem = '' or imagem ~ '^https://');


create or replace view public.venda_do_parceiro
with (security_invoker = true) as
select v.item_id,
       pp.parceiro_id,
       v.pedido_id,
       v.pedido,
       v.vendido_em,
       to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
       v.produto_id,
       v.produto,
       v.variante,
       v.quantidade,
       v.devolvida,
       c.conta,
       c.aparece,
       case when c.conta then null
            when v.cancelado_em is not null then 'cancelada'
            else 'devolvida' end as motivo,
       c.pecas,
       c.valor,
       c.cheio,
       a.tipo  as acordo_tipo,
       a.valor as acordo_valor,
       a.base  as acordo_base,
       case when not c.conta then 0
            when a.id is null then null
            when a.tipo = 'valor_por_peca' then round(c.pecas * a.valor, 2)
            when a.base = 'preco_cheio' then round(c.cheio * a.valor / 100, 2)
            else round(c.valor * a.valor / 100, 2)
       end as parte,
       v.situacao,
       v.cancelado_em,
       pp.imagem
  from public.venda_da_loja v
  join public.produto_do_parceiro pp on pp.produto_id = v.produto_id
 cross join lateral (
        select q.conta,
               q.aparece,
               case when q.conta then q.liquida else 0 end as pecas,
               case when q.conta
                    then round((v.quantidade * v.preco - v.desconto) * q.liquida / v.quantidade, 2)
                    else 0 end as valor,
               case when q.conta then round(v.preco * q.liquida, 2) else 0 end as cheio
          from (select greatest(v.quantidade - v.devolvida, 0) as liquida,
                       v.situacao in ('paid', 'partially_refunded', 'refunded') as aparece,
                       v.situacao in ('paid', 'partially_refunded')
                         and v.cancelado_em is null
                         and v.quantidade - v.devolvida > 0 as conta) q
       ) c
  left join lateral (
        select x.id, x.tipo, x.valor, x.base
          from public.acordo_do_parceiro x
         where x.parceiro_id = pp.parceiro_id
           and x.vale_desde <= (v.vendido_em at time zone 'America/Sao_Paulo')::date
         order by x.vale_desde desc
         limit 1
       ) a on true;


create or replace function public.registrar_produtos_do_parceiro(
  p_parceiro uuid,
  p_produtos jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not exists (select 1 from public.parceiro where id = p_parceiro) then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.produto_do_parceiro (produto_id, parceiro_id, titulo, imagem, visto_em)
  select distinct on ((x ->> 'id')::bigint)
         (x ->> 'id')::bigint, p_parceiro, coalesce(x ->> 'titulo', ''),
         case when coalesce(x ->> 'imagem', '') ~ '^https://' then x ->> 'imagem' else '' end,
         now()
    from jsonb_array_elements(coalesce(p_produtos, '[]'::jsonb)) x
   where coalesce(x ->> 'id', '') ~ '^[0-9]+$'
  on conflict (produto_id) do update
    set titulo = excluded.titulo,
        /* leitura que veio sem foto nao apaga a foto que ja estava guardada */
        imagem = case when excluded.imagem <> '' then excluded.imagem else public.produto_do_parceiro.imagem end,
        visto_em = excluded.visto_em
    where public.produto_do_parceiro.parceiro_id = excluded.parceiro_id;
  update public.parceiro set produtos_em = now() where id = p_parceiro;
  select count(*) into n from public.produto_do_parceiro where parceiro_id = p_parceiro;
  return n;
end $$;


create or replace function public.painel_do_parceiro(p_chave text, p_senha text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p      public.parceiro;
  agora  timestamptz := now();
  hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  inicio date;
begin
  select * into p from public.parceiro
   where chave = btrim(coalesce(p_chave, '')) for update;
  if not found or not p.ativo then
    return jsonb_build_object('ok', false, 'erro', 'indisponivel');
  end if;

  if p.travado_ate is not null and p.travado_ate > agora then
    return jsonb_build_object('ok', false, 'erro', 'travado',
      'minutos', greatest(1, ceil(extract(epoch from p.travado_ate - agora) / 60)::int));
  end if;

  if upper(btrim(coalesce(p_senha, ''))) is distinct from upper(p.senha) then
    if p.erros + 1 >= 5 then
      update public.parceiro set erros = 0, travado_ate = agora + interval '15 minutes' where id = p.id;
      return jsonb_build_object('ok', false, 'erro', 'travado', 'minutos', 15);
    end if;
    update public.parceiro set erros = p.erros + 1, travado_ate = null where id = p.id;
    return jsonb_build_object('ok', false, 'erro', 'senha', 'restam', 5 - (p.erros + 1));
  end if;

  update public.parceiro set erros = 0, travado_ate = null, aberta_em = agora where id = p.id;

  inicio := (date_trunc('month', hoje::timestamp) - interval '23 months')::date;

  return jsonb_build_object(
    'ok', true,
    'parceiro', p.nome,
    'hoje', hoje,
    'acordo', (
      select jsonb_build_object('tipo', x.tipo, 'valor', x.valor, 'base', x.base, 'desde', x.vale_desde)
        from public.acordo_do_parceiro x
       where x.parceiro_id = p.id and x.vale_desde <= hoje
       order by x.vale_desde desc limit 1),
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object('mes', m.mes, 'pecas', m.pecas, 'valor', m.valor, 'parte', m.parte)
                       order by m.mes desc)
        from (select v.mes,
                     sum(v.pecas)::int as pecas,
                     sum(v.valor) as valor,
                     sum(coalesce(v.parte, 0)) as parte
                from public.venda_do_parceiro v
               where v.parceiro_id = p.id and v.conta
                 and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio
               group by v.mes) m), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
                 'quando', to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
                 'mes', v.mes,
                 'produto', v.produto,
                 'imagem', v.imagem,
                 'variante', v.variante,
                 'quantidade', v.quantidade,
                 'pecas', v.pecas,
                 'valor', v.valor,
                 'vendido', round(l.quantidade * l.preco - l.desconto, 2),
                 'parte', v.parte,
                 'conta', v.conta,
                 'motivo', v.motivo)
               order by v.vendido_em desc, v.item_id)
        from public.venda_do_parceiro v
        join public.venda_da_loja l on l.item_id = v.item_id
       where v.parceiro_id = p.id and v.aparece
         and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio), '[]'::jsonb)
  );
end $$;


-- ---------- a prova --------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'venda_do_parceiro' and column_name = 'imagem') then
    raise exception 'a view venda_do_parceiro nao ganhou a coluna imagem';
  end if;
  if has_function_privilege('anon', 'public.registrar_produtos_do_parceiro(uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_produtos_do_parceiro(uuid, jsonb)', 'execute') then
    raise exception 'registrar_produtos_do_parceiro ficou aberta a quem nao e o porteiro';
  end if;
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a pagina do parceiro perdeu o acesso a painel_do_parceiro';
  end if;
  if has_table_privilege('anon', 'public.venda_do_parceiro', 'select')
     or has_table_privilege('anon', 'public.produto_do_parceiro', 'select') then
    raise exception 'quem nao entrou passou a ler tabela dos parceiros';
  end if;
  if position('vendido' in pg_get_functiondef('public.painel_do_parceiro(text, text)'::regprocedure)) = 0 then
    raise exception 'painel_do_parceiro perdeu o campo vendido da 045';
  end if;
  raise notice '046 pronta';
end $$;
