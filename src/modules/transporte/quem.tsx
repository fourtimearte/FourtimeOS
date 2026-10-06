import { Fragment, useEffect, useState } from 'react'
import { CaretRight, NotePencil, Path } from '@phosphor-icons/react'
import {
  AreaTexto,
  avisar,
  Botao,
  Campo,
  Entrada,
  Gaveta,
  IconeDoTitulo,
  Modal,
  Segmentado,
  Vazio,
} from '@ds'
import { cnpjNaTela, cnpjValido, mascaraDoCnpj } from '@dominio/fornecedor'
import {
  MEIOS,
  NOME_DO_MEIO,
  abertos,
  paraQue,
  salvarTransportador,
  somaDe,
  type Lancamento,
  type Meio,
  type Transportador,
} from '@dominio/transporte'
import { dinheiro, lerMes, MES_LONGO, plural, quandoFoi } from './apoio'
import { IconeDoMeio, Situacao } from './resumo'

/* ==========================================================================
   Quem transporta: o cadastro.

   Uma faixa por meio, como Fornecedores faz por tipo. A transportadora tem
   CNPJ, e é por ele que o Verificador de Boleto a reconhece; motoboy, Uber e
   táxi não têm, e aqui isso não é falta.

   OS NÚMEROS SÃO DO MÊS ESCOLHIDO NA BARRA. Corridas, gasto e a pagar leem os
   mesmos lançamentos da primeira aba.
   ========================================================================== */

const NOVO_EM: Record<Meio, string> = {
  motoboy: 'Novo motoboy',
  uber: 'Novo aplicativo',
  taxi: 'Novo táxi',
  transportadora: 'Nova transportadora',
}

type Formulario = { id?: string; meio: Meio } | null

