-- ===========================================================================
-- A PROVA DA 052: a escala do molde.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria a propria referencia e as proprias pessoas. Nada do cadastro de
-- verdade e tocado.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente, que edita
  v uuid := gen_random_uuid();  -- vendedor, que so ve
  r uuid; outra uuid;
  n numeric; c int;
  recusou boolean;
  txt text := '';
  um  text := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';
  dois text := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg>';
begin
  insert into public.convite (email, papel) values ('prova-eg@prova.test', 'gerente'), ('prova-ev@prova.test', 'vendedor');
  insert into auth.users (id, email) values (g, 'prova-eg@prova.test'), (v, 'prova-ev@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-eg@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-ev@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;
  insert into public.referencia (cod, nome, genero) values ('FT-999-998M', 'PECA DA PROVA 052', 'M') returning id into r;
  insert into public.referencia (cod, nome, genero) values ('FT-999-997M', 'OUTRA PECA DA PROVA 052', 'M') returning id into outra;

  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;

  -- 1. sem desenho nao ha o que acertar
  recusou := false;
  begin perform public.acertar_escala_do_molde(r, 0.25); exception when others then recusou := sqlstate = 'P0002'; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 1. molde sem desenho nao tem escala para acertar';

  -- 2. o desenho entra sem escala
  perform public.salvar_molde_da_referencia(r, um);
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  txt := txt || E'\n' || case when n is null then 'ok  ' else 'RUIM' end || ' 2. o desenho novo entra sem escala acertada';

  -- 3. acertar guarda, e devolve o que guardou
  n := public.acertar_escala_do_molde(r, 0.25);
  select count(*) into c from public.molde_da_referencia where referencia_id = r and tamanho = '' and cm_por_unidade = 0.25;
  txt := txt || E'\n' || case when n = 0.25 and c = 1 then 'ok  ' else 'RUIM' end || ' 3. acertar a escala guarda o numero no molde';

  -- 4. zero, negativo e absurdo sao recusados, e o que estava fica
  recusou := false;
  begin perform public.acertar_escala_do_molde(r, 0); exception when others then recusou := sqlstate = '23514'; end;
  if recusou then recusou := false; begin perform public.acertar_escala_do_molde(r, -1); exception when others then recusou := sqlstate = '23514'; end; end if;
  if recusou then recusou := false; begin perform public.acertar_escala_do_molde(r, 100.01); exception when others then recusou := sqlstate = '23514'; end; end if;
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  txt := txt || E'\n' || case when recusou and n = 0.25 then 'ok  ' else 'RUIM' end || ' 4. zero, negativo e mais de um metro por unidade sao recusados, e a escala de antes fica';

  -- 5. salvar o MESMO desenho de novo nao derruba a escala
  perform public.salvar_molde_da_referencia(r, um);
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  txt := txt || E'\n' || case when n = 0.25 then 'ok  ' else 'RUIM' end || ' 5. o mesmo desenho enviado de novo mantem a escala';

  -- 6. trocar o desenho derruba a escala
  perform public.salvar_molde_da_referencia(r, dois);
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  select count(*) into c from public.molde_da_referencia where referencia_id = r and tamanho = '' and svg = dois;
  txt := txt || E'\n' || case when n is null and c = 1 then 'ok  ' else 'RUIM' end || ' 6. desenho trocado: o novo entra e a escala acertada cai';

  -- 7. a escala e de cada tamanho
  perform public.salvar_molde_da_referencia(r, um, 'M');
  perform public.acertar_escala_do_molde(r, 0.5, 'M');
  perform public.acertar_escala_do_molde(r, 0.1);
  select count(*) into c from public.molde_da_referencia
   where referencia_id = r and ((tamanho = 'M' and cm_por_unidade = 0.5) or (tamanho = '' and cm_por_unidade = 0.1));
  txt := txt || E'\n' || case when c = 2 then 'ok  ' else 'RUIM' end || ' 7. o molde de um tamanho tem a escala dele, e o geral a dele';

  -- 8. tamanho sem desenho e recusado, e nao cria linha
  recusou := false;
  begin perform public.acertar_escala_do_molde(r, 0.3, 'G'); exception when others then recusou := sqlstate = 'P0002'; end;
  select count(*) into c from public.molde_da_referencia where referencia_id = r;
  txt := txt || E'\n' || case when recusou and c = 2 then 'ok  ' else 'RUIM' end || ' 8. tamanho sem desenho nao ganha escala nem linha';

  -- 9. nulo tira a escala
  n := public.acertar_escala_do_molde(r, null, 'M');
  select count(*) into c from public.molde_da_referencia where referencia_id = r and tamanho = 'M' and cm_por_unidade is null;
  txt := txt || E'\n' || case when n is null and c = 1 then 'ok  ' else 'RUIM' end || ' 9. escala nula tira a acertada, sem mexer no desenho';

  -- 10. a escala de uma referencia nao encosta na outra
  perform public.salvar_molde_da_referencia(outra, um);
  select count(*) into c from public.molde_da_referencia where referencia_id = outra and cm_por_unidade is null;
  txt := txt || E'\n' || case when c = 1 then 'ok  ' else 'RUIM' end || ' 10. a escala de uma referencia nao passa para a outra';

  -- 11. quem so ve nao acerta
  perform set_config('request.jwt.claim.sub', v::text, true);
  recusou := false;
  begin perform public.acertar_escala_do_molde(r, 0.9); exception when insufficient_privilege then recusou := true; end;
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  txt := txt || E'\n' || case when recusou and n = 0.1 then 'ok  ' else 'RUIM' end || ' 11. o vendedor, que so ve, nao acerta a escala';

  -- 12. e le a escala pela tabela, sem o direito de escrever nela
  select count(*) into c from public.molde_da_referencia where referencia_id = r and tamanho = '' and cm_por_unidade = 0.1;
  recusou := false;
  begin update public.molde_da_referencia set cm_por_unidade = 9 where referencia_id = r; exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when c = 1 and recusou then 'ok  ' else 'RUIM' end || ' 12. quem so ve le a escala, e ninguem escreve na tabela por fora da funcao';

  -- 13. tirar o molde leva a escala junto, e o proximo desenho nasce sem ela
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform public.salvar_molde_da_referencia(r, '');
  perform public.salvar_molde_da_referencia(r, dois);
  select cm_por_unidade into n from public.molde_da_referencia where referencia_id = r and tamanho = '';
  txt := txt || E'\n' || case when n is null then 'ok  ' else 'RUIM' end || ' 13. molde tirado e posto de novo nasce sem escala';

  reset role;
  raise exception E'\nPROVA DA ESCALA DO MOLDE (052)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
