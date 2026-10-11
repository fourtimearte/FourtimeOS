-- ===========================================================================
-- 065: O LEAD DO SITE (parte C1 do plano FOURTIME OS - 15)
--
-- O chat da loja (fourtimefit.com.br) manda uma ficha quando o cliente deixa
-- nome e telefone. Quem recebe e o porteiro (Edge Function lead-do-site, C2),
-- e quem grava e esta migracao: a funcao registrar_lead_do_site, que so a
-- chave de servico chama.
--
-- O que muda:
--   1. lead ganha o que a ficha traz: id_envio, email, briefing, o aceite da
--      LGPD (data e versao, sem booleano) e prioridade. origem vira lista
--      fechada, mantendo o que ja existe na base.
--   2. mensagem ganha canal (whatsapp, site, whatsapp_vendedor). O padrao e
--      whatsapp, para nada do que existe mudar. A janela de 24 horas so abre
--      para whatsapp: conversa do site nao e WhatsApp.
--   3. envio_do_site: o limite por IP, guardando so a impressao do IP (hash
--      com segredo, feito no porteiro), nunca o IP cru.
--   4. regra_do_lead_do_site: QUEM RECEBE o lead do site. Decisao do Henrique
--      em 11/10/2026: "quero opcao configurada aqui, no momento vai para uma
--      pessoa fixa, mas no futuro rodizio". Uma linha so, que o admin troca.
--   5. o sino ganha o aviso de lead ("lead").
--   6. registrar_lead_do_site(p_ficha, p_impressao).
--
-- Decisoes de 11/10/2026 (plano 15, secao 3): mesmo telefone com lead aberto
-- vai para o MESMO cartao; prioridade e SO o selo, sem sino para todos; o
-- aviso e so o sino (o e-mail fica anotado como obrigatorio antes do fim).
-- ===========================================================================

-- ---------- 1. o lead ------------------------------------------------------
alter table public.lead
  add column if not exists id_envio            uuid,
  add column if not exists email               text not null default '',
  add column if not exists briefing            jsonb not null default '{}'::jsonb,
  add column if not exists consentimento_em    timestamptz,
  add column if not exists consentimento_texto text not null default '',
  add column if not exists prioridade          boolean not null default false;

create unique index if not exists lead_por_id_envio on public.lead (id_envio) where id_envio is not null;

/* A ORIGEM VIRA LISTA FECHADA SEM QUEBRAR O QUE JA EXISTE. A lista de 25/09
   mais o que estiver gravado hoje: um valor antigo fora da lista entra na
   regra em vez de fazer a migracao falhar. */
do $$
declare
  lista text[] := array['site-chat', 'whatsapp', 'indicacao', 'manual', 'instagram'];
  extra text[];
begin
  select coalesce(array_agg(distinct origem), '{}') into extra
    from public.lead
   where origem <> all (lista);
  alter table public.lead drop constraint if exists lead_origem_da_lista;
  execute format(
    'alter table public.lead add constraint lead_origem_da_lista check (origem = any (%L::text[]))',
    lista || extra
  );
  if array_length(extra, 1) > 0 then
    raise notice 'origens antigas mantidas na regra: %', extra;
  end if;
end $$;


-- ---------- 2. o canal da mensagem -----------------------------------------
alter table public.mensagem
  add column if not exists canal text not null default 'whatsapp';

alter table public.mensagem drop constraint if exists mensagem_canal_da_lista;
alter table public.mensagem
  add constraint mensagem_canal_da_lista check (canal in ('whatsapp', 'site', 'whatsapp_vendedor'));

/* A janela de 24 horas e regra da API oficial do WhatsApp, e so do numero
   da Fourtime. Fala do cliente no chat do site (ou registrada no WhatsApp do
   vendedor) nao abre janela nenhuma. */
create or replace function public.abrir_a_janela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quem = 'cliente' and new.canal = 'whatsapp' then
    update public.lead
       set janela_ate = greatest(coalesce(janela_ate, new.em), new.em + interval '24 hours')
     where id = new.lead_id;
  end if;
  return new;
