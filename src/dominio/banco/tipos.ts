/* ==========================================================================
   O banco de dados da fábrica, em tipos.

   Regra número um, e ela vem da fábrica e não do sistema: CÓDIGO NÃO MUDA.
   A referência é FT-GGG-NNNX, a cor de DTF é um número de três dígitos e a de
   sublimação é S mais dois. É isso que o operador lê na máquina e o que está
   escrito nas fichas antigas. O que a tela edita é o nome.
   ========================================================================== */

/** As dez categorias, nos três grupos em que o editor as arruma. */
export type Categoria =
  | 'referencias'
  | 'tecidos'
  | 'pagamento'
  | 'entrega'
  | 'embalagem'
  | 'vendedor'
  | 'departamento'
  | 'cor-tecido'
  | 'dtf'
  | 'sublimacao'

/** Os cinco tipos que moram na mesma tabela, porque são a mesma coisa. */
export type TipoDeLista = 'pagamento' | 'entrega' | 'embalagem' | 'vendedor' | 'departamento'

export type Grupo = { cod: string; nome: string; ordem: number }

export type Referencia = {
  id: string
  cod: string
  nome: string
  grupo: string | null
  /** M masculino, F feminino, C infantil, U unissex */
  genero: string
  ordem: number
  ativo: boolean
}

export type Tecido = {
  id: string
  nome: string
  grupo: string | null
  ordem: number
  ativo: boolean
}

export type CorDeTecido = {
  id: string
  nome: string
  hex: string
  grupo: string | null
  ordem: number
  ativo: boolean
}

/** Tabela fixa: ninguém acrescenta nem apaga pela tela. Só o nome muda. */
export type CorDeImpressao = {
  codigo: string
  tecnica: 'dtf' | 'sublimacao'
  numero: number
  hex: string
  nome: string
}

export type ItemDeLista = {
  tipo: TipoDeLista
  valor: string
  ordem: number
  ativo: boolean
}

export type Problema = { id: string; cod: string; nome: string; problema: string }

/** Tudo que a tela do banco precisa, numa carga só. */
export type Banco = {
  gruposDeReferencia: Grupo[]
  gruposDeTecido: Grupo[]
  gruposDeCor: Grupo[]
  referencias: Referencia[]
  tecidos: Tecido[]
  coresDeTecido: CorDeTecido[]
  coresDeImpressao: CorDeImpressao[]
  listas: ItemDeLista[]
  problemas: Problema[]
}

export const BANCO_VAZIO: Banco = {
  gruposDeReferencia: [],
  gruposDeTecido: [],
  gruposDeCor: [],
  referencias: [],
  tecidos: [],
  coresDeTecido: [],
  coresDeImpressao: [],
  listas: [],
  problemas: [],
}

/* --- o código da referência ------------------------------------------------
   FT-010-004F: o 010 é o grupo de peça, o 004 é o sequencial e o F é o gênero.
   As duas funções abaixo leem isso, e são as únicas que sabem o formato. */

export const GENERO_DA_LETRA: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  C: 'Infantil',
  U: 'Unissex',
}

export function grupoDoCodigo(cod: string): string {
  const p = cod.split('-')
  /* FT-KIT-020-000M-090-000M existe: o grupo é a segunda parte, sempre. */
  return p.length >= 2 ? p[1] : ''
}

export function generoDoCodigo(cod: string): string {
  const fim = cod.trim().slice(-1).toUpperCase()
  return GENERO_DA_LETRA[fim] ? fim : ''
}

/** "FT-010-004F" vira "010-004F": o FT é o mesmo em todas e só ocupa espaço. */
export function codigoCurto(cod: string): string {
  return cod.startsWith('FT-') ? cod.slice(3) : cod
}
