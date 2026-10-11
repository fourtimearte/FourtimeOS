import type { ReactNode } from 'react'
import { TShirt } from '@phosphor-icons/react'
import { LINHA_ESCOLHIDA } from '@ds'
import type { PedidoNaSeparacao, PedidoSeparado } from '@dominio/estoque'

/* ==========================================================================
   A FILA DA SEPARAÇÃO (prancha 82): os pedidos em dois grupos, Separando (já
   começou) e Esperando (pela entrega mais próxima), cada um com a miniatura
   da arte do primeiro layout, o cliente, o pedido, as peças e os layouts, a
   entrega e quantos materiais já saíram da prateleira.
   ========================================================================== */

export function dataCurta(iso: string): string {
  if (!iso) return 'sem data'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** dias até a entrega, contados por dia de calendário */
export function diasAte(iso: string, hoje = new Date()): number | null {
  if (!iso) return null
  const alvo = new Date(iso.slice(0, 10) + 'T12:00:00')
  const base = new Date(hoje.toISOString().slice(0, 10) + 'T12:00:00')
  return Math.round((alvo.getTime() - base.getTime()) / 86400000)
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function Miniatura({ src }: { src?: string }) {
  return (
    <span className="sp-mini" aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : <TShirt size={20} />}
    </span>
  )
}

export function LinhaDaFila({
  p,
  miniatura,
  escolhido,
  aoEscolher,
}: {
  p: PedidoNaSeparacao
  miniatura?: string
  escolhido: boolean
  aoEscolher: () => void
}) {
  const dias = diasAte(p.entregaEm)
  const perto = dias !== null && dias <= 7
  return (
    <button
      type="button"
      data-pedido={p.numero}
      className={escolhido ? 'sp-item escolhido ' + LINHA_ESCOLHIDA : 'sp-item'}
      aria-pressed={escolhido}
      onClick={aoEscolher}
    >
      <Miniatura src={miniatura} />
      <span className="sp-item-meio">
        <b className="sp-cliente">{p.cliente || 'sem cliente'}</b>
        <small>
          {p.numero} · {p.pecas} pçs{p.layouts ? ' · ' + plural(p.layouts, 'layout', 'layouts') : ''}
        </small>
      </span>
      <span className="sp-item-fim">
        <b className={perto ? 'sp-perto' : undefined}>entrega {dataCurta(p.entregaEm)}</b>
        <small className={p.naoCobre ? 'sp-pouco' : p.tudoSeparado ? 'sp-pronto' : undefined}>
          {p.materiais ? `${p.separados} de ${p.materiais} separados` : 'sem material'}
          {p.naoCobre ? ' · falta' : ''}
        </small>
      </span>
    </button>
  )
}

const NOME_DO_ESTADO: Record<string, string> = {
  pcp: 'no PCP',
  producao: 'na produção',
  pronto: 'pronto',
  enviado: 'enviado',
  entregue: 'entregue',
}

export function LinhaDoSeparado({
  p,
  miniatura,
  escolhido,
  aoEscolher,
}: {
  p: PedidoSeparado
  miniatura?: string
  escolhido: boolean
  aoEscolher: () => void
}) {
  return (
    <button
      type="button"
      data-pedido={p.numero}
      className={escolhido ? 'sp-item escolhido ' + LINHA_ESCOLHIDA : 'sp-item'}
      aria-pressed={escolhido}
      onClick={aoEscolher}
    >
      <Miniatura src={miniatura} />
      <span className="sp-item-meio">
        <b className="sp-cliente">{p.cliente || 'sem cliente'}</b>
        <small>
          {p.numero} · {p.pecas} pçs · {NOME_DO_ESTADO[p.estado] ?? p.estado}
        </small>
      </span>
      <span className="sp-item-fim">
        <b>{p.separadoEm ? 'separado ' + dataCurta(p.separadoEm) : 'sem material'}</b>
        <small className={p.aviso ? 'sp-pouco' : undefined}>
          {p.materiais ? `${p.separados} de ${p.materiais}` : ''}
          {p.aviso ? (p.materiais ? ' · ' : '') + 'desceu com falta' : ''}
        </small>
      </span>
    </button>
  )
}

export function GrupoDaFila({ nome, apoio, children }: { nome: string; apoio: string; children: ReactNode }) {
  return (
    <div className="sp-grupo">
      <div className="sp-g">
        {nome}
        <small>{apoio}</small>
      </div>
      {children}
    </div>
  )
}
