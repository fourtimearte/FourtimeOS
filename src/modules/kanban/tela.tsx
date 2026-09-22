import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as EventoDePonteiro } from 'react'
import { Esqueleto, Kpi, Pagina, Vazio, avisar } from '@ds'
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
  vizinhoNaRota,
  type Etapa,
  type FatiaNoQuadro,
  type Rota,
  type Tag,
} from '@dominio/producao'
import { pode, useSessao } from '@dominio/sessao'
import { CartaoDaFatia } from './cartao'
import { CartaoAberto } from './cartao-aberto'
import { ConfirmarSaida } from './confirmar-saida'
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
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [alvo, setAlvo] = useState<Etapa | null>(null)
  const quadro = useRef<HTMLDivElement>(null)

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

  const porChave = useMemo(() => new Map(tags.map((t) => [t.chave, t])), [tags])
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

     O alvo também é decidido aqui, e não no pointermove: com o quadro rolando
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
        if (x < caixa.left + beira) {
          el.scrollLeft -= Math.min(24, (caixa.left + beira - x) / 2)
        } else if (x > caixa.right - beira) {
          el.scrollLeft += Math.min(24, (x - (caixa.right - beira)) / 2)
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

  return (
    <Pagina
      acima="Produção"
      titulo="MARK45"
      sub={
        <>
          <b>{conta.cartoes}</b> {conta.cartoes === 1 ? 'cartão' : 'cartões'} no chão de fábrica ·{' '}
          {conta.pecas.toLocaleString('pt-BR')} peças · um cartão é um pedido numa técnica
        </>
      }
    >
      <div className="kb-kpis">
        <Kpi rotulo="No chão de fábrica" valor={conta.cartoes} sub="fora do finalizado" />
        <Kpi rotulo="Peças correndo" valor={conta.pecas.toLocaleString('pt-BR')} sub="somando os cartões" />
        <Kpi
          rotulo="Parados há 3 dias ou mais"
          valor={conta.parados}
          sub={conta.parados ? 'é o que segura a entrega' : 'nada empacado'}
          aviso={conta.parados > 0}
        />
        <Kpi rotulo="Finalizados" valor={conta.prontos} sub="chegaram ao fim da rota" />
      </div>

      {erro ? (
        <Vazio titulo="Não consegui ler o quadro" texto={erro} />
      ) : carregando ? (
        <div className="cartao">
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
        <div
          className="kb-quadro"
          ref={quadro}
          onPointerMove={andar}
          onPointerUp={largar}
          onPointerCancel={largar}
        >
          {COLUNAS.map((posto) => {
            const lista = porPosto.get(posto) ?? []
            const naRota = arrasto?.valendo
              ? estaNaRota(rotas, arrasto.fatia.tecnica, posto)
              : true
            const classes = [
              'kb-coluna',
              arrasto?.valendo && !naRota ? 'fora' : '',
              alvo === posto ? 'alvo' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <section key={posto} className={classes} data-posto={posto}>
                <header className="kb-topo" style={{ '--posto-cor': corDoPosto(posto) } as CSSProperties}>
                  <b>{nomeDoPosto(posto)}</b>
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
                      aoPegar={(e) => comecar(e, f)}
                      aoAbrir={() => setAberto(f.id)}
                      aoTerminar={() => setConfirmando(f.id)}
                    />
                  ))}
                  {!lista.length ? <p className="kb-vazio">vazio</p> : null}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* O CARTÃO ABERTO. Ele não é uma tela nova: é o mesmo cartão, aberto,
          e por isso ele vive aqui dentro e não numa rota própria. Rota própria
          faria o Voltar do navegador sair do quadro e perder a rolagem de
          treze colunas que a pessoa acabou de fazer. */}
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
    </Pagina>
  )
}
