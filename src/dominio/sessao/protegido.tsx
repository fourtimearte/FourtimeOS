import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSessao } from './contexto'

/* Porteiro das rotas. Sem sessao, manda para a tela de entrada e guarda de onde
   a pessoa veio, para devolver ela no lugar certo depois de entrar. */
export function Protegido({ children }: { children: ReactNode }) {
  const { estado } = useSessao()
  const local = useLocation()

  /* Enquanto o cracha guardado esta sendo conferido, nao decide nada. Mandar
     para a entrada aqui faria a pessoa que ja estava dentro piscar na tela de
     login a cada recarga da pagina. */
  if (estado.fase === 'conferindo') return <Conferindo />

  if (estado.fase === 'fora') {
    return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />
  }
  return <>{children}</>
}

/* Um instante so, entao nao merece tela: o mesmo circulo do botao carregando,
   sozinho no meio do fundo, na cor do tema que ja esta aplicado. */
function Conferindo() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        color: 'var(--text-3)',
      }}
      role="status"
      aria-label="Conferindo o acesso"
    >
      <span className="girando" />
    </div>
  )
}
