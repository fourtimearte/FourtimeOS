import { useRef, useState } from 'react'
import type { PointerEvent as EventoDePonteiro } from 'react'
import { Table } from '@phosphor-icons/react'
import { Segmentado, TituloCartao } from '@ds'
import { GradeDeTamanhos, foraDaFaixa, tamanhosNaOrdem, type Faixa, type Grade, type Tamanho } from '@dominio/layout'
import { pecasDoProduto, totalDoProduto, type ProdutoCotado } from '@dominio/cotacao'
import './cotacao.css'

/* ==========================================================================
   A GRADE E VALORES, DEITADA (prancha 109): uma coluna por tamanho, com as
   peças, o valor e o total de cada um, e a soma na última coluna. Deitada ela
   cabe embaixo da arte sem empurrar a ficha para fora da primeira tela.

   O valor em cinza é o da tabela de preço (o precoBase): escrever por cima
   muda só aquele tamanho, e apagar volta ao da tabela. A alça de cada célula
   repete o número nas vizinhas, arrastando para o lado, como na v3.375.
   ========================================================================== */

const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const lerNumero = (t: string): number | null => {
  const limpo = t.trim().replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n >= 0 ? n : null
}

type Linha = 'pecas' | 'valor'

export function CartaoDaGrade({
  produto,
  travado,
  aoMudarProduto,
}: {
  produto: ProdutoCotado
  travado: boolean
  aoMudarProduto: (troca: (p: ProdutoCotado) => ProdutoCotado) => void
}) {
  const b = produto.bloco
  const tamanhos = tamanhosNaOrdem(b.faixa, b.grade)
  const [editando, setEditando] = useState<{ linha: Linha; t: string; texto: string } | null>(null)
  /* a alça: de onde o arrasto começou e até onde ele foi */
  const [alca, setAlca] = useState<{ linha: Linha; de: number; ate: number } | null>(null)
  const tabela = useRef<HTMLTableElement>(null)

  const mudarGrade = (g: Grade) => aoMudarProduto((p) => ({ ...p, bloco: { ...p.bloco, grade: g } }))
  const mudarFaixa = (f: Faixa) => aoMudarProduto((p) => ({ ...p, bloco: { ...p.bloco, faixa: f } }))
  const preco = (t: string) => produto.precoPorTamanho[t] ?? produto.precoBase

  function gravar(linha: Linha, alvos: string[], n: number | null) {
    if (linha === 'pecas') {
      const g: Grade = { ...b.grade }
      for (const t of alvos) {
        if (n && n > 0) g[t as Tamanho] = Math.round(n)
        else delete g[t as Tamanho]
      }
      mudarGrade(g)
    } else {
      aoMudarProduto((p) => {
        const novo = { ...p.precoPorTamanho }
        for (const t of alvos) {
          if (n === null || n === p.precoBase) delete novo[t]
          else novo[t] = n
        }
        return { ...p, precoPorTamanho: novo }
      })
    }
  }

  function texto(linha: Linha, t: string): string {
    if (editando && editando.linha === linha && editando.t === t) return editando.texto
    if (linha === 'pecas') return b.grade[t as Tamanho] ? String(b.grade[t as Tamanho]) : ''
    return preco(t) ? n2(preco(t)) : ''
  }

  /* O ARRASTO DA ALÇA: a célula de origem vale para todas até onde o ponteiro
     chegou, na mesma linha. Solta, grava de uma vez. */
  function comecarAlca(e: EventoDePonteiro, linha: Linha, i: number) {
    e.preventDefault()
    e.stopPropagation()
    setAlca({ linha, de: i, ate: i })
    const mover = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-col]')
      if (el && tabela.current?.contains(el)) setAlca((a) => (a ? { ...a, ate: Number(el.dataset.col) } : a))
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      setAlca((a) => {
        if (a && a.ate !== a.de) {
          const [x, y] = a.de < a.ate ? [a.de, a.ate] : [a.ate, a.de]
          const alvos = tamanhos.slice(x, y + 1)
          const origem = tamanhos[a.de]
          const valor = a.linha === 'pecas' ? (b.grade[origem] ?? null) : preco(origem)
          gravar(a.linha, alvos, valor)
        }
        return null
      })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const naAlca = (linha: Linha, i: number) =>
    !!alca && alca.linha === linha && i >= Math.min(alca.de, alca.ate) && i <= Math.max(alca.de, alca.ate)

  function celula(linha: Linha, t: Tamanho, i: number) {
    const proprio = linha === 'valor' && produto.precoPorTamanho[t] != null
    const classes = [
      'ct-gd-campo',
      linha === 'valor' && !proprio ? 'ct-gd-base' : '',
      foraDaFaixa(b.faixa, t) ? 'ct-gd-fora' : '',
      naAlca(linha, i) ? 'ct-gd-alca-sel' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <td key={t} data-col={i} className="ct-gd-cel">
        <input
          className={classes}
          inputMode={linha === 'pecas' ? 'numeric' : 'decimal'}
          disabled={travado}
          value={texto(linha, t)}
          placeholder={linha === 'pecas' ? '0' : ''}
          aria-label={(linha === 'pecas' ? 'Peças no ' : 'Valor do ') + t}
          onFocus={(e) => {
            setEditando({ linha, t, texto: texto(linha, t) })
            e.currentTarget.select()
          }}
          onChange={(e) => setEditando({ linha, t, texto: e.target.value })}
          onBlur={() => {
            if (editando && editando.linha === linha && editando.t === t) gravar(linha, [t], lerNumero(editando.texto))
            setEditando(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setEditando(null)
              e.currentTarget.blur()
            }
          }}
        />
        {!travado ? (
          <span
            className="ct-gd-alca"
            aria-hidden="true"
            title="Arraste para repetir nas vizinhas"
            onPointerDown={(e) => comecarAlca(e, linha, i)}
          />
        ) : null}
      </td>
    )
  }

  const pecas = pecasDoProduto(produto)
  const total = totalDoProduto(produto)

  return (
    <section className="cartao ct-gd">
      <header className="ct-gd-cab">
        <TituloCartao icone={Table}>Grade e valores</TituloCartao>
        {!travado ? (
          <Segmentado
            valor={b.faixa}
            opcoes={[
              { valor: 'adulto', rotulo: 'Adulta' },
              { valor: 'infantil', rotulo: 'Infantil' },
            ]}
            aoMudar={(v) => mudarFaixa(v as Faixa)}
          />
        ) : null}
      </header>
      {/* NO CELULAR a grade fica EM PÉ: deitada, doze colunas não cabem em 360
          px, e tabela que rola de lado esconde o número que a pessoa veio ver.
          É a grade de sempre do módulo de layout, com o mesmo dado. */}
      <div className="ct-gd-empe">
        <GradeDeTamanhos
          leitura={travado}
          faixa={b.faixa}
          grade={b.grade}
          aoMudar={travado ? undefined : mudarGrade}
          precoBase={produto.precoBase}
          precoPorTamanho={produto.precoPorTamanho}
          aoMudarPreco={(t, valor) => gravar('valor', [t], valor)}
        />
      </div>
      <div className="ct-gd-rolo">
        <table className="ct-gd-tab" ref={tabela}>
          <thead>
            <tr>
              <th scope="col" className="ct-gd-rot">
                Tamanho
              </th>
              {tamanhos.map((t) => (
                <th scope="col" key={t} className={foraDaFaixa(b.faixa, t) ? 'ct-gd-fora' : undefined}>
                  {t}
                </th>
              ))}
              <th scope="col" className="ct-gd-soma">
                Soma
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="ct-gd-rot">
                Peças
              </th>
              {tamanhos.map((t, i) => celula('pecas', t, i))}
              <td className="ct-gd-soma">
                <b>{pecas}</b>
              </td>
            </tr>
            <tr>
              <th scope="row" className="ct-gd-rot">
                Valor
              </th>
              {tamanhos.map((t, i) => celula('valor', t, i))}
              <td className="ct-gd-soma" />
            </tr>
            <tr className="ct-gd-total">
              <th scope="row" className="ct-gd-rot">
                Total
              </th>
              {tamanhos.map((t) => {
                const n = b.grade[t] ?? 0
                return <td key={t}>{n ? n2(n * preco(t)) : ''}</td>
              })}
              <td className="ct-gd-soma">
                <b>{n2(total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {!travado ? (
        <p className="ct-gd-nota">
          O valor em cinza é o da tabela de preço. Escreva por cima para mudar só naquele tamanho; apague para voltar ao
          da tabela. Arraste pela alça de uma célula para repetir o número nas vizinhas.
        </p>
      ) : null}
    </section>
  )
}
