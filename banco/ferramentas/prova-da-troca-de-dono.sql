-- ===========================================================================
-- A PROVA DA 072: toda troca de dono do lead deixa rastro.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 072" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedora
  w uuid := gen_random_uuid();  -- outro vendedor
  ld uuid;
  n int; t text; d timestamptz; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-72a@prova.test', 'admin'), ('prova-72v@prova.test', 'vendedor'), ('prova-72w@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-72a@prova.test'), (v, 'prova-72v@prova.test'), (w, 'prova-72w@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova 072', 'admin', 'aprovado', 'prova-72a@prova.test'),
    (v, 'Dani da Prova 072', 'vendedor', 'aprovado', 'prova-72v@prova.test'),
    (w, 'Rafa da Prova 072', 'vendedor', 'aprovado', 'prova-72w@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.lead (nome, contato, telefone, vendedor_id) values ('LEAD PROVA 072', 'Marcos', '62999990720', v) returning id into ld;
  select count(*) into n from public.transferencia_de_lead where lead_id = ld;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 1. criar o lead com dono nao e troca (' || n || ')';

  -- 2. a vendedora passa o lead pelo PATCH de sempre: anota, sem motivo
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  update public.lead set vendedor_id = w where id = ld;
  select count(*) into n from public.transferencia_de_lead where lead_id = ld and de_quem = v and para_quem = w and quem_fez = v;
  select dono_desde into d from public.lead where id = ld;
  txt := txt || E'\n' || case when n = 1 and d is not null then 'ok  ' else 'RUIM' end || ' 2. o PATCH direto anota de quem, para quem e quem fez, e o dono_desde anda';

  -- 3. com motivo, pela funcao da tela
  perform public.trocar_dono_do_lead(ld, v, 'cliente pediu a Dani');
  select motivo into t from public.transferencia_de_lead where lead_id = ld and de_quem = w and para_quem = v;
  txt := txt || E'\n' || case when t = 'cliente pediu a Dani' then 'ok  ' else 'RUIM' end || ' 3. trocar_dono_do_lead leva o motivo (' || coalesce(t, 'nada') || ')';

  -- 4. o motivo nao vaza para a proxima troca
  update public.lead set vendedor_id = w where id = ld;
  select motivo into t from public.transferencia_de_lead where lead_id = ld order by em desc, id limit 1;
  select count(*) into n from public.transferencia_de_lead where lead_id = ld and motivo = '';
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 4. o motivo vale so para a troca dele (' || n || ' sem motivo)';

  -- 5. tirar o dono tambem e anotado
  update public.lead set vendedor_id = null where id = ld;
  select count(*) into n from public.transferencia_de_lead where lead_id = ld and para_quem is null;
  select dono_desde into d from public.lead where id = ld;
  txt := txt || E'\n' || case when n = 1 and d is null then 'ok  ' else 'RUIM' end || ' 5. tirar o dono anota "para ninguem" e zera o dono_desde';

  -- 6. a transferir_lead do admin anota UMA vez (antes da 072 seriam duas)
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  select count(*) into n from public.transferencia_de_lead where lead_id = ld;
  perform public.transferir_lead(ld, v, 'rodizio corrigido');
  select count(*) - n into n from public.transferencia_de_lead where lead_id = ld;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 6. transferir_lead anota uma vez so (' || n || ')';

  -- 7. a vendedora nao transfere pela funcao do admin
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    perform public.transferir_lead(ld, w, '');
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 7. transferir_lead continua so do admin (42501)';

  -- 8. ninguem apaga nem edita o historico
  b := true;
  set local role authenticated;
  begin
    delete from public.transferencia_de_lead where lead_id = ld;
    get diagnostics n = row_count;
    b := n = 0;
  exception when insufficient_privilege then b := true;
  end;
  reset role;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 8. o historico nao se apaga';

  raise exception E'\nPROVA DA TROCA DE DONO (072)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
