-- ===========================================================================
-- ARQUIVAR AS CORES DE TECIDO DO ENSAIO, MENOS DEZ.
--
-- Pedido do Henrique em 05/10/2026: "pode retirar essas cores falsas que estao
-- ai de enfeite, deixe so 10 para demonstracao".
--
-- O QUE FAZ: marca como inativo (ativo = false) todo material de tecido
-- semeado pelo ensaio (teste = true), menos dez. Inativo some da tela do
-- Estoque, do trilho, do Para comprar e das Estatisticas.
--
-- O QUE NAO FAZ: nao apaga nada. O material, o razao dele e as reservas
-- continuam no banco. Aviamento e insumo nao sao tocados, nem material que
-- alguem cadastrou de verdade (teste = false).
--
-- QUAIS DEZ FICAM: as que mais pedidos em aberto reservam, e no empate a
-- ordem do nome. Sao as cores que a Separacao dos pedidos de ensaio mais usa,
-- entao a demonstracao continua amarrada: o pedido, a reserva e a cor.
--
-- O QUE MUDA PARA OS PEDIDOS DE ENSAIO: a reserva de uma cor arquivada
-- continua valendo e a Separacao continua mostrando a cor. Ela so nao aparece
-- mais na pagina Estoque.
--
-- COMO VOLTAR: banco/ferramentas/desarquivar-cores-de-ensaio.sql devolve
-- todas. Uma so volta sozinha quando alguem cadastra de novo a mesma cor do
-- mesmo tecido em "Novo material": a tela acha a arquivada e reativa, com o
-- saldo que ela tinha.
--
-- Pode rodar mais de uma vez: com dez ou menos cores de ensaio ativas, nao
-- arquiva nenhuma.
-- ===========================================================================
with reservas as (
  select material_id, count(*) as pedidos
    from public.reserva
   where not baixada
   group by material_id
),
candidatas as (
  select m.id, m.nome, coalesce(r.pedidos, 0) as pedidos
    from public.material m
    left join reservas r on r.material_id = m.id
   where m.teste and m.ativo and m.categoria = 'tecido'
),
ficam as (
  select id from candidatas order by pedidos desc, nome limit 10
),
arquivadas as (
  update public.material m
     set ativo = false, atualizado_em = now()
   where m.teste and m.ativo and m.categoria = 'tecido'
     and m.id not in (select id from ficam)
  returning m.id
)
select
  (select count(*) from arquivadas) as arquivadas,
  (select count(*) from ficam) as ficaram,
  (select string_agg(c.nome || ' (' || c.pedidos || ')', ' | ' order by c.pedidos desc, c.nome)
     from candidatas c where c.id in (select id from ficam)) as as_que_ficaram;
