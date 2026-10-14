import { baixarArquivo, chamar, subirArquivo, tabela } from '@shared/supabase'
import { formatarDinheiroExato, semAcento } from '@shared'

/* ==========================================================================
   A CONFIRMAÇÃO DO FRETE (080), aba de Transporte.

   Cada pedido que ainda vai sair tem o seu frete: quem paga (o cliente antes
   do envio, a Fourtime, ou sem frete quando o cliente retira), como vai, o
   valor combinado e o que o cliente pagou, e o comprovante. A logística anda
   os três passos: pediu ao cliente, recebeu o comprovante, o financeiro
   confirmou.

   A TRAVA mora no banco: frete do cliente registrado e não confirmado não
   deixa o pedido sair de PRONTO para ENVIADO.
   ========================================================================== */

export type QuemPagaOFrete = 'cliente' | 'fourtime' | 'sem_frete'

export const NOME_DE_QUEM_PAGA: Record<QuemPagaOFrete, string> = {
  cliente: 'Cliente paga antes',
  fourtime: 'Fourtime paga',
  sem_frete: 'Sem frete',
}

/** 0 falar com o cliente, 1 pedido ao cliente, 2 comprovante recebido, 3 confirmado. */
export type PassoDoFrete = 0 | 1 | 2 | 3

export const PASSOS_DO_FRETE = ['Pedir ao cliente', 'Comprovante', 'Financeiro'] as const

/** O botão que leva ao próximo passo. */
export const PROXIMO_PASSO: Record<0 | 1 | 2, string> = {
  0: 'Pedi ao cliente',
  1: 'Comprovante recebido',
  2: 'Financeiro confirmou',
}

export type FreteDoPedido = {
  pedidoId: string
  numero: string
  cliente: string
  telefone: string
  /** aprovado, separacao, pcp, producao ou pronto */
  estado: string
  /** a data de entrega combinada, AAAA-MM-DD */
  entregaEm: string | null
  /** quando ficou PRONTO */
  liberadoEm: string | null
  envio: string
  quemPaga: QuemPagaOFrete
  /** a logística já mexeu neste frete */
  registrado: boolean
  valorCombinado: number | null
  valorPago: number | null
  comprovante: string | null
  comprovanteNome: string
  observacao: string
  passo: PassoDoFrete
  pedidoEm: string | null
  pedidoPor: string
  recebidoEm: string | null
  recebidoPor: string
  confirmadoEm: string | null
  confirmadoPor: string
}

type Linha = {
  pedido_id: string
  numero: string
  cliente: string | null
  telefone: string | null
  estado: string
  entrega_em: string | null
  liberado_em: string | null
  envio: string | null
  quem_paga: QuemPagaOFrete
  registrado: boolean
  valor_combinado: number | string | null
  valor_pago: number | string | null
  comprovante: string | null
  comprovante_nome: string | null
  observacao: string | null
  passo: number
  pedido_em: string | null
  pedido_por: string | null
  recebido_em: string | null
  recebido_por: string | null
  confirmado_em: string | null
  confirmado_por: string | null
}

const numeroOuNulo = (v: number | string | null) => (v === null || v === '' ? null : Number(v))

const semAView = (e: unknown) => e instanceof Error && /frete_na_lista|schema cache|PGRST205|42P01|Não encontrei/i.test(e.message)

/** Os fretes dos pedidos que ainda vão sair. `null` antes da 080 rodar. */
export async function carregarFretes(): Promise<FreteDoPedido[] | null> {
  try {
    const linhas = await tabela<Linha[]>('frete_na_lista?select=*&order=entrega_em.asc.nullslast,numero.asc')
    return linhas.map((l) => ({
      pedidoId: l.pedido_id,
      numero: l.numero,
      cliente: l.cliente ?? '',
      telefone: l.telefone ?? '',
      estado: l.estado,
      entregaEm: l.entrega_em,
      liberadoEm: l.liberado_em,
      envio: l.envio ?? '',
      quemPaga: l.quem_paga,
      registrado: !!l.registrado,
      valorCombinado: numeroOuNulo(l.valor_combinado),
      valorPago: numeroOuNulo(l.valor_pago),
      comprovante: l.comprovante,
      comprovanteNome: l.comprovante_nome ?? '',
      observacao: l.observacao ?? '',
      passo: Math.max(0, Math.min(3, l.passo)) as PassoDoFrete,
      pedidoEm: l.pedido_em,
      pedidoPor: l.pedido_por ?? '',
      recebidoEm: l.recebido_em,
      recebidoPor: l.recebido_por ?? '',
      confirmadoEm: l.confirmado_em,
      confirmadoPor: l.confirmado_por ?? '',
    }))
  } catch (e) {
    if (semAView(e)) return null
    throw e
  }
}

export async function salvarFrete(f: {
  pedidoId: string
  quemPaga: QuemPagaOFrete
  envio: string
  valorCombinado: number | null
  valorPago: number | null
  observacao: string
}): Promise<void> {
  await chamar('salvar_frete_do_pedido', {
    p_pedido: f.pedidoId,
    p_quem_paga: f.quemPaga,
    p_envio: f.envio.trim(),
    p_valor_combinado: f.valorCombinado,
    p_valor_pago: f.valorPago,
    p_observacao: f.observacao.trim(),
  })
}

export async function andarOFrete(pedidoId: string, passo: PassoDoFrete): Promise<void> {
  await chamar('passo_do_frete', { p_pedido: pedidoId, p_passo: passo })
}

export const BALDE_DOS_COMPROVANTES = 'comprovantes'

