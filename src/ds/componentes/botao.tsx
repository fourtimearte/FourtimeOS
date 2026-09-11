import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export type TomBotao = 'primario' | 'forte' | 'contorno' | 'limpo' | 'perigo' | 'wa'
export type TamanhoBotao = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tom?: TomBotao
  tamanho?: TamanhoBotao
  /** ocupa a largura toda, para rodapé de formulário e tela de celular */
  bloco?: boolean
  /** quadrado, só com o ícone dentro */
  icone?: boolean
  carregando?: boolean
}

/* Botão. O tom diz o peso da ação, não o gosto:
   primário é a ação principal em vermelho, forte é preto e serve para confirmar,
   contorno é a ação secundária, limpo é a terciária, perigo é o que não volta
   atrás, e wa é o WhatsApp. */
export function Botao({
  tom = 'contorno',
  tamanho = 'md',
  bloco,
  icone,
  carregando,
  className = '',
  children,
  type = 'button',
  ...resto
}: Props) {
  const classes = [
    'btn',
    `btn-${tom}`,
    tamanho !== 'md' ? tamanho : '',
    bloco ? 'bloco' : '',
    icone ? 'icone' : '',
    carregando ? 'carregando' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...resto}>
      {tom === 'wa' ? <span className="pt-wa" /> : null}
      {children}
    </button>
  )
}

type PropsChip = ButtonHTMLAttributes<HTMLButtonElement> & {
  ligado?: boolean
  tamanho?: 'sm' | 'md'
  /** cor do ponto, quando o chip representa uma coisa que tem cor */
  cor?: string
  children?: ReactNode
}

/* Chip. Filtro que liga e desliga. Ligado ele fica preto, porque preto é
   seleção no V7. */
export function Chip({
  ligado,
  tamanho = 'md',
  cor,
  className = '',
  children,
  type = 'button',
  ...resto
}: PropsChip) {
  const classes = ['chip', ligado ? 'ligado' : '', tamanho === 'sm' ? 'sm' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...resto}>
      {cor ? <span className="pt" style={{ '--c': cor } as CSSProperties} /> : null}
      {children}
    </button>
  )
}
