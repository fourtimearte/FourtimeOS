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

   Peca compartilhada: na cotacao ela vem com as colunas de valor; na ficha,
   so com quantidade. Por isso as colunas de dinheiro sao opcionais.

   A regra do fora de faixa vem do v3.375 e existe porque ninguem digita
   tamanho infantil numa grade adulta por acidente. Quando acontece, e de
   proposito, e precisa ser visto do outro lado da mesa de corte: por isso o
   tamanho sobe para o topo (ou desce para o fim) e ganha fundo de sinal.
   ========================================================================== */

const FAIXAS: { valor: Faixa; rotulo: string }[] = [
  { valor: 'adulto', rotulo: 'Adulto' },
  { valor: 'infantil', rotulo: 'Infantil' },
]

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
  /* as tres de baixo so aparecem na cotacao */
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

  function lancar(t: Tamanho, texto: string) {
    if (!aoMudar) return
    const n = Math.max(0, Math.round(Number(texto.replace(/\D/g, '')) || 0))
    const nova: Grade = { ...grade }
    if (n > 0) nova[t] = n
    else delete nova[t]
    aoMudar(nova)
  }

  return (
    <div className="gr">
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
            {visiveis.map((t) => {
              const fora = faixaDoTamanho(t) !== faixa
              const qtd = grade[t] ?? 0
              return (
                <tr key={t} data-fora={fora ? faixaDoTamanho(t) : undefined}>
                  <td className="gr-tam">{t}</td>
                  <td className="num">
                    {leitura ? (
                      qtd || ''
                    ) : (
                      <input
                        className="gr-campo"
                        inputMode="numeric"
                        value={qtd || ''}
                        onChange={(e) => lancar(t, e.target.value)}
                        aria-label={'Peças no tamanho ' + t}
                      />
                    )}
                  </td>
                  {comDinheiro ? (
                    <td className="num">
                      {leitura ? (
                        dinheiro(precoDe(t))
                      ) : (
                        <input
                          className="gr-campo"
                          inputMode="decimal"
                          placeholder={dinheiro(precoBase ?? 0)}
                          value={precoPorTamanho?.[t] !== undefined ? String(precoPorTamanho[t]) : ''}
                          onChange={(e) => {
                            const cru = e.target.value.replace(',', '.')
                            aoMudarPreco?.(t, cru.trim() === '' ? null : Number(cru) || 0)
                          }}
                          aria-label={'Valor do tamanho ' + t}
                        />
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
