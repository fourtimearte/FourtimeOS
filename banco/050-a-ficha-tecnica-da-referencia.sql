-- ===========================================================================
-- 050: A FICHA TECNICA DA REFERENCIA
--
-- O Henrique pediu, em 05/10/2026, a pagina Fichas tecnicas: cada referencia
-- com o molde, os detalhes da peca, a tabela de medidas, o tecido que ela
-- gasta em cada tamanho e os aviamentos. O wireframe sao as pranchas 57 a 71
-- do canvas. Este arquivo e o banco da primeira parte, a das referencias. Os
-- kits, o movimento, o deposito de pecas prontas e as estatisticas vem depois,
-- cada um no seu arquivo.
--
-- O QUE ENTRA:
--   1. o que a referencia ganha: detalhes, observacao, a grade ligada
--   2. a tabela de medidas, livre: cada referencia tem as medidas que precisar
--   3. as partes do molde, com o tecido de cada uma em cada tamanho
--   4. os aviamentos e insumos por peca
--   5. o molde em SVG, numa tabela a parte
--   6. a area de tecido no consumo, e a conta do consumo que passa a usa-la
--   7. a view da lista, sem o molde
--   8. a funcao que salva a ficha inteira, e a que salva o molde
--
-- A TABELA DE MEDIDAS E LIVRE, por pedido dele: "algumas pecas nao tem so
-- comprimento, largura, manga". Uma calca leva cintura, quadril, gancho e
-- entrepernas. Por isso a medida e uma linha com nome, e nao uma coluna.
--
-- O TECIDO E DIGITADO EM AREA, por parte do molde. O estudo de moldes de
-- 05/08/2026 mede a area liquida de cada tamanho e divide pelo aproveitamento.
-- Area nao depende do tecido: os metros saem da largura e os quilos da
-- gramatura do tecido escolhido no orcamento. E por parte porque a peca
-- esportiva pode levar mais de um tecido (frente e costas num, mangas noutro),
-- e e a parte que diz quanto de cada um.
--
-- A RESERVA CONTINUA LENDO consumo_da_referencia. A ficha escreve la a AREA
-- da peca inteira em cada tamanho, e consumo_da_peca passa a converter a area
-- quando o tecido tem largura e gramatura. O que ja estava cadastrado em
-- metros ou em quilos continua valendo onde nao ha area.
--
-- A ETIQUETA NAO MORA AQUI, por decisao dele: e caso a caso (silk, DTF ou
-- sublimacao, conforme o cliente). Ela e do kit e do orcamento.
--
-- QUEM SALVA A FICHA E UMA FUNCAO SO, de uma vez: ou entra a ficha inteira,
-- ou nao entra nada. As tabelas novas nao tem regra de escrita, de proposito:
-- ninguem escreve nelas por fora da funcao.
-- ===========================================================================


-- ---------- 1. o que a referencia ganha -------------------------------------
alter table public.referencia
  add column if not exists detalhes   jsonb       not null default '{}'::jsonb,
  add column if not exists observacao text        not null default '',
  add column if not exists tamanhos   text[]      not null default '{}',
  add column if not exists ficha_em   timestamptz;

comment on column public.referencia.detalhes is
  'gola, manga, punho, barra e costura da peca, em texto. Etiqueta nao: ela e do kit e do orcamento';
comment on column public.referencia.observacao is 'observacao para a costura';
comment on column public.referencia.tamanhos is
  'os tamanhos que a peca tem. Vazio enquanto ninguem preencheu a ficha: a tela mostra a grade do genero';
comment on column public.referencia.ficha_em is
  'quando a ficha tecnica foi salva pela ultima vez. Nulo: a ficha esta em branco';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referencia_detalhes_e_objeto') then
    alter table public.referencia
      add constraint referencia_detalhes_e_objeto check (jsonb_typeof(detalhes) = 'object');
  end if;
end $$;


