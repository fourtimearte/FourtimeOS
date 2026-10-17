-- ===========================================================================
-- 084: A PORTA DAS FUNÇÕES (17/10/2026, auditoria do banco)
--
-- O QUE A AUDITORIA ACHOU. No Postgres, toda função nasce com EXECUTE para
-- PUBLIC, e PUBLIC inclui o anon: quem não entrou, com a chave pública que
-- está no site. O PostgREST publica cada função do schema public em
-- /rest/v1/rpc/<nome>. Das 142 funções, 118 podiam ser chamadas por quem não
-- entrou. Quase todas conferem quem chamou lá dentro (posso, sou_admin,
-- auth.uid) e recusam. Oito não conferem nada:
--
--   lead_do_telefone           devolvia o lead inteiro de um telefone (nome,
--                              contato, vendedor) e criava lead novo, girando
--                              o rodízio. Nenhuma tela usa.
--   dono_do_lead               girava o rodízio a cada chamada e dizia de qual
--                              vendedor é um telefone. Só o banco usa.
--   reservar_o_pedido          refaz a reserva de material de um pedido.
--   negociar_a_cotacao         refaz o negociado de uma cotação.
--   proximo_numero_de_cotacao  queimavam números da sequência.
--   proximo_numero_de_pedido
--   pedido_em_teste            só lê a regulagem (inofensiva, mas aberta).
--   lancar_transporte (a de 11 argumentos, da 042): só repassa para a nova,
--                              que confere; ficou sobrando quando a 079
--                              trocou p_pedido por p_pedidos.
--
-- O CONSERTO, em três partes:
--   1. ninguém de fora chama função nenhuma, menos as duas que são de fora
--      de propósito: painel_do_parceiro (a página do parceiro na loja) e
--      erros_da_extensao_para_o_vigia (o vigia agendado). Quem entrou
--      continua chamando o que chamava antes: nada muda para a equipe.
--      A chave de serviço (as Edge Functions) também fica com o que tinha.
--   2. as que são só do banco (dono_do_lead, lead_do_telefone) saem também
--      de quem entrou; a lancar_transporte velha sai do banco.
--   3. função NOVA nasce fechada para PUBLIC e para anon, e aberta para
--      authenticated (default privileges). Abrir para fora vira uma decisão
--      escrita na migração, e não um esquecimento.
--
-- E a tabela painel ganha a RLS que a 003 esqueceu de ligar (a regra de
-- leitura existe desde a 029; na produção a RLS já estava ligada pelo
-- painel do Supabase, e agora o repositório diz a mesma coisa).
--
-- Roda quantas vezes quiser. Termina conferindo e recusa se sobrar porta.
-- ===========================================================================

-- ---------- 1. quem entrou continua com o que tinha; PUBLIC e anon saem ------
do $$
declare
  f record;
begin
  for f in
    select p.oid, p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    if has_function_privilege('authenticated', f.oid, 'execute') then
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
    /* a chave de serviço (as Edge Functions da loja e do lead do site) também
       fica com o que tinha: muitas ela chamava só por ser PUBLIC */
    if has_function_privilege('service_role', f.oid, 'execute') then
      execute format('grant execute on function %s to service_role', f.assinatura);
    end if;
    execute format('revoke execute on function %s from public, anon', f.assinatura);
  end loop;
end $$;

-- as duas que são de fora de propósito
grant execute on function public.painel_do_parceiro(text, text) to anon;
grant execute on function public.erros_da_extensao_para_o_vigia(timestamptz) to anon;

-- ---------- 2. as que são só do banco ---------------------------------------
revoke execute on function public.dono_do_lead(text) from authenticated;
revoke execute on function public.lead_do_telefone(text, text, text, text) from authenticated;

comment on function public.dono_do_lead(text) is
  'De quem é o telefone: a dona da carteira, ou a vez do rodízio (que anda). Só o banco chama (lead do site, lead_do_telefone): a 084 tirou de quem entrou, porque cada chamada gira o rodízio.';
comment on function public.lead_do_telefone(text, text, text, text) is
  'O lead aberto deste telefone, ou um novo pelo rodízio (011). Nenhuma tela chama hoje (auditoria de 17/10/2026); fica para a entrada do WhatsApp oficial. Só o banco e a chave de serviço chamam.';

drop function if exists public.lancar_transporte(uuid, timestamptz, uuid, text, text, uuid, text, numeric, text, boolean, text);

-- ---------- 3. função nova nasce fechada para fora ----------------------------
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- ---------- 4. a RLS da tabela painel -----------------------------------------
alter table public.painel enable row level security;

-- ---------- conferência -------------------------------------------------------
do $$
declare
  abertas text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into abertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('painel_do_parceiro', 'erros_da_extensao_para_o_vigia');
  if abertas is not null then
    raise exception 'quem não entrou ainda chama: %', abertas;
  end if;
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a página do parceiro perdeu a porta';
  end if;
  if has_function_privilege('authenticated', 'public.dono_do_lead(text)', 'execute') then
    raise exception 'dono_do_lead continua aberta para quem entrou';
  end if;
  if not has_function_privilege('authenticated', 'public.posso(text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.salvar_kit(uuid, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.proximo_numero_de_cotacao()', 'execute') then
    raise exception 'quem entrou perdeu uma função que usava';
  end if;
  if not has_function_privilege('service_role', 'public.registrar_lead_do_site(jsonb, text)', 'execute')
     or not has_function_privilege('service_role', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute') then
    raise exception 'a chave de serviço perdeu uma função das Edge Functions';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.painel'::regclass) then
    raise exception 'a tabela painel ficou sem RLS';
  end if;
  raise notice '084 pronta: % funções; só a página do parceiro e o vigia abrem para fora',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f');
end $$;
