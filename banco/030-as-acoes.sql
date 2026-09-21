-- ===========================================================================
-- 030: AS ACOES
--
-- A matriz da 028 decide PAGINAS. Mas "aprovar o pedido para a fabrica" nao e
-- ver o PCP nem editar o PCP: e um botao especifico, e ate hoje quem podia
-- aperta-lo estava escrito a mao dentro de cada funcao do banco.
--
-- Entra o catalogo de acoes e a matriz de quem faz cada uma.
--
-- O CATALOGO SO TEM ACAO QUE A MATRIZ REALMENTE MANDA. A tentacao era listar
-- as vinte e poucas travas que existem no banco e ir ligando aos poucos. Uma
-- tela que mostra uma caixa que nao faz nada e pior que uma tela que nao
-- mostra: a pessoa marca, acredita, e descobre semanas depois. Acao entra
-- aqui no mesmo dia em que a funcao dela passa a perguntar.
--
-- O QUE NAO ENTRA, E NAO VAI ENTRAR: mexer nos acessos, aprovar conta, trocar
-- o papel de alguem, convidar e-mail, apagar dados de teste. Sao as acoes que
-- DAO poder, e continuam presas ao administrador no codigo. Se elas virassem
-- linha da matriz, a matriz viraria o caminho para escapar da matriz.
--
-- A ESCADA DE NOVO, em outra forma: acao que mora numa pagina exige ENXERGAR
-- aquela pagina. Ninguem da baixa num estoque que nao abre.
-- ===========================================================================

-- ---------- 1. o catalogo --------------------------------------------------
create table if not exists public.acao (
  chave  text primary key,
  nome   text not null,
  grupo  text not null,
  -- a pagina onde a acao mora; nulo quer dizer que ela nao mora em nenhuma
  painel text references public.painel (chave) on delete set null on update cascade,
  linha  text not null default '',
  ordem  int  not null default 100
);

comment on table public.acao is
  'O que da para FAZER no sistema, por chave. So entra acao cuja funcao ja pergunta a matriz.';

insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('pedido.separar',      'Mandar o pedido aprovado para a separação', 'O caminho do pedido', null,
   'A primeira passagem depois da venda fechada.', 10),
  ('pedido.ao_pcp',       'Mandar da separação para o PCP',            'O caminho do pedido', null,
   'É o que o botão Concluir a separação faz por dentro.', 20),
  ('pedido.a_producao',   'Liberar o pedido para a fábrica',           'O caminho do pedido', null,
   'O portão. Daqui para a frente o pedido está no chão de fábrica.', 30),
  ('pedido.pronto',       'Marcar o pedido como pronto',               'O caminho do pedido', null,
   'A produção acabou e o pedido espera a expedição.', 40),
  ('pedido.enviar',       'Marcar o pedido como enviado',              'O caminho do pedido', null,
   '', 50),
  ('pedido.entregar',     'Marcar o pedido como entregue',             'O caminho do pedido', null,
   '', 60),
  ('pedido.voltar',       'Voltar o pedido um passo',                  'O caminho do pedido', null,
   'Só um degrau de cada vez. Voltar dois não existe.', 70),
  ('pedido.cancelar',     'Cancelar o pedido',                         'O caminho do pedido', null,
   'De qualquer ponto do caminho.', 80),
  ('pedido.ressuscitar',  'Tirar um pedido do cancelado',              'O caminho do pedido', null,
   '', 90),

  ('estoque.mexer',       'Registrar entrada, saída ou ajuste',        'Estoque e separação', 'estoque',
   'Toda linha do razão nasce daqui, inclusive a baixa da separação.', 110),
  ('estoque.reservas',    'Refazer as reservas abertas',               'Estoque e separação', 'estoque',
   'Recalcula o que os pedidos em aberto comprometeram.', 120),
  ('separacao.separar',   'Dar baixa do material',                     'Estoque e separação', 'separacao',
   'Tira da prateleira o que saiu de verdade.', 130),
  ('separacao.desfazer',  'Desfazer uma separação',                    'Estoque e separação', 'separacao',
   'Devolve para a prateleira, sem apagar o que aconteceu.', 140),
  ('separacao.concluir',  'Concluir a separação',                      'Estoque e separação', 'separacao',
   'Leva o pedido ao PCP, com falta ou sem.', 150)
