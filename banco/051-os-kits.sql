-- ===========================================================================
-- 051: OS KITS
--
-- A segunda parte da pagina Fichas tecnicas (wireframe de 05/10/2026, pranchas
-- 60 e 61): o kit, que junta duas ou mais referencias numa ficha de fabricacao
-- so. E o que o vendedor oferece no funil: camiseta e calcao, agasalho.
--
-- O KIT JA EXISTIA COMO REFERENCIA. No catalogo ha um grupo KIT, e o codigo
-- dele e feito do codigo das pecas: FT-KIT-020-000M-090-000M e o raglan
-- 020-000M com o calcao 090-000M. O que faltava era dizer isso em tabela, e
-- guardar o que e do kit e nao de cada peca.
--
-- O QUE E DO KIT, E O QUE E DA PECA. A gola, a manga, o punho, a barra e a
-- costura sao da referencia (050): a mesma camiseta nao tem outra gola por
-- estar num kit, e gola V e outra referencia. O que o kit guarda, peca por
-- peca, e o que muda de kit para kit: o papel da peca (parte de cima, parte
-- de baixo), os TECIDOS de cada parte do molde, o design impresso e onde vai,
-- a etiqueta e a observacao para a fabrica.
--
-- MAIS DE UM TECIDO POR PECA, por pedido do Henrique em 05/10/2026: "algumas
-- de nossas pecas esportivas vai com mais de um tecido na peca". Por isso o
-- tecido e uma lista de parte do molde e tecido, e cada parte usa um so.
--
-- A ETIQUETA MORA AQUI, tambem por decisao dele: e caso a caso (silk, DTF ou
-- sublimacao). Ela e o padrao do kit; o orcamento pode trocar.
--
-- AS PECAS DE UM KIT NAO MUDAM DEPOIS DE CRIADO. O codigo do kit e feito do
-- codigo das pecas, e codigo nao muda (008): ele ja pode estar em orcamento.
-- Kit com outras pecas e outro kit.
--
-- O QUE ENTRA:
--   1. a tabela das pecas do kit, com a ficha de fabricacao de cada uma
--   2. a view da lista de kits, e a das pecas (que tambem responde em que
--      kits uma referencia entra)
--   3. a funcao que cria e salva o kit inteiro, de uma vez
--   4. as pecas dos kits que ja estavam no catalogo, lidas do codigo
-- ===========================================================================


-- ---------- 0. o grupo dos kits ----------------------------------------------
-- Ja existe em producao desde o catalogo; aqui so garante, para a base nova.
insert into public.grupo_de_referencia (cod, nome, ordem)
values ('KIT', 'Kits (conjuntos)', 990)
on conflict (cod) do nothing;


-- ---------- 1. as pecas do kit ------------------------------------------------
create table if not exists public.peca_do_kit (
  id            uuid primary key default gen_random_uuid(),
  kit_id        uuid not null references public.referencia (id) on delete cascade,
  /* a peca apagada sai do kit junto: o wireframe avisa isso na hora de excluir */
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  papel         text not null default '',
  ordem         int  not null default 0,
  /* [{ "parte": "Frente e costas", "tecido_id": "...", "tecido": "DRYFIT" }] */
  tecidos       jsonb not null default '[]'::jsonb,
  /* [{ "tecnica": "subli", "onde": "peca inteira" }] */
  design        jsonb not null default '[]'::jsonb,
  /* '' ainda nao escolhida; silk, dtf, subli; sem = o kit vai sem etiqueta */
  etiqueta      text not null default '',
  etiqueta_onde text not null default '',
  observacao    text not null default '',
  constraint peca_nao_repete_no_kit unique (kit_id, referencia_id),
  constraint peca_nao_e_o_proprio_kit check (kit_id <> referencia_id),
  constraint peca_tecidos_e_lista check (jsonb_typeof(tecidos) = 'array'),
  constraint peca_design_e_lista check (jsonb_typeof(design) = 'array'),
  constraint peca_etiqueta_conhecida check (etiqueta in ('', 'silk', 'dtf', 'subli', 'sem'))
);
create index if not exists peca_do_kit_por_kit on public.peca_do_kit (kit_id, ordem);
create index if not exists peca_do_kit_por_referencia on public.peca_do_kit (referencia_id);

comment on table public.peca_do_kit is
  'As pecas de um kit, com a ficha de fabricacao de cada uma dentro dele. Quem escreve e salvar_kit';

alter table public.peca_do_kit enable row level security;
drop policy if exists "quem foi aprovado le as pecas do kit" on public.peca_do_kit;
create policy "quem foi aprovado le as pecas do kit" on public.peca_do_kit
  for select to authenticated using (public.meu_papel() is not null);
/* sem regra de escrita, de proposito: so a funcao grava */
grant select on public.peca_do_kit to authenticated;


