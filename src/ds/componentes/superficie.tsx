import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

/* --- cartão -------------------------------------------------------------- */
export function Cartao({
  clicavel,
  semPadding,
  className = '',
  children,
  ...resto
}: HTMLAttributes<HTMLDivElement> & { clicavel?: boolean; semPadding?: boolean }) {
  const classes = [
    'cartao',
    semPadding ? '' : 'cartao-pad',
    clicavel ? 'clicavel' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} {...resto}>
      {children}
    </div>
  )
}

export function TituloCartao({ children, marca = true }: { children: ReactNode; marca?: boolean }) {
  return (
    <h3 className="cartao-titulo">
      {marca ? <span className="marca" /> : null}
      {children}
    </h3>
  )
}

/* --- selo ---------------------------------------------------------------- */
export type TomSelo = 'ok' | 'warn' | 'info' | 'brand' | 'neutro'

/* Selo. Estado de uma coisa: pago, atrasado, em produção.
   A forma diz o peso: suave lê, sólido grita, contorno avisa sem preencher. */
export function Selo({
  tom = 'neutro',
  forma = 'suave',
  children,
}: {
  tom?: TomSelo
  forma?: 'suave' | 'solido' | 'contorno' | 'forte'
  children: ReactNode
}) {
  const classes = [
    'selo',
    forma === 'solido' ? 'solido' : forma === 'contorno' ? 'contorno' : forma === 'forte' ? 'forte' : '',
    tom !== 'neutro' ? `c-${tom}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={classes}>{children}</span>
}

/* --- tag ----------------------------------------------------------------- */
export function Tag({
  genero,
  children,
}: {
  /** tarja de gênero da referência: masculino, feminino ou infantil */
  genero?: 'masculino' | 'feminino' | 'infantil'
  children: ReactNode
}) {
  return (
    <span className={['tag', genero ? `gen-${genero}` : ''].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

/* --- etiqueta: a tag do cartão do kanban ---------------------------------
   O TOM É UMA CHAVE, e não uma cor. O banco guarda o nome do tom porque cor
   literal dentro do dado atravessa o sistema sem passar pelo tema, e no
   Grafite sai ilegível. Quem pinta é o CSS, pelo mesmo mecanismo do selo. */
export type TomDeEtiqueta =
  | 'cinza'
  | 'vermelha'
  | 'laranja'
  | 'amarela'
  | 'verde'
  | 'azul'
  | 'roxa'

export function Etiqueta({
  tom = 'cinza',
  /** a tag mestre vem do cabeçalho da cotação e vale para o pedido inteiro */
  mestre,
  /** a tag que existe mas não vale neste posto: aparece apagada, não some */
  fora,
  pequena,
  aoTirar,
  aoClicar,
  desligada,
  title,
  children,
}: {
  tom?: TomDeEtiqueta
  mestre?: boolean
  fora?: boolean
  pequena?: boolean
  aoTirar?: () => void
  aoClicar?: () => void
  desligada?: boolean
  title?: string
  children: ReactNode
}) {
  const classes = [
    'etiqueta',
    mestre ? 'mestre' : '',
    fora ? 'fora' : '',
    pequena ? 'sm' : '',
    `t-${tom}`,
  ]
    .filter(Boolean)
    .join(' ')

  /* Quem escolhe uma tag CLICA, e por isso ela nasce <button> e não um div com
     onClick: um div com clique é invisível para o Tab e para quem usa leitor
     de tela, e esta tela roda em tablet onde o teclado é o único jeito de
     chegar em muita coisa. */
  if (aoClicar) {
    return (
      <button type="button" className={classes} onClick={aoClicar} disabled={desligada} title={title}>
        <span className="n">{children}</span>
      </button>
    )
  }

  return (
    <span className={classes} title={title}>
      <span className="n">{children}</span>
      {aoTirar ? (
        <button type="button" className="x" onClick={aoTirar} aria-label="Tirar esta tag">
          <Fechar />
        </button>
      ) : null}
    </span>
  )
}

function Fechar() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --- técnica ------------------------------------------------------------- */
export type Tecnica =
  | 'dtf'
  | 'subli'
  | 'silk'
  | 'patch'
  | 'bordado'
  | 'gola'
  | 'ribana'
  | 'etiqueta'

function coresDaTecnica(t: Tecnica): CSSProperties {
  return {
    '--tc': `var(--tec-${t})`,
    '--tv': `var(--tec-${t}-vivo)`,
    '--ts': `var(--tec-${t}-soft)`,
    '--tf': `var(--tec-${t}-fg)`,
  } as CSSProperties
}

/* A pílula de técnica. É a peça que carrega a cor do editor para dentro do
   sistema: a mesma cor no editor, no cartão e no kanban. */
export function PilulaTecnica({
  tecnica,
  tamanho = 'md',
  clicavel,
  aoAdicionar,
  children,
  ...resto
}: {
  tecnica: Tecnica
  tamanho?: 'sm' | 'md' | 'lg'
  clicavel?: boolean
  /** o "+" de acrescentar cor. Para remover é botão direito, nunca um X. */
  aoAdicionar?: () => void
  children: ReactNode
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const classes = [
    'tec',
    tamanho !== 'md' ? tamanho : '',
    clicavel || aoAdicionar ? 'clicavel' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} style={coresDaTecnica(tecnica)} {...resto}>
      {children}
      {aoAdicionar ? (
        <button
          type="button"
          className="mais"
          aria-label="Acrescentar cor"
          onClick={(e) => {
            e.stopPropagation()
            aoAdicionar()
          }}
        >
          +
        </button>
      ) : null}
    </span>
  )
}

/* A versão de leitura: fundo suave, texto na cor da técnica, ponto vivo. */
export function ChipTecnica({ tecnica, children }: { tecnica: Tecnica; children: ReactNode }) {
  return (
    <span className="tec-soft" style={coresDaTecnica(tecnica)}>
      <span className="pt" />
      {children}
    </span>
  )
}

/* --- amostra de cor ------------------------------------------------------ */
export function Amostra({ cor }: { cor?: string }) {
  return <span className="amostra" style={{ '--cor-amostra': cor } as CSSProperties} />
}

/* --- barra de nivel -------------------------------------------------------
   Quanto tem contra quanto deveria ter. O traco do meio e o alvo: encher ate
   ele e estar no limite, passar dele e ter folga. A cor chega pronta de fora
   porque quem decide o que e pouco e o dominio.

   Recebe a porcentagem ja calculada, e nao os dois numeros, pelo mesmo motivo:
   a regra de "quanto da barra encher" pertence a quem tem os numeros. */
export function Nivel({
  valor,
  cor,
  fixa,
  titulo,
}: {
  /** 0 a 100 */
  valor: number
  cor?: string
  /** largura travada, para lista apertada em vez de coluna de tabela */
  fixa?: boolean
  titulo?: string
}) {
  const cheio = Math.max(0, Math.min(100, valor))
  return (
    <span
      className={fixa ? 'nivel fixa' : 'nivel'}
      style={{ '--nivel-cor': cor } as CSSProperties}
      title={titulo}
    >
      <i style={{ width: cheio + '%' }} />
      <u />
    </span>
  )
}

/* --- avatar --------------------------------------------------------------
   A bolinha redonda da pessoa: foto quando existe, iniciais quando nao.

   Recebe as iniciais prontas em vez de tirar do nome sozinho. Nao e preciosismo
   de camada: quem sabe o que e "nome de pessoa" na Fourtime e o dominio, e o
   Design System nunca precisou saber. */
export function Avatar({
  iniciais,
  foto,
  tamanho = 32,
  titulo,
}: {
  iniciais: string
  foto?: string | null
  tamanho?: number
  titulo?: string
}) {
  return (
    <span
      className="avatar"
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) }}
      title={titulo}
    >
      {foto ? <img src={foto} alt="" loading="lazy" /> : iniciais}
    </span>
  )
}
