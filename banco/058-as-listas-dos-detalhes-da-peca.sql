-- ===========================================================================
-- 058: AS LISTAS DOS DETALHES DA PECA, E O KIT QUE ESCOLHE POR CIMA DA REFERENCIA
--
-- Dois pedidos do Henrique em 07/10/2026.
--
-- 1. AS LISTAS. "Na referencia, o detalhes de peca onde usa dropdown, quero um
--    editor onde eu possa adicionar itens para esses detalhes de peca em cada
--    dropdown." Gola, manga, punho, barra e costura eram texto livre (050),
--    porque as listas nao estavam definidas. Agora cada detalhe tem a sua
--    lista, e a lista e dele: acrescenta, muda o nome, muda a ordem e tira
--    (wireframe, pranchas 113 e 114).
--
-- 2. O KIT ESCOLHE POR CIMA. "O kit pode dar override nos detalhes da
--    referencia, e por isso que sinto falta da opcao de escolher os detalhes da
--    peca." Ate aqui a gola era so da referencia (051): o kit so lia. Agora
--    cada peca do kit pode dizer a sua gola, manga, punho, barra e costura. Em
--    branco, vale o que a referencia diz.
--
-- O QUE FICA GUARDADO E O TEXTO, como sempre foi. referencia.detalhes continua
-- sendo { "gola": "Redonda" }, e peca_do_kit.detalhes nasce igual. A lista e o
-- catalogo dos nomes que se pode escolher. Por isso:
--   mudar o nome de um item muda o texto nas referencias e nos kits que o usam;
--   tirar um item da lista nao apaga nada: o texto continua onde estava, e o
--   item so deixa de aparecer para escolher;
--   nada do que ja foi digitado se perde, e a folha impressa nao muda.
--
-- AS LISTAS NASCEM DO QUE JA ESTA ESCRITO. Cada texto que alguma referencia ja
-- usa vira um item da lista do detalhe dele, do mais usado para o menos usado.
-- Nenhum item e inventado: lista de detalhe sem uso nenhum nasce vazia.
--
-- O QUE ENTRA:
--   1. a tabela item_de_detalhe, e os itens que ja estao em uso
--   2. a view item_de_detalhe_na_lista, com quantas referencias e quantas
--      pecas de kit usam cada item
--   3. adicionar_item_de_detalhe (o "Adicionar" de dentro da lista) e
--      salvar_listas_de_detalhe (o editor das listas, tudo de uma vez)
--   4. peca_do_kit.detalhes, a view das pecas com a coluna nova, e o
--      salvar_kit, que passa a gravar os detalhes de cada peca
--
-- O salvar_kit e a funcao da 051, igual, mais os detalhes. Ela vem inteira
-- porque funcao nao se emenda: se troca. A assinatura nao muda.
--
-- A tela que esta no ar hoje continua funcionando: ela nao manda os detalhes
-- do kit (ficam vazios, que e "vale o da referencia") e nao le as listas.
--
-- Rodar de novo nao muda nada.
-- ===========================================================================


-- ---------- 1. a lista de cada detalhe ----------------------------------------
create table if not exists public.item_de_detalhe (
  id        uuid primary key default gen_random_uuid(),
  detalhe   text not null,
  nome      text not null,
  ordem     int  not null default 0,
  criado_em timestamptz not null default now(),
  constraint item_de_detalhe_conhecido check (detalhe in ('gola', 'manga', 'punho', 'barra', 'costura')),
  constraint item_de_detalhe_com_nome check (btrim(nome) <> '' and char_length(nome) <= 200)
);
/* o mesmo nome nao entra duas vezes na mesma lista, escreva como escrever */
create unique index if not exists item_de_detalhe_nome_unico
  on public.item_de_detalhe (detalhe, lower(nome));

comment on table public.item_de_detalhe is
  'A lista de cada detalhe da peca (gola, manga, punho, barra, costura). E o catalogo dos nomes: o que a referencia e o kit guardam e o texto.';

