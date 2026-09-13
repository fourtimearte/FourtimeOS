-- ============================================================
-- Fourtime OS - 003 papeis, convite e aprovacao
-- ============================================================
-- O combinado:
--   1. o admin libera o e-mail da pessoa antes
--   2. a pessoa se cadastra sozinha com e-mail, senha e nome
--   3. enquanto o admin nao aprova, ela so enxerga o proprio perfil
--   4. ao aprovar, o admin escolhe o papel e pode ajustar painel por painel
--
-- Duas coisas que este arquivo NAO faz, e e importante nao se enganar:
-- esconder um item do menu nao e tranca, e a lista de paineis nao protege
-- dado nenhum sozinha. Quem tranca o dado e a regra de acesso das tabelas,
-- que olha o papel. A lista de paineis diz o que a pessoa VE; o papel diz o
-- que ela PODE. As duas andam juntas mas nao sao a mesma coisa.

-- ---------- os papeis novos ----------------------------------
-- Trocar os valores de um enum no lugar e chato porque a funcao meu_papel()
-- devolvia o proprio enum. Ela passa a devolver texto: assim o dia em que
-- entrar um papel novo, nenhuma policy precisa ser derrubada junto.

drop policy if exists "pessoa le o proprio cadastro, dono le todos" on public.pessoa;
drop policy if exists "so o dono mexe em pessoa" on public.pessoa;
drop policy if exists "todo mundo que entrou le cliente" on public.cliente;
drop policy if exists "dono e vendedor cadastram cliente" on public.cliente;
drop policy if exists "dono e vendedor editam cliente" on public.cliente;
drop policy if exists "so o dono apaga cliente" on public.cliente;

drop function if exists public.meu_papel();

alter table public.pessoa alter column papel drop default;
alter type public.papel rename to papel_antigo;

create type public.papel as enum
  ('admin', 'gerente', 'vendedor', 'producao', 'estoquista', 'analista');

alter table public.pessoa
  alter column papel type public.papel
  using (
    case papel::text
      when 'dono' then 'admin'
      else papel::text
    end
  )::public.papel;

alter table public.pessoa alter column papel set default 'producao';
drop type public.papel_antigo;

-- ---------- esperando, aprovado, bloqueado -------------------
create type public.situacao_da_pessoa as enum ('esperando', 'aprovado', 'bloqueado');

alter table public.pessoa
  add column situacao public.situacao_da_pessoa not null default 'esperando',
  add column paineis text[],
  add column aprovado_em timestamptz,
  add column aprovado_por uuid references auth.users (id) on delete set null;

comment on column public.pessoa.paineis is
  'Nulo significa: usa o padrao do papel. Lista significa: esta pessoa tem esta lista, e so ela.';

-- quem ja estava dentro continua dentro
update public.pessoa
   set situacao = 'aprovado', aprovado_em = now()
 where ativo;

alter table public.pessoa drop column ativo;

-- ---------- os paineis que existem ---------------------------
-- A lista mora aqui, e nao so no codigo da tela, porque a aprovacao grava
-- estes nomes no banco. Se os dois lados escrevessem a lista por conta
-- propria, um dia iam discordar em silencio.
create table public.painel (
  chave   text primary key,
  nome    text not null,
  grupo   text not null,
  ordem   int  not null
);

insert into public.painel (chave, nome, grupo, ordem) values
  ('inicio',     'Início',              'Vendas',    1),
  ('funil',      'Funil e WhatsApp',    'Vendas',    2),
  ('clientes',   'Clientes',            'Vendas',    3),
  ('cotacao',    'Cotação de venda',    'Vendas',    4),
  ('ficha',      'Ficha de produção',   'Produção',  5),
  ('kanban',     'Kanban de produção',  'Produção',  6),
  ('produtos',   'Fichas técnicas',     'Produção',  7),
  ('estoque',    'Estoque',             'Produção',  8),
  ('atividades', 'Painel de atividades','Gestão',    9),
  ('relatorio',  'Relatório mensal',    'Gestão',   10),
  ('banco',      'Banco de dados',      'Gestão',   11),
  ('config',     'Configurações',       'Gestão',   12),
  ('kit',        'Design System',       'Gestão',   13);

-- O padrao de cada papel. E so padrao: a coluna paineis da pessoa manda mais.
create or replace function public.paineis_do_papel(p public.papel)
returns text[]
language sql
immutable
as $$
  select case p
    when 'admin' then array[
      'inicio','funil','clientes','cotacao','ficha','kanban','produtos',
      'estoque','atividades','relatorio','banco','config','kit']
    when 'gerente' then array[
      'inicio','funil','clientes','cotacao','ficha','kanban','produtos',
      'estoque','atividades','relatorio','banco']
    when 'vendedor' then array[
      'inicio','funil','clientes','cotacao','atividades']
    when 'producao' then array[
      'inicio','ficha','kanban','produtos','atividades','banco']
    when 'estoquista' then array[
      'inicio','estoque','produtos','banco']
    when 'analista' then array[
      'inicio','atividades','relatorio']
  end
$$;

