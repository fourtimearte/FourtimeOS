import { DEPARTAMENTOS, VENDEDORES } from '@dominio/banco'
import { diaDaSemanaDe, iso, semanaDeslocada, type Pedido } from './tipos'

/* ==========================================================================
   Os pedidos de exemplo.

   Sao os mesmos dez do mockup v5, com os mesmos clientes, pecas, etapas e
   prazos, para o inicio e o painel baterem numero a numero com o desenho. O
   prazo esta guardado em DIAS a partir de hoje, e o planejamento em DIA DA
   SEMANA, e nao em data fixa, para a tela contar a mesma historia amanha.

   Vendedor e departamento vem das listas do EDITOR, e nao das inventadas no
   mockup: quem vende na Fourtime e Lucas, Dani, Kev, Alam e Fabricio, e
   departamento la quer dizer a tecnica (Sublimacao, DTF, Silk).

   ATENCAO: os pedidos sao inventados. Quando o kanban entrar, SO ESTE ARQUIVO
   muda.
   ========================================================================== */

export const DADO_DE_EXEMPLO = true

const V = VENDEDORES
const D = DEPARTAMENTOS

/* A data de um apontamento feito ha N dias, em ISO. Os exemplos usam isto em
   vez de data escrita a mao para a coluna Atualizacao nao envelhecer sozinha
   toda vez que alguem abre o sistema numa segunda-feira. */
function diasAtras(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString()
}

/* O dia i (0 segunda, 5 sabado) da semana que esta a `semana` semanas daqui.
   Os exemplos usam isto, e nao data escrita a mao, para o painel abrir sempre
   com a semana corrente cheia, seja qual for o dia em que alguem abrir. */
/** A data que esta a N dias de hoje, em ISO. Negativo e passado. */
function daquiA(n: number): string {
  return iso(new Date(Date.now() + n * 86400000))
}

function noDia(semana: number, i: number): string {
  return iso(diaDaSemanaDe(semanaDeslocada(semana), i))
}

