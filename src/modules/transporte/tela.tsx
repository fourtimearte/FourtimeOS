import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { CaretRight, DownloadSimple, Plus, X } from '@phosphor-icons/react'
import { Botao, Busca, Chip, Esqueleto, Gaveta, Pagina, Segmentado, Seletor, Vazio, avisar } from '@ds'
import { usarConsulta } from '@shared'
import {
  MEIOS,
  NOME_DA_FORMA,
  NOME_DO_MEIO,
  NOME_DO_MOTIVO,
  abertosDe,
  acertarTransporte,
  apagarLancamento,
  corridasDe,
  custoDe,
  temAberto,
  aConfirmar,
  carregarFretes,
  combinaComFrete,
  passaNoFiltro,
  type FiltroDoFrete,
  type FreteDoPedido,
  carregarLancamentos,
  carregarTransportadores,
  combinaComLancamento,
  limitesDoMes,
  paraQue,
  planilhaDoPeriodo,
  type Lancamento,
  type Meio,
  type Transportador,
} from '@dominio/transporte'
import { pode, souAdmin, useSessao } from '@dominio/sessao'
import {
  chaveDoDia,
  diaPorExtenso,
  dinheiro,
  hora,
  lerMes,
  mesAnterior,
  nomeDoMes,
  plural,
  ultimosMeses,
} from './apoio'
import { BotoesDoLancamento, CorpoDoLancamento, IconeDoMeio, ResumoDoMes, SituacaoDaLinha } from './resumo'
import { FolhaDeLancamento, type InicioDoLancamento } from './folha'
import { QuemTransporta } from './quem'
import { Lixeira } from './lixeira'
import { ConfirmacaoDoFrete } from './confirmacao'
import { WhatsAppDaLogistica } from './whatsapp'
import { RelatorioDeTransporte } from './relatorio'
import './transporte.css'

/* ==========================================================================
   Transporte.

   O que a Fourtime paga para levar e buscar. Três jeitos de olhar a mesma
   coisa: os lançamentos, dia por dia, com o resumo do mês ao lado; quem
   transporta, que é o cadastro; e o relatório, que é a soma.

   A LISTA E O ESCOLHIDO AO LADO, como no Estoque e em Fornecedores. Sem
   nada escolhido, o lado mostra o mês: quanto foi, o que está aberto para
   acertar e como se reparte. Com uma corrida escolhida, mostra a corrida.

   DUAS ABAS DA LOGÍSTICA (080, 14/10/2026): a Confirmação do frete (o
   frete que o cliente paga antes, em três passos) e o WhatsApp (o mesmo do
   Funil, com os pedidos PRONTOS e as mensagens da logística ao lado). São
   abas daqui, e não páginas nem itens do menu, a pedido do Henrique.

   O MÊS É O FILTRO DE TUDO. Lançamento, cadastro e relatório leem o mesmo
   mês, que mora na barra de controle.
   ========================================================================== */

type Aba = 'lancamentos' | 'frete' | 'whatsapp' | 'quem' | 'relatorio' | 'lixeira'
type EntregaFiltro = 'hoje' | 'semana' | 'todas'
type Filtro = '' | Meio | 'aberto'

