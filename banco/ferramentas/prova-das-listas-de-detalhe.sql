-- ===========================================================================
-- A PROVA DA 058: as listas dos detalhes da peca, e o kit que escolhe por cima
-- da referencia.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria as proprias referencias, o proprio tecido, as proprias pessoas e o
-- proprio papel. Os itens que ela poe nas listas tem "DA PROVA 058" no nome.
-- Toda vez que salva uma lista ela manda JUNTO os itens que ja existiam, na
-- ordem em que estavam: a lista de verdade nao perde nada nem durante a prova.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente: cria kit e salva
  e uuid := gen_random_uuid();  -- edita a ficha, sem ser chefia
  v uuid := gen_random_uuid();  -- vendedor: so ve
  cima uuid; baixo uuid; solta uuid;
  pano uuid;
  kit uuid;
  a uuid; b uuid; c uuid; d uuid; x uuid;
  antes jsonb;      -- os itens que a lista de golas ja tinha, como o editor mandaria
  mangas int;       -- quantos itens a lista de mangas tinha
  lista jsonb;
  ficha jsonb;
  r record;
  n int;
  recusou boolean;
  txt text := '';
begin
  insert into public.papel_do_sistema (chave, nome) values ('prova_lista', 'Edita ficha na prova 058') on conflict do nothing;
  insert into public.permissao (papel, painel, ver, editar) values ('prova_lista', 'produtos', true, true)
    on conflict (papel, painel) do update set ver = true, editar = true;
  insert into public.convite (email, papel) values
    ('prova-lg@prova.test', 'gerente'), ('prova-le@prova.test', 'prova_lista'), ('prova-lv@prova.test', 'vendedor');
  insert into auth.users (id, email) values (g, 'prova-lg@prova.test'), (e, 'prova-le@prova.test'), (v, 'prova-lv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-lg@prova.test'),
    (e, 'Editor da Prova', 'prova_lista', 'aprovado', 'prova-le@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-lv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;
  insert into public.permissao (papel, painel, ver, editar, deletar, total) values ('vendedor', 'produtos', true, false, false, false)
    on conflict (papel, painel) do update set ver = true, editar = false, deletar = false, total = false;

  insert into public.referencia (cod, nome, genero, detalhes) values
    ('FT-997-001M', 'CAMISETA DA PROVA 058', 'M', '{"gola": "Gola A DA PROVA 058", "manga": "Manga DA PROVA 058"}') returning id into cima;
  insert into public.referencia (cod, nome, genero, detalhes) values
    ('FT-997-002M', 'CALCAO DA PROVA 058', 'M', '{"gola": "gola a da prova 058"}') returning id into baixo;
  insert into public.referencia (cod, nome, genero, detalhes) values
    ('FT-997-003M', 'REGATA DA PROVA 058', 'M', '{"gola": "Gola B DA PROVA 058"}') returning id into solta;
  insert into public.tecido (nome) values ('TECIDO DA PROVA 058') returning id into pano;

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) order by i.ordem, i.nome), '[]'::jsonb)
    into antes from public.item_de_detalhe i where i.detalhe = 'gola';
  select count(*) into mangas from public.item_de_detalhe where detalhe = 'manga';

  -- 1. quem so ve nao acrescenta item
  perform set_config('request.jwt.claim.sub', v::text, true);
  recusou := false;
  begin perform public.adicionar_item_de_detalhe('gola', 'Gola do Vendedor DA PROVA 058');
  exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 1. o vendedor, que so ve, nao acrescenta item';

  -- 2. quem edita a ficha acrescenta, e o item entra no fim da lista
  perform set_config('request.jwt.claim.sub', e::text, true);
  a := public.adicionar_item_de_detalhe('gola', '  Gola A DA PROVA 058  ');
  select * into r from public.item_de_detalhe where id = a;
  txt := txt || E'\n' || case when r.nome = 'Gola A DA PROVA 058' and r.detalhe = 'gola'
                               and r.ordem = (select max(ordem) from public.item_de_detalhe where detalhe = 'gola')
                              then 'ok  ' else 'RUIM' end
             || ' 2. o item entra aparado, na lista certa e no fim dela';

  -- 3. o mesmo nome, escrito de outro jeito, devolve o item que ja existe
  x := public.adicionar_item_de_detalhe('gola', 'GOLA A da prova 058');
  select count(*) into n from public.item_de_detalhe where detalhe = 'gola' and lower(nome) = 'gola a da prova 058';
  txt := txt || E'\n' || case when x = a and n = 1 then 'ok  ' else 'RUIM' end
             || ' 3. o mesmo nome em outra caixa nao vira segundo item (' || n || ')';

  -- 4. o que nao entra: lista que nao existe, nome vazio, nome comprido
  recusou := false;
  begin perform public.adicionar_item_de_detalhe('bolso', 'Faca'); exception when invalid_parameter_value then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 4. lista que nao existe e recusada';
  recusou := false;
  begin perform public.adicionar_item_de_detalhe('gola', '   '); exception when check_violation then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 4b. item sem nome e recusado';
  recusou := false;
  begin perform public.adicionar_item_de_detalhe('gola', repeat('x', 201)); exception when check_violation then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 4c. nome com mais de 200 letras e recusado';

  -- 5. a view diz quem usa: duas referencias (em caixas diferentes) e nenhum kit
  select * into r from public.item_de_detalhe_na_lista where id = a;
  txt := txt || E'\n' || case when r.referencias = 2 and r.kits = 0 then 'ok  ' else 'RUIM' end
             || ' 5. a lista conta as 2 referencias que usam o item, escrito de qualquer jeito (' || r.referencias || ', ' || r.kits || ')';

  -- 6. o kit escolhe por cima: so o que foi preenchido fica guardado, aparado
  perform set_config('request.jwt.claim.sub', g::text, true);
  b := public.adicionar_item_de_detalhe('gola', 'Gola B DA PROVA 058');
  ficha := jsonb_build_object('nome', 'KIT DA PROVA 058', 'pecas', jsonb_build_array(
    jsonb_build_object('referencia_id', cima, 'papel', 'Parte de cima',
      'tecidos', jsonb_build_array(jsonb_build_object('parte', 'A peça inteira', 'tecido_id', pano)),
      'detalhes', jsonb_build_object('gola', '  Gola B DA PROVA 058 ', 'punho', '   ', 'costura', 'Costura DA PROVA 058')),
    jsonb_build_object('referencia_id', baixo, 'papel', 'Parte de baixo')));
  kit := public.salvar_kit(null, ficha);
  select * into r from public.peca_do_kit_na_lista where kit_id = kit and referencia_id = cima;
  txt := txt || E'\n' || case when r.detalhes_do_kit = '{"gola": "Gola B DA PROVA 058", "costura": "Costura DA PROVA 058"}'::jsonb
                               and r.detalhes ->> 'gola' = 'Gola A DA PROVA 058' and r.detalhes ->> 'manga' = 'Manga DA PROVA 058'
                              then 'ok  ' else 'RUIM' end
             || ' 6. o kit guarda a gola e a costura dele; o punho em branco nao fica; a referencia continua com a dela (' || r.detalhes_do_kit::text || ')';
  select * into r from public.peca_do_kit_na_lista where kit_id = kit and referencia_id = baixo;
  txt := txt || E'\n' || case when r.detalhes_do_kit = '{}'::jsonb then 'ok  ' else 'RUIM' end
             || ' 6b. a peca que veio sem detalhes (a tela de antes) grava vazio: vale o da referencia';
  select referencia.detalhes into lista from public.referencia where id = cima;
  txt := txt || E'\n' || case when lista ->> 'gola' = 'Gola A DA PROVA 058' then 'ok  ' else 'RUIM' end
             || ' 6c. escolher no kit nao escreve na referencia';

  -- 7. o que o kit nao aceita
  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_set(ficha, '{pecas,0,detalhes}', '{"bolso": "faca"}'));
  exception when invalid_parameter_value then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 7. detalhe que nao existe e recusado no kit';
  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_set(ficha, '{pecas,0,detalhes}', jsonb_build_object('gola', repeat('x', 201))));
  exception when check_violation then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 7b. detalhe com mais de 200 letras e recusado no kit';
  recusou := false;
  begin perform public.salvar_kit(kit, jsonb_set(ficha, '{pecas,0,detalhes}', '["gola"]'));
  exception when invalid_parameter_value then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 7c. detalhes em formato errado sao recusados no kit';
  select count(*) into n from public.peca_do_kit where kit_id = kit;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 7d. a recusa nao desfaz o kit que estava salvo (' || n || ' pecas)';

  -- 8. a lista conta tambem a peca de kit que usa o item
  select * into r from public.item_de_detalhe_na_lista where id = b;
  txt := txt || E'\n' || case when r.referencias = 1 and r.kits = 1 then 'ok  ' else 'RUIM' end
             || ' 8. a lista conta a referencia e a peca de kit que usam o item (' || r.referencias || ', ' || r.kits || ')';

  -- 9. o vendedor nao salva as listas
  perform set_config('request.jwt.claim.sub', v::text, true);
  recusou := false;
  begin perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', antes));
  exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 9. o vendedor nao salva as listas';

  -- 10. o editor: muda a ordem, muda um nome e poe um item novo, de uma vez
  perform set_config('request.jwt.claim.sub', e::text, true);
  lista := jsonb_build_array(
             jsonb_build_object('nome', 'Gola C DA PROVA 058'),
             jsonb_build_object('id', b, 'nome', 'Gola B DA PROVA 058'),
             jsonb_build_object('id', a, 'nome', 'Gola A nova DA PROVA 058')) || antes;
  n := public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista));
  select id into c from public.item_de_detalhe where detalhe = 'gola' and nome = 'Gola C DA PROVA 058';
  txt := txt || E'\n' || case when c is not null
                               and (select ordem from public.item_de_detalhe where id = c) = 0
                               and (select ordem from public.item_de_detalhe where id = b) = 1
                               and (select ordem from public.item_de_detalhe where id = a) = 2
                               and (select nome from public.item_de_detalhe where id = a) = 'Gola A nova DA PROVA 058'
                               and n = jsonb_array_length(lista)
                              then 'ok  ' else 'RUIM' end
             || ' 10. o editor grava a ordem nova, o nome novo e o item novo de uma vez';
  txt := txt || E'\n' || case when (select count(*) from public.item_de_detalhe where detalhe = 'gola') = jsonb_array_length(lista)
                               and not exists (select 1 from jsonb_array_elements(antes) i
                                                where not exists (select 1 from public.item_de_detalhe z
                                                                   where z.id = (i ->> 'id')::uuid and z.nome = i ->> 'nome'))
                              then 'ok  ' else 'RUIM' end
             || ' 10b. os ' || jsonb_array_length(antes) || ' itens que a lista ja tinha continuam la, com o mesmo nome';

  -- 11. mudar o nome muda o texto em quem usava, escrito de qualquer jeito, e em mais ninguem
  txt := txt || E'\n' || case when (select detalhes ->> 'gola' from public.referencia where id = cima) = 'Gola A nova DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = baixo) = 'Gola A nova DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = solta) = 'Gola B DA PROVA 058'
                               and (select detalhes ->> 'manga' from public.referencia where id = cima) = 'Manga DA PROVA 058'
                              then 'ok  ' else 'RUIM' end
             || ' 11. o nome novo vai para as 2 referencias que usavam o item; a outra e a manga ficam como estavam';

  -- 12. o nome novo vai tambem para a peca de kit que usava
  lista := jsonb_build_array(
             jsonb_build_object('id', c, 'nome', 'Gola C DA PROVA 058'),
             jsonb_build_object('id', b, 'nome', 'Gola B nova DA PROVA 058'),
             jsonb_build_object('id', a, 'nome', 'Gola A nova DA PROVA 058')) || antes;
  perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista));
  txt := txt || E'\n' || case when (select detalhes ->> 'gola' from public.peca_do_kit where kit_id = kit and referencia_id = cima) = 'Gola B nova DA PROVA 058'
                               and (select detalhes ->> 'costura' from public.peca_do_kit where kit_id = kit and referencia_id = cima) = 'Costura DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = solta) = 'Gola B nova DA PROVA 058'
                              then 'ok  ' else 'RUIM' end
             || ' 12. o nome novo vai para a peca do kit e para a referencia que usavam; a costura do kit fica';

  -- 13. dois itens trocam de nome entre si, e cada referencia segue o seu item
  lista := jsonb_build_array(
             jsonb_build_object('id', c, 'nome', 'Gola C DA PROVA 058'),
             jsonb_build_object('id', b, 'nome', 'Gola A nova DA PROVA 058'),
             jsonb_build_object('id', a, 'nome', 'Gola B nova DA PROVA 058')) || antes;
  perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista));
  txt := txt || E'\n' || case when (select nome from public.item_de_detalhe where id = a) = 'Gola B nova DA PROVA 058'
                               and (select nome from public.item_de_detalhe where id = b) = 'Gola A nova DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = cima) = 'Gola B nova DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = solta) = 'Gola A nova DA PROVA 058'
                              then 'ok  ' else 'RUIM' end
             || ' 13. dois itens trocam de nome entre si sem se atropelar, e cada referencia segue o seu';

  -- 14. tirar um item da lista nao apaga o texto de quem usava
  lista := jsonb_build_array(
             jsonb_build_object('id', c, 'nome', 'Gola C DA PROVA 058'),
             jsonb_build_object('id', b, 'nome', 'Gola A nova DA PROVA 058')) || antes;
  perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista));
  txt := txt || E'\n' || case when not exists (select 1 from public.item_de_detalhe where id = a)
                               and (select detalhes ->> 'gola' from public.referencia where id = cima) = 'Gola B nova DA PROVA 058'
                               and (select detalhes ->> 'gola' from public.referencia where id = baixo) = 'Gola B nova DA PROVA 058'
                              then 'ok  ' else 'RUIM' end
             || ' 14. o item sai da lista e as referencias que o usavam continuam com o texto';

  -- 15. a lista que nao veio nao e mexida
  txt := txt || E'\n' || case when (select count(*) from public.item_de_detalhe where detalhe = 'manga') = mangas
                              then 'ok  ' else 'RUIM' end
             || ' 15. salvar as golas nao mexe na lista de mangas (' || mangas || ' itens)';

  -- 16. o que o editor nao aceita, e a recusa nao deixa nada pela metade
  recusou := false;
  begin perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista || jsonb_build_array(
          jsonb_build_object('nome', 'Gola D DA PROVA 058'), jsonb_build_object('nome', 'gola d da prova 058'))));
  exception when unique_violation then recusou := true; end;
  txt := txt || E'\n' || case when recusou and not exists (select 1 from public.item_de_detalhe where nome ilike 'gola d da prova 058')
                              then 'ok  ' else 'RUIM' end || ' 16. o mesmo nome duas vezes e recusado, e nenhum dos dois entra';
  recusou := false;
  begin perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista || jsonb_build_array(jsonb_build_object('nome', '  '))));
  exception when check_violation then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 16b. item sem nome e recusado';
  d := public.adicionar_item_de_detalhe('manga', 'Manga DA PROVA 058');
  recusou := false;
  begin perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', lista || jsonb_build_array(jsonb_build_object('id', d, 'nome', 'Manga na gola DA PROVA 058'))));
  exception when no_data_found then recusou := true; end;
  txt := txt || E'\n' || case when recusou and (select nome from public.item_de_detalhe where id = d) = 'Manga DA PROVA 058'
                              then 'ok  ' else 'RUIM' end || ' 16c. item de outra lista nao entra nesta';
  recusou := false;
  begin perform public.salvar_listas_de_detalhe('{"bolso": []}'::jsonb);
  exception when invalid_parameter_value then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 16d. lista que nao existe e recusada';
  recusou := false;
  begin perform public.salvar_listas_de_detalhe(jsonb_build_object('gola', 'Redonda'));
  exception when invalid_parameter_value then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 16e. lista em formato errado e recusada';

  -- 17. ninguem escreve na tabela por fora, e quem nao entrou nao chama as funcoes
  set local role authenticated;
  recusou := false;
  begin insert into public.item_de_detalhe (detalhe, nome) values ('gola', 'Por fora DA PROVA 058');
  exception when insufficient_privilege then recusou := true; end;
  reset role;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 17. ninguem escreve na lista por fora das funcoes';
  recusou := false;
  begin
    set local role anon;
    perform public.adicionar_item_de_detalhe('gola', 'Do anonimo DA PROVA 058');
    reset role;
  exception when insufficient_privilege then reset role; recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 17b. quem nao entrou no sistema nao acrescenta item';

  -- 18. o vendedor le as listas, com a contagem
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  select count(*) into n from public.item_de_detalhe_na_lista where nome like '%DA PROVA 058';
  reset role;
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 18. o vendedor le as listas (' || n || ' itens da prova)';

  -- 19. salvar o kit de novo sem os detalhes limpa a escolha: volta a valer a referencia
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform public.salvar_kit(kit, jsonb_set(ficha, '{pecas,0}', (ficha -> 'pecas' -> 0) - 'detalhes'));
  select detalhes into lista from public.peca_do_kit where kit_id = kit and referencia_id = cima;
  txt := txt || E'\n' || case when lista = '{}'::jsonb then 'ok  ' else 'RUIM' end
             || ' 19. o kit salvo sem detalhes fica em branco: volta a valer o da referencia';

  raise exception E'\nPROVA DAS LISTAS DE DETALHE E DO KIT QUE ESCOLHE (058)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