const EXEMPLO: Pedido[] = [
  { id: 'PD004139', cliente: 'Atlética Medicina UFX', vendedor: V[0], departamento: D[0], etapa: 'finalizado', entregaEm: daquiA(2), pecas: 52, layouts: 1, tecnicas: ['subli'], planejadoEm: noDia(0, 1), planejamentoManual: false, fechadoEm: '2026-09-08', aviso: '', atualizadoEm: diasAtras(0), pecasSubli: 32, pecasPersonalizadas: 20, valorSubli: 1724, valorPersonalizado: 891 },
  { id: 'PD004137', cliente: 'Academia Prime Fit', vendedor: V[2], departamento: D[1], etapa: 'finalizado', entregaEm: daquiA(3), pecas: 46, layouts: 1, tecnicas: ['dtf'], planejadoEm: noDia(0, 2), planejamentoManual: false, fechadoEm: '2026-09-09', aviso: '', atualizadoEm: diasAtras(1), pecasSubli: 0, pecasPersonalizadas: 46, valorSubli: 0, valorPersonalizado: 2055 },
  { id: 'PD004142', cliente: 'Academia Prime Fit', vendedor: V[1], departamento: D[1], etapa: 'conferencia', entregaEm: daquiA(-2), pecas: 120, layouts: 2, tecnicas: ['dtf'], planejadoEm: noDia(0, 4), planejamentoManual: true, fechadoEm: '2026-09-06', aviso: 'falta-tecido', atualizadoEm: diasAtras(0), pecasSubli: 0, pecasPersonalizadas: 120, valorSubli: 0, valorPersonalizado: 2055 },
  { id: 'PD004140', cliente: 'Umbroken Funcional', vendedor: V[1], departamento: D[2], etapa: 'silk', entregaEm: daquiA(-1), pecas: 80, layouts: 1, tecnicas: ['silk'], planejadoEm: noDia(0, 1), planejamentoManual: false, fechadoEm: '2026-09-01', aviso: 'falta-tecido', atualizadoEm: diasAtras(1), pecasSubli: 33, pecasPersonalizadas: 47, valorSubli: 1792, valorPersonalizado: 828 },
  { id: 'PD004145', cliente: 'Crossbox Norte', vendedor: V[2], departamento: D[1], etapa: 'embalagem', entregaEm: daquiA(1), pecas: 75, layouts: 1, tecnicas: ['dtf'], planejadoEm: noDia(0, 4), planejamentoManual: false, fechadoEm: '2026-09-03', aviso: '', atualizadoEm: diasAtras(0), pecasSubli: 0, pecasPersonalizadas: 75, valorSubli: 0, valorPersonalizado: 4344 },
  { id: 'PD004149', cliente: 'EC Juventude Sul', vendedor: V[2], departamento: D[0], etapa: 'subli', entregaEm: daquiA(4), pecas: 46, layouts: 1, tecnicas: ['subli'], planejadoEm: noDia(0, 5), planejamentoManual: false, fechadoEm: '2026-09-08', aviso: '', atualizadoEm: diasAtras(2), pecasSubli: 46, pecasPersonalizadas: 0, valorSubli: 2055, valorPersonalizado: 0 },
  { id: 'PD004146', cliente: 'Logística Ramos Ltda', vendedor: V[1], departamento: D[2], etapa: 'bordado', entregaEm: daquiA(5), pecas: 60, layouts: 1, tecnicas: ['bordado'], planejadoEm: noDia(0, 5), planejamentoManual: false, fechadoEm: '2026-09-09', aviso: '', atualizadoEm: diasAtras(5), pecasSubli: 0, pecasPersonalizadas: 60, valorSubli: 0, valorPersonalizado: 2637 },
  { id: 'PD004148', cliente: 'Colégio Santa Clara', vendedor: V[1], departamento: D[3], etapa: 'costura', entregaEm: daquiA(7), pecas: 180, layouts: 2, tecnicas: ['subli', 'silk'], planejadoEm: noDia(0, 2), planejamentoManual: true, fechadoEm: '2026-09-10', aviso: '', atualizadoEm: diasAtras(1), pecasSubli: 130, pecasPersonalizadas: 50, valorSubli: 7020, valorPersonalizado: 1900 },
  { id: 'PD004153', cliente: 'Vôlei Clube Araras', vendedor: V[1], departamento: D[0], etapa: 'corte', entregaEm: daquiA(11), pecas: 28, layouts: 2, tecnicas: ['subli'], planejadoEm: noDia(0, 4), planejamentoManual: false, fechadoEm: '2026-09-09', aviso: '', atualizadoEm: diasAtras(0), pecasSubli: 28, pecasPersonalizadas: 0, valorSubli: 1820, valorPersonalizado: 0 },
  { id: 'PD004150', cliente: 'Viapol Engenharia', vendedor: V[2], departamento: D[4], etapa: 'corte', entregaEm: daquiA(14), pecas: 170, layouts: 1, tecnicas: ['dtf', 'silk'], planejadoEm: noDia(1, 3), planejamentoManual: false, fechadoEm: '2026-09-01', aviso: '', atualizadoEm: diasAtras(4), pecasSubli: 0, pecasPersonalizadas: 170, valorSubli: 0, valorPersonalizado: 8330 },
  { id: 'PD004151', cliente: 'Escola Municipal Ipê', vendedor: V[2], departamento: D[1], etapa: 'corte', entregaEm: daquiA(19), pecas: 320, layouts: 2, tecnicas: ['dtf'], planejadoEm: noDia(1, 3), planejamentoManual: true, fechadoEm: '2026-09-02', aviso: '', atualizadoEm: diasAtras(6), pecasSubli: 0, pecasPersonalizadas: 320, valorSubli: 0, valorPersonalizado: 13300 },
  { id: 'PD004138', cliente: 'Colégio Horizonte', vendedor: V[2], departamento: D[0], etapa: 'finalizado', entregaEm: daquiA(-6), pecas: 240, layouts: 1, tecnicas: ['subli'], planejadoEm: noDia(-1, 0), planejamentoManual: false, fechadoEm: '2026-08-27', aviso: '', atualizadoEm: diasAtras(0), pecasSubli: 240, pecasPersonalizadas: 0, valorSubli: 9860, valorPersonalizado: 0 },
]

/* ==========================================================================
   O historico do relatorio mensal.

   Julho e agosto nascem de uma conta, e nao de uma lista escrita a mao: a
   mesma semente sempre da os mesmos pedidos, entao o relatorio de agosto e o
   mesmo toda vez que abre. Serve para a tela ter o que somar antes de existir
   pedido de verdade.
   ========================================================================== */

