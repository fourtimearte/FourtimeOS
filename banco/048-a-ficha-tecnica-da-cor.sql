-- ===========================================================================
-- 048: A FICHA TECNICA DA COR
--
-- O Henrique pediu, em 05/10/2026, a ficha tecnica dentro do Estoque:
-- composicao, gramatura, largura, detalhes e os simbolos de cuidado. E disse
-- de quem ela e: "a ficha tecnica daquele tecido com aquela cor, entenda que
-- isso e individual". A mesma malha comprada de dois fornecedores, em duas
-- cores, pode ter gramatura e cuidado diferentes.
--
-- Por isso a ficha mora no MATERIAL (a cor do tecido no estoque), e nao no
-- catalogo de tecidos. O wireframe de 04/10/2026 dizia "vale para o tecido
-- inteiro": a tela continua a mesma, o dono da ficha mudou.
--
-- O QUE ENTRA:
--   1. os 38 simbolos de cuidado da norma de etiqueta textil, em 6 grupos
--   2. a ficha no material: composicao, gramatura, largura, detalhes, cuidados
--   3. o gatilho que confere a ficha antes de gravar
--   4. a view da lista, com a ficha
--   5. a funcao que muda o cadastro de varios materiais de uma vez
--
-- A GRAMATURA E A LARGURA DO CATALOGO (tecido.gramatura, tecido.largura)
-- CONTINUAM LA, e e delas que a reserva tira a conta de metro para quilo. As
-- da cor sao a ficha daquela cor; quando a cor nao tem a sua, a tela mostra a
-- do catalogo e diz que e de la.
--
-- UM SIMBOLO POR GRUPO. Lavagem, alvejamento, secagem em tambor, secagem
-- natural, passadoria e limpeza profissional: a etiqueta leva um de cada, e
-- dois da mesma familia se contradizem. Quem confere e o banco.
--
-- EM LOTE, E DE UMA VEZ. A tabela do Estoque marca trinta cores e muda o
-- fornecedor, o minimo ou a ficha de todas. A funcao recebe a lista e so o que
-- e para mudar: o que nao veio fica como esta em cada material. Ou muda todas,
-- ou nao muda nenhuma.
-- ===========================================================================


-- ---------- 1. os simbolos de cuidado ---------------------------------------
-- O desenho e a frase de cada um moram na tela (src/dominio/estoque/
-- cuidados.ts). Aqui fica so o que o banco precisa para conferir: o codigo, o
-- grupo e a ordem em que aparecem na etiqueta. O teste testes/cuidados.mjs
-- confere que as duas listas sao a mesma.
create table if not exists public.simbolo_de_cuidado (
  cod   text primary key,
  grupo text not null,
  ordem int  not null,

  constraint simbolo_de_cuidado_grupo_conhecido check (
    grupo in ('lavagem', 'alvejamento', 'tambor', 'natural', 'passadoria', 'profissional')
  ),
  constraint simbolo_de_cuidado_ordem_unica unique (ordem)
);

comment on table public.simbolo_de_cuidado is
  'Os simbolos de cuidado com o tecido (ABNT NBR NM ISO 3758). Em cada grupo a ficha leva um so.';

alter table public.simbolo_de_cuidado enable row level security;

drop policy if exists "quem foi aprovado le os simbolos" on public.simbolo_de_cuidado;
create policy "quem foi aprovado le os simbolos" on public.simbolo_de_cuidado
  for select to authenticated using (public.meu_papel() is not null);

grant select on public.simbolo_de_cuidado to authenticated;

