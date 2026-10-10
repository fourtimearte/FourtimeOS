-- ===========================================================================
-- A PROVA DA 060: os informes da casa.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria as proprias pessoas. Os textos que ela grava tem "DA PROVA 060",
-- e nenhum sobra.
-- ===========================================================================
do $$
declare
  d uuid := gen_random_uuid();  -- o admin
  g uuid := gen_random_uuid();  -- o gerente
  v uuid := gen_random_uuid();  -- o vendedor
  e uuid := gen_random_uuid();  -- esperando aprovacao
  x uuid; y uuid;
  n int;
  t timestamptz;
  recusou boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-id@prova.test', 'admin'), ('prova-ig@prova.test', 'gerente'), ('prova-iv@prova.test', 'vendedor'), ('prova-ie@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (d, 'prova-id@prova.test'), (g, 'prova-ig@prova.test'), (v, 'prova-iv@prova.test'), (e, 'prova-ie@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (d, 'Admin da Prova', 'admin', 'aprovado', 'prova-id@prova.test'),
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-ig@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-iv@prova.test'),
    (e, 'Esperando da Prova', 'vendedor', 'esperando', 'prova-ie@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  -- 1. os nove de hoje estao la, nos dois grupos
  select count(*) into n from public.informe_da_casa;
  select count(*) * 100 + n into n from public.informe_da_casa where grupo = 'producao';
  txt := txt || E'\n' || case when n >= 309 then 'ok  ' else 'RUIM' end || ' 1. a carga trouxe os textos de hoje, com os de producao separados';

  set local role authenticated;

  -- 2. o admin acrescenta um
  perform set_config('request.jwt.claim.sub', d::text, true);
  insert into public.informe_da_casa (grupo, texto, ordem) values ('producao', 'NOVO DA PROVA 060', 99) returning id into x;
  select count(*) into n from public.informe_da_casa where id = x and nasce_marcado;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 2. o admin acrescenta, e o texto novo nasce marcado';

  -- 3. o gerente muda: o relogio anda
  perform set_config('request.jwt.claim.sub', g::text, true);
  select alterado_em into t from public.informe_da_casa where id = x;
  perform pg_sleep(0.01);
  update public.informe_da_casa set texto = 'MUDADO DA PROVA 060', nasce_marcado = false, grupo = 'termos' where id = x;
  select count(*) into n from public.informe_da_casa where id = x and texto = 'MUDADO DA PROVA 060' and not nasce_marcado and grupo = 'termos' and alterado_em >= t;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 3. o gerente muda texto, grupo e marcacao';

  -- 4. o gerente tambem cria
  insert into public.informe_da_casa (grupo, texto) values ('termos', 'DO GERENTE DA PROVA 060') returning id into y;
  txt := txt || E'\n' || case when y is not null then 'ok  ' else 'RUIM' end || ' 4. o gerente acrescenta';

  -- 5. grupo desconhecido e texto em branco sao recusados
  recusou := false;
  begin insert into public.informe_da_casa (grupo, texto) values ('outro', 'X DA PROVA 060'); exception when check_violation then recusou := true; end;
  if recusou then recusou := false; begin insert into public.informe_da_casa (grupo, texto) values ('termos', '   '); exception when check_violation then recusou := true; end; end if;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 5. grupo desconhecido e texto em branco sao recusados';

  -- 6. o vendedor le, mas nao cria, nao muda e nao apaga
  perform set_config('request.jwt.claim.sub', v::text, true);
  select count(*) into n from public.informe_da_casa where id in (x, y);
  recusou := false;
  begin insert into public.informe_da_casa (grupo, texto) values ('termos', 'DO VENDEDOR DA PROVA 060'); exception when insufficient_privilege then recusou := true; end;
  update public.informe_da_casa set texto = 'VENDEDOR MUDOU DA PROVA 060' where id = x;
  delete from public.informe_da_casa where id = y;
  perform set_config('request.jwt.claim.sub', d::text, true);
  select count(*) * 10 + n into n from public.informe_da_casa where (id = x and texto = 'MUDADO DA PROVA 060') or id = y;
  txt := txt || E'\n' || case when n = 22 and recusou then 'ok  ' else 'RUIM' end || ' 6. o vendedor le, e nao cria, nao muda e nao apaga';

  -- 7. quem espera aprovacao nao le
  perform set_config('request.jwt.claim.sub', e::text, true);
  select count(*) into n from public.informe_da_casa;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 7. quem ainda espera aprovacao nao le';

  -- 8. o admin apaga
  perform set_config('request.jwt.claim.sub', d::text, true);
  delete from public.informe_da_casa where id in (x, y);
  select count(*) into n from public.informe_da_casa where id in (x, y);
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 8. o admin apaga';

  -- 9. o anonimo nao chega na tabela
  reset role;
  set local role anon;
  recusou := false;
  begin select count(*) into n from public.informe_da_casa; exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 9. o anonimo nao le a tabela';

  reset role;
  raise exception E'\nPROVA DOS INFORMES DA CASA (060)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
