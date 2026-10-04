import { useMemo, type ReactNode } from 'react'
import { TShirt } from '@phosphor-icons/react'
import { Kpi, TituloCartao } from '@ds'
import { quandoFoi } from '@shared'
import {
  fraseDoAcordo,
  miniatura,
  somar,
  somarPorMes,
  somarPorParceiro,
  SOMA_VAZIA,
  type Parceiro,
  type VendaDoParceiro,
} from '@dominio/parceiro'
import { dinheiro, faltaDeAcordo, inteiro, parteNaTela, plural } from './apoio'
import { GraficoPorMes } from './grafico'

/* ==========================================================================
   A visão geral: todos os parceiros juntos.

   É o que aparece quando nenhum parceiro está escolhido: quanto a loja vendeu
   de peças de parceiros no período, quanto disso é deles e quanto fica com a
   Fourtime, o vendido mês a mês, a soma de cada parceiro e as últimas compras.

   "Fica com a Fourtime" é o vendido menos a parte dos parceiros. Peça vendida
   num dia sem acordo ainda não tem parte para descontar, e o cartão diz isso.
   ========================================================================== */

export function VisaoGeral({
  parceiros,
  vendas,
  meses,
  mesAtual,
  larga,
  estreita,
  hoje,
  meio,
}: {
  parceiros: Parceiro[]
  /** as vendas de todos os parceiros no período, da mais nova para a mais velha */
  vendas: VendaDoParceiro[]
  /** os meses do período, do mais velho para o mais novo */
  meses: string[]
  mesAtual: string
  /** a lista de parceiros mora ao lado: aqui entra a tabela do período */
  larga: boolean
  estreita: boolean
  hoje: Date
  /** o que entra entre os números e o gráfico: a lista de parceiros, na tela
      em que ela não cabe ao lado */
  meio?: ReactNode
}) {
  const total = useMemo(() => somar(vendas), [vendas])
  const porMes = useMemo(() => somarPorMes(vendas, meses), [vendas, meses])
  const porParceiro = useMemo(() => somarPorParceiro(vendas), [vendas])
  const nomes = useMemo(() => new Map(parceiros.map(p => [p.id, p.nome])), [parceiros])
  const ultimas = useMemo(
    () => vendas.filter(v => v.conta).slice(0, estreita ? 4 : 6),
    [vendas, estreita],
  )

  const falta = faltaDeAcordo(total)
  const fica = Math.round((total.valor - total.parte) * 100) / 100

  return (
    <>
      <div className="pa-numeros">
        <Kpi rotulo="Peças vendidas" valor={inteiro(total.pecas)} />
        <Kpi rotulo="Total vendido" valor={dinheiro(total.valor)} />
        <Kpi rotulo="Parte dos parceiros" valor={parteNaTela(total)} sub={falta || undefined} />
        <Kpi
          rotulo="Fica com a Fourtime"
          valor={dinheiro(fica)}
          sub={
            total.semAcordo > 0
              ? `sem descontar ${plural(total.semAcordo, 'peça sem acordo', 'peças sem acordo')}`
              : undefined
          }
        />
      </div>

      {meio}

      <GraficoPorMes
        titulo="Vendido por mês"
        total={dinheiro(total.valor)}
        sub="em vendas de peças de parceiros, sem o frete"
        meses={meses}
        valores={porMes.map(s => s.valor)}
        mesAtual={mesAtual}
        minimo={100}
        emDinheiro
        longo={dinheiro}
        curto={v => inteiro(Math.round(v))}
        falado={dinheiro}
      />

      {larga ? (
        <section className="pa-bloco">
          <h2 className="pa-bloco-titulo">Por parceiro, no período</h2>
          <div className="cartao pa-quadro">
            <div className="tabela-rola">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Parceiro</th>
                    <th>Acordo</th>
                    <th className="dir">Peças</th>
                    <th className="dir">Vendido</th>
                    <th className="dir">Parte do parceiro</th>
                  </tr>
                </thead>
                <tbody>
                  {parceiros.map(p => {
                    const s = porParceiro.get(p.id) ?? SOMA_VAZIA
                    return (
                      <tr key={p.id}>
                        <td className="pa-forte">{p.nome}</td>
                        <td className={p.acordo ? undefined : 'pa-falta'}>
                          {fraseDoAcordo(p.acordo)}
                        </td>
                        <td className="dir">{inteiro(s.pecas)}</td>
                        <td className="dir">{dinheiro(s.valor)}</td>
                        <td className="dir pa-forte">{parteNaTela(s)}</td>
                      </tr>
                    )
                  })}
                  <tr className="total">
                    <td>Total</td>
                    <td />
                    <td className="dir">{inteiro(total.pecas)}</td>
                    <td className="dir">{dinheiro(total.valor)}</td>
                    <td className="dir">{parteNaTela(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="cartao cartao-pad pa-ultimas">
        <TituloCartao>Últimas compras</TituloCartao>
        {ultimas.length === 0 ? (
          <p className="pa-ajuda">Nenhuma compra de peça de parceiro no período.</p>
        ) : (
          <ul className="pa-compras">
            {ultimas.map(v => {
              const foto = miniatura(v.imagem)
              return (
                <li key={v.id} className="pa-compra">
                  <span className="pa-foto">
                    {foto ? (
                      <img
                        src={foto}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        onError={e => {
                          e.currentTarget.hidden = true
                        }}
                      />
                    ) : (
                      <TShirt size={18} />
                    )}
                  </span>
                  <span className="pa-nome">
                    <b>{v.produto}</b>
                    <small>
                      {quandoFoi(v.quando, hoje)}
                      {nomes.get(v.parceiroId) ? ` · ${nomes.get(v.parceiroId)}` : ''}
                      {v.pecas > 1 ? ` · ${v.pecas} peças` : ''}
                    </small>
                  </span>
                  <span className="pa-compra-valor">{dinheiro(v.valor)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
