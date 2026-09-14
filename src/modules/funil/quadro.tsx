import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as MouseEventoReact, PointerEvent as PointerEventoReact } from 'react'
import { MenuDeContexto, type ItemDeContexto } from '@ds'
import {
  ESTAGIOS,
  NOME_DO_ESTAGIO,
  corDoEstagio,
  formatarDinheiro,
  iniciais,
  nomeDoLead,
  porEstagio,
  minutosDesde,
  semResposta,
  tempoCurto,
  type Estagio,
  type Lead,
} from '@dominio/funil'

/* ==========================================================================
   O quadro do funil, como no v5.

   Seis colunas que rolam para o lado dentro da propria caixa, cada uma com
   nome, contagem e soma, e uma barra de 2 px embaixo do cabecalho na cor do
   estagio. No celular, as fichas de cima levam para a coluna.

   ARRASTAR COM PONTEIRO, E NAO COM O ARRASTE DO NAVEGADOR: o arraste nativo
   nao existe no toque, e isto roda em tablet no galpao. E arrastar nunca e o
   unico caminho, porque quem esta de pe com uma mao so precisa do menu.
   ========================================================================== */

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

export function Quadro({
  leads,
  aberto,
  aoMover,
  aoAbrir,
  relogio,
}: {
  leads: Lead[]
  aberto: string
  aoMover: (id: string, estagio: Estagio) => void
  aoAbrir: (l: Lead) => void
  /* O instante que a tela esta usando para ler o tempo. Vem de cima para o
     quadro inteiro contar pelo mesmo relogio: dois cartoes que chegaram juntos
     nao podem dizer 47 e 48 min so porque foram desenhados em milissegundos
     diferentes. */
  relogio: number
}) {
  const colunas = porEstagio(leads)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [alvo, setAlvo] = useState<Estagio | ''>('')
  const [ctx, setCtx] = useState<{ lead: Lead; itens: ItemDeContexto[] } | null>(null)
  const ancora = useRef<HTMLElement | null>(null)
  const arrastou = useRef(false)
  const quadro = useRef<HTMLDivElement>(null)
  const agora = useRef<{ arrasto: Arrasto | null; alvo: Estagio | '' }>({ arrasto: null, alvo: '' })
  agora.current = { arrasto, alvo }

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
  }, [arrasto, aoMover])

  function pegar(e: PointerEventoReact<HTMLElement>, l: Lead) {
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
    ancora.current = e.currentTarget
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

  function irPara(e: Estagio) {
    const col = quadro.current?.querySelector('[data-estagio="' + e + '"]') as HTMLElement | null
    const caixa = quadro.current
    if (col && caixa) caixa.scrollTo({ left: col.offsetLeft - caixa.offsetLeft, behavior: 'smooth' })
  }

  return (
    <>
      {/* as fichas de cima: so no celular, para pular de coluna sem arrastar a tela */}
      <div className="fn-abas">
        {ESTAGIOS.map((e) => (
          <button key={e} type="button" className="fn-aba" onClick={() => irPara(e)}>
            {NOME_DO_ESTAGIO[e]} <b>{colunas[e].length}</b>
          </button>
        ))}
      </div>

      <div className="fn-quadro" ref={quadro}>
        {ESTAGIOS.map((e) => {
          const lista = colunas[e]
          const soma = lista.reduce((s, l) => s + l.valor, 0)
          return (
            <section
              key={e}
              className="fn-col"
              data-estagio={e}
              style={{ '--c': corDoEstagio(e) } as CSSProperties}
            >
              <header className="fn-col-topo">
                <span className="t">{NOME_DO_ESTAGIO[e]}</span>
                <span className="n">{lista.length}</span>
                <span className="n suave">{formatarDinheiro(soma)}</span>
              </header>

              <div
                className={[
                  'fn-col-corpo',
                  alvo === e && arrasto?.valendo ? 'sobre' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {lista.map((l) => (
                  <Cartao
                    key={l.id}
                    lead={l}
                    relogio={relogio}
                    aberto={aberto === l.id}
                    carregando={arrasto?.id === l.id && arrasto.valendo}
                    aoPegar={(ev) => pegar(ev, l)}
                    aoMenu={(ev) => abrirMenu(ev, l)}
                    aoAbrir={() => {
                      if (!arrastou.current) aoAbrir(l)
                    }}
                  />
                ))}
                {!lista.length ? <p className="fn-vazio">Arraste um lead para cá</p> : null}
              </div>
            </section>
          )
        })}
      </div>

      {carregado && arrasto?.valendo ? (
        <div
          className="fn-fantasma"
          style={{ left: arrasto.x - arrasto.dx, top: arrasto.y - arrasto.dy, width: arrasto.largura }}
        >
          <b>{nomeDoLead(carregado)}</b>
          <span>{formatarDinheiro(carregado.valor)}</span>
        </div>
      ) : null}

      <MenuDeContexto
        aberto={!!ctx}
        ancora={ancora}
        aoFechar={() => setCtx(null)}
        cabecalho={ctx ? nomeDoLead(ctx.lead) : undefined}
        itens={ctx?.itens ?? []}
      />
    </>
  )
}

/* --- o cartao do v5 ------------------------------------------------------
   Avatar com as iniciais, anel vermelho quando tem nao lida, nome, o contador
   vermelho, duas linhas da ultima mensagem, e embaixo o valor com o tempo. */
function Cartao({
  lead,
  relogio,
  aberto,
  carregando,
  aoPegar,
  aoMenu,
  aoAbrir,
}: {
  lead: Lead
  relogio: number
  aberto: boolean
  carregando: boolean
  aoPegar: (e: PointerEventoReact<HTMLElement>) => void
  aoMenu: (e: MouseEventoReact<HTMLElement>) => void
  aoAbrir: () => void
}) {
  return (
    <article
      className={['fn-card', carregando ? 'carregando' : '', aberto ? 'aberto' : '']
        .filter(Boolean)
        .join(' ')}
      onPointerDown={aoPegar}
      onContextMenu={aoMenu}
      onClick={aoAbrir}
    >
      <div className="fn-card-topo">
        <span className={lead.novo ? 'fn-avatar anel' : 'fn-avatar'}>
          {iniciais(nomeDoLead(lead))}
        </span>
        <span className="fn-nome">{nomeDoLead(lead)}</span>
        {lead.novo ? <span className="fn-novo">{lead.novo}</span> : null}
        <button
          type="button"
          className="fn-mais"
          aria-label="Mover ou abrir"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation()
            aoMenu(ev)
          }}
        >
          ⋯
        </button>
      </div>

      <p className="fn-msg">{lead.msg}</p>

      <div className="fn-card-pe">
        <span className="fn-valor">{formatarDinheiro(lead.valor)}</span>
        <span className="fn-meta">
          <Relogio />
          <span className={semResposta(lead, relogio) ? 'fn-tempo atrasado' : 'fn-tempo'}>
            {tempoCurto(minutosDesde(lead.ultimaMsgEm, relogio))}
          </span>
          {lead.cotacao ? <span className="fn-tag">{lead.cotacao}</span> : null}
          {lead.pedido ? <span className="fn-tag">{lead.pedido}</span> : null}
        </span>
      </div>
    </article>
  )
}

function Relogio() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
