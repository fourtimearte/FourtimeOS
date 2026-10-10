/* ==========================================================================
   O HIGHLIGHT DO MOCKUP: a geometria dos destaques (decisão 164).

   O vendedor escolhe partes da arte do layout e cada parte vira um destaque,
   uma miniatura ampliada da mesma imagem. No editor os destaques ficam à
   direita da arte; na folha A4, embaixo dela (ou numa coluna à direita, quando
   a arte é alta: decisão 165). Este arquivo é só a conta, sem tela: o editor e
   a folha leem daqui, e por isso os dois mostram sempre o mesmo recorte.

   Veio do protótipo aprovado em 09/10/2026 (hl/mural.js, FOURTIME OS - 13,
   seção 6). As regras que o Henrique pediu:
   1. cada destaque tem o FORMATO EXATO da região escolhida;
   2. os deitados vêm primeiro, um em cima do outro; os em pé depois, lado a
      lado; uma fileira nunca mistura deitado com em pé (o quase quadrado vai
      com qualquer um);
   3. no editor a arte desliza para a esquerda e os destaques ficam na sobra;
   4. na folha os destaques ficam embaixo da arte.

   O dado guardado é em frações da IMAGEM ORIGINAL, e não da tela: o mesmo
   mural vale no editor, no celular e no papel.
   ========================================================================== */

/** Uma região escolhida, em frações (0 a 1) da largura e da altura da imagem. */
export type Regiao = {
  x: number
  y: number
  w: number
  h: number
  /** o zoom do vendedor por cima: 1 é a região inteira cabendo no destaque */
  z: number
  /** o quanto ele arrastou o miolo, em fração da imagem */
  dx: number
  dy: number
}

/** O mural de uma arte: as regiões, na ordem da numeração, e a trava. */
export type Mural = { regs: Regiao[]; travado: boolean }

/** A imagem original: largura e altura em pixels, e a proporção. */
export type Imagem = { w: number; h: number; a: number }

export type Caixa = { x: number; y: number; w: number; h: number }

export const MAX_DESTAQUES = 8
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4

/** o vão entre os destaques, em fração da largura da caixa */
export const GAP = 0.012

export function muralVazio(): Mural {
  return { regs: [], travado: false }
}

export function imagemDe(w: number, h: number): Imagem {
  return { w, h, a: h > 0 ? w / h : 1 }
}

const entre = (v: unknown, min: number, max: number, padrao: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}

/* O MURAL QUE CHEGA DE FORA É CONFERIDO AQUI.

   Ele vem do corpo da cotação, de um .cft aberto em outro computador ou de
   uma cópia de layout. Número fora da faixa vira o número da beira, região
   sem tamanho sai, e passam no máximo oito: um mural estragado nunca derruba
   a tela, ele só fica menor. */
export function limparMural(bruto: unknown): Mural {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const lista = Array.isArray(b.regs) ? (b.regs as Record<string, unknown>[]) : []
  const regs: Regiao[] = []
  for (const r of lista) {
    if (!r || typeof r !== 'object') continue
    const x = entre(r.x, 0, 1, 0)
    const y = entre(r.y, 0, 1, 0)
    const w = entre(r.w, 0, 1 - x, 0)
    const h = entre(r.h, 0, 1 - y, 0)
    if (w <= 0 || h <= 0) continue
    const reg: Regiao = { x, y, w, h, z: entre(r.z, ZOOM_MIN, ZOOM_MAX, 1), dx: entre(r.dx, -1, 1, 0), dy: entre(r.dy, -1, 1, 0) }
    regs.push(prender(reg))
    if (regs.length >= MAX_DESTAQUES) break
  }
  return { regs, travado: b.travado === true }
}

/** O centro do destaque nunca sai da arte. Devolve a mesma região, presa. */
export function prender(r: Regiao): Regiao {
  r.dx = Math.min(1 - (r.x + r.w / 2), Math.max(-(r.x + r.w / 2), r.dx))
  r.dy = Math.min(1 - (r.y + r.h / 2), Math.max(-(r.y + r.h / 2), r.dy))
  return r
}

/** O formato da região na imagem de verdade: largura sobre altura. */
export const formato = (r: Regiao, im: Imagem): number => (r.w * im.w) / (r.h * im.h)

/** 1 deitado, 0 quase quadrado (0,8 a 1,25), -1 em pé. */
export const tipoDe = (a: number): 1 | 0 | -1 => (a >= 1.25 ? 1 : a <= 0.8 ? -1 : 0)

/* AS FILEIRAS JUSTIFICADAS.

   Numa fileira todos têm a mesma altura, e cada um a largura que o formato
   pede. A conta testa todas as formas de quebrar as fileiras (com oito
   destaques são 128) e fica com a de nota maior: a soma dos lados (a raiz da
   área) de cada destaque, castigada quando sai um gigante ao lado de um
   minúsculo. */
