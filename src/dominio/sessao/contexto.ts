import { createContext, useContext } from 'react'
import type { Estado } from './tipos'

export type Sessao = {
  estado: Estado
  entrar: (email: string, senha: string) => Promise<void>
  criarConta: (nome: string, email: string, senha: string) => Promise<void>
  mudarMeuNome: (nome: string) => Promise<void>
  trocarMinhaFoto: (arquivo: Blob) => Promise<void>
  tirarMinhaFoto: () => Promise<void>
  /** pergunta de novo ao banco quem eu sou: usada depois que o admin aprova */
  reconferir: () => Promise<void>
  sair: () => Promise<void>
}

export const ContextoDaSessao = createContext<Sessao | null>(null)

export function useSessao(): Sessao {
  const s = useContext(ContextoDaSessao)
  if (!s) throw new Error('useSessao precisa estar dentro do ProvedorDeSessao')
  return s
}
