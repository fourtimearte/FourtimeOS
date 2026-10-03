-- ===========================================================================
-- 043: OS PARCEIROS DA LOJA
--
-- A loja (fourtimefit.com.br, na Shopify) vende pecas de parceiros: o Goias
-- Volei, o Viapol, o Colegio Yolanda. Cada um recebe uma parte do que vende,
-- e cada um tem um acordo diferente: percentual, ou valor fixo por peca.
--
-- O Henrique pediu uma pagina para cada parceiro acompanhar as proprias
-- vendas, aberta por link mais senha, e um lugar no Fourtime OS para dizer o
-- acordo de cada um. Este arquivo e o banco das duas coisas.
--
-- O CAMINHO DO DADO:
--   1. a Shopify avisa cada pedido (webhook) a uma funcao do Supabase, o
--      porteiro (supabase/functions/loja)
--   2. o porteiro confere a assinatura, joga fora tudo que e do comprador e
--      chama registrar_pedido_da_loja com o que sobrou: as linhas do pedido
--   3. a view venda_do_parceiro diz de que parceiro e cada linha e quanto e a
--      parte dele, com o acordo que valia no dia da venda
--   4. a pagina Parceiros do OS le as tabelas; a pagina do parceiro, na loja,
--      chama painel_do_parceiro com o link e a senha
--
-- O QUE ENTRA:
--   1. a pagina Parceiros na lista de paineis, e quem entra nela
--   2. o parceiro, o acordo e os produtos de cada parceiro
--   3. a venda da loja (uma linha por peca vendida) e o registro dos avisos
--   4. as views que a tela le
--   5. as funcoes do cadastro (quem tem "editar" na pagina)
--   6. as funcoes do porteiro (so a chave de servico chama)
--   7. a funcao da pagina do parceiro (a unica do banco aberta a quem nao
--      entrou no sistema: quem abre e o parceiro, com o link e a senha)
--
-- NADA DO COMPRADOR MORA AQUI. Nem nome, nem e-mail, nem endereco, nem
-- documento. A tabela guarda a peca, o tamanho, a quantidade e o valor.
--
-- A PARTE DO PARCEIRO NAO E GRAVADA: e conta, feita na hora de ler, com o
-- acordo do dia da venda. Acordo novo comeca a valer numa data ("vale a partir
-- de") e o anterior continua valendo para o que foi vendido antes. Acordo com
-- data no passado muda a parte de venda ja registrada, e por isso a funcao so
-- aceita quando quem salva confirma (p_refazer).
--
-- A SENHA DA PAGINA E GERADA PELO SISTEMA e fica legivel para quem ve a
-- pagina Parceiros, porque e o Henrique quem a envia ao parceiro. Ela so abre
-- a lista de vendas daquele parceiro: nao e senha de pessoa.
-- ===========================================================================


-- ---------- 1. a pagina e quem entra nela ----------------------------------
insert into public.painel (chave, nome, grupo, ordem) values
  ('parceiros', 'Parceiros', 'Gestão', 127)
on conflict (chave) do nothing;

/* O PADRAO DE CADA PAPEL: so o administrador e o gerente. Acordo de parceiro
   e assunto de quem negocia. A matriz de Acessos muda depois, pela tela. */
insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, 'parceiros', true, true, true, true
  from (values ('admin'), ('gerente')) as r(papel)
  join public.papel_do_sistema ps on ps.chave = r.papel
on conflict (papel, painel) do nothing;

/* quem tem lista propria nao herda o padrao: a pagina nova entra na mao */
update public.pessoa set paineis = paineis || array['parceiros']
 where paineis is not null
   and not ('parceiros' = any (paineis))
   and papel in ('admin', 'gerente');


-- ---------- 2. o parceiro, o acordo e os produtos --------------------------

/* A senha nova: 8 caracteres de um alfabeto de 32, sem I, O, 0 e 1, que se
   confundem ao ler em voz alta. Sai dos bytes de um uuid aleatorio (os bytes
   6 e 8 ficam de fora: neles moram a versao e a variante, que nao sao sorte).
   256 e multiplo de 32, entao o resto da divisao nao favorece letra nenhuma. */
create or replace function public.senha_nova_de_parceiro()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(x.b, i.i) % 32), 1), '')
    from (select uuid_send(gen_random_uuid()) as b) x,
         unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as i(i)
$$;

