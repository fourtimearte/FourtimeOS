import { MES_LONGO, chaveDoMes, lerMes, mesesAte } from '../../shared/meses'
import { TAMANHOS_ADULTO, TAMANHOS_INFANTIL } from '../layout/grade'
import { TODOS_OS_TAMANHOS } from './contas'

/* ==========================================================================
   O MOVIMENTO E AS VENDAS: as contas em cima dos layouts dos pedidos.

   O banco só copia (migração 053): de cada pedido, os layouts que o orçamento
   aprovado tem, com a referência, a grade e as técnicas. Somar é daqui, e
   conta se prova sozinha (sh testes/produto.sh).

   DUAS PERGUNTAS, DUAS DATAS.
     O MOVIMENTO pergunta o que a fábrica FEZ: vale o dia em que o layout
     ficou pronto (a última fatia dele fechou, ou o pedido foi finalizado).
     AS ESTATÍSTICAS perguntam o que VENDEU: vale o dia em que o orçamento
     foi aprovado. Um pedido aprovado em setembro e feito em outubro é venda
     de setembro e movimento de outubro.

   O KIT CONTA AS PEÇAS DELE. Um layout de 89 kits de camiseta e calção são 89
   kits e 178 peças de roupa: 89 de cada referência. A peça vendida dentro de
   kit entra no ranking das referências e também no dos kits.

   O MÊS É O DE QUEM ESTÁ OLHANDO, e não o do servidor: a venda das dez da
   noite do dia 31 em Goiânia é do dia 31.
   ========================================================================== */

/** Um layout de um pedido, como a view layout_na_fabrica devolve. */
export type LayoutVendido = {
  pedidoId: string
  numero: string
  cliente: string
  /** aprovado, separacao, pcp, producao, pronto, enviado ou entregue: cancelado não chega aqui */
  estado: string
  /** o posto do pedido inteiro, que vale para o layout sem fatia */
  etapa: string
  etapaEm: string
  aprovadoEm: string
  fechadoEm: string
  teste: boolean
  /** a posição no orçamento, começando em 1 */
  ordem: number
  /** o número da folha (L-01), que é como a fatia do kanban chama o layout */
  layout: number
  /** o código como está no orçamento, ou vazio */
  referencia: string
  nome: string
  arte: string
  grade: Record<string, number>
  /** quantas unidades: peças, ou kits quando a referência é um kit */
  pecas: number
  tecnicas: string[]
  /** a referência do catálogo, quando o orçamento aponta para uma que existe */
  referenciaId: string | null
  kit: boolean
}

/** Uma fatia do kanban: uma técnica do pedido, com os layouts que passam por ela. */
export type FatiaDoLayout = {
  pedidoId: string
  tecnica: string
  etapa: string
  etapaEm: string
  fechadoEm: string
  layouts: number[]
}

export type PecaDeKit = { referenciaId: string; cod: string; nome: string }
/** as peças de cada kit, pelo id do kit */
export type PecasDosKits = Record<string, PecaDeKit[]>

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** O mês de um instante, na hora de quem está olhando: "2026-10". Vazio quando não há data. */
export function mesDe(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : chaveDoMes(d.getFullYear(), d.getMonth())
}

/** Quantas peças de roupa o layout tem: o kit conta as peças dele. Kit sem peça cadastrada conta uma. */
export function pecasDoLayout(l: LayoutVendido, kits: PecasDosKits): number {
  if (!l.kit) return l.pecas
  const n = l.referenciaId ? (kits[l.referenciaId]?.length ?? 0) : 0
  return l.pecas * Math.max(1, n)
}

/* --- o movimento ---------------------------------------------------------------- */

export type SituacaoDoLayout = {
  pronto: boolean
  /** o posto em que o layout está; vazio quando o pedido ainda não entrou na produção */
  etapa: string
  /** quando ficou pronto, ou desde quando está neste posto */
  em: string
}

