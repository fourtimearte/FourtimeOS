-- ===========================================================================
-- 063: O PCP DE QUEM CONFERE (parte P1 do wireframe, pranchas 87 a 92;
-- FOURTIME OS - 12, 4.0c)
--
-- A fila do PCP do wireframe pergunta tres coisas que o banco nao sabia:
--
--   1. QUEM ESTA CONFERINDO, e desde quando ("Bruna esta conferindo desde
--      hoje, 09:05"; "ainda nao aberto"). Fica no pedido: conferindo_por e
--      conferindo_em, escritos por abrir_no_pcp na primeira vez que alguem
--      que confere abre o pedido.
--
--   2. OS DEVOLVIDOS AO VENDEDOR. Decisao do Henrique em 11/10/2026: o PCP
--      devolve ao vendedor com o motivo, o pedido CONTINUA no PCP, na aba
--      Devolvidos, e a grade aprovada nao destrava. Quem devolve e o PCP
--      (o botao fica ao lado de "Marcar como conferido"), por isso a acao e
--      nova (pcp.ao_vendedor) e nasce com quem marca. A devolucao do DIRETOR
--      ao PCP (devolver_do_pcp, 032) continua a mesma: sao duas devolucoes
--      diferentes. O pedido sai dos Devolvidos quando o PCP volta a conferir
--      (voltar_a_conferir) ou quando marca.
--
--   3. OS LIBERADOS, com quem aprovou e quando. Nao havia historico de
--      estado: liberado_em e liberado_por passam a ser carimbados quando o
--      pedido sai do PCP para a producao. Os que ja tinham descido ficam com
--      a hora da primeira fatia e sem nome.
--
-- E tudo que acontece no PCP fica numa linha do tempo, passo_do_pcp
-- (abriu, marcou, desmarcou, devolveu, ao_vendedor, voltou, liberou), que a
-- conversa do pedido (parte P4) vai ler.
--
-- NENHUMA FUNCAO DO PORTAO FOI REESCRITA. marcar_para_aprovacao,
-- desmarcar_do_pcp, devolver_do_pcp e liberar_para_producao continuam com o
-- corpo de hoje (032 e 035): o que muda no pedido quando elas rodam e
-- anotado por um gatilho, pedido_anota_o_pcp. Reescrever o portao a partir
-- de um arquivo antigo ja apagou um conserto uma vez (035).
-- ===========================================================================

-- ---------- 1. os campos ---------------------------------------------------
alter table public.pedido add column if not exists conferindo_em timestamptz;
alter table public.pedido add column if not exists conferindo_por uuid
  references public.pessoa (id) on delete set null;
alter table public.pedido add column if not exists vendedor_motivo text not null default '';
alter table public.pedido add column if not exists vendedor_em timestamptz;
alter table public.pedido add column if not exists vendedor_por uuid
  references public.pessoa (id) on delete set null;
alter table public.pedido add column if not exists liberado_em timestamptz;
alter table public.pedido add column if not exists liberado_por uuid
  references public.pessoa (id) on delete set null;

comment on column public.pedido.conferindo_por is
  'quem abriu o pedido no PCP primeiro, para conferir; nulo quer dizer ainda nao aberto';
comment on column public.pedido.vendedor_em is
  'quando o PCP devolveu o pedido ao vendedor; nulo quer dizer que nao esta com o vendedor';
comment on column public.pedido.liberado_em is
  'quando o pedido saiu do PCP para a producao';

-- os que ja desceram: a hora da primeira fatia, sem nome
update public.pedido p
   set liberado_em = f.primeira
  from (select pedido_id, min(criado_em) as primeira from public.fatia group by pedido_id) f
 where f.pedido_id = p.id
   and p.liberado_em is null;


-- ---------- 2. a linha do tempo do PCP -------------------------------------
create table if not exists public.passo_do_pcp (
  id        uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido (id) on delete cascade,
  tipo      text not null check (tipo in
              ('abriu', 'marcou', 'desmarcou', 'devolveu', 'ao_vendedor', 'voltou', 'liberou')),
  texto     text not null default '',
  quem      uuid references public.pessoa (id) on delete set null,
  em        timestamptz not null default now()
);

create index if not exists passo_do_pcp_do_pedido on public.passo_do_pcp (pedido_id, em);

alter table public.passo_do_pcp enable row level security;

drop policy if exists passo_do_pcp_le on public.passo_do_pcp;
create policy passo_do_pcp_le on public.passo_do_pcp
  for select to authenticated
  using (public.meu_papel() is not null);

-- so leitura: quem escreve sao o gatilho e as funcoes
grant select on public.passo_do_pcp to authenticated;


-- ---------- 3. a acao nova: devolver ao vendedor ---------------------------
insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('pcp.ao_vendedor', 'Devolver o pedido ao vendedor com motivo', 'O caminho do pedido', 'pcp',
   'O pedido continua no PCP, na aba Devolvidos, e o motivo fica escrito para o vendedor.', 30)
on conflict (chave) do nothing;

-- nasce com quem marca: e o PCP que confere e que acha a diferenca
insert into public.permissao_da_acao (papel, acao)
select x.papel, 'pcp.ao_vendedor'
  from public.permissao_da_acao x
 where x.acao = 'pcp.marcar'
on conflict (papel, acao) do nothing;

-- a devolucao do diretor ganha o nome do que ela e hoje
update public.acao
   set nome = 'Devolver o pedido do diretor ao PCP com motivo'
 where chave = 'pcp.devolver';


-- ---------- 4. o gatilho que anota -----------------------------------------
-- SECURITY DEFINER porque escreve em passo_do_pcp, que ninguem escreve por
-- fora; o que ele grava sai do que mudou no pedido, e nao do que alguem pediu.
create or replace function public.anotar_o_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* entrou no PCP (da separacao, ou voltou da producao): conferencia nova */
  if new.estado = 'pcp' and old.estado is distinct from 'pcp' then
    new.conferindo_por := null;
    new.conferindo_em := null;
    new.vendedor_motivo := '';
    new.vendedor_em := null;
    new.vendedor_por := null;
  end if;

  /* marcou: o que estava com o vendedor voltou resolvido */
  if old.marcado_em is null and new.marcado_em is not null then
    new.vendedor_motivo := '';
    new.vendedor_em := null;
    new.vendedor_por := null;
    insert into public.passo_do_pcp (pedido_id, tipo, quem)
    values (new.id, 'marcou', coalesce(new.marcado_por, auth.uid()));
  end if;

  /* a marca caiu: ou o diretor devolveu (com motivo), ou alguem tirou */
  if old.marcado_em is not null and new.marcado_em is null and new.estado = 'pcp' then
    if new.devolvido_em is not null and new.devolvido_em is distinct from old.devolvido_em then
      insert into public.passo_do_pcp (pedido_id, tipo, texto, quem)
      values (new.id, 'devolveu', new.devolvido_motivo, coalesce(new.devolvido_por, auth.uid()));
    else
      insert into public.passo_do_pcp (pedido_id, tipo, quem) values (new.id, 'desmarcou', auth.uid());
    end if;
  end if;

  /* o portao: saiu do PCP para a producao */
  if old.estado = 'pcp' and new.estado = 'producao' then
    new.liberado_em := now();
    new.liberado_por := auth.uid();
    insert into public.passo_do_pcp (pedido_id, tipo, quem) values (new.id, 'liberou', auth.uid());
  end if;

  return new;
end $$;

drop trigger if exists pedido_anota_o_pcp on public.pedido;
create trigger pedido_anota_o_pcp
  before update on public.pedido
  for each row execute function public.anotar_o_pcp();


-- ---------- 5. as tres funcoes novas ---------------------------------------
-- ABRIR: a primeira pessoa que confere e abre o pedido fica sendo quem esta
-- conferindo. Abrir de novo, ou outra pessoa abrir, nao muda nada.
create or replace function public.abrir_no_pcp(p_pedido uuid)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
begin
  if not public.posso_a_acao('pcp.marcar') then
    raise exception 'Seu acesso não permite conferir pedido no PCP.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' or ped.conferindo_por is not null or ped.marcado_em is not null then
    return ped;
  end if;

  update public.pedido
     set conferindo_por = auth.uid(), conferindo_em = now()
   where id = p_pedido
  returning * into ped;

  insert into public.passo_do_pcp (pedido_id, tipo, quem) values (p_pedido, 'abriu', auth.uid());
  return ped;
end $$;

grant execute on function public.abrir_no_pcp(uuid) to authenticated;


create or replace function public.devolver_ao_vendedor(p_pedido uuid, p_motivo text)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped    public.pedido;
  motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.posso_a_acao('pcp.ao_vendedor') then
    raise exception 'Seu acesso não permite devolver pedido ao vendedor.' using errcode = '42501';
  end if;
  if length(motivo) < 3 then
    raise exception 'Escreva o motivo da devolução.' using errcode = '23514';
  end if;
  if length(motivo) > 1000 then
    raise exception 'O motivo passa de 1.000 letras.' using errcode = '23514';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' then
    raise exception 'Este pedido não está no PCP.' using errcode = '23514';
  end if;
  /* marcado ja passou da conferencia: quem devolve dali e o diretor, ao PCP */
  if ped.marcado_em is not null then
    raise exception 'Este pedido já foi marcado como conferido. Tire a marca antes de devolver.'
      using errcode = '23514';
  end if;

  update public.pedido
     set vendedor_motivo = motivo,
         vendedor_em = now(),
         vendedor_por = auth.uid(),
         conferindo_por = coalesce(conferindo_por, auth.uid()),
         conferindo_em = coalesce(conferindo_em, now())
   where id = p_pedido
  returning * into ped;

  insert into public.passo_do_pcp (pedido_id, tipo, texto, quem)
  values (p_pedido, 'ao_vendedor', motivo, auth.uid());
  return ped;
end $$;

grant execute on function public.devolver_ao_vendedor(uuid, text) to authenticated;


-- VOLTAR A CONFERIR: o vendedor respondeu ou corrigiu, e o pedido volta da
-- aba Devolvidos para Conferindo. O motivo sai do pedido e fica na linha do
-- tempo.
create or replace function public.voltar_a_conferir(p_pedido uuid)
returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
begin
  if not public.posso_a_acao('pcp.marcar') then
    raise exception 'Seu acesso não permite conferir pedido no PCP.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' or ped.vendedor_em is null then
    raise exception 'Este pedido não está devolvido ao vendedor.' using errcode = '23514';
  end if;

  update public.pedido
     set vendedor_motivo = '', vendedor_em = null, vendedor_por = null
   where id = p_pedido
  returning * into ped;

  insert into public.passo_do_pcp (pedido_id, tipo, quem) values (p_pedido, 'voltou', auth.uid());
  return ped;
end $$;

grant execute on function public.voltar_a_conferir(uuid) to authenticated;


-- ---------- 6. o que a tela le ---------------------------------------------
-- pedido_no_pcp: as colunas de antes, na mesma ordem, e as novas no fim (o
-- grant fica). Os nomes vem da view equipe, nunca de pessoa (032).
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
       coalesce(r.faltando, 0)   as faltando,
       coalesce(ct.numero, '')   as cotacao_numero,
       coalesce(p.vendedor_nome, '') as vendedor_nome,
       p.conferindo_em,
       coalesce(qc.nome, '') as conferindo_por_nome,
       (p.vendedor_em is not null) as com_o_vendedor,
       p.vendedor_motivo,
       p.vendedor_em,
       coalesce(qv.nome, '') as vendedor_por_nome
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join public.cotacao ct on ct.id = p.cotacao_id
  left join public.equipe qm on qm.id = p.marcado_por
  left join public.equipe qd on qd.id = p.devolvido_por
  left join public.equipe qc on qc.id = p.conferindo_por
  left join public.equipe qv on qv.id = p.vendedor_por
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


-- os que passaram pelo portao, o mais recente primeiro
create or replace view public.pedido_liberado
with (security_invoker = true) as
select p.id,
       p.numero,
       p.cotacao_id,
       coalesce(c.nome, '') as cliente,
       p.estado,
       p.etapa,
       p.pecas,
       p.total,
       p.data_de_envio as entrega_em,
       p.layouts,
       p.tecnicas,
       p.teste,
       p.aviso,
       p.liberado_em,
       coalesce(ql.nome, '') as liberado_por_nome,
       coalesce(qm.nome, '') as marcado_por_nome
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join public.equipe ql on ql.id = p.liberado_por
  left join public.equipe qm on qm.id = p.marcado_por
 where p.estado in ('producao', 'pronto', 'enviado', 'entregue')
   and p.liberado_em is not null;

grant select on public.pedido_liberado to authenticated;


-- a linha do tempo com o nome de quem
create or replace view public.passo_do_pcp_na_lista
with (security_invoker = true) as
select s.id,
       s.pedido_id,
       s.tipo,
       s.texto,
       s.em,
       coalesce(q.nome, '') as quem_nome
  from public.passo_do_pcp s
  left join public.equipe q on q.id = s.quem;

grant select on public.passo_do_pcp_na_lista to authenticated;
