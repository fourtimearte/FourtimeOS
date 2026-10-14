-- ===========================================================================
-- A PROVA DA 079: quem pagou o frete, a coleta, varios pedidos e a lixeira.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  p uuid := gen_random_uuid();  -- producao
  moto uuid; aviao uuid; l1 uuid; l2 uuid; cot uuid; cot2 uuid; ped1 uuid; ped2 uuid;
  txt text := '';
  n int;
  r record;
begin
  insert into public.convite (email, papel) values
    ('prova-79a@prova.test', 'admin'), ('prova-79p@prova.test', 'producao');
  insert into auth.users (id, email) values (a, 'prova-79a@prova.test'), (p, 'prova-79p@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-79a@prova.test'),
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-79p@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-079', '{}'::jsonb, 4, 'Cliente da Prova') returning id into cot;
  insert into public.pedido (numero, cotacao_id, data_de_envio) values ('PD-PROVA-079A', cot, date '2026-10-20') returning id into ped1;
  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-079B', '{}'::jsonb, 4, 'Outro Cliente da Prova') returning id into cot2;
  insert into public.pedido (numero, cotacao_id, data_de_envio) values ('PD-PROVA-079B', cot2, date '2026-10-22') returning id into ped2;

  -- 1. os tipos novos e as empresas que ele citou
  select count(*) into n from public.transportador
   where (lower(nome) in ('latam', 'golog', 'azul') and meio = 'aereo')
      or (lower(nome) = 'correios' and meio = 'correios')
      or (lower(nome) in ('melhor envio', 'jadlog') and meio = 'transportadora');
  txt := txt || E'\n' || case when n = 6 then 'ok  ' else 'RUIM' end || ' 1. Latam, GoLog, Azul, Correios, Melhor Envio e Jadlog cadastrados (' || n || ')';

  -- 2. empresa aerea com CNPJ vira fornecedor de frete
  perform set_config('request.jwt.claim.sub', p::text, true);
  aviao := public.salvar_transportador(null, 'Aérea da Prova', 'aereo', '11.222.333/0001-81');
  select * into r from public.transportador_na_lista where id = aviao;
  txt := txt || E'\n' || case when r.meio = 'aereo' and r.cnpj = '11222333000181' then 'ok  ' else 'RUIM' end || ' 2. aereo guarda o CNPJ';

  moto := public.salvar_transportador(null, 'Motoboy da Prova 79', 'motoboy');

  -- 3. um envio com dois pedidos e a coleta do motoboy
  l1 := public.lancar_transporte(null, now(), aviao, 'entrega', array['PD-PROVA-079A', 'PD-PROVA-079B'], null,
          'Brasília', 500, 'boleto', false, '', 'fourtime',
          jsonb_build_object('transportador', moto, 'valor', 10, 'forma', 'pix', 'pago', false));
  select * into r from public.lancamento_de_transporte_na_lista where id = l1;
  txt := txt || E'\n' || case when jsonb_array_length(r.pedidos) = 2 and r.pedido = 'PD-PROVA-079A'
                               and r.pedidos -> 1 ->> 'numero' = 'PD-PROVA-079B'
                               and r.pedidos -> 0 ->> 'entrega' = '2026-10-20'
                               and r.coleta_transportador = 'Motoboy da Prova 79' and r.coleta_valor = 10
                              then 'ok  ' else 'RUIM' end
             || ' 3. o lancamento mostra os dois pedidos com a data de entrega e a coleta';
  select count(*) into n from public.lancamento_de_transporte_na_lista where id = l1 or coleta_de = l1;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 3b. a coleta nao aparece como linha propria na lista';
  select count(*) into n from public.corrida_de_transporte where lancamento_id = l1;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 3c. as corridas sao duas, envio e coleta (' || n || ')';
  select count(*) into n from public.corrida_de_transporte where lancamento_id = l1 and transportador_id = moto and coleta and not pago;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 3d. a coleta fica em A pagar do motoboy';

  -- 4. o frete pago pelo cliente: valor zero vale, e nao e gasto
  l2 := public.lancar_transporte(null, now(), aviao, 'entrega', array['PD-PROVA-079B'], null,
          '', 0, 'pix', false, '', 'cliente', null);
  select count(*) into n from public.corrida_de_transporte where lancamento_id = l2;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 4. frete do cliente, valor zero, fora das corridas da Fourtime';
  n := public.acertar_transporte(array[l2]);
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 4b. acertar nao marca frete do cliente';
  begin
    perform public.lancar_transporte(null, now(), aviao, 'entrega', array[]::text[], null, '', 0, 'pix', false, '', 'fourtime', null);
    txt := txt || E'\nRUIM 4c. frete da Fourtime aceitou valor zero';
  exception when check_violation then
    txt := txt || E'\nok   4c. frete da Fourtime continua pedindo valor';
  end;

  -- 5. corrigir tirando a coleta: ela vai para a lixeira, nao some
  perform public.lancar_transporte(l1, null, aviao, 'entrega', array['PD-PROVA-079B'], null,
          'Brasília', 520, 'boleto', false, '', 'fourtime', null);
  select count(*) into n from public.corrida_de_transporte where lancamento_id = l1;
  txt := txt || E'\n' || case when n = 1
                               and exists (select 1 from public.lancamento_de_transporte where coleta_de = l1 and apagado_em is not null)
                               and (select pedido from public.lancamento_de_transporte_na_lista where id = l1) = 'PD-PROVA-079B'
                              then 'ok  ' else 'RUIM' end || ' 5. corrigir tira a coleta e troca os pedidos';

  -- 6. a coleta volta na correcao seguinte
  perform public.lancar_transporte(l1, null, aviao, 'entrega', array['PD-PROVA-079A', 'PD-PROVA-079B'], null,
          'Brasília', 520, 'boleto', false, '', 'fourtime',
          jsonb_build_object('transportador', moto, 'valor', 12, 'forma', 'dinheiro', 'pago', true));
  select * into r from public.lancamento_de_transporte_na_lista where id = l1;
  txt := txt || E'\n' || case when r.coleta_valor = 12 and r.coleta_pago and jsonb_array_length(r.pedidos) = 2 then 'ok  ' else 'RUIM' end
             || ' 6. a coleta nova entra paga, com o valor corrigido';

  -- 7. a producao nao apaga (nao tem deletar)
  begin
    perform public.apagar_lancamento_de_transporte(l1);
    txt := txt || E'\nRUIM 7. producao apagou';
  exception when insufficient_privilege then
    txt := txt || E'\nok   7. producao nao apaga';
  end;

  -- 8. o admin apaga: some da lista e das corridas, aparece na lixeira
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.apagar_lancamento_de_transporte(l1);
  select count(*) into n from public.lancamento_de_transporte_na_lista where id = l1;
  select n + count(*) into n from public.corrida_de_transporte where lancamento_id = l1;
  select * into r from public.lancamento_na_lixeira where id = l1;
  txt := txt || E'\n' || case when n = 0 and r.apagado_por = 'Admin da Prova' then 'ok  ' else 'RUIM' end
             || ' 8. apagado sai da lista e das corridas e vai para a lixeira';

  -- 9. a producao nao devolve; o admin devolve, com a coleta
  perform set_config('request.jwt.claim.sub', p::text, true);
  begin
    perform public.devolver_lancamento_de_transporte(l1);
    txt := txt || E'\nRUIM 9. producao devolveu da lixeira';
  exception when insufficient_privilege then
    txt := txt || E'\nok   9. producao nao devolve da lixeira';
  end;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.devolver_lancamento_de_transporte(l1);
  select count(*) into n from public.corrida_de_transporte where lancamento_id = l1;
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end
             || ' 9b. o admin devolve, e volta a coleta que foi junto, nao a tirada antes (' || n || ' corridas)';

  -- 10. o jeito velho de chamar continua valendo
  perform set_config('request.jwt.claim.sub', p::text, true);
  l2 := public.lancar_transporte(null, now(), moto, 'entrega', 'PD-PROVA-079A', null, '', 15, 'pix', false, '');
  select * into r from public.lancamento_de_transporte_na_lista where id = l2;
  txt := txt || E'\n' || case when r.pedido = 'PD-PROVA-079A' and jsonb_array_length(r.pedidos) = 1 and r.frete_pago_por = 'fourtime'
                              then 'ok  ' else 'RUIM' end || ' 10. a chamada de 11 parametros ainda lanca';

  raise exception E'PROVA DA 079 (tudo desfeito):%', txt;
end $$;
