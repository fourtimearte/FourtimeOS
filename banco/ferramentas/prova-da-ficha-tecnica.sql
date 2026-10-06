-- ===========================================================================
-- A PROVA DA 050: a ficha tecnica da referencia.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria a propria referencia, o proprio tecido e as proprias pessoas. Nada
-- do cadastro de verdade e tocado.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente, que edita
  v uuid := gen_random_uuid();  -- vendedor, que so ve
  r uuid; pano uuid; pano_sem uuid; mat uuid;
  ficha jsonb;
  n int; a numeric; mt numeric; kg numeric;
  quando timestamptz;
  recusou boolean;
  msg text;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-fg@prova.test', 'gerente'), ('prova-fv@prova.test', 'vendedor');
  insert into auth.users (id, email) values (g, 'prova-fg@prova.test'), (v, 'prova-fv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-fg@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-fv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  insert into public.referencia (cod, nome, genero) values ('FT-999-999M', 'PECA DA PROVA 050', 'M') returning id into r;
  insert into public.tecido (nome, gramatura, largura) values ('TECIDO DA PROVA 050', 180, 1.6) returning id into pano;
  insert into public.tecido (nome) values ('TECIDO SEM MEDIDA DA PROVA 050') returning id into pano_sem;
  insert into public.material (categoria, nome, unidade, grupo) values ('insumo', 'Saco da Prova 050', 'un', 'Prova') returning id into mat;
  /* um consumo antigo, em metros, no tamanho M: e o que a area tem de vencer */
  insert into public.consumo_da_referencia (referencia_id, tamanho, metros) values (r, 'M', 9);
  /* e um em quilos num tamanho que a ficha nao vai preencher */
  insert into public.consumo_da_referencia (referencia_id, tamanho, quilos) values (r, 'G4', 0.5);

  ficha := jsonb_build_object(
    'nome', 'PECA DA PROVA 050',
    'detalhes', jsonb_build_object('gola', 'Redonda', 'manga', 'Curta', 'punho', '  '),
    'observacao', 'reforço de ombro',
    'tamanhos', jsonb_build_array('G', 'P', 'M'),
    'medidas', jsonb_build_array(
      jsonb_build_object('nome', 'Comprimento', 'como_medir', 'do ombro à barra', 'valores', jsonb_build_object('P', 68, 'M', 70, 'G', 72)),
      jsonb_build_object('nome', 'Largura', 'valores', jsonb_build_object('P', 50, 'M', 53))),
    'partes', jsonb_build_array(
      jsonb_build_object('nome', 'Frente', 'vezes', 1, 'unidade', 'm2', 'quantidades', jsonb_build_object('P', 0.4, 'M', 0.5)),
      jsonb_build_object('nome', 'Mangas', 'vezes', 2, 'unidade', 'm2', 'quantidades', jsonb_build_object('P', 0.3, 'M', 0.7)),
      jsonb_build_object('nome', 'Ribana da gola', 'vezes', 1, 'unidade', 'm', 'quantidades', jsonb_build_object('P', 0.04, 'M', 0.04, 'G', 0.05))),
    'materiais', jsonb_build_array(
      jsonb_build_object('material_id', mat, 'nome', 'Saco da Prova 050', 'quantidade', 1, 'unidade', 'un'),
      jsonb_build_object('nome', 'Linha na cor do tecido', 'quantidade', 0.02, 'unidade', 'cone')));

  -- 1. quem so ve nao salva
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 1. o vendedor, que so ve, nao salva a ficha';

  -- 2. e nao escreve nas tabelas por fora
  recusou := false;
  begin insert into public.medida_da_referencia (referencia_id, nome) values (r, 'Por fora'); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 2. ninguem escreve na tabela de medidas por fora da funcao';

  -- 3. o gerente salva, e a ficha inteira entra
  perform set_config('request.jwt.claim.sub', g::text, true);
  quando := public.salvar_ficha_da_referencia(r, ficha);
  select count(*) into n from (
    select 1 from public.medida_da_referencia where referencia_id = r
    union all select 1 from public.parte_da_referencia where referencia_id = r
    union all select 1 from public.material_da_referencia where referencia_id = r) x;
  txt := txt || E'\n' || case when n = 7 and quando is not null then 'ok  ' else 'RUIM' end
             || ' 3. o gerente salva: 2 medidas, 3 partes e 2 aviamentos (' || n || ' linhas)';

  -- 4. a grade fica na ordem da fabrica, e o detalhe em branco nao e guardado
  select (tamanhos = array['P','M','G']) and not (detalhes ? 'punho') and detalhes ->> 'gola' = 'Redonda' and ficha_em is not null
    into recusou from public.referencia where id = r;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 4. grade na ordem P, M, G; detalhe em branco fora; ficha_em preenchido';

  -- 5. a area e a soma das partes de pano; a ribana, em metros, fica de fora
  select area into a from public.consumo_da_referencia where referencia_id = r and tamanho = 'M';
  txt := txt || E'\n' || case when a = 1.2 then 'ok  ' else 'RUIM' end || ' 5. area do M = 0,5 + 0,7 = 1,2 m2, sem a ribana (' || coalesce(a::text, 'nula') || ')';

  -- 6. tamanho sem nenhuma parte de pano fica sem area, e nao com zero
  select count(*) into n from public.consumo_da_referencia where referencia_id = r and tamanho = 'G';
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 6. o G, que so tem ribana, nao ganha linha de consumo';

  -- 7. a area vence os metros antigos quando o tecido tem as medidas
  select metros, quilos into mt, kg from public.consumo_da_peca(r, 'M', pano);
  txt := txt || E'\n' || case when mt = 0.75 and kg = 0.216 then 'ok  ' else 'RUIM' end
             || ' 7. com tecido de 1,60 m e 180 g: 1,2 m2 da 0,75 m e 0,216 kg (' || coalesce(mt::text, '?') || ', ' || coalesce(kg::text, '?') || ')';

  -- 8. sem largura nem gramatura, vale o que estava cadastrado antes
  select metros, quilos into mt, kg from public.consumo_da_peca(r, 'M', pano_sem);
  txt := txt || E'\n' || case when mt = 9 and kg is null then 'ok  ' else 'RUIM' end
             || ' 8. tecido sem medida: voltam os 9 m antigos e quilo nulo (' || coalesce(mt::text, '?') || ', ' || coalesce(kg::text, 'nulo') || ')';

  -- 9. o consumo em quilos de um tamanho fora da ficha continua la
  select quilos into kg from public.consumo_da_referencia where referencia_id = r and tamanho = 'G4';
  txt := txt || E'\n' || case when kg = 0.5 then 'ok  ' else 'RUIM' end || ' 9. o G4 antigo, em quilos, nao foi tocado';

  -- 10. a view da lista conta o que tem numero
  select (medidas = 2 and partes_com_tecido = 3 and materiais = 2 and not tem_molde) into recusou
    from public.referencia_na_ficha where id = r;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 10. a lista diz 2 medidas, 3 partes, 2 aviamentos e sem molde';

  -- 11. salvar de novo troca tudo: sai uma medida, o P perde o pano, o M sai da grade
  ficha := ficha
    || jsonb_build_object('tamanhos', jsonb_build_array('P', 'G'))
    || jsonb_build_object('medidas', jsonb_build_array(
         jsonb_build_object('nome', 'Comprimento', 'valores', jsonb_build_object('P', 68, 'G', 72))))
    || jsonb_build_object('partes', jsonb_build_array(
         jsonb_build_object('nome', 'Frente', 'vezes', 1, 'unidade', 'm2', 'quantidades', jsonb_build_object('G', 0.6))));
  perform public.salvar_ficha_da_referencia(r, ficha);
  select count(*) into n from public.medida_da_referencia where referencia_id = r;
  select area, metros into a, mt from public.consumo_da_referencia where referencia_id = r and tamanho = 'M';
  recusou := n = 1 and a is null and mt = 9
    and not exists (select 1 from public.consumo_da_referencia where referencia_id = r and tamanho = 'P')
    and (select area from public.consumo_da_referencia where referencia_id = r and tamanho = 'G') = 0.6;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end
             || ' 11. salvar de novo troca tudo: 1 medida; M sem area mas com os 9 m; P some; G com 0,6';

  -- 12 a 17. o que a funcao recusa
  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha - 'partes'); exception when others then recusou := sqlstate = '22023'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 12. ficha pela metade (sem as partes) e recusada';

  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('tamanhos', '[]'::jsonb)); exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 13. grade sem nenhum tamanho e recusada';

  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('tamanhos', jsonb_build_array('P', 'XXG'))); exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 14. tamanho que a fabrica nao usa e recusado';

  recusou := false; msg := '';
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('medidas', jsonb_build_array(
      jsonb_build_object('nome', 'Comprimento', 'valores', jsonb_build_object('M', 70)))));
  exception when others then recusou := sqlstate = '23514'; msg := sqlerrm; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 15. numero em tamanho desligado e recusado, e a mensagem diz qual (' || msg || ')';

  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('medidas', jsonb_build_array(
      jsonb_build_object('nome', 'Manga', 'valores', '{}'::jsonb), jsonb_build_object('nome', ' manga ', 'valores', '{}'::jsonb))));
  exception when others then recusou := sqlstate = '23505'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 16. a mesma medida duas vezes e recusada, sem olhar maiuscula nem espaco';

  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('partes', jsonb_build_array(
      jsonb_build_object('nome', 'Frente', 'vezes', 1, 'unidade', 'm2', 'quantidades', jsonb_build_object('P', -1)))));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 17. area negativa e recusada';

  recusou := false;
  begin perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('materiais', jsonb_build_array(
      jsonb_build_object('nome', 'Linha', 'quantidade', 0, 'unidade', 'cone'))));
  exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 18. aviamento com quantidade zero e recusado';

  /* a recusa nao deixou nada pela metade: a ficha continua a do passo 11 */
  select count(*) into n from public.medida_da_referencia where referencia_id = r;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 19. depois das recusas a ficha continua a mesma (1 medida)';

  -- 20 a 23. o molde
  recusou := false;
  begin perform public.salvar_molde_da_referencia(r, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'); exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 20. SVG com script e recusado';

  recusou := false;
  begin perform public.salvar_molde_da_referencia(r, '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" onclick="x()"/></svg>'); exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 21. SVG com evento (onclick) e recusado';

  recusou := false;
  begin perform public.salvar_molde_da_referencia(r, 'isto nao e um desenho'); exception when others then recusou := sqlstate = '23514'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 22. arquivo que nao e SVG e recusado';

  perform public.salvar_molde_da_referencia(r, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>');
  select tem_molde into recusou from public.referencia_na_ficha where id = r;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 23. SVG limpo entra, e a lista passa a dizer que tem molde';

  perform public.salvar_molde_da_referencia(r, '');
  select not tem_molde into recusou from public.referencia_na_ficha where id = r;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 24. molde vazio tira o molde';

  -- 25. o vendedor le a ficha
  perform set_config('request.jwt.claim.sub', v::text, true);
  select count(*) into n from public.parte_da_referencia where referencia_id = r;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 25. o vendedor le a ficha (1 parte)';

  -- 26 e 27. a linha de consumo que o ensaio semeou: o quilo inventado sai quando a ficha poe a area
  reset role;
  insert into public.consumo_da_referencia (referencia_id, tamanho, quilos, teste) values (r, 'P', 0.1488, true), (r, 'G1', 0.2048, true);
  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;
  perform public.salvar_ficha_da_referencia(r, ficha || jsonb_build_object('partes', jsonb_build_array(
      jsonb_build_object('nome', 'Frente', 'vezes', 1, 'unidade', 'm2', 'quantidades', jsonb_build_object('P', 0.9)))));
  reset role;
  select count(*) into n from public.consumo_da_referencia
   where referencia_id = r and tamanho = 'P' and area = 0.9 and quilos is null and metros is null and not teste;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 26. a linha do ensaio que ganhou area vira de verdade, sem o quilo inventado';
  select count(*) into n from public.consumo_da_referencia
   where referencia_id = r and tamanho = 'G1' and quilos = 0.2048 and area is null and teste;
  delete from public.consumo_da_referencia where teste and referencia_id = r;
  select n + count(*) into n from public.consumo_da_referencia where referencia_id = r and tamanho = 'P' and area = 0.9;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 27. a do ensaio que a ficha nao tocou continua de teste, e limpar o ensaio nao leva a area da ficha';

  raise exception E'\nPROVA DA FICHA TECNICA (050)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
