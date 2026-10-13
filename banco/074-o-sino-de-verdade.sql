-- ===========================================================================
-- 074: O SINO DE VERDADE
--
-- 12/10/2026, item 12 da lista "PODE FAZER TODOS". Ate a 073 o sino so tinha
-- tres avisos: a conversa do pedido e a devolucao do PCP (064), e o lead que
-- chega pelo chat do site (065 e 066, que ja avisam o dono, ou admin e
-- gerente quando o lead chega sem dono). O resto do sistema nao avisava
-- ninguem.
--
-- TRES AVISOS NOVOS, todos escritos pelo banco (a tela continua so lendo):
--
--   dono     o lead passou a ser seu: alguem criou um lead com voce de dono,
--            ou trocou o dono para voce (072). O motivo da troca vai junto.
--            Quem passa o lead para si mesmo nao se avisa, e o lead do site
--            nao avisa duas vezes (ele chega sem pessoa logada, e a 066 ja
--            avisou).
--   pedido   a cotacao foi aprovada e virou pedido: avisa quem manda o pedido
--            para a separacao (acao pedido.separar da matriz), menos quem
--            aprovou. O clique abre a fila da separacao naquele pedido.
--   pronto   o pedido ficou pronto: avisa o vendedor dele, para enviar. Sem
--            vendedor (pessoa), avisa admin e gerente. O clique abre a
--            cotacao, onde fica o cartao Para entregar.
--
-- Ninguem e avisado do que ele mesmo fez.
-- ===========================================================================

-- ---------- 1. os tipos -----------------------------------------------------
do $$
declare nome text;
begin
  for nome in
    select conname from pg_constraint
     where conrelid = 'public.aviso_do_sino'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%tipo%'
  loop
    execute format('alter table public.aviso_do_sino drop constraint %I', nome);
  end loop;
end $$;
alter table public.aviso_do_sino
  add constraint aviso_do_sino_tipo_da_lista
  check (tipo in ('conversa', 'devolvido', 'lead', 'dono', 'pedido', 'pronto'));

-- o aviso do lead some junto com o lead (o do pedido ja sumia com o pedido)
alter table public.aviso_do_sino add column if not exists lead_id uuid
  references public.lead (id) on delete cascade;


-- ---------- 2. o lead passou a ser seu ----------------------------------------
create or replace function public.avisar_o_dono_do_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /* so vale quem e pessoa: o aviso guarda "de" com chave para pessoa, e
     um aviso nunca pode derrubar o que a pessoa estava gravando */
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
  motivo text := coalesce(nullif(current_setting('ft.motivo_da_troca', true), ''), '');
begin
  if new.vendedor_id is null or quem is null or new.vendedor_id = quem then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.vendedor_id is not distinct from old.vendedor_id then
    return null;
  end if;
  if not exists (select 1 from public.pessoa where id = new.vendedor_id and situacao = 'aprovado') then
    return null;
  end if;
  insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, lead_id, de)
  values (new.vendedor_id, 'dono',
          case when tg_op = 'INSERT' then 'Lead novo com você: ' else 'O lead passou para você: ' end
            || coalesce(nullif(new.nome, ''), 'sem nome')
            || case when motivo <> '' then ' (' || left(motivo, 140) || ')' else '' end,
          '/funil?lead=' || new.id, new.id, quem);
  return null;
end $$;

drop trigger if exists lead_avisa_o_dono on public.lead;
create trigger lead_avisa_o_dono
  after insert or update of vendedor_id on public.lead
  for each row execute function public.avisar_o_dono_do_lead();


-- ---------- 3. a cotacao aprovada vira aviso para a separacao -----------------
create or replace function public.avisar_o_pedido_novo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /* so vale quem e pessoa: o aviso guarda "de" com chave para pessoa, e
     um aviso nunca pode derrubar o que a pessoa estava gravando */
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
  cli text := '';
begin
  if new.estado is distinct from 'aprovado' then
    return null;
  end if;
  select coalesce(nullif(ct.cliente_nome, ''), c.nome, '') into cli
    from public.cotacao ct
    left join public.cliente c on c.id = ct.cliente_id
   where ct.id = new.cotacao_id;
  insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
  select p.id, 'pedido',
         'Cotação aprovada: ' || new.numero || case when coalesce(cli, '') <> '' then ' · ' || cli else '' end
           || ' chegou na separação',
         '/separacao?pedido=' || new.id, new.id, quem
    from public.pessoa p
   where p.situacao = 'aprovado'
     and p.papel::text = any (public.papeis_da_acao('pedido.separar'))
     and p.id is distinct from quem;
  return null;
end $$;

drop trigger if exists pedido_avisa_o_novo on public.pedido;
create trigger pedido_avisa_o_novo
  after insert on public.pedido
  for each row execute function public.avisar_o_pedido_novo();


-- ---------- 4. o pedido pronto avisa o vendedor --------------------------------
create or replace function public.avisar_o_pedido_pronto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /* so vale quem e pessoa: o aviso guarda "de" com chave para pessoa, e
     um aviso nunca pode derrubar o que a pessoa estava gravando */
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
  cli text := '';
begin
  if new.estado is distinct from 'pronto' or old.estado = 'pronto' then
    return null;
  end if;
  select coalesce(nullif(ct.cliente_nome, ''), c.nome, '') into cli
    from public.cotacao ct
    left join public.cliente c on c.id = ct.cliente_id
   where ct.id = new.cotacao_id;
  insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
  select p.id, 'pronto',
         new.numero || case when coalesce(cli, '') <> '' then ' · ' || cli else '' end || ' está pronto para enviar',
         case when new.cotacao_id is null then '/cotacao' else '/cotacao?c=' || new.cotacao_id end,
         new.id, quem
    from public.pessoa p
   where p.situacao = 'aprovado'
     and p.id is distinct from quem
     and (p.id = new.vendedor_id
          or (not exists (select 1 from public.pessoa v where v.id = new.vendedor_id and v.situacao = 'aprovado')
              and p.papel::text in ('admin', 'gerente')));
  return null;
end $$;

drop trigger if exists pedido_avisa_o_pronto on public.pedido;
/* SEM "of estado" DE PROPOSITO: o pedido fica pronto quase sempre pela
   etapa (finalizado), e quem muda o estado ai e o gatilho de antes (020).
   "update of estado" so dispara quando o estado esta escrito no update. */
create trigger pedido_avisa_o_pronto
  after update on public.pedido
  for each row
  when (new.estado = 'pronto' and old.estado is distinct from 'pronto')
  execute function public.avisar_o_pedido_pronto();