create table if not exists public.parceiro (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  -- o endereco da colecao na loja (o "handle"); vazio enquanto nao escolhida
  colecao       text not null default '',
  colecao_nome  text not null default '',
  -- a parte secreta do link, e a senha que abre a pagina
  chave         text not null default replace(gen_random_uuid()::text, '-', ''),
  senha         text not null default public.senha_nova_de_parceiro(),
  ativo         boolean not null default true,
  -- a trava de senha errada: 5 erros seguidos fecham a pagina por 15 minutos
  erros         int not null default 0,
  travado_ate   timestamptz,
  -- a ultima vez que o parceiro abriu a pagina com a senha certa
  aberta_em     timestamptz,
  -- a ultima vez que a lista de produtos foi lida da loja
  produtos_em   timestamptz,
  criado_por    uuid default auth.uid() references public.pessoa (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint parceiro_nome_nao_vazio check (btrim(nome) <> ''),
  constraint parceiro_chave_nao_vazia check (length(chave) >= 16),
  constraint parceiro_senha_nao_vazia check (length(senha) >= 6)
);

comment on table public.parceiro is
  'Quem vende pecas na loja e recebe parte da venda. Uma colecao da loja por parceiro.';

create unique index if not exists parceiro_nome_unico on public.parceiro (lower(nome));
create unique index if not exists parceiro_chave_unica on public.parceiro (chave);
create unique index if not exists parceiro_colecao_unica on public.parceiro (colecao) where colecao <> '';

alter table public.parceiro enable row level security;
drop policy if exists "quem ve os parceiros le o cadastro" on public.parceiro;
create policy "quem ve os parceiros le o cadastro"
  on public.parceiro for select to authenticated
  using (public.posso('parceiros', 'ver'));
/* so leitura: quem grava sao as funcoes da secao 5 */
grant select on public.parceiro to authenticated;


create table if not exists public.acordo_do_parceiro (
  id          uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiro (id) on delete cascade,
  tipo        text not null,
  -- o percentual (de 0 a 100) ou o valor em reais por peca
  valor       numeric(10,2) not null,
  -- sobre o que o percentual incide: o que o cliente pagou, ou o preco cheio
  base        text not null default 'valor_pago',
  vale_desde  date not null,
  criado_por  uuid default auth.uid() references public.pessoa (id) on delete set null,
  criado_em   timestamptz not null default now(),

  constraint acordo_tipo_conhecido check (tipo in ('percentual', 'valor_por_peca')),
  constraint acordo_base_conhecida check (base in ('valor_pago', 'preco_cheio')),
  constraint acordo_valor_nao_negativo check (valor >= 0),
  constraint acordo_percentual_ate_cem check (tipo <> 'percentual' or valor <= 100),
  constraint acordo_um_por_dia unique (parceiro_id, vale_desde)
);

comment on table public.acordo_do_parceiro is
  'O acordo de cada parceiro, com a data em que comeca a valer. Vale para a venda o acordo do dia dela.';

alter table public.acordo_do_parceiro enable row level security;
drop policy if exists "quem ve os parceiros le os acordos" on public.acordo_do_parceiro;
create policy "quem ve os parceiros le os acordos"
  on public.acordo_do_parceiro for select to authenticated
  using (public.posso('parceiros', 'ver'));
grant select on public.acordo_do_parceiro to authenticated;


/* DE QUE PARCEIRO E CADA PRODUTO. O aviso da Shopify traz o produto, e nao a
   colecao; esta lista e a ponte. Quem a enche e o porteiro, lendo a colecao
   do parceiro na loja. Produto que sai da colecao NAO sai daqui: a venda
   antiga dele continua sendo do parceiro. */
create table if not exists public.produto_do_parceiro (
  produto_id  bigint primary key,
  parceiro_id uuid not null references public.parceiro (id) on delete cascade,
  titulo      text not null default '',
  visto_em    timestamptz not null default now()
);

comment on table public.produto_do_parceiro is
  'Produto da loja (id da Shopify) que pertence a um parceiro. Um produto, um parceiro.';

create index if not exists produto_do_parceiro_por_parceiro
  on public.produto_do_parceiro (parceiro_id);

alter table public.produto_do_parceiro enable row level security;
drop policy if exists "quem ve os parceiros le os produtos" on public.produto_do_parceiro;
create policy "quem ve os parceiros le os produtos"
  on public.produto_do_parceiro for select to authenticated
  using (public.posso('parceiros', 'ver'));
grant select on public.produto_do_parceiro to authenticated;


-- ---------- 3. a venda da loja e o registro dos avisos ---------------------

/* UMA LINHA POR LINHA DE PEDIDO DA LOJA, de qualquer produto, de parceiro ou
   nao. Guardar todas e o que deixa a lista de produtos chegar atrasada sem
   perder venda: a venda ja esta aqui, e passa a ser do parceiro no instante
   em que o produto entra na lista dele.

   A situacao e a do pagamento, como a loja escreve, em minusculas: paid,
   partially_refunded, refunded, pending, expired, voided, authorized. */
create table if not exists public.venda_da_loja (
  -- o id da linha do pedido na Shopify
  item_id       bigint primary key,
  pedido_id     bigint not null,
  -- o numero que a loja mostra, como "#1089"
  pedido        text not null default '',
  vendido_em    timestamptz not null,
  produto_id    bigint,
  variante_id   bigint,
  -- o nome da peca e o tamanho, como estavam no dia da venda
  produto       text not null default '',
  variante      text not null default '',
  quantidade    int not null,
  devolvida     int not null default 0,
  -- o preco de uma peca, antes do desconto, e o desconto da linha inteira
  preco         numeric(12,2) not null,
  desconto      numeric(12,2) not null default 0,
  situacao      text not null default '',
  cancelado_em  timestamptz,
  -- a data de alteracao do pedido na loja: aviso mais velho nao pisa no novo
  atualizado_em timestamptz not null,
  recebido_em   timestamptz not null default now(),
  -- aviso (veio do webhook) ou carga (as vendas de antes de o aviso existir)
  origem        text not null default 'aviso',

  constraint venda_quantidade_positiva check (quantidade > 0),
  constraint venda_devolvida_cabe check (devolvida >= 0),
  constraint venda_origem_conhecida check (origem in ('aviso', 'carga'))
);

comment on table public.venda_da_loja is
  'Linhas dos pedidos da loja Shopify: peca, tamanho, quantidade e valor. Nenhum dado do comprador.';

create index if not exists venda_da_loja_por_produto on public.venda_da_loja (produto_id, vendido_em desc);
create index if not exists venda_da_loja_por_pedido on public.venda_da_loja (pedido_id);
create index if not exists venda_da_loja_por_dia on public.venda_da_loja (vendido_em desc);

alter table public.venda_da_loja enable row level security;
drop policy if exists "quem ve os parceiros le as vendas da loja" on public.venda_da_loja;
create policy "quem ve os parceiros le as vendas da loja"
  on public.venda_da_loja for select to authenticated
  using (public.posso('parceiros', 'ver'));
grant select on public.venda_da_loja to authenticated;


/* O REGISTRO DOS AVISOS: uma linha por aviso que chegou. E o que responde
   "a loja esta avisando?" sem ninguem ter de abrir o painel da Shopify. */
create table if not exists public.aviso_da_loja (
  id          bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  topico      text not null default '',
  pedido_id   bigint,
  pedido      text not null default '',
  itens       int not null default 0,
  resultado   text not null default ''
);

comment on table public.aviso_da_loja is
  'Um registro por aviso (webhook) recebido da loja: quando, de que pedido e o que foi feito.';

create index if not exists aviso_da_loja_por_dia on public.aviso_da_loja (recebido_em desc);

alter table public.aviso_da_loja enable row level security;
drop policy if exists "quem ve os parceiros le os avisos" on public.aviso_da_loja;
create policy "quem ve os parceiros le os avisos"
  on public.aviso_da_loja for select to authenticated
  using (public.posso('parceiros', 'ver'));
grant select on public.aviso_da_loja to authenticated;


-- ---------- 4. as views que a tela le --------------------------------------

/* A VENDA DE CADA PARCEIRO, com a conta feita.

   conta    a linha entra nas somas: foi paga, nao foi cancelada, nao foi
            devolvida inteira
   aparece  a linha aparece na lista do parceiro: foi paga em algum momento.
            Pedido que nunca foi pago (Pix vencido) nao e venda e nao aparece
   pecas    a quantidade que conta (a vendida menos a devolvida)
   valor    o que o cliente pagou por essas pecas, sem o frete
   cheio    o preco cheio dessas pecas, antes do desconto
   parte    a parte do parceiro; nula quando nao havia acordo no dia da venda

   O mes e o dia sao os de Goiania, e nao os do servidor: a venda das dez da
   noite do dia 31 e do mes que esta acabando. */
create or replace view public.venda_do_parceiro
with (security_invoker = true) as
select v.item_id,
       pp.parceiro_id,
       v.pedido_id,
       v.pedido,
       v.vendido_em,
       to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes,
       v.produto_id,
       v.produto,
       v.variante,
       v.quantidade,
       v.devolvida,
       c.conta,
       c.aparece,
       case when c.conta then null
            when v.cancelado_em is not null then 'cancelada'
            else 'devolvida' end as motivo,
       c.pecas,
       c.valor,
       c.cheio,
       a.tipo  as acordo_tipo,
       a.valor as acordo_valor,
       a.base  as acordo_base,
       case when not c.conta then 0
            when a.id is null then null
            when a.tipo = 'valor_por_peca' then round(c.pecas * a.valor, 2)
            when a.base = 'preco_cheio' then round(c.cheio * a.valor / 100, 2)
            else round(c.valor * a.valor / 100, 2)
       end as parte,
       v.situacao,
       v.cancelado_em
  from public.venda_da_loja v
  join public.produto_do_parceiro pp on pp.produto_id = v.produto_id
 cross join lateral (
        select q.conta,
               q.aparece,
               case when q.conta then q.liquida else 0 end as pecas,
               case when q.conta
                    then round((v.quantidade * v.preco - v.desconto) * q.liquida / v.quantidade, 2)
                    else 0 end as valor,
               case when q.conta then round(v.preco * q.liquida, 2) else 0 end as cheio
          from (select greatest(v.quantidade - v.devolvida, 0) as liquida,
                       v.situacao in ('paid', 'partially_refunded', 'refunded') as aparece,
                       v.situacao in ('paid', 'partially_refunded')
                         and v.cancelado_em is null
                         and v.quantidade - v.devolvida > 0 as conta) q
       ) c
  left join lateral (
        select x.id, x.tipo, x.valor, x.base
          from public.acordo_do_parceiro x
         where x.parceiro_id = pp.parceiro_id
           and x.vale_desde <= (v.vendido_em at time zone 'America/Sao_Paulo')::date
         order by x.vale_desde desc
         limit 1
       ) a on true;

grant select on public.venda_do_parceiro to authenticated;


/* O PARCEIRO NA LISTA, com o acordo que vale hoje, o ultimo acordo escrito
   (que pode comecar a valer so no futuro) e quantos produtos ele tem. */
create or replace view public.parceiro_na_lista
with (security_invoker = true) as
select p.id,
       p.nome,
       p.colecao,
       p.colecao_nome,
       p.chave,
       p.senha,
       p.ativo,
       p.aberta_em,
       p.travado_ate,
       p.produtos_em,
       p.criado_em,
       h.tipo       as acordo_tipo,
       h.valor      as acordo_valor,
       h.base       as acordo_base,
       h.vale_desde as acordo_desde,
       u.tipo       as ultimo_tipo,
       u.valor      as ultimo_valor,
       u.base       as ultimo_base,
       u.vale_desde as ultimo_desde,
       (select count(*) from public.produto_do_parceiro pp where pp.parceiro_id = p.id) as produtos
  from public.parceiro p
  left join lateral (
        select x.tipo, x.valor, x.base, x.vale_desde
          from public.acordo_do_parceiro x
         where x.parceiro_id = p.id
           and x.vale_desde <= (now() at time zone 'America/Sao_Paulo')::date
         order by x.vale_desde desc limit 1
       ) h on true
  left join lateral (
        select x.tipo, x.valor, x.base, x.vale_desde
          from public.acordo_do_parceiro x
         where x.parceiro_id = p.id
         order by x.vale_desde desc limit 1
       ) u on true;

grant select on public.parceiro_na_lista to authenticated;


-- ---------- 5. as funcoes do cadastro --------------------------------------

/* SALVAR O PARCEIRO, novo ou existente. O link e a senha nascem sozinhos.

   Trocar a colecao esvazia a lista de produtos do parceiro: ela e derivada da
   colecao, e o porteiro a enche de novo. Sem isso, escolher a colecao errada
   e corrigir deixaria as vendas da errada com o parceiro para sempre. */
create or replace function public.salvar_parceiro(
  p_id           uuid,
  p_nome         text,
  p_colecao      text default '',
  p_colecao_nome text default '',
  p_ativo        boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t   public.parceiro;
  col text := btrim(coalesce(p_colecao, ''));
begin
  if not public.posso('parceiros', 'editar') then
    raise exception 'Seu acesso não permite mexer nos parceiros.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_nome, '')) = '' then
    raise exception 'O parceiro precisa de um nome.' using errcode = '23514';
  end if;
  if exists (select 1 from public.parceiro x
              where lower(x.nome) = lower(btrim(p_nome)) and x.id is distinct from p_id) then
    raise exception 'Já existe um parceiro com este nome.' using errcode = '23505';
  end if;
  if col <> '' and exists (select 1 from public.parceiro x
                            where x.colecao = col and x.id is distinct from p_id) then
    raise exception 'Esta coleção já é de outro parceiro.' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.parceiro (nome, colecao, colecao_nome, ativo)
    values (btrim(p_nome), col, btrim(coalesce(p_colecao_nome, '')), coalesce(p_ativo, true))
    returning * into t;
    return t.id;
  end if;

  select * into t from public.parceiro where id = p_id for update;
  if not found then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  if t.colecao is distinct from col then
    delete from public.produto_do_parceiro where parceiro_id = p_id;
  end if;
  update public.parceiro
     set nome = btrim(p_nome),
         colecao = col,
         colecao_nome = btrim(coalesce(p_colecao_nome, '')),
         ativo = coalesce(p_ativo, true),
         produtos_em = case when t.colecao is distinct from col then null else produtos_em end,
         atualizado_em = now()
   where id = p_id;
  return p_id;
end $$;

revoke all on function public.salvar_parceiro(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.salvar_parceiro(uuid, text, text, text, boolean) to authenticated;


/* SALVAR O ACORDO. O formulario da tela escreve sempre o ULTIMO acordo do
   parceiro: salvar com uma data apaga o que estava marcado para depois dela,
   e o que valia antes continua valendo para as vendas de antes.

   Data no passado muda a parte de venda ja registrada. Entao, havendo venda
   do parceiro daquela data em diante, a funcao recusa, e so aceita quando
   quem salva diz que e isso mesmo (p_refazer). A pergunta e feita pelo banco,
   e nao so pela tela. */
create or replace function public.salvar_acordo_do_parceiro(
  p_parceiro   uuid,
  p_tipo       text,
  p_valor      numeric,
  p_base       text default 'valor_pago',
  p_vale_desde date default null,
  p_refazer    boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  desde date := coalesce(p_vale_desde, (now() at time zone 'America/Sao_Paulo')::date);
  base  text := coalesce(nullif(btrim(coalesce(p_base, '')), ''), 'valor_pago');
  novo  uuid;
  n     int;
begin
  if not public.posso('parceiros', 'editar') then
    raise exception 'Seu acesso não permite mexer nos parceiros.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.parceiro where id = p_parceiro) then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  if p_tipo not in ('percentual', 'valor_por_peca') then
    raise exception 'Tipo de acordo desconhecido.' using errcode = '22023';
  end if;
  if base not in ('valor_pago', 'preco_cheio') then
    raise exception 'Base do acordo desconhecida.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'O valor do acordo não pode ser negativo.' using errcode = '23514';
  end if;
  if p_tipo = 'percentual' and p_valor > 100 then
    raise exception 'O percentual vai de 0 a 100.' using errcode = '23514';
  end if;

  if desde < hoje and not coalesce(p_refazer, false) then
    select count(*) into n
      from public.venda_da_loja v
      join public.produto_do_parceiro pp on pp.produto_id = v.produto_id
     where pp.parceiro_id = p_parceiro
       and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= desde;
    if n > 0 then
      raise exception 'Este acordo muda a parte de % venda(s) já registrada(s). Confirme para refazer a conta.', n
        using errcode = '23514';
    end if;
  end if;

  delete from public.acordo_do_parceiro where parceiro_id = p_parceiro and vale_desde > desde;

  insert into public.acordo_do_parceiro (parceiro_id, tipo, valor, base, vale_desde)
  values (p_parceiro, p_tipo, round(p_valor, 2), base, desde)
  on conflict (parceiro_id, vale_desde) do update
    set tipo = excluded.tipo, valor = excluded.valor, base = excluded.base,
        criado_por = auth.uid(), criado_em = now()
  returning id into novo;
  return novo;
end $$;

revoke all on function public.salvar_acordo_do_parceiro(uuid, text, numeric, text, date, boolean) from public, anon;
grant execute on function public.salvar_acordo_do_parceiro(uuid, text, numeric, text, date, boolean) to authenticated;


/* GERAR OUTRA SENHA e TROCAR O LINK. As duas valem na hora: a senha ou o link
   antigo param de abrir. Gerar outra senha tambem destrava a pagina. */
create or replace function public.trocar_senha_do_parceiro(p_parceiro uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nova text := public.senha_nova_de_parceiro();
begin
  if not public.posso('parceiros', 'editar') then
    raise exception 'Seu acesso não permite mexer nos parceiros.' using errcode = '42501';
  end if;
  update public.parceiro
     set senha = nova, erros = 0, travado_ate = null, atualizado_em = now()
   where id = p_parceiro;
  if not found then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  return nova;
end $$;

revoke all on function public.trocar_senha_do_parceiro(uuid) from public, anon;
grant execute on function public.trocar_senha_do_parceiro(uuid) to authenticated;

create or replace function public.trocar_link_do_parceiro(p_parceiro uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nova text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.posso('parceiros', 'editar') then
    raise exception 'Seu acesso não permite mexer nos parceiros.' using errcode = '42501';
  end if;
  update public.parceiro
     set chave = nova, erros = 0, travado_ate = null, atualizado_em = now()
   where id = p_parceiro;
  if not found then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  return nova;
end $$;

revoke all on function public.trocar_link_do_parceiro(uuid) from public, anon;
grant execute on function public.trocar_link_do_parceiro(uuid) to authenticated;


-- ---------- 6. as funcoes do porteiro --------------------------------------
/* SO A CHAVE DE SERVICO CHAMA ESTAS TRES. O porteiro (a funcao do Supabase
   que recebe o aviso da loja) e quem tem essa chave, e so chama depois de
   conferir a assinatura do aviso. Se qualquer pessoa pudesse chamar, qualquer
   pessoa inventaria uma venda: por isso o revoke vem antes do grant, e a
   prova confere que anon e authenticated ficam de fora. */

/* REGISTRAR UM PEDIDO DA LOJA. Recebe o pedido ja sem nada do comprador:

     { id, nome, criado_em, atualizado_em, cancelado_em, situacao, teste,
       itens: [ { id, produto_id, variante_id, produto, variante,
                  quantidade, devolvida, preco, desconto } ] }

   O mesmo pedido chega varias vezes (criado, pago, alterado, cancelado), e
   nem sempre na ordem: cada linha so e reescrita por aviso mais novo que o
   guardado. Pedido de teste da loja e anotado no registro e nao e gravado.

   Devolve quantas linhas leu e se vale a pena reler os produtos dos
   parceiros (ha produto vendido que nao e de ninguem, e a ultima leitura tem
   mais de dez minutos). */
create or replace function public.registrar_pedido_da_loja(
  p_pedido jsonb,
  p_topico text default '',
  p_origem text default 'aviso'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ped      bigint;
  numero   text := coalesce(p_pedido ->> 'nome', '');
  vendido  timestamptz;
  alterado timestamptz;
  it       jsonb;
  n        int := 0;
  soltos   int := 0;
  reler    boolean := false;
  qtd      int;
begin
  if coalesce(p_pedido ->> 'id', '') !~ '^[0-9]+$' then
    insert into public.aviso_da_loja (topico, resultado)
    values (coalesce(p_topico, ''), 'sem pedido: aviso ignorado');
    return jsonb_build_object('ok', true, 'itens', 0, 'reler_produtos', false);
  end if;
  ped := (p_pedido ->> 'id')::bigint;

  if coalesce((p_pedido ->> 'teste')::boolean, false) then
    insert into public.aviso_da_loja (topico, pedido_id, pedido, resultado)
    values (coalesce(p_topico, ''), ped, numero, 'pedido de teste: não gravado');
    return jsonb_build_object('ok', true, 'itens', 0, 'teste', true, 'reler_produtos', false);
  end if;

  vendido  := coalesce((p_pedido ->> 'criado_em')::timestamptz, now());
  alterado := coalesce((p_pedido ->> 'atualizado_em')::timestamptz, vendido);

  for it in select * from jsonb_array_elements(coalesce(p_pedido -> 'itens', '[]'::jsonb)) loop
    continue when coalesce(it ->> 'id', '') !~ '^[0-9]+$';
    qtd := coalesce((it ->> 'quantidade')::int, 0);
    continue when qtd <= 0;
    insert into public.venda_da_loja
      (item_id, pedido_id, pedido, vendido_em, produto_id, variante_id, produto, variante,
       quantidade, devolvida, preco, desconto, situacao, cancelado_em, atualizado_em, origem)
    values
      ((it ->> 'id')::bigint, ped, numero, vendido,
       nullif(it ->> 'produto_id', '')::bigint,
       nullif(it ->> 'variante_id', '')::bigint,
       coalesce(it ->> 'produto', ''),
       coalesce(it ->> 'variante', ''),
       qtd,
       least(greatest(coalesce((it ->> 'devolvida')::int, 0), 0), qtd),
       coalesce((it ->> 'preco')::numeric, 0),
       greatest(coalesce((it ->> 'desconto')::numeric, 0), 0),
       lower(coalesce(p_pedido ->> 'situacao', '')),
       nullif(p_pedido ->> 'cancelado_em', '')::timestamptz,
       alterado,
       case when p_origem = 'carga' then 'carga' else 'aviso' end)
    on conflict (item_id) do update
      set pedido = excluded.pedido,
          produto_id = excluded.produto_id,
          variante_id = excluded.variante_id,
          produto = excluded.produto,
          variante = excluded.variante,
          quantidade = excluded.quantidade,
          devolvida = excluded.devolvida,
          preco = excluded.preco,
          desconto = excluded.desconto,
          situacao = excluded.situacao,
          cancelado_em = excluded.cancelado_em,
          atualizado_em = excluded.atualizado_em,
          recebido_em = now()
      where public.venda_da_loja.atualizado_em <= excluded.atualizado_em;
    n := n + 1;
  end loop;

  select count(distinct v.produto_id) into soltos
    from public.venda_da_loja v
   where v.pedido_id = ped
     and v.produto_id is not null
     and not exists (select 1 from public.produto_do_parceiro pp where pp.produto_id = v.produto_id);
  reler := soltos > 0 and exists (
    select 1 from public.parceiro p
     where p.ativo and p.colecao <> ''
       and (p.produtos_em is null or p.produtos_em < now() - interval '10 minutes'));

  insert into public.aviso_da_loja (topico, pedido_id, pedido, itens, resultado)
  values (coalesce(p_topico, ''), ped, numero, n,
          lower(coalesce(p_pedido ->> 'situacao', '')));

  return jsonb_build_object('ok', true, 'itens', n, 'reler_produtos', reler);
end $$;

revoke all on function public.registrar_pedido_da_loja(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pedido_da_loja(jsonb, text, text) to service_role;


/* AS COLECOES QUE O PORTEIRO TEM DE LER: a de cada parceiro ativo. */
create or replace function public.colecoes_dos_parceiros()
returns table (parceiro_id uuid, colecao text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.colecao from public.parceiro p where p.ativo and p.colecao <> ''
$$;

revoke all on function public.colecoes_dos_parceiros() from public, anon, authenticated;
grant execute on function public.colecoes_dos_parceiros() to service_role;


/* OS PRODUTOS DE UM PARCEIRO, lidos da colecao dele na loja:

     [ { id, titulo } ]

   Produto novo entra, o que ja era dele ganha o titulo de hoje. Nada sai.
   Produto que ja e de outro parceiro fica com quem ja estava: um produto, um
   parceiro. Devolve quantos produtos o parceiro tem depois da leitura. */
create or replace function public.registrar_produtos_do_parceiro(
  p_parceiro uuid,
  p_produtos jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not exists (select 1 from public.parceiro where id = p_parceiro) then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.produto_do_parceiro (produto_id, parceiro_id, titulo, visto_em)
  select distinct on ((x ->> 'id')::bigint)
         (x ->> 'id')::bigint, p_parceiro, coalesce(x ->> 'titulo', ''), now()
    from jsonb_array_elements(coalesce(p_produtos, '[]'::jsonb)) x
   where coalesce(x ->> 'id', '') ~ '^[0-9]+$'
  on conflict (produto_id) do update
    set titulo = excluded.titulo, visto_em = excluded.visto_em
    where public.produto_do_parceiro.parceiro_id = excluded.parceiro_id;
  update public.parceiro set produtos_em = now() where id = p_parceiro;
  select count(*) into n from public.produto_do_parceiro where parceiro_id = p_parceiro;
  return n;
end $$;

revoke all on function public.registrar_produtos_do_parceiro(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_produtos_do_parceiro(uuid, jsonb) to service_role;


-- ---------- 7. a pagina do parceiro ----------------------------------------

/* O PAINEL DO PARCEIRO. E a unica funcao do banco aberta a quem nao entrou no
   sistema (papel anon): quem chama e a pagina da loja, com a chave do link e
   a senha que o parceiro digitou. Ela nao levanta erro: devolve sempre um
   objeto, e o campo "ok" diz se abriu.

     indisponivel  o link nao existe, ou a pagina esta desligada
     senha         senha errada; "restam" diz quantas tentativas sobram
     travado       5 erros seguidos: a pagina fecha por 15 minutos

   A senha errada e contada no proprio cadastro. Quem tem o link consegue
   travar a pagina por 15 minutos errando de proposito; e o preco de a senha
   nao poder ser adivinhada por tentativa.

   Devolve os ultimos 24 meses: os totais por mes e as vendas, uma a uma, com
   o que o parceiro pode ver. Nunca o comprador, que nem esta no banco. */
create or replace function public.painel_do_parceiro(p_chave text, p_senha text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p      public.parceiro;
  agora  timestamptz := now();
  hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  inicio date;
begin
  select * into p from public.parceiro
   where chave = btrim(coalesce(p_chave, '')) for update;
  if not found or not p.ativo then
    return jsonb_build_object('ok', false, 'erro', 'indisponivel');
  end if;

  if p.travado_ate is not null and p.travado_ate > agora then
    return jsonb_build_object('ok', false, 'erro', 'travado',
      'minutos', greatest(1, ceil(extract(epoch from p.travado_ate - agora) / 60)::int));
  end if;

  if upper(btrim(coalesce(p_senha, ''))) is distinct from upper(p.senha) then
    if p.erros + 1 >= 5 then
      update public.parceiro set erros = 0, travado_ate = agora + interval '15 minutes' where id = p.id;
      return jsonb_build_object('ok', false, 'erro', 'travado', 'minutos', 15);
    end if;
    update public.parceiro set erros = p.erros + 1, travado_ate = null where id = p.id;
    return jsonb_build_object('ok', false, 'erro', 'senha', 'restam', 5 - (p.erros + 1));
  end if;

  update public.parceiro set erros = 0, travado_ate = null, aberta_em = agora where id = p.id;

  inicio := (date_trunc('month', hoje::timestamp) - interval '23 months')::date;

  return jsonb_build_object(
    'ok', true,
    'parceiro', p.nome,
    'hoje', hoje,
    'acordo', (
      select jsonb_build_object('tipo', x.tipo, 'valor', x.valor, 'base', x.base, 'desde', x.vale_desde)
        from public.acordo_do_parceiro x
       where x.parceiro_id = p.id and x.vale_desde <= hoje
       order by x.vale_desde desc limit 1),
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object('mes', m.mes, 'pecas', m.pecas, 'valor', m.valor, 'parte', m.parte)
                       order by m.mes desc)
        from (select v.mes,
                     sum(v.pecas)::int as pecas,
                     sum(v.valor) as valor,
                     sum(coalesce(v.parte, 0)) as parte
                from public.venda_do_parceiro v
               where v.parceiro_id = p.id and v.conta
                 and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio
               group by v.mes) m), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
                 'quando', to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
                 'mes', v.mes,
                 'produto', v.produto,
                 'variante', v.variante,
                 'quantidade', v.quantidade,
                 'pecas', v.pecas,
                 'valor', v.valor,
                 'parte', v.parte,
                 'conta', v.conta,
                 'motivo', v.motivo)
               order by v.vendido_em desc, v.item_id)
        from public.venda_do_parceiro v
       where v.parceiro_id = p.id and v.aparece
         and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio), '[]'::jsonb)
  );
end $$;

revoke all on function public.painel_do_parceiro(text, text) from public;
grant execute on function public.painel_do_parceiro(text, text) to anon, authenticated;


-- ---------- 8. a prova -----------------------------------------------------
do $$
begin
  if not exists (select 1 from public.painel where chave = 'parceiros') then
    raise exception 'o painel parceiros nao entrou';
  end if;
  if not exists (select 1 from public.permissao where papel = 'admin' and painel = 'parceiros' and total) then
    raise exception 'o admin ficou sem a pagina de parceiros';
  end if;
  if has_function_privilege('anon', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute') then
    raise exception 'registrar_pedido_da_loja ficou aberta a quem nao e o porteiro';
  end if;
  if has_function_privilege('anon', 'public.registrar_produtos_do_parceiro(uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_produtos_do_parceiro(uuid, jsonb)', 'execute') then
    raise exception 'registrar_produtos_do_parceiro ficou aberta a quem nao e o porteiro';
  end if;
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a pagina do parceiro nao consegue chamar painel_do_parceiro';
  end if;
  if length(public.senha_nova_de_parceiro()) <> 8 then
    raise exception 'a senha nova nao saiu com 8 caracteres';
  end if;
  raise notice '043 pronta: % parceiros, % produtos, % linhas de venda',
    (select count(*) from public.parceiro),
    (select count(*) from public.produto_do_parceiro),
    (select count(*) from public.venda_da_loja);
end $$;
