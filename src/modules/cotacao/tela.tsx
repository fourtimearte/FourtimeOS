import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChartBar, Funnel, MapPin, SealCheck, TShirt } from '@phosphor-icons/react'
import {
  Botao,
  Busca,
  Esqueleto,
  Kpi,
  LINHA_ESCOLHIDA,
  Pagina,
  Segmentado,
  Seletor,
  TituloCartao,
  Vazio,
  avisar,
} from '@ds'
import {
  ArquivoRecusado,
  ONDE_ESTA_O_PEDIDO,
  abrirCft,
  carregarCotacoes,
  carregarPedidosDasCotacoes,
  cotacaoEmBranco,
  diaDe,
  diasEntre,
  estatisticasDoComercial,
  naAba,
  nomeDoMes,
  nomeDoMesComAno,
  proximoNumero,
  quandoDaCotacao,
  salvarCotacao,
  ultimosMeses,
  type AbaDoComercial,
  type CotacaoNaLista,
  type EstadoDaCotacao,
  type EstatisticasDoComercial,
  type PedidoDaCotacao,
} from '@dominio/cotacao'
import { souAdmin, useSessao } from '@dominio/sessao'
import { CotacaoEscolhida } from './cotacao-escolhida'
import './cotacao.css'

/* ==========================================================================
   A PÁGINA DO ORÇAMENTO (pranchas 72, 72b e 73, revisão de 06 e 08/10/2026).

   À esquerda, a lista: as abas (Em aberto, Aprovadas, Perdidas, Todas) são o
   cabeçalho da coluna, a busca vem logo abaixo, e as cotações em grupos.
   À direita, com nada escolhido, as estatísticas de quem olha: o vendedor vê
   só as dele (a RLS já entrega só as dele), o administrador vê as de todos e
   escolhe o vendedor no topo, ao lado do mês. Com uma escolhida, a cotação
   abre ao lado da lista (73), e o endereço guarda qual é (?c=).
   ========================================================================== */

const limpar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const cotacoes = (n: number) => n + (n === 1 ? ' cotação' : ' cotações')

const GRUPOS: Record<AbaDoComercial, [string, string, EstadoDaCotacao][]> = {
  aberto: [
    ['Enviadas', 'esperando o cliente', 'enviada'],
    ['Rascunhos', 'ainda não saiu', 'rascunho'],
  ],
  aprovadas: [['Aprovadas', 'viraram pedido', 'aprovada']],
  perdidas: [
    ['Recusadas', 'o cliente disse não', 'recusada'],
    ['Vencidas', 'passaram da validade', 'vencida'],
  ],
  todas: [
    ['Enviadas', 'esperando o cliente', 'enviada'],
    ['Rascunhos', 'ainda não saiu', 'rascunho'],
    ['Aprovadas', 'viraram pedido', 'aprovada'],
    ['Recusadas', 'o cliente disse não', 'recusada'],
    ['Vencidas', 'passaram da validade', 'vencida'],
  ],
}

