\set ON_ERROR_STOP on
-- tres pessoas: uma admin e duas vendedoras
insert into public.convite (email, papel) values
 ('henrique@f.com','admin'),('carla@f.com','vendedor'),('tiago@f.com','vendedor');
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','henrique@f.com','{"nome":"Henrique"}'),
 ('22222222-2222-2222-2222-222222222222','carla@f.com','{"nome":"Carla"}'),
 ('33333333-3333-3333-3333-333333333333','tiago@f.com','{"nome":"Tiago"}');
update public.pessoa set papel='admin', situacao='aprovado' where id='11111111-1111-1111-1111-111111111111';
update public.pessoa set papel='vendedor', situacao='aprovado' where id in
 ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');

insert into public.comissao_do_vendedor (pessoa_id, pct) values
 ('22222222-2222-2222-2222-222222222222', 3.5),
 ('33333333-3333-3333-3333-333333333333', 3.0);

insert into public.rodizio (pessoa_id, ordem) values
 ('22222222-2222-2222-2222-222222222222', 1),
 ('33333333-3333-3333-3333-333333333333', 2);

-- um cliente que ja e da Carla
insert into public.cliente (nome, celular, vendedor_id)
 values ('Escola Girassol', '(62) 99321-4455', '22222222-2222-2222-2222-222222222222');

\echo '--- REGRA 1: cliente conhecido volta para a dona da carteira ---'
select e.nome as dono from public.lead_do_telefone('5562993214455') l join public.equipe e on e.id = l.vendedor_id;

\echo '--- REGRA 2: telefone novo entra no rodizio, um de cada vez ---'
select e.nome from public.lead_do_telefone('62911110001','Time Novo') l join public.equipe e on e.id=l.vendedor_id;
select e.nome from public.lead_do_telefone('62911110002','Outro Time') l join public.equipe e on e.id=l.vendedor_id;
select e.nome from public.lead_do_telefone('62911110003','Terceiro') l join public.equipe e on e.id=l.vendedor_id;

\echo '--- o mesmo telefone nao cria um segundo lead ---'
select count(*) as leads_do_mesmo_telefone from public.lead where public.fim_do_telefone(telefone)='93214455';

\echo '--- o lead vira cliente e nao duplica o Girassol ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select nome, (select count(*) from public.cliente where public.chave_do_nome(nome)=public.chave_do_nome('Escola Girassol')) as quantos_girassol
  from public.lead_vira_cliente((select id from public.lead where public.fim_do_telefone(telefone)='93214455'));

\echo '--- numero da cotacao ---'
insert into public.cotacao (numero, corpo, versao_do_formato, cliente_id, cliente_nome, lead_id, estado, vendedor_id, total, pecas)
select public.proximo_numero_de_cotacao(), '{"produtos":[]}'::jsonb, 4, l.cliente_id, 'Escola Girassol', l.id,
       'enviada', l.vendedor_id, 4820.00, 96
  from public.lead l where public.fim_do_telefone(l.telefone)='93214455';
select numero from public.cotacao;

\echo '--- a aprovacao: numero de pedido, comissao congelada, lead fechado ---'
select numero, vendedor_nome, comissao_pct, total from public.aprovar_cotacao((select id from public.cotacao));
select estagio, valor from public.lead where public.fim_do_telefone(telefone)='93214455';
select estado from public.cotacao;

\echo '--- o relatorio da Carla, visto pela Carla ---'
select vendedor_nome, mes, pedidos, vendido, comissao from public.comissao_por_mes;

\echo '--- a mesma consulta vista pelo Tiago: nao e dele, some ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) as linhas_para_o_tiago from public.comissao_por_mes;

\echo '--- vista pelo admin: aparece ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as linhas_para_o_admin from public.comissao_por_mes;

\echo '--- aprovar duas vezes tem que recusar ---'
