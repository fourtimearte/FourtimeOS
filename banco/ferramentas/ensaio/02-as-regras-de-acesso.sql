\echo '=== AGORA COMO authenticated DE VERDADE (RLS ligada) ==='

\echo '--- a Carla le o funil e a lista de cotacoes ---'
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as leads_que_a_carla_ve from public.lead;
select numero, vendedor_nome, total from public.cotacao_na_lista;
select nome from public.equipe order by nome;

\echo '--- a Carla cria um lead e uma cotacao ---'
insert into public.lead (nome, telefone, vendedor_id, dono_desde)
 values ('Teste Carla','62999990000','22222222-2222-2222-2222-222222222222', now());
insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome, estado, vendedor_id, total, pecas)
 values (public.proximo_numero_de_cotacao(), '{}'::jsonb, 4, 'Teste Carla', 'rascunho','22222222-2222-2222-2222-222222222222', 900, 20);
select numero from public.cotacao order by criada_em desc limit 1;

\echo '--- a Carla NAO ve o percentual do Tiago ---'
select count(*) as percentuais_visiveis_para_carla from public.comissao_do_vendedor;

\echo '--- a Carla NAO transfere lead (so o admin) ---'
do $$ begin
  perform public.transferir_lead(
    (select id from public.lead where nome='Teste Carla'),
    '33333333-3333-3333-3333-333333333333', 'tentativa');
  raise notice 'FALHA DO TESTE: a Carla conseguiu transferir';
exception when insufficient_privilege then
  raise notice 'ok: a transferencia foi recusada (%)', sqlerrm;
end $$;

\echo '--- a Carla nao apaga pedido nem lead (o esperado e DELETE 0 nos dois) ---'
delete from public.pedido;
delete from public.lead where nome='Time Novo';

\echo '--- aprovar a mesma cotacao duas vezes ---'
do $$ begin
  perform public.aprovar_cotacao((select id from public.cotacao where numero like 'CO%-0001'));
  raise notice 'FALHA DO TESTE: aprovou duas vezes';
exception when unique_violation then
  raise notice 'ok: recusou a segunda aprovacao (%)', sqlerrm;
end $$;

\echo '--- alguem da producao: le tudo, nao cria cotacao, anda com o pedido ---'
reset role;
insert into public.convite (email, papel) values ('joana@f.com','producao');
insert into auth.users (id,email,raw_user_meta_data) values
 ('44444444-4444-4444-4444-444444444444','joana@f.com','{"nome":"Joana"}');
update public.pessoa set situacao='aprovado' where id='44444444-4444-4444-4444-444444444444';
set role authenticated; set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select count(*) as cotacoes_que_a_joana_ve from public.cotacao_na_lista;
update public.pedido set estado='producao';
select numero, estado from public.pedido;
do $$ begin
  insert into public.cotacao (numero, corpo, versao_do_formato, estado, total, pecas)
   values ('9999-9999','{}'::jsonb,4,'rascunho',1,1);
  raise notice 'FALHA DO TESTE: a producao criou cotacao';
exception when insufficient_privilege then
  raise notice 'ok: a producao nao cria cotacao';
end $$;

\echo '--- o admin transfere, e fica registrado ---'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.transferir_lead((select id from public.lead where nome='Teste Carla'),
  '33333333-3333-3333-3333-333333333333', 'Carla de folga');
select e.nome as agora_e_de, t.motivo, d.nome as era_de
  from public.transferencia_de_lead t
  join public.equipe e on e.id=t.para_quem
  left join public.equipe d on d.id=t.de_quem;

\echo '--- e o admin apaga lead (o esperado e DELETE 1) ---'
delete from public.lead where nome='Time Novo';

\echo ''
\echo '=== 013: o pedido de teste ate o lancamento ==='
reset role; set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

\echo '--- o pedido do ensaio nasceu marcado como teste? ---'
select numero, teste from public.pedido;

\echo '--- a Carla nao libera o pedido real ---'
do $$ begin
  perform public.liberar_pedido_real(5200);
  raise notice 'FALHA DO TESTE: a Carla liberou';
exception when insufficient_privilege then raise notice 'ok: recusou (%)', sqlerrm; end $$;

\echo '--- nova cotacao aprovada continua saindo PD-TESTE ---'
insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome, estado, vendedor_id, total, pecas)
 values (public.proximo_numero_de_cotacao(), '{}'::jsonb, 4, 'Segundo Teste', 'enviada','22222222-2222-2222-2222-222222222222', 1500, 30);
select numero, teste from public.aprovar_cotacao((select id from public.cotacao where cliente_nome='Segundo Teste'));

\echo '--- o admin tenta liberar com numero menor que um pedido real que ja exista ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform public.liberar_pedido_real(-1);
  raise notice 'FALHA DO TESTE: aceitou numero negativo';
exception when others then raise notice 'ok: recusou numero invalido'; end $$;

\echo '--- o dia do lancamento ---'
select public.liberar_pedido_real(5200);

\echo '--- dai em diante o pedido sai real, e nao marcado ---'
insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome, estado, vendedor_id, total, pecas)
 values (public.proximo_numero_de_cotacao(), '{}'::jsonb, 4, 'Depois do Lancamento', 'enviada','22222222-2222-2222-2222-222222222222', 800, 12);
select numero, teste from public.aprovar_cotacao((select id from public.cotacao where cliente_nome='Depois do Lancamento'));

\echo '--- e liberar de novo com numero menor agora e recusado ---'
do $$ begin
  perform public.liberar_pedido_real(10);
  raise notice 'FALHA DO TESTE: aceitou numero menor que um pedido real existente';
exception when others then raise notice 'ok: recusou (%)', sqlerrm; end $$;

\echo '--- o que ficou para tras ---'
select numero, teste from public.pedido order by teste desc, numero;

\echo ''
\echo '=== 014: a marca de teste ==='
reset role; set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

insert into public.cliente (nome, teste) values ('Cliente Semeado', true);
insert into public.lead (nome, telefone, teste) values ('Lead Semeado', '62900000001', true);

\echo '--- o que esta marcado como teste ---'
select * from public.dado_de_teste order by tabela;

\echo '--- a Carla nao apaga os dados de teste ---'
do $$ begin
  perform public.apagar_dados_de_teste();
  raise notice 'FALHA DO TESTE: a Carla apagou';
exception when insufficient_privilege then raise notice 'ok: recusou (%)', sqlerrm; end $$;

\echo '--- o admin apaga, e o dado de verdade fica ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.apagar_dados_de_teste();
select * from public.dado_de_teste order by tabela;

\echo '--- e o que NAO era teste continua ali ---'
select (select count(*) from public.cliente) as clientes,
       (select count(*) from public.pedido)  as pedidos,
       (select count(*) from public.cotacao) as cotacoes;
