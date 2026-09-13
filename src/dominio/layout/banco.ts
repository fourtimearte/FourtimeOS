import {
  CATS_ORDEM,
  CATS_REF,
  DTF_CORES,
  GRUPOS_DE_COR,
  SB_CORES,
  TAG_ACABAMENTO,
  TAG_ETIQUETA,
  TAG_TECNICA,
  TIPOS_TECIDO,
  refCategoria,
  refGenero,
  REFS,
} from '@ds/kit/banco-de-exemplo'
import type { AbaDeCores, Referencia, SecaoDeTecnica, Tecnica as TecnicaDoDs } from '@ds'
import type { Tecnica } from './bloco'

/* A lista de tecnicas existe duas vezes de proposito: o ds precisa dela para
   pintar, e o dominio precisa dela sem depender do ds (bloco.ts e dado puro, e
   a conferencia das contas o compila sozinho, sem os atalhos do bundler).
   Duas listas que precisam ser iguais quebram calada um dia, entao esta trava
   compara as duas: se alguem acrescentar uma tecnica num lado so, o build
   para aqui em vez de parar na tela do galpao. */
type Confere<A extends B, B> = A
export type TravaDaTecnica = Confere<Tecnica, TecnicaDoDs> & Confere<TecnicaDoDs, Tecnica>

/* ==========================================================================
   O vocabulario da fabrica, do jeito que os menus pedem.

   As listas cruas moram em ds/kit/banco-de-exemplo, porque foi la que elas
   nasceram para o /kit. Aqui elas viram o formato que os cinco menus esperam,
   e este arquivo passa a ser o UNICO lugar que faz essa traducao: o editor de
   cotacao e, na fase 2, o de ficha leem daqui.

   Quando o Supabase entrar, so este arquivo troca a origem das listas.
   ========================================================================== */

/* o banco guarda a referencia como "codigo <traco> nome" numa linha so */
const SEPARADOR = /\s*—\s*/

export const REFERENCIAS: Referencia[] = REFS.map((linha) => {
  const [cod, ...resto] = linha.split(SEPARADOR)
  return { cod, nome: resto.join(' '), genero: refGenero(cod), categoria: refCategoria(cod) }
})

export function acharReferencia(cod: string): Referencia | null {
  return REFERENCIAS.find((r) => r.cod === cod) ?? null
}

export const CATEGORIAS = CATS_REF
export const ORDEM_DAS_CATEGORIAS = CATS_ORDEM
export const TIPOS_DE_TECIDO = TIPOS_TECIDO
export const GRUPOS_DE_COR_DE_TECIDO = GRUPOS_DE_COR

/* --- design: etiqueta, tecnica e acabamento, nessa ordem fixa ------------- */

export const COR_DA_TECNICA: Record<string, string> = {
  DTF: 'var(--tec-dtf-vivo)',
  Subli: 'var(--tec-subli-vivo)',
  Silk: 'var(--tec-silk-vivo)',
  Patch: 'var(--tec-patch-vivo)',
  Bordado: 'var(--tec-bordado-vivo)',
  'Gola Tecido': 'var(--tec-gola-vivo)',
  Ribana: 'var(--tec-ribana-vivo)',
}

export const TECNICA_DA_TAG: Record<string, Tecnica> = {
  DTF: 'dtf',
  Subli: 'subli',
  Silk: 'silk',
  Patch: 'patch',
  Bordado: 'bordado',
  'Gola Tecido': 'gola',
  Ribana: 'ribana',
}

export const TAGS_DE_ETIQUETA = TAG_ETIQUETA
export const TAGS_DE_TECNICA = TAG_TECNICA
export const TAGS_DE_ACABAMENTO = TAG_ACABAMENTO
export const TODAS_AS_TAGS = [...TAG_ETIQUETA, ...TAG_TECNICA, ...TAG_ACABAMENTO]

/* A que fileira do cartao de design a tag pertence. Sao tres seçoes de
   verdade, e nao rotulos: etiqueta e o que vai costurado na peça, tecnica e
   como a arte e impressa, acabamento e como a peça e montada. No cartao cada
   uma ganha a sua fileira, com um filete entre elas. */
export type SecaoDaTag = 'etiqueta' | 'tecnica' | 'acabamento'

export function secaoDaTag(tag: string): SecaoDaTag {
  if (TAG_ETIQUETA.includes(tag)) return 'etiqueta'
  if (TAG_ACABAMENTO.includes(tag)) return 'acabamento'
  return 'tecnica'
}

/** A familia de cor de uma tag. Toda etiqueta pinta de etiqueta. */
export function tecnicaDaTag(tag: string): Tecnica {
  if (TAG_ETIQUETA.includes(tag)) return 'etiqueta'
  return TECNICA_DA_TAG[tag] ?? 'dtf'
}

export const SECOES_DE_TECNICA: SecaoDeTecnica[] = [
  { titulo: 'Etiqueta', itens: TAG_ETIQUETA.map((n) => ({ nome: n, cor: 'var(--brand)' })) },
  { titulo: 'Tipo de impressão', itens: TAG_TECNICA.map((n) => ({ nome: n, cor: COR_DA_TECNICA[n] })) },
  { titulo: 'Acabamento', itens: TAG_ACABAMENTO.map((n) => ({ nome: n, cor: COR_DA_TECNICA[n] })) },
]

/* --- codigo de cor: as duas abas ----------------------------------------- */

export const ABAS_DE_COR: AbaDeCores[] = [
  { id: 'dtf', rotulo: 'DTF', cor: 'var(--tec-dtf-vivo)', cores: DTF_CORES },
  { id: 'sub', rotulo: 'SUB', cor: 'var(--tec-subli-vivo)', cores: SB_CORES },
]

/* Quais tecnicas lancam codigo de cor.

   DUAS, e so duas: DTF e sublimacao. E o que a v3.375 faz, e o motivo esta na
   fabrica e nao no sistema: DTF e sublimacao tem tabela de cor numerada na
   maquina, e o silk e misturado na hora pelo operador. Lancar codigo no silk
   seria pedir um numero que nao existe em lugar nenhum. */
export function lancaCor(tecnica: Tecnica) {
  return tecnica === 'dtf' || tecnica === 'subli'
}
