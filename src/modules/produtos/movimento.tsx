import { Fragment, type ReactNode } from 'react'
import { Kpi, Vazio } from '@ds'
import { MES_LONGO, lerMes } from '@shared'
import {
  codigoCurto,
  movimentoPorReferencia,
  type LayoutVendido,
  type LinhaDoMovimento,
  type Movimento as MovimentoDoMes,
  type PecasDosKits,
  type PedidoNoMovimento,
} from '@dominio/produto'
import { plural } from './apoio'
import { Gradinha, Tecnicas, codigosDe, emUnidades, numero, ondeEsta, quandoFicou } from './vendas'

/* ==========================================================================
   O Movimento (prancha 62): as peças feitas, orçamento por orçamento.

   O QUE ENTRA NUM MÊS: o layout que ficou pronto nele e, no mês que está
   correndo, o que ainda está na fábrica. O pedido que só foi aprovado, e
   ainda está na Separação ou no PCP, não é movimento: ele aparece nas
   Estatísticas, que contam venda.

   POR ORÇAMENTO responde "o que saiu de cada pedido". POR REFERÊNCIA junta
   as mesmas linhas pela peça, e responde "em que pedidos esta peça andou".

   OS NÚMEROS DE CIMA SÃO DO MÊS, e não da busca: quem procura um cliente não
   quer ver o total do mês virar o total daquele cliente.

   No celular a tabela vira lista, como no Estoque: seis colunas em 390 px são
   seis colunas que ninguém lê.
   ========================================================================== */

export type Agrupar = 'orcamento' | 'referencia'
export type Situacao = 'tudo' | 'producao' | 'pronto'

const nomeDoMes = (chave: string) => MES_LONGO[lerMes(chave).mes]

/** O nome da peça: um botão quando a ficha dela existe, e texto quando não. */
function Nome({ l, abrir }: { l: LayoutVendido; abrir: (() => void) | null }) {
  return abrir ? (
    <button type="button" className="pd-liga" onClick={abrir}>
      {l.nome || 'sem nome'}
    </button>
  ) : (
    <b>{l.nome || 'sem nome'}</b>
  )
}

const layoutEArte = (l: LayoutVendido) => 'Layout ' + l.layout + (l.arte ? ' · ' + l.arte : '')

