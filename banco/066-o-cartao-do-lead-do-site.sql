-- ===========================================================================
-- 066: O CARTAO DO LEAD DO SITE MOSTRA O QUE O CLIENTE DISSE
--
-- No primeiro lead de verdade pelo chat da loja (11/10/2026), o cartao do
-- funil mostrou "Voce ja tem a arte?": a pergunta do robo. A ficha manda em
-- "mensagem" a ultima fala da conversa, e a 065 usava ela como a ultima
-- mensagem do cartao.
--
-- O que muda:
--   1. registrar_lead_do_site passa a usar a ULTIMA FALA DO CLIENTE da
--      conversa; sem fala do cliente, a "mensagem" da ficha; sem nada, o
--      texto padrao. O resto da funcao e o da 065, sem mudanca.
--   2. os leads do site que ja estao com a fala do robo no cartao passam a
--      mostrar a ultima fala do cliente. So muda o cartao cuja ultima
--      mensagem e igual a uma fala do robo daquele lead.
-- ===========================================================================

-- ---------- 1. a funcao ----------------------------------------------------
create or replace function public.registrar_lead_do_site(p_ficha jsonb, p_impressao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f          jsonb := coalesce(p_ficha, '{}'::jsonb);
  v_envio    uuid;
  v_nome     text := btrim(coalesce(f->>'nome', ''));
  v_tel      text := regexp_replace(coalesce(f->>'telefone', ''), '\s', '', 'g');
  v_email    text := lower(btrim(coalesce(f->>'email', '')));
  v_msg      text := left(btrim(coalesce(f->>'mensagem', '')), 2000);
  v_numero   int  := case when coalesce(f->>'envio_numero', '') ~ '^[0-9]{1,4}$'
                             then greatest(1, (f->>'envio_numero')::int) else 1 end;
  v_teste    boolean := coalesce(f->'teste' = 'true'::jsonb, false);
  v_prio     boolean := coalesce(f->'prioridade' = 'true'::jsonb, false) or coalesce(f->>'motivo' = 'prioridade', false);
  v_aceite   timestamptz;
  v_em       timestamptz;
  v_briefing jsonb;
  v_falas    jsonb;
  v_lead     public.lead;
  v_repetido boolean := false;
  v_dono     uuid;
  v_regra    public.regra_do_lead_do_site;
  v_quantos  int;
  v_texto    text;
  v_ultima   text;
  i          int;
  fala       jsonb;
begin
  -- o limite por IP: 5 em 10 minutos, 20 em 24 horas
  if coalesce(length(p_impressao), 0) < 16 then
    raise exception 'sem impressao do envio' using errcode = '22023';
  end if;
  delete from public.envio_do_site where em < now() - interval '2 days';
  if (select count(*) from public.envio_do_site
       where impressao = p_impressao and em > now() - interval '10 minutes') >= 5
     or (select count(*) from public.envio_do_site
          where impressao = p_impressao and em > now() - interval '24 hours') >= 20 then
    raise exception 'limite de envios' using errcode = 'P0429';
  end if;
  insert into public.envio_do_site (impressao) values (p_impressao);

  -- a isca: gente nunca preenche
  if btrim(coalesce(f->>'empresa_extra', '')) <> '' then
    raise exception 'isca preenchida' using errcode = 'P0422';
  end if;

  -- o que a ficha precisa trazer
  if f->>'origem' is distinct from 'site-chat' then
    raise exception 'origem invalida' using errcode = '22023';
  end if;
  begin
    v_envio := (f->>'id_envio')::uuid;
  exception when others then
    raise exception 'id_envio invalido' using errcode = '22023';
  end;
  if v_envio is null then
    raise exception 'id_envio invalido' using errcode = '22023';
  end if;
  if length(v_nome) not between 2 and 120 then
    raise exception 'nome invalido' using errcode = '22023';
  end if;
  if v_tel !~ '^\+55[0-9]{10,11}$' then
    raise exception 'telefone invalido' using errcode = '22023';
  end if;
  if v_email <> '' and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'email invalido' using errcode = '22023';
  end if;
  if btrim(coalesce(f->>'consentimento_texto', '')) = '' then
    raise exception 'sem o aceite da politica' using errcode = '22023';
  end if;
  begin
    v_aceite := (f->>'consentimento_em')::timestamptz;
    v_em := coalesce((f->>'enviado_em')::timestamptz, now());
  exception when others then
    raise exception 'data invalida' using errcode = '22023';
  end;
  if v_em > now() + interval '1 day' then v_em := now(); end if;

  if f ? 'tipo_peca' and f->>'tipo_peca' not in ('kit_camiseta_short', 'camiseta', 'short', 'uniforme_completo') then
    raise exception 'tipo_peca fora da lista' using errcode = '22023';
  end if;
  if f ? 'modelo_camiseta' and f->>'modelo_camiseta' not in ('tradicional', 'raglan', 'nao_sei') then
    raise exception 'modelo_camiseta fora da lista' using errcode = '22023';
  end if;
  if f ? 'finalidade' and f->>'finalidade' not in ('time', 'escola', 'empresa', 'evento', 'academia', 'outro') then
    raise exception 'finalidade fora da lista' using errcode = '22023';
  end if;
  if f ? 'quantidade_faixa' and f->>'quantidade_faixa' not in ('ate_20', '20_50', '50_100', 'mais_100') then
    raise exception 'quantidade_faixa fora da lista' using errcode = '22023';
  end if;
  if f ? 'prazo' and f->>'prazo' not in ('urgente', 'ate_30_dias', 'sem_pressa') then
    raise exception 'prazo fora da lista' using errcode = '22023';
  end if;
  if f ? 'arte' and f->>'arte' not in ('pronta', 'ideia', 'criar_do_zero') then
    raise exception 'arte fora da lista' using errcode = '22023';
  end if;

  /* O BRIEFING E SO O QUE O CONTRATO TEM. O que nao esta aqui nao e gravado,
     por mais que venha na ficha. Texto vai como texto: quem mostra na tela
     trata como digitado por desconhecido. */
  v_briefing := jsonb_strip_nulls(jsonb_build_object(
    'tipo_peca',        f->'tipo_peca',
    'modelo_camiseta',  f->'modelo_camiseta',
    'finalidade',       f->'finalidade',
    'quantidade_faixa', f->'quantidade_faixa',
    'prazo',            f->'prazo',
    'arte',             f->'arte',
    'detalhe',          to_jsonb(left(coalesce(f->>'detalhe', ''), 2000)),
    'mensagem',         to_jsonb(v_msg),
    'motivo',           f->'motivo',
    'fora_do_horario',  f->'fora_do_horario',
    'pagina_origem',    to_jsonb(left(coalesce(f->>'pagina_origem', ''), 500)),
    'pagina_titulo',    to_jsonb(left(coalesce(f->>'pagina_titulo', ''), 200)),
    'produto',          case when jsonb_typeof(f->'produto') = 'object' then jsonb_build_object(
                          'id', left(coalesce(f->'produto'->>'id', ''), 80),
                          'titulo', left(coalesce(f->'produto'->>'titulo', ''), 200),
                          'url', left(coalesce(f->'produto'->>'url', ''), 500)) end,
    'utm',              case when jsonb_typeof(f->'utm') = 'object' then jsonb_build_object(
                          'source', left(coalesce(f->'utm'->>'source', ''), 120),
                          'medium', left(coalesce(f->'utm'->>'medium', ''), 120),
                          'campaign', left(coalesce(f->'utm'->>'campaign', ''), 200),
                          'content', left(coalesce(f->'utm'->>'content', ''), 200),
                          'term', left(coalesce(f->'utm'->>'term', ''), 200)) end,
    'fbclid',           to_jsonb(left(coalesce(f->>'fbclid', ''), 300)),
    'gclid',            to_jsonb(left(coalesce(f->>'gclid', ''), 300)),
    'entrou_por',       to_jsonb(left(coalesce(f->>'entrou_por', ''), 500)),
    'veio_de',          to_jsonb(left(coalesce(f->>'veio_de', ''), 500)),
    'dispositivo',      f->'dispositivo',
    'roteiro_atualizado_em', f->'roteiro_atualizado_em',
    'enviado_em',       to_jsonb(v_em),
    'envio_numero',     to_jsonb(v_numero)
  ));

  /* A conversa como o cliente viu (mensagens: autor, texto, em), ate 200
     falas. Sem ela, a ultima mensagem sozinha. */
  if jsonb_typeof(f->'mensagens') = 'array' then
    select coalesce(jsonb_agg(x order by n), '[]'::jsonb) into v_falas
      from (select x, n from jsonb_array_elements(f->'mensagens') with ordinality as t(x, n) where n <= 200) s;
  else
    v_falas := '[]'::jsonb;
  end if;
  if jsonb_array_length(v_falas) = 0 and v_msg <> '' then
    v_falas := jsonb_build_array(jsonb_build_object('autor', 'cliente', 'texto', v_msg, 'em', v_em));
  end if;

  /* O QUE O CARTAO MOSTRA E A ULTIMA FALA DO CLIENTE (066). A ficha manda em
     "mensagem" a ultima fala da conversa, que quase sempre e a pergunta do
     robo; no cartao, o vendedor quer ler o que o cliente disse. */
  select left(btrim(x->>'texto'), 280) into v_ultima
    from jsonb_array_elements(v_falas) with ordinality as t(x, n)
   where x->>'autor' = 'cliente' and btrim(coalesce(x->>'texto', '')) <> ''
   order by n desc
   limit 1;

  -- NOVO, REPETIDO OU JUNTA
  select * into v_lead from public.lead where id_envio = v_envio;
  if found then
    v_repetido := true;
    update public.lead
       set briefing = case when coalesce((briefing->>'envio_numero')::int, 0) <= v_numero then v_briefing else briefing end,
           email = case when email = '' then v_email else email end,
           prioridade = prioridade or v_prio
     where id = v_lead.id;
  else
    select * into v_lead from public.lead
     where public.fim_do_telefone(telefone) = public.fim_do_telefone(v_tel)
       and estagio not in ('fechado', 'perdido')
     order by atualizado_em desc
     limit 1;
    if found then
      -- mesmo telefone com lead aberto: o MESMO cartao (decisao 3)
      v_repetido := true;
      update public.lead
         set id_envio = coalesce(id_envio, v_envio),
             briefing = v_briefing,
             email = case when email = '' then v_email else email end,
             consentimento_em = coalesce(v_aceite, consentimento_em),
             consentimento_texto = left(f->>'consentimento_texto', 80),
             prioridade = prioridade or v_prio
       where id = v_lead.id;
    else
      select * into v_regra from public.regra_do_lead_do_site where id = 1;
      -- a carteira vem primeiro: cliente que ja tem vendedor volta para ele
      select c.vendedor_id into v_dono
        from public.cliente c
        join public.pessoa p on p.id = c.vendedor_id and p.situacao = 'aprovado'
       where public.fim_do_telefone(c.celular) = public.fim_do_telefone(v_tel)
          or public.fim_do_telefone(c.telefone) = public.fim_do_telefone(v_tel)
       order by c.atualizado_em desc
       limit 1;
      if v_dono is null and v_regra.modo = 'rodizio' then
        v_dono := public.dono_do_lead(v_tel);
      elsif v_dono is null then
        select p.id into v_dono from public.pessoa p
         where p.id = v_regra.pessoa_id and p.situacao = 'aprovado';
      end if;

      insert into public.lead (
        nome, contato, telefone, vendedor_id, dono_desde, origem, anuncio,
        id_envio, email, briefing, consentimento_em, consentimento_texto,
        prioridade, teste, estagio
      ) values (
        v_nome, v_nome, v_tel, v_dono, case when v_dono is not null then now() end, 'site-chat',
        left(coalesce(f->'utm'->>'campaign', ''), 200),
        v_envio, v_email, v_briefing, v_aceite, left(f->>'consentimento_texto', 80),
        v_prio, v_teste, 'novo'
      ) returning * into v_lead;
    end if;
  end if;

  /* AS FALAS ENTRAM UMA VEZ SO. O id_externo e o envio mais a posicao da
     fala: o reenvio traz a conversa inteira de novo, e so o que passou do
     ultimo envio e novo. */
  v_quantos := 0;
  i := 0;
  for fala in select * from jsonb_array_elements(v_falas) loop
    i := i + 1;
    v_texto := left(btrim(coalesce(fala->>'texto', '')), 2000);
    continue when v_texto = '';
    insert into public.mensagem (lead_id, quem, tipo, texto, em, canal, id_externo)
    values (
      v_lead.id,
      case when fala->>'autor' = 'cliente' then 'cliente'::public.quem_falou else 'sistema'::public.quem_falou end,
      'texto',
      v_texto,
      coalesce(
        case when fala->>'em' ~ '^\d{4}-\d{2}-\d{2}' then (fala->>'em')::timestamptz end,
        v_em),
      'site',
      'site:' || v_envio || ':' || i
    )
    on conflict (id_externo) where id_externo <> '' do nothing;
    if found then v_quantos := v_quantos + 1; end if;
  end loop;

  if v_quantos > 0 or not v_repetido then
    update public.lead
       set ultima_msg = left(coalesce(v_ultima, nullif(v_msg, ''), 'Pedido de orçamento pelo site'), 280),
           ultima_msg_em = greatest(coalesce(ultima_msg_em, v_em), v_em),
           nao_lidas = nao_lidas + greatest(v_quantos, 1),
           atualizado_em = now()
     where id = v_lead.id
     returning * into v_lead;

    /* O SINO: o dono do lead. Lead sem dono avisa admin e gerente, para
       alguem pegar. Prioridade e so o selo no cartao (decisao 4). */
    insert into public.aviso_do_sino (pessoa_id, tipo, texto, link)
    select p.id,
           'lead',
           case when v_repetido then 'Nova mensagem pelo site: ' else 'Lead novo pelo site: ' end || v_lead.nome,
           '/funil?lead=' || v_lead.id
      from public.pessoa p
     where p.situacao = 'aprovado'
       and (p.id = v_lead.vendedor_id
            or (v_lead.vendedor_id is null and p.papel in ('admin', 'gerente')));
  end if;

  return jsonb_build_object('lead_id', v_lead.id, 'repetido', v_repetido);
end $$;

revoke all on function public.registrar_lead_do_site(jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_lead_do_site(jsonb, text) to service_role;

-- ---------- 2. os cartoes que ja estao com a fala do robo ------------------
update public.lead l
   set ultima_msg = (
     select left(m.texto, 280) from public.mensagem m
      where m.lead_id = l.id and m.quem = 'cliente' and btrim(m.texto) <> ''
      order by m.em desc, m.id desc
      limit 1)
 where l.origem = 'site-chat'
   and exists (select 1 from public.mensagem c
                where c.lead_id = l.id and c.quem = 'cliente' and btrim(c.texto) <> '')
   and exists (select 1 from public.mensagem r
                where r.lead_id = l.id and r.quem = 'sistema' and r.canal = 'site'
                  and left(r.texto, 280) = l.ultima_msg);

-- ---------- conferencia ----------------------------------------------------
do $$
begin
  if position('v_ultima' in pg_get_functiondef('public.registrar_lead_do_site(jsonb, text)'::regprocedure)) = 0 then
    raise exception 'registrar_lead_do_site nao ficou com a ultima fala do cliente';
  end if;
  if has_function_privilege('anon', 'public.registrar_lead_do_site(jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_lead_do_site(jsonb, text)', 'execute') then
    raise exception 'registrar_lead_do_site ficou aberta para fora da chave de servico';
  end if;
  raise notice '066 ok: o cartao do lead do site mostra a ultima fala do cliente';
end $$;
