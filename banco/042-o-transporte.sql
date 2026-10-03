-- ===========================================================================
-- 042: O TRANSPORTE
--
-- A 041 guardou a transportadora como um tipo de fornecedor, o Frete. Nao
-- cabe: fornecedor e de quem a Fourtime compra material; transporte e servico
-- pago por corrida, e no meio dele estao o motoboy, o Uber e o taxi, que nem
-- CNPJ tem. E faltava o principal: registrar o que se paga por cada corrida e
-- somar isso num relatorio.
--
-- O QUE ENTRA:
--   1. a pagina Transporte na lista de paineis, e quem entra nela
--   2. quem transporta: transportadora, motoboy, Uber e taxi
--   3. o lancamento: o pagamento de uma corrida
--   4. as duas views que a tela le
--   5. as tres funcoes: lancar (e corrigir), acertar e salvar o cadastro
--   6. as transportadoras que a 041 semeou como fornecedor passam para ca
--
-- O CNPJ DA TRANSPORTADORA CONTINUA NA TABELA fornecedor. E la que mora a
-- lista de confiaveis que o Verificador de Boleto consulta, e a transportadora
-- manda boleto como qualquer outro. Entao o cadastro daqui aponta para a linha
-- de la, e a pagina de Fornecedores so deixa de mostrar quem e de frete. Uma
-- lista so de CNPJ, duas paginas olhando.
--
-- NADA SE APAGA. Lancamento e registro de pagamento: corrige-se, nao se
-- apaga. Por isso nao ha delete, nem na tabela nem em funcao.
--
-- TODA ESCRITA PASSA POR FUNCAO. As duas tabelas so tem grant de leitura. Quem
-- lanca, corrige, acerta e cadastra e quem tem "editar" na pagina, e quem
-- pergunta isso e a funcao, e nao a tela.
-- ===========================================================================


-- ---------- 1. a pagina e quem entra nela ----------------------------------
insert into public.painel (chave, nome, grupo, ordem) values
  ('transporte', 'Transporte', 'Gestão', 125)
on conflict (chave) do nothing;

/* O PADRAO DE CADA PAPEL. E so o ponto de partida: a matriz de Acessos muda
   depois, pela tela, e o on conflict garante que rodar isto de novo nao
   desfaz o que o Henrique mexer.

   Admin e gerente tem tudo. Producao e estoquista lancam e acertam, porque
   sao eles que chamam o motoboy e buscam material. O analista le o
   relatorio. O vendedor fica de fora. So entra papel que ainda existe. */
insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, 'transporte', true, r.editar, r.total, r.total
  from (values
    ('admin',      true,  true),
    ('gerente',    true,  true),
    ('producao',   true,  false),
    ('estoquista', true,  false),
    ('analista',   false, false)
  ) as r(papel, editar, total)
  join public.papel_do_sistema ps on ps.chave = r.papel
on conflict (papel, painel) do nothing;

/* quem tem lista propria nao herda o padrao: a pagina nova entra na mao,
   como a 022 fez com a separacao e o PCP */
update public.pessoa set paineis = paineis || array['transporte']
 where paineis is not null
   and not ('transporte' = any (paineis))
   and papel in ('admin', 'gerente', 'producao', 'estoquista', 'analista');


