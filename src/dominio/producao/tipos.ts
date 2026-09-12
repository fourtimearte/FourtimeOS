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
  etapa: Etapa
  /** quantos dias daqui ate a entrega. Negativo e atraso. */
  emDias: number
  pecas: number
  layouts: number
  tecnicas: Tecnica[]
}

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
