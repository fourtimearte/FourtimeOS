import { useState } from 'react'
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Info,
  Scales,
  WarningCircle,
} from '@phosphor-icons/react'
import { Esqueleto, TituloCartao } from '@ds'
import type { ComparacaoDoLayout, EstadoDaLinha } from '@dominio/producao'

/* ==========================================================================
   A COMPARAÇÃO DOS COMPONENTES (prancha 88, parte P3).

   Um layout por linha, fechado, com "6 de 6" quando tudo confere; o que tem
   diferença já abre sozinho. Dentro, as linhas do que o orçamento diz contra
   o que a ficha técnica, a separação e a produção dizem, com a diferença em
   vermelho. O aviso (o que não dá para conferir, como a ficha em branco) é
   cinza e não conta como diferença.

   Depois que o PCP marca, a diferença que continua é ACEITA: o título diz
   isso, e o diretor vê o que está levando (prancha 89).
   ========================================================================== */

/* a classe inteira escrita aqui, e não montada: a prova das ligações lê o
   nome, e "aviso" sozinho é classe do Design System */
const CLASSE_DA_LINHA: Record<EstadoDaLinha, string> = {
  ok: 'pc-cmp-linha',
  diferenca: 'pc-cmp-linha pc-e-diferenca',
  aviso: 'pc-cmp-linha',
}

const L = (n: number) => 'L-' + String(n).padStart(2, '0')

function IconeDoEstado({ e, tamanho = 18 }: { e: EstadoDaLinha; tamanho?: number }) {
  if (e === 'diferenca')
    return (
      <span className="pc-cmp-ic diferenca" aria-label="diferença">
        <WarningCircle size={tamanho} />
      </span>
    )
  if (e === 'aviso')
    return (
      <span className="pc-cmp-ic pc-so-aviso" aria-label="não dá para conferir">
        <Info size={tamanho} />
      </span>
    )
  return (
    <span className="pc-cmp-ic" aria-label="confere">
      <CheckCircle size={tamanho} />
    </span>
  )
}

export function CartaoDaComparacao({
  layouts,
  aceitas,
}: {
  /** undefined: lendo; null: não deu para ler a cotação */
  layouts: ComparacaoDoLayout[] | null | undefined
  /** o PCP já marcou: o que sobrou de diferença foi aceito */
  aceitas: boolean
}) {
  const [abertos, setAbertos] = useState<Record<number, boolean>>({})
  const diferencas = (layouts ?? []).reduce((s, l) => s + l.diferencas, 0)
  const apoio =
    layouts === undefined
      ? 'conferindo'
      : layouts === null
        ? ''
        : diferencas
          ? `${diferencas} ${diferencas === 1 ? (aceitas ? 'diferença aceita' : 'diferença') : aceitas ? 'diferenças aceitas' : 'diferenças'}`
          : 'tudo confere'

  return (
    <section className="cartao pc-cmp" aria-label="Comparação dos componentes">
      <header className="pc-cab">
        <TituloCartao icone={Scales}>Comparação dos componentes</TituloCartao>
        <span className={diferencas && !aceitas ? 'pc-cab-apoio pc-alerta' : 'pc-cab-apoio'}>
          {apoio}
        </span>
      </header>
      {layouts === undefined ? (
        <div className="pc-espera">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      ) : layouts === null ? (
        <p className="pc-nada">
          Não achei a cotação deste pedido, e sem ela não há o que comparar.
        </p>
      ) : !layouts.length ? (
        <p className="pc-nada">O orçamento não tem layout.</p>
      ) : (
        layouts.map(l => {
          const aberto = abertos[l.n] ?? l.diferencas > 0
          const Seta = aberto ? CaretDown : CaretRight
          return (
            <div key={l.n} className="pc-cmp-lay" data-comparacao={L(l.n)}>
              <button
                type="button"
                className="pc-cmp-topo"
                aria-expanded={aberto}
                onClick={() => setAbertos(a => ({ ...a, [l.n]: !aberto }))}
              >
                <Seta size={14} aria-hidden="true" />
                <span className="pc-cmp-nome pc-corta">
                  {L(l.n)} · {l.nome.toUpperCase()}
                </span>
                <span className={l.diferencas ? 'pc-cmp-conta diferenca' : 'pc-cmp-conta'}>
                  <IconeDoEstado e={l.diferencas ? 'diferenca' : 'ok'} tamanho={16} />
                  {l.confere} de {l.total}
                </span>
              </button>
              {aberto ? (
                <ul className="pc-cmp-linhas">
                  {l.linhas.map(x => (
                    <li key={x.chave} className={CLASSE_DA_LINHA[x.estado]} data-linha={x.chave}>
                      <IconeDoEstado e={x.estado} />
                      <div className="pc-cmp-meio">
                        <b>{x.titulo}</b>
                        <dl>
                          {x.lados.map((y, i) => (
                            <div key={i} className="pc-cmp-lado">
                              <dt>{y.rotulo}</dt>
                              <dd className={y.alerta ? 'pc-alerta' : undefined}>{y.texto}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })
      )}
    </section>
  )
}