alter table public.item_de_detalhe enable row level security;
drop policy if exists "quem foi aprovado le as listas de detalhe" on public.item_de_detalhe;
create policy "quem foi aprovado le as listas de detalhe" on public.item_de_detalhe
  for select to authenticated using (public.meu_papel() is not null);
/* sem regra de escrita, de proposito: so as duas funcoes gravam */
grant select on public.item_de_detalhe to authenticated;

/* os itens que ja estao em uso: cada texto que alguma referencia tem, do mais
   usado para o menos usado. Quem ja esta na lista fica como esta. */
insert into public.item_de_detalhe (detalhe, nome, ordem)
select d.chave, x.nome,
       (row_number() over (partition by d.chave order by x.usos desc, lower(x.nome)))::int - 1
  from (values ('gola'), ('manga'), ('punho'), ('barra'), ('costura')) as d(chave)
 cross join lateral (
        select min(btrim(r.detalhes ->> d.chave)) as nome, count(*) as usos
          from public.referencia r
         where r.grupo is distinct from 'KIT'
           and btrim(coalesce(r.detalhes ->> d.chave, '')) <> ''
         group by lower(btrim(r.detalhes ->> d.chave))
       ) x
on conflict (detalhe, lower(nome)) do nothing;


-- ---------- 2. o que o kit escolhe por cima da referencia ----------------------
alter table public.peca_do_kit add column if not exists detalhes jsonb not null default '{}'::jsonb;

comment on column public.peca_do_kit.detalhes is
  'Gola, manga, punho, barra e costura que ESTE kit escolheu para a peca. Em branco, vale o que a referencia diz.';

alter table public.peca_do_kit drop constraint if exists peca_detalhes_e_objeto;
alter table public.peca_do_kit
  add constraint peca_detalhes_e_objeto check (jsonb_typeof(detalhes) = 'object');

-- ---------- 3. a lista, com quem usa cada item, e as pecas do kit -------------
create or replace view public.item_de_detalhe_na_lista
with (security_invoker = true) as
select i.id, i.detalhe, i.nome, i.ordem,
       (select count(*) from public.referencia r
         where r.grupo is distinct from 'KIT'
           and lower(btrim(r.detalhes ->> i.detalhe)) = lower(i.nome))::int as referencias,
       (select count(*) from public.peca_do_kit p
         where lower(btrim(p.detalhes ->> i.detalhe)) = lower(i.nome))::int as kits
  from public.item_de_detalhe i;


/* a view da 051, igual, mais a coluna nova. Coluna nova de view so entra no
   fim. "detalhes" continua sendo o da REFERENCIA; "detalhes_do_kit" e o do kit. */
create or replace view public.peca_do_kit_na_lista
with (security_invoker = true) as
select
  p.id, p.kit_id, k.cod as kit_cod, k.nome as kit_nome, k.ativo as kit_ativo,
  p.referencia_id, r.cod, r.nome, r.genero, r.grupo, r.detalhes, r.tamanhos,
  p.papel, p.ordem, p.tecidos, p.design, p.etiqueta, p.etiqueta_onde, p.observacao,
  p.detalhes as detalhes_do_kit
from public.peca_do_kit p
join public.referencia k on k.id = p.kit_id
join public.referencia r on r.id = p.referencia_id;

grant select on public.peca_do_kit_na_lista to authenticated;
grant select on public.item_de_detalhe_na_lista to authenticated;


-- ---------- 4. acrescentar um item, de dentro da lista ------------------------
/* E o "Adicionar" que aparece quando a pessoa escreve um nome que ainda nao
   existe. O item entra no fim da lista. Se o nome ja existe, escrito de outro
   jeito, devolve o que ja existe: ninguem ganha "Redonda" e "redonda". */
