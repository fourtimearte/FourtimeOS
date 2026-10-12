/* ==========================================================================
   O DEPOSITO DE PECAS PRONTAS (073; prancha 63): as contas, sem banco.

   Um lote e uma referencia numa cor, de uma origem (pronta entrega, sobra de
   pedido ou mostruario), com a grade (tamanho -> pecas) e o lugar. A grade
   adulta e a infantil dividem as mesmas colunas: PP com 2A, P com 4A, e assim
   por diante. O lote e de uma ou de outra, pelos tamanhos que ele tem.
   ========================================================================== */

export type OrigemDaPeca = 'pronta' | 'sobra' | 'mostruario'

export const NOME_DA_ORIGEM_DA_PECA: Record<OrigemDaPeca, string> = {
  pronta: 'Pronta entrega',
  sobra: 'Sobra de pedido',
  mostruario: 'Mostruário',
}

export type LoteDePecas = {
  id: string
  referenciaId: string
  cod: string
  nome: string
  cor: string
  origem: OrigemDaPeca
  pedido: string
  grade: Record<string, number>
  onde: string
  guardadoEm: string
}

/** As colunas da grade: o tamanho adulto em cima e o infantil embaixo. */
export const COLUNAS_DO_DEPOSITO: [string, string][] = [
  ['PP', '2A'],
  ['P', '4A'],
  ['M', '6A'],
  ['G', '8A'],
  ['GG', '10A'],
  ['XG', '12A'],
  ['G1', '14A'],
  ['G2', ''],
  ['G3', ''],
  ['G4', ''],
]
export const TAMANHOS_ADULTOS = COLUNAS_DO_DEPOSITO.map(([a]) => a)
export const TAMANHOS_INFANTIS = COLUNAS_DO_DEPOSITO.map(([, i]) => i).filter(Boolean)

export const totalDoLote = (l: Pick<LoteDePecas, 'grade'>) => Object.values(l.grade).reduce((s, n) => s + (Number(n) || 0), 0)

/** O lote e infantil quando os tamanhos dele sao os de crianca (2A a 14A). */
export const loteInfantil = (l: Pick<LoteDePecas, 'grade'>) => {
  const t = Object.keys(l.grade).filter((k) => l.grade[k] > 0)
  return t.length > 0 && t.every((k) => TAMANHOS_INFANTIS.includes(k))
}

/** O texto da origem na linha: "pronta entrega", "sobra do PD-0398", "mostruário". */
export function textoDaOrigem(l: Pick<LoteDePecas, 'origem' | 'pedido'>): string {
  if (l.origem === 'sobra') return l.pedido ? 'sobra do ' + l.pedido : 'sobra de pedido'
  return l.origem === 'mostruario' ? 'mostruário' : 'pronta entrega'
}

export const DIAS_PARADA = 90

export function diasGuardado(l: Pick<LoteDePecas, 'guardadoEm'>, hoje: Date): number {
  const d = Date.parse(l.guardadoEm)
  return Number.isFinite(d) ? Math.floor((hoje.getTime() - d) / 86400000) : 0
}

export type FiltroDoDeposito = 'tudo' | OrigemDaPeca | 'sem-lugar'

export function noFiltro(l: LoteDePecas, f: FiltroDoDeposito): boolean {
  if (f === 'tudo') return true
  if (f === 'sem-lugar') return !l.onde.trim()
  return l.origem === f
}

/** So os lotes que ainda tem peca. O lote zerado fica no banco, como registro. */
export const lotesVivos = (ls: LoteDePecas[]) => ls.filter((l) => totalDoLote(l) > 0)

export type ResumoDoDeposito = {
  pecas: number
  referencias: number
  semLugar: number
  /** pecas guardadas ha mais de 90 dias */
  paradas: number
  porFiltro: Record<FiltroDoDeposito, number>
}

export function resumoDoDeposito(todos: LoteDePecas[], hoje: Date): ResumoDoDeposito {
  const ls = lotesVivos(todos)
  const porFiltro = { tudo: ls.length, pronta: 0, sobra: 0, mostruario: 0, 'sem-lugar': 0 } as Record<FiltroDoDeposito, number>
  ls.forEach((l) => {
    porFiltro[l.origem]++
    if (!l.onde.trim()) porFiltro['sem-lugar']++
  })
  return {
    pecas: ls.reduce((s, l) => s + totalDoLote(l), 0),
    referencias: new Set(ls.map((l) => l.referenciaId || l.cod)).size,
    semLugar: porFiltro['sem-lugar'],
    paradas: ls.filter((l) => diasGuardado(l, hoje) > DIAS_PARADA).reduce((s, l) => s + totalDoLote(l), 0),
    porFiltro,
  }
}

/** A grade que sai na baixa nao pode passar do que o lote tem. */
export function baixaPossivel(l: Pick<LoteDePecas, 'grade'>, sai: Record<string, number>): string {
  for (const [t, n] of Object.entries(sai)) {
    if (n < 0 || !Number.isInteger(n)) return 'Escreva números inteiros.'
    if (n > (l.grade[t] ?? 0)) return `O lote só tem ${l.grade[t] ?? 0} no tamanho ${t}.`
  }
  if (!Object.values(sai).some((n) => n > 0)) return 'Escreva quantas peças saem.'
  return ''
}
