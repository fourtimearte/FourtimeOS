-- ===========================================================================
-- A PROVA DA 041: fornecedores e conferencia de boleto.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste tres pessoas (admin, estoquista e vendedor) e tenta o que cada
-- uma pode e o que nao pode. A regra mora no banco, entao o teste tambem.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  e uuid := gen_random_uuid();  -- estoquista
  v uuid := gen_random_uuid();  -- vendedor
  f1 uuid; f2 uuid; m uuid; c uuid;
  txt text := '';
  n int;
  r record;
  procedure_ok boolean;
begin
  /* a conta so nasce com convite (003), e a prova respeita a mesma porta */
  insert into public.convite (email, papel) values
    ('prova-a@prova.test', 'admin'), ('prova-e@prova.test', 'estoquista'), ('prova-v@prova.test', 'vendedor');
  insert into auth.users (id, email) values (a, 'prova-a@prova.test'), (e, 'prova-e@prova.test'), (v, 'prova-v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-a@prova.test'),
    (e, 'Estoque da Prova', 'estoquista', 'aprovado', 'prova-e@prova.test'),
    (v, 'Venda da Prova', 'vendedor', 'aprovado', 'prova-v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  -- 1. o estoquista cria fornecedor novo
  perform set_config('request.jwt.claim.sub', e::text, true);
  insert into public.fornecedor (nome, entrou_por) values ('Fornecedor da Prova', 'estoque')
    returning id into f1;
  txt := txt || E'\nok   1. estoquista cria fornecedor novo';

  -- 2. e nao consegue marcar como confiavel
  begin
    update public.fornecedor set situacao = 'confiavel' where id = f1;
    txt := txt || E'\nRUIM 2. estoquista marcou como confiavel';
  exception when insufficient_privilege then
    txt := txt || E'\nok   2. estoquista nao marca como confiavel';
  end;

  -- 3. nem nascer confiavel
  begin
    insert into public.fornecedor (nome, situacao) values ('Nasceu Confiavel da Prova', 'confiavel');
    txt := txt || E'\nRUIM 3. estoquista criou um confiavel';
  exception when insufficient_privilege then
    txt := txt || E'\nok   3. estoquista nao cria confiavel';
  end;

  -- 4. entrada com cinco argumentos continua funcionando, e com seis liga o fornecedor
  insert into public.material (categoria, nome, unidade, minimo, grupo)
    values ('insumo', 'Material da Prova 041', 'un', 10, 'Prova') returning id into m;
  perform public.mexer_no_estoque(m, 5, 'entrada', 'cinco argumentos', null);
  perform public.mexer_no_estoque(m, 7, 'entrada', 'seis argumentos', null, f1);
  select count(*) into n from public.material_fornecedor where material_id = m and fornecedor_id = f1;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end
             || ' 4. entrada com fornecedor liga material e fornecedor (' || n || ')';
  select saldo into n from public.material where id = m;
  txt := txt || E'\n' || case when n = 12 then 'ok  ' else 'RUIM' end
             || ' 4b. saldo 12 depois de 5 + 7 (' || n || ')';
  select count(*) into n from public.movimento_do_estoque where material_id = m and fornecedor = 'Fornecedor da Prova';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end
             || ' 4c. a view do movimento mostra o fornecedor (' || n || ')';
  select count(*) into n from public.material_na_prateleira where id = m and grupo = 'Prova';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end
             || ' 4d. a view do material mostra o grupo (' || n || ')';

  -- 5. o vendedor nao cria fornecedor na mao
  perform set_config('request.jwt.claim.sub', v::text, true);
  begin
    set local role authenticated;
    insert into public.fornecedor (nome) values ('Do Vendedor da Prova');
    reset role;
    txt := txt || E'\nRUIM 5. vendedor criou fornecedor direto na tabela';
  exception when insufficient_privilege or check_violation then
    reset role;
    txt := txt || E'\nok   5. vendedor nao cria fornecedor direto na tabela';
  end;

  -- 6. o vendedor confere um boleto de CNPJ desconhecido dizendo "pode pagar": o banco corrige
  set local role authenticated;
  insert into public.conferencia_de_boleto (linha, beneficiario, cnpj, valor, resultado, situacao)
    values (repeat('1', 47), 'Transportadora da Prova Ltda', '11222333000181', 640, 'pode_pagar', 'conferido')
    returning id into c;
  reset role;
  select * into r from public.conferencia_de_boleto where id = c;
  txt := txt || E'\n' || case when r.resultado = 'precisa_aprovacao' and r.quem = v and r.quem_nome = 'Venda da Prova'
                              then 'ok  ' else 'RUIM' end
             || ' 6. pode_pagar de CNPJ desconhecido vira precisa_aprovacao, com o carimbo de quem conferiu ('
             || r.resultado || ', ' || r.quem_nome || ')';

  -- 7. pedir aprovacao cria o fornecedor na fila
  perform public.pedir_aprovacao_do_boleto(c, 'frete da malha');
  select * into r from public.conferencia_de_boleto where id = c;
  txt := txt || E'\n' || case when r.situacao = 'esperando' and r.motivo = 'frete da malha' then 'ok  ' else 'RUIM' end
             || ' 7. pedir aprovacao poe o boleto esperando, com o motivo (' || r.situacao || ')';
  select * into r from public.fornecedor where cnpj = '11222333000181';
  txt := txt || E'\n' || case when r.situacao = 'esperando' and r.entrou_por = 'boleto' then 'ok  ' else 'RUIM' end
             || ' 7b. e cria o fornecedor esperando, vindo do boleto (' || coalesce(r.situacao, 'nao criou') || ')';
  f2 := r.id;
  begin
    perform public.pedir_aprovacao_do_boleto(c, 'de novo');
    txt := txt || E'\nRUIM 7c. pediu duas vezes';
  exception when check_violation then
    txt := txt || E'\nok   7c. pedir duas vezes nao existe';
  end;

  -- 8. o vendedor nao decide
  begin
    perform public.decidir_o_boleto(c, 'aprovar_e_listar', '');
    txt := txt || E'\nRUIM 8. vendedor aprovou o boleto';
  exception when insufficient_privilege then
    txt := txt || E'\nok   8. vendedor nao aprova boleto';
  end;

  -- 9. o admin aprova e poe na lista
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.decidir_o_boleto(c, 'aprovar_e_listar', 'confirmei com a compra');
  select * into r from public.fornecedor where id = f2;
  txt := txt || E'\n' || case when r.situacao = 'confiavel' and r.aprovado_por = a then 'ok  ' else 'RUIM' end
             || ' 9. admin aprova e o fornecedor vira confiavel (' || r.situacao || ')';
  select * into r from public.conferencia_de_boleto where id = c;
  txt := txt || E'\n' || case when r.situacao = 'aprovado' and r.decidido_por_nome = 'Admin da Prova' then 'ok  ' else 'RUIM' end
             || ' 9b. a conferencia fica aprovada, com o nome de quem decidiu';

  -- 10. decidir duas vezes nao existe
  begin
    perform public.decidir_o_boleto(c, 'recusar', '');
    txt := txt || E'\nRUIM 10. decidiu duas vezes';
  exception when check_violation then
    txt := txt || E'\nok   10. boleto decidido nao se decide de novo';
  end;

  -- 11. agora o mesmo CNPJ passa como pode_pagar
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  insert into public.conferencia_de_boleto (linha, beneficiario, cnpj, valor, resultado)
    values (repeat('3', 47), 'Transportadora da Prova Ltda', '11222333000181', 640, 'pode_pagar')
    returning id into c;
  reset role;
  select * into r from public.conferencia_de_boleto where id = c;
  txt := txt || E'\n' || case when r.resultado = 'pode_pagar' and r.fornecedor_id = f2 then 'ok  ' else 'RUIM' end
             || ' 11. depois de confiavel, o boleto do mesmo CNPJ pode pagar (' || r.resultado || ')';

  -- 12. bloqueado nunca passa
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.fornecedor set situacao = 'bloqueado', motivo_do_bloqueio = 'prova' where id = f2;
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  insert into public.conferencia_de_boleto (linha, beneficiario, cnpj, valor, resultado, situacao)
    values (repeat('4', 47), 'Transportadora da Prova Ltda', '11222333000181', 640, 'pode_pagar', 'esperando')
    returning id into c;
  reset role;
  select * into r from public.conferencia_de_boleto where id = c;
  txt := txt || E'\n' || case when r.resultado = 'nao_pague' and r.situacao = 'conferido' then 'ok  ' else 'RUIM' end
             || ' 12. CNPJ bloqueado vira nao_pague, e nao entra em fila (' || r.resultado || ', ' || r.situacao || ')';

  begin
    perform public.pedir_aprovacao_do_boleto(c, 'bloqueado nao pede');
    txt := txt || E'\nRUIM 12b. pediu aprovacao de um bloqueado';
  exception when check_violation then
    txt := txt || E'\nok   12b. boleto de bloqueado nao entra na fila';
  end;

  -- 13. entrada de fornecedor bloqueado e recusada
  perform set_config('request.jwt.claim.sub', e::text, true);
  begin
    perform public.mexer_no_estoque(m, 1, 'entrada', '', null, f2);
    txt := txt || E'\nRUIM 13. entrada de fornecedor bloqueado passou';
  exception when check_violation then
    txt := txt || E'\nok   13. entrada de fornecedor bloqueado e recusada';
  end;

  -- 14. o estoquista nao desbloqueia
  begin
    update public.fornecedor set situacao = 'novo' where id = f2;
    txt := txt || E'\nRUIM 14. estoquista desbloqueou';
  exception when insufficient_privilege then
    txt := txt || E'\nok   14. estoquista nao desbloqueia';
  end;

  -- 15. juntar leva material e historico, e so o admin junta
  begin
    perform public.juntar_fornecedores(f2, f1);
    txt := txt || E'\nRUIM 15. estoquista juntou fornecedores';
  exception when insufficient_privilege then
    txt := txt || E'\nok   15. estoquista nao junta fornecedores';
  end;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.juntar_fornecedores(f2, f1);
  select count(*) into n from public.material_fornecedor where material_id = m and fornecedor_id = f2;
  txt := txt || E'\n' || case when n = 1 and not exists (select 1 from public.fornecedor where id = f1)
                              then 'ok  ' else 'RUIM' end
             || ' 15b. juntar levou o material e apagou o que sobrou';
  select count(*) into n from public.movimento_de_estoque where fornecedor_id = f2;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end
             || ' 15c. o movimento passou para o que ficou (' || n || ')';

  -- 16. a lista
  select * into r from public.fornecedor_na_lista where id = f2;
  txt := txt || E'\n' || case when r.materiais = 1 and r.entradas = 1 and r.boletos >= 3 then 'ok  ' else 'RUIM' end
             || ' 16. a lista conta materiais, entradas e boletos (' || r.materiais || ', ' || r.entradas || ', ' || r.boletos || ')';

  -- 17. o tipo fixo nao se apaga
  delete from public.tipo_de_fornecedor where chave = 'frete' and not fixo;
  select count(*) into n from public.tipo_de_fornecedor where chave = 'frete';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 17. o tipo de nascenca continua la';

  raise exception E'PROVA DA 041 (tudo desfeito):%', txt;
end $$;
