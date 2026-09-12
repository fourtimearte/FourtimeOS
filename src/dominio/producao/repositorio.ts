import { DEPARTAMENTOS, VENDEDORES } from '@dominio/banco'
import type { Pedido } from './tipos'

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

const EXEMPLO: Pedido[] = [
  { id: 'PD004142', cliente: 'Academia Prime Fit', vendedor: V[1], departamento: D[1], etapa: 'cq', emDias: -2, pecas: 120, layouts: 2, tecnicas: ['dtf'], planejadoNoDia: 4, planejamentoManual: true, fechadoEm: '2026-09-06', pecasSubli: 0, pecasPersonalizadas: 120, valorSubli: 0, valorPersonalizado: 2055 },
  { id: 'PD004140', cliente: 'Umbroken Funcional', vendedor: V[1], departamento: D[2], etapa: 'silk', emDias: -1, pecas: 80, layouts: 1, tecnicas: ['silk'], planejadoNoDia: 1, planejamentoManual: false, fechadoEm: '2026-09-01', pecasSubli: 33, pecasPersonalizadas: 47, valorSubli: 1792, valorPersonalizado: 828 },
  { id: 'PD004145', cliente: 'Crossbox Norte', vendedor: V[2], departamento: D[1], etapa: 'despacho', emDias: 1, pecas: 75, layouts: 1, tecnicas: ['dtf'], planejadoNoDia: 4, planejamentoManual: false, fechadoEm: '2026-09-03', pecasSubli: 0, pecasPersonalizadas: 75, valorSubli: 0, valorPersonalizado: 4344 },
  { id: 'PD004149', cliente: 'EC Juventude Sul', vendedor: V[2], departamento: D[0], etapa: 'subli', emDias: 4, pecas: 46, layouts: 1, tecnicas: ['subli'], planejadoNoDia: 5, planejamentoManual: false, fechadoEm: '2026-09-08', pecasSubli: 46, pecasPersonalizadas: 0, valorSubli: 2055, valorPersonalizado: 0 },
  { id: 'PD004146', cliente: 'Logística Ramos Ltda', vendedor: V[1], departamento: D[2], etapa: 'bordado', emDias: 5, pecas: 60, layouts: 1, tecnicas: ['bordado'], planejadoNoDia: 5, planejamentoManual: false, fechadoEm: '2026-09-09', pecasSubli: 0, pecasPersonalizadas: 60, valorSubli: 0, valorPersonalizado: 2637 },
  { id: 'PD004148', cliente: 'Colégio Santa Clara', vendedor: V[1], departamento: D[3], etapa: 'costura', emDias: 7, pecas: 180, layouts: 2, tecnicas: ['subli', 'silk'], planejadoNoDia: 2, planejamentoManual: true, fechadoEm: '2026-09-10', pecasSubli: 130, pecasPersonalizadas: 50, valorSubli: 7020, valorPersonalizado: 1900 },
  { id: 'PD004153', cliente: 'Vôlei Clube Araras', vendedor: V[1], departamento: D[0], etapa: 'arte', emDias: 11, pecas: 28, layouts: 2, tecnicas: ['subli'], planejadoNoDia: 4, planejamentoManual: false, fechadoEm: '2026-09-09', pecasSubli: 28, pecasPersonalizadas: 0, valorSubli: 1820, valorPersonalizado: 0 },
  { id: 'PD004150', cliente: 'Viapol Engenharia', vendedor: V[2], departamento: D[4], etapa: 'corte', emDias: 14, pecas: 170, layouts: 1, tecnicas: ['dtf', 'silk'], planejadoNoDia: 3, planejamentoManual: false, fechadoEm: '2026-09-01', pecasSubli: 0, pecasPersonalizadas: 170, valorSubli: 0, valorPersonalizado: 8330 },
  { id: 'PD004151', cliente: 'Escola Municipal Ipê', vendedor: V[2], departamento: D[1], etapa: 'corte', emDias: 19, pecas: 320, layouts: 2, tecnicas: ['dtf'], planejadoNoDia: 3, planejamentoManual: true, fechadoEm: '2026-09-02', pecasSubli: 0, pecasPersonalizadas: 320, valorSubli: 0, valorPersonalizado: 13300 },
  { id: 'PD004138', cliente: 'Colégio Horizonte', vendedor: V[2], departamento: D[0], etapa: 'fim', emDias: -6, pecas: 240, layouts: 1, tecnicas: ['subli'], planejadoNoDia: 0, planejamentoManual: false, fechadoEm: '2026-08-27', pecasSubli: 240, pecasPersonalizadas: 0, valorSubli: 9860, valorPersonalizado: 0 },
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
        etapa: 'fim',
        emDias: -60,
        pecas: Math.round(sub / 54) + Math.round(per / 45),
        layouts: 1,
        tecnicas: sub ? ['subli'] : ['dtf'],
        planejadoNoDia: 0,
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

/** Os que estao na fabrica agora. E o que o inicio e o painel usam. */
export function listarPedidos(): Pedido[] {
  return EXEMPLO
}

/** Tudo, inclusive o historico fechado. E o que o relatorio soma. */
export function listarTodosOsPedidos(): Pedido[] {
  return TODOS
}
