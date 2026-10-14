-- ===========================================================================
-- 079: O TRANSPORTE DE QUEM PAGA, DA COLETA E DA LIXEIRA (14/10/2026)
--
-- Respostas do Henrique em 14/10/2026, pergunta por pergunta:
--
--   1. OS TIPOS DE ENVIO E AS EMPRESAS. O meio passa a ser o TIPO (motoboy,
--      Uber, taxi, aereo, onibus, Correios, transportadora) e o cadastro de
--      quem transporta e a EMPRESA dentro dele: Latam, GoLog e Azul no aereo;
--      as viacoes no onibus; Correios; Melhor Envio e Jadlog na
--      transportadora. O CNPJ, que so a transportadora tinha, vale para toda
--      empresa (aereo, onibus, Correios e transportadora).
--   2. QUEM PAGOU O FRETE: a Fourtime ou o cliente. O frete pago pelo cliente
--      fica registrado (e dado), mas nao e gasto da Fourtime nem fica em A
--      pagar.
--   3. A COLETA E O ENVIO. "Um motoboy leva as encomendas ate os Correios e
--      cobra 10; la ele paga 500 de frete." Sao dois fretes, cada um com o
--      seu: o FRETE DE COLETA (quem levou ate o ponto de despacho) e o FRETE
--      DO ENVIO. Na tela e um lancamento so; no banco a coleta e uma linha
--      filha (coleta_de), e por isso o A pagar, o Acertar e o relatorio por
--      quem transporta continuam valendo sem conta nova: o motoboy da coleta
--      e acertado no fim da semana como qualquer corrida dele.
--   4. VARIOS PEDIDOS POR ENTREGA: a tabela pedido_do_lancamento. O pedido_id
--      de antes continua, como o primeiro deles, para nada do que ja le
--      quebrar.
--   5. A LIXEIRA. "Nada se apaga" (042) cai: apagar manda o lancamento (e a
--      coleta dele) para a lixeira, que some da lista e dos relatorios; o
--      administrador devolve. Apaga quem tem "deletar" em Transporte.
--
-- NADA E PERDIDO: os lancamentos de antes ficam como envio pago pela
-- Fourtime, sem coleta, com o pedido que tinham.
-- ===========================================================================


-- ---------- 1. os tipos de envio ---------------------------------------------
alter table public.transportador drop constraint if exists transportador_meio_conhecido;
alter table public.transportador
  add constraint transportador_meio_conhecido
  check (meio in ('motoboy', 'uber', 'taxi', 'aereo', 'onibus', 'correios', 'transportadora'));

/* os Correios entraram na 042 como transportadora (vinham do fornecedor de
   frete da 041): passam para o tipo proprio */
update public.transportador set meio = 'correios'
 where lower(nome) = 'correios' and meio = 'transportadora';

/* as empresas que ele citou, para a lista nascer pronta (nao sao de teste) */
insert into public.transportador (nome, meio, observacao)
select x.nome, x.meio, ''
  from (values
    ('Latam', 'aereo'),
    ('GoLog', 'aereo'),
    ('Azul', 'aereo'),
    ('Correios', 'correios'),
    ('Melhor Envio', 'transportadora'),
    ('Jadlog', 'transportadora')
  ) as x(nome, meio)
 where not exists (select 1 from public.transportador t where lower(t.nome) = lower(x.nome));


-- ---------- 2, 3 e 5. as colunas novas do lancamento -------------------------
alter table public.lancamento_de_transporte
  add column if not exists frete_pago_por text not null default 'fourtime',
  add column if not exists coleta_de uuid references public.lancamento_de_transporte (id) on delete cascade,
  add column if not exists apagado_em timestamptz,
  add column if not exists apagado_por uuid references public.pessoa (id) on delete set null;

alter table public.lancamento_de_transporte drop constraint if exists lancamento_frete_pago_por;
alter table public.lancamento_de_transporte
  add constraint lancamento_frete_pago_por check (frete_pago_por in ('fourtime', 'cliente'));

/* o frete pago pelo cliente pode nao ter valor sabido: zero passa a valer */
alter table public.lancamento_de_transporte drop constraint if exists lancamento_valor_positivo;
alter table public.lancamento_de_transporte
  add constraint lancamento_valor_positivo check (valor >= 0);

