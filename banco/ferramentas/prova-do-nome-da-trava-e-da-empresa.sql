-- ===========================================================================
-- A PROVA DA 075: o nome do pedido, a trava das fatias, a empresa e o tecido
-- renomeado.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 075" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedor
  cot uuid; ped uuid; ped2 uuid; tec uuid; cor uuid; mat uuid;
  n int; t text; b boolean; j jsonb; r record;
  emp_antes jsonb;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-75a@prova.test', 'admin'), ('prova-75v@prova.test', 'vendedor');
  insert into auth.users (id, email) values (a, 'prova-75a@prova.test'), (v, 'prova-75v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova 075', 'admin', 'aprovado', 'prova-75a@prova.test'),
    (v, 'Dani da Prova 075', 'vendedor', 'aprovado', 'prova-75v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, cliente_nome, corpo, versao_do_formato)
  values ('CO-PROVA-075', 'Escola PROVA 075', '{"producao":{"marcas":["VIP","EVENTO"]}}'::jsonb, 6) returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-075', cot, 'producao') returning id into ped;
  insert into public.cotacao (numero, cliente_nome, corpo, versao_do_formato)
  values ('CO-PROVA-075B', 'Clube PROVA 075', '{}'::jsonb, 6) returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-075B', cot, 'producao') returning id into ped2;

  -- 1. o nome: o admin da, o vendedor (so ve o painel) nao
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  t := public.dar_nome_ao_pedido(ped, '  Uniforme   Equipe Verão ');
  select nome, marcas, tem_fatias into r from public.pedido_na_fabrica where id = ped;
  txt := txt || E'\n' || case when t = 'Uniforme Equipe Verão' and r.nome = t then 'ok  ' else 'RUIM' end
         || ' 1. dar nome ao pedido limpa o espaco e a view mostra (' || coalesce(r.nome, '-') || ')';
  txt := txt || E'\n' || case when r.marcas = array['VIP', 'EVENTO'] then 'ok  ' else 'RUIM' end
         || ' 2. a view traz as marcas da cotacao (' || array_to_string(r.marcas, ', ') || ')';
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    perform public.dar_nome_ao_pedido(ped, 'Outro');
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 3. quem so ve o painel nao da nome (42501)';

  -- 4. a trava: sem fatia, a etapa muda como sempre
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  update public.pedido set etapa = 'costura' where id = ped2;
  select etapa::text into t from public.pedido where id = ped2;
  txt := txt || E'\n' || case when t = 'costura' then 'ok  ' else 'RUIM' end || ' 4. pedido sem fatia: a etapa muda pelo painel (' || t || ')';

  -- 5. com fatia: a fatia acerta o pedido, e o painel nao muda mais
  insert into public.fatia (pedido_id, tecnica, etapa) values (ped, 'subli', 'calandra');
  select etapa::text, tem_fatias into t, b from public.pedido_na_fabrica where id = ped;
  txt := txt || E'\n' || case when t = 'calandra' and b then 'ok  ' else 'RUIM' end
         || ' 5. a fatia nova acerta a etapa do pedido (' || t || ') e tem_fatias liga';
  b := false;
  begin
    update public.pedido set etapa = 'costura' where id = ped;
  exception when sqlstate '23514' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. com fatia, mudar a etapa direto e recusado (23514)';
  b := false;
  begin
    update public.pedido set etapa = 'finalizado' where id = ped;
  exception when sqlstate '23514' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 7. e o "Pronto em" tambem';
  update public.pedido set aviso = 'falta-material' where id = ped;
  select aviso into t from public.pedido where id = ped;
  txt := txt || E'\n' || case when t = 'falta-material' then 'ok  ' else 'RUIM' end || ' 8. o resto do pedido continua mudando (aviso)';
  update public.fatia set etapa = 'futurize' where pedido_id = ped;
  select etapa::text into t from public.pedido where id = ped;
  txt := txt || E'\n' || case when t = 'futurize' then 'ok  ' else 'RUIM' end || ' 9. a fatia andando continua levando o pedido (' || t || ')';

  -- 10. a empresa: o admin grava, a chave inventada cai, o vendedor le e nao grava
  select dados into emp_antes from public.empresa;
  j := public.salvar_empresa('{"cnpj":"12.ABC.345/0001-90","cidade":" Goiânia ","hacker":"x"}'::jsonb);
  txt := txt || E'\n' || case when j = '{"cnpj":"12.ABC.345/0001-90","cidade":"Goiânia"}'::jsonb then 'ok  ' else 'RUIM' end
         || ' 10. salvar a empresa guarda so o que conhece, aparado (' || j::text || ')';
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    perform public.salvar_empresa('{"cnpj":"x"}'::jsonb);
  exception when sqlstate '42501' then b := true;
  end;
  set local role authenticated;
  select dados ->> 'cnpj' into t from public.empresa;
  b := b and t = '12.ABC.345/0001-90';
  begin
    update public.empresa set dados = '{}';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  reset role;
  txt := txt || E'\n' || case when b and n = 0 then 'ok  ' else 'RUIM' end || ' 11. o vendedor le a empresa e nao grava, nem pela funcao nem direto';

  -- 12. renomear o tecido leva o material; renomear a cor tambem
  insert into public.tecido (nome) values ('PIQUET PROVA 075') returning id into tec;
  insert into public.cor_de_tecido (nome, hex) values ('Verde Prova 075', '#00aa00') returning id into cor;
  insert into public.material (categoria, nome, unidade, tecido_id, cor_id)
  values ('tecido', 'PIQUET PROVA 075 · Verde Prova 075', 'kg', tec, cor) returning id into mat;
  update public.tecido set nome = 'PIQUE PROVA 075' where id = tec;
  select nome into t from public.material where id = mat;
  txt := txt || E'\n' || case when t = 'PIQUE PROVA 075 · Verde Prova 075' then 'ok  ' else 'RUIM' end || ' 12. renomear o tecido renomeia o material (' || t || ')';
  update public.cor_de_tecido set nome = 'Verde Musgo Prova 075' where id = cor;
  select nome into t from public.material where id = mat;
  txt := txt || E'\n' || case when t = 'PIQUE PROVA 075 · Verde Musgo Prova 075' then 'ok  ' else 'RUIM' end || ' 13. renomear a cor tambem (' || t || ')';

  raise exception E'\nPROVA DO NOME, DA TRAVA E DA EMPRESA (075)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
