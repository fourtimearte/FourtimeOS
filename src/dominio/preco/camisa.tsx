import { useRef } from 'react'
import type { KeyboardEvent as EventoDeTecla, PointerEvent as EventoDePonteiro } from 'react'
import { ESCALA_DA_CAMISA, POSICOES_DE_DTF, caixaDoTamanho, centroQueCabe, medidaDoTamanho, type LadoDaCamisa, type TamanhoDeDtf } from './adicionais'
import './camisa.css'

/* ==========================================================================
   A CAMISA DO DTF (083): o desenho da frente ou das costas com os tamanhos
   de DTF da tabela. O ligado vem cheio na cor do DTF; o desligado,
   tracejado. Com `aoAlternar`, cada tamanho é um botão (o editor de
   combinações); sem ele, o desenho só mostra (a lista e o modal da cotação).

   Desde 22/10/2026 os tamanhos são de cada tabela (`tamanhos`); sem eles,
   valem os seis de partida.
   ========================================================================== */

const CORPO = 'M30 10 L40 6 Q50 13 60 6 L70 10 L91 25 L83 39 L72 32 L72 94 L28 94 L28 32 L17 39 L9 25 Z'

function Corpo({ lado }: { lado: LadoDaCamisa }) {
  return (
    <>
      <path d={CORPO} className="dtf-camisa-corpo" />
      {lado === 'frente' ? <path d="M40 6 Q50 16 60 6" className="dtf-camisa-gola" /> : null}
    </>
  )
}

export function CamisaDoDtf({
  lado,
  ligadas,
  tamanhos = POSICOES_DE_DTF,
  aoAlternar,
  className = '',
}: {
  lado: LadoDaCamisa
  ligadas: string[]
  tamanhos?: TamanhoDeDtf[]
  aoAlternar?: (posicao: string) => void
  className?: string
}) {
  const nome = lado === 'frente' ? 'Frente' : 'Costas'
  const doLado = tamanhos.filter((p) => p.lado === lado)
  return (
    <svg
      viewBox="0 0 100 100"
      className={'dtf-camisa ' + className}
      role={aoAlternar ? 'group' : 'img'}
      aria-label={
        nome +
        ': ' +
        (doLado
          .filter((p) => ligadas.includes(p.id))
          .map((p) => p.nome)
          .join(', ') || 'sem DTF')
      }
    >
      <Corpo lado={lado} />
      {/* o maior embaixo, para o pequeno por cima continuar clicável */}
      {[...doLado]
        .sort((a, b) => b.largura * b.altura - a.largura * a.altura)
        .map((p) => {
          const [x, y, w, h] = caixaDoTamanho(p)
          const on = ligadas.includes(p.id)
          const cls = on ? 'dtf-pos dtf-pos-on' : 'dtf-pos'
          return aoAlternar ? (
            <rect
              key={p.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1.6}
              className={cls + ' dtf-pos-botao'}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={p.nome}
              onClick={() => aoAlternar(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  aoAlternar(p.id)
                }
              }}
            >
              <title>{p.nome + ', ' + medidaDoTamanho(p)}</title>
            </rect>
          ) : (
            <rect key={p.id} x={x} y={y} width={w} height={h} rx={1.6} className={cls} />
          )
        })}
    </svg>
  )
}

/** A frente e as costas lado a lado, pequenas (a lista e o modal). */
export function CamisasDoDtf({ ligadas, tamanhos, className = '' }: { ligadas: string[]; tamanhos?: TamanhoDeDtf[]; className?: string }) {
  return (
    <span className={'dtf-par ' + className}>
      <CamisaDoDtf lado="frente" ligadas={ligadas} tamanhos={tamanhos} />
      <CamisaDoDtf lado="costas" ligadas={ligadas} tamanhos={tamanhos} />
    </span>
  )
}

/* ==========================================================================
   A CAMISA DE EDITAR UM TAMANHO (22/10/2026). Os outros tamanhos do mesmo
   lado aparecem tracejados, para servir de régua, e um clique neles troca o
   escolhido. O escolhido:
     arrastar muda o lugar;
     o quadradinho do canto muda a medida (Shift guarda a proporção);
     as setas andam 1 (Shift + seta anda 5), para quem não usa o mouse;
     a bolinha de girar (ou a tecla R) deita o que está em pé e levanta o
     que está deitado: troca a largura pela altura, no mesmo lugar.
   A medida também se escreve nos campos ao lado: arrastar é atalho, nunca
   o único caminho.
   ========================================================================== */

export type MudancaDoTamanho = Partial<Pick<TamanhoDeDtf, 'x' | 'y' | 'largura' | 'altura'>>

const meio = (v: number) => Math.round(v * 2) / 2

