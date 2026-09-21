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
