-- ===========================================================================
-- 081: O ESTOQUE NEGOCIADO, A PESAGEM NA SEPARACAO E A BAIXA NO PRIMEIRO POSTO
--      (14/10/2026, respostas do Henrique pergunta por pergunta)
--
--   1. A COTACAO ABERTA (rascunho ou enviada) marca o material como
--      NEGOCIADO. Negociado nao tira do livre: so avisa os outros vendedores
--      que aquele tecido esta numa conversa. Aprovada, vira RESERVADO (como
--      antes, pela aprovar_cotacao); recusada, vencida ou apagada, solta.
--   2. A SEPARACAO "PESA E GUARDA": continua separando e pesando, mas SO
--      ANOTA quanto saiu (reserva.separado, com quem e quando). Nao mexe no
--      estoque, e o material segue reservado, agora pelo peso anotado.
--   3. A BAIXA acontece quando o pedido entra na producao, que e quando os
--      cartoes nascem no PRIMEIRO POSTO do kanban (liberar_para_producao),
--      usando o peso anotado. O que nao foi pesado baixa o que estava
--      reservado: o pedido desceu para a fabrica, e o material foi junto.
--
-- A conta do consumo de cada layout, que morava dentro de reservar_o_pedido
-- (062), vira uma funcao propria, consumo_do_documento, para o pedido e a
-- cotacao usarem a mesma conta. O resultado da reserva nao muda.
--
-- O QUE JA FOI BAIXADO NO JEITO ANTIGO (separacao que mexia no estoque) fica
-- como esta; desfazer uma dessas continua devolvendo ao estoque.
-- ===========================================================================


-- ---------- 0. o que a reserva ganha ------------------------------------------
alter table public.reserva
  add column if not exists pesado_em  timestamptz,
  add column if not exists pesado_por uuid references public.pessoa (id) on delete set null;

comment on column public.reserva.separado is
  'o peso anotado na separacao (081): a baixa no primeiro posto usa este numero; nulo enquanto nao pesou';

alter table public.movimento_de_estoque drop constraint if exists movimento_motivo_conhecido;
alter table public.movimento_de_estoque
  add constraint movimento_motivo_conhecido
  check (motivo in ('entrada', 'saida', 'ajuste', 'separacao', 'devolucao', 'producao'));


-- ---------- 1. a conta do consumo, de um documento ----------------------------
/* O mesmo laco da 062, devolvendo as linhas em vez de gravar. Uma linha por
   tecido ou aviamento de cada layout; quem chama soma por (ordem, material).
   A primeira linha de cada par diz o tipo e a explicacao. */
