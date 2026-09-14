-- Rodar isto no SQL Editor depois de QUALQUER migracao.
--
-- Ele acha a classe de erro que derrubou o login em 13/09/2026: um objeto em
-- public que existe, funciona, e que ninguem consegue ler porque o grant se
-- perdeu. Sintoma na tela: a pessoa entra e e derrubada no segundo seguinte.
--
-- O resultado esperado e "No rows returned". Qualquer linha aqui e um buraco.

select
  c.relname as objeto,
  case c.relkind when 'v' then 'view' else 'tabela' end as tipo,
  'authenticated nao consegue ler' as problema
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and not has_table_privilege('authenticated', c.oid, 'SELECT')
  -- contador fica de fora DE PROPOSITO (011): ninguem tira numero de cotacao
  -- nem de pedido na mao, so as duas funcoes security definer que mexem nele.
  and c.relname <> 'contador'
order by 1;
