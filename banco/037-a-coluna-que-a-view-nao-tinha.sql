-- ===========================================================================
-- 037. A COLUNA QUE A TABELA GANHOU E A VIEW NAO
--
-- Achado em 24/09, andando a volta inteira com um pedido de teste, que era
-- justamente o que o passo 12 existia para fazer.
--
-- O QUE ESTAVA ACONTECENDO: a tela de Separacao nao listava material nenhum.
-- Para qualquer pedido, em qualquer estado, ela desenhava "Nenhum material
-- neste pedido" enquanto o cartao da fila ao lado dizia "0 de 1". A tela
-- discordava dela mesma na mesma janela e ninguem tinha percebido, porque a
-- frase do vazio e plausivel: existe mesmo pedido sem consumo cadastrado.
--
-- POR QUE: a migracao 027 acrescentou `separado` na TABELA reserva e nunca
-- reconstruiu a VIEW reserva_do_pedido, que nasceu na 026 sem essa coluna. A
-- tela pede `separado` na lista de colunas, o PostgREST responde 400, e a tela
-- cai para lista vazia.
--
-- A LICAO, e ela e irma da que a 035 deixou: coluna nova numa tabela nao chega
-- sozinha nas views que leem essa tabela. Quem acrescenta coluna que a tela
-- vai ler acrescenta na view no mesmo arquivo, ou a tela le um 400 que ela nao
-- sabe distinguir de "nao ha nada".
--
-- Roda inteiro. Nao apaga nada e nao move pedido nenhum: so devolve para a
-- view as tres colunas que a 027 criou e a 026 nao podia conhecer.
-- ===========================================================================

-- ---------- 1. a view, com o que a 027 acrescentou -------------------------
-- `separado` e o que a balanca pesou, e `quantidade` continua sendo o que a
-- conta reservou. As duas juntas sao o que a tela precisa para mostrar a
-- diferenca entre o que se esperava gastar e o que saiu da prateleira.
--
-- `falta` vem junto porque a conta e sempre a mesma e ela estava sendo feita
-- na tela: quanto do que foi reservado ainda nao saiu. Conta repetida em tela
-- e conta que um dia diverge entre duas telas.
drop view if exists public.reserva_do_pedido;
create view public.reserva_do_pedido
with (security_invoker = true) as
select r.id,
       r.pedido_id,
       p.numero    as pedido,
       r.material_id,
       m.nome      as material,
       m.categoria,
       r.quantidade,
       r.unidade,
       r.pecas,
       r.sem_consumo,
       r.baixada,
       r.separado,
       greatest(r.quantidade - coalesce(r.separado, 0), 0) as falta,
       m.saldo,
       (m.saldo >= r.quantidade and not r.sem_consumo) as o_estoque_cobre,
       r.criada_em
  from public.reserva r
  join public.material m on m.id = r.material_id
  join public.pedido   p on p.id = r.pedido_id;

grant select on public.reserva_do_pedido to authenticated;


-- ---------- 2. a conferencia -----------------------------------------------
-- Ela pergunta pela COLUNA na view, e nao pelo texto da migracao: o que
-- importa e o que o PostgREST vai conseguir selecionar amanha.
do $$
declare
  n int;
  faltando text;
begin
  select string_agg(c, ', ')
    into faltando
    from unnest(array['id','pedido_id','pedido','material_id','material','categoria',
                      'quantidade','unidade','pecas','sem_consumo','baixada','separado',
                      'falta','saldo','o_estoque_cobre']) c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'reserva_do_pedido'
        and column_name  = c);

  if faltando is not null then
    raise exception 'a view reserva_do_pedido ficou sem: %', faltando;
  end if;

  select count(*) into n from public.reserva_do_pedido;
  raise notice 'reserva_do_pedido refeita, % linhas de reserva visiveis', n;
end $$;
