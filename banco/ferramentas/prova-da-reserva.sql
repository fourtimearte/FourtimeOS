-- ============================================================
-- A PROVA DA RESERVA
-- ============================================================
-- Roda no SQL Editor quantas vezes quiser. Ele termina levantando um erro de
-- proposito, e por isso TUDO que ele fez e desfeito: nenhuma linha do banco
-- fica diferente. O relatorio sai dentro da mensagem de erro.
--
-- Ele NAO inventa um pedido: pega um pedido de verdade que ja esta na fabrica,
-- le o primeiro layout do documento dele, e monta em volta desse layout o
-- material e o consumo que faltavam. Depois reserva e confere a conta.
--
-- Provar com um pedido de mentira provaria a funcao contra a minha ideia do que
-- e um documento. Com um pedido de verdade, ela e provada contra o que o editor
-- realmente grava, que e a unica coisa que importa no dia em que quebrar.
--
-- A regra que ele confere esta na migracao 026:
--   consumo cadastrado vira quilo pela largura e pela gramatura do tecido;
--   a reserva e a soma da grade, tamanho por tamanho;
--   tamanho sem consumo NAO vira zero: vira a marca de que nao da para saber;
--   o livre e o saldo menos o reservado, e e ele que julga o minimo.
do $$
declare
  eu      uuid;
  ped     public.pedido;
  doc     jsonb;
  bloco   jsonb;
  pano    jsonb;
  ref_id  uuid;
  id_pano uuid;
  id_cor  uuid;
  id_mat  uuid;
  id_ped  uuid;
  par     record;
  r       text := E'\n';
  n       int;
  pecas   int;
  esperado numeric;
  achado   numeric;
  livre    numeric;
  aberto   boolean;
  um_tam   text;

begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  /* 1. ACHAR UM LAYOUT DE VERDADE QUE RESOLVA INTEIRO.

     Na primeira rodada esta prova pegou o layout mais recente e ele nao casou:
     a cotacao de exemplo usa a referencia FT-070-001F, que nao existe no
     catalogo do editor. Isso nao e defeito da reserva, e sim o que ela existe
     para mostrar, e virou uma linha de informacao aqui embaixo. A prova da
     CONTA precisa de um layout que resolva, entao ela procura um. */
  select p.id, x -> 'bloco' into id_ped, bloco
    from public.pedido p
    join public.cotacao c on c.id = p.cotacao_id
    cross join lateral jsonb_array_elements(coalesce(c.corpo -> 'produtos', '[]'::jsonb)) x
   where not coalesce((x -> 'bloco' ->> 'informacoes')::boolean, false)
     and jsonb_array_length(coalesce(x -> 'bloco' -> 'tecidos', '[]'::jsonb)) > 0
     and coalesce(x -> 'bloco' -> 'grade', '{}'::jsonb) <> '{}'::jsonb
     and exists (select 1 from public.referencia r
                  where r.cod <> '' and r.cod = coalesce(x -> 'bloco' ->> 'referencia', ''))
     and exists (select 1 from public.tecido t
                  where t.nome = coalesce(x -> 'bloco' -> 'tecidos' -> 0 ->> 'nome', ''))
     and exists (select 1 from public.cor_de_tecido cc
                  where cc.nome = coalesce(x -> 'bloco' -> 'tecidos' -> 0 ->> 'cor', ''))
   order by p.criado_em desc
   limit 1;
  if bloco is null then raise exception 'PROVA >> nenhum layout resolve referencia, tecido e cor'; end if;

  select * into ped from public.pedido where id = id_ped;
  select corpo into doc from public.cotacao where id = ped.cotacao_id;

  /* quantos layouts do banco NAO acham a referencia no catalogo. Zero e o que
     se quer; qualquer numero aqui e reserva que vai nascer sem tamanho. */
  select count(*) into n
    from public.cotacao c
    cross join lateral jsonb_array_elements(coalesce(c.corpo -> 'produtos', '[]'::jsonb)) x
   where not coalesce((x -> 'bloco' ->> 'informacoes')::boolean, false)
     and not exists (select 1 from public.referencia r
                      where r.cod <> '' and r.cod = coalesce(x -> 'bloco' ->> 'referencia', ''));
  r := r || 'info  ' || n || ' layout(s) no banco com referencia fora do catalogo' || E'\n';

  pano := bloco -> 'tecidos' -> 0;
  select sum(v::int)::int into pecas
    from jsonb_each_text(bloco -> 'grade') as g(k, v);

  r := r || 'info  pedido ' || ped.numero || ', layout com ' || pecas || ' peca(s)' || E'\n';

  /* 2. resolver catalogo. O layout guarda o NOME, e nao o id: e a divida que a
        026 registrou, e esta prova a exercita de proposito. */
  select id into ref_id from public.referencia
   where (cod <> '' and cod = coalesce(bloco ->> 'referencia', ''))
      or (coalesce(bloco ->> 'referencia', '') = ''
          and nome = coalesce(bloco ->> 'nomeDaReferencia', ''))
   limit 1;
  select id into id_pano from public.tecido      where nome = coalesce(pano ->> 'nome', '') limit 1;
  select id into id_cor  from public.cor_de_tecido where nome = coalesce(pano ->> 'cor', '')  limit 1;

  r := r || case when ref_id is not null then 'ok    ' else 'FALHA ' end
         || 'a referencia do layout casa com o catalogo [' || coalesce(bloco ->> 'referencia','')
         || ']' || E'\n';
  r := r || case when id_pano is not null and id_cor is not null then 'ok    ' else 'FALHA ' end
         || 'o tecido e a cor do layout casam com o catalogo ['
         || coalesce(pano ->> 'nome','') || ' / ' || coalesce(pano ->> 'cor','') || ']' || E'\n';
  if ref_id is null or id_pano is null or id_cor is null then
    raise exception 'PROVA DA RESERVA >> 1 falha(s) %', r;
  end if;

  /* 3. montar o que faltava: medida do tecido, material e consumo */
  update public.tecido set gramatura = 145, largura = 1.600 where id = id_pano;

  insert into public.material (categoria, nome, unidade, minimo, tecido_id, cor_id, teste)
  values ('tecido', 'PROVA malha da reserva', 'kg', 20, id_pano, id_cor, true)
  returning id into id_mat;
  perform public.mexer_no_estoque(id_mat, 100, 'entrada', 'saldo inicial da prova');

  for par in select k as tamanho from jsonb_each_text(bloco -> 'grade') as g(k, v) loop
    insert into public.consumo_da_referencia (referencia_id, tamanho, metros)
    values (ref_id, par.tamanho, 0.6000)
    on conflict (referencia_id, tamanho) do update set metros = excluded.metros;
  end loop;

  /* 4. a conversao: 0,6 m por peca, 1,60 m de largura, 145 g/m2
        0,6 * 1,6 * 145 / 1000 = 0,1392 kg por peca */
  esperado := round(pecas * 0.6 * 1.6 * 145 / 1000, 3);

  perform public.reservar_o_pedido(ped.id);

  select quantidade, sem_consumo into achado, aberto
    from public.reserva where pedido_id = ped.id and material_id = id_mat;

  r := r || case when found then 'ok    ' else 'FALHA ' end
         || 'a reserva do pedido existe para este material' || E'\n';
  r := r || case when round(achado, 3) = esperado then 'ok    ' else 'FALHA ' end
         || 'metro vira quilo pela largura e pela gramatura [esperado ' || esperado
         || ', achado ' || round(coalesce(achado,0), 3) || ']' || E'\n';
  r := r || case when aberto is false then 'ok    ' else 'FALHA ' end
         || 'com a grade inteira cadastrada, nada fica em aberto' || E'\n';

  /* 5. o livre desce, e o saldo nao */
  select m.livre into livre from public.material_na_prateleira m where m.id = id_mat;
  r := r || case when livre = 100 - achado then 'ok    ' else 'FALHA ' end
         || 'o livre e o saldo menos o reservado [' || coalesce(livre, 0) || ']' || E'\n';
  select count(*) into n from public.material_na_prateleira
   where id = id_mat and saldo = 100;
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'e o saldo da prateleira nao se mexeu: reserva nao e movimento' || E'\n';

  /* 6. reservar de novo nao soma em cima do que ja estava */
  perform public.reservar_o_pedido(ped.id);
  select quantidade into achado from public.reserva
   where pedido_id = ped.id and material_id = id_mat;
  r := r || case when round(achado, 3) = esperado then 'ok    ' else 'FALHA ' end
         || 'reservar duas vezes nao dobra a reserva [' || round(coalesce(achado,0), 3) || ']' || E'\n';

  /* 7. tamanho sem consumo NAO vira zero silencioso */
  select k into um_tam from jsonb_each_text(bloco -> 'grade') as g(k, v) where v::int > 0 limit 1;
  delete from public.consumo_da_referencia where referencia_id = ref_id and tamanho = um_tam;
  perform public.reservar_o_pedido(ped.id);
  select quantidade, sem_consumo into achado, aberto
    from public.reserva where pedido_id = ped.id and material_id = id_mat;
  r := r || case when aberto then 'ok    ' else 'FALHA ' end
         || 'faltando o tamanho ' || um_tam || ', a reserva fica marcada como sem consumo' || E'\n';
  r := r || case when achado = 0 then 'ok    ' else 'FALHA ' end
         || 'e a quantidade some em vez de virar um numero pela metade ['
         || round(coalesce(achado,0), 3) || ']' || E'\n';
  select count(*) into n from public.material_na_prateleira
   where id = id_mat and reserva_sem_consumo;
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'e a tela do estoque ve essa falta' || E'\n';

  /* 8. quem nao cuida de producao nao refaz reserva */
  select id into eu from public.pessoa
   where papel = 'vendedor' and situacao = 'aprovado' limit 1;
  if eu is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);
    begin
      perform public.refazer_as_reservas_abertas();
      r := r || 'FALHA vendedor refez as reservas' || E'\n';
    exception when others then
      r := r || 'ok    vendedor nao refaz as reservas (' || sqlstate || ')' || E'\n';
    end;
  else
    r := r || 'info  sem vendedor aprovado para provar a trava de papel' || E'\n';
  end if;

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DA RESERVA >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
