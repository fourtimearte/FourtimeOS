import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as MouseEventoReact, PointerEvent as PointerEventoReact } from 'react'
import { MenuDeContexto, type ItemDeContexto } from '@ds'
import {
  ESTAGIOS,
  EXPLICACAO_DO_ESTAGIO,
  NOME_DA_ORIGEM,
  NOME_DO_ESTAGIO,
  diasParado,
  esquecido,
  formatarDinheiro,
  porEstagio,
  type Estagio,
  type Lead,
} from '@dominio/funil'

/* ==========================================================================
   O quadro do funil.

   ARRASTAR COM PONTEIRO, E NAO COM O ARRASTE DO NAVEGADOR.
   O arraste nativo do HTML nao existe no toque, e este sistema roda em tablet
   no galpao. Entao o arraste aqui e feito na mao, com eventos de ponteiro, que
   sao os mesmos para dedo e para mouse.

   E arrastar NUNCA e o unico caminho. Todo cartao tem o menu do botao direito,
   ou do toque longo, com "mover para". Quem esta de pe segurando um tablet
   com uma mao so precisa disso, e quem usa teclado tambem.
   ========================================================================== */

type Arrasto = {
  id: string
  /* onde o dedo esta agora */
  x: number
  y: number
  /* onde ele encostou: e a distancia ate aqui que decide se e arraste */
  x0: number
  y0: number
  /* de onde no cartao ele pegou, para o fantasma nao pular para o dedo */
  dx: number
  dy: number
  largura: number
  /* so vira arraste de verdade depois de andar um tanto: senao todo toque
     no cartao viraria arraste e ninguem conseguiria abrir a conversa */
  valendo: boolean
}

export function Quadro({
  leads,
  aoMover,
  aoAbrir,
}: {
  leads: Lead[]
  aoMover: (id: string, estagio: Estagio) => void
  aoAbrir: (l: Lead) => void
}) {
  const colunas = porEstagio(leads)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [alvo, setAlvo] = useState<Estagio | ''>('')
  const [ctx, setCtx] = useState<{ lead: Lead; itens: ItemDeContexto[] } | null>(null)
  const ancora = useRef<HTMLElement | null>(null)
  /* o clique chega DEPOIS do soltar, quando o arraste ja acabou. Sem esta
     marca, largar um cartao abria a conversa dele junto */
  const arrastou = useRef(false)
  /* espelho do arrasto e do alvo, para o soltar nao precisar ler estado de
     dentro de um atualizador: atualizador de estado pode rodar duas vezes, e
     mover o lead duas vezes seria mover errado */
  const agora = useRef<{ arrasto: Arrasto | null; alvo: Estagio | '' }>({ arrasto: null, alvo: '' })
  agora.current = { arrasto, alvo }
  const hoje = Date.now()

  /* o cartao que esta sendo carregado, para o fantasma saber o que desenhar */
  const carregado = arrasto ? leads.find((l) => l.id === arrasto.id) : null

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
      const coluna = sob?.closest('[data-estagio]') as HTMLElement | null
      setAlvo((coluna?.dataset.estagio as Estagio) ?? '')
    }
    const soltar = () => {
      const { arrasto: a, alvo: onde } = agora.current
      if (a?.valendo) {
        arrastou.current = true
        /* o clique do mesmo gesto chega logo em seguida: a marca some depois */
        setTimeout(() => (arrastou.current = false), 0)
        if (onde) aoMover(a.id, onde)
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
  }, [arrasto, alvo, aoMover])

  function pegar(e: PointerEventoReact<HTMLElement>, l: Lead) {
    /* botao direito abre o menu, nao arrasta */
    if (e.button !== 0) return
    const caixa = e.currentTarget.getBoundingClientRect()
    setArrasto({
      id: l.id,
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

  function abrirMenu(e: MouseEventoReact<HTMLElement>, l: Lead) {
    e.preventDefault()
    ancora.current = e.currentTarget as HTMLElement
    setCtx({
      lead: l,
      itens: [
        { rotulo: 'Abrir a conversa', aoEscolher: () => aoAbrir(l) },
        ...ESTAGIOS.filter((x) => x !== l.estagio).map((x) => ({
          rotulo: 'Mover para ' + NOME_DO_ESTAGIO[x],
          aoEscolher: () => aoMover(l.id, x),
        })),
      ],
    })
  }

  return (
    <>
      <div className="fn-quadro">
        {ESTAGIOS.map((e) => {
          const lista = colunas[e]
          const soma = lista.reduce((s, l) => s + l.valor, 0)
          return (
            <section
              key={e}
              className={['fn-col', alvo === e && arrasto?.valendo ? 'alvo' : ''].filter(Boolean).join(' ')}
              data-estagio={e}
            >
              <header className="fn-col-topo">
                <span className="fn-col-nome">{NOME_DO_ESTAGIO[e]}</span>
                <span className="fn-col-conta">{lista.length}</span>
                <span className="fn-col-dica">{EXPLICACAO_DO_ESTAGIO[e]}</span>
                <span className="fn-col-soma">{formatarDinheiro(soma)}</span>
              </header>

              <div className="fn-col-lista">
                {lista.map((l) => (
                  <article
                    key={l.id}
                    className={[
                      'fn-card',
                      arrasto?.id === l.id && arrasto.valendo ? 'carregado' : '',
                      esquecido(l, hoje) ? 'esquecido' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onPointerDown={(ev) => pegar(ev, l)}
                    onContextMenu={(ev) => abrirMenu(ev, l)}
                    onClick={() => {
                      if (!arrastou.current) aoAbrir(l)
                    }}
                  >
                    <div className="fn-card-topo">
                      <b>{l.nome}</b>
                      <button
                        type="button"
                        className="fn-card-mais"
                        aria-label="Mover ou abrir"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          abrirMenu(ev, l)
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                    <span className="fn-card-linha">
                      {l.contato} · {l.cidade}
                    </span>
                    <span className="fn-card-linha">
                      {l.pecas} peças · <b>{formatarDinheiro(l.valor)}</b>
                    </span>
                    <div className="fn-card-pe">
                      <span className="fn-tag">{NOME_DA_ORIGEM[l.origem]}</span>
                      <span className="fn-tag">{l.vendedor}</span>
                      <span className={esquecido(l, hoje) ? 'fn-dias grita' : 'fn-dias'}>
                        {diasParado(l, hoje) === 0 ? 'hoje' : diasParado(l, hoje) + 'd'}
                      </span>
                    </div>
                  </article>
                ))}
                {!lista.length ? <p className="fn-vazio">nada aqui</p> : null}
              </div>
            </section>
          )
        })}
      </div>

      {/* o fantasma que segue o dedo. Ele mora no fim da tela, fora das
          colunas, para nao ser recortado por nenhuma delas */}
      {carregado && arrasto?.valendo ? (
        <div
          className="fn-fantasma"
          style={{
            left: arrasto.x - arrasto.dx,
            top: arrasto.y - arrasto.dy,
            width: arrasto.largura,
          }}
        >
          <b>{carregado.nome}</b>
          <span>
            {carregado.pecas} peças · {formatarDinheiro(carregado.valor)}
          </span>
        </div>
      ) : null}

      <MenuDeContexto
        aberto={!!ctx}
        ancora={ancora}
        aoFechar={() => setCtx(null)}
        cabecalho={ctx?.lead.nome}
        itens={ctx?.itens ?? []}
      />
    </>
  )
}