/** Sobe o arquivo na pasta do pedido e anexa. Anexar já conta como recebido. */
export async function anexarComprovante(pedidoId: string, arquivo: File): Promise<void> {
  const limpo = semAcento(arquivo.name).replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(-60) || 'comprovante'
  const caminho = `${pedidoId}/${Date.now()}-${limpo}`
  await subirArquivo(BALDE_DOS_COMPROVANTES, caminho, arquivo)
  await chamar('anexar_comprovante_do_frete', { p_pedido: pedidoId, p_caminho: caminho, p_nome: arquivo.name })
}

/** Abre o comprovante numa aba nova. O balde é privado: o arquivo vem com o crachá. */
export async function abrirComprovante(caminho: string): Promise<void> {
  const conteudo = await baixarArquivo(BALDE_DOS_COMPROVANTES, caminho)
  const endereco = URL.createObjectURL(conteudo)
  window.open(endereco, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(endereco), 60_000)
}

/* ---------- as contas, todas puras ---------------------------------------- */

export type SituacaoDoFrete = { texto: string; tom: 'ok' | 'warn' | 'info' | 'mudo' }

export function situacaoDoFrete(f: FreteDoPedido): SituacaoDoFrete {
  if (f.quemPaga === 'fourtime') return { texto: 'Frete da Fourtime', tom: 'mudo' }
  if (f.quemPaga === 'sem_frete') return { texto: 'Sem frete', tom: 'mudo' }
  if (f.passo === 3) return { texto: 'Confirmado', tom: 'ok' }
  if (f.passo === 2) return { texto: 'Com o financeiro', tom: 'warn' }
  if (f.passo === 1) return { texto: 'Esperando comprovante', tom: 'warn' }
  return { texto: 'Falar com o cliente', tom: 'info' }
}

/** Frete do cliente que ainda não foi confirmado: é o que a aba cobra. */
export const aConfirmar = (f: FreteDoPedido) => f.quemPaga === 'cliente' && f.passo < 3

export type FiltroDoFrete = 'aconfirmar' | 'confirmados' | 'fourtime' | 'todos'

export function passaNoFiltro(f: FreteDoPedido, filtro: FiltroDoFrete): boolean {
  if (filtro === 'aconfirmar') return aConfirmar(f)
  if (filtro === 'confirmados') return f.quemPaga === 'cliente' && f.passo === 3
  if (filtro === 'fourtime') return f.quemPaga !== 'cliente'
  return true
}

export function combinaComFrete(f: FreteDoPedido, busca: string): boolean {
  const b = semAcento(busca)
  if (!b) return true
  return semAcento([f.numero, f.cliente, f.envio].join(' ')).includes(b)
}

/** "CORREIOS" vira "Correios"; o que alguém escreveu fica como está. */
export function nomeDoEnvio(envio: string): string {
  const t = envio.trim()
  if (!t) return ''
  if (t !== t.toUpperCase()) return t
  const fixo: Record<string, string> = { AEREO: 'Aéreo', FABRICA: 'Retirada na fábrica', MOTOBOY: 'Motoboy' }
  return fixo[t] ?? t[0] + t.slice(1).toLowerCase()
}

/** Os prontos, na ordem em que foram liberados para envio. */
export const prontosParaEnvio = (fs: FreteDoPedido[]) =>
  fs
    .filter((f) => f.estado === 'pronto')
    .sort((a, b) => (a.liberadoEm ?? '').localeCompare(b.liberadoEm ?? '') || a.numero.localeCompare(b.numero))

/** O telefone com o 55 na frente, como o WhatsApp quer. */
export function telefoneComPais(t: string): string {
  const d = t.replace(/\D/g, '')
  if (!d) return ''
  return d.length <= 11 ? '55' + d : d
}

/* ---------- as mensagens rápidas da logística ------------------------------ */

export type MensagemDaLogistica = { id: string; titulo: string; texto: string; grupo: string }

/** As da logística (080). Lista vazia antes da 080 rodar. */
export async function carregarMensagensDaLogistica(): Promise<MensagemDaLogistica[]> {
  try {
    return await tabela<MensagemDaLogistica[]>(
      'mensagem_rapida?select=id,titulo,texto,grupo&lugar=eq.logistica&order=grupo.asc,ordem.asc,titulo.asc',
    )
  } catch {
    return []
  }
}

const dataCurta = (iso: string | null) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}` : ''
}

/** O texto pronto: {nome}, {cliente}, {pedido}, {envio}, {frete} e {entrega} trocados pelo pedido escolhido. */
export function preencherDaLogistica(texto: string, f: FreteDoPedido | null): string {
  const v: Record<string, string> = {
    nome: f?.cliente ?? '',
    cliente: f?.cliente ?? '',
    pedido: f?.numero ?? '',
    envio: f ? nomeDoEnvio(f.envio) : '',
    frete: f?.valorCombinado != null ? formatarDinheiroExato(f.valorCombinado) : '',
    entrega: dataCurta(f?.entregaEm ?? null),
  }
  return texto.replace(/\{(nome|cliente|pedido|envio|frete|entrega)\}/g, (_x, c: string) => v[c] ?? '')
}

/** Os campos que o texto usa e que ficaram vazios para este pedido. */
export function camposVaziosDaLogistica(texto: string, f: FreteDoPedido | null): string[] {
  const usados = [...texto.matchAll(/\{(nome|cliente|pedido|envio|frete|entrega)\}/g)].map((m) => m[1])
  return [...new Set(usados)].filter((c) => !preencherDaLogistica('{' + c + '}', f).trim())
}
