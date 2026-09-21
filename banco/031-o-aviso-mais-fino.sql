-- ===========================================================================
-- 031: O AVISO DA PORTA TRANCADA, MAIS FINO
--
-- A 029 ensinou conferir_os_acessos() a achar tabela com RLS ligada e nenhuma
-- politica, e na primeira rodada ela apontou public.contador. So que a
-- contador E TRANCADA DE PROPOSITO: ela nao tem grant nenhum, e o comentario
-- da 011 diz isso com todas as letras. Quem mexe nela sao duas funcoes
-- security definer, para o numero do pedido nao poder ser escolhido a mao.
--
-- Aviso que aponta o que esta certo e pior que aviso nenhum: na terceira vez
-- que ele aparece, a pessoa para de ler a lista inteira.
--
-- O DEFEITO DE VERDADE E A CONTRADICAO: dar permissao de leitura e nao dar
-- politica. Ai o banco diz sim num lugar e nao no outro, e quem escreveu o
-- grant acredita que liberou. Foi exatamente o caso da public.painel.
-- ===========================================================================

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
  select 'tabela liberada para leitura e sem politica nenhuma', c.relname
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
     and c.relrowsecurity
     and has_table_privilege('authenticated', c.oid, 'SELECT')
     and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)
  union all
  select 'acao que ninguem pode', a.chave
    from public.acao a
   where not exists (select 1 from public.permissao_da_acao x where x.acao = a.chave)
  union all
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