const ULTIMA_ETAPA = 'finalizado'
/* o pedido saiu da produção: pronto, e depois dele enviado e entregue */
const SAIU_DA_FABRICA = ['pronto', 'enviado', 'entregue']
/** O pedido está na fábrica, ou já passou por ela. Antes disso (Separação, PCP) não é movimento. */
export const passouPelaFabrica = (estado: string) => estado === 'producao' || SAIU_DA_FABRICA.includes(estado)
const maisNovo = (datas: string[]) => datas.filter(Boolean).sort().pop() ?? ''

/** Onde o layout está na fábrica. `dele` são só as fatias do pedido dele. */
export function situacaoDoLayout(
  l: LayoutVendido,
  doPedido: FatiaDoLayout[],
  ordemDasEtapas: readonly string[],
): SituacaoDoLayout {
  if (!passouPelaFabrica(l.estado)) return { pronto: false, etapa: '', em: '' }
  const dele = doPedido.filter(f => f.pedidoId === l.pedidoId && f.layouts.includes(l.layout))
  const abertas = dele.filter(f => f.etapa !== ULTIMA_ETAPA)
  const fecharam = maisNovo(dele.filter(f => f.etapa === ULTIMA_ETAPA).map(f => f.fechadoEm || f.etapaEm))

  if (SAIU_DA_FABRICA.includes(l.estado)) {
    /* o pedido foi finalizado: o layout está pronto. O dia é o da última
       fatia dele, e sem fatia fechada, o do pedido */
    const em = dele.length && !abertas.length && fecharam ? fecharam : l.fechadoEm || l.etapaEm
    return { pronto: true, etapa: ULTIMA_ETAPA, em }
  }
  if (dele.length && !abertas.length) return { pronto: true, etapa: ULTIMA_ETAPA, em: fecharam }
  if (abertas.length) {
    /* quem segura o layout é a fatia mais atrasada: a do posto que vem antes
       na ordem da fábrica, e no empate, a que está parada há mais tempo */
    const lugar = (e: string) => {
      const i = ordemDasEtapas.indexOf(e)
      return i < 0 ? 0 : i
    }
    const presa = [...abertas].sort((a, b) => lugar(a.etapa) - lugar(b.etapa) || a.etapaEm.localeCompare(b.etapaEm))[0]
    return { pronto: false, etapa: presa.etapa, em: presa.etapaEm }
  }
  /* sem técnica que vire fatia (uma peça lisa): vale o posto do pedido */
  return { pronto: l.etapa === ULTIMA_ETAPA, etapa: l.etapa, em: l.etapaEm }
}

export type LinhaDoMovimento = SituacaoDoLayout & {
  l: LayoutVendido
  /** peças de roupa: o kit já multiplicado */
  pecasDeRoupa: number
}

export type PedidoNoMovimento = {
  pedidoId: string
  numero: string
  cliente: string
  teste: boolean
  /** o instante mais novo entre as linhas: é o que ordena a lista */
  quando: string
  pecasDeRoupa: number
  /** alguma linha ainda não está pronta */
  emProducao: boolean
  linhas: LinhaDoMovimento[]
}

export type Movimento = {
  pedidos: PedidoNoMovimento[]
  /** do mês escolhido */
  pecasFeitas: number
  orcamentosComPecaFeita: number
  kitsFeitos: number
  /** de agora, qualquer que seja o mês escolhido */
  pecasEmProducao: number
  orcamentosEmProducao: number
}

/** Todos os layouts que estão ou estiveram na fábrica, cada um com a situação dele. */
export function linhasDaFabrica(
  layouts: LayoutVendido[],
  fatias: FatiaDoLayout[],
  kits: PecasDosKits,
  ordemDasEtapas: readonly string[],
): LinhaDoMovimento[] {
  const porPedido = new Map<string, FatiaDoLayout[]>()
  for (const f of fatias) {
    const lista = porPedido.get(f.pedidoId)
    if (lista) lista.push(f)
    else porPedido.set(f.pedidoId, [f])
  }
  const saida: LinhaDoMovimento[] = []
  for (const l of layouts) {
    if (!passouPelaFabrica(l.estado)) continue
    const s = situacaoDoLayout(l, porPedido.get(l.pedidoId) ?? [], ordemDasEtapas)
    saida.push({ ...s, l, pecasDeRoupa: pecasDoLayout(l, kits) })
  }
  return saida
}

