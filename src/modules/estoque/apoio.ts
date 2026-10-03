import {
  NOME_DO_MOTIVO,
  nomeInteiro,
  quantoNaUnidade,
  type GrupoDoEstoque,
  type Material,
  type Movimento,
} from '@dominio/estoque'
import type { Fornecedor, Ligacao } from '@dominio/fornecedor'

/* ==========================================================================
   O que mais de uma caixa do estoque precisa saber, num lugar só.
   ========================================================================== */

/** O que a tela sabe sobre fornecedor. `disponivel` é falso enquanto a
    migração 041 não rodou: aí a tela se cala sobre fornecedor em vez de
    acusar todo material de não ter um. */
export type Fornecimento = {
  fornecedores: Fornecedor[]
  ligacoes: Ligacao[]
  disponivel: boolean
}

export function idsDosFornecedores(ligacoes: Ligacao[], materialId: string): string[] {
  return ligacoes.filter((l) => l.materialId === materialId).map((l) => l.fornecedorId)
}

/* O FORNECEDOR DO GRUPO é o que entrega mais itens dele. Uma malha comprada
   de duas malharias mostra a principal na lista, e as duas aparecem quando o
   material é escolhido. */
export function fornecedorDoGrupo(g: Pick<GrupoDoEstoque, 'itens'>, f: Fornecimento): Fornecedor | null {
  const conta = new Map<string, number>()
  for (const m of g.itens) {
    for (const id of idsDosFornecedores(f.ligacoes, m.id)) conta.set(id, (conta.get(id) ?? 0) + 1)
  }
  let melhor = ''
  let maior = 0
  for (const [id, n] of conta) {
    if (n > maior) {
      melhor = id
      maior = n
    }
  }
  return f.fornecedores.find((x) => x.id === melhor) ?? null
}

export function fornecedorDoMaterial(m: Material, f: Fornecimento): Fornecedor | null {
  const ids = idsDosFornecedores(f.ligacoes, m.id)
  return f.fornecedores.find((x) => x.id === ids[0]) ?? null
}

/* ---------- as datas, do jeito que se fala ------------------------------- */

function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function diasAtras(iso: string, agora = new Date()): number {
  return Math.round((meiaNoite(agora) - meiaNoite(new Date(iso))) / 86400000)
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function diaEMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function diaMesEAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** "hoje, 14:10", "ontem, 16:20", "30/09, 10:05" */
export function quandoFoi(iso: string): string {
  const d = diasAtras(iso)
  const dia = d === 0 ? 'hoje' : d === 1 ? 'ontem' : diaEMes(iso)
  return `${dia}, ${hora(iso)}`
}

/** "Hoje, sexta 02/10", "Ontem, quinta 01/10", "Quarta, 30/09" */
export function diaPorExtenso(iso: string): string {
  const d = diasAtras(iso)
  const semana = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')
  if (d === 0) return `Hoje, ${semana} ${diaEMes(iso)}`
  if (d === 1) return `Ontem, ${semana} ${diaEMes(iso)}`
  return `${semana.charAt(0).toUpperCase() + semana.slice(1)}, ${diaEMes(iso)}`
}

/** A chave do dia, no fuso de quem olha: movimentos do mesmo dia ficam juntos. */
export function chaveDoDia(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ---------- o movimento em palavras -------------------------------------- */

export function quantoMexeu(v: Movimento): string {
  return (v.quantidade > 0 ? '+' : '') + quantoNaUnidade(v.quantidade, v.unidade)
}

/** O material do movimento, com a malha e a cor quando é tecido. */
export function materialDoMovimento(v: Movimento): string {
  return nomeInteiro({ categoria: v.categoria, tecido: v.tecido, cor: v.cor, nome: v.material })
}

/** O que explica o movimento: o pedido, o fornecedor ou a observação. */
export function porQue(v: Movimento): string {
  const partes: string[] = []
  if (v.pedido) partes.push('pedido ' + v.pedido)
  if (v.fornecedor) partes.push(v.fornecedor)
  if (v.observacao && v.observacao !== 'separação do pedido') partes.push(v.observacao)
  return partes.join(', ')
}

export function linhaDoMovimento(v: Movimento): string {
  return [quandoFoi(v.quando), NOME_DO_MOTIVO[v.motivo], porQue(v)].filter(Boolean).join(' · ')
}

export function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`
}
