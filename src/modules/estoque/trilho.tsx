import { useEffect, useRef, useState } from 'react'
import { TituloCartao } from '@ds'
import { CaretLeft, CaretRight, HourglassMedium } from '@phosphor-icons/react'
import {
  faltaDoMaterial,
  nomeInteiro,
  quantoNaUnidade,
  situacaoDoMaterial,
  type Material,
} from '@dominio/estoque'
import { plural } from './apoio'
import { VaoDoMaterial } from './vao'

/* ==========================================================================
   O trilho do que está acabando.

   Pedido do Henrique (05/10/2026): a prateleira de tecidos em sanfona repetia
   a coluna de tecidos da esquerda. No lugar dela fica um trilho: uma fileira
   só, na ordem da urgência, com os tecidos e os materiais que já caíram
   abaixo da quantidade mínima ou estão perto dela. O mais urgente fica na
   ponta esquerda.

   Cada parada é um vão: a altura é o livre contra o dobro do mínimo, e o
   risco do meio é o mínimo. Embaixo, o livre, o nome e o quanto falta para
   voltar ao mínimo (ou quanto sobra, quando ainda está perto).

   O trilho anda de lado dentro da própria caixa, pelo arrasto do dedo, pela
   roda com Shift, pelas setas do teclado e pelos dois botões das pontas, que
   só aparecem quando há para onde andar. A página não rola de lado.
   ========================================================================== */
export function Trilho({
  acabando,
  temMinimo,
  aoEscolher,
}: {
  /** já na ordem da urgência */
  acabando: Material[]
  /** algum material do estoque tem mínimo marcado */
  temMinimo: boolean
  aoEscolher: (m: Material) => void
}) {
  const faixa = useRef<HTMLDivElement>(null)
  const [pontas, setPontas] = useState({ antes: false, depois: false })

  /* as setas das pontas só existem quando há trilho escondido daquele lado */
  useEffect(() => {
    const el = faixa.current
    if (!el) return
    const medir = () =>
      setPontas({
        antes: el.scrollLeft > 4,
        depois: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      })
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const olho = new ResizeObserver(medir)
    olho.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      olho.disconnect()
    }
  }, [acabando.length])

  function andar(sentido: 1 | -1) {
    const el = faixa.current
    if (!el) return
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: calmo ? 'auto' : 'smooth' })
  }

  const comprar = acabando.filter(m => situacaoDoMaterial(m) === 'comprar').length
  const perto = acabando.length - comprar

  return (
    <section className="cartao em-col em-trilho" data-trilho="">
      <div className="em-topo">
        <TituloCartao icone={HourglassMedium}>O que está acabando</TituloCartao>
        <span className="em-topo-nota">
          {acabando.length
            ? [
                comprar ? `${comprar} abaixo do mínimo` : '',
                perto ? `${perto} perto dele` : '',
                'o mais urgente primeiro',
              ]
                .filter(Boolean)
                .join(' · ')
            : 'a altura é o livre · o risco é o mínimo'}
        </span>
      </div>

      {acabando.length === 0 ? (
        <p className="em-sem-linhas">
          {temMinimo
            ? 'Nada abaixo do mínimo nem perto dele.'
            : 'Nenhum material tem a quantidade mínima marcada. Ela se marca no cadastro de cada cor, e é ela que faz o aviso aparecer aqui.'}
        </p>
      ) : (
        <div className="em-trilho-corpo">
          {pontas.antes ? (
            <button
              type="button"
              className="em-trilho-seta antes"
              aria-label="Voltar no trilho"
              onClick={() => andar(-1)}
            >
              <CaretLeft size={16} weight="bold" />
            </button>
          ) : null}
          <div
            className="em-trilho-faixa"
            ref={faixa}
            tabIndex={0}
            role="group"
            aria-label={
              'O que está acabando, o mais urgente primeiro: ' +
              plural(acabando.length, 'material', 'materiais')
            }
          >
            {acabando.map((m, i) => {
              const s = situacaoDoMaterial(m)
              const falta = faltaDoMaterial(m)
              return (
                <button
                  type="button"
                  key={m.id}
                  className={s === 'comprar' ? 'em-parada comprar' : 'em-parada'}
                  data-parada={m.nome}
                  title={nomeInteiro(m)}
                  onClick={() => aoEscolher(m)}
                >
                  <span className="em-parada-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <VaoDoMaterial m={m} />
                  <b className={s === 'comprar' ? 'em-parada-q pouco' : 'em-parada-q'}>
                    {quantoNaUnidade(m.livre, m.unidade)}
                  </b>
                  <span className="em-parada-nome">
                    {m.categoria === 'tecido' && m.tecido && m.cor ? (
                      <>
                        <small>{m.tecido}</small>
                        <span>{m.cor}</span>
                      </>
                    ) : (
                      <span>{m.nome}</span>
                    )}
                  </span>
                  <small className="em-parada-falta">
                    {s === 'comprar'
                      ? (falta === 1 ? 'falta ' : 'faltam ') + quantoNaUnidade(falta, m.unidade)
                      : 'mínimo ' + quantoNaUnidade(m.minimo, m.unidade)}
                  </small>
                </button>
              )
            })}
            <span className="em-trilho-resto" aria-hidden="true" />
          </div>
          {pontas.depois ? (
            <button
              type="button"
              className="em-trilho-seta depois"
              aria-label="Avançar no trilho"
              onClick={() => andar(1)}
            >
              <CaretRight size={16} weight="bold" />
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
