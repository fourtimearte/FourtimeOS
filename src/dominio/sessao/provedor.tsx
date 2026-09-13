import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  crachaValido,
  entrarComEmail,
  sairDoSupabase,
  SUPABASE_LIGADO,
  tabela,
} from '@shared/supabase'
import { ContextoDaSessao } from './contexto'
import type { Sessao } from './contexto'
import type { Estado, Papel, Pessoa } from './tipos'

/* A sessao de verdade, com o Supabase por tras.

   Antes daqui existia uma cortina: usuario e senha escritos no codigo, que
   qualquer pessoa lia abrindo a pagina. Agora a senha nunca chega ao navegador
   e cada pessoa tem o seu papel, que e o que a tabela pessoa guarda. */

type LinhaDePessoa = {
  id: string
  nome: string
  papel: Papel
  ativo: boolean
}

const SEM_CADASTRO =
  'Sua conta entrou, mas ainda não tem cadastro de pessoa no sistema. Fale com o dono.'
const DESATIVADO = 'Seu acesso está desativado.'
const DESLIGADO =
  'O sistema ainda não está ligado ao banco. Falta configurar o endereço e a chave do Supabase.'

async function lerPessoa(id: string, email: string): Promise<Pessoa> {
  const linhas = await tabela<LinhaDePessoa[]>(
    `pessoa?select=id,nome,papel,ativo&id=eq.${encodeURIComponent(id)}&limit=1`,
  )
  const linha = linhas[0]
  if (!linha) throw new Error(SEM_CADASTRO)
  if (!linha.ativo) throw new Error(DESATIVADO)
  return { id: linha.id, nome: linha.nome || email, papel: linha.papel, email }
}

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    SUPABASE_LIGADO ? { fase: 'conferindo' } : { fase: 'fora' },
  )

  /* O componente pode sair da tela enquanto a conferencia ainda esta no ar.
     Sem esta trava, o setEstado chegaria depois e o React reclamaria. */
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  /* Ao abrir o sistema: tem cracha guardado? Ele ainda vale? E quem e essa
     pessoa hoje na tabela? Um cracha valido de alguem que foi desativado nao
     abre nada, e por isso a pergunta e feita toda vez, nao so ao entrar. */
  useEffect(() => {
    if (!SUPABASE_LIGADO) return
    let cancelado = false
    void (async () => {
      const cracha = await crachaValido()
      if (cancelado) return
      if (!cracha) {
        if (vivo.current) setEstado({ fase: 'fora' })
        return
      }
      try {
        const pessoa = await lerPessoa(cracha.usuario, cracha.email)
        if (!cancelado && vivo.current) setEstado({ fase: 'dentro', pessoa })
      } catch {
        /* cracha bom e cadastro ruim: derruba, senao a pessoa fica num limbo
           em que entrou mas nenhuma tela carrega */
        await sairDoSupabase()
        if (!cancelado && vivo.current) setEstado({ fase: 'fora' })
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    if (!SUPABASE_LIGADO) throw new Error(DESLIGADO)
    const cracha = await entrarComEmail(email, senha)
    try {
      const pessoa = await lerPessoa(cracha.usuario, cracha.email)
      if (vivo.current) setEstado({ fase: 'dentro', pessoa })
    } catch (e) {
      await sairDoSupabase()
      if (vivo.current) setEstado({ fase: 'fora' })
      throw e
    }
  }, [])

  const sair = useCallback(async () => {
    await sairDoSupabase()
    if (vivo.current) setEstado({ fase: 'fora' })
  }, [])

  const valor = useMemo<Sessao>(() => ({ estado, entrar, sair }), [estado, entrar, sair])

  return <ContextoDaSessao.Provider value={valor}>{children}</ContextoDaSessao.Provider>
}
