-- ===========================================================================
-- 085: O CORPO FICA FECHADO E AS CHAVES GANHAM ÍNDICE (17/10/2026, auditoria)
--
-- 1. O CORPO DA COTAÇÃO NÃO SE ABRE LINHA A LINHA.
--
--    O corpo (011) é a cotação inteira num jsonb, COM AS IMAGENS dos layouts.
--    Quatro views tiravam dele um pedacinho em cada linha:
--
--      fatia_na_fabrica, pedido_na_fabrica   as marcas da produção (o kanban,
--                                            relido a cada 30 segundos)
--      frete_na_lista                        o telefone e o modo de entrega
--      frete_do_cliente                      o modo de entrega dos 10 últimos
--
--    O Postgres não abre um pedaço de jsonb: para ler corpo->'informe' ele
--    descomprime o corpo inteiro. Com as artes dentro, cada linha do kanban
--    custava megabytes, e a conta crescia com cada pedido novo.
--
--    O conserto: três colunas GERADAS na cotação, que o próprio banco calcula
--    quando o corpo é gravado (o app não escreve nelas e não muda nada):
--
--      entrega              corpo -> informe ->> entrega
--      telefone_do_cliente  corpo -> cliente ->> telefone
--      marcas               corpo -> producao -> marcas, como lista de texto
--
--    e as quatro views passam a ler as colunas. O resultado das views é o
--    mesmo, coluna por coluna (a conferência embaixo compara).
--
--    ATENÇÃO NA HORA DE RODAR: acrescentar coluna gerada reescreve a tabela
--    cotacao (calcula as três para cada cotação que existe). Com o corpo pesado
--    isso pode levar alguns segundos, e a cotação fica travada enquanto isso.
--    Rodar fora do horário de venda.
--
-- 2. A CHAVE ESTRANGEIRA GANHA ÍNDICE nas tabelas que crescem. Sem índice,
--    apagar um lead varre aviso_do_sino inteira, juntar dois clientes varre
--    juntada_de_cliente, e assim por diante. As de cadastro pequeno (papel,
--    painel, grupo) ficam sem, de propósito (testes/banco.mjs, EXCECOES).
--
-- 3. SAEM TRÊS ÍNDICES REPETIDOS, que só custavam na escrita:
--      cor_de_impressao_por_tecnica  igual ao único (tecnica, numero)
--      reserva_por_pedido            começo do único (pedido_id, material_id)
--      tag_da_fatia_por_fatia        começo da chave (fatia_id, tag)
--
-- Roda quantas vezes quiser.
-- ===========================================================================

