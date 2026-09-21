import type { Tecnica } from '@ds'

/* ==========================================================================
   O pedido na fabrica.

   Ele so existe de verdade quando o kanban MARK42 entrar, na fase 3. O que
   mora aqui e o minimo que o inicio precisa saber para responder a pergunta
   da manha: o que esta atrasado e o que sai esta semana.

   Quando o kanban nascer, este arquivo vira a consulta de verdade e a tela do
   inicio nao muda, porque ela ja le por estas funcoes.
   ========================================================================== */

/* As 13 etapas do Relatorio de Atividade do editor v3.375, na ordem dele.

   Elas nao sao as 12 do roteador do kanban, e isso e de proposito: o kanban
   fatia o pedido por tecnica em 21 estacoes, e o painel de atividades olha o
   pedido inteiro num posto so. Sao duas perguntas diferentes.

   Os nomes estao como estao no editor, inclusive "Futurize" e "Cd costura",
   que sao os nomes que a fabrica usa. Mudar o nome aqui seria inventar um
   posto que ninguem conhece. */
export type Etapa =
  | 'corte'
  | 'subli'
  | 'dtf'
  | 'prensa'
  | 'silk'
  | 'bordado'
  | 'calandra'
  | 'futurize'
  | 'conferencia'
  | 'cd-costura'
  | 'costura'
  | 'embalagem'
  | 'finalizado'

/** nome e cor de cada posto, copiados do editor v3.375 */
export const POSTO: Record<Etapa, { nome: string; cor: string }> = {
  corte: { nome: 'Corte', cor: 'var(--posto-corte)' },
  subli: { nome: 'Impressão sublimação', cor: 'var(--posto-subli)' },
  dtf: { nome: 'Impressão DTF', cor: 'var(--posto-dtf)' },
  prensa: { nome: 'Prensa DTF', cor: 'var(--posto-prensa)' },
  silk: { nome: 'Silk', cor: 'var(--posto-silk)' },
  bordado: { nome: 'Bordado', cor: 'var(--posto-bordado)' },
  calandra: { nome: 'Calandra', cor: 'var(--posto-calandra)' },
  futurize: { nome: 'Futurize', cor: 'var(--posto-futurize)' },
  conferencia: { nome: 'Conferência', cor: 'var(--posto-conferencia)' },
  'cd-costura': { nome: 'Cd costura', cor: 'var(--posto-cd-costura)' },
  costura: { nome: 'Costura', cor: 'var(--posto-costura)' },
  embalagem: { nome: 'Embalagem', cor: 'var(--posto-embalagem)' },
  finalizado: { nome: 'Finalizado', cor: 'var(--posto-finalizado)' },
}

/* Os avisos do pedido.

   Hoje ha um so, e isso e de proposito: e o unico que a fabrica usa. A lista
   existe como lista, e nao como texto livre, porque "falta tecido", "sem
   tecido" e "tecido nao chegou" escritos por tres pessoas viram tres avisos
   diferentes no filtro e um so na fabrica. Quando faltar outro, a lista
   cresce aqui. */
export type Aviso = '' | 'falta-tecido'

export const AVISO: Record<Exclude<Aviso, ''>, { nome: string; cor: string }> = {
  'falta-tecido': { nome: 'Falta tecido', cor: 'var(--situacao-vencida)' },
}

export const AVISOS = Object.keys(AVISO) as Exclude<Aviso, ''>[]

/** A ordem em que os postos aparecem no menu e na lateral. */
export const ETAPAS = Object.keys(POSTO) as Etapa[]

/* As tres situacoes da lateral do editor. Elas nao sao etapa: um pedido em
   Costura pode estar com a entrega vencida ao mesmo tempo. */
export type Situacao = 'vencida' | 'finalizado' | 'andamento'

export const SITUACAO: Record<Situacao, { nome: string; cor: string }> = {
  vencida: { nome: 'Entrega vencida', cor: 'var(--situacao-vencida)' },
  finalizado: { nome: 'Finalizados', cor: 'var(--situacao-finalizado)' },
  andamento: { nome: 'Em andamento', cor: 'var(--situacao-andamento)' },
}

/** quanto a fabrica da conta por semana, e o que o KPI da fila compara */
export const CAPACIDADE_DA_SEMANA = 1500

