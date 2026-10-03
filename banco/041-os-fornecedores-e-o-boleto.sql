-- ===========================================================================
-- 041: OS FORNECEDORES E O BOLETO
--
-- Ate aqui o fornecedor era um texto na observacao do movimento: "NF 4471,
-- Malharia tal". Texto nao agrupa, nao responde "de quem eu compro este
-- tecido" e nao diz se um boleto que chegou hoje e de alguem que a Fourtime
-- conhece.
--
-- O QUE ENTRA:
--   1. o tipo de fornecedor (tecido, aviamento, insumo, frete, servico)
--   2. o fornecedor, com a situacao dele: novo, esperando, confiavel, bloqueado
--   3. a ligacao do fornecedor com o tipo e com o material do estoque
--   4. o grupo e o lugar do material, e o fornecedor no movimento
--   5. a conferencia de boleto: o que foi lido e o que foi decidido
--
-- O ARQUIVO DO BOLETO NAO ENTRA EM LUGAR NENHUM. O PDF e lido no navegador de
-- quem confere e morre ali. O que o banco guarda e o que estava escrito nele
-- e o resultado da conferencia.
--
-- CONFIAVEL E BLOQUEADO SAO DO ADMINISTRADOR. A lista de fornecedores
-- confiaveis e a trava contra boleto falso: se qualquer pessoa pudesse por um
-- CNPJ nela, a trava seria um formulario. Quem edita o estoque cria e arruma
-- fornecedor; marcar como confiavel, bloquear, desbloquear e trocar o CNPJ de
-- um confiavel so o admin, e quem cobra isso e um gatilho, e nao a tela.
--
-- NADA DO QUE JA FUNCIONA MUDA DE NOME. As duas views do estoque ganham
-- coluna NO FIM (create or replace), entao os grants ficam e a tela antiga
-- continua lendo. A funcao mexer_no_estoque ganha um sexto argumento com
-- padrao nulo, e quem chama com cinco continua chamando.
-- ===========================================================================


-- ---------- 1. o tipo de fornecedor ----------------------------------------
create table if not exists public.tipo_de_fornecedor (
  chave text primary key,
  nome  text not null,
  ordem int  not null default 100,
  -- os cinco de nascenca nao se apagam: tres deles sao as categorias do
  -- estoque, e apagar um deixaria material sem familia de fornecedor
  fixo  boolean not null default false,
  constraint tipo_de_fornecedor_chave_limpa check (chave ~ '^[a-z0-9_]+$'),
  constraint tipo_de_fornecedor_nome_nao_vazio check (btrim(nome) <> '')
);

comment on table public.tipo_de_fornecedor is
  'As familias de fornecedor. Tecido, aviamento e insumo tem a mesma chave da categoria do material.';

insert into public.tipo_de_fornecedor (chave, nome, ordem, fixo) values
  ('tecido',    'Tecido',    10, true),
  ('aviamento', 'Aviamento', 20, true),
  ('insumo',    'Insumo',    30, true),
  ('frete',     'Frete',     40, true),
  ('servico',   'Serviço',   50, true)
on conflict (chave) do nothing;

alter table public.tipo_de_fornecedor enable row level security;
drop policy if exists "quem foi aprovado le o tipo de fornecedor" on public.tipo_de_fornecedor;
drop policy if exists "quem edita o estoque mexe no tipo de fornecedor" on public.tipo_de_fornecedor;
create policy "quem foi aprovado le o tipo de fornecedor"
  on public.tipo_de_fornecedor for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem edita o estoque mexe no tipo de fornecedor"
  on public.tipo_de_fornecedor for all to authenticated
  using (public.posso('estoque', 'editar') and not fixo)
  with check (public.posso('estoque', 'editar') and not fixo);
grant select, insert, update, delete on public.tipo_de_fornecedor to authenticated;


