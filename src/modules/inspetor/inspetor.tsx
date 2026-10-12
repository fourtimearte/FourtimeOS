import { useEffect, useRef, useState } from 'react'
import { avisar } from '@ds'
import { descrever, enderecosDe } from './descrever'
import './inspetor.css'

/* ==========================================================================
   O INSPETOR (temporário; pedido do Henrique em 12/10/2026, sai quando o
   sistema ficar pronto). Ctrl+Shift+X liga em qualquer página: o elemento
   debaixo do mouse ganha a moldura e o endereço; o clique copia para a área
   de transferência um texto que diz onde ele está no código (a marca de
   fonte), em que página, e como está a cor, a fonte e o espaço agora. É só
   colar no chat e dizer o que mudar.

   Seta para cima sobe para o pai, seta para baixo volta, Enter copia o
   escolhido, Esc sai. Enquanto ligado, nenhum clique chega na página: não
   abre menu, não salva, não navega.

   A camada é um popover manual: fica na camada de cima do navegador, por
   cima até do modal aberto, e não recebe o mouse (pointer-events: none).
   ========================================================================== */

type Moldura = { x: number; y: number; w: number; h: number; rotulo: string; acima: boolean }

function molduraDe(el: Element): Moldura {
  const r = el.getBoundingClientRect()
  const { codigo, uso } = enderecosDe(el)
  const ft = uso && !uso.startsWith('ds/') ? uso : codigo || uso
  const classe = [...el.classList].slice(0, 2).join('.')
  const rotulo = `${el.tagName.toLowerCase()}${classe ? '.' + classe : ''}${ft ? '  ·  ' + ft : ''}`
  return { x: r.left, y: r.top, w: r.width, h: r.height, rotulo, acima: r.top > 30 }
}

export function Inspetor({ ligavel }: { ligavel: boolean }) {
  const [ligado, setLigado] = useState(false)
  const [moldura, setMoldura] = useState<Moldura | null>(null)
  const camada = useRef<HTMLDivElement>(null)
  const atual = useRef<Element | null>(null)
  const descidas = useRef<Element[]>([])

  /* o atalho */
  useEffect(() => {
    if (!ligavel) return
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        setLigado((l) => !l)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ligavel])

  useEffect(() => {
    if (!ligado) return
    const c = camada.current
    try {
      c?.showPopover()
    } catch {
      /* navegador sem popover: a camada fica com o z-index alto */
    }
    const escolher = (el: Element | null) => {
      if (!el || el === c || c?.contains(el)) return
      atual.current = el
      setMoldura(molduraDe(el))
    }
    const mover = (e: PointerEvent) => {
      descidas.current = []
      escolher(document.elementFromPoint(e.clientX, e.clientY))
    }
    const engolir = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    const copiar = (el: Element | null) => {
      if (!el) return
      const texto = descrever(el)
      const pronto = () => {
        avisar('Elemento copiado. É só colar no chat.', 'ok')
        setLigado(false)
      }
      navigator.clipboard?.writeText(texto).then(pronto, () => {
        /* sem permissão da área de transferência: o jeito antigo */
        const t = document.createElement('textarea')
        t.value = texto
        document.body.append(t)
        t.select()
        document.execCommand('copy')
        t.remove()
        pronto()
      })
    }
    const clique = (e: MouseEvent) => {
      engolir(e)
      copiar(atual.current ?? document.elementFromPoint(e.clientX, e.clientY))
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') return
      if (e.key === 'Escape') {
        engolir(e)
        setLigado(false)
      } else if (e.key === 'ArrowUp' && atual.current?.parentElement && atual.current.parentElement !== document.body) {
        engolir(e)
        descidas.current.push(atual.current)
        escolher(atual.current.parentElement)
      } else if (e.key === 'ArrowDown') {
        engolir(e)
        escolher(descidas.current.pop() ?? atual.current)
      } else if (e.key === 'Enter') {
        engolir(e)
        copiar(atual.current)
      }
    }
    const rolar = () => atual.current && setMoldura(molduraDe(atual.current))
    window.addEventListener('pointermove', mover, true)
    window.addEventListener('click', clique, true)
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'auxclick'])
      window.addEventListener(t, engolir, true)
    window.addEventListener('keydown', tecla, true)
    window.addEventListener('scroll', rolar, true)
    document.documentElement.classList.add('inspetor-ligado')
    return () => {
      window.removeEventListener('pointermove', mover, true)
      window.removeEventListener('click', clique, true)
      for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'auxclick'])
        window.removeEventListener(t, engolir, true)
      window.removeEventListener('keydown', tecla, true)
      window.removeEventListener('scroll', rolar, true)
      document.documentElement.classList.remove('inspetor-ligado')
      try {
        c?.hidePopover()
      } catch {
        /* já estava escondida */
      }
      atual.current = null
      descidas.current = []
      setMoldura(null)
    }
  }, [ligado])

  if (!ligavel || !ligado) return null
  return (
    <div ref={camada} popover="manual" className="insp" aria-hidden="true">
      <div className="insp-faixa">
        <b>Inspetor</b>
        <span>clique no elemento para copiar · ↑ pai · ↓ volta · Enter copia · Esc sai</span>
      </div>
      {moldura ? (
        <>
          <div
            className="insp-moldura"
            style={{ left: moldura.x, top: moldura.y, width: moldura.w, height: moldura.h }}
          />
          <div
            className={moldura.acima ? 'insp-rotulo' : 'insp-rotulo insp-rotulo-baixo'}
            style={{ left: Math.max(4, moldura.x), top: moldura.acima ? moldura.y : moldura.y + moldura.h }}
          >
            {moldura.rotulo}
          </div>
        </>
      ) : null}
    </div>
  )
}
