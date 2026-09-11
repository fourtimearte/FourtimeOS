import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { sessaoAtual } from './index'

/* Porteiro das rotas. Sem sessao, manda para a tela de entrada e guarda de onde
   a pessoa veio, para devolver ela no lugar certo depois de entrar. */
export function Protegido({ children }: { children: ReactNode }) {
  const local = useLocation()
  if (!sessaoAtual()) {
    return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />
  }
  return <>{children}</>
}
