-- ===========================================================================
-- A PROVA DA 047: o deposito.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste tres pessoas (admin, producao e uma conta ainda esperando) e
-- tenta o que cada uma pode e o que nao pode. A regra mora no banco, entao o
-- teste tambem.
--
-- ELA GUARDA E DEVOLVE O DEPOSITO QUE EXISTIR: como tudo e desfeito no fim,
-- o desenho de verdade nao muda. Mesmo assim a prova nao parte dele: apaga o
-- que houver dentro da transacao e monta o proprio.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin, que edita
  p uuid := gen_random_uuid();  -- producao, que so le
  e uuid := gen_random_uuid();  -- esperando aprovacao, que nao ve nada
  dep uuid;
  pd uuid := gen_random_uuid();   -- prateleira D
  pa uuid := gen_random_uuid();   -- prateleira A
  p1 uuid := gen_random_uuid();   -- palete P01
  p2 uuid := gen_random_uuid();   -- palete P02
  esc uuid := gen_random_uuid();  -- escada
  g uuid := gen_random_uuid();    -- a grade dos dois paletes
  m1 uuid; m2 uuid;
  planta jsonb;
  txt text := '';
  n int;
  r record;
begin
  insert into public.convite (email, papel) values
    ('prova-da@prova.test', 'admin'), ('prova-dp@prova.test', 'producao'), ('prova-de@prova.test', 'producao');
  insert into auth.users (id, email) values
    (a, 'prova-da@prova.test'), (p, 'prova-dp@prova.test'), (e, 'prova-de@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-da@prova.test'),
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-dp@prova.test'),
    (e, 'Esperando da Prova', 'producao', 'esperando', 'prova-de@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  delete from public.deposito;

  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material Um da Prova 047', 'un', 0, 'Prova') returning id into m1;
  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material Dois da Prova 047', 'un', 0, 'Prova') returning id into m2;

  planta := jsonb_build_object('nome', 'Depósito da Prova', 'largura', 15, 'fundo', 10, 'moveis', jsonb_build_array(
    jsonb_build_object('id', pd, 'tipo', 'prateleira', 'nome', 'D', 'uso', 'Tecido', 'x', 0.25, 'y', 2.2,
                       'largura', 0.7, 'fundo', 6, 'em_pe', true, 'vaos', 4, 'niveis', 4),
    jsonb_build_object('id', pa, 'tipo', 'prateleira', 'nome', 'A', 'uso', 'Aviamentos', 'x', 1, 'y', 0.25,
                       'largura', 6, 'fundo', 0.7, 'vaos', 3, 'niveis', 2,
                       'nomes_dos_vaos', jsonb_build_array('Botões', '', 'Linhas')),
    jsonb_build_object('id', p1, 'tipo', 'palete', 'nome', 'P01', 'x', 2.1, 'y', 1.6, 'largura', 1.3, 'fundo', 1.3, 'grade', g),
    jsonb_build_object('id', p2, 'tipo', 'palete', 'nome', 'P02', 'x', 4.1, 'y', 1.6, 'largura', 1.3, 'fundo', 1.3, 'grade', g),
    jsonb_build_object('id', esc, 'tipo', 'escada', 'nome', 'Escada', 'x', 0, 'y', 8.4, 'largura', 6.4, 'fundo', 1.6)
  ));

  -- 1. a producao le, mas nao desenha
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.salvar_deposito(planta);
    txt := txt || E'\nRUIM 1. producao desenhou o deposito';
  exception when insufficient_privilege then
    txt := txt || E'\nok   1. producao nao desenha o deposito';
  end;

  -- 2. o admin desenha: nasce o chao e as cinco pecas
  perform set_config('request.jwt.claim.sub', a::text, true);
  dep := public.salvar_deposito(planta);
  select count(*) into n from public.movel_do_deposito where deposito_id = dep;
  select * into r from public.deposito where id = dep;
  txt := txt || E'\n' || case when n = 5 and r.largura = 15 and r.fundo = 10 and r.nome = 'Depósito da Prova' and r.atualizado_por = a
                              then 'ok  ' else 'RUIM' end || ' 2. admin desenha: chao de 15 por 10 e 5 pecas (' || n || ')';

  -- 3. o nome de cada vao: o que veio escrito fica, o vazio vira nome mais numero
  select * into r from public.movel_do_deposito where id = pa;
  txt := txt || E'\n' || case when r.nomes_dos_vaos = array['Botões', 'A2', 'Linhas'] then 'ok  ' else 'RUIM' end
             || ' 3. vao sem nome vira A2 (' || array_to_string(r.nomes_dos_vaos, ', ') || ')';
  select * into r from public.movel_do_deposito where id = pd;
  txt := txt || E'\n' || case when r.nomes_dos_vaos = array['D1', 'D2', 'D3', 'D4'] and r.em_pe then 'ok  ' else 'RUIM' end
             || ' 3b. prateleira sem nomes ganha D1 a D4';

  -- 4. palete guarda a grade, e escada nao tem vao
  select * into r from public.movel_do_deposito where id = p1;
  txt := txt || E'\n' || case when r.grade = g and r.vaos = 1 and r.niveis = 1 then 'ok  ' else 'RUIM' end
             || ' 4. palete guarda a grade e nao tem vao nem nivel';

  -- 5. peca fora do chao e recusada, e nada muda
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis,2,x}', '14.5'));
    txt := txt || E'\nRUIM 5. aceitou palete fora do chao';
  exception when check_violation then
    txt := txt || E'\nok   5. palete fora do chao e recusado';
  end;

  -- 6. dois lugares com o mesmo nome sao recusados (palete com nome de vao)
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis,3,nome}', '"d2"'));
    txt := txt || E'\nRUIM 6. aceitou dois lugares chamados D2';
  exception when unique_violation then
    txt := txt || E'\nok   6. nome repetido (palete "d2" e vao D2) e recusado';
  end;

  -- 7. peca sem nome e recusada
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis,4,nome}', '"  "'));
    txt := txt || E'\nRUIM 7. aceitou peca sem nome';
  exception when check_violation then
    txt := txt || E'\nok   7. peca sem nome e recusada';
  end;

  -- 8. chao pequeno demais e recusado
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{largura}', '1'));
    txt := txt || E'\nRUIM 8. aceitou chao de 1 metro';
  exception when check_violation then
    txt := txt || E'\nok   8. chao de 1 metro e recusado';
  end;

  -- 9. sete niveis e recusado
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis,0,niveis}', '7'));
    txt := txt || E'\nRUIM 9. aceitou prateleira de 7 niveis';
  exception when check_violation then
    txt := txt || E'\nok   9. prateleira de 7 niveis e recusada';
  end;

  -- 10. marcar o lugar: dois lugares, o primeiro e o principal
  n := public.definir_lugares(array[m1], jsonb_build_array(
         jsonb_build_object('movel', pd, 'vao', 2, 'nivel', 3),
         jsonb_build_object('movel', p1)));
  select string_agg(codigo || case when principal then '*' else '' end, ' ' order by principal desc) into r
    from public.lugar_do_material_na_lista where material_id = m1;
  txt := txt || E'\n' || case when n = 1 and r.string_agg = 'D2-3* P01' then 'ok  ' else 'RUIM' end
             || ' 10. dois lugares, o primeiro e o principal (' || coalesce(r.string_agg, 'nada') || ')';

  -- 11. varios materiais de uma vez, com o vao que tem nome proprio e sem nivel
  n := public.definir_lugares(array[m1, m2], jsonb_build_array(jsonb_build_object('movel', pa, 'vao', 1)));
  select string_agg(codigo, ' ' order by material_id) into r from public.lugar_do_material_na_lista where material_id in (m1, m2);
  txt := txt || E'\n' || case when n = 2 and r.string_agg = 'Botões Botões' then 'ok  ' else 'RUIM' end
             || ' 11. dois materiais no vao com nome proprio, sem nivel (' || coalesce(r.string_agg, 'nada') || ')';

  -- 12. vao que nao existe, nivel que nao existe, palete com vao, e escada
  begin
    perform public.definir_lugares(array[m1], jsonb_build_array(jsonb_build_object('movel', pd, 'vao', 5)));
    txt := txt || E'\nRUIM 12. aceitou o vao 5 de uma prateleira de 4';
  exception when check_violation then
    txt := txt || E'\nok   12. vao que nao existe e recusado';
  end;
  begin
    perform public.definir_lugares(array[m1], jsonb_build_array(jsonb_build_object('movel', pa, 'vao', 1, 'nivel', 3)));
    txt := txt || E'\nRUIM 12b. aceitou o nivel 3 de uma prateleira de 2';
  exception when check_violation then
    txt := txt || E'\nok   12b. nivel que nao existe e recusado';
  end;
  begin
    perform public.definir_lugares(array[m1], jsonb_build_array(jsonb_build_object('movel', p1, 'vao', 1)));
    txt := txt || E'\nRUIM 12c. aceitou vao em palete';
  exception when check_violation then
    txt := txt || E'\nok   12c. palete nao tem vao';
  end;
  begin
    perform public.definir_lugares(array[m1], jsonb_build_array(jsonb_build_object('movel', esc)));
    txt := txt || E'\nRUIM 12d. guardou material na escada';
  exception when check_violation then
    txt := txt || E'\nok   12d. na escada nao se guarda material';
  end;

  -- 13. a recusa nao mexeu no que estava marcado
  select count(*) into n from public.lugar_do_material where material_id = m1;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 13. a recusa nao mexeu no lugar que estava (' || n || ')';

  -- 14. a producao nao marca lugar, e ninguem grava direto na tabela
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.definir_lugares(array[m1], '[]'::jsonb);
    txt := txt || E'\nRUIM 14. producao tirou o lugar';
  exception when insufficient_privilege then
    txt := txt || E'\nok   14. producao nao marca lugar';
  end;
  set local role authenticated;
  begin
    insert into public.lugar_do_material (material_id, movel_id) values (m2, p2);
    txt := txt || E'\nRUIM 14b. gravou direto na tabela';
  exception when insufficient_privilege then
    txt := txt || E'\nok   14b. ninguem grava direto na tabela';
  end;
  -- 15. mas a producao le o desenho e os lugares
  select count(*) into n from public.movel_do_deposito;
  txt := txt || E'\n' || case when n = 5 then 'ok  ' else 'RUIM' end || ' 15. producao le as 5 pecas (' || n || ')';
  select count(*) into n from public.lugar_do_material_na_lista;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 15b. producao le os lugares (' || n || ')';
  -- 16. quem ainda espera aprovacao nao le nada
  perform set_config('request.jwt.claim.sub', e::text, true);
  select count(*) into n from public.movel_do_deposito;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 16. quem espera aprovacao nao le o deposito (' || n || ')';
  reset role;

  -- 17. dois lugares de novo, para as provas de perda
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.definir_lugares(array[m1], jsonb_build_array(
            jsonb_build_object('movel', pd, 'vao', 4, 'nivel', 4), jsonb_build_object('movel', p2)));
  perform public.definir_lugares(array[m2], jsonb_build_array(jsonb_build_object('movel', pd, 'vao', 1, 'nivel', 1)));

  -- diminuir os vaos da D para 3 deixaria o material 1 sem o lugar D4-4: recusa sem confirmar
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis,0,vaos}', '3'));
    txt := txt || E'\nRUIM 17. diminuiu os vaos sem perguntar';
  exception when raise_exception then
    txt := txt || E'\nok   17. diminuir os vaos com material la pede confirmacao';
  end;
  select count(*) into n from public.lugar_do_material where material_id = m1;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 17b. e nada foi perdido (' || n || ')';

  -- 18. confirmando: o lugar D4-4 sai, e o palete, que era o segundo, vira o principal
  perform public.salvar_deposito(jsonb_set(planta, '{moveis,0,vaos}', '3'), true);
  select string_agg(codigo || case when principal then '*' else '' end, ' ') into r
    from public.lugar_do_material_na_lista where material_id = m1;
  txt := txt || E'\n' || case when r.string_agg = 'P02*' then 'ok  ' else 'RUIM' end
             || ' 18. confirmado: sai o D4-4 e o P02 vira o principal (' || coalesce(r.string_agg, 'nada') || ')';

  -- 19. tirar a prateleira D do desenho: o material 2 ficaria sem lugar
  begin
    perform public.salvar_deposito(jsonb_set(planta, '{moveis}', (planta -> 'moveis') - 0));
    txt := txt || E'\nRUIM 19. apagou a prateleira sem perguntar';
  exception when raise_exception then
    txt := txt || E'\nok   19. apagar prateleira com material pede confirmacao';
  end;
  perform public.salvar_deposito(jsonb_set(planta, '{moveis}', (planta -> 'moveis') - 0), true);
  select count(*) into n from public.lugar_do_material where material_id = m2;
  txt := txt || E'\n' || case when n = 0 and (select count(*) from public.movel_do_deposito where deposito_id = dep) = 4
                              then 'ok  ' else 'RUIM' end || ' 19b. confirmado: a prateleira sai e o material fica sem lugar';

  -- 20. mexer no desenho sem tirar nada nao pergunta e nao perde: mover o palete e trocar o nome
  planta := jsonb_set(jsonb_set(planta, '{moveis}', (planta -> 'moveis') - 0), '{moveis,2,x}', '6.1');
  planta := jsonb_set(planta, '{moveis,2,nome}', '"Retalhos"');
  perform public.salvar_deposito(planta);
  select string_agg(codigo, ' ') into r from public.lugar_do_material_na_lista where material_id = m1;
  txt := txt || E'\n' || case when r.string_agg = 'Retalhos' then 'ok  ' else 'RUIM' end
             || ' 20. palete movido e rebatizado: o material acompanha (' || coalesce(r.string_agg, 'nada') || ')';

  -- 21. continua sendo um deposito so
  select count(*) into n from public.deposito;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 21. salvar de novo nao cria outro deposito (' || n || ')';

  -- 22. lista vazia tira o lugar
  perform public.definir_lugares(array[m1], '[]'::jsonb);
  select count(*) into n from public.lugar_do_material where material_id = m1;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 22. lista vazia tira o lugar';

  raise exception E'PROVA DA 047 (tudo desfeito):%', txt;
end $$;
