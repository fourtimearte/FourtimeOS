/* ==========================================================================
   OS ADICIONAIS DA TABELA DE PREÇO (083; wireframe "Tabela de preço nova",
   aprovado em 16/10/2026).

   O preço da peça vira uma SOMA:
     peça (a faixa, o plus e o infantil, da 068)
     + material (o que o tecido soma)
     + técnica (Sub por peça; Silk por tela, vezes as telas; DTF pela
       combinação de posições, ou escrito na cotação "na metragem")
     + extras (Patch pelo tipo, Bordado pelo tamanho, e os que vierem,
       cada um vezes a quantidade).

   Aqui mora o dado e a conta, sem rede: o teste roda em node.
   ========================================================================== */

import type { Contexto, ItemDaTabela, TabelaDePreco } from './tipos'

export type { Adicionais, CombinacaoDeDtf, Extra, OpcaoDeExtra, PrecoDoTecido, TecnicaDoExtra } from './adicionais-base'
export { adicionaisEmBranco, extrasPadrao } from './adicionais-base'
import { extrasPadrao, type Adicionais, type Extra } from './adicionais-base'

/* --- as posições do DTF -------------------------------------------------------
   As mesmas em todas as tabelas. A caixa é o lugar no desenho da camisa (de
   0 a 100), para o editor e o modal mostrarem onde vai. */
export type LadoDaCamisa = 'frente' | 'costas'
export type PosicaoDeDtf = { id: string; nome: string; medida: string; lado: LadoDaCamisa; caixa: [number, number, number, number] }

export const POSICOES_DE_DTF: PosicaoDeDtf[] = [
  { id: 'peito-pequeno', nome: 'Peito pequeno', medida: 'até 10 cm', lado: 'frente', caixa: [57, 25, 11, 9] },
  { id: 'peito-grande', nome: 'Peito grande', medida: 'até A4', lado: 'frente', caixa: [35, 30, 30, 26] },
  { id: 'manga-direita', nome: 'Manga direita', medida: 'até 8 cm', lado: 'frente', caixa: [12, 24, 10, 8] },
  { id: 'manga-esquerda', nome: 'Manga esquerda', medida: 'até 8 cm', lado: 'frente', caixa: [78, 24, 10, 8] },
  { id: 'nuca', nome: 'Nuca', medida: 'até 10 cm', lado: 'costas', caixa: [43, 13, 14, 7] },
  { id: 'costas-grande', nome: 'Costas grande', medida: 'até A3', lado: 'costas', caixa: [33, 26, 34, 38] },
]

/** "Peito grande e manga direita", na ordem das posições */
export function nomeDaCombinacao(posicoes: string[]): string {
  const nomes = POSICOES_DE_DTF.filter((p) => posicoes.includes(p.id)).map((p, i) => (i ? p.nome.toLowerCase() : p.nome))
  if (!nomes.length) return 'Sem posição'
  if (nomes.length === 1) return nomes[0]
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
}

const numOuNulo = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const texto = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** O que veio do banco, arrumado. O Patch e o Bordado existem sempre. */
export function adicionaisDe(bruto: unknown): Adicionais {
  const x = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  const extras: Extra[] = lista(x.extras).map((e) => ({
    id: texto(e.id),
    nome: texto(e.nome),
    tecnica: e.tecnica === 'patch' || e.tecnica === 'bordado' ? e.tecnica : '',
    opcoes: lista(e.opcoes).map((o) => ({ id: texto(o.id), nome: texto(o.nome), medida: texto(o.medida), valor: numOuNulo(o.valor) })),
  }))
  for (const p of extrasPadrao()) if (!extras.some((e) => e.tecnica === p.tecnica)) extras.push(p)
  return {
    materiais: lista(x.materiais)
      .map((m) => ({ tecido: texto(m.tecido), valor: numOuNulo(m.valor) }))
      .filter((m) => m.tecido),
    extras: [...extras.filter((e) => e.tecnica === 'patch'), ...extras.filter((e) => e.tecnica === 'bordado'), ...extras.filter((e) => !e.tecnica)],
    dtf: lista(x.dtf).map((c) => ({
      id: texto(c.id),
      nome: texto(c.nome),
      posicoes: Array.isArray(c.posicoes) ? (c.posicoes as unknown[]).map(texto) : [],
      valor: numOuNulo(c.valor),
    })),
  }
}

/* --- o tecido ------------------------------------------------------------------
   O nome do tecido do layout é o do catálogo; a comparação é sem acento, sem
   caixa e sem espaço sobrando. */
