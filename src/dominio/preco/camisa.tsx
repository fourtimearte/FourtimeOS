import { POSICOES_DE_DTF, type LadoDaCamisa } from './adicionais'
import './camisa.css'

/* ==========================================================================
   A CAMISA DO DTF (083): o desenho da frente ou das costas com as posições.
   A posição ligada vem cheia na cor do DTF; a desligada, tracejada. Com
   `aoAlternar`, cada posição é um botão (o editor de combinações); sem ele,
   o desenho só mostra (a lista e o modal da cotação).
   ========================================================================== */

const CORPO = 'M30 10 L40 6 Q50 13 60 6 L70 10 L91 25 L83 39 L72 32 L72 94 L28 94 L28 32 L17 39 L9 25 Z'

export function CamisaDoDtf({
  lado,
  ligadas,
  aoAlternar,
  className = '',
}: {
  lado: LadoDaCamisa
  ligadas: string[]
  aoAlternar?: (posicao: string) => void
  className?: string
}) {
  const nome = lado === 'frente' ? 'Frente' : 'Costas'
  return (
    <svg
      viewBox="0 0 100 100"
      className={'dtf-camisa ' + className}
      role={aoAlternar ? 'group' : 'img'}
      aria-label={nome + ': ' + (POSICOES_DE_DTF.filter((p) => p.lado === lado && ligadas.includes(p.id)).map((p) => p.nome).join(', ') || 'sem DTF')}
    >
      <path d={CORPO} className="dtf-camisa-corpo" />
      {lado === 'frente' ? <path d="M40 6 Q50 16 60 6" className="dtf-camisa-gola" /> : null}
      {POSICOES_DE_DTF.filter((p) => p.lado === lado).map((p) => {
        const [x, y, w, h] = p.caixa
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
            <title>{p.nome + ', ' + p.medida}</title>
          </rect>
        ) : (
          <rect key={p.id} x={x} y={y} width={w} height={h} rx={1.6} className={cls} />
        )
      })}
    </svg>
  )
}

/** A frente e as costas lado a lado, pequenas (a lista e o modal). */
export function CamisasDoDtf({ ligadas, className = '' }: { ligadas: string[]; className?: string }) {
  return (
    <span className={'dtf-par ' + className}>
      <CamisaDoDtf lado="frente" ligadas={ligadas} />
      <CamisaDoDtf lado="costas" ligadas={ligadas} />
    </span>
  )
}
