-- ===========================================================================
-- 034: O ENSAIO GRANDE
--
-- Para o ensaio encher a fabrica inteira, a separacao precisa de consumo
-- cadastrado: sem ele toda reserva nasce marcada como "nao sei" e a tela da
-- separacao nao mostra numero nenhum.
--
-- So que consumo e CADASTRO DE VERDADE, e nao dado de teste: escrever numero
-- inventado num registro que a fabrica vai usar para comprar malha e o erro
-- que o passo 7 existe para nao cometer. Entao o consumo do ensaio ganha a
-- marca de teste, igual ao cliente e ao pedido, e some junto com eles.
--
-- E ele entra em QUILOS, e nao em metros. Metro so vira quilo com a largura e
-- a gramatura do tecido, que tambem sao cadastro de verdade: semear as duas
-- seria inventar numero em dois registros em vez de um.
-- ===========================================================================

alter table public.consumo_da_referencia
  add column if not exists teste boolean not null default false;

comment on column public.consumo_da_referencia.teste is
  'consumo semeado pelo ensaio; some com apagar_dados_de_teste()';

create or replace function public.apagar_dados_de_teste()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare p int; c int; l int; k int; m int; u int;
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

  update public.contador set valor = 0 where chave = 'pedido-teste';

  return 'Apaguei ' || k || ' cliente(s), ' || l || ' lead(s), '
      || c || ' cotação(ões), ' || p || ' pedido(s), '
      || m || ' material(is) e ' || u || ' consumo(s) de teste.';
end $$;

grant execute on function public.apagar_dados_de_teste() to authenticated;

create or replace view public.dado_de_teste
with (security_invoker = true) as
select 'cliente' as tabela, count(*) as linhas from public.cliente where teste
union all select 'lead',     count(*) from public.lead     where teste
union all select 'cotacao',  count(*) from public.cotacao  where teste
union all select 'pedido',   count(*) from public.pedido   where teste
union all select 'material', count(*) from public.material where teste
union all select 'consumo',  count(*) from public.consumo_da_referencia where teste;

grant select on public.dado_de_teste to authenticated;

-- ---------- o ensaio precisa escrever consumo ------------------------------
-- A tabela nasceu na 026 com escrita de admin e gerente. O ensaio roda como
-- admin, entao nada muda aqui; o grant existe porque a tela de consumo grava
-- direto na tabela, e o ensaio usa o mesmo caminho.
grant select, insert, update, delete on public.consumo_da_referencia to authenticated;