on conflict (chave) do nothing;

alter table public.acao enable row level security;
drop policy if exists "todo mundo le as acoes" on public.acao;
create policy "todo mundo le as acoes"
  on public.acao for select to authenticated using (true);
grant select on public.acao to authenticated;


-- ---------- 2. quem faz cada uma -------------------------------------------
-- A LINHA EXISTIR E A PERMISSAO. Sem linha, nao pode: o padrao de qualquer
-- acesso e nao, e assim nao existe o estado "marcado como falso" para alguem
-- confundir com "ainda nao decidido".
create table if not exists public.permissao_da_acao (
  papel     text not null references public.papel_do_sistema (chave)
              on delete cascade on update cascade,
  acao      text not null references public.acao (chave)
              on delete cascade on update cascade,
  mexido_em timestamptz not null default now(),
  primary key (papel, acao)
);

alter table public.permissao_da_acao enable row level security;
drop policy if exists "todo mundo le as acoes do papel" on public.permissao_da_acao;
drop policy if exists "so o admin mexe nas acoes"       on public.permissao_da_acao;
create policy "todo mundo le as acoes do papel"
  on public.permissao_da_acao for select to authenticated using (true);
create policy "so o admin mexe nas acoes"
  on public.permissao_da_acao for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
grant select on public.permissao_da_acao to authenticated;


-- ---------- 3. a semente ---------------------------------------------------
-- As passagens do pedido nascem exatamente com a lista que a 022 ja usava:
-- nenhum comportamento muda no dia em que esta migracao roda.
insert into public.permissao_da_acao (papel, acao)
select p, a
  from (values
    ('pedido.separar',     array['admin','gerente','producao','estoquista']),
    ('pedido.ao_pcp',      array['admin','gerente','producao','estoquista']),
    ('pedido.a_producao',  array['admin','gerente']),
    ('pedido.pronto',      array['admin','gerente','producao']),
    ('pedido.enviar',      array['admin','gerente','vendedor']),
    ('pedido.entregar',    array['admin','gerente','vendedor']),
    ('pedido.voltar',      array['admin','gerente']),
    ('pedido.cancelar',    array['admin','gerente']),
    ('pedido.ressuscitar', array['admin'])
  ) as r(a, papeis), unnest(r.papeis) as p
on conflict (papel, acao) do nothing;

-- Ja as acoes que moram numa pagina nascem de quem EDITA aquela pagina, e nao
-- da lista antiga. As duas discordavam: a lista antiga deixava a producao
-- mexer no estoque, e a matriz que o Henrique decidiu em 21/09 diz que a
-- producao so OLHA o estoque e a separacao. Quem manda e a decisao dele.
insert into public.permissao_da_acao (papel, acao)
select x.papel, a.chave
  from public.acao a
  join public.permissao x on x.painel = a.painel and x.editar
 where a.painel is not null
on conflict (papel, acao) do nothing;


-- ---------- 4. a pergunta --------------------------------------------------
create or replace function public.posso_a_acao(p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.pessoa pe
      join public.permissao_da_acao x on x.papel = pe.papel and x.acao = p_acao
      join public.acao a on a.chave = p_acao
     where pe.id = auth.uid()
       and pe.situacao = 'aprovado'
       /* acao que mora numa pagina exige enxergar a pagina */
       and (a.painel is null or public.posso(a.painel, 'ver'))
  )
$$;

grant execute on function public.posso_a_acao(text) to authenticated;

/* Os papeis que podem uma acao, para a trava da passagem continuar tendo a
   forma de lista que ela sempre teve. */
create or replace function public.papeis_da_acao(p_acao text)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(x.papel), array[]::text[])
    from public.permissao_da_acao x
   where x.acao = p_acao
$$;

grant execute on function public.papeis_da_acao(text) to authenticated;


