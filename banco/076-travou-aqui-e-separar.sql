-- ===========================================================================
-- 076: TRAVOU AQUI E SEPARAR, NO CARTAO DO KANBAN
--
-- 12/10/2026, item 14 da lista "PODE FAZER TODOS". As duas eram so decisao
-- (FOURTIME OS - 08, secao 8, item 6; decisao 28 do 10).
--
-- TRAVOU AQUI: o cartao parou neste posto por um motivo que nao e dele (a
-- maquina quebrou, falta a arte, o cliente mudou a grade). Quem esta no posto
-- aperta, escreve o motivo, e o cartao fica marcado em vermelho ate alguem
-- destravar ou ate ele andar de posto (andar e destravar). Avisa no sino quem
-- libera a fabrica (acao pedido.a_producao), menos quem travou.
--   Diferente da tag "maquina parada": a tag e recado de posto, escolhido de
--   uma lista; o travou e o motivo escrito, com quem e quando, e conta como
--   parado no quadro.
--
-- SEPARAR: tirar um ou mais layouts do cartao para um cartao novo, da mesma
-- tecnica, num posto escolhido da rota (a reimpressao que volta para a
-- impressao enquanto o resto segue). O cartao de origem fica com o resto dos
-- layouts e das pecas. Por isso a fatia nunca teve unico (pedido, tecnica).
--   As pecas dos layouts separados vem da tela, que le a grade da cotacao; o
--   banco confere que ficam entre 1 e as pecas do cartao menos 1.
--
-- As duas sao acoes novas da matriz (kanban.travar, kanban.separar), dadas a
-- quem edita o kanban, como as da 036.
-- ===========================================================================

-- ---------- 1. os campos e os eventos ---------------------------------------
alter table public.fatia add column if not exists travada_em timestamptz;
alter table public.fatia add column if not exists travada_motivo text not null default '';
alter table public.fatia add column if not exists travada_por uuid references public.pessoa (id) on delete set null;

alter table public.evento_da_fatia drop constraint if exists evento_tipo_conhecido;
alter table public.evento_da_fatia add constraint evento_tipo_conhecido
  check (tipo in ('fala','posto','tag','pegou','soltou','nasceu','travou','destravou','separou'));

-- o sino ganha o tipo do cartao travado
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
  check (tipo in ('conversa', 'devolvido', 'lead', 'dono', 'pedido', 'pronto', 'travou'));


-- ---------- 2. as acoes ------------------------------------------------------
insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('kanban.travar',  'Marcar que o cartão travou',        'Chão de fábrica', 'kanban',
   'Travou aqui, com o motivo escrito. Andar de posto destrava.', 240),
  ('kanban.separar', 'Separar layouts num cartão novo',   'Chão de fábrica', 'kanban',
   'Para a reimpressão: os layouts escolhidos voltam ao posto escolhido, e o resto segue.', 250)
on conflict (chave) do nothing;

insert into public.permissao_da_acao (papel, acao)
select x.papel, a.chave
  from public.permissao x
  cross join (values ('kanban.travar'), ('kanban.separar')) as a(chave)
 where x.painel = 'kanban' and x.editar
on conflict (papel, acao) do nothing;


-- ---------- 3. andar de posto destrava -----------------------------------------
-- O corpo e o da 036, com as tres linhas do travou no meio.
create or replace function public.fatia_no_lugar()
returns trigger
language plpgsql
as $$
begin
  if public.ordem_na_rota(new.tecnica, new.etapa) is null then
    raise exception 'A rota de % nao passa por %.', new.tecnica, new.etapa
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_em := now();
    /* o cartao que andou de posto sai da mao de quem estava com ele */
    new.pego_por := null;
    new.pego_em  := null;
    /* 076: e deixa de estar travado: o motivo era deste posto */
    new.travada_em := null;
    new.travada_motivo := '';
    new.travada_por := null;
  end if;
  if new.etapa = 'finalizado' then
    if new.fechado_em is null then new.fechado_em := now(); end if;
  else
    new.fechado_em := null;
  end if;
  return new;
end $$;


-- ---------- 4. travar e destravar ----------------------------------------------
create or replace function public.travar_a_fatia(p_fatia uuid, p_motivo text)
returns public.fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
  ped public.pedido;
  motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
begin
  if not public.posso_a_acao('kanban.travar') then
    raise exception 'Seu acesso não permite marcar que o cartão travou.' using errcode = '42501';
  end if;
  if length(motivo) < 3 then
    raise exception 'Escreva o motivo: o que travou o cartão.' using errcode = '22023';
  end if;
  select * into f from public.fatia where id = p_fatia for update;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if f.fechado_em is not null then
    raise exception 'Este cartão já chegou ao fim da rota.' using errcode = '23514';
  end if;

  update public.fatia
     set travada_em = now(), travada_motivo = left(motivo, 300), travada_por = quem
   where id = p_fatia returning * into f;

  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
  values (p_fatia, 'travou', left(motivo, 300), quem);

  select * into ped from public.pedido where id = f.pedido_id;
  insert into public.aviso_do_sino (pessoa_id, tipo, texto, link, pedido_id, de)
  select p.id, 'travou',
         ped.numero || ' travou em ' || f.etapa::text || ': ' || left(motivo, 140),
         '/kanban?cartao=' || f.id, f.pedido_id, quem
    from public.pessoa p
   where p.situacao = 'aprovado'
     and p.papel::text = any (public.papeis_da_acao('pedido.a_producao'))
     and p.id is distinct from quem;

  return f;