/** O movimento de um mês: o que ficou pronto nele e, no mês que está correndo, o que ainda está na fábrica. */
export function movimentoDoMes(linhas: LinhaDoMovimento[], mes: string, mesAtual: string): Movimento {
  const grupos = new Map<string, PedidoNoMovimento>()
  let pecasEmProducao = 0
  const pedidosEmProducao = new Set<string>()
  for (const x of linhas) {
    if (!x.pronto) {
      pecasEmProducao += x.pecasDeRoupa
      pedidosEmProducao.add(x.l.pedidoId)
    }
    const entra = x.pronto ? mesDe(x.em) === mes : mes === mesAtual
    if (!entra) continue
    let g = grupos.get(x.l.pedidoId)
    if (!g) {
      g = {
        pedidoId: x.l.pedidoId,
        numero: x.l.numero,
        cliente: x.l.cliente,
        teste: x.l.teste,
        quando: '',
        pecasDeRoupa: 0,
        emProducao: false,
        linhas: [],
      }
      grupos.set(x.l.pedidoId, g)
    }
    g.linhas.push(x)
    g.pecasDeRoupa += x.pecasDeRoupa
    if (!x.pronto) g.emProducao = true
    if (x.em > g.quando) g.quando = x.em
  }
  const pedidos = [...grupos.values()].sort((a, b) => b.quando.localeCompare(a.quando) || b.numero.localeCompare(a.numero))
  for (const g of pedidos) g.linhas.sort((a, b) => a.l.ordem - b.l.ordem)
  const prontas = pedidos.flatMap(g => g.linhas).filter(x => x.pronto)
  return {
    pedidos,
    pecasFeitas: prontas.reduce((a, x) => a + x.pecasDeRoupa, 0),
    orcamentosComPecaFeita: pedidos.filter(g => g.linhas.some(x => x.pronto)).length,
    kitsFeitos: prontas.filter(x => x.l.kit).reduce((a, x) => a + x.l.pecas, 0),
    pecasEmProducao,
    orcamentosEmProducao: pedidosEmProducao.size,
  }
}

/** As últimas peças que ficaram prontas, da mais nova para a mais velha. */
export function ultimasFeitas(linhas: LinhaDoMovimento[], quantas: number): LinhaDoMovimento[] {
  return linhas
    .filter(x => x.pronto && x.em)
    .sort((a, b) => b.em.localeCompare(a.em) || a.l.numero.localeCompare(b.l.numero) || a.l.ordem - b.l.ordem)
    .slice(0, quantas)
}

/** A linha casa com o que foi digitado: pela peça, pelo código, pelo pedido ou pelo cliente. */
export function casaComOMovimento(x: LinhaDoMovimento, busca: string): boolean {
  const termo = semAcento(busca.trim()).toLowerCase()
  if (!termo) return true
  return [x.l.nome, x.l.referencia, x.l.numero, x.l.cliente, x.l.arte].some(t => semAcento(t).toLowerCase().includes(termo))
}

export type ReferenciaNoMovimento = {
  chave: string
  referenciaId: string | null
  cod: string
  nome: string
  kit: boolean
  /** unidades: peças, ou kits */
  unidades: number
  orcamentos: number
  linhas: LinhaDoMovimento[]
}