end $$;


-- ---------- 3. o limite por IP ---------------------------------------------
create table if not exists public.envio_do_site (
  id        bigint generated always as identity primary key,
  /* hash do IP com segredo, feito no porteiro. O IP cru nunca chega aqui. */
  impressao text not null check (length(impressao) between 16 and 128),
  em        timestamptz not null default now()
);
create index if not exists envio_do_site_por_impressao on public.envio_do_site (impressao, em desc);

/* sem politica nenhuma: so a funcao abaixo (dona da tabela) le e escreve */
alter table public.envio_do_site enable row level security;
revoke all on public.envio_do_site from public, anon, authenticated;


-- ---------- 4. quem recebe o lead do site ----------------------------------
create table if not exists public.regra_do_lead_do_site (
  id             smallint primary key default 1 check (id = 1),
  modo           text not null default 'pessoa_fixa' check (modo in ('pessoa_fixa', 'rodizio')),
  /* a pessoa fixa. Vazia: o lead nasce sem dono e o sino avisa admin e gerente */
  pessoa_id      uuid references public.pessoa (id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.pessoa (id) on delete set null
);
insert into public.regra_do_lead_do_site (id) values (1) on conflict (id) do nothing;

alter table public.regra_do_lead_do_site enable row level security;

drop policy if exists regra_do_lead_do_site_le on public.regra_do_lead_do_site;
create policy regra_do_lead_do_site_le on public.regra_do_lead_do_site
  for select to authenticated using (public.meu_papel() is not null);

drop policy if exists regra_do_lead_do_site_admin on public.regra_do_lead_do_site;
create policy regra_do_lead_do_site_admin on public.regra_do_lead_do_site
  for update to authenticated using (public.sou_admin()) with check (public.sou_admin());

grant select, update on public.regra_do_lead_do_site to authenticated;

/* quem mexeu e quando, gravado pelo banco e nao pela tela */
create or replace function public.anotar_a_regra_do_lead()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

drop trigger if exists regra_do_lead_do_site_anota on public.regra_do_lead_do_site;
create trigger regra_do_lead_do_site_anota
  before update on public.regra_do_lead_do_site
  for each row execute function public.anotar_a_regra_do_lead();


-- ---------- 5. o sino ganha o aviso de lead --------------------------------
do $$
declare
  nome text;
begin
  for nome in
    select conname from pg_constraint
     where conrelid = 'public.aviso_do_sino'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%tipo%'
  loop
    execute format('alter table public.aviso_do_sino drop constraint %I', nome);
  end loop;
end $$;
alter table public.aviso_do_sino
  add constraint aviso_do_sino_tipo_da_lista check (tipo in ('conversa', 'devolvido', 'lead'));


-- ---------- 6. registrar o lead do site ------------------------------------
/* As listas do orcamento sao o contrato com a loja (SHOPIFY - 04, 6.1.6): o
   texto do botao muda a vontade, o codigo nao. Codigo fora da lista e
   recusado, e nao gravado como veio. */
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
       set ultima_msg = left(coalesce(nullif(v_msg, ''), 'Pedido de orçamento pelo site'), 280),
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


-- ---------- conferencia ----------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lead' and column_name = 'briefing') then
    raise exception 'lead.briefing nao ficou de pe';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'mensagem' and column_name = 'canal') then
    raise exception 'mensagem.canal nao ficou de pe';
  end if;
  if (select count(*) from public.regra_do_lead_do_site) <> 1 then
    raise exception 'a regra do lead do site precisa de uma linha so';
  end if;
  if has_function_privilege('anon', 'public.registrar_lead_do_site(jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_lead_do_site(jsonb, text)', 'execute') then
    raise exception 'registrar_lead_do_site ficou aberta para fora da chave de servico';
  end if;
  raise notice '065 ok: lead do site, canal da mensagem, limite por IP, regra e sino';
end $$;
