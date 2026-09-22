-- ===========================================================================
-- 032: AS DUAS APROVACOES DO PCP
--
-- Ate hoje existia UMA porta entre a separacao e o chao de fabrica, e quem
-- conferia era quem liberava. O Henrique corrigiu isso em 21/09: o PCP
-- confere e MARCA, e quem APROVA e o diretor de producao, que por enquanto e
-- o gerente.
--
-- SEM ESTADO NOVO, por escolha dele. O pedido continua em 'pcp' enquanto
-- espera, e a marca e um campo. A fila do diretor e o filtro de quem esta
-- marcado.
--
-- A MUDANCA DE VERDADE ESTA NUMA LINHA SO: liberar_para_producao deixa de
-- perguntar 'admin, gerente, producao' escrito a mao e passa a perguntar a
-- acao pedido.a_producao, que e de 'admin, gerente'. Com isso a producao
-- perde o poder de liberar sozinha, que e exatamente o que faz as duas
-- aprovacoes existirem: sem essa linha, o mesmo papel marcaria e aprovaria.
--
-- DEVOLVER NAO VOLTA DE ESTADO. O pedido devolvido continua em 'pcp', porque
-- ele nunca saiu de la. O que cai e a marca, e o motivo fica escrito.
-- ===========================================================================

-- ---------- 1. os campos ---------------------------------------------------
alter table public.pedido add column if not exists marcado_em  timestamptz;
alter table public.pedido add column if not exists marcado_por uuid
  references public.pessoa (id) on delete set null;
alter table public.pedido add column if not exists devolvido_motivo text not null default '';
alter table public.pedido add column if not exists devolvido_em  timestamptz;
alter table public.pedido add column if not exists devolvido_por uuid
  references public.pessoa (id) on delete set null;

comment on column public.pedido.marcado_em is
  'quando o PCP marcou este pedido para a aprovacao do diretor; nulo quer dizer que ainda nao marcou';


-- ---------- 2. as duas acoes novas -----------------------------------------
insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('pcp.marcar',   'Marcar o pedido para aprovação', 'O caminho do pedido', 'pcp',
   'Quem confere no PCP marca. Marcar não libera nada.', 25),
  ('pcp.devolver', 'Devolver o pedido ao PCP com motivo', 'O caminho do pedido', 'pcp',
   'O pedido continua no PCP, a marca cai e o motivo fica escrito.', 35)
on conflict (chave) do nothing;

-- quem EDITA o PCP marca: pela matriz de 21/09, isso e admin, gerente e producao
insert into public.permissao_da_acao (papel, acao)
select x.papel, 'pcp.marcar'
  from public.permissao x
 where x.painel = 'pcp' and x.editar
on conflict (papel, acao) do nothing;

-- devolver e de quem aprova, e nao de quem marca: devolver e a outra metade
-- da mesma decisao
insert into public.permissao_da_acao (papel, acao)
select x.papel, 'pcp.devolver'
  from public.permissao_da_acao x
 where x.acao = 'pedido.a_producao'
on conflict (papel, acao) do nothing;


-- ---------- 3. marcar, desmarcar, devolver ---------------------------------
create or replace function public.marcar_para_aprovacao(p_pedido uuid)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
begin
  if not public.posso_a_acao('pcp.marcar') then
    raise exception 'Seu acesso não permite marcar pedido para aprovação.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' then
    raise exception 'Só o pedido que está no PCP pode ser marcado, e este está em %.',
      ped.estado using errcode = '23514';
  end if;

  /* MARCAR LIMPA A DEVOLUCAO. Se o PCP marcou de novo, ele arrumou o que o
     diretor apontou, e deixar o motivo velho na tela faria o diretor recusar
     duas vezes pelo mesmo motivo ja resolvido. */
  update public.pedido
     set marcado_em = now(),
         marcado_por = auth.uid(),
         devolvido_motivo = '',
         devolvido_em = null,
         devolvido_por = null
   where id = p_pedido
  returning * into ped;

  return ped;
end $$;

grant execute on function public.marcar_para_aprovacao(uuid) to authenticated;


create or replace function public.desmarcar_do_pcp(p_pedido uuid)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
begin
  if not public.posso_a_acao('pcp.marcar') then
    raise exception 'Seu acesso não permite mexer na marca do PCP.' using errcode = '42501';
  end if;

  update public.pedido
     set marcado_em = null, marcado_por = null
   where id = p_pedido and estado = 'pcp'
  returning * into ped;

  if not found then
    raise exception 'Pedido não encontrado no PCP.' using errcode = 'P0002';
  end if;
  return ped;
end $$;

grant execute on function public.desmarcar_do_pcp(uuid) to authenticated;