export type Pedido = {
  /* O id do banco, que e um uuid. Ele NAO e o numero do pedido.

     Ate a virada para o Supabase os dois eram a mesma coisa: o pedido se
     chamava PD004139 e era isso que ia no endereco e no cartao. Com o banco
     real eles se separam, e e bom que se separem: o numero e o nome que a
     fabrica usa e que pode um dia ser corrigido, e o id e a identidade, que
     nunca muda. Quem grava usa o id; quem le na tela ve o numero. */
  id: string
  /** PD004139, ou PD-TESTE-0001 enquanto o sistema esta em ensaio */
  numero: string
  /** a cotacao de onde ele veio, para a ficha poder abrir o documento */
  cotacaoId: string
  cliente: string
  vendedor: string
  departamento: string
  etapa: Etapa
  /* A data de entrega, em ISO.
     Era "quantos dias daqui ate a entrega", e isso nao da para editar num
     calendario: numero de dias nao e data, e muda de significado a cada dia
     que passa. */
  entregaEm: string
  pecas: number
  layouts: number
  tecnicas: Tecnica[]
  /* A TAG: em que parte da fabrica o pedido esta, na lingua do painel e nao na
     dos 13 postos. Ela e o trabalho MAIS ATRASADO, agrupado em familia quando
     ha mais de um correndo. Vem derivada do banco, e e vazia enquanto o PCP
     nao liberou: sem fatia nao ha o que dizer. */
  tag: string
  /** o que a tag esconde: "subli:costura, dtf:dtf" */
  fatiasAbertas: string
  /* Em que DIA ele esta planejado, em ISO.
     Era so o indice do dia da semana, 0 a 5, e isso amarrava o painel a uma
     semana so: navegar para a semana que vem mostraria os mesmos pedidos de
     novo, o que e uma tela que mente. Com data de verdade a semana anterior
     mostra o que foi, e a seguinte mostra o que ja esta marcado. */
  planejadoEm: string
  /** true quando alguem escolheu a data na mao, e nao o sistema */
  planejamentoManual: boolean
  /** quando o pedido foi fechado, que e o que o relatorio mensal soma */
  fechadoEm: string
  /* O aviso do pedido. Vazio quer dizer "sem aviso", e a tela desenha isso
     com borda tracejada apagada, em vez de deixar a celula em branco: celula
     em branco parece dado que nao carregou. */
  aviso: Aviso
  /* Quando a etapa foi atualizada pela ultima vez, em ISO. A coluna se chama
     Atualizacao no editor por causa disto: ela nao diz so em que posto o
     pedido esta, diz tambem se isso ainda vale. Etapa antiga sai com a borda
     tracejada. */
  atualizadoEm: string
  /** a divisao que o relatorio precisa: sublimacao de um lado, o resto do outro */
  pecasSubli: number
  pecasPersonalizadas: number
  valorSubli: number
  valorPersonalizado: number
  /** o valor total do pedido, como foi aprovado */
  total: number
  teste: boolean
}

/* A etapa fica velha depois de tres dias sem ninguem mexer nela. Nao e
   palpite: o pedido medio atravessa a fabrica em menos de duas semanas, entao
   tres dias parado no mesmo posto e ou um pedido travado ou um apontamento que
   ninguem fez. Nos dois casos quem planeja a semana precisa saber. */
const DIAS_ATE_ENVELHECER = 3

export function etapaVelha(p: Pedido, hoje = Date.now()): boolean {
  if (!p.atualizadoEm) return true
  return (hoje - new Date(p.atualizadoEm).getTime()) / 86400000 > DIAS_ATE_ENVELHECER
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
/** A segunda-feira da semana que esta a N semanas daqui. 0 e esta semana. */
export function semanaDeslocada(semanas: number, de = new Date()): Date {
  const d = inicioDaSemana(de)
  d.setDate(d.getDate() + semanas * 7)
  return d
}

/** O dia i (0 a 5) da semana que comeca nesta segunda. */
export function diaDaSemanaDe(inicio: Date, i: number): Date {
  const d = new Date(inicio)
  d.setDate(d.getDate() + i)
  return d
}

/** A data em ISO curto, que e como o pedido guarda o planejamento. */
export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + m + '-' + dia
}

/* O titulo que o editor escreve: "7 a 12 de setembro de 2026", e "7 de
   setembro a 3 de outubro" quando a semana atravessa o mes. */
const MESES_POR_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function tituloDaSemana(inicio: Date): string {
  const fim = diaDaSemanaDe(inicio, DIAS_UTEIS - 1)
  const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear()
  const mesDe = MESES_POR_EXTENSO[inicio.getMonth()]
  const mesAte = MESES_POR_EXTENSO[fim.getMonth()]
  if (mesmoMes) return inicio.getDate() + ' a ' + fim.getDate() + ' de ' + mesAte + ' de ' + fim.getFullYear()
  return (
    inicio.getDate() + ' de ' + mesDe + ' a ' + fim.getDate() + ' de ' + mesAte + ' de ' + fim.getFullYear()
  )
}

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
  return new Date(p.entregaEm + 'T00:00:00')
}

/** Quantos dias faltam para a entrega. Negativo e atraso. */
export function diasAteAEntrega(p: Pedido, hoje = new Date()): number {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((dataDaEntrega(p).getTime() - base.getTime()) / DIA)
}

export function naFabrica(p: Pedido): boolean {
  return p.etapa !== 'finalizado'
}

export function atrasado(p: Pedido): boolean {
  return naFabrica(p) && diasAteAEntrega(p) < 0
}

/* No preparo: ainda nao encostou em maquina de estampa. No editor v3.375 a
   etapa de entrada e Corte; nao existe mais uma etapa "Arte" no painel, porque
   arte e trabalho de antes do pedido virar producao. */
export function noPreparo(p: Pedido): boolean {
  return p.etapa === 'corte'
}

export function saiEm7Dias(p: Pedido): boolean {
  const dias = diasAteAEntrega(p)
  return naFabrica(p) && dias >= 0 && dias <= 7
}

/** O texto da direita na lista: o atraso grita, o resto so informa. */
export function prazoEmTexto(p: Pedido): { texto: string; atrasado: boolean } {
  if (!naFabrica(p)) return { texto: 'Entregue', atrasado: false }
  const dias = diasAteAEntrega(p)
  if (dias < 0) return { texto: 'Atrasado ' + -dias + ' d', atrasado: true }
  if (dias === 0) return { texto: 'Entrega hoje', atrasado: false }
  if (dias <= 2) return { texto: 'Entrega em ' + dias + ' d', atrasado: false }
  return {
    texto:
      'Entrega ' +
      dataDaEntrega(p).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    atrasado: false,
  }
}
