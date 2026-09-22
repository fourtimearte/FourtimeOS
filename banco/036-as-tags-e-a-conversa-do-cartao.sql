-- ============================================================
-- Fourtime OS - 036 as tags e a conversa do cartao
-- ============================================================
-- O que esta migracao existe para sustentar esta desenhado em
-- claude/DECISAO-O-CARTAO-DO-MARK45.md: o cartao do kanban deixa de ser uma
-- etiqueta e passa a ser a tela por onde o chao de fabrica fala.
--
-- QUATRO COISAS NOVAS, e cada uma com uma vida diferente:
--
-- 1. A TAG DO POSTO. Ela diz o que esta acontecendo com o pedido AGORA, dentro
--    do posto em que ele esta: montagem, revisao, prova de cor. Ela muda o dia
--    todo, e so aparece nos postos onde faz sentido.
--
-- 2. A TAG MESTRE. Ela vem do cabecalho da cotacao (corpo -> producao ->
--    marcas) e vale para o pedido inteiro, em todo posto: evento, urgente,
--    vip, prioridade. Ela NAO e copiada para ca, e a razao esta escrita na
--    view mais abaixo.
--
-- 3. QUEM ESTA COM O CARTAO. Duas colunas na fatia e duas funcoes. E o que faz
--    o cronometro existir, e e o que transforma o painel de atividades de
--    estimativa em medicao.
--
-- 4. A LINHA DO TEMPO. Uma tabela so para a fala e para o que o sistema
--    registrou, porque um comentario lido sem saber que o cartao mudou de
--    posto tres minutos antes e meio comentario.
--
-- A REGRA QUE VALE PARA AS TRES FUNCOES QUE ESCREVEM: a trava mora no banco, e
-- nao no botao. Toda uma delas pergunta a matriz de acoes da 030 antes de
-- deixar escrever, entao a regra vale para a tela, para o toque no tablet e
-- para um PATCH cru no PostgREST.


-- ---------- 1. o nome do pedido -------------------------------------------
-- O cartao mostra o numero e o NOME do pedido. O numero o banco ja tem; o nome
-- nao existia. Ele nasce vazio e cai para o nome do cliente enquanto ninguem
-- escrever nada, que e o comportamento de hoje visto de fora.
--
-- ONDE ELE SE DIGITA AINDA NAO ESTA DECIDIDO, e por isso a coluna nasce aqui e
-- nao na cotacao: mexer no editor de cotacao por causa de um campo que o
-- Henrique ainda vai desenhar seria construir a porta antes de saber onde e a
-- parede.
alter table public.pedido add column if not exists nome text not null default '';

comment on column public.pedido.nome is
  'o nome que a fabrica da ao pedido, tipo Uniforme Equipe Verao; vazio cai para o nome do cliente';


-- ---------- 2. quem esta com o cartao --------------------------------------
alter table public.fatia add column if not exists pego_por uuid
  references public.pessoa (id) on delete set null;
alter table public.fatia add column if not exists pego_em timestamptz;

comment on column public.fatia.pego_em is
  'quando alguem pegou este cartao para trabalhar; nulo quer dizer que ele esta na fila';


-- ---------- 3. a tag -------------------------------------------------------
-- A COR E UMA CHAVE, e nao um hexadecimal. O Design System V7 proibe cor
-- literal fora dos tokens, e uma cor guardada em hexa no banco e exatamente
-- isso: ela atravessaria o sistema inteiro sem passar pelo tema, e no Grafite
-- ficaria ilegivel. Aqui fica o NOME do tom, e quem sabe pintar e o CSS.
create table if not exists public.tag (
  chave        text primary key
                 constraint tag_chave_arrumada check (chave ~ '^[a-z][a-z0-9_-]{1,31}$'),
  nome         text not null,
  tom          text not null default 'cinza'
                 constraint tag_tom_conhecido
                 check (tom in ('cinza','vermelha','laranja','amarela','verde','azul','roxa')),
  /* a tag que vale em todo posto nao precisa de nenhuma linha em tag_do_posto */
  em_todo_posto boolean not null default false,
  ordem        int not null default 100,
  ativa        boolean not null default true,
  criada_em    timestamptz not null default now()
);

