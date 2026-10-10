-- ===========================================================================
-- A PROVA DA 059: os presets de impressao da folha A4.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria as proprias pessoas. Os presets que ela grava tem "DA PROVA 059"
-- no nome, e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- vendedor A, que salva
  b uuid := gen_random_uuid();  -- vendedor B, que so olha
  d uuid := gen_random_uuid();  -- o admin
  e uuid := gen_random_uuid();  -- esperando aprovacao
  meu uuid; time uuid; x uuid;
  n int;
  t timestamptz;
  recusou boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-pa@prova.test', 'vendedor'), ('prova-pb@prova.test', 'vendedor'), ('prova-pd@prova.test', 'admin'), ('prova-pe@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-pa@prova.test'), (b, 'prova-pb@prova.test'), (d, 'prova-pd@prova.test'), (e, 'prova-pe@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Vendedor A da Prova', 'vendedor', 'aprovado', 'prova-pa@prova.test'),
    (b, 'Vendedor B da Prova', 'vendedor', 'aprovado', 'prova-pb@prova.test'),
    (d, 'Admin da Prova', 'admin', 'aprovado', 'prova-pd@prova.test'),
    (e, 'Esperando da Prova', 'vendedor', 'esperando', 'prova-pe@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  set local role authenticated;

  -- 1. o vendedor A salva um preset so dele, e o dono nasce dele sem mandar
  perform set_config('request.jwt.claim.sub', a::text, true);
  insert into public.preset_de_impressao (nome, valor, campos, fora)
    values ('SO MEU DA PROVA 059', false, '["cliente","pd"]', '["obs"]') returning id into meu;
  select count(*) into n from public.preset_de_impressao where id = meu and dono = a and not equipe and abre = '';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 1. o preset nasce do dono, so dele e sem abrir sozinho';

  -- 2. e um de equipe que abre sozinho na folha da producao
  insert into public.preset_de_impressao (nome, equipe, valor, abre)
    values ('DA EQUIPE DA PROVA 059', true, false, 'producao') returning id into time;
  txt := txt || E'\n' || case when time is not null then 'ok  ' else 'RUIM' end || ' 2. o preset de equipe com abre em producao entra';

  -- 3. ninguem salva em nome de outro
  recusou := false;
  begin insert into public.preset_de_impressao (nome, dono) values ('DE OUTRO DA PROVA 059', b); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 3. ninguem salva preset em nome de outra pessoa';

  -- 4. nome em branco, lista que nao e lista e abre desconhecido sao recusados
  recusou := false;
  begin insert into public.preset_de_impressao (nome) values ('   '); exception when check_violation then recusou := true; end;
  if recusou then recusou := false; begin insert into public.preset_de_impressao (nome, campos) values ('X DA PROVA 059', '{"a":1}'); exception when check_violation then recusou := true; end; end if;
  if recusou then recusou := false; begin insert into public.preset_de_impressao (nome, abre) values ('Y DA PROVA 059', 'arquivo'); exception when check_violation then recusou := true; end; end if;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 4. nome em branco, campos que nao sao lista e abre desconhecido sao recusados';

  -- 5. o vendedor B ve o de equipe e nao ve o so meu
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.preset_de_impressao where id in (meu, time);
  select count(*) + n * 10 into n from public.preset_de_impressao where id = time;
  txt := txt || E'\n' || case when n = 11 then 'ok  ' else 'RUIM' end || ' 5. o outro vendedor ve o de equipe e nao ve o que e so do dono';

  -- 6. e nao muda nem apaga o de equipe
  update public.preset_de_impressao set nome = 'MUDADO DA PROVA 059' where id = time;
  delete from public.preset_de_impressao where id = time;
  perform set_config('request.jwt.claim.sub', a::text, true);
  select count(*) into n from public.preset_de_impressao where id = time and nome = 'DA EQUIPE DA PROVA 059';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 6. quem nao e dono nao muda nem apaga o preset de equipe';

  -- 7. o dono muda: o relogio anda e o dono nao troca de mao
  select alterado_em into t from public.preset_de_impressao where id = meu;
  perform pg_sleep(0.01);
  update public.preset_de_impressao set nome = 'SO MEU RENOMEADO DA PROVA 059', dono = b, fora = '[]' where id = meu;
  select count(*) into n from public.preset_de_impressao where id = meu and dono = a and nome like 'SO MEU RENOMEADO%' and fora = '[]'::jsonb;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 7. o dono renomeia e muda, e o dono continua o mesmo';

  -- 8. quem espera aprovacao nao le nem cria
  perform set_config('request.jwt.claim.sub', e::text, true);
  select count(*) into n from public.preset_de_impressao where id = time;
  recusou := false;
  begin insert into public.preset_de_impressao (nome) values ('ESPERANDO DA PROVA 059'); exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when n = 0 and recusou then 'ok  ' else 'RUIM' end || ' 8. quem ainda espera aprovacao nao le nem cria preset';

  -- 9. o admin muda o de equipe de outra pessoa, mas nao ve o que e so dela
  perform set_config('request.jwt.claim.sub', d::text, true);
  update public.preset_de_impressao set abre = '' where id = time;
  select count(*) into n from public.preset_de_impressao where id = meu;
  select count(*) + n * 10 into n from public.preset_de_impressao where id = time and abre = '' and dono = a;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 9. o admin muda o de equipe de outra pessoa e nao ve o que e so dela';

  -- 10. o dono apaga o proprio
  perform set_config('request.jwt.claim.sub', a::text, true);
  delete from public.preset_de_impressao where id = meu;
  select count(*) into n from public.preset_de_impressao where id = meu;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 10. o dono apaga o proprio preset';

  -- 11. o anonimo nao chega na tabela
  reset role;
  set local role anon;
  recusou := false;
  begin select count(*) into n from public.preset_de_impressao; exception when insufficient_privilege then recusou := true; end;
  txt := txt || E'\n' || case when recusou then 'ok  ' else 'RUIM' end || ' 11. o anonimo nao le a tabela';

  reset role;
  raise exception E'\nPROVA DOS PRESETS DE IMPRESSAO (059)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
