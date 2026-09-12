import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Coluna<L> = {
  chave: string
  titulo: ReactNode
  /** à direita e com número tabular: para dinheiro, quantidade e data */
  numero?: boolean
  /** quando existe, a coluna pode ordenar; devolve o valor comparável */
  ordenarPor?: (linha: L) => string | number
  celula: (linha: L) => ReactNode
}

type Props<L> = {
  colunas: Coluna<L>[]
  linhas: L[]
  chaveDaLinha: (linha: L) => string
  /** linhas marcadas ficam com o fundo de seleção */
  marcadas?: string[]
  aoClicarNaLinha?: (linha: L) => void
  /** rodapé de totais, na mesma grade das colunas */
  total?: ReactNode[]
  vazio?: ReactNode
}

/* Tabela. Rola na horizontal dentro da própria caixa, então no celular ela
   não empurra a página inteira para o lado. */
export function Tabela<L>({
  colunas,
  linhas,
  chaveDaLinha,
  marcadas,
  aoClicarNaLinha,
  total,
  vazio,
}: Props<L>) {
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean } | null>(null)

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas
    const col = colunas.find((c) => c.chave === ordem.chave)
    if (!col?.ordenarPor) return linhas
    const puxa = col.ordenarPor
    const copia = [...linhas]
    copia.sort((a, b) => {
      const x = puxa(a)
      const y = puxa(b)
      if (x === y) return 0
      return (x > y ? 1 : -1) * (ordem.desc ? -1 : 1)
    })
    return copia
  }, [linhas, colunas, ordem])

  function alterna(chave: string) {
    setOrdem((o) => (o?.chave === chave ? { chave, desc: !o.desc } : { chave, desc: false }))
  }

  if (!linhas.length && vazio) return <>{vazio}</>

  return (
    <div className="tabela-rola">
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((c) => {
              const ordenando = ordem?.chave === c.chave
              return (
                <th
                  key={c.chave}
                  className={[c.numero ? 'dir' : '', c.ordenarPor ? 'ordena' : '', ordenando ? 'ordenando' : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={c.ordenarPor ? () => alterna(c.chave) : undefined}
                  aria-sort={ordenando ? (ordem.desc ? 'descending' : 'ascending') : undefined}
                >
                  {c.titulo}
                  {c.ordenarPor ? (
                    <span className="seta">{ordenando ? (ordem.desc ? '▼' : '▲') : '▲▼'}</span>
                  ) : null}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l) => {
            const id = chaveDaLinha(l)
            return (
              <tr
                key={id}
                className={marcadas?.includes(id) ? 'marcada' : ''}
                onClick={aoClicarNaLinha ? () => aoClicarNaLinha(l) : undefined}
                style={aoClicarNaLinha ? { cursor: 'pointer' } : undefined}
              >
                {colunas.map((c) => (
                  <td key={c.chave} className={c.numero ? 'dir' : ''}>
                    {c.celula(l)}
                  </td>
                ))}
              </tr>
            )
          })}
          {total ? (
            <tr className="total">
              {total.map((t, i) => (
                <td key={colunas[i]?.chave ?? i} className={colunas[i]?.numero ? 'dir' : ''}>
                  {t}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
