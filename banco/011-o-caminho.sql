-- ============================================================
-- Fourtime OS - 011 o caminho: lead, cotacao e pedido
-- ============================================================
-- Esta e a migracao que liga as pontas do sistema. Ate aqui o banco tinha
-- quem usa (pessoa), para quem se vende (cliente) e as listas da fabrica.
-- Faltava o caminho que o dinheiro percorre:
--
--   anuncio -> lead -> cliente -> cotacao -> pedido -> producao
--
-- Ele esta desenhado em claude/CAMINHO-COMPLETO-DO-SISTEMA.md, e a regra da
-- comissao que atravessa esse caminho esta em
-- claude/DECISAO-DONO-DO-LEAD-E-COMISSAO.md.
--
-- A CORRENTE DA COMISSAO, que e o motivo de metade das colunas daqui:
--
--   lead.vendedor -> cotacao.vendedor -> pedido.vendedor
--
-- Quem recebe e o dono do lead gravado no sistema, e nunca o celular em que a
-- mensagem caiu. E o percentual CONGELA no pedido, no dia do sim.


-- ============================================================
-- 1. o contador dos numeros
-- ============================================================
-- Cotacao e pedido precisam de numero que nao repete nem quando duas pessoas
-- salvam no mesmo segundo. Sequence do Postgres serviria para o pedido, mas
-- nao para a cotacao, que reinicia todo ano. Uma linha por contador resolve os
-- dois com a mesma regra, e o update atomico e quem garante que nao repete.

create table public.contador (
  chave text primary key,
  valor int  not null default 0
);

alter table public.contador enable row level security;

-- Nenhum grant de proposito: ninguem toca nesta tabela pela API. Quem mexe
-- sao as duas funcoes abaixo, e elas sao security definer justamente para
-- isso: o numero nao pode ser escolhido a mao por quem esta salvando.

create or replace function public.proximo_numero_de_cotacao()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  n   int;
begin
  insert into public.contador (chave, valor) values ('cotacao-' || ano, 1)
  on conflict (chave) do update set valor = contador.valor + 1
  returning valor into n;
  return ano || '-' || lpad(n::text, 4, '0');
end $$;

create or replace function public.proximo_numero_de_pedido()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.contador (chave, valor) values ('pedido', 1)
  on conflict (chave) do update set valor = contador.valor + 1
  returning valor into n;
  return 'PD' || lpad(n::text, 6, '0');
end $$;

-- O pedido nao comeca do zero: a Fourtime ja numerou milhares deles no sistema
-- antigo, e dois pedidos com o mesmo numero e o comeco de uma confusao que
-- ninguem desfaz. HENRIQUE: troque 4052 pelo ultimo numero de pedido real
-- antes de usar para valer.
insert into public.contador (chave, valor) values ('pedido', 4052)
  on conflict (chave) do nothing;


-- ============================================================
-- 2. so os digitos do telefone
-- ============================================================
-- "(62) 99321-4455", "62993214455" e "+55 62 99321 4455" sao o mesmo telefone.
-- A regra que manda o lead para o dono da carteira depende de reconhecer isso,
-- e comparar texto cru faria a regra falhar em silencio, que e pior do que nao
-- ter regra: o vendedor perderia o proprio cliente sem entender por que.
--
-- immutable porque vira indice. Os oito ultimos digitos sao o que se compara:
-- o 9 na frente do celular e o 55 do pais entram e saem da base do Bling sem
-- aviso, e o final nunca muda.

create or replace function public.fim_do_telefone(t text)
returns text
language sql
immutable
parallel safe
as $$ select right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 8) $$;

create index cliente_por_telefone on public.cliente (public.fim_do_telefone(celular))
  where celular <> '';
create index cliente_por_telefone_fixo on public.cliente (public.fim_do_telefone(telefone))
  where telefone <> '';


-- ============================================================
-- 3. o dono da carteira
-- ============================================================
-- cliente.vendedor ja existe e e TEXTO: e o nome que veio do Bling, e ele fica
-- onde esta, porque e o unico registro de quem vendeu antes do sistema existir.
-- Ao lado dele entra o vinculo de verdade, que aponta para a pessoa.