export function TelaTransporte() {
  const { estado } = useSessao()
  const pessoa = estado.fase === 'dentro' ? estado.pessoa : null
  const podeEditar = !!pessoa && pode(pessoa, 'transporte', 'editar')
  const podeApagar = !!pessoa && pode(pessoa, 'transporte', 'deletar')
  const admin = souAdmin(pessoa)

  const [hoje] = useState(() => new Date())
  const meses = useMemo(() => ultimosMeses(hoje), [hoje])
  const [mes, setMes] = useState(meses[0])

  const [transportadores, setTransportadores] = useState<Transportador[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [anteriores, setAnteriores] = useState<Lancamento[]>([])
  /* a Confirmação do frete e o WhatsApp (080): null antes da 080 rodar */
  const [fretes, setFretes] = useState<FreteDoPedido[] | null>([])
  const [filtroDoFrete, setFiltroDoFrete] = useState<FiltroDoFrete>('aconfirmar')
  const [entrega, setEntrega] = useState<EntregaFiltro>('semana')
  const [buscaDoFrete, setBuscaDoFrete] = useState('')
  const [conversa, setConversa] = useState<{ id: string; marca: number } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [aba, setAba] = useState<Aba>('lancamentos')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('')
  const [aberto, setAberto] = useState('')
  const [lancando, setLancando] = useState<InicioDoLancamento | null>(null)
  const [cadastrando, setCadastrando] = useState(false)

  const larga = usarConsulta('(min-width: 1200px)')
  /* no celular a tabela vira lista: uma linha de duas linhas por corrida */
  const estreita = usarConsulta('(max-width: 767px)')

  const ler = useCallback(async () => {
    const agora = lerMes(mes)
    const antes = lerMes(mesAnterior(mes))
    const [ts, ls, as, fs] = await Promise.all([
      carregarTransportadores(),
      carregarLancamentos(limitesDoMes(agora.ano, agora.mes).de, limitesDoMes(agora.ano, agora.mes).ate),
      /* o mês anterior é só a comparação: sem ele a página ainda funciona */
      carregarLancamentos(limitesDoMes(antes.ano, antes.mes).de, limitesDoMes(antes.ano, antes.mes).ate).catch(
        () => [] as Lancamento[],
      ),
      /* o frete é outra aba: se falhar, os lançamentos ainda abrem */
      carregarFretes().catch(() => null),
    ])
    setFretes(fs)
    setTransportadores(ts)
    setLancamentos(ls)
    setAnteriores(as)
    setErro('')
  }, [mes])

  const recarregar = useCallback(async () => {
    try {
      await ler()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o transporte.')
    }
  }, [ler])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    ler()
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler o transporte.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [ler])

  /* AS CORRIDAS são o que a Fourtime pagou, uma por frete (o envio e a
     coleta): é sobre elas que o resumo, o A pagar e o relatório fazem conta */
  const corridas = useMemo(() => corridasDe(lancamentos), [lancamentos])
  const corridasAntes = useMemo(() => corridasDe(anteriores), [anteriores])
  const somaDoDia = (ls: Lancamento[]) => ls.reduce((s, l) => s + custoDe(l), 0)

  const fretesFiltrados = useMemo(() => {
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hojeIso = iso(hoje)
    const domingo = new Date(hoje)
    domingo.setDate(hoje.getDate() + ((7 - hoje.getDay()) % 7))
    const fimDaSemana = iso(domingo)
    return (fretes ?? []).filter((f) => {
      if (!passaNoFiltro(f, filtroDoFrete)) return false
      if (entrega === 'hoje' && !(f.entregaEm && f.entregaEm <= hojeIso)) return false
      if (entrega === 'semana' && f.entregaEm && f.entregaEm > fimDaSemana) return false
      return combinaComFrete(f, buscaDoFrete)
    })
  }, [fretes, filtroDoFrete, entrega, buscaDoFrete, hoje])
  const quantosDoFrete = (k: FiltroDoFrete) => (fretes ?? []).filter((f) => passaNoFiltro(f, k)).length
  const faltamConfirmar = (fretes ?? []).filter(aConfirmar).length

  const filtrados = useMemo(
    () =>
      lancamentos.filter((l) => {
        if (filtro === 'aberto' && !temAberto(l)) return false
        if (filtro && filtro !== 'aberto' && l.meio !== filtro) return false
        return combinaComLancamento(l, busca)
      }),
    [lancamentos, filtro, busca],
  )

  /* um grupo por dia, na ordem em que os lançamentos já vêm: do mais novo */
  const dias = useMemo(() => {
    const mapa = new Map<string, Lancamento[]>()
    filtrados.forEach((l) => {
      const k = chaveDoDia(l.quando)
      mapa.set(k, [...(mapa.get(k) ?? []), l])
    })
    return [...mapa.entries()]
  }, [filtrados])

  /* a coleta escolhida no A pagar abre o lançamento dela */
  const escolhido = lancamentos.find((l) => l.id === aberto || l.coleta?.id === aberto) ?? null
  const noLado = larga && !!escolhido
  const naFolha = !!escolhido && !larga

  async function apagar(l: Lancamento) {
    try {
      await apagarLancamento(l.id)
      avisar(admin ? 'Foi para a lixeira. Dá para devolver na aba Lixeira.' : 'Foi para a lixeira. O administrador pode devolver.', 'ok')
      setAberto('')
      await recarregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui apagar.', 'brand')
    }
  }

  async function acertar(ids: string[], quem: string) {
    if (!ids.length) return
    try {
      await acertarTransporte(ids)
      avisar(`${plural(ids.length, 'corrida acertada', 'corridas acertadas')} com ${quem}.`, 'ok')
      await recarregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui acertar.', 'brand')
    }
  }

  function baixarPlanilha() {
    const arquivo = new Blob(['﻿' + planilhaDoPeriodo(lancamentos)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(arquivo)
    link.download = `transporte-${mes}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const corpoDoLancamento = escolhido ? <CorpoDoLancamento l={escolhido} hoje={hoje} /> : null
  const botoesDoLancamento = escolhido ? (
    <BotoesDoLancamento
      key={escolhido.id}
      l={escolhido}
      podeEditar={podeEditar}
      podeApagar={podeApagar}
      aoAcertar={() => void acertar(abertosDe(escolhido), escolhido.transportador)}
      aoEditar={() => setLancando({ editar: escolhido })}
      aoApagar={() => void apagar(escolhido)}
    />
  ) : null

  return (
    <Pagina
      acima="Gestão"
      titulo="Transporte"
      sub="O que a Fourtime paga para levar e buscar: transportadora, Correios, aéreo, ônibus, motoboy, Uber e táxi."
      acoes={
        <>
          <Botao onClick={baixarPlanilha} disabled={!lancamentos.length}>
            <DownloadSimple size={16} />
            Baixar planilha
          </Botao>
          {podeEditar ? (
            <Botao tom="primario" onClick={() => setLancando({})}>
              <Plus size={16} weight="bold" />
              Lançar transporte
            </Botao>
          ) : null}
        </>
      }
    >
      <div className="tp-barra">
        <Segmentado
          className="tp-aba"
          valor={aba}
          aoMudar={(v) => {
            setAba(v)
            setAberto('')
          }}
          opcoes={[
            { valor: 'lancamentos', rotulo: 'Lançamentos' },
            {
              valor: 'frete',
              rotulo: faltamConfirmar ? (
                <>
                  Confirmação do frete <span className="tp-conta">{faltamConfirmar}</span>
                </>
              ) : (
                'Confirmação do frete'
              ),
            },
            { valor: 'whatsapp', rotulo: 'WhatsApp' },
            { valor: 'quem', rotulo: 'Quem transporta' },
            { valor: 'relatorio', rotulo: 'Relatório' },
            ...(podeApagar || admin ? [{ valor: 'lixeira' as const, rotulo: 'Lixeira' }] : []),
          ]}
        />
        {aba === 'lancamentos' ? (
          <>
            <Busca
              className="tp-busca"
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="Buscar por pedido, cliente ou quem levou"
              aria-label="Buscar lançamento"
            />
            <div className="tp-chips">
              <Chip ligado={filtro === ''} onClick={() => setFiltro('')}>
                Todos <span className="tp-conta">{lancamentos.length}</span>
              </Chip>
              {/* só os tipos que têm lançamento no mês: sete chips vazios só ocupam a barra */}
              {MEIOS.filter((m) => m === filtro || lancamentos.some((l) => l.meio === m)).map((m) => (
                <Chip key={m} ligado={filtro === m} onClick={() => setFiltro(filtro === m ? '' : m)}>
                  {NOME_DO_MEIO[m]} <span className="tp-conta">{lancamentos.filter((l) => l.meio === m).length}</span>
                </Chip>
              ))}
              <Chip ligado={filtro === 'aberto'} onClick={() => setFiltro(filtro === 'aberto' ? '' : 'aberto')}>
                A pagar <span className="tp-conta">{lancamentos.filter(temAberto).length}</span>
              </Chip>
            </div>
          </>
        ) : aba === 'frete' && fretes ? (
          <>
            <Busca
              className="tp-busca"
              value={buscaDoFrete}
              onChange={(e) => setBuscaDoFrete(e.currentTarget.value)}
              placeholder="Buscar pedido ou cliente"
              aria-label="Buscar pedido"
            />
            <div className="tp-chips">
              {(
                [
                  ['aconfirmar', 'A confirmar'],
                  ['confirmados', 'Confirmados'],
                  ['fourtime', 'Frete da Fourtime'],
                  ['todos', 'Todos'],
                ] as [FiltroDoFrete, string][]
              ).map(([k, r]) => (
                <Chip key={k} ligado={filtroDoFrete === k} onClick={() => setFiltroDoFrete(k)}>
                  {r} <span className="tp-conta">{quantosDoFrete(k)}</span>
                </Chip>
              ))}
            </div>
          </>
        ) : aba === 'quem' && podeEditar ? (
          <Botao onClick={() => setCadastrando(true)}>
            <Plus size={16} weight="bold" />
            Novo cadastro
          </Botao>
        ) : null}
        {aba === 'frete' ? (
          <span className="tp-fim">
            <Seletor
              campo
              rotulo="Entrega"
              valor={entrega}
              opcoes={[
                { valor: 'hoje', rotulo: 'Até hoje' },
                { valor: 'semana', rotulo: 'Esta semana' },
                { valor: 'todas', rotulo: 'Todas' },
              ]}
              aoEscolher={(v) => setEntrega((v || 'semana') as EntregaFiltro)}
              vazio="Esta semana"
            />
          </span>
        ) : aba === 'whatsapp' ? null : (
        <span className="tp-fim">
          <Seletor
            campo
            rotulo="Mês"
            valor={mes}
            opcoes={meses.map((m) => ({ valor: m, rotulo: nomeDoMes(m) }))}
            aoEscolher={(v) => {
              setMes(v || meses[0])
              setAberto('')
            }}
            vazio={nomeDoMes(meses[0])}
          />
        </span>
        )}
      </div>

      {erro ? (
        <section className="cartao tp-quadro">
          <Vazio titulo="Não consegui ler o transporte" texto={erro} />
        </section>
      ) : carregando ? (
        <section className="cartao tp-quadro">
          <div className="tp-espera">
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
            <Esqueleto altura={18} />
          </div>
        </section>
      ) : aba === 'frete' || aba === 'whatsapp' ? (
        fretes === null ? (
          <section className="cartao tp-quadro">
            <Vazio
              titulo="Esta aba espera a migração 080"
              texto="A confirmação do frete e o WhatsApp da logística chegam quando a 080 rodar no banco."
            />
          </section>
        ) : aba === 'frete' ? (
          <ConfirmacaoDoFrete
            fretes={fretesFiltrados}
            todos={fretes}
            hoje={hoje}
            podeEditar={podeEditar}
            larga={larga}
            estreita={estreita}
            aoMudar={recarregar}
            aoConversar={(f) => {
              setConversa({ id: f.pedidoId, marca: Date.now() })
              setAba('whatsapp')
            }}
          />
        ) : (
          <WhatsAppDaLogistica fretes={fretes} hoje={hoje} pedidoInicial={conversa} />
        )
      ) : aba === 'lixeira' ? (
        <Lixeira podeDevolver={admin} hoje={hoje} aoDevolver={recarregar} />
      ) : aba === 'quem' ? (
        <QuemTransporta
          transportadores={transportadores}
          lancamentos={corridas}
          mes={mes}
          hoje={hoje}
          podeEditar={podeEditar}
          estreita={estreita}
          novo={cadastrando}
          aoAbrirNovo={() => setCadastrando(false)}
          aoAcertar={acertar}
          aoLancar={(t) => setLancando({ meio: t.meio, transportadorId: t.id })}
          aoMudar={recarregar}
        />
      ) : aba === 'relatorio' ? (
        <RelatorioDeTransporte
          lancamentos={corridas}
          anteriores={corridasAntes}
          mes={mes}
          hoje={hoje}
          estreita={estreita}
        />
      ) : (
        <div className="tp-duas">
          <section className="cartao tp-quadro">
            {lancamentos.length === 0 ? (
              <Vazio
                titulo={`Nenhum transporte em ${nomeDoMes(mes).toLowerCase()}`}
                texto="Cada corrida paga entra aqui: a entrega do motoboy, o Uber que buscou a malha, o frete da transportadora."
                acao={podeEditar ? <Botao onClick={() => setLancando({})}>Lançar transporte</Botao> : undefined}
              />
            ) : filtrados.length === 0 ? (
              <Vazio titulo="Nada neste filtro" texto="Nenhum lançamento combina com o que está escolhido." />
            ) : estreita ? (
              <div className="tp-dias">
                {dias.map(([dia, doDia]) => (
                  <Fragment key={dia}>
                    <div className="tp-faixa">
                      <b>{diaPorExtenso(doDia[0].quando, hoje)}</b>
                      <span>{dinheiro(somaDoDia(doDia))}</span>
                    </div>
                    {doDia.map((l) => (
                      <button key={l.id} type="button" className="tp-item" onClick={() => setAberto(l.id)}>
                        <IconeDoMeio meio={l.meio} />
                        <span className="tp-nome">
                          <b>{paraQue(l)}</b>
                          <small>
                            {hora(l.quando)} · {l.transportador}
                          </small>
                        </span>
                        <span className="tp-item-fim">
                          <b>{dinheiro(custoDe(l) || l.valor)}</b>
                          <SituacaoDaLinha l={l} />
                        </span>
                      </button>
                    ))}
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className="tabela-rola">
                <table className="tabela tp-tabela">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Quem levou</th>
                      <th>Para quê</th>
                      <th className="tp-some-medio">Pagamento</th>
                      <th className="dir">Valor</th>
                      <th className="tp-some-estreito">Situação</th>
                      <th className="tp-some-estreito" aria-label="Abrir" />
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map(([dia, doDia]) => (
                      <Fragment key={dia}>
                        <tr className="grupo">
                          <td colSpan={4}>
                            <span className="tp-grupo">
                              <b>{diaPorExtenso(doDia[0].quando, hoje)}</b>
                              <span>{plural(doDia.length, 'corrida', 'corridas')}</span>
                            </span>
                          </td>
                          <td className="dir tp-numero-forte tp-do-grupo">{dinheiro(somaDoDia(doDia))}</td>
                          <td className="tp-some-estreito" colSpan={2} />
                        </tr>
                        {doDia.map((l) => (
                          <tr
                            key={l.id}
                            className={l.id === aberto ? 'tp-linha marcada' : 'tp-linha'}
                            onClick={() => setAberto(l.id === aberto && noLado ? '' : l.id)}
                          >
                            <td className="tp-apoio tp-numero">{hora(l.quando)}</td>
                            <td>
                              <span className="tp-quem">
                                <IconeDoMeio meio={l.meio} />
                                <span className="tp-nome">
                                  <b>{l.transportador}</b>
                                  {l.transportador === NOME_DO_MEIO[l.meio] ? null : <small>{NOME_DO_MEIO[l.meio]}</small>}
                                </span>
                              </span>
                            </td>
                            <td>
                              <span className="tp-nome">
                                <b>{paraQue(l)}</b>
                                <small>
                                  {[
                                    NOME_DO_MOTIVO[l.motivo],
                                    l.destino,
                                    l.coleta ? `coleta ${l.coleta.transportador} ${dinheiro(l.coleta.valor)}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </small>
                              </span>
                            </td>
                            <td className="tp-apoio tp-some-medio">
                              {l.fretePagoPor === 'cliente' ? 'Pelo cliente' : NOME_DA_FORMA[l.forma]}
                            </td>
                            <td className="dir tp-numero-forte">{dinheiro(custoDe(l) || l.valor)}</td>
                            <td className="tp-some-estreito">
                              <SituacaoDaLinha l={l} />
                            </td>
                            <td className="tp-some-estreito">
                              <span className="tp-direita">
                                <CaretRight size={16} />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="tp-lado">
            {noLado && escolhido ? (
              <section className="cartao tp-ficha">
                <div className="tp-ficha-topo">
                  <div>
                    <h2>{dinheiro(custoDe(escolhido) || escolhido.valor)}</h2>
                    <p>
                      {escolhido.transportador === NOME_DO_MEIO[escolhido.meio]
                        ? escolhido.transportador
                        : `${escolhido.transportador} · ${NOME_DO_MEIO[escolhido.meio]}`}
                    </p>
                  </div>
                  <button type="button" className="tp-fechar" aria-label="Fechar" onClick={() => setAberto('')}>
                    <X size={18} />
                  </button>
                </div>
                {corpoDoLancamento}
                <div className="tp-ficha-pe">{botoesDoLancamento}</div>
              </section>
            ) : (
              <ResumoDoMes
                lancamentos={corridas}
                anteriores={corridasAntes}
                mes={mes}
                hoje={hoje}
                podeEditar={podeEditar}
                aoAcertar={acertar}
                aoVerAbertos={() => setFiltro('aberto')}
              />
            )}
          </div>
        </div>
      )}

      <Gaveta
        aberto={naFolha}
        aoFechar={() => setAberto('')}
        titulo={escolhido ? `${dinheiro(custoDe(escolhido) || escolhido.valor)} · ${escolhido.transportador}` : ''}
        pe={botoesDoLancamento ?? undefined}
      >
        <div className="tp-na-folha">{corpoDoLancamento}</div>
      </Gaveta>

      <FolhaDeLancamento
        inicio={lancando}
        transportadores={transportadores}
        hoje={hoje}
        aoFechar={() => setLancando(null)}
        aoLancado={async () => {
          setLancando(null)
          await recarregar()
        }}
      />
    </Pagina>
  )
}
