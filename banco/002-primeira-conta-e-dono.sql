-- ============================================================
-- Fourtime OS - 002 a primeira conta e a do dono
-- ============================================================
-- O gatilho da 001 dava papel 'producao' para toda conta nova, inclusive para
-- a primeira. Na pratica isso trava o sistema no primeiro dia: o Henrique cria
-- a propria conta, entra, e nao pode cadastrar nem um cliente, porque quem
-- libera papel e o dono e ainda nao existe dono nenhum. Ele teria que abrir o
-- SQL Editor para se promover, o que e exatamente o tipo de passo que se
-- esquece de documentar.
--
-- Agora a primeira pessoa que entrar na tabela nasce dona. Da segunda em
-- diante continua 'producao', e quem muda o papel e o dono.

create or replace function public.ao_criar_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeira boolean;
begin
  select not exists (select 1 from public.pessoa) into primeira;

  insert into public.pessoa (id, nome, papel)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    case when primeira then 'dono'::public.papel else 'producao'::public.papel end
  )
  on conflict (id) do nothing;

  return new;
end $$;
