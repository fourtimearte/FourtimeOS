-- ============================================================
-- Fourtime OS - 020 o pedido no chao da fabrica
-- ============================================================
-- O caminho parava no sim do cliente. O PD-TESTE-0001 existe no banco e nao
-- aparece no kanban, na ficha nem no painel de atividades, porque a tabela
-- pedido so sabia o que o comercial precisa: numero, cliente, vendedor, total.
--
-- Falta o que a fabrica precisa, e e outra coisa: em que POSTO a peca esta,
-- para que DIA ela esta planejada, se falta tecido, e a divisao entre
-- sublimacao e o resto, que e o que o relatorio mensal soma.
--
-- DOIS ESTADOS, E ELES NAO SAO O MESMO. Isto e a decisao que mais importa aqui:
--
--   estado  o ciclo do PEDIDO      aprovado, producao, pronto, enviado,
--                                  entregue, cancelado
--   etapa   o POSTO dentro da fabrica  corte, subli, dtf, ... finalizado
--
-- Sao granularidades diferentes e as duas sao verdade ao mesmo tempo: um pedido
-- em "producao" esta em "costura". Guardar so uma perderia informacao; guardar
-- as duas soltas, uma hora elas discordam. Entao elas andam juntas por gatilho,
-- e nao pela memoria de quem clica: quando a etapa vira "finalizado", o estado
-- vira "pronto" sozinho.
--
-- UMA DATA SO PARA A ENTREGA. data_de_envio ja existia, vinda da ficha de
-- producao da cotacao, e e a mesma data que o kanban chama de entrega. Nao
-- entra uma segunda: duas datas de entrega na mesma linha e a receita de a
-- tela mostrar uma e a fabrica trabalhar pela outra.

create type public.etapa_da_producao as enum (
  'corte', 'subli', 'dtf', 'prensa', 'silk', 'bordado', 'calandra', 'futurize',
  'conferencia', 'cd-costura', 'costura', 'embalagem', 'finalizado'
);

alter table public.pedido
  add column etapa public.etapa_da_producao not null default 'corte',
  /* quando a etapa mudou pela ultima vez. A coluna "Atualizacao" do kanban le
     daqui: ela nao diz so em que posto o pedido esta, diz se isso ainda vale.
     Tres dias parado e ou pedido travado ou apontamento que ninguem fez. */
  add column etapa_em timestamptz not null default now(),

  /* para que DIA a fabrica planejou, e se foi alguem que escolheu */
  add column planejado_em date,
  add column planejamento_manual boolean not null default false,

  /* Lista, e nao texto livre: "falta tecido", "sem tecido" e "tecido nao
     chegou" escritos por tres pessoas viram tres avisos no filtro e um so na
     fabrica. Vazio quer dizer sem aviso. */
  add column aviso text not null default '',

  /* o que a ficha e o relatorio precisam, congelado na aprovacao: o documento
     pode ser editado depois, e o que a fabrica cortou nao muda por isso */
  add column layouts int not null default 0,
  add column tecnicas text[] not null default '{}',
  add column pecas_subli int not null default 0,
  add column pecas_personalizadas int not null default 0,
  add column valor_subli numeric(12,2) not null default 0,
  add column valor_personalizado numeric(12,2) not null default 0,

  /* quando saiu da fabrica. E o que o relatorio mensal soma por mes. */
  add column fechado_em timestamptz;

alter table public.pedido
  add constraint pedido_aviso_conhecido check (aviso in ('', 'falta-tecido'));

create index pedido_por_etapa on public.pedido (etapa, etapa_em desc);
create index pedido_planejado on public.pedido (planejado_em)
  where planejado_em is not null;
create index pedido_fechado on public.pedido (fechado_em)
  where fechado_em is not null;


-- ---------- a etapa e o estado andam juntos -------------------------------
-- Por gatilho, e nao pela memoria de quem clica. A tela do kanban mexe na
-- etapa; o estado do pedido segue sozinho. Quem arrasta um cartao para
-- Finalizado nao deveria precisar lembrar de mudar mais nada.
create or replace function public.acertar_etapa_do_pedido()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_em := now();
  end if;

  if new.etapa = 'finalizado' then
    if new.fechado_em is null then new.fechado_em := now(); end if;
    /* enviado e entregue vem DEPOIS de pronto, e nao voltam para tras so
       porque a etapa continua marcada como finalizada */
    if new.estado in ('aprovado', 'producao') then new.estado := 'pronto'; end if;
  else
    new.fechado_em := null;
    if new.estado = 'pronto' then new.estado := 'producao'; end if;

    /* O pedido entra em producao no instante em que a fabrica ENCOSTA nele, e
       nao no instante em que o cliente diz sim. Um pedido aprovado parado no
       corte, que ninguem comecou, ainda e "aprovado"; assim que alguem arrasta
       o cartao, ele e "producao". Sem isto o kanban andaria e o estado do
       pedido continuaria dizendo que a fabrica nem sabe que ele existe. */
    if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa
       and new.estado = 'aprovado' then
      new.estado := 'producao';
    end if;
  end if;

  return new;
