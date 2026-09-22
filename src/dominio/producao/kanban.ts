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
  /* o nome que a fabrica da ao pedido. Vazio no banco, a view ja cai para o
     nome do cliente, entao aqui ele nunca vem em branco por engano */
  nome: string
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
  /* as tags mestre, lidas da cotacao na hora: elas valem para o pedido
     inteiro e em todo posto */
  marcas: string[]
  /* as tags do posto postas neste cartao */
  tags: string[]
  pegoPor: string
  pegoPorNome: string
  pegoEm: string
  falas: number
  /* QUANTOS ANEXOS, e ele é zero até o Drive entrar.

     O ícone de clipe no cartão já existe e já sabe se esconder quando não há
     anexo nenhum, que é o estado de hoje. Deixar o número de fora agora seria
     ter que mexer no cartão de novo no dia do Drive; deixar o ícone aceso sem
     anexo seria um clipe que não abre nada, que é pior. */
  anexos: number
}

type LinhaDaFatia = {
  id: string
  pedido_id: string
  numero: string
  nome: string
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
  marcas: string[] | null
  tags: string[] | null
  pego_por: string | null
  pego_por_nome: string | null
  pego_em: string | null
  falas: number | null
}

export async function carregarOQuadro(): Promise<FatiaNoQuadro[]> {
  const linhas = await tabela<LinhaDaFatia[]>(
    'fatia_na_fabrica?select=*&estado=in.(producao,pronto)&order=entrega_em.asc.nullslast,numero.asc',
  )
  return linhas.map((l) => ({
    id: l.id,
    pedidoId: l.pedido_id,
    numero: l.numero,
    nome: l.nome || l.cliente || '',
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
    marcas: l.marcas ?? [],
    tags: l.tags ?? [],
    pegoPor: l.pego_por ?? '',
    pegoPorNome: l.pego_por_nome || '',
    pegoEm: l.pego_em ?? '',
    falas: Number(l.falas) || 0,
    anexos: 0,
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