comment on table public.tag is
  'O recado que fica no cartao do kanban. A tag NAO move o cartao e NAO troca o estado do pedido.';

-- Os postos onde a tag aparece. Vazio mais em_todo_posto = false quer dizer
-- que a tag existe e nao aparece em lugar nenhum, que e um estado legitimo:
-- e assim que se aposenta uma tag sem apagar o historico dela.
create table if not exists public.tag_do_posto (
  tag   text not null references public.tag (chave) on delete cascade on update cascade,
  posto public.etapa_da_producao not null,
  primary key (tag, posto)
);

-- A tag POSTA num cartao. Ela guarda quem pos e quando, porque tag sem dono e
-- um recado anonimo, e recado anonimo ninguem tira.
create table if not exists public.tag_da_fatia (
  fatia_id  uuid not null references public.fatia (id) on delete cascade,
  tag       text not null references public.tag (chave) on delete cascade on update cascade,
  posta_por uuid references public.pessoa (id) on delete set null,
  posta_em  timestamptz not null default now(),
  primary key (fatia_id, tag)
);

create index if not exists tag_da_fatia_por_fatia on public.tag_da_fatia (fatia_id);


-- ---------- 4. a linha do tempo do cartao ----------------------------------
-- UMA TABELA SO PARA A FALA E PARA O FATO. A alternativa era duas, uma de
-- comentario e outra de evento, e juntar as duas na hora de desenhar. Isso
-- funciona ate o dia em que as duas precisam ser paginadas juntas, e ai a
-- segunda pagina fica mentindo.
create table if not exists public.evento_da_fatia (
  id        uuid primary key default gen_random_uuid(),
  fatia_id  uuid not null references public.fatia (id) on delete cascade,
  tipo      text not null default 'fala'
              constraint evento_tipo_conhecido
              check (tipo in ('fala','posto','tag','pegou','soltou','nasceu')),
  texto     text not null default '',
  quem      uuid references public.pessoa (id) on delete set null,
  em        timestamptz not null default now()
);

create index if not exists evento_da_fatia_por_fatia on public.evento_da_fatia (fatia_id, em desc);

comment on table public.evento_da_fatia is
  'A conversa e o historico do cartao, na mesma linha do tempo. tipo=fala e gente falando.';


-- ---------- 5. as acoes novas na matriz ------------------------------------
-- So entra acao cuja funcao ja pergunta a matriz, que e a regra escrita na 030.
-- As tres abaixo perguntam, logo abaixo neste mesmo arquivo.
insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('kanban.pegar',     'Pegar e soltar o cartão',          'Chão de fábrica', 'kanban',
   'Dizer que o trabalho está na sua mão. É o que faz o cronômetro do posto existir.', 210),
  ('kanban.etiquetar', 'Pôr e tirar tag do cartão',        'Chão de fábrica', 'kanban',
   'A tag é um recado: ela não move o cartão nem troca o estado do pedido.', 220),
  ('kanban.comentar',  'Escrever na conversa do cartão',   'Chão de fábrica', 'kanban',
   'Fica na linha do tempo do cartão, junto com o que o sistema registrou.', 230)
on conflict (chave) do nothing;

-- quem EDITA o kanban faz as tres, que e a mesma regra que a 033 usou para
-- kanban.mover: quem anda com o cartao fala sobre ele
insert into public.permissao_da_acao (papel, acao)
select x.papel, a.chave
  from public.permissao x
  cross join (values ('kanban.pegar'), ('kanban.etiquetar'), ('kanban.comentar')) as a(chave)
 where x.painel = 'kanban' and x.editar
on conflict (papel, acao) do nothing;