comment on column public.lancamento_de_transporte.frete_pago_por is
  'quem pagou o frete: fourtime (gasto da empresa) ou cliente (so registro)';
comment on column public.lancamento_de_transporte.coleta_de is
  'quando preenchido, esta linha e o FRETE DE COLETA do lancamento apontado';
comment on table public.lancamento_de_transporte is
  'O pagamento de uma corrida: quem levou, para que, quanto custou, quem pagou e se ja foi pago. Apagar manda para a lixeira (079).';

create unique index if not exists lancamento_uma_coleta
  on public.lancamento_de_transporte (coleta_de) where coleta_de is not null and apagado_em is null;
create index if not exists lancamento_apagado
  on public.lancamento_de_transporte (apagado_em) where apagado_em is not null;


-- ---------- 4. os pedidos de cada lancamento --------------------------------
create table if not exists public.pedido_do_lancamento (
  lancamento_id uuid not null references public.lancamento_de_transporte (id) on delete cascade,
  pedido_id     uuid not null references public.pedido (id) on delete cascade,
  ordem         int not null default 0,
  primary key (lancamento_id, pedido_id)
);
comment on table public.pedido_do_lancamento is
  'Os pedidos que foram na mesma entrega (079). O pedido_id do lancamento continua sendo o primeiro.';

alter table public.pedido_do_lancamento enable row level security;
drop policy if exists "quem ve o transporte le os pedidos do lancamento" on public.pedido_do_lancamento;
create policy "quem ve o transporte le os pedidos do lancamento"
  on public.pedido_do_lancamento for select to authenticated
  using (public.posso('transporte', 'ver'));
grant select on public.pedido_do_lancamento to authenticated;

/* o que ja existia: o pedido de cada lancamento entra na lista nova */
insert into public.pedido_do_lancamento (lancamento_id, pedido_id, ordem)
select l.id, l.pedido_id, 0
  from public.lancamento_de_transporte l
 where l.pedido_id is not null
on conflict do nothing;


-- ---------- as views --------------------------------------------------------
/* A LISTA: so o que nao esta na lixeira, e so os lancamentos principais (a
   coleta vem junto, nas colunas coleta_*). As colunas de antes ficam na mesma
   ordem e as novas vao no fim. */
create or replace view public.lancamento_de_transporte_na_lista
with (security_invoker = true) as
select l.id,
       l.quando,
       t.meio,
       l.transportador_id,
       t.nome     as transportador,
       l.motivo,
       l.pedido_id,
       p.numero   as pedido,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       l.fornecedor_id,
       f.nome     as fornecedor,
       l.destino,
       l.valor,
       l.forma,
       l.pago,
       l.pago_em,
       l.quem,
       coalesce(e.nome, nullif(l.quem_nome, ''), '') as quem_nome,
       l.observacao,
       l.teste,
       /* 079 */
       l.frete_pago_por,
       l.coleta_de,
       (select coalesce(jsonb_agg(jsonb_build_object(
                 'numero', pp.numero,
                 'cliente', coalesce(cc.nome, co.cliente_nome, ''),
                 'entrega', pp.data_de_envio) order by pl.ordem, pp.numero), '[]'::jsonb)
          from public.pedido_do_lancamento pl
          join public.pedido pp on pp.id = pl.pedido_id
          left join public.cliente cc on cc.id = pp.cliente_id
          left join public.cotacao co on co.id = pp.cotacao_id
         where pl.lancamento_id = l.id) as pedidos,
       k.id               as coleta_id,
       k.transportador_id as coleta_transportador_id,
       kt.nome            as coleta_transportador,
       kt.meio            as coleta_meio,
       k.valor            as coleta_valor,
       k.forma            as coleta_forma,
       k.pago             as coleta_pago
  from public.lancamento_de_transporte l
  join public.transportador t on t.id = l.transportador_id
  left join public.pedido p   on p.id = l.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id = p.cotacao_id
  left join public.fornecedor f on f.id = l.fornecedor_id
  left join public.equipe e   on e.id = l.quem
  left join public.lancamento_de_transporte k on k.coleta_de = l.id and k.apagado_em is null
  left join public.transportador kt on kt.id = k.transportador_id
 where l.apagado_em is null
   and l.coleta_de is null;

