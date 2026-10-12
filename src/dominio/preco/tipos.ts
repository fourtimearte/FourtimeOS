/* ==========================================================================
   AS TABELAS DE PREÇO (068; pranchas 134 a 138, aprovadas em 12/10/2026).

   O banco guarda só o que alguém escreveu: a base de cada item (o preço da
   primeira faixa) e o que foi escrito à mão em alguma faixa. Todo o resto é
   CONTA, e mora aqui, num lugar só, para a página, a cotação, a ficha
   técnica e a folha impressa darem o mesmo número:

     faixa seguinte  = a anterior com o passo (menos 10%), arredondada
     kit sem base    = a soma das peças, faixa a faixa, com o desconto do kit
     plus (G1 a G4)  = o preço da faixa mais os reais do plus
     infantil        = o preço da faixa com o desconto do infantil

   Tudo aqui é conta pura, sem rede: o teste roda em node (testes/precos.mjs).
   ========================================================================== */

export type Faixa = { de: number; ate: number | null }

export type Arredondar = '90' | '00' | ''

export type RegrasDaTabela = {
  /** de uma faixa para a seguinte, em por cento (-10 = 10% a menos) */
  passoPct: number
  arredondar: Arredondar
  /** quanto o plus (G1 a G4) custa a mais, em reais */
  plusReais: number
  /** o infantil (2 a 14 anos), em por cento (-10 = 10% a menos) */
  infantilPct: number
  /** o kit sem base própria: a soma das peças, em por cento (-8 = 8% a menos) */
  kitPct: number
}

export type TipoDoItem = 'referencia' | 'kit'

export type ItemDaTabela = {
  codigo: string
  tipo: TipoDoItem
  /** o preço da primeira faixa, escrito por alguém; null = o kit pela soma */
  base: number | null
  /** o escrito à mão em cada faixa; null = a regra */
  precos: (number | null)[]
}

export type SituacaoDaTabela = 'rascunho' | 'ativa' | 'arquivada'

export type TabelaDePreco = {
  id: string
  nome: string
  situacao: SituacaoDaTabela
  padrao: boolean
  /** ISO (2026-12-31) ou vazio */
  valeAte: string
  soGerente: boolean
  faixas: Faixa[]
  regras: RegrasDaTabela
  itens: ItemDaTabela[]
  observacao: string
  teste: boolean
  atualizadoEm: string
}

export const FAIXAS_PADRAO: Faixa[] = [
  { de: 10, ate: 20 },
  { de: 21, ate: 50 },
  { de: 51, ate: 100 },
  { de: 101, ate: null },
]

export const REGRAS_PADRAO: RegrasDaTabela = {
  passoPct: -10,
  arredondar: '90',
  plusReais: 6,
  infantilPct: -10,
  kitPct: -8,
}

export const NOME_DA_SITUACAO: Record<SituacaoDaTabela, string> = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  arquivada: 'Arquivada',
}

export const TAMANHOS_PLUS = ['G1', 'G2', 'G3', 'G4']
export const TAMANHOS_INFANTIS = ['2A', '4A', '6A', '8A', '10A', '12A', '14A']

export function tabelaEmBranco(nome = ''): TabelaDePreco {
  return {
    id: '',
    nome,
    situacao: 'rascunho',
    padrao: false,
    valeAte: '',
    soGerente: false,
    faixas: FAIXAS_PADRAO.map((f) => ({ ...f })),
    regras: { ...REGRAS_PADRAO },
    itens: [],
    observacao: '',
    teste: false,
    atualizadoEm: '',
  }
}

/** "10 a 20", "101 ou mais" */
export function nomeDaFaixa(f: Faixa): string {
  return f.ate == null ? `${f.de} ou mais` : `${f.de} a ${f.ate}`
}

/* --- o arredondamento --------------------------------------------------------
   ",90": o X,90 mais perto (44,91 vira 44,90; 45,30 vira 44,90; 45,50 vira
   45,90). ",00": o real inteiro mais perto. Sem arredondar: o centavo. */
export function arredondar(v: number, modo: Arredondar): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  if (modo === '90') return Math.max(0.9, Math.round((Math.round(v + 0.1) - 0.1) * 100) / 100)
  if (modo === '00') return Math.max(1, Math.round(v))
  return Math.round(v * 100) / 100
}

const centavo = (v: number) => Math.round(v * 100) / 100

/** Qual faixa vale para tantas peças. Abaixo da primeira, a primeira. */
export function faixaDe(faixas: Faixa[], pecas: number): number {
  if (!faixas.length) return 0
  for (let i = faixas.length - 1; i >= 0; i--) if (pecas >= faixas[i].de) return i
  return 0
}

