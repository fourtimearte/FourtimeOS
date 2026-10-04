import { Fragment, useMemo, useState } from 'react'
import { CaretDown, CaretRight, CaretUp, TShirt } from '@phosphor-icons/react'
import { Kpi, Selo } from '@ds'
import { nomeDoMes } from '@shared'
import {
  miniatura,
  quandoNaLoja,
  seloDaVenda,
  somar,
  somarPorMes,
  tamanhoDaVenda,
  type VendaDoParceiro,
} from '@dominio/parceiro'
import {
  dinheiro,
  faltaDeAcordo,
  inteiro,
  mesCurtoComAno,
  mesSozinho,
  parteNaTela,
  plural,
  semCifrao,
} from './apoio'
import { GraficoPorMes } from './grafico'

/* ==========================================================================
   A aba Vendas de um parceiro.

   Os mesmos números que o parceiro vê na página dele, na loja: os quatro
   números do mês, as peças e o dinheiro por mês, e as vendas.

   OS MESES EM SANFONA. "Totais por mês" e "vendas do mês" são uma tabela só.
   Cada mês é uma linha que abre: embaixo dela vem um segundo cabeçalho, o das
   vendas, as 5 vendas mais novas do mês e a linha de ver mais. O mês em
   andamento já vem aberto, e só um fica aberto por vez. Pedido do Henrique de
   04/10/2026, na versão 2 do wireframe.

   Venda devolvida ou cancelada aparece na lista, riscada e com o selo, e não
   entra em nenhuma soma: é o que o parceiro também vê.
   ========================================================================== */

/** quantas vendas o mês aberto mostra antes do "ver mais" */
const PRIMEIRAS = 5

