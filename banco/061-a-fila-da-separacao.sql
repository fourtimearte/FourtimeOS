-- ===========================================================================
-- 061: A FILA DA SEPARACAO DO WIREFRAME (pranchas 82 e 83, parte S1)
--
-- A pagina da Separacao passa a ser a do wireframe: a fila em Separando e
-- Esperando, as abas Na fila, Com falta e Concluidas, e, com nenhum pedido
-- escolhido, a soma da fila inteira contra a prateleira. Esta migracao so
-- acrescenta leitura: nenhuma tabela nova, nenhuma regra de escrita.
--
-- O QUE ENTRA:
--   1. pedido_na_separacao ganha, no fim, a cotacao, os layouts e o vendedor
--      (o cabecalho do pedido e a miniatura da fila precisam deles)
--   2. material_da_fila: o que a fila inteira ainda pede de cada material,
--      contra o que esta na prateleira, com onde ele fica
--   3. pedido_separado: os pedidos que ja passaram pela separacao (a aba
--      Concluidas), com quando a ultima linha saiu da prateleira
-- ===========================================================================


-- ---------- 1. a fila, com o que o cabecalho precisa --------------------------
-- As colunas novas entram NO FIM: create or replace view so aceita coluna nova
-- depois das que ja existem, e assim ninguem que le a view hoje percebe.
create or replace view public.pedido_na_separacao
with (security_invoker = true) as
select p.id,
       p.numero,
       p.cliente_id,
       coalesce(c.nome, '')      as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       p.data_de_envio as entrega_em,
       p.departamento,
       p.criado_em,
       coalesce(r.linhas, 0)      as materiais,
       coalesce(r.separadas, 0)   as separados,
       coalesce(r.em_aberto, 0)   as sem_consumo,
       coalesce(r.descoberto, 0)  as nao_cobre,
       (coalesce(r.linhas, 0) > 0 and coalesce(r.separadas, 0) = coalesce(r.linhas, 0))
         as tudo_separado,
       p.cotacao_id,
       p.layouts,
       p.vendedor_nome
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join lateral (
    select count(*)                                          as linhas,
           count(*) filter (where x.baixada)                  as separadas,
           count(*) filter (where x.sem_consumo and not x.baixada) as em_aberto,
           count(*) filter (where not x.baixada and not x.sem_consumo
                              and m.saldo < x.quantidade)     as descoberto
      from public.reserva x
      join public.material m on m.id = x.material_id
     where x.pedido_id = p.id
  ) r on true
 where p.estado in ('aprovado', 'separacao');

grant select on public.pedido_na_separacao to authenticated;


-- ---------- 2. a soma da fila ---------------------------------------------------
-- Uma linha por material que algum pedido da fila ainda vai tirar da
-- prateleira. "pede" e o que falta sair (o que ja saiu nao pede mais nada);
-- "depois" e a prateleira menos o que a fila pede: negativo e falta.
-- A linha sem consumo cadastrado entra com pede zero e sem_consumo > 0: a fila
-- precisa daquele material e ninguem sabe quanto.
create or replace view public.material_da_fila
with (security_invoker = true) as
select m.id                                  as material_id,
       m.nome                                as material,
       m.categoria,
       m.unidade,
       coalesce(ct.hex, '')                  as cor_hex,
       /* onde fica: o lugar principal no deposito (047) e, sem ele, o texto
          livre do cadastro (041) */
       coalesce(lg.codigo, nullif(m.onde_fica, ''), '') as onde_fica,
       m.saldo,
       sum(case when x.sem_consumo then 0 else x.quantidade end) as pede,
       count(distinct x.pedido_id)           as pedidos,
       count(*) filter (where x.sem_consumo) as sem_consumo,
       m.saldo - sum(case when x.sem_consumo then 0 else x.quantidade end) as depois,
       /* os pedidos que a prateleira nao cobre, pela ordem da entrega: e o
          primeiro deles que desce com falta */
       array_agg(p.numero order by p.data_de_envio nulls last, p.numero) as numeros
  from public.reserva x
  join public.pedido   p  on p.id = x.pedido_id
  join public.material m  on m.id = x.material_id
  left join public.cor_de_tecido ct on ct.id = m.cor_id
  left join lateral (
    select l.codigo from public.lugar_do_material_na_lista l
     where l.material_id = m.id order by l.principal desc, l.criado_em limit 1
  ) lg on true
 where p.estado in ('aprovado', 'separacao')
   and not x.baixada
 group by m.id, m.nome, m.categoria, m.unidade, ct.hex, lg.codigo, m.onde_fica, m.saldo;

grant select on public.material_da_fila to authenticated;


-- ---------- 3. os que ja passaram ---------------------------------------------
-- A aba Concluidas. Nao existe historico de estado do pedido; quando a
-- separacao acabou e lido do razao: a ultima linha que saiu da prateleira para
-- ele. Pedido que desceu sem material nenhum fica com a data vazia.
create or replace view public.pedido_separado
with (security_invoker = true) as
select p.id,
       p.numero,
       coalesce(c.nome, '') as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       p.layouts,
       p.data_de_envio      as entrega_em,
       p.cotacao_id,
       coalesce(r.linhas, 0)    as materiais,
       coalesce(r.separadas, 0) as separados,
       v.quando              as separado_em
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join lateral (
    select count(*) as linhas, count(*) filter (where x.baixada) as separadas
      from public.reserva x where x.pedido_id = p.id
  ) r on true
  left join lateral (
    select max(mv.quando) as quando
      from public.movimento_de_estoque mv
     where mv.pedido_id = p.id and mv.motivo = 'separacao'
  ) v on true
 where p.estado in ('pcp', 'producao', 'pronto', 'enviado', 'entregue');

grant select on public.pedido_separado to authenticated;
