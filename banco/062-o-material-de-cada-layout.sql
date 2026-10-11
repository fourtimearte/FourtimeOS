-- ===========================================================================
-- 062: O MATERIAL DE CADA LAYOUT (Separacao do wireframe, parte S2, prancha 83)
--
-- A reserva (026) e uma linha por pedido e material: ela diz quanto o pedido
-- inteiro tira da prateleira, e nao de qual layout. A prancha 83 mostra cada
-- layout com o "Material deste layout" e de onde vem a conta ("Tecido, a peca
-- inteira, 104 m2 pela ficha"; "Aviamento, 0,02 cone por peca").
--
-- O QUE ENTRA:
--   1. a tabela consumo_do_layout: o que cada layout pede de cada material, com
--      a explicacao da conta. E derivada, como a reserva: refazer nao perde
--      nada que alguem digitou.
--   2. reservar_o_pedido refeita:
--      a. grava o consumo de cada layout e soma na reserva, como antes;
--      b. o KIT soma as pecas dele (peca_do_kit), e nao fica sem consumo;
--      c. os AVIAMENTOS E INSUMOS da ficha tecnica (material_da_referencia,
--         os que estao ligados a um material do Estoque) passam a ser
--         reservados, quantidade por peca vezes as pecas do layout;
--      d. a linha ja baixada nao e mais somada de novo ao refazer (antes, o
--         ON CONFLICT somava a conta nova em cima da linha separada).
--   3. as reservas dos pedidos que ainda nao sairam da separacao sao refeitas
--      (aprovado e separacao): e o que faz os aviamentos aparecerem nelas.
-- ===========================================================================


-- ---------- 1. a tabela ----------------------------------------------------
create table if not exists public.consumo_do_layout (
  pedido_id   uuid not null references public.pedido (id) on delete cascade,
  /* a posicao do layout no orcamento, comecando em 1 (a mesma de layout_do_pedido) */
  ordem       int  not null,
  material_id uuid not null references public.material (id) on delete cascade,
  quantidade  numeric(12,3) not null default 0,
  unidade     text not null default '',
  sem_consumo boolean not null default false,
  /* as pecas do layout: a reserva soma as dos layouts que pedem o material */
  pecas       int  not null default 0,
  /* tecido, aviamento ou insumo: a categoria do material */
  tipo        text not null default '',
  /* de onde vem a conta, para quem separa ler: "a peca inteira, 104 m2 pela ficha" */
  como        text not null default '',
  primary key (pedido_id, ordem, material_id)
);

comment on table public.consumo_do_layout is
  'O que cada layout de um pedido pede de cada material, com a explicacao da conta. Derivada: reservar_o_pedido refaz';

alter table public.consumo_do_layout enable row level security;
drop policy if exists "quem foi aprovado le o consumo do layout" on public.consumo_do_layout;
create policy "quem foi aprovado le o consumo do layout" on public.consumo_do_layout
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.consumo_do_layout to authenticated;


-- ---------- 2. a reserva, layout por layout ----------------------------------
create or replace function public.reservar_o_pedido(p_pedido uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     public.pedido;
  doc     jsonb;
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
  linhas  int := 0;
  conta   text;
begin
  select * into ped from public.pedido where id = p_pedido;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  select corpo into doc from public.cotacao where id = ped.cotacao_id;
  if doc is null then
    return 0;
  end if;

  /* refaz do zero o que nao foi separado: corrigir o consumo tem que dar o
     numero novo, e nao o novo somado ao velho */
  delete from public.reserva where pedido_id = p_pedido and not baixada;
  delete from public.consumo_do_layout where pedido_id = p_pedido;

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

      insert into public.consumo_do_layout (pedido_id, ordem, material_id, quantidade, unidade, sem_consumo, pecas, tipo, como)
      values (p_pedido, n, mat.id, case when falta then 0 else soma end, mat.unidade, falta, pecas, 'tecido', conta)
      on conflict (pedido_id, ordem, material_id) do update
        set quantidade  = consumo_do_layout.quantidade + excluded.quantidade,
            sem_consumo = consumo_do_layout.sem_consumo or excluded.sem_consumo;
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
        insert into public.consumo_do_layout (pedido_id, ordem, material_id, quantidade, unidade, sem_consumo, pecas, tipo, como)
        values (p_pedido, n, mat.id, avi.por_peca * pecas, mat.unidade, false, pecas, mat.categoria,
                case when mat.categoria = 'insumo' then 'Insumo' else 'Aviamento' end || ' · '
                || replace(rtrim(rtrim(to_char(avi.por_peca, 'FM9999990.0000'), '0'), '.'), '.', ',')
                || ' ' || coalesce(nullif(avi.unidade, ''), mat.unidade) || ' por peça')
        on conflict (pedido_id, ordem, material_id) do update
          set quantidade = consumo_do_layout.quantidade + excluded.quantidade;
      end loop;
    end if;
  end loop;

  /* --- a soma vira a reserva -------------------------------------------------
     Uma linha por material. A que ja foi separada (baixada) fica como esta: a
     conta nova nao se soma em cima do que ja saiu da prateleira. */
  for avi in
    select c.material_id, sum(c.quantidade) as quantidade, min(c.unidade) as unidade,
           bool_or(c.sem_consumo) as sem_consumo,
           sum(c.pecas)::int as pecas
      from public.consumo_do_layout c
     where c.pedido_id = p_pedido
     group by c.material_id
  loop
    continue when exists (select 1 from public.reserva r
                           where r.pedido_id = p_pedido and r.material_id = avi.material_id and r.baixada);
    insert into public.reserva (pedido_id, material_id, quantidade, unidade, pecas, sem_consumo)
    values (p_pedido, avi.material_id, case when avi.sem_consumo then 0 else avi.quantidade end,
            avi.unidade, coalesce(avi.pecas, 0), avi.sem_consumo);
    linhas := linhas + 1;
  end loop;

  return linhas;
end $$;

grant execute on function public.reservar_o_pedido(uuid) to authenticated;


-- ---------- 3. as reservas abertas, refeitas ----------------------------------
-- So os pedidos que ainda separam: no PCP e na producao o material ja saiu, e
-- os aviamentos novos nao tem mais quem separe.
do $$
declare p record;
begin
  for p in select id from public.pedido where estado in ('aprovado', 'separacao') loop
    perform public.reservar_o_pedido(p.id);
  end loop;
end $$;
