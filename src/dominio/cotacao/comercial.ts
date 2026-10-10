import type { EstadoDaCotacao } from './tipos'

/* as partes da lista e do pedido que as contas usam. Escritas aqui, e não
   importadas do repositório, para as contas rodarem sem o banco por perto */
type CotacaoNaLista = {
  id: string
  estado: EstadoDaCotacao
  vendedor: string
  total: number
  validaAte: string
  criadaEm: string
  alteradaEm: string
  pedido: string
}
type PedidoDaCotacao = {
  cotacaoId: string
  estado: 'aprovado' | 'separacao' | 'pcp' | 'producao' | 'pronto' | 'enviado' | 'entregue' | 'cancelado'
  aprovadoEm: string
  total: number
  vendedor: string
}

/* ==========================================================================
   AS CONTAS DA PÁGINA DO ORÇAMENTO (pranchas 72, 72b e 73).

   Sem banco e sem navegador: recebe a lista de cotações, os pedidos que elas
   viraram, o mês e o dia de hoje, e devolve o que a página desenha. Assim as
   contas se provam em `npm run contas`, sem tela.

   O que cada número quer dizer, escrito uma vez:
   - ESPERANDO O CLIENTE: as cotações enviadas, de qualquer mês, e a soma delas.
   - VENCEM ESTA SEMANA: as enviadas que perdem a validade de hoje até 7 dias.
   - APROVADAS NO MÊS: os pedidos com a data de aprovação no mês escolhido.
   - RASCUNHOS: as que ainda não saíram.
   - CONVERSÃO: das cotações do mês (as aprovadas no mês, as que esperam o
     cliente e as perdidas no mês), quanto virou pedido. Perdida é recusada ou
     vencida; o mês dela é o da última mudança, porque a lista não guarda o dia
     em que ela foi perdida.
   ========================================================================== */

export type AbaDoComercial = 'aberto' | 'aprovadas' | 'perdidas' | 'todas'

export const ESTADOS_DA_ABA: Record<Exclude<AbaDoComercial, 'todas'>, EstadoDaCotacao[]> = {
  aberto: ['enviada', 'rascunho'],
  aprovadas: ['aprovada'],
  perdidas: ['recusada', 'vencida'],
}

export const naAba = (c: CotacaoNaLista, aba: AbaDoComercial) => aba === 'todas' || ESTADOS_DA_ABA[aba].includes(c.estado)

/** o dia de uma data, no fuso de quem olha: '2026-10-20' fica como está; um instante vira o dia local */
export function diaDe(iso: string): string {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

/** quantos dias de `de` até `ate`, contando o calendário (e não as horas) */
export function diasEntre(de: string, ate: string): number {
  const a = Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))
  const b = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

const ddmm = (dia: string) => dia.slice(8, 10) + '/' + dia.slice(5, 7)

/* O QUE A LINHA DIZ À DIREITA, embaixo do valor. `perto` pinta de vermelho:
   a enviada que acaba em até 3 dias, ou que já acabou. */
export function quandoDaCotacao(c: CotacaoNaLista, hoje: string): { texto: string; perto: boolean } {
  const h = diaDe(hoje)
  if (c.estado === 'enviada') {
    const v = diaDe(c.validaAte)
    if (!v) return { texto: 'sem validade', perto: false }
    const d = diasEntre(h, v)
    if (d < 0) return { texto: 'venceu em ' + ddmm(v), perto: true }
    if (d === 0) return { texto: 'vence hoje', perto: true }
    if (d === 1) return { texto: 'vence amanhã', perto: true }
    return { texto: 'vale até ' + ddmm(v), perto: d <= 3 }
  }
  if (c.estado === 'rascunho') {
    const m = diaDe(c.alteradaEm)
    const d = m ? diasEntre(m, h) : -1
    return { texto: d === 0 ? 'mexida hoje' : d === 1 ? 'mexida ontem' : m ? 'mexida em ' + ddmm(m) : 'rascunho', perto: false }
  }
  if (c.estado === 'aprovada') return { texto: c.pedido ? 'pedido ' + c.pedido : 'aprovada', perto: false }
  if (c.estado === 'vencida') return { texto: c.validaAte ? 'venceu em ' + ddmm(diaDe(c.validaAte)) : 'vencida', perto: false }
  return { texto: 'recusada', perto: false }
}

/* ONDE O PEDIDO ESTÁ AGORA, em palavras de quem vende */
export const ONDE_ESTA_O_PEDIDO: Record<PedidoDaCotacao['estado'], string> = {
  aprovado: 'aprovado, indo para a Separação',
  separacao: 'na Separação',
  pcp: 'no PCP',
  producao: 'na fábrica',
  pronto: 'pronto, esperando o envio',
  enviado: 'enviado ao cliente',
  entregue: 'entregue',
  cancelado: 'cancelado',
}

