import type { CSSProperties } from 'react'
import { CalendarBlank, Receipt, Target, Truck, UsersThree } from '@phosphor-icons/react'
import { Kpi, TituloCartao, Vazio } from '@ds'
import {
  MEIOS,
  MOTIVOS,
  NOME_DO_MEIO,
  NOME_DO_MOTIVO,
  abertos,
  repartir,
  semanaDoMes,
  somaDe,
  type Lancamento,
  type Meio,
  type Motivo,
} from '@dominio/transporte'
import { dinheiro, dinheiroCurto, lerMes, MES_LONGO, nomeDoMes, plural } from './apoio'
import { Barras, comparacao, IconeDoMeio } from './resumo'

/* ==========================================================================
   O relatório de gastos com transporte.

   A mesma soma olhada de cinco jeitos: o total, por meio, por motivo, por
   semana e por quem recebeu. Nada aqui é digitado: tudo sai dos lançamentos
   do mês escolhido na barra.

   AS BARRAS TÊM UMA COR SÓ. Elas medem tamanho, e o nome de cada uma está
   escrito ao lado; cor a mais seria enfeite.
   ========================================================================== */

export function RelatorioDeTransporte({
  lancamentos,
  anteriores,
  mes,
  hoje,
  estreita,
}: {
  lancamentos: Lancamento[]
  anteriores: Lancamento[]
  mes: string
  hoje: Date
  /* no celular os quatro números vão dois a dois, e o valor comprido encolhe
     pela regra do próprio Kpi; na tela larga os quatro ficam do mesmo corpo */
  estreita: boolean
}) {
  if (!lancamentos.length) {
    return (
      <section className="cartao tp-quadro">
        <Vazio
          titulo={`Nenhum transporte em ${nomeDoMes(mes).toLowerCase()}`}
          texto="O relatório se monta sozinho com os lançamentos do mês."
        />
      </section>
    )
  }

  const total = somaDe(lancamentos)
  const emAberto = abertos(lancamentos)
  const { texto } = comparacao(lancamentos, anteriores, mes, hoje)
  const nome = MES_LONGO[lerMes(mes).mes]
  const maisCara = [...lancamentos].sort((a, b) => b.valor - a.valor)[0]
  const entregas = lancamentos.filter((l) => l.motivo === 'entrega').length
  const buscas = lancamentos.filter((l) => l.motivo === 'busca').length

  const porMeio = repartir(
    lancamentos,
    (l) => l.meio,
    (k) => NOME_DO_MEIO[k as Meio],
  ).sort((a, b) => MEIOS.indexOf(a.chave as Meio) - MEIOS.indexOf(b.chave as Meio))
  const porMotivo = repartir(
    lancamentos,
    (l) => l.motivo,
    (k) => NOME_DO_MOTIVO[k as Motivo],
  ).sort((a, b) => MOTIVOS.indexOf(a.chave as Motivo) - MOTIVOS.indexOf(b.chave as Motivo))

  const semanas = [1, 2, 3, 4, 5].map((s) => {
    const daSemana = lancamentos.filter((l) => semanaDoMes(l.quando) === s)
    return { semana: s, corridas: daSemana.length, valor: somaDe(daSemana) }
  })
  const maiorSemana = Math.max(...semanas.map((s) => s.valor)) || 1

  const porQuem = repartir(
    lancamentos,
    (l) => l.transportadorId,
    (k) => lancamentos.find((l) => l.transportadorId === k)?.transportador ?? k,
  )
  const meioDe = (id: string) => lancamentos.find((l) => l.transportadorId === id)?.meio ?? 'motoboy'
  const comPedido = lancamentos.filter((l) => l.pedido)
  const porPedido = repartir(
    comPedido,
    (l) => l.pedido,
    (k) => k,
  ).slice(0, 6)
  const clienteDe = (pedido: string) => comPedido.find((l) => l.pedido === pedido)?.cliente ?? ''

  return (
    <div className="tp-relatorio">
      <div className="fila-kpi tp-kpis">
        <Kpi rotulo={`Gasto em ${nome}`} valor={estreita ? dinheiro(total) : <>{dinheiro(total)}</>} sub={texto} />
        <Kpi
          rotulo="Corridas"
          valor={lancamentos.length}
          sub={`${plural(entregas, 'entrega', 'entregas')} e ${plural(buscas, 'busca', 'buscas')}`}
        />
        <Kpi
          rotulo="Média por corrida"
          valor={estreita ? dinheiro(total / lancamentos.length) : <>{dinheiro(total / lancamentos.length)}</>}
          sub={`a mais cara foi ${dinheiroCurto(maisCara.valor)}, ${maisCara.transportador}`}
        />
        <Kpi
          rotulo="A pagar"
          valor={estreita ? dinheiro(somaDe(emAberto)) : <>{dinheiro(somaDe(emAberto))}</>}
          sub={emAberto.length ? plural(emAberto.length, 'corrida em aberto', 'corridas em aberto') : 'tudo acertado'}
          aviso={emAberto.length > 0}
        />
      </div>

      <div className="tp-rel-duas">
        <section className="cartao tp-caixa">
          <div className="tp-caixa-topo">
            <TituloCartao icone={Truck}>Por meio</TituloCartao>
            <span className="tp-caixa-nota">onde o dinheiro foi</span>
          </div>
          <div className="tp-caixa-corpo">
            <Barras fatias={porMeio} vazio="Sem corrida neste mês." />
          </div>
        </section>
        <section className="cartao tp-caixa">
          <div className="tp-caixa-topo">
            <TituloCartao icone={Target}>Para quê</TituloCartao>
            <span className="tp-caixa-nota">entregar ao cliente ou buscar material</span>
          </div>
          <div className="tp-caixa-corpo">
            <Barras fatias={porMotivo} vazio="Sem corrida neste mês." />
          </div>
        </section>
      </div>

      <section className="cartao tp-caixa">
        <div className="tp-caixa-topo">
          <TituloCartao icone={CalendarBlank}>Por semana</TituloCartao>
          <span className="tp-caixa-nota tp-some-estreito">a semana é a do mês: do dia 1 ao 7, do 8 ao 14, e assim vai</span>
        </div>
        <div className="tp-colunas">
          {semanas.map((s) => (
            <div
              key={s.semana}
              className="tp-coluna"
              title={`Semana ${s.semana}: ${dinheiro(s.valor)} em ${plural(s.corridas, 'corrida', 'corridas')}`}
            >
              <span className="tp-coluna-valor">{s.valor ? dinheiroCurto(Math.round(s.valor)) : ''}</span>
              <span className="tp-coluna-vao">
                <span
                  className={s.valor ? 'tp-coluna-cheia' : 'tp-coluna-cheia vazia'}
                  style={{ '--a': `${s.valor ? Math.max(3, (s.valor / maiorSemana) * 100) : 0}%` } as CSSProperties}
                />
              </span>
              <span className="tp-coluna-nome">
                <b>
                  <span className="tp-some-estreito">Semana</span>
                  <span className="tp-so-estreito">Sem</span> {s.semana}
                </b>
                <small>{s.corridas ? plural(s.corridas, 'corrida', 'corridas') : 'sem corrida'}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="tp-rel-duas">
        <section className="cartao tp-caixa">
          <div className="tp-caixa-topo">
            <TituloCartao icone={UsersThree}>Quem mais recebeu</TituloCartao>
            <span className="tp-caixa-nota">{plural(porQuem.length, 'nome', 'nomes')} no mês</span>
          </div>
          <div className="tabela-rola">
            <table className="tabela tp-tabela">
              <thead>
                <tr>
                  <th>Quem levou</th>
                  <th className="dir tp-some-estreito">Corridas</th>
                  <th className="dir">Valor</th>
                  <th className="dir tp-some-estreito">Do total</th>
                </tr>
              </thead>
              <tbody>
                {porQuem.slice(0, 6).map((f) => (
                  <tr key={f.chave}>
                    <td>
                      <span className="tp-quem">
                        <IconeDoMeio meio={meioDe(f.chave)} />
                        <span className="tp-nome">
                          <b>{f.nome}</b>
                          {f.nome === NOME_DO_MEIO[meioDe(f.chave)] ? null : <small>{NOME_DO_MEIO[meioDe(f.chave)]}</small>}
                        </span>
                      </span>
                    </td>
                    <td className="dir tp-numero tp-some-estreito">{f.corridas}</td>
                    <td className="dir tp-numero-forte">{dinheiro(f.valor)}</td>
                    <td className="dir tp-numero tp-apoio tp-some-estreito">{Math.round(f.parte * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cartao tp-caixa">
          <div className="tp-caixa-topo">
            <TituloCartao icone={Receipt}>Pedidos que mais gastaram</TituloCartao>
            <span className="tp-caixa-nota">
              {dinheiro(somaDe(comPedido))} em {plural(new Set(comPedido.map((l) => l.pedido)).size, 'pedido', 'pedidos')}
            </span>
          </div>
          {porPedido.length ? (
            <div className="tabela-rola">
              <table className="tabela tp-tabela">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th className="dir tp-some-estreito">Corridas</th>
                    <th className="dir">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {porPedido.map((f) => (
                    <tr key={f.chave}>
                      <td>
                        <span className="tp-nome">
                          <b>{f.nome}</b>
                          <small>{clienteDe(f.chave)}</small>
                        </span>
                      </td>
                      <td className="dir tp-numero tp-some-estreito">{f.corridas}</td>
                      <td className="dir tp-numero-forte">{dinheiro(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tp-vazio-dentro">Nenhuma corrida deste mês foi ligada a um pedido.</p>
          )}
        </section>
      </div>

      <p className="tp-rodape">
        Baixar planilha, no topo da página, leva uma linha por lançamento de {nome}: data, meio, quem levou, pedido,
        valor, forma de pagamento e situação.
      </p>
    </div>
  )
}