create or replace function public.adicionar_item_de_detalhe(
  p_detalhe text,
  p_nome    text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_novo text := btrim(coalesce(p_nome, ''));
  achado    uuid;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar as listas dos detalhes de peça.' using errcode = '42501';
  end if;
  if coalesce(p_detalhe, '') not in ('gola', 'manga', 'punho', 'barra', 'costura') then
    raise exception 'Não conheço a lista "%".', p_detalhe using errcode = '22023';
  end if;
  if nome_novo = '' then
    raise exception 'O item precisa de um nome.' using errcode = '23514';
  end if;
  if char_length(nome_novo) > 200 then
    raise exception 'O nome do item passa de 200 letras.' using errcode = '23514';
  end if;
  select id into achado from public.item_de_detalhe
   where detalhe = p_detalhe and lower(nome) = lower(nome_novo);
  if found then
    return achado;
  end if;
  insert into public.item_de_detalhe (detalhe, nome, ordem)
  values (p_detalhe, nome_novo,
          coalesce((select max(ordem) + 1 from public.item_de_detalhe where detalhe = p_detalhe), 0))
  returning id into achado;
  return achado;
end $$;

revoke all on function public.adicionar_item_de_detalhe(text, text) from public, anon;
grant execute on function public.adicionar_item_de_detalhe(text, text) to authenticated;


-- ---------- 5. salvar as listas, pelo editor ----------------------------------
/* O editor manda as listas que abriu, cada uma INTEIRA e na ordem:
     { "gola": [ { "id": "...", "nome": "Redonda" }, { "nome": "Gola alta" } ], ... }
   Item com id e um que ja existia (pode ter mudado de nome); sem id, e novo;
   o que existia e nao veio, saiu da lista. Lista que nao veio nao e mexida.

   MUDAR O NOME muda o texto nas referencias e nas pecas de kit que usavam o
   nome antigo. TIRAR nao mexe em referencia nenhuma. Ou entra tudo, ou nada. */
create or replace function public.salvar_listas_de_detalhe(p_listas jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  l       jsonb := coalesce(p_listas, '{}'::jsonb);
  det     text;
  item    jsonb;
  nomes   text[];
  ids     text[];
  n       int := 0;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar as listas dos detalhes de peça.' using errcode = '42501';
  end if;
  if jsonb_typeof(l) <> 'object' then
    raise exception 'As listas vieram num formato que eu não entendo.' using errcode = '22023';
  end if;

  /* --- primeiro confere tudo --- */
  for det in select jsonb_object_keys(l) loop
    if det not in ('gola', 'manga', 'punho', 'barra', 'costura') then
      raise exception 'Não conheço a lista "%".', det using errcode = '22023';
    end if;
    if jsonb_typeof(l -> det) <> 'array' then
      raise exception 'A lista "%" veio num formato que eu não entendo.', det using errcode = '22023';
    end if;
    if jsonb_array_length(l -> det) > 200 then
      raise exception 'São muitos itens na lista "%". Ela leva até 200.', det using errcode = '23514';
    end if;
    nomes := '{}';
    ids := '{}';
    for item in select * from jsonb_array_elements(l -> det) loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'nome') <> 'string'
         or btrim(item ->> 'nome') = '' then
        raise exception 'Tem um item sem nome na lista "%".', det using errcode = '23514';
      end if;
      if char_length(btrim(item ->> 'nome')) > 200 then
        raise exception 'Na lista "%", o nome de um item passa de 200 letras.', det using errcode = '23514';
      end if;
      if lower(btrim(item ->> 'nome')) = any (nomes) then
        raise exception 'Na lista "%", o item "%" está duas vezes.', det, btrim(item ->> 'nome') using errcode = '23505';
      end if;
      nomes := nomes || lower(btrim(item ->> 'nome'));
      if coalesce(item ->> 'id', '') <> '' then
        if (item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or not exists (select 1 from public.item_de_detalhe x
                           where x.id = (item ->> 'id')::uuid and x.detalhe = det) then
          raise exception 'Um item da lista "%" não existe mais. Abra o editor de novo.', det using errcode = 'P0002';
        end if;
        if (item ->> 'id') = any (ids) then
          raise exception 'Na lista "%", o mesmo item veio duas vezes.', det using errcode = '23505';
        end if;
        ids := ids || (item ->> 'id');
      end if;
    end loop;
  end loop;

  /* --- tudo conferido: grava, lista por lista --- */
  for det in select jsonb_object_keys(l) loop
    /* o nome que mudou, mudado tambem em quem o usa. Uma instrucao so por
       tabela, para a troca de dois nomes entre si nao se atropelar */
    update public.referencia r
       set detalhes = jsonb_set(r.detalhes, array[det], to_jsonb(m.novo))
      from (select x.nome as antigo, btrim(i.value ->> 'nome') as novo
              from public.item_de_detalhe x
              join jsonb_array_elements(l -> det) as i(value) on i.value ->> 'id' = x.id::text
             where x.detalhe = det and x.nome <> btrim(i.value ->> 'nome')) m
     where lower(btrim(r.detalhes ->> det)) = lower(m.antigo);
    update public.peca_do_kit p
       set detalhes = jsonb_set(p.detalhes, array[det], to_jsonb(m.novo))
      from (select x.nome as antigo, btrim(i.value ->> 'nome') as novo
              from public.item_de_detalhe x
              join jsonb_array_elements(l -> det) as i(value) on i.value ->> 'id' = x.id::text
             where x.detalhe = det and x.nome <> btrim(i.value ->> 'nome')) m
     where lower(btrim(p.detalhes ->> det)) = lower(m.antigo);

    /* o que saiu da lista */
    delete from public.item_de_detalhe x
     where x.detalhe = det
       and not exists (select 1 from jsonb_array_elements(l -> det) as i(value)
                        where i.value ->> 'id' = x.id::text);

    /* um nome de passagem em cada um, para a troca de nomes entre dois itens
       nao bater na regra de nao repetir no meio do caminho */
    update public.item_de_detalhe set nome = id::text where detalhe = det;

    update public.item_de_detalhe x
       set nome = btrim(i.value ->> 'nome'), ordem = (i.n - 1)::int
      from jsonb_array_elements(l -> det) with ordinality as i(value, n)
     where x.detalhe = det and i.value ->> 'id' = x.id::text;

    insert into public.item_de_detalhe (detalhe, nome, ordem)
    select det, btrim(i.value ->> 'nome'), (i.n - 1)::int
      from jsonb_array_elements(l -> det) with ordinality as i(value, n)
     where coalesce(i.value ->> 'id', '') = '';

    n := n + jsonb_array_length(l -> det);
  end loop;
  return n;
end $$;

revoke all on function public.salvar_listas_de_detalhe(jsonb) from public, anon;
grant execute on function public.salvar_listas_de_detalhe(jsonb) to authenticated;


-- ---------- 6. o salvar_kit, com os detalhes de cada peca ----------------------
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

    /* os detalhes que o kit escolhe por cima da referencia: em branco, vale o dela */
    if jsonb_typeof(coalesce(item -> 'detalhes', '{}'::jsonb)) <> 'object' then
      raise exception 'Em "%", os detalhes vieram num formato que eu não entendo.', r.nome using errcode = '22023';
    end if;
    for chave in select jsonb_object_keys(coalesce(item -> 'detalhes', '{}'::jsonb)) loop
      if chave not in ('gola', 'manga', 'punho', 'barra', 'costura') then
        raise exception 'Em "%", não sei guardar o detalhe "%".', r.nome, chave using errcode = '22023';
      end if;
      if jsonb_typeof(item -> 'detalhes' -> chave) <> 'string' or char_length(item -> 'detalhes' ->> chave) > 200 then
        raise exception 'Em "%", o detalhe "%" é um texto de até 200 letras.', r.nome, chave using errcode = '23514';
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
      (kit_id, referencia_id, papel, ordem, tecidos, design, etiqueta, etiqueta_onde, observacao, detalhes)
    values (
      kit, (item ->> 'referencia_id')::uuid, btrim(coalesce(item ->> 'papel', '')), i, panos,
      coalesce((select jsonb_agg(jsonb_build_object('tecnica', d ->> 'tecnica', 'onde', btrim(coalesce(d ->> 'onde', ''))))
                  from jsonb_array_elements(coalesce(item -> 'design', '[]'::jsonb)) d), '[]'::jsonb),
      coalesce(item ->> 'etiqueta', ''), btrim(coalesce(item ->> 'etiqueta_onde', '')),
      btrim(coalesce(item ->> 'observacao', '')),
      /* detalhe em branco nao fica guardado: em branco e "vale o da referencia" */
      coalesce((select jsonb_object_agg(d.k, btrim(d.v))
                  from jsonb_each_text(coalesce(item -> 'detalhes', '{}'::jsonb)) as d(k, v)
                 where btrim(d.v) <> ''), '{}'::jsonb));
    i := i + 1;
  end loop;
  return kit;
end $$;

grant execute on function public.salvar_kit(uuid, jsonb) to authenticated;


-- ---------- a prova --------------------------------------------------------
do $$
declare
  corpo text := pg_get_functiondef('public.salvar_kit(uuid, jsonb)'::regprocedure);
begin
  if position('detalhes' in corpo) = 0 then
    raise exception 'salvar_kit nao grava os detalhes da peca';
  end if;
  if position('etiqueta_onde' in corpo) = 0 or position('tecido_id' in corpo) = 0 then
    raise exception 'salvar_kit perdeu a etiqueta ou os tecidos (051)';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'peca_do_kit_na_lista'
         and column_name in ('detalhes', 'detalhes_do_kit')) <> 2 then
    raise exception 'a view das pecas do kit nao tem os detalhes da referencia e os do kit';
  end if;
  if not exists (select 1 from pg_class c where c.oid = 'public.peca_do_kit_na_lista'::regclass
                    and c.reloptions @> array['security_invoker=true'])
     or not exists (select 1 from pg_class c where c.oid = 'public.item_de_detalhe_na_lista'::regclass
                    and c.reloptions @> array['security_invoker=true']) then
    raise exception 'uma das views deixou de respeitar o acesso de quem le';
  end if;
  if not has_table_privilege('authenticated', 'public.item_de_detalhe', 'select')
     or not has_table_privilege('authenticated', 'public.item_de_detalhe_na_lista', 'select')
     or not has_table_privilege('authenticated', 'public.peca_do_kit_na_lista', 'select') then
    raise exception 'quem entrou no sistema nao le as listas ou as pecas do kit';
  end if;
  if has_table_privilege('authenticated', 'public.item_de_detalhe', 'insert')
     or has_table_privilege('authenticated', 'public.item_de_detalhe', 'update')
     or has_table_privilege('authenticated', 'public.item_de_detalhe', 'delete') then
    raise exception 'a lista de detalhes aceita escrita direta: so as funcoes gravam';
  end if;
  if has_function_privilege('anon', 'public.adicionar_item_de_detalhe(text, text)', 'execute')
     or has_function_privilege('anon', 'public.salvar_listas_de_detalhe(jsonb)', 'execute') then
    raise exception 'quem nao entrou no sistema consegue mexer nas listas';
  end if;
  /* cada texto que ja estava numa referencia tem o seu item na lista */
  if exists (
    select 1
      from public.referencia r
      cross join (values ('gola'), ('manga'), ('punho'), ('barra'), ('costura')) as d(chave)
     where r.grupo is distinct from 'KIT'
       and btrim(coalesce(r.detalhes ->> d.chave, '')) <> ''
       and not exists (select 1 from public.item_de_detalhe i
                        where i.detalhe = d.chave and lower(i.nome) = lower(btrim(r.detalhes ->> d.chave)))) then
    raise exception 'um detalhe que ja estava escrito numa referencia ficou fora da lista';
  end if;
end $$;
