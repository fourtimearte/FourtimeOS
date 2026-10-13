-- ===========================================================================
-- 077: AS REGRAS ANTIGAS DE ESCREVER PASSAM A PERGUNTAR A MATRIZ
--
-- 12/10/2026, item 13 da lista "PODE FAZER TODOS" (FOURTIME OS - 12, 4.4
-- item 6). Desde a 028 a tela pergunta a matriz de acessos (/config/acessos),
-- mas as regras de escrever do cliente, do lead, da conversa, da cotacao, do
-- pedido e do material continuavam com os papeis escritos a mao desde a 011
-- e a 025. Mudar a matriz mudava a tela e nao mudava o banco.
--
-- AQUI, UMA POR UMA, a lista de papeis vira a pergunta posso(pagina, nivel):
--
--   cliente   criar e mudar           posso('clientes','editar')
--   lead      criar e mudar           posso('funil','editar')
--   mensagem  falar e mudar situacao  posso('funil','editar')
--   cotacao   criar e mudar           posso('cotacao','editar')
--             apagar                  posso('cotacao','deletar')
--   pedido    criar                   posso('cotacao','editar')
--   material  criar e mudar           posso('estoque','editar')
--             apagar                  posso('estoque','deletar')
--
-- O QUE FICA COMO ESTAVA, de proposito:
--   apagar cliente, lead e pedido continua so do admin. Na matriz de partida
--   o vendedor tem "deletar" em Clientes e no Funil; trocar aqui daria a ele
--   o poder de apagar cliente pelo banco, que hoje ele nao tem. Isso e decisao
--   do Henrique, e nao efeito colateral de uma migracao.
--   reserva, consumo, catalogos, informes, tabelas de preco: ficam para uma
--   proxima, cada uma com a sua prova.
--
-- ANTES DE RODAR, a consulta banco/ferramentas/antes-da-077.sql mostra, papel
-- por papel, quem ganharia ou perderia o poder de escrever com a matriz de
-- HOJE. Sem linha, nada muda para ninguem; com linha, cada uma e uma decisao.
-- ===========================================================================

-- ---------- cliente ----------------------------------------------------------
drop policy if exists "cadastra cliente" on public.cliente;
create policy "cadastra cliente" on public.cliente
  for insert to authenticated
  with check (public.posso('clientes', 'editar'));

drop policy if exists "edita cliente" on public.cliente;
create policy "edita cliente" on public.cliente
  for update to authenticated
  using (public.posso('clientes', 'editar'))
  with check (public.posso('clientes', 'editar'));

-- ---------- lead ---------------------------------------------------------------
drop policy if exists "admin, gerente e vendedor criam lead" on public.lead;
drop policy if exists "quem edita o funil cria lead" on public.lead;
create policy "quem edita o funil cria lead" on public.lead
  for insert to authenticated
  with check (public.posso('funil', 'editar'));

drop policy if exists "admin, gerente e vendedor mexem no lead" on public.lead;
drop policy if exists "quem edita o funil mexe no lead" on public.lead;
create policy "quem edita o funil mexe no lead" on public.lead
  for update to authenticated
  using (public.posso('funil', 'editar'))
  with check (public.posso('funil', 'editar'));

-- ---------- mensagem -------------------------------------------------------------
drop policy if exists "admin, gerente e vendedor falam" on public.mensagem;
drop policy if exists "quem edita o funil fala" on public.mensagem;
create policy "quem edita o funil fala" on public.mensagem
  for insert to authenticated
  with check (public.posso('funil', 'editar'));

drop policy if exists "admin, gerente e vendedor atualizam a situacao" on public.mensagem;
drop policy if exists "quem edita o funil atualiza a situacao" on public.mensagem;
create policy "quem edita o funil atualiza a situacao" on public.mensagem
  for update to authenticated
  using (public.posso('funil', 'editar'))
  with check (public.posso('funil', 'editar'));

-- ---------- cotacao ---------------------------------------------------------------
-- era uma regra ALL (criar, mudar e apagar com a mesma lista); vira tres
drop policy if exists "admin, gerente e vendedor mexem na cotacao" on public.cotacao;
drop policy if exists "quem edita a cotacao cria" on public.cotacao;
create policy "quem edita a cotacao cria" on public.cotacao
  for insert to authenticated
  with check (public.posso('cotacao', 'editar'));
drop policy if exists "quem edita a cotacao muda" on public.cotacao;
create policy "quem edita a cotacao muda" on public.cotacao
  for update to authenticated
  using (public.posso('cotacao', 'editar'))
  with check (public.posso('cotacao', 'editar'));
drop policy if exists "quem apaga cotacao" on public.cotacao;
create policy "quem apaga cotacao" on public.cotacao
  for delete to authenticated
  using (public.posso('cotacao', 'deletar'));

-- ---------- pedido -----------------------------------------------------------------
drop policy if exists "admin, gerente e vendedor criam pedido" on public.pedido;
drop policy if exists "quem edita a cotacao cria pedido" on public.pedido;
create policy "quem edita a cotacao cria pedido" on public.pedido
  for insert to authenticated
  with check (public.posso('cotacao', 'editar'));

-- ---------- material -----------------------------------------------------------------
drop policy if exists "quem cuida de estoque mexe no material" on public.material;
drop policy if exists "quem edita o estoque cria material" on public.material;
create policy "quem edita o estoque cria material" on public.material
  for insert to authenticated
  with check (public.posso('estoque', 'editar'));
drop policy if exists "quem edita o estoque muda material" on public.material;
create policy "quem edita o estoque muda material" on public.material
  for update to authenticated
  using (public.posso('estoque', 'editar'))
  with check (public.posso('estoque', 'editar'));
drop policy if exists "quem apaga material" on public.material;
create policy "quem apaga material" on public.material
  for delete to authenticated
  using (public.posso('estoque', 'deletar'));
