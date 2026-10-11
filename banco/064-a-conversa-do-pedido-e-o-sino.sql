-- ===========================================================================
-- 064: A CONVERSA DO PEDIDO E O SINO (parte P4 do PCP, pranchas 88 e 92;
-- FOURTIME OS - 12, 4.0c)
--
-- A conversa do PCP é mensagem interna do sistema, guardada no pedido, e
-- não WhatsApp (suposição (b) do item 30 do 12). Cada pedido tem uma
-- conversa por pessoa de fora do PCP: "o PCP com a Dani", "o PCP com o Léo".
-- Quem é do PCP (quem vê a página) escreve em qualquer uma; a pessoa de fora
-- escreve e lê só a dela.
--
-- O SINO do topo passa a ter dados: cada mensagem avisa quem está do outro
-- lado, e o pedido DEVOLVIDO AO VENDEDOR avisa o vendedor (decisão do
-- Henrique em 11/10/2026: "o vendedor é avisado, responde ou corrige a
-- cotação, e o PCP volta a conferir"). A devolução vira também a primeira
-- mensagem da conversa com o vendedor, para ele responder ali.
--
-- Quem escreve é sempre uma função (falar_no_pedido) ou um gatilho: as duas
-- tabelas só têm leitura.
-- ===========================================================================

-- ---------- 1. a conversa ---------------------------------------------------
create table if not exists public.conversa_do_pedido (
  id        uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido (id) on delete cascade,
  /* a pessoa de fora do PCP com quem é esta conversa */
  com       uuid not null references public.pessoa (id) on delete cascade,
  quem      uuid references public.pessoa (id) on delete set null,
  texto     text not null check (length(btrim(texto)) between 1 and 2000),
  em        timestamptz not null default now()
);

create index if not exists conversa_do_pedido_ordem on public.conversa_do_pedido (pedido_id, com, em);

alter table public.conversa_do_pedido enable row level security;

/* quem edita o PCP lê todas; a pessoa de fora lê a dela */
drop policy if exists conversa_do_pedido_le on public.conversa_do_pedido;
create policy conversa_do_pedido_le on public.conversa_do_pedido
  for select to authenticated
  using (
    public.meu_papel() is not null
    and (public.posso('pcp', 'editar') or com = auth.uid())
  );

grant select on public.conversa_do_pedido to authenticated;


-- ---------- 2. os avisos do sino --------------------------------------------
create table if not exists public.aviso_do_sino (
  id        uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  tipo      text not null check (tipo in ('conversa', 'devolvido')),
  texto     text not null default '',
  /* para onde o clique leva, dentro do sistema: começa com / */
  link      text not null default '' check (link = '' or link like '/%'),
  pedido_id uuid references public.pedido (id) on delete cascade,
  de        uuid references public.pessoa (id) on delete set null,
  criado_em timestamptz not null default now(),
  lido_em   timestamptz
);

create index if not exists aviso_do_sino_da_pessoa on public.aviso_do_sino (pessoa_id, criado_em desc);

alter table public.aviso_do_sino enable row level security;

drop policy if exists aviso_do_sino_le on public.aviso_do_sino;
create policy aviso_do_sino_le on public.aviso_do_sino
  for select to authenticated
  using (pessoa_id = auth.uid());

grant select on public.aviso_do_sino to authenticated;


-- ---------- 3. falar no pedido ----------------------------------------------
create or replace function public.falar_no_pedido(p_pedido uuid, p_com uuid, p_texto text)
returns public.conversa_do_pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  texto text := btrim(coalesce(p_texto, ''));
  ped   public.pedido;
  msg   public.conversa_do_pedido;
  eu    uuid := auth.uid();
  numero text;
  para  uuid;
begin
  if public.meu_papel() is null then
    raise exception 'Só quem foi aprovado conversa no pedido.' using errcode = '42501';
  end if;
  /* do PCP escreve em qualquer conversa; de fora, só na sua */
  if not public.posso('pcp', 'editar') and eu is distinct from p_com then
    raise exception 'Esta conversa não é sua.' using errcode = '42501';
  end if;
  if length(texto) < 1 then
    raise exception 'Escreva a mensagem.' using errcode = '23514';
  end if;
  if length(texto) > 2000 then
    raise exception 'A mensagem passa de 2.000 letras.' using errcode = '23514';
  end if;

  select * into ped from public.pedido where id = p_pedido;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.pessoa where id = p_com and situacao = 'aprovado') then
    raise exception 'Essa pessoa não está na equipe.' using errcode = '23514';
  end if;

  insert into public.conversa_do_pedido (pedido_id, com, quem, texto)
  values (p_pedido, p_com, eu, texto)
  returning * into msg;

  numero := ped.numero;

  /* O AVISO. Do PCP para a pessoa de fora: avisa ela. Da pessoa de fora
     para o PCP: avisa quem está conferindo e, sem ele, quem já escreveu do
     lado do PCP nesta conversa. Ninguém é avisado da própria mensagem. */
  if eu is distinct from p_com then
    insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
    values (p_com, 'conversa', numero || ': ' || left(texto, 140), '/pcp?pedido=' || p_pedido, p_pedido, eu);
  else
    for para in
      select distinct x from (
        select ped.conferindo_por as x
        union
        select c.quem from public.conversa_do_pedido c
         where c.pedido_id = p_pedido and c.com = p_com and c.quem is distinct from p_com
      ) d
      where x is not null and x is distinct from eu
    loop
      insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
      values (para, 'conversa', numero || ': ' || left(texto, 140), '/pcp?pedido=' || p_pedido, p_pedido, eu);
    end loop;
  end if;

  return msg;