insert into public.simbolo_de_cuidado (cod, grupo, ordem) values
  ('lavar-30',                   'lavagem',      101),
  ('lavar-30-suave',             'lavagem',      102),
  ('lavar-30-muito-suave',       'lavagem',      103),
  ('lavar-40',                   'lavagem',      104),
  ('lavar-40-suave',             'lavagem',      105),
  ('lavar-40-muito-suave',       'lavagem',      106),
  ('lavar-50',                   'lavagem',      107),
  ('lavar-60',                   'lavagem',      108),
  ('lavar-95',                   'lavagem',      109),
  ('lavar-mao',                  'lavagem',      110),
  ('nao-lavar',                  'lavagem',      111),
  ('alvejar',                    'alvejamento',  201),
  ('alvejar-oxigenio',           'alvejamento',  202),
  ('nao-alvejar',                'alvejamento',  203),
  ('tambor-normal',              'tambor',       301),
  ('tambor-baixa',               'tambor',       302),
  ('nao-tambor',                 'tambor',       303),
  ('varal',                      'natural',      401),
  ('varal-sombra',               'natural',      402),
  ('varal-pingando',             'natural',      403),
  ('varal-pingando-sombra',      'natural',      404),
  ('horizontal',                 'natural',      405),
  ('horizontal-sombra',          'natural',      406),
  ('horizontal-pingando',        'natural',      407),
  ('horizontal-pingando-sombra', 'natural',      408),
  ('passar-1',                   'passadoria',   501),
  ('passar-2',                   'passadoria',   502),
  ('passar-3',                   'passadoria',   503),
  ('nao-passar',                 'passadoria',   504),
  ('seco-p',                     'profissional', 601),
  ('seco-p-suave',               'profissional', 602),
  ('seco-f',                     'profissional', 603),
  ('seco-f-suave',               'profissional', 604),
  ('nao-seco',                   'profissional', 605),
  ('umido-w',                    'profissional', 606),
  ('umido-w-suave',              'profissional', 607),
  ('umido-w-muito-suave',        'profissional', 608),
  ('nao-umido',                  'profissional', 609)
on conflict (cod) do update set grupo = excluded.grupo, ordem = excluded.ordem;


-- ---------- 2. a ficha no material ------------------------------------------
alter table public.material
  -- [{"fibra": "Poliéster", "pct": 96}, {"fibra": "Elastano", "pct": 4}]
  add column if not exists composicao jsonb not null default '[]'::jsonb,
  -- em g/m2; nula enquanto ninguem escreveu a desta cor
  add column if not exists gramatura  numeric(7,2),
  -- em metros
  add column if not exists largura    numeric(6,3),
  -- frases curtas: "Proteção UV 50+", "Secagem rápida"
  add column if not exists detalhes   text[] not null default '{}'::text[],
  -- os codigos de simbolo_de_cuidado, um por grupo, na ordem da etiqueta
  add column if not exists cuidados   text[] not null default '{}'::text[];

alter table public.material drop constraint if exists material_gramatura_que_existe;
alter table public.material add constraint material_gramatura_que_existe
  check (gramatura is null or gramatura between 20 and 1500);

alter table public.material drop constraint if exists material_largura_que_existe;
alter table public.material add constraint material_largura_que_existe
  check (largura is null or largura between 0.2 and 5);

comment on column public.material.composicao is
  'As fibras e a porcentagem de cada uma. Vazia ou somando 100.';
comment on column public.material.cuidados is
  'Os simbolos de cuidado desta cor: codigos de simbolo_de_cuidado, um por grupo.';


-- ---------- 3. o gatilho que confere a ficha ---------------------------------
-- A composicao soma 100 ou esta vazia; nenhuma fibra se repete; os detalhes
-- nao trazem linha vazia nem repetida; e os cuidados sao simbolos que existem,
-- um por grupo. O gatilho tambem ARRUMA o que da para arrumar sem inventar:
-- tira espaco das pontas e poe os simbolos na ordem da etiqueta.
create or replace function public.conferir_a_ficha_do_material()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  it     jsonb;
  fibra  text;
  pct    numeric;
  soma   numeric := 0;
  vistas text[] := '{}';
  limpa  jsonb := '[]'::jsonb;
  d      text;
  novos  text[] := '{}';
  n      int;
