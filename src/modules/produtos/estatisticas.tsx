import { useMemo, useState, type CSSProperties } from 'react'
import { CalendarBlank, ChartBar } from '@phosphor-icons/react'
import { Kpi, Segmentado, TituloCartao, Vazio } from '@ds'
import { MES_LONGO, lerMes } from '@shared'
import {
  casaComABusca,
  codigoCurto,
  comparacaoEmPalavras,
  janelasDoPeriodo,
  pecasVendidas,
  periodoEmPalavras,
  rankingDeKits,
  rankingDeReferencias,
  tamanhosVendidos,
  vendaMesAMes,
  type KitNaLista,
  type Periodo,
  type ReferenciaNaFicha,
  type Vendida,
} from '@dominio/produto'
import { plural } from './apoio'
import { emKits, emPecas, numero, type Vendas } from './vendas'

/* ==========================================================================
   As Estatísticas (prancha 64): o que mais vende.

   CONTA A PEÇA DE ORÇAMENTO APROVADO NO PERÍODO, pelo dia em que foi
   aprovado, e entra o pedido que ainda nem foi para a fábrica: venda é
   venda. Pedido cancelado não conta.

   A PEÇA VENDIDA DENTRO DE KIT CONTA DUAS VEZES, DE PROPÓSITO: no ranking das
   referências (a camiseta saiu) e no ranking dos kits (o kit saiu). São duas
   perguntas, e somar um ranking com o outro não quer dizer nada.

   A COMPARAÇÃO É COM O MESMO TRECHO DE ANTES. No dia 6, "1 mês" compara de 1
   a 6 deste mês com de 1 a 6 do mês passado: comparar seis dias com um mês
   inteiro diria que tudo caiu.
   ========================================================================== */

export type Categoria = 'referencias' | 'kits'

export const PERIODOS: { valor: `${Periodo}`; rotulo: string }[] = [
  { valor: '1', rotulo: '1 mês' },
  { valor: '3', rotulo: '3 meses' },
  { valor: '6', rotulo: '6 meses' },
  { valor: '12', rotulo: '1 ano' },
]

const QUANTAS_NO_RANKING = 12
const QUANTAS_DO_LADO = 5

