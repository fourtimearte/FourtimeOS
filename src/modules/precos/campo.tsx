import {
  CampoDeCelula,
  usarAlcaDeCelulas,
  usarEdicaoDeCelulas,
  type AlcaDeCelulas,
  type EdicaoDeCelulas,
  type EstadoDaCelula,
} from '@ds'
import { COLUNAS_DE_TECNICA, celula, tecnicaDoItem, type Celula, type Contexto, type ItemDaTabela, type TabelaDePreco } from '@dominio/preco'

/* ==========================================================================
   O CAMPO DO PREÇO (prancha 139): todo preço é um campo à vista. A primeira
   faixa é o PREÇO BASE, escrito por alguém; as outras vêm da regra, em
   cinza, ou foram escritas à mão, com o ponto. Sem base, o campo fica
   tracejado em vermelho ("R$ 0,00") e as faixas esperam com "da base".

   A célula, a edição jeito planilha e a alça moram no Design System desde
   16/10/2026 (ds/componentes/celula.tsx; Kit de Comportamento, seção 3).
   Aqui fica só o que é da tabela de preço: a faixa e o que cada estado diz.
   ========================================================================== */

const TITULO: Record<EstadoDaCelula, string> = {
  base: 'O preço base, escrito por alguém',
  mao: 'Escrito à mão. Apague para voltar à regra.',
  regra: 'Da regra da tabela, a partir do preço base',
  kit: 'Soma das peças do kit',
  vazio: 'Falta o preço base: sem ele a peça não sai na cotação',
  espera: 'Espera o preço base',
  fora: 'Fora da tabela: escreva um preço para pôr',
}

export type Edicao = EdicaoDeCelulas
export type Alca = AlcaDeCelulas

export function usarEdicao(o: {
  ordem: string[]
  faixas: number
  valorDe: (codigo: string, faixa: number) => number | null
  aoEscrever: (codigo: string, faixa: number, valor: number | null) => void
  aoColar: (codigo: string, faixa: number, texto: string) => void
}): Edicao {
  return usarEdicaoDeCelulas({ ordem: o.ordem, colunas: o.faixas, valorDe: o.valorDe, aoEscrever: o.aoEscrever, aoColar: o.aoColar })
}

export function usarAlca(o: {
  ordem: string[]
  valorDe: (codigo: string, faixa: number) => number | null
  aoPreencher: (alvos: { codigo: string; faixa: number }[], valor: number) => void
}): Alca {
  return usarAlcaDeCelulas({
    ordem: o.ordem,
    valorDe: o.valorDe,
    aoPreencher: (alvos, v) => o.aoPreencher(alvos.map((a) => ({ codigo: a.id, faixa: a.coluna })), v),
  })
}

export function CampoDePreco({
  codigo,
  faixa,
  celula,
  fora = false,
  rotulo,
  podeMexer,
  edicao,
  alca,
  vazioDiz,
}: {
  codigo: string
  faixa: number
  celula: Celula
  fora?: boolean
  rotulo: string
  podeMexer: boolean
  edicao: Edicao
  alca?: Alca
  /** o que a célula vazia diz quando ela não é a base (Sub e Silk: "não faz") */
  vazioDiz?: string
}) {
  const estado: EstadoDaCelula = fora
    ? 'fora'
    : celula.origem === 'vazio'
      ? faixa === 0 && !vazioDiz
        ? 'vazio'
        : 'espera'
      : celula.origem === 'mao'
        ? 'mao'
        : celula.origem
  const texto =
    estado === 'fora' ? 'fora' : estado === 'vazio' ? 'R$ 0,00' : estado === 'espera' ? (vazioDiz ?? 'da base') : undefined
  return (
    <CampoDeCelula
      id={codigo}
      coluna={faixa}
      valor={celula.valor}
      estado={estado}
      texto={texto}
      titulo={vazioDiz && estado === 'espera' ? 'A peça não faz esta técnica nesta tabela. Escreva o preço para fazer.' : TITULO[estado]}
      rotulo={rotulo}
      podeMexer={podeMexer}
      edicao={edicao}
      alca={alca}
    />
  )
}

/* --- AS COLUNAS DA GRADE (083): as faixas, e depois a Sub (por peça) e o
   Silk (por tela). As duas grades da tabela, a Lista e o modo Tabela, usam
   as mesmas contas, e as mesmas teclas passam de uma coluna para a outra. */
export const colunasDaGrade = (t: TabelaDePreco) => t.faixas.length + COLUNAS_DE_TECNICA

export const ehTecnica = (t: TabelaDePreco, i: number) => i >= t.faixas.length

/** O que a célula guarda (o escrito): a base, o à mão da faixa, a Sub ou o Silk. */
export function escritoNaColuna(t: TabelaDePreco, it: ItemDaTabela | undefined, i: number): number | null {
  if (!it) return null
  if (i === t.faixas.length) return it.sub ?? null
  if (i === t.faixas.length + 1) return it.silk ?? null
  return i === 0 ? it.base : (it.precos[i] ?? null)
}

/** O que a célula mostra, e de onde veio. */
export function celulaDaColuna(t: TabelaDePreco, it: ItemDaTabela, i: number, ctx: Contexto): Celula {
  if (!ehTecnica(t, i)) return celula(t, it, i, ctx)
  const r = tecnicaDoItem(t, it, i === t.faixas.length ? 'sub' : 'silk', ctx)
  return { valor: r.valor, origem: r.origem }
}
