-- ===========================================================================
-- 028: OS ACESSOS
--
-- Ate hoje o acesso era uma lista de paginas por pessoa: ve ou nao ve. Isso
-- respondia "esta pagina aparece no menu?" e nao respondia "esta pessoa pode
-- MEXER no que tem dentro dela?", que e a pergunta que a fabrica faz.
--
-- Entram duas coisas:
--   1. o papel deixa de ser enum e vira TABELA, para um papel novo nascer
--      pela tela em vez de pedir migracao;
--   2. a matriz de permissao, com quatro niveis por pagina.
--
-- A ESCADA MORA NO BANCO, e nao no formulario. Nao existe deletar sem ver:
-- quem nao enxerga a pagina nao tem como apagar o que esta dentro dela. Se a
-- regra so existisse na tela, um POST cru gravaria um estado que o resto do
-- sistema nao sabe ler.
--
-- O QUE ESTA MIGRACAO NAO FAZ: ela ainda nao reescreve as politicas de RLS
-- que ja estao no ar. Elas continuam com a lista de papeis escrita a mao, e
-- vao ser trocadas uma por uma, com prova, para nao existir o dia em que
-- todo mundo fica trancado do lado de fora por causa de uma politica errada.
-- Enquanto isso a matriz manda no menu, nas rotas e nos botoes, e a funcao
-- posso() ja esta de pe para o codigo novo usar.
-- ===========================================================================

-- ---------- 1. o papel vira tabela -----------------------------------------
create table if not exists public.papel_do_sistema (
  chave      text primary key,
  nome       text not null,
  linha      text not null default '',
  -- o admin nao se apaga e nao troca de chave: e ele que conserta o resto
  fixo       boolean not null default false,
  ordem      int not null default 100,
  criado_em  timestamptz not null default now(),

  constraint papel_chave_limpa check (chave ~ '^[a-z][a-z0-9_]{1,23}$'),
  constraint papel_tem_nome    check (btrim(nome) <> '')
);

comment on table public.papel_do_sistema is
  'Os papeis do sistema. Era um enum ate a 028, e virou tabela para papel novo nascer pela tela.';

insert into public.papel_do_sistema (chave, nome, linha, fixo, ordem) values
  ('admin',      'Administrador', 'Manda em tudo, e é quem libera e-mail, aprova conta e escolhe painel.', true,  10),
  ('gerente',    'Gerente',       'Vê a fábrica inteira e o dinheiro, e aprova o pedido para a produção.',  false, 20),
  ('vendedor',   'Vendedor',      'Cliente, funil e cotação.',                                             false, 30),
  ('producao',   'Produção',      'Confere o PCP e marca, toca o kanban e lê a ficha.',                    false, 40),
  ('estoquista', 'Estoquista',    'Estoque, separação e as referências das peças.',                        false, 50),
  ('analista',   'Analista',      'Relatório e o painel da semana, para olhar sem mexer.',                 false, 60)
on conflict (chave) do nothing;


-- ---------- 2. a coluna papel deixa de ser enum ----------------------------
-- A ORDEM AQUI NAO E ESCOLHA. A view meu_perfil chama paineis_do_papel, e a
-- funcao antiga recebe o enum: sem derrubar a view primeiro, o banco recusa
-- derrubar a funcao, e sem derrubar a funcao a coluna nao muda de tipo.
drop view if exists public.meu_perfil;
-- A view equipe tambem le pessoa.papel, e o Postgres recusa mudar o tipo de uma
-- coluna que uma view enxerga. Ela cai aqui e volta igual logo abaixo: a lista
-- da equipe nao muda de forma nenhuma por causa desta migracao.
drop view if exists public.equipe;
drop function if exists public.paineis_do_papel(public.papel);

alter table public.pessoa  alter column papel drop default;
alter table public.pessoa  alter column papel type text using papel::text;
alter table public.pessoa  alter column papel set default 'producao';

alter table public.convite alter column papel drop default;
alter table public.convite alter column papel type text using papel::text;
alter table public.convite alter column papel set default 'producao';

-- ON UPDATE CASCADE e o que deixa renomear a chave de um papel pela tela sem
-- deixar pessoa orfa no meio do caminho.
alter table public.pessoa  drop constraint if exists pessoa_papel_existe;
alter table public.pessoa  add  constraint pessoa_papel_existe
  foreign key (papel) references public.papel_do_sistema (chave) on update cascade;

alter table public.convite drop constraint if exists convite_papel_existe;
alter table public.convite add  constraint convite_papel_existe
  foreign key (papel) references public.papel_do_sistema (chave) on update cascade;