grant select on public.lancamento_de_transporte_na_lista to authenticated;

/* AS CORRIDAS, uma linha por frete (o envio e a coleta separados): e o que o
   A pagar, o Acertar e o relatorio por quem transporta somam. So o que a
   Fourtime pagou entra; o frete pago pelo cliente fica de fora. */
create or replace view public.corrida_de_transporte
with (security_invoker = true) as
select l.id,
       coalesce(l.coleta_de, l.id) as lancamento_id,
       (l.coleta_de is not null)    as coleta,
       l.quando,
       t.meio,
       l.transportador_id,
       t.nome as transportador,
       l.motivo,
       l.valor,
       l.forma,
       l.pago,
       l.pago_em,
       l.frete_pago_por
  from public.lancamento_de_transporte l
  join public.transportador t on t.id = l.transportador_id
  left join public.lancamento_de_transporte pai on pai.id = l.coleta_de
 where l.apagado_em is null
   and l.frete_pago_por = 'fourtime'
   and (l.coleta_de is null or pai.apagado_em is null);

grant select on public.corrida_de_transporte to authenticated;

/* A LIXEIRA: o que foi apagado, com quem apagou e quando */
create or replace view public.lancamento_na_lixeira
with (security_invoker = true) as
select l.id,
       l.quando,
       t.meio,
       t.nome as transportador,
       l.motivo,
       p.numero as pedido,
       l.destino,
       l.valor,
       l.apagado_em,
       coalesce(ap.nome, '') as apagado_por
  from public.lancamento_de_transporte l
  join public.transportador t on t.id = l.transportador_id
  left join public.pedido p on p.id = l.pedido_id
  left join public.pessoa ap on ap.id = l.apagado_por
 where l.apagado_em is not null
   and l.coleta_de is null;

grant select on public.lancamento_na_lixeira to authenticated;


-- ---------- o cadastro: CNPJ para toda empresa ------------------------------
create or replace function public.salvar_transportador(
  p_id          uuid,
  p_nome        text,
  p_meio        text,
  p_cnpj        text default null,
  p_contato     text default '',
  p_onde_atende text default '',
  p_prazo       text default '',
  p_observacao  text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t     public.transportador;
  f     uuid;
  outro uuid;
  limpo text := nullif(upper(regexp_replace(coalesce(p_cnpj, ''), '[^0-9A-Za-z]', '', 'g')), '');
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite mexer em quem transporta.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_nome, '')) = '' then
    raise exception 'O cadastro precisa de um nome.' using errcode = '23514';
  end if;
  if p_meio not in ('motoboy', 'uber', 'taxi', 'aereo', 'onibus', 'correios', 'transportadora') then
    raise exception 'Tipo de envio desconhecido.' using errcode = '22023';
  end if;
  /* CNPJ e de empresa: motoboy, Uber e taxi nao tem */
  if p_meio in ('motoboy', 'uber', 'taxi') then
    limpo := null;
  end if;
  if limpo is not null and limpo !~ '^[0-9A-Z]{12}[0-9]{2}$' then
    raise exception 'O CNPJ precisa ter 14 caracteres.' using errcode = '23514';
  end if;
  if exists (select 1 from public.transportador x
              where lower(x.nome) = lower(btrim(p_nome)) and x.id is distinct from p_id) then
    raise exception 'Já existe um cadastro com este nome.' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.transportador (nome, meio, contato, onde_atende, prazo, observacao)
    values (btrim(p_nome), p_meio, btrim(coalesce(p_contato, '')), btrim(coalesce(p_onde_atende, '')),
            btrim(coalesce(p_prazo, '')), btrim(coalesce(p_observacao, '')))
    returning * into t;
  else
    update public.transportador
       set nome = btrim(p_nome),
           meio = p_meio,
           contato = btrim(coalesce(p_contato, '')),
           onde_atende = btrim(coalesce(p_onde_atende, '')),
           prazo = btrim(coalesce(p_prazo, '')),
           observacao = btrim(coalesce(p_observacao, ''))
     where id = p_id
     returning * into t;
    if not found then
      raise exception 'Cadastro não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  if limpo is not null then
    f := t.fornecedor_id;
    select id into outro from public.fornecedor where cnpj = limpo;
    if outro is not null then
      f := outro;
    elsif f is null then
      insert into public.fornecedor (nome, cnpj, cidade, o_que_fornece, entrou_por)
      values (public.nome_livre_de_fornecedor(t.nome, limpo), limpo, t.onde_atende, 'Transporte', 'entrega')
      returning id into f;
    else
      update public.fornecedor set cnpj = limpo where id = f;
    end if;
    insert into public.fornecedor_tipo (fornecedor_id, tipo) values (f, 'frete')
    on conflict do nothing;
    update public.transportador set fornecedor_id = f
     where id = t.id and fornecedor_id is distinct from f;
  end if;

  return t.id;