-- ---------- 2. a tabela de medidas ------------------------------------------
-- A peca pronta, medida esticada na mesa, em centimetros. `valores` e um
-- objeto de tamanho para numero ({"PP": 66, "P": 68}): tamanho sem numero
-- simplesmente nao esta la.
create table if not exists public.medida_da_referencia (
  id            uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  nome          text not null,
  como_medir    text not null default '',
  ordem         int  not null default 0,
  valores       jsonb not null default '{}'::jsonb,

  constraint medida_nome_nao_vazio check (btrim(nome) <> ''),
  constraint medida_valores_e_objeto check (jsonb_typeof(valores) = 'object')
);

create unique index if not exists medida_por_referencia_e_nome
  on public.medida_da_referencia (referencia_id, lower(nome));
create index if not exists medida_por_referencia
  on public.medida_da_referencia (referencia_id, ordem);

comment on table public.medida_da_referencia is
  'A tabela de medidas da referencia: uma linha por medida, com o valor em cm de cada tamanho';

alter table public.medida_da_referencia enable row level security;
drop policy if exists "quem foi aprovado le as medidas" on public.medida_da_referencia;
create policy "quem foi aprovado le as medidas" on public.medida_da_referencia
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.medida_da_referencia to authenticated;


-- ---------- 3. as partes do molde -------------------------------------------
-- Frente, costas, mangas, gola. `quantidades` e o tecido da parte em cada
-- tamanho, ja com a perda do corte e ja com todos os cortes dela (as duas
-- mangas juntas). A unidade diz se e area (m2), que e o caso do pano, ou
-- comprimento (m), que e o caso da ribana e do vies.
create table if not exists public.parte_da_referencia (
  id            uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  nome          text not null,
  /* quantas vezes a parte e cortada numa peca: a manga, duas */
  vezes         int  not null default 1,
  unidade       text not null default 'm2',
  ordem         int  not null default 0,
  quantidades   jsonb not null default '{}'::jsonb,

  constraint parte_nome_nao_vazio check (btrim(nome) <> ''),
  constraint parte_vezes_na_faixa check (vezes between 1 and 20),
  constraint parte_unidade_conhecida check (unidade in ('m2', 'm')),
  constraint parte_quantidades_e_objeto check (jsonb_typeof(quantidades) = 'object')
);

create unique index if not exists parte_por_referencia_e_nome
  on public.parte_da_referencia (referencia_id, lower(nome));
create index if not exists parte_por_referencia
  on public.parte_da_referencia (referencia_id, ordem);

comment on table public.parte_da_referencia is
  'As partes do molde da referencia e o tecido de cada uma em cada tamanho (m2 de pano ou m de ribana)';

alter table public.parte_da_referencia enable row level security;
drop policy if exists "quem foi aprovado le as partes" on public.parte_da_referencia;
create policy "quem foi aprovado le as partes" on public.parte_da_referencia
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.parte_da_referencia to authenticated;


-- ---------- 4. os aviamentos e insumos por peca -----------------------------
-- O material do Estoque quando ele e um so (o saco de embalagem), ou so o nome
-- quando depende da cor da peca (a linha na cor do tecido): por isso o
-- material e opcional e o nome fica sempre escrito.
create table if not exists public.material_da_referencia (
  id            uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  material_id   uuid references public.material (id) on delete set null,
  nome          text not null,
  quantidade    numeric(12,4) not null,
  unidade       text not null default '',
  ordem         int  not null default 0,

  constraint material_da_referencia_nome_nao_vazio check (btrim(nome) <> ''),
  constraint material_da_referencia_quantidade_positiva check (quantidade > 0)
);

create index if not exists material_por_referencia
  on public.material_da_referencia (referencia_id, ordem);

comment on table public.material_da_referencia is
  'Aviamentos e insumos que uma peca da referencia leva, iguais em toda a grade';

alter table public.material_da_referencia enable row level security;
drop policy if exists "quem foi aprovado le os materiais da referencia" on public.material_da_referencia;
create policy "quem foi aprovado le os materiais da referencia" on public.material_da_referencia
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.material_da_referencia to authenticated;


