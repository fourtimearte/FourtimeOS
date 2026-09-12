import type { Faixa, Grade } from './grade'

/* ==========================================================================
   O bloco de layout.

   Este e o pedaco que a cotacao (.cft) e a ficha de producao (.ft) vao
   compartilhar. Ele mora aqui, em dominio/layout, e nao dentro de um dos dois,
   exatamente para os dois lerem a mesma coisa e a escada de migracao ser uma
   so. Quando a fase 2 comecar, a ficha importa daqui sem copiar nada.

   Um bloco e uma peca cotada: referencia, tecido, cor, grade, design e imagem.
   ========================================================================== */

export const VERSAO_DO_BLOCO = 1

export type Tecnica =
  | 'dtf'
  | 'subli'
  | 'silk'
  | 'patch'
  | 'bordado'
  | 'gola'
  | 'ribana'
  | 'etiqueta'

/** uma tecnica marcada no bloco, com as cores lancadas nela */
export type Design = {
  /** o nome como a fabrica fala: DTF, Subli, Silk, Eti. Fourtime, Gola Tecido */
  tag: string
  /** a familia de cor, que decide a pilula e a faixa */
  tecnica: Tecnica
  /** codigos do banco: 001 a 300 no DTF, S01 a S87 na sublimacao */
  cores: { cod: string; hex: string }[]
}

export type TecidoDoBloco = {
  nome: string
  cor: string
  hex: string
}

export type Bloco = {
  id: string
  /** a ordem na folha, comecando em 1 */
  n: number
  referencia: string
  nomeDaReferencia: string
  genero: string
  faixa: Faixa
  grade: Grade
  tecidos: TecidoDoBloco[]
  design: Design[]
  /** o nome da arte, que e o que liga o bloco ao arquivo de arte */
  arte: string
  /** a imagem em data URL, ou vazio */
  imagem: string
  observacao: string
}

export function blocoEmBranco(n: number): Bloco {
  return {
    id: 'B' + Math.random().toString(36).slice(2, 9),
    n,
    referencia: '',
    nomeDaReferencia: '',
    genero: '',
    faixa: 'adulto',
    grade: {},
    tecidos: [],
    design: [],
    arte: '',
    imagem: '',
    observacao: '',
  }
}

/* ==========================================================================
   A escada de migracao do bloco.

   Ela nasce com um degrau so, que nao faz nada, e isso e de proposito: a hora
   de escrever a escada e antes de existir o segundo formato, nao depois. Cada
   mudanca de formato vira um degrau novo aqui, e nenhum arquivo antigo deixa
   de abrir.
   ========================================================================== */

type Bruto = Record<string, unknown>

const DEGRAUS: ((b: Bruto) => Bruto)[] = [
  /* de 0 (antes de existir versao) para 1: nada a fazer, so carimbar */
  (b) => b,
]

export function migrarBloco(bruto: Bruto): Bloco {
  let v = Number(bruto.versao ?? 0)
  let atual = bruto
  while (v < VERSAO_DO_BLOCO) {
    atual = DEGRAUS[v](atual)
    v++
  }
  return { ...(atual as unknown as Bloco) }
}
