import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChartBar, CheckCircle, TShirt } from '@phosphor-icons/react'
import { TituloCartao } from '@ds'
import { MES_LONGO, lerMes } from '@shared'
import {
  carregarMolde,
  codigoCurto,
  janelasDoPeriodo,
  moldeComoImagem,
  rankingDeKits,
  rankingDeReferencias,
  ultimasFeitas,
  type KitNaLista,
  type LinhaDoMovimento,
  type ReferenciaNaFicha,
} from '@dominio/produto'
import { emKits, emPecas, emUnidades, quandoFicou, tecnicasEmPalavras, type Vendas } from './vendas'

/* ==========================================================================
   Antes de escolher uma peça (prancha 57): o lado direito da página mostra o
   que mais vendeu no mês, as últimas peças que ficaram prontas e os kits que
   mais saem. Cada caixa leva para a aba que conta a história inteira.

   SEM VENDA NÃO HÁ GRÁFICO VAZIO: a caixa diz, em uma frase, que nada saiu no
   mês ainda.
   ========================================================================== */

const QUANTAS_NO_GRAFICO = 7
const QUANTAS_FEITAS = 8
const QUANTOS_KITS = 4

/** O desenho de um kit, lido só para os que aparecem na faixa. */
function DesenhoDoKit({ kit }: { kit: KitNaLista | undefined }) {
  const [svg, setSvg] = useState<string | null>(null)
  const id = kit?.temDesenho ? kit.id : ''
  useEffect(() => {
    let vivo = true
    setSvg(null)
    if (id) {
      carregarMolde(id)
        .then(lido => {
          if (vivo) setSvg(lido)
        })
        .catch(() => {})
    }
    return () => {
      vivo = false
    }
  }, [id])
  return (
    <span className="pd-kit-desenho">
      {svg ? <img src={moldeComoImagem(svg)} alt="" /> : <TShirt size={32} weight="duotone" aria-hidden="true" />}
    </span>
  )
}

