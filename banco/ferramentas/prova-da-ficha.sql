-- ===========================================================================
-- A PROVA DA 048: a ficha tecnica da cor.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste tres pessoas (admin, producao e uma conta ainda esperando), cria
-- os proprios materiais e fornecedores, e tenta o que cada uma pode e o que
-- nao pode. Nada do estoque de verdade e tocado.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin, que edita
  p uuid := gen_random_uuid();  -- producao, que so le
  e uuid := gen_random_uuid();  -- esperando aprovacao, que nao ve nada
  m1 uuid; m2 uuid; m3 uuid;
  f1 uuid; f2 uuid; fb uuid;
  r record;
  n int;
  txt text := '';
  ficha jsonb := jsonb_build_object(
    'composicao', jsonb_build_array(jsonb_build_object('fibra', ' Poliéster ', 'pct', 96),
                                    jsonb_build_object('fibra', 'Elastano', 'pct', 4)),
    'gramatura', 190, 'largura', 1.2,
    'detalhes', jsonb_build_array('Proteção UV 50+', '  Secagem rápida ', '', 'proteção uv 50+'),
    'cuidados', jsonb_build_array('nao-seco', 'passar-1', 'lavar-40-suave', 'nao-alvejar', 'varal-sombra', 'nao-tambor'));
