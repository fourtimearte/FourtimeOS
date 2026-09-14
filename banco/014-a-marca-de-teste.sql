-- ============================================================
-- Fourtime OS - 014 a marca de teste
-- ============================================================
-- O pedido ja nasce sabendo se e teste (013). Agora o resto do caminho tambem,
-- e pelo mesmo motivo: as telas vao ser conferidas com conteudo semeado, e
-- esse conteudo vai conviver na mesma base com o dado de verdade ate o dia do
-- lancamento.
--
-- Sem a marca, no dia da limpeza alguem teria que olhar nome por nome e
-- adivinhar o que era teste. Com ela, a limpeza e uma linha, e a conta sai de
-- um campo que ninguem digitou.
--
-- A marca fica DENTRO da mesma decisao do 013: enquanto regulagem.pedido valer
-- 'teste', o sistema esta em ensaio. O que o 014 acrescenta e a capacidade de
-- separar as linhas do ensaio das linhas de verdade quando as duas coexistirem.

alter table public.cliente add column teste boolean not null default false;
alter table public.lead    add column teste boolean not null default false;
alter table public.cotacao add column teste boolean not null default false;

create index cliente_de_teste on public.cliente (teste) where teste;
create index lead_de_teste    on public.lead    (teste) where teste;
create index cotacao_de_teste on public.cotacao (teste) where teste;

-- A trava do nome do cliente continua valendo para todo mundo, e e de
-- proposito: se a semente inventar um "Escola Girassol" e amanha a base do
-- Bling trouxer o Escola Girassol de verdade, o import vai esbarrar na trava e
-- gritar. E o que se quer. Gritar na hora do import e barato; descobrir dois
-- Girassol seis meses depois, com pedido em cada um, nao e.


-- ---------- quantas linhas de teste existem ------------------
-- A tela de configuracoes le daqui em vez de cada uma refazer a conta.
create view public.dado_de_teste
with (security_invoker = true) as
select 'cliente' as tabela, count(*) as linhas from public.cliente where teste
union all select 'lead',    count(*) from public.lead    where teste
union all select 'cotacao', count(*) from public.cotacao where teste
union all select 'pedido',  count(*) from public.pedido  where teste;

grant select on public.dado_de_teste to authenticated;


-- ---------- a limpeza ----------------------------------------
-- Na ordem em que as chaves estrangeiras permitem: o pedido segura a cotacao
-- (on delete restrict), entao ele sai primeiro. Depois a cotacao, depois o
-- lead, e o cliente por ultimo.
--
-- So apaga o que esta marcado. Uma linha de teste que tenha sido ligada a uma
-- linha de verdade no meio do caminho e o unico jeito de isto doer, e por isso
-- a funcao devolve o que apagou: quem chamou ve o numero e confere.

create or replace function public.apagar_dados_de_teste()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare p int; c int; l int; k int;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador apaga os dados de teste.' using errcode = '42501';
  end if;

  with x as (delete from public.pedido  where teste returning 1) select count(*) into p from x;
  with x as (delete from public.cotacao where teste returning 1) select count(*) into c from x;
  with x as (delete from public.lead    where teste returning 1) select count(*) into l from x;
  with x as (delete from public.cliente where teste returning 1) select count(*) into k from x;

  -- O contador do pedido de teste volta a zero, senao a proxima rodada de
  -- ensaio comecaria no PD-TESTE-0043 sem nenhum PD-TESTE-0042 para olhar.
  update public.contador set valor = 0 where chave = 'pedido-teste';

  return 'Apaguei ' || k || ' cliente(s), ' || l || ' lead(s), '
      || c || ' cotação(ões) e ' || p || ' pedido(s) de teste.';
end $$;

grant execute on function public.apagar_dados_de_teste() to authenticated;
