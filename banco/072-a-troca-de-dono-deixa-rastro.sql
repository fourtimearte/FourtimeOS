-- ===========================================================================
-- 072: A TROCA DE DONO DO LEAD DEIXA RASTRO
--
-- 12/10/2026, com o rodizio, a carteira e a transferencia (pendencias 4.2 e
-- 2, item 7, do FOURTIME OS - 12).
--
-- O BURACO: a tabela transferencia_de_lead e a funcao transferir_lead existem
-- desde a 011, mas a tela troca o dono do lead por um PATCH direto na coluna
-- vendedor_id (o editar do Funil). Nada era anotado: tres meses depois, "de
-- quem era esse lead" virava discussao de memoria, que e o que o historico
-- existe para acabar.
--
-- AGORA:
--   1. Um gatilho anota TODA troca de dono, venha de onde vier (a tela, a
--      funcao, um PATCH direto, o ensaio): de quem, para quem, quem fez e
--      quando. Tirar o dono tambem e anotado (para_quem vazio).
--   2. trocar_dono_do_lead(lead, para, motivo): o jeito da tela trocar com
--      MOTIVO. Ela so guarda o motivo para o gatilho e troca a coluna; quem
--      pode trocar continua sendo a regra de acesso do lead (admin, gerente e
--      vendedor), igual ao PATCH de antes.
--   3. transferir_lead (011) passa pelo mesmo caminho, e deixa de anotar duas
--      vezes.
-- ===========================================================================

alter table public.transferencia_de_lead alter column para_quem drop not null;

create or replace function public.anotar_troca_de_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendedor_id is distinct from old.vendedor_id then
    insert into public.transferencia_de_lead (lead_id, de_quem, para_quem, motivo, quem_fez)
    values (
      new.id, old.vendedor_id, new.vendedor_id,
      left(coalesce(nullif(current_setting('ft.motivo_da_troca', true), ''), ''), 300),
      auth.uid()
    );
    new.dono_desde := case when new.vendedor_id is null then null else now() end;
  end if;
  return new;
end $$;

revoke all on function public.anotar_troca_de_dono() from public;

drop trigger if exists a_troca_de_dono_deixa_rastro on public.lead;
create trigger a_troca_de_dono_deixa_rastro
  before update of vendedor_id on public.lead
  for each row
  execute function public.anotar_troca_de_dono();

-- O jeito da tela: o motivo vai junto, e a regra de acesso do lead decide.
create or replace function public.trocar_dono_do_lead(
  p_lead uuid, p_para uuid, p_motivo text default ''
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('ft.motivo_da_troca', coalesce(p_motivo, ''), true);
  update public.lead set vendedor_id = p_para where id = p_lead;
  if not found then
    raise exception 'Lead não encontrado, ou seu acesso não permite mudar o dono dele.' using errcode = 'P0002';
  end if;
  perform set_config('ft.motivo_da_troca', '', true);
end $$;

grant execute on function public.trocar_dono_do_lead(uuid, uuid, text) to authenticated;

-- A de 011, agora pelo mesmo caminho (o gatilho anota; antes ela anotava a mao)
create or replace function public.transferir_lead(
  p_lead uuid, p_para uuid, p_motivo text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador transfere lead.' using errcode = '42501';
  end if;
  perform set_config('ft.motivo_da_troca', coalesce(p_motivo, ''), true);
  update public.lead set vendedor_id = p_para where id = p_lead;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;
  perform set_config('ft.motivo_da_troca', '', true);
end $$;

grant execute on function public.transferir_lead(uuid, uuid, text) to authenticated;

comment on function public.trocar_dono_do_lead(uuid, uuid, text) is
  'Troca o dono do lead com o motivo; o gatilho a_troca_de_dono_deixa_rastro anota em transferencia_de_lead (072).';
