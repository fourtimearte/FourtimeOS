import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as EventoDePonteiro } from 'react'
import { Esqueleto, Vazio, avisar } from '@ds'
import {
  COLUNAS,
  carregarAsRotas,
  carregarAsTags,
  carregarOQuadro,
  corDoPosto,
  estaNaRota,
  moverAFatia,
  nomeDoPosto,
  paradoHa,
  pedidosDoQuadro,
  vizinhoNaRota,
  type Etapa,
  type FatiaNoQuadro,
  type PedidoNoTrilho,
  type Rota,
  type Tag,
} from '@dominio/producao'
import { pode, useSessao } from '@dominio/sessao'
import { CartaoDaFatia } from './cartao'
import { PedidoAberto } from './pedido-aberto'
import { Trilho } from './trilho'
import { CartaoAberto } from './cartao-aberto'
import { ConfirmarSaida } from './confirmar-saida'
import { SetaDireita, SetaEsquerda } from './setas'
import './kanban.css'

/* ==========================================================================
   MARK45: o quadro do chão de fábrica.

   O CARTÃO NÃO É O PEDIDO, É UMA FATIA: pedido mais técnica. Um pedido com
   sublimação e DTF vira dois cartões, porque os dois não andam juntos: a
   sublimação imprime antes de cortar e o DTF corta antes de imprimir.

   POR ISSO UM CARTÃO NÃO CAI EM QUALQUER COLUNA. Enquanto ele está sendo
   arrastado, as colunas que a rota dele não conhece apagam. Deixar todas
   acesas e recusar no fim seria ensinar errado e depois corrigir, e quem está
   com a mão no tablet aprende pelo que a tela deixa fazer.

   ARRASTAR E BOTÃO, OS DOIS. O plano pedia arrastar, e arrastar é bom no
   computador. No galpão a mão está suja, a tela é de vidro e o cartão escapa:
   a seta que empurra para o próximo posto da rota faz a mesma coisa com um
   toque, e é ela que vai ser usada de verdade.

   A MUDANÇA APARECE ANTES DE O BANCO RESPONDER, e volta atrás se ele recusar.
   Esperar a viagem faz a pessoa arrastar de novo achando que não pegou.

   O DESENHO É O DO WIREFRAME DE 01/10/2026, aprovado pelo Henrique com a
   ordem de ficar idêntico: sem o cabeçalho do MARK45, uma faixa só com o
   trilho e as quatro caixas quadradas da mesma altura, e o quadro andando por
   setas, sem barra de rolagem.
   ========================================================================== */

type Arrasto = {
  fatia: FatiaNoQuadro
  x: number
  y: number
  /* só vira arrasto de verdade depois de andar: sem isso, todo toque para
     ler o cartão vira um cartão andando de posto */
  valendo: boolean
}

