import type { Parte } from './contas'

/* ==========================================================================
   O MOLDE MEDIDO: as contas da tela cheia, sem o navegador.

   Quem mede é o navegador (modules/produtos/medir.ts): ele desenha o SVG num
   quadro isolado e devolve a caixa de cada pedaço do desenho, na unidade do
   próprio desenho. Daqui para a frente é conta, e conta se prova sozinha:

     1. o que é uma PARTE do molde, e o que é detalhe dentro de uma parte
     2. o nome de cada parte, tirado do nome da camada no Affinity
     3. a ESCALA: quantos centímetros vale uma unidade do desenho
     4. o zoom e o encaixe na tela

   LARGURA É DE PONTA A PONTA: do ponto mais à esquerda ao mais à direita da
   parte, do jeito que ela está deitada no arquivo. Altura, do mais alto ao
   mais baixo. Não é medida de costura: é a caixa da parte.

   A ESCALA NÃO SE ADIVINHA. O SVG do Affinity costuma sair em pixel, e pixel
   não diz o tamanho de nada: o mesmo molde exportado a 72 e a 300 pontos por
   polegada dá números quatro vezes diferentes. Então a escala vem, nesta
   ordem: de quem acertou à mão (digitou quanto mede de verdade uma parte), ou
   do próprio arquivo quando ele diz o tamanho em milímetro, centímetro ou
   polegada. Sem nenhuma das duas, a tela mostra a medida na unidade do
   desenho e diz que falta acertar a escala. Número em centímetro inventado é
   pior que número nenhum: alguém corta pano por ele.
   ========================================================================== */

/** A caixa de um pedaço do desenho, na unidade do desenho. */
export type CaixaMedida = {
  /** o nome que o arquivo dá ao pedaço (a camada do Affinity), ou vazio */
  id: string
  x: number
  y: number
  w: number
  h: number
  /** o pedaço é um retângulo só: é assim que se reconhece o fundo da prancha */
  retangulo: boolean
}

/** O quadro do desenho: o viewBox. */
export type QuadroDoMolde = { x: number; y: number; w: number; h: number }

/** O que o medidor devolve. */
export type MoldeMedido = {
  quadro: QuadroDoMolde
  /** o width e o height escritos no arquivo, como vieram: "297mm", "100%", "" */
  largura: string
  altura: string
  caixas: CaixaMedida[]
}