-- ---------- 2. as views -------------------------------------------------------
-- A lista de kits: o que a aba precisa para dizer, sem abrir, quantas pecas
-- tem e o que falta.
drop view if exists public.kit_na_ficha;
create view public.kit_na_ficha
with (security_invoker = true) as
select
  k.id, k.cod, k.nome, k.genero, k.ativo, k.ficha_em,
  (select count(*) from public.peca_do_kit p where p.kit_id = k.id)::int as pecas,
  coalesce((select array_agg(r.cod order by p.ordem, r.cod)
              from public.peca_do_kit p
              join public.referencia r on r.id = p.referencia_id
             where p.kit_id = k.id), '{}'::text[]) as pecas_cod,
  (select count(*) from public.peca_do_kit p
    where p.kit_id = k.id and p.tecidos = '[]'::jsonb)::int as pecas_sem_tecido,
  (select count(*) from public.peca_do_kit p
    where p.kit_id = k.id and p.etiqueta = '')::int as pecas_sem_etiqueta,
  exists (select 1 from public.molde_da_referencia o where o.referencia_id = k.id) as tem_desenho
from public.referencia k
where k.grupo = 'KIT';

grant select on public.kit_na_ficha to authenticated;

-- As pecas, com o que a tela precisa de cada uma. Filtrada pelo kit, e a
-- ficha do kit; filtrada pela referencia, responde em que kits a peca entra.
drop view if exists public.peca_do_kit_na_lista;
create view public.peca_do_kit_na_lista
with (security_invoker = true) as
select
  p.id, p.kit_id, k.cod as kit_cod, k.nome as kit_nome, k.ativo as kit_ativo,
  p.referencia_id, r.cod, r.nome, r.genero, r.grupo, r.detalhes, r.tamanhos,
  p.papel, p.ordem, p.tecidos, p.design, p.etiqueta, p.etiqueta_onde, p.observacao
from public.peca_do_kit p
join public.referencia k on k.id = p.kit_id
join public.referencia r on r.id = p.referencia_id;

grant select on public.peca_do_kit_na_lista to authenticated;


