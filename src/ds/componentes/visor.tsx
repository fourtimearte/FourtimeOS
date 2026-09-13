import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoDePonteiro } from 'react'

/* ==========================================================================
   O visor de imagem em tela cheia, portado da v3.375.

   Ele existe porque a arte na ficha aparece em meia coluna, e quem confere
   estampa precisa chegar perto: ler o nome do patrocinador, ver se o escudo
   esta vetorizado, achar o pixel serrilhado. Abrir a imagem noutra aba perde
   o lugar na ficha; ampliar dentro da propria pagina resolve.

   Tres gestos, os mesmos de la:

     roda        amplia e reduz ANCORADO NO CURSOR, e nao no centro. Ancorar
                 no centro obriga a arrastar de volta depois de cada giro.
     arrastar    passeia pela imagem.
     clicar fora fecha. E medido, e nao um clique puro: o fundo tambem e a
                 area de arrasto, e terminar um arrasto longo sobre o fundo
                 fecharia o visor no meio do trabalho. Menos de 5 px de
                 caminho e clique; mais que isso foi passeio.

   Esc fecha. A imagem abre no tamanho que couber na tela, nunca maior.
   ========================================================================== */

const MENOR = 0.05
const MAIOR = 12
const PASSO = 1.12

type Vista = { escala: number; x: number; y: number }

export function VisorDeImagem({
  src,
  nome,
  aoFechar,
}: {
  src: string
  /** o nome do arquivo ao baixar, sem extensao */
  nome?: string
  aoFechar: () => void
}) {
  const [v, setV] = useState<Vista>({ escala: 1, x: 0, y: 0 })
  const [arrastando, setArrastando] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  /* o gesto vive numa referencia porque os ouvintes de janela sao registrados
     uma vez, e um estado capturado no fecho deles estaria sempre velho */
  const gesto = useRef<{ mx: number; my: number; x: number; y: number; fora: boolean } | null>(null)
  const vista = useRef(v)
  vista.current = v

  const caber = useCallback(() => {
    const im = img.current
    if (!im || !im.naturalWidth) return
    const s = Math.min(innerWidth / im.naturalWidth, innerHeight / im.naturalHeight)
    setV({
      escala: s,
      x: (innerWidth - im.naturalWidth * s) / 2,
      y: (innerHeight - im.naturalHeight * s) / 2,
    })
  }, [])

  useEffect(() => {
    const im = img.current
    if (im?.complete && im.naturalWidth) caber()
  }, [src, caber])

  useEffect(() => {
    const naTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      aoFechar()
    }
    addEventListener('keydown', naTecla, true)
    addEventListener('resize', caber)
    return () => {
      removeEventListener('keydown', naTecla, true)
      removeEventListener('resize', caber)
    }
  }, [aoFechar, caber])

  /* a roda precisa de ouvinte nao passivo para poder impedir a rolagem da
     pagina atras, e o React registra o onWheel dele como passivo */
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const naRoda = (e: WheelEvent) => {
      e.preventDefault()
      const a = vista.current
      const novo = Math.min(Math.max(a.escala * (e.deltaY < 0 ? PASSO : 1 / PASSO), MENOR), MAIOR)
      const r = novo / a.escala
      setV({
        escala: novo,
        x: e.clientX - (e.clientX - a.x) * r,
        y: e.clientY - (e.clientY - a.y) * r,
      })
    }
    el.addEventListener('wheel', naRoda, { passive: false })
    return () => el.removeEventListener('wheel', naRoda)
  }, [])

  function pegar(e: EventoDePonteiro<HTMLDivElement>) {
    const alvo = e.target
    if (alvo instanceof Element && alvo.closest('.vs-bt')) return
    e.preventDefault()
    gesto.current = {
      mx: e.clientX,
      my: e.clientY,
      x: v.x,
      y: v.y,
      fora: !(alvo instanceof Element && alvo.closest('.vs-img')),
    }
    setArrastando(true)
  }

  useEffect(() => {
    if (!arrastando) return
    const mover = (e: PointerEvent) => {
      const g = gesto.current
      if (!g) return
      setV((a) => ({ ...a, x: g.x + (e.clientX - g.mx), y: g.y + (e.clientY - g.my) }))
    }
    const soltar = (e: PointerEvent) => {
      const g = gesto.current
      gesto.current = null
      setArrastando(false)
      if (!g || !g.fora) return
      const alvo = e.target
      if (alvo instanceof Element && alvo.closest('.vs-bt, .vs-img')) return
      const andou = Math.abs(e.clientX - g.mx) + Math.abs(e.clientY - g.my)
      if (andou > 5) return
      aoFechar()
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', soltar)
    addEventListener('pointercancel', soltar)
    return () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', soltar)
      removeEventListener('pointercancel', soltar)
    }
  }, [arrastando, aoFechar])

  return (
    <div
      ref={caixa}
      className={arrastando ? 'vs arrastando' : 'vs'}
      role="presentation"
      onPointerDown={pegar}
    >
      <img
        ref={img}
        className="vs-img"
        src={src}
        alt={nome || 'arte do layout'}
        draggable={false}
        onLoad={caber}
        style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.escala})` }}
      />

      <div className="vs-tools">
        <button type="button" className="vs-bt" title="Fechar (Esc)" onClick={aoFechar}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <a
          className="vs-bt"
          href={src}
          download={(nome || 'arte') + '.png'}
          title="Baixar a imagem"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 12 5 5 5-5" />
              <path d="M4 21h16" />
            </g>
          </svg>
        </a>
        <button type="button" className="vs-bt" title="Caber na tela" onClick={caber}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5" />
              <path d="M20 9V4h-5" />
              <path d="M4 15v5h5" />
              <path d="M20 15v5h-5" />
            </g>
          </svg>
        </button>
      </div>

      <span className="vs-zoom">{Math.round(v.escala * 100)}%</span>
    </div>
  )
}
