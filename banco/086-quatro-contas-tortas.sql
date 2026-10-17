-- ===========================================================================
-- 086: QUATRO CONTAS QUE A 081 E A 011 DEIXARAM TORTAS (17/10/2026, auditoria)
--
-- 1. O PCP VIA FALTA EM TODO PEDIDO. A coluna faltando de pedido_no_pcp
--    (063, 064) contava como "sem cobrir" toda reserva ainda não BAIXADA. Até
--    a 081 a separação baixava na hora; desde a 081 ela só ANOTA o peso
--    (reserva.separado) e a baixa vem no primeiro posto da produção. Resultado:
--    no PCP, faltando = materiais em todo pedido, o aviso "material sem
--    cobrir" aparecia sempre e a Mesa do diretor nunca marcava nada sozinha.
--    Agora falta é o que a 081 chama de falta: a reserva que ninguém pesou, ou
--    a que foi pesada A MENOS do que pedia.
--
-- 2. O USO DO ESTOQUE PAROU DE CONTAR A PRODUÇÃO. uso_do_estoque (049) soma
--    as saídas dos motivos separacao, saida e devolucao. A baixa da 081 entra
--    com o motivo producao, que ficou de fora: o consumo de 30, 90 e 180 dias
--    ia caindo para zero conforme os pedidos novos chegavam ao primeiro posto.
--
-- 3. O LEAD IA PARA VENDEDOR BLOQUEADO. dono_do_lead (011) procura primeiro
--    a dona da carteira do cliente com aquele telefone, sem olhar se ela ainda
--    está aprovada. Pessoa bloqueada ou que saiu continuava recebendo lead do
--    site e do WhatsApp. Agora a carteira só vale para quem está aprovado; sem
--    ninguém, segue para o rodízio, como já era.
--
-- 4. OS ÍNDICES DE TELEFONE NUNCA ERAM USADOS. lead_por_telefone,
--    cliente_por_telefone e cliente_por_telefone_fixo (011) eram parciais
--    ("where telefone <> ''"), e nenhuma busca repete essa condição: o
--    Postgres não podia usar o índice e lia a tabela inteira a cada lead novo.
--    Conferido com EXPLAIN no ensaio. Viram índices inteiros.
--
-- Roda quantas vezes quiser.
-- ===========================================================================

-- ---------- 1. a falta do PCP ---------------------------------------------------
create or replace view public.pedido_no_pcp with (security_invoker = true) as
SELECT p.id,
    p.numero,
    p.cotacao_id,
    p.cliente_id,
    COALESCE(c.nome, ''::text) AS cliente,
    p.estado,
    p.aviso,
    p.pecas,
    p.total,
    p.data_de_envio AS entrega_em,
    p.departamento,
    p.layouts,
    p.tecnicas,
    p.teste,
    p.criado_em,
    p.marcado_em,
    COALESCE(qm.nome, ''::text) AS marcado_por_nome,
    p.devolvido_motivo,
    p.devolvido_em,
    COALESCE(qd.nome, ''::text) AS devolvido_por_nome,
    p.marcado_em IS NOT NULL AS marcado,
    COALESCE(r.materiais, 0::bigint) AS materiais,
    COALESCE(r.faltando, 0::bigint) AS faltando,
    COALESCE(ct.numero, ''::text) AS cotacao_numero,
    COALESCE(p.vendedor_nome, ''::text) AS vendedor_nome,
    p.conferindo_em,
    COALESCE(qc.nome, ''::text) AS conferindo_por_nome,
    p.vendedor_em IS NOT NULL AS com_o_vendedor,
    p.vendedor_motivo,
    p.vendedor_em,
    COALESCE(qv.nome, ''::text) AS vendedor_por_nome,
    p.vendedor_id
   FROM pedido p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     LEFT JOIN cotacao ct ON ct.id = p.cotacao_id
     LEFT JOIN equipe qm ON qm.id = p.marcado_por
     LEFT JOIN equipe qd ON qd.id = p.devolvido_por
     LEFT JOIN equipe qc ON qc.id = p.conferindo_por
     LEFT JOIN equipe qv ON qv.id = p.vendedor_por
     LEFT JOIN LATERAL ( SELECT count(*) AS materiais,
            count(*) FILTER (WHERE NOT x.baixada AND x.separado IS NULL OR x.separado IS NOT NULL AND NOT x.sem_consumo AND x.separado < x.quantidade) AS faltando
           FROM reserva x
          WHERE x.pedido_id = p.id) r ON true
  WHERE p.estado = 'pcp'::estado_do_pedido;

grant select on public.pedido_no_pcp to authenticated;

-- ---------- 2. o uso do estoque conta a baixa da produção -----------------------
do $$
declare
  def text := pg_get_functiondef('public.uso_do_estoque()'::regprocedure);
begin
  if position('''producao''' in def) = 0 then
    execute replace(def, 'v.motivo in (''separacao'', ''saida'', ''devolucao'')',
                         'v.motivo in (''separacao'', ''producao'', ''saida'', ''devolucao'')');
  end if;
end $$;

-- ---------- 3. a carteira só vale para quem está aprovado -----------------------
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
      join public.pessoa p on p.id = c.vendedor_id and p.situacao = 'aprovado'
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

comment on function public.dono_do_lead(text) is
  'De quem é o telefone: a dona da carteira, se ainda está aprovada (086), ou a vez do rodízio (que anda). Só o banco chama (lead do site, lead_do_telefone): a 084 tirou de quem entrou, porque cada chamada gira o rodízio.';

-- ---------- 4. os índices de telefone, inteiros ---------------------------------
drop index if exists public.lead_por_telefone;
create index lead_por_telefone on public.lead (public.fim_do_telefone(telefone));
drop index if exists public.cliente_por_telefone;
create index cliente_por_telefone on public.cliente (public.fim_do_telefone(celular));
drop index if exists public.cliente_por_telefone_fixo;
create index cliente_por_telefone_fixo on public.cliente (public.fim_do_telefone(telefone));

-- ---------- conferência -------------------------------------------------------------
do $$
begin
  if position('x.separado IS NULL' in pg_get_viewdef('public.pedido_no_pcp'::regclass)) = 0 then
    raise exception 'pedido_no_pcp não ganhou a falta nova';
  end if;
  if position('''producao''' in pg_get_functiondef('public.uso_do_estoque()'::regprocedure)) = 0 then
    raise exception 'uso_do_estoque ainda não conta a produção';
  end if;
  if position('situacao = ''aprovado''' in (select prosrc from pg_proc where oid = 'public.dono_do_lead(text)'::regprocedure)) = 0 then
    raise exception 'dono_do_lead ainda aceita carteira de quem não está aprovado';
  end if;
  if has_function_privilege('authenticated', 'public.dono_do_lead(text)', 'execute') then
    raise exception 'dono_do_lead voltou a abrir para quem entrou';
  end if;
  if exists (select 1 from pg_indexes where indexname in ('lead_por_telefone', 'cliente_por_telefone', 'cliente_por_telefone_fixo') and indexdef like '%WHERE%') then
    raise exception 'um índice de telefone continua parcial';
  end if;
  raise notice '086 pronta';
end $$;