-- ---------- 5. a trava da passagem passa a ler a matriz --------------------
-- Ela era uma tabela de ifs escrita a mao na 022. Continua com a mesma forma
-- por fora, entao o gatilho e a tela nao mudam de jeito nenhum: o que muda e
-- de onde vem a lista. Deixou de ser immutable porque agora le tabela.
create or replace function public.quem_pode_a_passagem(
  de   public.estado_do_pedido,
  para public.estado_do_pedido
) returns text[]
language sql
stable
as $$
  select case
    when de = 'aprovado'  and para = 'separacao' then public.papeis_da_acao('pedido.separar')
    when de = 'separacao' and para = 'pcp'       then public.papeis_da_acao('pedido.ao_pcp')
    when de = 'pcp'       and para = 'producao'  then public.papeis_da_acao('pedido.a_producao')
    when de = 'producao'  and para = 'pronto'    then public.papeis_da_acao('pedido.pronto')
    when de = 'pronto'    and para = 'enviado'   then public.papeis_da_acao('pedido.enviar')
    when de = 'enviado'   and para = 'entregue'  then public.papeis_da_acao('pedido.entregar')

    when de = 'separacao' and para = 'aprovado'  then public.papeis_da_acao('pedido.voltar')
    when de = 'pcp'       and para = 'separacao' then public.papeis_da_acao('pedido.voltar')
    when de = 'producao'  and para = 'pcp'       then public.papeis_da_acao('pedido.voltar')
    when de = 'pronto'    and para = 'producao'  then public.papeis_da_acao('pedido.voltar')
    when de = 'enviado'   and para = 'pronto'    then public.papeis_da_acao('pedido.voltar')
    when de = 'entregue'  and para = 'enviado'   then public.papeis_da_acao('pedido.voltar')

    when para = 'cancelado'                      then public.papeis_da_acao('pedido.cancelar')
    when de   = 'cancelado'                      then public.papeis_da_acao('pedido.ressuscitar')
    else null
  end
$$;

grant execute on function public.quem_pode_a_passagem(
  public.estado_do_pedido, public.estado_do_pedido) to authenticated;


-- ---------- 6. as funcoes do estoque e da separacao ------------------------
-- Mesmo corpo de antes; o que muda e a primeira linha de cada uma.
create or replace function public.mexer_no_estoque(
  p_material   uuid,
  p_quantidade numeric,
  p_motivo     text,
  p_observacao text default '',
  p_pedido     uuid default null
) returns public.material
language plpgsql
security definer
set search_path = public
as $$
declare
  fim public.material;
begin
  if not public.posso_a_acao('estoque.mexer') then
    raise exception 'Seu acesso não permite mexer no estoque.' using errcode = '42501';
  end if;
  if p_quantidade = 0 then
    raise exception 'Movimento de zero não diz nada.' using errcode = '23514';
  end if;

  insert into public.movimento_de_estoque
    (material_id, quantidade, motivo, observacao, pedido_id, quem)
  values (p_material, p_quantidade, p_motivo, coalesce(p_observacao,''), p_pedido, auth.uid());

  select * into fim from public.material where id = p_material;
  if not found then
    raise exception 'Material não encontrado.' using errcode = 'P0002';
  end if;
  return fim;
end $$;

grant execute on function public.mexer_no_estoque(uuid, numeric, text, text, uuid) to authenticated;


create or replace function public.refazer_as_reservas_abertas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  p      record;
  quanto int := 0;
begin
  if not public.posso_a_acao('estoque.reservas') then
    raise exception 'Seu acesso não permite refazer as reservas.' using errcode = '42501';
  end if;

  for p in
    select id from public.pedido
     where estado in ('aprovado', 'separacao', 'pcp', 'producao')
  loop
    perform public.reservar_o_pedido(p.id);
    quanto := quanto + 1;
  end loop;

  return quanto;
end $$;

grant execute on function public.refazer_as_reservas_abertas() to authenticated;


