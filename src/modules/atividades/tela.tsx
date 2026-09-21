import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as PointerEventoReact } from 'react'
import { ArrowsClockwise, DotsSixVertical, Printer } from '@phosphor-icons/react'
import { Aviso as Faixa, Botao, DataEmPilula, Pagina, Seletor, avisar } from '@ds'
import {
  AVISO,
  AVISOS,
  CAPACIDADE_DA_SEMANA,
  CAPACIDADE_DO_DIA,
  DIAS_DA_SEMANA,
  DIAS_UTEIS,
  ETAPAS,
  POSTO,
  aoVirarODia,
  atrasado,
  diaDaSemanaDe,
  diaEMes,
  ehHoje,
  etapaVelha,
  finalizarEm,
  hojeISO,
  iso,
  carregarPedidos,
  montarSemana,
  moverEtapa,
  mudarAviso,
  mudarEntrega,
  planejarPara,
  semanaDeslocada,
  semanaDoAno,
  tituloDaSemana,
  type Aviso,
  type Colocacao,
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
  /* A LISTA INTEIRA DA FABRICA, E A SEMANA E FILTRO DE TELA.

     Pedir ao banco so os planejados desta semana pareceria mais economico, mas
     a fabrica inteira tem dezenas de pedidos abertos, nao milhares, e navegar
     de semana em semana viraria uma consulta por clique. Pior: os numeros do
     topo comparam a semana com a capacidade, e quem esta olhando quer poder
     pular para a semana que vem e voltar sem esperar. */
  const [todos, setTodos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')

  const recarregar = useCallback(async () => {
    try {
      setTodos(await carregarPedidos())
      setFalha('')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não consegui carregar os pedidos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  /* ---------- O PAINEL SE ATUALIZA SOZINHO ------------------------------

     Tres relogios, e cada um conserta uma forma diferente de esta tela
     mentir sem avisar.

     1. HOJE. A colocacao de cada pedido depende do dia. Lido uma vez na
        montagem, o painel atravessa a meia-noite de domingo mostrando na
        semana corrente o que ja e da semana passada, e e exatamente ai que o
        painel antigo quebrava. `aoVirarODia` se reagenda sozinho.

     2. A FABRICA. A etapa que a tag mostra e a MESMA coluna que o kanban
        grava: quando um cartao passa de Corte para Impressao DTF, o dado ja
        mudou para todo mundo. O que falta e esta tela reler. Trinta segundos
        e mais do que suficiente para um quadro que uma pessoa aponta a cada
        poucos minutos, e nao pesa: sao dezenas de linhas, nao milhares.

     3. A VOLTA PARA A ABA. O tablet do galpao passa a noite com a tela
        apagada, e temporizador em aba escondida e estrangulado pelo
        navegador. Ao voltar para a frente, rele na hora, sem esperar o
        proximo intervalo. */
  const [hoje, setHoje] = useState(hojeISO)

  useEffect(() => aoVirarODia(setHoje), [])

  useEffect(() => {
    const t = setInterval(() => void recarregar(), 30000)
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
      setHoje(hojeISO())
      void recarregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [recarregar])

  /* Troca um pedido na lista sem reler a fabrica inteira: mexer num cartao nao
     deveria custar uma consulta de tudo. */
  const trocar = useCallback((p: Pedido | null) => {
    if (p) setTodos((atuais) => atuais.map((x) => (x.id === p.id ? p : x)))
  }, [])

  /* A linha volta do BANCO, e nao do que a tela achou que ia acontecer. Mudar
     a etapa para "finalizado" tambem muda o estado do pedido, por gatilho la
     dentro, e a tela que adivinha o resultado e a tela que mente. */
  const gravar = useCallback(
    async (promessa: Promise<Pedido | null>) => {
      try {
        trocar(await promessa)
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'Não consegui gravar', 'warn')
        void recarregar()
      }
    },
    [trocar, recarregar],
  )

  /* O arrastar le a lista de dentro de um ouvinte de evento, que foi montado
     uma vez. Sem esta referencia ele leria a lista de quando foi montado. */
  const todosAgora = useRef<Pedido[]>([])
  todosAgora.current = todos

  /* 0 e esta semana, -1 a passada, +1 a que vem */
  const [semana, setSemana] = useState(0)
  const [etapa, setEtapa] = useState('')

  const inicio = useMemo(() => semanaDeslocada(semana), [semana])
  const diasDaSemana = useMemo(
    () => DIAS_DA_SEMANA.map((nome, i) => ({ nome, data: diaDaSemanaDe(inicio, i) })),
    [inicio],
  )

  /* ---------- A SEMANA, MONTADA PELA REGRA -------------------------------

     Aqui estava o bug da virada, e vale deixar escrito o que ele era:

         const doDia = filtrados.filter((p) => p.planejadoEm === chave)

     Filtrar por `planejadoEm` antes de colocar joga fora exatamente o pedido
     que a virada existe para resgatar. O atrasado tem `planejadoEm` na semana
     passada, entao o filtro o descarta ANTES de a regra ter chance de o
     trazer para esta semana: ele nao aparece em lugar nenhum e ninguem
     percebe, porque tela que perde linha nao da erro, so fica errada.

     `montarSemana` inverte a ordem: coloca todos os pedidos primeiro, com a
     regra, e so depois fica com os que cairam nesta semana. E ela nao grava
     nada: a colocacao e derivada de `fechado_em`, `planejado_em` e de que dia
     e hoje. Por isso a semana passada continua mostrando o que foi feito
     nela, e nao muda sozinha depois de fechada. */
  const daEtapa = useMemo(
    () => (etapa ? todos.filter((p) => p.etapa === etapa) : todos),
    [todos, etapa],
  )

  const semanaMontada = useMemo(
    () => montarSemana(daEtapa, iso(inicio), hoje),
    [daEtapa, inicio, hoje],
  )

  /* A pendencia: o que caiu aqui porque a semana dele acabou sem finalizar,
     mais o que entrou no sistema e ninguem planejou. E a fila de triagem da
     segunda-feira, e o filtro do topo isola ela com um clique. */
  const pendencia = semanaMontada.pendencia
  const [soPendencia, setSoPendencia] = useState(false)

  const visiveis = useMemo(() => {
    if (!soPendencia) return semanaMontada
    const ids = new Set(pendencia.map((p) => p.id))
    return montarSemana(daEtapa.filter((p) => ids.has(p.id)), iso(inicio), hoje)
  }, [soPendencia, semanaMontada, pendencia, daEtapa, inicio, hoje])

  const filtrados = visiveis.pedidos

  const pecas = filtrados.reduce((s, p) => s + p.pecas, 0)
  const pecasSubli = filtrados.reduce((s, p) => s + p.pecasSubli, 0)
  const pecasPersonalizadas = filtrados.reduce((s, p) => s + p.pecasPersonalizadas, 0)
  const atrasados = filtrados.filter(atrasado).length
  const saturacao = Math.round((pecas / CAPACIDADE_DA_SEMANA) * 100)
  const sobra = CAPACIDADE_DA_SEMANA - pecas
  const prontosNaSemana = filtrados.filter((p) => p.etapa === 'finalizado')
  const prontos = prontosNaSemana.length
  const pecasProntas = prontosNaSemana.reduce((s, p) => s + p.pecas, 0)


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
        const antes = todosAgora.current.find((p) => p.id === a.id)
        if (antes && antes.planejadoEm !== onde) {
          /* O cartao pula para o dia novo na hora e a gravacao vai atras. Se o
             banco recusar, ele volta: um cartao parado no dia errado enquanto a
             fabrica inteira olha o mesmo quadro e pior do que um cartao que
             volta. */
          setTodos((atuais) =>
            atuais.map((x) => (x.id === a.id ? { ...x, planejadoEm: onde } : x)),
          )
          avisar(antes.numero + ' passou para ' + diaEMes(new Date(onde + 'T00:00:00')), 'ok')
          planejarPara(a.id, onde)
            .then(trocar)
            .catch((e) => {
              setTodos((atuais) => atuais.map((x) => (x.id === a.id ? antes : x)))
              avisar(e instanceof Error ? e.message : 'Não consegui mover o pedido', 'warn')
            })
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
      {falha ? (
        <Faixa tom="brand" titulo="Não consegui carregar os pedidos">
          {falha}
        </Faixa>
      ) : null}

              ‹
            </button>
            <b className="at-semana-txt">{tituloDaSemana(inicio)}</b>
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
              /* A contagem do filtro conta o que ESTA SEMANA mostra, e nao a
                 fabrica inteira: um numero ao lado de "Costura" que nao bate
                 com o que aparece ao escolher Costura e pior que numero
                 nenhum. Por isso ela sai de semanaMontada, que ja passou pela
                 regra da virada. */
              contagem: semanaMontada.pedidos.filter((p) => p.etapa === e).length,
            }))}
            vazio="Todas as etapas"
            aoEscolher={setEtapa}
          />
          <Botao
            tom="forte"
            onClick={() => avisar('A varredura do Drive entra junto com o kanban', 'info')}
          >
            <ArrowsClockwise size={17} />
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
            {/* uma por linha, e não uma frase que quebra no meio de "418
                personalizado". Estas duas linhas são a legenda dos pontinhos
                coloridos que aparecem em cada pedido lá embaixo. */}
            <small className="at-divisao">
              <span className="at-qtd subli">
                <i />
                {pecasSubli.toLocaleString('pt-BR')} sublimação
              </span>
              <span className="at-qtd pers">
                <i />
                {pecasPersonalizadas.toLocaleString('pt-BR')} personalizado
              </span>
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

      {/* A FILA DA SEGUNDA-FEIRA. Sem esta faixa, o que a virada traz de volta
          se mistura com o que foi planejado e a segunda vira uma pilha sem
          explicação: o operador vê o dia vermelho e não sabe se a semana
          nasceu cheia ou se herdou. Ela só aparece quando existe o que
          triar, e o botão isola essas linhas para arrastar uma a uma. */}
      {pendencia.length ? (
        <div className={soPendencia ? 'at-fila ligada' : 'at-fila'}>
          <span className="at-fila-num">{pendencia.length}</span>
          <span className="at-fila-txt">
            {pendencia.length === 1 ? 'pedido esperando' : 'pedidos esperando'} um dia nesta semana
            <small>
              {pendencia.reduce((t, x) => t + x.pecas, 0).toLocaleString('pt-BR')} peças que vieram
              de uma semana que terminou sem finalizar, ou que entraram sem planejamento
            </small>
          </span>
          <Botao
            tom={soPendencia ? 'forte' : 'contorno'}
            tamanho="sm"
            onClick={() => setSoPendencia((v) => !v)}
          >
            {soPendencia ? 'Ver a semana toda' : 'Ver só estes'}
          </Botao>
        </div>
      ) : null}

      {/* O cabecalho gruda no topo sozinho, e a linha de dia nao: rolando uma
          semana cheia, o que se perde de vista e o nome das colunas. Ele tem
          contraste proprio, mais escuro que a linha de dia, para os dois nao
          virarem a mesma faixa cinza quando encostam. */}
      {/* O cabecalho de colunas e os dias dividem a mesma borda: eles sao UMA
          peca, e por isso entram na pagina dentro de um filho so. O vao da
          pagina separa a peca inteira do que vem antes e do que vem depois, e
          nada separa o cabecalho do primeiro dia, que e o certo. */}
      <div className="at-tabela">
        <div className="at-colunas">
          <span />
          <span className="at-cod">Pedido</span>
          <span>Nome</span>
          <span className="esconde">Aviso</span>
          <span className="some-antes">Departamento</span>
          <span className="esconde meio">Entrega</span>
          <span className="esconde meio">Planejamento</span>
          <span className="num">Total</span>
          <span>Atualização</span>
        </div>

        {diasDaSemana.map(({ nome, data }, i) => {
          const chave = iso(data)
          const coluna = visiveis.dias[i]
          const doDia = coluna.pedidos
          const pecasDoDia = coluna.pecas
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
                    colocacao={visiveis.onde.get(p.id)}
                    carregando={arrasto?.id === p.id && arrasto.valendo}
                    aoFinalizarEm={(d) => {
                      avisar(p.numero + ' finalizado em ' + diaEMes(new Date(d + 'T12:00:00')), 'ok')
                      void gravar(finalizarEm(p.id, d))
                    }}
                    aoPegar={(ev) => pegar(ev, p)}
                    aoTrocarEtapa={(e) => {
                      const de = POSTO[p.etapa].nome
                      avisar(p.numero + ': ' + de + ' para ' + POSTO[e].nome, 'ok')
                      void gravar(moverEtapa(p.id, e))
                    }}
                    aoTrocarAviso={(a) => void gravar(mudarAviso(p.id, a))}
                    aoTrocarEntrega={(d) => void gravar(mudarEntrega(p.id, d))}
                    aoTrocarPlanejamento={(d) => void gravar(planejarPara(p.id, d))}
                  />
                ))}
                {!doDia.length ? (
                  <p className="at-vazio">
                    {carregando
                      ? 'Buscando...'
                      : falha
                        ? 'Não consegui carregar'
                        : 'Nada neste dia.'}
                  </p>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

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
  colocacao,
  carregando,
  aoPegar,
  aoTrocarEtapa,
  aoTrocarAviso,
  aoTrocarEntrega,
  aoTrocarPlanejamento,
  aoFinalizarEm,
}: {
  pedido: Pedido
  colocacao?: Colocacao
  carregando: boolean
  aoPegar: (e: PointerEventoReact<HTMLElement>) => void
  aoTrocarEtapa: (e: Etapa) => void
  aoTrocarAviso: (a: Aviso) => void
  aoTrocarEntrega: (d: string) => void
  aoTrocarPlanejamento: (d: string) => void
  aoFinalizarEm: (d: string) => void
}) {
  const p = pedido
  const late = atrasado(p)
  const velha = etapaVelha(p)
  /* De onde ele veio parar neste dia. So importa quando nao foi uma pessoa
     que o pos aqui: linha que apareceu sozinha precisa dizer isso, senao o
     operador acha que alguem planejou para hoje. */
  const origem = colocacao?.origem
  return (
    <div
      className={[
        'at-linha',
        late ? 'atrasada' : '',
        carregando ? 'carregando' : '',
        origem === 'arrastado' || origem === 'novo' ? 'pendente' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="at-punho"
        onPointerDown={aoPegar}
        aria-label={'Arrastar ' + p.numero + ' para outro dia'}
        title="Arraste para mudar o dia"
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      <span className="at-cod">{p.numero}</span>

      {/* O vendedor e a divisão das peças na mesma linha miúda. As duas
          quantidades levam a cor da técnica que representam, a mesma do resumo
          lá em cima: é a cor que separa uma da outra sem escrever "subli" e
          "pers" por extenso no meio da tabela. */}
      <span className="at-quem">
        {/* No celular não cabem sete colunas, então o código do pedido e o
            total de peças dobram para dentro da célula do nome. Eles não
            somem: some a coluna, que é outra coisa. */}
        <span className="at-antes-do-nome">
          {p.numero} · {p.pecas} pçs
        </span>
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

      {/* A MARCA DE QUEM CHEGOU SOZINHO. Um pedido que caiu na segunda-feira
          porque a semana dele acabou não pode parecer igual a um que alguém
          planejou para segunda: são a mesma linha com histórias opostas, e é
          o operador que precisa separar as duas para decidir. A pílula
          continua mostrando o dia REAL do banco, que é a semana passada, e
          não o dia em que a linha está aparecendo. */}
      <span className="esconde at-planejado">
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
        {origem === 'arrastado' ? (
          <small className="at-veio" title="A semana dele terminou sem finalizar. Arraste para o dia certo, ou finalize na data em que ele ficou pronto.">
            veio da semana passada
          </small>
        ) : null}
        {origem === 'novo' ? (
          <small className="at-veio novo" title="Entrou no sistema e ninguém planejou ainda.">
            sem planejamento
          </small>
        ) : null}
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
        {/* EM QUE DIA ELE FICOU PRONTO, e não em que dia alguém lembrou de
            apontar. É este campo que devolve o pedido para a semana em que o
            trabalho aconteceu: a colocação lê a finalização antes de tudo,
            então escolher a sexta passada aqui tira a linha desta semana e a
            põe de volta lá, sozinha. Só aparece quando a etapa é finalizado,
            porque em qualquer outra o banco zera esta data. */}
        {p.etapa === 'finalizado' ? (
          <DataEmPilula
            rotulo="Pronto em"
            valor={p.fechadoEm}
            marcada
            aoMudar={aoFinalizarEm}
            titulo="O dia em que ele ficou pronto de verdade. Mudar aqui devolve o pedido para a semana daquele dia."
          />
        ) : null}
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