/* --- o preço de um item numa faixa ------------------------------------------
   `achar` dá o item da mesma tabela por código: é por ele que o kit sem base
   soma as peças. `pecasDoKit` dá os códigos das peças de cada kit (da ficha
   técnica). */
export type Contexto = {
  achar: (codigo: string) => ItemDaTabela | undefined
  pecasDoKit: (codigo: string) => string[]
}

export type Celula = {
  valor: number | null
  /** de onde veio: a base escrita, à mão na faixa, a regra, ou a soma do kit */
  origem: 'base' | 'mao' | 'regra' | 'kit' | 'vazio'
}

export function celula(t: TabelaDePreco, item: ItemDaTabela, i: number, ctx: Contexto, visitando: string[] = []): Celula {
  const mao = item.precos[i]
  if (mao != null && Number.isFinite(mao)) return { valor: centavo(mao), origem: 'mao' }
  if (i === 0) {
    if (item.base != null && Number.isFinite(item.base)) return { valor: centavo(item.base), origem: 'base' }
    if (item.tipo === 'kit') {
      const soma = somaDoKit(t, item, 0, ctx, visitando)
      return soma == null ? { valor: null, origem: 'vazio' } : { valor: arredondar(soma * (1 + t.regras.kitPct / 100), t.regras.arredondar), origem: 'kit' }
    }
    return { valor: null, origem: 'vazio' }
  }
  /* o kit sem base segue a soma das peças em cada faixa, e nao o passo */
  if (item.tipo === 'kit' && (item.base == null || !Number.isFinite(item.base))) {
    const soma = somaDoKit(t, item, i, ctx, visitando)
    return soma == null ? { valor: null, origem: 'vazio' } : { valor: arredondar(soma * (1 + t.regras.kitPct / 100), t.regras.arredondar), origem: 'kit' }
  }
  const antes = celula(t, item, i - 1, ctx, visitando).valor
  if (antes == null) return { valor: null, origem: 'vazio' }
  return { valor: arredondar(antes * (1 + t.regras.passoPct / 100), t.regras.arredondar), origem: 'regra' }
}

function somaDoKit(t: TabelaDePreco, kit: ItemDaTabela, i: number, ctx: Contexto, visitando: string[]): number | null {
  if (visitando.includes(kit.codigo)) return null
  const pecas = ctx.pecasDoKit(kit.codigo)
  if (!pecas.length) return null
  let soma = 0
  for (const cod of pecas) {
    const it = ctx.achar(cod)
    if (!it) return null
    const v = celula(t, it, i, ctx, [...visitando, kit.codigo]).valor
    if (v == null) return null
    soma += v
  }
  return soma
}

/** O preço de um item para um tamanho: plus e infantil por cima da faixa. */
export function precoDoTamanho(t: TabelaDePreco, valorDaFaixa: number, tamanho: string): number {
  if (TAMANHOS_PLUS.includes(tamanho)) return centavo(valorDaFaixa + t.regras.plusReais)
  if (TAMANHOS_INFANTIS.includes(tamanho))
    return arredondar(valorDaFaixa * (1 + t.regras.infantilPct / 100), t.regras.arredondar)
  return valorDaFaixa
}

/* --- mudar em lote ------------------------------------------------------------
   Os itens marcados mudam a base (e o que estava escrito à mão) em tantos por
   cento, arredondados. "Voltar para a regra" apaga o escrito à mão nas faixas. */
export function ajustarEmLote(t: TabelaDePreco, codigos: string[], pct: number, modo: Arredondar): TabelaDePreco {
  const f = (v: number | null) => (v == null ? null : arredondar(v * (1 + pct / 100), modo))
  return {
    ...t,
    itens: t.itens.map((it) =>
      codigos.includes(it.codigo) ? { ...it, base: f(it.base), precos: it.precos.map(f) } : it,
    ),
  }
}

export function voltarParaARegra(t: TabelaDePreco, codigos: string[]): TabelaDePreco {
  return {
    ...t,
    itens: t.itens.map((it) => (codigos.includes(it.codigo) ? { ...it, precos: it.precos.map(() => null) } : it)),
  }
}

/** Escreve numa célula: a primeira faixa é a base; as outras ficam "à mão". */
export function escrever(t: TabelaDePreco, codigo: string, i: number, valor: number | null): TabelaDePreco {
  return {
    ...t,
    itens: t.itens.map((it) => {
      if (it.codigo !== codigo) return it
      if (i === 0) return { ...it, base: valor }
      const precos = t.faixas.map((_, k) => it.precos[k] ?? null)
      precos[i] = valor
      return { ...it, precos }
    }),
  }
}

/* --- a tabela nova -------------------------------------------------------------
   Copiar de outra tabela leva os itens, as faixas e as regras, com o ajuste
   em por cento na base e no escrito à mão. */
