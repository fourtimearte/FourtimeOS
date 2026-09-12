import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as PointerEventoReact } from 'react'
import { DotsSixVertical, Printer } from '@phosphor-icons/react'
import { Botao, DataEmPilula, Pagina, Seletor, avisar } from '@ds'
import {
  AVISO,
  AVISOS,
  CAPACIDADE_DA_SEMANA,
  CAPACIDADE_DO_DIA,
  DIAS_DA_SEMANA,
  DIAS_UTEIS,
  ETAPAS,
  POSTO,
  atrasado,
  diaDaSemanaDe,
  diaEMes,
  ehHoje,
  etapaVelha,
  iso,
  listarPedidos,
  moverEtapa,
  mudarAviso,
  mudarEntrega,
  planejarPara,
  semanaDeslocada,
  semanaDoAno,
  tituloDaSemana,
  type Aviso,
  type Etapa,
  type Pedido,
} from '@dominio/producao'
import './atividades.css'

/* ==========================================================================
   Painel de atividades.

   A pergunta da tela esta escrita no proprio cabecalho: o que a fabrica
   produz nesta semana, e cabe? Por isso cada dia carrega a sua caixa de
   saturacao, que fica verde enquanto sobra espaco, laranja quando esta quase
   cheia e vermelha quando passou.

   As colunas sao as do Relatorio de Atividade do editor v3.375. Segunda a
   sabado, seis dias: domingo nao vira linha, porque dia que nao produz nao
   ocupa espaco.
   ========================================================================== */

/* Quase cheio a partir de 85 por cento. O numero nao e redondo por acaso: com
   325 pecas por dia, 85 por cento sao 276, e o que sobra dali nao da mais para
   um pedido medio da casa. Dia que nao cabe mais um pedido ja nao e dia com
   espaco, e a cor tem que dizer isso antes de estourar. */
const QUASE_CHEIO = 85

type Arrasto = {
  id: string
  x: number
  y: number
  x0: number
  y0: number
  dx: number
  dy: number
  largura: number
  valendo: boolean
}