-- ---------- 2. o fornecedor ------------------------------------------------
create table if not exists public.fornecedor (
  id            uuid primary key default gen_random_uuid(),
  -- o nome do dia a dia, que e o que a fabrica fala; a razao social e a do CNPJ
  nome          text not null,
  razao_social  text not null default '',
  -- so os 14 caracteres, sem ponto nem barra. Letra maiuscula entra porque o
  -- CNPJ novo, de julho de 2026 em diante, tem letra nas doze primeiras casas.
  cnpj          text,
  cidade        text not null default '',
  uf            text not null default '',
  contato       text not null default '',
  pagamento     text not null default '',
  prazo         text not null default '',
  -- o que ele fornece quando nao e material do estoque: frete, faccao, servico
  o_que_fornece text not null default '',
  situacao      text not null default 'novo',
  entrou_por    text not null default 'cadastro',
  -- o que a Receita respondeu no dia da consulta: situacao, abertura, atividade
  receita       jsonb,
  aprovado_por  uuid references public.pessoa (id) on delete set null,
  aprovado_em   timestamptz,
  motivo_do_bloqueio text not null default '',
  ativo         boolean not null default true,
  teste         boolean not null default false,
  criado_por    uuid default auth.uid() references public.pessoa (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint fornecedor_nome_nao_vazio check (btrim(nome) <> ''),
  constraint fornecedor_situacao_conhecida
    check (situacao in ('novo', 'esperando', 'confiavel', 'bloqueado')),
  constraint fornecedor_entrada_conhecida
    check (entrou_por in ('cadastro', 'estoque', 'entrega', 'boleto')),
  constraint fornecedor_cnpj_no_formato
    check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

comment on table public.fornecedor is
  'De quem a Fourtime compra. A situacao confiavel e a lista que o Verificador de Boleto consulta.';

/* um CNPJ e um fornecedor so. Dois cadastros do mesmo CNPJ seriam duas
   situacoes para a mesma empresa, e o boleto leria a que achasse primeiro. */
create unique index if not exists fornecedor_cnpj_unico
  on public.fornecedor (cnpj) where cnpj is not null;
create unique index if not exists fornecedor_nome_unico
  on public.fornecedor (lower(nome));
create index if not exists fornecedor_por_situacao on public.fornecedor (situacao);

drop trigger if exists fornecedor_carimbo on public.fornecedor;
create trigger fornecedor_carimbo
  before update on public.fornecedor
  for each row execute function public.carimbar_atualizacao();

/* A TRAVA DO CONFIAVEL. Roda para todo insert e update, venha de onde vier.
   auth.uid() nulo e o SQL Editor, que e o proprio dono do banco. */
create or replace function public.guardar_o_fornecedor()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admin boolean := auth.uid() is null or public.sou_admin();
begin
  if tg_op = 'INSERT' then
    if new.situacao in ('confiavel', 'bloqueado') and not admin then
      raise exception 'Só o administrador marca um fornecedor como confiável ou bloqueado.'
        using errcode = '42501';
    end if;
  else
    if new.situacao is distinct from old.situacao
       and (new.situacao in ('confiavel', 'bloqueado') or old.situacao in ('confiavel', 'bloqueado'))
       and not admin then
      raise exception 'Só o administrador marca um fornecedor como confiável ou bloqueado.'
        using errcode = '42501';
    end if;
    /* trocar o CNPJ de um confiavel seria o atalho para por outro CNPJ na
       lista sem passar pela aprovacao */
    if new.cnpj is distinct from old.cnpj and old.situacao = 'confiavel' and not admin then
      raise exception 'Só o administrador troca o CNPJ de um fornecedor confiável.'
        using errcode = '42501';
    end if;
  end if;

  if new.situacao = 'confiavel' and (tg_op = 'INSERT' or old.situacao <> 'confiavel') then
    new.aprovado_por := coalesce(auth.uid(), new.aprovado_por);
    new.aprovado_em  := now();
  end if;
  if new.situacao <> 'bloqueado' then
    new.motivo_do_bloqueio := '';
  end if;
  return new;
end $$;

drop trigger if exists fornecedor_guarda on public.fornecedor;
create trigger fornecedor_guarda
  before insert or update on public.fornecedor
  for each row execute function public.guardar_o_fornecedor();

alter table public.fornecedor enable row level security;
drop policy if exists "quem foi aprovado le o fornecedor" on public.fornecedor;
drop policy if exists "quem edita o estoque cria fornecedor" on public.fornecedor;
drop policy if exists "quem edita o estoque arruma fornecedor" on public.fornecedor;
drop policy if exists "quem apaga no estoque apaga fornecedor" on public.fornecedor;
create policy "quem foi aprovado le o fornecedor"
  on public.fornecedor for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem edita o estoque cria fornecedor"
  on public.fornecedor for insert to authenticated
  with check (public.posso('estoque', 'editar'));
create policy "quem edita o estoque arruma fornecedor"
  on public.fornecedor for update to authenticated
  using (public.posso('estoque', 'editar'))
  with check (public.posso('estoque', 'editar'));
create policy "quem apaga no estoque apaga fornecedor"
  on public.fornecedor for delete to authenticated
  using (public.posso('estoque', 'deletar'));
grant select, insert, update, delete on public.fornecedor to authenticated;


-- ---------- 3. as ligacoes -------------------------------------------------
create table if not exists public.fornecedor_tipo (
  fornecedor_id uuid not null references public.fornecedor (id) on delete cascade,
  tipo          text not null references public.tipo_de_fornecedor (chave)
                  on delete cascade on update cascade,
  primary key (fornecedor_id, tipo)
);

create table if not exists public.material_fornecedor (
  material_id   uuid not null references public.material (id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedor (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (material_id, fornecedor_id)
);
create index if not exists material_fornecedor_por_fornecedor
  on public.material_fornecedor (fornecedor_id);

alter table public.fornecedor_tipo enable row level security;
alter table public.material_fornecedor enable row level security;
drop policy if exists "quem foi aprovado le o tipo do fornecedor" on public.fornecedor_tipo;
drop policy if exists "quem edita o estoque mexe no tipo do fornecedor" on public.fornecedor_tipo;
drop policy if exists "quem foi aprovado le o fornecedor do material" on public.material_fornecedor;
drop policy if exists "quem edita o estoque liga fornecedor e material" on public.material_fornecedor;
create policy "quem foi aprovado le o tipo do fornecedor"
  on public.fornecedor_tipo for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem edita o estoque mexe no tipo do fornecedor"
  on public.fornecedor_tipo for all to authenticated
  using (public.posso('estoque', 'editar'))
  with check (public.posso('estoque', 'editar'));
create policy "quem foi aprovado le o fornecedor do material"
  on public.material_fornecedor for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem edita o estoque liga fornecedor e material"
  on public.material_fornecedor for all to authenticated
  using (public.posso('estoque', 'editar'))
  with check (public.posso('estoque', 'editar'));
grant select, insert, update, delete on public.fornecedor_tipo to authenticated;
grant select, insert, update, delete on public.material_fornecedor to authenticated;


-- ---------- 4. o material ganha grupo e lugar ------------------------------
-- O GRUPO e o que junta "Linha poliester 120 branca" e "Linha poliester 120
-- preta" numa linha so da lista, do mesmo jeito que a malha junta as cores do
-- tecido. Tecido nao usa: o grupo dele e a propria malha do catalogo.
alter table public.material add column if not exists grupo     text not null default '';
alter table public.material add column if not exists onde_fica text not null default '';

/* O primeiro palpite de grupo sai do nome, e so para quem ainda esta sem
   grupo. Quem nao casar com nada fica vazio e a tela mostra em "Sem grupo",
   que e melhor que um grupo inventado. */
update public.material
   set grupo = case
         when categoria = 'aviamento' and nome ilike 'linha%'    then 'Linha'
         when categoria = 'aviamento' and (nome ilike 'elástico%' or nome ilike 'elastico%'
                                           or nome ilike 'cadarço%' or nome ilike 'cadarco%')
                                                                  then 'Elástico e cadarço'
         when categoria = 'aviamento' and (nome ilike 'botão%' or nome ilike 'botao%')
                                                                  then 'Botão'
         when categoria = 'aviamento' and nome ilike 'etiqueta%' then 'Etiqueta'
         when categoria = 'aviamento' and (nome ilike 'gola%' or nome ilike 'punho%'
                                           or nome ilike 'ribana%') then 'Gola'
         when categoria = 'aviamento' and (nome ilike 'zíper%' or nome ilike 'ziper%')
                                                                  then 'Zíper'
         when categoria = 'insumo' and nome ilike '%dtf%'         then 'DTF'
         when categoria = 'insumo' and nome ilike '%sublim%'      then 'Sublimação'
         when categoria = 'insumo' and (nome ilike '%silk%' or nome ilike '%plastisol%'
                                        or nome ilike '%serigraf%') then 'Silk'
         when categoria = 'insumo' and (nome ilike 'saco%' or nome ilike 'caixa%'
                                        or nome ilike '%embalagem%' or nome ilike 'fita%')
                                                                  then 'Embalagem'
         else ''
       end
 where grupo = '' and categoria <> 'tecido';

create index if not exists material_por_grupo on public.material (categoria, grupo);


-- ---------- 5. o movimento diz de quem veio --------------------------------
alter table public.movimento_de_estoque
  add column if not exists fornecedor_id uuid references public.fornecedor (id) on delete set null;
create index if not exists movimento_por_fornecedor
  on public.movimento_de_estoque (fornecedor_id, quando desc)
  where fornecedor_id is not null;

/* A FUNCAO ANTIGA SAI E A NOVA ENTRA NO MESMO GOLPE. Com as duas vivas o
   PostgREST nao saberia qual chamar quando a tela manda cinco argumentos, e a
   resposta dele para a duvida e um erro. A nova aceita os mesmos cinco. */
drop function if exists public.mexer_no_estoque(uuid, numeric, text, text, uuid);

create or replace function public.mexer_no_estoque(
  p_material   uuid,
  p_quantidade numeric,
  p_motivo     text,
  p_observacao text default '',
  p_pedido     uuid default null,
  p_fornecedor uuid default null
) returns public.material
language plpgsql
security definer
set search_path = public
as $$
declare
  fim public.material;
  dele text;
begin
  if not public.posso_a_acao('estoque.mexer') then
    raise exception 'Seu acesso não permite mexer no estoque.' using errcode = '42501';
  end if;
  if p_quantidade = 0 then
    raise exception 'Movimento de zero não diz nada.' using errcode = '23514';
  end if;

  if p_fornecedor is not null then
    select situacao into dele from public.fornecedor where id = p_fornecedor;
    if not found then
      raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
    end if;
    if dele = 'bloqueado' then
      raise exception 'Este fornecedor está bloqueado.' using errcode = '23514';
    end if;
  end if;

  insert into public.movimento_de_estoque
    (material_id, quantidade, motivo, observacao, pedido_id, quem, fornecedor_id)
  values (p_material, p_quantidade, p_motivo, coalesce(p_observacao,''), p_pedido, auth.uid(),
          p_fornecedor);

  select * into fim from public.material where id = p_material;
  if not found then
    raise exception 'Material não encontrado.' using errcode = 'P0002';
  end if;

  /* quem entregou uma vez passa a ser fornecedor deste material */
  if p_fornecedor is not null then
    insert into public.material_fornecedor (material_id, fornecedor_id)
    values (p_material, p_fornecedor)
    on conflict do nothing;
  end if;
  return fim;
end $$;

grant execute on function public.mexer_no_estoque(uuid, numeric, text, text, uuid, uuid)
  to authenticated;


-- ---------- 6. as views do estoque, com coluna nova NO FIM -----------------
-- create or replace, e nao drop: o grant fica, e quem ja le continua lendo.
-- As primeiras colunas sao exatamente as da 026 e da 025, na mesma ordem.
create or replace view public.material_na_prateleira
with (security_invoker = true) as
select m.id,
       m.categoria,
       m.nome,
       m.unidade,
       m.minimo,
       m.saldo,
       coalesce(r.reservado, 0)           as reservado,
       m.saldo - coalesce(r.reservado, 0) as livre,
       coalesce(r.pedidos, 0)             as pedidos_reservando,
       coalesce(r.em_aberto, false)       as reserva_sem_consumo,
       m.ativo,
       m.tecido_id,
       m.cor_id,
       t.nome as tecido,
       c.nome as cor,
       c.hex  as cor_hex,
       (m.saldo - coalesce(r.reservado, 0) < m.minimo) as abaixo_do_minimo,
       m.atualizado_em,
       (select max(v.quando) from public.movimento_de_estoque v
         where v.material_id = m.id) as ultimo_movimento,
       m.grupo,
       m.onde_fica,
       m.criado_em
  from public.material m
  left join public.tecido t        on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join lateral (
    select sum(x.quantidade)          as reservado,
           count(*)                   as pedidos,
           bool_or(x.sem_consumo)     as em_aberto
      from public.reserva x
     where x.material_id = m.id and not x.baixada
  ) r on true
 where m.ativo;

grant select on public.material_na_prateleira to authenticated;

create or replace view public.movimento_do_estoque
with (security_invoker = true) as
select v.id,
       v.material_id,
       m.nome     as material,
       m.unidade,
       m.categoria,
       v.quantidade,
       v.motivo,
       v.observacao,
       v.pedido_id,
       p.numero   as pedido,
       v.quem,
       q.nome     as quem_nome,
       v.quando,
       v.fornecedor_id,
       f.nome     as fornecedor,
       m.tecido_id,
       m.grupo,
       t.nome     as tecido,
       c.nome     as cor,
       c.hex      as cor_hex,
       e.nome     as quem_na_equipe
  from public.movimento_de_estoque v
  join public.material m on m.id = v.material_id
  left join public.pedido p on p.id = v.pedido_id
  left join public.pessoa q on q.id = v.quem
  left join public.fornecedor f on f.id = v.fornecedor_id
  left join public.tecido t on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join public.equipe e on e.id = v.quem;

grant select on public.movimento_do_estoque to authenticated;

/* O que os pedidos ainda seguram, com a data que a tela mostra ao lado. */
create or replace view public.reserva_em_aberto
with (security_invoker = true) as
select r.id,
       r.pedido_id,
       p.numero        as pedido,
       p.data_de_envio as entrega,
       r.material_id,
       r.quantidade,
       r.unidade,
       r.pecas,
       r.sem_consumo
  from public.reserva r
  join public.pedido p on p.id = r.pedido_id
 where not r.baixada;

grant select on public.reserva_em_aberto to authenticated;


-- ---------- 7. a conferencia de boleto -------------------------------------
create table if not exists public.conferencia_de_boleto (
  id            uuid primary key default gen_random_uuid(),
  quando        timestamptz not null default now(),
  quem          uuid references public.pessoa (id) on delete set null,
  quem_nome     text not null default '',
  -- a linha digitavel, so os numeros. E por ela que se acha o boleto repetido.
  linha         text not null,
  -- so o NOME do arquivo. O arquivo nao sobe para lugar nenhum.
  arquivo       text not null default '',
  banco         text not null default '',
  banco_nome    text not null default '',
  valor         numeric(14,2),
  vencimento    date,
  beneficiario  text not null default '',
  cnpj          text,
  pagador       text not null default '',
  pagador_documento text not null default '',
  resultado     text not null,
  situacao      text not null default 'conferido',
  -- as oito conferencias, cada uma com o estado e a frase que a tela mostrou
  checagens     jsonb not null default '[]'::jsonb,
  -- o que quem conferiu escreveu ao pedir a aprovacao
  motivo        text not null default '',
  fornecedor_id uuid references public.fornecedor (id) on delete set null,
  decidido_por  uuid references public.pessoa (id) on delete set null,
  decidido_por_nome text not null default '',
  decidido_em   timestamptz,
  nota_da_decisao text not null default '',
  teste         boolean not null default false,

  constraint conferencia_linha_so_numero check (linha ~ '^[0-9]{44,48}$'),
  constraint conferencia_resultado_conhecido
    check (resultado in ('pode_pagar', 'precisa_aprovacao', 'nao_pague')),
  constraint conferencia_situacao_conhecida
    check (situacao in ('conferido', 'esperando', 'aprovado', 'recusado')),
  constraint conferencia_cnpj_no_formato
    check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')
);

comment on table public.conferencia_de_boleto is
  'O registro do Verificador de Boleto: o que o boleto dizia e o que foi decidido. Nunca o arquivo.';

create index if not exists conferencia_por_dia on public.conferencia_de_boleto (quando desc);
create index if not exists conferencia_por_linha on public.conferencia_de_boleto (linha);
create index if not exists conferencia_por_cnpj on public.conferencia_de_boleto (cnpj, quando desc);
create index if not exists conferencia_esperando on public.conferencia_de_boleto (quando)
  where situacao = 'esperando';

/* um nome que ainda nao exista na lista. O nome do fornecedor e unico, e o
   beneficiario de um boleto pode ter o mesmo nome de alguem ja cadastrado
   com outro CNPJ. */
create or replace function public.nome_livre_de_fornecedor(p_nome text, p_cnpj text)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when exists (select 1 from public.fornecedor f where lower(f.nome) = lower(btrim(p_nome)))
             then btrim(p_nome) || ' · ' || right(coalesce(p_cnpj, ''), 6)
           else btrim(p_nome)
         end
$$;

/* O CARIMBO E O JUIZO DO BANCO. Quem insere nao escolhe quem conferiu nem
   quando, e nao consegue registrar "pode pagar" para quem o banco sabe que
   nao e confiavel. A conta dos digitos e da tela; a lista e do banco.

   TODA CONFERENCIA NASCE "conferido". Pedir aprovacao e um segundo passo, com
   funcao propria, para que o boleto amarelo fique no registro mesmo quando
   quem conferiu desistiu de pedir. */
create or replace function public.carimbar_a_conferencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fornecedor;
begin
  new.quem      := auth.uid();
  new.quem_nome := coalesce((select nome from public.pessoa where id = auth.uid()), '');
  new.quando    := now();
  new.situacao  := 'conferido';
  new.motivo    := '';
  new.decidido_por := null;
  new.decidido_por_nome := '';
  new.decidido_em := null;
  new.nota_da_decisao := '';
  new.fornecedor_id := null;

  if new.cnpj is not null then
    select * into f from public.fornecedor where cnpj = new.cnpj;
    if found then
      new.fornecedor_id := f.id;
      if f.situacao = 'bloqueado' then
        new.resultado := 'nao_pague';
      elsif f.situacao <> 'confiavel' and new.resultado = 'pode_pagar' then
        new.resultado := 'precisa_aprovacao';
      end if;
    elsif new.resultado = 'pode_pagar' then
      new.resultado := 'precisa_aprovacao';
    end if;
  elsif new.resultado = 'pode_pagar' then
    new.resultado := 'precisa_aprovacao';
  end if;
  return new;
end $$;

drop trigger if exists conferencia_carimbo on public.conferencia_de_boleto;
create trigger conferencia_carimbo
  before insert on public.conferencia_de_boleto
  for each row execute function public.carimbar_a_conferencia();

alter table public.conferencia_de_boleto enable row level security;
drop policy if exists "quem foi aprovado le as conferencias" on public.conferencia_de_boleto;
drop policy if exists "quem foi aprovado registra conferencia" on public.conferencia_de_boleto;
create policy "quem foi aprovado le as conferencias"
  on public.conferencia_de_boleto for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem foi aprovado registra conferencia"
  on public.conferencia_de_boleto for insert to authenticated
  with check (public.meu_papel() is not null);
/* update e delete NAO tem policy nem grant de proposito: a decisao passa por
   decidir_o_boleto, e registro de conferencia que se edita nao e registro. */
grant select, insert on public.conferencia_de_boleto to authenticated;

/* PEDIR A APROVACAO. Poe o boleto amarelo na fila do administrador e, junto,
   o fornecedor: cria quem ainda nao existe e marca como esperando quem era
   novo. Qualquer pessoa aprovada pede; decidir e outra funcao. */
create or replace function public.pedir_aprovacao_do_boleto(
  p_conferencia uuid,
  p_motivo      text default ''
) returns public.conferencia_de_boleto
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conferencia_de_boleto;
  f uuid;
begin
  if public.meu_papel() is null then
    raise exception 'Seu acesso não permite pedir aprovação.' using errcode = '42501';
  end if;
  select * into c from public.conferencia_de_boleto where id = p_conferencia for update;
  if not found then
    raise exception 'Não encontrei esta conferência.' using errcode = 'P0002';
  end if;
  if c.resultado <> 'precisa_aprovacao' then
    raise exception 'Este boleto não precisa de aprovação.' using errcode = '23514';
  end if;
  if c.situacao <> 'conferido' then
    raise exception 'A aprovação deste boleto já foi pedida.' using errcode = '23514';
  end if;

  f := c.fornecedor_id;
  if c.cnpj is not null then
    if f is null then
      select id into f from public.fornecedor where cnpj = c.cnpj;
    end if;
    if f is null then
      insert into public.fornecedor (nome, razao_social, cnpj, situacao, entrou_por)
      values (public.nome_livre_de_fornecedor(c.beneficiario, c.cnpj),
              btrim(c.beneficiario), c.cnpj, 'esperando', 'boleto')
      returning id into f;
    else
      update public.fornecedor set situacao = 'esperando' where id = f and situacao = 'novo';
    end if;
  end if;

  update public.conferencia_de_boleto
     set situacao = 'esperando',
         motivo = coalesce(btrim(p_motivo), ''),
         fornecedor_id = f
   where id = p_conferencia
   returning * into c;
  return c;
end $$;

grant execute on function public.pedir_aprovacao_do_boleto(uuid, text) to authenticated;

create or replace function public.decidir_o_boleto(
  p_conferencia uuid,
  p_decisao     text,
  p_nota        text default ''
) returns public.conferencia_de_boleto
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conferencia_de_boleto;
  f uuid;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador decide um boleto em espera.' using errcode = '42501';
  end if;
  if p_decisao not in ('aprovar', 'aprovar_e_listar', 'recusar') then
    raise exception 'Decisão desconhecida.' using errcode = '22023';
  end if;

  select * into c from public.conferencia_de_boleto where id = p_conferencia for update;
  if not found then
    raise exception 'Não encontrei esta conferência.' using errcode = 'P0002';
  end if;
  if c.situacao <> 'esperando' then
    raise exception 'Este boleto já foi decidido.' using errcode = '23514';
  end if;

  f := c.fornecedor_id;
  if f is null and c.cnpj is not null then
    select id into f from public.fornecedor where cnpj = c.cnpj;
  end if;

  if p_decisao = 'aprovar_e_listar' then
    if c.cnpj is null then
      raise exception 'Sem CNPJ não dá para pôr o fornecedor na lista.' using errcode = '23514';
    end if;
    if f is null then
      insert into public.fornecedor (nome, razao_social, cnpj, situacao, entrou_por)
      values (public.nome_livre_de_fornecedor(c.beneficiario, c.cnpj),
              btrim(c.beneficiario), c.cnpj, 'confiavel', 'boleto')
      returning id into f;
    else
      update public.fornecedor set situacao = 'confiavel'
       where id = f and situacao <> 'bloqueado';
    end if;
  elsif f is not null then
    /* aprovar so este boleto, ou recusar, tira o fornecedor da fila sem
       coloca-lo na lista: o proximo boleto dele pede aprovacao de novo */
    update public.fornecedor set situacao = 'novo' where id = f and situacao = 'esperando';
  end if;

  update public.conferencia_de_boleto
     set situacao = case when p_decisao = 'recusar' then 'recusado' else 'aprovado' end,
         decidido_por = auth.uid(),
         decidido_por_nome = coalesce((select nome from public.pessoa where id = auth.uid()), ''),
         decidido_em = now(),
         nota_da_decisao = coalesce(btrim(p_nota), ''),
         fornecedor_id = f
   where id = p_conferencia
   returning * into c;
  return c;
end $$;

grant execute on function public.decidir_o_boleto(uuid, text, text) to authenticated;


-- ---------- 8. juntar dois cadastros do mesmo fornecedor -------------------
-- Acontece: o estoque cria "Malharia Exemplo" sem CNPJ e o boleto cria
-- "MALHARIA EXEMPLO LTDA" com CNPJ. Juntar leva tudo de um para o outro e
-- apaga o que sobrou. So o admin, porque juntar um novo num confiavel e um
-- jeito de por material e historico na conta de quem ja foi aprovado.
create or replace function public.juntar_fornecedores(p_fica uuid, p_some uuid)
returns public.fornecedor
language plpgsql
security definer
set search_path = public
as $$
declare
  fica public.fornecedor;
  vai  public.fornecedor;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador junta fornecedores.' using errcode = '42501';
  end if;
  if p_fica = p_some then
    raise exception 'Escolha dois fornecedores diferentes.' using errcode = '23514';
  end if;
  select * into fica from public.fornecedor where id = p_fica for update;
  if not found then raise exception 'Fornecedor não encontrado.' using errcode = 'P0002'; end if;
  select * into vai from public.fornecedor where id = p_some for update;
  if not found then raise exception 'Fornecedor não encontrado.' using errcode = 'P0002'; end if;
  if fica.cnpj is not null and vai.cnpj is not null and fica.cnpj <> vai.cnpj then
    raise exception 'Os dois têm CNPJ, e são diferentes. Não são o mesmo fornecedor.'
      using errcode = '23514';
  end if;

  insert into public.fornecedor_tipo (fornecedor_id, tipo)
  select p_fica, t.tipo from public.fornecedor_tipo t where t.fornecedor_id = p_some
  on conflict do nothing;
  insert into public.material_fornecedor (material_id, fornecedor_id, criado_em)
  select m.material_id, p_fica, m.criado_em
    from public.material_fornecedor m where m.fornecedor_id = p_some
  on conflict do nothing;
  update public.movimento_de_estoque set fornecedor_id = p_fica where fornecedor_id = p_some;
  update public.conferencia_de_boleto set fornecedor_id = p_fica where fornecedor_id = p_some;

  delete from public.fornecedor where id = p_some;

  update public.fornecedor
     set cnpj          = coalesce(fica.cnpj, vai.cnpj),
         razao_social  = case when fica.razao_social = '' then vai.razao_social else fica.razao_social end,
         cidade        = case when fica.cidade = '' then vai.cidade else fica.cidade end,
         uf            = case when fica.uf = '' then vai.uf else fica.uf end,
         contato       = case when fica.contato = '' then vai.contato else fica.contato end,
         pagamento     = case when fica.pagamento = '' then vai.pagamento else fica.pagamento end,
         prazo         = case when fica.prazo = '' then vai.prazo else fica.prazo end,
         o_que_fornece = case when fica.o_que_fornece = '' then vai.o_que_fornece else fica.o_que_fornece end,
         receita       = coalesce(fica.receita, vai.receita)
   where id = p_fica
   returning * into fica;
  return fica;
end $$;

grant execute on function public.juntar_fornecedores(uuid, uuid) to authenticated;


-- ---------- 9. a lista que a tela le ---------------------------------------
create or replace view public.fornecedor_na_lista
with (security_invoker = true) as
select f.id,
       f.nome,
       f.razao_social,
       f.cnpj,
       f.cidade,
       f.uf,
       f.contato,
       f.pagamento,
       f.prazo,
       f.o_que_fornece,
       f.situacao,
       f.entrou_por,
       f.receita,
       f.aprovado_por,
       e.nome as aprovado_por_nome,
       f.aprovado_em,
       f.motivo_do_bloqueio,
       f.criado_em,
       coalesce((select array_agg(t.tipo order by tp.ordem, tp.nome)
                   from public.fornecedor_tipo t
                   join public.tipo_de_fornecedor tp on tp.chave = t.tipo
                  where t.fornecedor_id = f.id), '{}'::text[]) as tipos,
       (select count(*) from public.material_fornecedor mf
          join public.material m on m.id = mf.material_id and m.ativo
         where mf.fornecedor_id = f.id) as materiais,
       (select count(*) from public.movimento_de_estoque v
         where v.fornecedor_id = f.id) as entradas,
       (select max(v.quando) from public.movimento_de_estoque v
         where v.fornecedor_id = f.id) as ultima_entrada,
       (select count(*) from public.conferencia_de_boleto c
         where c.fornecedor_id = f.id) as boletos,
       (select max(c.quando) from public.conferencia_de_boleto c
         where c.fornecedor_id = f.id) as ultimo_boleto
  from public.fornecedor f
  left join public.equipe e on e.id = f.aprovado_por
 where f.ativo;

grant select on public.fornecedor_na_lista to authenticated;


-- ---------- 10. a semente --------------------------------------------------
-- As transportadoras que a tela de entrega ja conhece viram fornecedor de
-- frete. Entram como NOVO e sem CNPJ: quem tem o CNPJ certo e o financeiro,
-- e um CNPJ plausivel escrito aqui seria pior que o campo em branco.
insert into public.fornecedor (nome, o_que_fornece, cidade, entrou_por)
select s.nome, s.fornece, s.onde, 'entrega'
  from (values
    ('Correios',      'Entrega ao cliente, PAC e SEDEX',          'Brasil inteiro'),
    ('Jadlog',        'Entrega ao cliente, 1 a 3 dias úteis',     'GO e DF'),
    ('Braspress',     'Entrega ao cliente, 2 a 5 dias úteis',     'Capitais SP e GO'),
    ('Total Express', 'Entrega ao cliente, 1 a 4 dias úteis',     'Estado de São Paulo')
  ) as s(nome, fornece, onde)
 where not exists (select 1 from public.fornecedor f where lower(f.nome) = lower(s.nome));

insert into public.fornecedor_tipo (fornecedor_id, tipo)
select f.id, 'frete'
  from public.fornecedor f
 where f.entrou_por = 'entrega'
on conflict do nothing;


-- ---------- 11. a prova ----------------------------------------------------
do $$
declare
  n int;
  faltando text;
begin
  select string_agg(c, ', ') into faltando
    from unnest(array['grupo', 'onde_fica', 'criado_em']) as c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'material_na_prateleira' and column_name = c);
  if faltando is not null then
    raise exception 'a view material_na_prateleira ficou sem: %', faltando;
  end if;

  select string_agg(c, ', ') into faltando
    from unnest(array['fornecedor_id', 'fornecedor', 'cor_hex', 'quem_na_equipe']) as c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'movimento_do_estoque' and column_name = c);
  if faltando is not null then
    raise exception 'a view movimento_do_estoque ficou sem: %', faltando;
  end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'mexer_no_estoque';
  if n <> 1 then
    raise exception 'mexer_no_estoque deveria existir uma vez so, e existe % vezes', n;
  end if;

  select count(*) into n from public.tipo_de_fornecedor;
  raise notice '041 pronta: % tipos de fornecedor, % fornecedores de frete semeados, % materiais com grupo',
    n,
    (select count(*) from public.fornecedor where entrou_por = 'entrega'),
    (select count(*) from public.material where grupo <> '');
end $$;
