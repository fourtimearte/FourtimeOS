import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Sigma, Warning } from '@phosphor-icons/react'
import { Aviso, Botao, Kpi, TituloCartao } from '@ds'
import { numeroNaUnidade, type MaterialDaFila, type PedidoNaSeparacao } from '@dominio/estoque'
import { dataCurta, diasAte } from './fila'

/* ==========================================================================
   NADA ESCOLHIDO (prancha 82): a fila inteira de uma vez.

   Os quatro números (quantos pedidos, quantas peças, a entrega mais próxima e
   quantos a prateleira não cobre), a SOMA DA FILA, que é o que a fila inteira
   ainda vai tirar de cada material contra o que está na prateleira, e o
   cartão FALTA NA PRATELEIRA, com o pedido que desce com falta.

   A soma mostra primeiro o que falta e o que fica mais apertado; o resto, que
   está coberto, abre com um clique.
   ========================================================================== */

const VISIVEIS = 8
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function ResumoDaFila({
  fila,
  materiais,
  aoAbrirPedido,
}: {
  fila: PedidoNaSeparacao[]
  /** null: a 061 não rodou e a soma não existe ainda */
  materiais: MaterialDaFila[] | null
  aoAbrirPedido: (numero: string) => void
}) {
  const [tudo, setTudo] = useState(false)
  const pecas = fila.reduce((s, p) => s + p.pecas, 0)
  const layouts = fila.reduce((s, p) => s + p.layouts, 0)
  const proxima = fila.filter((p) => p.entregaEm).sort((a, b) => a.entregaEm.localeCompare(b.entregaEm))[0]
  const dias = proxima ? diasAte(proxima.entregaEm) : null
  const naoCobre = fila.filter((p) => p.naoCobre > 0).length
  const faltas = (materiais ?? []).filter((m) => m.depois < 0)
  const linhas = materiais ? (tudo ? materiais : materiais.slice(0, VISIVEIS)) : []
  const cobertos = materiais ? materiais.length - linhas.length : 0

  return (
    <div className="sp-resumo">
      <div className="sp-kpis">
        <Kpi rotulo="Na fila" valor={fila.length} unidade={fila.length === 1 ? 'pedido' : 'pedidos'} sub="da aprovação até o PCP" />
        <Kpi
          rotulo="Peças"
          valor={pecas.toLocaleString('pt-BR')}
          unidade="pçs"
          sub={layouts ? 'em ' + plural(layouts, 'layout', 'layouts') : 'na fila inteira'}
        />
        <Kpi
          rotulo="Entrega mais próxima"
          valor={proxima ? dataCurta(proxima.entregaEm) : '-'}
          sub={
            proxima
              ? (proxima.cliente || proxima.numero) +
                (dias === null ? '' : dias < 0 ? ', atrasada' : dias === 0 ? ', hoje' : `, em ${plural(dias, 'dia', 'dias')}`)
              : 'nenhum pedido com data'
          }
        />
        <Kpi
          rotulo="A prateleira não cobre"
          valor={naoCobre}
          unidade={naoCobre === 1 ? 'pedido' : 'pedidos'}
          sub={naoCobre ? 'vai descer com falta' : 'tudo coberto'}
          aviso={naoCobre > 0}
        />
      </div>

      <div className="sp-resumo-par">
        <section className="cartao sp-soma" aria-label="Soma da fila">
          <header className="sp-cab">
            <TituloCartao icone={Sigma}>Soma da fila</TituloCartao>
            <span className="sp-cab-apoio">os {plural(fila.length, 'pedido', 'pedidos')} juntos</span>
          </header>
          {materiais === null ? (
            <div className="sp-cartao-corpo">
              <Aviso tom="warn" titulo="A soma da fila ainda não existe no banco">
                Falta rodar a migração 061. A fila e a separação de cada pedido funcionam sem ela.
              </Aviso>
            </div>
          ) : !materiais.length ? (
            <p className="ct-nada sp-cartao-corpo">Nenhum material a separar: o que a fila pedia já saiu da prateleira.</p>
          ) : (
            <>
              <div className="sp-tabela-caixa">
                <table className="sp-tabela">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="num">A fila pede</th>
                      <th className="num">Na prateleira</th>
                      <th className="num">Depois de separar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((m) => (
                      <tr key={m.materialId} className={m.depois < 0 ? 'falta' : undefined} data-material={m.material}>
                        <td>
                          <span className="sp-mat">
                            {m.categoria === 'tecido' ? (
                              <i className="sp-q" style={{ '--cor': m.corHex || 'var(--surface-3)' } as CSSProperties} />
                            ) : null}
                            <span>{m.material}</span>
                          </span>
                        </td>
                        <td className="num">
                          <b>{m.pede ? numeroNaUnidade(m.pede, m.unidade) : 'sem consumo'}</b>
                        </td>
                        <td className="num">{numeroNaUnidade(m.saldo, m.unidade)}</td>
                        <td className="num">
                          {m.depois < 0 ? (
                            <b className="sp-pouco">falta {numeroNaUnidade(-m.depois, m.unidade)}</b>
                          ) : (
                            <span className="sp-apoio">sobra {numeroNaUnidade(m.depois, m.unidade)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {materiais.length > VISIVEIS ? (
                <button type="button" className="sp-mais" onClick={() => setTudo((x) => !x)}>
                  {tudo
                    ? 'Mostrar só os primeiros ' + VISIVEIS
                    : `Ver os ${materiais.length} materiais · os outros ${cobertos} estão cobertos`}
                </button>
              ) : null}
            </>
          )}
        </section>

        <section className="cartao sp-falta" aria-label="Falta na prateleira">
          <header className="sp-cab">
            <TituloCartao icone={Warning}>Falta na prateleira</TituloCartao>
            <span className="sp-cab-apoio">{plural(faltas.length, 'material', 'materiais')}</span>
          </header>
          {materiais === null ? (
            <p className="ct-nada sp-cartao-corpo">Depende da soma da fila (migração 061).</p>
          ) : !faltas.length ? (
            <p className="ct-nada sp-cartao-corpo">A prateleira cobre a fila inteira. Nenhum pedido desce com falta.</p>
          ) : (
            <>
              <ul className="sp-faltas">
                {faltas.map((m) => (
                  <li key={m.materialId}>
                    {m.categoria === 'tecido' ? (
                      <i className="sp-q" style={{ '--cor': m.corHex || 'var(--surface-3)' } as CSSProperties} />
                    ) : null}
                    <span className="pilha colada">
                      <b>{m.material}</b>
                      <small>
                        falta {numeroNaUnidade(-m.depois, m.unidade)} · {m.numeros.join(', ')}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="sp-falta-pe">
                <p>
                  O pedido pode descer com falta: quem decide é o PCP e o diretor. Pedir a compra põe o material em
                  Para comprar, no Estoque.
                </p>
                <div className="fileira">
                  <Botao tom="contorno" onClick={() => aoAbrirPedido(faltas[0].numeros[faltas[0].numeros.length - 1] ?? '')}>
                    Abrir o pedido
                  </Botao>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
