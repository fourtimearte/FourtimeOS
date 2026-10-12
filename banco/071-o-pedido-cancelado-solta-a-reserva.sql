-- ===========================================================================
-- 071: O PEDIDO CANCELADO SOLTA A RESERVA
--
-- 12/10/2026, junto com os botoes do fim do caminho do pedido (Enviar,
-- Entregar, Voltar e Cancelar, que o banco ja aceitava desde a 022 e a 030 e
-- nenhuma tela chamava).
--
-- O BURACO: cancelar mudava so o estado. A reserva de material do pedido
-- continuava aberta e segurando saldo na prateleira (material_na_prateleira
-- soma toda reserva nao baixada), entao o Estoque e a Separacao contavam
-- material preso por um pedido que nao existe mais.
--
-- AGORA:
--   cancelar  = as reservas AINDA NAO SEPARADAS do pedido saem. A separada
--               (baixada) fica: o material ja saiu da prateleira, e a linha
--               e o registro disso. Devolver o material e uma entrada no
--               Estoque, feita por uma pessoa.
--   reabrir   = (so o admin, acao pedido.ressuscitar) quando o pedido volta
--               para aprovado ou separacao, a reserva e refeita pela mesma
--               reservar_o_pedido de sempre.
--
-- Nada mais muda: quem pode cancelar continua sendo a matriz de acoes, e a
-- conta da reserva continua a da 062.
-- ===========================================================================

create or replace function public.soltar_a_reserva_do_cancelado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelado' and old.estado is distinct from 'cancelado' then
    delete from public.reserva where pedido_id = new.id and not baixada;
  elsif old.estado = 'cancelado' and new.estado in ('aprovado', 'separacao') then
    perform public.reservar_o_pedido(new.id);
  end if;
  return null;
end $$;

revoke all on function public.soltar_a_reserva_do_cancelado() from public;

drop trigger if exists o_cancelado_solta_a_reserva on public.pedido;
create trigger o_cancelado_solta_a_reserva
  after update of estado on public.pedido
  for each row
  when (old.estado is distinct from new.estado)
  execute function public.soltar_a_reserva_do_cancelado();

comment on function public.soltar_a_reserva_do_cancelado() is
  'Cancelar o pedido apaga as reservas ainda nao separadas; reabrir para aprovado ou separacao refaz a reserva (071).';
