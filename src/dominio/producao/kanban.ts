import type { Tecnica } from '@ds'
import { tabela } from '@shared/supabase'
import { POSTO } from './tipos'
import type { Etapa } from './tipos'

/* ==========================================================================
   O quadro MARK45.

   O CARTÃO NÃO É O PEDIDO, É UMA FATIA: pedido mais técnica. Um pedido com
   layouts em sublimação e DTF vira dois cartões, cada um com o seu ritmo,
   porque eles não andam juntos: a sublimação imprime antes de cortar e o DTF
   corta antes de imprimir.

   CADA TÉCNICA TEM A SUA ROTA, e ela não é um caminho só. A fatia de
   sublimação passa por impressão, calandra e corte, nessa ordem; a de DTF
   passa por corte, DTF e prensa. Por isso um cartão não pode cair em qualquer
   coluna: ele só anda pelos postos que a rota dele conhece, e é o banco que
   recusa o resto.
   ========================================================================== */

export type FatiaNoQuadro = {
  id: string
  pedidoId: string
  numero: string
  cliente: string
  vendedor: string
  tecnica: Tecnica
  etapa: Etapa
  etapaEm: string
  fechadoEm: string
  layouts: number[]
  pecas: number
  entregaEm: string
  aviso: string
  estado: string
  teste: boolean
}

type LinhaDaFatia = {
  id: string
  pedido_id: string
  numero: string
  cliente: string
  vendedor: string
  tecnica: Tecnica
  etapa: Etapa
  etapa_em: string
  fechado_em: string | null
  layouts: number[] | null
  pecas: number
  entrega_em: string | null
  aviso: string
  estado: string
  teste: boolean
}

export async function carregarOQuadro(): Promise<FatiaNoQuadro[]> {
  const linhas = await tabela<LinhaDaFatia[]>(
    'fatia_na_fabrica?select=*&estado=in.(producao,pronto)&order=entrega_em.asc.nullslast,numero.asc',
  )
  return linhas.map((l) => ({
    id: l.id,
    pedidoId: l.pedido_id,
    numero: l.numero,
    cliente: l.cliente || '',
    vendedor: l.vendedor || '',
    tecnica: l.tecnica,
    etapa: l.etapa,
    etapaEm: l.etapa_em,
    fechadoEm: l.fechado_em ?? '',
    layouts: l.layouts ?? [],
    pecas: Number(l.pecas) || 0,
    entregaEm: l.entrega_em ?? '',
    aviso: l.aviso || '',
    estado: l.estado,
    teste: !!l.teste,
  }))
}

export type Rota = { tecnica: string; ordem: number; posto: Etapa }

export async function carregarAsRotas(): Promise<Rota[]> {
  return tabela<Rota[]>('rota_da_tecnica?select=tecnica,ordem,posto&order=tecnica.asc,ordem.asc')
}

/** Os postos por onde esta técnica passa, na ordem. */
export function rotaDe(rotas: Rota[], tecnica: string): Etapa[] {
  return rotas
    .filter((r) => r.tecnica === tecnica)
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => r.posto)
}

/* O posto seguinte e o anterior DENTRO DA ROTA DELA. Não existe "o próximo
   posto" sozinho: o que vem depois do corte depende da técnica. */
export function vizinhoNaRota(
  rotas: Rota[],
  tecnica: string,
  etapa: Etapa,
  passo: 1 | -1,
): Etapa | null {
  const r = rotaDe(rotas, tecnica)
  const i = r.indexOf(etapa)
  if (i < 0) return null
  const alvo = r[i + passo]
  return alvo ?? null
}

export function estaNaRota(rotas: Rota[], tecnica: string, etapa: Etapa): boolean {
  return rotaDe(rotas, tecnica).includes(etapa)
}

/** Move a fatia. O gatilho da 023 recusa posto fora da rota. */
export async function moverAFatia(id: string, etapa: Etapa): Promise<void> {
  await tabela(`fatia?id=eq.${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    corpo: { etapa },
  })
}

/** As colunas do quadro, na ordem do chão de fábrica. */
export const COLUNAS: Etapa[] = [
  'corte',
  'subli',
  'dtf',
  'prensa',
  'silk',
  'bordado',
  'calandra',
  'futurize',
  'conferencia',
  'cd-costura',
  'costura',
  'embalagem',
  'finalizado',
]

export function nomeDoPosto(e: Etapa): string {
  return POSTO[e]?.nome ?? e
}

export function corDoPosto(e: Etapa): string {
  return POSTO[e]?.cor ?? 'var(--border-2)'
}

/* HÁ QUANTO TEMPO ESTE CARTÃO NÃO ANDA. É a pergunta que o quadro existe para
   responder de longe: um cartão parado há quatro dias no mesmo posto é o que
   está segurando a entrega. */
export function paradoHa(iso: string): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}