export function TelaCotacao() {
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const escolhida = params.get('c') ?? ''
  const { estado: sessao } = useSessao()
  const admin = souAdmin(sessao.fase === 'dentro' ? sessao.pessoa : null)

  /* A LISTA VEM DA VIEW, SEM O CORPO DO DOCUMENTO. Dentro do corpo vão as
     imagens dos layouts; pedir a cotação inteira para desenhar uma lista de
     texto seria baixar dezenas de megabytes. Os pedidos vêm à parte, sem
     corpo também, e se eles falharem a lista continua: só as estatísticas de
     aprovação ficam vazias. */
  const [todas, setTodas] = useState<CotacaoNaLista[]>([])
  const [pedidos, setPedidos] = useState<PedidoDaCotacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')

  const recarregar = useCallback(async () => {
    try {
      setTodas(await carregarCotacoes())
      setFalha('')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui carregar as cotações.')
    } finally {
      setCarregando(false)
    }
    carregarPedidosDasCotacoes()
      .then(setPedidos)
      .catch(() => setPedidos([]))
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const [aba, setAba] = useState<AbaDoComercial>('aberto')
  const [busca, setBusca] = useState('')
  const [vendedor, setVendedor] = useState('')
  const hoje = new Date().toISOString()
  const meses = ultimosMeses(hoje)
  const [mesEscolhido, setMes] = useState('')
  const mes = mesEscolhido || meses[0]

  const vendedores = useMemo(
    () => [...new Set(todas.map(c => c.vendedor).filter(Boolean))].sort(),
    [todas],
  )
  const vistas = useMemo(
    () => (vendedor ? todas.filter(c => c.vendedor === vendedor) : todas),
    [todas, vendedor],
  )
  const pedidosVistos = useMemo(
    () => (vendedor ? pedidos.filter(p => p.vendedor === vendedor) : pedidos),
    [pedidos, vendedor],
  )
  const conta = (a: AbaDoComercial) => vistas.filter(c => naAba(c, a)).length

  const filtradas = useMemo(() => {
    const b = limpar(busca.trim())
    return vistas.filter(c => {
      if (!naAba(c, aba)) return false
      if (!b) return true
      return limpar(
        [c.numero, c.clienteNome, c.clienteCidade, admin ? c.vendedor : ''].join(' '),
      ).includes(b)
    })
  }, [vistas, aba, busca, admin])

  const est = useMemo(
    () => estatisticasDoComercial(vistas, pedidosVistos, mes, hoje),
    [vistas, pedidosVistos, mes, hoje],
  )

  const escolher = (id: string) => {
    const p = new URLSearchParams(params)
    if (id) p.set('c', id)
    else p.delete('c')
    setParams(p)
  }

  /* O NUMERO SAI DO BANCO, e nao de uma conta sobre a lista. Duas pessoas
     criando cotacao no mesmo minuto leriam a mesma lista e tirariam o mesmo
     proximo numero; o contador la dentro e uma linha so, e o update dele e
     atomico. */
  async function nova() {
    try {
      const c = cotacaoEmBranco(await proximoNumero())
      const salva = await salvarCotacao(c)
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui criar a cotação', 'warn')
    }
  }

  async function abrirArquivo() {
    try {
      const c = await abrirCft()
      if (!c) return
      /* Arquivo aberto vira cotacao NOVA no banco, com numero novo. Ele pode
         ter vindo de outro computador, de um backup ou de uma versao antiga, e
         gravar por cima do id que estava escrito dentro dele sobrescreveria
         silenciosamente uma cotacao que alguem esta editando. */
      const salva = await salvarCotacao({
        ...c,
        id: '',
        numero: c.numero || (await proximoNumero()),
      })
      avisar('Cotação ' + salva.numero + ' aberta do arquivo', 'ok')
      navegar('/cotacao/' + salva.id)
    } catch (e) {
      avisar(e instanceof ArquivoRecusado ? e.message : 'Não deu para abrir o arquivo', 'warn')
    }
  }

  const sub = (
    <>
      {cotacoes(vistas.length)}
      {admin ? '' : ' suas'} · {est.esperando.n} esperando o cliente ·{' '}
      <b>{reais(est.esperando.valor)}</b> em aberto
    </>
  )

  return (
    <Pagina
      acima="Comercial"
      titulo="Cotação de venda"
      sub={sub}
      acoes={
        <>
          {/* o filtro de vendedor é só do administrador: o vendedor só vê as dele */}
          {admin ? (
            <Seletor
              rotulo="VENDEDOR"
              valor={vendedor}
              opcoes={vendedores.map(v => ({ valor: v, rotulo: v }))}
              vazio="Todos"
              aoEscolher={setVendedor}
            />
          ) : null}
          {/* o MÊS das estatísticas mora no topo, ao lado do vendedor (comentário
              dele na prancha 72, 08/10/2026), e só quando elas aparecem */}
          {!escolhida ? (
            <Seletor
              rotulo="MÊS"
              valor={mesEscolhido}
              opcoes={meses.slice(1).map(m => ({ valor: m, rotulo: nomeDoMesComAno(m) }))}
              vazio={nomeDoMesComAno(meses[0])}
              aoEscolher={setMes}
            />
          ) : null}
          <Botao tom="contorno" onClick={() => void abrirArquivo()}>
            Abrir .cft
          </Botao>
          <Botao tom="primario" onClick={() => void nova()}>
            Nova cotação
          </Botao>
        </>
      }
    >
      {/* a caixa de fora é quem mede a largura: um container não consegue
          mudar as próprias colunas pela própria largura */}
      <div className="ct-lt-caixa">
        <div className={escolhida ? 'ct-lt ct-lt-com' : 'ct-lt'}>
          <section className="cartao ct-lt-lista" aria-label="Cotações">
            <div className="ct-lt-abas">
              <Segmentado
                className="ct-lt-seg"
                valor={aba}
                aoMudar={v => setAba(v as AbaDoComercial)}
                opcoes={(
                  [
                    ['aberto', 'Em aberto'],
                    ['aprovadas', 'Aprovadas'],
                    ['perdidas', 'Perdidas'],
                    ['todas', 'Todas'],
                  ] as [AbaDoComercial, string][]
                ).map(([valor, nome]) => ({
                  valor,
                  rotulo: (
                    <>
                      {nome} <small>{conta(valor)}</small>
                    </>
                  ),
                }))}
              />
            </div>
            <div className="ct-lt-busca">
              <Busca
                placeholder={
                  admin
                    ? 'Buscar cliente, número ou vendedor'
                    : 'Buscar cliente ou número da cotação'
                }
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            {carregando ? (
              <div className="ct-lt-espera">
                <Esqueleto altura={200} />
              </div>
            ) : falha ? (
              <Vazio
                titulo="Não consegui carregar as cotações"
                texto={falha}
                acao={
                  <Botao
                    tom="forte"
                    onClick={() => {
                      setCarregando(true)
                      void recarregar()
                    }}
                  >
                    Tentar de novo
                  </Botao>
                }
              />
            ) : !filtradas.length ? (
              <Vazio
                titulo="Nenhuma cotação por aqui"
                texto={
                  busca.trim()
                    ? 'Nada com esse nome ou número nesta aba.'
                    : todas.length
                      ? 'Troque de aba para ver as outras.'
                      : 'Abra um arquivo .cft ou comece uma cotação nova.'
                }
              />
            ) : (
              GRUPOS[aba].map(([nome, apoio, e]) => {
                const itens = filtradas.filter(c => c.estado === e)
                if (!itens.length) return null
                return (
                  <div key={e} className="ct-lt-grupo">
                    <div className="ct-lt-g">
                      {nome}
                      <small>
                        {itens.length} · {apoio}
                      </small>
                    </div>
                    {itens.map(c => (
                      <LinhaDaCotacao
                        key={c.id}
                        c={c}
                        hoje={hoje}
                        comVendedor={admin}
                        escolhida={c.id === escolhida}
                        aoEscolher={() => escolher(c.id === escolhida ? '' : c.id)}
                      />
                    ))}
                  </div>
                )
              })
            )}
          </section>

          {escolhida ? (
            <CotacaoEscolhida key={escolhida} id={escolhida} aoFechar={() => escolher('')} />
          ) : (
            <Estatisticas
              est={est}
              mes={mes}
              hoje={hoje}
              admin={admin && !vendedor}
              comVendedor={admin}
            />
          )}
        </div>
      </div>
    </Pagina>
  )
}

function LinhaDaCotacao({
  c,
  hoje,
  comVendedor,
  escolhida,
  aoEscolher,
}: {
  c: CotacaoNaLista
  hoje: string
  comVendedor: boolean
  escolhida: boolean
  aoEscolher: () => void
}) {
  const q = quandoDaCotacao(c, hoje)
  return (
    <div className={escolhida ? 'ct-lt-t ct-lt-sel ' + LINHA_ESCOLHIDA : 'ct-lt-t'}>
      <button type="button" className="ct-lt-nome" aria-pressed={escolhida} onClick={aoEscolher}>
        <span className="ct-lt-ic" aria-hidden="true">
          <TShirt size={18} />
        </span>
        <span className="ct-lt-nomes">
          <b>{c.clienteNome || 'sem cliente'}</b>
          <small>
            {c.numero}
            {comVendedor && c.vendedor ? ' · ' + c.vendedor : ''} · {c.pecas} pçs
          </small>
        </span>
        <span className="ct-lt-fim">
          <b>{reais(c.total)}</b>
          <small className={q.perto ? 'ct-lt-perto' : undefined}>{q.texto}</small>
        </span>
      </button>
    </div>
  )
}

/* ==========================================================================
   72. NADA ESCOLHIDO: as estatísticas de quem olha.
   ========================================================================== */
function Estatisticas({
  est,
  mes,
  hoje,
  admin,
  comVendedor,
}: {
  est: EstatisticasDoComercial<CotacaoNaLista, PedidoDaCotacao>
  mes: string
  hoje: string
  /** o administrador olhando para todos: só aí entra "Aprovado por vendedor" */
  admin: boolean
  comVendedor: boolean
}) {
  const nomeMes = nomeDoMes(mes)
  const quando = (iso: string) => {
    const d = diasEntre(diaDe(iso), diaDe(hoje))
    return d === 0
      ? 'aprovada hoje'
      : d === 1
        ? 'aprovada ontem'
        : 'aprovada em ' + diaDe(iso).slice(8, 10) + '/' + diaDe(iso).slice(5, 7)
  }
  const partes = [
    { cls: 'ct-cv-ap', nome: 'Aprovadas', n: est.aprovadas.n, valor: est.aprovadas.valor },
    {
      cls: 'ct-cv-es',
      nome: 'Esperando o cliente',
      n: est.esperando.n,
      valor: est.esperando.valor,
    },
    { cls: 'ct-cv-pe', nome: 'Perdidas', n: est.perdidas.n, valor: est.perdidas.valor },
  ]
  const maior = Math.max(1, ...est.porVendedor.map(v => v.valor))

  const conversao = (
    <section className="cartao ct-lt-cartao">
      <header className="ct-lt-cab">
        <TituloCartao icone={Funnel}>Conversão das cotações</TituloCartao>
        <span className="ct-lt-nota">o tamanho de cada parte é o valor em reais · {nomeMes}</span>
      </header>
      {est.saidas ? (
        <div className="ct-cv">
          <div className="ct-cv-topo">
            <div className="ct-cv-taxa">
              <b>{est.taxa}%</b>
              <span>viraram pedido</span>
              <small>
                {est.aprovadas.n} de {cotacoes(est.saidas)}
              </small>
            </div>
            <dl className="ct-cv-lado">
              <div>
                <dt>Tempo médio até aprovar</dt>
                <dd>
                  {est.diasAteAprovar === null
                    ? '-'
                    : est.diasAteAprovar + (est.diasAteAprovar === 1 ? ' dia' : ' dias')}
                </dd>
              </div>
              <div>
                <dt>Valor médio da aprovada</dt>
                <dd>{est.valorMedio === null ? '-' : reais(est.valorMedio)}</dd>
              </div>
              <div>
                <dt>Maior cotação em aberto</dt>
                <dd>{est.maiorEmAberto === null ? '-' : reais(est.maiorEmAberto)}</dd>
              </div>
            </dl>
          </div>
          <div
            className="ct-cv-barra"
            role="img"
            aria-label={
              'Das ' +
              est.saidas +
              ' cotações de ' +
              nomeMes +
              ': ' +
              partes.map(p => p.n + ' ' + p.nome.toLowerCase()).join(', ')
            }
          >
            {partes
              .filter(p => p.valor > 0)
              .map(p => (
                <i
                  key={p.cls}
                  className={p.cls}
                  style={{ '--ct-peso': Math.round(p.valor) } as CSSProperties}
                />
              ))}
          </div>
          <div className="ct-cv-leg">
            {partes.map(p => (
              <div key={p.cls} className={'ct-cv-item ' + p.cls}>
                <i />
                <b>{p.nome}</b>
                <span>
                  {p.n ? cotacoes(p.n) + ' · ' + reais(p.valor) : 'nenhuma em ' + nomeMes}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="ct-lt-vazio">Nenhuma cotação saiu em {nomeMes}.</p>
      )}
    </section>
  )

  return (
    <div className="ct-lt-direita">
      <div className="fila-kpi ct-lt-kpis">
        <Kpi
          rotulo="Esperando o cliente"
          valor={reais(est.esperando.valor)}
          sub={cotacoes(est.esperando.n) + (est.esperando.n === 1 ? ' enviada' : ' enviadas')}
        />
        <Kpi
          rotulo="Vencem esta semana"
          valor={est.vencemNaSemana}
          aviso={est.vencemNaSemana > 0}
          sub={
            est.vencemNaSemana ? 'acabam nos próximos 7 dias' : 'nenhuma acaba nos próximos 7 dias'
          }
        />
        <Kpi
          rotulo={'Aprovadas em ' + nomeMes}
          valor={reais(est.aprovadas.valor)}
          sub={
            cotacoes(est.aprovadas.n) +
            (est.aprovadas.n === 1 ? ' virou pedido' : ' viraram pedido')
          }
        />
        <Kpi
          rotulo="Rascunhos"
          valor={est.rascunhos}
          sub={est.rascunhos ? 'ainda não saiu' : 'nenhum parado'}
        />
      </div>

      <section className="cartao ct-lt-cartao">
        <header className="ct-lt-cab">
          <TituloCartao icone={SealCheck}>Últimas aprovadas</TituloCartao>
          <span className="ct-lt-nota">onde cada pedido está agora</span>
        </header>
        {est.ultimas.length ? (
          <div className="ct-ap">
            {est.ultimas.map(({ pedido: p, cotacao: c }) => (
              <div key={p.numero} className="ct-ap-item">
                <span className="ct-lt-ic ct-ap-ic" aria-hidden="true">
                  <TShirt size={22} />
                </span>
                <div className="ct-ap-txt">
                  <b>{c?.clienteNome || 'Pedido ' + p.numero}</b>
                  <small>
                    {[c?.numero, comVendedor ? p.vendedor : '', p.pecas + ' pçs'].filter(Boolean).join(' · ')}
                  </small>
                  <small>{quando(p.aprovadoEm)}</small>
                  <span className="ct-ap-valor">{reais(p.total)}</span>
                  <span className="ct-ap-onde">
                    <MapPin size={14} />
                    {ONDE_ESTA_O_PEDIDO[p.estado]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ct-lt-vazio">Nenhuma cotação virou pedido ainda.</p>
        )}
      </section>

      {admin ? (
        <div className="ct-lt-dois">
          {conversao}
          <section className="cartao ct-lt-cartao">
            <header className="ct-lt-cab">
              <TituloCartao icone={ChartBar}>Aprovado por vendedor</TituloCartao>
              <span className="ct-lt-nota">só o administrador vê</span>
            </header>
            <div
              className="ct-gv"
              role="img"
              aria-label={'O valor aprovado em ' + nomeMes + ', por vendedor'}
            >
              {est.porVendedor.length ? (
                est.porVendedor.map(v => (
                  <div key={v.nome} className="ct-gv-lin">
                    <span className="ct-gv-nome">
                      <b>{v.nome}</b>
                      <small>
                        aprovou {v.aprovou} de {v.de}
                      </small>
                    </span>
                    <span className="ct-gv-trilho">
                      <i
                        style={
                          {
                            '--ct-parte': ((v.valor / maior) * 100).toFixed(1) + '%',
                          } as CSSProperties
                        }
                      />
                    </span>
                    <b className="ct-gv-valor">{reais(v.valor)}</b>
                  </div>
                ))
              ) : (
                <p className="ct-lt-vazio">Nenhum vendedor com cotação.</p>
              )}
            </div>
          </section>
        </div>
      ) : (
        conversao
      )}
    </div>
  )
}
