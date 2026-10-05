-- ===========================================================================
-- DESFAZ O arquivar-cores-de-ensaio.sql: devolve para a tela do Estoque todas
-- as cores de tecido do ensaio que estavam arquivadas, com o saldo, o razao e
-- as reservas que tinham. Nao toca em material cadastrado de verdade.
-- ===========================================================================
with voltaram as (
  update public.material
     set ativo = true, atualizado_em = now()
   where teste and not ativo and categoria = 'tecido'
  returning id
)
select count(*) as voltaram from voltaram;
