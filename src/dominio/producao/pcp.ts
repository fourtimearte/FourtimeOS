import type { Tecnica } from '@ds'
import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   O PCP: as duas aprovações.

   O PCP confere o pedido e MARCA. Quem APROVA é o diretor de produção, que
   hoje é o gerente. Só a aprovação dele cria as fatias no kanban.

   QUEM CONFERE NÃO É QUEM LIBERA. Antes da migração 032 existia uma porta só,
   e o mesmo papel fazia as duas coisas: o desenho das duas aprovações era um
   combinado entre pessoas, e não uma regra do sistema.

   DEVOLVER NÃO VOLTA DE ESTADO. O pedido devolvido continua no PCP, porque
   ele nunca saiu de lá. O que cai é a marca, e o motivo fica escrito para
   quem for arrumar.
   ========================================================================== */

export type PedidoNoPcp = {
  id: string
  numero: string
  cotacaoId: string
  cliente: string
  aviso: string
  pecas: number
  total: number
  entregaEm: string
  departamento: string
  layouts: number
  tecnicas: Tecnica[]
  teste: boolean
  /** marcado pelo PCP, esperando o diretor */
  marcado: boolean
  marcadoEm: string
  marcadoPor: string
  devolvidoMotivo: string
  devolvidoEm: string
  devolvidoPor: string
  /** linhas de material do pedido, e quantas não foram cobertas */
  materiais: number
  faltando: number
  /* da 063: quem confere, a devolução ao vendedor e a cotação */
  cotacaoNumero: string
  vendedor: string
  /** quem abriu primeiro para conferir; vazio: ainda não aberto */
  conferindoPor: string
  conferindoEm: string
  /** devolvido ao vendedor: fica na aba Devolvidos */
  comOVendedor: boolean
  vendedorMotivo: string
  vendedorEm: string
  vendedorPor: string
  /** o vendedor como pessoa (064): a conversa do pedido abre nele */
  vendedorId: string
}

/** um pedido que já passou pelo portão (063) */
export type PedidoLiberado = {
  id: string
  numero: string
  cotacaoId: string
  cliente: string
  estado: string
  etapa: string
  pecas: number
  total: number
  entregaEm: string
  layouts: number
  tecnicas: Tecnica[]
  teste: boolean
  aviso: string
  liberadoEm: string
  liberadoPor: string
  marcadoPor: string
}

type LinhaDoPcp = {
  id: string
  numero: string
  cotacao_id: string
  cliente: string
  aviso: string
  pecas: number
  total: string | number
  entrega_em: string | null
  departamento: string
  layouts: number
  tecnicas: Tecnica[] | null
  teste: boolean
  marcado: boolean
  marcado_em: string | null
  marcado_por_nome: string
  devolvido_motivo: string
  devolvido_em: string | null
  devolvido_por_nome: string
  materiais: number
  faltando: number
  cotacao_numero?: string
  vendedor_nome?: string
  conferindo_em?: string | null
  conferindo_por_nome?: string
  com_o_vendedor?: boolean
  vendedor_motivo?: string
  vendedor_em?: string | null
  vendedor_por_nome?: string
  vendedor_id?: string | null
}

function daLinha(l: LinhaDoPcp): PedidoNoPcp {
  return {
    id: l.id,
    numero: l.numero,
    cotacaoId: l.cotacao_id,
    cliente: l.cliente || '',
    aviso: l.aviso || '',
    pecas: Number(l.pecas) || 0,
    /* o PostgREST devolve numeric como texto, e sem o Number a soma vira
       concatenação de string */
    total: Number(l.total) || 0,
    entregaEm: l.entrega_em ?? '',
    departamento: l.departamento || '',
    layouts: Number(l.layouts) || 0,
    tecnicas: l.tecnicas ?? [],
    teste: !!l.teste,
    marcado: !!l.marcado,
    marcadoEm: l.marcado_em ?? '',
    marcadoPor: l.marcado_por_nome || '',
    devolvidoMotivo: l.devolvido_motivo || '',
    devolvidoEm: l.devolvido_em ?? '',
    devolvidoPor: l.devolvido_por_nome || '',
    materiais: Number(l.materiais) || 0,
    faltando: Number(l.faltando) || 0,
    /* antes da 063 estas colunas não vêm, e a fila funciona igual */
    cotacaoNumero: l.cotacao_numero || '',
    vendedor: l.vendedor_nome || '',
    conferindoPor: l.conferindo_por_nome || '',
    conferindoEm: l.conferindo_em ?? '',
    comOVendedor: !!l.com_o_vendedor,
    vendedorMotivo: l.vendedor_motivo || '',
    vendedorEm: l.vendedor_em ?? '',
    vendedorPor: l.vendedor_por_nome || '',
    vendedorId: l.vendedor_id ?? '',
  }
}