/** As mesmas linhas, juntas por referência em vez de por orçamento. */
export function movimentoPorReferencia(pedidos: PedidoNoMovimento[]): ReferenciaNoMovimento[] {
  const grupos = new Map<string, ReferenciaNoMovimento & { pedidos: Set<string> }>()
  for (const g of pedidos) {
    for (const x of g.linhas) {
      const chave = x.l.referenciaId ?? 'fora:' + (x.l.referencia || x.l.nome)
      let r = grupos.get(chave)
      if (!r) {
        r = {
          chave,
          referenciaId: x.l.referenciaId,
          cod: x.l.referencia,
          nome: x.l.nome,
          kit: x.l.kit,
          unidades: 0,
          orcamentos: 0,
          linhas: [],
          pedidos: new Set(),
        }
        grupos.set(chave, r)
      }
      r.linhas.push(x)
      r.unidades += x.l.pecas
      r.pedidos.add(x.l.pedidoId)
    }
  }
  return [...grupos.values()]
    .map(({ pedidos: quais, ...r }) => ({ ...r, orcamentos: quais.size }))
    .sort((a, b) => b.unidades - a.unidades || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/* --- as vendas ------------------------------------------------------------------ */

export type Periodo = 1 | 3 | 6 | 12

/** de: o primeiro instante que conta. ate: o primeiro que já não conta. */
export type Janela = { de: string; ate: string }

const noMes = (ano: number, mes: number, dia: number) => {
  /* o dia 31 num mês de 30 vira o último dia dele, e não o dia 1º do seguinte */
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimo))
}

/* A JANELA QUE VALE E A QUE COMPARA. O período vai do dia 1º do primeiro mês
   até hoje. A comparação é com o MESMO TRECHO, tantos meses antes: no dia 6
   de outubro, "1 mês" compara 1 a 6 de outubro com 1 a 6 de setembro.
   Comparar seis dias com um mês inteiro diria que tudo caiu. */
export function janelasDoPeriodo(
  periodo: Periodo,
  hoje: Date,
): { atual: Janela; anterior: Janela; meses: string[]; mesesAntes: string[] } {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const dia = hoje.getDate()
  const amanha = new Date(ano, mes, dia + 1)
  const fimDeAntes = noMes(ano, mes - periodo, dia)
  fimDeAntes.setDate(fimDeAntes.getDate() + 1)
  const fim = chaveDoMes(ano, mes)
  const meses = mesesAte(fim, periodo)
  return {
    atual: { de: new Date(ano, mes - (periodo - 1), 1).toISOString(), ate: amanha.toISOString() },
    anterior: { de: new Date(ano, mes - (periodo - 1) - periodo, 1).toISOString(), ate: fimDeAntes.toISOString() },
    meses,
    mesesAntes: mesesAte(meses[0], periodo + 1).slice(0, periodo),
  }
}

const minusculo = (chave: string) => MES_LONGO[lerMes(chave).mes]

/** "em outubro", "de agosto a outubro": o período como a tela escreve. */
export function periodoEmPalavras(meses: string[]): string {
  if (!meses.length) return ''
  return meses.length === 1 ? 'em ' + minusculo(meses[0]) : `de ${minusculo(meses[0])} a ${minusculo(meses[meses.length - 1])}`
}

/** "contra setembro", "contra os 3 meses antes": com o que a tela compara. */
export function comparacaoEmPalavras(mesesAntes: string[]): string {
  if (!mesesAntes.length) return ''
  return mesesAntes.length === 1 ? 'contra ' + minusculo(mesesAntes[0]) : `contra os ${mesesAntes.length} meses antes`
}

const dentro = (l: LayoutVendido, j: Janela) => {
  if (!l.aprovadoEm) return false
  const t = new Date(l.aprovadoEm).getTime()
  return t >= new Date(j.de).getTime() && t < new Date(j.ate).getTime()
}

export type Rumo = 'subiu' | 'igual' | 'caiu'

/** Subiu, caiu ou ficou igual. Diferença de até 5% é igual: uma peça a mais em cem não é subida. */
export function rumoDe(agora: number, antes: number): Rumo {
  if (Math.abs(agora - antes) <= Math.max(agora, antes) * 0.05) return 'igual'
  return agora > antes ? 'subiu' : 'caiu'
}

