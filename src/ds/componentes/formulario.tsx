import { useId, useLayoutEffect, useRef, useState } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

/* --- campo: o rótulo, o controle e a dica juntos ------------------------- */
export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className = '',
}: {
  rotulo?: ReactNode
  /** texto de apoio embaixo; quando `erro` está ligado ele fica vermelho */
  dica?: ReactNode
  erro?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={['campo', erro ? 'erro' : '', className].filter(Boolean).join(' ')}>
      {rotulo ? <span>{rotulo}</span> : null}
      {children}
      {dica ? <span className="dica">{dica}</span> : null}
    </label>
  )
}

export function Entrada({
  tamanho = 'md',
  className = '',
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { tamanho?: 'sm' | 'md' }) {
  return (
    <input
      className={['entrada', tamanho === 'sm' ? 'sm' : '', className].filter(Boolean).join(' ')}
      {...resto}
    />
  )
}

export function AreaTexto({
  className = '',
  rows = 4,
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['entrada', className].filter(Boolean).join(' ')} rows={rows} {...resto} />
}

/* --- busca --------------------------------------------------------------- */
export function Busca({
  className = '',
  ...resto
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={['busca', className].filter(Boolean).join(' ')}>
      <Lupa />
      <input type="search" {...resto} />
    </div>
  )
}

function Lupa() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/* --- caixa de marcação e escolha ---------------------------------------- */
type PropsMarcacao = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode
  /** meio marcado: quando parte da lista está marcada */
  meio?: boolean
}

export function Marcacao({ children, meio, className = '', ...resto }: PropsMarcacao) {
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = !!meio
  }, [meio])
  return (
    <label className={['ck', className].filter(Boolean).join(' ')}>
      <input ref={ref} type="checkbox" {...resto} />
      <span className="bx">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      </span>
      {children ? <span>{children}</span> : null}
    </label>
  )
}

export function Escolha({
  children,
  className = '',
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children?: ReactNode }) {
  return (
    <label className={['ck', 'rd', className].filter(Boolean).join(' ')}>
      <input type="radio" {...resto} />
      <span className="bx" />
      {children ? <span>{children}</span> : null}
    </label>
  )
}

/* --- interruptor --------------------------------------------------------- */
export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
}: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotulo?: ReactNode
}) {
  const conteudo = (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      className={['tgl', ligado ? 'ligado' : ''].filter(Boolean).join(' ')}
      onClick={() => aoMudar(!ligado)}
    />
  )
  if (!rotulo) return conteudo
  return (
    <span className="ck" style={{ cursor: 'default' }}>
      {conteudo}
      <span>{rotulo}</span>
    </span>
  )
}

/* --- segmentado com indicador deslizante --------------------------------- */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  className = '',
}: {
  opcoes: { valor: T; rotulo: ReactNode }[]
  valor: T
  aoMudar: (v: T) => void
  className?: string
}) {
  const grupo = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const raiz = caixa.current
    if (!raiz) return
    const medir = () => {
      const ativo = raiz.querySelector<HTMLButtonElement>('button.ligado')
      if (!ativo) return
      setInd({ x: ativo.offsetLeft, w: ativo.offsetWidth })
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(raiz)
    return () => obs.disconnect()
  }, [valor, opcoes])

  return (
    <div className={['seg', className].filter(Boolean).join(' ')} ref={caixa} role="tablist">
      {ind ? (
        <span className="ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
      ) : null}
      {opcoes.map((o) => (
        <button
          key={`${grupo}-${o.valor}`}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          className={o.valor === valor ? 'ligado' : ''}
          onClick={() => aoMudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
