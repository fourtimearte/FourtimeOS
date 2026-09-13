import { createContext, useContext } from 'react'
import type { Estado } from './tipos'

export type Sessao = {
  estado: Estado
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

export const ContextoDaSessao = createContext<Sessao | null>(null)

export function useSessao(): Sessao {
  const s = useContext(ContextoDaSessao)
  if (!s) throw new Error('useSessao precisa estar dentro do ProvedorDeSessao')
  return s
}