export function VisaoGeral({
  vendas,
  linhas,
  hoje,
  referencias,
  kits,
  aoAbrirKit,
  aoVerEstatisticas,
  aoVerMovimento,
}: {
  vendas: Vendas
  /** os layouts que estão ou estiveram na fábrica, com a situação de cada um */
  linhas: LinhaDoMovimento[]
  hoje: Date
  referencias: ReferenciaNaFicha[]
  kits: KitNaLista[]
  aoAbrirKit: (id: string) => void
  aoVerEstatisticas: () => void
  aoVerMovimento: () => void
}) {
  const j = useMemo(() => janelasDoPeriodo(1, hoje), [hoje])
  const mes = MES_LONGO[lerMes(j.meses[0]).mes]
  const maisVendidas = useMemo(
    () => rankingDeReferencias(vendas.layouts, vendas.kits, j.atual).slice(0, QUANTAS_NO_GRAFICO),
    [vendas, j],
  )
  const kitsDoMes = useMemo(() => rankingDeKits(vendas.layouts, j.atual), [vendas, j])
  const feitas = useMemo(() => ultimasFeitas(linhas, QUANTAS_FEITAS), [linhas])

  const noCatalogo = useMemo(() => new Map(referencias.map(r => [r.id, r])), [referencias])
  const kitNoCatalogo = useMemo(() => new Map(kits.map(k => [k.id, k])), [kits])
  const teto = maisVendidas[0]?.quanto ?? 0

  /* as técnicas com que o kit saiu no mês, tiradas dos layouts dele */
  const tecnicasDoKit = (kitId: string) => {
    const de = new Date(j.atual.de).getTime()
    const ate = new Date(j.atual.ate).getTime()
    const todas = vendas.layouts
      .filter(l => {
        const t = l.aprovadoEm ? new Date(l.aprovadoEm).getTime() : NaN
        return l.referenciaId === kitId && t >= de && t < ate
      })
      .flatMap(l => l.tecnicas)
    return tecnicasEmPalavras(todas)
  }

  return (
    <>
      <section className="cartao pd-col pd-curta pd-dupla" data-coluna="vendidas">
        <div className="pd-topo">
          <TituloCartao icone={ChartBar}>Mais vendidas no mês</TituloCartao>
          <span className="pd-topo-nome">peças vendidas em {mes}</span>
        </div>
        {maisVendidas.length ? (
          <div
            className="pd-graf"
            role="img"
            aria-label={
              'As referências que mais venderam no mês, em peças: ' +
              maisVendidas.map(v => `${v.nome} ${v.quanto}`).join(', ')
            }
          >
            {maisVendidas.map(v => (
              <div className="pd-graf-lin" key={v.chave} data-mais-vendida={v.cod || v.nome}>
                <span className="pd-graf-nome">
                  <b>{(v.referenciaId ? noCatalogo.get(v.referenciaId)?.nome : '') || v.nome || 'sem nome'}</b>
                  <small>{codigoCurto(v.cod)}</small>
                </span>
                <span className="pd-graf-trilho">
                  <i style={{ '--pd-parte': (teto ? (v.quanto / teto) * 100 : 0).toFixed(1) + '%' } as CSSProperties} />
                </span>
                <b className="pd-graf-valor">{emPecas(v.quanto)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="pd-sem-linhas">
            Nenhuma peça vendida em {mes} ainda. Entra aqui a peça de orçamento aprovado no mês.
          </p>
        )}
        <button type="button" className="pd-pe" onClick={aoVerEstatisticas}>
          Ver mais · nas Estatísticas
        </button>
      </section>

      <section className="cartao pd-col pd-curta" data-coluna="feitas">
        <div className="pd-topo">
          <TituloCartao icone={CheckCircle}>Últimas peças feitas</TituloCartao>
        </div>
        {feitas.length ? (
          <div className="pd-rolagem" role="group" aria-label="Últimas peças feitas" tabIndex={0}>
            {feitas.map(x => (
              <div className="pd-lin" key={x.l.pedidoId + '-' + x.l.ordem} data-feita={x.l.numero}>
                <span className="pd-txt">
                  <b>{x.l.nome || 'sem nome'}</b>
                  <small>
                    {x.l.numero}
                    {x.l.cliente ? ' · ' + x.l.cliente : ''}
                  </small>
                  <small>{quandoFicou(x.em, hoje)}</small>
                </span>
                <span className="pd-val">{emUnidades(x.l.pecas, x.l.kit)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pd-sem-linhas">Nenhuma peça ficou pronta ainda. Ela entra aqui quando sai da fábrica.</p>
        )}
        <button type="button" className="pd-pe" onClick={aoVerMovimento}>
          Ver mais · todo o Movimento
        </button>
      </section>

      <section className="cartao pd-col pd-faixa-caixa" data-coluna="kits">
        <div className="pd-topo">
          <TituloCartao icone={ChartBar}>Kits que mais saem</TituloCartao>
          <span className="pd-topo-nome">
            {kitsDoMes.length > QUANTOS_KITS
              ? `os ${QUANTOS_KITS} primeiros de ${kitsDoMes.length} · em ${mes}`
              : `em ${mes}`}
          </span>
        </div>
        {kitsDoMes.length ? (
          <div className="pd-faixa">
            {kitsDoMes.slice(0, QUANTOS_KITS).map(v => {
              const k = v.referenciaId ? kitNoCatalogo.get(v.referenciaId) : undefined
              const pecas = v.referenciaId ? (vendas.kits[v.referenciaId] ?? []) : []
              const tecnicas = v.referenciaId ? tecnicasDoKit(v.referenciaId) : ''
              return (
                <button
                  type="button"
                  className="pd-kit"
                  key={v.chave}
                  data-kit-que-sai={v.cod}
                  disabled={!k}
                  onClick={() => k && aoAbrirKit(k.id)}
                >
                  <DesenhoDoKit kit={k} />
                  <b>{k?.nome ?? v.nome}</b>
                  <small>{pecas.map(p => codigoCurto(p.cod)).join(' + ') || codigoCurto(v.cod)}</small>
                  <small>
                    <b>{emKits(v.quanto)}</b> no mês{tecnicas ? ' · ' + tecnicas : ''}
                  </small>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="pd-sem-linhas">
            Nenhum kit vendido em {mes} ainda. O kit entra aqui quando um orçamento com ele é aprovado.
          </p>
        )}
      </section>
    </>
  )
}