create or replace function public.devolver_do_pcp(p_pedido uuid, p_motivo text)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped    public.pedido;
  motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.posso_a_acao('pcp.devolver') then
    raise exception 'Seu acesso não permite devolver pedido ao PCP.' using errcode = '42501';
  end if;

  /* O MOTIVO E OBRIGATORIO. Sem ele, reprovar vira recado de WhatsApp e o
     sistema nao sabe por que o pedido voltou, que e justamente a informacao
     que o PCP precisa para consertar. */
  if length(motivo) < 3 then
    raise exception 'Escreva o motivo da devolução.' using errcode = '23514';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' then
    raise exception 'Este pedido não está no PCP.' using errcode = '23514';
  end if;
  if ped.marcado_em is null then
    raise exception 'Este pedido ainda não foi marcado pelo PCP.' using errcode = '23514';
  end if;

  update public.pedido
     set marcado_em = null,
         marcado_por = null,
         devolvido_motivo = motivo,
         devolvido_em = now(),
         devolvido_por = auth.uid()
   where id = p_pedido
  returning * into ped;

  return ped;
end $$;

grant execute on function public.devolver_do_pcp(uuid, text) to authenticated;


-- ---------- 4. O PORTAO ----------------------------------------------------
-- Mesmo corpo de antes, com duas linhas novas: a trava vem da matriz, e o
-- pedido precisa ter passado pela marca do PCP.
create or replace function public.liberar_para_producao(
  p_pedido uuid,
  p_fatias jsonb
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
  f   jsonb;
  tec text;
  primeiro public.etapa_da_producao;
begin
  if not public.posso_a_acao('pedido.a_producao') then
    raise exception 'Seu acesso não permite liberar pedido para produção.'
      using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' then
    raise exception 'Só o pedido que está no PCP pode ser liberado, e este está em %.',
      ped.estado using errcode = '23514';
  end if;

  /* AS DUAS APROVACOES, NO BANCO E NAO NA TELA. Quem confere marca; quem
     aprova encontra a marca. Sem esta linha, um POST cru pularia a primeira
     aprovacao inteira e o desenho viraria combinado entre pessoas. */
  if ped.marcado_em is null then
    raise exception 'Este pedido ainda não foi marcado pelo PCP para aprovação.'
      using errcode = '23514';
  end if;

  if jsonb_array_length(coalesce(p_fatias, '[]'::jsonb)) = 0 then
    raise exception 'Um pedido sem nenhuma técnica de produção não tem o que liberar.'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.fatia where pedido_id = p_pedido) then
    raise exception 'Este pedido já foi liberado e já tem fatias no kanban.'
      using errcode = '23505';
  end if;

  for f in select * from jsonb_array_elements(p_fatias) loop
    tec := f ->> 'tecnica';
    select posto into primeiro from public.rota_da_tecnica
     where tecnica = tec order by ordem limit 1;
    if primeiro is null then
      raise exception 'Não existe rota para a técnica %.', tec using errcode = '23514';
    end if;

    insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
    values (
      p_pedido, tec, primeiro,
      coalesce((select array_agg(x::int) from jsonb_array_elements_text(f -> 'layouts') x), '{}'),
      coalesce((f ->> 'pecas')::int, 0)
    );
  end loop;

  update public.pedido set estado = 'producao' where id = p_pedido returning * into ped;
  return ped;
end $$;

grant execute on function public.liberar_para_producao(uuid, jsonb) to authenticated;


-- ---------- 5. o que a tela le ---------------------------------------------
-- O nome de quem marcou vem da view equipe, e nao da tabela pessoa: a regra
-- de acesso da pessoa deixa cada um ver so a propria linha, entao juntar
-- pessoa aqui devolveria nome vazio para todo mundo menos o admin.
create or replace view public.pedido_no_pcp
with (security_invoker = true) as
select p.id,
       p.numero,
       p.cotacao_id,
       p.cliente_id,
       coalesce(c.nome, '')  as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       p.total,
       p.data_de_envio as entrega_em,
       p.departamento,
       p.layouts,
       p.tecnicas,
       p.teste,
       p.criado_em,
       p.marcado_em,
       coalesce(qm.nome, '') as marcado_por_nome,
       p.devolvido_motivo,
       p.devolvido_em,
       coalesce(qd.nome, '') as devolvido_por_nome,
       (p.marcado_em is not null) as marcado,
       coalesce(r.materiais, 0)  as materiais,
       coalesce(r.faltando, 0)   as faltando
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join public.equipe qm on qm.id = p.marcado_por
  left join public.equipe qd on qd.id = p.devolvido_por
  left join lateral (
    select count(*) as materiais,
           count(*) filter (
             where not x.baixada
                or (not x.sem_consumo and coalesce(x.separado, 0) < x.quantidade)
           ) as faltando
      from public.reserva x
     where x.pedido_id = p.id
  ) r on true
 where p.estado = 'pcp';

grant select on public.pedido_no_pcp to authenticated;
