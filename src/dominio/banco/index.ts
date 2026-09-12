import { CATS_REF, GRUPOS_DE_COR, TIPOS_TECIDO, refCategoria, refGenero } from '@ds/kit/banco-de-exemplo'
import {
  CORES_DO_EDITOR,
  DEPARTAMENTOS,
  EMBALAGENS,
  ENTREGAS,
  PAGAMENTOS,
  REFERENCIAS_DO_EDITOR,
  VENDEDORES,
  type CorDoBanco,
} from './dados'

/* ==========================================================================
   O banco de dados, nas nove categorias do editor.

   A tela so mostra; quem manda no conteudo e dados.ts, que e copia do banco do
   editor. Aqui mora o que a tela precisa saber para agrupar e contar.
   ========================================================================== */

export * from './dados'

export type Categoria =
  | 'clientes'
  | 'cores'
  | 'referencias'
  | 'tecidos'
  | 'pagamentos'
  | 'departamentos'
  | 'vendedores'
  | 'entregas'
  | 'embalagens'

/* --- referencia: o codigo carrega categoria e genero ---------------------- */
const SEPARADOR = /\s*—\s*/

export type ReferenciaDoBanco = {
  cod: string
  nome: string
  genero: string
  categoria: string
}

export const REFERENCIAS: ReferenciaDoBanco[] = REFERENCIAS_DO_EDITOR.map((linha) => {
  const partes = linha.split(SEPARADOR)
  /* Duas linhas do banco do editor nao tem codigo: alguem cadastrou so o nome.
     Elas entram assim mesmo, marcadas, porque esconder erro de cadastro e o
     jeito de ele nunca ser consertado. */
  if (partes.length < 2) {
    return { cod: '', nome: linha, genero: '', categoria: 'sem categoria' }
  }
  const [cod, ...resto] = partes
  return {
    cod,
    nome: resto.join(' '),
    genero: refGenero(cod),
    categoria: CATS_REF[refCategoria(cod)] ?? 'Outros',
  }
})

/** Quantas referencias estao sem codigo. A tela avisa, e nao esconde. */
export const REFERENCIAS_SEM_CODIGO = REFERENCIAS.filter((r) => !r.cod).length

/* --- cor: o codigo do grupo vira o nome do grupo -------------------------- */
const NOME_DO_GRUPO: Record<string, string> = { SUB: 'Sublimação' }
GRUPOS_DE_COR.forEach((g) => {
  NOME_DO_GRUPO[g.cod] = g.nome
})

export type GrupoDeCores = { cod: string; nome: string; cores: CorDoBanco[] }

export const CORES_POR_GRUPO: GrupoDeCores[] = (() => {
  const ordem: string[] = []
  const mapa: Record<string, CorDoBanco[]> = {}
  CORES_DO_EDITOR.forEach((c) => {
    if (!mapa[c.g]) {
      mapa[c.g] = []
      ordem.push(c.g)
    }
    mapa[c.g].push(c)
  })
  return ordem.map((cod) => ({ cod, nome: NOME_DO_GRUPO[cod] ?? cod, cores: mapa[cod] }))
})()

/* --- tecido: os tipos vem da 3.375, que foi quando eles nasceram ---------- */
export type TipoDeTecidoDoBanco = { cod: string; nome: string; itens: string[] }
export const TECIDOS_POR_TIPO: TipoDeTecidoDoBanco[] = TIPOS_TECIDO
export const TECIDOS = TIPOS_TECIDO.flatMap((t) => t.itens)

/* --- as listas simples, que sao so nome ----------------------------------- */
export const LISTA_SIMPLES: Record<string, string[]> = {
  pagamentos: PAGAMENTOS,
  departamentos: DEPARTAMENTOS,
  vendedores: VENDEDORES,
  entregas: ENTREGAS,
  embalagens: EMBALAGENS,
}

export type Aba = { chave: Categoria; nome: string; conta: number }

/** Quantos clientes a base tem. Ele chega de fora porque cliente tem tela
    propria: aqui o banco so conta. */
export function abas(clientes: number): Aba[] {
  return [
    { chave: 'clientes', nome: 'Clientes', conta: clientes },
    { chave: 'cores', nome: 'Cores', conta: CORES_DO_EDITOR.length },
    { chave: 'referencias', nome: 'Referências', conta: REFERENCIAS.length },
    { chave: 'tecidos', nome: 'Tecidos', conta: TECIDOS.length },
    { chave: 'pagamentos', nome: 'Pagamentos', conta: PAGAMENTOS.length },
    { chave: 'departamentos', nome: 'Departamentos', conta: DEPARTAMENTOS.length },
    { chave: 'vendedores', nome: 'Vendedores', conta: VENDEDORES.length },
    { chave: 'entregas', nome: 'Entregas', conta: ENTREGAS.length },
    { chave: 'embalagens', nome: 'Embalagens', conta: EMBALAGENS.length },
  ]
}
