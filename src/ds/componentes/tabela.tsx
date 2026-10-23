import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Marcacao } from './formulario'
import { useSelecaoDeLinhas } from './selecao'

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
  /* MARCAR LINHAS PARA O LOTE (Kit de Comportamento, seção 1; 23/10/2026):
     a coluna de caixas, a caixa do cabeçalho, o clique na linha, Ctrl, Shift,
     Esc e Ctrl + A, pelo useSelecaoDeLinhas. Quem guarda o que está marcado
     é a tela. Com a seleção, `marcadas` e `aoClicarNaLinha` não se usam. */
  selecao?: {
    marcadas: string[]
    aoMudar: (ids: string[]) => void
    /** o nome da linha para o leitor de tela ("Marcar L-01") */
    nome?: (linha: L) => string
  }
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
  selecao,
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

  /* a ordem da TELA (depois de ordenar) é a que o Shift percorre */
  const ids = ordenadas.map(chaveDaLinha)
  const sel = useSelecaoDeLinhas(ids, selecao?.marcadas ?? [], selecao?.aoMudar ?? (() => {}))
  const todas = !!selecao && ids.length > 0 && ids.every((id) => selecao.marcadas.includes(id))
  const algumas = !!selecao && !todas && ids.some((id) => selecao.marcadas.includes(id))

  function alterna(chave: string) {
    setOrdem((o) => (o?.chave === chave ? { chave, desc: !o.desc } : { chave, desc: false }))
  }

  if (!linhas.length && vazio) return <>{vazio}</>

  return (
    /* com a seleção, a caixa recebe o foco no clique de qualquer linha (tabIndex
       -1: fora da ordem do Tab), e é por isso que o Esc e o Ctrl + A chegam */
    <div className="tabela-rola" tabIndex={selecao ? -1 : undefined} onKeyDown={selecao ? sel.naTecla : undefined}>
      <table className="tabela">
        <thead>
          <tr>
            {selecao ? (
              <th className="ck-col">
                <Marcacao aria-label="Marcar todas" checked={todas} meio={algumas} onChange={() => sel.todas(!todas)} />
              </th>
            ) : null}
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
            if (selecao) {
              const marcada = selecao.marcadas.includes(id)
              return (
                <tr key={id} className={marcada ? 'marcada' : ''} aria-selected={marcada} onClick={(e) => sel.naLinha(id, e)}>
                  <td className="ck-col">
                    <Marcacao
                      aria-label={'Marcar ' + (selecao.nome?.(l) ?? id)}
                      checked={marcada}
                      onChange={() => {}}
                      onClick={(e) => sel.naCaixa(id, e)}
                    />
                  </td>
                  {colunas.map((c) => (
                    <td key={c.chave} className={c.numero ? 'dir' : ''}>
                      {c.celula(l)}
                    </td>
                  ))}
                </tr>
              )
            }
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
              {selecao ? <td className="ck-col" /> : null}
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