end $$;


-- ---------- lancar: o envio, a coleta e os pedidos --------------------------
/* LANCAR (ou corrigir) UM LANCAMENTO INTEIRO.

   p_pedidos: os NUMEROS dos pedidos da entrega, na ordem da tela. Numero que
   nao existe e erro, como antes.
   p_coleta: nulo, sem coleta (ou a coleta que havia sai para a lixeira); ou
   {"transportador": uuid, "valor": n, "forma": "pix", "pago": bool}.

   A versao de antes (11 parametros) continua existindo e passa a chamar esta,
   para quem ainda chama do jeito velho. */
create or replace function public.lancar_transporte(
  p_id            uuid,
  p_quando        timestamptz,
  p_transportador uuid,
  p_motivo        text,
  p_pedidos       text[],
  p_fornecedor    uuid,
  p_destino       text,
  p_valor         numeric,
  p_forma         text,
  p_pago          boolean,
  p_observacao    text,
  p_frete_pago_por text,
  p_coleta        jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo     uuid;
  primeiro uuid;
  atual    public.lancamento_de_transporte;
  coleta   public.lancamento_de_transporte;
  ids      uuid[] := array[]::uuid[];
  num      text;
  achado   uuid;
  i        int := 0;
  quem_paga text := coalesce(nullif(btrim(p_frete_pago_por), ''), 'fourtime');
  k_transp uuid;
  k_valor  numeric;
  k_forma  text;
  k_pago   boolean;
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite lançar transporte.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.transportador where id = p_transportador and ativo) then
    raise exception 'Escolha quem levou.' using errcode = 'P0002';
  end if;
  if p_motivo not in ('entrega', 'busca', 'outro') then
    raise exception 'Motivo desconhecido.' using errcode = '22023';
  end if;
  if p_forma not in ('pix', 'dinheiro', 'cartao', 'boleto') then
    raise exception 'Forma de pagamento desconhecida.' using errcode = '22023';
  end if;
  if quem_paga not in ('fourtime', 'cliente') then
    raise exception 'Quem pagou o frete: a Fourtime ou o cliente.' using errcode = '22023';
  end if;
  /* o frete que a Fourtime pagou tem valor; o do cliente pode ficar em zero */
  if coalesce(p_valor, 0) < 0 or (quem_paga = 'fourtime' and coalesce(p_valor, 0) <= 0) then
    raise exception 'O valor precisa ser maior que zero.' using errcode = '23514';
  end if;

  if p_motivo = 'entrega' then
    foreach num in array coalesce(p_pedidos, array[]::text[]) loop
      continue when nullif(btrim(num), '') is null;
      select id into achado from public.pedido where numero = btrim(num);
      if not found then
        raise exception 'Não encontrei o pedido %.', btrim(num) using errcode = 'P0002';
      end if;
      if not achado = any (ids) then
        ids := ids || achado;
      end if;
    end loop;
  end if;
  primeiro := ids[1];

  if p_motivo = 'busca' and p_fornecedor is not null
     and not exists (select 1 from public.fornecedor where id = p_fornecedor) then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
  end if;

  if p_id is null then
    insert into public.lancamento_de_transporte
      (quando, transportador_id, motivo, pedido_id, fornecedor_id, destino, valor, forma,
       pago, pago_em, pago_por, quem, quem_nome, observacao, frete_pago_por)
    values
      (coalesce(p_quando, now()), p_transportador, p_motivo, primeiro,
       case when p_motivo = 'busca' then p_fornecedor end,
       btrim(coalesce(p_destino, '')), coalesce(p_valor, 0), p_forma,
       coalesce(p_pago, false),
       case when coalesce(p_pago, false) then now() end,
       case when coalesce(p_pago, false) then auth.uid() end,
       auth.uid(),
       coalesce((select nome from public.pessoa where id = auth.uid()), ''),
       btrim(coalesce(p_observacao, '')),
       quem_paga)
    returning id into novo;
  else
    select * into atual from public.lancamento_de_transporte
     where id = p_id and coleta_de is null and apagado_em is null for update;
    if not found then
      raise exception 'Não encontrei este lançamento.' using errcode = 'P0002';
    end if;
    update public.lancamento_de_transporte
       set quando = coalesce(p_quando, atual.quando),
           transportador_id = p_transportador,
           motivo = p_motivo,
           pedido_id = primeiro,
           fornecedor_id = case when p_motivo = 'busca' then p_fornecedor end,
           destino = btrim(coalesce(p_destino, '')),
           valor = coalesce(p_valor, 0),
           forma = p_forma,
           observacao = btrim(coalesce(p_observacao, '')),
           frete_pago_por = quem_paga,
           pago = coalesce(p_pago, false),
           pago_em = case when not coalesce(p_pago, false) then null
                          when atual.pago then atual.pago_em
                          else now() end,
           pago_por = case when not coalesce(p_pago, false) then null
                           when atual.pago then atual.pago_por
                           else auth.uid() end
     where id = p_id;
    novo := p_id;
  end if;

  /* os pedidos: a lista inteira, na ordem da tela */
  delete from public.pedido_do_lancamento where lancamento_id = novo;
  foreach achado in array ids loop
    insert into public.pedido_do_lancamento (lancamento_id, pedido_id, ordem) values (novo, achado, i);
    i := i + 1;
  end loop;

  /* a coleta: a linha filha, nova, corrigida ou tirada */
  select * into coleta from public.lancamento_de_transporte
   where coleta_de = novo and apagado_em is null for update;
  if p_coleta is null or jsonb_typeof(p_coleta) <> 'object' or p_motivo <> 'entrega' then
    if coleta.id is not null then
      update public.lancamento_de_transporte
         set apagado_em = clock_timestamp(), apagado_por = auth.uid()
       where id = coleta.id;
    end if;
  else
    k_transp := nullif(p_coleta ->> 'transportador', '')::uuid;
    k_valor  := coalesce(nullif(p_coleta ->> 'valor', '')::numeric, 0);
    k_forma  := coalesce(nullif(p_coleta ->> 'forma', ''), 'pix');
    k_pago   := coalesce((p_coleta ->> 'pago')::boolean, false);
    if not exists (select 1 from public.transportador where id = k_transp and ativo) then
      raise exception 'Escolha quem fez a coleta.' using errcode = 'P0002';
    end if;
    if k_valor <= 0 then
      raise exception 'O frete de coleta precisa ser maior que zero.' using errcode = '23514';
    end if;
    if k_forma not in ('pix', 'dinheiro', 'cartao', 'boleto') then
      raise exception 'Forma de pagamento da coleta desconhecida.' using errcode = '22023';
    end if;
    if coleta.id is null then
      insert into public.lancamento_de_transporte
        (quando, transportador_id, motivo, pedido_id, destino, valor, forma,
         pago, pago_em, pago_por, quem, quem_nome, observacao, frete_pago_por, coleta_de, teste)
      select l.quando, k_transp, 'entrega', l.pedido_id, 'Coleta até o despacho', k_valor, k_forma,
             k_pago, case when k_pago then now() end, case when k_pago then auth.uid() end,
             auth.uid(), l.quem_nome, '', 'fourtime', l.id, l.teste
        from public.lancamento_de_transporte l where l.id = novo;
    else
      update public.lancamento_de_transporte
         set quando = (select quando from public.lancamento_de_transporte where id = novo),
             transportador_id = k_transp,
             pedido_id = primeiro,
             valor = k_valor,
             forma = k_forma,
             pago = k_pago,
             pago_em = case when not k_pago then null when coleta.pago then coleta.pago_em else now() end,
             pago_por = case when not k_pago then null when coleta.pago then coleta.pago_por else auth.uid() end
       where id = coleta.id;
    end if;
  end if;

  return novo;