export function copiarDe(origem: TabelaDePreco, nome: string, pct: number, modo: Arredondar): TabelaDePreco {
  const ajustada = ajustarEmLote(origem, origem.itens.map((i) => i.codigo), pct, modo)
  return {
    ...tabelaEmBranco(nome),
    faixas: origem.faixas.map((f) => ({ ...f })),
    regras: { ...origem.regras, arredondar: modo },
    itens: ajustada.itens.map((i) => ({ ...i, precos: [...i.precos] })),
  }
}

/* --- o que vale na cotação -------------------------------------------------------
   As tabelas que aparecem para escolher: as ativas; a "só gerente" só para
   admin e gerente. A padrão primeiro. */
export function tabelasParaEscolher(todas: TabelaDePreco[], souGerente: boolean): TabelaDePreco[] {
  return todas
    .filter((t) => t.situacao === 'ativa' && (!t.soGerente || souGerente))
    .sort((a, b) => Number(b.padrao) - Number(a.padrao) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/* --- as faixas, escritas pelo fim (prancha 141, 12/10/2026) ---------------------
   Quem monta as faixas escreve o começo da primeira e onde cada uma ACABA; a
   seguinte começa no número depois, sem buraco e sem peça sobrando, e a
   última é sempre "ou mais". */
export const MAXIMO_DE_FAIXAS = 8

export const MODELOS_DE_FAIXAS: { nome: string; faixas: Faixa[] }[] = [
  { nome: 'Do chat da loja', faixas: FAIXAS_PADRAO },
  {
    nome: '1 a 30, 31 a 100, 101 ou mais',
    faixas: [
      { de: 1, ate: 30 },
      { de: 31, ate: 100 },
      { de: 101, ate: null },
    ],
  },
  { nome: 'Uma faixa só', faixas: [{ de: 1, ate: null }] },
]

/** Monta as faixas pelo começo da primeira e pelo fim de cada uma (a última sem fim). */
export function faixasDosFins(primeira: number, fins: number[]): Faixa[] {
  const out: Faixa[] = []
  let de = Math.max(1, Math.round(primeira))
  for (const fim of fins) {
    out.push({ de, ate: Math.round(fim) })
    de = Math.round(fim) + 1
  }
  out.push({ de, ate: null })
  return out
}

/** O que está errado nas faixas, numa frase; vazio quando estão certas. */
export function conferirFaixas(faixas: Faixa[]): string {
  if (!faixas.length) return 'A tabela precisa de pelo menos uma faixa.'
  if (faixas.length > MAXIMO_DE_FAIXAS) return `No máximo ${MAXIMO_DE_FAIXAS} faixas.`
  if (faixas[0].de < 1) return 'A primeira faixa começa em 1 peça ou mais.'
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i]
    const ultima = i === faixas.length - 1
    if (ultima ? f.ate != null : f.ate == null) return 'Só a última faixa é "ou mais".'
    if (f.ate != null && f.ate < f.de) return `A faixa ${i + 1} acaba antes de começar (${f.de} a ${f.ate}).`
    if (i > 0 && f.de !== (faixas[i - 1].ate ?? 0) + 1) return `A faixa ${i + 1} tem de começar logo depois da anterior.`
  }
  return ''
}

/* Trocar as faixas de uma tabela que já tem preço: a base fica; o escrito à
   mão só fica na faixa que continua igual (mesmo começo e mesmo fim). */
export function trocarFaixas(t: TabelaDePreco, novas: Faixa[]): TabelaDePreco {
  const igual = (a: Faixa, b: Faixa) => a.de === b.de && a.ate === b.ate
  return {
    ...t,
    faixas: novas.map((f) => ({ ...f })),
    itens: t.itens.map((it) => ({
      ...it,
      precos: novas.map((f) => {
        const j = t.faixas.findIndex((v) => igual(v, f))
        return j >= 0 ? (it.precos[j] ?? null) : null
      }),
    })),
  }
}

/* --- pôr, tirar e preencher muitas de uma vez (pranchas 140 e 142) ---------------- */
export type EntradaDoCatalogo = { codigo: string; tipo: TipoDoItem }

/** Põe na tabela o que ainda não está, com a base (ou sem). Não mexe no que já está. */
export function porNaTabela(t: TabelaDePreco, entradas: EntradaDoCatalogo[], base: number | null = null): TabelaDePreco {
  const tem = new Set(t.itens.map((i) => i.codigo))
  const novos = entradas
    .filter((e) => !tem.has(e.codigo))
    .filter((e, i, a) => a.findIndex((x) => x.codigo === e.codigo) === i)
    .map((e) => ({ codigo: e.codigo, tipo: e.tipo, base, precos: t.faixas.map(() => null) }))
  return novos.length ? { ...t, itens: [...t.itens, ...novos] } : t
}

