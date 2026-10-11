-- ===========================================================================
-- A PROVA DA 063: quem confere, os devolvidos ao vendedor e os liberados.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Veste tres pessoas (admin,
-- producao e vendedor) e cria o proprio pedido ("PROVA 063" no nome).
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin: o diretor
  p uuid := gen_random_uuid();  -- producao: quem confere
  v uuid := gen_random_uuid();  -- vendedor: so ve o PCP
  cot uuid; ped uuid;
  r public.pedido;
  n int; t text; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-63a@prova.test', 'admin'), ('prova-63p@prova.test', 'producao'), ('prova-63v@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-63a@prova.test'), (p, 'prova-63p@prova.test'), (v, 'prova-63v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova', 'admin', 'aprovado', 'prova-63a@prova.test'),
    (p, 'Bruna da Prova', 'producao', 'aprovado', 'prova-63p@prova.test'),
    (v, 'Dani da Prova', 'vendedor', 'aprovado', 'prova-63v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-063', '{}'::jsonb, 6, 'Cliente da Prova 063') returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-063', cot, 'separacao') returning id into ped;
  /* entra no PCP como entra de verdade: a separacao concluida muda o estado */
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  update public.pedido set estado = 'pcp' where id = ped;

  -- 1. quem confere abre: fica sendo quem esta conferindo; o segundo nao troca
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  r := public.abrir_no_pcp(ped);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  r := public.abrir_no_pcp(ped);
  select count(*) into n from public.passo_do_pcp where pedido_id = ped and tipo = 'abriu';
  txt := txt || E'\n' || case when r.conferindo_por = p and r.conferindo_em is not null and n = 1 then 'ok  ' else 'RUIM' end
         || ' 1. a primeira pessoa que abre fica conferindo, e abrir de novo nao troca';

  -- 2. o vendedor nao confere
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin
    perform public.abrir_no_pcp(ped);
  exception when sqlstate '42501' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 2. o vendedor nao abre para conferir (42501)';

  -- 3. quem confere devolve ao vendedor, e so com motivo
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  b := false;
  begin
    perform public.devolver_ao_vendedor(ped, ' ');
  exception when sqlstate '23514' then b := true;
  end;
  r := public.devolver_ao_vendedor(ped, 'O L-03 esta sem etiqueta.');
  select count(*) into n from public.pedido_no_pcp where id = ped and com_o_vendedor and vendedor_por_nome = 'Bruna da Prova'
     and vendedor_motivo = 'O L-03 esta sem etiqueta.' and conferindo_por_nome = 'Bruna da Prova' and cotacao_numero = 'CO-PROVA-063';
  txt := txt || E'\n' || case when b and r.estado = 'pcp' and n = 1 then 'ok  ' else 'RUIM' end
         || ' 3. devolver ao vendedor pede motivo, deixa o pedido no PCP e a view mostra quem e por que';

  -- 4. voltar a conferir tira dos devolvidos, e o motivo fica na linha do tempo
  r := public.voltar_a_conferir(ped);
  select count(*) into n from public.passo_do_pcp where pedido_id = ped and tipo in ('ao_vendedor', 'voltou')
     and (tipo = 'voltou' or texto = 'O L-03 esta sem etiqueta.');
  txt := txt || E'\n' || case when r.vendedor_em is null and r.vendedor_motivo = '' and n = 2 then 'ok  ' else 'RUIM' end
         || ' 4. voltar a conferir tira dos devolvidos e a linha do tempo guarda o motivo';

  -- 5. devolvido de novo, marcar resolve: a marca limpa a devolucao ao vendedor
  r := public.devolver_ao_vendedor(ped, 'Confirmar a cor do calcao.');
  r := public.marcar_para_aprovacao(ped);
  select count(*) into n from public.passo_do_pcp where pedido_id = ped and tipo = 'marcou' and quem = p;
  txt := txt || E'\n' || case when r.marcado_em is not null and r.vendedor_em is null and n = 1 then 'ok  ' else 'RUIM' end
         || ' 5. marcar como conferido tira o pedido dos devolvidos e fica anotado com quem marcou';

  -- 6. marcado nao se devolve ao vendedor
  b := false;
  begin
    perform public.devolver_ao_vendedor(ped, 'Tarde demais.');
  exception when sqlstate '23514' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. o marcado nao volta ao vendedor (23514)';

  -- 7. o diretor devolve ao PCP: fica anotado com o motivo
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  r := public.devolver_do_pcp(ped, 'Falta conferir a grade do goleiro.');
  select texto into t from public.passo_do_pcp where pedido_id = ped and tipo = 'devolveu';
  txt := txt || E'\n' || case when r.marcado_em is null and t = 'Falta conferir a grade do goleiro.' then 'ok  ' else 'RUIM' end
         || ' 7. a devolucao do diretor ao PCP fica na linha do tempo, com o motivo';

  -- 8. marcado de novo e liberado: quem aprovou e quando
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  r := public.marcar_para_aprovacao(ped);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  r := public.liberar_para_producao(ped, '[{"tecnica":"subli","layouts":[1],"pecas":10}]'::jsonb);
  select count(*) into n from public.pedido_liberado where id = ped and liberado_por_nome = 'Diretor da Prova'
     and marcado_por_nome = 'Bruna da Prova' and liberado_em is not null;
  txt := txt || E'\n' || case when r.estado = 'producao' and r.liberado_por = a and n = 1
           and exists (select 1 from public.passo_do_pcp where pedido_id = ped and tipo = 'liberou' and quem = a) then 'ok  ' else 'RUIM' end
         || ' 8. liberar carimba quem aprovou e quando, e o pedido aparece nos liberados';

  -- 9. a linha do tempo em ordem, com os nomes
  select string_agg(tipo, ',' order by em, tipo) into t from public.passo_do_pcp_na_lista where pedido_id = ped;
  select count(*) into n from public.passo_do_pcp_na_lista where pedido_id = ped and quem_nome = '';
  txt := txt || E'\n' || case when n = 0 and (select count(*) from public.passo_do_pcp where pedido_id = ped) = 8 then 'ok  ' else 'RUIM' end
         || ' 9. oito passos, todos com nome (' || coalesce(t, '') || ')';

  -- 10. quem foi aprovado le a linha do tempo; o anonimo nao
  set local role authenticated;
  select count(*) into n from public.passo_do_pcp where pedido_id = ped;
  reset role;
  set local role anon;
  b := n = 8;
  if b then b := false; else n := -1; end if;
  begin
    select count(*) into n from public.passo_do_pcp;
  exception when insufficient_privilege then b := true;
  end;
  reset role;
  txt := txt || E'\n' || case when b and n <> -1 then 'ok  ' else 'RUIM' end || ' 10. quem foi aprovado le a linha do tempo, e o anonimo nao le a linha do tempo';

  raise exception E'\nPROVA DO PCP DE QUEM CONFERE (063)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