end $$;

create trigger pedido_acerta_a_etapa
  before insert or update on public.pedido
  for each row execute function public.acertar_etapa_do_pedido();


-- ---------- a aprovacao entrega o pedido pronto para a fabrica -------------
-- Os numeros da fabrica sao calculados pelo APLICATIVO e passados aqui, em vez
-- de o banco abrir o corpo do documento e somar.
--
-- E de proposito: quem sabe ler um bloco de layout, o que e uma tecnica e como
-- uma grade vira peca e o dominio em TypeScript, onde isso ja esta escrito e
-- testado. Ensinar a mesma coisa ao SQL seria a mesma regra em duas linguagens,
-- e no dia em que uma mudasse a outra ficaria mentindo em silencio.
--
-- Todos sao opcionais: uma aprovacao que nao passe nada continua funcionando e
-- grava zero, que e o que ja acontecia ate ontem.
create or replace function public.aprovar_cotacao(
  p_cotacao uuid,
  p_versao int default 1,
  p_layouts int default 0,
  p_tecnicas text[] default '{}',
  p_pecas_subli int default 0,
  p_pecas_personalizadas int default 0,
  p_valor_subli numeric default 0,
  p_valor_personalizado numeric default 0
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  c    public.cotacao;
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

  select p.nome into nome from public.pessoa p where p.id = c.vendedor_id;
  nome := coalesce(nullif(btrim(nome), ''), nullif(btrim(c.vendedor_nome), ''), '');

  insert into public.pedido (
    numero, cotacao_id, cliente_id, lead_id, total, pecas,
    vendedor_id, vendedor_nome, versao_aprovada, aprovado_por, teste,
    departamento, data_de_envio,
    layouts, tecnicas, pecas_subli, pecas_personalizadas,
    valor_subli, valor_personalizado
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, nome, p_versao, auth.uid(), public.pedido_em_teste(),
    /* o departamento e a data de envio ja estavam no documento, no bloco que
       veio da ficha de producao: eles descem para a linha do pedido agora */
    coalesce(c.corpo -> 'producao' ->> 'departamento', ''),
    nullif(c.corpo -> 'producao' ->> 'dataDeEnvio', '')::date,
    coalesce(p_layouts, 0), coalesce(p_tecnicas, '{}'),
    coalesce(p_pecas_subli, 0), coalesce(p_pecas_personalizadas, 0),
    coalesce(p_valor_subli, 0), coalesce(p_valor_personalizado, 0)
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  return novo;
end $$;

-- A assinatura mudou, entao a antiga continua existindo com outro numero de
-- argumentos. Ela sai: duas funcoes com o mesmo nome e comportamentos
-- diferentes e o tipo de armadilha que so aparece meses depois.
drop function if exists public.aprovar_cotacao(uuid, int);

grant execute on function public.aprovar_cotacao(
  uuid, int, int, text[], int, int, numeric, numeric) to authenticated;


-- ---------- o que a fabrica le --------------------------------------------
-- Tudo que o kanban, a ficha e o painel precisam, sem o comercial junto. Ela
-- NAO filtra por vendedor, ao contrario de venda_por_pedido: quem esta no
-- galpao precisa ver o pedido inteiro da casa, independente de quem vendeu.

create view public.pedido_na_fabrica
with (security_invoker = true) as
select p.id,
       p.numero,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       p.departamento,
       p.etapa,
       p.etapa_em,
       p.estado,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.planejamento_manual,
       p.aviso,
       p.pecas,
       p.layouts,
       p.tecnicas,
       p.total,
       p.pecas_subli,
       p.pecas_personalizadas,
       p.valor_subli,
       p.valor_personalizado,
       p.fechado_em,
       p.aprovado_em,
       p.teste,
       c.numero as cotacao_numero,
       c.id     as cotacao_id
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado';

grant select on public.pedido_na_fabrica to authenticated;
