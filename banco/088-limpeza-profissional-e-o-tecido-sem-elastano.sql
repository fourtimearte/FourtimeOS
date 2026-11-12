-- ===========================================================================
-- 088: LIMPEZA PROFISSIONAL COM DOIS SIMBOLOS, E O TECIDO SEM ELASTANO (12/11/2026)
--
-- O Henrique pediu, sobre os cuidados na ficha tecnica do Estoque:
-- "na parte limpeza profissional nas etiquetas de cuidado ... eu tenho que
-- poder selecionar mais de um, la so pode 1".
--
-- A norma (ABNT NBR NM ISO 3758) poe na limpeza profissional DUAS perguntas
-- diferentes: a limpeza a seco (P, F ou "nao limpar a seco") e a limpeza a
-- umido (W ou "nao limpar a umido"). A etiqueta pode trazer uma de cada, e
-- era isso que a regra "um por grupo" da 048 e da 087 impedia.
--
-- O grupo continua o mesmo (a tela mostra "Limpeza profissional" junto). O
-- que muda e a VAGA: cada simbolo ganha a vaga dele, que e o proprio grupo,
-- menos na limpeza profissional, que tem duas vagas (seco e umido). A regra
-- passa a ser "um simbolo por vaga". A lista das vagas mora tambem em
-- src/dominio/estoque/cuidados.tsx, e testes/cuidados.mjs reprova quando as
-- duas se separam.
--
-- E, junto, o pedido: "tem dois poliamida furadinho com elastano, um esta
-- escrito c/ e outro com, deixe o c/ como o certo e mude o com para sem", e
-- logo depois, sobre o DRYFIT COM ELASTANO PROTECAO UV50: "mesmo problema
-- com dryfit". Todo tecido "COM ELASTANO" que tem um gemeo "C/ ELASTANO"
-- passa a "SEM ELASTANO" (secao 4). O nome das cores dele vai junto, pelo
-- gatilho da 075. O relatorio do fim diz o que mudou e o que nao mudou.
--
-- PRECISA DA 087 (a ficha do tecido). Roda quantas vezes quiser.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tecido' and column_name = 'cuidados') then
    raise exception 'Rode a 087 antes da 088: a ficha do tecido ainda nao existe.';
  end if;
end $$;


-- ---------- 1. a vaga de cada simbolo ----------------------------------------
alter table public.simbolo_de_cuidado add column if not exists vaga text;

update public.simbolo_de_cuidado
   set vaga = case
                when grupo = 'profissional'
                 and cod in ('umido-w', 'umido-w-suave', 'umido-w-muito-suave', 'nao-umido')
                  then 'profissional-umido'
                when grupo = 'profissional' then 'profissional-seco'
                else grupo
              end;

alter table public.simbolo_de_cuidado alter column vaga set not null;

comment on column public.simbolo_de_cuidado.vaga is
  'Onde o simbolo disputa lugar: a ficha leva um por vaga. E o grupo, menos na limpeza profissional, que tem duas (seco e umido).';


-- ---------- 2. a ficha da cor: um simbolo por vaga ----------------------------
-- A mesma funcao da 048, so com a conta por vaga no lugar da conta por grupo.
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
    from (select s.vaga
            from public.simbolo_de_cuidado s
           where s.cod = any (new.cuidados)
           group by s.vaga
          having count(*) > 1) g;
  if n > 0 or cardinality(new.cuidados) <> (select count(distinct c) from unnest(new.cuidados) c) then
    raise exception 'A ficha leva um símbolo de cuidado por grupo (na limpeza profissional, um a seco e um a úmido).'
      using errcode = '23514';
  end if;
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados
    from public.simbolo_de_cuidado s
   where s.cod = any (new.cuidados);

  return new;
end $$;


