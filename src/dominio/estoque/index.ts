/* ==========================================================================
   O estoque, no minimo que o inicio precisa.

   O modulo de verdade entra na fase 4, com entrada, separacao e compras. O que
   existe aqui e a lista de material e o quanto tem, para o cartao "abaixo do
   minimo" do inicio poder existir.

   ATENCAO: os numeros sao os do mockup v5, e sao inventados.
   ========================================================================== */

export type Categoria = 'tecido' | 'aviamento' | 'insumo'

export type Material = {
  id: string
  categoria: Categoria
  nome: string
  unidade: string
  atual: number
  minimo: number
}

const EXEMPLO: Material[] = [
  { id: 'e02', categoria: 'tecido', nome: 'DRY FIT PET 160 · PRETO', unidade: 'kg', atual: 9, minimo: 20 },
  { id: 'e04', categoria: 'tecido', nome: 'PIQUET PA · BRANCO', unidade: 'kg', atual: 6, minimo: 15 },
  { id: 'e14', categoria: 'aviamento', nome: 'Gola retilínea piquet marinho', unidade: 'un', atual: 40, minimo: 60 },
  { id: 'e21', categoria: 'insumo', nome: 'Tinta sublimática magenta', unidade: 'L', atual: 0.6, minimo: 1 },
  { id: 'e01', categoria: 'tecido', nome: 'DRY FIT PET 160 · BRANCO', unidade: 'kg', atual: 42, minimo: 20 },
  { id: 'e06', categoria: 'tecido', nome: 'MEIA MALHA 30.1 · CINZA MESCLA', unidade: 'kg', atual: 58, minimo: 20 },
  { id: 'e11', categoria: 'aviamento', nome: 'Linha poliéster 120 branca', unidade: 'cone', atual: 18, minimo: 8 },
]

export const DADO_DE_EXEMPLO = true

export function listarMateriais(): Material[] {
  return EXEMPLO
}

export function abaixoDoMinimo(): Material[] {
  return EXEMPLO.filter((m) => m.atual < m.minimo)
}

/** Quanto da barra encher: o minimo fica na metade, para o olho comparar. */
export function nivel(m: Material): number {
  return Math.min(100, (m.atual / (m.minimo * 2)) * 100)
}

export function corDoNivel(m: Material): string {
  if (m.atual < m.minimo) return 'var(--brand)'
  if (m.atual < m.minimo * 1.3) return 'var(--warn)'
  return 'var(--ok)'
}

export function quantidade(m: Material): string {
  return m.atual.toLocaleString('pt-BR', { maximumFractionDigits: m.unidade === 'L' ? 1 : 0 }) + ' ' + m.unidade
}
