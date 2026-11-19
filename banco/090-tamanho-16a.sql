-- ===========================================================================
-- 090: O TAMANHO 16A NA GRADE INFANTIL (19/11/2026)
--
-- O Henrique pediu, para o editor V4 e o Fourtime OS: "colocar mais um
-- tamanho na grade infantil, o 16A". O editor V4 3.384 traz o 16A no fim
-- da grade infantil, depois do 14A, e o Fourtime OS segue igual.
--
-- No banco, a lista dos tamanhos da fabrica mora numa funcao so, a
-- tamanhos_da_fabrica() (050). E ela que a ficha tecnica da referencia e a
-- escala do molde (052) usam para recusar tamanho que nao existe, e para
-- pôr os tamanhos na ordem. Sem o 16A nela, a ficha recusaria a medida do
-- 16A. Esta migracao so troca a lista: o 16A entra no fim, depois do 14A.
--
-- Nenhum dado muda: nada no banco tinha 16A, porque ele nao era aceito.
-- Roda quantas vezes quiser: "create or replace" com a mesma assinatura.
-- ===========================================================================

create or replace function public.tamanhos_da_fabrica()
returns text[]
language sql
immutable
as $$
  select array['PP','P','M','G','GG','XG','G1','G2','G3','G4','2A','4A','6A','8A','10A','12A','14A','16A']
$$;
grant execute on function public.tamanhos_da_fabrica() to authenticated;

-- o relatorio: a lista depois da 090 (a ultima linha tem de ser o 16A)
select n as ordem, t as tamanho
  from unnest(public.tamanhos_da_fabrica()) with ordinality as x(t, n)
 order by n;
