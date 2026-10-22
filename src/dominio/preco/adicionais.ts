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

export type { Adicionais, CombinacaoDeDtf, Extra, LadoDaCamisa, OpcaoDeExtra, PrecoDoTecido, TamanhoDeDtf, TecnicaDoExtra } from './adicionais-base'
export { adicionaisEmBranco, extrasPadrao, tamanhosPadrao } from './adicionais-base'
import { extrasPadrao, tamanhosPadrao, type Adicionais, type Extra, type LadoDaCamisa, type TamanhoDeDtf } from './adicionais-base'

/* --- os tamanhos do DTF no desenho --------------------------------------------
   O desenho da camisa vai de 0 a 100 e é o molde M da camiseta tradicional
   (camisa-molde.ts), em cm: 1 unidade = 1 cm. A caixa de cada tamanho sai da
   medida real, centrada no lugar escolhido, e nunca sai do desenho.
   (Até 22/10/2026 o desenho era à mão e a escala era 0,8.) */
export const ESCALA_DA_CAMISA = 1
export type PosicaoDeDtf = TamanhoDeDtf
/** Os tamanhos de partida (o que uma tabela sem tamanhos guardados usa). */
export const POSICOES_DE_DTF: TamanhoDeDtf[] = tamanhosPadrao()

const meio = (v: number) => Math.round(v * 2) / 2
const ladoNoDesenho = (cm: number) => Math.min(96, Math.max(2, cm * ESCALA_DA_CAMISA))

/** [x, y, largura, altura] no desenho */
export function caixaDoTamanho(p: TamanhoDeDtf): [number, number, number, number] {
  const w = ladoNoDesenho(p.largura)
  const h = ladoNoDesenho(p.altura)
  const cx = Math.min(100 - w / 2, Math.max(w / 2, p.x))
  const cy = Math.min(100 - h / 2, Math.max(h / 2, p.y))
  return [cx - w / 2, cy - h / 2, w, h]
}

/** O centro que cabe no desenho com esta medida (arrastar não leva para fora). */
export function centroQueCabe(p: TamanhoDeDtf, x: number, y: number): { x: number; y: number } {
  const w = ladoNoDesenho(p.largura)
  const h = ladoNoDesenho(p.altura)
  return { x: meio(Math.min(100 - w / 2, Math.max(w / 2, x))), y: meio(Math.min(100 - h / 2, Math.max(h / 2, y))) }
}

const cm = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
/** "21 x 29,7 cm" */
export const medidaDoTamanho = (p: Pick<TamanhoDeDtf, 'largura' | 'altura'>) => `${cm(p.largura)} x ${cm(p.altura)} cm`

/** As medidas prontas que se clicam no editor. */
export const MEDIDAS_PRONTAS: { nome: string; largura: number; altura: number }[] = [
  { nome: 'A3', largura: 29.7, altura: 42 },
  { nome: 'A4', largura: 21, altura: 29.7 },
  { nome: 'A5', largura: 14.8, altura: 21 },
  { nome: 'A6', largura: 10.5, altura: 14.8 },
  { nome: '10 x 10', largura: 10, altura: 10 },
  { nome: '8 x 8', largura: 8, altura: 8 },
]

/* --- o CUSTO do DTF (pedido dele em 22/10/2026) -------------------------------
   O metro de filme custa tudo junto (filme, pó, tinta, prensa e mão de obra),
   e só uma parte dele vira estampa: o resto se perde entre as artes. O custo
   de um cm² de estampa é o metro dividido só pela área aproveitada:
     metro ÷ (100 cm × largura do filme × aproveitamento)
   R$ 60 o metro, filme de 58 cm e 80% aproveitado dá R$ 0,012931 o cm².
   O número vale para a fábrica inteira e mora na regulagem (custo-do-dtf.ts). */
export type CustoDoDtf = {
  /** o preço do metro, tudo incluído */
  metro: number
  /** a largura do filme, em cm */
  largura: number
  /** quanto do filme vira estampa, em por cento */
  aproveitamento: number
}
export const CUSTO_DO_DTF_PADRAO: CustoDoDtf = { metro: 60, largura: 58, aproveitamento: 80 }

/** R$ por cm² de estampa, com a perda do filme dentro */
export const custoPorCm2 = (c: CustoDoDtf) => c.metro / (100 * c.largura * (c.aproveitamento / 100))

/** o custo de uma área de estampa, em reais, com o centavo arredondado uma vez */
export const custoDaArea = (cm2: number, c: CustoDoDtf) => Math.round(cm2 * custoPorCm2(c) * 100) / 100

export const custoDoTamanho = (t: Pick<TamanhoDeDtf, 'largura' | 'altura'>, c: CustoDoDtf) => custoDaArea(t.largura * t.altura, c)

/** a soma das áreas dos tamanhos ligados, arredondada uma vez; null sem tamanho */
export function custoDaCombinacao(posicoes: string[], tamanhos: TamanhoDeDtf[], c: CustoDoDtf): number | null {
  const ligados = tamanhos.filter((t) => posicoes.includes(t.id))
  if (!ligados.length) return null
  return custoDaArea(
    ligados.reduce((s, t) => s + t.largura * t.altura, 0),
    c,
  )
}

/** o preço que ainda acompanha o custo (ninguém escreveu outro por cima) */
export const segueOCusto = (valor: number | null, custo: number | null) => valor == null || (custo != null && Math.abs(valor - custo) < 0.005)

/** "Peito grande e manga direita", na ordem dos tamanhos da tabela */
export function nomeDaCombinacao(posicoes: string[], tamanhos: TamanhoDeDtf[] = POSICOES_DE_DTF): string {
  const nomes = tamanhos.filter((p) => posicoes.includes(p.id)).map((p, i) => (i ? p.nome.toLowerCase() : p.nome))
  if (!nomes.length) return 'Sem posição'
  if (nomes.length === 1) return nomes[0]
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
}

const numOuNulo = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const texto = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Uma tabela guardada antes da 083 (o rascunho que ficou no navegador, de
    antes de os adicionais existirem) volta completa: sem isto a página de
    Tabelas de preço caía ao abrir, lendo "materiais" de nada (19/10/2026). */
export function tabelaCompleta(t: TabelaDePreco): TabelaDePreco {
  return {
    ...t,
    itens: (t.itens ?? []).map((i) => ({ ...i, precos: [...(i.precos ?? [])], sub: i.sub ?? null, silk: i.silk ?? null })),
    adicionais: adicionaisDe(t.adicionais),
  }
}

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
    /* sem a lista guardada (toda tabela de antes de 22/10/2026), os seis de
       partida, que têm os mesmos ids das posições fixas de antes */
    tamanhosDtf: Array.isArray(x.tamanhosDtf) ? lista(x.tamanhosDtf).map(tamanhoDe).filter((p) => p.id) : tamanhosPadrao(),
  }
}

function tamanhoDe(p: Record<string, unknown>): TamanhoDeDtf {
  const n = (v: unknown, reserva: number) => {
    const k = numOuNulo(v)
    return k != null && k > 0 ? k : reserva
  }
  const lado: LadoDaCamisa = p.lado === 'costas' ? 'costas' : 'frente'
  return { id: texto(p.id), nome: texto(p.nome), lado, largura: n(p.largura, 10), altura: n(p.altura, 10), x: n(p.x, 50), y: n(p.y, 45) }
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
