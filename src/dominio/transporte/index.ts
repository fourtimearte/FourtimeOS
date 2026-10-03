import { chamar, tabela } from '@shared/supabase'
import { semAcento } from '@shared'

/* ==========================================================================
   O transporte.

   Tudo que a Fourtime paga para alguma coisa sair de um lugar e chegar em
   outro: a transportadora que leva a encomenda, o motoboy que entrega em
   Goiânia, o Uber e o táxi de quem foi buscar malha ou levar um pedido com
   pressa.

   SÃO DUAS COISAS. Quem transporta é o cadastro: a transportadora, o
   motoboy, o Uber, o táxi. O lançamento é o pagamento de uma corrida: quem
   levou, para quê, quanto custou e se já foi pago. O relatório é a soma dos
   lançamentos, e por isso não tem tabela própria.

   A TRANSPORTADORA SAIU DE FORNECEDORES. Fornecedor é de quem a Fourtime
   compra material; transporte é serviço que se paga por corrida, com motoboy
   e aplicativo no meio, que nem CNPJ têm. O Verificador de Boleto continua
   conhecendo o CNPJ da transportadora, porque o boleto dela chega do mesmo
   jeito que o de qualquer outro.

   "A PAGAR" É O QUE FAZ ESTA PÁGINA SER USADA TODO DIA. O motoboy costuma
   receber no fim do dia ou da semana, e a transportadora manda boleto. O
   lançamento nasce no dia da corrida e fica aberto até alguém acertar.
   ========================================================================== */

export type Meio = 'transportadora' | 'motoboy' | 'uber' | 'taxi'
export const MEIOS: Meio[] = ['motoboy', 'uber', 'taxi', 'transportadora']

export const NOME_DO_MEIO: Record<Meio, string> = {
  motoboy: 'Motoboy',
  uber: 'Uber',
  taxi: 'Táxi',
  transportadora: 'Transportadora',
}

export type Motivo = 'entrega' | 'busca' | 'outro'
export const MOTIVOS: Motivo[] = ['entrega', 'busca', 'outro']

export const NOME_DO_MOTIVO: Record<Motivo, string> = {
  entrega: 'Entrega ao cliente',
  busca: 'Busca de material',
  outro: 'Outro',
}

export type Forma = 'pix' | 'dinheiro' | 'cartao' | 'boleto'
export const FORMAS: Forma[] = ['pix', 'dinheiro', 'cartao', 'boleto']

export const NOME_DA_FORMA: Record<Forma, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  boleto: 'Boleto',
}

/** Quem transporta: a transportadora, o motoboy, o Uber, o táxi. */
export type TransportadorNovo = {
  id?: string
  nome: string
  meio: Meio
  cnpj: string
  contato: string
  ondeAtende: string
  prazo: string
  observacao: string
}

export async function salvarTransportador(n: TransportadorNovo): Promise<void> {
  await chamar('salvar_transportador', {
    p_id: n.id ?? null,
    p_nome: n.nome.trim(),
    p_meio: n.meio,
    p_cnpj: n.cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null,
    p_contato: n.contato.trim(),
    p_onde_atende: n.ondeAtende.trim(),
    p_prazo: n.prazo.trim(),
    p_observacao: n.observacao.trim(),
  })
}

export type Transportador = {
  id: string
  nome: string
  meio: Meio
  /** só a transportadora tem; é o que o Verificador de Boleto confere */
  cnpj: string | null
  contato: string
  ondeAtende: string
  prazo: string
  observacao: string
}

/** O pagamento de uma corrida. */
export type Lancamento = {
  id: string
  /** o dia e a hora da corrida, em ISO */
  quando: string
  meio: Meio
  transportadorId: string
  transportador: string
  motivo: Motivo
  /** o número do pedido, quando a corrida é de um pedido */
  pedido: string
  cliente: string
  /** de quem veio o material, quando é busca */
  fornecedorId: string
  fornecedor: string
  /** para onde foi, ou de onde veio: bairro e cidade bastam */
  destino: string
  valor: number
  forma: Forma
  pago: boolean
  pagoEm: string | null
  /** quem lançou */
  quem: string
  observacao: string
}