-- ---------- 6. quem le e quem escreve --------------------------------------
-- Ler e de quem foi aprovado, como a rota e a fatia. Escrever passa pelas
-- funcoes abaixo, e por isso o grant de insert e update NAO e dado: nao existe
-- caminho de mao livre para estas tabelas.
alter table public.tag             enable row level security;
alter table public.tag_do_posto    enable row level security;
alter table public.tag_da_fatia    enable row level security;
alter table public.evento_da_fatia enable row level security;

drop policy if exists "quem foi aprovado le a tag"        on public.tag;
drop policy if exists "quem cuida da config mexe na tag"  on public.tag;
create policy "quem foi aprovado le a tag"
  on public.tag for select to authenticated using (public.meu_papel() is not null);
create policy "quem cuida da config mexe na tag"
  on public.tag for all to authenticated
  using (public.posso('config','editar')) with check (public.posso('config','editar'));
grant select, insert, update, delete on public.tag to authenticated;

drop policy if exists "quem foi aprovado le o posto da tag"       on public.tag_do_posto;
drop policy if exists "quem cuida da config mexe no posto da tag" on public.tag_do_posto;
create policy "quem foi aprovado le o posto da tag"
  on public.tag_do_posto for select to authenticated using (public.meu_papel() is not null);
create policy "quem cuida da config mexe no posto da tag"
  on public.tag_do_posto for all to authenticated
  using (public.posso('config','editar')) with check (public.posso('config','editar'));
grant select, insert, update, delete on public.tag_do_posto to authenticated;

drop policy if exists "quem foi aprovado le a tag do cartao" on public.tag_da_fatia;
create policy "quem foi aprovado le a tag do cartao"
  on public.tag_da_fatia for select to authenticated using (public.meu_papel() is not null);
grant select on public.tag_da_fatia to authenticated;

drop policy if exists "quem foi aprovado le a linha do tempo" on public.evento_da_fatia;
create policy "quem foi aprovado le a linha do tempo"
  on public.evento_da_fatia for select to authenticated using (public.meu_papel() is not null);
grant select on public.evento_da_fatia to authenticated;


-- ---------- 7. as tags que a fabrica ja usa --------------------------------
-- Elas sao um PONTO DE PARTIDA, e nao uma lista fechada: a tela de
-- Configuracoes cria, renomeia e aposenta. Os postos de cada uma vem do que o
-- nome dela quer dizer, e nao de um palpite sobre o fluxo.
insert into public.tag (chave, nome, tom, em_todo_posto, ordem) values
  ('falta_tecido',   'falta tecido',   'vermelha', true,  10),
  ('reposicao',      'reposição',      'laranja',  true,  20),
  ('montagem',       'montagem',       'verde',    false, 30),
  ('prova_de_cor',   'prova de cor',   'azul',     false, 40),
  ('esperando_arte', 'esperando arte', 'azul',     false, 50),
  ('revisao',        'revisão',        'roxa',     false, 60),
  ('maquina_parada', 'máquina parada', 'amarela',  true,  70)
on conflict (chave) do nothing;

insert into public.tag_do_posto (tag, posto) values
  ('montagem',       'dtf'),
  ('montagem',       'subli'),
  ('montagem',       'silk'),
  ('prova_de_cor',   'dtf'),
  ('prova_de_cor',   'subli'),
  ('prova_de_cor',   'silk'),
  ('esperando_arte', 'dtf'),
  ('esperando_arte', 'subli'),
  ('esperando_arte', 'silk'),
  ('revisao',        'conferencia'),
  ('revisao',        'corte')
on conflict (tag, posto) do nothing;


