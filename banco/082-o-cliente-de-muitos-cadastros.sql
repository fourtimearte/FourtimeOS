-- ===========================================================================
-- 082: O CLIENTE DE MUITOS CADASTROS (15/10/2026)
--
-- Respostas do Henrique em 14/10/2026 ("numero 1 e 2"): a ficha guarda VARIOS
-- CPF/CNPJ, enderecos de entrega e contatos, porque ha cliente no Bling com
-- ate 3 CNPJs e 3 enderecos; cada cotacao escolhe quais usa; JUNTAR COM OUTRO
-- CLIENTE une duas fichas da mesma pessoa; e a forma de frete preferida sai
-- dos ultimos pedidos.
--
-- O PRINCIPAL CONTINUA NA FICHA. As colunas de sempre do cliente (documento,
-- contato, celular, endereco...) sao o cadastro principal, e tudo que ja le o
-- cliente continua lendo dali. Os outros vao em tres tabelas novas, so com os
-- EXTRAS. Tornar um extra principal e trocar de lugar com o da ficha (a tela
-- faz), e nada fica em dois lugares.
-- ===========================================================================


-- ---------- 1. os extras ------------------------------------------------------
create table if not exists public.documento_do_cliente (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.cliente (id) on delete cascade,
  tipo       public.tipo_de_pessoa not null default 'J',
  documento  text not null,
  /* a razao social daquele CNPJ, quando nao e o nome da ficha */
  nome       text not null default '',
  ordem      int not null default 0,
  criado_em  timestamptz not null default now(),
  constraint documento_do_cliente_nao_vazio check (btrim(documento) <> '')
);
create index if not exists documento_do_cliente_de on public.documento_do_cliente (cliente_id);
create index if not exists documento_do_cliente_numero on public.documento_do_cliente (documento);

create table if not exists public.endereco_do_cliente (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.cliente (id) on delete cascade,
  /* como a pessoa chama: "Filial Anapolis", "Casa do tecnico" */
  apelido     text not null default '',
  endereco    text not null default '',
  complemento text not null default '',
  bairro      text not null default '',
  cidade      text not null default '',
  uf          text not null default '',
  cep         text not null default '',
  ordem       int not null default 0,
  criado_em   timestamptz not null default now(),
  constraint endereco_do_cliente_uf check (uf = '' or uf ~ '^[A-Z]{2}$'),
  constraint endereco_do_cliente_nao_vazio check (btrim(endereco || cidade || cep) <> '')
);
create index if not exists endereco_do_cliente_de on public.endereco_do_cliente (cliente_id);

create table if not exists public.contato_do_cliente (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.cliente (id) on delete cascade,
  nome       text not null default '',
  /* financeiro, compras, o tecnico do time */
  cargo      text not null default '',
  celular    text not null default '',
  telefone   text not null default '',
  email      text not null default '',
  ordem      int not null default 0,
  criado_em  timestamptz not null default now(),
  constraint contato_do_cliente_nao_vazio check (btrim(nome || celular || telefone || email) <> '')
);
create index if not exists contato_do_cliente_de on public.contato_do_cliente (cliente_id);
create index if not exists contato_do_cliente_telefone
  on public.contato_do_cliente (public.fim_do_telefone(celular)) where celular <> '';

do $$
declare t text;
begin
  foreach t in array array['documento_do_cliente', 'endereco_do_cliente', 'contato_do_cliente'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "quem foi aprovado le" on public.%I', t);
    execute format('create policy "quem foi aprovado le" on public.%I for select to authenticated using (public.meu_papel() is not null)', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;


-- ---------- 2. a lista dos extras de cada cliente ------------------------------
create or replace view public.extras_do_cliente
with (security_invoker = true) as
select c.id as cliente_id,
       coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'documento', d.documento, 'nome', d.nome)
                                  order by d.ordem, d.criado_em)
                   from public.documento_do_cliente d where d.cliente_id = c.id), '[]'::jsonb) as documentos,
       coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'apelido', e.apelido, 'endereco', e.endereco,
                                                     'complemento', e.complemento, 'bairro', e.bairro, 'cidade', e.cidade,
                                                     'uf', e.uf, 'cep', e.cep)
                                  order by e.ordem, e.criado_em)
                   from public.endereco_do_cliente e where e.cliente_id = c.id), '[]'::jsonb) as enderecos,
       coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome, 'cargo', k.cargo, 'celular', k.celular,
                                                     'telefone', k.telefone, 'email', k.email)
                                  order by k.ordem, k.criado_em)
                   from public.contato_do_cliente k where k.cliente_id = c.id), '[]'::jsonb) as contatos
  from public.cliente c;

