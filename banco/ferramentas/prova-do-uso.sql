-- ===========================================================================
-- A PROVA DA 049: o uso do estoque.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria os proprios materiais e escreve movimentos com data no passado
-- (10, 40, 100 e 200 dias atras), para conferir as tres janelas. Nada do
-- estoque de verdade e tocado.
-- ===========================================================================
do $$
declare
  p uuid := gen_random_uuid();  -- producao, que le
  e uuid := gen_random_uuid();  -- esperando aprovacao, que nao ve nada
  m1 uuid; m2 uuid; m3 uuid;
  u jsonb; l jsonb;
  mes10 text := to_char((now() - interval '10 days') at time zone 'America/Sao_Paulo', 'YYYY-MM');
  mes100 text := to_char((now() - interval '100 days') at time zone 'America/Sao_Paulo', 'YYYY-MM');
  soma numeric;
  n int;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-up@prova.test', 'producao'), ('prova-ue@prova.test', 'producao');
  insert into auth.users (id, email) values (p, 'prova-up@prova.test'), (e, 'prova-ue@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (p, 'Producao da Prova', 'producao', 'aprovado', 'prova-up@prova.test'),
    (e, 'Esperando da Prova', 'producao', 'esperando', 'prova-ue@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  insert into public.material (categoria, nome, unidade, grupo) values ('insumo', 'Material Um da Prova 049', 'kg', 'Prova') returning id into m1;
  insert into public.material (categoria, nome, unidade, grupo) values ('insumo', 'Material Dois da Prova 049', 'kg', 'Prova') returning id into m2;
  insert into public.material (categoria, nome, unidade, grupo) values ('insumo', 'Material Tres da Prova 049', 'kg', 'Prova') returning id into m3;

  -- m1: entra 500 (nao e uso), sai 10 ha 10 dias, 20 ha 40, 40 ha 100 e 80 ha 200; voltam 3 ha 5 dias
  insert into public.movimento_de_estoque (material_id, quantidade, motivo, quando) values
    (m1,  500, 'entrada',   now() - interval '210 days'),
    (m1,  -80, 'separacao', now() - interval '200 days'),
    (m1,  -40, 'separacao', now() - interval '100 days'),
    (m1,  -20, 'saida',     now() - interval '40 days'),
    (m1,  -10, 'separacao', now() - interval '10 days'),
    (m1,    3, 'devolucao', now() - interval '5 days'),
    (m1,   -7, 'ajuste',    now() - interval '3 days');
  -- m2: so entrada e ajuste: nao tem uso
  insert into public.movimento_de_estoque (material_id, quantidade, motivo, quando) values
    (m2, 100, 'entrada', now() - interval '20 days'),
    (m2,  -4, 'ajuste',  now() - interval '2 days');
  -- m3: usou, e depois foi arquivado
  insert into public.movimento_de_estoque (material_id, quantidade, motivo, quando) values
    (m3, 50, 'entrada', now() - interval '30 days'),
    (m3, -9, 'separacao', now() - interval '8 days');
  update public.material set ativo = false where id = m3;

  perform set_config('request.jwt.claim.sub', p::text, true);
  set local role authenticated;
  u := public.uso_do_estoque();
  select x into l from jsonb_array_elements(u) x where (x ->> 'material_id')::uuid = m1;

  -- 1. as tres janelas: 30 dias = 10 - 3; 90 dias = mais os 20; 180 dias = mais os 40; os 80 de 200 dias atras ficam de fora
  txt := txt || E'\n' || case when (l ->> 'd30')::numeric = 7 and (l ->> 'd90')::numeric = 27 and (l ->> 'd180')::numeric = 67
                              then 'ok  ' else 'RUIM' end
             || ' 1. as tres janelas somam 7, 27 e 67 (' || coalesce(l ->> 'd30', '?') || ', ' || coalesce(l ->> 'd90', '?') || ', ' || coalesce(l ->> 'd180', '?') || ')';

  -- 2. a devolucao desconta, e a entrada e o ajuste nao entram
  txt := txt || E'\n' || case when (l ->> 'd30')::numeric = 7 then 'ok  ' else 'RUIM' end
             || ' 2. devolucao desconta do uso; entrada e ajuste nao sao uso';

  -- 3. mes a mes: o mes de 10 dias atras e o de 100 dias atras estao la, e a soma dos meses nao passa do que saiu
  select coalesce(sum(v::numeric), 0) into soma from jsonb_each_text(l -> 'meses') as t(k, v);
  txt := txt || E'\n' || case when (l -> 'meses') ? mes10 and soma >= 27 and soma <= 67 then 'ok  ' else 'RUIM' end
             || ' 3. mes a mes: o mes de 10 dias atras esta la, e os meses somam entre 27 e 67 (' || soma || ')';
  select count(*) into n from jsonb_object_keys(l -> 'meses');
  txt := txt || E'\n' || case when n between 2 and 6 then 'ok  ' else 'RUIM' end || ' 3b. no maximo seis meses (' || n || ')';

  -- 4. quem so teve entrada e ajuste nao aparece
  select count(*) into n from jsonb_array_elements(u) x where (x ->> 'material_id')::uuid = m2;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 4. material sem saida nao aparece no uso';

  -- 5. material arquivado nao entra na estatistica
  select count(*) into n from jsonb_array_elements(u) x where (x ->> 'material_id')::uuid = m3;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 5. material arquivado nao entra no uso';

  -- 6. o razao a vista diz quem esta arquivado
  select count(*) filter (where material_ativo) as vivos, count(*) filter (where not material_ativo) as arquivados into n, soma
    from public.movimento_do_estoque where material_id in (m1, m3);
  txt := txt || E'\n' || case when n = 7 and soma = 2 then 'ok  ' else 'RUIM' end
             || ' 6. o razao a vista marca o movimento do material arquivado (' || n || ' vivos, ' || soma || ' arquivados)';

  -- 7. quem espera aprovacao recebe um vetor vazio
  perform set_config('request.jwt.claim.sub', e::text, true);
  u := public.uso_do_estoque();
  txt := txt || E'\n' || case when u = '[]'::jsonb then 'ok  ' else 'RUIM' end || ' 7. quem espera aprovacao nao ve uso nenhum';
  reset role;

  raise exception E'PROVA DA 049 (tudo desfeito):%', txt;
end $$;