-- ---------- 2. quem transporta ---------------------------------------------
create table if not exists public.transportador (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  meio          text not null,
  -- so a transportadora usa: a linha de fornecedor onde mora o CNPJ dela
  fornecedor_id uuid references public.fornecedor (id) on delete set null,
  contato       text not null default '',
  onde_atende   text not null default '',
  prazo         text not null default '',
  observacao    text not null default '',
  ativo         boolean not null default true,
  teste         boolean not null default false,
  criado_por    uuid default auth.uid() references public.pessoa (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint transportador_nome_nao_vazio check (btrim(nome) <> ''),
  constraint transportador_meio_conhecido
    check (meio in ('motoboy', 'uber', 'taxi', 'transportadora'))
);

comment on table public.transportador is
  'Quem transporta: transportadora, motoboy, Uber e taxi. O CNPJ da transportadora mora em fornecedor.';

create unique index if not exists transportador_nome_unico
  on public.transportador (lower(nome));
create index if not exists transportador_por_fornecedor
  on public.transportador (fornecedor_id) where fornecedor_id is not null;

drop trigger if exists transportador_carimbo on public.transportador;
create trigger transportador_carimbo
  before update on public.transportador
  for each row execute function public.carimbar_atualizacao();

alter table public.transportador enable row level security;
drop policy if exists "quem ve o transporte le quem transporta" on public.transportador;
create policy "quem ve o transporte le quem transporta"
  on public.transportador for select to authenticated
  using (public.posso('transporte', 'ver'));
/* so leitura: quem grava e a funcao salvar_transportador */
grant select on public.transportador to authenticated;


-- ---------- 3. o lancamento ------------------------------------------------
create table if not exists public.lancamento_de_transporte (
  id               uuid primary key default gen_random_uuid(),
  -- o dia e a hora da corrida, que nao e a hora em que alguem a lancou
  quando           timestamptz not null default now(),
  transportador_id uuid not null references public.transportador (id) on delete restrict,
  motivo           text not null,
  pedido_id        uuid references public.pedido (id) on delete set null,
  -- de quem se buscou o material, quando o motivo e busca
  fornecedor_id    uuid references public.fornecedor (id) on delete set null,
  destino          text not null default '',
  valor            numeric(12,2) not null,
  forma            text not null,
  pago             boolean not null default false,
  pago_em          timestamptz,
  pago_por         uuid references public.pessoa (id) on delete set null,
  quem             uuid references public.pessoa (id) on delete set null,
  quem_nome        text not null default '',
  observacao       text not null default '',
  teste            boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  constraint lancamento_motivo_conhecido check (motivo in ('entrega', 'busca', 'outro')),
  constraint lancamento_forma_conhecida check (forma in ('pix', 'dinheiro', 'cartao', 'boleto')),
  constraint lancamento_valor_positivo check (valor > 0),
  /* pago e a data andam juntos: lancamento pago sem dia, ou com dia e sem
     estar pago, seria um registro que discorda de si mesmo */
  constraint lancamento_pago_tem_data check ((pago and pago_em is not null) or (not pago and pago_em is null))
);

comment on table public.lancamento_de_transporte is
  'O pagamento de uma corrida: quem levou, para que, quanto custou e se ja foi pago. Nao se apaga.';

create index if not exists lancamento_por_dia
  on public.lancamento_de_transporte (quando desc);
create index if not exists lancamento_por_transportador
  on public.lancamento_de_transporte (transportador_id, quando desc);
create index if not exists lancamento_em_aberto
  on public.lancamento_de_transporte (transportador_id) where not pago;
create index if not exists lancamento_por_pedido
  on public.lancamento_de_transporte (pedido_id) where pedido_id is not null;

drop trigger if exists lancamento_de_transporte_carimbo on public.lancamento_de_transporte;
create trigger lancamento_de_transporte_carimbo
  before update on public.lancamento_de_transporte
  for each row execute function public.carimbar_atualizacao();

alter table public.lancamento_de_transporte enable row level security;
drop policy if exists "quem ve o transporte le os lancamentos" on public.lancamento_de_transporte;
create policy "quem ve o transporte le os lancamentos"
  on public.lancamento_de_transporte for select to authenticated
  using (public.posso('transporte', 'ver'));
/* so leitura: quem grava sao lancar_transporte e acertar_transporte */
grant select on public.lancamento_de_transporte to authenticated;


-- ---------- 4. as views que a tela le --------------------------------------
create or replace view public.transportador_na_lista
with (security_invoker = true) as
select t.id,
       t.nome,
       t.meio,
       f.cnpj,
       f.situacao as situacao_do_cnpj,
       t.fornecedor_id,
       t.contato,
       t.onde_atende,
       t.prazo,
       t.observacao,
       t.criado_em
  from public.transportador t
  left join public.fornecedor f on f.id = t.fornecedor_id
 where t.ativo;

grant select on public.transportador_na_lista to authenticated;

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
       l.teste
  from public.lancamento_de_transporte l
  join public.transportador t on t.id = l.transportador_id
  left join public.pedido p   on p.id = l.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id = p.cotacao_id
  left join public.fornecedor f on f.id = l.fornecedor_id
  left join public.equipe e   on e.id = l.quem;

grant select on public.lancamento_de_transporte_na_lista to authenticated;


-- ---------- 5. as funcoes --------------------------------------------------

/* SALVAR O CADASTRO de quem transporta, novo ou existente.

   Quando vem CNPJ, e so transportadora tem, ele vai para a tabela fornecedor:
   acha a linha que ja tem aquele CNPJ, ou cria uma, e marca como frete. A
   linha nasce "novo", nunca confiavel: quem poe CNPJ na lista de confiaveis e
   o administrador, pela regra da 041, e o gatilho de la continua cobrando
   isso mesmo passando por aqui.

   CNPJ em branco nao mexe no que ja esta ligado. Tirar um CNPJ da lista de
   fornecedores e assunto do administrador, e nao de um campo vazio. */
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
  if p_meio not in ('motoboy', 'uber', 'taxi', 'transportadora') then
    raise exception 'Meio de transporte desconhecido.' using errcode = '22023';
  end if;
  if p_meio <> 'transportadora' then
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
      /* o CNPJ ja e de alguem da lista: e a essa linha que o cadastro se liga */
      f := outro;
    elsif f is null then
      insert into public.fornecedor (nome, cnpj, cidade, o_que_fornece, entrou_por)
      values (public.nome_livre_de_fornecedor(t.nome, limpo), limpo, t.onde_atende, 'Transporte', 'entrega')
      returning id into f;
    else
      /* trocar o CNPJ de um confiavel so o administrador: o gatilho da 041
         levanta o erro, e ele sobe ate a tela como veio */
      update public.fornecedor set cnpj = limpo where id = f;
    end if;
    insert into public.fornecedor_tipo (fornecedor_id, tipo) values (f, 'frete')
    on conflict do nothing;
    update public.transportador set fornecedor_id = f
     where id = t.id and fornecedor_id is distinct from f;
  end if;

  return t.id;
end $$;

grant execute on function public.salvar_transportador(uuid, text, text, text, text, text, text, text)
  to authenticated;

/* LANCAR UMA CORRIDA, ou corrigir uma que ja existe (p_id).

   O pedido chega pelo NUMERO, que e o que a pessoa escolhe na folha, e a
   funcao acha o id. Numero que nao existe e erro, e nao lancamento sem
   pedido: gasto que some da conta do pedido por erro de digitacao e o tipo de
   furo que so aparece no fim do mes.

   Quem lancou e carimbado aqui e nao muda na correcao. */
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
language plpgsql
security definer
set search_path = public
as $$
declare
  novo   uuid;
  pedido uuid;
  atual  public.lancamento_de_transporte;
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
  if coalesce(p_valor, 0) <= 0 then
    raise exception 'O valor precisa ser maior que zero.' using errcode = '23514';
  end if;

  if p_motivo = 'entrega' and nullif(btrim(coalesce(p_pedido, '')), '') is not null then
    select id into pedido from public.pedido where numero = btrim(p_pedido);
    if not found then
      raise exception 'Não encontrei o pedido %.', btrim(p_pedido) using errcode = 'P0002';
    end if;
  end if;
  if p_motivo = 'busca' and p_fornecedor is not null
     and not exists (select 1 from public.fornecedor where id = p_fornecedor) then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
  end if;

  if p_id is null then
    insert into public.lancamento_de_transporte
      (quando, transportador_id, motivo, pedido_id, fornecedor_id, destino, valor, forma,
       pago, pago_em, pago_por, quem, quem_nome, observacao)
    values
      (coalesce(p_quando, now()), p_transportador, p_motivo, pedido,
       case when p_motivo = 'busca' then p_fornecedor end,
       btrim(coalesce(p_destino, '')), p_valor, p_forma,
       coalesce(p_pago, false),
       case when coalesce(p_pago, false) then now() end,
       case when coalesce(p_pago, false) then auth.uid() end,
       auth.uid(),
       coalesce((select nome from public.pessoa where id = auth.uid()), ''),
       btrim(coalesce(p_observacao, '')))
    returning id into novo;
    return novo;
  end if;

  select * into atual from public.lancamento_de_transporte where id = p_id for update;
  if not found then
    raise exception 'Não encontrei este lançamento.' using errcode = 'P0002';
  end if;
  update public.lancamento_de_transporte
     set quando = coalesce(p_quando, atual.quando),
         transportador_id = p_transportador,
         motivo = p_motivo,
         pedido_id = pedido,
         fornecedor_id = case when p_motivo = 'busca' then p_fornecedor end,
         destino = btrim(coalesce(p_destino, '')),
         valor = p_valor,
         forma = p_forma,
         observacao = btrim(coalesce(p_observacao, '')),
         pago = coalesce(p_pago, false),
         /* a data do pagamento so anda quando a situacao muda */
         pago_em = case when not coalesce(p_pago, false) then null
                        when atual.pago then atual.pago_em
                        else now() end,
         pago_por = case when not coalesce(p_pago, false) then null
                         when atual.pago then atual.pago_por
                         else auth.uid() end
   where id = p_id;
  return p_id;
end $$;

grant execute on function public.lancar_transporte(
  uuid, timestamptz, uuid, text, text, uuid, text, numeric, text, boolean, text) to authenticated;

/* ACERTAR: marcar como pagos, de uma vez, os lancamentos abertos escolhidos.
   E o que se faz com o motoboy no fim da semana. Devolve quantos acertou; o
   que ja estava pago fica como estava, com a data antiga. */
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
   where id = any (coalesce(p_lancamentos, array[]::uuid[])) and not pago;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.acertar_transporte(uuid[]) to authenticated;


-- ---------- 6. o que ja existia passa para ca ------------------------------
/* Todo fornecedor marcado como frete vira cadastro de transportadora, ligado
   a propria linha. Sao os quatro que a 041 semeou e qualquer outro que alguem
   tenha criado desde entao. A linha de fornecedor fica: a pagina de
   Fornecedores so deixa de mostra-la. */
insert into public.transportador (nome, meio, fornecedor_id, onde_atende, prazo, observacao, criado_por)
select f.nome,
       'transportadora',
       f.id,
       f.cidade,
       case when f.o_que_fornece ~ 'dias' then btrim(split_part(f.o_que_fornece, ',', 2)) else '' end,
       case when f.o_que_fornece ~ 'dias' or position(',' in f.o_que_fornece) = 0 then ''
            else btrim(split_part(f.o_que_fornece, ',', 2)) end,
       null
  from public.fornecedor f
 where exists (select 1 from public.fornecedor_tipo ft where ft.fornecedor_id = f.id and ft.tipo = 'frete')
   and not exists (select 1 from public.transportador t
                    where t.fornecedor_id = f.id or lower(t.nome) = lower(f.nome));

update public.transportador set prazo = '2 a 8 dias úteis'
 where lower(nome) = 'correios' and prazo = '';

/* O motoboy que a tela de entrega do cliente ja sugeria, o Uber e o taxi,
   para a folha de lancar funcionar no primeiro dia. Os motoboys de verdade,
   com nome, quem cadastra e a fabrica. */
insert into public.transportador (nome, meio, onde_atende, prazo, criado_por)
select s.nome, s.meio, s.onde, s.prazo, null
  from (values
    ('Motoboy Fourtime', 'motoboy', 'Goiânia e Aparecida de Goiânia', 'mesmo dia'),
    ('Uber',             'uber',    '',                               ''),
    ('Táxi',             'taxi',    '',                               '')
  ) as s(nome, meio, onde, prazo)
 where not exists (select 1 from public.transportador t where lower(t.nome) = lower(s.nome));


-- ---------- 7. a prova -----------------------------------------------------
do $$
declare
  n int;
  sobrou int;
begin
  if not exists (select 1 from public.painel where chave = 'transporte') then
    raise exception 'o painel transporte nao entrou';
  end if;
  if not exists (select 1 from public.permissao where papel = 'admin' and painel = 'transporte' and total) then
    raise exception 'o admin ficou sem a pagina de transporte';
  end if;

  /* nenhum fornecedor de frete pode ter ficado sem cadastro em transporte */
  select count(*) into sobrou
    from public.fornecedor f
   where exists (select 1 from public.fornecedor_tipo ft where ft.fornecedor_id = f.id and ft.tipo = 'frete')
     and not exists (select 1 from public.transportador t
                      where t.fornecedor_id = f.id or lower(t.nome) = lower(f.nome));
  if sobrou > 0 then
    raise exception '% fornecedor(es) de frete ficaram sem cadastro em transporte', sobrou;
  end if;

  select count(*) into n from public.transportador;
  raise notice '042 pronta: % cadastros em transporte (% transportadoras, % motoboys), % lancamentos',
    n,
    (select count(*) from public.transportador where meio = 'transportadora'),
    (select count(*) from public.transportador where meio = 'motoboy'),
    (select count(*) from public.lancamento_de_transporte);
end $$;