alter table public.cliente
  add column vendedor_id uuid references public.pessoa (id) on delete set null;

create index cliente_por_vendedor on public.cliente (vendedor_id)
  where vendedor_id is not null;


-- ============================================================
-- 3b. o nome de quem vende
-- ============================================================
-- A tabela pessoa so deixa cada um ler o proprio cadastro, e esta certa: e ali
-- que mora email e foto. Mas o funil, a lista de cotacoes e a fila do rodizio
-- precisam escrever o NOME do vendedor na tela, e sem isso o cartao do colega
-- apareceria sem dono para todo mundo que nao e o administrador.
--
-- Entao sai uma porta estreita: quatro colunas, nenhuma delas particular.
-- A view nao leva security_invoker de proposito, e e isso que a faz passar por
-- cima da regra da tabela: ela roda com o direito de quem a criou. E o unico
-- lugar do banco onde isso e feito, e e por isso que ela nao tem email.

create view public.equipe as
select id, nome, papel, situacao from public.pessoa;

grant select on public.equipe to authenticated;


-- ============================================================
-- 4. o lead
-- ============================================================
-- O lead e uma CONVERSA que ainda nao virou pedido. Por isso o cartao do funil
-- mostra o trecho da ultima mensagem e o tempo desde ela, e nao um resumo de
-- cadastro: quem olha o funil esta perguntando de quem a conversa esta
-- esperando.

create type public.estagio as enum
  ('novo', 'atendimento', 'cotacao', 'negociando', 'fechado', 'perdido');

create table public.lead (
  id            uuid primary key default gen_random_uuid(),

  -- quem e
  nome          text not null default 'Novo lead',
  contato       text not null default '',
  telefone      text not null default '',
  /** existe quando o lead ja virou (ou sempre foi) um cliente cadastrado */
  cliente_id    uuid references public.cliente (id) on delete set null,

  -- onde esta
  estagio       public.estagio not null default 'novo',
  valor         numeric(12,2)  not null default 0,

  -- DE QUEM E. Este e o campo da comissao, e por isso ele nao e texto.
  vendedor_id   uuid references public.pessoa (id) on delete set null,
  /** desde quando e dele. A transferencia troca os dois juntos. */
  dono_desde    timestamptz,

  -- de onde veio. O ctwa_clid e o que a Meta devolve no primeiro webhook de
  -- quem clicou no anuncio, e e ele que volta pela Conversions API quando o
  -- pedido fecha: sem ele o anuncio nunca fica sabendo que deu venda.
  origem        text not null default 'whatsapp',
  anuncio       text not null default '',
  ctwa_clid     text not null default '',

  -- o que o cartao mostra sem abrir a conversa
  ultima_msg    text not null default '',
  ultima_msg_em timestamptz,
  nao_lidas     int  not null default 0,
  /** quando a janela de 24h de atendimento do WhatsApp fecha */
  janela_ate    timestamptz,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint lead_nome_nao_vazio check (btrim(nome) <> '')
);

create index lead_por_estagio     on public.lead (estagio, atualizado_em desc);
create index lead_por_vendedor    on public.lead (vendedor_id);
create index lead_por_cliente     on public.lead (cliente_id);
create index lead_por_telefone    on public.lead (public.fim_do_telefone(telefone))
  where telefone <> '';

create trigger lead_carimbo
  before update on public.lead
  for each row execute function public.carimbar_atualizacao();

alter table public.lead enable row level security;

-- O funil e um quadro da equipe: todo mundo ve todos os leads. Esconder o lead
-- dos outros e o que faz o vendedor achar que o sistema esconde tambem o dele.
create policy "quem foi aprovado le lead"
  on public.lead for select to authenticated using (public.meu_papel() is not null);

create policy "admin, gerente e vendedor criam lead"
  on public.lead for insert to authenticated
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

create policy "admin, gerente e vendedor mexem no lead"
  on public.lead for update to authenticated
  using (public.meu_papel() in ('admin','gerente','vendedor'))
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