begin
  /* a composicao */
  new.composicao := coalesce(new.composicao, '[]'::jsonb);
  if jsonb_typeof(new.composicao) <> 'array' then
    raise exception 'A composição veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(new.composicao) > 8 then
    raise exception 'A composição cabe em até 8 fibras.' using errcode = '23514';
  end if;
  for it in select * from jsonb_array_elements(new.composicao) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'A composição veio num formato que eu não entendo.' using errcode = '22023';
    end if;
    fibra := btrim(coalesce(it ->> 'fibra', ''));
    if fibra = '' or length(fibra) > 40 then
      raise exception 'Toda linha da composição precisa do nome da fibra.' using errcode = '23514';
    end if;
    begin
      pct := (it ->> 'pct')::numeric;
    exception when others then
      raise exception 'A porcentagem de % não é um número.', fibra using errcode = '23514';
    end;
    if pct is null or pct <= 0 or pct > 100 then
      raise exception 'A porcentagem de % tem de ficar entre 0 e 100.', fibra using errcode = '23514';
    end if;
    if lower(fibra) = any (vistas) then
      raise exception 'A fibra % aparece duas vezes na composição.', fibra using errcode = '23514';
    end if;
    vistas := vistas || lower(fibra);
    soma := soma + pct;
    limpa := limpa || jsonb_build_object('fibra', fibra, 'pct', pct);
  end loop;
  if jsonb_array_length(limpa) > 0 and abs(soma - 100) > 0.01 then
    raise exception 'A composição soma %, e tem de somar 100.', trim(to_char(soma, 'FM999990.##')) || '%'
      using errcode = '23514';
  end if;
  new.composicao := limpa;

  /* os detalhes */
  if cardinality(coalesce(new.detalhes, '{}')) > 12 then
    raise exception 'A ficha cabe em até 12 detalhes.' using errcode = '23514';
  end if;
  foreach d in array coalesce(new.detalhes, '{}') loop
    d := btrim(coalesce(d, ''));
    continue when d = '';
    if length(d) > 60 then
      raise exception 'Cada detalhe cabe em até 60 letras.' using errcode = '23514';
    end if;
    if not exists (select 1 from unnest(novos) x where lower(x) = lower(d)) then
      novos := novos || d;
    end if;
  end loop;
  new.detalhes := novos;

  /* os cuidados */
  new.cuidados := coalesce(new.cuidados, '{}');
  select count(*) into n
    from unnest(new.cuidados) c
   where not exists (select 1 from public.simbolo_de_cuidado s where s.cod = c);
  if n > 0 then
    raise exception 'Há símbolo de cuidado que eu não conheço.' using errcode = '23514';
  end if;
  select count(*) into n
    from (select s.grupo
            from public.simbolo_de_cuidado s
           where s.cod = any (new.cuidados)
           group by s.grupo
          having count(*) > 1) g;
  if n > 0 or cardinality(new.cuidados) <> (select count(distinct c) from unnest(new.cuidados) c) then
    raise exception 'A ficha leva um símbolo de cuidado por grupo.' using errcode = '23514';
  end if;
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados
    from public.simbolo_de_cuidado s
   where s.cod = any (new.cuidados);

  return new;
end $$;

drop trigger if exists material_ficha on public.material;
create trigger material_ficha
  before insert or update of composicao, detalhes, cuidados on public.material
  for each row execute function public.conferir_a_ficha_do_material();


-- ---------- 4. a view da lista, com a ficha -----------------------------------
-- A mesma da 041, com as cinco colunas da ficha no fim. As colunas novas vao
-- no fim de proposito: create or replace view so aceita acrescentar ali.
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
       m.cuidados
  from public.material m
  left join public.tecido t on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join lateral (
    select sum(x.quantidade)     as reservado,
           count(*)              as pedidos,
           bool_or(x.sem_consumo) as em_aberto
      from public.reserva x
     where x.material_id = m.id
       and not x.baixada
  ) r on true
 where m.ativo;

grant select on public.material_na_prateleira to authenticated;