const CLIENTES_DO_HISTORICO = [
  'Academia Prime Fit', 'Colégio Santa Clara', 'EC Juventude Sul', 'Crossbox Norte',
  'Logística Ramos Ltda', 'Colégio Horizonte', 'Umbroken Funcional', 'Viapol Engenharia',
  'Escola Municipal Ipê', 'Vôlei Clube Araras',
]

function historico(): Pedido[] {
  const saida: Pedido[] = []
  let n = 4100
  const meses: [number, number][] = [
    [6, 14],
    [7, 22],
  ]
  meses.forEach(([mes, quantos]) => {
    for (let i = 0; i < quantos; i++) {
      const dia = 1 + ((i * 7 + mes * 3) % 27)
      const sub = (i * 37) % 5 === 0 ? 0 : (300 + ((i * 131) % 900)) * 4
      const per = (i * 53) % 3 === 0 ? 0 : (200 + ((i * 97) % 700)) * 3
      if (!sub && !per) continue
      const id = 'PD00' + n++
      saida.push({
        id,
        cliente: CLIENTES_DO_HISTORICO[(i + mes) % CLIENTES_DO_HISTORICO.length],
        vendedor: VENDEDORES[i % VENDEDORES.length],
        departamento: DEPARTAMENTOS[i % DEPARTAMENTOS.length],
        etapa: 'finalizado',
        aviso: '',
        atualizadoEm: diasAtras(0),
        entregaEm: daquiA(-60),
        pecas: Math.round(sub / 54) + Math.round(per / 45),
        layouts: 1,
        tecnicas: sub ? ['subli'] : ['dtf'],
        /* o historico ja fechou: o planejamento dele e o proprio dia em que
           saiu, e nao um dia de uma semana que o painel ainda mostra */
        planejadoEm:
          '2026-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0'),
        planejamentoManual: false,
        fechadoEm: '2026-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0'),
        pecasSubli: sub ? Math.round(sub / 54) : 0,
        pecasPersonalizadas: per ? Math.round(per / 45) : 0,
        valorSubli: sub,
        valorPersonalizado: per,
      })
    }
  })
  return saida
}

const TODOS = [...EXEMPLO, ...historico()]

/* A lista viva. Trocar a etapa mexe aqui, e nao no banco, porque banco ainda
   nao ha: vale enquanto a aba estiver aberta e some ao recarregar. */
let base: Pedido[] = [...EXEMPLO]

/** Os que estao na fabrica agora. E o que o inicio e o painel usam. */
export function listarPedidos(): Pedido[] {
  return base
}

export function acharPedido(id: string): Pedido | undefined {
  return base.find((p) => p.id === id)
}

/* Trocar a etapa carimba a hora junto, sempre. Elas nao podem andar
   separadas: uma etapa nova com a data velha faria a coluna Atualizacao dizer
   que o apontamento de agora mesmo ja esta vencido. */
/* Arrastar o pedido para outro dia marca o planejamento como manual, sempre.
   Quem arrastou decidiu na mao, e o sistema nao pode depois remarcar por cima
   achando que a data era sugestao dele. */
export function planejarPara(id: string, dia: string): Pedido | undefined {
  return mexer(id, (p) => ({ ...p, planejadoEm: dia, planejamentoManual: true }))
}

export function mudarEntrega(id: string, dia: string): Pedido | undefined {
  return mexer(id, (p) => ({ ...p, entregaEm: dia }))
}

export function mudarAviso(id: string, aviso: Pedido['aviso']): Pedido | undefined {
  return mexer(id, (p) => ({ ...p, aviso }))
}

function mexer(id: string, troca: (p: Pedido) => Pedido): Pedido | undefined {
  const achado = base.find((p) => p.id === id)
  if (!achado) return undefined
  const novo = troca(achado)
  base = base.map((p) => (p.id === id ? novo : p))
  return novo
}

export function moverEtapa(id: string, etapa: Pedido['etapa']): Pedido | undefined {
  const achado = base.find((p) => p.id === id)
  if (!achado) return undefined
  const novo = { ...achado, etapa, atualizadoEm: new Date().toISOString() }
  base = base.map((p) => (p.id === id ? novo : p))
  return novo
}

/** Tudo, inclusive o historico fechado. E o que o relatorio soma. */
export function listarTodosOsPedidos(): Pedido[] {
  return TODOS
}
