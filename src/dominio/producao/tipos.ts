import type { Tecnica } from '@ds'

/* ==========================================================================
   O pedido na fabrica.

   Ele so existe de verdade quando o kanban MARK42 entrar, na fase 3. O que
   mora aqui e o minimo que o inicio precisa saber para responder a pergunta
   da manha: o que esta atrasado e o que sai esta semana.

   Quando o kanban nascer, este arquivo vira a consulta de verdade e a tela do
   inicio nao muda, porque ela ja le por estas funcoes.
   ========================================================================== */

export type Etapa =
  | 'arte'
  | 'corte'
  | 'dtf'
  | 'prensa'
  | 'silk'
  | 'subli'
  | 'calandra'
  | 'bordado'
  | 'costura'
  | 'cq'
  | 'despacho'
  | 'fim'

/** nome e cor de cada posto, na ordem do roteador do V7 */
export const POSTO: Record<Etapa, { nome: string; cor: string }> = {
  arte: { nome: 'Arte', cor: 'var(--info)' },
  corte: { nome: 'Corte', cor: 'var(--text-2)' },
  dtf: { nome: 'Impressão DTF', cor: 'var(--tec-dtf-vivo)' },
  prensa: { nome: 'Prensa DTF', cor: 'var(--tec-dtf-vivo)' },
  silk: { nome: 'Silk', cor: 'var(--tec-silk-vivo)' },
  subli: { nome: 'Impressão Subli', cor: 'var(--tec-subli-vivo)' },
  calandra: { nome: 'Calandra', cor: 'var(--tec-subli-vivo)' },
  bordado: { nome: 'Bordado externo', cor: 'var(--tec-bordado-vivo)' },
  costura: { nome: 'Costura', cor: 'var(--text-2)' },
  cq: { nome: 'CQ e Embalagem', cor: 'var(--ok)' },
  despacho: { nome: 'Despacho', cor: 'var(--info)' },
  fim: { nome: 'Finalizado', cor: 'var(--text-3)' },
}

/** quanto a fabrica da conta por semana, e o que o KPI da fila compara */
export const CAPACIDADE_DA_SEMANA = 1500

export type Pedido = {
  id: string
  cliente: string
  vendedor: string
  departamento: string
  etapa: Etapa
  /** quantos dias daqui ate a entrega. Negativo e atraso. */
  emDias: number
  pecas: number
  layouts: number
  tecnicas: Tecnica[]
  /** em que dia da semana ele esta planejado: 0 e segunda, 5 e sabado */
  planejadoNoDia: number
  /** true quando alguem escolheu a data na mao, e nao o sistema */
  planejamentoManual: boolean
  /** quando o pedido foi fechado, que e o que o relatorio mensal soma */
  fechadoEm: string
  /** a divisao que o relatorio precisa: sublimacao de um lado, o resto do outro */
  pecasSubli: number
  pecasPersonalizadas: number
  valorSubli: number
  valorPersonalizado: number
}

/** Pedido misto: tem sublimacao E outra tecnica junto. O relatorio marca. */
export function misto(p: Pedido): boolean {
  return p.valorSubli > 0 && p.valorPersonalizado > 0
}

export function valorDoPedido(p: Pedido): number {
  return p.valorSubli + p.valorPersonalizado
}

/* ==========================================================================
   A semana do painel de atividades.

   Segunda a sabado, seis dias, porque e o que a fabrica trabalha. O domingo
   nao existe no painel de proposito: dia que nao produz nao ocupa coluna.
   ========================================================================== */

export const DIAS_DA_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const CAPACIDADE_DO_DIA = 325
export const DIAS_UTEIS = 6

/** A segunda-feira da semana de uma data. */
export function inicioDaSemana(d = new Date()): Date {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dia = base.getDay()
  /* domingo (0) conta como fim da semana anterior, e nao comeco da proxima */
  const recuo = dia === 0 ? 6 : dia - 1
  base.setDate(base.getDate() - recuo)
  return base
}

export function diaDaSemana(i: number, de = new Date()): Date {
  const d = inicioDaSemana(de)
  d.setDate(d.getDate() + i)
  return d
}

/** A semana do ano, que e como a fabrica fala de prazo. */
export function semanaDoAno(d = new Date()): number {
  const inicio = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + inicio.getDay() + 1) / 7)
}

export function ehHoje(d: Date): boolean {
  const hoje = new Date()
  return (
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  )
}

export const diaEMes = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const DIA = 24 * 60 * 60 * 1000

export function dataDaEntrega(p: Pedido): Date {
  return new Date(Date.now() + p.emDias * DIA)
}

export function naFabrica(p: Pedido): boolean {
  return p.etapa !== 'fim'
}

export function atrasado(p: Pedido): boolean {
  return naFabrica(p) && p.emDias < 0
}

/** No preparo: ainda nao encostou em maquina de estampa. */
export function noPreparo(p: Pedido): boolean {
  return p.etapa === 'arte' || p.etapa === 'corte'
}

export function saiEm7Dias(p: Pedido): boolean {
  return naFabrica(p) && p.emDias >= 0 && p.emDias <= 7
}

/** O texto da direita na lista: o atraso grita, o resto so informa. */
export function prazoEmTexto(p: Pedido): { texto: string; atrasado: boolean } {
  if (!naFabrica(p)) return { texto: 'Entregue', atrasado: false }
  if (p.emDias < 0) return { texto: 'Atrasado ' + -p.emDias + ' d', atrasado: true }
  if (p.emDias === 0) return { texto: 'Entrega hoje', atrasado: false }
  if (p.emDias <= 2) return { texto: 'Entrega em ' + p.emDias + ' d', atrasado: false }
  return {
    texto:
      'Entrega ' +
      dataDaEntrega(p).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    atrasado: false,
  }
}
