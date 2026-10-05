#!/bin/sh
# ===========================================================================
# A PROVA DO arquivar-cores-de-ensaio.sql, no Postgres do ensaio local.
#
# Roda dentro de uma transacao que termina em rollback: semeia 14 cores de
# ensaio, 1 cor de verdade, 1 aviamento de ensaio e reservas em aberto, roda o
# arquivo de verdade (o mesmo que vai para o SQL Editor), confere, roda de
# novo, desfaz com o desarquivar e confere outra vez.
#
# Uso:  sh banco/ferramentas/prova-do-arquivar.sh        (porta 5439, banco ft)
# ===========================================================================
cd "$(dirname "$0")" || exit 1
psql -h /tmp -p "${PORTA:-5439}" -U postgres -d "${BANCO:-ft}" -X -q -At -v ON_ERROR_STOP=1 <<'SQL'
begin;
-- as reservas apontam para pedidos que nao existem: a prova so precisa da conta
set local session_replication_role = replica;
create temp table prova_pedido (id uuid) on commit drop;
insert into prova_pedido select gen_random_uuid() from generate_series(1, 3);

insert into public.material (categoria, nome, unidade, minimo, teste, tecido_id, cor_id)
select 'tecido', 'TECIDO DA PROVA · Cor ' || lpad(n::text, 2, '0'), 'kg', 10, true,
       (select id from public.tecido order by nome limit 1),
       (select id from public.cor_de_tecido order by nome offset n limit 1)
  from generate_series(1, 14) n;
insert into public.material (categoria, nome, unidade, minimo, teste, tecido_id, cor_id)
values ('tecido', 'TECIDO DA PROVA · Cor de verdade', 'kg', 10, false,
        (select id from public.tecido order by nome limit 1),
        (select id from public.cor_de_tecido order by nome offset 40 limit 1));
insert into public.material (categoria, nome, unidade, teste, grupo)
values ('aviamento', 'Aviamento da Prova do Arquivar', 'un', true, 'Prova');

-- a Cor 14 e reservada por 3 pedidos, a 13 por 2, a 12 por 1 (ja baixada nao conta)
insert into public.reserva (pedido_id, material_id, quantidade, unidade)
select p.id, m.id, 5, 'kg' from prova_pedido p, public.material m where m.nome = 'TECIDO DA PROVA · Cor 14';
insert into public.reserva (pedido_id, material_id, quantidade, unidade)
select p.id, m.id, 5, 'kg' from (select id from prova_pedido limit 2) p, public.material m where m.nome = 'TECIDO DA PROVA · Cor 13';
insert into public.reserva (pedido_id, material_id, quantidade, unidade)
select p.id, m.id, 5, 'kg' from (select id from prova_pedido limit 1) p, public.material m where m.nome = 'TECIDO DA PROVA · Cor 12';
insert into public.reserva (pedido_id, material_id, quantidade, unidade, baixada)
select p.id, m.id, 5, 'kg', true from prova_pedido p, public.material m where m.nome = 'TECIDO DA PROVA · Cor 11';

\echo --- roda o arquivo de verdade
\i arquivar-cores-de-ensaio.sql

create temp table prova_r (ok boolean, caso text) on commit drop;
insert into prova_r
select (select count(*) from public.material where teste and categoria = 'tecido' and ativo) = 10,
       '1. ficam 10 cores de ensaio ativas'
union all select (select count(*) from public.material where teste and categoria = 'tecido' and not ativo) = 4,
       '2. as outras 4 ficam arquivadas, e nenhuma some do banco'
union all select (select bool_and(ativo) from public.material where nome in ('TECIDO DA PROVA · Cor 14', 'TECIDO DA PROVA · Cor 13', 'TECIDO DA PROVA · Cor 12')),
       '3. as tres com reserva em aberto ficam, que sao as que mais pedidos usam'
union all select not (select ativo from public.material where nome = 'TECIDO DA PROVA · Cor 11'),
       '4. reserva ja baixada nao conta: a Cor 11 sai, porque no empate vale a ordem do nome'
union all select (select string_agg(right(nome, 2), ' ' order by nome) from public.material where teste and categoria = 'tecido' and not ativo) = '08 09 10 11',
       '5. no empate saem as ultimas pela ordem do nome (08 09 10 11)'
union all select (select ativo from public.material where nome = 'TECIDO DA PROVA · Cor de verdade'),
       '6. a cor cadastrada de verdade nao e tocada'
union all select (select ativo from public.material where nome = 'Aviamento da Prova do Arquivar'),
       '7. aviamento de ensaio nao e tocado'
union all select (select count(*) from public.reserva r join public.material m on m.id = r.material_id where m.nome like 'TECIDO DA PROVA%') = 9,
       '8. as 9 reservas continuam no banco'
union all select (select count(*) from public.material_na_prateleira where nome like 'TECIDO DA PROVA%') = 11,
       '9. a tela do Estoque passa a ver 11 (as 10 de ensaio e a de verdade)';

\echo --- roda de novo: nao pode arquivar mais nada
\i arquivar-cores-de-ensaio.sql
insert into prova_r
select (select count(*) from public.material where teste and categoria = 'tecido' and ativo) = 10,
       '10. rodar de novo nao arquiva mais nenhuma';

\echo --- desfaz
\i desarquivar-cores-de-ensaio.sql
insert into prova_r
select (select count(*) from public.material where teste and categoria = 'tecido' and ativo) = 14
   and (select count(*) from public.material where nome like '%da Prova%' and not ativo) = 0,
       '11. o desarquivar devolve as 14';

\echo --- o relatorio
select case when ok then 'ok   ' else 'RUIM ' end || caso from prova_r order by split_part(caso, '.', 1)::int;
select case when bool_and(ok) then 'tudo certo: ' || count(*) || ' pontos' else 'NAO PASSOU' end from prova_r;
rollback;
SQL