-- ---------- 5. o molde em SVG -----------------------------------------------
-- NUMA TABELA A PARTE, pelo mesmo motivo do corpo da cotacao: a lista das 112
-- referencias nunca pode baixar 112 desenhos para mostrar 112 linhas de texto.
-- `tamanho` vazio e o desenho da referencia; um tamanho escrito e o molde
-- daquele tamanho, que a tela cheia vai usar quando existir.
create table if not exists public.molde_da_referencia (
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  tamanho       text not null default '',
  svg           text not null,
  atualizado_em timestamptz not null default now(),

  primary key (referencia_id, tamanho),
  constraint molde_e_svg check (svg ~* '<svg[\s>]'),
  /* 600 mil letras e um SVG de molde folgado. Mais que isso e foto dentro do
     arquivo, e o lugar de foto nao e aqui */
  constraint molde_cabe check (char_length(svg) <= 600000)
);

comment on table public.molde_da_referencia is
  'O molde da referencia em SVG, tirado do Affinity. Fora da tabela referencia para a lista nao carregar desenho';

alter table public.molde_da_referencia enable row level security;
drop policy if exists "quem foi aprovado le os moldes" on public.molde_da_referencia;
create policy "quem foi aprovado le os moldes" on public.molde_da_referencia
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.molde_da_referencia to authenticated;


-- ---------- 6. a area no consumo --------------------------------------------
-- A area da peca inteira em cada tamanho, em m2, ja com a perda. Quem escreve
-- e a funcao que salva a ficha: e a soma das partes de pano.
alter table public.consumo_da_referencia
  add column if not exists area numeric(10,4);

comment on column public.consumo_da_referencia.area is
  'm2 de tecido por peca, ja com a perda do corte. Vem da ficha tecnica da referencia';

alter table public.consumo_da_referencia drop constraint if exists consumo_tem_alguma_medida;
alter table public.consumo_da_referencia
  add constraint consumo_tem_alguma_medida
  check (metros is not null or quilos is not null or area is not null);

alter table public.consumo_da_referencia drop constraint if exists consumo_nao_e_negativo;
alter table public.consumo_da_referencia
  add constraint consumo_nao_e_negativo
  check (coalesce(metros, 0) >= 0 and coalesce(quilos, 0) >= 0 and coalesce(area, 0) >= 0);

/* A AREA VEM NA FRENTE QUANDO DA PARA CONVERTER. Ela e o numero da ficha
   tecnica, medido no molde: se existe e o tecido tem a medida que falta, e
   ela que vale. Onde nao ha area, ou o tecido nao tem largura ou gramatura,
   continua valendo o que estava cadastrado em metros e em quilos, do mesmo
   jeito de antes. Continua devolvendo nulo no que nao da para saber. */
create or replace function public.consumo_da_peca(
  p_referencia uuid,
  p_tamanho    text,
  p_tecido     uuid
) returns table (metros numeric, quilos numeric)
language sql
stable
as $$
  select
    coalesce(
      case when c.area is not null and t.largura > 0 then c.area / t.largura end,
      c.metros,
      case when c.quilos is not null and t.largura > 0 and t.gramatura > 0
           then c.quilos * 1000 / (t.largura * t.gramatura) end
    ),
    coalesce(
      case when c.area is not null and t.gramatura > 0 then c.area * t.gramatura / 1000 end,
      c.quilos,
      case when c.metros is not null and t.largura > 0 and t.gramatura > 0
           then c.metros * t.largura * t.gramatura / 1000 end
    )
  from public.consumo_da_referencia c
  left join public.tecido t on t.id = p_tecido
  where c.referencia_id = p_referencia and c.tamanho = p_tamanho
$$;
grant execute on function public.consumo_da_peca(uuid, text, uuid) to authenticated;


-- ---------- 7. a view da lista ----------------------------------------------
-- O que a sanfona precisa para dizer, sem abrir a ficha, o que ja foi
-- preenchido. Sem o molde: so se ele existe.
drop view if exists public.referencia_na_ficha;
create view public.referencia_na_ficha
with (security_invoker = true) as
select
  r.id, r.cod, r.nome, r.grupo, r.genero, r.ordem, r.ativo,
  r.detalhes, r.observacao, r.tamanhos, r.ficha_em,
  (select count(*) from public.medida_da_referencia m
    where m.referencia_id = r.id and m.valores <> '{}'::jsonb)::int as medidas,
  (select count(*) from public.parte_da_referencia p
    where p.referencia_id = r.id and p.quantidades <> '{}'::jsonb)::int as partes_com_tecido,
  (select count(*) from public.material_da_referencia a
    where a.referencia_id = r.id)::int as materiais,
  exists (select 1 from public.molde_da_referencia o where o.referencia_id = r.id) as tem_molde