create or replace function public.consumo_do_documento(doc jsonb)
returns table (
  o_seq         int,
  o_ordem       int,
  o_material    uuid,
  o_quantidade  numeric,
  o_unidade     text,
  o_sem_consumo boolean,
  o_pecas       int,
  o_tipo        text,
  o_como        text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  prod    jsonb;
  bloco   jsonb;
  pano    jsonb;
  par     record;
  peca    record;
  avi     record;
  ref_id  uuid;
  eh_kit  boolean;
  id_pano uuid;
  id_cor  uuid;
  mat     public.material;
  medida  record;
  pecas   int;
  soma    numeric;
  area    numeric;
  falta   boolean;
  i       int;
  n       int := 0;
  conta   text;
begin
  o_seq := 0;
  if doc is null then
    return;
  end if;

  for prod in select * from jsonb_array_elements(coalesce(doc -> 'produtos', '[]'::jsonb)) loop
    n := n + 1;
    bloco := prod -> 'bloco';
    continue when bloco is null;
    continue when coalesce((bloco ->> 'informacoes')::boolean, false);

    select r.id, coalesce(r.grupo = 'KIT', false) into ref_id, eh_kit from public.referencia r
     where (r.cod <> '' and r.cod = coalesce(bloco ->> 'referencia', ''))
        or (coalesce(bloco ->> 'referencia', '') = ''
            and r.nome = coalesce(bloco ->> 'nomeDaReferencia', ''))
     limit 1;

    pecas := coalesce((
      select sum(v::int)::int from jsonb_each_text(coalesce(bloco -> 'grade', '{}'::jsonb)) as g(k, v)
    ), 0);
    continue when pecas = 0;

    /* --- os tecidos --------------------------------------------------------- */
    i := 0;
    for pano in select * from jsonb_array_elements(coalesce(bloco -> 'tecidos', '[]'::jsonb)) loop
      i := i + 1;

      /* o material do Estoque que o editor guardou (11/10/2026) vale primeiro;
         sem ele, o tecido e a cor pelo nome, como sempre */
      mat := null;
      if coalesce(pano ->> 'materialId', '') ~ '^[0-9a-f-]{36}$' then
        select * into mat from public.material m where m.id = (pano ->> 'materialId')::uuid and m.ativo;
      end if;
      if mat.id is null then
        select t.id into id_pano from public.tecido t where t.nome = coalesce(pano ->> 'nome', '') limit 1;
        select c.id into id_cor from public.cor_de_tecido c where c.nome = coalesce(pano ->> 'cor', '') limit 1;
        select * into mat from public.material m where m.tecido_id = id_pano and m.cor_id = id_cor limit 1;
      end if;
      continue when mat.id is null;

      soma  := 0;
      area  := 0;
      falta := false;

      if i > 1 then
        falta := true;
        conta := 'Tecido · onde ele vai não está no orçamento';
      elsif ref_id is null then
        falta := true;
        conta := 'Tecido · a referência não está nas Fichas técnicas';
      else
        /* a peca inteira; no kit, a soma das pecas dele */
        for peca in
          select x.referencia_id from public.peca_do_kit x where eh_kit and x.kit_id = ref_id
          union all
          select ref_id where not eh_kit
        loop
          for par in
            select k as tamanho, v::int as quantos
              from jsonb_each_text(coalesce(bloco -> 'grade', '{}'::jsonb)) as g(k, v)
             where v::int > 0
          loop
            select * into medida from public.consumo_da_peca(peca.referencia_id, par.tamanho, mat.tecido_id);
            if not found
               or (mat.unidade = 'kg' and medida.quilos is null)
               or (mat.unidade = 'm'  and medida.metros is null)
               or mat.unidade not in ('kg', 'm') then
              falta := true;
            else
              soma := soma + par.quantos * case when mat.unidade = 'kg' then medida.quilos else medida.metros end;
              area := area + par.quantos * coalesce((
                select c.area from public.consumo_da_referencia c
                 where c.referencia_id = peca.referencia_id and c.tamanho = par.tamanho), 0);
            end if;
          end loop;
        end loop;
        conta := case
          when falta then 'Tecido · falta o consumo de algum tamanho na ficha técnica'
          when area > 0 then 'Tecido · ' || case when eh_kit then 'as peças do kit' else 'a peça inteira' end
               || ' · ' || replace(to_char(round(area, 1), 'FM999990.0'), '.', ',') || ' m² pela ficha'
          else 'Tecido · ' || case when eh_kit then 'as peças do kit' else 'a peça inteira' end || ' · pelo consumo cadastrado'
        end;
      end if;

      o_seq := o_seq + 1;
      o_ordem := n; o_material := mat.id; o_quantidade := case when falta then 0 else soma end;
      o_unidade := mat.unidade; o_sem_consumo := falta; o_pecas := pecas; o_tipo := 'tecido'; o_como := conta;
      return next;
    end loop;

    /* --- os aviamentos e insumos da ficha tecnica ----------------------------- */
    if ref_id is not null then
      for avi in
        select a.material_id, sum(a.quantidade) as por_peca, min(a.unidade) as unidade
          from public.material_da_referencia a
          join public.material m on m.id = a.material_id and m.ativo
         where a.material_id is not null
           and a.referencia_id in (
             select x.referencia_id from public.peca_do_kit x where eh_kit and x.kit_id = ref_id
             union all
             select ref_id where not eh_kit)
         group by a.material_id
      loop
        select * into mat from public.material m where m.id = avi.material_id;
        o_seq := o_seq + 1;
        o_ordem := n; o_material := mat.id; o_quantidade := avi.por_peca * pecas;
        o_unidade := mat.unidade; o_sem_consumo := false; o_pecas := pecas; o_tipo := mat.categoria;
        o_como := case when mat.categoria = 'insumo' then 'Insumo' else 'Aviamento' end || ' · '
                || replace(rtrim(rtrim(to_char(avi.por_peca, 'FM9999990.0000'), '0'), '.'), '.', ',')
                || ' ' || coalesce(nullif(avi.unidade, ''), mat.unidade) || ' por peça';
        return next;
      end loop;
    end if;
  end loop;

end $$;

revoke all on function public.consumo_do_documento(jsonb) from public;


-- ---------- 2. a reserva usa a conta, e guarda o que ja foi pesado -----------
create or replace function public.reservar_o_pedido(p_pedido uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ped    public.pedido;
  doc    jsonb;
  avi    record;
  linhas int := 0;
begin
  select * into ped from public.pedido where id = p_pedido;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  select corpo into doc from public.cotacao where id = ped.cotacao_id;
  if doc is null then
    return 0;
  end if;

  /* refaz do zero o que nao foi baixado nem pesado: corrigir o consumo tem
     que dar o numero novo; o que ja foi pesado tem o peso de verdade */
  delete from public.reserva where pedido_id = p_pedido and not baixada and separado is null;
  delete from public.consumo_do_layout where pedido_id = p_pedido;

  insert into public.consumo_do_layout (pedido_id, ordem, material_id, quantidade, unidade, sem_consumo, pecas, tipo, como)
  select p_pedido, c.o_ordem, c.o_material, sum(c.o_quantidade), min(c.o_unidade), bool_or(c.o_sem_consumo),
         max(c.o_pecas), (array_agg(c.o_tipo order by c.o_seq))[1], (array_agg(c.o_como order by c.o_seq))[1]
    from public.consumo_do_documento(doc) c
   group by c.o_ordem, c.o_material;

  /* --- a soma vira a reserva -------------------------------------------------
     Uma linha por material. A que ja foi baixada ou pesada fica como esta. */
  for avi in
    select c.material_id, sum(c.quantidade) as quantidade, min(c.unidade) as unidade,
           bool_or(c.sem_consumo) as sem_consumo,
           sum(c.pecas)::int as pecas
      from public.consumo_do_layout c
     where c.pedido_id = p_pedido
     group by c.material_id
  loop
    continue when exists (select 1 from public.reserva r
                           where r.pedido_id = p_pedido and r.material_id = avi.material_id
                             and (r.baixada or r.separado is not null));
    insert into public.reserva (pedido_id, material_id, quantidade, unidade, pecas, sem_consumo)
    values (p_pedido, avi.material_id, case when avi.sem_consumo then 0 else avi.quantidade end,
            avi.unidade, coalesce(avi.pecas, 0), avi.sem_consumo);
    linhas := linhas + 1;
  end loop;

  return linhas;
end $$;

grant execute on function public.reservar_o_pedido(uuid) to authenticated;


-- ---------- 3. o negociado ----------------------------------------------------
create table if not exists public.negociado (
  cotacao_id  uuid not null references public.cotacao (id) on delete cascade,
  material_id uuid not null references public.material (id) on delete cascade,
  quantidade  numeric(12,3) not null default 0,
  unidade     text not null default '',
  sem_consumo boolean not null default false,
  pecas       int not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (cotacao_id, material_id)
);
comment on table public.negociado is
  'O material das cotacoes abertas (081): nao tira do livre, so avisa. Derivada: negociar_a_cotacao refaz.';
create index if not exists negociado_do_material on public.negociado (material_id);

alter table public.negociado enable row level security;
drop policy if exists "quem foi aprovado le o negociado" on public.negociado;
create policy "quem foi aprovado le o negociado" on public.negociado
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.negociado to authenticated;

/* Refaz o negociado de uma cotacao: aberta (rascunho ou enviada, e nao de
   teste) conta; qualquer outro estado solta. */
create or replace function public.negociar_a_cotacao(p_cotacao uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cotacao;
  n int := 0;
begin
  delete from public.negociado where cotacao_id = p_cotacao;
  select * into c from public.cotacao where id = p_cotacao;
  if not found or c.estado not in ('rascunho', 'enviada') or coalesce(c.teste, false) then
    return 0;
  end if;
  insert into public.negociado (cotacao_id, material_id, quantidade, unidade, sem_consumo, pecas)
  select p_cotacao, x.o_material,
         sum(case when x.o_sem_consumo then 0 else x.o_quantidade end),
         min(x.o_unidade), bool_or(x.o_sem_consumo), sum(x.o_pecas)::int
    from public.consumo_do_documento(c.corpo) x
   group by x.o_material;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.negociar_a_cotacao(uuid) to authenticated;

/* A cotacao que muda refaz o seu negociado. Falha aqui nunca impede de
   salvar a cotacao: o negociado e aviso, e nao trava. */
create or replace function public.cotacao_negocia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.negociar_a_cotacao(new.id);
  exception when others then
    raise warning 'negociado da cotacao % nao refeito: %', new.numero, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists cotacao_negocia on public.cotacao;
create trigger cotacao_negocia
  after insert or update of corpo, estado, teste on public.cotacao
  for each row execute function public.cotacao_negocia();

/* as cotacoes abertas de hoje entram ja */
do $$
declare x record;
begin
  for x in select id from public.cotacao where estado in ('rascunho', 'enviada') and not coalesce(teste, false) loop
    begin
      perform public.negociar_a_cotacao(x.id);
    exception when others then
      raise warning 'negociado da cotacao % nao feito: %', x.id, sqlerrm;
    end;
  end loop;
end $$;


-- ---------- 4. a separacao pesa e guarda ---------------------------------------
create or replace function public.separar_material(
  p_reserva    uuid,
  p_quantidade numeric,
  p_observacao text default ''
) returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if not public.posso_a_acao('separacao.separar') then
    raise exception 'Seu acesso não permite separar material.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if res.baixada or res.separado is not null then
    raise exception 'Este material já foi pesado.' using errcode = '23505';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Escreva quanto pesou.' using errcode = '23514';
  end if;

  /* so anota: a baixa no estoque e no primeiro posto da producao */
  update public.reserva
     set separado = p_quantidade,
         pesado_em = now(),
         pesado_por = auth.uid(),
         atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.separar_material(uuid, numeric, text) to authenticated;

create or replace function public.desfazer_a_separacao(p_reserva uuid)
returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if not public.posso_a_acao('separacao.desfazer') then
    raise exception 'Seu acesso não permite desfazer uma separação.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if not res.baixada and res.separado is null then
    raise exception 'Este material não foi pesado.' using errcode = '23514';
  end if;

  /* a que ja saiu do estoque (o jeito antigo, ou ja baixada no primeiro
     posto) volta para a prateleira; a so pesada so esquece o peso */
  if res.baixada and coalesce(res.separado, 0) > 0 then
    perform public.mexer_no_estoque(
      res.material_id, res.separado, 'devolucao',
      'separação desfeita', res.pedido_id);
  end if;

  update public.reserva
     set baixada = false, separado = null, pesado_em = null, pesado_por = null, atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.desfazer_a_separacao(uuid) to authenticated;

create or replace function public.concluir_a_separacao(p_pedido uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     public.pedido;
  faltam  int;
  abertas int;
  saiu    int;
  total   int;
begin
  if not public.posso_a_acao('separacao.concluir') then
    raise exception 'Seu acesso não permite concluir a separação.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado not in ('aprovado', 'separacao') then
    raise exception 'Este pedido não está na separação.' using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where baixada or separado is not null),
         count(*) filter (where not baixada and separado is null),
         count(*) filter (where sem_consumo and not baixada and separado is null)
    into total, saiu, faltam, abertas
    from public.reserva where pedido_id = p_pedido;

  select faltam + count(*) into faltam
    from public.reserva
   where pedido_id = p_pedido and (baixada or separado is not null)
     and not sem_consumo and coalesce(separado, 0) < quantidade;

  if ped.estado = 'aprovado' then
    update public.pedido set estado = 'separacao' where id = p_pedido;
  end if;

  update public.pedido
     set estado = 'pcp',
         aviso = case
           when faltam > 0 then 'falta-material'
           when aviso = 'falta-material' then ''
           else aviso
         end
   where id = p_pedido;

  return case
    when total = 0 then 'Nenhum material cadastrado para este pedido. Ele seguiu para o PCP.'
    when faltam = 0 then 'Separação concluída: ' || saiu || ' de ' || total ||
                         ' materiais pesados. O pedido seguiu para o PCP.'
    else 'Separação concluída com falta: ' || faltam || ' de ' || total ||
         ' materiais incompletos' ||
         case when abertas > 0 then ', ' || abertas || ' sem consumo cadastrado' else '' end ||
         '. O PCP decide se o pedido desce assim.'
  end;
end $$;

grant execute on function public.concluir_a_separacao(uuid) to authenticated;


-- ---------- 5. a baixa no primeiro posto ----------------------------------------
/* Quando o pedido entra na producao (o PCP libera e os cartoes nascem no
   primeiro posto de cada tecnica), o que estava reservado sai do estoque:
   o peso anotado na separacao, ou o reservado quando ninguem pesou. */
create or replace function public.baixar_no_primeiro_posto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.reserva;
  quanto numeric;
begin
  if new.estado <> 'producao' or old.estado = 'producao' then
    return null;
  end if;
  for r in select * from public.reserva where pedido_id = new.id and not baixada for update loop
    quanto := coalesce(r.separado, case when r.sem_consumo then 0 else r.quantidade end);
    if quanto > 0 then
      insert into public.movimento_de_estoque (material_id, quantidade, motivo, observacao, pedido_id, quem)
      values (r.material_id, -quanto, 'producao',
              case when r.separado is not null then 'baixa no primeiro posto, pelo peso da separação'
                   else 'baixa no primeiro posto, pelo reservado (não foi pesado)' end,
              new.id, auth.uid());
    end if;
    update public.reserva
       set baixada = true, separado = coalesce(separado, quanto), atualizado_em = now()
     where id = r.id;
  end loop;
  return null;
end $$;

drop trigger if exists pedido_baixa_no_primeiro_posto on public.pedido;
create trigger pedido_baixa_no_primeiro_posto
  after update of estado on public.pedido
  for each row execute function public.baixar_no_primeiro_posto();


-- ---------- 6. as views ---------------------------------------------------------
/* A PRATELEIRA: o reservado conta o peso anotado quando ja pesou; o negociado
   entra no fim (as colunas de antes ficam onde estavam). */
create or replace view public.material_na_prateleira
with (security_invoker = true) as
select m.id,
       m.categoria,
       m.nome,
       m.unidade,
       m.minimo,
       m.saldo,
       coalesce(r.reservado, 0)             as reservado,
       m.saldo - coalesce(r.reservado, 0)   as livre,
       coalesce(r.pedidos, 0)               as pedidos_reservando,
       coalesce(r.em_aberto, false)         as reserva_sem_consumo,
       m.ativo,
       m.tecido_id,
       m.cor_id,
       t.nome  as tecido,
       c.nome  as cor,
       c.hex   as cor_hex,
       (m.saldo - coalesce(r.reservado, 0)) < m.minimo as abaixo_do_minimo,
       m.atualizado_em,
       (select max(v.quando) from public.movimento_de_estoque v where v.material_id = m.id)
         as ultimo_movimento,
       m.grupo,
       m.onde_fica,
       m.criado_em,
       m.composicao,
       m.gramatura,
       m.largura,
       m.detalhes,
       m.cuidados,
       /* 081 */
       coalesce(ng.negociado, 0)            as negociado,
       coalesce(ng.cotacoes, 0)             as cotacoes_negociando
  from public.material m
  left join public.tecido t on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join lateral (
    select sum(coalesce(x.separado, x.quantidade)) as reservado,
           count(*)              as pedidos,
           bool_or(x.sem_consumo and x.separado is null) as em_aberto
      from public.reserva x
     where x.material_id = m.id
       and not x.baixada
  ) r on true
  left join lateral (
    select sum(g.quantidade) as negociado, count(*) as cotacoes
      from public.negociado g
     where g.material_id = m.id
  ) ng on true
 where m.ativo;

grant select on public.material_na_prateleira to authenticated;

/* AS COTACOES QUE NEGOCIAM UM MATERIAL: para o Estoque e a cotacao dizerem
   quem esta na conversa */
create or replace view public.negociado_na_lista
with (security_invoker = true) as
select g.material_id,
       g.cotacao_id,
       c.numero,
       coalesce(c.cliente_nome, '') as cliente,
       coalesce(c.vendedor_nome, '') as vendedor,
       c.estado::text as estado,
       g.quantidade,
       g.unidade,
       g.sem_consumo,
       g.pecas,
       c.atualizado_em,
       m.nome as material,
       m.categoria
  from public.negociado g
  join public.cotacao c on c.id = g.cotacao_id
  join public.material m on m.id = g.material_id;

grant select on public.negociado_na_lista to authenticated;

create or replace view public.pedido_na_separacao
with (security_invoker = true) as
select p.id,
       p.numero,
       p.cliente_id,
       coalesce(c.nome, '')      as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       p.data_de_envio as entrega_em,
       p.departamento,
       p.criado_em,
       coalesce(r.linhas, 0)      as materiais,
       coalesce(r.separadas, 0)   as separados,
       coalesce(r.em_aberto, 0)   as sem_consumo,
       coalesce(r.descoberto, 0)  as nao_cobre,
       (coalesce(r.linhas, 0) > 0 and coalesce(r.separadas, 0) = coalesce(r.linhas, 0))
         as tudo_separado,
       p.cotacao_id,
       p.layouts,
       p.vendedor_nome
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join lateral (
    select count(*)                                                         as linhas,
           count(*) filter (where x.baixada or x.separado is not null)      as separadas,
           count(*) filter (where x.sem_consumo and not x.baixada and x.separado is null) as em_aberto,
           count(*) filter (where not x.baixada and x.separado is null and not x.sem_consumo
                              and m.saldo < x.quantidade)                    as descoberto
      from public.reserva x
      join public.material m on m.id = x.material_id
     where x.pedido_id = p.id
  ) r on true
 where p.estado in ('aprovado', 'separacao');

grant select on public.pedido_na_separacao to authenticated;

create or replace view public.material_da_fila
with (security_invoker = true) as
select m.id                                  as material_id,
       m.nome                                as material,
       m.categoria,
       m.unidade,
       coalesce(ct.hex, '')                  as cor_hex,
       coalesce(lg.codigo, nullif(m.onde_fica, ''), '') as onde_fica,
       m.saldo,
       sum(case when x.sem_consumo then 0 else x.quantidade end) as pede,
       count(distinct x.pedido_id)           as pedidos,
       count(*) filter (where x.sem_consumo) as sem_consumo,
       m.saldo - sum(case when x.sem_consumo then 0 else x.quantidade end) as depois,
       array_agg(p.numero order by p.data_de_envio nulls last, p.numero) as numeros
  from public.reserva x
  join public.pedido   p  on p.id = x.pedido_id
  join public.material m  on m.id = x.material_id
  left join public.cor_de_tecido ct on ct.id = m.cor_id
  left join lateral (
    select l.codigo from public.lugar_do_material_na_lista l
     where l.material_id = m.id order by l.principal desc, l.criado_em limit 1
  ) lg on true
 where p.estado in ('aprovado', 'separacao')
   and not x.baixada
   and x.separado is null
 group by m.id, m.nome, m.categoria, m.unidade, ct.hex, lg.codigo, m.onde_fica, m.saldo;

grant select on public.material_da_fila to authenticated;

create or replace view public.pedido_separado
with (security_invoker = true) as
select p.id,
       p.numero,
       coalesce(c.nome, '') as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       p.layouts,
       p.data_de_envio      as entrega_em,
       p.cotacao_id,
       coalesce(r.linhas, 0)    as materiais,
       coalesce(r.separadas, 0) as separados,
       greatest(r.pesado_em, v.quando) as separado_em
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join lateral (
    select count(*) as linhas,
           count(*) filter (where x.baixada or x.separado is not null) as separadas,
           max(x.pesado_em) as pesado_em
      from public.reserva x where x.pedido_id = p.id
  ) r on true
  left join lateral (
    select max(mv.quando) as quando
      from public.movimento_de_estoque mv
     where mv.pedido_id = p.id and mv.motivo = 'separacao'
  ) v on true
 where p.estado in ('pcp', 'producao', 'pronto', 'enviado', 'entregue');

grant select on public.pedido_separado to authenticated;

create or replace view public.reserva_do_pedido
with (security_invoker = true) as
select r.id,
       r.pedido_id,
       p.numero    as pedido,
       r.material_id,
       m.nome      as material,
       m.categoria,
       r.quantidade,
       r.unidade,
       r.pecas,
       r.sem_consumo,
       r.baixada,
       r.separado,
       greatest(r.quantidade - coalesce(r.separado, 0), 0) as falta,
       m.saldo,
       (m.saldo >= r.quantidade and not r.sem_consumo) as o_estoque_cobre,
       r.criada_em,
       /* 081: pesado e ainda no estoque, esperando o primeiro posto */
       (r.separado is not null and not r.baixada) as pesada,
       r.pesado_em,
       coalesce(pe.nome, '') as pesado_por
  from public.reserva r
  join public.material m on m.id = r.material_id
  join public.pedido   p on p.id = r.pedido_id
  left join public.pessoa pe on pe.id = r.pesado_por;

grant select on public.reserva_do_pedido to authenticated;


-- ---------- a prova -------------------------------------------------------------
do $$
begin
  raise notice '081 pronta: % material(is) negociado(s) em % cotacao(oes) aberta(s)',
    (select count(distinct material_id) from public.negociado),
    (select count(distinct cotacao_id) from public.negociado);
end $$;
