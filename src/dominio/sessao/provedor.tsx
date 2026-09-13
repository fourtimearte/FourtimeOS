import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  cadastrar,
  chamar,
  crachaValido,
  entrarComEmail,
  sairDoSupabase,
  SUPABASE_LIGADO,
  tabela,
} from '@shared/supabase'
import { ContextoDaSessao } from './contexto'
import type { Sessao } from './contexto'
import type { Estado, Painel, Papel, Pessoa, Situacao } from './tipos'

/* A sessao de verdade, com o Supabase por tras.

   Antes daqui existia uma cortina: usuario e senha escritos no codigo, que
   qualquer pessoa lia abrindo a pagina. Agora a senha nunca chega ao navegador
   e cada pessoa tem o seu papel e a sua lista de paineis.

   Quem responde "quem sou eu" e a view meu_perfil, nao a tabela pessoa. Ela ja
   devolve a lista de paineis resolvida (o padrao do papel, ou a lista so dela)
   e devolve lista vazia para quem ainda nao foi aprovado. Assim a tela nao
   precisa saber a regra: ela recebe a resposta pronta. */

type LinhaDoPerfil = {
  id: string
  nome: string
  papel: Papel
  situacao: Situacao
  paineis: Painel[] | null
}

const SEM_CADASTRO =
  'Sua conta entrou, mas não tem cadastro no sistema. Fale com o administrador.'
const DESLIGADO =
  'O sistema ainda não está ligado ao banco. Falta configurar o endereço e a chave do Supabase.'

async function lerPerfil(email: string): Promise<Pessoa> {
  const linhas = await tabela<LinhaDoPerfil[]>('meu_perfil?select=*&limit=1')
  const linha = linhas[0]
  if (!linha) throw new Error(SEM_CADASTRO)
  return {
    id: linha.id,
    nome: linha.nome || email,
    papel: linha.papel,
    situacao: linha.situacao,
    paineis: linha.paineis ?? [],
    email,
  }
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

  /* Tem cracha guardado? Ele ainda vale? E quem e essa pessoa HOJE?
     A ultima pergunta e feita toda vez de proposito: um cracha valido de
     alguem que foi bloqueado ontem nao pode abrir nada hoje. */
  const conferir = useCallback(async (): Promise<Estado> => {
    const cracha = await crachaValido()
    if (!cracha) return { fase: 'fora' }
    try {
      return { fase: 'dentro', pessoa: await lerPerfil(cracha.email) }
    } catch {
      /* cracha bom e cadastro ruim: derruba, senao a pessoa fica num limbo em
         que entrou mas nenhuma tela carrega */
      await sairDoSupabase()
      return { fase: 'fora' }
    }
  }, [])

  useEffect(() => {
    if (!SUPABASE_LIGADO) return
    let cancelado = false
    void conferir().then((novo) => {
      if (!cancelado && vivo.current) setEstado(novo)
    })
    return () => {
      cancelado = true
    }
  }, [conferir])

  const reconferir = useCallback(async () => {
    const novo = await conferir()
    if (vivo.current) setEstado(novo)
  }, [conferir])

  /* Entrar e criar conta terminam do mesmo jeito: o cracha ja esta guardado, e
     o que falta e descobrir quem essa pessoa e no sistema. */
  const depoisDoCracha = useCallback(async (email: string) => {
    try {
      const pessoa = await lerPerfil(email)
      if (vivo.current) setEstado({ fase: 'dentro', pessoa })
    } catch (e) {
      await sairDoSupabase()
      if (vivo.current) setEstado({ fase: 'fora' })
      throw e
    }
  }, [])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      if (!SUPABASE_LIGADO) throw new Error(DESLIGADO)
      const cracha = await entrarComEmail(email, senha)
      await depoisDoCracha(cracha.email)
    },
    [depoisDoCracha],
  )

  const criarConta = useCallback(
    async (nome: string, email: string, senha: string) => {
      if (!SUPABASE_LIGADO) throw new Error(DESLIGADO)
      const cracha = await cadastrar(email, senha, nome)
      await depoisDoCracha(cracha.email)
    },
    [depoisDoCracha],
  )

  const mudarMeuNome = useCallback(async (nome: string) => {
    await chamar<null>('mudar_meu_nome', { novo: nome })
    if (vivo.current) {
      setEstado((atual) =>
        atual.fase === 'dentro'
          ? { fase: 'dentro', pessoa: { ...atual.pessoa, nome: nome.trim() } }
          : atual,
      )
    }
  }, [])

  const sair = useCallback(async () => {
    await sairDoSupabase()
    if (vivo.current) setEstado({ fase: 'fora' })
  }, [])

  const valor = useMemo<Sessao>(
    () => ({ estado, entrar, criarConta, mudarMeuNome, reconferir, sair }),
    [estado, entrar, criarConta, mudarMeuNome, reconferir, sair],
  )

  return <ContextoDaSessao.Provider value={valor}>{children}</ContextoDaSessao.Provider>
}
