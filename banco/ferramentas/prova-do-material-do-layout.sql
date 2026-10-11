-- ===========================================================================
-- A PROVA DA 062: o material de cada layout e a reserva refeita.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 062" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  ref_a uuid; ref_b uuid; kit uuid;
  pano  uuid; cor uuid; mat_t uuid; mat_l uuid; mat_s uuid;
  cot   uuid; ped uuid;
  n     int; q numeric; t text;
  txt   text := '';
begin
  insert into public.tecido (nome, largura, gramatura) values ('DRY PROVA 062', 1.6, 160) returning id into pano;
  insert into public.cor_de_tecido (nome, hex) values ('AZUL PROVA 062', '#1d4ed8') returning id into cor;
  insert into public.material (categoria, nome, unidade, tecido_id, cor_id)
    values ('tecido', 'DRY PROVA 062 · AZUL', 'kg', pano, cor) returning id into mat_t;
  insert into public.material (categoria, nome, unidade) values ('aviamento', 'LINHA PROVA 062', 'cone') returning id into mat_l;
  insert into public.material (categoria, nome, unidade) values ('insumo', 'SACO PROVA 062', 'un') returning id into mat_s;

  insert into public.referencia (cod, nome) values ('FT-062-001M', 'CAMISA PROVA 062') returning id into ref_a;
  insert into public.referencia (cod, nome) values ('FT-062-002M', 'CALCAO PROVA 062') returning id into ref_b;
  insert into public.referencia (cod, nome, grupo) values ('FT-KIT-062', 'KIT PROVA 062', 'KIT') returning id into kit;
  /* area por peca: M 0,5 m2 e G 0,6 m2; o calcao 0,3 m2 em M */
  insert into public.consumo_da_referencia (referencia_id, tamanho, area) values (ref_a, 'M', 0.5), (ref_a, 'G', 0.6), (ref_b, 'M', 0.3);
  insert into public.material_da_referencia (referencia_id, material_id, nome, quantidade, unidade)
    values (ref_a, mat_l, 'Linha', 0.02, 'cone'), (ref_a, mat_s, 'Saco', 1, 'un'), (ref_b, mat_l, 'Linha', 0.01, 'cone');
  insert into public.peca_do_kit (kit_id, referencia_id) values (kit, ref_a), (kit, ref_b);

  /* tres layouts: a camisa (10 M e 5 G), o kit (4 M) e um modulo de informacoes */
  insert into public.cotacao (numero, corpo, versao_do_formato) values ('CO-PROVA-062', jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('bloco', jsonb_build_object('referencia', 'FT-062-001M', 'grade', jsonb_build_object('M', 10, 'G', 5),
      'tecidos', jsonb_build_array(jsonb_build_object('nome', 'DRY PROVA 062', 'cor', 'AZUL PROVA 062', 'materialId', mat_t)))),
    jsonb_build_object('bloco', jsonb_build_object('referencia', 'FT-KIT-062', 'grade', jsonb_build_object('M', 4),
      'tecidos', jsonb_build_array(jsonb_build_object('nome', 'DRY PROVA 062', 'cor', 'AZUL PROVA 062')))),
    jsonb_build_object('bloco', jsonb_build_object('informacoes', true, 'grade', jsonb_build_object('M', 1)))
  )), 6) returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-062', cot, 'aprovado') returning id into ped;

  perform public.reservar_o_pedido(ped);

  -- 1. a camisa: 10 x 0,5 + 5 x 0,6 = 8 m2; em kg, 8 x 160 / 1000 = 1,28 kg
  select quantidade, como into q, t from public.consumo_do_layout where pedido_id = ped and ordem = 1 and material_id = mat_t;
  txt := txt || E'\n' || case when q = 1.28 and t like '%a peça inteira · 8,0 m² pela ficha' then 'ok  ' else 'RUIM' end
         || ' 1. o tecido do layout 1 pela area da ficha: ' || coalesce(q::text, 'nada') || ' kg, "' || coalesce(t, '') || '"';

  -- 2. o kit soma a camisa e o calcao: 4 x (0,5 + 0,3) = 3,2 m2 = 0,512 kg
  select quantidade, como into q, t from public.consumo_do_layout where pedido_id = ped and ordem = 2 and material_id = mat_t;
  txt := txt || E'\n' || case when q = 0.512 and t like 'Tecido · as peças do kit%' then 'ok  ' else 'RUIM' end
         || ' 2. o kit soma o tecido das pecas dele: ' || coalesce(q::text, 'nada') || ' kg';

  -- 3. os aviamentos: a linha 15 x 0,02 + 4 x (0,02 + 0,01); o saco 15 + 4
  select quantidade, como into q, t from public.consumo_do_layout where pedido_id = ped and ordem = 1 and material_id = mat_l;
  txt := txt || E'\n' || case when q = 0.3 and t = 'Aviamento · 0,02 cone por peça' then 'ok  ' else 'RUIM' end
         || ' 3. o aviamento da ficha, por peca: ' || coalesce(q::text, 'nada') || ', "' || coalesce(t, '') || '"';
  select quantidade into q from public.consumo_do_layout where pedido_id = ped and ordem = 2 and material_id = mat_l;
  txt := txt || E'\n' || case when q = 0.12 then 'ok  ' else 'RUIM' end || ' 4. no kit, a linha das duas pecas: ' || coalesce(q::text, 'nada');

  -- 5. a reserva soma os layouts: tecido 1,792; linha 0,42; saco 19; o modulo de informacoes nao entra
  select count(*) into n from public.reserva where pedido_id = ped
     and ((material_id = mat_t and quantidade = 1.792 and pecas = 19)
       or (material_id = mat_l and quantidade = 0.42)
       or (material_id = mat_s and quantidade = 19));
  txt := txt || E'\n' || case when n = 3 and (select count(*) from public.reserva where pedido_id = ped) = 3 then 'ok  ' else 'RUIM' end
         || ' 5. a reserva soma os layouts, com o aviamento e o insumo (' || n || ' de 3)';

  -- 6. a linha separada nao dobra ao refazer
  update public.reserva set baixada = true, separado = 1.792 where pedido_id = ped and material_id = mat_t;
  perform public.reservar_o_pedido(ped);
  select quantidade into q from public.reserva where pedido_id = ped and material_id = mat_t;
  select count(*) into n from public.reserva where pedido_id = ped;
  txt := txt || E'\n' || case when q = 1.792 and n = 3 then 'ok  ' else 'RUIM' end
         || ' 6. refazer nao soma a conta nova em cima do que ja foi separado (' || coalesce(q::text, 'nada') || ')';

  -- 7. quem foi aprovado le; o anonimo nao
  set local role anon;
  begin
    select count(*) into n from public.consumo_do_layout;
    txt := txt || E'\n' || 'RUIM 7. o anonimo leu o consumo do layout';
  exception when insufficient_privilege then
    txt := txt || E'\n' || 'ok   7. o anonimo nao le o consumo do layout';
  end;
  reset role;

  raise exception E'\nPROVA DO MATERIAL DE CADA LAYOUT (062)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
