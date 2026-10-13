-- ===========================================================================
-- A PROVA DA 077: as regras de escrever perguntam a matriz.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito (inclusive a mexida na
-- matriz do passo 6). Cria os proprios dados, com "PROVA 077" no nome.
-- ===========================================================================
do $$
declare
  v uuid := gen_random_uuid();  -- vendedor
  o uuid := gen_random_uuid();  -- producao
  e uuid := gen_random_uuid();  -- estoquista
  ld uuid; cl uuid; ct uuid;
  n int; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-77v@prova.test', 'vendedor'), ('prova-77o@prova.test', 'producao'), ('prova-77e@prova.test', 'estoquista');
  insert into auth.users (id, email) values
    (v, 'prova-77v@prova.test'), (o, 'prova-77o@prova.test'), (e, 'prova-77e@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (v, 'Dani da Prova 077', 'vendedor', 'aprovado', 'prova-77v@prova.test'),
    (o, 'Operador da Prova 077', 'producao', 'aprovado', 'prova-77o@prova.test'),
    (e, 'Estoquista da Prova 077', 'estoquista', 'aprovado', 'prova-77e@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome, paineis = null;

  -- 1. o vendedor (edita o funil, os clientes e a cotacao pela matriz) escreve
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  insert into public.lead (nome, vendedor_id) values ('Lead PROVA 077', v) returning id into ld;
  insert into public.cliente (nome) values ('Cliente PROVA 077') returning id into cl;
  insert into public.cotacao (numero, corpo, versao_do_formato) values ('CO-PROVA-077', '{}'::jsonb, 6) returning id into ct;
  update public.lead set nome = 'Lead PROVA 077 b' where id = ld;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when ld is not null and cl is not null and ct is not null and n = 1 then 'ok  ' else 'RUIM' end
         || ' 1. o vendedor cria lead, cliente e cotacao e muda o lead (pela matriz)';

  -- 2. o vendedor nao mexe no material (nao edita o estoque)
  b := false;
  begin
    insert into public.material (categoria, nome, unidade) values ('insumo', 'SACO PROVA 077', 'un');
  exception when insufficient_privilege then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 2. o vendedor nao cria material';

  -- 3. a producao nao cria lead nem cliente
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  b := false;
  begin
    insert into public.lead (nome) values ('Lead PROVA 077 producao');
  exception when insufficient_privilege then b := true;
  end;
  update public.cliente set nome = 'mexido' where id = cl;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when b and n = 0 then 'ok  ' else 'RUIM' end || ' 3. a producao nao cria lead nem muda cliente';

  -- 4. a estoquista cria e muda material
  perform set_config('request.jwt.claim.sub', e::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  insert into public.material (categoria, nome, unidade) values ('insumo', 'SACO PROVA 077', 'un');
  update public.material set minimo = 5 where nome = 'SACO PROVA 077';
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 4. a estoquista cria e muda material';

  -- 5. o vendedor apaga a propria cotacao (deletar na Cotacao)
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  delete from public.cotacao where id = ct;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when n = (select case when deletar then 1 else 0 end from public.permissao where papel = 'vendedor' and painel = 'cotacao') then 'ok  ' else 'RUIM' end
         || ' 5. apagar cotacao segue o "deletar" da matriz (' || n || ')';

  -- 6. A MATRIZ MANDA: tirando o "editar" do Funil do vendedor, ele para de mexer no lead
  reset role;
  update public.permissao set editar = false, deletar = false, total = false where papel = 'vendedor' and painel = 'funil';
  set local role authenticated;
  update public.lead set nome = 'nao pode' where id = ld;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 6. tirar o editar do Funil na matriz tira a escrita do lead no banco';

  -- 7. a lista propria da pessoa tambem vale: sem a pagina Clientes, nao cria cliente
  reset role;
  update public.pessoa set paineis = array['funil', 'cotacao'] where id = v;
  set local role authenticated;
  b := false;
  begin
    insert into public.cliente (nome) values ('Cliente PROVA 077 b');
  exception when insufficient_privilege then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 7. a lista propria de paginas da pessoa tambem vale no banco';

  -- 8. apagar cliente continua so do admin
  reset role;
  update public.pessoa set paineis = null where id = v;
  set local role authenticated;
  delete from public.cliente where id = cl;
  get diagnostics n = row_count;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 8. apagar cliente continua so do admin';
  reset role;

  raise exception E'\nPROVA DAS REGRAS NA MATRIZ (077)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
