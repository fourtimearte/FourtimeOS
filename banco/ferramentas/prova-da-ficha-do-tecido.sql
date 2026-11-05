-- ===========================================================================
-- A PROVA DA 087: a ficha tecnica do tecido.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste duas pessoas (admin, que edita o Estoque, e producao, que so le),
-- cria o proprio tecido e tenta o que cada uma pode e o que nao pode.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin, que edita
  p uuid := gen_random_uuid();  -- producao, que so le
  t uuid; t2 uuid;
  r record;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-ta@prova.test', 'admin'), ('prova-tp@prova.test', 'producao');
  insert into auth.users (id, email) values (a, 'prova-ta@prova.test'), (p, 'prova-tp@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-ta@prova.test'),
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-tp@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  insert into public.tecido (nome) values ('TECIDO DA PROVA 087') returning id into t;

  -- 1. o tecido novo nasce com a ficha vazia
  select * into r from public.tecido where id = t;
  txt := txt || E'\n' || case when r.composicao = '[]'::jsonb and r.cuidados = '{}' and r.cuidados_a_confirmar = '{}'
                              then 'ok  ' else 'RUIM' end || ' 1. tecido novo nasce com a ficha vazia';

  -- 2. a producao le, mas nao muda a ficha
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.definir_ficha_do_tecido(t, '{"cuidados": ["lavar-30"]}'::jsonb);
    txt := txt || E'\nRUIM 2. producao mudou a ficha do tecido';
  exception when insufficient_privilege then
    txt := txt || E'\nok   2. producao nao muda a ficha do tecido';
  end;

  -- 3. o admin grava composicao, cuidados fora de ordem e o a confirmar
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.definir_ficha_do_tecido(t, jsonb_build_object(
    'composicao', jsonb_build_array(jsonb_build_object('fibra', ' Algodão ', 'pct', 100)),
    'cuidados', jsonb_build_array('passar-2', 'lavar-40', 'nao-alvejar'),
    'cuidados_a_confirmar', jsonb_build_array('passar-2', 'nao-seco'),
    'gramatura', 180, 'largura', 1.8));
  select * into r from public.tecido where id = t;
  txt := txt || E'\n' || case when r.composicao = '[{"fibra":"Algodão","pct":100}]'::jsonb
                                   and r.cuidados = '{lavar-40,nao-alvejar,passar-2}'
                                   and r.cuidados_a_confirmar = '{passar-2}'
                                   and r.gramatura = 180 and r.largura = 1.8
                              then 'ok  ' else 'RUIM' end
             || ' 3. grava, poe na ordem da etiqueta e o a confirmar so guarda o que esta marcado';

  -- 4. so o que veio muda
  perform public.definir_ficha_do_tecido(t, '{"cuidados_a_confirmar": []}'::jsonb);
  select * into r from public.tecido where id = t;
  txt := txt || E'\n' || case when r.cuidados_a_confirmar = '{}' and cardinality(r.cuidados) = 3
                                   and r.gramatura = 180 and jsonb_array_length(r.composicao) = 1
                              then 'ok  ' else 'RUIM' end || ' 4. confirmar tira a marca e nao mexe no resto';

  -- 5. composicao que nao soma 100
  begin
    perform public.definir_ficha_do_tecido(t, '{"composicao": [{"fibra": "Algodão", "pct": 90}]}'::jsonb);
    txt := txt || E'\nRUIM 5. aceitou composicao somando 90';
  exception when check_violation then
    txt := txt || E'\nok   5. composicao que nao soma 100 e recusada';
  end;

  -- 6. dois simbolos do mesmo grupo
  begin
    perform public.definir_ficha_do_tecido(t, '{"cuidados": ["lavar-30", "lavar-40"]}'::jsonb);
    txt := txt || E'\nRUIM 6. aceitou dois simbolos de lavagem';
  exception when check_violation then
    txt := txt || E'\nok   6. um simbolo por grupo';
  end;

  -- 7. gramatura fora da faixa
  begin
    perform public.definir_ficha_do_tecido(t, '{"gramatura": 5}'::jsonb);
    txt := txt || E'\nRUIM 7. aceitou gramatura de 5';
  exception when check_violation then
    txt := txt || E'\nok   7. gramatura fora da faixa e recusada';
  end;

  -- 8. chave que a funcao nao conhece
  begin
    perform public.definir_ficha_do_tecido(t, '{"nome": "OUTRO"}'::jsonb);
    txt := txt || E'\nRUIM 8. mudou o nome pela ficha';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   8. a ficha nao muda o nome do tecido';
  end;

  -- 9. a partida da 087 reconhece o tecido pelo nome (o ensaio tem os 42 do catalogo)
  select * into r from public.tecido where nome = 'NEOPRENE';
  if found then
    txt := txt || E'\n' || case when 'lavar-mao' = any (r.cuidados) and 'nao-passar' = any (r.cuidados)
                                then 'ok  ' else 'RUIM' end || ' 9. o neoprene nasceu com lavar a mao e nao passar';
  end if;

  -- 10. tecido que nenhum padrao reconhece fica sem cuidados
  insert into public.tecido (nome) values ('XYZ DA PROVA 087') returning id into t2;
  select * into r from public.tecido where id = t2;
  txt := txt || E'\n' || case when r.cuidados = '{}' then 'ok  ' else 'RUIM' end
             || ' 10. tecido novo nao ganha cuidado inventado';

  raise exception E'PROVA DA 087 (tudo desfeito):%', txt;
end $$;
