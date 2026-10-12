-- ===========================================================================
-- A PROVA DA 071: o fim do caminho do pedido e o cancelado que solta a reserva.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 071" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedor
  mat_l uuid; mat_s uuid; ref_a uuid; cot uuid; ped uuid;
  n int; q numeric; b boolean; e text;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-71a@prova.test', 'admin'), ('prova-71v@prova.test', 'vendedor');
  insert into auth.users (id, email) values (a, 'prova-71a@prova.test'), (v, 'prova-71v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova 071', 'admin', 'aprovado', 'prova-71a@prova.test'),
    (v, 'Dani da Prova 071', 'vendedor', 'aprovado', 'prova-71v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.material (categoria, nome, unidade) values ('aviamento', 'LINHA PROVA 071', 'cone') returning id into mat_l;
  insert into public.material (categoria, nome, unidade) values ('insumo', 'SACO PROVA 071', 'un') returning id into mat_s;
  insert into public.referencia (cod, nome) values ('FT-071-001M', 'CAMISA PROVA 071') returning id into ref_a;
  insert into public.material_da_referencia (referencia_id, material_id, nome, quantidade, unidade)
    values (ref_a, mat_l, 'Linha', 0.02, 'cone'), (ref_a, mat_s, 'Saco', 1, 'un');
  insert into public.cotacao (numero, corpo, versao_do_formato) values ('CO-PROVA-071', jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('bloco', jsonb_build_object('referencia', 'FT-071-001M', 'grade', jsonb_build_object('M', 10))))), 6)
    returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-071', cot, 'aprovado') returning id into ped;
  perform public.reservar_o_pedido(ped);
  select count(*) into n from public.reserva where pedido_id = ped;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 0. o pedido nasce com as duas reservas (' || n || ')';

  -- 1. o saco ja foi separado; a linha nao
  update public.reserva set baixada = true where pedido_id = ped and material_id = mat_s;

  -- 2. o vendedor nao cancela (a matriz de acoes so da a admin e gerente)
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    update public.pedido set estado = 'cancelado' where id = ped;
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 1. o vendedor nao cancela o pedido (42501)';

  -- 3. o admin cancela: a reserva nao separada sai, a separada fica
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform public.mover_pedido(ped, 'cancelado');
  select count(*) into n from public.reserva where pedido_id = ped and not baixada;
  select count(*) filter (where baixada) into q from public.reserva where pedido_id = ped;
  txt := txt || E'\n' || case when n = 0 and q = 1 then 'ok  ' else 'RUIM' end
         || ' 2. cancelado: a reserva ainda nao separada sai (' || n || ' aberta) e a separada fica (' || q || ')';

  -- 4. a prateleira nao conta mais a linha presa
  select coalesce(sum(x.quantidade), 0) into q from public.reserva x where x.material_id = mat_l and not x.baixada;
  txt := txt || E'\n' || case when q = 0 then 'ok  ' else 'RUIM' end || ' 3. a linha deixou de ser segurada na prateleira (' || q || ')';

  -- 5. o admin reabre para aprovado: a reserva volta
  perform public.mover_pedido(ped, 'aprovado');
  select count(*) into n from public.reserva where pedido_id = ped and material_id = mat_l and not baixada;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 4. reabrir para aprovado refaz a reserva da linha (' || n || ')';

  -- 6. o caminho do fim: pronto, enviado, entregue e voltar um passo
  update public.pedido set etapa = 'finalizado' where id = ped;  -- o gatilho poe em pronto
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  perform public.mover_pedido(ped, 'enviado');
  perform public.mover_pedido(ped, 'entregue');
  select estado::text into e from public.pedido where id = ped;
  txt := txt || E'\n' || case when e = 'entregue' then 'ok  ' else 'RUIM' end || ' 5. o vendedor marca enviado e entregue (' || e || ')';
  b := false;
  begin
    perform public.mover_pedido(ped, 'enviado');
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. voltar um passo e so de quem manda: o vendedor nao volta (42501)';
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform public.mover_pedido(ped, 'enviado');
  perform public.mover_pedido(ped, 'pronto');
  select estado::text into e from public.pedido where id = ped;
  txt := txt || E'\n' || case when e = 'pronto' then 'ok  ' else 'RUIM' end || ' 7. o admin volta de entregue para enviado e para pronto (' || e || ')';

  raise exception E'\nPROVA DO PEDIDO CANCELADO (071)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
