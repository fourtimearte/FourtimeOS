import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoDePonteiro } from 'react'
import { Segmentado } from '@ds'
import {
  faixaDoTamanho,
  tamanhosNaOrdem,
  totalDaGrade,
  type Faixa,
  type Grade,
  type Tamanho,
} from './grade'
import './layout.css'

/* ==========================================================================
   A grade de tamanhos.

   Peca compartilhada: na cotacao e na ficha de producao ela e a mesma, e as
   colunas de dinheiro aparecem ou somem conforme o modo. Nao sao duas
   tabelas: e uma, com e sem valor.

   A regra do fora de faixa vem do v3.375 e existe porque ninguem digita
   tamanho infantil numa grade adulta por acidente. Quando acontece, e de
   proposito, e precisa ser visto do outro lado da mesa de corte: por isso o
   tamanho sobe para o topo (ou desce para o fim) e ganha fundo de sinal.

   A ALCA DE PREENCHIMENTO (v174 do editor) e a ferramenta que o vendedor
   usa mais: pega o quadradinho no canto da celula, arrasta para baixo, e o
   valor desce para as celulas cobertas. Um orcamento de vinte layouts com o
   mesmo preco em dez tamanhos e duzentas digitacoes sem ela.
   ========================================================================== */

const FAIXAS: { valor: Faixa; rotulo: string }[] = [
  { valor: 'adulto', rotulo: 'Adulto' },
  { valor: 'infantil', rotulo: 'Infantil' },
]

type Coluna = 'q' | 'u'
type Arrasto = { col: Coluna; de: number; ate: number }

