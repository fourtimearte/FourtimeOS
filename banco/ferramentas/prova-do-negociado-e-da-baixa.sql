-- ===========================================================================
-- A PROVA DA 081: o negociado da cotacao aberta, a separacao que so pesa e a
-- baixa no primeiro posto. Roda no SQL Editor quantas vezes quiser: termina
-- levantando um erro de proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();
  ref_a uuid; pano uuid; cor uuid; mat_t uuid; mat_l uuid;
  cot uuid; ped uuid; res_t uuid; res_l uuid;
  n int; q numeric;
  r record;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-81@prova.test', 'admin');
  insert into auth.users (id, email) values (a, 'prova-81@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-81@prova.test')
  on conflict (id) do update set papel = 'admin', situacao = 'aprovado', nome = excluded.nome;
  perform set_config('request.jwt.claim.sub', a::text, true);

  insert into public.tecido (nome, largura, gramatura) values ('DRY PROVA 081', 1.6, 160) returning id into pano;
  insert into public.cor_de_tecido (nome, hex) values ('AZUL PROVA 081', '#1d4ed8') returning id into cor;
  insert into public.material (categoria, nome, unidade, tecido_id, cor_id)
    values ('tecido', 'DRY PROVA 081 · AZUL', 'kg', pano, cor) returning id into mat_t;
  insert into public.material (categoria, nome, unidade) values ('aviamento', 'LINHA PROVA 081', 'cone') returning id into mat_l;
  insert into public.referencia (cod, nome) values ('FT-081-001M', 'CAMISA PROVA 081') returning id into ref_a;
  insert into public.consumo_da_referencia (referencia_id, tamanho, area) values (ref_a, 'M', 0.5), (ref_a, 'G', 0.6);
  insert into public.material_da_referencia (referencia_id, material_id, nome, quantidade, unidade) values (ref_a, mat_l, 'Linha', 0.02, 'cone');
  insert into public.movimento_de_estoque (material_id, quantidade, motivo) values (mat_t, 10, 'entrada'), (mat_l, 5, 'entrada');

  /* a camisa: 10 M e 5 G = 8 m2 = 1,28 kg; a linha 15 x 0,02 = 0,3 */
  insert into public.cotacao (numero, corpo, versao_do_formato) values ('CO-PROVA-081', jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('bloco', jsonb_build_object('referencia', 'FT-081-001M', 'grade', jsonb_build_object('M', 10, 'G', 5),
      'tecidos', jsonb_build_array(jsonb_build_object('nome', 'DRY PROVA 081', 'cor', 'AZUL PROVA 081', 'materialId', mat_t))))
  )), 6) returning id into cot;

  -- 1. a cotacao aberta negocia, e nao tira do livre
  select * into r from public.material_na_prateleira where id = mat_t;
  txt := txt || E'\n' || case when r.negociado = 1.28 and r.cotacoes_negociando = 1 and r.livre = 10 and r.reservado = 0
                              then 'ok  ' else 'RUIM' end
         || ' 1. cotacao aberta: 1,28 kg negociado, livre continua 10 (' || r.negociado || ', ' || r.livre || ')';
  select count(*) into n from public.negociado_na_lista where cotacao_id = cot and numero = 'CO-PROVA-081';
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 1b. a lista diz as duas linhas da cotacao (' || n || ')';

  -- 2. mudar a grade refaz o negociado
  update public.cotacao set corpo = jsonb_set(corpo, '{produtos,0,bloco,grade}', '{"M": 20}') where id = cot;
  select negociado into q from public.material_na_prateleira where id = mat_t;
  txt := txt || E'\n' || case when q = 1.6 then 'ok  ' else 'RUIM' end || ' 2. mudar a grade refaz o negociado (' || q || ')';

  -- 3. aprovada solta o negociado; o pedido reserva
  update public.cotacao set estado = 'aprovada' where id = cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-081', cot, 'aprovado') returning id into ped;
  perform public.reservar_o_pedido(ped);
  select * into r from public.material_na_prateleira where id = mat_t;
  txt := txt || E'\n' || case when r.negociado = 0 and r.reservado = 1.6 and r.livre = 8.4 then 'ok  ' else 'RUIM' end
         || ' 3. aprovada: o negociado sai e vira reservado (' || r.negociado || ', ' || r.reservado || ', ' || r.livre || ')';

  -- 4. a separacao pesa e guarda: o saldo nao muda, o reservado vira o peso
  select id into res_t from public.reserva where pedido_id = ped and material_id = mat_t;
  select id into res_l from public.reserva where pedido_id = ped and material_id = mat_l;
  perform public.separar_material(res_t, 1.7);
  select * into r from public.material_na_prateleira where id = mat_t;
  select count(*) into n from public.movimento_de_estoque where pedido_id = ped;
  txt := txt || E'\n' || case when r.saldo = 10 and r.reservado = 1.7 and r.livre = 8.3 and n = 0 then 'ok  ' else 'RUIM' end
         || ' 4. pesar nao mexe no estoque: saldo 10, reservado vira 1,7 (' || r.saldo || ', ' || r.reservado || ', ' || n || ' movimento)';
  select * into r from public.reserva_do_pedido where id = res_t;
  txt := txt || E'\n' || case when r.pesada and not r.baixada and r.pesado_por = 'Admin da Prova' then 'ok  ' else 'RUIM' end
         || ' 4b. a reserva diz pesada, quem e quando';
  begin
    perform public.separar_material(res_t, 1.7);
    txt := txt || E'\nRUIM 5. pesou duas vezes';
  exception when unique_violation then
    txt := txt || E'\nok   5. pesar de novo e recusado';
  end;

  -- 6. refazer a reserva guarda o peso
  perform public.reservar_o_pedido(ped);
  select separado into q from public.reserva where pedido_id = ped and material_id = mat_t;
  txt := txt || E'\n' || case when q = 1.7 then 'ok  ' else 'RUIM' end || ' 6. refazer a reserva nao perde o peso (' || coalesce(q::text, 'nada') || ')';

  -- 7. a fila da separacao nao pede mais o pesado
  select count(*) into n from public.material_da_fila where material_id = mat_t;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 7. o pesado sai da fila';

  -- 8. conclui com a linha sem pesar: falta-material
  perform public.concluir_a_separacao(ped);
  select * into r from public.pedido where id = ped;
  txt := txt || E'\n' || case when r.estado = 'pcp' and r.aviso = 'falta-material' then 'ok  ' else 'RUIM' end || ' 8. a linha sem pesar conta como falta';

  -- 9. liberar para a producao baixa: o peso do tecido e o reservado da linha
  update public.pedido set marcado_em = now() where id = ped;
  perform public.liberar_para_producao(ped, '[{"tecnica":"subli","layouts":[1],"pecas":20}]'::jsonb);
  select * into r from public.material_na_prateleira where id = mat_t;
  txt := txt || E'\n' || case when r.saldo = 8.3 and r.reservado = 0 and r.livre = 8.3 then 'ok  ' else 'RUIM' end
         || ' 9. no primeiro posto o tecido sai pelo peso: saldo 8,3 (' || r.saldo || ', ' || r.reservado || ')';
  select saldo into q from public.material where id = mat_l;
  select count(*) into n from public.movimento_de_estoque where pedido_id = ped and motivo = 'producao';
  txt := txt || E'\n' || case when q = 4.6 and n = 2 then 'ok  ' else 'RUIM' end
         || ' 9b. a linha nao pesada sai pelo reservado (' || q || ', ' || n || ' movimentos)';

  -- 10. voltar ao PCP e liberar de novo nao baixa duas vezes
  update public.pedido set estado = 'pcp' where id = ped;
  update public.pedido set estado = 'producao' where id = ped;
  select saldo into q from public.material where id = mat_t;
  txt := txt || E'\n' || case when q = 8.3 then 'ok  ' else 'RUIM' end || ' 10. nao baixa duas vezes (' || q || ')';

  raise exception E'\nPROVA DA 081 (tudo desfeito)%', txt;
end $$;