-- ---------- 8. pegar e soltar o cartao -------------------------------------
create or replace function public.pegar_a_fatia(p_fatia uuid)
returns public.fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
begin
  if not public.posso_a_acao('kanban.pegar') then
    raise exception 'Seu acesso não permite pegar o cartão.' using errcode = '42501';
  end if;

  select * into f from public.fatia where id = p_fatia for update;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if f.fechado_em is not null then
    raise exception 'Este cartão já chegou ao fim da rota.' using errcode = '23514';
  end if;

  /* PEGAR DUAS VEZES NAO REINICIA O RELOGIO. Quem ja esta com o cartao na mao
     tocando no botao de novo quer dizer "continuo com ele", e nao "comecei
     agora": zerar o tempo aqui apagaria justamente a espera que o painel
     existe para medir. */
  if f.pego_por = auth.uid() then
    return f;
  end if;

  update public.fatia set pego_por = auth.uid(), pego_em = now()
   where id = p_fatia returning * into f;

  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
  values (p_fatia, 'pegou', '', auth.uid());

  return f;
end $$;

create or replace function public.soltar_a_fatia(p_fatia uuid)
returns public.fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
begin
  if not public.posso_a_acao('kanban.pegar') then
    raise exception 'Seu acesso não permite soltar o cartão.' using errcode = '42501';
  end if;

  update public.fatia set pego_por = null, pego_em = null
   where id = p_fatia returning * into f;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
  values (p_fatia, 'soltou', '', auth.uid());

  return f;
end $$;

grant execute on function public.pegar_a_fatia(uuid)  to authenticated;
grant execute on function public.soltar_a_fatia(uuid) to authenticated;


