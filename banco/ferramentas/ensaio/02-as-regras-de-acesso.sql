grant usage on schema public to authenticated;
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
