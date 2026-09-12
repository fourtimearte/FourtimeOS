import type { Pedido } from './tipos'

/* ==========================================================================
   Os pedidos de exemplo.

   Sao os mesmos dez do mockup v5, com os mesmos clientes, pecas, etapas e
   prazos, para o inicio bater numero a numero com o desenho. O prazo esta
   guardado em DIAS a partir de hoje, e nao em data fixa, para a tela contar a
   mesma historia amanha.

   ATENCAO: sao inventados. Quando o kanban entrar, SO ESTE ARQUIVO muda.
   ========================================================================== */

export const DADO_DE_EXEMPLO = true

const EXEMPLO: Pedido[] = [
  { id: 'PD004142', cliente: 'Academia Prime Fit', vendedor: 'Carla', etapa: 'cq', emDias: -2, pecas: 120, layouts: 2, tecnicas: ['dtf'] },
  { id: 'PD004140', cliente: 'Umbroken Funcional', vendedor: 'Carla', etapa: 'silk', emDias: -1, pecas: 80, layouts: 1, tecnicas: ['silk'] },
  { id: 'PD004145', cliente: 'Crossbox Norte', vendedor: 'Tiago', etapa: 'despacho', emDias: 1, pecas: 75, layouts: 1, tecnicas: ['dtf'] },
  { id: 'PD004149', cliente: 'EC Juventude Sul', vendedor: 'Tiago', etapa: 'subli', emDias: 4, pecas: 46, layouts: 1, tecnicas: ['subli'] },
  { id: 'PD004146', cliente: 'Logística Ramos Ltda', vendedor: 'Carla', etapa: 'bordado', emDias: 5, pecas: 60, layouts: 1, tecnicas: ['bordado'] },
  { id: 'PD004148', cliente: 'Colégio Santa Clara', vendedor: 'Carla', etapa: 'costura', emDias: 7, pecas: 180, layouts: 2, tecnicas: ['subli', 'silk'] },
  { id: 'PD004153', cliente: 'Vôlei Clube Araras', vendedor: 'Carla', etapa: 'arte', emDias: 11, pecas: 28, layouts: 2, tecnicas: ['subli'] },
  { id: 'PD004150', cliente: 'Viapol Engenharia', vendedor: 'Tiago', etapa: 'corte', emDias: 14, pecas: 170, layouts: 1, tecnicas: ['dtf', 'silk'] },
  { id: 'PD004151', cliente: 'Escola Municipal Ipê', vendedor: 'Tiago', etapa: 'corte', emDias: 19, pecas: 320, layouts: 2, tecnicas: ['dtf'] },
  { id: 'PD004138', cliente: 'Colégio Horizonte', vendedor: 'Tiago', etapa: 'fim', emDias: -6, pecas: 240, layouts: 1, tecnicas: ['subli'] },
]

export function listarPedidos(): Pedido[] {
  return EXEMPLO
}