end $$;

grant execute on function public.lancar_transporte(
  uuid, timestamptz, uuid, text, text[], uuid, text, numeric, text, boolean, text, text, jsonb) to authenticated;

/* a versao de antes, para quem ainda chama assim: um pedido, sem coleta */
create or replace function public.lancar_transporte(
  p_id            uuid,
  p_quando        timestamptz,
  p_transportador uuid,
  p_motivo        text,
  p_pedido        text default null,
  p_fornecedor    uuid default null,
  p_destino       text default '',
  p_valor         numeric default 0,
  p_forma         text default 'pix',
  p_pago          boolean default false,
  p_observacao    text default ''
) returns uuid
language sql
security definer
set search_path = public
as $$
  select public.lancar_transporte(
    p_id, p_quando, p_transportador, p_motivo,
    case when nullif(btrim(coalesce(p_pedido, '')), '') is null then array[]::text[] else array[btrim(p_pedido)] end,
    p_fornecedor, p_destino, p_valor, p_forma, p_pago, p_observacao, 'fourtime', null)
$$;


-- ---------- a lixeira -------------------------------------------------------
/* APAGAR manda o lancamento (e a coleta dele) para a lixeira. */
create or replace function public.apagar_lancamento_de_transporte(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  /* o mesmo instante no lancamento e na coleta: e por ele que o devolver
     sabe qual coleta foi junto (clock_timestamp, e nao now, para nao
     empatar com uma coleta tirada antes na mesma transacao) */
  agora timestamptz := clock_timestamp();
begin
  if not public.posso('transporte', 'deletar') then
    raise exception 'Seu acesso não permite apagar lançamento.' using errcode = '42501';
  end if;
  update public.lancamento_de_transporte
     set apagado_em = agora, apagado_por = auth.uid()
   where (id = p_id or coleta_de = p_id) and apagado_em is null;
  if not found then
    raise exception 'Não encontrei este lançamento.' using errcode = 'P0002';
  end if;
end $$;

grant execute on function public.apagar_lancamento_de_transporte(uuid) to authenticated;

/* DEVOLVER da lixeira: so o administrador. A coleta volta junto. */
create or replace function public.devolver_lancamento_de_transporte(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quando_apagou timestamptz;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador devolve da lixeira.' using errcode = '42501';
  end if;
  select apagado_em into quando_apagou from public.lancamento_de_transporte where id = p_id and coleta_de is null;
  if quando_apagou is null then
    raise exception 'Este lançamento não está na lixeira.' using errcode = 'P0002';
  end if;
  update public.lancamento_de_transporte
     set apagado_em = null, apagado_por = null
   where id = p_id
      /* a coleta que foi junto com ele (e nao a que saiu antes, na correcao) */
      or (coleta_de = p_id and apagado_em = quando_apagou);
end $$;

grant execute on function public.devolver_lancamento_de_transporte(uuid) to authenticated;

/* ACERTAR so acerta o que esta fora da lixeira e o que a Fourtime paga */
create or replace function public.acertar_transporte(p_lancamentos uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite acertar transporte.' using errcode = '42501';
  end if;
  update public.lancamento_de_transporte
     set pago = true, pago_em = now(), pago_por = auth.uid()
   where id = any (coalesce(p_lancamentos, array[]::uuid[]))
     and not pago and apagado_em is null and frete_pago_por = 'fourtime';
  get diagnostics n = row_count;
  return n;
end $$;


-- ---------- o apagar dados de teste alcanca a tabela nova -------------------
/* pedido_do_lancamento sai sozinho (on delete cascade) com o lancamento ou o
   pedido de teste; nada a fazer na funcao da 069. */