export function Movimento({
  doMes,
  pedidos,
  agrupar,
  mes,
  mesAtual,
  kits,
  hoje,
  celular,
  filtrando,
  aoAbrir,
}: {
  /** o mês inteiro, sem busca e sem filtro: é de onde saem os números de cima */
  doMes: MovimentoDoMes
  /** o que a tabela mostra: já com a busca e com Tudo, Em produção ou Pronto */
  pedidos: PedidoNoMovimento[]
  agrupar: Agrupar
  mes: string
  mesAtual: string
  kits: PecasDosKits
  hoje: Date
  celular: boolean
  /** há busca ou filtro ligado: muda o que o vazio diz */
  filtrando: boolean
  /** devolve o que abre a ficha da peça ou do kit; nulo quando ela não está no catálogo */
  aoAbrir: (l: LayoutVendido) => (() => void) | null
}) {
  const noMes = mes === mesAtual ? `em ${nomeDoMes(mes)}, até hoje` : `em ${nomeDoMes(mes)}`

  const numeros = (
    <div className="pd-numeros-caixa">
      <div className="fila-kpi pd-kpis" data-numeros="movimento">
        <Kpi rotulo="Peças feitas" valor={numero(doMes.pecasFeitas)} unidade="pçs" sub={noMes} />
        <Kpi
          rotulo="Orçamentos"
          valor={numero(doMes.orcamentosComPecaFeita)}
          sub="com peça feita no mês"
        />
        <Kpi
          rotulo="Kits feitos"
          valor={numero(doMes.kitsFeitos)}
          unidade={doMes.kitsFeitos === 1 ? 'kit' : 'kits'}
          sub="cada kit conta as peças dele"
        />
        <Kpi
          rotulo="Em produção agora"
          valor={numero(doMes.pecasEmProducao)}
          unidade="pçs"
          sub={
            doMes.orcamentosEmProducao
              ? 'em ' + plural(doMes.orcamentosEmProducao, 'orçamento', 'orçamentos')
              : 'nada na fábrica'
          }
        />
      </div>
    </div>
  )

  if (!pedidos.length) {
    return (
      <>
        {numeros}
        <section className="cartao pd-quadro" data-movimento="vazio">
          {filtrando ? (
            <Vazio titulo="Nada neste filtro" texto="Nenhuma peça combina com o que está escolhido e com a busca." />
          ) : mes === mesAtual ? (
            <Vazio
              titulo={`Nada em ${nomeDoMes(mes)} ainda`}
              texto="Aqui aparecem as peças que ficaram prontas no mês e as que estão na fábrica agora. Elas entram quando o PCP libera o pedido para a produção."
            />
          ) : (
            <Vazio titulo={`Nada ficou pronto em ${nomeDoMes(mes)}`} texto="Nenhuma peça foi finalizada neste mês." />
          )}
        </section>
      </>
    )
  }

  /* as mesmas linhas, de um jeito ou de outro: cada grupo tem o título e as linhas dele */
  type Grupo = { chave: string; titulo: ReactNode; linhas: LinhaDoMovimento[] }
  const grupos: Grupo[] =
    agrupar === 'orcamento'
      ? pedidos.map(g => ({
          chave: g.pedidoId,
          titulo: (
            <span className="pd-grupo-nome" data-grupo-do-movimento={g.numero}>
              <b>
                {g.numero}
                {g.cliente ? ' · ' + g.cliente : ''}
              </b>
              {[quandoFicou(g.quando, hoje), plural(g.pecasDeRoupa, 'peça', 'peças')].filter(Boolean).join(' · ')}
              {g.teste ? <span className="pd-marca-teste">teste</span> : null}
            </span>
          ),
          linhas: g.linhas,
        }))
      : movimentoPorReferencia(pedidos).map(r => ({
          chave: r.chave,
          titulo: (
            <span className="pd-grupo-nome" data-grupo-do-movimento={r.cod ? codigoCurto(r.cod) : r.nome}>
              <b>
                {r.nome || 'sem nome'}
                {r.kit && r.referenciaId && kits[r.referenciaId]?.length
                  ? ' · ' + kits[r.referenciaId].map(p => codigoCurto(p.cod)).join(' + ')
                  : r.cod
                    ? ' · ' + codigoCurto(r.cod)
                    : ''}
              </b>
              {emUnidades(r.unidades, r.kit)} · em {plural(r.orcamentos, 'orçamento', 'orçamentos')}
            </span>
          ),
          linhas: r.linhas,
        }))

  const primeira = (x: LinhaDoMovimento) =>
    agrupar === 'orcamento' ? (
      <span className="pd-celula">
        <Nome l={x.l} abrir={aoAbrir(x.l)} />
        <small>{codigosDe(x.l, kits)}</small>
      </span>
    ) : (
      <span className="pd-celula">
        <b>{x.l.numero}</b>
        <small>{x.l.cliente}</small>
      </span>
    )

  if (celular) {
    return (
      <>
        {numeros}
        <section className="cartao pd-quadro" data-movimento="lista">
          {grupos.map(g => (
            <Fragment key={g.chave}>
              <div className="pd-mov-grupo">{g.titulo}</div>
              {g.linhas.map(x => (
                <div className="pd-mov-lin" key={x.l.pedidoId + '-' + x.l.ordem} data-linha-do-movimento="">
                  <div className="pd-mov-cima">
                    {primeira(x)}
                    <span className="pd-val">
                      {emUnidades(x.l.pecas, x.l.kit)}
                      <small>{ondeEsta(x)}</small>
                    </span>
                  </div>
                  <span className="pd-apoio">{layoutEArte(x.l)}</span>
                  <Gradinha grade={x.l.grade} />
                  <Tecnicas tecnicas={x.l.tecnicas} />
                </div>
              ))}
            </Fragment>
          ))}
        </section>
      </>
    )
  }

  return (
    <>
      {numeros}
      <section className="cartao pd-quadro" data-movimento="tabela">
        <div className="tabela-rola">
          <table className="tabela pd-mov">
            <thead>
              <tr>
                <th scope="col">{agrupar === 'orcamento' ? 'Peça ou kit' : 'Orçamento'}</th>
                <th scope="col">Layout do orçamento</th>
                <th scope="col">Grade feita</th>
                <th scope="col" className="dir">
                  Quanto
                </th>
                <th scope="col">Design</th>
                <th scope="col">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => (
                <Fragment key={g.chave}>
                  <tr className="grupo">
                    <td colSpan={6}>{g.titulo}</td>
                  </tr>
                  {g.linhas.map(x => (
                    <tr key={x.l.pedidoId + '-' + x.l.ordem} data-linha-do-movimento="">
                      <td>{primeira(x)}</td>
                      <td className="pd-apoio">{layoutEArte(x.l)}</td>
                      <td>
                        <Gradinha grade={x.l.grade} />
                      </td>
                      <td className="dir pd-quanto">{emUnidades(x.l.pecas, x.l.kit)}</td>
                      <td>
                        <Tecnicas tecnicas={x.l.tecnicas} />
                      </td>
                      <td className="pd-apoio" data-etapa="">
                        {ondeEsta(x)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