export function empacotar(
  L: number,
  H: number,
  as: number[],
  g: number,
  centro: boolean,
  tipo: number[],
): { caixas: Caixa[]; nota: number } {
  const n = as.length
  const ordem = [1, 0, -1].flatMap((t) => [...as.keys()].filter((i) => tipo[i] === t))
  let melhor: { nota: number; filas: number[][]; hs: number[]; s: number } | null = null
  for (let m = 0; m < 1 << (n - 1); m++) {
    const filas: number[][] = [[ordem[0]]]
    for (let k = 1; k < n; k++) {
      if (m & (1 << (k - 1))) filas.push([])
      filas[filas.length - 1].push(ordem[k])
    }
    if (filas.some((f) => f.some((i) => tipo[i] === 1) && f.some((i) => tipo[i] === -1))) continue
    const hs = filas.map((f) => (L - g * (f.length - 1)) / f.reduce((t, i) => t + as[i], 0))
    const soma = hs.reduce((t, h) => t + h, 0)
    const s = Math.min(1, (H - g * (filas.length - 1)) / soma)
    if (s <= 0) continue
    const lados = filas.flatMap((f, j) => f.map((i) => hs[j] * s * Math.sqrt(as[i])))
    const nota = lados.reduce((t, l) => t + l, 0) * Math.sqrt(Math.min(...lados) / Math.max(...lados))
    if (!melhor || nota > melhor.nota + 0.01) melhor = { nota, filas, hs, s }
  }
  if (!melhor) return { caixas: [], nota: 0 }
  const { nota, filas, hs, s } = melhor
  const usada = hs.reduce((t, h) => t + h * s, 0) + g * (filas.length - 1)
  const caixas: Caixa[] = []
  let y = centro ? (H - usada) / 2 : 0
  filas.forEach((f, j) => {
    const h = hs[j] * s
    const larg = f.reduce((t, i) => t + as[i] * h, 0) + g * (f.length - 1)
    let x = (L - larg) / 2
    for (const i of f) {
      caixas[i] = { x, y, w: as[i] * h, h }
      x += as[i] * h + g
    }
    y += h + g
  })
  return { caixas, nota }
}

/** NO EDITOR: a arte à esquerda, com a altura inteira, e os destaques na sobra da direita. */
export function arranjo(W: number, H: number, im: Imagem, regs: Regiao[]): { arte: Caixa; thumbs: Caixa[] } {
  if (!regs.length) {
    const w = Math.min(W, H * im.a)
    const h = w / im.a
    return { arte: { x: (W - w) / 2, y: (H - h) / 2, w, h }, thumbs: [] }
  }
  const g = GAP * W
  const wArte = Math.min(H * im.a, W * 0.72 - g)
  const hArte = wArte / im.a
  const arte = { x: 0, y: (H - hArte) / 2, w: wArte, h: hArte }
  const as = regs.map((r) => formato(r, im))
  const x0 = wArte + g
  const { caixas } = empacotar(W - x0, H, as, g, true, as.map(tipoDe))
  return { arte, thumbs: caixas.map((c) => ({ ...c, x: c.x + x0 })) }
}

/** A faixa dos destaques, a partir do topo dela: fileiras ou colunas, a de nota maior. */
export function faixaDeDestaques(
  W: number,
  im: Imagem,
  regs: Regiao[],
  faixa: number,
  g = GAP * W * 1.6,
): { thumbs: Caixa[]; H: number } {
  if (!regs.length) return { thumbs: [], H: 0 }
  const as = regs.map((r) => formato(r, im))
  const tipo = as.map(tipoDe)
  const fil = empacotar(W, faixa, as, g, false, tipo)
  const col = empacotar(
    faixa,
    W,
    as.map((a) => 1 / a),
    g,
    true,
    tipo,
  )
  const caixas = fil.nota >= col.nota ? fil.caixas : col.caixas.map((c) => ({ x: c.y, y: c.x, w: c.h, h: c.w }))
  const topo = Math.min(...caixas.map((c) => c.y))
  const usada = Math.max(...caixas.map((c) => c.y + c.h)) - topo
  return { thumbs: caixas.map((c) => ({ ...c, y: c.y - topo })), H: usada }
}

/* A COLUNA À DIREITA, para a arte ALTA na folha (regra dele de 10/10/2026):
   todos com a mesma largura, um embaixo do outro, cada um na altura que o seu
   formato pede. Devolve as caixas dentro de uma coluna de largura W e a
   altura que ela usou; quem chama encolhe a coluna se passar da arte. */
export function colunaDeDestaques(W: number, im: Imagem, regs: Regiao[], g: number): { thumbs: Caixa[]; H: number } {
  const thumbs: Caixa[] = []
  let y = 0
  for (const r of regs) {
    const h = W / formato(r, im)
    thumbs.push({ x: 0, y, w: W, h })
    y += h + g
  }
  return { thumbs, H: Math.max(0, y - g) }
}

/* A FILEIRA SÓ, para a arte LARGA na folha (estilo 14 do template padrão):
   todos com a mesma altura, lado a lado, cada um na largura que o formato
   pede. A altura é a que faz a fileira encher a largura, com teto. */
export function fileiraDeDestaques(
  W: number,
  im: Imagem,
  regs: Regiao[],
  g: number,
  teto: number,
): { thumbs: Caixa[]; H: number } {
  if (!regs.length) return { thumbs: [], H: 0 }
  const as = regs.map((r) => formato(r, im))
  const h = Math.min(teto, (W - g * (regs.length - 1)) / as.reduce((t, a) => t + a, 0))
  const larg = as.reduce((t, a) => t + a * h, 0) + g * (regs.length - 1)
  let x = (W - larg) / 2
  const thumbs = as.map((a) => {
    const c = { x, y: 0, w: a * h, h }
    x += a * h + g
    return c
  })
  return { thumbs, H: h }
}

/* O FUNDO DE UM DESTAQUE: a região escolhida cabe inteira na caixa, com o zoom
   do vendedor por cima, e o resto da arte em volta preenche. Sai pronto para
   o CSS (background-size e background-position). */
export function fundo(reg: Regiao, box: { w: number; h: number }, im: Imagem): { s: number; size: string; pos: string } {
  const rw = reg.w * im.w
  const rh = reg.h * im.h
  const s = Math.min(box.w / rw, box.h / rh) * reg.z
  const cx = (reg.x + reg.w / 2 + reg.dx) * im.w
  const cy = (reg.y + reg.h / 2 + reg.dy) * im.h
  return { s, size: `${im.w * s}px ${im.h * s}px`, pos: `${box.w / 2 - cx * s}px ${box.h / 2 - cy * s}px` }
}
