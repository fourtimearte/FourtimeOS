import {
  TAMANHOS_INFANTIS,
  TAMANHOS_PLUS,
  celula,
  faixaDe,
  precoDoTamanho,
  type TabelaDePreco,
} from '../preco/tipos'
import { pecasDoProduto, type Cotacao, type ProdutoCotado } from './tipos'

/* ==========================================================================
   A TABELA DE PREÇO NA COTAÇÃO (068, prancha 137).

   De onde vem o preço de um layout, nesta ordem:
     1. o que foi escrito à mão na grade (precoPorTamanho);
     2. a tabela escolhida no layout (tabelaId);
     3. a tabela da cotação, na faixa do total de peças dos layouts que seguem
        aquela mesma tabela;
     4. sem a referência na tabela, ou sem tabela: o preço base continua o que
        estava, escrito por alguém.

   A tabela escreve o precoBase (o adulto) e o precoDaTabela (plus e
   infantil). Cotação aprovada não muda: depois do sim, preço é história.
   ========================================================================== */

export const SEM_TABELA = 'manual'

/** A tabela que vale para um layout: a dele, a da cotação, ou nenhuma. */
export function tabelaDoLayout(c: Cotacao, p: ProdutoCotado): string {
  if (p.tabelaId === SEM_TABELA) return ''
  return p.tabelaId || c.informe.tabelaDePrecoId || ''
}

/** Quantas peças a cotação tem em cada tabela: é isso que escolhe a faixa. */
export function pecasPorTabela(c: Cotacao): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of c.produtos) {
    const id = tabelaDoLayout(c, p)
    if (id) m.set(id, (m.get(id) ?? 0) + pecasDoProduto(p))
  }
  return m
}

export type OrigemDoPreco = { tabela: string; faixa: string } | null

/* Devolve a cotação com os preços da tabela aplicados, ou a MESMA cotação
   (o mesmo objeto) quando nada muda: quem chama compara por identidade. */
export function aplicarTabelas(
  c: Cotacao,
  tabelas: TabelaDePreco[],
  pecasDoKit: (codigo: string) => string[],
): Cotacao {
  if (c.aprovacao || !tabelas.length) return c
  const total = pecasPorTabela(c)
  let mudou = false
  const produtos = c.produtos.map((p) => {
    const id = tabelaDoLayout(c, p)
    const t = id ? tabelas.find((x) => x.id === id) : undefined
    const cod = p.bloco.referencia.trim()
    const item = t && cod ? t.itens.find((i) => i.codigo === cod) : undefined
    if (!t || !item) return p
    const i = faixaDe(t.faixas, total.get(id) ?? 0)
    const ctx = {
      achar: (k: string) => t.itens.find((x) => x.codigo === k),
      pecasDoKit,
    }
    const v = celula(t, item, i, ctx).valor
    if (v == null) return p
    const daTabela: Partial<Record<string, number>> = {}
    for (const tam of [...TAMANHOS_PLUS, ...TAMANHOS_INFANTIS]) daTabela[tam] = precoDoTamanho(t, v, tam)
    const igual =
      p.precoBase === v && JSON.stringify(p.precoDaTabela ?? {}) === JSON.stringify(daTabela)
    if (igual) return p
    mudou = true
    return { ...p, precoBase: v, precoDaTabela: daTabela }
  })
  return mudou ? { ...c, produtos } : c
}

/** Para a tela dizer de onde veio o preço do layout. */
export function origemDoPreco(c: Cotacao, p: ProdutoCotado, tabelas: TabelaDePreco[]): OrigemDoPreco {
  const id = tabelaDoLayout(c, p)
  const t = id ? tabelas.find((x) => x.id === id) : undefined
  if (!t || !t.itens.some((i) => i.codigo === p.bloco.referencia.trim())) return null
  const n = pecasPorTabela(c).get(id) ?? 0
  const f = t.faixas[faixaDe(t.faixas, n)]
  return { tabela: t.nome, faixa: f.ate == null ? `${f.de} ou mais` : `${f.de} a ${f.ate}` }
}
