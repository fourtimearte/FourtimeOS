-- ===========================================================================
-- 084: A PORTA DAS FUNÇÕES E A TRAVA QUE ACEITAVA NULO (17/10/2026, auditoria)
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
-- A TRAVA QUE ACEITAVA NULO (o furo mais grave da auditoria). meu_papel()
-- devolve NULO para quem não entrou, para quem espera aprovação e para quem
-- foi bloqueado; sou_admin() é "meu_papel() = 'admin'", então também dá NULO.
-- No PL/pgSQL, "if not NULO then raise" NÃO levanta o erro: NULO não é
-- verdadeiro. Dez funções "só do admin" (salvar_permissao, criar_papel,
-- salvar_papel, apagar_papel, apagar_dados_de_teste, liberar_pedido_real,
-- decidir_o_boleto, juntar_fornecedores, transferir_lead,
-- devolver_lancamento_de_transporte), mais juntar_clientes, deixavam passar
-- justamente quem NÃO é admin nem foi aprovado. O mesmo com "if meu_papel()
-- not in (...)" em aprovar_cotacao, lead_vira_cliente, salvar_kit e
-- tabela_de_preco_padrao. Provado no ensaio em 17/10/2026: sem login,
-- apagar_papel apagou o papel. Com a porta aberta para PUBLIC (até esta
-- migração), isso valia para quem não entrou, com a chave pública do site.
--
-- O conserto: sou_admin() passa a devolver falso, nunca nulo; e as quatro
-- que perguntam "meu_papel() not in" passam a perguntar
-- "coalesce(meu_papel(), '') not in". meu_papel() continua devolvendo nulo
-- (as regras de acesso dependem de "meu_papel() is not null").
--
-- E a tabela painel ganha a RLS que a 003 esqueceu de ligar (a regra de
-- leitura existe desde a 029; na produção a RLS já estava ligada pelo
-- painel do Supabase, e agora o repositório diz a mesma coisa).
--
-- Roda quantas vezes quiser. Termina conferindo e recusa se sobrar porta.
-- ===========================================================================

-- ---------- 0. a trava que aceitava nulo -------------------------------------
create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.meu_papel() = 'admin', false) $$;
comment on function public.sou_admin() is
  'Verdadeiro só para o admin aprovado. Nunca nulo (084): "if not sou_admin()" deixava passar quem não entrou, quem espera aprovação e quem foi bloqueado.';

do $$
declare
  f   record;
  def text;
  novo text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ~ 'public\.meu_papel\(\) not in'
  loop
    def := pg_get_functiondef(f.oid);
    novo := replace(def, 'public.meu_papel() not in', 'coalesce(public.meu_papel(), '''') not in');
    if novo <> def then
      execute novo;
    end if;
  end loop;
end $$;

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
-- O EXECUTE de PUBLIC é um padrão GLOBAL do Postgres: revogar "in schema
-- public" não tira ele (o padrão por schema só soma ao global). Por isso a
-- primeira linha vale para tudo que o dono do banco criar; as outras abrem
-- de novo, só no public, para quem precisa.
alter default privileges revoke execute on functions from public;
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
  /* a trava não aceita mais nulo: sem login, sou_admin() é falso, e as
     funções do admin recusam */
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  if public.sou_admin() is distinct from false then
    raise exception 'sou_admin() sem login não deu falso';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosrc ~ 'public\.meu_papel\(\) not in' and p.prosrc !~ 'coalesce\(public\.meu_papel\(\)') then
    raise exception 'ainda há função com "meu_papel() not in" sem coalesce';
  end if;
  /* prova sem risco: um papel que não existe. Com a trava certa, a recusa é
     a do admin (42501); a de "não encontrado" (P0002) quer dizer que passou */
  begin
    perform public.apagar_papel('papel_que_nao_existe_084');
    raise exception 'apagar_papel rodou sem login';
  exception when insufficient_privilege then
    null;
  end;

  /* a função que nascer depois desta migração também nasce fechada: prova
     criando uma de mentira, conferindo, e apagando */
  create function public.prova_da_porta_084() returns int language sql as 'select 1';
  if has_function_privilege('anon', 'public.prova_da_porta_084()', 'execute') then
    raise exception 'função nova ainda nasce aberta para quem não entrou';
  end if;
  if not has_function_privilege('authenticated', 'public.prova_da_porta_084()', 'execute') then
    raise exception 'função nova nasce fechada para a equipe';
  end if;
  drop function public.prova_da_porta_084();
  raise notice '084 pronta: % funções; só a página do parceiro e o vigia abrem para fora',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f');
end $$;
