/* ==========================================================================
   O QUE O INSPETOR COPIA de um elemento: um texto curto para colar no chat
   que diz ao Claude, sem explicação, onde a coisa está no código e como ela
   está na tela agora.

   O endereço vem da marca de fonte (data-ft, ferramentas/marca-de-fonte.ts):
   o arquivo, a linha e o componente onde o elemento foi escrito, e os dos
   pais até a página. As cores são traduzidas para o token do Design System
   quando batem com um.
   ========================================================================== */

const LIMITE_DE_PAIS = 6

/** Onde o elemento foi escrito (data-ft), e onde ele foi USADO numa tela
    (data-ft-uso, o lugar mais de fora que chegou até ele). */
export function enderecosDe(el: Element): { codigo: string; uso: string; dentro: string[] } {
  const codigo = el.getAttribute('data-ft') ?? ''
  let uso = ''
  const dentro: string[] = []
  for (let e: Element | null = el; e && dentro.length < LIMITE_DE_PAIS; e = e.parentElement) {
    const u = e.getAttribute('data-ft-uso')
    const f = e.getAttribute('data-ft')
    if (u && !uso) uso = u
    else if (u && !dentro.includes(u) && u !== uso) dentro.push(u)
    /* dos pais, só o que é de tela: o miolo do Design System se repete em todo lugar */
    if (e !== el && f && !f.startsWith('ds/') && !dentro.includes(f) && f !== uso) dentro.push(f)
  }
  return { codigo, uso, dentro }
}

function nomeCurto(e: Element): string {
  const classes = [...e.classList].filter((c) => !/^(on|ligado|aberto|sel)$/.test(c)).slice(0, 3)
  return e.tagName.toLowerCase() + (classes.length ? '.' + classes.join('.') : '')
}

/** O caminho de classes, do bloco de fora até o elemento (para achar no CSS). */
export function caminhoDe(el: Element): string {
  const partes: string[] = []
  for (let e: Element | null = el; e && partes.length < 5; e = e.parentElement) {
    if (e === document.body || e.tagName === 'MAIN') break
    let p = nomeCurto(e)
    const pai = e.parentElement
    if (pai) {
      const iguais = [...pai.children].filter((x) => nomeCurto(x) === nomeCurto(e))
      if (iguais.length > 1) p += `:nth-of-type(${[...pai.children].filter((x) => x.tagName === e.tagName).indexOf(e) + 1})`
    }
    partes.unshift(p)
  }
  return partes.join(' > ')
}

function textoDe(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value || el.placeholder || el.getAttribute('aria-label') || ''
  }
  const t = (el instanceof HTMLElement ? el.innerText : el.textContent) ?? ''
  const limpo = t.replace(/\s+/g, ' ').trim()
  return limpo || el.getAttribute('aria-label') || el.getAttribute('title') || ''
}

/* ---------- as cores, traduzidas para os tokens ---------- */

let tokensDeCor: Map<string, string[]> | null = null
let temaDosTokens = ''

/** Lê os nomes --x das folhas do sistema e guarda os que são cor, pelo valor de agora. */
function lerTokens(): Map<string, string[]> {
  const tema = document.documentElement.getAttribute('data-theme') ?? ''
  if (tokensDeCor && tema === temaDosTokens) return tokensDeCor
  const nomes = new Set<string>()
  for (const folha of [...document.styleSheets]) {
    let regras: CSSRuleList
    try {
      regras = folha.cssRules
    } catch {
      continue
    }
    const andar = (lista: CSSRuleList) => {
      for (const r of [...lista]) {
        if (r instanceof CSSStyleRule && /:root|data-theme/.test(r.selectorText)) {
          for (const n of [...r.style]) if (n.startsWith('--')) nomes.add(n)
        } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) {
          andar((r as CSSGroupingRule).cssRules)
        }
      }
    }
    andar(regras)
  }
  const prova = document.createElement('i')
  prova.style.display = 'none'
  document.body.append(prova)
  const mapa = new Map<string, string[]>()
  for (const n of nomes) {
    prova.style.color = ''
    prova.style.color = `var(${n})`
    const v = getComputedStyle(prova).color
    if (!v || v === 'rgba(0, 0, 0, 0)') continue
    const cru = getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    if (!/^(#|rgb|hsl|oklch|color|var)/.test(cru)) continue
    mapa.set(v, [...(mapa.get(v) ?? []), n])
  }
  prova.remove()
  tokensDeCor = mapa
  temaDosTokens = tema
  return mapa
}

function cor(v: string): string {
  if (!v || v === 'rgba(0, 0, 0, 0)') return 'transparente'
  const nomes = lerTokens().get(v)
  return nomes ? `${v} (${nomes.slice(0, 2).map((n) => `var(${n})`).join(' ou ')})` : v
}

function estiloDe(el: Element): string[] {
  const c = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const borda = c.borderTopWidth !== '0px' ? `${c.borderTopWidth} ${c.borderTopStyle} ${cor(c.borderTopColor)}` : 'sem borda'
  return [
    `Medidas: ${Math.round(r.width)} x ${Math.round(r.height)} px, em x ${Math.round(r.left)} y ${Math.round(r.top)}`,
    `Texto: cor ${cor(c.color)} · fonte ${c.fontSize} ${c.fontWeight} ${c.fontFamily.split(',')[0].replace(/"/g, '')}`,
    `Fundo: ${cor(c.backgroundColor)}${c.backgroundImage !== 'none' ? ' com imagem ou degradê' : ''}`,
    `Borda: ${borda} · raio ${c.borderRadius}`,
    `Espaço: recheio ${c.padding} · margem ${c.margin}${c.display.includes('flex') || c.display.includes('grid') ? ` · ${c.display}, vão ${c.gap}` : ''}`,
  ]
}

/** O texto inteiro que vai para a área de transferência. */
export function descrever(el: Element): string {
  const { codigo, uso, dentro } = enderecosDe(el)
  const tag = el.tagName.toLowerCase()
  const classe = el.getAttribute('class')
  const texto = textoDe(el).slice(0, 80)
  const titulo =
    document.querySelector('.pagina-topo h1')?.textContent?.trim() || document.title.replace(/\s*[·|].*$/, '')
  const tema = document.documentElement.getAttribute('data-theme') === 'dark' ? 'escuro' : 'claro'
  const linhas = [
    '[FOURTIME OS · elemento escolhido]',
    `Página: ${titulo} (${location.pathname}${location.search})`,
    `Tela: ${innerWidth} x ${innerHeight} · tema ${tema}`,
    `Elemento: <${tag}${classe ? ` class="${classe}"` : ''}>${texto ? ` "${texto}"` : ''}`,
    `Código: ${codigo ? 'src/' + codigo : '(sem marca de fonte)'}`,
  ]
  if (uso && uso !== codigo) linhas.push(`Usado em: src/${uso}`)
  if (dentro.length) linhas.push(`Dentro de: ${dentro.map((e) => 'src/' + e).join(' < ')}`)
  linhas.push(`Caminho: ${caminhoDe(el)}`, ...estiloDe(el))
  return linhas.join('\n')
}