export const chaveDoTecido = (nome: string) =>
  (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

/** undefined: o tecido não está na lista; null: está, sem preço. */
export function valorDoTecido(a: Adicionais, nome: string): number | null | undefined {
  const k = chaveDoTecido(nome)
  const m = a.materiais.find((x) => chaveDoTecido(x.tecido) === k)
  return m ? m.valor : undefined
}

export function comPrecoDoTecido(a: Adicionais, nomes: string[], valor: number | null): Adicionais {
  const ks = new Set(nomes.map(chaveDoTecido))
  const resto = a.materiais.filter((m) => !ks.has(chaveDoTecido(m.tecido)))
  return { ...a, materiais: [...resto, ...nomes.map((tecido) => ({ tecido, valor }))] }
}

/* --- o id de uma opção ou de uma combinação nova ------------------------------ */
export function novoId(prefixo: string, usados: string[]): string {
  for (let n = 1; ; n++) if (!usados.includes(prefixo + n)) return prefixo + n
}

/* --- a técnica do item: Sub e Silk (o kit sem valor próprio soma as peças) ---- */
export function tecnicaDoItem(
  t: TabelaDePreco,
  item: ItemDaTabela,
  campo: 'sub' | 'silk',
  ctx: Contexto,
  visitando: string[] = [],
): { valor: number | null; origem: 'base' | 'kit' | 'vazio' } {
  const proprio = item[campo]
  if (proprio != null && Number.isFinite(proprio)) return { valor: proprio, origem: 'base' }
  if (item.tipo !== 'kit' || visitando.includes(item.codigo)) return { valor: null, origem: 'vazio' }
  const pecas = ctx.pecasDoKit(item.codigo)
  if (!pecas.length) return { valor: null, origem: 'vazio' }
  let soma = 0
  for (const cod of pecas) {
    const it = ctx.achar(cod)
    const v = it ? tecnicaDoItem(t, it, campo, ctx, [...visitando, item.codigo]).valor : null
    if (v == null) return { valor: null, origem: 'vazio' }
    soma += v
  }
  return { valor: Math.round(soma * 100) / 100, origem: 'kit' }
}

/* --- a conta de um layout ---------------------------------------------------- */

/** O que o layout escolheu, lido da ficha do layout na cotação. */
export type EscolhasDoLayout = {
  tecidos: string[]
  sub: boolean
  /** quantas telas; null = o layout não tem Silk */
  silk: number | null
  /** null = sem DTF; senão a combinação escolhida ou o preço por peça escrito */
  dtf: { combinacao: string; porPeca: number | null } | null
  patch: { opcao: string; qtd: number } | null
  bordado: { opcao: string; qtd: number } | null
  /** os extras novos (nem Patch nem Bordado) */
  extras: { extra: string; opcao: string; qtd: number }[]
}

export type TipoDaParte = 'material' | 'sub' | 'silk' | 'dtf' | 'patch' | 'bordado' | 'extra'

export type ParteDaConta = {
  tipo: TipoDaParte
  /** "Dry fit PET 160", "Peito grande e manga", "Relevo" */
  rotulo: string
  /** o preço de cada um (por tela, por patch); 0 quando falta */
  cada: number
  qtd: number
  /** cada vezes a quantidade */
  valor: number
  /** o que falta para a parte valer; vazio quando está certa */
  falta: string
}

export type ContaDosAdicionais = { partes: ParteDaConta[]; adicional: number }

const centavo = (v: number) => Math.round(v * 100) / 100

export function contaDosAdicionais(
  t: TabelaDePreco | undefined,
  item: ItemDaTabela | undefined,
  ctx: Contexto | undefined,
  e: EscolhasDoLayout,
): ContaDosAdicionais {
  const partes: ParteDaConta[] = []
  const por = (tipo: TipoDaParte, rotulo: string, cada: number | null | undefined, qtd: number, falta: string) => {
    const c = cada == null || !Number.isFinite(cada) ? 0 : cada
    partes.push({ tipo, rotulo, cada: centavo(c), qtd, valor: centavo(c * qtd), falta: cada == null ? falta : '' })
  }
  const a = t?.adicionais

  /* o material: o tecido mais caro do layout (dois tecidos na mesma peça não somam duas vezes) */
  if (a && e.tecidos.length) {
    const vistos = e.tecidos.map((n) => ({ n, v: valorDoTecido(a, n) }))
    const comPreco = vistos.filter((x) => x.v != null) as { n: string; v: number }[]
    if (comPreco.length) {
      const maior = comPreco.reduce((m, x) => (x.v > m.v ? x : m))
      if (maior.v > 0) por('material', maior.n, maior.v, 1, '')
    } else if (vistos.some((x) => x.v === null)) {
      por('material', vistos[0].n, null, 1, 'o tecido está sem preço na tabela')
    }
  }

  if (e.sub) {
    const v = t && item && ctx ? tecnicaDoItem(t, item, 'sub', ctx).valor : null
    por('sub', 'Sublimação', v, 1, 'a peça está sem o preço da Sub na tabela')
  }
  if (e.silk != null) {
    const v = t && item && ctx ? tecnicaDoItem(t, item, 'silk', ctx).valor : null
    por('silk', 'Silk', v, Math.max(1, e.silk), 'a peça está sem o preço da tela do Silk na tabela')
  }
  if (e.dtf) {
    if (e.dtf.porPeca != null) por('dtf', 'Na metragem', e.dtf.porPeca, 1, '')
    else {
      const c = a?.dtf.find((x) => x.id === e.dtf!.combinacao)
      por('dtf', c ? c.nome : 'DTF', c ? c.valor : null, 1, c ? 'a combinação está sem preço' : 'escolher o DTF')
    }
  }
  const doExtra = (tipo: TipoDaParte, ex: Extra | undefined, opcao: string, qtd: number, nome: string) => {
    const o = ex?.opcoes.find((x) => x.id === opcao)
    por(tipo, o ? o.nome + (o.medida ? ', ' + o.medida : '') : nome, o ? o.valor : null, Math.max(1, qtd), o ? 'sem preço na tabela' : 'escolher ' + nome.toLowerCase())
  }
  if (e.patch) doExtra('patch', a?.extras.find((x) => x.tecnica === 'patch'), e.patch.opcao, e.patch.qtd, 'o tipo')
  if (e.bordado) doExtra('bordado', a?.extras.find((x) => x.tecnica === 'bordado'), e.bordado.opcao, e.bordado.qtd, 'o tamanho')
  for (const x of e.extras) {
    const ex = a?.extras.find((y) => y.id === x.extra)
    doExtra('extra', ex, x.opcao, x.qtd, ex?.nome ?? 'a opção')
  }
  return { partes, adicional: centavo(partes.reduce((s, p) => s + p.valor, 0)) }
}
