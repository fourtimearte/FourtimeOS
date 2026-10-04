-- ===========================================================================
-- 047: O DEPOSITO
--
-- Ate aqui o material dizia onde estava num campo de texto livre (onde_fica,
-- da 041): "prateleira 3", "armario do fundo". Texto livre nao se desenha, nao
-- se procura e cada pessoa escreve de um jeito. O Henrique pediu, em
-- 04/10/2026, o deposito visto de cima: o chao, as prateleiras, os paletes e a
-- escada, com o lugar de cada material marcado no desenho, e um editor para
-- ele mesmo montar e remontar esse desenho conforme o estoque for arrumado.
--
-- O QUE ENTRA:
--   1. o deposito: o chao, com largura e fundo em metros
--   2. o que esta no chao: prateleira, palete, escada e porta
--   3. o lugar de cada material: em qual prateleira (vao e nivel) ou palete
--   4. a view que a tela le
--   5. as duas funcoes: salvar o deposito inteiro e marcar o lugar
--
-- O DESENHO E GRAVADO INTEIRO, DE UMA VEZ. O editor manda o chao e tudo o que
-- esta nele, e a funcao troca o que mudou numa transacao so. Um desenho pela
-- metade (a prateleira nova entrou, o palete que saiu ficou) nao existe.
--
-- UM MATERIAL PODE ESTAR EM MAIS DE UM LUGAR, e um deles e o principal: e o
-- que a lista e a separacao mostram. O que nao coube na prateleira e foi para
-- um palete continua sendo o mesmo material.
--
-- NINGUEM PERDE O LUGAR SEM SABER. Apagar uma prateleira que tem material, ou
-- diminuir os vaos dela, deixaria material apontando para um lugar que nao
-- existe. A funcao recusa, a nao ser que quem salva diga que sabe (p_soltar):
-- ai o material fica sem lugar marcado, e nunca num lugar inventado.
--
-- TODA ESCRITA PASSA POR FUNCAO. As tres tabelas so tem grant de leitura. Quem
-- desenha o deposito e marca lugar e quem tem "editar" no Estoque, e quem
-- pergunta isso e a funcao, e nao a tela.
--
-- O onde_fica DA 041 FICA COMO ESTA: e o que a pessoa escreveu antes de o
-- deposito existir, e ninguem o apaga daqui.
-- ===========================================================================


