import { useState } from 'react'
import type { KeyboardEvent as EventoDeTecla, ReactNode } from 'react'
import { Marcacao } from '@ds'
import { formatarNumeroExato } from '@shared'
import {
  celula,
  nomeDaFaixa,
  type Contexto,
  type ItemDaTabela,
  type TabelaDePreco,
} from '@dominio/preco'

/* ==========================================================================
   A GRADE DA TABELA (prancha 134): uma linha por referência ou kit, agrupada,
   e uma coluna por faixa de quantidade.

   Em cinza o que veio da regra; com ponto o que foi escrito à mão; a
   primeira faixa é a base, escrita por alguém. Clicar numa célula abre o
   campo: Enter grava, Tab grava e vai para a faixa do lado, Esc desiste.
   Apagar o número de uma faixa à mão devolve ela para a regra.
   ========================================================================== */

/* a classe de cada origem, escrita inteira para a conferencia de ligacoes achar */
const CLASSE_DA_ORIGEM = {
  base: 'pr-v-base',
  mao: 'pr-v-mao',
  regra: 'pr-v-regra',
  kit: 'pr-v-kit',
  vazio: 'pr-v-vazio',
} as const

export type LinhaDaGrade = {
  item: ItemDaTabela
  nome: string
  sub: string
  grupo: string
}

export function GradeDaTabela({
  tabela,
  linhas,
  ctx,
  podeMexer,
  marcados,
  aoMarcar,
  aoEscrever,
}: {
  tabela: TabelaDePreco
  linhas: LinhaDaGrade[]
  ctx: Contexto
  podeMexer: boolean
  marcados: string[]
  aoMarcar: (codigos: string[]) => void
  aoEscrever: (codigo: string, faixa: number, valor: number | null) => void
}) {
  const [editando, setEditando] = useState<{ codigo: string; faixa: number } | null>(null)
  const [texto, setTexto] = useState('')

  const grupos: [string, LinhaDaGrade[]][] = []
  for (const l of linhas) {
    const g = grupos.find(([n]) => n === l.grupo)
    if (g) g[1].push(l)
    else grupos.push([l.grupo, [l]])
  }
  const todos = linhas.map((l) => l.item.codigo)
  const marcouTodos = todos.length > 0 && todos.every((c) => marcados.includes(c))

  function abrir(codigo: string, faixa: number, valor: number | null) {
    if (!podeMexer) return
    setEditando({ codigo, faixa })
    setTexto(valor == null ? '' : formatarNumeroExato(valor))
  }

  function gravar(proxima?: number) {
    if (!editando) return
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const n = limpo === '' ? null : Number(limpo)
    if (n === null || (Number.isFinite(n) && n >= 0)) aoEscrever(editando.codigo, editando.faixa, n)
    if (proxima != null && proxima < tabela.faixas.length) {
      const it = linhas.find((l) => l.item.codigo === editando.codigo)?.item
      const v = it ? celula(tabela, it, proxima, ctx).valor : null
      setEditando({ codigo: editando.codigo, faixa: proxima })
      setTexto(v == null ? '' : formatarNumeroExato(v))
      return
    }
    setEditando(null)
  }

  function tecla(e: EventoDeTecla<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      gravar()
    } else if (e.key === 'Tab' && !e.shiftKey && editando) {
      e.preventDefault()
      gravar(editando.faixa + 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditando(null)
    }
  }

  return (
    <div className="pr-rola">
      <table className="pr-grade">
        <thead>
          <tr>
            <th className="pr-ck-col">
              {podeMexer ? (
                <Marcacao
                  aria-label="Marcar todas"
                  checked={marcouTodos}
                  meio={!marcouTodos && marcados.length > 0}
                  onChange={() => aoMarcar(marcouTodos ? [] : todos)}
                />
              ) : null}
            </th>
            <th className="pr-nm">Referência ou kit</th>
            {tabela.faixas.map((f) => (
              <th key={nomeDaFaixa(f)}>
                {nomeDaFaixa(f)}
                <small>peças</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(([grupo, ls]) => (
            <GrupoDaGrade key={grupo} grupo={grupo} colunas={tabela.faixas.length + 2}>
              {ls.map((l) => {
                const marcado = marcados.includes(l.item.codigo)
                return (
                  <tr key={l.item.codigo} className={marcado ? 'pr-marcada' : ''}>
                    <td className="pr-ck-col">
                      {podeMexer ? (
                        <Marcacao
                          aria-label={'Marcar ' + l.item.codigo}
                          checked={marcado}
                          onChange={() =>
                            aoMarcar(marcado ? marcados.filter((c) => c !== l.item.codigo) : [...marcados, l.item.codigo])
                          }
                        />
                      ) : null}
                    </td>
                    <td className="pr-nm">
                      <span className="pr-cod">{l.item.codigo}</span>
                      <b>{l.nome}</b>
                      {l.sub ? <small>{l.sub}</small> : null}
                    </td>
                    {tabela.faixas.map((f, i) => {
                      const c = celula(tabela, l.item, i, ctx)
                      const aberto = editando?.codigo === l.item.codigo && editando.faixa === i
                      return (
                        <td key={nomeDaFaixa(f)}>
                          {aberto ? (
                            <input
                              className="pr-v pr-v-campo"
                              autoFocus
                              inputMode="decimal"
                              aria-label={`${l.item.codigo}, ${nomeDaFaixa(f)} peças`}
                              value={texto}
                              onChange={(e) => setTexto(e.target.value)}
                              onKeyDown={tecla}
                              onBlur={() => gravar()}
                            />
                          ) : (
                            <button
                              type="button"
                              className={'pr-v ' + CLASSE_DA_ORIGEM[c.origem]}
                              disabled={!podeMexer}
                              title={
                                c.origem === 'mao'
                                  ? 'Escrito à mão. Apague para voltar à regra.'
                                  : c.origem === 'regra'
                                    ? 'Da regra da tabela'
                                    : c.origem === 'kit'
                                      ? 'Soma das peças do kit, com o desconto do kit'
                                      : c.origem === 'vazio'
                                        ? 'Sem preço'
                                        : 'A base, escrita por alguém'
                              }
                              onClick={() => abrir(l.item.codigo, i, c.valor)}
                            >
                              {c.valor == null ? '·' : formatarNumeroExato(c.valor)}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </GrupoDaGrade>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GrupoDaGrade({ grupo, colunas, children }: { grupo: string; colunas: number; children: ReactNode }) {
  return (
    <>
      <tr className="pr-grupo">
        <td colSpan={colunas}>{grupo}</td>
      </tr>
      {children}
    </>
  )
}
