import { nomeDaParteNoMolde, type CaixaMedida, type MoldeMedido, type QuadroDoMolde } from '@dominio/produto'

/* ==========================================================================
   MEDIR O MOLDE: a caixa de cada parte, tirada do próprio SVG.

   O NAVEGADOR É QUEM SABE MEDIR. Um caminho do Affinity é curva, com matriz
   de transformação em cima de matriz; refazer essa conta à mão é reescrever o
   que o navegador já faz certo. Então o desenho é posto num quadro, o
   navegador o desenha, e a medida é lida dali.

   O QUADRO É ISOLADO, E NADA DENTRO DELE RODA. A regra da página continua de
   pé: o SVG nunca é colado dentro dela (ver molde.tsx). Ele vai para um
   iframe com sandbox e SEM allow-scripts, fora da vista. Ali não roda script,
   nem evento, nem nada que o arquivo traga; a página só lê a geometria.

   O QUE É UMA PARTE. O Affinity exporta cada camada como um grupo, às vezes
   dentro de um grupo só que embrulha tudo (a prancheta). A medição desce
   pelos embrulhos sem nome até achar onde o desenho se divide, e cada filho
   dali é um pedaço: o nome dele é o nome da camada. Quem decide o que é parte
   e o que é detalhe (o bolso desenhado dentro da frente, o fundo da prancha)
   são as contas de dominio/produto/molde.ts, que se provam sem navegador.
   ========================================================================== */

const GEOMETRIA = 'path,rect,circle,ellipse,line,polyline,polygon,use'
const FORA_DO_DESENHO = 'defs,clipPath,mask,symbol,pattern,marker,linearGradient,radialGradient,filter'
const DESENHAVEL = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'use', 'svg', 'a'])

type Caixa = { x0: number; y0: number; x1: number; y1: number }

/** O nome que o arquivo dá ao pedaço: a camada do Affinity (serif:id) ou o id. */
function nomeNoArquivo(el: Element): string {
  return el.getAttribute('serif:id') || el.getAttribute('inkscape:label') || el.getAttribute('id') || ''
}

function filhosDesenhaveis(el: Element): SVGGraphicsElement[] {
  return [...el.children].filter(
    (f): f is SVGGraphicsElement => DESENHAVEL.has(f.tagName.toLowerCase()) && typeof (f as SVGGraphicsElement).getBBox === 'function',
  )
}

/** As formas de um pedaço: ele mesmo, ou tudo que está desenhado dentro dele. */
function formasDe(el: SVGGraphicsElement): SVGGraphicsElement[] {
  if (el.matches(GEOMETRIA)) return [el]
  return [...el.querySelectorAll<SVGGraphicsElement>(GEOMETRIA)].filter(f => !f.closest(FORA_DO_DESENHO))
}

/** A caixa de uma forma, no sistema do quadro do desenho. */
function caixaDaForma(forma: SVGGraphicsElement, paraORaiz: (el: SVGGraphicsElement) => DOMMatrix | null): Caixa | null {
  let bb: DOMRect
  try {
    bb = forma.getBBox()
  } catch {
    return null
  }
  if (!(bb.width > 0) && !(bb.height > 0)) return null
  const m = paraORaiz(forma)
  if (!m) return null
  const pontos: { x: number; y: number }[] = []
  const reta = Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9
  const curva = forma as unknown as SVGGeometryElement
  if (!reta && typeof curva.getTotalLength === 'function') {
    /* GIRADA, a caixa da caixa mente para mais. Aí a medida sai de pontos
       tirados ao longo do próprio traço. */
    try {
      const total = curva.getTotalLength()
      const passos = Math.min(2000, Math.max(120, Math.ceil(total / 2)))
      for (let i = 0; i <= passos; i++) {
        const p = curva.getPointAtLength((total * i) / passos)
        pontos.push({ x: p.x, y: p.y })
      }
    } catch {
      /* cai na caixa, abaixo */
    }
  }
  if (!pontos.length) {
    pontos.push(
      { x: bb.x, y: bb.y },
      { x: bb.x + bb.width, y: bb.y },
      { x: bb.x, y: bb.y + bb.height },
      { x: bb.x + bb.width, y: bb.y + bb.height },
    )
  }
  const caixa: Caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const p of pontos) {
    const x = m.a * p.x + m.c * p.y + m.e
    const y = m.b * p.x + m.d * p.y + m.f
    caixa.x0 = Math.min(caixa.x0, x)
    caixa.y0 = Math.min(caixa.y0, y)
    caixa.x1 = Math.max(caixa.x1, x)
    caixa.y1 = Math.max(caixa.y1, y)
  }
  return Number.isFinite(caixa.x0) ? caixa : null
}

function juntar(caixas: Caixa[]): Caixa | null {
  if (!caixas.length) return null
  return caixas.reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  }))
}