export function Estatisticas({
  vendas,
  hoje,
  periodo,
  categoria,
  aoMudarCategoria,
  busca,
  referencias,
  kits,
  aoAbrirReferencia,
  aoAbrirKit,
}: {
  vendas: Vendas
  hoje: Date
  periodo: Periodo
  categoria: Categoria
  aoMudarCategoria: (c: Categoria) => void
  busca: string
  /** as referências de peça que estão no catálogo, sem os kits */
  referencias: ReferenciaNaFicha[]
  kits: KitNaLista[]
  aoAbrirReferencia: (id: string) => void
  aoAbrirKit: (id: string) => void
}) {
  const [inteira, setInteira] = useState(false)

  const j = useMemo(() => janelasDoPeriodo(periodo, hoje), [periodo, hoje])
  const dasReferencias = useMemo(
    () => rankingDeReferencias(vendas.layouts, vendas.kits, j.atual, j.anterior),
    [vendas, j],
  )
  const dosKits = useMemo(() => rankingDeKits(vendas.layouts, j.atual, j.anterior), [vendas, j])
  const total = useMemo(() => pecasVendidas(vendas.layouts, vendas.kits, j.atual), [vendas, j])
  const tamanhos = useMemo(() => tamanhosVendidos(vendas.layouts, vendas.kits, j.atual), [vendas, j])
  const meses = useMemo(() => vendaMesAMes(vendas.layouts, vendas.kits, hoje), [vendas, hoje])

  const noCatalogo = useMemo(() => new Map(referencias.map(r => [r.id, r])), [referencias])
  const kitNoCatalogo = useMemo(() => new Map(kits.map(k => [k.id, k])), [kits])
  /* o nome de hoje no catálogo ganha do nome que o orçamento guardou */
  const nomeDe = (v: Vendida) =>
    (v.referenciaId ? (noCatalogo.get(v.referenciaId)?.nome ?? kitNoCatalogo.get(v.referenciaId)?.nome) : '') ||
    v.nome ||
    'sem nome'
  const codigosDoKit = (v: Vendida) =>
    v.referenciaId && vendas.kits[v.referenciaId]?.length
      ? vendas.kits[v.referenciaId].map(p => codigoCurto(p.cod)).join(' + ')
      : codigoCurto(v.cod)

  const quando = periodoEmPalavras(j.meses)
  const contra = comparacaoEmPalavras(j.mesesAntes)
  const deKits = categoria === 'kits'
  const lista = deKits ? dosKits : dasReferencias
  const termo = busca.trim()
  const achadas = termo ? lista.filter(v => casaComABusca({ nome: nomeDe(v), cod: v.cod }, termo)) : lista
  const aVista = inteira || termo ? achadas : achadas.slice(0, QUANTAS_NO_RANKING)
  const maior = lista[0]?.quanto ?? 0
  const quanto = (n: number) => (deKits ? emKits(n) : emPecas(n))

  const kitsVendidos = dosKits.reduce((a, v) => a + v.quanto, 0)
  const vendidas = new Set(dasReferencias.map(v => v.referenciaId).filter(Boolean))
  const paradas = referencias.filter(r => !vendidas.has(r.id)).length

  const abre = (v: Vendida): (() => void) | null => {
    const id = v.referenciaId
    if (!id) return null
    if (kitNoCatalogo.has(id)) return () => aoAbrirKit(id)
    if (noCatalogo.has(id)) return () => aoAbrirReferencia(id)
    return null
  }

  /* os dois tamanhos que mais saem, para a frase debaixo do gráfico */
  const doisMaiores = [...tamanhos].sort((a, b) => b.pecas - a.pecas).slice(0, 2)
  const maiorTamanho = Math.max(0, ...tamanhos.map(t => t.pecas))
  const maiorMes = Math.max(0, ...meses.map(m => m.pecas))
  const doLado = deKits ? dasReferencias : dosKits

  const linha = (v: Vendida) => {
    const abrir = abre(v)
    const dentro = (
      <>
        <span className="pd-est-nome">
          <span className="pd-posicao">{lista.indexOf(v) + 1}</span>
          <b>{nomeDe(v)}</b>
          <small>{deKits ? '' : codigoCurto(v.cod)}</small>
        </span>
        <span className="pd-est-barra" aria-hidden="true">
          <i style={{ '--pd-parte': (maior ? (v.quanto / maior) * 100 : 0).toFixed(1) + '%' } as CSSProperties} />
        </span>
        <b className="pd-est-num">{quanto(v.quanto)}</b>
        <span className="pd-est-num pd-est-apoio">{Math.round(v.parte * 100)}%</span>
        <span className="pd-est-onde">
          <small>em {plural(v.orcamentos, 'orçamento', 'orçamentos')}</small>
          <b className={v.rumo === 'caiu' ? 'pd-est-caiu' : undefined}>
            {v.rumo} {contra}
          </b>
        </span>
      </>
    )
    return abrir ? (
      <button type="button" className="pd-est-linha" key={v.chave} data-vendida={v.cod || v.nome} onClick={abrir}>
        {dentro}
      </button>
    ) : (
      <div className="pd-est-linha" key={v.chave} data-vendida={v.cod || v.nome}>
        {dentro}
      </div>
    )
  }

  return (
    <>
      <div className="pd-alto">
        <Segmentado
          className="pd-seg pd-categoria"
          valor={categoria}
          aoMudar={c => {
            setInteira(false)
            aoMudarCategoria(c)
          }}
          opcoes={[
            {
              valor: 'referencias',
              rotulo: (
                <>
                  Referências <small>{referencias.length}</small>
                </>
              ),
            },
            {
              valor: 'kits',
              rotulo: (
                <>
                  Kits <small>{kits.length}</small>
                </>
              ),
            },
          ]}
        />
      </div>

      <div className="pd-numeros-caixa">
        <div className="fila-kpi pd-kpis" data-numeros="estatisticas">
          <Kpi rotulo="Peças vendidas" valor={numero(total)} unidade="pçs" sub={quando + ', até hoje'} />
          <Kpi
            rotulo="A que mais sai"
            valor={numero(dasReferencias[0]?.quanto ?? 0)}
            unidade="pçs"
            sub={
              dasReferencias.length
                ? `${nomeDe(dasReferencias[0])} · ${Math.round(dasReferencias[0].parte * 100)}% do total`
                : 'nada vendido no período'
            }
          />
          <Kpi
            rotulo="Kits vendidos"
            valor={numero(kitsVendidos)}
            unidade={kitsVendidos === 1 ? 'kit' : 'kits'}
            sub={dosKits.length ? plural(dosKits.length, 'kit diferente', 'kits diferentes') : 'nenhum kit no período'}
          />
          <Kpi
            rotulo="Paradas"
            valor={numero(paradas)}
            unidade="ref."
            sub={paradas === 1 ? 'referência que não vendeu no período' : 'referências que não venderam no período'}
          />
        </div>
      </div>

      <div className="pd-est-dois-caixa">
        <div className="pd-est-dois">
          <section className="cartao pd-est-col" data-cartao="ranking">
            <header className="pd-topo">
              <TituloCartao icone={ChartBar}>
                {deKits ? 'Os kits que mais vendem' : 'As referências que mais vendem'}
              </TituloCartao>
              <span className="pd-topo-nome">
                {deKits
                  ? plural(lista.length, 'kit saiu', 'kits saíram')
                  : plural(lista.length, 'referência saiu', 'referências saíram')}{' '}
                · {quando}
              </span>
            </header>
            {!lista.length ? (
              <Vazio
                titulo={deKits ? 'Nenhum kit vendido no período' : 'Nada vendido no período'}
                texto="Entra aqui a peça de orçamento aprovado no período. Escolha um período maior em cima, do lado direito."
              />
            ) : !achadas.length ? (
              <Vazio titulo="Nada com esse nome" texto="Nenhuma das que saíram no período combina com a busca." />
            ) : (
              <>
                <div className="pd-est-cabeca" aria-hidden="true">
                  <span>{deKits ? 'Kit' : 'Referência'}</span>
                  <span />
                  <span className="pd-est-num">{deKits ? 'Kits' : 'Peças'}</span>
                  <span className="pd-est-num">Do total</span>
                  <span>Onde saiu</span>
                </div>
                {aVista.map(v => linha(v))}
                {!termo && achadas.length > QUANTAS_NO_RANKING ? (
                  <button type="button" className="pd-pe" onClick={() => setInteira(v => !v)}>
                    {inteira ? `Ver só as ${QUANTAS_NO_RANKING} primeiras` : `Ver as ${achadas.length} que saíram`}
                  </button>
                ) : null}
              </>
            )}
            <p className="pd-est-pe">
              Conta a peça de orçamento aprovado no período. Peça vendida dentro de kit conta no ranking das
              referências e também no dos kits. A comparação é com o mesmo trecho do período anterior: os mesmos
              dias, {plural(periodo, 'mês', 'meses')} atrás.
            </p>
          </section>

          <div className="pd-est-lado">
            <section className="cartao pd-est-col" data-cartao="tamanhos">
              <header className="pd-topo">
                <TituloCartao icone={ChartBar}>Tamanhos que mais saem</TituloCartao>
                <span className="pd-topo-nome">em % das peças</span>
              </header>
              {tamanhos.length ? (
                <>
                  <div
                    className="pd-colunas"
                    role="img"
                    aria-label={
                      'Parte de cada tamanho nas peças vendidas: ' +
                      tamanhos.map(t => `${t.tamanho} ${Math.round(t.parte * 100)}%`).join(', ')
                    }
                    style={{ '--pd-quantas': tamanhos.length } as CSSProperties}
                  >
                    {tamanhos.map(t => (
                      <div className="pd-coluna" key={t.tamanho} data-tamanho={t.tamanho}>
                        <span className="pd-coluna-valor">{Math.round(t.parte * 100)}</span>
                        <span className="pd-coluna-trilho">
                          <i
                            style={
                              { '--pd-parte': (maiorTamanho ? (t.pecas / maiorTamanho) * 100 : 0).toFixed(0) + '%' } as CSSProperties
                            }
                          />
                        </span>
                        <span className="pd-coluna-nome">{t.tamanho}</span>
                      </div>
                    ))}
                  </div>
                  <p className="pd-est-pe">
                    {doisMaiores.length === 2 && doisMaiores[1].pecas > 0
                      ? `${doisMaiores[0].tamanho} e ${doisMaiores[1].tamanho} somam ${Math.round((doisMaiores[0].parte + doisMaiores[1].parte) * 100)}% das peças. `
                      : ''}
                    Serve para montar a pronta entrega.
                  </p>
                </>
              ) : (
                <p className="pd-est-pe">Nada vendido no período.</p>
              )}
            </section>

            <section className="cartao pd-est-col" data-cartao="mes-a-mes">
              <header className="pd-topo">
                <TituloCartao icone={CalendarBlank}>Mês a mês</TituloCartao>
                <span className="pd-topo-nome">peças vendidas</span>
              </header>
              <div
                className="pd-colunas"
                role="img"
                aria-label={
                  'Peças vendidas em cada mês: ' +
                  meses.map(m => `${MES_LONGO[lerMes(m.mes).mes]} ${numero(m.pecas)}`).join(', ')
                }
                style={{ '--pd-quantas': meses.length } as CSSProperties}
              >
                {meses.map(m => (
                  <div className={m.corrente ? 'pd-coluna pd-corrente' : 'pd-coluna'} key={m.mes} data-mes={m.mes}>
                    <span className="pd-coluna-valor">{numero(m.pecas)}</span>
                    <span className="pd-coluna-trilho">
                      <i
                        style={
                          { '--pd-parte': (maiorMes ? (m.pecas / maiorMes) * 100 : 0).toFixed(0) + '%' } as CSSProperties
                        }
                      />
                    </span>
                    <span className="pd-coluna-nome">{MES_LONGO[lerMes(m.mes).mes].slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              <p className="pd-est-pe">O último mês ainda está correndo, e vai só até hoje.</p>
            </section>

            <section className="cartao pd-est-col" data-cartao="do-lado">
              <header className="pd-topo">
                <TituloCartao icone={ChartBar}>
                  {deKits ? 'As referências que mais vendem' : 'Os kits que mais vendem'}
                </TituloCartao>
                <span className="pd-topo-nome">{quando}</span>
              </header>
              {doLado.length ? (
                doLado.slice(0, QUANTAS_DO_LADO).map(v => {
                  const abrir = abre(v)
                  const dentro = (
                    <>
                      <span className="pd-pri-texto">
                        <b>{nomeDe(v)}</b>
                        <small>{deKits ? codigoCurto(v.cod) : codigosDoKit(v)}</small>
                      </span>
                      <span className="pd-pri-quanto">{deKits ? emPecas(v.quanto) : emKits(v.quanto)}</span>
                    </>
                  )
                  return abrir ? (
                    <button type="button" className="pd-pri" key={v.chave} data-do-lado={v.cod || v.nome} onClick={abrir}>
                      {dentro}
                    </button>
                  ) : (
                    <div className="pd-pri" key={v.chave} data-do-lado={v.cod || v.nome}>
                      {dentro}
                    </div>
                  )
                })
              ) : (
                <p className="pd-est-pe">
                  {deKits ? 'Nenhuma peça vendida no período.' : 'Nenhum kit vendido no período.'}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
