import type { ReactNode } from 'react'
import { Plus, Warning } from '@phosphor-icons/react'
import { Botao, Marcacao, PilulaTecnica, useSelecaoDeLinhas } from '@ds'
import { celula, nomeDaFaixa, type Contexto, type TabelaDePreco } from '@dominio/preco'
import { CampoDePreco, celulaDaColuna, colunasDaGrade, escritoNaColuna, usarAlca, usarEdicao } from './campo'
import type { LinhaDaGrade, PecaDoCatalogo } from './catalogo'

/* ==========================================================================
   A GRADE DA TABELA, NA LISTA (prancha 139): uma linha por referência ou kit
   da tabela, agrupada como na ficha técnica (o código do grupo na caixa), e
   uma coluna por faixa. A primeira é o PREÇO BASE, destacada. Todo preço é
   um campo à vista (campo.tsx).

   Com busca, embaixo vem o que o catálogo tem e a tabela não: "Fora desta
   tabela", cada uma com Pôr na tabela. Era por isso que a busca parecia não
   funcionar: ela só olhava dentro da tabela.
   ========================================================================== */


export function GradeDaTabela({
  tabela,
  linhas,
  fora,
  busca,
  ctx,
  podeMexer,
  marcados,
  aoMarcar,
  aoEscrever,
  aoColar,
  aoPreencher,
  aoPor,
}: {
  tabela: TabelaDePreco
  linhas: LinhaDaGrade[]
  /** o que a busca achou no catálogo e a tabela não tem */
  fora: PecaDoCatalogo[]
  busca: string
  ctx: Contexto
  podeMexer: boolean
  marcados: string[]
  aoMarcar: (codigos: string[]) => void
  aoEscrever: (codigo: string, faixa: number, valor: number | null) => void
  aoColar: (codigos: string[], linha: number, faixa: number, texto: string) => void
  aoPreencher: (alvos: { codigo: string; faixa: number }[], valor: number) => void
  aoPor: (p: PecaDoCatalogo) => void
}) {
  const ordem = linhas.map((l) => l.item.codigo)
  const edicao = usarEdicao({
    ordem,
    faixas: colunasDaGrade(tabela),
    /* abrir mostra o que esta escrito: a base, o a mao da faixa, a Sub ou o Silk */
    valorDe: (cod, i) => escritoNaColuna(tabela, tabela.itens.find((x) => x.codigo === cod), i),
    aoEscrever,
    aoColar: (cod, i, texto) => aoColar(ordem, ordem.indexOf(cod), i, texto),
  })

  /* a seleção do Kit de Comportamento: caixa, clique, Ctrl, Shift, Esc e Ctrl+A */
  const selecao = useSelecaoDeLinhas(ordem, marcados, aoMarcar)
  const alca = usarAlca({
    ordem,
    valorDe: (cod, i) => {
      const it = tabela.itens.find((x) => x.codigo === cod)
      return it ? celulaDaColuna(tabela, it, i, ctx).valor : null
    },
    aoPreencher,
  })

  const grupos: [string, string, LinhaDaGrade[]][] = []
  for (const l of linhas) {
    const g = grupos.find(([n]) => n === l.grupo)
    if (g) g[2].push(l)
    else grupos.push([l.grupo, l.grupoCod, [l]])
  }
  const marcouTodos = ordem.length > 0 && ordem.every((c) => marcados.includes(c))
  const colunas = tabela.faixas.length + 4

  return (
    <div className="pr-rola" onKeyDown={podeMexer ? selecao.naTecla : undefined}>
      <table className="pr-grade">
        <thead>
          <tr>
            <th className="pr-ck-col">
              {podeMexer && ordem.length ? (
                <Marcacao
                  aria-label="Marcar todas"
                  checked={marcouTodos}
                  meio={!marcouTodos && marcados.length > 0}
                  onChange={() => aoMarcar(marcouTodos ? [] : ordem)}
                />
              ) : null}
            </th>
            <th className="pr-nm">Referência ou kit</th>
            {tabela.faixas.map((f, i) => (
              <th key={nomeDaFaixa(f)} className={i === 0 ? 'pr-col-base' : ''}>
                {i === 0 ? 'Preço base' : nomeDaFaixa(f)}
                <small>{i === 0 ? nomeDaFaixa(f) + ' peças' : 'peças'}</small>
              </th>
            ))}
            <th className="pr-tec pr-col-tec">
              <PilulaTecnica tecnica="subli" tamanho="sm">SUB</PilulaTecnica>
              <small>por peça</small>
            </th>
            <th className="pr-tec">
              <PilulaTecnica tecnica="silk" tamanho="sm">SILK</PilulaTecnica>
              <small>por tela</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(([grupo, cod, ls]) => (
            <GrupoDaGrade key={grupo} grupo={grupo} cod={cod} colunas={colunas}>
              {ls.map((l) => {
                const marcado = marcados.includes(l.item.codigo)
                const semBase = celula(tabela, l.item, 0, ctx).valor == null
                return (
                  <tr
                    key={l.item.codigo}
                    className={marcado ? 'pr-marcada' : ''}
                    aria-selected={marcado}
                    onClick={podeMexer ? (e) => selecao.naLinha(l.item.codigo, e) : undefined}
                  >
                    <td className="pr-ck-col">
                      {podeMexer ? (
                        <Marcacao
                          aria-label={'Marcar ' + l.item.codigo}
                          checked={marcado}
                          onChange={() => {}}
                          onClick={(e) => selecao.naCaixa(l.item.codigo, e)}
                        />
                      ) : null}
                    </td>
                    <td className="pr-nm">
                      <span className="pr-cod">{l.item.codigo}</span>
                      <b>{l.nome}</b>
                      {l.sub ? <small>{l.sub}</small> : null}
                      {semBase ? (
                        <span className="pr-falta">
                          <Warning size={14} />
                          falta o preço base
                        </span>
                      ) : null}
                    </td>
                    {tabela.faixas.map((f, i) => (
                      <td key={nomeDaFaixa(f)} className={i === 0 ? 'pr-col-base' : ''}>
                        <CampoDePreco
                          codigo={l.item.codigo}
                          faixa={i}
                          celula={celula(tabela, l.item, i, ctx)}
                          rotulo={`${l.item.codigo}, ${i === 0 ? 'preço base' : nomeDaFaixa(f) + ' peças'}`}
                          podeMexer={podeMexer}
                          edicao={edicao}
                          alca={alca}
                        />
                      </td>
                    ))}
                    {(['sub', 'silk'] as const).map((tec, k) => (
                      <td key={tec} className={k === 0 ? 'pr-tec pr-col-tec' : 'pr-tec'}>
                        <CampoDePreco
                          codigo={l.item.codigo}
                          faixa={tabela.faixas.length + k}
                          celula={celulaDaColuna(tabela, l.item, tabela.faixas.length + k, ctx)}
                          rotulo={`${l.item.codigo}, ${tec === 'sub' ? 'Sublimação por peça' : 'Silk por tela'}`}
                          podeMexer={podeMexer}
                          edicao={edicao}
                          alca={alca}
                          vazioDiz="não faz"
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </GrupoDaGrade>
          ))}
          {fora.length ? (
            <>
              <tr className="pr-sep">
                <td colSpan={colunas}>
                  Fora desta tabela, com “{busca.trim()}” · {fora.length}
                </td>
              </tr>
              {fora.map((p) => (
                <tr key={p.codigo} className="pr-fora-linha">
                  <td className="pr-ck-col" />
                  <td className="pr-nm">
                    <span className="pr-cod">{p.codigo}</span>
                    <b>{p.nome}</b>
                    {p.sub ? <small>{p.sub}</small> : null}
                  </td>
                  <td colSpan={colunas - 2} className="pr-fora-acao">
                    {podeMexer ? (
                      <Botao tom="contorno" tamanho="sm" onClick={() => aoPor(p)}>
                        <Plus size={15} />
                        Pôr na tabela
                      </Botao>
                    ) : (
                      <span className="pr-nota">não está nesta tabela</span>
                    )}
                  </td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function GrupoDaGrade({ grupo, cod, colunas, children }: { grupo: string; cod: string; colunas: number; children: ReactNode }) {
  return (
    <>
      <tr className="pr-grupo">
        <td colSpan={colunas}>
          {cod ? <span className="pr-gcod">{cod}</span> : null}
          {grupo}
        </td>
      </tr>
      {children}
    </>
  )
}