export type Vendida = {
  chave: string
  referenciaId: string | null
  cod: string
  nome: string
  /** peças de roupa no ranking das referências; kits no ranking dos kits */
  quanto: number
  orcamentos: number
  /** a parte dela no total, de 0 a 1 */
  parte: number
  antes: number
  rumo: Rumo
}

type Soma = { referenciaId: string | null; cod: string; nome: string; quanto: number; pedidos: Set<string> }

function somar(mapa: Map<string, Soma>, chave: string, de: Omit<Soma, 'quanto' | 'pedidos'>, quanto: number, pedido: string) {
  let s = mapa.get(chave)
  if (!s) {
    s = { ...de, quanto: 0, pedidos: new Set() }
    mapa.set(chave, s)
  }
  s.quanto += quanto
  s.pedidos.add(pedido)
}

/** As peças de roupa de cada referência numa janela. O kit vira as peças dele. */
function pecasPorReferencia(layouts: LayoutVendido[], kits: PecasDosKits, j: Janela): Map<string, Soma> {
  const mapa = new Map<string, Soma>()
  for (const l of layouts) {
    if (!dentro(l, j)) continue
    const doKit = l.kit && l.referenciaId ? (kits[l.referenciaId] ?? []) : []
    if (doKit.length) {
      for (const p of doKit) {
        somar(mapa, p.referenciaId, { referenciaId: p.referenciaId, cod: p.cod, nome: p.nome }, l.pecas, l.pedidoId)
      }
      continue
    }
    /* a peça escolhida só pelo nome, ou que saiu do catálogo, fica com o nome que o orçamento deu */
    const chave = l.referenciaId ?? 'fora:' + (l.referencia || l.nome)
    somar(mapa, chave, { referenciaId: l.referenciaId, cod: l.referencia, nome: l.nome }, l.pecas, l.pedidoId)
  }
  return mapa
}

/** Os kits vendidos numa janela, em kits. */
function kitsPorKit(layouts: LayoutVendido[], j: Janela): Map<string, Soma> {
  const mapa = new Map<string, Soma>()
  for (const l of layouts) {
    if (!l.kit || !l.referenciaId || !dentro(l, j)) continue
    somar(mapa, l.referenciaId, { referenciaId: l.referenciaId, cod: l.referencia, nome: l.nome }, l.pecas, l.pedidoId)
  }
  return mapa
}

