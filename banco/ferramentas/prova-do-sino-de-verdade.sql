-- ===========================================================================
-- A PROVA DA 074: o sino de verdade.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 074" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedor
  w uuid := gen_random_uuid();  -- outro vendedor
  s uuid := gen_random_uuid();  -- estoquista (manda para a separacao)
  ld uuid; cot uuid; ped uuid;
  n int; t text;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-74a@prova.test', 'admin'), ('prova-74v@prova.test', 'vendedor'),
    ('prova-74w@prova.test', 'vendedor'), ('prova-74s@prova.test', 'estoquista');
  insert into auth.users (id, email) values
    (a, 'prova-74a@prova.test'), (v, 'prova-74v@prova.test'), (w, 'prova-74w@prova.test'), (s, 'prova-74s@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova 074', 'admin', 'aprovado', 'prova-74a@prova.test'),
    (v, 'Dani da Prova 074', 'vendedor', 'aprovado', 'prova-74v@prova.test'),
    (w, 'Lucas da Prova 074', 'vendedor', 'aprovado', 'prova-74w@prova.test'),
    (s, 'Sara da Prova 074', 'estoquista', 'aprovado', 'prova-74s@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  -- 1. o vendedor cria o proprio lead: ninguem e avisado
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  insert into public.lead (nome, vendedor_id) values ('Escola PROVA 074', v) returning id into ld;
  select count(*) into n from public.aviso_do_sino where lead_id = ld;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 1. quem cria o proprio lead nao se avisa (' || n || ')';

  -- 2. o admin passa o lead para o Lucas, com motivo: o Lucas e avisado
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform public.trocar_dono_do_lead(ld, w, 'Dani de ferias');
  select count(*), max(texto) into n, t from public.aviso_do_sino where lead_id = ld and pessoa_id = w and tipo = 'dono' and de = a;
  txt := txt || E'\n' || case when n = 1 and t like '%Dani de ferias%' then 'ok  ' else 'RUIM' end
         || ' 2. a troca de dono avisa o novo dono, com o motivo (' || coalesce(t, '-') || ')';

  -- 3. o admin cria um lead ja com a Dani de dona: a Dani e avisada
  insert into public.lead (nome, vendedor_id) values ('Clube PROVA 074', v) returning id into ld;
  select count(*), max(link) into n, t from public.aviso_do_sino where lead_id = ld and pessoa_id = v and tipo = 'dono';
  txt := txt || E'\n' || case when n = 1 and t = '/funil?lead=' || ld then 'ok  ' else 'RUIM' end
         || ' 3. lead criado com outra pessoa de dona avisa a dona (' || coalesce(t, '-') || ')';

  -- 4. sem pessoa logada (o lead do site) o gatilho nao avisa de novo
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.lead (nome, vendedor_id) values ('Site PROVA 074', v) returning id into ld;
  select count(*) into n from public.aviso_do_sino where lead_id = ld;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 4. lead sem pessoa logada (o do site) nao avisa duas vezes (' || n || ')';

  -- 5. a cotacao aprovada vira pedido: a estoquista e avisada, quem aprovou nao
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  insert into public.cotacao (numero, cliente_nome, vendedor_id, corpo, versao_do_formato) values ('CO-PROVA-074', 'Escola PROVA 074', v, '{}'::jsonb, 6) returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado, vendedor_id) values ('PD-PROVA-074', cot, 'aprovado', v) returning id into ped;
  select count(*), max(texto) into n, t from public.aviso_do_sino where pedido_id = ped and pessoa_id = s and tipo = 'pedido';
  txt := txt || E'\n' || case when n = 1 and t like '%PD-PROVA-074 · Escola PROVA 074%' then 'ok  ' else 'RUIM' end
         || ' 5. pedido novo avisa quem manda para a separacao (' || coalesce(t, '-') || ')';
  select count(*) into n from public.aviso_do_sino where pedido_id = ped and pessoa_id in (v, w);
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 6. nem quem aprovou nem outro vendedor recebem o aviso do pedido novo (' || n || ')';

  -- 7. o pedido fica pronto pela etapa: a Dani (vendedora dele) e avisada
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  update public.pedido set etapa = 'finalizado' where id = ped;  -- o gatilho poe em pronto
  select count(*), max(link) into n, t from public.aviso_do_sino where pedido_id = ped and pessoa_id = v and tipo = 'pronto';
  txt := txt || E'\n' || case when n = 1 and t = '/cotacao?c=' || cot then 'ok  ' else 'RUIM' end
         || ' 7. pronto pela etapa avisa a vendedora, com o link da cotacao (' || coalesce(t, '-') || ')';
  select count(*) into n from public.aviso_do_sino where pedido_id = ped and tipo = 'pronto' and pessoa_id <> v;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 8. so a vendedora e avisada do pronto (' || n || ' a mais)';

  -- 9. cada um le so os seus
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', w::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', w)::text, true);
  select count(*) into n from public.aviso_na_lista where pedido_id = ped;
  reset role;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 9. o Lucas nao le o aviso da Dani (' || n || ')';

  raise exception E'\nPROVA DO SINO DE VERDADE (074)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