-- ---------- 1. as colunas geradas --------------------------------------------
create or replace function public.marcas_do_corpo(p_corpo jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case jsonb_typeof(p_corpo -> 'producao' -> 'marcas')
           when 'array' then array(select jsonb_array_elements_text(p_corpo -> 'producao' -> 'marcas'))
         end
$$;
comment on function public.marcas_do_corpo(jsonb) is
  'As marcas da produção de um corpo de cotação, como lista de texto (085). Usada pela coluna gerada cotacao.marcas.';

alter table public.cotacao
  add column if not exists entrega text generated always as (corpo -> 'informe' ->> 'entrega') stored,
  add column if not exists telefone_do_cliente text generated always as (corpo -> 'cliente' ->> 'telefone') stored,
  add column if not exists marcas text[] generated always as (public.marcas_do_corpo(corpo)) stored;

comment on column public.cotacao.entrega is 'Gerada (085): corpo -> informe ->> entrega. Para as views não abrirem o corpo.';
comment on column public.cotacao.telefone_do_cliente is 'Gerada (085): corpo -> cliente ->> telefone. Para as views não abrirem o corpo.';
comment on column public.cotacao.marcas is 'Gerada (085): as marcas da produção (corpo -> producao -> marcas). Para o kanban não abrir o corpo.';

-- ---------- as views, lendo as colunas ----------------------------------------
create or replace view public.fatia_na_fabrica with (security_invoker = true) as
SELECT f.id,
    f.pedido_id,
    p.numero,
    COALESCE(NULLIF(btrim(p.nome), ''::text), cl.nome, c.cliente_nome, ''::text) AS nome,
    COALESCE(cl.nome, c.cliente_nome, ''::text) AS cliente,
    p.vendedor_nome AS vendedor,
    f.tecnica,
    f.etapa,
    f.etapa_em,
    f.fechado_em,
    f.layouts,
    f.pecas,
    ordem_na_rota(f.tecnica, f.etapa) AS ordem_na_rota,
    p.data_de_envio AS entrega_em,
    p.planejado_em,
    p.aviso,
    p.estado,
    p.teste,
    f.pego_por,
    f.pego_em,
    COALESCE(qp.nome, ''::text) AS pego_por_nome,
    COALESCE(c.marcas, '{}'::text[]) AS marcas,
    COALESCE(( SELECT array_agg(tf.tag ORDER BY t.ordem) AS array_agg
           FROM tag_da_fatia tf
             JOIN tag t ON t.chave = tf.tag
          WHERE tf.fatia_id = f.id), '{}'::text[]) AS tags,
    ( SELECT count(*) AS count
           FROM evento_da_fatia e
          WHERE e.fatia_id = f.id AND e.tipo = 'fala'::text) AS falas,
    p.cliente_id,
    f.travada_em,
    f.travada_motivo,
    COALESCE(qt.nome, ''::text) AS travada_por_nome
   FROM fatia f
     JOIN pedido p ON p.id = f.pedido_id
     LEFT JOIN cliente cl ON cl.id = p.cliente_id
     LEFT JOIN cotacao c ON c.id = p.cotacao_id
     LEFT JOIN equipe qp ON qp.id = f.pego_por
     LEFT JOIN equipe qt ON qt.id = f.travada_por
  WHERE p.estado <> 'cancelado'::estado_do_pedido;

grant select on public.fatia_na_fabrica to authenticated;

create or replace view public.pedido_na_fabrica with (security_invoker = true) as
SELECT p.id,
    p.numero,
    COALESCE(cl.nome, c.cliente_nome, ''::text) AS cliente,
    p.vendedor_nome AS vendedor,
    p.departamento,
    p.etapa,
    p.etapa_em,
    p.estado,
    p.data_de_envio AS entrega_em,
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
    c.numero AS cotacao_numero,
    c.id AS cotacao_id,
    tag_do_pedido(p.id) AS tag,
    ( SELECT string_agg((f.tecnica || ':'::text) || f.etapa, ', '::text ORDER BY f.tecnica) AS string_agg
           FROM fatia f
          WHERE f.pedido_id = p.id AND f.fechado_em IS NULL) AS fatias_abertas,
    p.cliente_id,
    btrim(p.nome) AS nome,
    COALESCE(c.marcas, '{}'::text[]) AS marcas,
    (EXISTS ( SELECT 1
           FROM fatia f
          WHERE f.pedido_id = p.id)) AS tem_fatias
   FROM pedido p
     LEFT JOIN cliente cl ON cl.id = p.cliente_id
     LEFT JOIN cotacao c ON c.id = p.cotacao_id
  WHERE p.estado <> 'cancelado'::estado_do_pedido;

grant select on public.pedido_na_fabrica to authenticated;

create or replace view public.frete_na_lista as
SELECT p.id AS pedido_id,
    p.numero,
    COALESCE(cl.nome, c.cliente_nome, ''::text) AS cliente,
    p.cliente_id,
    COALESCE(NULLIF(cl.celular, ''::text), NULLIF(cl.telefone, ''::text), NULLIF(c.telefone_do_cliente, ''::text), ''::text) AS telefone,
    p.estado,
    p.data_de_envio AS entrega_em,
    p.fechado_em AS liberado_em,
    COALESCE(NULLIF(f.envio, ''::text), c.entrega, ''::text) AS envio,
    COALESCE(f.quem_paga,
        CASE
            WHEN upper(COALESCE(c.entrega, ''::text)) = 'FABRICA'::text THEN 'sem_frete'::text
            ELSE 'cliente'::text
        END) AS quem_paga,
    f.pedido_id IS NOT NULL AS registrado,
    f.valor_combinado,
    f.valor_pago,
    f.comprovante,
    COALESCE(f.comprovante_nome, ''::text) AS comprovante_nome,
    COALESCE(f.observacao, ''::text) AS observacao,
        CASE
            WHEN f.confirmado_em IS NOT NULL THEN 3
            WHEN f.recebido_em IS NOT NULL THEN 2
            WHEN f.pedido_em IS NOT NULL THEN 1
            ELSE 0
        END AS passo,
    f.pedido_em,
    COALESCE(pp.nome, ''::text) AS pedido_por,
    f.recebido_em,
    COALESCE(pr.nome, ''::text) AS recebido_por,
    f.confirmado_em,
    COALESCE(pc.nome, ''::text) AS confirmado_por,
    p.teste
   FROM pedido p
     LEFT JOIN cotacao c ON c.id = p.cotacao_id
     LEFT JOIN cliente cl ON cl.id = p.cliente_id
     LEFT JOIN frete_do_pedido f ON f.pedido_id = p.id
     LEFT JOIN pessoa pp ON pp.id = f.pedido_por
     LEFT JOIN pessoa pr ON pr.id = f.recebido_por
     LEFT JOIN pessoa pc ON pc.id = f.confirmado_por
  WHERE (p.estado = ANY (ARRAY['aprovado'::estado_do_pedido, 'separacao'::estado_do_pedido, 'pcp'::estado_do_pedido, 'producao'::estado_do_pedido, 'pronto'::estado_do_pedido])) AND posso('transporte'::text, 'ver'::text);

grant select on public.frete_na_lista to authenticated;

comment on view public.frete_na_lista is
  'Os pedidos que a logística acompanha (080). Roda como dona DE PROPÓSITO: a logística vê telefone e modo de entrega sem ter acesso à cotação; a própria view filtra por posso(transporte, ver). Desde a 085 lê as colunas geradas da cotação, sem abrir o corpo.';

create or replace view public.frete_do_cliente with (security_invoker = true) as
WITH ultimos AS (
         SELECT p.id,
            p.cliente_id,
            p.aprovado_em,
            upper(btrim(COALESCE(c.entrega, ''::text))) AS modo,
            COALESCE(f.envio, ''::text) AS envio,
            row_number() OVER (PARTITION BY p.cliente_id ORDER BY p.aprovado_em DESC NULLS LAST, p.numero DESC) AS n
           FROM pedido p
             LEFT JOIN cotacao c ON c.id = p.cotacao_id
             LEFT JOIN frete_do_pedido f ON f.pedido_id = p.id
          WHERE p.cliente_id IS NOT NULL AND p.estado <> 'cancelado'::estado_do_pedido
        )
 SELECT cliente_id,
    ( SELECT x.modo
           FROM ultimos x
          WHERE x.cliente_id = u.cliente_id AND x.n <= 10 AND x.modo <> ''::text
          GROUP BY x.modo
          ORDER BY (count(*)) DESC, (max(x.aprovado_em)) DESC NULLS LAST
         LIMIT 1) AS modo,
    ( SELECT count(*) AS count
           FROM ultimos x
          WHERE x.cliente_id = u.cliente_id AND x.n <= 10 AND x.modo = (( SELECT y.modo
                   FROM ultimos y
                  WHERE y.cliente_id = u.cliente_id AND y.n <= 10 AND y.modo <> ''::text
                  GROUP BY y.modo
                  ORDER BY (count(*)) DESC, (max(y.aprovado_em)) DESC NULLS LAST
                 LIMIT 1))) AS vezes,
    ( SELECT count(*) AS count
           FROM ultimos x
          WHERE x.cliente_id = u.cliente_id AND x.n <= 10) AS pedidos,
    ( SELECT x.envio
           FROM ultimos x
          WHERE x.cliente_id = u.cliente_id AND x.envio <> ''::text
          ORDER BY x.n
         LIMIT 1) AS ultimo_envio,
    ( SELECT t.nome
           FROM ultimos x
             JOIN pedido_do_lancamento pl ON pl.pedido_id = x.id
             JOIN lancamento_de_transporte l ON l.id = pl.lancamento_id AND l.apagado_em IS NULL AND l.coleta_de IS NULL
             JOIN transportador t ON t.id = l.transportador_id
          WHERE x.cliente_id = u.cliente_id
          ORDER BY l.quando DESC
         LIMIT 1) AS ultimo_transportador
   FROM ( SELECT DISTINCT ultimos.cliente_id
           FROM ultimos) u;

grant select on public.frete_do_cliente to authenticated;

-- ---------- 2. as chaves estrangeiras das tabelas que crescem -------------------
create index if not exists aviso_do_sino_por_lead on public.aviso_do_sino (lead_id) where lead_id is not null;
create index if not exists aviso_do_sino_por_pedido on public.aviso_do_sino (pedido_id) where pedido_id is not null;
create index if not exists conferencia_por_fornecedor on public.conferencia_de_boleto (fornecedor_id) where fornecedor_id is not null;
create index if not exists consumo_do_layout_por_material on public.consumo_do_layout (material_id);
create index if not exists juntada_por_quem_ficou on public.juntada_de_cliente (ficou_id);
create index if not exists lancamento_por_fornecedor on public.lancamento_de_transporte (fornecedor_id) where fornecedor_id is not null;
create index if not exists material_por_cor on public.material (cor_id) where cor_id is not null;
create index if not exists material_da_referencia_por_material on public.material_da_referencia (material_id);
create index if not exists mensagem_por_pessoa on public.mensagem (pessoa_id) where pessoa_id is not null;
create index if not exists pedido_por_lead on public.pedido (lead_id) where lead_id is not null;
create index if not exists pedido_do_lancamento_por_pedido on public.pedido_do_lancamento (pedido_id);
create index if not exists tag_da_fatia_por_tag on public.tag_da_fatia (tag);

-- ---------- 3. os índices repetidos ---------------------------------------------
drop index if exists public.cor_de_impressao_por_tecnica;
drop index if exists public.reserva_por_pedido;
drop index if exists public.tag_da_fatia_por_fatia;

-- ---------- conferência -----------------------------------------------------------
do $$
declare
  v text;
begin
  foreach v in array array['fatia_na_fabrica', 'pedido_na_fabrica', 'frete_na_lista', 'frete_do_cliente'] loop
    if position('corpo' in pg_get_viewdef(('public.' || v)::regclass)) > 0 then
      raise exception 'a view % ainda abre o corpo', v;
    end if;
  end loop;
  if exists (select 1 from public.cotacao c
              where c.entrega is distinct from c.corpo -> 'informe' ->> 'entrega'
                 or c.telefone_do_cliente is distinct from c.corpo -> 'cliente' ->> 'telefone'
                 or coalesce(c.marcas, '{}') is distinct from coalesce(public.marcas_do_corpo(c.corpo), '{}')) then
    raise exception 'as colunas geradas não batem com o corpo';
  end if;
  if not has_table_privilege('authenticated', 'public.fatia_na_fabrica', 'select')
     or not has_table_privilege('authenticated', 'public.frete_na_lista', 'select') then
    raise exception 'uma view perdeu o grant';
  end if;
  raise notice '085 pronta: % cotações com as colunas geradas', (select count(*) from public.cotacao);
end $$;
