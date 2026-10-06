-- ===========================================================================
-- 054: A PRATELEIRA COM ATE NOVE NIVEIS
--
-- Pedido do Henrique em 06/10/2026: "prateleiras do estoque, preciso que tenha
-- ate 9 niveis de altura". A 047 parava em seis, porque seis era quantas cores
-- de nivel o Design System tinha. O Design System ganhou tres cores (nivel 7,
-- 8 e 9), e o banco acompanha.
--
-- O LIMITE MORA EM DOIS LUGARES DO BANCO, e os dois mudam aqui:
--   1. a restricao da tabela movel_do_deposito
--   2. a conferencia do salvar_deposito, que e quem devolve a frase que a
--      pessoa le ("precisa ter de 1 a 9 niveis")
--
-- A FUNCAO E A MESMA DA 047, letra por letra, menos as duas linhas do limite.
-- Ela vem inteira porque funcao nao se emenda: se troca. A prova
-- (ferramentas/prova-do-deposito.sql) passou a pedir nove aceito e dez
-- recusado.
--
-- NADA QUE EXISTE MUDA: prateleira de 1 a 6 niveis continua valendo, e nenhum
-- lugar marcado perde o lugar.
-- ===========================================================================


-- ---------- 1. a restricao da tabela ----------------------------------------
alter table public.movel_do_deposito drop constraint if exists movel_niveis_que_cabem;
alter table public.movel_do_deposito
  /* nove niveis: e quantas cores de nivel o Design System tem */
  add constraint movel_niveis_que_cabem check (niveis between 1 and 9);


-- ---------- 2. o salvar_deposito, com o limite novo --------------------------
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