/* O CAMINHO DO PEDIDO (prancha 73): Cotação, Separação, PCP e Produção. O
   passo de agora é o que está acontecendo; os de antes estão feitos. Depois
   da produção, os quatro estão feitos (agora = 4). */
export function passoDoCaminho(estado: EstadoDaCotacao, pedido: PedidoDaCotacao | null): number {
  if (estado !== 'aprovada' || !pedido) return 0
  switch (pedido.estado) {
    case 'aprovado':
    case 'separacao':
      return 1
    case 'pcp':
      return 2
    case 'producao':
      return 3
    default:
      return 4
  }
}

export type NumeroDoMes = { n: number; valor: number }

export type EstatisticasDoComercial<C = CotacaoNaLista, P = PedidoDaCotacao> = {
  esperando: NumeroDoMes
  vencemNaSemana: number
  aprovadas: NumeroDoMes
  rascunhos: number
  ultimas: { pedido: P; cotacao: C | null }[]
  perdidas: NumeroDoMes
  /** quanto do que saiu virou pedido, de 0 a 100; null quando nada saiu */
  taxa: number | null
  saidas: number
  diasAteAprovar: number | null
  valorMedio: number | null
  maiorEmAberto: number | null
  porVendedor: { nome: string; valor: number; aprovou: number; de: number }[]
}

const soma = (l: { total: number }[]) => l.reduce((s, x) => s + x.total, 0)

export function estatisticasDoComercial<C extends CotacaoNaLista, P extends PedidoDaCotacao>(
  cots: C[],
  pedidos: P[],
  mes: string,
  hoje: string,
): EstatisticasDoComercial<C, P> {
  const h = diaDe(hoje)
  const doMes = (iso: string) => diaDe(iso).slice(0, 7) === mes
  const porId = new Map(cots.map((c) => [c.id, c]))
  const enviadas = cots.filter((c) => c.estado === 'enviada')
  const aprovadasNoMes = pedidos.filter((p) => p.estado !== 'cancelado' && doMes(p.aprovadoEm))
  const perdidasNoMes = cots.filter((c) => (c.estado === 'recusada' || c.estado === 'vencida') && doMes(c.alteradaEm))
  const saidas = aprovadasNoMes.length + enviadas.length + perdidasNoMes.length
  const dias = aprovadasNoMes
    .map((p) => {
      const c = porId.get(p.cotacaoId)
      return c ? diasEntre(diaDe(c.criadaEm), diaDe(p.aprovadoEm)) : null
    })
    .filter((d): d is number => d !== null && d >= 0)
  const nomes = [...new Set([...cots.map((c) => c.vendedor), ...pedidos.map((p) => p.vendedor)].filter(Boolean))].sort()
  return {
    esperando: { n: enviadas.length, valor: soma(enviadas) },
    vencemNaSemana: enviadas.filter((c) => {
      const v = diaDe(c.validaAte)
      if (!v) return false
      const d = diasEntre(h, v)
      return d >= 0 && d <= 7
    }).length,
    aprovadas: { n: aprovadasNoMes.length, valor: soma(aprovadasNoMes) },
    rascunhos: cots.filter((c) => c.estado === 'rascunho').length,
    ultimas: [...pedidos]
      .filter((p) => p.estado !== 'cancelado')
      .sort((a, b) => (a.aprovadoEm < b.aprovadoEm ? 1 : -1))
      .slice(0, 3)
      .map((p) => ({ pedido: p, cotacao: porId.get(p.cotacaoId) ?? null })),
    perdidas: { n: perdidasNoMes.length, valor: soma(perdidasNoMes) },
    taxa: saidas ? Math.round((aprovadasNoMes.length / saidas) * 100) : null,
    saidas,
    diasAteAprovar: dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null,
    valorMedio: aprovadasNoMes.length ? soma(aprovadasNoMes) / aprovadasNoMes.length : null,
    maiorEmAberto: enviadas.length ? Math.max(...enviadas.map((c) => c.total)) : null,
    porVendedor: nomes.map((nome) => {
      const ap = aprovadasNoMes.filter((p) => p.vendedor === nome)
      const de =
        ap.length +
        enviadas.filter((c) => c.vendedor === nome).length +
        perdidasNoMes.filter((c) => c.vendedor === nome).length
      return { nome, valor: soma(ap), aprovou: ap.length, de }
    }),
  }
}

/** os últimos doze meses, do mais novo para o mais velho, como 'AAAA-MM' */
export function ultimosMeses(hoje: string, n = 12): string[] {
  const h = diaDe(hoje)
  let a = +h.slice(0, 4)
  let m = +h.slice(5, 7)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(a + '-' + String(m).padStart(2, '0'))
    m -= 1
    if (!m) {
      m = 12
      a -= 1
    }
  }
  return out
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeDoMes = (mes: string) => MESES[+mes.slice(5, 7) - 1] ?? ''
export const nomeDoMesComAno = (mes: string) => {
  const n = nomeDoMes(mes)
  return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + mes.slice(0, 4)
}
