import type { CSSProperties } from 'react'
import { CheckCircle, Circle, TShirt, WarningCircle } from '@phosphor-icons/react'
import { PilulaTecnica } from '@ds'
import { tamanhosNaOrdem, totalDaGrade, type Bloco } from '@dominio/layout'
import { numeroNaUnidade, type MaterialDoLayout, type ReservaDoPedido } from '@dominio/estoque'

/* ==========================================================================
   UM LAYOUT DO PEDIDO NA SEPARAÇÃO (prancha 83, parte S2).

   À esquerda o que foi negociado, como o orçamento diz: a arte, o tecido, o
   design, a grade e a observação. À direita o MATERIAL DESTE LAYOUT, com de
   onde vem a conta (062) e como ele está: separado, a separar, ou faltando
   na prateleira.

   O "como está" é do material no pedido inteiro, e não só do layout: a
   reserva é uma linha por pedido e material, e é ela que sai da prateleira
   numa pesagem só.
   ========================================================================== */

const NOME_DA_CATEGORIA: Record<string, string> = { tecido: 'Tecido', aviamento: 'Aviamento', insumo: 'Insumo' }

function ComoEsta({ r }: { r?: ReservaDoPedido }) {
  if (!r) return <span className="sp-como">sem reserva</span>
  if (r.baixada)
    return (
      <span className="sp-como sp-separado">
        <CheckCircle size={16} weight="bold" /> separado
      </span>
    )
  if (!r.semConsumo && r.saldo < r.quantidade)
    return (
      <span className="sp-como falta">
        <WarningCircle size={16} weight="bold" /> falta {numeroNaUnidade(r.quantidade - r.saldo, r.unidade)}
      </span>
    )
  return (
    <span className="sp-como">
      <Circle size={16} /> a separar
    </span>
  )
}

export function CartaoDoLayout({
  bloco,
  materiais,
  reservas,
}: {
  bloco: Bloco
  /** null: a 062 não rodou e o material por layout não existe ainda */
  materiais: MaterialDoLayout[] | null
  reservas: ReservaDoPedido[]
}) {
  const pecas = totalDaGrade(bloco.grade)
  const tamanhos = tamanhosNaOrdem(bloco.faixa, bloco.grade).filter((t) => (bloco.grade[t] ?? 0) > 0)
  const nome = bloco.nomeDaReferencia || bloco.referencia || 'sem referência'
  const daReserva = (id: string) => reservas.find((r) => r.materialId === id)

  return (
    <section className="cartao sp-lay" data-layout={bloco.n}>
      <header className="sp-cab">
        <span className="sp-lay-tit">
          <TShirt size={18} weight="duotone" aria-hidden="true" />
          L-{String(bloco.n).padStart(2, '0')} · {nome.toUpperCase()}
        </span>
        <span className="sp-cab-apoio">
          {pecas} peças{bloco.referencia ? ' · ' + bloco.referencia : ''}
        </span>
      </header>
      <div className="sp-lay-corpo">
        <div className="sp-lay-esq">
          <div className="sp-lay-arte">{bloco.imagem ? <img src={bloco.imagem} alt={'Arte do layout ' + bloco.n} /> : <span>sem arte</span>}</div>
          <dl className="sp-lay-dados">
            <dt>Tecido</dt>
            <dd>
              {bloco.tecidos.length
                ? bloco.tecidos.map((t, i) => (
                    <span key={i} className="sp-lay-tec">
                      <i className="sp-q" style={{ '--cor': t.hex || 'var(--surface-3)' } as CSSProperties} />
                      {t.nome}
                      {t.cor && t.cor !== 'sem cor' ? ' · ' + t.cor : ''}
                    </span>
                  ))
                : 'sem tecido'}
            </dd>
            <dt>Design</dt>
            <dd className="sp-lay-tags">
              {bloco.design.length
                ? bloco.design.map((d) => (
                    <PilulaTecnica key={d.tag} tecnica={d.tecnica} tamanho="sm">
                      {d.tag}
                    </PilulaTecnica>
                  ))
                : 'sem design'}
            </dd>
            <dt>Grade</dt>
            <dd className="sp-lay-grade">
              {tamanhos.map((t) => (
                <span key={t}>
                  {t} <b>{bloco.grade[t]}</b>
                </span>
              ))}
            </dd>
            {bloco.observacao ? (
              <>
                <dt>Obs.</dt>
                <dd className="sp-lay-obs">{bloco.observacao.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="sp-lay-dir">
          {materiais === null ? (
            <p className="ct-nada sp-cartao-corpo">O material por layout depende da migração 062.</p>
          ) : !materiais.length ? (
            <p className="ct-nada sp-cartao-corpo">
              Nenhum material calculado para este layout: o tecido não está cadastrado no Estoque, ou a referência não tem ficha técnica.
            </p>
          ) : (
            <table className="sp-tabela sp-lay-tabela">
              <thead>
                <tr>
                  <th>Material deste layout</th>
                  <th className="num">Precisa</th>
                  <th>Como está</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((m) => {
                  const r = daReserva(m.materialId)
                  const falta = !!r && !r.baixada && !r.semConsumo && r.saldo < r.quantidade
                  return (
                    <tr key={m.materialId} className={falta ? 'falta' : undefined}>
                      <td>
                        <span className="sp-mat">
                          {m.categoria === 'tecido' ? <i className="sp-q" style={{ '--cor': m.corHex || 'var(--surface-3)' } as CSSProperties} /> : null}
                          <span className="pilha colada">
                            <span>{m.material}</span>
                            <small className="sp-apoio">{m.como || NOME_DA_CATEGORIA[m.categoria] || m.categoria}</small>
                          </span>
                        </span>
                      </td>
                      <td className="num">{m.semConsumo ? <span className="sp-apoio">não sei</span> : <b>{numeroNaUnidade(m.quantidade, m.unidade)}</b>}</td>
                      <td>
                        <ComoEsta r={r} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