/** Uma parte do molde, já com as caixas dela juntas. */
export type ParteNoMolde = {
  chave: string
  nome: string
  /** quantas vezes ela aparece no desenho */
  vezes: number
  /** de ponta a ponta, na unidade do desenho: a maior entre as que têm o mesmo nome */
  largura: number
  altura: number
  caixas: { x: number; y: number; w: number; h: number }[]
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/* nomes que o programa de desenho põe sozinho em quem não tem nome */
const NOME_AUTOMATICO =
  /^(path|g|rect|polygon|polyline|circle|ellipse|line|use|svg|layer|camada|curve|curva|curvas|group|grupo|shape|forma|artboard|prancheta|clip|mask|objeto|object)\s*\d*$/i

/** O nome da camada virando nome de parte: "Manga_2" é "Manga", "FRENTE" é "Frente". */
export function nomeDaParteNoMolde(id: string): string {
  let t = (id ?? '').trim()
  if (!t) return ''
  /* o Affinity escreve o que não cabe num id como _x28_ (o código da letra) */
  t = t.replace(/_x([0-9a-f]{2,4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  t = t.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  /* o número no fim é do programa, que não deixa dois ids iguais: Manga1, Manga 2 */
  t = t.replace(/\s*\d+$/, '').trim()
  if (!t || NOME_AUTOMATICO.test(t)) return ''
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const tudoIgual = letras === letras.toUpperCase() || letras === letras.toLowerCase()
  return tudoIgual ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t
}

const chaveDoNome = (nome: string) => semAcento(nome).toLowerCase().replace(/\s+/g, ' ').trim()

/** As partes do molde, tiradas das caixas medidas. */
export function partesNoMolde(m: MoldeMedido): ParteNoMolde[] {
  const q = m.quadro
  const minimo = Math.max(q.w, q.h) * 0.002
  /* fio solto (linha de dobra, pique) não é parte */
  let caixas = m.caixas.filter(c => c.w > minimo && c.h > minimo)
  /* o fundo da prancha: um retângulo sem nome do tamanho do desenho inteiro */
  caixas = caixas.filter(
    c => !(c.retangulo && !nomeDaParteNoMolde(c.id) && c.w >= q.w * 0.99 && c.h >= q.h * 0.99),
  )
  /* o que está inteiro dentro de outra caixa é detalhe dela: o nome escrito
     na parte, o bolso desenhado na frente, a marca do pique */
  const folga = Math.max(q.w, q.h) * 0.002
  const dentro = (a: CaixaMedida, b: CaixaMedida) =>
    a.x >= b.x - folga &&
    a.y >= b.y - folga &&
    a.x + a.w <= b.x + b.w + folga &&
    a.y + a.h <= b.y + b.h + folga &&
    a.w * a.h < b.w * b.h
  caixas = caixas.filter(c => !caixas.some(o => o !== c && dentro(c, o)))

  const saida: ParteNoMolde[] = []
  let semNome = 0
  for (const c of caixas) {
    const nome = nomeDaParteNoMolde(c.id)
    const caixa = { x: c.x, y: c.y, w: c.w, h: c.h }
    if (!nome) {
      semNome++
      saida.push({
        chave: 'sem-nome-' + semNome,
        nome: 'Parte ' + semNome,
        vezes: 1,
        largura: c.w,
        altura: c.h,
        caixas: [caixa],
      })
      continue
    }
    const chave = chaveDoNome(nome)
    const ja = saida.find(p => p.chave === chave)
    if (ja) {
      ja.vezes++
      ja.largura = Math.max(ja.largura, c.w)
      ja.altura = Math.max(ja.altura, c.h)
      ja.caixas.push(caixa)
    } else {
      saida.push({ chave, nome, vezes: 1, largura: c.w, altura: c.h, caixas: [caixa] })
    }
  }
  return saida
}

/** Quantas vezes a parte é cortada: o que a ficha diz, e sem ficha, quantas vezes ela está no desenho.
    "Manga" no desenho e "Mangas" na ficha são a mesma parte. */
export function vezesDaParte(parte: ParteNoMolde, daFicha: Parte[]): number {
  const semPlural = (t: string) => chaveDoNome(t).replace(/s\b/g, '')
  const alvo = semPlural(parte.nome)
  const achada = daFicha.find(p => p.unidade !== 'm' && semPlural(p.nome) === alvo)
  return achada ? achada.vezes : parte.vezes
}

/* --- a escala ---------------------------------------------------------------- */

const CM_POR_UNIDADE_DE_PAPEL: Record<string, number> = {
  mm: 0.1,
  cm: 1,
  in: 2.54,
  pt: 2.54 / 72,
  pc: 2.54 / 6,
}

/** O tamanho escrito no arquivo, em centímetros. Pixel, porcento e número solto não dizem tamanho. */
function tamanhoEmCm(texto: string): number | null {
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(mm|cm|in|pt|pc)\s*$/i.exec(texto ?? '')
  if (!m) return null
  const n = Number(m[1])
  return n > 0 ? n * CM_POR_UNIDADE_DE_PAPEL[m[2].toLowerCase()] : null
}

/** Quantos centímetros vale uma unidade do desenho, quando o próprio arquivo diz. */
export function escalaDoArquivo(m: MoldeMedido): number | null {
  const largura = tamanhoEmCm(m.largura)
  if (largura !== null && m.quadro.w > 0) return largura / m.quadro.w
  const altura = tamanhoEmCm(m.altura)
  if (altura !== null && m.quadro.h > 0) return altura / m.quadro.h
  return null
}

export type OrigemDaEscala = 'acertada' | 'arquivo' | ''

/** A escala que vale: a acertada à mão ganha da que o arquivo diz. */
export function escalaDoMolde(
  acertada: number | null | undefined,
  m: MoldeMedido,
): { cmPorUnidade: number | null; origem: OrigemDaEscala } {
  if (typeof acertada === 'number' && acertada > 0) return { cmPorUnidade: acertada, origem: 'acertada' }
  const doArquivo = escalaDoArquivo(m)
  return doArquivo ? { cmPorUnidade: doArquivo, origem: 'arquivo' } : { cmPorUnidade: null, origem: '' }
}

/** A escala que sai de uma medida conhecida: esta largura do desenho mede tantos centímetros. */
export function escalaPelaMedida(unidades: number, cm: number): number | null {
  if (!(unidades > 0) || !(cm > 0) || !Number.isFinite(cm)) return null
  return cm / unidades
}

/** A medida como a tela mostra: "55,0" em centímetro; sem escala, o número do desenho. */
export function medidaDoMolde(unidades: number, cmPorUnidade: number | null): string {
  const v = cmPorUnidade ? unidades * cmPorUnidade : unidades
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** A régua do canto: o maior comprimento redondo que cabe em um sexto do desenho. */
export function reguaDoMolde(cmPorUnidade: number | null, larguraDoQuadro: number): { cm: number; unidades: number } | null {
  if (!cmPorUnidade || !(larguraDoQuadro > 0)) return null
  const teto = (larguraDoQuadro * cmPorUnidade) / 6
  const redondos = [100, 50, 20, 10, 5, 2, 1, 0.5]
  const cm = redondos.find(r => r <= teto)
  return cm ? { cm, unidades: cm / cmPorUnidade } : null
}

/* --- a vista: o zoom e o lugar do desenho na tela ---------------------------------
   Um ponto do desenho (ux, uy) cai na tela em  x + ux * z,  y + uy * z. */

export type Vista = { z: number; x: number; y: number }

/** O desenho inteiro dentro do palco, com folga em volta para as cotas. */
export function encaixar(q: QuadroDoMolde, palco: { w: number; h: number }, folga = 64): Vista {
  const util = { w: Math.max(40, palco.w - folga * 2), h: Math.max(40, palco.h - folga * 2) }
  const z = Math.min(util.w / q.w, util.h / q.h)
  return { z, x: (palco.w - q.w * z) / 2 - q.x * z, y: (palco.h - q.h * z) / 2 - q.y * z }
}

export const ZOOM_MINIMO = 0.25
export const ZOOM_MAXIMO = 8

/** Aproxima ou afasta em volta de um ponto da tela, que fica parado. `base` é o zoom do encaixe. */
export function aproximar(v: Vista, fator: number, ponto: { x: number; y: number }, base: number): Vista {
  const z = Math.min(base * ZOOM_MAXIMO, Math.max(base * ZOOM_MINIMO, v.z * fator))
  const f = z / v.z
  return { z, x: ponto.x - (ponto.x - v.x) * f, y: ponto.y - (ponto.y - v.y) * f }
}

/** O zoom em porcento do encaixe: 100 é o desenho inteiro na tela. */
export function zoomEmPorcento(v: Vista, base: number): number {
  return base > 0 ? Math.round((v.z / base) * 100) : 100
}

/** A parte que está debaixo de um ponto do desenho: a menor caixa que o contém. */
export function parteNoPonto(partes: ParteNoMolde[], ux: number, uy: number): string | null {
  let melhor: { chave: string; area: number } | null = null
  for (const p of partes) {
    for (const c of p.caixas) {
      if (ux < c.x || ux > c.x + c.w || uy < c.y || uy > c.y + c.h) continue
      const area = c.w * c.h
      if (!melhor || area < melhor.area) melhor = { chave: p.chave, area }
    }
  }
  return melhor ? melhor.chave : null
}