type LinhaDoTransportador = {
  id: string
  nome: string
  meio: Meio
  cnpj: string | null
  contato: string | null
  onde_atende: string | null
  prazo: string | null
  observacao: string | null
}

type LinhaDoLancamento = {
  id: string
  quando: string
  meio: Meio
  transportador_id: string
  transportador: string
  motivo: Motivo
  pedido: string | null
  cliente: string | null
  fornecedor_id: string | null
  fornecedor: string | null
  destino: string | null
  valor: number | string
  forma: Forma
  pago: boolean
  pago_em: string | null
  quem_nome: string | null
  observacao: string | null
}

export async function carregarTransportadores(): Promise<Transportador[]> {
  const linhas = await tabela<LinhaDoTransportador[]>('transportador_na_lista?select=*&order=nome.asc')
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    meio: l.meio,
    cnpj: l.cnpj,
    contato: l.contato ?? '',
    ondeAtende: l.onde_atende ?? '',
    prazo: l.prazo ?? '',
    observacao: l.observacao ?? '',
  }))
}

/** Os lançamentos de um intervalo, do mais novo para o mais velho. */
export async function carregarLancamentos(de: string, ate: string): Promise<Lancamento[]> {
  const linhas = await tabela<LinhaDoLancamento[]>(
    `lancamento_de_transporte_na_lista?select=*&quando=gte.${encodeURIComponent(de)}&quando=lt.${encodeURIComponent(ate)}&order=quando.desc`,
  )
  return linhas.map((l) => ({
    id: l.id,
    quando: l.quando,
    meio: l.meio,
    transportadorId: l.transportador_id,
    transportador: l.transportador,
    motivo: l.motivo,
    pedido: l.pedido ?? '',
    cliente: l.cliente ?? '',
    fornecedorId: l.fornecedor_id ?? '',
    fornecedor: l.fornecedor ?? '',
    destino: l.destino ?? '',
    valor: Number(l.valor) || 0,
    forma: l.forma,
    pago: !!l.pago,
    pagoEm: l.pago_em,
    quem: l.quem_nome ?? '',
    observacao: l.observacao ?? '',
  }))
}

export type LancamentoNovo = {
  /** quando vem, é a correção de um lançamento que já existe */
  id?: string
  quando: string
  transportadorId: string
  motivo: Motivo
  /** o número do pedido; a função do banco acha o id */
  pedido: string
  fornecedorId: string
  destino: string
  valor: number
  forma: Forma
  pago: boolean
  observacao: string
}

export async function lancarTransporte(n: LancamentoNovo): Promise<void> {
  await chamar('lancar_transporte', {
    p_id: n.id ?? null,
    p_quando: n.quando,
    p_transportador: n.transportadorId,
    p_motivo: n.motivo,
    p_pedido: n.pedido || null,
    p_fornecedor: n.fornecedorId || null,
    p_destino: n.destino,
    p_valor: n.valor,
    p_forma: n.forma,
    p_pago: n.pago,
    p_observacao: n.observacao,
  })
}

/** Acertar: marca como pagos, de uma vez, os lançamentos abertos escolhidos. */
export async function acertarTransporte(ids: string[]): Promise<void> {
  await chamar('acertar_transporte', { p_lancamentos: ids })
}

/* ---------- as contas, todas puras ---------------------------------------- */

export const somaDe = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0)
export const abertos = (ls: Lancamento[]) => ls.filter((l) => !l.pago)

export type Fatia = { chave: string; nome: string; corridas: number; valor: number; parte: number }

/** A soma repartida por uma chave, da maior fatia para a menor. */
export function repartir(
  ls: Lancamento[],
  chaveDe: (l: Lancamento) => string,
  nomeDe: (chave: string) => string,
): Fatia[] {
  const total = somaDe(ls) || 1
  const mapa = new Map<string, { corridas: number; valor: number }>()
  ls.forEach((l) => {
    const k = chaveDe(l)
    const ja = mapa.get(k) ?? { corridas: 0, valor: 0 }
    mapa.set(k, { corridas: ja.corridas + 1, valor: ja.valor + l.valor })
  })
  return [...mapa.entries()]
    .map(([chave, v]) => ({ chave, nome: nomeDe(chave), corridas: v.corridas, valor: v.valor, parte: v.valor / total }))
    .sort((a, b) => b.valor - a.valor)
}