export function GradeDeTamanhos({
  faixa,
  grade,
  aoMudar,
  aoTrocarFaixa,
  precoBase,
  precoPorTamanho,
  aoMudarPreco,
  leitura,
}: {
  faixa: Faixa
  grade: Grade
  aoMudar?: (g: Grade) => void
  aoTrocarFaixa?: (f: Faixa) => void
  /* as tres de baixo so aparecem quando o modo e com valor */
  precoBase?: number
  precoPorTamanho?: Partial<Record<string, number>>
  aoMudarPreco?: (tamanho: string, valor: number | null) => void
  leitura?: boolean
}) {
  const comDinheiro = precoBase !== undefined
  const tamanhos = tamanhosNaOrdem(faixa, grade)
  const visiveis = leitura ? tamanhos.filter((t) => (grade[t] ?? 0) > 0) : tamanhos

  const precoDe = (t: string) => precoPorTamanho?.[t] ?? precoBase ?? 0
  const total = visiveis.reduce((s, t) => s + (grade[t] ?? 0) * precoDe(t), 0)

  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  /* O arrasto vive numa referencia tambem: o ouvinte de soltar e registrado
     uma vez, e um estado capturado no fecho dele estaria sempre velho. */
  const emCurso = useRef<Arrasto | null>(null)
  emCurso.current = arrasto

  function lancar(t: Tamanho, texto: string) {
    if (!aoMudar) return
    const n = Math.max(0, Math.round(Number(texto.replace(/\D/g, '')) || 0))
    const nova: Grade = { ...grade }
    if (n > 0) nova[t] = n
    else delete nova[t]
    aoMudar(nova)
  }

  /* --- a alca ------------------------------------------------------------ */

  const faixaDoArrasto = (a: Arrasto) => {
    const de = Math.min(a.de, a.ate)
    const ate = Math.max(a.de, a.ate)
    return { de, ate }
  }

  const dentroDoArrasto = (i: number) => {
    if (!arrasto) return false
    const { de, ate } = faixaDoArrasto(arrasto)
    return i >= de && i <= ate
  }

  function pegarAlca(e: EventoDePonteiro<HTMLElement>, col: Coluna, i: number) {
    if (leitura) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setArrasto({ col, de: i, ate: i })
  }

  function arrastarAlca(e: EventoDePonteiro<HTMLElement>) {
    if (!arrasto) return
    /* com a captura do ponteiro, o pointerenter das outras linhas nao chega:
       quem diz em que linha o dedo esta e o proprio ponto na tela */
    const sob = document.elementFromPoint(e.clientX, e.clientY)
    const linha = sob instanceof Element ? sob.closest('tr[data-i]') : null
    if (!(linha instanceof HTMLElement)) return
    const i = Number(linha.dataset.i)
    if (Number.isNaN(i) || i === arrasto.ate) return
    setArrasto({ ...arrasto, ate: i })
  }

  const soltarAlca = useCallback(() => {
    const a = emCurso.current
    setArrasto(null)
    if (!a) return
    const de = Math.min(a.de, a.ate)
    const ate = Math.max(a.de, a.ate)
    if (de === ate) return

    const origem = visiveis[a.de]
    if (!origem) return

    if (a.col === 'q') {
      if (!aoMudar) return
      const valor = grade[origem] ?? 0
      const nova: Grade = { ...grade }
      for (let i = de; i <= ate; i++) {
        const t = visiveis[i]
        if (!t) continue
        if (valor > 0) nova[t] = valor
        else delete nova[t]
      }
      aoMudar(nova)
      return
    }

    if (!aoMudarPreco) return
    const valor = precoPorTamanho?.[origem]
    for (let i = de; i <= ate; i++) {
      const t = visiveis[i]
      if (t) aoMudarPreco(t, valor === undefined ? null : valor)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [grade, visiveis, aoMudar, aoMudarPreco, precoPorTamanho])

  useEffect(() => {
    if (!arrasto) return
    window.addEventListener('pointerup', soltarAlca)
    window.addEventListener('pointercancel', soltarAlca)
    return () => {
      window.removeEventListener('pointerup', soltarAlca)
      window.removeEventListener('pointercancel', soltarAlca)
    }
  }, [arrasto, soltarAlca])

  const alca = (col: Coluna, i: number) =>
    leitura ? null : (
      <span
        className="gr-alca"
        title="Arraste para repetir para baixo"
        onPointerDown={(e) => pegarAlca(e, col, i)}
        onPointerMove={arrastarAlca}
      />
    )

  return (
    <div className={arrasto ? 'gr arrastando' : 'gr'}>
      {aoTrocarFaixa ? (
        <div className="gr-topo">
          <Segmentado valor={faixa} opcoes={FAIXAS} aoMudar={aoTrocarFaixa} />
          <span className="gr-dica">
            Tamanho da outra faixa aparece destacado e fora da ordem, de propósito.
          </span>
        </div>
      ) : null}

      <div className="gr-rolo">
        <table className="gr-tab">
          <thead>
            <tr>
              <th>Tamanho</th>
              <th className="num">Peças</th>
              {comDinheiro ? <th className="num">Valor</th> : null}
              {comDinheiro ? <th className="num">Total</th> : null}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((t, i) => {
              const fora = faixaDoTamanho(t) !== faixa
              const qtd = grade[t] ?? 0
              const pintada = (col: Coluna) =>
                arrasto?.col === col && dentroDoArrasto(i) ? 'num gr-pintada' : 'num'
              return (
                <tr key={t} data-i={i} data-fora={fora ? faixaDoTamanho(t) : undefined}>
                  <td className="gr-tam">{t}</td>
                  <td className={pintada('q')}>
                    {leitura ? (
                      qtd || ''
                    ) : (
                      <>
                        <input
                          className="gr-campo"
                          inputMode="numeric"
                          value={qtd || ''}
                          onChange={(e) => lancar(t, e.target.value)}
                          aria-label={'Peças no tamanho ' + t}
                        />
                        {alca('q', i)}
                      </>
                    )}
                  </td>
                  {comDinheiro ? (
                    <td className={pintada('u')}>
                      {leitura ? (
                        dinheiro(precoDe(t))
                      ) : (
                        <>
                          <input
                            className="gr-campo"
                            inputMode="decimal"
                            placeholder={dinheiro(precoBase ?? 0)}
                            value={
                              precoPorTamanho?.[t] !== undefined ? String(precoPorTamanho[t]) : ''
                            }
                            onChange={(e) => {
                              const cru = e.target.value.replace(',', '.')
                              aoMudarPreco?.(t, cru.trim() === '' ? null : Number(cru) || 0)
                            }}
                            aria-label={'Valor do tamanho ' + t}
                          />
                          {alca('u', i)}
                        </>
                      )}
                    </td>
                  ) : null}
                  {comDinheiro ? (
                    <td className="num gr-linha-total">{qtd ? dinheiro(qtd * precoDe(t)) : ''}</td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{totalDaGrade(grade)}</td>
              {comDinheiro ? <td className="num" /> : null}
              {comDinheiro ? <td className="num">{dinheiro(total)}</td> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function dinheiro(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** A grade escrita numa linha, com o fora de faixa destacado. Usada no resumo. */
export function GradeEmLinha({ faixa, grade }: { faixa: Faixa; grade: Grade }) {
  const tamanhos = tamanhosNaOrdem(faixa, grade).filter((t) => (grade[t] ?? 0) > 0)
  return (
    <span className="gr-linha">
      {tamanhos.map((t) => (
        <span
          key={t}
          className="gr-par"
          data-fora={faixaDoTamanho(t) !== faixa ? faixaDoTamanho(t) : undefined}
        >
          <b>{t}</b>
          {grade[t]}
        </span>
      ))}
    </span>
  )
}