export function tirarDaTabela(t: TabelaDePreco, codigos: string[]): TabelaDePreco {
  return { ...t, itens: t.itens.filter((i) => !codigos.includes(i.codigo)) }
}

/** O mesmo preço base para várias; quem ainda não está na tabela entra. */
export function escreverBase(t: TabelaDePreco, entradas: EntradaDoCatalogo[], valor: number): TabelaDePreco {
  const com = porNaTabela(t, entradas)
  const cods = new Set(entradas.map((e) => e.codigo))
  return { ...com, itens: com.itens.map((i) => (cods.has(i.codigo) ? { ...i, base: valor } : i)) }
}

/* Copia de outra tabela a base e o escrito à mão das peças pedidas, com o
   ajuste em por cento. O escrito à mão só vem quando as faixas são as mesmas;
   peça que a outra tabela não tem não muda. */
export function copiarPrecosDe(
  t: TabelaDePreco,
  origem: TabelaDePreco,
  codigos: string[],
  pct: number,
  modo: Arredondar,
): TabelaDePreco {
  const mesmas = JSON.stringify(t.faixas) === JSON.stringify(origem.faixas)
  const f = (v: number | null) => (v == null ? null : arredondar(v * (1 + pct / 100), modo))
  const daOrigem = new Map(origem.itens.filter((i) => codigos.includes(i.codigo)).map((i) => [i.codigo, i]))
  const com = porNaTabela(t, [...daOrigem.values()].map((i) => ({ codigo: i.codigo, tipo: i.tipo })))
  return {
    ...com,
    itens: com.itens.map((i) => {
      const o = daOrigem.get(i.codigo)
      if (!o) return i
      return { ...i, base: f(o.base), precos: mesmas ? o.precos.map(f) : t.faixas.map(() => null) }
    }),
  }
}

/** "R$ 1.234,56", "49,9", "49.90" viram número; vazio vira null; o resto, NaN. */
export function numeroDoTexto(texto: string): number | null {
  const s = texto.replace(/[^\d,.-]/g, '')
  if (!s) return null
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Number(limpo)
}

/* COLAR DA PLANILHA: a coluna (ou o bloco) copiado começa na célula onde se
   colou e desce pelas linhas à vista, na ordem da tela; colunas a mais vão
   para as faixas do lado. Quem não estava na tabela entra. */
export function colarNaTabela(
  t: TabelaDePreco,
  linhas: EntradaDoCatalogo[],
  linha: number,
  faixa: number,
  texto: string,
): { tabela: TabelaDePreco; coladas: number } {
  const matriz = texto
    .replace(/\r/g, '')
    .split('\n')
    .filter((l, i, a) => l.trim() !== '' || i < a.length - 1)
    .map((l) => l.split('\t').map(numeroDoTexto))
  let out = t
  let coladas = 0
  matriz.forEach((cols, dr) => {
    const alvo = linhas[linha + dr]
    if (!alvo) return
    cols.forEach((v, dc) => {
      const k = faixa + dc
      if (k >= t.faixas.length || (v != null && (!Number.isFinite(v) || v < 0))) return
      out = escrever(porNaTabela(out, [alvo]), alvo.codigo, k, v)
      coladas++
    })
  })
  return { tabela: out, coladas }
}

/* COPIAR OS PREÇOS DE UMA PEÇA E COLAR EM OUTRAS (pedido de 12/10/2026, no modo
   tabela): a base e o escrito à mão de cada faixa vão iguais; quem não estava
   na tabela entra. */
export function colarPrecosDaPeca(t: TabelaDePreco, origem: string, destinos: EntradaDoCatalogo[]): TabelaDePreco {
  const o = t.itens.find((i) => i.codigo === origem)
  if (!o) return t
  const alvos = destinos.filter((d) => d.codigo !== origem)
  const com = porNaTabela(t, alvos)
  const cods = new Set(alvos.map((d) => d.codigo))
  return {
    ...com,
    itens: com.itens.map((i) => (cods.has(i.codigo) ? { ...i, base: o.base, precos: t.faixas.map((_, k) => o.precos[k] ?? null) } : i)),
  }
}

/* A ALÇA (como a grade do editor da cotação): o valor de uma célula repete
   nas vizinhas, para baixo (outras peças, mesma faixa) ou para o lado (a
   mesma peça, outras faixas). A primeira faixa é a base; as outras ficam à
   mão. */
export function preencherCelulas(
  t: TabelaDePreco,
  alvos: { codigo: string; tipo: TipoDoItem; faixa: number }[],
  valor: number | null,
): TabelaDePreco {
  let out = t
  for (const a of alvos) out = escrever(porNaTabela(out, [{ codigo: a.codigo, tipo: a.tipo }]), a.codigo, a.faixa, valor)
  return out
}
