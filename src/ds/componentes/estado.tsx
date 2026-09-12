import type { CSSProperties, ReactNode } from 'react'

/* Estado vazio. Nunca só "nenhum resultado": diz o que aconteceu e qual é a
   saída, porque lista vazia num galpão costuma ser dúvida, não descanso. */
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string
  texto?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="vazio">
      <h3>{titulo}</h3>
      {texto ? <p>{texto}</p> : null}
      {acao}
    </div>
  )
}

/* Esqueleto de carregamento. Ocupa o lugar exato do conteúdo, para a tela não
   pular quando o dado chega. */
export function Esqueleto({
  largura = '100%',
  altura = 14,
  raio = 'var(--radius-xs)',
}: {
  largura?: number | string
  altura?: number | string
  raio?: string
}) {
  return <span className="esqueleto" style={{ display: 'block', width: largura, height: altura, borderRadius: raio }} />
}

export type TomAviso = 'brand' | 'ok' | 'warn' | 'info'

/* Aviso preso na página. O toast some sozinho; este fica enquanto a condição
   existir. */
export function Aviso({
  tom = 'brand',
  titulo,
  children,
  acao,
}: {
  tom?: TomAviso
  titulo?: ReactNode
  children: ReactNode
  acao?: ReactNode
}) {
  const cor =
    tom === 'ok'
      ? 'var(--ok)'
      : tom === 'warn'
        ? 'var(--warn)'
        : tom === 'info'
          ? 'var(--info)'
          : 'var(--brand)'
  return (
    <div className="aviso" style={{ '--c': cor } as CSSProperties}>
      <span className="pt" />
      <div className="corpo">
        {titulo ? <b>{titulo}</b> : null}
        {children}
      </div>
      {acao}
    </div>
  )
}
