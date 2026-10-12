-- ===========================================================================
-- 069: OS ACESSOS GRAVAM, E O APAGAR DADOS DE TESTE ALCANCA TUDO
--
-- Rodar DEPOIS da 068 (ela cria a tabela_de_preco, que esta migracao conta).
--
-- 1. A tela de Acessos marca e desmarca acao com POST e DELETE direto em
--    permissao_da_acao (marcarAcao, src/dominio/acessos). A 030 deu a regra
--    (so o admin mexe) mas so o grant de leitura: conferido em producao em
--    12/10/2026, o papel authenticated tinha SELECT, REFERENCES, TRIGGER e
--    TRUNCATE, e nada de INSERT nem DELETE. O clique dava permissao negada.
--    O grant abre a porta; a regra de linha da 030 continua dizendo que so
--    o admin passa por ela.
--
-- 2. apagar_dados_de_teste() e a view dado_de_teste (ultima versao na 034)
--    nao conheciam as tabelas que nasceram depois com a coluna teste:
--    fornecedor e conferencia_de_boleto (041), transportador e
--    lancamento_de_transporte (042), e tabela_de_preco (068).
--
--    A ordem importa: o lancamento aponta para o transportador com RESTRICT,
--    entao os lancamentos de teste saem antes. Um transportador de teste que
--    ainda tenha lancamento DE VERDADE fica, e a frase de volta diz quantos
--    ficaram: apagar o real junto nunca e o certo. O fornecedor sai depois da
--    conferencia; o resto que aponta para ele (material, movimento,
--    transportador, lancamento) fica com o campo vazio (set null), como a 041
--    e a 042 decidiram.
-- ===========================================================================

do $$
begin
  if to_regclass('public.tabela_de_preco') is null then
    raise exception 'Rode a 068 (as tabelas de preco) antes desta.';
  end if;
end $$;

-- ---------- 1. os acessos --------------------------------------------------
grant insert, update, delete on public.permissao_da_acao to authenticated;

-- ---------- 2. o apagar dados de teste -------------------------------------
create or replace function public.apagar_dados_de_teste()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p int; c int; l int; k int; m int; u int;
  lt int; tr int; tf int; cb int; fo int; tb int;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador apaga os dados de teste.' using errcode = '42501';
  end if;

  with x as (delete from public.pedido   where teste returning 1) select count(*) into p from x;
  with x as (delete from public.cotacao  where teste returning 1) select count(*) into c from x;
  with x as (delete from public.lead     where teste returning 1) select count(*) into l from x;
  with x as (delete from public.cliente  where teste returning 1) select count(*) into k from x;
  with x as (delete from public.material where teste returning 1) select count(*) into m from x;
  with x as (delete from public.consumo_da_referencia where teste returning 1)
    select count(*) into u from x;

  with x as (delete from public.lancamento_de_transporte where teste returning 1)
    select count(*) into lt from x;
  with x as (
    delete from public.transportador t
     where t.teste
       and not exists (select 1 from public.lancamento_de_transporte l where l.transportador_id = t.id)
    returning 1)
    select count(*) into tr from x;
  select count(*) into tf from public.transportador where teste;

  with x as (delete from public.conferencia_de_boleto where teste returning 1)
    select count(*) into cb from x;
  with x as (delete from public.fornecedor where teste returning 1) select count(*) into fo from x;
  with x as (delete from public.tabela_de_preco where teste returning 1) select count(*) into tb from x;

  update public.contador set valor = 0 where chave = 'pedido-teste';

  return 'Apaguei ' || k || ' cliente(s), ' || l || ' lead(s), '
      || c || ' cotação(ões), ' || p || ' pedido(s), '
      || m || ' material(is), ' || u || ' consumo(s), '
      || fo || ' fornecedor(es), ' || cb || ' conferência(s) de boleto, '
      || tr || ' transportador(es), ' || lt || ' lançamento(s) de transporte e '
      || tb || ' tabela(s) de preço de teste.'
      || case when tf > 0
           then ' Ficaram ' || tf || ' transportador(es) de teste com lançamento de verdade.'
           else '' end;
end $$;

grant execute on function public.apagar_dados_de_teste() to authenticated;

create or replace view public.dado_de_teste
with (security_invoker = true) as
select 'cliente' as tabela, count(*) as linhas from public.cliente where teste
union all select 'lead',     count(*) from public.lead     where teste
union all select 'cotacao',  count(*) from public.cotacao  where teste
union all select 'pedido',   count(*) from public.pedido   where teste
union all select 'material', count(*) from public.material where teste
union all select 'consumo',  count(*) from public.consumo_da_referencia where teste
union all select 'fornecedor',               count(*) from public.fornecedor               where teste
union all select 'conferencia_de_boleto',    count(*) from public.conferencia_de_boleto    where teste
union all select 'transportador',            count(*) from public.transportador            where teste
union all select 'lancamento_de_transporte', count(*) from public.lancamento_de_transporte where teste
union all select 'tabela_de_preco',          count(*) from public.tabela_de_preco          where teste;

grant select on public.dado_de_teste to authenticated;
