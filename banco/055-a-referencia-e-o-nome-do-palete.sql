-- ===========================================================================
-- 055: A REFERENCIA E O NOME DO PALETE
--
-- Pedido do Henrique em 06/10/2026: "quero dois campos por palete, uma
-- referencia e um nome. A referencia e o P01, P02 etc., fica no canto superior
-- esquerdo, e o nome fica no canto inferior direito". Ele tinha escrito o
-- tecido no lugar do nome do palete ("POLIAMIDA FUR C/ ELASTANO"), que era o
-- unico campo que havia, e o nome saia para fora do quadrado no desenho.
--
-- O QUE CADA CAMPO E:
--   nome     a REFERENCIA do palete: "P01". E o codigo do lugar, o que a
--            pessoa procura e o que aparece ao lado do material. Continua na
--            coluna `nome`, porque a view, o codigo do lugar e a regra de nao
--            repetir ja moram nela. Nada disso muda.
--   apelido  o NOME do palete: "ALGODAO", "DRY DE SUBLIMACAO". Texto livre,
--            pode repetir e pode ficar vazio. So palete tem.
--
-- O QUE ENTRA:
--   1. a coluna `apelido`
--   2. o salvar_deposito, que passa a gravar o nome do palete
--   3. os paletes que ja existem: quem tinha um nome por extenso no lugar da
--      referencia ganha a referencia (P01 em diante, na ordem de leitura do
--      desenho: de cima para baixo, da esquerda para a direita) e o que
--      estava escrito vai para o nome. Quem ja se chamava "P07" fica como esta.
--
-- A FUNCAO E A MESMA DA 054, mais o campo novo. Ela vem inteira porque funcao
-- nao se emenda: se troca.
--
-- RODAR DE NOVO NAO MUDA NADA: a coluna ja existe, e nenhum palete tem mais um
-- nome por extenso na referencia.
-- ===========================================================================


-- ---------- 1. a coluna -------------------------------------------------------
alter table public.movel_do_deposito add column if not exists apelido text not null default '';

comment on column public.movel_do_deposito.apelido is
  'O nome que a pessoa da ao palete ("ALGODAO"). A referencia ("P01") e a coluna nome.';

alter table public.movel_do_deposito drop constraint if exists movel_apelido_curto;
alter table public.movel_do_deposito
  add constraint movel_apelido_curto check (char_length(apelido) <= 60);
/* so palete tem nome alem da referencia: nos outros o campo seria uma mentira */
alter table public.movel_do_deposito drop constraint if exists movel_so_palete_tem_apelido;
alter table public.movel_do_deposito
  add constraint movel_so_palete_tem_apelido check (tipo = 'palete' or apelido = '');


-- ---------- 2. o salvar_deposito, com o nome do palete -----------------------
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
  vapelido text;
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
      if vniveis < 1 or vniveis > 9 then
        raise exception 'A prateleira % precisa ter de 1 a 9 níveis.', vnome using errcode = '23514';
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
      /* o nome do palete (055): livre, pode repetir, so nao pode ser um texto sem fim */
      if char_length(btrim(coalesce(it ->> 'apelido', ''))) > 60 then
        raise exception 'O nome do palete % passa de 60 letras.', vnome using errcode = '23514';
      end if;
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
    /* O NOME DO PALETE (055). So palete tem. Quando o desenho vem SEM a chave
       (a tela antiga, que ainda nao conhece o campo), o nome que estava
       guardado fica: salvar por ela nao pode apagar o que a tela nova escreveu. */
    if vtipo <> 'palete' then
      vapelido := '';
    elsif it ? 'apelido' then
      vapelido := btrim(coalesce(it ->> 'apelido', ''));
    else
      select coalesce(max(mv.apelido), '') into vapelido
        from public.movel_do_deposito mv where mv.id = vid and mv.tipo = 'palete';
    end if;

    insert into public.movel_do_deposito
      (id, deposito_id, tipo, nome, apelido, uso, x, y, largura, fundo, em_pe, vaos, niveis, nomes_dos_vaos, grade)
    values
      (vid, d, vtipo, vnome, vapelido, btrim(coalesce(it ->> 'uso', '')),
       (it ->> 'x')::numeric, (it ->> 'y')::numeric, (it ->> 'largura')::numeric, (it ->> 'fundo')::numeric,
       coalesce((it ->> 'em_pe')::boolean, false), vvaos, vniveis, vnomes,
       case when vtipo = 'palete' then nullif(it ->> 'grade', '')::uuid end)
    on conflict (id) do update
      set tipo = excluded.tipo, nome = excluded.nome, apelido = excluded.apelido, uso = excluded.uso,
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


-- ---------- 3. os paletes que ja existem --------------------------------------
/* Referencia e o que parece codigo: ate tres letras e um numero ("P07",
   "PA12", "7"). O resto e nome por extenso, e vai para o campo novo. A
   referencia nova e a primeira livre a partir de P01: nao repete palete nem
   vao de prateleira, que dividem o mesmo codigo. */
do $$
declare
  p      record;
  n      int;
  ref    text;
  usados text[];
begin
  for p in
    select mv.id, mv.deposito_id, mv.nome
      from public.movel_do_deposito mv
     where mv.tipo = 'palete'
       and mv.apelido = ''
       and btrim(mv.nome) !~ '^[A-Za-z]{0,3}[0-9]{1,4}$'
     order by mv.deposito_id, mv.y, mv.x, mv.id
  loop
    select coalesce(array_agg(lower(c)), '{}') into usados
      from (
        select o.nome as c from public.movel_do_deposito o
         where o.deposito_id = p.deposito_id and o.tipo = 'palete'
        union all
        select coalesce(nullif(btrim(o.nomes_dos_vaos[v]), ''), o.nome || v::text)
          from public.movel_do_deposito o, generate_series(1, o.vaos) as v
         where o.deposito_id = p.deposito_id and o.tipo = 'prateleira'
      ) todos;
    n := 1;
    loop
      ref := 'P' || lpad(n::text, 2, '0');
      exit when not (lower(ref) = any (usados));
      n := n + 1;
    end loop;
    update public.movel_do_deposito
       set apelido = left(btrim(p.nome), 60), nome = ref
     where id = p.id;
  end loop;
end $$;
