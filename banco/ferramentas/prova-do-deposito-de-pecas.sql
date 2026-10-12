-- ===========================================================================
-- A PROVA DA 073: o deposito de pecas prontas.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 073" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedor (so ve as fichas)
  ref uuid; lote public.peca_pronta;
  n int; b boolean; t text;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-73a@prova.test', 'admin'), ('prova-73v@prova.test', 'vendedor');
  insert into auth.users (id, email) values (a, 'prova-73a@prova.test'), (v, 'prova-73v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova 073', 'admin', 'aprovado', 'prova-73a@prova.test'),
    (v, 'Dani da Prova 073', 'vendedor', 'aprovado', 'prova-73v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.referencia (cod, nome, genero) values ('FT-073-001M', 'CAMISETA PROVA 073', 'M') returning id into ref;

  -- 1. o admin guarda: a grade sai limpa (zero e lixo ficam de fora)
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  lote := public.guardar_pecas(ref, ' Preto ', 'pronta', 'PD-1', '{"P":6,"M":12,"G":0,"GG":"x","XG":-2}'::jsonb, 'P2 · B3');
  txt := txt || E'\n' || case when lote.grade = '{"P":6,"M":12}'::jsonb and lote.cor = 'Preto' and lote.pedido = '' and lote.cod = 'FT-073-001M' and lote.onde = 'P2 · B3' then 'ok  ' else 'RUIM' end
         || ' 1. guardar: a grade limpa, a cor aparada, o pedido so na sobra, o codigo junto (' || lote.grade::text || ')';
  select count(*) into n from public.movimento_de_peca where lote_id = lote.id and tipo = 'guardou';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 2. guardar anota o movimento';

  -- 3. sobra de pedido guarda o numero
  t := (public.guardar_pecas(ref, 'Branco', 'sobra', 'PD-0398', '{"M":2}'::jsonb, '')).pedido;
  txt := txt || E'\n' || case when t = 'PD-0398' then 'ok  ' else 'RUIM' end || ' 3. a sobra guarda o pedido (' || t || ')';

  -- 4. baixa: tira, zera o tamanho e anota com o motivo
  lote := public.dar_baixa_de_pecas(lote.id, '{"P":6,"M":2}'::jsonb, 'vendida no balcão');
  select motivo into t from public.movimento_de_peca where lote_id = lote.id and tipo = 'baixa';
  txt := txt || E'\n' || case when lote.grade = '{"M":10}'::jsonb and t = 'vendida no balcão' then 'ok  ' else 'RUIM' end
         || ' 4. a baixa tira, some o tamanho zerado e anota o motivo (' || lote.grade::text || ')';

  -- 5. nao tira mais do que tem
  b := false;
  begin
    perform public.dar_baixa_de_pecas(lote.id, '{"M":11}'::jsonb, 'teste');
  exception when sqlstate '22023' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 5. a baixa recusa tirar mais do que o lote tem';

  -- 6. baixa sem motivo nao vai
  b := false;
  begin
    perform public.dar_baixa_de_pecas(lote.id, '{"M":1}'::jsonb, '  ');
  exception when sqlstate '22023' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. a baixa pede o motivo';

  -- 7. mudar de lugar anota
  lote := public.mudar_lugar_do_lote(lote.id, 'P3 · A1');
  select count(*) into n from public.movimento_de_peca where lote_id = lote.id and tipo = 'lugar' and motivo = 'P3 · A1';
  txt := txt || E'\n' || case when lote.onde = 'P3 · A1' and n = 1 then 'ok  ' else 'RUIM' end || ' 7. mudar o lugar troca e anota';

  -- 8. quem nao edita as fichas nao guarda
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    perform public.guardar_pecas(ref, 'Azul', 'pronta', '', '{"M":1}'::jsonb, '');
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 8. sem "editar" nas fichas, nao guarda (42501)';

  -- 9. ninguem escreve direto na tabela
  set local role authenticated;
  b := false;
  begin
    insert into public.peca_pronta (cod, nome) values ('X', 'X');
  exception when insufficient_privilege then b := true;
  end;
  reset role;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 9. escrever direto na tabela e recusado (so pelas funcoes)';

  raise exception E'\nPROVA DO DEPOSITO DE PECAS (073)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
