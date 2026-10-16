import {
  TAMANHOS_INFANTIS,
  TAMANHOS_PLUS,
  celula,
  faixaDe,
  precoDoTamanho,
  type TabelaDePreco,
} from '../preco/tipos'
import { contaDosAdicionais, type EscolhasDoLayout } from '../preco/adicionais'
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

/* O QUE O LAYOUT ESCOLHEU (083), lido da ficha do layout: o tecido, as
   técnicas ligadas com as telas do Silk, o DTF, o Patch e o Bordado com a
   quantidade, e os extras novos. */
export function escolhasDoLayout(p: ProdutoCotado): EscolhasDoLayout {
  const d = (tec: string) => p.bloco.design.find((x) => x.tecnica === tec)
  const silk = d('silk')
  const dtf = d('dtf')
  const patch = d('patch')
  const bordado = d('bordado')
  const qtd = (x: { quantidade?: number } | undefined) => (x?.quantidade && x.quantidade > 1 ? x.quantidade : 1)
  return {
    tecidos: p.bloco.tecidos.map((t) => t.nome).filter(Boolean),
    sub: !!d('subli'),
    silk: silk ? qtd(silk) : null,
    dtf: dtf ? { combinacao: dtf.combinacao ?? '', porPeca: dtf.dtfPorPeca ?? null } : null,
    patch: patch ? { opcao: String(patch.tipoDePatch ?? ''), qtd: qtd(patch) } : null,
    bordado: bordado ? { opcao: String(bordado.tamanho ?? ''), qtd: qtd(bordado) } : null,
    extras: p.extras ?? [],
  }
}

/* Devolve a cotação com os preços da tabela aplicados, ou a MESMA cotação
   (o mesmo objeto) quando nada muda: quem chama compara por identidade.
   Desde a 083 o preço é a peça (a faixa, com plus e infantil) mais os
   adicionais do layout. */
export function aplicarTabelas(
  c: Cotacao,
  tabelas: TabelaDePreco[],
  pecasDoKit: (codigo: string) => string[],
): Cotacao {
  if (c.aprovacao) return c
  const total = pecasPorTabela(c)
  let mudou = false
  const produtos = c.produtos.map((p) => {
    const id = tabelaDoLayout(c, p)
    const t = id ? tabelas.find((x) => x.id === id) : undefined
    const cod = p.bloco.referencia.trim()
    const item = t && cod ? t.itens.find((i) => i.codigo === cod) : undefined
    const ctx = t ? { achar: (k: string) => t.itens.find((x) => x.codigo === k), pecasDoKit } : undefined
    let novo: ProdutoCotado = p
    if (t && item && ctx) {
      const i = faixaDe(t.faixas, total.get(id) ?? 0)
      const v = celula(t, item, i, ctx).valor
      if (v != null) {
        const daTabela: Partial<Record<string, number>> = {}
        for (const tam of [...TAMANHOS_PLUS, ...TAMANHOS_INFANTIS]) daTabela[tam] = precoDoTamanho(t, v, tam)
        if (p.precoBase !== v || JSON.stringify(p.precoDaTabela ?? {}) !== JSON.stringify(daTabela))
          novo = { ...novo, precoBase: v, precoDaTabela: daTabela }
      }
    }
    /* a conta só existe quando o layout segue uma tabela que tem a peça: sem
       tabela o preço é o escrito, e não há o que somar */
    const conta = t && item && ctx ? contaDosAdicionais(t, item, ctx, escolhasDoLayout(p)) : { partes: [], adicional: 0 }
    const adicional = conta.partes.length ? conta.adicional : undefined
    const partes = conta.partes.length ? conta.partes : undefined
    if ((novo.adicional ?? undefined) !== adicional || JSON.stringify(novo.conta ?? null) !== JSON.stringify(partes ?? null)) {
      const { adicional: _a, conta: _c, ...resto } = novo
      void _a
      void _c
      novo = { ...resto, ...(adicional != null ? { adicional } : {}), ...(partes ? { conta: partes } : {}) }
    }
    if (novo !== p) mudou = true
    return novo
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