export function CamisaDosTamanhos({
  lado,
  tamanhos,
  escolhido,
  aoEscolher,
  aoMudar,
  className = '',
}: {
  lado: LadoDaCamisa
  tamanhos: TamanhoDeDtf[]
  escolhido: string
  aoEscolher: (id: string) => void
  /** sem ele, o desenho só mostra */
  aoMudar?: (id: string, m: MudancaDoTamanho) => void
  className?: string
}) {
  const svg = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{
    tipo: 'mover' | 'medir'
    px: number
    py: number
    t: TamanhoDeDtf
  } | null>(null)
  const doLado = tamanhos.filter((p) => p.lado === lado)
  const atual = doLado.find((p) => p.id === escolhido)
  const outros = doLado.filter((p) => p.id !== escolhido).sort((a, b) => b.largura * b.altura - a.largura * a.altura)

  function ponto(e: EventoDePonteiro): { x: number; y: number } {
    const s = svg.current
    const m = s?.getScreenCTM()
    if (!s || !m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  function comecar(e: EventoDePonteiro<SVGElement>, tipo: 'mover' | 'medir') {
    if (!atual || !aoMudar) return
    e.preventDefault()
    e.stopPropagation()
    const p = ponto(e)
    arrasto.current = { tipo, px: p.x, py: p.y, t: atual }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function mover(e: EventoDePonteiro<SVGElement>) {
    const a = arrasto.current
    if (!a || !aoMudar) return
    const p = ponto(e)
    if (a.tipo === 'mover') {
      aoMudar(a.t.id, centroQueCabe(a.t, a.t.x + p.x - a.px, a.t.y + p.y - a.py))
      return
    }
    /* medir: o canto de cima, à esquerda, fica parado */
    const [x0, y0] = caixaDoTamanho(a.t)
    let w = Math.max(2, p.x - x0)
    let h = Math.max(2, p.y - y0)
    if (e.shiftKey) {
      const r = a.t.altura / a.t.largura
      if (w * r > h) h = w * r
      else w = h / r
    }
    const largura = Math.max(1, meio(w / ESCALA_DA_CAMISA))
    const altura = Math.max(1, meio(h / ESCALA_DA_CAMISA))
    const W = largura * ESCALA_DA_CAMISA
    const H = altura * ESCALA_DA_CAMISA
    const novo = { ...a.t, largura, altura }
    aoMudar(a.t.id, { largura, altura, ...centroQueCabe(novo, x0 + W / 2, y0 + H / 2) })
  }

  function soltar() {
    arrasto.current = null
  }

  /** girar 90 graus: a largura vira a altura, o centro fica onde está */
  function girar() {
    if (!atual || !aoMudar) return
    const deitado = { ...atual, largura: atual.altura, altura: atual.largura }
    aoMudar(atual.id, { largura: deitado.largura, altura: deitado.altura, ...centroQueCabe(deitado, atual.x, atual.y) })
  }

  function tecla(e: EventoDeTecla<SVGElement>) {
    if (!atual || !aoMudar) return
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      girar()
      return
    }
    const passo = e.shiftKey ? 5 : 1
    const setas: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    }
    const d = setas[e.key]
    if (!d) return
    e.preventDefault()
    aoMudar(atual.id, centroQueCabe(atual, atual.x + d[0], atual.y + d[1]))
  }

  const caixa = atual ? caixaDoTamanho(atual) : null
  return (
    <svg
      ref={svg}
      viewBox="0 0 100 100"
      className={'dtf-camisa dtf-edita ' + className}
      role="group"
      aria-label={(lado === 'frente' ? 'Frente' : 'Costas') + ', os tamanhos'}
    >
      <Corpo lado={lado} />
      {outros.map((p) => {
        const [x, y, w, h] = caixaDoTamanho(p)
        return (
          <rect key={p.id} x={x} y={y} width={w} height={h} rx={1.2} className="dtf-pos dtf-pos-outro" onClick={() => aoEscolher(p.id)}>
            <title>{p.nome + ', ' + medidaDoTamanho(p)}</title>
          </rect>
        )
      })}
      {atual && caixa ? (
        <g>
          <rect
            x={caixa[0]}
            y={caixa[1]}
            width={caixa[2]}
            height={caixa[3]}
            rx={1.2}
            className={'dtf-pos dtf-pos-on' + (aoMudar ? ' dtf-pos-arrasta' : '')}
            tabIndex={aoMudar ? 0 : -1}
            role={aoMudar ? 'slider' : 'img'}
            aria-label={atual.nome + ', ' + medidaDoTamanho(atual) + (aoMudar ? '. Arraste ou use as setas para mudar o lugar; R gira' : '')}
            aria-valuetext={`lugar ${atual.x}, ${atual.y}`}
            onPointerDown={(e) => comecar(e, 'mover')}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onKeyDown={tecla}
          />
          {aoMudar ? (
            <g
              className="dtf-girar"
              role="button"
              tabIndex={0}
              aria-label="Girar o DTF: trocar a largura pela altura"
              transform={`translate(${Math.min(96.5, caixa[0] + caixa[2] + 3)} ${Math.max(3.5, caixa[1] - 3)})`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={girar}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  girar()
                }
              }}
            >
              <circle r={5.5} className="dtf-girar-pega" />
              <circle r={3.4} className="dtf-girar-ve" />
              {/* três quartos de volta, com a ponta da seta na abertura */}
              <path d="M0.9 -1.56 A1.8 1.8 0 1 0 1.56 0.9" className="dtf-girar-seta" />
              <path d="M0.2 -2.4 L1.55 -1.6 L0.35 -0.75 Z" className="dtf-girar-ponta" />
              <title>Girar: trocar a largura pela altura (tecla R)</title>
            </g>
          ) : null}
          {aoMudar ? (
            <g className="dtf-alca" onPointerDown={(e) => comecar(e, 'medir')} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
              {/* a área de pegar é maior que o quadradinho que se vê */}
              <rect x={caixa[0] + caixa[2] - 5} y={caixa[1] + caixa[3] - 5} width={10} height={10} className="dtf-alca-pega" />
              <rect x={caixa[0] + caixa[2] - 1.8} y={caixa[1] + caixa[3] - 1.8} width={3.6} height={3.6} rx={0.6} className="dtf-alca-ve" />
              <title>Arraste para mudar a medida (Shift guarda a proporção)</title>
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  )
}