end $$;

create or replace function public.destravar_a_fatia(p_fatia uuid)
returns public.fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
begin
  if not public.posso_a_acao('kanban.travar') then
    raise exception 'Seu acesso não permite destravar o cartão.' using errcode = '42501';
  end if;
  select * into f from public.fatia where id = p_fatia for update;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if f.travada_em is null then
    return f;
  end if;
  update public.fatia
     set travada_em = null, travada_motivo = '', travada_por = null
   where id = p_fatia returning * into f;
  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
  values (p_fatia, 'destravou', '', quem);
  return f;
end $$;

grant execute on function public.travar_a_fatia(uuid, text) to authenticated;
grant execute on function public.destravar_a_fatia(uuid) to authenticated;


-- ---------- 5. separar ---------------------------------------------------------
create or replace function public.separar_da_fatia(
  p_fatia uuid, p_layouts int[], p_pecas int, p_posto public.etapa_da_producao, p_motivo text
) returns public.fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
  nova public.fatia;
  ficam int[];
  motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid());
  lista text;
begin
  if not public.posso_a_acao('kanban.separar') then
    raise exception 'Seu acesso não permite separar o cartão.' using errcode = '42501';
  end if;
  if length(motivo) < 3 then
    raise exception 'Escreva o motivo da separação.' using errcode = '22023';
  end if;
  select * into f from public.fatia where id = p_fatia for update;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if f.fechado_em is not null then
    raise exception 'Este cartão já chegou ao fim da rota.' using errcode = '23514';
  end if;
  if coalesce(array_length(p_layouts, 1), 0) = 0 then
    raise exception 'Escolha os layouts que saem do cartão.' using errcode = '22023';
  end if;
  if not (p_layouts <@ f.layouts) then
    raise exception 'Um dos layouts escolhidos não está neste cartão.' using errcode = '22023';
  end if;
  select coalesce(array_agg(x order by x), '{}') into ficam
    from unnest(f.layouts) x
   where x <> all (p_layouts);
  if coalesce(array_length(ficam, 1), 0) = 0 then
    raise exception 'Separar todos os layouts é mover o cartão: deixe pelo menos um.' using errcode = '22023';
  end if;
  if p_pecas is null or p_pecas < 1 or p_pecas >= f.pecas then
    raise exception 'As peças separadas precisam ficar entre 1 e %.', f.pecas - 1 using errcode = '22023';
  end if;
  if p_posto = 'finalizado' or public.ordem_na_rota(f.tecnica, p_posto) is null then
    raise exception 'A rota de % não passa por %.', f.tecnica, p_posto using errcode = '23514';
  end if;

  update public.fatia set layouts = ficam, pecas = pecas - p_pecas
   where id = p_fatia returning * into f;

  insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
  values (f.pedido_id, f.tecnica, p_posto,
          (select array_agg(x order by x) from unnest(p_layouts) x), p_pecas)
  returning * into nova;

  select string_agg('L-' || lpad(x::text, 2, '0'), ', ' order by x) into lista from unnest(p_layouts) x;
  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem) values
    (f.id,    'separou', lista || ' saíram para um cartão novo em ' || p_posto::text || ': ' || left(motivo, 200), quem),
    (nova.id, 'separou', 'Nasceu separado de outro cartão, com ' || lista || ': ' || left(motivo, 200), quem);

  return nova;
end $$;

grant execute on function public.separar_da_fatia(uuid, int[], int, public.etapa_da_producao, text) to authenticated;


-- ---------- 6. a view do quadro mostra o travou, no fim ------------------------
create or replace view public.fatia_na_fabrica
with (security_invoker = true) as
select f.id,
       f.pedido_id,
       p.numero,
       coalesce(nullif(btrim(p.nome), ''), cl.nome, c.cliente_nome, '') as nome,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       f.tecnica,
       f.etapa,
       f.etapa_em,
       f.fechado_em,
       f.layouts,
       f.pecas,
       public.ordem_na_rota(f.tecnica, f.etapa) as ordem_na_rota,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.aviso,
       p.estado,
       p.teste,
       f.pego_por,
       f.pego_em,
       coalesce(qp.nome, '') as pego_por_nome,
       coalesce(
         (select array_agg(x) from jsonb_array_elements_text(
            case jsonb_typeof(c.corpo -> 'producao' -> 'marcas')
              when 'array' then c.corpo -> 'producao' -> 'marcas'
              else '[]'::jsonb
            end) x),
         '{}') as marcas,
       coalesce(
         (select array_agg(tf.tag order by t.ordem)
            from public.tag_da_fatia tf
            join public.tag t on t.chave = tf.tag
           where tf.fatia_id = f.id),
         '{}') as tags,
       (select count(*) from public.evento_da_fatia e
         where e.fatia_id = f.id and e.tipo = 'fala') as falas,
       p.cliente_id,
       /* 076: travou aqui */
       f.travada_em,
       f.travada_motivo,
       coalesce(qt.nome, '') as travada_por_nome
  from public.fatia f
  join public.pedido p  on p.id = f.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
  left join public.equipe qp  on qp.id = f.pego_por
  left join public.equipe qt  on qt.id = f.travada_por
 where p.estado <> 'cancelado';

grant select on public.fatia_na_fabrica to authenticated;