export function TelaKanban() {
  const { estado } = useSessao()
  const eu = estado.fase === 'dentro' ? estado.pessoa : null
  const podeMover = !!eu && pode(eu, 'kanban', 'editar')

  const [fatias, setFatias] = useState<FatiaNoQuadro[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  /* O CARTÃO ABERTO E A CONFIRMAÇÃO GUARDAM O ID, e não a fatia inteira: a
     fatia muda embaixo deles quando alguém põe uma tag ou pega o cartão, e uma
     cópia guardada aqui ficaria velha na primeira mexida. */
  const [aberto, setAberto] = useState('')
  const [confirmando, setConfirmando] = useState('')
  /* O PEDIDO ACESO. Guardado por id, como o cartão aberto, e pelo mesmo
     motivo: a lista se relê e uma cópia guardada aqui ficaria velha.

     O DESTAQUE SOBREVIVE AO MODAL, de propósito. Fechar a folha e continuar
     vendo onde as peças daquele pedido estão espalhadas pelo quadro é
     justamente para o que o destaque serve; some-lo junto com o modal
     obrigaria a abrir o pedido de novo para olhar o quadro. Clicar no mesmo
     cartão do trilho, ou apertar Esc com o modal já fechado, limpa. */
  const [aceso, setAceso] = useState('')
  const [pedidoAberto, setPedidoAberto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [alvo, setAlvo] = useState<Etapa | null>(null)
  const quadro = useRef<HTMLDivElement>(null)

  /* O QUADRO ANDA POR COLUNA, COM SETAS, e não rola. Quantas colunas cabem
     sai da largura medida: 219px é a coluna do wireframe em 1080p, mais 12 de
     vão. Em 1608px de mesa cabem sete, e elas esticam até encostar nas duas
     bordas, que é o que o wireframe desenha. */
  const [largura, setLargura] = useState(0)
  const [desvio, setDesvio] = useState(0)
  useLayoutEffect(() => {
    const el = quadro.current
    if (!el) return
    const medir = () => setLargura(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
    /* o quadro só existe depois de carregar e quando há fatia: é quando o
       ref aparece que a medida precisa começar */
  }, [carregando, fatias.length > 0])
  const VAO = 12
  const cabem = Math.max(1, Math.min(COLUNAS.length, Math.floor((largura + VAO) / (219 + VAO))))
  const larguraDaColuna = largura ? (largura - VAO * (cabem - 1)) / cabem : 219
  const desvioMaximo = COLUNAS.length - cabem
  const inicio = Math.min(desvio, desvioMaximo)
  const ultimoAndar = useRef(0)
  /* o laço do arrasto roda fora do render e precisa do teto de hoje */
  const teto = useRef(0)
  teto.current = desvioMaximo

  /* O laço do arrasto lê destes, e não do estado: ele roda a cada quadro de
     vídeo, e reassinar o laço a cada setState faria ele nascer e morrer
     sessenta vezes por segundo. */
  const ponto = useRef({ x: 0, y: 0 })
  const oQueArrasta = useRef<FatiaNoQuadro | null>(null)
  const quadroDeVideo = useRef(0)

  const carregar = useCallback(async () => {
    try {
      const [f, r, t] = await Promise.all([
        carregarOQuadro(),
        carregarAsRotas(),
        carregarAsTags(),
      ])
      setFatias(f)
      setRotas(r)
      setTags(t)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o quadro.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const porPosto = useMemo(() => {
    const m = new Map<Etapa, FatiaNoQuadro[]>()
    for (const c of COLUNAS) m.set(c, [])
    for (const f of fatias) m.get(f.etapa)?.push(f)
    return m
  }, [fatias])

  /* O TRILHO SAI DAS FATIAS QUE O QUADRO JÁ TEM, e não de consulta própria:
     os dois têm que concordar sempre. Vindo de consultas diferentes bastaria
     meio segundo entre as duas para o trilho apontar para um pedido sem
     cartão nenhum. */
  const trilho = useMemo(() => pedidosDoQuadro(fatias), [fatias])

  const porChave = useMemo(() => new Map(tags.map((t) => [t.chave, t])), [tags])
  const oPedidoAberto = trilho.find((p) => p.id === pedidoAberto) ?? null
  const asFatiasDoPedido = useMemo(
    () => (pedidoAberto ? fatias.filter((f) => f.pedidoId === pedidoAberto) : []),
    [fatias, pedidoAberto],
  )

  const aFatiaAberta = fatias.find((f) => f.id === aberto) ?? null
  const aFatiaConfirmando = fatias.find((f) => f.id === confirmando) ?? null

  const conta = useMemo(
    () => ({
      cartoes: fatias.filter((f) => f.etapa !== 'finalizado').length,
      pecas: fatias.filter((f) => f.etapa !== 'finalizado').reduce((s, f) => s + f.pecas, 0),
      parados: fatias.filter((f) => f.etapa !== 'finalizado' && paradoHa(f.etapaEm) >= 3).length,
      prontos: fatias.filter((f) => f.etapa === 'finalizado').length,
    }),
    [fatias],
  )

  function limparODestaque() {
    setAceso('')
    setPedidoAberto('')
  }

  /* UM CLIQUE FAZ AS DUAS COISAS: acende o quadro e abre o pedido. Foi o que o
     Henrique pediu, e é o certo: acender sem abrir deixaria a pessoa olhando
     cartões acesos sem saber o que eles são, e abrir sem acender perderia o
     motivo de o pedido estar espalhado. Clicar no mesmo cartão limpa. */
  function escolherNoTrilho(p: PedidoNoTrilho) {
    if (aceso === p.id) {
      limparODestaque()
      return
    }
    setAceso(p.id)
    /* O QUADRO ANDA ATÉ O PEDIDO. Acender cartões que estão fora da janela
       seria acender no escuro: ele vai até a primeira coluna onde o pedido
       tem cartão, se ela não estiver à vista. */
    const colunasDele = fatias
      .filter((f) => f.pedidoId === p.id)
      .map((f) => COLUNAS.indexOf(f.etapa))
      .filter((i) => i >= 0)
    if (colunasDele.length) {
      const primeira = Math.min(...colunasDele)
      if (primeira < inicio || primeira >= inicio + cabem) setDesvio(Math.min(desvioMaximo, primeira))
    }
  }

  /* ESC LIMPA O DESTAQUE, e só quando não há modal na frente: o <dialog> já
     usa Esc para fechar a si mesmo, e as duas coisas no mesmo toque fariam o
     quadro apagar junto com a folha sem ninguém ter pedido. */
  useEffect(() => {
    if (!aceso) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('dialog[open]')) return
      limparODestaque()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  async function mover(f: FatiaNoQuadro, para: Etapa) {
    if (para === f.etapa) return
    const antes = f.etapa
    setFatias((lista) =>
      lista.map((x) => (x.id === f.id ? { ...x, etapa: para, etapaEm: new Date().toISOString() } : x)),
    )
    try {
      await moverAFatia(f.id, para)
      await carregar()
    } catch (e) {
      setFatias((lista) => lista.map((x) => (x.id === f.id ? { ...x, etapa: antes } : x)))
      avisar(e instanceof Error ? e.message : 'Não consegui mover o cartão.', 'brand')
    }
  }

  /* ---------- o arrasto, com Pointer Events ----------
     Um só caminho para dedo, caneta e ponteiro: escrever mouse e touch
     separados é escrever a mesma regra duas vezes e ver as duas divergirem. */
  function comecar(e: EventoDePonteiro, f: FatiaNoQuadro) {
    if (!podeMover || f.etapa === 'finalizado') return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    ponto.current = { x: e.clientX, y: e.clientY }
    setArrasto({ fatia: f, x: e.clientX, y: e.clientY, valendo: false })
  }

  function andar(e: EventoDePonteiro) {
    if (!arrasto) return
    ponto.current = { x: e.clientX, y: e.clientY }
    const andou =
      arrasto.valendo || Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y) > 6
    if (!andou) return
    if (!arrasto.valendo) oQueArrasta.current = arrasto.fatia
    setArrasto({ ...arrasto, x: e.clientX, y: e.clientY, valendo: true })
  }

  function largar() {
    if (arrasto?.valendo && alvo) void mover(arrasto.fatia, alvo)
    oQueArrasta.current = null
    setArrasto(null)
    setAlvo(null)
  }

  /* ---------- O QUADRO ROLA ENQUANTO VOCÊ ARRASTA ----------

     São treze postos, e o próximo posto da rota quase nunca está na tela: a
     sublimação sai da impressão e vai para a calandra, que é seis colunas
     adiante. Sem isto, arrastar só funciona para a coluna do lado, e a fábrica
     ia concluir que arrastar não funciona.

     O alvo também é decidido aqui, e não no pointermove: com o quadro andando
     sozinho, a coluna embaixo do dedo muda sem o dedo se mexer. */
  useEffect(() => {
    if (!arrasto?.valendo) return
    let vivo = true

    const passo = () => {
      if (!vivo) return
      const el = quadro.current
      const f = oQueArrasta.current
      if (el && f) {
        const caixa = el.getBoundingClientRect()
        const beira = 72
        const { x, y } = ponto.current
        /* sem barra de rolagem, o quadro anda uma coluna inteira por vez,
           e espera 450ms entre uma e outra para dar tempo de o olho achar o
           alvo antes de ele passar */
        const agora = performance.now()
        if (agora - ultimoAndar.current > 450) {
          if (x < caixa.left + beira) {
            setDesvio((d) => Math.max(0, Math.min(d, teto.current) - 1))
            ultimoAndar.current = agora
          } else if (x > caixa.right - beira) {
            setDesvio((d) => Math.min(teto.current, d + 1))
            ultimoAndar.current = agora
          }
        }

        /* elementFromPoint em vez de onDragOver, porque o cartão flutuante
           segue o ponteiro e taparia o alvo. */
        const sob = document.elementFromPoint(x, y)
        const col = sob?.closest('[data-posto]') as HTMLElement | null
        const posto = (col?.dataset.posto as Etapa | undefined) ?? null
        const bom = posto && estaNaRota(rotas, f.tecnica, posto) ? posto : null
        setAlvo((atual) => (atual === bom ? atual : bom))
      }
      quadroDeVideo.current = requestAnimationFrame(passo)
    }

    quadroDeVideo.current = requestAnimationFrame(passo)
    return () => {
      vivo = false
      cancelAnimationFrame(quadroDeVideo.current)
    }
  }, [arrasto?.valendo, rotas])

  if (!eu) return null

  const ultima = Math.min(COLUNAS.length, inicio + cabem)
  const oAceso = trilho.find((p) => p.id === aceso) ?? null

  return (
    <div className="kb-pagina">
      {/* O título existe para quem lê a tela com leitor: o wireframe tirou o
          cabeçalho do MARK45 da vista, e não da página. */}
      <h1 className="kb-titulo-oculto">Kanban de produção</h1>

      {/* O palco só existe para ser medido: ele é o contêiner que a faixa de
          cima consulta. Sem ele a conta seria da janela, que tem 248px de
          menu lateral que o quadro não pode usar. */}
      <div className="kb-palco">
        <section className="kb-cima" aria-label="Entregas e números do quadro">
          <Trilho
            pedidos={trilho}
            fatias={fatias}
            rotas={rotas}
            aceso={aceso}
            aoEscolher={escolherNoTrilho}
            aoAbrirPedido={(p) => setPedidoAberto(p.id)}
          />

          {/* QUATRO CAIXAS QUADRADAS, LADO A LADO, DA ALTURA DO TRILHO. Duas
              fileiras de duas era o que o Henrique não queria. */}
          <div className="kb-kpis">
            <Caixa rotulo="No chão de fábrica" valor={conta.cartoes} sub="cartões correndo" />
            <Caixa rotulo="Peças correndo" valor={conta.pecas.toLocaleString('pt-BR')} sub="somando os pedidos" />
            <Caixa
              rotulo="Parados 3 dias ou mais"
              valor={conta.parados}
              sub={conta.parados ? 'segurando entrega' : 'nada empacado'}
              alerta={conta.parados > 0}
            />
            <Caixa rotulo="Finalizados" valor={conta.prontos} sub="no fim da rota" />
          </div>
        </section>
      </div>

      {erro ? (
        <Vazio titulo="Não consegui ler o quadro" texto={erro} />
      ) : carregando ? (
        <div className="kb-carregando">
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
          <Esqueleto altura={18} />
        </div>
      ) : !fatias.length ? (
        <Vazio
          titulo="O quadro está vazio"
          texto="Cartão nasce quando o diretor aprova um pedido no PCP. Enquanto nada for aprovado, não há o que a fábrica possa começar."
        />
      ) : (
        <section className="kb-postos" aria-label="Postos">
          <div className="kb-postos-topo">
            <h2>Postos</h2>
            <span className="kb-faixa">
              {inicio + 1} a {ultima} de {COLUNAS.length} · {nomeDoPosto(COLUNAS[inicio])} até{' '}
              {nomeDoPosto(COLUNAS[ultima - 1])}
            </span>
            {oAceso ? (
              <button type="button" className="kb-aceso" onClick={limparODestaque}>
                Acesos: {oAceso.numero} · {oAceso.fatias} {oAceso.fatias === 1 ? 'cartão' : 'cartões'}
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
            <span className="kb-empurra" />
            <button
              type="button"
              className="kb-seta"
              aria-label="Postos anteriores"
              disabled={inicio <= 0}
              onClick={() => setDesvio(Math.max(0, inicio - 1))}
            >
              <SetaEsquerda />
            </button>
            <button
              type="button"
              className="kb-seta"
              aria-label="Próximos postos"
              disabled={inicio >= desvioMaximo}
              onClick={() => setDesvio(Math.min(desvioMaximo, inicio + 1))}
            >
              <SetaDireita />
            </button>
          </div>

          <div
            className="kb-quadro"
            ref={quadro}
            onPointerMove={andar}
            onPointerUp={largar}
            onPointerCancel={largar}
          >
            <div
              className="kb-quadro-fita"
              style={{ transform: `translateX(${-inicio * (larguraDaColuna + VAO)}px)` }}
            >
              {COLUNAS.map((posto, i) => {
                const lista = porPosto.get(posto) ?? []
                const naRota = arrasto?.valendo
                  ? estaNaRota(rotas, arrasto.fatia.tecnica, posto)
                  : true
                const fora = i < inicio || i >= ultima
                const classes = [
                  'kb-coluna',
                  arrasto?.valendo && !naRota ? 'fora' : '',
                  alvo === posto ? 'alvo' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <section
                    key={posto}
                    className={classes}
                    data-posto={posto}
                    aria-hidden={fora || undefined}
                    inert={fora || undefined}
                    style={{ width: larguraDaColuna, '--c': corDoPosto(posto) } as CSSProperties}
                  >
                    <header className="kb-topo">
                      <span className="kb-topo-nome">{nomeDoPosto(posto)}</span>
                      <span className="kb-empurra" />
                      <span className="kb-conta">{lista.length}</span>
                    </header>

                    <div className="kb-pilha">
                      {lista.map((f) => (
                        <CartaoDaFatia
                          key={f.id}
                          fatia={f}
                          rotas={rotas}
                          tags={porChave}
                          podeMover={podeMover}
                          arrastando={arrasto?.fatia.id === f.id && arrasto.valendo}
                          aceso={!!aceso && f.pedidoId === aceso}
                          apagado={!!aceso && f.pedidoId !== aceso}
                          aoPegar={(e) => comecar(e, f)}
                          aoAbrir={() => setAberto(f.id)}
                          aoTerminar={() => setConfirmando(f.id)}
                        />
                      ))}
                      {!lista.length ? <p className="kb-vazio">nada aqui</p> : null}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* O CARTÃO ABERTO. Ele não é uma tela nova: é o mesmo cartão, aberto,
          e por isso ele vive aqui dentro e não numa rota própria. Rota própria
          faria o Voltar do navegador sair do quadro e perder a rolagem de
          treze colunas que a pessoa acabou de fazer. */}
      {oPedidoAberto ? (
        <PedidoAberto
          pedido={oPedidoAberto}
          fatias={asFatiasDoPedido}
          rotas={rotas}
          /* FECHAR O MODAL NÃO APAGA O QUADRO. O destaque é o que sobra, e é
             ele que responde onde as peças estão espalhadas. */
          aoFechar={() => setPedidoAberto('')}
        />
      ) : null}

      {aFatiaAberta ? (
        <CartaoAberto
          fatia={aFatiaAberta}
          rotas={rotas}
          tags={tags}
          podeMover={podeMover}
          euId={eu.id}
          aoFechar={() => setAberto('')}
          aoMexer={() => void carregar()}
          aoTerminar={() => setConfirmando(aFatiaAberta.id)}
        />
      ) : null}

      {aFatiaConfirmando ? (
        <ConfirmarSaida
          fatia={aFatiaConfirmando}
          tags={tags}
          podeMover={podeMover}
          aoFechar={() => setConfirmando('')}
          aoConfirmar={() => {
            const p = vizinhoNaRota(rotas, aFatiaConfirmando.tecnica, aFatiaConfirmando.etapa, 1)
            setConfirmando('')
            setAberto('')
            if (p) void mover(aFatiaConfirmando, p)
          }}
        />
      ) : null}

      {/* O cartão que segue o dedo. Ele é só a sombra do que está sendo
          movido: o original fica no lugar, apagado, para a pessoa saber de
          onde saiu se resolver desistir. */}
      {arrasto?.valendo ? (
        <div
          className="kb-fantasma"
          style={{ left: arrasto.x, top: arrasto.y }}
          aria-hidden="true"
        >
          <b>{arrasto.fatia.numero}</b>
          <span>{arrasto.fatia.pecas} pçs</span>
        </div>
      ) : null}
    </div>
  )
}

/* UMA CAIXA DE NÚMERO, quadrada, do wireframe: rótulo em cima, número
   embaixo, e a frase miúda no pé. Não é o Kpi do Design System porque o Kpi
   tem altura e recheio próprios, e a caixa aqui tem que medir exatamente o
   mesmo que o trilho do lado. */
function Caixa({
  rotulo,
  valor,
  sub,
  alerta,
}: {
  rotulo: string
  valor: number | string
  sub: string
  alerta?: boolean
}) {
  return (
    <div className={alerta ? 'kb-caixa alerta' : 'kb-caixa'}>
      <span className="kb-caixa-rot">{rotulo}</span>
      <span className="kb-empurra" />
      <span className="kb-caixa-n">{valor}</span>
      <span className="kb-caixa-sub">{sub}</span>
    </div>
  )
}
