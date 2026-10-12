-- ===========================================================================
-- A PROVA DA 069: os acessos gravam, e o apagar dados de teste alcanca as
-- tabelas novas.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  g uuid := gen_random_uuid();  -- gerente
  sufixo text := substr(md5(random()::text), 1, 6);
  f_t uuid; f_r uuid; tr_t uuid; tr_r uuid; tr_preso uuid; tb uuid;
  acao_x text; n int; b boolean; frase text;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-69a-' || sufixo || '@prova.test', 'admin'), ('prova-69g-' || sufixo || '@prova.test', 'gerente');
  insert into auth.users (id, email) values
    (a, 'prova-69a-' || sufixo || '@prova.test'), (g, 'prova-69g-' || sufixo || '@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova 69', 'admin', 'aprovado', 'prova-69a-' || sufixo || '@prova.test'),
    (g, 'Gerente da Prova 69', 'gerente', 'aprovado', 'prova-69g-' || sufixo || '@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado';
  select chave into acao_x from public.acao order by chave limit 1;

  -- 1. o admin marca e desmarca uma acao direto na tabela, como a tela faz
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.permissao_da_acao where papel = 'gerente' and acao = acao_x;
  insert into public.permissao_da_acao (papel, acao) values ('gerente', acao_x)
    on conflict (papel, acao) do nothing;
  select count(*) into n from public.permissao_da_acao where papel = 'gerente' and acao = acao_x;
  delete from public.permissao_da_acao where papel = 'gerente' and acao = acao_x;
  txt := txt || E'\n' || case when n = 1
      and not exists (select 1 from public.permissao_da_acao where papel = 'gerente' and acao = acao_x)
    then 'ok  ' else 'RUIM' end || ' 1. o admin marca e desmarca a acao (' || acao_x || ') sem permissao negada';
  reset role;

  -- 2. o gerente passa pelo grant, mas a regra da 030 ainda barra
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  b := false;
  begin
    insert into public.permissao_da_acao (papel, acao) values ('vendedor', acao_x);
  exception when insufficient_privilege then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 2. o gerente continua sem mexer na matriz';
  reset role;

  -- 3. um de cada, de teste e de verdade; um transportador de teste com corrida de verdade
  insert into public.fornecedor (nome, teste) values ('Forn teste ' || sufixo, true) returning id into f_t;
  insert into public.fornecedor (nome, teste) values ('Forn real ' || sufixo, false) returning id into f_r;
  insert into public.conferencia_de_boleto (linha, resultado, fornecedor_id, teste) values (repeat('1', 47), 'pode_pagar', f_t, true);
  insert into public.transportador (nome, meio, teste) values ('Moto teste ' || sufixo, 'motoboy', true) returning id into tr_t;
  insert into public.transportador (nome, meio, teste) values ('Moto preso ' || sufixo, 'motoboy', true) returning id into tr_preso;
  insert into public.transportador (nome, meio, teste) values ('Moto real ' || sufixo, 'motoboy', false) returning id into tr_r;
  insert into public.lancamento_de_transporte (transportador_id, motivo, valor, forma, fornecedor_id, teste)
    values (tr_t, 'busca', 10, 'pix', f_t, true), (tr_preso, 'entrega', 12, 'pix', null, false),
           (tr_r, 'busca', 15, 'pix', f_t, false);
  insert into public.tabela_de_preco (nome, teste) values ('Tab teste ' || sufixo, true) returning id into tb;

  select count(*) into n from public.dado_de_teste
   where tabela in ('fornecedor','conferencia_de_boleto','transportador','lancamento_de_transporte','tabela_de_preco')
     and linhas > 0;
  txt := txt || E'\n' || case when n = 5 then 'ok  ' else 'RUIM' end || ' 3. a view conta as cinco tabelas novas';

  -- 4. o admin apaga: sai o de teste, fica o de verdade, e o transportador preso fica e e contado
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  frase := public.apagar_dados_de_teste();
  reset role;
  txt := txt || E'\n' || case when
        not exists (select 1 from public.fornecedor where id = f_t)
    and exists (select 1 from public.fornecedor where id = f_r)
    and not exists (select 1 from public.transportador where id = tr_t)
    and exists (select 1 from public.transportador where id = tr_preso)
    and exists (select 1 from public.transportador where id = tr_r)
    and not exists (select 1 from public.tabela_de_preco where id = tb)
    and (select count(*) from public.lancamento_de_transporte where transportador_id in (tr_t, tr_preso, tr_r)) = 2
    and (select fornecedor_id from public.lancamento_de_transporte where transportador_id = tr_r) is null
    and not exists (select 1 from public.conferencia_de_boleto where fornecedor_id = f_t)
    and frase like '%Ficaram 1 transportador(es) de teste com lançamento de verdade.%'
    then 'ok  ' else 'RUIM' end || ' 4. sai o de teste, fica o de verdade (o fornecedor da corrida real vira vazio) e o transportador preso fica: ' || frase;

  raise exception E'\nPROVA DOS ACESSOS E DO TESTE (069)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
