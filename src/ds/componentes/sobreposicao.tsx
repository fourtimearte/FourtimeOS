import { useEffect, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'

type Props = {
  aberto: boolean
  aoFechar: () => void
  titulo?: ReactNode
  children: ReactNode
  pe?: ReactNode
  /** largo: para o que precisa de duas colunas, como a ficha do cliente */
  largo?: boolean
}

/* O <dialog> nativo é usado de propósito: ele desenha na camada do topo do
   navegador, acima de qualquer overflow e de qualquer z-index, e já entrega
   foco preso dentro, Esc para sair e o fundo inerte. O que a gente não usa é a
   aparência dele: tudo abaixo é desenho nosso, igual ao resto do V7. */
function usarDialogo(aberto: boolean, aoFechar: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const fechou = () => aoFechar()
    d.addEventListener('close', fechou)
    return () => d.removeEventListener('close', fechou)
  }, [aoFechar])
  return ref
}

/* clicar no escuro fecha, clicar dentro da caixa não */
function cliqueNoEscuro(e: MouseEvent<HTMLDialogElement>, aoFechar: () => void) {
  if (e.target === e.currentTarget) aoFechar()
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  pe,
  largo,
  gigante,
  solto,
  topo,
}: Props & {
  /** o tamanho do cartão do kanban: duas colunas de conteúdo lado a lado */
  gigante?: boolean
  /** sem recheio e sem rolagem no corpo, para a tela que rola por dentro */
  solto?: boolean
  /** um cabeçalho próprio no lugar do título simples */
  topo?: ReactNode
}) {
  const ref = usarDialogo(aberto, aoFechar)
  return (
    <dialog
      ref={ref}
      className={['sobrepoe', 'modal', gigante ? 'gigante' : largo ? 'largo' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => cliqueNoEscuro(e, aoFechar)}
    >
      <div className="caixa">
        {topo ? (
          <header className="sobre-topo">
            {topo}
            <BotaoFechar aoFechar={aoFechar} />
          </header>
        ) : titulo ? (
          <header className="sobre-topo">
            <h2 className="t">{titulo}</h2>
            <BotaoFechar aoFechar={aoFechar} />
          </header>
        ) : null}
        <div className={solto ? 'sobre-corpo solto' : 'sobre-corpo'}>{children}</div>
        {pe ? <footer className="sobre-pe">{pe}</footer> : null}
      </div>
    </dialog>
  )
}

/* Folha lateral. Entra pela direita no computador e por baixo no celular,
   que é onde o polegar alcança. */
export function Gaveta({ aberto, aoFechar, titulo, children, pe }: Props) {
  const ref = usarDialogo(aberto, aoFechar)
  return (
    <dialog ref={ref} className="sobrepoe gaveta" onClick={(e) => cliqueNoEscuro(e, aoFechar)}>
      <div className="caixa">
        {titulo ? (
          <header className="sobre-topo">
            <h2 className="t">{titulo}</h2>
            <BotaoFechar aoFechar={aoFechar} />
          </header>
        ) : null}
        <div className="sobre-corpo">{children}</div>
        {pe ? <footer className="sobre-pe">{pe}</footer> : null}
      </div>
    </dialog>
  )
}

function BotaoFechar({ aoFechar }: { aoFechar: () => void }) {
  return (
    <button type="button" className="btn btn-limpo icone sm" aria-label="Fechar" onClick={aoFechar}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </button>
  )
}