-- a equipe volta exatamente como estava na 011
create view public.equipe as
select id, nome, papel, situacao from public.pessoa;

grant select on public.equipe to authenticated;

-- O tipo public.papel fica orfao de proposito. Derrubar ele aqui faria a
-- migracao inteira voltar atras se algum objeto esquecido ainda apontasse
-- para ele, e um tipo sem uso nao custa nada.

alter table public.papel_do_sistema enable row level security;

drop policy if exists "todo mundo le os papeis"    on public.papel_do_sistema;
drop policy if exists "so o admin mexe nos papeis" on public.papel_do_sistema;

create policy "todo mundo le os papeis"
  on public.papel_do_sistema for select to authenticated
  using (true);

create policy "so o admin mexe nos papeis"
  on public.papel_do_sistema for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

grant select on public.papel_do_sistema to authenticated;


-- ---------- 3. a matriz ----------------------------------------------------
create table if not exists public.permissao (
  papel   text not null references public.papel_do_sistema (chave)
            on delete cascade on update cascade,
  painel  text not null references public.painel (chave)
            on delete cascade on update cascade,
  ver     boolean not null default false,
  editar  boolean not null default false,
  deletar boolean not null default false,
  total   boolean not null default false,
  mexido_em timestamptz not null default now(),

  primary key (papel, painel),

  /* A ESCADA. Ela e constraint e nao conselho: o banco recusa gravar
     "deletar sem ver", venha de onde vier. */
  constraint permissao_escada check (
    (not total   or (ver and editar and deletar)) and
    (not deletar or (ver and editar)) and
    (not editar  or ver)
  )
);

comment on table public.permissao is
  'O que cada papel pode em cada pagina: ver, editar, deletar, controle total.';

alter table public.permissao enable row level security;

drop policy if exists "todo mundo le a matriz"    on public.permissao;
drop policy if exists "so o admin mexe na matriz" on public.permissao;

create policy "todo mundo le a matriz"
  on public.permissao for select to authenticated
  using (true);

create policy "so o admin mexe na matriz"
  on public.permissao for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

grant select on public.permissao to authenticated;


-- ---------- 4. a matriz que o Henrique decidiu em 21/09 --------------------
-- ON CONFLICT DO NOTHING de proposito: rodar esta migracao de novo nao pode
-- desfazer o que ele mexer depois pela tela.

insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, p, true, true, true, true
  from (values
    ('admin',    array['inicio','funil','clientes','cotacao','separacao','pcp','ficha',
                       'kanban','produtos','estoque','atividades','relatorio','banco','config','kit']),
    ('gerente',  array['inicio','funil','clientes','cotacao','separacao','pcp','ficha',
                       'kanban','produtos','estoque','atividades','relatorio','banco']),
    ('vendedor', array['inicio','funil','clientes','cotacao'])
  ) as r(papel, paineis), unnest(r.paineis) as p
on conflict (papel, painel) do nothing;

insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, p, true, true, true, false
  from (values
    ('estoquista', array['separacao','produtos','estoque'])
  ) as r(papel, paineis), unnest(r.paineis) as p
on conflict (papel, painel) do nothing;

insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, p, true, true, false, false
  from (values
    /* O PCP entra aqui, e nao em ver. Sem editar, quem opera o PCP nao
       consegue marcar o pedido, e as duas aprovacoes viravam uma so. */
    ('producao', array['pcp','kanban','atividades'])
  ) as r(papel, paineis), unnest(r.paineis) as p
on conflict (papel, painel) do nothing;

insert into public.permissao (papel, painel, ver, editar, deletar, total)
select r.papel, p, true, false, false, false
  from (values
    ('gerente',    array['config']),
    ('vendedor',   array['separacao','pcp','kanban','produtos','estoque','atividades','banco','config']),
    ('producao',   array['inicio','separacao','ficha','produtos','estoque','banco']),
    ('estoquista', array['inicio','kanban','banco']),
    ('analista',   array['inicio','kanban','atividades','relatorio'])
  ) as r(papel, paineis), unnest(r.paineis) as p
on conflict (papel, painel) do nothing;


-- ---------- 5. quem le a matriz -------------------------------------------
-- Deixou de ser immutable: agora ela le tabela, entao e stable.
create or replace function public.paineis_do_papel(p text)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(x.painel order by pa.ordem), array[]::text[])
    from public.permissao x
    join public.painel pa on pa.chave = x.painel
   where x.papel = p and x.ver
$$;

grant execute on function public.paineis_do_papel(text) to authenticated;

