-- ===========================================================================
-- A PROVA DA 078: os erros da extensao (1 a 6) e o registro do WhatsApp
-- no lead, a W3 (7 a 11).
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  v uuid := gen_random_uuid();  -- vendedora aprovada
  a uuid := gen_random_uuid();  -- admin
  o uuid := gen_random_uuid();  -- producao
  ld uuid; janela timestamptz; resumo text;
  n int; b boolean; r record;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-78v@prova.test', 'vendedor'), ('prova-78a@prova.test', 'admin'), ('prova-78o@prova.test', 'producao');
  insert into auth.users (id, email) values (v, 'prova-78v@prova.test'), (a, 'prova-78a@prova.test'), (o, 'prova-78o@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (v, 'Vendedora da Prova 078', 'vendedor', 'aprovado', 'prova-78v@prova.test'),
    (a, 'Admin da Prova 078', 'admin', 'aprovado', 'prova-78a@prova.test'),
    (o, 'Producao da Prova 078', 'producao', 'aprovado', 'prova-78o@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  -- 1. a vendedora grava o mesmo erro tres vezes: uma linha, tres vezes
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_erro_da_extensao('9.9.9', 'campo-de-escrever', 'PROVA 078', '{"t":"footer"}'::jsonb);
  perform public.registrar_erro_da_extensao('9.9.9', 'campo-de-escrever', 'PROVA 078', null);
  perform public.registrar_erro_da_extensao('9.9.9', 'campo-de-escrever', 'PROVA 078', '{"t":"footer","f":[]}'::jsonb);
  reset role;
  select count(*) into n from public.erro_da_extensao where o_que = 'PROVA 078';
  select vezes = 3 into b from public.erro_da_extensao where o_que = 'PROVA 078';
  txt := txt || E'\n' || case when n = 1 and b then 'ok  ' else 'RUIM' end || ' 1. o mesmo erro no mesmo dia vira uma linha com 3 vezes (' || n || ')';

  -- 2. a vendedora nao le a tabela
  set local role authenticated;
  select count(*) into n from public.erro_da_extensao where o_que = 'PROVA 078';
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 2. a vendedora nao le os erros (' || n || ')';

  -- 3. o admin le
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.erro_da_extensao where o_que = 'PROVA 078';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 3. o admin le os erros (' || n || ')';
  reset role;

  -- 4. quem nao entrou nao grava
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  b := false;
  begin
    perform public.registrar_erro_da_extensao('9.9.9', 'campo-de-escrever', 'PROVA 078 anon', null);
  exception when insufficient_privilege then b := true;
  end;
  reset role;
  select count(*) into n from public.erro_da_extensao where o_que = 'PROVA 078 anon';
  txt := txt || E'\n' || case when b and n = 0 then 'ok  ' else 'RUIM' end || ' 4. sem entrar, a funcao de gravar e recusada';

  -- 5. o vigia (sem entrar) le o resumo, sem dizer quem
  set local role anon;
  select * into r from public.erros_da_extensao_para_o_vigia(now() - interval '1 hour') where o_que = 'PROVA 078';
  reset role;
  txt := txt || E'\n' || case when r.vezes = 3 and r.pessoas = 1 and r.estrutura ? 'f' then 'ok  ' else 'RUIM' end
         || ' 5. o vigia le versao, onde, o esqueleto mais novo, 3 vezes e 1 pessoa, sem o id';

  -- 6. esqueleto grande demais e cortado
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_erro_da_extensao('9.9.9', 'botao-de-enviar', 'PROVA 078 grande', jsonb_build_object('x', repeat('a', 20000)));
  reset role;
  select (estrutura ->> 'cortado') = 'true' into b from public.erro_da_extensao where o_que = 'PROVA 078 grande';
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. esqueleto acima de 16 mil letras fica so "cortado"';

  -- 7. a vendedora registra a conversa do lead dela: 3 mensagens entram
  insert into public.lead (nome, telefone, vendedor_id) values ('Lead PROVA 078', '62999990078', v) returning id, janela_ate into ld, janela;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  n := public.registrar_conversa_do_whatsapp(ld, jsonb_build_array(
    jsonb_build_object('id', 'false_5562999990078@c.us_PROVA1', 'eu', false, 'em', '2026-10-13T14:30:00.000Z', 'tipo', 'texto', 'texto', 'Oi, quanto fica 20 camisas?'),
    jsonb_build_object('id', 'false_5562999990078@c.us_PROVA2', 'eu', false, 'em', '2026-10-13T14:31:00.000Z', 'tipo', 'audio', 'texto', ''),
    jsonb_build_object('id', 'true_5562999990078@c.us_PROVA3', 'eu', true, 'em', '2026-10-13T14:35:00.000Z', 'tipo', 'texto', 'texto', 'Fica R$ 1.200,00')));
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 7. a vendedora registra 3 mensagens no lead dela (' || n || ')';

  -- 8. a mesma leitura de novo nao duplica
  n := public.registrar_conversa_do_whatsapp(ld, jsonb_build_array(
    jsonb_build_object('id', 'false_5562999990078@c.us_PROVA1', 'eu', false, 'em', '2026-10-13T14:30:00.000Z', 'tipo', 'texto', 'texto', 'Oi, quanto fica 20 camisas?')));
  reset role;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 8. a mesma mensagem lida de novo nao entra duas vezes (' || n || ')';

  -- 9. quem mandou, o tipo, o canal, a pessoa, o cartao e a janela
  select string_agg(quem::text || ':' || tipo::text || ':' || (pessoa_id is not null)::text, ',' order by em) into resumo
    from public.mensagem where lead_id = ld;
  select (l.ultima_msg = 'Fica R$ 1.200,00') and (l.janela_ate is not distinct from janela)
         and not exists (select 1 from public.mensagem x where x.lead_id = ld and x.canal <> 'whatsapp_vendedor') into b
    from public.lead l where l.id = ld;
  txt := txt || E'\n' || case when b and resumo = 'cliente:texto:false,cliente:audio:false,nos:texto:true' then 'ok  ' else 'RUIM' end
         || ' 9. cliente e nos, o audio como fato, a vendedora em quem mandou, o cartao com a ultima e a janela de 24 h parada (' || coalesce(resumo, '-') || ')';

  -- 10. a producao (nao edita o Funil) nao registra
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  b := false;
  begin
    perform public.registrar_conversa_do_whatsapp(ld, '[]'::jsonb);
  exception when insufficient_privilege then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 10. quem nao edita o Funil nao registra';

  -- 11. lead que nao existe e recusado, e lista grande demais tambem
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  b := false;
  begin
    perform public.registrar_conversa_do_whatsapp(gen_random_uuid(), '[]'::jsonb);
  exception when raise_exception then b := true;
  end;
  begin
    perform public.registrar_conversa_do_whatsapp(ld, (select jsonb_agg(jsonb_build_object('id', 'x' || g)) from generate_series(1, 201) g));
    b := false;
  exception when invalid_parameter_value then null;
  end;
  reset role;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 11. lead que nao existe e lista com mais de 200 sao recusados';

  raise exception E'\nPROVA DOS ERROS DA EXTENSAO E DO REGISTRO DO WHATSAPP (078)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
