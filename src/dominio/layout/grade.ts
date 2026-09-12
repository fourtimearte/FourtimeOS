/* ==========================================================================
   A grade de tamanhos.

   Duas faixas: adulto e infantil. A grade e propriedade da REFERENCIA, nao do
   sistema: a mesma cotacao pode ter um produto em grade adulta e outro em
   infantil.

   A regra de ordem vem do editor v4 e existe porque ninguem digita tamanho
   fora de faixa por acidente: quando acontece, e de proposito, e precisa
   aparecer. Na grade adulta, tamanho infantil preenchido sobe para o topo,
   antes do PP. Na grade infantil, tamanho adulto desce para o fim, depois do
   14A. E o que esta fora da faixa ganha fundo colorido, para ser visto de
   longe na mesa de corte.
   ========================================================================== */

export type Faixa = 'adulto' | 'infantil'

export const TAMANHOS_ADULTO = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4'] as const
export const TAMANHOS_INFANTIL = ['1A', '2A', '4A', '6A', '8A', '10A', '12A', '14A'] as const

export type Tamanho = (typeof TAMANHOS_ADULTO)[number] | (typeof TAMANHOS_INFANTIL)[number]

/** quantidade por tamanho. Tamanho sem quantidade simplesmente nao esta aqui. */
export type Grade = Partial<Record<Tamanho, number>>

export function faixaDoTamanho(t: string): Faixa {
  return (TAMANHOS_INFANTIL as readonly string[]).includes(t) ? 'infantil' : 'adulto'
}

/** Os tamanhos que a grade mostra, na ordem certa para a faixa escolhida. */
export function tamanhosNaOrdem(faixa: Faixa, grade: Grade): Tamanho[] {
  const daFaixa = faixa === 'adulto' ? TAMANHOS_ADULTO : TAMANHOS_INFANTIL
  const daOutra = faixa === 'adulto' ? TAMANHOS_INFANTIL : TAMANHOS_ADULTO
  /* da outra faixa, so entram os que tem quantidade: eles sao a excecao */
  const intrusos = daOutra.filter((t) => (grade[t] ?? 0) > 0)
  return faixa === 'adulto'
    ? [...intrusos, ...daFaixa]
    : [...daFaixa, ...intrusos]
}

/** true quando o tamanho nao pertence a faixa da grade */
export function foraDaFaixa(faixa: Faixa, t: string) {
  return faixaDoTamanho(t) !== faixa
}

export function totalDaGrade(g: Grade): number {
  return Object.values(g).reduce((s: number, n) => s + (n ?? 0), 0)
}

/** A grade escrita em uma linha, para o resumo e para a folha A4. */
export function gradeEmTexto(faixa: Faixa, g: Grade): string {
  return tamanhosNaOrdem(faixa, g)
    .filter((t) => (g[t] ?? 0) > 0)
    .map((t) => t + ' ' + g[t])
    .join('   ')
}
