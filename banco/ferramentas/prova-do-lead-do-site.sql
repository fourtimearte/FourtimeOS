-- ===========================================================================
-- A PROVA DA 065 E DA 066: o lead do site.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Veste um admin, um gerente
-- e uma vendedora, e chama a funcao como a chave de servico chamaria.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  g uuid := gen_random_uuid();  -- gerente
  v uuid := gen_random_uuid();  -- vendedora: a pessoa fixa
  envio uuid := gen_random_uuid();
  envio2 uuid := gen_random_uuid();
  tel text := '+5562' || (900000000 + floor(random() * 99999999))::bigint::text;
  ficha jsonb;
  r jsonb; r2 jsonb;
  lid uuid;
  n int; t text; b boolean; l public.lead;
  imp text := 'prova-065-' || md5(random()::text);
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-65a@prova.test', 'admin'), ('prova-65g@prova.test', 'gerente'), ('prova-65v@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-65a@prova.test'), (g, 'prova-65g@prova.test'), (v, 'prova-65v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Diretor da Prova', 'admin', 'aprovado', 'prova-65a@prova.test'),
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-65g@prova.test'),
    (v, 'Dani da Prova', 'vendedor', 'aprovado', 'prova-65v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  ficha := jsonb_build_object(
    'origem', 'site-chat', 'id_envio', envio, 'enviado_em', '2026-10-11T15:00:08-03:00',
    'aberto_em', '2026-10-11T14:58:00-03:00', 'empresa_extra', '',
    'nome', 'Fernanda da Prova', 'telefone', tel, 'email', 'fernanda@prova.test',
    'tipo_peca', 'kit_camiseta_short', 'modelo_camiseta', 'raglan', 'finalidade', 'academia',
    'quantidade_faixa', '50_100', 'prazo', 'urgente', 'arte', 'criar_do_zero',
    'mensagem', 'Queremos a logo nas costas.', 'detalhe', 'Queremos a logo nas costas.',
    'pagina_origem', 'https://fourtimefit.com.br/products/raglan',
    'utm', jsonb_build_object('source', 'instagram', 'medium', 'cpc', 'campaign', 'academias-outubro', 'content', '', 'term', ''),
    'consentimento_em', '2026-10-11T15:00:00-03:00', 'consentimento_texto', 'politica-2026-09',
    'prioridade', true, 'envio_numero', 1, 'teste', true,
    'campo_que_nao_existe', 'nao pode entrar',
    'mensagens', jsonb_build_array(
      jsonb_build_object('autor', 'cliente', 'texto', 'Quero um orçamento.', 'em', '2026-10-11T14:59:00-03:00'),
      jsonb_build_object('autor', 'bot', 'texto', 'Ótimo! Qual peça?', 'em', '2026-10-11T14:59:05-03:00'),
      jsonb_build_object('autor', 'cliente', 'texto', '<b>Kit</b> camiseta e short', 'em', '2026-10-11T14:59:30-03:00'))
  );

  -- a regra: pessoa fixa, a Dani
  update public.regra_do_lead_do_site set modo = 'pessoa_fixa', pessoa_id = v where id = 1;

  -- 1. ficha nova: lead novo da Dani, no Novo lead, com o briefing do contrato
  r := public.registrar_lead_do_site(ficha, imp);
  lid := (r->>'lead_id')::uuid;
  select * into l from public.lead where id = lid;
  txt := txt || E'\n' || case when (r->>'repetido')::boolean = false and l.vendedor_id = v and l.estagio = 'novo'
      and l.origem = 'site-chat' and l.teste and l.prioridade and l.email = 'fernanda@prova.test'
      and l.briefing->>'tipo_peca' = 'kit_camiseta_short' and l.briefing->'utm'->>'campaign' = 'academias-outubro'
      and not l.briefing ? 'campo_que_nao_existe' and l.consentimento_texto = 'politica-2026-09'
      and l.consentimento_em is not null and l.id_envio = envio
    then 'ok  ' else 'RUIM' end || ' 1. ficha nova vira lead da pessoa fixa, com o briefing do contrato e nada fora dele';

  -- 2. as falas viram mensagens do canal site, e a janela de 24 h NAO abre
  select count(*) into n from public.mensagem where lead_id = lid and canal = 'site';
  select texto into t from public.mensagem where lead_id = lid and id_externo = 'site:' || envio || ':3';
  txt := txt || E'\n' || case when n = 3 and l.janela_ate is null and t = '<b>Kit</b> camiseta e short'
      and (select quem from public.mensagem where lead_id = lid and id_externo = 'site:' || envio || ':2') = 'sistema'
    then 'ok  ' else 'RUIM' end || ' 2. as tres falas entram no canal site (o robo como sistema, o texto como veio) e a janela nao abre';

  -- 3. o sino avisa a Dani, e so ela (prioridade e so o selo)
  select count(*) into n from public.aviso_do_sino where tipo = 'lead' and link = '/funil?lead=' || lid;
  txt := txt || E'\n' || case when n = 1 and exists (select 1 from public.aviso_do_sino where pessoa_id = v and tipo = 'lead'
      and texto = 'Lead novo pelo site: Fernanda da Prova') then 'ok  ' else 'RUIM' end
      || ' 3. o sino avisa so a dona do lead, mesmo com prioridade';

  -- 4. a mesma ficha de novo, com uma fala a mais: o mesmo lead, so a fala nova
  ficha := jsonb_set(ficha, '{envio_numero}', '2');
  ficha := jsonb_set(ficha, '{mensagens}', (ficha->'mensagens') || jsonb_build_array(
    jsonb_build_object('autor', 'cliente', 'texto', 'E o prazo?', 'em', '2026-10-11T16:00:00-03:00')));
  r2 := public.registrar_lead_do_site(ficha, imp);
  select count(*) into n from public.mensagem where lead_id = lid and canal = 'site';
  txt := txt || E'\n' || case when (r2->>'lead_id')::uuid = lid and (r2->>'repetido')::boolean and n = 4
      and (select (briefing->>'envio_numero')::int from public.lead where id = lid) = 2
      and (select count(*) from public.lead where id_envio = envio) = 1
    then 'ok  ' else 'RUIM' end || ' 4. reenvio da mesma conversa: mesmo lead, envio_numero 2, so a fala nova entra';

  -- 11 (066). o cartao mostra a ultima fala do CLIENTE, e nao a "mensagem" da ficha nem o robo
  ficha := jsonb_set(ficha, '{envio_numero}', '3');
  ficha := jsonb_set(ficha, '{mensagem}', '"Você já tem a arte?"');
  ficha := jsonb_set(ficha, '{mensagens}', (ficha->'mensagens') || jsonb_build_array(
    jsonb_build_object('autor', 'bot', 'texto', 'Você já tem a arte?', 'em', '2026-10-11T16:00:05-03:00')));
  perform public.registrar_lead_do_site(ficha, imp);
  txt := txt || E'\n' || case when (select ultima_msg from public.lead where id = lid) = 'E o prazo?'
    then 'ok  ' else 'RUIM' end || ' 11. o cartao mostra a ultima fala do cliente, e nao a pergunta do robo (066)';

  -- 5. outra conversa do mesmo telefone com o lead aberto: o mesmo cartao
  r2 := public.registrar_lead_do_site(jsonb_set(jsonb_set(ficha, '{id_envio}', to_jsonb(envio2)), '{envio_numero}', '1'), imp);
  txt := txt || E'\n' || case when (r2->>'lead_id')::uuid = lid and (r2->>'repetido')::boolean
      and (select count(*) from public.lead where public.fim_do_telefone(telefone) = public.fim_do_telefone(tel)) = 1
    then 'ok  ' else 'RUIM' end || ' 5. mesmo telefone com lead aberto vai para o mesmo cartao';

  -- 6. codigo fora da lista e recusado
  b := false;
  begin
    perform public.registrar_lead_do_site(jsonb_set(jsonb_set(ficha, '{id_envio}', to_jsonb(gen_random_uuid())), '{prazo}', '"ontem"'), imp || 'x');
  exception when others then b := sqlerrm like 'prazo fora da lista%';
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 6. codigo do orcamento fora da lista e recusado';

  -- 7. a isca preenchida e recusada com o codigo dela, sem gravar lead
  b := false;
  begin
    perform public.registrar_lead_do_site(jsonb_set(jsonb_set(ficha, '{id_envio}', to_jsonb(gen_random_uuid())), '{empresa_extra}', '"Robo Ltda"'), imp || 'y');
  exception when sqlstate 'P0422' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 7. a isca preenchida e recusada (P0422)';

  -- 8. o limite: o sexto envio em 10 minutos da mesma impressao e recusado
  b := false;
  begin
    for n in 1..6 loop
      perform public.registrar_lead_do_site(ficha, imp || 'z');
    end loop;
  exception when sqlstate 'P0429' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 8. o sexto envio em 10 minutos da mesma impressao e recusado (P0429)';

  -- 9. sem pessoa fixa: o lead nasce sem dono e o sino avisa admin e gerente
  update public.regra_do_lead_do_site set pessoa_id = null where id = 1;
  r := public.registrar_lead_do_site(jsonb_set(jsonb_set(ficha, '{id_envio}', to_jsonb(gen_random_uuid())),
         '{telefone}', to_jsonb('+5562' || (900000000 + floor(random() * 99999999))::bigint::text)), imp || 'w');
  lid := (r->>'lead_id')::uuid;
  txt := txt || E'\n' || case when (select vendedor_id from public.lead where id = lid) is null
      and exists (select 1 from public.aviso_do_sino where pessoa_id = a and link = '/funil?lead=' || lid)
      and exists (select 1 from public.aviso_do_sino where pessoa_id = g and link = '/funil?lead=' || lid)
      and not exists (select 1 from public.aviso_do_sino where pessoa_id = v and link = '/funil?lead=' || lid)
    then 'ok  ' else 'RUIM' end || ' 9. sem pessoa fixa: lead sem dono, e o sino avisa admin e gerente';

  -- 10. so a chave de servico chama; e so o admin muda a regra
  b := not has_function_privilege('anon', 'public.registrar_lead_do_site(jsonb, text)', 'execute')
       and not has_function_privilege('authenticated', 'public.registrar_lead_do_site(jsonb, text)', 'execute');
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.regra_do_lead_do_site set modo = 'rodizio' where id = 1;
  get diagnostics n = row_count;
  reset role;
  b := b and n = 0;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.regra_do_lead_do_site set modo = 'rodizio' where id = 1;
  get diagnostics n = row_count;
  reset role;
  b := b and n = 1 and (select atualizado_por from public.regra_do_lead_do_site) = a;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end
      || ' 10. so a chave de servico chama a funcao; a vendedora nao muda a regra e o admin muda (fica anotado)';

  raise exception E'\nPROVA DO LEAD DO SITE (065 e 066)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