end $$;

grant execute on function public.falar_no_pedido(uuid, uuid, text) to authenticated;


-- ---------- 4. ler os avisos ------------------------------------------------
-- p_ids nulo: todos os da pessoa. Devolve quantos marcou.
create or replace function public.ler_avisos(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'Entre no sistema primeiro.' using errcode = '42501';
  end if;
  update public.aviso_do_sino
     set lido_em = now()
   where pessoa_id = auth.uid()
     and lido_em is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.ler_avisos(uuid[]) to authenticated;


-- ---------- 5. a devolução ao vendedor avisa o vendedor ----------------------
create or replace function public.avisar_a_devolucao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendedor_em is not null and old.vendedor_em is null and new.vendedor_id is not null
     and exists (select 1 from public.pessoa where id = new.vendedor_id and situacao = 'aprovado') then
    insert into public.conversa_do_pedido (pedido_id, com, quem, texto)
    values (new.id, new.vendedor_id, new.vendedor_por, 'Devolvi o pedido para você: ' || new.vendedor_motivo);
    if new.vendedor_por is distinct from new.vendedor_id then
      insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
      values (new.vendedor_id, 'devolvido', new.numero || ' voltou do PCP: ' || left(new.vendedor_motivo, 140),
              '/pcp?pedido=' || new.id, new.id, new.vendedor_por);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists pedido_avisa_a_devolucao on public.pedido;
create trigger pedido_avisa_a_devolucao
  after update of vendedor_em on public.pedido
  for each row execute function public.avisar_a_devolucao();


-- ---------- 6. o que a tela lê -----------------------------------------------
create or replace view public.conversa_na_lista
with (security_invoker = true) as
select c.id,
       c.pedido_id,
       c.com,
       coalesce(qc.nome, '') as com_nome,
       coalesce(qc.papel, '') as com_papel,
       c.quem,
       coalesce(qq.nome, '') as quem_nome,
       c.texto,
       c.em
  from public.conversa_do_pedido c
  left join public.equipe qc on qc.id = c.com
  left join public.equipe qq on qq.id = c.quem;

grant select on public.conversa_na_lista to authenticated;

create or replace view public.aviso_na_lista
with (security_invoker = true) as
select a.id,
       a.tipo,
       a.texto,
       a.link,
       a.pedido_id,
       coalesce(q.nome, '') as de_nome,
       a.criado_em,
       a.lido_em
  from public.aviso_do_sino a
  left join public.equipe q on q.id = a.de;

grant select on public.aviso_na_lista to authenticated;

-- pedido_no_pcp ganha o vendedor como pessoa, no fim (a conversa abre nele)
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
       coalesce(qv.nome, '') as vendedor_por_nome,
       p.vendedor_id
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