-- ---------- 3. a funcao que cria e salva o kit --------------------------------
-- p_kit nulo cria o kit; com o id, salva a ficha dele. O kit vem INTEIRO: o
-- nome e todas as pecas, cada uma com a sua ficha. Ou entra tudo, ou nada.
create or replace function public.salvar_kit(
  p_kit   uuid,
  p_ficha jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f        jsonb := coalesce(p_ficha, '{}'::jsonb);
  chave    text;
  item     jsonb;
  sub      jsonb;
  r        public.referencia;
  k        public.referencia;
  kit      uuid := p_kit;
  ids      uuid[] := '{}';
  cods     text[] := '{}';
  generos  text[] := '{}';
  nomes    text[];
  cod_novo text;
  gen      text;
  panos    jsonb;
  i        int := 0;
  pano_id  uuid;
  pano     text;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar a ficha do kit.' using errcode = '42501';
  end if;
  if jsonb_typeof(f) <> 'object' then
    raise exception 'O kit veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  for chave in select jsonb_object_keys(f) loop
    if chave not in ('nome', 'pecas') then
      raise exception 'Não sei guardar "%" no kit.', chave using errcode = '22023';
    end if;
  end loop;
  if not (f ?& array['nome', 'pecas']) then
    raise exception 'O kit veio incompleto, e eu não gravo kit pela metade.' using errcode = '22023';
  end if;
  if jsonb_typeof(f -> 'nome') <> 'string' or btrim(f ->> 'nome') = '' then
    raise exception 'O kit precisa de um nome.' using errcode = '23514';
  end if;
  if char_length(f ->> 'nome') > 120 then
    raise exception 'O nome do kit passa de 120 letras.' using errcode = '23514';
  end if;
  if jsonb_typeof(f -> 'pecas') <> 'array' then
    raise exception 'As peças do kit vieram num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(f -> 'pecas') < 2 then
    raise exception 'Um kit tem pelo menos duas peças.' using errcode = '23514';
  end if;
  if jsonb_array_length(f -> 'pecas') > 6 then
    raise exception 'São muitas peças. O kit leva até 6.' using errcode = '23514';
  end if;

  /* --- cada peca: existe, nao e kit, nao repete, e a ficha dela esta inteira --- */
  for item in select * from jsonb_array_elements(f -> 'pecas') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'referencia_id') <> 'string'
       or (item ->> 'referencia_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Uma peça do kit veio sem a referência.' using errcode = '22023';
    end if;
    select * into r from public.referencia where id = (item ->> 'referencia_id')::uuid;
    if not found then
      raise exception 'Uma das peças não está mais no cadastro de referências.' using errcode = 'P0002';
    end if;
    if r.grupo is not distinct from 'KIT' then
      raise exception '"%" é um kit, e kit não entra dentro de kit.', r.nome using errcode = '23514';
    end if;
    if r.cod = '' then
      raise exception '"%" está sem código, e o código do kit é feito do código das peças.', r.nome using errcode = '23514';
    end if;
    if r.id = any (ids) then
      raise exception '"%" está duas vezes no kit.', r.nome using errcode = '23505';
    end if;
    ids := ids || r.id;
    cods := cods || r.cod;
    generos := generos || r.genero;

    if char_length(coalesce(item ->> 'papel', '')) > 40 then
      raise exception 'Em "%", o papel no kit passa de 40 letras.', r.nome using errcode = '23514';
    end if;

    /* os tecidos: cada parte do molde com um tecido so */
    if jsonb_typeof(coalesce(item -> 'tecidos', '[]'::jsonb)) <> 'array' then
      raise exception 'Em "%", os tecidos vieram num formato que eu não entendo.', r.nome using errcode = '22023';
    end if;
    if jsonb_array_length(coalesce(item -> 'tecidos', '[]'::jsonb)) > 12 then
      raise exception 'Em "%", são muitos tecidos. A peça leva até 12.', r.nome using errcode = '23514';
    end if;
    nomes := '{}';
    for sub in select * from jsonb_array_elements(coalesce(item -> 'tecidos', '[]'::jsonb)) loop
      if jsonb_typeof(sub) <> 'object' or btrim(coalesce(sub ->> 'parte', '')) = '' then
        raise exception 'Em "%", diga a que parte do molde cada tecido pertence.', r.nome using errcode = '23514';
      end if;
      if char_length(sub ->> 'parte') > 60 then
        raise exception 'Em "%", o nome da parte passa de 60 letras.', r.nome using errcode = '23514';
      end if;
      if lower(btrim(sub ->> 'parte')) = any (nomes) then
        raise exception 'Em "%", a parte "%" está com dois tecidos. Cada parte usa um só.', r.nome, btrim(sub ->> 'parte') using errcode = '23505';
      end if;
      nomes := nomes || lower(btrim(sub ->> 'parte'));
      if coalesce(sub ->> 'tecido_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (select 1 from public.tecido where id = (sub ->> 'tecido_id')::uuid) then
        raise exception 'Em "%", escolha o tecido de "%" no catálogo.', r.nome, btrim(sub ->> 'parte') using errcode = '23514';
      end if;
    end loop;

    /* o design impresso: a tecnica e onde ela vai */
    if jsonb_typeof(coalesce(item -> 'design', '[]'::jsonb)) <> 'array' then
      raise exception 'Em "%", o design impresso veio num formato que eu não entendo.', r.nome using errcode = '22023';
    end if;
    nomes := '{}';
    for sub in select * from jsonb_array_elements(coalesce(item -> 'design', '[]'::jsonb)) loop
      if jsonb_typeof(sub) <> 'object'
         or coalesce(sub ->> 'tecnica', '') not in ('subli', 'dtf', 'silk', 'bordado', 'patch') then
        raise exception 'Em "%", há uma técnica de impressão que eu não conheço.', r.nome using errcode = '23514';
      end if;
      if (sub ->> 'tecnica') = any (nomes) then
        raise exception 'Em "%", a mesma técnica está duas vezes.', r.nome using errcode = '23505';
      end if;
      nomes := nomes || (sub ->> 'tecnica');
      if char_length(coalesce(sub ->> 'onde', '')) > 120 then
        raise exception 'Em "%", o "onde vai" passa de 120 letras.', r.nome using errcode = '23514';
      end if;
    end loop;

    if coalesce(item ->> 'etiqueta', '') not in ('', 'silk', 'dtf', 'subli', 'sem') then
      raise exception 'Em "%", a etiqueta é silk, DTF, sublimação ou nenhuma.', r.nome using errcode = '23514';
    end if;
    if char_length(coalesce(item ->> 'etiqueta_onde', '')) > 120 then
      raise exception 'Em "%", o lugar da etiqueta passa de 120 letras.', r.nome using errcode = '23514';
    end if;
    if char_length(coalesce(item ->> 'observacao', '')) > 2000 then
      raise exception 'Em "%", a observação passa de 2.000 letras.', r.nome using errcode = '23514';
    end if;
  end loop;

  /* --- o codigo: FT-KIT e o codigo de cada peca, sem o FT- da frente --- */
  select 'FT-KIT-' || string_agg(regexp_replace(c, '^FT-', ''), '-' order by n)
    into cod_novo
    from unnest(cods) with ordinality as x(c, n);

  if p_kit is null then
    /* criar kit e mexer no cadastro de referencias, que so a chefia mexe (008) */
    if public.meu_papel() not in ('admin', 'gerente') then
      raise exception 'Só administrador e gerente criam kit.' using errcode = '42501';
    end if;
    select * into k from public.referencia where cod = cod_novo limit 1;
    if found then
      raise exception 'Já existe um kit com estas peças, nesta ordem: %.', k.nome using errcode = '23505';
    end if;
    /* o genero do kit e o das pecas quando todas concordam; senao, unissex */
    select case when count(distinct g) = 1 then min(g) else 'U' end into gen from unnest(generos) g;
    insert into public.referencia (cod, nome, grupo, genero, ficha_em)
    values (cod_novo, btrim(f ->> 'nome'), 'KIT', coalesce(nullif(gen, ''), 'U'), now())
    returning id into kit;
  else
    select * into k from public.referencia where id = p_kit;
    if not found or k.grupo is distinct from 'KIT' then
      raise exception 'Kit não encontrado.' using errcode = 'P0002';
    end if;
    if k.cod <> cod_novo then
      raise exception 'As peças de um kit não mudam depois de criado: o código dele é feito delas. Para outras peças, crie outro kit.' using errcode = '23514';
    end if;
    update public.referencia set nome = btrim(f ->> 'nome'), ficha_em = now() where id = p_kit;
  end if;

  /* --- tudo conferido: grava --- */
  delete from public.peca_do_kit where kit_id = kit;
  for item in select * from jsonb_array_elements(f -> 'pecas') loop
    /* o nome do tecido vai junto, do catalogo: se o tecido sair do catalogo, a ficha ainda diz qual era */
    panos := '[]'::jsonb;
    for sub in select * from jsonb_array_elements(coalesce(item -> 'tecidos', '[]'::jsonb)) loop
      pano_id := (sub ->> 'tecido_id')::uuid;
      select nome into pano from public.tecido where id = pano_id;
      panos := panos || jsonb_build_array(jsonb_build_object(
        'parte', btrim(sub ->> 'parte'), 'tecido_id', pano_id, 'tecido', pano));
    end loop;
    insert into public.peca_do_kit
      (kit_id, referencia_id, papel, ordem, tecidos, design, etiqueta, etiqueta_onde, observacao)
    values (
      kit, (item ->> 'referencia_id')::uuid, btrim(coalesce(item ->> 'papel', '')), i, panos,
      coalesce((select jsonb_agg(jsonb_build_object('tecnica', d ->> 'tecnica', 'onde', btrim(coalesce(d ->> 'onde', ''))))
                  from jsonb_array_elements(coalesce(item -> 'design', '[]'::jsonb)) d), '[]'::jsonb),
      coalesce(item ->> 'etiqueta', ''), btrim(coalesce(item ->> 'etiqueta_onde', '')),
      btrim(coalesce(item ->> 'observacao', '')));
    i := i + 1;
  end loop;
  return kit;
end $$;

grant execute on function public.salvar_kit(uuid, jsonb) to authenticated;


-- ---------- 4. os kits que ja estavam no catalogo -----------------------------
-- O codigo do kit diz as pecas: FT-KIT-020-000M-090-000M. Quem ja estava no
-- grupo KIT ganha as suas pecas lidas dali, a primeira como parte de cima e a
-- segunda como parte de baixo. So entra o kit em que TODAS as pecas do codigo
-- existem, uma vez cada: kit pela metade nao e kit.
do $$
declare
  k     record;
  pecas text[];
  achou int;
begin
  for k in
    select r.id, r.cod from public.referencia r
     where r.grupo = 'KIT' and r.cod ~ '^FT-KIT(-[0-9]{3}-[0-9]{3}[A-Z])+$'
       and not exists (select 1 from public.peca_do_kit p where p.kit_id = r.id)
  loop
    select array_agg('FT-' || m[1] order by n) into pecas
      from regexp_matches(k.cod, '([0-9]{3}-[0-9]{3}[A-Z])', 'g') with ordinality as x(m, n);
    select count(*) into achou from (
      select c from unnest(pecas) c
       where (select count(*) from public.referencia r
               where r.cod = c and r.grupo is distinct from 'KIT') = 1
    ) certas;
    if achou = cardinality(pecas) and cardinality(pecas) >= 2
       and cardinality(pecas) = (select count(distinct c) from unnest(pecas) c) then
      insert into public.peca_do_kit (kit_id, referencia_id, papel, ordem)
      select k.id, r.id,
             case x.n when 1 then 'Parte de cima' when 2 then 'Parte de baixo' else 'Acessório' end,
             (x.n - 1)::int
        from unnest(pecas) with ordinality as x(c, n)
        join public.referencia r on r.cod = x.c and r.grupo is distinct from 'KIT';
    end if;
  end loop;
end $$;
