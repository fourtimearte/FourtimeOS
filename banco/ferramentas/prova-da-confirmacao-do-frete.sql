-- ===========================================================================
-- A PROVA DA 080: a confirmacao do frete, a trava do envio e as mensagens da
-- logistica. Roda no SQL Editor quantas vezes quiser: termina levantando um
-- erro de proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  p uuid := gen_random_uuid();  -- producao
  v uuid := gen_random_uuid();  -- vendedor, que nao ve o transporte
  cot uuid; ped uuid; cot2 uuid; ped2 uuid;
  txt text := '';
  n int;
  r record;
begin
  insert into public.convite (email, papel) values
    ('prova-80a@prova.test', 'admin'), ('prova-80p@prova.test', 'producao'), ('prova-80v@prova.test', 'vendedor');
  insert into auth.users (id, email) values (a, 'prova-80a@prova.test'), (p, 'prova-80p@prova.test'), (v, 'prova-80v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-80a@prova.test'),
    (p, 'Logistica da Prova', 'producao', 'aprovado', 'prova-80p@prova.test'),
    (v, 'Venda da Prova', 'vendedor', 'aprovado', 'prova-80v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-080', '{"informe":{"entrega":"CORREIOS"},"cliente":{"telefone":"62999990080"}}'::jsonb, 4, 'Cliente da Prova')
    returning id into cot;
  insert into public.pedido (numero, cotacao_id, data_de_envio) values ('PD-PROVA-080', cot, date '2026-10-20') returning id into ped;
  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-080B', '{"informe":{"entrega":"FABRICA"}}'::jsonb, 4, 'Retira da Prova') returning id into cot2;
  insert into public.pedido (numero, cotacao_id) values ('PD-PROVA-080B', cot2) returning id into ped2;

  -- 1. a lista mostra o pedido sem linha, com o envio e o telefone da cotacao
  perform set_config('request.jwt.claim.sub', p::text, true);
  select * into r from public.frete_na_lista where pedido_id = ped;
  txt := txt || E'\n' || case when r.envio = 'CORREIOS' and r.quem_paga = 'cliente' and r.passo = 0 and not r.registrado
                               and r.telefone = '62999990080' and r.entrega_em = date '2026-10-20'
                              then 'ok  ' else 'RUIM' end || ' 1. pedido sem linha: cliente paga, falar com o cliente, envio e telefone da cotacao';
  select * into r from public.frete_na_lista where pedido_id = ped2;
  txt := txt || E'\n' || case when r.quem_paga = 'sem_frete' then 'ok  ' else 'RUIM' end || ' 1b. quem retira na fabrica nasce sem frete';

  -- 2. o vendedor nao ve a lista nem a tabela
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  select count(*) into n from public.frete_na_lista;
  select n + count(*) into n from public.frete_do_pedido;
  reset role;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 2. vendedor nao ve o frete (' || n || ')';
  begin
    perform public.passo_do_frete(ped, 1);
    txt := txt || E'\nRUIM 2b. vendedor andou o passo';
  exception when insufficient_privilege then
    txt := txt || E'\nok   2b. vendedor nao anda o passo';
  end;

  -- 3. a logistica grava o valor e anda os passos
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform public.salvar_frete_do_pedido(ped, 'cliente', 'Correios SEDEX', 64.3, null, '');
  perform public.passo_do_frete(ped, 1);
  select * into r from public.frete_na_lista where pedido_id = ped;
  txt := txt || E'\n' || case when r.passo = 1 and r.pedido_por = 'Logistica da Prova' and r.envio = 'Correios SEDEX' and r.valor_combinado = 64.3
                              then 'ok  ' else 'RUIM' end || ' 3. logistica grava o frete e marca que pediu ao cliente';

  -- 4. o comprovante leva ao passo 2
  perform public.anexar_comprovante_do_frete(ped, ped::text || '/comprovante.pdf', 'comprovante.pdf');
  select * into r from public.frete_na_lista where pedido_id = ped;
  txt := txt || E'\n' || case when r.passo = 2 and r.comprovante_nome = 'comprovante.pdf' then 'ok  ' else 'RUIM' end || ' 4. anexar o comprovante conta como recebido';
  begin
    perform public.anexar_comprovante_do_frete(ped, 'outra-pasta/x.pdf', 'x.pdf');
    txt := txt || E'\nRUIM 4b. aceitou comprovante fora da pasta do pedido';
  exception when invalid_parameter_value then
    txt := txt || E'\nok   4b. comprovante fora da pasta do pedido e recusado';
  end;

  -- 5. a trava: pronto nao vai a enviado sem a confirmacao
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.pedido set etapa = 'finalizado' where id = ped;
  select estado into r from public.pedido where id = ped;
  begin
    perform public.mover_pedido(ped, 'enviado');
    txt := txt || E'\nRUIM 5. enviou sem o frete confirmado (estado era ' || r.estado || ')';
  exception when check_violation then
    txt := txt || E'\nok   5. pronto nao vai a enviado com o frete do cliente sem confirmar';
  end;

  -- 6. confirmado, sai
  perform public.passo_do_frete(ped, 3);
  perform public.mover_pedido(ped, 'enviado');
  select estado into r from public.pedido where id = ped;
  txt := txt || E'\n' || case when r.estado = 'enviado' then 'ok  ' else 'RUIM' end || ' 6. com o financeiro confirmado, o pedido sai (' || r.estado || ')';

  -- 7. voltar um passo apaga os de cima
  perform public.passo_do_frete(ped, 1);
  select * into r from public.frete_do_pedido where pedido_id = ped;
  txt := txt || E'\n' || case when r.recebido_em is null and r.confirmado_em is null and r.pedido_em is not null then 'ok  ' else 'RUIM' end || ' 7. voltar ao passo 1 apaga recebido e confirmado';

  -- 8. pedido sem linha nao trava
  update public.pedido set etapa = 'finalizado' where id = ped2;
  perform public.mover_pedido(ped2, 'enviado');
  txt := txt || E'\nok   8. pedido que ninguem registrou nao trava';

  -- 9. as mensagens da logistica, e a logistica cria a sua
  select count(*) into n from public.mensagem_rapida where lugar = 'logistica';
  perform set_config('request.jwt.claim.sub', p::text, true);
  set local role authenticated;
  insert into public.mensagem_rapida (titulo, texto, grupo, lugar, criado_por) values ('Da prova', 'Oi {nome}', 'Frete', 'logistica', p);
  reset role;
  txt := txt || E'\n' || case when n >= 4 then 'ok  ' else 'RUIM' end || ' 9. quatro mensagens da logistica, e a logistica cria a sua (' || n || ')';
  begin
    set local role authenticated;
    insert into public.mensagem_rapida (titulo, texto, grupo, lugar, criado_por) values ('Da prova', 'Oi', 'Geral', 'vendas', p);
    reset role;
    txt := txt || E'\nRUIM 9b. producao criou mensagem de vendas';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   9b. producao nao cria mensagem de vendas';
  end;

  raise exception E'PROVA DA 080 (tudo desfeito):%', txt;
end $$;