export function TelaAtividades() {
  /* muda quando alguem mexe num pedido: e o sinal para reler a lista */
  const [versao, setVersao] = useState(0)
  /* 0 e esta semana, -1 a passada, +1 a que vem */
  const [semana, setSemana] = useState(0)
  const [etapa, setEtapa] = useState('')

  const inicio = useMemo(() => semanaDeslocada(semana), [semana])
  const diasDaSemana = useMemo(
    () => DIAS_DA_SEMANA.map((nome, i) => ({ nome, data: diaDaSemanaDe(inicio, i) })),
    [inicio],
  )

  /* So os que estao planejados nesta semana. O painel mostra tambem o que ja
     finalizou: esconder os prontos faria a saturacao do dia mentir, que e
     justamente a conta que esta tela existe para responder. */
  const pedidos = useMemo(() => {
    const dias = new Set(diasDaSemana.map((d) => iso(d.data)))
    return listarPedidos().filter((p) => dias.has(p.planejadoEm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, diasDaSemana])

  const filtrados = useMemo(
    () => (etapa ? pedidos.filter((p) => p.etapa === etapa) : pedidos),
    [pedidos, etapa],
  )

  const pecas = filtrados.reduce((s, p) => s + p.pecas, 0)
  const pecasSubli = filtrados.reduce((s, p) => s + p.pecasSubli, 0)
  const pecasPersonalizadas = filtrados.reduce((s, p) => s + p.pecasPersonalizadas, 0)
  const atrasados = filtrados.filter(atrasado).length
  const saturacao = Math.round((pecas / CAPACIDADE_DA_SEMANA) * 100)
  const sobra = CAPACIDADE_DA_SEMANA - pecas
  const prontosNaSemana = filtrados.filter((p) => p.etapa === 'finalizado')
  const prontos = prontosNaSemana.length
  const pecasProntas = prontosNaSemana.reduce((s, p) => s + p.pecas, 0)

  const mexeu = () => setVersao((v) => v + 1)

  /* --- arrastar o pedido para outro dia ---------------------------------
     Por evento de ponteiro, e nao pelo arrastar do HTML: o painel roda em
     tablet no chao de fabrica, e o arrastar do HTML nao existe no toque. */
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [alvo, setAlvo] = useState('')
  const agora = useRef<{ arrasto: Arrasto | null; alvo: string }>({ arrasto: null, alvo: '' })
  agora.current = { arrasto, alvo }
  const carregado = arrasto ? filtrados.find((p) => p.id === arrasto.id) : null

  useEffect(() => {
    if (!arrasto) return
    const mover = (e: PointerEvent) => {
      setArrasto((a) =>
        a
          ? {
              ...a,
              x: e.clientX,
              y: e.clientY,
              valendo: a.valendo || Math.hypot(e.clientX - a.x0, e.clientY - a.y0) > 6,
            }
          : a,
      )
      const sob = document.elementFromPoint(e.clientX, e.clientY)
      const dia = sob?.closest('[data-dia]') as HTMLElement | null
      setAlvo(dia?.dataset.dia ?? '')
    }
    const soltar = () => {
      const { arrasto: a, alvo: onde } = agora.current
      if (a?.valendo && onde) {
        const antes = listarPedidos().find((p) => p.id === a.id)
        if (antes && antes.planejadoEm !== onde) {
          planejarPara(a.id, onde)
          setVersao((v) => v + 1)
          avisar(a.id + ' passou para ' + diaEMes(new Date(onde + 'T00:00:00')), 'ok')
        }
      }
      setArrasto(null)
      setAlvo('')
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [arrasto])

  function pegar(e: PointerEventoReact<HTMLElement>, p: Pedido) {
    if (e.button !== 0) return
    const linha = e.currentTarget.closest('.at-linha') as HTMLElement | null
    const caixa = (linha ?? e.currentTarget).getBoundingClientRect()
    setArrasto({
      id: p.id,
      x: e.clientX,
      y: e.clientY,
      x0: e.clientX,
      y0: e.clientY,
      dx: e.clientX - caixa.left,
      dy: e.clientY - caixa.top,
      largura: caixa.width,
      valendo: false,
    })
  }

  return (
    <Pagina
      acima="Gestão · o que a fábrica produz nesta semana, e cabe?"
      titulo="Painel de atividades"
      sub={
        'Semana ' +
        semanaDoAno(inicio) +
        ' · ' +
        tituloDaSemana(inicio) +
        ' · o planejamento é por dia, e o atraso é calculado pela entrega'
      }
      acoes={
        <>
          <span className="at-semana">
            <button
              type="button"
              onClick={() => setSemana((n) => n - 1)}
              aria-label="Semana anterior"
              title="Semana anterior"
            >
              ‹
            </button>
            <span className="at-semana-txt">
              <b>{tituloDaSemana(inicio)}</b>
              <small>{comoChamarASemana(semana)}</small>
            </span>
            <button
              type="button"
              onClick={() => setSemana((n) => n + 1)}
              aria-label="Próxima semana"
              title="Próxima semana"
            >
              ›
            </button>
          </span>
          {semana !== 0 ? (
            <Botao tom="limpo" onClick={() => setSemana(0)}>
              Semana de hoje
            </Botao>
          ) : null}

          <Seletor
            rotulo="ETAPA"
            valor={etapa}
            opcoes={ETAPAS.map((e) => ({
              valor: e,
              rotulo: POSTO[e].nome,
              contagem: pedidos.filter((p) => p.etapa === e).length,
            }))}
            vazio="Todas as etapas"
            aoEscolher={setEtapa}
          />
          <Botao
            tom="forte"
            onClick={() => avisar('A varredura do Drive entra junto com o kanban', 'info')}
          >
            Conferir agora
          </Botao>
          <Botao
            tom="contorno"
            onClick={() => avisar('A folha A4 do painel entra junto com o kanban', 'info')}
          >
            <Printer size={17} />
            Impressão
          </Botao>
        </>
      }
    >
      <div className="at-topo">
        {/* Os quatro numeros do Relatorio de Atividade do editor. A segunda
            linha de cada um e o que faz o numero valer: "1.173" sozinho nao
            diz nada, "730 sublimacao e 443 personalizado" diz onde a semana
            esta carregada. */}
        <div className="at-numeros">
          <div style={{ '--barra': 'var(--posto-subli)' } as CSSProperties}>
            <span className="l">Peças na semana</span>
            <b>{pecas.toLocaleString('pt-BR')}</b>
            <small>
              <i className="at-ponto subli" />
              {pecasSubli.toLocaleString('pt-BR')} sublimação ·{' '}
              <i className="at-ponto pers" />
              {pecasPersonalizadas.toLocaleString('pt-BR')} personalizado
            </small>
          </div>
          <div style={{ '--barra': 'var(--text-3)' } as CSSProperties}>
            <span className="l">Capacidade</span>
            <b>{CAPACIDADE_DA_SEMANA.toLocaleString('pt-BR')}</b>
            <small>
              {CAPACIDADE_DO_DIA} peças por dia · {DIAS_UTEIS} dias
            </small>
          </div>
          <div style={{ '--barra': corDaCarga(saturacao) } as CSSProperties}>
            <span className="l">Saturação</span>
            <b style={{ color: corDaCarga(saturacao) }}>{saturacao}%</b>
            <small>
              {sobra >= 0
                ? 'cabem +' + sobra.toLocaleString('pt-BR') + ' peças'
                : 'passou ' + Math.abs(sobra).toLocaleString('pt-BR') + ' peças do limite'}
            </small>
            <span className="at-regua">
              <i
                style={
                  {
                    width: Math.min(100, saturacao) + '%',
                    background: corDaCarga(saturacao),
                  } as CSSProperties
                }
              />
            </span>
          </div>
          <div style={{ '--barra': 'var(--brand)' } as CSSProperties}>
            <span className="l">Pedidos</span>
            <b>{filtrados.length}</b>
            <small>
              {prontos} finalizados · {pecasProntas.toLocaleString('pt-BR')} peças prontas
              {atrasados ? (
                <span className="at-atrasados">
                  {atrasados} atrasado{atrasados > 1 ? 's' : ''}
                </span>
              ) : null}
            </small>
          </div>
        </div>
      </div>

      {/* O cabecalho gruda no topo sozinho, e a linha de dia nao: rolando uma
          semana cheia, o que se perde de vista e o nome das colunas. Ele tem
          contraste proprio, mais escuro que a linha de dia, para os dois nao
          virarem a mesma faixa cinza quando encostam. */}
      <div className="at-colunas">
        <span />
        <span>Pedido</span>
        <span>Nome</span>
        <span className="esconde">Aviso</span>
        <span className="some-antes">Departamento</span>
        <span className="esconde">Entrega</span>
        <span className="esconde">Planejamento</span>
        <span className="num">Total</span>
        <span>Atualização</span>
      </div>

      {diasDaSemana.map(({ nome, data }) => {
        const chave = iso(data)
        const doDia = filtrados.filter((p) => p.planejadoEm === chave)
        const pecasDoDia = doDia.reduce((s, p) => s + p.pecas, 0)
        const pct = Math.round((pecasDoDia / CAPACIDADE_DO_DIA) * 100)
        const folga = CAPACIDADE_DO_DIA - pecasDoDia
        return (
          <section
            key={nome}
            className={alvo === chave && arrasto?.valendo ? 'at-dia alvo' : 'at-dia'}
            data-dia={chave}
          >
            <header className={ehHoje(data) ? 'at-dia-topo hoje' : 'at-dia-topo'}>
              <span className="at-dia-nome">
                {nome} <span className="at-data">{diaEMes(data)}</span>
                {ehHoje(data) ? <span className="at-hoje">hoje</span> : null}
              </span>

              {/* A carga do dia numa caixa só: quantas peças, a régua e quanto
                  ainda cabe. Verde enquanto sobra espaço, laranja quando está
                  quase cheio, vermelho quando passou. */}
              <span className={'at-carga ' + faixaDaCarga(pct)}>
                <b>{pecasDoDia.toLocaleString('pt-BR')}</b>
                <span className="at-de">/ {CAPACIDADE_DO_DIA}</span>
                <span className="at-regua dia">
                  <i style={{ width: Math.min(100, pct) + '%' }} />
                </span>
                <span className="at-folga">
                  {folga >= 0
                    ? 'cabem +' + folga.toLocaleString('pt-BR')
                    : 'passou ' + Math.abs(folga).toLocaleString('pt-BR')}
                </span>
              </span>
            </header>

            <div className="at-corpo">
              {doDia.map((p) => (
                <Linha
                  key={p.id}
                  pedido={p}
                  carregando={arrasto?.id === p.id && arrasto.valendo}
                  aoPegar={(ev) => pegar(ev, p)}
                  aoTrocarEtapa={(e) => {
                    const de = POSTO[p.etapa].nome
                    moverEtapa(p.id, e)
                    mexeu()
                    avisar(p.id + ': ' + de + ' para ' + POSTO[e].nome, 'ok')
                  }}
                  aoTrocarAviso={(a) => {
                    mudarAviso(p.id, a)
                    mexeu()
                  }}
                  aoTrocarEntrega={(d) => {
                    mudarEntrega(p.id, d)
                    mexeu()
                  }}
                  aoTrocarPlanejamento={(d) => {
                    planejarPara(p.id, d)
                    mexeu()
                  }}
                />
              ))}
              {!doDia.length ? <p className="at-vazio">Nada neste dia.</p> : null}
            </div>
          </section>
        )
      })}

      {/* o pedido que está na mão, seguindo o dedo */}
      {carregado && arrasto?.valendo ? (
        <div
          className="at-fantasma"
          style={{
            left: arrasto.x - arrasto.dx,
            top: arrasto.y - arrasto.dy,
            width: arrasto.largura,
          }}
        >
          <b>{carregado.cliente}</b>
          <span>
            {carregado.id} · {carregado.pecas} pçs
          </span>
        </div>
      ) : null}

      <div className="at-legenda">
        <span>
          <i className="at-marca atrasado" />
          atrasado: situação calculada pela entrega, convive com a etapa
        </span>
        <span>arraste a linha pelo punho para mudar o dia do pedido</span>
      </div>
    </Pagina>
  )
}

/* --- uma linha de pedido -------------------------------------------------- */
function Linha({
  pedido,
  carregando,
  aoPegar,
  aoTrocarEtapa,
  aoTrocarAviso,
  aoTrocarEntrega,
  aoTrocarPlanejamento,
}: {
  pedido: Pedido
  carregando: boolean
  aoPegar: (e: PointerEventoReact<HTMLElement>) => void
  aoTrocarEtapa: (e: Etapa) => void
  aoTrocarAviso: (a: Aviso) => void
  aoTrocarEntrega: (d: string) => void
  aoTrocarPlanejamento: (d: string) => void
}) {
  const p = pedido
  const late = atrasado(p)
  const velha = etapaVelha(p)
  return (
    <div
      className={['at-linha', late ? 'atrasada' : '', carregando ? 'carregando' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="at-punho"
        onPointerDown={aoPegar}
        aria-label={'Arrastar ' + p.id + ' para outro dia'}
        title="Arraste para mudar o dia"
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      <span className="at-cod">{p.id}</span>

      {/* O vendedor e a divisão das peças na mesma linha miúda. As duas
          quantidades levam a cor da técnica que representam, a mesma do resumo
          lá em cima: é a cor que separa uma da outra sem escrever "subli" e
          "pers" por extenso no meio da tabela. */}
      <span className="at-quem">
        <b>{p.cliente}</b>
        <small>
          {p.vendedor}
          {p.pecasSubli ? (
            <span className="at-qtd subli" title={p.pecasSubli + ' peças de sublimação'}>
              <i />
              {p.pecasSubli}
            </span>
          ) : null}
          {p.pecasPersonalizadas ? (
            <span className="at-qtd pers" title={p.pecasPersonalizadas + ' peças personalizadas'}>
              <i />
              {p.pecasPersonalizadas}
            </span>
          ) : null}
        </small>
      </span>

      <span className="esconde">
        <Seletor
          tamanho="sm"
          bloco
          comBusca={false}
          cor={p.aviso ? AVISO[p.aviso].cor : undefined}
          valor={p.aviso}
          vazio="sem aviso"
          opcoes={AVISOS.map((a) => ({ valor: a, rotulo: AVISO[a].nome }))}
          aoEscolher={(v) => aoTrocarAviso(v as Aviso)}
        />
      </span>

      <span className="some-antes at-suave">{p.departamento}</span>

      <span className="esconde">
        <DataEmPilula
          rotulo="Entrega"
          valor={p.entregaEm}
          aviso={late}
          aoMudar={aoTrocarEntrega}
          titulo="Data de entrega combinada com o cliente"
        />
      </span>

      <span className="esconde">
        <DataEmPilula
          rotulo="Planejamento"
          valor={p.planejadoEm}
          marcada={p.planejamentoManual}
          aoMudar={aoTrocarPlanejamento}
          titulo={
            p.planejamentoManual
              ? 'Dia escolhido na mão'
              : 'Dia sugerido pelo sistema. Escolher uma data marca como manual.'
          }
        />
      </span>

      <span className="num at-forte">{p.pecas}</span>

      {/* A coluna chama Atualização, e não Etapa, porque ela responde duas
          perguntas: em que posto o pedido está, e se isso ainda vale. Etapa
          sem ninguém tocar há mais de três dias sai com a borda tracejada. */}
      <span className={velha ? 'at-etapa velha' : 'at-etapa'}>
        <Seletor
          tamanho="sm"
          bloco
          comBusca={false}
          cor={POSTO[p.etapa].cor}
          valor={p.etapa}
          opcoes={ETAPAS.map((e) => ({ valor: e, rotulo: POSTO[e].nome }))}
          vazio="sem etapa"
          aoEscolher={(v) => aoTrocarEtapa((v || p.etapa) as Etapa)}
        />
      </span>
    </div>
  )
}

/* --- as cores da carga ---------------------------------------------------- */
function faixaDaCarga(pct: number): string {
  if (pct > 100) return 'passou'
  if (pct >= QUASE_CHEIO) return 'quase'
  return 'cabe'
}

function corDaCarga(pct: number): string {
  if (pct > 100) return 'var(--brand)'
  if (pct >= QUASE_CHEIO) return 'var(--warn)'
  return 'var(--posto-finalizado)'
}

function comoChamarASemana(n: number): string {
  if (n === 0) return 'semana de hoje'
  if (n === -1) return 'semana passada'
  if (n === 1) return 'semana que vem'
  return n < 0 ? Math.abs(n) + ' semanas atrás' : 'daqui a ' + n + ' semanas'
}