-- Apagar lead e do admin, e nao do vendedor. Nao e desconfianca: o lead leva a
-- conversa inteira junto, com os audios, e quem apaga por engano nao tem como
-- trazer de volta. Lead que nao deu em nada vai para 'perdido', que e a forma
-- de sumir da tela sem sumir do historico.
create policy "so o admin apaga lead"
  on public.lead for delete to authenticated
  using (public.sou_admin());

grant select, insert, update, delete on public.lead to authenticated;


-- ============================================================
-- 5. a transferencia
-- ============================================================
-- Historico, e nao um campo que sobrescreve. Sem esse registro a transferencia
-- vira discussao de memoria tres meses depois, que e exatamente o que o numero
-- unico de WhatsApp existe para acabar.

create table public.transferencia_de_lead (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.lead (id) on delete cascade,
  de_quem    uuid references public.pessoa (id) on delete set null,
  para_quem  uuid not null references public.pessoa (id) on delete cascade,
  motivo     text not null default '',
  quem_fez   uuid references public.pessoa (id) on delete set null,
  em         timestamptz not null default now()
);

create index transferencia_por_lead on public.transferencia_de_lead (lead_id, em desc);

alter table public.transferencia_de_lead enable row level security;

create policy "quem foi aprovado le a transferencia"
  on public.transferencia_de_lead for select to authenticated using (public.meu_papel() is not null);

-- Ninguem edita nem apaga: historico que se apaga nao e historico.
create policy "so o admin transfere"
  on public.transferencia_de_lead for insert to authenticated
  with check (public.sou_admin());

grant select, insert on public.transferencia_de_lead to authenticated;