from public.referencia r;

grant select on public.referencia_na_ficha to authenticated;


-- ---------- 8. a funcao que salva a ficha -----------------------------------
create or replace function public.tamanhos_da_fabrica()
returns text[]
language sql
immutable
as $$
  select array['PP','P','M','G','GG','XG','G1','G2','G3','G4','2A','4A','6A','8A','10A','12A','14A']
$$;
grant execute on function public.tamanhos_da_fabrica() to authenticated;

/* Confere um objeto de tamanho para numero: so tamanho da ficha, so numero,
   dentro da faixa. Devolve a mensagem do que esta errado, ou nulo. */
create or replace function public.erro_nos_valores_por_tamanho(
  p_valores  jsonb,
  p_tamanhos text[],
  p_teto     numeric,
  p_de_quem  text
) returns text
language plpgsql
immutable
as $$
declare
  k text;
  v jsonb;
begin
  if p_valores is null or jsonb_typeof(p_valores) <> 'object' then
    return format('Os números de "%s" vieram num formato que eu não entendo.', p_de_quem);
  end if;
  for k, v in select * from jsonb_each(p_valores) loop
    if not (k = any (p_tamanhos)) then
      return format('"%s" tem número no tamanho %s, que não está ligado na grade.', p_de_quem, k);
    end if;
    if jsonb_typeof(v) <> 'number' then
      return format('Em "%s", o tamanho %s não é um número.', p_de_quem, k);
    end if;
    if (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > p_teto then
      return format('Em "%s", o tamanho %s está fora da faixa (de 0 a %s).', p_de_quem, k, p_teto);
    end if;
  end loop;
  return null;
end $$;

create or replace function public.salvar_ficha_da_referencia(
  p_referencia uuid,
  p_ficha      jsonb
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  f        jsonb := coalesce(p_ficha, '{}'::jsonb);
  chave    text;
  tam      text[];
  det      jsonb;
  item     jsonb;
  nomes    text[];
  erro     text;
  i        int;
  t        text;
  soma     numeric;
  tem      boolean;
  agora    timestamptz := now();
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar a ficha técnica.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.referencia where id = p_referencia) then
    raise exception 'Referência não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(f) <> 'object' then
    raise exception 'A ficha veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  for chave in select jsonb_object_keys(f) loop
    if chave not in ('nome', 'detalhes', 'observacao', 'tamanhos', 'medidas', 'partes', 'materiais') then
      raise exception 'Não sei guardar "%" na ficha técnica.', chave using errcode = '22023';
    end if;
  end loop;
  /* A FICHA VEM INTEIRA. Faltar um pedaco apagaria esse pedaco em silencio */
  if not (f ?& array['nome', 'detalhes', 'observacao', 'tamanhos', 'medidas', 'partes', 'materiais']) then
    raise exception 'A ficha veio incompleta, e eu não gravo ficha pela metade.' using errcode = '22023';
  end if;

  if jsonb_typeof(f -> 'nome') <> 'string' or btrim(f ->> 'nome') = '' then
    raise exception 'A referência precisa de um nome.' using errcode = '23514';
  end if;
  if char_length(f ->> 'nome') > 120 then
    raise exception 'O nome da referência passa de 120 letras.' using errcode = '23514';
  end if;
  if jsonb_typeof(f -> 'observacao') <> 'string' or char_length(f ->> 'observacao') > 2000 then
    raise exception 'A observação é um texto de até 2.000 letras.' using errcode = '23514';
  end if;

  /* --- a grade --- */
  if jsonb_typeof(f -> 'tamanhos') <> 'array' then
    raise exception 'A grade veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  tam := array(select jsonb_array_elements_text(f -> 'tamanhos'));
  if cardinality(tam) = 0 then
    raise exception 'Ligue pelo menos um tamanho na grade.' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(tam) x where not (x = any (public.tamanhos_da_fabrica()))) then
    raise exception 'A grade tem um tamanho que a fábrica não usa.' using errcode = '23514';
  end if;
  if (select count(distinct x) from unnest(tam) x) <> cardinality(tam) then
    raise exception 'A grade tem tamanho repetido.' using errcode = '23514';
  end if;
  /* na ordem da fabrica, venha como vier */
  tam := array(select x from unnest(public.tamanhos_da_fabrica()) with ordinality as o(x, n)
                where x = any (tam) order by n);

  /* --- os detalhes --- */
  det := f -> 'detalhes';
  if jsonb_typeof(det) <> 'object' then
    raise exception 'Os detalhes vieram num formato que eu não entendo.' using errcode = '22023';
  end if;
  for chave in select jsonb_object_keys(det) loop
    if chave not in ('gola', 'manga', 'punho', 'barra', 'costura') then
      raise exception 'Não sei guardar o detalhe "%".', chave using errcode = '22023';
    end if;
    if jsonb_typeof(det -> chave) <> 'string' or char_length(det ->> chave) > 200 then
      raise exception 'O detalhe "%" é um texto de até 200 letras.', chave using errcode = '23514';
    end if;
  end loop;
  /* detalhe em branco nao fica guardado como texto vazio */
  det := coalesce((select jsonb_object_agg(k, btrim(v)) from jsonb_each_text(det) as d(k, v)
                    where btrim(v) <> ''), '{}'::jsonb);

  /* --- as medidas --- */
  if jsonb_typeof(f -> 'medidas') <> 'array' then
    raise exception 'A tabela de medidas veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(f -> 'medidas') > 40 then
    raise exception 'São muitas medidas. A tabela leva até 40.' using errcode = '23514';
  end if;
  nomes := '{}';
  for item in select * from jsonb_array_elements(f -> 'medidas') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'nome') <> 'string'
       or btrim(item ->> 'nome') = '' then
      raise exception 'Toda medida precisa de um nome.' using errcode = '23514';
    end if;
    if char_length(item ->> 'nome') > 60 or char_length(coalesce(item ->> 'como_medir', '')) > 120 then
      raise exception 'O nome da medida vai até 60 letras, e o "como medir" até 120.' using errcode = '23514';
    end if;
    if lower(btrim(item ->> 'nome')) = any (nomes) then
      raise exception 'A medida "%" está duas vezes na tabela.', btrim(item ->> 'nome') using errcode = '23505';
    end if;
    nomes := nomes || lower(btrim(item ->> 'nome'));
    erro := public.erro_nos_valores_por_tamanho(coalesce(item -> 'valores', '{}'::jsonb), tam, 999, btrim(item ->> 'nome'));
    if erro is not null then raise exception '%', erro using errcode = '23514'; end if;
  end loop;

  /* --- as partes do molde --- */
  if jsonb_typeof(f -> 'partes') <> 'array' then
    raise exception 'As partes do molde vieram num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(f -> 'partes') > 30 then
    raise exception 'São muitas partes. O molde leva até 30.' using errcode = '23514';
  end if;
  nomes := '{}';
  for item in select * from jsonb_array_elements(f -> 'partes') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'nome') <> 'string'
       or btrim(item ->> 'nome') = '' then
      raise exception 'Toda parte do molde precisa de um nome.' using errcode = '23514';
    end if;
    if char_length(item ->> 'nome') > 60 then
      raise exception 'O nome da parte vai até 60 letras.' using errcode = '23514';
    end if;
    if lower(btrim(item ->> 'nome')) = any (nomes) then
      raise exception 'A parte "%" está duas vezes no molde.', btrim(item ->> 'nome') using errcode = '23505';
    end if;
    nomes := nomes || lower(btrim(item ->> 'nome'));
    if coalesce(item ->> 'unidade', 'm2') not in ('m2', 'm') then
      raise exception 'A parte "%" tem uma unidade que eu não conheço.', btrim(item ->> 'nome') using errcode = '23514';
    end if;
    if jsonb_typeof(coalesce(item -> 'vezes', '1'::jsonb)) <> 'number'
       or (coalesce(item ->> 'vezes', '1'))::numeric not between 1 and 20
       or (coalesce(item ->> 'vezes', '1'))::numeric <> floor((coalesce(item ->> 'vezes', '1'))::numeric) then
      raise exception 'A parte "%" é cortada de 1 a 20 vezes.', btrim(item ->> 'nome') using errcode = '23514';
    end if;
    erro := public.erro_nos_valores_por_tamanho(coalesce(item -> 'quantidades', '{}'::jsonb), tam, 99, btrim(item ->> 'nome'));
    if erro is not null then raise exception '%', erro using errcode = '23514'; end if;
  end loop;

  /* --- os aviamentos e insumos --- */
  if jsonb_typeof(f -> 'materiais') <> 'array' then
    raise exception 'Os aviamentos vieram num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(f -> 'materiais') > 60 then
    raise exception 'São muitos aviamentos. A ficha leva até 60.' using errcode = '23514';
  end if;
  for item in select * from jsonb_array_elements(f -> 'materiais') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'nome') <> 'string'
       or btrim(item ->> 'nome') = '' then
      raise exception 'Todo aviamento precisa de um nome.' using errcode = '23514';
    end if;
    if char_length(item ->> 'nome') > 120 or char_length(coalesce(item ->> 'unidade', '')) > 12 then
      raise exception 'O nome do aviamento vai até 120 letras, e a unidade até 12.' using errcode = '23514';
    end if;
    if jsonb_typeof(item -> 'quantidade') is distinct from 'number'
       or (item ->> 'quantidade')::numeric <= 0 or (item ->> 'quantidade')::numeric > 99999 then
      raise exception 'Diga quanto de "%" vai em cada peça, em número maior que zero.', btrim(item ->> 'nome') using errcode = '23514';
    end if;
    if nullif(item ->> 'material_id', '') is not null
       and not exists (select 1 from public.material where id = (item ->> 'material_id')::uuid) then
      raise exception 'O material "%" não está mais no Estoque.', btrim(item ->> 'nome') using errcode = 'P0002';
    end if;
  end loop;

  /* --- tudo conferido: grava --- */
  update public.referencia
     set nome       = btrim(f ->> 'nome'),
         detalhes   = det,
         observacao = btrim(f ->> 'observacao'),
         tamanhos   = tam,
         ficha_em   = agora
   where id = p_referencia;

  delete from public.medida_da_referencia where referencia_id = p_referencia;
  i := 0;
  for item in select * from jsonb_array_elements(f -> 'medidas') loop
    insert into public.medida_da_referencia (referencia_id, nome, como_medir, ordem, valores)
    values (p_referencia, btrim(item ->> 'nome'), btrim(coalesce(item ->> 'como_medir', '')), i,
            coalesce(item -> 'valores', '{}'::jsonb));
    i := i + 1;
  end loop;

  delete from public.parte_da_referencia where referencia_id = p_referencia;
  i := 0;
  for item in select * from jsonb_array_elements(f -> 'partes') loop
    insert into public.parte_da_referencia (referencia_id, nome, vezes, unidade, ordem, quantidades)
    values (p_referencia, btrim(item ->> 'nome'), (coalesce(item ->> 'vezes', '1'))::int,
            coalesce(item ->> 'unidade', 'm2'), i, coalesce(item -> 'quantidades', '{}'::jsonb));
    i := i + 1;
  end loop;

  delete from public.material_da_referencia where referencia_id = p_referencia;
  i := 0;
  for item in select * from jsonb_array_elements(f -> 'materiais') loop
    insert into public.material_da_referencia (referencia_id, material_id, nome, quantidade, unidade, ordem)
    values (p_referencia, nullif(item ->> 'material_id', '')::uuid, btrim(item ->> 'nome'),
            (item ->> 'quantidade')::numeric, btrim(coalesce(item ->> 'unidade', '')), i);
    i := i + 1;
  end loop;

  /* --- a area da peca inteira vai para o consumo, que e de onde a reserva le.
     Tamanho sem nenhuma parte de pano preenchida fica sem area, e nao com zero:
     zero e um numero, e numero errado aqui vira compra errada --- */
  /* a linha que so tinha a area sai inteira: ela nao tem mais o que dizer, e
     ficar com as tres medidas nulas a regra da tabela nao deixa. A que tem
     metros ou quilos de antes continua, so sem a area */
  delete from public.consumo_da_referencia
   where referencia_id = p_referencia and metros is null and quilos is null;
  update public.consumo_da_referencia set area = null
   where referencia_id = p_referencia and area is not null;
  foreach t in array tam loop
    select coalesce(sum((p.quantidades ->> t)::numeric), 0), count(*) > 0
      into soma, tem
      from public.parte_da_referencia p
     where p.referencia_id = p_referencia and p.unidade = 'm2' and p.quantidades ? t;
    if tem and soma > 0 then
      insert into public.consumo_da_referencia (referencia_id, tamanho, area)
      values (p_referencia, t, soma)
      on conflict (referencia_id, tamanho) do update
        /* A LINHA QUE O ENSAIO SEMEOU VIRA DE VERDADE quando a ficha poe a
           area nela: o metro e o quilo inventados saem, e a marca de teste
           tambem. Sem isso a limpeza do ensaio levaria a area da ficha junto,
           e o quilo inventado continuaria valendo ao lado do numero medido */
        set area = excluded.area,
            metros = case when public.consumo_da_referencia.teste then null else public.consumo_da_referencia.metros end,
            quilos = case when public.consumo_da_referencia.teste then null else public.consumo_da_referencia.quilos end,
            teste = false,
            atualizado_em = now();
    end if;
  end loop;
  return agora;
