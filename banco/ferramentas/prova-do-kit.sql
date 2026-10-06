-- ===========================================================================
-- A PROVA DA 051: os kits.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria as proprias referencias, os proprios tecidos, as proprias pessoas e
-- ate o proprio papel (um que edita a ficha sem ser chefia, para a prova nao
-- depender de como a matriz de acessos esta hoje). Nada do cadastro de verdade
-- e tocado.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente: cria e salva
  e uuid := gen_random_uuid();  -- edita a ficha, mas nao e chefia
  v uuid := gen_random_uuid();  -- vendedor: so ve
  cima uuid; baixo uuid; fem uuid; semcod uuid; outro_kit uuid;
  pano uuid; pano2 uuid;
  kit uuid; kit2 uuid;
  ficha jsonb; peca_cima jsonb; peca_baixo jsonb;
  n int; t text; b boolean;
  recusou boolean;
  txt text := '';
begin
  insert into public.papel_do_sistema (chave, nome) values ('prova_kit', 'Edita ficha na prova') on conflict do nothing;
  insert into public.permissao (papel, painel, ver, editar) values ('prova_kit', 'produtos', true, true)
    on conflict (papel, painel) do update set ver = true, editar = true;
  insert into public.convite (email, papel) values
    ('prova-kg@prova.test', 'gerente'), ('prova-ke@prova.test', 'prova_kit'), ('prova-kv@prova.test', 'vendedor');
  insert into auth.users (id, email) values (g, 'prova-kg@prova.test'), (e, 'prova-ke@prova.test'), (v, 'prova-kv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-kg@prova.test'),
    (e, 'Editor da Prova', 'prova_kit', 'aprovado', 'prova-ke@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-kv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;
  /* o vendedor da prova so ve as fichas, seja como for a matriz de hoje */
  insert into public.permissao (papel, painel, ver, editar, deletar, total) values ('vendedor', 'produtos', true, false, false, false)
    on conflict (papel, painel) do update set ver = true, editar = false, deletar = false, total = false;

  insert into public.referencia (cod, nome, genero) values ('FT-998-001M', 'CAMISETA DA PROVA 051', 'M') returning id into cima;
  insert into public.referencia (cod, nome, genero) values ('FT-998-002M', 'CALCAO DA PROVA 051', 'M') returning id into baixo;
  insert into public.referencia (cod, nome, genero) values ('FT-998-003F', 'TOP DA PROVA 051', 'F') returning id into fem;
  insert into public.referencia (cod, nome, genero) values ('', 'SEM CODIGO DA PROVA 051', 'M') returning id into semcod;
  insert into public.referencia (cod, nome, genero, grupo) values ('FT-KIT-998-777M-998-778M', 'OUTRO KIT DA PROVA 051', 'M', 'KIT') returning id into outro_kit;
  insert into public.tecido (nome) values ('TECIDO A DA PROVA 051') returning id into pano;
  insert into public.tecido (nome) values ('TECIDO B DA PROVA 051') returning id into pano2;

  peca_cima := jsonb_build_object(
    'referencia_id', cima, 'papel', ' Parte de cima ',
    'tecidos', jsonb_build_array(
      jsonb_build_object('parte', 'Frente e costas', 'tecido_id', pano),
      jsonb_build_object('parte', 'Mangas', 'tecido_id', pano2)),
    'design', jsonb_build_array(
      jsonb_build_object('tecnica', 'subli', 'onde', '  peça inteira  '),
      jsonb_build_object('tecnica', 'patch', 'onde', 'escudo no peito')),
    'etiqueta', 'silk', 'etiqueta_onde', 'no decote, por dentro', 'observacao', 'Patch depois da costura.');
  peca_baixo := jsonb_build_object('referencia_id', baixo, 'papel', 'Parte de baixo');
  ficha := jsonb_build_object('nome', '  KIT DA PROVA 051  ', 'pecas', jsonb_build_array(peca_cima, peca_baixo));

  -- 1. quem so ve nao cria
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  recusou := false;
  begin perform public.salvar_kit(null, ficha); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 1. o vendedor, que so ve, nao cria kit';

  -- 2. quem edita a ficha sem ser chefia tambem nao cria
  perform set_config('request.jwt.claim.sub', e::text, true);
  recusou := false;
  begin perform public.salvar_kit(null, ficha); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 2. quem edita a ficha sem ser chefia nao cria kit';

  -- 3. ninguem escreve nas pecas por fora
  perform set_config('request.jwt.claim.sub', g::text, true);
  recusou := false;
  begin insert into public.peca_do_kit (kit_id, referencia_id) values (outro_kit, cima); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 3. ninguem escreve nas pecas do kit por fora da funcao';

  -- 4. o gerente cria: o codigo nasce das pecas, o grupo e KIT, o genero e o das pecas
  kit := public.salvar_kit(null, ficha);
  reset role;
  select count(*) into n from public.referencia
   where id = kit and cod = 'FT-KIT-998-001M-998-002M' and grupo = 'KIT' and genero = 'M'
     and nome = 'KIT DA PROVA 051' and ficha_em is not null;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 4. o gerente cria: codigo FT-KIT-998-001M-998-002M, grupo KIT, masculino, nome aparado';

  -- 5. a ficha de cada peca entrou, com o nome do tecido vindo do catalogo e o texto aparado
  select count(*) into n from public.peca_do_kit
   where kit_id = kit and referencia_id = cima and papel = 'Parte de cima' and ordem = 0
     and tecidos = jsonb_build_array(
           jsonb_build_object('parte', 'Frente e costas', 'tecido_id', pano, 'tecido', 'TECIDO A DA PROVA 051'),
           jsonb_build_object('parte', 'Mangas', 'tecido_id', pano2, 'tecido', 'TECIDO B DA PROVA 051'))
     and design = jsonb_build_array(
           jsonb_build_object('tecnica', 'subli', 'onde', 'peça inteira'),
           jsonb_build_object('tecnica', 'patch', 'onde', 'escudo no peito'))
     and etiqueta = 'silk' and etiqueta_onde = 'no decote, por dentro' and observacao = 'Patch depois da costura.';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 5. a peca de cima: dois tecidos com o nome do catalogo, duas tecnicas, etiqueta e observacao';

  -- 6. a lista de kits diz o que tem e o que falta
  select count(*) into n from public.kit_na_ficha
   where id = kit and pecas = 2 and pecas_cod = array['FT-998-001M', 'FT-998-002M']
     and pecas_sem_tecido = 1 and pecas_sem_etiqueta = 1 and not tem_desenho;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 6. a lista: 2 pecas na ordem, 1 sem tecido, 1 sem etiqueta, sem desenho';

  -- 7. a referencia sabe em que kit entra
  select count(*) into n from public.peca_do_kit_na_lista where referencia_id = baixo and kit_id = kit and kit_nome = 'KIT DA PROVA 051' and papel = 'Parte de baixo';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 7. a referencia diz em que kit entra, e com que papel';

  -- 8. quem edita sem ser chefia salva a ficha do kit que existe
  perform set_config('request.jwt.claim.sub', e::text, true);
  set local role authenticated;
  kit2 := public.salvar_kit(kit, jsonb_build_object('nome', 'KIT DA PROVA 051 B', 'pecas', jsonb_build_array(
    peca_cima, peca_baixo || jsonb_build_object('etiqueta', 'sem', 'tecidos', jsonb_build_array(jsonb_build_object('parte', 'A peça inteira', 'tecido_id', pano))))));
  reset role;
  select count(*) into n from public.kit_na_ficha where id = kit and nome = 'KIT DA PROVA 051 B' and pecas = 2 and pecas_sem_tecido = 0 and pecas_sem_etiqueta = 0;
  txt := txt || E'\n' || case when kit2 = kit and n = 1 then 'ok  ' else 'RUIM' end || ' 8. quem edita sem ser chefia salva o kit que existe: nome novo, e nada mais faltando';

  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;

  -- 9. as pecas nao mudam depois de criado
  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(peca_cima, jsonb_build_object('referencia_id', fem))));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 9. trocar uma peca do kit que existe e recusado';

  -- 10. nem a ordem delas
  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(peca_baixo, peca_cima)));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 10. trocar a ordem das pecas e recusado (o codigo mudaria)';

  -- 11. o mesmo kit de novo
  recusou := false;
  begin perform public.salvar_kit(null, ficha); exception when others then recusou := sqlstate = '23505'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 11. criar de novo um kit com as mesmas pecas e recusado';

  -- 12. genero misto vira unissex
  kit2 := public.salvar_kit(null, jsonb_build_object('nome', 'KIT MISTO DA PROVA 051', 'pecas', jsonb_build_array(
    jsonb_build_object('referencia_id', fem), jsonb_build_object('referencia_id', baixo))));
  reset role;
  select genero, cod into t, txt from (select genero, txt || E'\n' || case when genero = 'U' and cod = 'FT-KIT-998-003F-998-002M' then 'ok  ' else 'RUIM' end
         || ' 12. pecas de generos diferentes: o kit nasce unissex (' || genero || ', ' || cod || ')' as cod from public.referencia where id = kit2) x;
  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;

  -- 13 a 22. as recusas
  recusou := false;
  begin perform public.salvar_kit(null, jsonb_build_object('nome', 'UM SO', 'pecas', jsonb_build_array(peca_cima)));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 13. kit de uma peca so e recusado';

  recusou := false;
  begin perform public.salvar_kit(null, jsonb_build_object('nome', 'KIT DE KIT', 'pecas', jsonb_build_array(peca_cima, jsonb_build_object('referencia_id', outro_kit))));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 14. kit dentro de kit e recusado';

  recusou := false;
  begin perform public.salvar_kit(null, jsonb_build_object('nome', 'REPETIDO', 'pecas', jsonb_build_array(peca_cima, peca_cima)));
  exception when others then recusou := sqlstate = '23505'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 15. a mesma peca duas vezes e recusada';

  recusou := false;
  begin perform public.salvar_kit(null, jsonb_build_object('nome', 'SEM CODIGO', 'pecas', jsonb_build_array(peca_cima, jsonb_build_object('referencia_id', semcod))));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 16. peca sem codigo e recusada';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(
    peca_cima || jsonb_build_object('tecidos', jsonb_build_array(
      jsonb_build_object('parte', 'Mangas', 'tecido_id', pano), jsonb_build_object('parte', ' mangas', 'tecido_id', pano2))), peca_baixo)));
  exception when others then recusou := sqlstate = '23505'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 17. a mesma parte com dois tecidos e recusada, sem olhar maiuscula nem espaco';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(
    peca_cima || jsonb_build_object('tecidos', jsonb_build_array(jsonb_build_object('parte', 'Mangas', 'tecido_id', gen_random_uuid()))), peca_baixo)));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 18. tecido que nao esta no catalogo e recusado';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(
    peca_cima || jsonb_build_object('design', jsonb_build_array(jsonb_build_object('tecnica', 'laser', 'onde', 'x'))), peca_baixo)));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 19. tecnica que nao existe e recusada';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(
    peca_cima || jsonb_build_object('design', jsonb_build_array(jsonb_build_object('tecnica', 'dtf'), jsonb_build_object('tecnica', 'dtf'))), peca_baixo)));
  exception when others then recusou := sqlstate = '23505'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 20. a mesma tecnica duas vezes e recusada';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'X', 'pecas', jsonb_build_array(peca_cima || jsonb_build_object('etiqueta', 'bordada'), peca_baixo)));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 21. etiqueta que nao e silk, DTF, sublimacao nem nenhuma e recusada';

  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_build_object('nome', 'SO O NOME'));
  exception when others then recusou := sqlstate = '22023'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 22. kit pela metade (sem as pecas) e recusado';

  recusou := false;
  begin perform public.salvar_kit(cima, ficha);
  exception when others then recusou := sqlstate = 'P0002'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 23. salvar como kit uma referencia que nao e kit e recusado';

  -- 24. depois das recusas o kit continua o do passo 8
  reset role;
  select count(*) into n from public.peca_do_kit where kit_id = kit;
  select n + count(*) into n from public.referencia where id = kit and nome = 'KIT DA PROVA 051 B';
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 24. depois das recusas o kit continua o mesmo (2 pecas, o mesmo nome)';

  -- 25. o desenho do kit entra pelo mesmo caminho do molde
  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;
  perform public.salvar_molde_da_referencia(kit, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>');
  select tem_desenho into b from public.kit_na_ficha where id = kit;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 25. o desenho do kit entra, e a lista passa a dizer que tem';

  -- 26. o vendedor le o kit
  perform set_config('request.jwt.claim.sub', v::text, true);
  select count(*) into n from public.peca_do_kit_na_lista where kit_id = kit;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 26. o vendedor le as pecas do kit (2)';

  -- 27 e 28. apagar a peca tira ela do kit; apagar o kit leva as pecas dele
  reset role;
  delete from public.referencia where id = baixo;
  select count(*) into n from public.peca_do_kit where kit_id = kit;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 27. apagar a referencia tira a peca do kit (sobrou 1)';
  delete from public.referencia where id = kit;
  select count(*) into n from public.peca_do_kit where kit_id = kit;
  select n + count(*) into n from public.molde_da_referencia where referencia_id = kit;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 28. apagar o kit leva as pecas e o desenho dele';

  raise exception E'\nPROVA DOS KITS (051)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
