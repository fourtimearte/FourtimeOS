-- ===========================================================================
-- A SAÚDE DOS DADOS NA PRODUÇÃO (17/10/2026, auditoria). SÓ LÊ.
--
-- O retrato (catalogo.sql) diz como o banco É. Este diz como os DADOS estão:
-- o tamanho de cada tabela, quanto pesa o corpo das cotações, o que ficou
-- órfão, o que está fora da regra e o que cresce sem limpeza.
--
-- Uma linha por pergunta: (grupo, pergunta, resposta, alerta). "alerta" true
-- é o que precisa de olho. Rodar no SQL Editor; nada aqui muda dado.
-- ===========================================================================
with
tamanho as (
  select c.relname as tabela, s.n_live_tup as linhas, s.n_dead_tup as mortas,
         pg_total_relation_size(c.oid) as bytes, s.last_autovacuum, s.last_autoanalyze
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s on s.relid = c.oid
   where n.nspname = 'public' and c.relkind = 'r'
),
corpo as (
  select count(*) as cotacoes,
         coalesce(avg(pg_column_size(corpo)), 0)::bigint as media,
         coalesce(max(pg_column_size(corpo)), 0)::bigint as maior,
         coalesce(sum(pg_column_size(corpo)), 0)::bigint as soma
    from public.cotacao
)
select * from (
  -- ---------- o tamanho ----------------------------------------------------
  select 'tamanho' as grupo, 'banco inteiro' as pergunta,
         pg_size_pretty(pg_database_size(current_database())) as resposta,
         pg_database_size(current_database()) > 400 * 1024 * 1024 as alerta
  union all
  select 'tamanho', 'tabela ' || tabela,
         linhas || ' linhas, ' || pg_size_pretty(bytes) || coalesce(', ' || mortas || ' mortas', ''),
         bytes > 50 * 1024 * 1024 or coalesce(mortas, 0) > greatest(1000, coalesce(linhas, 0))
    from tamanho
  union all
  select 'tamanho', 'corpo das cotações',
         cotacoes || ' cotações, média ' || pg_size_pretty(media) || ', maior ' || pg_size_pretty(maior) || ', soma ' || pg_size_pretty(soma),
         media > 1024 * 1024
    from corpo

  -- ---------- o que ficou órfão -------------------------------------------------
  union all
  select 'órfão', 'cotação com cliente_id que não existe',
         count(*)::text, count(*) > 0
    from public.cotacao c where c.cliente_id is not null and not exists (select 1 from public.cliente x where x.id = c.cliente_id)
  union all
  select 'órfão', 'pedido sem cotação',
         count(*)::text, count(*) > 0
    from public.pedido p where p.cotacao_id is null
  union all
  select 'órfão', 'pedido em produção sem fatia',
         count(*)::text, count(*) > 0
    from public.pedido p where p.estado = 'producao' and not exists (select 1 from public.fatia f where f.pedido_id = p.id)
  union all
  select 'órfão', 'fatia aberta de pedido fechado ou cancelado',
         count(*)::text, count(*) > 0
    from public.fatia f join public.pedido p on p.id = f.pedido_id
   where f.fechado_em is null and p.estado in ('cancelado', 'enviado', 'entregue')
  union all
  select 'órfão', 'reserva aberta de pedido cancelado',
         count(*)::text, count(*) > 0
    from public.reserva r join public.pedido p on p.id = r.pedido_id
   where p.estado = 'cancelado' and not r.baixada
  union all
  select 'órfão', 'lead fechado sem pedido',
         count(*)::text, false
    from public.lead l where l.estagio = 'fechado' and not exists (select 1 from public.pedido p where p.lead_id = l.id)
  union all
  select 'órfão', 'pessoa sem conta no auth',
         count(*)::text, count(*) > 0
    from public.pessoa p where not exists (select 1 from auth.users u where u.id = p.id)

  -- ---------- fora da regra ------------------------------------------------------
  union all
  select 'regra', 'material com saldo negativo',
         count(*)::text, count(*) > 0
    from public.material m where m.saldo < 0
  union all
  select 'regra', 'saldo do material diferente da soma do razão',
         count(*)::text, count(*) > 0
    from public.material m
   where m.saldo <> coalesce((select sum(x.quantidade) from public.movimento_de_estoque x where x.material_id = m.id), 0)
  union all
  select 'regra', 'cliente com o mesmo telefone (8 últimos dígitos) em outra ficha',
         count(*)::text, count(*) > 0
    from (select public.fim_do_telefone(celular) f from public.cliente where celular <> '' group by 1 having count(*) > 1) d
  union all
  select 'regra', 'lead aberto com o mesmo telefone de outro lead aberto',
         count(*)::text, count(*) > 0
    from (select public.fim_do_telefone(telefone) f from public.lead
           where telefone <> '' and estagio not in ('fechado', 'perdido') group by 1 having count(*) > 1) d
  union all
  select 'regra', 'pedido com número repetido',
         count(*)::text, count(*) > 0
    from (select numero from public.pedido group by 1 having count(*) > 1) d
  union all
  select 'regra', 'tabela de preço padrão (tem de ser uma)',
         count(*)::text, count(*) <> 1
    from public.tabela_de_preco where padrao
  union all
  select 'regra', 'dado de teste ainda no banco',
         (select count(*) from public.cotacao where teste)::text || ' cotações, ' ||
         (select count(*) from public.pedido where teste)::text || ' pedidos, ' ||
         (select count(*) from public.cliente where teste)::text || ' clientes',
         false

  -- ---------- o que cresce sem limpeza ------------------------------------------
  union all
  select 'crescimento', 'aviso do sino com mais de 90 dias',
         count(*)::text, count(*) > 5000
    from public.aviso_do_sino where criado_em < now() - interval '90 days'
  union all
  select 'crescimento', 'erro da extensão com mais de 30 dias',
         count(*)::text, count(*) > 5000
    from public.erro_da_extensao where ultima_em < now() - interval '30 days'
  union all
  select 'crescimento', 'envio do site com mais de 30 dias',
         count(*)::text, count(*) > 5000
    from public.envio_do_site where em < now() - interval '30 days'
  union all
  select 'crescimento', 'lote do depósito de peças sem peça nenhuma',
         count(*)::text, count(*) > 500
    from public.peca_pronta p
   where coalesce((select sum(v::int) from jsonb_each_text(p.grade) g(k, v)), 0) <= 0

  -- ---------- o desempenho ---------------------------------------------------------
  union all
  select 'desempenho', 'índice nunca usado: ' || s.indexrelname,
         pg_size_pretty(pg_relation_size(s.indexrelid)) || ' em ' || s.relname,
         pg_relation_size(s.indexrelid) > 1024 * 1024
    from pg_stat_user_indexes s
    join pg_index i on i.indexrelid = s.indexrelid
   where s.schemaname = 'public' and s.idx_scan = 0 and not i.indisunique and not i.indisprimary
  union all
  select 'desempenho', 'tabela lida inteira mais vezes que pelo índice: ' || relname,
         seq_scan || ' leituras inteiras, ' || coalesce(idx_scan, 0) || ' pelo índice, ' || n_live_tup || ' linhas',
         n_live_tup > 1000
    from pg_stat_user_tables
   where schemaname = 'public' and seq_scan > coalesce(idx_scan, 0) and n_live_tup > 200
) x
order by grupo, alerta desc, pergunta;