-- ---------- quem sou eu --------------------------------------
-- Continua security definer, e agora devolve texto. Sem o security definer a
-- policy da tabela pessoa consultaria a propria tabela pessoa e entraria em
-- recursao: ninguem leria nada.
create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel::text from public.pessoa
   where id = auth.uid() and situacao = 'aprovado'
$$;

create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.meu_papel() = 'admin' $$;

-- ---------- os e-mails liberados -----------------------------
create table public.convite (
  email      text primary key,
  papel      public.papel not null default 'producao',
  paineis    text[],
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  usado_em   timestamptz,

  constraint convite_email_minusculo check (email = lower(btrim(email))),
  constraint convite_email_com_arroba check (email like '%_@_%._%')
);

alter table public.convite enable row level security;

create policy "so o admin mexe em convite"
  on public.convite for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

-- ---------- a conta nova -------------------------------------
-- A trava de verdade esta aqui dentro, nao na tela: sem convite o insert em
-- auth.users e desfeito e a conta simplesmente nao nasce. Conferir na tela
-- antes e so gentileza com quem digitou o e-mail errado.
create or replace function public.ao_criar_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeira  boolean;
  endereco  text;
  convidado public.convite%rowtype;
begin
  endereco := lower(btrim(new.email));
  select not exists (select 1 from public.pessoa) into primeira;

  if primeira then
    insert into public.pessoa (id, nome, papel, situacao, aprovado_em)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(endereco, '@', 1)),
      'admin',
      'aprovado',
      now()
    )
    on conflict (id) do nothing;
    return new;
  end if;

  select * into convidado from public.convite where email = endereco;

  if not found then
    raise exception 'E-MAIL SEM CONVITE'
      using hint = 'Peça para o administrador liberar este e-mail antes de criar a conta.';
  end if;

  if convidado.usado_em is not null then
    raise exception 'CONVITE JA USADO'
      using hint = 'Já existe uma conta criada com este e-mail.';
  end if;

  insert into public.pessoa (id, nome, papel, paineis, situacao)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(endereco, '@', 1)),
    convidado.papel,
    convidado.paineis,
    'esperando'
  )
  on conflict (id) do nothing;

  update public.convite set usado_em = now() where email = endereco;

  return new;
end $$;

-- ---------- quem le e quem mexe ------------------------------
create policy "cada um le o proprio cadastro"
  on public.pessoa for select to authenticated
  using (id = auth.uid() or public.sou_admin());

/* A pessoa muda o proprio nome, e so o nome.

   A tentacao aqui e escrever uma policy de update que deixa a pessoa mexer na
   propria linha e conferir, no with check, que ela nao mudou o papel. Nao
   funciona: para comparar com o valor gravado a policy da tabela pessoa teria
   que consultar a tabela pessoa, e policy que consulta a propria tabela entra
   em recursao. Uma funcao resolve sem ambiguidade: ela toca uma coluna so, e
   nao existe caminho para tocar outra. */
create or replace function public.mudar_meu_nome(novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  limpo text := btrim(coalesce(novo, ''));
begin
  if limpo = '' then
    raise exception 'O nome não pode ficar em branco.';
  end if;
  if length(limpo) > 80 then
    raise exception 'O nome ficou comprido demais.';
  end if;
  update public.pessoa set nome = limpo where id = auth.uid();
end $$;

create policy "o admin mexe em qualquer pessoa"
  on public.pessoa for update to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

create policy "o admin apaga pessoa"
  on public.pessoa for delete to authenticated
  using (public.sou_admin() and id <> auth.uid());

-- o cliente volta com os papeis novos
create policy "quem foi aprovado le cliente"
  on public.cliente for select to authenticated
  using (public.meu_papel() is not null);

create policy "cadastra cliente"
  on public.cliente for insert to authenticated
  with check (public.meu_papel() in ('admin', 'gerente', 'vendedor'));

create policy "edita cliente"
  on public.cliente for update to authenticated
  using (public.meu_papel() in ('admin', 'gerente', 'vendedor'))
  with check (public.meu_papel() in ('admin', 'gerente', 'vendedor'));

create policy "so o admin apaga cliente"
  on public.cliente for delete to authenticated
  using (public.sou_admin());

-- ---------- o que a tela le sobre si mesma -------------------
-- security_invoker faz a view respeitar a regra de acesso de quem consulta,
-- em vez de rodar com o poder de quem a criou. Sem isso ela seria um buraco.
create view public.meu_perfil
with (security_invoker = true) as
select
  p.id,
  p.nome,
  p.papel::text  as papel,
  p.situacao::text as situacao,
  coalesce(p.paineis, public.paineis_do_papel(p.papel)) as paineis
from public.pessoa p
where p.id = auth.uid();

-- ---------- quem enxerga a tabela pela API -------------------
grant select on public.painel    to authenticated;
grant select on public.meu_perfil to authenticated;
grant select, update, delete on public.pessoa to authenticated;
grant select, insert, update, delete on public.convite to authenticated;
grant execute on function public.paineis_do_papel(public.papel) to authenticated;
grant execute on function public.mudar_meu_nome(text) to authenticated;
