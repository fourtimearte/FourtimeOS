-- ===========================================================================
-- A PROVA DA 042: o transporte.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste quatro pessoas (admin, producao, analista e vendedor) e tenta o
-- que cada uma pode e o que nao pode. A regra mora no banco, entao o teste
-- tambem.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  p uuid := gen_random_uuid();  -- producao
  l uuid := gen_random_uuid();  -- analista, que so le
  v uuid := gen_random_uuid();  -- vendedor, que nem ve
  moto uuid; transp uuid; l1 uuid; l2 uuid; l3 uuid; forn uuid; cot uuid; ped uuid;
  txt text := '';
  n int;
  r record;
begin
  insert into public.convite (email, papel) values
    ('prova-ta@prova.test', 'admin'), ('prova-tp@prova.test', 'producao'),
    ('prova-tl@prova.test', 'analista'), ('prova-tv@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-ta@prova.test'), (p, 'prova-tp@prova.test'), (l, 'prova-tl@prova.test'), (v, 'prova-tv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-ta@prova.test'),
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-tp@prova.test'),
    (l, 'Analista da Prova', 'analista', 'aprovado', 'prova-tl@prova.test'),
    (v, 'Venda da Prova', 'vendedor', 'aprovado', 'prova-tv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  /* um pedido para a corrida apontar */
  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-042', '{}'::jsonb, 4, 'Cliente da Prova') returning id into cot;
  insert into public.pedido (numero, cotacao_id) values ('PD-PROVA-042', cot) returning id into ped;

  -- 1. a producao cadastra um motoboy
  perform set_config('request.jwt.claim.sub', p::text, true);
  moto := public.salvar_transportador(null, 'Motoboy da Prova', 'motoboy', null, '(62) 9 0000-0000', 'Goiânia', 'mesmo dia', '');
  select * into r from public.transportador where id = moto;
  txt := txt || E'\n' || case when r.meio = 'motoboy' and r.fornecedor_id is null then 'ok  ' else 'RUIM' end
             || ' 1. producao cadastra motoboy, sem linha de fornecedor';

  -- 2. motoboy com CNPJ: o CNPJ e ignorado, porque so transportadora tem
  n := (select count(*) from public.fornecedor where cnpj = '11222333000181');
  perform public.salvar_transportador(moto, 'Motoboy da Prova', 'motoboy', '11.222.333/0001-81');
  txt := txt || E'\n' || case when (select count(*) from public.fornecedor where cnpj = '11222333000181') = n
                              then 'ok  ' else 'RUIM' end || ' 2. CNPJ em motoboy nao cria fornecedor';

  -- 3. transportadora com CNPJ cria a linha de fornecedor, de frete e nova
  transp := public.salvar_transportador(null, 'Transportadora da Prova Ltda', 'transportadora', '11.222.333/0001-81', '', 'Goiás', '2 a 4 dias úteis', '');
  select f.* into r from public.fornecedor f join public.transportador t on t.fornecedor_id = f.id where t.id = transp;
  forn := r.id;
  txt := txt || E'\n' || case when r.cnpj = '11222333000181' and r.situacao = 'novo'
                               and exists (select 1 from public.fornecedor_tipo where fornecedor_id = r.id and tipo = 'frete')
                              then 'ok  ' else 'RUIM' end
             || ' 3. transportadora com CNPJ vira fornecedor de frete, situacao novo (' || coalesce(r.situacao, 'nada') || ')';
  select * into r from public.transportador_na_lista where id = transp;
  txt := txt || E'\n' || case when r.cnpj = '11222333000181' then 'ok  ' else 'RUIM' end || ' 3b. a lista mostra o CNPJ';

  -- 4. nome repetido e recusado
  begin
    perform public.salvar_transportador(null, 'motoboy da prova', 'motoboy');
    txt := txt || E'\nRUIM 4. aceitou nome repetido';
  exception when unique_violation then
    txt := txt || E'\nok   4. nome repetido e recusado';
  end;

  -- 5. o admin marca o CNPJ como confiavel, e a producao nao consegue troca-lo
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.fornecedor set situacao = 'confiavel' where id = forn;
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.salvar_transportador(transp, 'Transportadora da Prova Ltda', 'transportadora', '45.723.174/0001-10');
    txt := txt || E'\nRUIM 5. producao trocou o CNPJ de um confiavel';
  exception when insufficient_privilege then
    txt := txt || E'\nok   5. producao nao troca o CNPJ de um confiavel';
  end;

  -- 6. a producao lanca uma entrega com pedido, em aberto
  l1 := public.lancar_transporte(null, now(), moto, 'entrega', 'PD-PROVA-042', null, 'Setor Bueno, Goiânia', 25, 'pix', false, '');
  select * into r from public.lancamento_de_transporte_na_lista where id = l1;
  txt := txt || E'\n' || case when r.pedido = 'PD-PROVA-042' and r.cliente = 'Cliente da Prova' and not r.pago
                               and r.quem_nome = 'Producao da Prova' and r.meio = 'motoboy' and r.valor = 25
                              then 'ok  ' else 'RUIM' end
             || ' 6. entrega lancada com pedido, cliente e o carimbo de quem lancou (' || coalesce(r.pedido, '-') || ', ' || coalesce(r.cliente, '-') || ', ' || r.quem_nome || ')';

  -- 7. pedido que nao existe e erro, e nao lancamento sem pedido
  begin
    perform public.lancar_transporte(null, now(), moto, 'entrega', 'PD-NAO-EXISTE', null, '', 20, 'pix', false, '');
    txt := txt || E'\nRUIM 7. lancou com pedido inexistente';
  exception when no_data_found then
    txt := txt || E'\nok   7. pedido inexistente e recusado';
  end;

  -- 8. valor zero e recusado
  begin
    perform public.lancar_transporte(null, now(), moto, 'outro', null, null, '', 0, 'pix', false, '');
    txt := txt || E'\nRUIM 8. lancou valor zero';
  exception when check_violation then
    txt := txt || E'\nok   8. valor zero e recusado';
  end;

  -- 9. busca de material com fornecedor, ja paga
  l2 := public.lancar_transporte(null, now(), transp, 'busca', null, forn, 'Goiânia, GO', 640, 'boleto', true, 'NF da prova');
  select * into r from public.lancamento_de_transporte where id = l2;
  txt := txt || E'\n' || case when r.pago and r.pago_em is not null and r.pago_por = p and r.fornecedor_id = forn and r.pedido_id is null
                              then 'ok  ' else 'RUIM' end || ' 9. busca ja paga guarda a data, quem pagou e o fornecedor';

  -- 10. corrigir: muda o valor, e o carimbo de quem lancou fica
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.lancar_transporte(l1, null, moto, 'entrega', 'PD-PROVA-042', null, 'Setor Bueno, Goiânia', 30, 'pix', false, 'corrigido');
  select * into r from public.lancamento_de_transporte where id = l1;
  txt := txt || E'\n' || case when r.valor = 30 and r.quem = p and not r.pago and r.observacao = 'corrigido'
                              then 'ok  ' else 'RUIM' end || ' 10. a correcao muda o valor e nao muda quem lancou';

  -- 11. acertar marca os abertos e deixa em paz o que ja estava pago
  l3 := public.lancar_transporte(null, now(), moto, 'outro', null, null, '', 18, 'dinheiro', false, '');
  select pago_em into r from public.lancamento_de_transporte where id = l2;
  n := public.acertar_transporte(array[l1, l2, l3]);
  txt := txt || E'\n' || case when n = 2
                               and (select bool_and(pago) from public.lancamento_de_transporte where id in (l1, l2, l3))
                               and (select pago_em from public.lancamento_de_transporte where id = l2) = r.pago_em
                               and (select pago_por from public.lancamento_de_transporte where id = l1) = a
                              then 'ok  ' else 'RUIM' end
             || ' 11. acertar marcou os 2 abertos e nao mexeu no que ja estava pago (' || n || ')';

  -- 12. corrigir tirando o pago apaga a data
  perform public.lancar_transporte(l3, null, moto, 'outro', null, null, '', 18, 'dinheiro', false, '');
  select * into r from public.lancamento_de_transporte where id = l3;
  txt := txt || E'\n' || case when not r.pago and r.pago_em is null and r.pago_por is null then 'ok  ' else 'RUIM' end
             || ' 12. desmarcar o pago apaga a data';

  -- 13. o analista le e nao lanca
  perform set_config('request.jwt.claim.sub', l::text, true);
  set local role authenticated;
  select count(*) into n from public.lancamento_de_transporte_na_lista where id in (l1, l2, l3);
  reset role;
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 13. analista le os lancamentos (' || n || ')';
  begin
    perform public.lancar_transporte(null, now(), moto, 'outro', null, null, '', 10, 'pix', false, '');
    txt := txt || E'\nRUIM 13b. analista lancou';
  exception when insufficient_privilege then
    txt := txt || E'\nok   13b. analista nao lanca';
  end;
  begin
    perform public.acertar_transporte(array[l3]);
    txt := txt || E'\nRUIM 13c. analista acertou';
  exception when insufficient_privilege then
    txt := txt || E'\nok   13c. analista nao acerta';
  end;

  -- 14. o vendedor nao ve nada, nem pela view, nem pela tabela
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  select count(*) into n from public.lancamento_de_transporte_na_lista;
  select n + count(*) into n from public.transportador_na_lista;
  select n + count(*) into n from public.lancamento_de_transporte;
  reset role;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 14. vendedor nao ve transporte (' || n || ' linhas)';
  begin
    perform public.salvar_transportador(null, 'Do Vendedor da Prova', 'motoboy');
    txt := txt || E'\nRUIM 14b. vendedor cadastrou';
  exception when insufficient_privilege then
    txt := txt || E'\nok   14b. vendedor nao cadastra';
  end;

  -- 15. ninguem grava direto na tabela, nem quem pode editar
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    set local role authenticated;
    insert into public.lancamento_de_transporte (transportador_id, motivo, valor, forma) values (moto, 'outro', 5, 'pix');
    reset role;
    txt := txt || E'\nRUIM 15. gravou direto na tabela';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   15. ninguem grava direto na tabela';
  end;
  begin
    set local role authenticated;
    delete from public.lancamento_de_transporte where id = l1;
    reset role;
    txt := txt || E'\nRUIM 15b. apagou um lancamento';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   15b. lancamento nao se apaga';
  end;

  -- 16. o Verificador de Boleto conhece o CNPJ da transportadora
  set local role authenticated;
  insert into public.conferencia_de_boleto (linha, beneficiario, cnpj, valor, resultado, situacao)
    values (repeat('3', 47), 'Transportadora da Prova Ltda', '11222333000181', 640, 'pode_pagar', 'conferido')
    returning id into l1;
  reset role;
  select * into r from public.conferencia_de_boleto where id = l1;
  txt := txt || E'\n' || case when r.resultado = 'pode_pagar' and r.fornecedor_id = forn then 'ok  ' else 'RUIM' end
             || ' 16. boleto da transportadora confiavel passa como pode_pagar (' || r.resultado || ')';

  -- 17. as transportadoras da 041 estao em transporte, ligadas ao fornecedor
  select count(*) into n from public.transportador t
    join public.fornecedor f on f.id = t.fornecedor_id
   where t.meio = 'transportadora' and lower(t.nome) in ('correios', 'jadlog', 'braspress', 'total express');
  txt := txt || E'\n' || case when n = 4 then 'ok  ' else 'RUIM' end || ' 17. as quatro transportadoras da 041 vieram (' || n || ')';

  raise exception E'PROVA DA 042 (tudo desfeito):%', txt;
end $$;
