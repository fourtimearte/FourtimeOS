-- ===========================================================================
-- 029: A TABELA PAINEL ESTAVA TRANCADA PARA TODO MUNDO
--
-- A tabela public.painel tem RLS ligada e NENHUMA politica. Em Postgres isso
-- nao quer dizer "livre": quer dizer "ninguem le, nem com grant". O grant de
-- select existe desde a 003 e nunca valeu de nada.
--
-- Isso passou despercebido ate hoje porque nada critico dependia dela: a
-- gaveta de paineis da tela de equipe simplesmente aparecia vazia, e ninguem
-- usava. A 028 trouxe o defeito para a luz, porque a view meu_perfil passou a
-- juntar painel para ordenar, e com zero linhas de painel o menu inteiro
-- desaparecia. Um administrador abriu o sistema sem nenhum item no menu.
--
-- A LICAO, ESCRITA AQUI PARA NAO SE PERDER: RLS ligada sem politica e uma
-- porta trancada, e nao uma porta aberta. Conferir com o papel de dono no SQL
-- Editor nao prova nada: ali a RLS nao vale, e a resposta vem certa enquanto
-- o sistema de verdade recebe vazio.
--
-- A lista de paineis nao e segredo: ela e o mapa das telas que existem, e a
-- trava de quem abre cada uma mora na matriz de permissao, nao aqui.
-- ===========================================================================

drop policy if exists "todo mundo le os paineis" on public.painel;

create policy "todo mundo le os paineis"
  on public.painel for select to authenticated
  using (true);

grant select on public.painel to authenticated;

-- A conferencia ganha esta pergunta, para o mesmo tipo de porta trancada
-- aparecer sozinho da proxima vez.
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
  select 'tabela com RLS ligada e nenhuma politica', c.relname
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
     and c.relrowsecurity
     and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)
$$;

grant execute on function public.conferir_os_acessos() to authenticated;