/* As permissoes de uma pessoa: o papel dela, cruzado com a lista propria.

   A LISTA PROPRIA CONTINUA SUBSTITUINDO, E NAO ENCOLHENDO. Era assim antes da
   028 e tinha que continuar: o administrador abre a ficha de alguem e marca
   uma pagina a mais que o papel nao tem, e essa marca precisa valer. Fazer a
   lista so encolher transformaria aquele clique em nada, sem nenhum aviso, que
   e o pior jeito de uma regra falhar.

   Numa pagina que veio da lista propria e que o papel nao cobre, a pessoa VE e
   nao mexe. Ver e o que ela pediu ao marcar a pagina; editar e deletar nascem
   do papel, e nao de uma caixa marcada na ficha de alguem. */
create or replace function public.permissoes_de(p_papel text, p_paineis text[])
returns jsonb
language sql
stable
as $$
  with vistas as (
    select pa.chave as painel
      from public.painel pa
     where case
             when p_paineis is null then exists (
               select 1 from public.permissao x
                where x.papel = p_papel and x.painel = pa.chave and x.ver)
             else pa.chave = any (p_paineis)
           end
  )
  select coalesce(
    jsonb_object_agg(v.painel, jsonb_build_object(
      'ver',     true,
      'editar',  coalesce(x.editar, false),
      'deletar', coalesce(x.deletar, false),
      'total',   coalesce(x.total, false))),
    '{}'::jsonb)
    from vistas v
    left join public.permissao x
      on x.papel = p_papel and x.painel = v.painel and x.ver
$$;

grant execute on function public.permissoes_de(text, text[]) to authenticated;

/* A pergunta curta, para o codigo novo e para a RLS que vier depois. */
create or replace function public.posso(p_painel text, p_nivel text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_nivel
             when 'ver'     then true
             when 'editar'  then coalesce(x.editar, false)
             when 'deletar' then coalesce(x.deletar, false)
             when 'total'   then coalesce(x.total, false)
             else false
           end
      from public.pessoa pe
      left join public.permissao x
        on x.papel = pe.papel and x.painel = p_painel and x.ver
     where pe.id = auth.uid()
       and pe.situacao = 'aprovado'
       and case
             when pe.paineis is null then x.painel is not null
             else p_painel = any (pe.paineis)
           end
  ), false)
$$;

grant execute on function public.posso(text, text) to authenticated;


-- ---------- 6. o perfil passa a carregar a matriz -------------------------
-- Ela ja caiu la em cima, antes da funcao antiga. Uma coluna no meio nunca
-- entraria com create or replace de qualquer jeito.

create view public.meu_perfil
with (security_invoker = true) as
select
  p.id,
  p.nome,
  p.email,
  p.papel,
  p.situacao::text as situacao,
  p.foto_em,
  /* paineis sai de DENTRO das permissoes, e nao de uma conta paralela: assim
     as duas respostas nao tem como discordar. */
  case when p.situacao = 'aprovado'
       then coalesce((
              select array_agg(t.k order by pa.ordem)
                from jsonb_object_keys(public.permissoes_de(p.papel, p.paineis)) as t(k)
                join public.painel pa on pa.chave = t.k
            ), array[]::text[])
       else array[]::text[]
  end as paineis,
  case when p.situacao = 'aprovado'
       then public.permissoes_de(p.papel, p.paineis)
       else '{}'::jsonb
  end as permissoes
from public.pessoa p
where p.id = auth.uid();

grant select on public.meu_perfil to authenticated;


-- ---------- 7. o que a tela do admin chama --------------------------------
create or replace function public.salvar_permissao(
  p_papel   text,
  p_painel  text,
  p_ver     boolean,
  p_editar  boolean,
  p_deletar boolean,
  p_total   boolean
) returns public.permissao
language plpgsql
security definer
set search_path = public
as $$
declare
  linha public.permissao;
  v boolean := coalesce(p_ver, false);
  e boolean := coalesce(p_editar, false);
  d boolean := coalesce(p_deletar, false);
  t boolean := coalesce(p_total, false);
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador mexe nos acessos.' using errcode = '42501';
  end if;

  /* A escada aplicada aqui, e nao devolvida como erro. O banco sabe o que a
     pessoa quis dizer ao marcar deletar, e arrumar e mais util que recusar. */
  if t then v := true; e := true; d := true;
  elsif d then v := true; e := true;
  elsif e then v := true;
  end if;

  if not v then
    delete from public.permissao where papel = p_papel and painel = p_painel;
    linha.papel := p_papel; linha.painel := p_painel;
    linha.ver := false; linha.editar := false; linha.deletar := false; linha.total := false;
    return linha;
  end if;

  insert into public.permissao (papel, painel, ver, editar, deletar, total, mexido_em)
  values (p_papel, p_painel, v, e, d, t, now())
      on conflict (papel, painel) do update
         set ver = excluded.ver, editar = excluded.editar,
             deletar = excluded.deletar, total = excluded.total,
             mexido_em = now()
  returning * into linha;

  return linha;