create or replace function public.separar_material(
  p_reserva    uuid,
  p_quantidade numeric,
  p_observacao text default ''
) returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if not public.posso_a_acao('separacao.separar') then
    raise exception 'Seu acesso não permite separar material.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if res.baixada then
    raise exception 'Este material já foi separado.' using errcode = '23505';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Escreva quanto saiu da prateleira.' using errcode = '23514';
  end if;

  perform public.mexer_no_estoque(
    res.material_id, -p_quantidade, 'separacao',
    coalesce(nullif(btrim(p_observacao), ''), 'separação do pedido'),
    res.pedido_id);

  update public.reserva
     set baixada = true,
         separado = p_quantidade,
         atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.separar_material(uuid, numeric, text) to authenticated;


create or replace function public.desfazer_a_separacao(p_reserva uuid)
returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if not public.posso_a_acao('separacao.desfazer') then
    raise exception 'Seu acesso não permite desfazer uma separação.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if not res.baixada then
    raise exception 'Este material não foi separado.' using errcode = '23514';
  end if;

  if coalesce(res.separado, 0) > 0 then
    perform public.mexer_no_estoque(
      res.material_id, res.separado, 'devolucao',
      'separação desfeita', res.pedido_id);
  end if;

  update public.reserva
     set baixada = false, separado = null, atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.desfazer_a_separacao(uuid) to authenticated;


create or replace function public.concluir_a_separacao(p_pedido uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     public.pedido;
  faltam  int;
  abertas int;
  saiu    int;
  total   int;
begin
  if not public.posso_a_acao('separacao.concluir') then
    raise exception 'Seu acesso não permite concluir a separação.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado not in ('aprovado', 'separacao') then
    raise exception 'Este pedido não está na separação.' using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where baixada),
         count(*) filter (where not baixada),
         count(*) filter (where sem_consumo and not baixada)
    into total, saiu, faltam, abertas
    from public.reserva where pedido_id = p_pedido;

  select faltam + count(*) into faltam
    from public.reserva
   where pedido_id = p_pedido and baixada
     and not sem_consumo and coalesce(separado, 0) < quantidade;

  if ped.estado = 'aprovado' then
    update public.pedido set estado = 'separacao' where id = p_pedido;
  end if;

  update public.pedido
     set estado = 'pcp',
         aviso = case
           when faltam > 0 then 'falta-material'
           when aviso = 'falta-material' then ''
           else aviso
         end
   where id = p_pedido;

  return case
    when total = 0 then 'Nenhum material cadastrado para este pedido. Ele seguiu para o PCP.'
    when faltam = 0 then 'Separação concluída: ' || saiu || ' de ' || total ||
                         ' materiais. O pedido seguiu para o PCP.'
    else 'Separação concluída com falta: ' || faltam || ' de ' || total ||
         ' materiais incompletos' ||
         case when abertas > 0 then ', ' || abertas || ' sem consumo cadastrado' else '' end ||
         '. O PCP decide se o pedido desce assim.'
  end;
end $$;

grant execute on function public.concluir_a_separacao(uuid) to authenticated;


-- ---------- 7. a conferencia cresce ----------------------------------------
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
  union all
  select 'tabela com RLS ligada e nenhuma politica', c.relname
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
     and c.relrowsecurity
     and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)
  union all
  select 'acao que ninguem pode', a.chave
    from public.acao a
   where not exists (select 1 from public.permissao_da_acao x where x.acao = a.chave)
  union all
  /* A BAIXA DA SEPARACAO E UM MOVIMENTO DE ESTOQUE. Quem separa e nao mexe no
     estoque leva um erro na cara no meio da separacao, e o erro fala de
     estoque enquanto a pessoa esta olhando para a separacao. */
  select 'papel que separa e nao mexe no estoque', x.papel
    from public.permissao_da_acao x
   where x.acao = 'separacao.separar'
     and not exists (select 1 from public.permissao_da_acao y
                      where y.papel = x.papel and y.acao = 'estoque.mexer')
  union all
  select 'acao que mora numa pagina que o papel nao enxerga', x.papel || ' / ' || x.acao
    from public.permissao_da_acao x
    join public.acao a on a.chave = x.acao
   where a.painel is not null
     and not exists (select 1 from public.permissao p
                      where p.papel = x.papel and p.painel = a.painel and p.ver)
$$;

grant execute on function public.conferir_os_acessos() to authenticated;
