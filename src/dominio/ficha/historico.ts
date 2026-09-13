import { useCallback, useEffect, useRef, useState } from 'react'

/* ==========================================================================
   O histórico de desfazer.

   Cinquenta passos, como combinado. O teto existe porque cada passo é uma
   cópia do documento inteiro, e um documento com vinte layouts não é pequeno:
   sem teto, uma tarde de trabalho vira memória que ninguém devolve.

   Regra que veio do editor v3.375: a IMAGEM fica de fora do histórico. Ela é
   quase todo o peso do documento, e guardar cinquenta cópias de seis imagens
   é a diferença entre um histórico de alguns megabytes e um de centenas. A
   imagem entra no passo pela etiqueta, e a etiqueta aponta para o registro de
   imagens, que é um só.

   Digitar não é um passo por tecla. Mudanças que chegam coladas no tempo
   (menos de 400 ms) substituem a última em vez de empilhar, se não desfazer
   uma frase custaria quarenta Ctrl+Z.
   ========================================================================== */

export const PASSOS_DO_HISTORICO = 50
const JUNTA_ATE_MS = 400

export type Historico<T> = {
  valor: T
  /** troca o valor e empilha um passo */
  mudar: (proximo: T | ((atual: T) => T), opcoes?: { junta?: boolean }) => void
  /** troca o valor SEM empilhar: para carregar do banco, por exemplo */
  repor: (proximo: T) => void
  desfazer: () => void
  refazer: () => void
  podeDesfazer: boolean
  podeRefazer: boolean
  /** quantos passos guardados, para a tela poder dizer */
  passos: number
}

export function useHistorico<T>(inicial: T): Historico<T> {
  const [pilha, setPilha] = useState<T[]>([inicial])
  const [onde, setOnde] = useState(0)
  const ultimaEm = useRef(0)

  const valor = pilha[onde]

  const mudar = useCallback(
    (proximo: T | ((atual: T) => T), opcoes?: { junta?: boolean }) => {
      setPilha((p) => {
        const atual = p[onde]
        const novo =
          typeof proximo === 'function' ? (proximo as (a: T) => T)(atual) : proximo
        if (Object.is(novo, atual)) return p

        const agora = Date.now()
        const cola = opcoes?.junta ?? agora - ultimaEm.current < JUNTA_ATE_MS
        ultimaEm.current = agora

        /* refazer morre assim que alguém escreve por cima: o futuro que
           existia era o de outra história */
        const ate = p.slice(0, onde + 1)

        if (cola && ate.length > 1) {
          const juntado = [...ate.slice(0, -1), novo]
          setOnde(juntado.length - 1)
          return juntado
        }

        const empilhado = [...ate, novo]
        const cortado =
          empilhado.length > PASSOS_DO_HISTORICO
            ? empilhado.slice(empilhado.length - PASSOS_DO_HISTORICO)
            : empilhado
        setOnde(cortado.length - 1)
        return cortado
      })
    },
    [onde],
  )

  const repor = useCallback((proximo: T) => {
    ultimaEm.current = 0
    setPilha([proximo])
    setOnde(0)
  }, [])

  const desfazer = useCallback(() => {
    ultimaEm.current = 0
    setOnde((o) => Math.max(0, o - 1))
  }, [])

  const refazer = useCallback(() => {
    ultimaEm.current = 0
    setOnde((o) => Math.min(pilha.length - 1, o + 1))
  }, [pilha.length])

  return {
    valor,
    mudar,
    repor,
    desfazer,
    refazer,
    podeDesfazer: onde > 0,
    podeRefazer: onde < pilha.length - 1,
    passos: pilha.length,
  }
}

/* Ctrl+Z desfaz, Ctrl+Y e Ctrl+Shift+Z refazem. Os três atalhos da v3.375.

   Campo de texto em foco não é exceção: o navegador desfaz a digitação
   sozinho dentro do campo, e deixar os dois brigando faz o documento voltar
   um passo enquanto o campo volta outro. Por isso o atalho só vale quando o
   foco NÃO está num campo que já tem desfazer próprio. */
export function useAtalhosDoHistorico(h: { desfazer: () => void; refazer: () => void }) {
  useEffect(() => {
    function ouvir(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const alvo = e.target as HTMLElement | null
      const digitando =
        !!alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.isContentEditable)

      const tecla = e.key.toLowerCase()
      if (tecla === 'z' && !e.shiftKey) {
        if (digitando) return
        e.preventDefault()
        h.desfazer()
        return
      }
      if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
        if (digitando) return
        e.preventDefault()
        h.refazer()
      }
    }
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [h])
}