end $$;

grant execute on function public.salvar_ficha_da_referencia(uuid, jsonb) to authenticated;


-- ---------- a funcao que salva o molde --------------------------------------
-- A parte da ficha, porque o desenho e grande e muda sozinho: trocar o SVG nao
-- e motivo para mandar a ficha inteira de novo. Nulo ou vazio tira o molde.
create or replace function public.salvar_molde_da_referencia(
  p_referencia uuid,
  p_svg        text,
  p_tamanho    text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tam text := coalesce(p_tamanho, '');
  svg text := btrim(coalesce(p_svg, ''));
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar o molde.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.referencia where id = p_referencia) then
    raise exception 'Referência não encontrada.' using errcode = 'P0002';
  end if;
  if tam <> '' and not (tam = any (public.tamanhos_da_fabrica())) then
    raise exception 'Esse tamanho a fábrica não usa.' using errcode = '23514';
  end if;

  if svg = '' then
    delete from public.molde_da_referencia where referencia_id = p_referencia and tamanho = tam;
    return false;
  end if;
  if svg !~* '<svg[\s>]' then
    raise exception 'O arquivo não é um SVG.' using errcode = '23514';
  end if;
  if char_length(svg) > 600000 then
    raise exception 'O SVG é grande demais. Exporte o molde sem imagem dentro.' using errcode = '23514';
  end if;
  /* DESENHO, E NAO PROGRAMA. Um SVG pode carregar script, e este vai ser
     mostrado na tela de quem abrir a ficha. A tela ja o mostra de um jeito que
     nao roda nada, e mesmo assim ele nao entra no banco com isso dentro */
  if svg ~* '<script|<foreignobject|javascript:|\son[a-z]+\s*=' then
    raise exception 'O SVG tem programa dentro (script ou evento). Exporte só o desenho.' using errcode = '23514';
  end if;

  insert into public.molde_da_referencia (referencia_id, tamanho, svg, atualizado_em)
  values (p_referencia, tam, svg, now())
  on conflict (referencia_id, tamanho) do update
    set svg = excluded.svg, atualizado_em = now();
  return true;
end $$;

grant execute on function public.salvar_molde_da_referencia(uuid, text, text) to authenticated;