-- ---------- 1. o deposito: o chao ------------------------------------------
create table if not exists public.deposito (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null default 'Depósito',
  -- em metros: largura e o lado que vai da esquerda para a direita do desenho
  largura        numeric(6,2) not null,
  fundo          numeric(6,2) not null,
  atualizado_por uuid references public.pessoa (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint deposito_nome_nao_vazio check (btrim(nome) <> ''),
  constraint deposito_medidas_que_cabem
    check (largura between 2 and 200 and fundo between 2 and 200)
);

comment on table public.deposito is
  'O chao do deposito de materiais, em metros. Hoje existe um so; a tela usa o mais antigo.';

drop trigger if exists deposito_carimbo on public.deposito;
create trigger deposito_carimbo
  before update on public.deposito
  for each row execute function public.carimbar_atualizacao();

alter table public.deposito enable row level security;
drop policy if exists "quem foi aprovado le o deposito" on public.deposito;
create policy "quem foi aprovado le o deposito"
  on public.deposito for select to authenticated
  using (public.meu_papel() is not null);
/* so leitura: quem grava e a funcao salvar_deposito */
grant select on public.deposito to authenticated;


-- ---------- 2. o que esta no chao ------------------------------------------
/* PRATELEIRA tem vaos (lado a lado, vistos de cima) e niveis (um em cima do
   outro, vistos de frente). PALETE e um lugar so. ESCADA e PORTA nao guardam
   nada: estao no desenho para a pessoa se achar.

   x e y sao o canto de cima, a esquerda, em metros a partir do canto do chao;
   largura e fundo sao o retangulo como ele aparece no desenho, ja girado.
   em_pe diz para que lado os vaos correm: de lado (falso) ou de cima para
   baixo (verdadeiro).

   grade junta os paletes que foram postos de uma vez: o editor mexe neles
   como um bloco so enquanto tiverem o mesmo numero. */
create table if not exists public.movel_do_deposito (
  id             uuid primary key default gen_random_uuid(),
  deposito_id    uuid not null references public.deposito (id) on delete cascade,
  tipo           text not null,
  nome           text not null,
  uso            text not null default '',
  x              numeric(6,2) not null,
  y              numeric(6,2) not null,
  largura        numeric(6,2) not null,
  fundo          numeric(6,2) not null,
  em_pe          boolean not null default false,
  vaos           smallint not null default 1,
  niveis         smallint not null default 1,
  nomes_dos_vaos text[] not null default '{}',
  grade          uuid,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint movel_tipo_conhecido check (tipo in ('prateleira', 'palete', 'escada', 'porta')),
  constraint movel_nome_nao_vazio check (btrim(nome) <> ''),
  constraint movel_medidas_positivas check (largura > 0 and fundo > 0 and x >= 0 and y >= 0),
  constraint movel_vaos_que_cabem check (vaos between 1 and 20),
  /* seis niveis: e quantas cores de nivel o Design System tem */
  constraint movel_niveis_que_cabem check (niveis between 1 and 6),
  /* so prateleira tem vao e nivel: nos outros o numero seria uma mentira */
  constraint movel_so_prateleira_tem_vaos
    check (tipo = 'prateleira' or (vaos = 1 and niveis = 1 and nomes_dos_vaos = '{}'))
);

comment on table public.movel_do_deposito is
  'O que esta desenhado no chao do deposito: prateleira (com vaos e niveis), palete, escada e porta.';

create index if not exists movel_por_deposito on public.movel_do_deposito (deposito_id);
create index if not exists movel_por_grade on public.movel_do_deposito (grade) where grade is not null;

drop trigger if exists movel_do_deposito_carimbo on public.movel_do_deposito;
create trigger movel_do_deposito_carimbo
  before update on public.movel_do_deposito
  for each row execute function public.carimbar_atualizacao();

alter table public.movel_do_deposito enable row level security;
drop policy if exists "quem foi aprovado le o que esta no deposito" on public.movel_do_deposito;
create policy "quem foi aprovado le o que esta no deposito"
  on public.movel_do_deposito for select to authenticated
  using (public.meu_papel() is not null);
/* so leitura: quem grava e a funcao salvar_deposito */
grant select on public.movel_do_deposito to authenticated;


-- ---------- 3. o lugar de cada material ------------------------------------
/* vao e nivel contam de 1. No palete os dois ficam vazios. Na prateleira o
   vao e obrigatorio e o nivel pode faltar: quem sabe so a prateleira e o vao
   ja ajuda quem procura.

   Apagar o movel apaga o lugar (cascade), mas ninguem apaga movel na mao: a
   funcao salvar_deposito e quem decide, e ela pergunta antes. */
create table if not exists public.lugar_do_material (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.material (id) on delete cascade,
  movel_id    uuid not null references public.movel_do_deposito (id) on delete cascade,
  vao         smallint,
  nivel       smallint,
  principal   boolean not null default false,
  criado_por  uuid default auth.uid() references public.pessoa (id) on delete set null,
  criado_em   timestamptz not null default now(),

  constraint lugar_vao_positivo check (vao is null or vao >= 1),
  constraint lugar_nivel_positivo check (nivel is null or nivel >= 1),
  constraint lugar_nivel_pede_vao check (nivel is null or vao is not null)
);

comment on table public.lugar_do_material is
  'Onde cada material esta guardado no deposito. Pode haver mais de um lugar; um e o principal.';

/* o mesmo material nao entra duas vezes no mesmo lugar */
create unique index if not exists lugar_do_material_unico
  on public.lugar_do_material (material_id, movel_id, coalesce(vao, 0), coalesce(nivel, 0));
/* e tem um principal so */
create unique index if not exists lugar_principal_unico
  on public.lugar_do_material (material_id) where principal;
create index if not exists lugar_por_movel on public.lugar_do_material (movel_id);

alter table public.lugar_do_material enable row level security;
drop policy if exists "quem foi aprovado le o lugar do material" on public.lugar_do_material;
create policy "quem foi aprovado le o lugar do material"
  on public.lugar_do_material for select to authenticated
  using (public.meu_papel() is not null);
/* so leitura: quem grava sao definir_lugares e salvar_deposito */
grant select on public.lugar_do_material to authenticated;


-- ---------- 4. a view que a tela le ----------------------------------------
/* O CODIGO e o que a pessoa le e fala: "D2-3" e a prateleira D, vao 2, nivel
   3; "P07" e o palete. O nome do vao e o que o editor guardou; se ele nao
   guardou nenhum, e o nome da prateleira com o numero do vao. */
create or replace view public.lugar_do_material_na_lista
with (security_invoker = true) as
select l.id,
       l.material_id,
       l.movel_id,
       mv.deposito_id,
       mv.tipo,
       mv.nome as movel,
       l.vao,
       case when l.vao is not null
            then coalesce(nullif(btrim(mv.nomes_dos_vaos[l.vao]), ''), mv.nome || l.vao::text)
       end as vao_nome,
       l.nivel,
       l.principal,
       case when l.vao is null then mv.nome
            else coalesce(nullif(btrim(mv.nomes_dos_vaos[l.vao]), ''), mv.nome || l.vao::text)
                 || coalesce('-' || l.nivel::text, '')
       end as codigo,
       l.criado_em
  from public.lugar_do_material l
  join public.movel_do_deposito mv on mv.id = l.movel_id;

grant select on public.lugar_do_material_na_lista to authenticated;


-- ---------- 5. as funcoes --------------------------------------------------

/* SALVAR O DEPOSITO INTEIRO.

   p_planta e o desenho como o editor o tem:
     { "nome": "...", "largura": 15, "fundo": 10,
       "moveis": [ { "id": "...", "tipo": "prateleira", "nome": "D", "uso": "Tecido",
                     "x": 0.25, "y": 2.2, "largura": 0.7, "fundo": 6, "em_pe": true,
                     "vaos": 4, "niveis": 4, "nomes_dos_vaos": ["D1","D2","D3","D4"],
                     "grade": null }, ... ] }

   O id de cada movel vem do editor: movel novo ja nasce com o id que a tela
   usou, e o que nao veio na lista saiu do desenho.

   A funcao confere o que a tela tambem confere, porque a trava mora aqui:
   tudo cabe dentro do chao, todo lugar tem nome, e nenhum nome se repete (o
   nome e o codigo que a pessoa procura; dois "D2" seriam dois lugares que
   ninguem distingue).

   Devolve o id do deposito. */
create or replace function public.salvar_deposito(
  p_planta jsonb,
  p_soltar boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d        uuid;
  larg     numeric(6,2);
  fund     numeric(6,2);
  nom      text := btrim(coalesce(p_planta ->> 'nome', ''));
  itens    jsonb := coalesce(p_planta -> 'moveis', '[]'::jsonb);
  it       jsonb;
  ids      uuid[] := array[]::uuid[];
  codigos  text[] := array[]::text[];
  cod      text;
  vid      uuid;
  vtipo    text;
  vnome    text;
  vx       numeric(6,2);
  vy       numeric(6,2);
  vl       numeric(6,2);
  vf       numeric(6,2);
  vvaos    smallint;
  vniveis  smallint;
  vnomes   text[];
  i        int;
  perdidos int;
begin
  if not public.posso('estoque', 'editar') then
    raise exception 'Seu acesso não permite editar o depósito.' using errcode = '42501';
  end if;
  if jsonb_typeof(itens) <> 'array' then
    raise exception 'O desenho do depósito veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  begin
    larg := (p_planta ->> 'largura')::numeric;
    fund := (p_planta ->> 'fundo')::numeric;
  exception when others then
    raise exception 'A largura e o fundo do depósito precisam ser números.' using errcode = '22023';
  end;
  if larg is null or fund is null or larg < 2 or larg > 200 or fund < 2 or fund > 200 then
    raise exception 'O chão do depósito precisa ter de 2 a 200 metros de cada lado.' using errcode = '23514';
  end if;
  if nom = '' then
    nom := 'Depósito';
  end if;

  /* primeira passada: conferir tudo antes de mexer em qualquer coisa */
  for it in select * from jsonb_array_elements(itens) loop
    begin
      vid := (it ->> 'id')::uuid;
      vx := (it ->> 'x')::numeric;
      vy := (it ->> 'y')::numeric;
      vl := (it ->> 'largura')::numeric;
      vf := (it ->> 'fundo')::numeric;
      vvaos := coalesce((it ->> 'vaos')::smallint, 1);
      vniveis := coalesce((it ->> 'niveis')::smallint, 1);
    exception when others then
      raise exception 'Uma peça do desenho veio com medida que não é número.' using errcode = '22023';
    end;
    vtipo := it ->> 'tipo';
    vnome := btrim(coalesce(it ->> 'nome', ''));
    if vid is null then
      raise exception 'Uma peça do desenho veio sem identificação.' using errcode = '22023';
    end if;
    if vid = any (ids) then
      raise exception 'A mesma peça veio duas vezes no desenho.' using errcode = '23505';
    end if;
    ids := ids || vid;
    if vtipo is null or vtipo not in ('prateleira', 'palete', 'escada', 'porta') then
      raise exception 'Tipo de peça desconhecido no desenho.' using errcode = '22023';
    end if;
    if vnome = '' then
      raise exception 'Toda peça do depósito precisa de um nome.' using errcode = '23514';
    end if;
    if vx is null or vy is null or vl is null or vf is null or vl <= 0 or vf <= 0 or vx < 0 or vy < 0 then
      raise exception '% está com medida inválida.', vnome using errcode = '23514';
    end if;
    if vx + vl > larg + 0.001 or vy + vf > fund + 0.001 then
      raise exception '% está fora do chão do depósito.', vnome using errcode = '23514';
    end if;

    if vtipo = 'prateleira' then
      if vvaos < 1 or vvaos > 20 then
        raise exception 'A prateleira % precisa ter de 1 a 20 vãos.', vnome using errcode = '23514';
      end if;
      if vniveis < 1 or vniveis > 6 then
        raise exception 'A prateleira % precisa ter de 1 a 6 níveis.', vnome using errcode = '23514';
      end if;
      vnomes := array(select btrim(coalesce(v, '')) from jsonb_array_elements_text(coalesce(it -> 'nomes_dos_vaos', '[]'::jsonb)) as v);
      for i in 1 .. vvaos loop
        cod := lower(coalesce(nullif(vnomes[i], ''), vnome || i::text));
        if cod = any (codigos) then
          raise exception 'O nome % aparece em mais de um lugar do depósito.', upper(cod) using errcode = '23505';
        end if;
        codigos := codigos || cod;
      end loop;
    elsif vtipo = 'palete' then
      cod := lower(vnome);
      if cod = any (codigos) then
        raise exception 'O nome % aparece em mais de um lugar do depósito.', vnome using errcode = '23505';
      end if;
      codigos := codigos || cod;
    end if;
  end loop;

  select id into d from public.deposito order by criado_em, id limit 1;

  /* quem perderia o lugar: o movel saiu do desenho, ou o vao ou o nivel
     marcado deixou de existir */
  if d is not null then
    select count(distinct l.material_id) into perdidos
      from public.lugar_do_material l
      join public.movel_do_deposito mv on mv.id = l.movel_id
      left join lateral (
        select coalesce((e ->> 'vaos')::int, 1) as vaos,
               coalesce((e ->> 'niveis')::int, 1) as niveis,
               e ->> 'tipo' as tipo
          from jsonb_array_elements(itens) as e
         where (e ->> 'id')::uuid = l.movel_id
      ) novo on true
     where mv.deposito_id = d
       and (novo.tipo is null
            or novo.tipo not in ('prateleira', 'palete')
            or (novo.tipo = 'palete' and l.vao is not null)
            or (novo.tipo = 'prateleira' and (l.vao is null or l.vao > novo.vaos or coalesce(l.nivel, 1) > novo.niveis)));
    if perdidos > 0 and not coalesce(p_soltar, false) then
      raise exception 'Com esta mudança % ficariam sem lugar marcado. Confirme antes de salvar.',
        case when perdidos = 1 then '1 material' else perdidos || ' materiais' end
        using errcode = 'P0001';
    end if;
  end if;

  if d is null then
    insert into public.deposito (nome, largura, fundo, atualizado_por)
    values (nom, larg, fund, auth.uid())
    returning id into d;
  else
    update public.deposito
       set nome = nom, largura = larg, fundo = fund, atualizado_por = auth.uid()
     where id = d;
  end if;

  /* o lugar que deixou de existir sai junto com a mudanca */
  delete from public.lugar_do_material l
   using public.movel_do_deposito mv
   where mv.id = l.movel_id
     and mv.deposito_id = d
     and exists (
       select 1 from jsonb_array_elements(itens) as e
        where (e ->> 'id')::uuid = l.movel_id
          and ((e ->> 'tipo') not in ('prateleira', 'palete')
               or ((e ->> 'tipo') = 'palete' and l.vao is not null)
               or ((e ->> 'tipo') = 'prateleira'
                   and (l.vao is null
                        or l.vao > coalesce((e ->> 'vaos')::int, 1)
                        or coalesce(l.nivel, 1) > coalesce((e ->> 'niveis')::int, 1))))
     );
  delete from public.movel_do_deposito where deposito_id = d and not (id = any (ids));

  for it in select * from jsonb_array_elements(itens) loop
    vid := (it ->> 'id')::uuid;
    vtipo := it ->> 'tipo';
    vnome := btrim(it ->> 'nome');
    if vtipo = 'prateleira' then
      vvaos := coalesce((it ->> 'vaos')::smallint, 1);
      vniveis := coalesce((it ->> 'niveis')::smallint, 1);
      vnomes := array(select btrim(coalesce(v, '')) from jsonb_array_elements_text(coalesce(it -> 'nomes_dos_vaos', '[]'::jsonb)) as v);
      /* um nome por vao, sempre: o que veio vazio vira o nome da prateleira com o numero */
      vnomes := array(select coalesce(nullif(vnomes[n], ''), vnome || n::text) from generate_series(1, vvaos) as n);
    else
      vvaos := 1;
      vniveis := 1;
      vnomes := '{}';
    end if;

    insert into public.movel_do_deposito
      (id, deposito_id, tipo, nome, uso, x, y, largura, fundo, em_pe, vaos, niveis, nomes_dos_vaos, grade)
    values
      (vid, d, vtipo, vnome, btrim(coalesce(it ->> 'uso', '')),
       (it ->> 'x')::numeric, (it ->> 'y')::numeric, (it ->> 'largura')::numeric, (it ->> 'fundo')::numeric,
       coalesce((it ->> 'em_pe')::boolean, false), vvaos, vniveis, vnomes,
       case when vtipo = 'palete' then nullif(it ->> 'grade', '')::uuid end)
    on conflict (id) do update
      set tipo = excluded.tipo, nome = excluded.nome, uso = excluded.uso,
          x = excluded.x, y = excluded.y, largura = excluded.largura, fundo = excluded.fundo,
          em_pe = excluded.em_pe, vaos = excluded.vaos, niveis = excluded.niveis,
          nomes_dos_vaos = excluded.nomes_dos_vaos, grade = excluded.grade
      where movel_do_deposito.deposito_id = d;
    if not found then
      /* o id ja existe em outro deposito: nao e deste desenho */
      raise exception 'Uma peça do desenho pertence a outro depósito.' using errcode = '23505';
    end if;
  end loop;

  /* quem perdeu o lugar principal e ainda tem outro: o mais antigo assume */
  update public.lugar_do_material l
     set principal = true
   where l.id in (
     select distinct on (x.material_id) x.id
       from public.lugar_do_material x
      where not exists (select 1 from public.lugar_do_material p
                         where p.material_id = x.material_id and p.principal)
      order by x.material_id, x.criado_em, x.id
   );

  return d;
end $$;

grant execute on function public.salvar_deposito(jsonb, boolean) to authenticated;


/* MARCAR ONDE O MATERIAL ESTA.

   Troca todos os lugares dos materiais de p_materiais pelos de p_lugares, na
   ordem em que vieram: o primeiro e o principal. Lista vazia tira o lugar.

   p_lugares: [ { "movel": "<id>", "vao": 2, "nivel": 3 }, { "movel": "<id do palete>" } ]

   Vale para um material (a ficha) e para varios de uma vez (a tabela, em
   lote). Devolve quantos materiais foram marcados. */
create or replace function public.definir_lugares(
  p_materiais uuid[],
  p_lugares   jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  lugares jsonb := coalesce(p_lugares, '[]'::jsonb);
  it      jsonb;
  mv      public.movel_do_deposito;
  vvao    smallint;
  vnivel  smallint;
  primeiro boolean;
  m       uuid;
  n       int := 0;
begin
  if not public.posso('estoque', 'editar') then
    raise exception 'Seu acesso não permite marcar o lugar dos materiais.' using errcode = '42501';
  end if;
  if p_materiais is null or cardinality(p_materiais) = 0 then
    raise exception 'Escolha pelo menos um material.' using errcode = '22023';
  end if;
  if jsonb_typeof(lugares) <> 'array' then
    raise exception 'A lista de lugares veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(lugares) > 6 then
    raise exception 'Um material cabe em até 6 lugares.' using errcode = '23514';
  end if;

  /* conferir os lugares uma vez, antes de mexer */
  for it in select * from jsonb_array_elements(lugares) loop
    select * into mv from public.movel_do_deposito where id = nullif(it ->> 'movel', '')::uuid;
    if not found then
      raise exception 'Este lugar não existe mais no depósito.' using errcode = 'P0002';
    end if;
    vvao := (it ->> 'vao')::smallint;
    vnivel := (it ->> 'nivel')::smallint;
    if mv.tipo = 'palete' then
      if vvao is not null or vnivel is not null then
        raise exception 'Palete não tem vão nem nível.' using errcode = '23514';
      end if;
    elsif mv.tipo = 'prateleira' then
      if vvao is null or vvao < 1 or vvao > mv.vaos then
        raise exception 'A prateleira % tem % vãos: escolha um deles.', mv.nome, mv.vaos using errcode = '23514';
      end if;
      if vnivel is not null and (vnivel < 1 or vnivel > mv.niveis) then
        raise exception 'A prateleira % tem % níveis: escolha um deles.', mv.nome, mv.niveis using errcode = '23514';
      end if;
    else
      raise exception 'Ali não se guarda material.' using errcode = '23514';
    end if;
  end loop;

  foreach m in array p_materiais loop
    if not exists (select 1 from public.material where id = m) then
      raise exception 'Material não encontrado.' using errcode = 'P0002';
    end if;
    delete from public.lugar_do_material where material_id = m;
    primeiro := true;
    for it in select * from jsonb_array_elements(lugares) loop
      insert into public.lugar_do_material (material_id, movel_id, vao, nivel, principal)
      values (m, (it ->> 'movel')::uuid, (it ->> 'vao')::smallint, (it ->> 'nivel')::smallint, primeiro)
      on conflict (material_id, movel_id, (coalesce(vao, 0)), (coalesce(nivel, 0))) do nothing;
      primeiro := false;
    end loop;
    n := n + 1;
  end loop;

  return n;
end $$;

grant execute on function public.definir_lugares(uuid[], jsonb) to authenticated;
