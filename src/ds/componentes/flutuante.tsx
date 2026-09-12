import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'

export type OpcoesFlutuante = {
  /** centrado no campo: o centro é o ponto que não se move quando a largura muda */
  centro?: boolean
  /** escolhe sempre o lado com mais espaço, em vez de "embaixo se couber" */
  maior?: boolean
  alinhar?: 'esquerda' | 'direita'
  /** a largura vem da lista, não do campo. Uma vez por abertura, nunca a cada tecla */
  medirPelaLista?: boolean
  /** largura fixa, quando o menu não se mede pela lista */
  largura?: number
}

/* Posiciona na camada do topo. A altura vem do lado com mais espaço, não do
   "embaixo se couber": o menu mede o vão de cima e o de baixo e escolhe o maior. */
function posicionar(el: HTMLElement, ancora: HTMLElement, o: OpcoesFlutuante) {
  const r = ancora.getBoundingClientRect()
  const vw = innerWidth
  const vh = innerHeight
  const folga = 8
  const respiro = 6
  el.style.maxHeight = 'none'
  const lm = Math.min(el.offsetWidth, vw - folga * 2)
  const am = el.offsetHeight
  const abaixo = vh - r.bottom - folga - respiro
  const acima = r.top - folga - respiro
  const paraCima = o.maior ? acima > abaixo : am > abaixo && acima > abaixo
  const espaco = Math.max(96, Math.min(paraCima ? acima : abaixo, vh - folga * 2))
  const alt = Math.min(am, espaco)
  el.style.maxHeight = alt + 'px'
  let left = o.alinhar === 'direita' ? r.right - lm : r.left
  if (o.centro) left = r.left + r.width / 2 - lm / 2
  left = Math.max(folga, Math.min(left, vw - lm - folga))
  let top = paraCima ? r.top - alt - respiro : r.bottom + respiro
  top = Math.max(folga, Math.min(top, vh - alt - folga))
  el.style.left = Math.round(left) + 'px'
  el.style.top = Math.round(top) + 'px'
  el.dataset.lado = paraCima ? 'cima' : 'baixo'
}

/* A régua: desenha o menu invisível, com todos os grupos abertos e nada
   cortado, mede a largura real e só então deixa ele aparecer. */
function medirPelaLista(el: HTMLElement, piso: number) {
  el.classList.add('medindo')
  el.style.width = ''
  const lista = el.querySelector<HTMLElement>('.mn-lista')
  let guarda: string | null = null
  if (lista) {
    guarda = lista.style.cssText
    lista.style.maxHeight = 'none'
    lista.style.overflow = 'visible'
  }
  /* abre só o que estava fechado, para não apagar o grupo que já nasceu aberto */
  const fechados = [...el.querySelectorAll('.mn-g:not(.aberto)')]
  fechados.forEach((g) => g.classList.add('aberto'))
  const larg = Math.ceil(Math.max(el.scrollWidth, el.getBoundingClientRect().width)) + 2
  fechados.forEach((g) => g.classList.remove('aberto'))
  if (lista) lista.style.cssText = guarda ?? ''
  el.classList.remove('medindo')
  el.style.maxWidth = ''
  const teto = Math.min(innerWidth - 24, 560)
  el.style.width = Math.round(Math.max(piso, Math.min(larg, teto))) + 'px'
}

/* liga a barra de rolagem com sombra quando a lista não coube */
function marcarRolavel(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>('.mn-lista,.mn-grade').forEach((l) =>
    l.classList.toggle('rolavel', l.scrollHeight > l.clientHeight + 1),
  )
}

/* A camada do topo, com `popover`: o navegador desenha fora de qualquer
   overflow e de qualquer empilhamento, então o menu nunca nasce cortado dentro
   de um cartão. Esc fecha sem mudar nada, clique fora fecha. */