-- ---------- 5. mudar o cadastro de varios materiais de uma vez ----------------
-- p_mudanca traz SO O QUE E PARA MUDAR. Chave que nao veio fica como esta em
-- cada material. As chaves:
--   minimo       numero, zero ou mais
--   composicao   [{fibra, pct}], vazia para apagar
--   gramatura    numero ou null
--   largura      numero ou null
--   detalhes     [texto]
--   cuidados     [codigo]
--   fornecedor   uuid, ou null para deixar sem fornecedor
--   so_sem_fornecedor  true: o fornecedor so entra em quem nao tem nenhum
--
-- O FORNECEDOR TROCA, NAO SOMA. Dizer "esta cor vem de tal malharia" tira as
-- ligacoes antigas daquele material e poe a nova. A entrada de material de
-- outro fornecedor continua somando sozinha (mexer_no_estoque, 041): aqui e a
-- pessoa dizendo de quem a cor vem.
create or replace function public.definir_cadastro(
  p_materiais uuid[],
  p_mudanca   jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mud     jsonb := coalesce(p_mudanca, '{}'::jsonb);
  chave   text;
  forn    uuid;
  so_sem  boolean := false;
  m       uuid;
  n       int := 0;
begin
  if not public.posso('estoque', 'editar') then
    raise exception 'Seu acesso não permite mudar o cadastro dos materiais.' using errcode = '42501';
  end if;
  if p_materiais is null or cardinality(p_materiais) = 0 then
    raise exception 'Escolha pelo menos um material.' using errcode = '22023';
  end if;
  if cardinality(p_materiais) > 500 then
    raise exception 'São muitos materiais de uma vez. Mude até 500 por vez.' using errcode = '22023';
  end if;
  if jsonb_typeof(mud) <> 'object' then
    raise exception 'A mudança veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  for chave in select jsonb_object_keys(mud) loop
    if chave not in ('minimo', 'composicao', 'gramatura', 'largura', 'detalhes', 'cuidados',
                     'fornecedor', 'so_sem_fornecedor') then
      raise exception 'Não sei mudar "%" no cadastro do material.', chave using errcode = '22023';
    end if;
  end loop;
  if mud = '{}'::jsonb or mud = '{"so_sem_fornecedor": true}'::jsonb
     or mud = '{"so_sem_fornecedor": false}'::jsonb then
    raise exception 'Nada para mudar.' using errcode = '22023';
  end if;
  if (select count(*) from public.material where id = any (p_materiais))
     <> (select count(distinct x) from unnest(p_materiais) x) then
    raise exception 'Material não encontrado.' using errcode = 'P0002';
  end if;

  if mud ? 'minimo' then
    if jsonb_typeof(mud -> 'minimo') <> 'number' or (mud ->> 'minimo')::numeric < 0 then
      raise exception 'O mínimo é um número, zero ou mais.' using errcode = '23514';
    end if;
  end if;
  if mud ? 'gramatura' and jsonb_typeof(mud -> 'gramatura') not in ('number', 'null') then
    raise exception 'A gramatura é um número, em g/m².' using errcode = '23514';
  end if;
  if mud ? 'largura' and jsonb_typeof(mud -> 'largura') not in ('number', 'null') then
    raise exception 'A largura é um número, em metros.' using errcode = '23514';
  end if;
  if mud ? 'detalhes' and jsonb_typeof(mud -> 'detalhes') <> 'array' then
    raise exception 'Os detalhes vieram num formato que eu não entendo.' using errcode = '22023';
  end if;
  if mud ? 'cuidados' and jsonb_typeof(mud -> 'cuidados') <> 'array' then
    raise exception 'Os cuidados vieram num formato que eu não entendo.' using errcode = '22023';
  end if;

  /* o cadastro: uma passada so, e o gatilho confere a ficha de cada linha */
  update public.material x
     set minimo     = case when mud ? 'minimo' then (mud ->> 'minimo')::numeric else x.minimo end,
         composicao = case when mud ? 'composicao' then mud -> 'composicao' else x.composicao end,
         gramatura  = case when mud ? 'gramatura' then (mud ->> 'gramatura')::numeric else x.gramatura end,
         largura    = case when mud ? 'largura' then (mud ->> 'largura')::numeric else x.largura end,
         detalhes   = case when mud ? 'detalhes'
                        then array(select jsonb_array_elements_text(mud -> 'detalhes'))
                        else x.detalhes end,
         cuidados   = case when mud ? 'cuidados'
                        then array(select jsonb_array_elements_text(mud -> 'cuidados'))
                        else x.cuidados end
   where x.id = any (p_materiais);
  get diagnostics n = row_count;

  /* o fornecedor */
  if mud ? 'fornecedor' then
    so_sem := coalesce((mud ->> 'so_sem_fornecedor')::boolean, false);
    if jsonb_typeof(mud -> 'fornecedor') = 'null' then
      delete from public.material_fornecedor where material_id = any (p_materiais);
    else
      begin
        forn := (mud ->> 'fornecedor')::uuid;
      exception when others then
        raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
      end;
      if not exists (select 1 from public.fornecedor f where f.id = forn and f.ativo) then
        raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
      end if;
      if exists (select 1 from public.fornecedor f where f.id = forn and f.situacao = 'bloqueado') then
        raise exception 'Este fornecedor está bloqueado. Desbloqueie em Fornecedores antes de escolher.'
          using errcode = '23514';
      end if;
      foreach m in array p_materiais loop
        continue when so_sem
          and exists (select 1 from public.material_fornecedor mf where mf.material_id = m);
        delete from public.material_fornecedor where material_id = m and fornecedor_id <> forn;
        insert into public.material_fornecedor (material_id, fornecedor_id)
        values (m, forn)
        on conflict do nothing;
      end loop;
    end if;
  end if;

  return n;
end $$;

comment on function public.definir_cadastro(uuid[], jsonb) is
  'Muda o minimo, a ficha tecnica e o fornecedor de varios materiais de uma vez. So o que vem em p_mudanca muda.';

revoke all on function public.definir_cadastro(uuid[], jsonb) from public;
grant execute on function public.definir_cadastro(uuid[], jsonb) to authenticated;