-- A transferencia inteira num pedido so: grava o historico e troca o dono.
-- Junto de proposito, porque gravar um sem o outro deixa o sistema mentindo.
create or replace function public.transferir_lead(
  p_lead uuid, p_para uuid, p_motivo text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare atual uuid;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador transfere lead.' using errcode = '42501';
  end if;

  select vendedor_id into atual from public.lead where id = p_lead for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.transferencia_de_lead (lead_id, de_quem, para_quem, motivo, quem_fez)
  values (p_lead, atual, p_para, coalesce(p_motivo, ''), auth.uid());

  update public.lead
     set vendedor_id = p_para, dono_desde = now()
   where id = p_lead;
end $$;

grant execute on function public.transferir_lead(uuid, uuid, text) to authenticated;


-- ============================================================
-- 6. a conversa
-- ============================================================
-- Audio e arquivo nao ficam aqui: ficam no balde do Storage, e a linha guarda
-- o caminho. Base64 de audio dentro da tabela deixaria a lista do funil lenta
-- para sempre, por causa de um audio que ninguem vai ouvir de novo.

create type public.quem_falou as enum ('nos', 'cliente', 'sistema');
create type public.tipo_de_mensagem as enum ('texto', 'audio', 'imagem', 'arquivo', 'modelo');

create table public.mensagem (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.lead (id) on delete cascade,
  quem        public.quem_falou not null,
  tipo        public.tipo_de_mensagem not null default 'texto',
  texto       text not null default '',
  /** caminho dentro do balde, para audio, imagem e arquivo */
  arquivo     text not null default '',
  nome_do_arquivo text not null default '',
  /** o id da mensagem la na Meta, para casar o recibo de entrega com a linha */
  id_externo  text not null default '',
  /** enviado, entregue, lido, falhou */
  situacao    text not null default '',
  /** quem da equipe mandou. Null quando quem falou foi o cliente. */
  pessoa_id   uuid references public.pessoa (id) on delete set null,
  em          timestamptz not null default now()
);

create index mensagem_por_lead on public.mensagem (lead_id, em);
create unique index mensagem_id_externo on public.mensagem (id_externo)
  where id_externo <> '';

alter table public.mensagem enable row level security;

create policy "quem foi aprovado le a conversa"
  on public.mensagem for select to authenticated using (public.meu_papel() is not null);

create policy "admin, gerente e vendedor falam"
  on public.mensagem for insert to authenticated
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

-- update existe so para o recibo de entrega; apagar mensagem, nao.
create policy "admin, gerente e vendedor atualizam a situacao"
  on public.mensagem for update to authenticated
  using (public.meu_papel() in ('admin','gerente','vendedor'))
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

grant select, insert, update on public.mensagem to authenticated;


-- ============================================================
-- 7. a cotacao
-- ============================================================
-- POR QUE O DOCUMENTO INTEIRO VAI NUM jsonb, e nao em cinco tabelas.
--
-- A cotacao ja e um formato versionado, o .cft, com uma escada de migracao que
-- sobe o documento antigo ate o formato de hoje (claude/REGRA-ESCADA-*.md).
-- Espalhar esse documento em produto_cotado, ajuste, informe e grade criaria
-- uma SEGUNDA escada, a do banco, que teria que andar junto com a primeira
-- para sempre. Duas escadas para o mesmo documento e a receita de um dia elas
-- discordarem, e o dia em que discordarem e o dia em que uma cotacao aprovada
-- abre errada.
--
-- Entao o documento continua sendo UM: o mesmo objeto que ja vai no .cft, com
-- a sua versao do lado. A escada continua sendo uma so, a que ja existe e ja
-- foi testada.
--
-- O que o sistema PROCURA sai do corpo e vira coluna: numero, cliente, estado,
-- vendedor, total, pecas, validade. Assim a lista de cotacoes e o relatorio de
-- comissao nunca carregam o corpo, que tem as imagens dos layouts dentro.
-- A regra de ouro do lado do app: `select` da lista NUNCA pede a coluna corpo.

create type public.estado_da_cotacao as enum
  ('rascunho', 'enviada', 'aprovada', 'recusada', 'vencida');

create table public.cotacao (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,

  -- o documento
  corpo         jsonb not null,
  versao_do_formato int not null,

  -- o que se procura sem abrir o documento
  cliente_id    uuid references public.cliente (id) on delete set null,
  cliente_nome  text not null default '',
  lead_id       uuid references public.lead (id) on delete set null,
  estado        public.estado_da_cotacao not null default 'rascunho',
  vendedor_id   uuid references public.pessoa (id) on delete set null,
  total         numeric(12,2) not null default 0,
  pecas         int           not null default 0,
  valida_ate    date,

  criada_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint cotacao_numero_nao_vazio check (btrim(numero) <> '')
);

create index cotacao_por_cliente  on public.cotacao (cliente_id);
create index cotacao_por_estado   on public.cotacao (estado, atualizado_em desc);
create index cotacao_por_vendedor on public.cotacao (vendedor_id);
create index cotacao_por_lead     on public.cotacao (lead_id);

create trigger cotacao_carimbo
  before update on public.cotacao
  for each row execute function public.carimbar_atualizacao();

alter table public.cotacao enable row level security;

create policy "quem foi aprovado le cotacao"
  on public.cotacao for select to authenticated using (public.meu_papel() is not null);

create policy "admin, gerente e vendedor mexem na cotacao"
  on public.cotacao for all to authenticated
  using (public.meu_papel() in ('admin','gerente','vendedor'))
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

grant select, insert, update, delete on public.cotacao to authenticated;

-- A lista da tela, sem o corpo. Existe para ninguem esquecer e pedir a tabela
-- inteira sem querer: quem pede a view nao consegue carregar as imagens.
create view public.cotacao_na_lista
with (security_invoker = true) as
select c.id, c.numero, c.cliente_id, c.cliente_nome, c.lead_id, c.estado,
       c.vendedor_id, p.nome as vendedor_nome, c.total, c.pecas, c.valida_ate,
       c.criada_em, c.atualizado_em
from public.cotacao c
left join public.equipe p on p.id = c.vendedor_id;

grant select on public.cotacao_na_lista to authenticated;


-- ============================================================
-- 8. a comissao
-- ============================================================
-- A tabela do que cada vendedor ganha HOJE. O pedido nao le daqui na hora do
-- relatorio: ele copia o numero no dia do sim e nunca mais mexe. Se em
-- novembro a tabela mudar, os pedidos de setembro continuam de setembro.

create table public.comissao_do_vendedor (
  pessoa_id  uuid primary key references public.pessoa (id) on delete cascade,
  pct        numeric(5,2) not null default 0,
  atualizado_em timestamptz not null default now(),

  constraint comissao_pct_no_intervalo check (pct >= 0 and pct <= 100)
);

alter table public.comissao_do_vendedor enable row level security;

-- Cada um ve o seu; o admin ve todos. O percentual do colega e a informacao que
-- mais azeda equipe comercial, e ela nao precisa estar exposta para o sistema
-- funcionar.
create policy "vendedor le a propria comissao, admin le todas"
  on public.comissao_do_vendedor for select to authenticated
  using (pessoa_id = auth.uid() or public.sou_admin());

create policy "so o admin define comissao"
  on public.comissao_do_vendedor for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

grant select, insert, update, delete on public.comissao_do_vendedor to authenticated;


-- ============================================================
-- 9. o pedido
-- ============================================================
-- O pedido nasce do sim do cliente. Ele e o que a fabrica conhece pelo numero,
-- e e a linha que o relatorio de comissao le.

create type public.estado_do_pedido as enum
  ('aprovado', 'producao', 'pronto', 'enviado', 'entregue', 'cancelado');

create table public.pedido (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,

  cotacao_id  uuid not null references public.cotacao (id) on delete restrict,
  cliente_id  uuid references public.cliente (id) on delete set null,
  lead_id     uuid references public.lead (id) on delete set null,

  estado      public.estado_do_pedido not null default 'aprovado',
  total       numeric(12,2) not null default 0,
  pecas       int not null default 0,

  -- A COMISSAO, CONGELADA. As duas colunas sao copia, e nao vinculo: o
  -- vendedor pode sair da empresa e o pedido continua sabendo de quem foi.
  vendedor_id uuid references public.pessoa (id) on delete set null,
  vendedor_nome text not null default '',
  comissao_pct  numeric(5,2) not null default 0,

  -- qual versao enviada o cliente aprovou, e quem registrou o sim
  versao_aprovada int not null default 1,
  aprovado_por  uuid references public.pessoa (id) on delete set null,
  aprovado_em   timestamptz not null default now(),

  -- o que a fabrica precisa saber
  data_de_envio date,
  departamento  text not null default '',

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint pedido_pct_no_intervalo check (comissao_pct >= 0 and comissao_pct <= 100)
);

create index pedido_por_cliente  on public.pedido (cliente_id);
create index pedido_por_vendedor on public.pedido (vendedor_id, aprovado_em desc);
create index pedido_por_estado   on public.pedido (estado, atualizado_em desc);
create unique index pedido_uma_cotacao on public.pedido (cotacao_id);

create trigger pedido_carimbo
  before update on public.pedido
  for each row execute function public.carimbar_atualizacao();

alter table public.pedido enable row level security;

create policy "quem foi aprovado le pedido"
  on public.pedido for select to authenticated using (public.meu_papel() is not null);

create policy "admin, gerente e vendedor criam pedido"
  on public.pedido for insert to authenticated
  with check (public.meu_papel() in ('admin','gerente','vendedor'));

-- A producao precisa andar com o estado do pedido, e por isso ela entra aqui.
create policy "quem foi aprovado anda com o pedido"
  on public.pedido for update to authenticated
  using (public.meu_papel() is not null)
  with check (public.meu_papel() is not null);

create policy "so o admin apaga pedido"
  on public.pedido for delete to authenticated
  using (public.sou_admin());

grant select, insert, update, delete on public.pedido to authenticated;


-- ============================================================
-- 10. a passagem: a cotacao vira pedido
-- ============================================================
-- Num pedido so, porque as cinco coisas que acontecem no sim tem que acontecer
-- juntas ou nenhuma: tirar o numero, congelar a comissao, marcar a cotacao
-- como aprovada, fechar o lead e avisar quem ganhou. Meia aprovacao gravada e
-- uma cotacao que a tela mostra aprovada e a fabrica nunca ve.

create or replace function public.aprovar_cotacao(
  p_cotacao uuid, p_versao int default 1
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  c    public.cotacao;
  pct  numeric(5,2);
  nome text;
  novo public.pedido;
begin
  if public.meu_papel() not in ('admin','gerente','vendedor') then
    raise exception 'Seu acesso não permite aprovar cotação.' using errcode = '42501';
  end if;

  select * into c from public.cotacao where id = p_cotacao for update;
  if not found then
    raise exception 'Cotação não encontrada.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.pedido where cotacao_id = p_cotacao) then
    raise exception 'Esta cotação já virou pedido.' using errcode = '23505';
  end if;

  -- O percentual do dia. Vendedor sem linha na tabela entra com zero em vez de
  -- travar a aprovacao: o cliente ja disse sim, e segurar o pedido por causa de
  -- um cadastro faltando seria o sistema atrapalhando a venda.
  select coalesce(k.pct, 0), coalesce(p.nome, '')
    into pct, nome
    from public.pessoa p
    left join public.comissao_do_vendedor k on k.pessoa_id = p.id
   where p.id = c.vendedor_id;

  insert into public.pedido (
    numero, cotacao_id, cliente_id, lead_id, total, pecas,
    vendedor_id, vendedor_nome, comissao_pct, versao_aprovada, aprovado_por
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, coalesce(nome, ''), coalesce(pct, 0), p_versao, auth.uid()
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  return novo;
end $$;

grant execute on function public.aprovar_cotacao(uuid, int) to authenticated;


-- ============================================================
-- 11. o relatorio de comissao
-- ============================================================
-- Mes a mes, pedido a pedido. A tela do vendedor abre daqui sozinha, sem pedir
-- para ninguem, que e a terceira das tres coisas que fazem a equipe aceitar o
-- numero unico de WhatsApp.
--
-- security_invoker: a view respeita a policy de pedido, e o filtro de quem ve o
-- que esta escrito aqui embaixo, na propria consulta.

create view public.comissao_por_pedido
with (security_invoker = true) as
select p.id,
       p.numero,
       p.aprovado_em,
       date_trunc('month', p.aprovado_em at time zone 'America/Sao_Paulo')::date as mes,
       p.vendedor_id,
       p.vendedor_nome,
       p.cliente_id,
       cl.nome as cliente_nome,
       p.total,
       p.comissao_pct,
       round(p.total * p.comissao_pct / 100, 2) as comissao,
       p.estado
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
 where p.estado <> 'cancelado'
   and (p.vendedor_id = auth.uid() or public.sou_admin());

grant select on public.comissao_por_pedido to authenticated;

create view public.comissao_por_mes
with (security_invoker = true) as
select mes, vendedor_id, vendedor_nome,
       count(*)      as pedidos,
       sum(total)    as vendido,
       sum(comissao) as comissao
  from public.comissao_por_pedido
 group by mes, vendedor_id, vendedor_nome;

grant select on public.comissao_por_mes to authenticated;


-- ============================================================
-- 12. o rodizio
-- ============================================================
-- Fila aberta vira corrida, e corrida premia quem esta com o celular na mao, e
-- nao quem vende melhor. Entao o lead novo e distribuido, um de cada vez, e a
-- fila e VISIVEL: o vendedor tem que poder ver que o proximo e dele. Regra
-- escondida, ninguem confia.

create table public.rodizio (
  pessoa_id uuid primary key references public.pessoa (id) on delete cascade,
  ordem     int  not null default 0,
  ativo     boolean not null default true,
  /** quantos leads ja levou. E o que decide de quem e a vez. */
  levou     int  not null default 0,
  ultimo_em timestamptz
);

alter table public.rodizio enable row level security;

create policy "quem foi aprovado ve a fila"
  on public.rodizio for select to authenticated using (public.meu_papel() is not null);

create policy "so o admin mexe na fila"
  on public.rodizio for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

grant select, insert, update, delete on public.rodizio to authenticated;

-- De quem e este lead. As duas regras, nesta ordem:
--   1. telefone conhecido vai para o dono da carteira  (protege o vendedor)
--   2. telefone novo entra no rodizio                  (nao premia velocidade)
create or replace function public.dono_do_lead(p_telefone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fim  text := public.fim_do_telefone(p_telefone);
  quem uuid;
begin
  if fim <> '' then
    select c.vendedor_id into quem
      from public.cliente c
     where c.vendedor_id is not null
       and (public.fim_do_telefone(c.celular) = fim
         or public.fim_do_telefone(c.telefone) = fim)
     order by c.atualizado_em desc
     limit 1;
    if quem is not null then return quem; end if;
  end if;

  select r.pessoa_id into quem
    from public.rodizio r
    join public.pessoa p on p.id = r.pessoa_id and p.situacao = 'aprovado'
   where r.ativo
   order by r.levou asc, r.ordem asc
   limit 1;

  if quem is not null then
    update public.rodizio
       set levou = levou + 1, ultimo_em = now()
     where pessoa_id = quem;
  end if;

  return quem;
end $$;

grant execute on function public.dono_do_lead(text) to authenticated;

-- A porta de entrada do lead novo, que o webhook do WhatsApp vai chamar na
-- etapa C: acha o lead aberto daquele telefone, ou cria um ja com dono.
create or replace function public.lead_do_telefone(
  p_telefone text, p_nome text default '', p_ctwa text default '', p_anuncio text default ''
) returns public.lead
language plpgsql
security definer
set search_path = public
as $$
declare
  fim text := public.fim_do_telefone(p_telefone);
  l   public.lead;
  cli public.cliente;
begin
  select * into l from public.lead
   where public.fim_do_telefone(telefone) = fim
     and estagio not in ('fechado','perdido')
   order by atualizado_em desc limit 1;
  if found then return l; end if;

  select * into cli from public.cliente
   where public.fim_do_telefone(celular) = fim
      or public.fim_do_telefone(telefone) = fim
   limit 1;

  insert into public.lead (
    nome, contato, telefone, cliente_id, vendedor_id, dono_desde, ctwa_clid, anuncio
  ) values (
    coalesce(nullif(btrim(coalesce(cli.nome, p_nome)), ''), 'Novo lead'),
    coalesce(nullif(cli.contato, ''), p_nome, ''),
    p_telefone,
    cli.id,
    public.dono_do_lead(p_telefone),
    now(),
    coalesce(p_ctwa, ''),
    coalesce(p_anuncio, '')
  ) returning * into l;

  return l;
end $$;

grant execute on function public.lead_do_telefone(text, text, text, text) to authenticated;


-- ============================================================
-- 13. a passagem: o lead vira cliente
-- ============================================================
-- O lead vira cliente com o nome que ja esta na conversa, e o dono do lead
-- vira o dono da carteira no mesmo instante. Se o nome ja existir na base, ele
-- se liga ao cliente que existe em vez de criar o segundo: foi a falta dessa
-- trava que virou 225 clientes em 900.

create or replace function public.lead_vira_cliente(p_lead uuid)
returns public.cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  l   public.lead;
  cli public.cliente;
begin
  if public.meu_papel() not in ('admin','gerente','vendedor') then
    raise exception 'Seu acesso não permite cadastrar cliente.' using errcode = '42501';
  end if;

  select * into l from public.lead where id = p_lead for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;

  if l.cliente_id is not null then
    select * into cli from public.cliente where id = l.cliente_id;
    if found then return cli; end if;
  end if;

  select * into cli from public.cliente
   where public.chave_do_nome(nome) = public.chave_do_nome(l.nome) limit 1;

  if not found then
    insert into public.cliente (nome, contato, celular, vendedor_id)
    values (l.nome, l.contato, l.telefone, l.vendedor_id)
    returning * into cli;
  elsif cli.vendedor_id is null and l.vendedor_id is not null then
    update public.cliente set vendedor_id = l.vendedor_id where id = cli.id
    returning * into cli;
  end if;

  update public.lead set cliente_id = cli.id where id = l.id;
  return cli;
end $$;

grant execute on function public.lead_vira_cliente(uuid) to authenticated;
