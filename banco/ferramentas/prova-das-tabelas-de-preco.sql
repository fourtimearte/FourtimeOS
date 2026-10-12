-- ===========================================================================
-- A PROVA DA 068: as tabelas de preco.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente
  v uuid := gen_random_uuid();  -- vendedora
  sufixo text := substr(md5(random()::text), 1, 6);
  t1 uuid; t2 uuid;
  n int; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-68g-' || sufixo || '@prova.test', 'gerente'), ('prova-68v-' || sufixo || '@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (g, 'prova-68g-' || sufixo || '@prova.test'), (v, 'prova-68v-' || sufixo || '@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova 68', 'gerente', 'aprovado', 'prova-68g-' || sufixo || '@prova.test'),
    (v, 'Dani da Prova 68', 'vendedor', 'aprovado', 'prova-68v-' || sufixo || '@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado';

  -- 1. o gerente cria duas tabelas, e o banco anota quem
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.tabela_de_preco (nome, situacao, itens, teste)
    values ('Prova Atacado ' || sufixo, 'ativa', '[{"codigo":"CT02","tipo":"referencia","base":54.9,"precos":[null,48.9,null,null]}]', true)
    returning id into t1;
  insert into public.tabela_de_preco (nome, teste) values ('Prova Varejo ' || sufixo, true) returning id into t2;
  txt := txt || E'\n' || case when (select atualizado_por from public.tabela_de_preco where id = t1) = g
      and (select faixas->3->>'ate' from public.tabela_de_preco where id = t2) is null
      and (select regras->>'arredondar' from public.tabela_de_preco where id = t2) = '90'
    then 'ok  ' else 'RUIM' end || ' 1. o gerente cria; a tabela nasce com as 4 faixas e as regras; o banco anota quem';

  -- 2. a padrao troca numa chamada so, e so uma fica padrao
  perform public.tabela_de_preco_padrao(t1);
  perform public.tabela_de_preco_padrao(t2);
  txt := txt || E'\n' || case when (select count(*) from public.tabela_de_preco where padrao and nome like 'Prova % ' || sufixo) = 1
      and (select padrao and situacao = 'ativa' from public.tabela_de_preco where id = t2)
    then 'ok  ' else 'RUIM' end || ' 2. trocar a padrao deixa uma so, e ativa';

  -- 3. a padrao nao arquiva; nome repetido (sem caixa) nao entra
  b := false;
  begin
    update public.tabela_de_preco set situacao = 'arquivada' where id = t2;
  exception when check_violation then b := true;
  end;
  begin
    insert into public.tabela_de_preco (nome) values ('PROVA ATACADO ' || upper(sufixo));
    b := false;
  exception when unique_violation then null;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 3. a padrao nao arquiva, e nome repetido nao entra';
  reset role;

  -- 4. a vendedora le, e nao muda nem cria
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.tabela_de_preco where id in (t1, t2);
  update public.tabela_de_preco set nome = 'mexi' where id = t1;
  get diagnostics b = row_count;
  b := not b;
  begin
    insert into public.tabela_de_preco (nome) values ('Da vendedora ' || sufixo);
    b := false;
  exception when insufficient_privilege then null;
  end;
  txt := txt || E'\n' || case when n = 2 and b then 'ok  ' else 'RUIM' end || ' 4. a vendedora le as tabelas e nao muda nem cria';
  reset role;

  raise exception E'\nPROVA DAS TABELAS DE PRECO (068)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
