import type { CSSProperties, ReactNode } from 'react'
import { TituloCartao } from '@ds'
import { nomeDoMes } from '@shared'
import { degrauDoEixo, mesCurto, rotuloDoEixo } from './apoio'

/* ==========================================================================
   O gráfico de barras por mês.

   Uma barra por mês do período, da mais velha para a mais nova. É o mesmo
   desenho do gráfico da página do parceiro, na loja: o eixo tem três degraus
   redondos, o mês em andamento vem mais claro, e o número fica à mostra nas
   últimas barras. Nas outras ele aparece ao apontar a barra ou ao chegar nela
   pelo teclado.

   Uma série só, e por isso sem legenda: o título do cartão diz o que é. A cor
   é a tinta do sistema, que vira junto com o tema.
   ========================================================================== */

export function GraficoPorMes({
  titulo,
  total,
  sub,
  meses,
  valores,
  mesAtual,
  minimo,
  emDinheiro,
  longo,
  curto,
  falado,
}: {
  titulo: string
  /** o número grande, que é a soma do período */
  total: ReactNode
  sub: ReactNode
  /** as chaves dos meses ("2026-05"), do mais velho para o mais novo */
  meses: string[]
  valores: number[]
  /** o mês em andamento, que fica mais claro */
  mesAtual: string
  /** o menor degrau do eixo: 1 para peça, 100 para dinheiro */
  minimo: number
  emDinheiro: boolean
  /** o número em cima da barra, e a forma curta dele para o cartão estreito */
  longo: (v: number) => string
  curto: (v: number) => string
  /** como o leitor de tela diz o valor: "6 peças", "R$ 1.559,40" */
  falado: (v: number) => string
}) {
  const passo = degrauDoEixo(Math.max(0, ...valores), minimo)
  const teto = passo * 3
  /* com muitos meses as barras ficam perto: só a última mostra o número */
  const fixas = meses.length <= 6 ? 2 : 1

  return (
    <section
      className={
        meses.length > 6 ? 'cartao cartao-pad pa-grafico muitos' : 'cartao cartao-pad pa-grafico'
      }
    >
      <TituloCartao>{titulo}</TituloCartao>
      <div className="pa-grafico-cabeca">
        <b className="pa-grafico-numero">{total}</b>
        <span className="pa-ajuda">{sub}</span>
      </div>
      <div className="pa-grafico-area">
        <div className="pa-grafico-eixo" aria-hidden="true">
          {[3, 2, 1, 0].map(k => (
            <span key={k}>{rotuloDoEixo(passo * k, emDinheiro)}</span>
          ))}
        </div>
        <div className="pa-grafico-barras" role="list" aria-label={`${titulo} por mês`}>
          {meses.map((m, i) => {
            const v = valores[i] ?? 0
            const classes = [
              'pa-coluna',
              i >= meses.length - fixas ? 'fixa' : '',
              m === mesAtual ? 'andamento' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div
                key={m}
                className={classes}
                role="listitem"
                tabIndex={0}
                aria-label={`${nomeDoMes(m)}: ${falado(v)}`}
                style={{ '--v': String(Math.max(0, Math.min(1, v / teto))) } as CSSProperties}
              >
                <span className="pa-coluna-valor">
                  <span className="longo">{longo(v)}</span>
                  <span className="curto">{curto(v)}</span>
                </span>
                <span className="pa-coluna-barra" />
              </div>
            )
          })}
        </div>
        <div className="pa-grafico-meses" aria-hidden="true">
          {meses.map(m => (
            <span key={m}>{mesCurto(m)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
