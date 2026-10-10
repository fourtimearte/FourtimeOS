import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as EventoDeTecla, PointerEvent as EventoDePonteiro } from 'react'
import { ArrowLineUp, CrosshairSimple, Minus, Plus, Trash } from '@phosphor-icons/react'
import {
  arranjo,
  fundo,
  prender,
  MAX_DESTAQUES,
  ZOOM_MAX,
  ZOOM_MIN,
  type Imagem,
  type Mural,
  type Regiao,
} from '@dominio/layout'
import './cotacao.css'

/* ==========================================================================
   O HIGHLIGHT DO MOCKUP NO EDITOR (decisão 164; comportamento e código de
   referência em FOURTIME OS - 13).

   Com o modo de destacar ligado, arrastar em cima da arte desenha uma região,
   e cada região vira um destaque: a mesma imagem, ampliada, com o FORMATO
   EXATO da região. No primeiro destaque a arte desliza para a esquerda e os
   destaques ficam na sobra da direita, em fileiras (os deitados primeiro, um
   em cima do outro; os em pé depois, lado a lado).

   Clicar num destaque (ou na marca dele em cima da arte) escolhe ele: a barra
   de baixo mostra o zoom DELE, Centralizar, Subir e Tirar. Arrastar dentro do
   destaque move a arte nele; a rodinha muda o zoom; com o foco nele, as setas
   movem, + e - mudam o zoom, Delete tira, Esc solta.

   "Travar o mural" esconde as marcas e a barra e não deixa mexer mais. O mural
   mora no bloco do layout (bloco.destaques), em frações da imagem original, e
   vai junto para o .cft e para a folha A4.
   ========================================================================== */