function emRanking(agora: Map<string, Soma>, antes: Map<string, Soma>): Vendida[] {
  const total = [...agora.values()].reduce((a, s) => a + s.quanto, 0)
  return [...agora.entries()]
    .map(([chave, s]): Vendida => {
      const eraAntes = antes.get(chave)?.quanto ?? 0
      return {
        chave,
        referenciaId: s.referenciaId,
        cod: s.cod,
        nome: s.nome,
        quanto: s.quanto,
        orcamentos: s.pedidos.size,
        parte: total ? s.quanto / total : 0,
        antes: eraAntes,
        rumo: rumoDe(s.quanto, eraAntes),
      }
    })
    .sort((a, b) => b.quanto - a.quanto || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** As referências que mais venderam, em peças de roupa. A peça de dentro do kit conta aqui. */
export function rankingDeReferencias(layouts: LayoutVendido[], kits: PecasDosKits, atual: Janela, anterior?: Janela): Vendida[] {
  return emRanking(
    pecasPorReferencia(layouts, kits, atual),
    anterior ? pecasPorReferencia(layouts, kits, anterior) : new Map(),
  )
}

/** Os kits que mais venderam, em kits. */
export function rankingDeKits(layouts: LayoutVendido[], atual: Janela, anterior?: Janela): Vendida[] {
  return emRanking(kitsPorKit(layouts, atual), anterior ? kitsPorKit(layouts, anterior) : new Map())
}

/** Quantas peças de roupa foram vendidas na janela. */
export function pecasVendidas(layouts: LayoutVendido[], kits: PecasDosKits, j: Janela): number {
  return layouts.reduce((a, l) => (dentro(l, j) ? a + pecasDoLayout(l, kits) : a), 0)
}

/** Em quantos orçamentos a referência (peça ou kit) saiu na janela. */
export function orcamentosCom(layouts: LayoutVendido[], referenciaId: string, j: Janela): number {
  return new Set(layouts.filter(l => l.referenciaId === referenciaId && dentro(l, j)).map(l => l.pedidoId)).size
}

export type TamanhoVendido = { tamanho: string; pecas: number; parte: number }

/** A parte de cada tamanho nas peças vendidas. Só os tamanhos que saíram, na ordem da fábrica. */
export function tamanhosVendidos(layouts: LayoutVendido[], kits: PecasDosKits, j: Janela): TamanhoVendido[] {
  const soma = new Map<string, number>()
  for (const l of layouts) {
    if (!dentro(l, j)) continue
    const vezes = l.pecas ? pecasDoLayout(l, kits) / l.pecas : 1
    for (const [t, n] of Object.entries(l.grade)) soma.set(t, (soma.get(t) ?? 0) + n * vezes)
  }
  const total = [...soma.values()].reduce((a, n) => a + n, 0)
  /* entre o menor e o maior que saíram, o tamanho que não vendeu aparece com
     zero: buraco no meio da grade é informação. Cada faixa tem o seu trecho */
  const trecho = (faixa: readonly string[]) => {
    const sairam = faixa.map((t, i) => ((soma.get(t) ?? 0) > 0 ? i : -1)).filter(i => i >= 0)
    return sairam.length ? faixa.slice(sairam[0], sairam[sairam.length - 1] + 1) : []
  }
  const conhecidos = [...trecho(TAMANHOS_ADULTO), ...trecho(TAMANHOS_INFANTIL)]
  const outros = [...soma.keys()].filter(t => !TODOS_OS_TAMANHOS.includes(t)).sort()
  return [...conhecidos, ...outros].map(t => {
    const pecas = soma.get(t) ?? 0
    return { tamanho: t, pecas, parte: total ? pecas / total : 0 }
  })
}

/** As peças vendidas em cada um dos últimos meses, do mais velho para o que está correndo. */
export function vendaMesAMes(
  layouts: LayoutVendido[],
  kits: PecasDosKits,
  hoje: Date,
  quantos = 6,
): { mes: string; pecas: number; corrente: boolean }[] {
  const fim = chaveDoMes(hoje.getFullYear(), hoje.getMonth())
  const meses = mesesAte(fim, quantos)
  const soma = new Map<string, number>(meses.map(m => [m, 0]))
  for (const l of layouts) {
    const m = mesDe(l.aprovadoEm)
    if (soma.has(m)) soma.set(m, (soma.get(m) ?? 0) + pecasDoLayout(l, kits))
  }
  return meses.map(m => ({ mes: m, pecas: soma.get(m) ?? 0, corrente: m === fim }))
}

/** Os últimos orçamentos em que a referência (peça ou kit) entrou, do mais novo para o mais velho. */
export function ultimosOrcamentosCom(
  layouts: LayoutVendido[],
  referenciaId: string,
  quantos: number,
): { pedidoId: string; numero: string; cliente: string; estado: string; aprovadoEm: string; fechadoEm: string; unidades: number }[] {
  const porPedido = new Map<string, { l: LayoutVendido; unidades: number }>()
  for (const l of layouts) {
    if (l.referenciaId !== referenciaId) continue
    const ja = porPedido.get(l.pedidoId)
    if (ja) ja.unidades += l.pecas
    else porPedido.set(l.pedidoId, { l, unidades: l.pecas })
  }
  return [...porPedido.values()]
    .sort((a, b) => b.l.aprovadoEm.localeCompare(a.l.aprovadoEm) || b.l.numero.localeCompare(a.l.numero))
    .slice(0, quantos)
    .map(({ l, unidades }) => ({
      pedidoId: l.pedidoId,
      numero: l.numero,
      cliente: l.cliente,
      estado: l.estado,
      aprovadoEm: l.aprovadoEm,
      fechadoEm: l.fechadoEm,
      unidades,
    }))
}
