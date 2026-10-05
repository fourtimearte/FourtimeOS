-- ===========================================================================
-- 049: O USO DO ESTOQUE
--
-- O Henrique pediu, em 05/10/2026, uma tela de estatistica no Estoque: quanto
-- de cada tecido, e de cada cor, a fabrica usou no mes, em tres meses e no
-- semestre. E por ai que se decide a prioridade de compra: o minimo diz que
-- esta acabando, o uso diz o quanto isso importa.
--
-- O QUE ENTRA:
--   1. a funcao que soma o uso de cada material nas tres janelas e mes a mes
--   2. o razao a vista sabe se o material ainda esta no estoque
--
-- USO E O QUE SAIU PARA A FABRICA: a separacao de pedido e a saida avulsa,
-- menos o que voltou em devolucao. Entrada e compra, e ajuste e contagem:
-- nenhum dos dois e uso, e os dois ficam de fora.
--
-- A CONTA E FEITA AQUI, E NAO NA TELA. A tela le no maximo mil linhas por
-- pedido, e seis meses de razao passam disso com folga. A funcao devolve uma
-- linha por material que teve uso, ja somada.
--
-- AS JANELAS ANDAM COM O DIA: 30, 90 e 180 dias contados de agora. O "mes a
-- mes" e de calendario, no fuso da fabrica, e serve para o desenho da barra.
-- ===========================================================================


-- ---------- 1. o uso de cada material ----------------------------------------
-- Devolve um vetor JSON, uma linha por material ativo com uso nos ultimos 180
-- dias ou nos ultimos seis meses de calendario:
--   {"material_id": uuid, "d30": n, "d90": n, "d180": n, "meses": {"2026-05": n, ...}}
-- security invoker: quem le o razao le o uso, e a RLS do razao e que decide.
create or replace function public.uso_do_estoque()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with inicio as (
    select date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '5 months' as do_mes,
           now() - interval '180 days' as dos_dias
  ),
  saidas as (
    select v.material_id,
           -v.quantidade as usado,
           v.quando,
           to_char(v.quando at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes
      from public.movimento_de_estoque v
      join public.material m on m.id = v.material_id and m.ativo
      cross join inicio i
     where v.motivo in ('separacao', 'saida', 'devolucao')
       and v.quando >= least(i.dos_dias, i.do_mes at time zone 'America/Sao_Paulo')
  ),
  por_mes as (
    select s.material_id, s.mes, sum(s.usado) as usado
      from saidas s
      cross join inicio i
     where (s.quando at time zone 'America/Sao_Paulo') >= i.do_mes
     group by s.material_id, s.mes
  ),
  por_material as (
    select s.material_id,
           coalesce(sum(s.usado) filter (where s.quando >= now() - interval '30 days'), 0)  as d30,
           coalesce(sum(s.usado) filter (where s.quando >= now() - interval '90 days'), 0)  as d90,
           coalesce(sum(s.usado) filter (where s.quando >= now() - interval '180 days'), 0) as d180
      from saidas s
     group by s.material_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'material_id', p.material_id,
           'd30', p.d30,
           'd90', p.d90,
           'd180', p.d180,
           'meses', coalesce((select jsonb_object_agg(x.mes, x.usado)
                                from por_mes x where x.material_id = p.material_id), '{}'::jsonb)
         )), '[]'::jsonb)
    from por_material p;
$$;

comment on function public.uso_do_estoque() is
  'O que a fabrica usou de cada material (separacao e saida, menos devolucao) em 30, 90 e 180 dias, e mes a mes nos ultimos seis meses.';

revoke all on function public.uso_do_estoque() from public;
grant execute on function public.uso_do_estoque() to authenticated;


-- ---------- 2. o razao a vista sabe se o material ainda esta no estoque -------
-- A mesma view da 041, com uma coluna a mais no fim. Material arquivado
-- (ativo = false) some da lista do Estoque desde a 025; o razao dele continua
-- inteiro na tabela, e a tela escolhe se mostra. Ate aqui ela nao tinha como
-- saber: o movimento de um material arquivado aparecia nas movimentacoes de
-- um material que a lista nao mostrava mais.
create or replace view public.movimento_do_estoque
with (security_invoker = true) as
select v.id,
       v.material_id,
       m.nome     as material,
       m.unidade,
       m.categoria,
       v.quantidade,
       v.motivo,
       v.observacao,
       v.pedido_id,
       p.numero   as pedido,
       v.quem,
       q.nome     as quem_nome,
       v.quando,
       v.fornecedor_id,
       f.nome     as fornecedor,
       m.tecido_id,
       m.grupo,
       t.nome     as tecido,
       c.nome     as cor,
       c.hex      as cor_hex,
       e.nome     as quem_na_equipe,
       m.ativo    as material_ativo
  from public.movimento_de_estoque v
  join public.material m on m.id = v.material_id
  left join public.pedido p on p.id = v.pedido_id
  left join public.pessoa q on q.id = v.quem
  left join public.fornecedor f on f.id = v.fornecedor_id
  left join public.tecido t on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join public.equipe e on e.id = v.quem;

grant select on public.movimento_do_estoque to authenticated;