/* A fila vem pela data de entrega, e o sem data vai para o fim: quem olha o
   PCP está perguntando o que aperta primeiro. */
export async function carregarOPcp(): Promise<PedidoNoPcp[]> {
  const linhas = await tabela<LinhaDoPcp[]>(
    'pedido_no_pcp?select=*&order=entrega_em.asc.nullslast,numero.asc',
  )
  return linhas.map(daLinha)
}

type LinhaLiberada = {
  id: string
  numero: string
  cotacao_id: string
  cliente: string
  estado: string
  etapa: string | null
  pecas: number
  total: string | number
  entrega_em: string | null
  layouts: number
  tecnicas: Tecnica[] | null
  teste: boolean
  aviso: string
  liberado_em: string
  liberado_por_nome: string
  marcado_por_nome: string
}

/** O tamanho da aba Liberados: os mais recentes. */
export const LIBERADOS_A_VISTA = 60

/* Os que passaram pelo portão, o mais recente primeiro. Antes da 063 a view
   não existe: volta null, e a aba diz o que falta. */
export async function carregarLiberados(): Promise<PedidoLiberado[] | null> {
  try {
    const linhas = await tabela<LinhaLiberada[]>(
      `pedido_liberado?select=*&order=liberado_em.desc&limit=${LIBERADOS_A_VISTA}`,
    )
    return linhas.map((l) => ({
      id: l.id,
      numero: l.numero,
      cotacaoId: l.cotacao_id,
      cliente: l.cliente || '',
      estado: l.estado,
      etapa: l.etapa ?? '',
      pecas: Number(l.pecas) || 0,
      total: Number(l.total) || 0,
      entregaEm: l.entrega_em ?? '',
      layouts: Number(l.layouts) || 0,
      tecnicas: l.tecnicas ?? [],
      teste: !!l.teste,
      aviso: l.aviso || '',
      liberadoEm: l.liberado_em,
      liberadoPor: l.liberado_por_nome || '',
      marcadoPor: l.marcado_por_nome || '',
    }))
  } catch (e) {
    if (e instanceof Error && /Não encontrei|pedido_liberado|PGRST205|schema cache/i.test(e.message)) return null
    throw e
  }
}

/* QUEM ABRE PARA CONFERIR fica sendo quem confere (063). Abrir de novo, ou
   outra pessoa abrir, não muda nada; antes da 063 a função não existe e a
   tela segue sem anotar. */
export async function abrirNoPcp(id: string): Promise<boolean> {
  try {
    await chamar('abrir_no_pcp', { p_pedido: id })
    return true
  } catch {
    return false
  }
}

export async function devolverAoVendedor(id: string, motivo: string): Promise<void> {
  await chamar('devolver_ao_vendedor', { p_pedido: id, p_motivo: motivo })
}

export async function voltarAConferir(id: string): Promise<void> {
  await chamar('voltar_a_conferir', { p_pedido: id })
}

export async function marcarParaAprovacao(id: string): Promise<void> {
  await chamar('marcar_para_aprovacao', { p_pedido: id })
}

export async function desmarcarDoPcp(id: string): Promise<void> {
  await chamar('desmarcar_do_pcp', { p_pedido: id })
}

export async function devolverDoPcp(id: string, motivo: string): Promise<void> {
  await chamar('devolver_do_pcp', { p_pedido: id, p_motivo: motivo })
}

/** Quantos dias faltam para a entrega. Negativo quer dizer atrasado. */
export function diasAte(iso: string): number | null {
  if (!iso) return null
  const alvo = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}