export function MuralDaArte({
  imagem,
  dimensoes,
  mural,
  selecionando,
  aoTerminarDeSelecionar,
  aoMudar,
}: {
  imagem: string
  dimensoes: Imagem
  mural: Mural
  /** o modo de destacar: arrastar em cima da arte desenha a região */
  selecionando: boolean
  aoTerminarDeSelecionar: () => void
  aoMudar: (m: Mural) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [sel, setSel] = useState(-1)
  const [laco, setLaco] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const arrasto = useRef<{ i: number; x: number; y: number; dx: number; dy: number; s: number } | null>(null)
  const travado = mural.travado

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* o destaque escolhido some se ele saiu do mural (tirado, ou outro layout) */
  useEffect(() => {
    if (sel >= mural.regs.length || travado) setSel(-1)
  }, [mural.regs.length, travado, sel])

  const ar = tam.w && tam.h ? arranjo(tam.w, tam.h, dimensoes, mural.regs) : null
  const mudarRegiao = (i: number, troca: (r: Regiao) => Regiao) =>
    aoMudar({ ...mural, regs: mural.regs.map((r, k) => (k === i ? prender(troca({ ...r })) : r)) })

  /* o ponto do ponteiro em frações da arte */
  const naArte = (ev: { clientX: number; clientY: number }) => {
    const el = area.current
    if (!el || !ar) return null
    const b = el.getBoundingClientRect()
    return { x: (ev.clientX - b.left - ar.arte.x) / ar.arte.w, y: (ev.clientY - b.top - ar.arte.y) / ar.arte.h }
  }

  function aoApertar(ev: EventoDePonteiro<HTMLDivElement>) {
    if (travado || ev.button !== 0) return
    const th = (ev.target as HTMLElement).closest<HTMLElement>('[data-th]')
    if (th) {
      const i = Number(th.dataset.th)
      setSel(i)
      if (selecionando) aoTerminarDeSelecionar()
      const r = mural.regs[i]
      const s = fundo(r, { w: th.clientWidth, h: th.clientHeight }, dimensoes).s
      arrasto.current = { i, x: ev.clientX, y: ev.clientY, dx: r.dx, dy: r.dy, s }
      ev.currentTarget.setPointerCapture(ev.pointerId)
      return
    }
    const marca = (ev.target as HTMLElement).closest<HTMLElement>('[data-marca]')
    if (marca && !selecionando) {
      setSel(Number(marca.dataset.marca))
      return
    }
    if (!selecionando) {
      setSel(-1)
      return
    }
    const p = naArte(ev)
    if (!p || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return
    setLaco({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    ev.currentTarget.setPointerCapture(ev.pointerId)
    ev.preventDefault()
  }

  function aoMover(ev: EventoDePonteiro<HTMLDivElement>) {
    const a = arrasto.current
    if (a) {
      const r = mural.regs[a.i]
      if (!r) return
      mudarRegiao(a.i, (x) => ({
        ...x,
        dx: a.dx - (ev.clientX - a.x) / (a.s * dimensoes.w),
        dy: a.dy - (ev.clientY - a.y) / (a.s * dimensoes.h),
      }))
      return
    }
    if (!laco) return
    const p = naArte(ev)
    if (!p) return
    setLaco({ ...laco, x1: Math.min(1, Math.max(0, p.x)), y1: Math.min(1, Math.max(0, p.y)) })
  }

  function aoSoltar() {
    if (arrasto.current) {
      arrasto.current = null
      return
    }
    if (!laco || !ar) return
    const l = laco
    setLaco(null)
    const w = Math.abs(l.x1 - l.x0)
    const h = Math.abs(l.y1 - l.y0)
    /* um clique solto (menos de 10 px) não vira destaque */
    if (w * ar.arte.w < 10 || h * ar.arte.h < 10) return
    if (mural.regs.length >= MAX_DESTAQUES) return
    const nova: Regiao = { x: Math.min(l.x0, l.x1), y: Math.min(l.y0, l.y1), w, h, z: 1, dx: 0, dy: 0 }
    aoMudar({ ...mural, regs: [...mural.regs, nova] })
    setSel(mural.regs.length)
    aoTerminarDeSelecionar()
  }

  function aoRodar(ev: WheelEvent) {
    const th = (ev.target as HTMLElement).closest<HTMLElement>('[data-th]')
    if (!th || travado) return
    const i = Number(th.dataset.th)
    setSel(i)
    mudarRegiao(i, (r) => ({ ...r, z: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, r.z * Math.exp(-ev.deltaY * 0.002))) }))
  }

  function aoTeclar(ev: EventoDeTecla<HTMLDivElement>) {
    const th = (ev.target as HTMLElement).closest<HTMLElement>('[data-th]')
    if (ev.key === 'Escape') {
      setSel(-1)
      if (selecionando) aoTerminarDeSelecionar()
      return
    }
    if (!th || travado) return
    const i = Number(th.dataset.th)
    const passo = 0.01
    const acoes: Record<string, (r: Regiao) => Regiao> = {
      ArrowLeft: (r) => ({ ...r, dx: r.dx - passo }),
      ArrowRight: (r) => ({ ...r, dx: r.dx + passo }),
      ArrowUp: (r) => ({ ...r, dy: r.dy - passo }),
      ArrowDown: (r) => ({ ...r, dy: r.dy + passo }),
      '+': (r) => ({ ...r, z: Math.min(ZOOM_MAX, r.z * 1.1) }),
      '=': (r) => ({ ...r, z: Math.min(ZOOM_MAX, r.z * 1.1) }),
      '-': (r) => ({ ...r, z: Math.max(ZOOM_MIN, r.z / 1.1) }),
    }
    if (ev.key === 'Delete') {
      ev.preventDefault()
      aoMudar({ ...mural, regs: mural.regs.filter((_, k) => k !== i) })
      setSel(-1)
      return
    }
    const acao = acoes[ev.key]
    if (!acao) return
    ev.preventDefault()
    setSel(i)
    mudarRegiao(i, acao)
  }

  /* A RODINHA PRECISA DE OUVINTE PRÓPRIO: o do React é passivo, e aí o zoom do
     destaque viria junto com a página rolando embaixo dele */
  const rodar = useRef(aoRodar)
  rodar.current = aoRodar
  useEffect(() => {
    const el = area.current
    if (!el) return
    const ouvir = (ev: WheelEvent) => {
      if (!(ev.target as HTMLElement).closest('[data-th]') || travado) return
      ev.preventDefault()
      rodar.current(ev)
    }
    el.addEventListener('wheel', ouvir, { passive: false })
    return () => el.removeEventListener('wheel', ouvir)
  }, [travado])

  const r = sel >= 0 ? mural.regs[sel] : undefined
  const ver = !travado

  return (
    <div className="ct-hl">
      <div
        ref={area}
        className={['ct-hl-area', selecionando ? 'ct-hl-sel' : '', travado ? 'ct-hl-travado' : ''].filter(Boolean).join(' ')}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onKeyDown={aoTeclar}
      >
        {ar ? (
          <>
            <img
              className="ct-hl-arte"
              alt=""
              src={imagem}
              draggable={false}
              style={{ left: ar.arte.x, top: ar.arte.y, width: ar.arte.w, height: ar.arte.h }}
            />
            {ver
              ? mural.regs.map((g, i) => (
                  <span
                    key={'m' + i}
                    data-marca={i}
                    title={'Destaque ' + (i + 1)}
                    className={i === sel ? 'ct-hl-marca ct-hl-marca-sel' : 'ct-hl-marca'}
                    style={{ left: ar.arte.x + g.x * ar.arte.w, top: ar.arte.y + g.y * ar.arte.h, width: g.w * ar.arte.w, height: g.h * ar.arte.h }}
                  >
                    <i>{i + 1}</i>
                  </span>
                ))
              : null}
            {ar.thumbs.map((b, i) => {
              const f = fundo(mural.regs[i], b, dimensoes)
              return (
                <div
                  key={'t' + i}
                  data-th={i}
                  role={travado ? undefined : 'button'}
                  tabIndex={travado ? undefined : 0}
                  aria-label={'Destaque ' + (i + 1) + (travado ? '' : ': clique para ajustar')}
                  className={i === sel && ver ? 'ct-hl-th ct-hl-th-sel' : 'ct-hl-th'}
                  onFocus={() => !travado && setSel(i)}
                  style={
                    {
                      left: b.x,
                      top: b.y,
                      width: b.w,
                      height: b.h,
                      backgroundImage: `url("${imagem}")`,
                      backgroundSize: f.size,
                      backgroundPosition: f.pos,
                    } as CSSProperties
                  }
                >
                  {ver ? <span className="ct-hl-n">{i + 1}</span> : null}
                </div>
              )
            })}
            {laco ? (
              <span
                className="ct-hl-laco"
                style={{
                  left: ar.arte.x + Math.min(laco.x0, laco.x1) * ar.arte.w,
                  top: ar.arte.y + Math.min(laco.y0, laco.y1) * ar.arte.h,
                  width: Math.abs(laco.x1 - laco.x0) * ar.arte.w,
                  height: Math.abs(laco.y1 - laco.y0) * ar.arte.h,
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {r && ver ? (
        <div className="ct-hl-barra">
          <b className="ct-hl-qual">Destaque {sel + 1}</b>
          <span className="ct-hl-zoom">
            <button type="button" aria-label="Menos zoom" onClick={() => mudarRegiao(sel, (x) => ({ ...x, z: Math.max(ZOOM_MIN, x.z / 1.1) }))}>
              <Minus size={14} />
            </button>
            <input
              type="range"
              min={ZOOM_MIN * 100}
              max={ZOOM_MAX * 100}
              step={5}
              value={Math.round(r.z * 100)}
              aria-label="Zoom do destaque"
              onChange={(e) => mudarRegiao(sel, (x) => ({ ...x, z: Number(e.target.value) / 100 }))}
            />
            <button type="button" aria-label="Mais zoom" onClick={() => mudarRegiao(sel, (x) => ({ ...x, z: Math.min(ZOOM_MAX, x.z * 1.1) }))}>
              <Plus size={14} />
            </button>
            <output>{Math.round(r.z * 100)}%</output>
          </span>
          <button type="button" className="btn btn-contorno sm" onClick={() => mudarRegiao(sel, (x) => ({ ...x, z: 1, dx: 0, dy: 0 }))}>
            <CrosshairSimple size={15} />
            Centralizar
          </button>
          <button
            type="button"
            className="btn btn-contorno sm"
            disabled={sel === 0}
            onClick={() => {
              const regs = [...mural.regs]
              ;[regs[sel - 1], regs[sel]] = [regs[sel], regs[sel - 1]]
              aoMudar({ ...mural, regs })
              setSel(sel - 1)
            }}
          >
            <ArrowLineUp size={15} />
            Subir
          </button>
          <button
            type="button"
            className="btn btn-contorno sm"
            onClick={() => {
              aoMudar({ ...mural, regs: mural.regs.filter((_, k) => k !== sel) })
              setSel(-1)
            }}
          >
            <Trash size={15} />
            Tirar
          </button>
        </div>
      ) : null}
    </div>
  )
}