-- ---------- 3. a ficha do tecido: um simbolo por vaga --------------------------
-- A mesma funcao da 087, so com a conta por vaga no lugar da conta por grupo.
create or replace function public.conferir_a_ficha_do_tecido()
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

  /* os cuidados */
  new.cuidados := coalesce(new.cuidados, '{}');
  select count(*) into n
    from unnest(new.cuidados) c
   where not exists (select 1 from public.simbolo_de_cuidado s where s.cod = c);
  if n > 0 then
    raise exception 'Há símbolo de cuidado que eu não conheço.' using errcode = '23514';
  end if;
  select count(*) into n
    from (select s.vaga
            from public.simbolo_de_cuidado s
           where s.cod = any (new.cuidados)
           group by s.vaga
          having count(*) > 1) g;
  if n > 0 or cardinality(new.cuidados) <> (select count(distinct c) from unnest(new.cuidados) c) then
    raise exception 'A ficha leva um símbolo de cuidado por grupo (na limpeza profissional, um a seco e um a úmido).'
      using errcode = '23514';
  end if;
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados
    from public.simbolo_de_cuidado s
   where s.cod = any (new.cuidados);

  /* o "a confirmar" so guarda o que esta marcado, na mesma ordem */
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados_a_confirmar
    from public.simbolo_de_cuidado s
   where s.cod = any (coalesce(new.cuidados_a_confirmar, '{}'))
     and s.cod = any (new.cuidados);

  return new;
end $$;


-- ---------- 4. os tecidos sem elastano ---------------------------------------
-- A regra, pelos dois casos que o Henrique apontou (POLIAMIDA FURADINHO e
-- DRYFIT ... PROTECAO UV50): quando ha dois tecidos com o mesmo nome, um com
-- "C/ ELASTANO" e outro com "COM ELASTANO", o "C/" e o certo e o "COM" vira
-- "SEM". So troca quando o gemeo com "C/" existe; quando o nome com "SEM" ja
-- existe, nao troca e o relatorio diz.
drop table if exists pg_temp._088_relato;
create temporary table _088_relato (o_que text, resultado text);

do $$
declare
  t      record;
  chave  text;
  novo   text;
  n      int := 0;
begin
  for t in
    select id, nome
      from public.tecido
     where upper(nome) ~ '\mCOM ELASTANO\M'
     order by nome
  loop
    /* o nome do gemeo, normalizado: COM vira C/, espacos repetidos somem */
    chave := upper(regexp_replace(regexp_replace(btrim(t.nome), '\s+', ' ', 'g'),
                                  '\mCOM ELASTANO\M', 'C/ ELASTANO', 'i'));
    if not exists (select 1 from public.tecido o
                    where o.id <> t.id
                      and upper(regexp_replace(regexp_replace(btrim(o.nome), '\s+', ' ', 'g'),
                                               'C\s*/\s*ELASTANO', 'C/ ELASTANO', 'i')) = chave) then
      continue;   -- sem gemeo com C/, o COM e o nome certo e fica
    end if;
    /* troca so a palavra, do jeito que ela esta escrita */
    novo := regexp_replace(t.nome, '\mCOM(\s+ELASTANO)', 'SEM\1');
    novo := regexp_replace(novo, '\mcom(\s+elastano)', 'sem\1', 'i');
    novo := regexp_replace(novo, '\mCom(\s+)', 'Sem\1');
    if exists (select 1 from public.tecido where upper(btrim(nome)) = upper(btrim(novo))) then
      insert into _088_relato values ('sem elastano', 'NAO MUDOU (ja existe ' || novo || '): ' || t.nome);
      continue;
    end if;
    update public.tecido set nome = novo where id = t.id;
    insert into _088_relato values ('sem elastano', t.nome || ' virou ' || novo);
    n := n + 1;
  end loop;
  if not exists (select 1 from _088_relato) then
    insert into _088_relato values ('sem elastano', 'nada a trocar (ja rodou, ou nao ha par C/ e COM)');
  end if;
end $$;

insert into _088_relato
select 'limpeza profissional',
       count(*) filter (where vaga = 'profissional-seco') || ' simbolos a seco e '
       || count(*) filter (where vaga = 'profissional-umido') || ' a umido'
  from public.simbolo_de_cuidado;

insert into _088_relato
select 'os pares agora', coalesce(string_agg(nome, ', ' order by nome), 'nenhum')
  from public.tecido
 where upper(nome) ~ '(DRYFIT|POLIAMIDA FURADINH).*\m(C/|COM|SEM) ELASTANO';

select * from _088_relato;