export function QuemTransporta({
  transportadores,
  lancamentos,
  mes,
  hoje,
  podeEditar,
  estreita,
  novo,
  aoAbrirNovo,
  aoAcertar,
  aoLancar,
  aoMudar,
}: {
  transportadores: Transportador[]
  lancamentos: Lancamento[]
  mes: string
  hoje: Date
  podeEditar: boolean
  /** no celular a tabela vira lista */
  estreita: boolean
  /** o botão "Novo cadastro" da barra foi apertado */
  novo: boolean
  aoAbrirNovo: () => void
  aoAcertar: (ids: string[], quem: string) => Promise<void>
  aoLancar: (t: Transportador) => void
  aoMudar: () => Promise<void>
}) {
  const [aberto, setAberto] = useState('')
  const [formulario, setFormulario] = useState<Formulario>(null)

  /* o botão da barra mora na página; quem abre o formulário é este pedaço */
  useEffect(() => {
    if (!novo) return
    setFormulario({ meio: 'motoboy' })
    aoAbrirNovo()
  }, [novo, aoAbrirNovo])

  const escolhido = transportadores.find((t) => t.id === aberto) ?? null
  const doEscolhido = escolhido ? lancamentos.filter((l) => l.transportadorId === escolhido.id) : []
  const abertosDoEscolhido = abertos(doEscolhido)
  const nomeDoMes = MES_LONGO[lerMes(mes).mes]

  return (
    <>
      <section className="cartao tp-quadro">
        {transportadores.length === 0 ? (
          <Vazio
            titulo="Ninguém cadastrado ainda"
            texto="Cadastre a transportadora, o motoboy, o Uber e o táxi que a Fourtime usa."
            acao={
              podeEditar ? <Botao onClick={() => setFormulario({ meio: 'motoboy' })}>Novo motoboy</Botao> : undefined
            }
          />
        ) : estreita ? (
          <div className="tp-dias">
            {MEIOS.map((meio) => {
              const doMeio = transportadores.filter((t) => t.meio === meio)
              return (
                <Fragment key={meio}>
                  <div className="tp-faixa">
                    <b>
                      {NOME_DO_MEIO[meio]} <small>{plural(doMeio.length, 'cadastro', 'cadastros')}</small>
                    </b>
                    <span>{dinheiro(somaDe(lancamentos.filter((l) => l.meio === meio)))}</span>
                  </div>
                  {doMeio.map((t) => {
                    const dele = lancamentos.filter((l) => l.transportadorId === t.id)
                    const aPagar = somaDe(abertos(dele))
                    return (
                      <button key={t.id} type="button" className="tp-item" onClick={() => setAberto(t.id)}>
                        <IconeDoMeio meio={t.meio} />
                        <span className="tp-nome">
                          <b>{t.nome}</b>
                          <small>{dele.length ? plural(dele.length, 'corrida', 'corridas') : 'nenhuma corrida'}</small>
                        </span>
                        <span className="tp-item-fim">
                          <b>{dele.length ? dinheiro(somaDe(dele)) : ''}</b>
                          {aPagar ? <Situacao pago={false} texto={`${dinheiro(aPagar)} a pagar`} /> : null}
                        </span>
                      </button>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        ) : (
          <div className="tabela-rola">
            <table className="tabela tp-tabela">
              <thead>
                <tr>
                  <th>Quem transporta</th>
                  <th className="tp-some-estreito">CNPJ ou contato</th>
                  <th className="tp-some-medio">Prazo</th>
                  <th className="dir">Corridas</th>
                  <th className="dir">Gasto em {nomeDoMes}</th>
                  <th className="dir tp-some-estreito">A pagar</th>
                  <th className="tp-some-estreito" aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {MEIOS.map((meio) => {
                  const doMeio = transportadores.filter((t) => t.meio === meio)
                  const gasto = somaDe(lancamentos.filter((l) => l.meio === meio))
                  return (
                    <Fragment key={meio}>
                      <tr className="grupo">
                        <td colSpan={4}>
                          <span className="tp-grupo">
                            <IconeDoMeio meio={meio} tamanho={16} />
                            <b>{NOME_DO_MEIO[meio]}</b>
                            <span>{plural(doMeio.length, 'cadastro', 'cadastros')}</span>
                          </span>
                        </td>
                        <td className="dir tp-numero-forte tp-do-grupo">{dinheiro(gasto)}</td>
                        <td className="tp-some-estreito" colSpan={2}>
                          {podeEditar ? (
                            <span className="tp-grupo-fim">
                              <Botao tamanho="sm" onClick={() => setFormulario({ meio })}>
                                {NOVO_EM[meio]}
                              </Botao>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                      {doMeio.map((t) => {
                        const dele = lancamentos.filter((l) => l.transportadorId === t.id)
                        const aPagar = somaDe(abertos(dele))
                        return (
                          <tr key={t.id} className="tp-linha" onClick={() => setAberto(t.id)}>
                            <td>
                              <span className="tp-nome">
                                <b>{t.nome}</b>
                                <small>{t.ondeAtende || 'sem região escrita'}</small>
                              </span>
                            </td>
                            <td className="tp-numero tp-some-estreito">
                              {t.meio === 'transportadora' ? (
                                t.cnpj ? (
                                  cnpjNaTela(t.cnpj)
                                ) : (
                                  <span className="tp-falta">falta o CNPJ</span>
                                )
                              ) : (
                                t.contato || <span className="tp-falta">sem contato</span>
                              )}
                            </td>
                            <td className="tp-apoio tp-some-medio">{t.prazo}</td>
                            <td className="dir tp-numero">{dele.length || ''}</td>
                            <td className="dir tp-numero-forte">{dele.length ? dinheiro(somaDe(dele)) : ''}</td>
                            <td className="dir tp-numero tp-some-estreito">
                              {aPagar ? <span className="tp-alerta">{dinheiro(aPagar)}</span> : ''}
                            </td>
                            <td className="tp-some-estreito">
                              <span className="tp-direita">
                                <CaretRight size={16} />
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Gaveta
        aberto={!!escolhido}
        aoFechar={() => setAberto('')}
        titulo={escolhido?.nome ?? ''}
        pe={
          escolhido && podeEditar ? (
            <>
              <Botao onClick={() => setFormulario({ id: escolhido.id, meio: escolhido.meio })}>Editar</Botao>
              <Botao
                tom="primario"
                onClick={() => {
                  setAberto('')
                  aoLancar(escolhido)
                }}
              >
                Lançar transporte
              </Botao>
            </>
          ) : undefined
        }
      >
        {escolhido ? (
          <div className="tp-na-folha">
            <div className="tp-ficha-corpo">
              <div className="tp-ficha-estado">
                <span className="tp-quem">
                  <IconeDoMeio meio={escolhido.meio} />
                  <b>{NOME_DO_MEIO[escolhido.meio]}</b>
                </span>
                <span className="tp-apoio">
                  {doEscolhido.length
                    ? `${plural(doEscolhido.length, 'corrida', 'corridas')} em ${nomeDoMes}, ${dinheiro(somaDe(doEscolhido))}`
                    : `nenhuma corrida em ${nomeDoMes}`}
                </span>
              </div>

              <div className="tp-dados">
                {escolhido.meio === 'transportadora' ? (
                  <div className="tp-dado">
                    <span>CNPJ</span>
                    {escolhido.cnpj ? <b>{cnpjNaTela(escolhido.cnpj)}</b> : <b className="tp-falta">falta o CNPJ</b>}
                  </div>
                ) : null}
                <div className="tp-dado">
                  <span>Contato</span>
                  {escolhido.contato ? <b>{escolhido.contato}</b> : <b className="tp-falta">não foi escrito</b>}
                </div>
                <div className="tp-dado">
                  <span>Onde atende</span>
                  {escolhido.ondeAtende ? <b>{escolhido.ondeAtende}</b> : <b className="tp-falta">não foi escrito</b>}
                </div>
                {escolhido.prazo ? (
                  <div className="tp-dado">
                    <span>Prazo</span>
                    <b>{escolhido.prazo}</b>
                  </div>
                ) : null}
              </div>

              {escolhido.meio === 'transportadora' ? (
                <p className="tp-ajuda">
                  {escolhido.cnpj
                    ? 'O Verificador de Boleto reconhece este CNPJ quando o boleto da transportadora chegar.'
                    : 'Sem o CNPJ, o boleto desta transportadora cai em Precisa de aprovação no Verificador de Boleto.'}
                </p>
              ) : null}

              {abertosDoEscolhido.length ? (
                <div className="tp-acerto">
                  <span className="tp-nome">
                    <b>{dinheiro(somaDe(abertosDoEscolhido))} a pagar</b>
                    <small>{plural(abertosDoEscolhido.length, 'corrida em aberto', 'corridas em aberto')}</small>
                  </span>
                  {podeEditar ? (
                    <Botao
                      onClick={() =>
                        void aoAcertar(
                          abertosDoEscolhido.map((l) => l.id),
                          escolhido.nome,
                        )
                      }
                    >
                      Acertar tudo
                    </Botao>
                  ) : null}
                </div>
              ) : null}

              <div className="tp-secao">
                <div className="tp-secao-topo">
                  <span className="tp-secao-nome">
                    <IconeDoTitulo icone={Path} miudo />
                    Últimas corridas
                  </span>
                  <small>de {nomeDoMes}</small>
                </div>
                <div className="tp-lista">
                  {doEscolhido.length ? (
                    doEscolhido.slice(0, 6).map((l) => (
                      <div key={l.id} className="tp-lista-linha">
                        <span className="tp-nome">
                          <b>{paraQue(l)}</b>
                          <small>{quandoFoi(l.quando, hoje)}</small>
                        </span>
                        <Situacao pago={l.pago} />
                        <span className="tp-valor">{dinheiro(l.valor)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="tp-vazio-dentro">Nenhuma corrida neste mês.</p>
                  )}
                </div>
              </div>

              {escolhido.observacao ? (
                <div className="tp-secao">
                  <div className="tp-secao-topo">
                    <span className="tp-secao-nome">
                      <IconeDoTitulo icone={NotePencil} miudo />
                      Observação
                    </span>
                  </div>
                  <p className="tp-obs">{escolhido.observacao}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Gaveta>

      <FormularioDeTransportador
        inicio={formulario}
        atual={formulario?.id ? (transportadores.find((t) => t.id === formulario.id) ?? null) : null}
        aoFechar={() => setFormulario(null)}
        aoSalvo={async () => {
          setFormulario(null)
          await aoMudar()
        }}
      />
    </>
  )
}

function FormularioDeTransportador({
  inicio,
  atual,
  aoFechar,
  aoSalvo,
}: {
  inicio: Formulario
  atual: Transportador | null
  aoFechar: () => void
  aoSalvo: () => Promise<void>
}) {
  const [meio, setMeio] = useState<Meio>('motoboy')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contato, setContato] = useState('')
  const [ondeAtende, setOndeAtende] = useState('')
  const [prazo, setPrazo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    if (!inicio) return
    setMeio(atual?.meio ?? inicio.meio)
    setNome(atual?.nome ?? '')
    setCnpj(atual?.cnpj ? cnpjNaTela(atual.cnpj) : '')
    setContato(atual?.contato ?? '')
    setOndeAtende(atual?.ondeAtende ?? '')
    setPrazo(atual?.prazo ?? '')
    setObservacao(atual?.observacao ?? '')
  }, [inicio, atual])

  const cnpjRuim = meio === 'transportadora' && cnpj.trim() !== '' && !cnpjValido(cnpj)
  const valido = nome.trim() !== '' && !cnpjRuim

  async function gravar() {
    if (!valido) return
    setGravando(true)
    try {
      await salvarTransportador({
        id: inicio?.id,
        nome,
        meio,
        cnpj: meio === 'transportadora' ? cnpj : '',
        contato,
        ondeAtende,
        prazo,
        observacao,
      })
      avisar(`${nome.trim()} ${inicio?.id ? 'foi atualizado' : 'entrou em Quem transporta'}.`, 'ok')
      await aoSalvo()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar.', 'brand')
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal
      aberto={!!inicio}
      aoFechar={aoFechar}
      titulo={inicio?.id ? 'Editar cadastro' : 'Novo em Quem transporta'}
      pe={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao tom="primario" onClick={gravar} disabled={!valido || gravando} carregando={gravando}>
            {gravando ? 'Salvando' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <div className="pilha solta">
        <Campo rotulo="O que é">
          <Segmentado
            className="tp-seg-cheio"
            valor={meio}
            aoMudar={setMeio}
            opcoes={MEIOS.map((m) => ({ valor: m, rotulo: NOME_DO_MEIO[m] }))}
          />
        </Campo>
        <Campo rotulo={meio === 'motoboy' ? 'Nome do motoboy' : 'Nome'}>
          <Entrada
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            placeholder={meio === 'transportadora' ? 'Jadlog' : meio === 'motoboy' ? 'Como a fábrica o chama' : 'Uber'}
          />
        </Campo>
        {meio === 'transportadora' ? (
          <Campo
            rotulo="CNPJ"
            erro={cnpjRuim}
            dica={
              cnpjRuim
                ? 'Este CNPJ não fecha a conta dos dígitos.'
                : 'É por ele que o Verificador de Boleto reconhece a transportadora. Marcar como confiável continua sendo do administrador.'
            }
          >
            <Entrada
              value={cnpj}
              onChange={(e) => setCnpj(mascaraDoCnpj(e.currentTarget.value))}
              placeholder="00.000.000/0000-00"
              aria-label="CNPJ"
            />
          </Campo>
        ) : null}
        <div className="tp-dois-iguais">
          <Campo rotulo="Contato">
            <Entrada
              value={contato}
              onChange={(e) => setContato(e.currentTarget.value)}
              placeholder="Telefone ou nome de quem atende"
            />
          </Campo>
          <Campo rotulo="Onde atende">
            <Entrada
              value={ondeAtende}
              onChange={(e) => setOndeAtende(e.currentTarget.value)}
              placeholder="Goiânia e Aparecida"
            />
          </Campo>
        </div>
        {meio === 'transportadora' || meio === 'motoboy' ? (
          <Campo rotulo="Prazo de costume">
            <Entrada
              value={prazo}
              onChange={(e) => setPrazo(e.currentTarget.value)}
              placeholder={meio === 'motoboy' ? 'mesmo dia' : '1 a 3 dias úteis'}
            />
          </Campo>
        ) : null}
        <Campo rotulo="Observação">
          <AreaTexto rows={2} value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} />
        </Campo>
      </div>
    </Modal>
  )
}