begin
  insert into public.convite (email, papel) values
    ('prova-fa@prova.test', 'admin'), ('prova-fp@prova.test', 'producao'), ('prova-fe@prova.test', 'producao');
  insert into auth.users (id, email) values
    (a, 'prova-fa@prova.test'), (p, 'prova-fp@prova.test'), (e, 'prova-fe@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-fa@prova.test'),
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-fp@prova.test'),
    (e, 'Esperando da Prova', 'producao', 'esperando', 'prova-fe@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material Um da Prova 048', 'kg', 5, 'Prova') returning id into m1;
  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material Dois da Prova 048', 'kg', 5, 'Prova') returning id into m2;
  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material Tres da Prova 048', 'kg', 5, 'Prova') returning id into m3;
  insert into public.fornecedor (nome, situacao) values ('Fornecedor Um da Prova 048', 'novo') returning id into f1;
  insert into public.fornecedor (nome, situacao) values ('Fornecedor Dois da Prova 048', 'novo') returning id into f2;
  insert into public.fornecedor (nome, situacao, motivo_do_bloqueio)
    values ('Fornecedor Bloqueado da Prova 048', 'bloqueado', 'prova') returning id into fb;

  -- 0. os simbolos: 38, em 6 grupos
  select count(*) as n, count(distinct grupo) as g into r from public.simbolo_de_cuidado;
  txt := txt || E'\n' || case when r.n = 38 and r.g = 6 then 'ok  ' else 'RUIM' end
             || ' 0. 38 simbolos de cuidado em 6 grupos (' || r.n || ' em ' || r.g || ')';

  -- 1. material novo nasce com a ficha vazia
  select * into r from public.material where id = m1;
  txt := txt || E'\n' || case when r.composicao = '[]'::jsonb and r.gramatura is null and r.largura is null
                                   and r.detalhes = '{}' and r.cuidados = '{}' then 'ok  ' else 'RUIM' end
             || ' 1. material novo nasce com a ficha vazia';

  -- 2. a producao le, mas nao muda o cadastro
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.definir_cadastro(array[m1], ficha);
    txt := txt || E'\nRUIM 2. producao mudou a ficha';
  exception when insufficient_privilege then
    txt := txt || E'\nok   2. producao nao muda o cadastro';
  end;

  -- 3. o admin grava a ficha inteira de uma cor
  perform set_config('request.jwt.claim.sub', a::text, true);
  n := public.definir_cadastro(array[m1], ficha);
  select * into r from public.material where id = m1;
  txt := txt || E'\n' || case when n = 1 and r.gramatura = 190 and r.largura = 1.2
                                   and r.composicao = '[{"fibra":"Poliéster","pct":96},{"fibra":"Elastano","pct":4}]'::jsonb
                              then 'ok  ' else 'RUIM' end
             || ' 3. admin grava composicao, gramatura e largura, com o nome da fibra sem espaco nas pontas (' || r.composicao::text || ')';

  -- 4. os simbolos ficam na ordem da etiqueta, e nao na ordem em que vieram
  txt := txt || E'\n' || case when r.cuidados = array['lavar-40-suave', 'nao-alvejar', 'nao-tambor', 'varal-sombra', 'passar-1', 'nao-seco']
                              then 'ok  ' else 'RUIM' end
             || ' 4. os simbolos ficam na ordem da etiqueta (' || array_to_string(r.cuidados, ' ') || ')';

  -- 5. detalhe vazio sai, repetido sai, e o espaco das pontas tambem
  txt := txt || E'\n' || case when r.detalhes = array['Proteção UV 50+', 'Secagem rápida'] then 'ok  ' else 'RUIM' end
             || ' 5. detalhe vazio e repetido saem (' || array_to_string(r.detalhes, ' | ') || ')';

  -- 6. so o que veio muda: mexer na gramatura nao apaga a composicao
  perform public.definir_cadastro(array[m1], '{"gramatura": 200}'::jsonb);
  select * into r from public.material where id = m1;
  txt := txt || E'\n' || case when r.gramatura = 200 and jsonb_array_length(r.composicao) = 2 and cardinality(r.cuidados) = 6
                                   and r.largura = 1.2 and r.minimo = 5 then 'ok  ' else 'RUIM' end
             || ' 6. so o que veio muda: a gramatura mudou e o resto ficou';

  -- 7. composicao que nao soma 100 e recusada
  begin
    perform public.definir_cadastro(array[m1], '{"composicao": [{"fibra": "Algodão", "pct": 60}, {"fibra": "Poliéster", "pct": 30}]}'::jsonb);
    txt := txt || E'\nRUIM 7. aceitou composicao somando 90';
  exception when check_violation then
    txt := txt || E'\nok   7. composicao que nao soma 100 e recusada';
  end;

  -- 8. fibra repetida e recusada
  begin
    perform public.definir_cadastro(array[m1], '{"composicao": [{"fibra": "Algodão", "pct": 50}, {"fibra": "algodão", "pct": 50}]}'::jsonb);
    txt := txt || E'\nRUIM 8. aceitou a mesma fibra duas vezes';
  exception when check_violation then
    txt := txt || E'\nok   8. fibra repetida e recusada';
  end;

  -- 9. dois simbolos do mesmo grupo sao recusados
  begin
    perform public.definir_cadastro(array[m1], '{"cuidados": ["lavar-30", "lavar-40"]}'::jsonb);
    txt := txt || E'\nRUIM 9. aceitou dois simbolos de lavagem';
  exception when check_violation then
    txt := txt || E'\nok   9. dois simbolos do mesmo grupo sao recusados';
  end;

  -- 10. simbolo que nao existe e recusado
  begin
    perform public.definir_cadastro(array[m1], '{"cuidados": ["lavar-agua-benta"]}'::jsonb);
    txt := txt || E'\nRUIM 10. aceitou simbolo inventado';
  exception when check_violation then
    txt := txt || E'\nok   10. simbolo que nao existe e recusado';
  end;

  -- 11. gramatura e largura fora do que existe sao recusadas
  begin
    perform public.definir_cadastro(array[m1], '{"gramatura": 5}'::jsonb);
    txt := txt || E'\nRUIM 11. aceitou gramatura de 5 g/m2';
  exception when check_violation then
    txt := txt || E'\nok   11. gramatura de 5 g/m2 e recusada';
  end;
  begin
    perform public.definir_cadastro(array[m1], '{"largura": 12}'::jsonb);
    txt := txt || E'\nRUIM 11b. aceitou largura de 12 m';
  exception when check_violation then
    txt := txt || E'\nok   11b. largura de 12 m e recusada';
  end;

  -- 12. as recusas nao mexeram na ficha que estava
  select * into r from public.material where id = m1;
  txt := txt || E'\n' || case when r.gramatura = 200 and jsonb_array_length(r.composicao) = 2 and cardinality(r.cuidados) = 6
                              then 'ok  ' else 'RUIM' end || ' 12. as recusas nao mexeram na ficha que estava';

  -- 13. em lote: o minimo de dois materiais de uma vez, sem tocar na ficha de nenhum
  n := public.definir_cadastro(array[m1, m2], '{"minimo": 25}'::jsonb);
  select count(*) into r from public.material where id in (m1, m2) and minimo = 25;
  txt := txt || E'\n' || case when n = 2 and r.count = 2
                                   and (select cardinality(cuidados) from public.material where id = m1) = 6
                                   and (select minimo from public.material where id = m3) = 5
                              then 'ok  ' else 'RUIM' end || ' 13. em lote: o minimo de dois muda, a ficha fica e o terceiro nao e tocado';

  -- 14. em lote: a ficha inteira em tres de uma vez
  n := public.definir_cadastro(array[m1, m2, m3], ficha);
  select count(*) into r from public.material
   where id in (m1, m2, m3) and gramatura = 190 and cardinality(cuidados) = 6 and jsonb_array_length(composicao) = 2;
  txt := txt || E'\n' || case when n = 3 and r.count = 3 then 'ok  ' else 'RUIM' end || ' 14. em lote: a mesma ficha nas tres (' || r.count || ')';

  -- 15. ou muda todas, ou nenhuma: um material que nao existe derruba o lote
  begin
    perform public.definir_cadastro(array[m1, gen_random_uuid()], '{"minimo": 99}'::jsonb);
    txt := txt || E'\nRUIM 15. mudou o lote com um material que nao existe';
  exception when no_data_found then
    txt := txt || E'\nok   15. material que nao existe derruba o lote';
  end;
  select minimo into r from public.material where id = m1;
  txt := txt || E'\n' || case when r.minimo = 25 then 'ok  ' else 'RUIM' end || ' 15b. e o que existia nao mudou (' || r.minimo || ')';

  -- 16. chave que a funcao nao conhece e recusada, e mudanca vazia tambem
  begin
    perform public.definir_cadastro(array[m1], '{"saldo": 1000}'::jsonb);
    txt := txt || E'\nRUIM 16. aceitou mudar o saldo pelo cadastro';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   16. o saldo nao muda por aqui: chave desconhecida e recusada';
  end;
  begin
    perform public.definir_cadastro(array[m1], '{}'::jsonb);
    txt := txt || E'\nRUIM 16b. aceitou mudanca vazia';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   16b. mudanca vazia e recusada';
  end;
  begin
    perform public.definir_cadastro('{}'::uuid[], '{"minimo": 1}'::jsonb);
    txt := txt || E'\nRUIM 16c. aceitou lista vazia de materiais';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   16c. lista vazia de materiais e recusada';
  end;

  -- 17. o fornecedor: entra nos dois
  n := public.definir_cadastro(array[m1, m2], jsonb_build_object('fornecedor', f1));
  select count(*) into r from public.material_fornecedor where material_id in (m1, m2) and fornecedor_id = f1;
  txt := txt || E'\n' || case when r.count = 2 then 'ok  ' else 'RUIM' end || ' 17. o fornecedor entra nos dois materiais';

  -- 18. o fornecedor troca, nao soma
  perform public.definir_cadastro(array[m1], jsonb_build_object('fornecedor', f2));
  select string_agg(f.nome, ', ') as nomes, count(*) as n into r
    from public.material_fornecedor mf join public.fornecedor f on f.id = mf.fornecedor_id where mf.material_id = m1;
  txt := txt || E'\n' || case when r.n = 1 and r.nomes = 'Fornecedor Dois da Prova 048' then 'ok  ' else 'RUIM' end
             || ' 18. o fornecedor troca, nao soma (' || coalesce(r.nomes, 'nenhum') || ')';

  -- 19. "so em quem nao tem": m1 e m2 ja tem, m3 nao tem
  perform public.definir_cadastro(array[m1, m2, m3], jsonb_build_object('fornecedor', f1, 'so_sem_fornecedor', true));
  txt := txt || E'\n' || case when (select fornecedor_id from public.material_fornecedor where material_id = m1) = f2
                                   and (select fornecedor_id from public.material_fornecedor where material_id = m2) = f1
                                   and (select fornecedor_id from public.material_fornecedor where material_id = m3) = f1
                              then 'ok  ' else 'RUIM' end || ' 19. "so em quem nao tem": quem ja tinha fica com o seu, e o que nao tinha ganha';

  -- 20. fornecedor bloqueado e recusado, e o que nao existe tambem
  begin
    perform public.definir_cadastro(array[m3], jsonb_build_object('fornecedor', fb));
    txt := txt || E'\nRUIM 20. aceitou fornecedor bloqueado';
  exception when check_violation then
    txt := txt || E'\nok   20. fornecedor bloqueado e recusado';
  end;
  begin
    perform public.definir_cadastro(array[m3], jsonb_build_object('fornecedor', gen_random_uuid()));
    txt := txt || E'\nRUIM 20b. aceitou fornecedor que nao existe';
  exception when no_data_found then
    txt := txt || E'\nok   20b. fornecedor que nao existe e recusado';
  end;

  -- 21. fornecedor nulo deixa sem fornecedor
  perform public.definir_cadastro(array[m3], '{"fornecedor": null}'::jsonb);
  select count(*) into n from public.material_fornecedor where material_id = m3;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 21. fornecedor nulo deixa o material sem fornecedor';

  -- 22. apagar a ficha: listas vazias e numeros nulos
  perform public.definir_cadastro(array[m3], '{"composicao": [], "gramatura": null, "largura": null, "detalhes": [], "cuidados": []}'::jsonb);
  select * into r from public.material where id = m3;
  txt := txt || E'\n' || case when r.composicao = '[]'::jsonb and r.gramatura is null and r.largura is null
                                   and r.detalhes = '{}' and r.cuidados = '{}' then 'ok  ' else 'RUIM' end
             || ' 22. a ficha pode ser apagada';

  -- 23. a view da lista mostra a ficha, e a producao le
  perform set_config('request.jwt.claim.sub', p::text, true);
  set local role authenticated;
  select * into r from public.material_na_prateleira where id = m1;
  txt := txt || E'\n' || case when r.gramatura = 190 and cardinality(r.cuidados) = 6 and jsonb_array_length(r.composicao) = 2
                                   and cardinality(r.detalhes) = 2 and r.largura = 1.2
                              then 'ok  ' else 'RUIM' end || ' 23. a view da lista traz a ficha, e a producao le';
  select count(*) into n from public.simbolo_de_cuidado;
  txt := txt || E'\n' || case when n = 38 then 'ok  ' else 'RUIM' end || ' 23b. a producao le os simbolos (' || n || ')';

  -- 24. a producao nao escreve nos simbolos nem na ficha, nem por fora da funcao
  begin
    insert into public.simbolo_de_cuidado (cod, grupo, ordem) values ('inventado', 'lavagem', 999);
    txt := txt || E'\nRUIM 24. producao criou simbolo';
  exception when insufficient_privilege then
    txt := txt || E'\nok   24. ninguem cria simbolo pela tela';
  end;
  update public.material set gramatura = 300 where id = m1;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 24b. a producao nao muda a ficha direto na tabela (' || n || ' linhas)';

  -- 25. quem ainda espera aprovacao nao ve nada
  perform set_config('request.jwt.claim.sub', e::text, true);
  select count(*) into n from public.material_na_prateleira where id = m1;
  txt := txt || E'\n' || case when n = 0 and (select count(*) from public.simbolo_de_cuidado) = 0 then 'ok  ' else 'RUIM' end
             || ' 25. quem espera aprovacao nao ve material nem simbolo';
  reset role;

  -- 26. o gatilho tambem confere a escrita direta de quem pode (o PATCH da tela)
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    update public.material set cuidados = array['passar-1', 'passar-3'] where id = m1;
    txt := txt || E'\nRUIM 26. a escrita direta passou por fora da conferencia';
  exception when check_violation then
    txt := txt || E'\nok   26. a escrita direta na tabela tambem e conferida';
  end;
  reset role;

  -- 27. sao muitos de uma vez
  begin
    perform public.definir_cadastro(array(select gen_random_uuid() from generate_series(1, 501)), '{"minimo": 1}'::jsonb);
    txt := txt || E'\nRUIM 27. aceitou 501 materiais de uma vez';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   27. mais de 500 de uma vez e recusado';
  end;

  raise exception E'PROVA DA 048 (tudo desfeito):%', txt;
end $$;