/** Mede o molde. Devolve o quadro do desenho, o tamanho que o arquivo diz e a caixa de cada pedaço. */
export function medirMolde(svg: string): MoldeMedido {
  const lido = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const origem = lido.documentElement
  if (!origem || origem.tagName.toLowerCase() !== 'svg' || lido.querySelector('parsererror')) {
    throw new Error('Não consegui ler o desenho deste SVG para medir.')
  }

  const quadroDeFora = document.createElement('iframe')
  /* sandbox sem allow-scripts: o que estiver dentro do arquivo não roda. O
     allow-same-origin é o que deixa esta página ler a geometria lá dentro. */
  quadroDeFora.setAttribute('sandbox', 'allow-same-origin')
  quadroDeFora.setAttribute('aria-hidden', 'true')
  quadroDeFora.tabIndex = -1
  quadroDeFora.className = 'pd-medidor'
  document.body.append(quadroDeFora)
  try {
    const doc = quadroDeFora.contentDocument
    if (!doc || !doc.body) throw new Error('Não consegui abrir o quadro de medir.')
    const raiz = doc.importNode(origem, true) as unknown as SVGSVGElement
    const largura = raiz.getAttribute('width') ?? ''
    const altura = raiz.getAttribute('height') ?? ''
    doc.body.style.margin = '0'
    doc.body.append(raiz)

    /* o quadro: o viewBox, e sem ele o tamanho escrito, e sem ele o que está desenhado */
    const vb = raiz.viewBox?.baseVal
    let quadro: QuadroDoMolde | null = vb && vb.width > 0 && vb.height > 0 ? { x: vb.x, y: vb.y, w: vb.width, h: vb.height } : null
    if (!quadro) {
      const w = parseFloat(largura)
      const h = parseFloat(altura)
      if (w > 0 && h > 0 && !/%/.test(largura + altura)) {
        quadro = { x: 0, y: 0, w, h }
        raiz.setAttribute('viewBox', `0 0 ${w} ${h}`)
      }
    }
    /* um tamanho de verdade para o navegador ter o que desenhar */
    raiz.setAttribute('width', '1000')
    raiz.setAttribute('height', '1000')

    const telaDoRaiz = raiz.getScreenCTM()
    const inversa = telaDoRaiz ? telaDoRaiz.inverse() : null
    const paraORaiz = (el: SVGGraphicsElement): DOMMatrix | null => {
      const tela = el.getScreenCTM()
      return tela && inversa ? inversa.multiply(tela) : null
    }
    const caixaDe = (el: SVGGraphicsElement) =>
      juntar(formasDe(el).map(f => caixaDaForma(f, paraORaiz)).filter((c): c is Caixa => !!c))

    if (!quadro) {
      const tudo = caixaDe(raiz)
      if (!tudo) throw new Error('Este SVG não tem desenho para medir.')
      quadro = { x: tudo.x0, y: tudo.y0, w: tudo.x1 - tudo.x0, h: tudo.y1 - tudo.y0 }
    }
    const q = quadro

    type Pedaco = { el: SVGGraphicsElement; caixa: Caixa; retangulo: boolean }
    const pedacosDe = (no: Element): Pedaco[] =>
      filhosDesenhaveis(no)
        .filter(f => !f.closest(FORA_DO_DESENHO))
        .map(el => {
          const formas = formasDe(el)
          const caixa = juntar(formas.map(f => caixaDaForma(f, paraORaiz)).filter((c): c is Caixa => !!c))
          return caixa ? { el, caixa, retangulo: formas.length === 1 && formas[0].tagName.toLowerCase() === 'rect' } : null
        })
        .filter((p): p is Pedaco => !!p)
    const ehFundo = (p: Pedaco) =>
      p.retangulo &&
      !nomeDaParteNoMolde(nomeNoArquivo(p.el)) &&
      p.caixa.x1 - p.caixa.x0 >= q.w * 0.99 &&
      p.caixa.y1 - p.caixa.y0 >= q.h * 0.99

    /* desce pelos embrulhos sem nome (a prancheta, o grupo que embrulha tudo) */
    let no: Element = raiz
    let pedacos = pedacosDe(no).filter(p => !ehFundo(p))
    for (let fundo = 0; fundo < 12; fundo++) {
      const unico = pedacos.length === 1 ? pedacos[0] : null
      if (!unico || unico.el.tagName.toLowerCase() !== 'g' || nomeDaParteNoMolde(nomeNoArquivo(unico.el))) break
      const dentro = pedacosDe(unico.el).filter(p => !ehFundo(p))
      if (!dentro.length) break
      no = unico.el
      pedacos = dentro
    }

    const caixas: CaixaMedida[] = pedacos.map(p => {
      /* a camada pode estar um degrau para dentro, embrulhada num grupo de matriz */
      let nome = nomeNoArquivo(p.el)
      let olhando: Element = p.el
      for (let i = 0; i < 4 && !nomeDaParteNoMolde(nome); i++) {
        const filhos = filhosDesenhaveis(olhando)
        if (filhos.length !== 1) break
        olhando = filhos[0]
        nome = nomeNoArquivo(olhando) || nome
      }
      return {
        id: nome,
        x: p.caixa.x0,
        y: p.caixa.y0,
        w: p.caixa.x1 - p.caixa.x0,
        h: p.caixa.y1 - p.caixa.y0,
        retangulo: p.retangulo,
      }
    })
    return { quadro: q, largura, altura, caixas }
  } finally {
    quadroDeFora.remove()
  }
}
