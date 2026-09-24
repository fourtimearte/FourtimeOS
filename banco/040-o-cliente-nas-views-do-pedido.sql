-- ===========================================================================
-- 040. O CLIENTE ENTRA NAS VIEWS DO PEDIDO E DA FATIA
--
-- Precisa disto a secao "Ultimos pedidos do cliente" dentro do cartao aberto
-- do MARK45: quem confere um uniforme precisa dos pedidos anteriores DAQUELE
-- cliente para comparar arte, cor e grade.
--
-- POR QUE POR ID E NAO POR NOME. As duas views ja devolvem `cliente` como
-- TEXTO, e casar pedido com pedido por esse texto e exatamente o que a
-- migracao 025 mandou nao fazer: "Escola Girassol" e "ESCOLA GIRASSOL LTDA"
-- sao a mesma escola e dois textos. O texto continua onde esta, porque e ele
-- que a tela escreve; o que entra e o id, que responde "e o mesmo cliente".
--
-- CREATE OR REPLACE, E NAO DROP, e a coluna nova entra NO FIM. A regra esta em
-- banco/LEIA.md e ela custou caro: em 13/09 um `drop view` levou junto o grant
-- e a tela ficou sem dado sem dar erro. O replace so aceita coluna nova no
-- fim da lista, entao e la que ela vai, mesmo nao sendo onde ela se leria
-- melhor.
--
-- Roda inteiro. Nao apaga nada e nao muda coluna nenhuma de tabela.
-- ===========================================================================

-- ---------- 1. pedido_na_fabrica -------------------------------------------
create or replace view public.pedido_na_fabrica
with (security_invoker = true) as
select p.id,
       p.numero,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       p.departamento,
       p.etapa,
       p.etapa_em,
       p.estado,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.planejamento_manual,
       p.aviso,
       p.pecas,
       p.layouts,
       p.tecnicas,
       p.total,
       p.pecas_subli,
       p.pecas_personalizadas,
       p.valor_subli,
       p.valor_personalizado,
       p.fechado_em,
       p.aprovado_em,
       p.teste,
       c.numero as cotacao_numero,
       c.id     as cotacao_id,
       /* a tag: o trabalho mais atrasado, agrupado em familia quando ha mais
          de um correndo. Nula enquanto o pedido nao tem fatia. */
       public.tag_do_pedido(p.id) as tag,
       /* o que a tag esconde, para o passar o mouse e para o modal da
          timeline: cada fatia aberta com o posto exato dela */
       (select string_agg(f.tecnica || ':' || f.etapa, ', ' order by f.tecnica)
          from public.fatia f
         where f.pedido_id = p.id and f.fechado_em is null) as fatias_abertas,
       /* O ID DO CLIENTE, e nao so o nome dele. Casar pedido com pedido pelo
          TEXTO e o que a 025 mandou nao fazer: "Escola Girassol" e "ESCOLA
          GIRASSOL LTDA" sao a mesma escola e dois textos. Entra no fim porque
          e o unico lugar onde o create or replace aceita coluna nova. */
       p.cliente_id
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado';

grant select on public.pedido_na_fabrica to authenticated;


-- ---------- 2. fatia_na_fabrica --------------------------------------------
create or replace view public.fatia_na_fabrica
with (security_invoker = true) as
select f.id,
       f.pedido_id,
       p.numero,
       coalesce(nullif(btrim(p.nome), ''), cl.nome, c.cliente_nome, '') as nome,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       f.tecnica,
       f.etapa,
       f.etapa_em,
       f.fechado_em,
       f.layouts,
       f.pecas,
       public.ordem_na_rota(f.tecnica, f.etapa) as ordem_na_rota,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.aviso,
       p.estado,
       p.teste,
       f.pego_por,
       f.pego_em,
       coalesce(qp.nome, '') as pego_por_nome,
       /* as tags mestre, lidas da cotacao */
       coalesce(
         (select array_agg(x) from jsonb_array_elements_text(
            case jsonb_typeof(c.corpo -> 'producao' -> 'marcas')
              when 'array' then c.corpo -> 'producao' -> 'marcas'
              else '[]'::jsonb
            end) x),
         '{}') as marcas,
       /* as tags do posto postas neste cartao */
       coalesce(
         (select array_agg(tf.tag order by t.ordem)
            from public.tag_da_fatia tf
            join public.tag t on t.chave = tf.tag
           where tf.fatia_id = f.id),
         '{}') as tags,
       (select count(*) from public.evento_da_fatia e
         where e.fatia_id = f.id and e.tipo = 'fala') as falas,
       /* o mesmo id, pelo mesmo motivo. O cartao aberto ja tem a fatia na mao
          e nao deveria precisar de uma segunda consulta so para descobrir de
          quem e o pedido. */
       p.cliente_id
  from public.fatia f
  join public.pedido p  on p.id = f.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
  left join public.equipe qp  on qp.id = f.pego_por
 where p.estado <> 'cancelado';

grant select on public.fatia_na_fabrica to authenticated;


-- ---------- 3. a conferencia -----------------------------------------------
-- Pergunta pela COLUNA nas duas views, e depois conta quantas linhas trazem o
-- id preenchido: coluna que existe e vem sempre nula nao casa pedido nenhum.
do $$
declare
  total int;
  com_cliente int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='pedido_na_fabrica'
       and column_name='cliente_id'
  ) then
    raise exception 'pedido_na_fabrica ficou sem cliente_id';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='fatia_na_fabrica'
       and column_name='cliente_id'
  ) then
    raise exception 'fatia_na_fabrica ficou sem cliente_id';
  end if;

  select count(*) into total from public.pedido_na_fabrica;
  select count(*) into com_cliente
    from public.pedido_na_fabrica where cliente_id is not null;

  if com_cliente = 0 and total > 0 then
    raise exception 'cliente_id entrou mas veio nulo em todos os % pedidos', total;
  end if;

  raise notice 'cliente_id nas views: % pedidos, % com cliente ligado', total, com_cliente;
end $$;
