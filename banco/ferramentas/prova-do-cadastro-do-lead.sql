-- ===========================================================================
-- A PROVA DA 067: o cadastro do cliente que nasce do lead.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Veste uma vendedora e uma
-- pessoa da producao, e chama a funcao como a tela chamaria.
-- ===========================================================================
do $$
declare
  v uuid := gen_random_uuid();  -- vendedora
  p uuid := gen_random_uuid();  -- producao
  sufixo text := substr(md5(random()::text), 1, 8);
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid;
  existente uuid; escolhido uuid;
  c public.cliente;
  b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-67v-' || sufixo || '@prova.test', 'vendedor'), ('prova-67p-' || sufixo || '@prova.test', 'producao');
  insert into auth.users (id, email) values
    (v, 'prova-67v-' || sufixo || '@prova.test'), (p, 'prova-67p-' || sufixo || '@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (v, 'Dani da Prova 67', 'vendedor', 'aprovado', 'prova-67v-' || sufixo || '@prova.test'),
    (p, 'Joana da Prova 67', 'producao', 'aprovado', 'prova-67p-' || sufixo || '@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.lead (nome, contato, telefone, vendedor_id, teste, email)
    values ('Academia Prova ' || sufixo, 'Marcos', '+5562988887777', v, true, 'marcos@prova.test') returning id into l1;
  insert into public.cliente (nome, documento, cidade, uf, celular)
    values ('Escola Prova ' || sufixo, '12345678000190', 'Goiânia', 'GO', '') returning id into existente;
  insert into public.lead (nome, contato, telefone, vendedor_id, teste)
    values ('ESCOLA PROVA ' || upper(sufixo), 'Bia', '+5562977776666', v, true) returning id into l2;
  insert into public.cliente (nome, celular, cidade) values ('Time Escolhido ' || sufixo, '62966665555', 'Anápolis')
    returning id into escolhido;
  insert into public.lead (nome, telefone, vendedor_id, teste)
    values ('Outro Nome ' || sufixo, '+5562966665555', v, true) returning id into l3;
  insert into public.lead (nome, contato, telefone, vendedor_id, teste)
    values ('So Lead ' || sufixo, 'Rafa', '+5562955554444', v, true) returning id into l4;
  insert into public.lead (nome, telefone, teste) values ('Da Producao ' || sufixo, '+5562944443333', true) returning id into l5;

  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. cliente novo com o cadastro inteiro
  c := public.lead_vira_cliente(l1, jsonb_build_object(
    'nome', 'Academia Prova ' || sufixo, 'tipo', 'J', 'documento', '11.222.333/0001-81',
    'contato', 'Marcos', 'celular', '(62) 98888-7777', 'email', '', 'endereco', 'Rua 1, 10',
    'bairro', 'Centro', 'cidade', 'Goiânia', 'uf', 'go', 'cep', '74000-000', 'segmento', 'academia'));
  txt := txt || E'\n' || case when c.documento = '11222333000181' and c.tipo = 'J' and c.celular = '62988887777'
      and c.email = 'marcos@prova.test' and c.uf = 'GO' and c.cep = '74000000' and c.cidade = 'Goiânia'
      and c.segmento = 'academia' and c.teste and c.vendedor_id = v
      and (select cliente_id from public.lead where id = l1) = c.id
    then 'ok  ' else 'RUIM' end || ' 1. cliente novo nasce com o cadastro inteiro, a marca de teste, o vendedor e o lead ligado';

  -- 2. o nome ja existe: liga e so preenche o vazio
  c := public.lead_vira_cliente(l2, jsonb_build_object(
    'nome', 'escola prova ' || sufixo, 'documento', '99999999999', 'celular', '62977776666', 'cidade', 'Trindade', 'email', 'bia@prova.test'));
  txt := txt || E'\n' || case when c.id = existente and c.documento = '12345678000190' and c.cidade = 'Goiânia'
      and c.celular = '62977776666' and c.email = 'bia@prova.test' and c.vendedor_id = v
      and (select count(*) from public.cliente where public.chave_do_nome(nome) = public.chave_do_nome('Escola Prova ' || sufixo)) = 1
    then 'ok  ' else 'RUIM' end || ' 2. nome que ja existe: liga ao mesmo cliente e so preenche o que estava vazio';

  -- 3. ligar a um cliente escolhido na tela, sem mexer no cadastro dele
  c := public.lead_vira_cliente(l3, null, escolhido);
  txt := txt || E'\n' || case when c.id = escolhido and c.nome = 'Time Escolhido ' || sufixo and c.cidade = 'Anápolis'
      and (select cliente_id from public.lead where id = l3) = escolhido
    then 'ok  ' else 'RUIM' end || ' 3. ligar ao cliente escolhido: liga, e o cadastro dele nao muda';

  -- 4. a chamada antiga, so com o lead, continua funcionando
  c := public.lead_vira_cliente(l4);
  txt := txt || E'\n' || case when c.nome = 'So Lead ' || sufixo and c.contato = 'Rafa' and c.celular = '62955554444' and c.teste
    then 'ok  ' else 'RUIM' end || ' 4. so com o lead faz o que fazia antes (nome, contato e celular)';

  -- 5. lead ja ligado a outro cliente nao troca de cliente em silencio
  b := false;
  begin
    perform public.lead_vira_cliente(l1, null, escolhido);
  exception when sqlstate '22023' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 5. lead ja ligado nao troca de cliente em silencio';

  reset role;

  -- 6. a producao nao cadastra cliente
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
  b := false;
  begin
    perform public.lead_vira_cliente(l5, '{"nome":"x"}'::jsonb);
  exception when sqlstate '42501' then b := true;
  end;
  reset role;
  txt := txt || E'\n' || case when b and (select cliente_id from public.lead where id = l5) is null
    then 'ok  ' else 'RUIM' end || ' 6. a producao nao cadastra cliente';

  raise exception E'\nPROVA DO CADASTRO DO LEAD (067)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
