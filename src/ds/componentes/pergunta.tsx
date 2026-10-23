import type { ReactNode } from 'react'
import { Botao } from './botao'

/* ==========================================================================
   A PERGUNTA ANTES DE APAGAR, NA PRÓPRIA PÁGINA (Kit de Comportamento, seção
   7). Nada de confirm(): a pergunta aparece no lugar do botão que pediu,
   diz o que se perde, e oferece Manter e Apagar. Subiu para o Design System
   em 23/10/2026: era escrita igual, à mão, em três telas (o extra, a
   combinação e o tamanho de DTF da tabela de preço).

   O texto é de quem pergunta: o nome do que sai em negrito e, se houver, o
   que mais muda junto ("O layout que usa ela fica pedindo outro DTF").
   ========================================================================== */

export function PerguntaDeApagar({
  children,
  aoManter,
  aoApagar,
  apagar = 'Apagar',
}: {
  children: ReactNode
  aoManter: () => void
  aoApagar: () => void
  /** o nome do botão vermelho, quando "Apagar" não é a palavra certa */
  apagar?: string
}) {
  return (
    <div className="pergunta-apagar" role="alert">
      <span>{children}</span>
      <span className="fileira">
        <Botao tom="contorno" tamanho="sm" onClick={aoManter}>
          Manter
        </Botao>
        <Botao tom="perigo" tamanho="sm" onClick={aoApagar}>
          {apagar}
        </Botao>
      </span>
    </div>
  )
}
