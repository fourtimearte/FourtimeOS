-- ============================================================
-- Fourtime OS - 012 o CO no numero da cotacao
-- ============================================================
-- A cotacao nascia "2026-0001" e o pedido nasce "PD004053". Lado a lado numa
-- conversa de WhatsApp, "2026-0001" nao diz o que e: parece data, parece codigo
-- de qualquer coisa. Passa a ser "CO2026-0001".
--
-- Os dois numeros agora se leem de longe e sem legenda:
--
--   CO2026-0001   a cotacao, que reinicia todo ano
--   PD004053      o pedido, que corre desde antes do sistema existir
--
-- O contador NAO reinicia: quem ja tirou o numero 7 do ano continua tirando o
-- 8. O que muda e so como o numero e escrito.

create or replace function public.proximo_numero_de_cotacao()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  n   int;
begin
  insert into public.contador (chave, valor) values ('cotacao-' || ano, 1)
  on conflict (chave) do update set valor = contador.valor + 1
  returning valor into n;
  return 'CO' || ano || '-' || lpad(n::text, 4, '0');
end $$;

-- As cotacoes que ja existem com o formato antigo passam para o novo. Hoje sao
-- zero, e por isso este update e barato. Ele fica escrito assim mesmo porque um
-- arquivo de migracao que so funciona em banco vazio e uma armadilha para quem
-- rodar a serie inteira num banco restaurado daqui a seis meses.
update public.cotacao
   set numero = 'CO' || numero
 where numero ~ '^[0-9]{4}-[0-9]{4}$';
