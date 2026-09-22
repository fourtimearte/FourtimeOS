-- ===========================================================================
-- 033: MOVER CARTAO NO KANBAN VIRA ACAO
--
-- A fatia anda por UPDATE direto na tabela, e a regra de quem pode andar com
-- ela estava escrita a mao na policy da 023: admin, gerente, producao.
--
-- Esta e a primeira policy de RLS a sair da lista escrita a mao e passar a
-- perguntar a matriz. Ela e a candidata certa para comecar: e uma tabela so,
-- uma operacao so, e o pior que pode acontecer se eu errar e o cartao nao
-- andar, que aparece no primeiro arrasto. As policies de leitura e escrita do
-- cliente, da cotacao e do pedido vem depois, uma a uma, pelo mesmo caminho.
-- ===========================================================================

insert into public.acao (chave, nome, grupo, painel, linha, ordem) values
  ('kanban.mover', 'Mover o cartão de posto', 'Chão de fábrica', 'kanban',
   'Arrastar a fatia de um posto para o outro, dentro da rota da técnica dela.', 200)
on conflict (chave) do nothing;

-- quem EDITA o kanban move: pela matriz de 21/09, admin, gerente e producao,
-- que e exatamente a lista que estava escrita na policy
insert into public.permissao_da_acao (papel, acao)
select x.papel, 'kanban.mover'
  from public.permissao x
 where x.painel = 'kanban' and x.editar
on conflict (papel, acao) do nothing;

drop policy if exists "quem cuida de producao anda com a fatia" on public.fatia;

create policy "quem pode a acao anda com a fatia"
  on public.fatia for update to authenticated
  using (public.posso_a_acao('kanban.mover'))
  with check (public.posso_a_acao('kanban.mover'));