/** A semana do mês em que o dia cai: do dia 1 ao 7 é a primeira, e assim vai. */
export const semanaDoMes = (iso: string) => Math.min(5, Math.ceil(new Date(iso).getDate() / 7))

/** "PD-0412 · Colégio Atena", "Malharia Exemplo Ltda" ou o que estiver escrito. */
export function paraQue(l: Lancamento): string {
  if (l.motivo === 'entrega') return [l.pedido, l.cliente].filter(Boolean).join(' · ') || 'Entrega ao cliente'
  if (l.motivo === 'busca') return l.fornecedor || 'Busca de material'
  return l.observacao || 'Outro'
}

export function combinaComLancamento(l: Lancamento, busca: string): boolean {
  const b = semAcento(busca)
  if (!b) return true
  return semAcento(
    [l.transportador, NOME_DO_MEIO[l.meio], l.pedido, l.cliente, l.fornecedor, l.destino, l.observacao].join(' '),
  ).includes(b)
}

/* O primeiro instante de um mês e o primeiro do mês seguinte, NA HORA DE QUEM
   ESTÁ OLHANDO. O banco guarda em UTC, e a corrida das dez da noite do dia 31
   em Goiânia já é dia 1º lá: pedir o mês pela data solta jogaria essa corrida
   no relatório do mês seguinte. */
export function limitesDoMes(ano: number, mes: number): { de: string; ate: string } {
  return { de: new Date(ano, mes, 1).toISOString(), ate: new Date(ano, mes + 1, 1).toISOString() }
}

/** A planilha do relatório: uma linha por lançamento, separada por ponto e vírgula. */
export function planilhaDoPeriodo(ls: Lancamento[]): string {
  const aspas = (t: string) => '"' + t.replace(/"/g, '""') + '"'
  const linhas = [
    ['Data', 'Hora', 'Meio', 'Quem levou', 'Para quê', 'Pedido', 'Destino', 'Valor', 'Pagamento', 'Situação', 'Lançado por'],
    ...[...ls].reverse().map((l) => {
      const d = new Date(l.quando)
      return [
        d.toLocaleDateString('pt-BR'),
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        NOME_DO_MEIO[l.meio],
        l.transportador,
        NOME_DO_MOTIVO[l.motivo],
        l.pedido,
        l.destino,
        l.valor.toFixed(2).replace('.', ','),
        NOME_DA_FORMA[l.forma],
        l.pago ? 'Pago' : 'A pagar',
        l.quem,
      ]
    }),
  ]
  return linhas.map((c) => c.map((x) => aspas(String(x))).join(';')).join('\r\n')
}

/* ---------- o apoio da folha de lançar ------------------------------------ */

/** Os pedidos que a folha oferece. Apoio: se a lista não vier, a folha ainda lança sem pedido. */
export async function pedidosParaOTransporte(): Promise<{ numero: string; cliente: string }[]> {
  try {
    const linhas = await tabela<{ numero: string; cliente: string | null }[]>(
      'pedido_na_fabrica?select=numero,cliente&order=numero.desc&limit=300',
    )
    return linhas.map((l) => ({ numero: l.numero, cliente: l.cliente ?? '' }))
  } catch {
    return []
  }
}

/** O jeito mais comum de pagar cada meio, que a folha já deixa escolhido. */
export const FORMA_DE_COSTUME: Record<Meio, Forma> = {
  motoboy: 'pix',
  uber: 'cartao',
  taxi: 'dinheiro',
  transportadora: 'boleto',
}

/** Uber e táxi se pagam na hora. Motoboy e transportadora costumam ficar para acertar. */
export const PAGO_NA_HORA: Record<Meio, boolean> = {
  motoboy: false,
  uber: true,
  taxi: true,
  transportadora: false,
}