export function Flutuante({
  aberto,
  ancora,
  aoFechar,
  opcoes = {},
  className = '',
  /* muda quando o conteúdo muda de tamanho: reposiciona, mas não re-mede */
  versao,
  children,
}: {
  aberto: boolean
  ancora: RefObject<HTMLElement | null>
  aoFechar: () => void
  opcoes?: OpcoesFlutuante
  className?: string
  versao?: unknown
  children: ReactNode
}) {
  const el = useRef<HTMLDivElement>(null)

  const repor = useCallback(() => {
    const d = el.current
    const a = ancora.current
    if (!d || !a || !d.classList.contains('flutua')) return
    posicionar(d, a, opcoes)
    marcarRolavel(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancora, opcoes.centro, opcoes.maior, opcoes.alinhar])

  useLayoutEffect(() => {
    const d = el.current
    const a = ancora.current
    if (!d) return
    if (!aberto) {
      try {
        if (d.matches(':popover-open')) d.hidePopover()
      } catch {
        /* navegador sem popover: a classe já resolve */
      }
      d.classList.remove('flutua')
      d.style.width = ''
      d.style.maxHeight = ''
      return
    }
    if (!a) return
    d.style.visibility = 'hidden'
    d.classList.add('flutua')
    try {
      d.showPopover()
    } catch {
      /* idem */
    }
    if (opcoes.medirPelaLista) medirPelaLista(d, a.getBoundingClientRect().width)
    else if (opcoes.largura) d.style.width = opcoes.largura + 'px'
    posicionar(d, a, opcoes)
    marcarRolavel(d)
    d.style.visibility = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  /* o conteúdo mudou de tamanho: reposiciona sem medir de novo, se não o menu
     muda de largura debaixo do ponteiro enquanto a pessoa digita */
  useLayoutEffect(() => {
    if (aberto) repor()
  }, [versao, aberto, repor])

  useEffect(() => {
    if (!aberto) return
    const naRolagem = () => repor()
    addEventListener('scroll', naRolagem, true)
    addEventListener('resize', naRolagem)
    const naTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        aoFechar()
      }
    }
    const noClique = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (el.current?.contains(alvo)) return
      if (ancora.current?.contains(alvo)) return
      aoFechar()
    }
    document.addEventListener('keydown', naTecla, true)
    /* no capture não, para o clique que abriu não fechar na mesma hora */
    setTimeout(() => document.addEventListener('mousedown', noClique), 0)
    return () => {
      removeEventListener('scroll', naRolagem, true)
      removeEventListener('resize', naRolagem)
      document.removeEventListener('keydown', naTecla, true)
      document.removeEventListener('mousedown', noClique)
    }
  }, [aberto, aoFechar, ancora, repor])

  return (
    <div ref={el} popover="manual" className={['mn', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/* --- a dica de linha: balão preto em pílula, sempre acima ---------------- */
/* Sempre acima porque abaixo ela nasce debaixo do ponteiro e cobre a linha
   seguinte. 140 ms de espera para não piscar quando a pessoa só passa reto. */
let dicaEl: HTMLDivElement | null = null
let dicaT: number | undefined

function garantirDica() {
  if (dicaEl) return dicaEl
  dicaEl = document.createElement('div')
  dicaEl.className = 'mn-dica-linha'
  dicaEl.setAttribute('popover', 'manual')
  document.body.appendChild(dicaEl)
  return dicaEl
}

export function abrirDica(ancora: HTMLElement, html: string, espera = 140) {
  clearTimeout(dicaT)
  dicaT = window.setTimeout(() => {
    const d = garantirDica()
    d.innerHTML = html
    d.classList.add('flutua')
    try {
      d.showPopover()
    } catch {
      /* sem popover, a classe resolve */
    }
    const r = ancora.getBoundingClientRect()
    const folga = 8
    const seta = 7
    const respiro = 3
    const l0 = Math.max(folga, Math.min(r.left + r.width / 2 - d.offsetWidth / 2, innerWidth - d.offsetWidth - folga))
    let top = r.top - d.offsetHeight - seta - respiro
    let lado = 'cima'
    if (top < folga) {
      top = r.bottom + seta + respiro
      lado = 'baixo'
    }
    d.dataset.lado = lado
    d.style.left = Math.round(l0) + 'px'
    d.style.top = Math.round(top) + 'px'
    d.style.setProperty(
      '--seta',
      Math.round(Math.max(14, Math.min(r.left + r.width / 2 - l0, d.offsetWidth - 14))) + 'px',
    )
  }, espera)
}

export function fecharDica() {
  clearTimeout(dicaT)
  if (!dicaEl) return
  dicaEl.classList.remove('flutua')
  try {
    if (dicaEl.matches(':popover-open')) dicaEl.hidePopover()
  } catch {
    /* idem */
  }
}

/* busca sem acento e sem caixa, que é como a fábrica digita */
export function semAcento(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
