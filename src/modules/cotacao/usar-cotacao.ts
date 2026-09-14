import { useCallback, useEffect, useState } from 'react'
import { acharCotacao, type Cotacao } from '@dominio/cotacao'

/* ==========================================================================
   Buscar UMA cotação pelo id do endereço.

   Mora aqui, e não em dominio/, porque é um hook: ele é a ponte entre a porta
   do banco e a vida de uma tela do React. O editor e a folha de impressão
   fazem exatamente a mesma coisa ao abrir, e fazer duas vezes é o caminho
   normal para as duas divergirem num detalhe.

   TRÊS ESTADOS, E NÃO DOIS. "Carregando", "não achei" e "achei" são coisas
   diferentes, e juntar as duas primeiras é o erro clássico: por meio segundo a
   tela diria "esta cotação não existe mais" para uma cotação que existe, e
   quem estivesse com a internet lenta leria isso o tempo todo.
   ========================================================================== */

export type BuscaDaCotacao = {
  cotacao: Cotacao | null
  carregando: boolean
  falha: string
  recarregar: () => void
}

export function usarCotacao(id: string): BuscaDaCotacao {
  const [cotacao, setCotacao] = useState<Cotacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setFalha('')
    acharCotacao(id)
      .then((c) => vivo && setCotacao(c))
      .catch((e) => {
        if (!vivo) return
        setCotacao(null)
        setFalha(e instanceof Error ? e.message : 'Não consegui carregar a cotação.')
      })
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [id, versao])

  return { cotacao, carregando, falha, recarregar }
}
