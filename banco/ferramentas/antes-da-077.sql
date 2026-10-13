-- ===========================================================================
-- ANTES DA 077: quem ganha ou perde o poder de escrever.
--
-- Só lê. Compara, papel por papel, a lista escrita à mão de hoje com o que a
-- matriz de acessos (/config/acessos) diz AGORA. Sem linha: a 077 não muda
-- nada para ninguém. Cada linha é uma mudança que a 077 faria.
--
-- A segunda parte acha as PESSOAS com lista própria de páginas (pessoa.paineis)
-- que perderiam a escrita por não terem a página na lista dela.
-- ===========================================================================
with regra(tabela, acao, antes, painel, nivel) as (values
  ('cliente',  'criar e mudar',   array['admin','gerente','vendedor'],   'clientes', 'editar'),
  ('lead',     'criar e mudar',   array['admin','gerente','vendedor'],   'funil',    'editar'),
  ('mensagem', 'falar e mudar',   array['admin','gerente','vendedor'],   'funil',    'editar'),
  ('cotacao',  'criar e mudar',   array['admin','gerente','vendedor'],   'cotacao',  'editar'),
  ('cotacao',  'apagar',          array['admin','gerente','vendedor'],   'cotacao',  'deletar'),
  ('pedido',   'criar',           array['admin','gerente','vendedor'],   'cotacao',  'editar'),
  ('material', 'criar e mudar',   array['admin','gerente','estoquista'], 'estoque',  'editar'),
  ('material', 'apagar',          array['admin','gerente','estoquista'], 'estoque',  'deletar')
),
papeis as (select chave from public.papel_do_sistema)
select r.tabela, r.acao, p.chave as papel,
       case when p.chave = any (r.antes) then 'perde' else 'ganha' end as muda
  from regra r
  cross join papeis p
  left join public.permissao x on x.papel = p.chave and x.painel = r.painel and x.ver
 where (p.chave = any (r.antes))
       <> coalesce(case r.nivel when 'editar' then x.editar else x.deletar end, false)
union all
select r.tabela, r.acao, 'pessoa: ' || pe.nome, 'perde (lista propria sem ' || r.painel || ')'
  from regra r
  join public.pessoa pe on pe.situacao = 'aprovado' and pe.paineis is not null
 where pe.papel::text = any (r.antes)
   and not (r.painel = any (pe.paineis))
order by 1, 2, 3;
