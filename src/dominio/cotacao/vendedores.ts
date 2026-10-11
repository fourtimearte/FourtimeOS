import { tabela } from '@shared/supabase'

/* ==========================================================================
   O VENDEDOR DA COTAÇÃO É UMA PESSOA (pedido do Henrique, 11/10/2026).

   A lista "Vendedores" do Banco de dados saiu: quem cria o orçamento já é o
   vendedor dele, inclusive quando ele não passou pelo lead. Quem tem
   CONTROLE TOTAL em Cotação (matriz de Acessos) pode pôr o orçamento no nome
   de outra pessoa; a lista para escolher é de quem cria orçamento: as
   pessoas aprovadas cujo papel pode EDITAR a página Cotação.

   A costura com o banco já existia (017 e 019): a cotação guarda o nome e o
   vendedor_id, e o pedido aprovado copia os dois.
   ========================================================================== */

export type Vendedor = { id: string; nome: string }

export async function carregarVendedores(): Promise<Vendedor[]> {
  const papeis = await tabela<{ papel: string }[]>('permissao?select=papel&painel=eq.cotacao&editar=is.true')
  if (!papeis.length) return []
  const lista = papeis.map((p) => encodeURIComponent(p.papel)).join(',')
  return tabela<Vendedor[]>('equipe?select=id,nome&situacao=eq.aprovado&papel=in.(' + lista + ')&order=nome.asc')
}