export function VendasDoParceiro({
  vendas,
  meses,
  mesAtual,
  dia,
  estreita,
}: {
  /** as vendas deste parceiro no período, da mais nova para a mais velha */
  vendas: VendaDoParceiro[]
  /** os meses do período, do mais velho para o mais novo */
  meses: string[]
  mesAtual: string
  /** o dia de hoje na loja, "03": até onde o mês em andamento foi */
  dia: string
  estreita: boolean
}) {
  const [aberto, setAberto] = useState(mesAtual)
  const [inteira, setInteira] = useState(false)

  const porMes = useMemo(() => somarPorMes(vendas, meses), [vendas, meses])
  const total = useMemo(() => somar(vendas), [vendas])
  const noMes = porMes[meses.indexOf(mesAtual)] ?? { pecas: 0, valor: 0, parte: 0, semAcordo: 0 }
  const doNovoParaOVelho = useMemo(
    () => meses.map((m, i) => ({ mes: m, soma: porMes[i] })).reverse(),
    [meses, porMes],
  )

  const nosUltimos = `nos últimos ${meses.length} meses`
  const esteMes = mesSozinho(mesAtual)

  const abrir = (m: string) => {
    setAberto(antes => (antes === m ? '' : m))
    setInteira(false)
  }

  const doMes = (m: string) => vendas.filter(v => v.mes === m)

  /* ---------- as peças de uma venda, iguais na tabela e no cartão ---------- */
  const foto = (v: VendaDoParceiro) => {
    const endereco = miniatura(v.imagem)
    return (
      <span className="pa-foto">
        {endereco ? (
          <img
            src={endereco}
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
    )
  }
  const valorDaVenda = (v: VendaDoParceiro) =>
    v.conta ? dinheiro(v.valor) : v.vendido === null ? '' : dinheiro(v.vendido)
  const parteDaVenda = (v: VendaDoParceiro) =>
    !v.conta ? 'não conta' : v.parte === null ? 'sem acordo' : dinheiro(v.parte)
  const quantidadeDaVenda = (v: VendaDoParceiro) => (v.conta ? v.pecas : v.quantidade)

  const verMais = (m: string, quantas: number) => {
    const resto = quantas - PRIMEIRAS
    if (resto <= 0) return null
    return (
      <button
        type="button"
        className="pa-ver-mais"
        aria-expanded={inteira}
        onClick={() => setInteira(i => !i)}
      >
        {inteira ? 'Ver menos' : `Ver mais ${plural(resto, 'venda', 'vendas')} de ${mesSozinho(m)}`}
        {inteira ? <CaretUp size={16} /> : <CaretDown size={16} />}
      </button>
    )
  }
  const semVenda = (m: string) => (
    <p className="pa-ajuda pa-mes-vazio">
      Nenhuma venda em {mesSozinho(m)}
      {m === mesAtual ? ' até agora.' : '.'}
    </p>
  )

  /* ---------- a tabela, na tela que não é o celular ------------------------- */
  const vendasEmTabela = (m: string) => {
    const todas = doMes(m)
    if (todas.length === 0) return semVenda(m)
    const mostradas = inteira ? todas : todas.slice(0, PRIMEIRAS)
    const mais = verMais(m, todas.length)
    return (
      <table className="tabela pa-vendas">
        <colgroup>
          <col className="pa-col-data" />
          <col />
          <col className="pa-col-tamanho" />
          <col className="pa-col-pecas" />
          <col className="pa-col-valor" />
          <col className="pa-col-parte" />
        </colgroup>
        <thead>
          <tr>
            <th>Data</th>
            <th>Peça</th>
            <th>Tamanho</th>
            <th className="dir">Qtd.</th>
            <th className="dir">Valor</th>
            <th className="dir">Parte</th>
          </tr>
        </thead>
        <tbody>
          {mostradas.map(v => {
            const q = quandoNaLoja(v.quando)
            const selo = seloDaVenda(v)
            return (
              <tr key={v.id} className={v.conta ? undefined : 'pa-fora'}>
                <td>
                  {q.dia} <span className="pa-hora">{q.hora}</span>
                </td>
                <td className="pa-quebra">
                  <span className="pa-peca">
                    {foto(v)}
                    <span className="pa-peca-nome">
                      <span className={v.conta ? undefined : 'pa-riscado'}>{v.produto}</span>
                      {selo ? <Selo forma="contorno">{selo}</Selo> : null}
                    </span>
                  </span>
                </td>
                <td>{tamanhoDaVenda(v)}</td>
                <td className="dir">{inteiro(quantidadeDaVenda(v))}</td>
                <td className={v.conta ? 'dir' : 'dir pa-riscado'}>{valorDaVenda(v)}</td>
                <td className={v.conta ? 'dir pa-forte' : 'dir'}>{parteDaVenda(v)}</td>
              </tr>
            )
          })}
          {mais ? (
            <tr className="pa-mais">
              <td colSpan={6}>{mais}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    )
  }

  const tabela = (
    <div className="cartao pa-quadro">
      <div className="tabela-rola">
        <table className="tabela pa-meses">
          <colgroup>
            <col />
            <col className="pa-col-pecas" />
            <col className="pa-col-valor" />
            <col className="pa-col-parte" />
          </colgroup>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="dir">Peças</th>
              <th className="dir">Total vendido</th>
              <th className="dir">Parte do parceiro</th>
            </tr>
          </thead>
          <tbody>
            {doNovoParaOVelho.map(({ mes: m, soma }) => {
              const esta = aberto === m
              return (
                <Fragment key={m}>
                  <tr className={esta ? 'pa-mes aberto' : 'pa-mes'} onClick={() => abrir(m)}>
                    <td>
                      <button type="button" className="pa-mes-nome" aria-expanded={esta}>
                        <span className="pa-chev">
                          {esta ? <CaretDown size={16} /> : <CaretRight size={16} />}
                        </span>
                        <span>
                          {nomeDoMes(m)}
                          {m === mesAtual ? <small> (até o dia {dia})</small> : null}
                        </span>
                      </button>
                    </td>
                    <td className="dir">{inteiro(soma.pecas)}</td>
                    <td className="dir">{dinheiro(soma.valor)}</td>
                    <td className="dir pa-forte">{parteNaTela(soma)}</td>
                  </tr>
                  {esta ? (
                    <tr className="pa-mes-dentro">
                      <td colSpan={4}>
                        <div className="pa-mes-caixa">{vendasEmTabela(m)}</div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            <tr className="total">
              <td>
                <span className="pa-mes-nome">
                  <span className="pa-chev" />
                  Total
                </span>
              </td>
              <td className="dir">{inteiro(total.pecas)}</td>
              <td className="dir">{dinheiro(total.valor)}</td>
              <td className="dir">{parteNaTela(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  /* ---------- a lista, no celular -------------------------------------------- */
  const vendasEmCartoes = (m: string) => {
    const todas = doMes(m)
    if (todas.length === 0) return semVenda(m)
    const mostradas = inteira ? todas : todas.slice(0, PRIMEIRAS)
    return (
      <>
        {mostradas.map(v => {
          const q = quandoNaLoja(v.quando)
          const selo = seloDaVenda(v)
          const t = tamanhoDaVenda(v)
          const medida = `${t ? `Tamanho ${t}, ` : ''}${plural(quantidadeDaVenda(v), 'peça', 'peças')}`
          return (
            <div key={v.id} className={v.conta ? 'pa-venda' : 'pa-venda pa-fora'}>
              {foto(v)}
              <div className="pa-venda-texto">
                <div className="pa-venda-linha pa-venda-topo">
                  <span>
                    {q.dia} às {q.hora}
                  </span>
                  {v.conta ? <span>{medida}</span> : <Selo forma="contorno">{selo}</Selo>}
                </div>
                <div className={v.conta ? 'pa-venda-peca' : 'pa-venda-peca pa-riscado'}>
                  {v.produto}
                </div>
                {v.conta && selo ? (
                  <div className="pa-venda-linha">
                    <Selo forma="contorno">{selo}</Selo>
                  </div>
                ) : null}
                <div className="pa-venda-linha">
                  <span className={v.conta ? undefined : 'pa-riscado'}>{valorDaVenda(v)}</span>
                  <span className={v.conta ? 'pa-forte' : undefined}>
                    {v.conta ? `Parte: ${parteDaVenda(v)}` : 'não conta'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        {verMais(m, todas.length)}
      </>
    )
  }

  const lista = (
    <>
      <div className="cartao pa-quadro pa-meses-cel">
        <div className="pa-mes-linha cabeca">
          <span className="pa-mes-nome">
            <span className="pa-chev" />
            Mês
          </span>
          <span>Peças</span>
          <span>Vendido</span>
          <span>Parte</span>
        </div>
        {doNovoParaOVelho.map(({ mes: m, soma }) => {
          const esta = aberto === m
          return (
            <Fragment key={m}>
              <button
                type="button"
                className={esta ? 'pa-mes-linha aberto' : 'pa-mes-linha'}
                aria-expanded={esta}
                onClick={() => abrir(m)}
              >
                <span className="pa-mes-nome">
                  <span className="pa-chev">
                    {esta ? <CaretDown size={16} /> : <CaretRight size={16} />}
                  </span>
                  {mesCurtoComAno(m)}
                </span>
                <span>{inteiro(soma.pecas)}</span>
                <span>{semCifrao(soma.valor)}</span>
                <b>{parteNaTela(soma, semCifrao)}</b>
              </button>
              {esta ? <div className="pa-mes-dentro">{vendasEmCartoes(m)}</div> : null}
            </Fragment>
          )
        })}
        <div className="pa-mes-linha total">
          <span className="pa-mes-nome">
            <span className="pa-chev" />
            Total
          </span>
          <span>{inteiro(total.pecas)}</span>
          <span>{semCifrao(total.valor)}</span>
          <span>{parteNaTela(total, semCifrao)}</span>
        </div>
      </div>
      <p className="pa-ajuda">Valores em reais. Toque num mês para abrir as vendas dele.</p>
    </>
  )

  return (
    <>
      <div className="pa-numeros">
        <Kpi rotulo={`Peças em ${esteMes}`} valor={inteiro(noMes.pecas)} />
        <Kpi rotulo={`Vendido em ${esteMes}`} valor={dinheiro(noMes.valor)} />
        <Kpi
          rotulo={`Parte em ${esteMes}`}
          valor={parteNaTela(noMes)}
          sub={faltaDeAcordo(noMes) || undefined}
        />
        <Kpi
          rotulo={`Parte em ${meses.length} meses`}
          valor={parteNaTela(total)}
          sub={faltaDeAcordo(total) || undefined}
        />
      </div>

      <div className="pa-graficos">
        <GraficoPorMes
          titulo="Peças vendidas"
          total={inteiro(total.pecas)}
          sub={`${total.pecas === 1 ? 'peça' : 'peças'} ${nosUltimos}`}
          meses={meses}
          valores={porMes.map(s => s.pecas)}
          mesAtual={mesAtual}
          minimo={1}
          emDinheiro={false}
          longo={inteiro}
          curto={inteiro}
          falado={v => plural(v, 'peça', 'peças')}
        />
        <GraficoPorMes
          titulo="Total vendido"
          total={dinheiro(total.valor)}
          sub={`em vendas ${nosUltimos}`}
          meses={meses}
          valores={porMes.map(s => s.valor)}
          mesAtual={mesAtual}
          minimo={100}
          emDinheiro
          longo={v => inteiro(Math.round(v))}
          curto={v => inteiro(Math.round(v))}
          falado={dinheiro}
        />
      </div>

      <section className="pa-bloco">
        <div className="pa-bloco-topo">
          <h2 className="pa-bloco-titulo">Vendas por mês</h2>
          {estreita ? null : (
            <span className="pa-ajuda">Clique num mês para abrir as vendas dele.</span>
          )}
        </div>
        {estreita ? lista : tabela}
      </section>
    </>
  )
}
