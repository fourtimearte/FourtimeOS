-- ===========================================================================
-- A PROVA DOS CONSERTOS DA AUDITORIA (084 e 086, 17/10/2026).
-- Roda no ENSAIO (psql como postgres: usa session_replication_role, que o SQL
-- Editor do Supabase nao deixa), depois da 084 e da 086. Tudo numa
-- transação que termina em ROLLBACK: nada fica gravado. Cada linha diz o caso
-- e o que deu; o esperado está no nome do caso.
-- ===========================================================================
begin;

-- 084: sem login, a trava do admin fecha
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
select '084 sou_admin sem login (esperado: false)' as caso, public.sou_admin()::text as deu;

-- 086.1: a falta do PCP
insert into public.material (nome, categoria, unidade) values ('Prova auditoria A', 'insumo', 'un'), ('Prova auditoria B', 'insumo', 'un');
set local session_replication_role = replica;
create temp table prova_pedido on commit drop as select id from public.pedido where estado <> 'cancelado' limit 1;
update public.pedido set estado = 'pcp' where id = (select id from prova_pedido);
insert into public.reserva (pedido_id, material_id, quantidade, unidade, separado)
select (select id from prova_pedido), id, 5, 'un', 5 from public.material where nome like 'Prova auditoria%';
set local session_replication_role = origin;
select '086 PCP pesado por inteiro (esperado: 0)' as caso, faltando::text as deu from public.pedido_no_pcp where id = (select id from prova_pedido);
update public.reserva set separado = 2 where pedido_id = (select id from prova_pedido) and material_id = (select id from public.material where nome = 'Prova auditoria A');
select '086 PCP um pesado a menos (esperado: 1)', faltando::text from public.pedido_no_pcp where id = (select id from prova_pedido);
update public.reserva set separado = null where pedido_id = (select id from prova_pedido);
select '086 PCP nada pesado (esperado: 2)', faltando::text from public.pedido_no_pcp where id = (select id from prova_pedido);

-- 086.2: o uso do estoque conta a baixa da produção
insert into public.movimento_de_estoque (material_id, quantidade, motivo, observacao)
select id, 10, 'entrada', 'prova' from public.material where nome = 'Prova auditoria A'
union all select id, -3, 'producao', 'prova' from public.material where nome = 'Prova auditoria A';
select '086 uso de 30 dias com baixa de produção (esperado: 3)', (x ->> 'd30')
  from jsonb_array_elements(public.uso_do_estoque()) x
 where x ->> 'material_id' = (select id::text from public.material where nome = 'Prova auditoria A');

-- 086.3: carteira de vendedora bloqueada vai para o rodízio
create temp table prova_vendedora on commit drop as select id from public.pessoa where papel = 'vendedor' and situacao = 'aprovado' limit 1;
insert into public.cliente (nome, celular, vendedor_id) values ('Prova auditoria carteira', '62900001234', (select id from prova_vendedora));
select '086 carteira aprovada (esperado: true)', (public.dono_do_lead('62900001234') = (select id from prova_vendedora))::text;
update public.pessoa set situacao = 'bloqueado' where id = (select id from prova_vendedora);
select '086 carteira bloqueada (esperado: false)', coalesce((public.dono_do_lead('62900001234') = (select id from prova_vendedora))::text, 'false');

rollback;
