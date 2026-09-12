import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Flutuante } from './flutuante'

/* ==========================================================================
   O botao que abre um menu qualquer.

   E o gatilho do Seletor sem a lista: a mesma pilula, a mesma seta, o mesmo
   preto quando ha coisa escolhida, mas o que abre e o que voce puser dentro.

   Ele existe porque nem todo menu e uma lista de opcoes. O periodo do
   relatorio e um passo de ano mais uma grade de doze meses, e forcar isso
   numa lista de opcoes daria uma lista de doze linhas onde a pessoa precisa
   ver o ano inteiro de uma vez para decidir.

   Regra que ele NAO quebra: quem desenha o corpo do menu e quem usa, mas a
   pilula continua sendo do Design System. Assim o dia que a pilula mudar,
   muda em todo lugar.
   ========================================================================== */
export function BotaoComMenu({
  rotulo,
  valor,
  marcado,
  conta,
  cor,
  tamanho = 'md',
  bloco,
  titulo,
  children,
}: {
  /** o rotulo miudo dentro do botao, tipo PERIODO */
  rotulo?: string
  /** o que esta escolhido, escrito */
  valor: ReactNode
  /** desenha a pilula como "peneirando por isto" */
  marcado?: boolean
  /** um numero no canto, quando o escolhido nao cabe por extenso */
  conta?: number
  /** pinta o escolhido com a cor do proprio estado, como no Seletor */
  cor?: string
  tamanho?: 'sm' | 'md'
  bloco?: boolean
  titulo?: string
  /** o corpo do menu. Recebe o fechar para os botoes de dentro poderem fechar */
  children: (fechar: () => void) => ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const bt = useRef<HTMLButtonElement>(null)
  const fechar = () => setAberto(false)

  return (
    <span
      className={[
        'sel',
        tamanho === 'sm' ? 'sm' : '',
        bloco ? 'bloco' : '',
        cor ? 'tom' : '',
        aberto ? 'aberto' : '',
        marcado ? 'marcado' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={cor ? ({ '--tom': cor } as CSSProperties) : undefined}
    >
      <button
        ref={bt}
        type="button"
        className="cb"
        title={titulo}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {rotulo ? <span className="lb">{rotulo}</span> : null}
        <span className="v">{valor}</span>
        {conta != null && conta > 1 ? <span className="conta-sel">{conta}</span> : null}
        <span className="seta">▼</span>
      </button>

      <Flutuante
        aberto={aberto}
        ancora={bt}
        aoFechar={fechar}
        opcoes={{ maior: true }}
        className="mn corpo-livre"
      >
        {children(fechar)}
      </Flutuante>
    </span>
  )
}