-- ---------- 9. por e tirar a tag -------------------------------------------
create or replace function public.por_a_tag(p_fatia uuid, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fatia;
  t public.tag;
begin
  if not public.posso_a_acao('kanban.etiquetar') then
    raise exception 'Seu acesso não permite pôr tag no cartão.' using errcode = '42501';
  end if;

  select * into f from public.fatia where id = p_fatia;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  select * into t from public.tag where chave = p_tag;
  if not found then
    raise exception 'Esta tag não existe.' using errcode = 'P0002';
  end if;
  if not t.ativa then
    raise exception 'A tag % está aposentada.', t.nome using errcode = '23514';
  end if;

  /* A TAG SO ENTRA ONDE ELA VALE, e a conferencia e aqui e nao na tela. Uma
     tela que so oferece as tags certas e uma boa tela; um banco que so aceita
     as tags certas e o que faz a tela poder errar sem estragar o dado. */
  if not t.em_todo_posto
     and not exists (select 1 from public.tag_do_posto
                      where tag = p_tag and posto = f.etapa) then
    raise exception 'A tag % não vale no posto %.', t.nome, f.etapa using errcode = '23514';
  end if;

  insert into public.tag_da_fatia (fatia_id, tag, posta_por)
  values (p_fatia, p_tag, auth.uid())
  on conflict (fatia_id, tag) do nothing;

  if found then
    insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
    values (p_fatia, 'tag', 'pôs ' || t.nome, auth.uid());
  end if;
end $$;

create or replace function public.tirar_a_tag(p_fatia uuid, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  if not public.posso_a_acao('kanban.etiquetar') then
    raise exception 'Seu acesso não permite tirar tag do cartão.' using errcode = '42501';
  end if;

  select t.nome into nome from public.tag t where t.chave = p_tag;
  delete from public.tag_da_fatia where fatia_id = p_fatia and tag = p_tag;
  if found then
    insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
    values (p_fatia, 'tag', 'tirou ' || coalesce(nome, p_tag), auth.uid());
  end if;
end $$;

grant execute on function public.por_a_tag(uuid, text)   to authenticated;
grant execute on function public.tirar_a_tag(uuid, text) to authenticated;


-- ---------- 10. falar na conversa do cartao --------------------------------
create or replace function public.comentar_na_fatia(p_fatia uuid, p_texto text)
returns public.evento_da_fatia
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.evento_da_fatia;
begin
  if not public.posso_a_acao('kanban.comentar') then
    raise exception 'Seu acesso não permite escrever na conversa do cartão.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_texto, ''))) < 2 then
    raise exception 'Escreva o recado antes de enviar.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.fatia where id = p_fatia) then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
  values (p_fatia, 'fala', btrim(p_texto), auth.uid())
  returning * into e;
  return e;
end $$;

grant execute on function public.comentar_na_fatia(uuid, text) to authenticated;


-- ---------- 11. o posto que muda tambem escreve na linha do tempo ----------
-- O gatilho da 023 ja carimba etapa_em. O que faltava era dizer isso na linha
-- do tempo, e SOLTAR o cartao: quem terminou na costura nao continua com ele
-- na mao depois que ele foi para a embalagem.
create or replace function public.fatia_conta_o_que_andou()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into public.evento_da_fatia (fatia_id, tipo, texto, quem)
    values (new.id, 'posto', old.etapa::text || ' para ' || new.etapa::text, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists fatia_conta_o_que_andou on public.fatia;
create trigger fatia_conta_o_que_andou
  after update on public.fatia
  for each row execute function public.fatia_conta_o_que_andou();

-- soltar mora no gatilho BEFORE que ja existe, e nao num segundo AFTER: quem
-- escreve na propria linha tem que escrever antes de ela ser gravada
create or replace function public.fatia_no_lugar()
returns trigger
language plpgsql
as $$
begin
  if public.ordem_na_rota(new.tecnica, new.etapa) is null then
    raise exception 'A rota de % nao passa por %.', new.tecnica, new.etapa
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_em := now();
    /* o cartao que andou de posto sai da mao de quem estava com ele */
    new.pego_por := null;
    new.pego_em  := null;
  end if;
  if new.etapa = 'finalizado' then
    if new.fechado_em is null then new.fechado_em := now(); end if;
  else
    new.fechado_em := null;
  end if;
  return new;
end $$;


-- ---------- 12. o vizinho na rota, agora tambem no banco -------------------
-- A tela ja sabia calcular o proximo posto; o banco nao, e era ele quem
-- precisava, porque e ele quem responde a conferencia do Terminei. Duas contas
-- do mesmo caminho em duas linguagens e o comeco de duas respostas diferentes.
create or replace function public.vizinho_na_rota(
  p_tecnica text,
  p_posto public.etapa_da_producao
) returns public.etapa_da_producao
language sql
stable
as $$
  select posto from public.rota_da_tecnica
   where tecnica = p_tecnica
     and ordem > coalesce(public.ordem_na_rota(p_tecnica, p_posto), -1)
   order by ordem limit 1
$$;

grant execute on function public.vizinho_na_rota(text, public.etapa_da_producao) to authenticated;


-- ---------- 13. a conferencia do Terminei ----------------------------------
-- UMA FUNCAO SO, e a tela nao decide nada: ela desenha o que esta funcao
-- respondeu. Se a regra morasse na tela, o mesmo Terminei dado por um PATCH
-- direto no PostgREST passaria sem conferir coisa nenhuma.
--
-- Ela devolve uma lista, e cada item tem um tom: 'ok' e o que esta certo,
-- 'atencao' e o que a maquina nao pode decidir sozinha, e 'nota' e o que e bom
-- saber e nao impede. Nenhum deles TRAVA: travar e papel do gatilho da rota.
create or replace function public.conferir_a_saida(p_fatia uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f        public.fatia;
  ped      public.pedido;
  itens    jsonb := '[]'::jsonb;
  proximo  public.etapa_da_producao;
  n_res    int;
  n_falta  int;
  presas   text;
  atras    int;
begin
  select * into f from public.fatia where id = p_fatia;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  select * into ped from public.pedido where id = f.pedido_id;

  select public.vizinho_na_rota(f.tecnica, f.etapa) into proximo;

  /* 1. o material */
  select count(*), count(*) filter (where not baixada)
    into n_res, n_falta
    from public.reserva where pedido_id = f.pedido_id;

  if n_res = 0 then
    itens := itens || jsonb_build_object(
      'tom', 'nota', 'titulo', 'Este pedido não tem reserva de material',
      'linha', 'Nada a conferir na prateleira.');
  elsif n_falta = 0 then
    itens := itens || jsonb_build_object(
      'tom', 'ok', 'titulo', 'O material saiu da prateleira',
      'linha', n_res || ' linha(s) de reserva, todas baixadas na separação.');
  else
    itens := itens || jsonb_build_object(
      'tom', 'atencao', 'titulo', 'Ainda há material não separado',
      'linha', n_falta || ' de ' || n_res || ' linha(s) de reserva sem baixa.');
  end if;

  /* 2. as tags presas no cartao */
  select string_agg(t.nome, ', ' order by t.ordem)
    into presas
    from public.tag_da_fatia tf join public.tag t on t.chave = tf.tag
   where tf.fatia_id = p_fatia;

  if presas is null then
    itens := itens || jsonb_build_object(
      'tom', 'ok', 'titulo', 'Nenhuma tag pendurada no cartão',
      'linha', 'Nada segurando este trabalho aqui.');
  else
    itens := itens || jsonb_build_object(
      'tom', 'atencao', 'titulo', 'Tag ainda posta: ' || presas,
      'linha', 'Se já resolveu, tire a tag antes de mandar para a frente.');
  end if;

  /* 3. o resto do pedido */
  select count(*) into atras
    from public.fatia o
   where o.pedido_id = f.pedido_id and o.id <> p_fatia and o.fechado_em is null;

  if atras > 0 then
    itens := itens || jsonb_build_object(
      'tom', 'nota', 'titulo', 'Este pedido tem mais ' || atras || ' cartão(ões) abertos',
      'linha', 'O pedido só fecha quando o último fechar.');
  end if;

  /* 4. o aviso que veio do PCP */
  if coalesce(ped.aviso, '') <> '' then
    itens := itens || jsonb_build_object(
      'tom', 'nota', 'titulo', 'O PCP deixou um aviso neste pedido',
      'linha', ped.aviso);
  end if;

  return jsonb_build_object(
    'fatia',   p_fatia,
    'numero',  ped.numero,
    'posto',   f.etapa,
    'proximo', proximo,
    'itens',   itens,
    'pode',    public.posso_a_acao('kanban.mover')
  );
end $$;

grant execute on function public.conferir_a_saida(uuid) to authenticated;


-- ---------- 14. o que o quadro le ------------------------------------------
-- AS TAGS MESTRE NAO SAO COPIADAS PARA CA, e sim lidas da cotacao na hora.
--
-- O vendedor congelado da 019 foi copiado de proposito, porque ele responde
-- "quem vendeu isto", uma pergunta sobre o passado, e a resposta nao pode
-- mudar quando a pessoa troca de time. A tag mestre responde "o que este
-- pedido e AGORA": marcar um pedido como VIP depois dele ter descido tem que
-- acender o cartao no mesmo instante. Copiar transformaria a tag mestre numa
-- foto, e a primeira vez que alguem marcasse urgente sem ver efeito nenhum no
-- quadro, a funcionalidade inteira perderia a confianca da fabrica.
drop view if exists public.fatia_na_fabrica;
create view public.fatia_na_fabrica
with (security_invoker = true) as
select f.id,
       f.pedido_id,
       p.numero,
       coalesce(nullif(btrim(p.nome), ''), cl.nome, c.cliente_nome, '') as nome,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       f.tecnica,
       f.etapa,
       f.etapa_em,
       f.fechado_em,
       f.layouts,
       f.pecas,
       public.ordem_na_rota(f.tecnica, f.etapa) as ordem_na_rota,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.aviso,
       p.estado,
       p.teste,
       f.pego_por,
       f.pego_em,
       coalesce(qp.nome, '') as pego_por_nome,
       /* as tags mestre, lidas da cotacao */
       coalesce(
         (select array_agg(x) from jsonb_array_elements_text(
            case jsonb_typeof(c.corpo -> 'producao' -> 'marcas')
              when 'array' then c.corpo -> 'producao' -> 'marcas'
              else '[]'::jsonb
            end) x),
         '{}') as marcas,
       /* as tags do posto postas neste cartao */
       coalesce(
         (select array_agg(tf.tag order by t.ordem)
            from public.tag_da_fatia tf
            join public.tag t on t.chave = tf.tag
           where tf.fatia_id = f.id),
         '{}') as tags,
       (select count(*) from public.evento_da_fatia e
         where e.fatia_id = f.id and e.tipo = 'fala') as falas
  from public.fatia f
  join public.pedido p  on p.id = f.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
  left join public.equipe qp  on qp.id = f.pego_por
 where p.estado <> 'cancelado';

grant select on public.fatia_na_fabrica to authenticated;

-- a linha do tempo com o nome de quem falou. Vem da view equipe e nao da
-- tabela pessoa pelo mesmo motivo da 032: a regra da pessoa deixa cada um ver
-- so a propria linha, entao juntar pessoa aqui devolveria nome vazio
create or replace view public.linha_do_tempo_da_fatia
with (security_invoker = true) as
select e.id,
       e.fatia_id,
       e.tipo,
       e.texto,
       e.em,
       e.quem,
       coalesce(q.nome, '') as quem_nome
  from public.evento_da_fatia e
  left join public.equipe q on q.id = e.quem;

grant select on public.linha_do_tempo_da_fatia to authenticated;


-- ---------- 15. a conferencia ----------------------------------------------
do $$
declare
  n int;
begin
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='tag') then
    raise exception 'a tabela tag nao existe';
  end if;
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='evento_da_fatia') then
    raise exception 'a tabela evento_da_fatia nao existe';
  end if;

  select count(*) into n from public.tag;
  if n < 7 then raise exception 'as tags de partida nao entraram: %', n; end if;

  select count(*) into n from public.acao
   where chave in ('kanban.pegar','kanban.etiquetar','kanban.comentar');
  if n <> 3 then raise exception 'as tres acoes novas nao entraram: %', n; end if;

  select count(*) into n from public.permissao_da_acao
   where acao in ('kanban.pegar','kanban.etiquetar','kanban.comentar');
  if n = 0 then raise exception 'nenhum papel recebeu as acoes novas'; end if;

  -- a coluna nova do pedido e as duas da fatia
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='pedido' and column_name='nome') then
    raise exception 'pedido.nome nao existe';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fatia' and column_name='pego_em') then
    raise exception 'fatia.pego_em nao existe';
  end if;

  -- a view tem que devolver marcas e tags, senao o cartao nasce sem etiqueta
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fatia_na_fabrica'
                    and column_name='marcas') then
    raise exception 'a view perdeu a coluna marcas';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fatia_na_fabrica'
                    and column_name='tags') then
    raise exception 'a view perdeu a coluna tags';
  end if;

  -- as cinco funcoes novas, e as tres que escrevem tem que perguntar a matriz
  perform 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname='public' and p.proname='conferir_a_saida';
  if not found then raise exception 'conferir_a_saida nao existe'; end if;

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('pegar_a_fatia','soltar_a_fatia','por_a_tag','tirar_a_tag','comentar_na_fatia')
     and pg_get_functiondef(p.oid) like '%posso_a_acao%';
  if n <> 5 then
    raise exception 'alguma funcao que escreve nao pergunta a matriz: % de 5', n;
  end if;

  -- o cartao que anda de posto tem que sair da mao de quem estava com ele
  if position('new.pego_por := null' in
       (select pg_get_functiondef(p.oid) from pg_proc p
          join pg_namespace ns on ns.oid = p.pronamespace
         where ns.nspname='public' and p.proname='fatia_no_lugar')) = 0 then
    raise exception 'fatia_no_lugar nao solta o cartao quando ele muda de posto';
  end if;

  raise notice 'tudo passou: tags, linha do tempo, pegar, conferir a saida';
end $$;