grant select on public.extras_do_cliente to authenticated;


-- ---------- 3. gravar os extras -------------------------------------------------
/* A lista inteira de cada um, como esta na tela: o que nao veio sai. Linha
   vazia e ignorada (a tela deixa uma em branco para escrever). */
create or replace function public.salvar_extras_do_cliente(
  p_cliente    uuid,
  p_documentos jsonb,
  p_enderecos  jsonb,
  p_contatos   jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  x jsonb;
  i int;
begin
  if not public.posso('clientes', 'editar') then
    raise exception 'Seu acesso não permite mexer no cadastro do cliente.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cliente where id = p_cliente) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  delete from public.documento_do_cliente where cliente_id = p_cliente;
  i := 0;
  for x in select * from jsonb_array_elements(coalesce(p_documentos, '[]'::jsonb)) loop
    continue when btrim(coalesce(x ->> 'documento', '')) = '';
    i := i + 1;
    insert into public.documento_do_cliente (cliente_id, tipo, documento, nome, ordem)
    values (p_cliente,
            case when x ->> 'tipo' = 'F' then 'F'::public.tipo_de_pessoa else 'J'::public.tipo_de_pessoa end,
            regexp_replace(x ->> 'documento', '[^0-9A-Za-z]', '', 'g'),
            btrim(coalesce(x ->> 'nome', '')), i);
  end loop;

  delete from public.endereco_do_cliente where cliente_id = p_cliente;
  i := 0;
  for x in select * from jsonb_array_elements(coalesce(p_enderecos, '[]'::jsonb)) loop
    continue when btrim(coalesce(x ->> 'endereco', '') || coalesce(x ->> 'cidade', '') || coalesce(x ->> 'cep', '')) = '';
    i := i + 1;
    insert into public.endereco_do_cliente (cliente_id, apelido, endereco, complemento, bairro, cidade, uf, cep, ordem)
    values (p_cliente, btrim(coalesce(x ->> 'apelido', '')), btrim(coalesce(x ->> 'endereco', '')),
            btrim(coalesce(x ->> 'complemento', '')), btrim(coalesce(x ->> 'bairro', '')),
            btrim(coalesce(x ->> 'cidade', '')), upper(btrim(coalesce(x ->> 'uf', ''))),
            regexp_replace(coalesce(x ->> 'cep', ''), '\D', '', 'g'), i);
  end loop;

  delete from public.contato_do_cliente where cliente_id = p_cliente;
  i := 0;
  for x in select * from jsonb_array_elements(coalesce(p_contatos, '[]'::jsonb)) loop
    continue when btrim(coalesce(x ->> 'nome', '') || coalesce(x ->> 'celular', '') || coalesce(x ->> 'telefone', '')
                        || coalesce(x ->> 'email', '')) = '';
    i := i + 1;
    insert into public.contato_do_cliente (cliente_id, nome, cargo, celular, telefone, email, ordem)
    values (p_cliente, btrim(coalesce(x ->> 'nome', '')), btrim(coalesce(x ->> 'cargo', '')),
            regexp_replace(coalesce(x ->> 'celular', ''), '\D', '', 'g'),
            regexp_replace(coalesce(x ->> 'telefone', ''), '\D', '', 'g'),
            btrim(coalesce(x ->> 'email', '')), i);
  end loop;
end $$;

grant execute on function public.salvar_extras_do_cliente(uuid, jsonb, jsonb, jsonb) to authenticated;


-- ---------- 4. juntar duas fichas ------------------------------------------------
/* O registro de cada juntada: a ficha que saiu vai inteira para ca, para
   ninguem perder o que estava nela. */
create table if not exists public.juntada_de_cliente (
  id       uuid primary key default gen_random_uuid(),
  ficou_id uuid references public.cliente (id) on delete set null,
  saiu     jsonb not null,
  quem     uuid references public.pessoa (id) on delete set null,
  quando   timestamptz not null default now()
);
alter table public.juntada_de_cliente enable row level security;
drop policy if exists "quem foi aprovado le as juntadas" on public.juntada_de_cliente;
create policy "quem foi aprovado le as juntadas" on public.juntada_de_cliente
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.juntada_de_cliente to authenticated;

/* JUNTAR: p_sai entra em p_fica e some. O principal de quem fica nao muda; o
   principal de quem sai vira extra (se for diferente), os extras de quem sai
   vem junto, o vazio de quem fica e preenchido, e as cotacoes, os pedidos e os
   leads passam para quem fica. O historico do Bling soma. */
create or replace function public.juntar_clientes(p_fica uuid, p_sai uuid)
returns public.cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.cliente;
  s public.cliente;
  n int;
  dig text;
begin
  if not public.posso('clientes', 'deletar') and not public.sou_admin() then
    raise exception 'Juntar fichas é do administrador (ou de quem pode apagar cliente).' using errcode = '42501';
  end if;
  if p_fica = p_sai then
    raise exception 'Escolha duas fichas diferentes.' using errcode = '22023';
  end if;
  select * into f from public.cliente where id = p_fica for update;
  select * into s from public.cliente where id = p_sai for update;
  if f.id is null or s.id is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.juntada_de_cliente (ficou_id, saiu, quem)
  values (f.id, to_jsonb(s) || jsonb_build_object(
            'extras', (select to_jsonb(x) from public.extras_do_cliente x where x.cliente_id = s.id)), auth.uid());

  /* o documento principal de quem sai vira extra, se for outro */
  select coalesce(max(ordem), 0) into n from public.documento_do_cliente where cliente_id = f.id;
  dig := regexp_replace(s.documento, '[^0-9A-Za-z]', '', 'g');
  if dig <> '' and dig <> regexp_replace(f.documento, '[^0-9A-Za-z]', '', 'g')
     and not exists (select 1 from public.documento_do_cliente d where d.cliente_id = f.id and d.documento = dig) then
    insert into public.documento_do_cliente (cliente_id, tipo, documento, nome, ordem)
    values (f.id, s.tipo, dig, case when s.nome <> f.nome then s.nome else '' end, n + 1);
  end if;
  update public.documento_do_cliente d set cliente_id = f.id, ordem = d.ordem + n + 1
   where d.cliente_id = s.id
     and d.documento <> regexp_replace(f.documento, '[^0-9A-Za-z]', '', 'g')
     and not exists (select 1 from public.documento_do_cliente x where x.cliente_id = f.id and x.documento = d.documento);

  /* o endereco principal de quem sai vira extra, se for outro */
  select coalesce(max(ordem), 0) into n from public.endereco_do_cliente where cliente_id = f.id;
  if btrim(s.endereco || s.cidade || s.cep) <> ''
     and lower(btrim(s.endereco)) || s.cep <> lower(btrim(f.endereco)) || f.cep then
    insert into public.endereco_do_cliente (cliente_id, apelido, endereco, complemento, bairro, cidade, uf, cep, ordem)
    values (f.id, case when s.nome <> f.nome then s.nome else '' end, s.endereco, s.complemento, s.bairro, s.cidade, s.uf, s.cep, n + 1);
  end if;
  update public.endereco_do_cliente set cliente_id = f.id, ordem = ordem + n + 2 where cliente_id = s.id;

  /* o contato principal de quem sai vira extra, se for outro */
  select coalesce(max(ordem), 0) into n from public.contato_do_cliente where cliente_id = f.id;
  if btrim(s.contato || s.celular || s.telefone || s.email) <> ''
     and public.fim_do_telefone(s.celular) is distinct from public.fim_do_telefone(f.celular)
     and lower(s.email) is distinct from nullif(lower(f.email), '') then
    insert into public.contato_do_cliente (cliente_id, nome, cargo, celular, telefone, email, ordem)
    values (f.id, s.contato, '', s.celular, s.telefone, s.email, n + 1);
  end if;
  update public.contato_do_cliente set cliente_id = f.id, ordem = ordem + n + 2 where cliente_id = s.id;

  /* o que esta vazio em quem fica, quem sai preenche; o historico soma */
  update public.cliente c
     set fantasia    = case when c.fantasia = '' then s.fantasia else c.fantasia end,
         documento   = case when c.documento = '' then s.documento else c.documento end,
         contato     = case when c.contato = '' then s.contato else c.contato end,
         celular     = case when c.celular = '' then s.celular else c.celular end,
         telefone    = case when c.telefone = '' then s.telefone else c.telefone end,
         email       = case when c.email = '' then s.email else c.email end,
         endereco    = case when c.endereco = '' then s.endereco else c.endereco end,
         complemento = case when c.endereco = '' then s.complemento else c.complemento end,
         bairro      = case when c.endereco = '' then s.bairro else c.bairro end,
         cidade      = case when c.cidade = '' then s.cidade else c.cidade end,
         uf          = case when c.uf = '' then s.uf else c.uf end,
         cep         = case when c.cep = '' then s.cep else c.cep end,
         vendedor_id = coalesce(c.vendedor_id, s.vendedor_id),
         vendedor    = case when c.vendedor = '' then s.vendedor else c.vendedor end,
         pedidos_antigos = c.pedidos_antigos + s.pedidos_antigos,
         total_antigo    = c.total_antigo + s.total_antigo,
         ultimo_pedido_antigo = greatest(c.ultimo_pedido_antigo, s.ultimo_pedido_antigo),
         teste = c.teste and s.teste
   where c.id = f.id;

  /* quem apontava para a ficha que sai passa a apontar para a que fica */
  update public.lead    set cliente_id = f.id where cliente_id = s.id;
  update public.pedido  set cliente_id = f.id where cliente_id = s.id;
  update public.cotacao set cliente_id = f.id,
                            corpo = case when corpo -> 'cliente' ->> 'id' = s.id::text
                                         then jsonb_set(corpo, '{cliente,id}', to_jsonb(f.id::text))
                                         else corpo end
   where cliente_id = s.id or corpo -> 'cliente' ->> 'id' = s.id::text;

  delete from public.cliente where id = s.id;

  select * into f from public.cliente where id = p_fica;
  return f;
end $$;

grant execute on function public.juntar_clientes(uuid, uuid) to authenticated;


-- ---------- 5. o frete preferido, dos ultimos pedidos ------------------------------
/* Os ultimos 10 pedidos que nao foram cancelados: a forma de envio que mais
   aparece (o Envio da cotacao, ou o envio anotado na Confirmacao do frete), e
   quem levou da ultima vez (o lancamento de Transporte do pedido). */
create or replace view public.frete_do_cliente
with (security_invoker = true) as
with ultimos as (
  select p.id, p.cliente_id, p.aprovado_em,
         upper(btrim(coalesce(c.corpo -> 'informe' ->> 'entrega', ''))) as modo,
         coalesce(f.envio, '') as envio,
         row_number() over (partition by p.cliente_id order by p.aprovado_em desc nulls last, p.numero desc) as n
    from public.pedido p
    left join public.cotacao c on c.id = p.cotacao_id
    left join public.frete_do_pedido f on f.pedido_id = p.id
   where p.cliente_id is not null and p.estado <> 'cancelado'
)
select u.cliente_id,
       (select x.modo from ultimos x where x.cliente_id = u.cliente_id and x.n <= 10 and x.modo <> ''
         group by x.modo order by count(*) desc, max(x.aprovado_em) desc nulls last limit 1) as modo,
       (select count(*) from ultimos x where x.cliente_id = u.cliente_id and x.n <= 10
           and x.modo = (select y.modo from ultimos y where y.cliente_id = u.cliente_id and y.n <= 10 and y.modo <> ''
                          group by y.modo order by count(*) desc, max(y.aprovado_em) desc nulls last limit 1)) as vezes,
       (select count(*) from ultimos x where x.cliente_id = u.cliente_id and x.n <= 10) as pedidos,
       (select x.envio from ultimos x where x.cliente_id = u.cliente_id and x.envio <> '' order by x.n limit 1) as ultimo_envio,
       (select t.nome
          from ultimos x
          join public.pedido_do_lancamento pl on pl.pedido_id = x.id
          join public.lancamento_de_transporte l on l.id = pl.lancamento_id and l.apagado_em is null and l.coleta_de is null
          join public.transportador t on t.id = l.transportador_id
         where x.cliente_id = u.cliente_id
         order by l.quando desc limit 1) as ultimo_transportador
  from (select distinct cliente_id from ultimos) u;

grant select on public.frete_do_cliente to authenticated;


-- ---------- a prova ----------------------------------------------------------------
do $$
begin
  raise notice '082 pronta: % cliente(s), extras e juntada no lugar', (select count(*) from public.cliente);
end $$;