end $$;

grant execute on function public.salvar_permissao(text, text, boolean, boolean, boolean, boolean)
  to authenticated;


create or replace function public.criar_papel(
  p_chave text, p_nome text, p_linha text default ''
) returns public.papel_do_sistema
language plpgsql
security definer
set search_path = public
as $$
declare
  novo public.papel_do_sistema;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador cria papel.' using errcode = '42501';
  end if;
  if exists (select 1 from public.papel_do_sistema where chave = p_chave) then
    raise exception 'Já existe um papel com a chave %.', p_chave using errcode = '23505';
  end if;

  insert into public.papel_do_sistema (chave, nome, linha, fixo, ordem)
  values (p_chave, btrim(p_nome), coalesce(btrim(p_linha), ''), false,
          (select coalesce(max(ordem), 0) + 10 from public.papel_do_sistema))
  returning * into novo;

  return novo;
end $$;

grant execute on function public.criar_papel(text, text, text) to authenticated;


create or replace function public.salvar_papel(
  p_chave text, p_chave_nova text, p_nome text, p_linha text default ''
) returns public.papel_do_sistema
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo public.papel_do_sistema;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador renomeia papel.' using errcode = '42501';
  end if;

  select * into alvo from public.papel_do_sistema where chave = p_chave;
  if not found then
    raise exception 'Papel não encontrado.' using errcode = 'P0002';
  end if;

  if p_chave_nova is not null and p_chave_nova <> p_chave then
    if alvo.fixo then
      raise exception 'A chave do administrador não muda.' using errcode = '23514';
    end if;
    if exists (select 1 from public.papel_do_sistema where chave = p_chave_nova) then
      raise exception 'Já existe um papel com a chave %.', p_chave_nova using errcode = '23505';
    end if;
    /* as chaves estrangeiras sao on update cascade: pessoa, convite e a
       matriz andam junto */
    update public.papel_do_sistema set chave = p_chave_nova where chave = p_chave;
    p_chave := p_chave_nova;
  end if;

  update public.papel_do_sistema
     set nome = btrim(p_nome), linha = coalesce(btrim(p_linha), '')
   where chave = p_chave
  returning * into alvo;

  return alvo;
end $$;

grant execute on function public.salvar_papel(text, text, text, text) to authenticated;


create or replace function public.apagar_papel(p_chave text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  public.papel_do_sistema;
  gente int;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador apaga papel.' using errcode = '42501';
  end if;

  select * into alvo from public.papel_do_sistema where chave = p_chave;
  if not found then
    raise exception 'Papel não encontrado.' using errcode = 'P0002';
  end if;
  if alvo.fixo then
    raise exception 'O administrador não pode ser apagado.' using errcode = '23514';
  end if;

  select count(*) into gente from public.pessoa where papel = p_chave;
  if gente > 0 then
    raise exception 'Este papel é de % pessoa(s). Troque o papel delas antes.', gente
      using errcode = '23503';
  end if;
  if exists (select 1 from public.convite where papel = p_chave and usado_em is null) then
    raise exception 'Existe convite aberto com este papel.' using errcode = '23503';
  end if;

  delete from public.papel_do_sistema where chave = p_chave;
  return 'Papel ' || alvo.nome || ' apagado.';
end $$;

grant execute on function public.apagar_papel(text) to authenticated;


-- ---------- 8. a conferencia ----------------------------------------------
/* O mesmo espirito do conferir_o_razao do estoque: uma pergunta que da para
   fazer a qualquer hora, e que devolve o que esta torto. */
create or replace function public.conferir_os_acessos()
returns table (aviso text, detalhe text)
language sql
stable
as $$
  select 'papel sem nenhuma pagina', p.chave
    from public.papel_do_sistema p
   where not exists (select 1 from public.permissao x where x.papel = p.chave and x.ver)
  union all
  select 'pagina que nenhum papel enxerga', pa.chave
    from public.painel pa
   where not exists (select 1 from public.permissao x where x.painel = pa.chave and x.ver)
  union all
  select 'pessoa com papel que nao existe', pe.email
    from public.pessoa pe
   where not exists (select 1 from public.papel_do_sistema p where p.chave = pe.papel)
$$;

grant execute on function public.conferir_os_acessos() to authenticated;
