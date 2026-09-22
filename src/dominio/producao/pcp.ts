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
