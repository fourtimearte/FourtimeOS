-- ===========================================================================
-- A PROVA DA 064: a conversa do pedido e o sino.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Veste quatro pessoas
-- (admin, producao, vendedor e analista) e cria o proprio pedido.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  p uuid := gen_random_uuid();  -- producao: quem confere
  v uuid := gen_random_uuid();  -- vendedor do pedido
  y uuid := gen_random_uuid();  -- analista: nao ve o PCP
  cot uuid; ped uuid;
  n int; t text; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-64a@prova.test', 'admin'), ('prova-64p@prova.test', 'producao'),
    ('prova-64v@prova.test', 'vendedor'), ('prova-64y@prova.test', 'analista');
  insert into auth.users (id, email) values
    (a, 'prova-64a@prova.test'), (p, 'prova-64p@prova.test'), (v, 'prova-64v@prova.test'), (y, 'prova-64y@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova', 'admin', 'aprovado', 'prova-64a@prova.test'),
    (p, 'Bruna da Prova', 'producao', 'aprovado', 'prova-64p@prova.test'),
    (v, 'Dani da Prova', 'vendedor', 'aprovado', 'prova-64v@prova.test'),
    (y, 'Analista da Prova', 'analista', 'aprovado', 'prova-64y@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-064', '{}'::jsonb, 6, 'Cliente da Prova 064') returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado, vendedor_id) values ('PD-PROVA-064', cot, 'separacao', v) returning id into ped;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  update public.pedido set estado = 'pcp' where id = ped;

  -- 1. o PCP devolve ao vendedor: vira a primeira mensagem e avisa o vendedor
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  perform public.abrir_no_pcp(ped);
  perform public.devolver_ao_vendedor(ped, 'O L-03 esta sem etiqueta.');
  select texto into t from public.conversa_do_pedido where pedido_id = ped and com = v and quem = p;
  select count(*) into n from public.aviso_do_sino where pessoa_id = v and tipo = 'devolvido' and pedido_id = ped and de = p
     and link = '/pcp?pedido=' || ped and texto like 'PD-PROVA-064 voltou do PCP: O L-03%';
  txt := txt || E'\n' || case when t = 'Devolvi o pedido para você: O L-03 esta sem etiqueta.' and n = 1 then 'ok  ' else 'RUIM' end
         || ' 1. a devolucao vira a primeira mensagem da conversa com o vendedor e avisa ele no sino';

  -- 2. o vendedor responde na conversa dele: avisa quem esta conferindo
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  perform public.falar_no_pedido(ped, v, 'E a Eti. Fourtime, igual as outras.');
  select count(*) into n from public.aviso_do_sino where pessoa_id = p and tipo = 'conversa' and de = v;
  txt := txt || E'\n' || case when n = 1 and not exists (select 1 from public.aviso_do_sino where pessoa_id = v and tipo = 'conversa') then 'ok  ' else 'RUIM' end
         || ' 2. a resposta do vendedor avisa quem confere, e ninguem e avisado da propria mensagem';

  -- 3. de fora, so na sua conversa
  perform set_config('request.jwt.claim.sub', y::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', y)::text, true);
  b := false;
  begin
    perform public.falar_no_pedido(ped, v, 'Intrometido.');
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 3. quem nao ve o PCP nao escreve na conversa dos outros (42501)';

  -- 4. o PCP escreve: avisa o vendedor; mensagem vazia e recusada
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  perform public.falar_no_pedido(ped, v, 'Combinado, vou marcar.');
  b := false;
  begin
    perform public.falar_no_pedido(ped, v, '   ');
  exception when sqlstate '23514' then b := true;
  end;
  select count(*) into n from public.aviso_do_sino where pessoa_id = v and lido_em is null;
  txt := txt || E'\n' || case when b and n = 2 then 'ok  ' else 'RUIM' end || ' 4. o PCP escreve e avisa o vendedor; mensagem vazia nao entra';

  -- 5. a lista com os nomes, em ordem
  select string_agg(quem_nome, ',' order by em, quem_nome) into t from public.conversa_na_lista where pedido_id = ped;
  select count(*) into n from public.conversa_na_lista where pedido_id = ped and com_nome = 'Dani da Prova';
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 5. tres mensagens na conversa com a Dani (' || coalesce(t, '') || ')';

  -- 6. ler os avisos: so os da pessoa
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  n := public.ler_avisos(null);
  txt := txt || E'\n' || case when n = 2
           and not exists (select 1 from public.aviso_do_sino where pessoa_id = v and lido_em is null)
           and exists (select 1 from public.aviso_do_sino where pessoa_id = p and lido_em is null) then 'ok  ' else 'RUIM' end
         || ' 6. ler os avisos marca os dois do vendedor e nao toca no do PCP';

  -- 7. cada um le so o seu sino, e a conversa so quem pode: o vendedor so ve
  --    o PCP, e por isso nao le a conversa do PCP com o diretor
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  perform public.falar_no_pedido(ped, a, 'Diretor, olha o L-03.');
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  set local role authenticated;
  select count(*) into n from public.aviso_do_sino;
  b := n = 2;
  select count(*) into n from public.conversa_do_pedido where pedido_id = ped;
  b := b and n = 3;
  perform set_config('request.jwt.claim.sub', y::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', y)::text, true);
  select count(*) into n from public.conversa_do_pedido where pedido_id = ped;
  b := b and n = 0;
  reset role;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 7. o vendedor le so os avisos e a conversa dele; o analista nao le a conversa dos outros';

  -- 8. o anonimo nao le
  set local role anon;
  b := false;
  begin
    select count(*) into n from public.aviso_do_sino;
  exception when insufficient_privilege then b := true;
  end;
  reset role;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 8. o anonimo nao le o sino';

  raise exception E'\nPROVA DA CONVERSA DO PEDIDO (064)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
