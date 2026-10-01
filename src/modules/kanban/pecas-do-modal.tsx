import type { ReactNode } from 'react'

/* ==========================================================================
   As peças que o cartão aberto, o pedido inteiro e o comparar dividem, com
   os desenhos do wireframe de 01/10/2026: os ícones de traço, o botão de
   fechar de 44px, a tag mestre e o rótulo de seção.
   ========================================================================== */

export function IconeX({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconeLupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconeSeta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconeTroca() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h14l-3-3M20 16H6l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconeEnviar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12l16-8-6 16-2-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

/** O botão de fechar do canto, 44px, sem borda. */
export function Fechar({ aoFechar }: { aoFechar: () => void }) {
  return (
    <button type="button" className="mk-fechar" aria-label="Fechar" onClick={aoFechar}>
      <IconeX />
    </button>
  )
}

/** A tag mestre: VIP, URGENTE. Vem da cotação e vale para o pedido inteiro. */
export function Mestre({ children }: { children: ReactNode }) {
  return <span className="mk-mestre">{children}</span>
}

/** O rótulo de seção, em versalete cinza. */
export function Rotulo({ children, como = 'h3' }: { children: ReactNode; como?: 'h3' | 'span' }) {
  const Tag = como
  return <Tag className="mk-rot">{children}</Tag>
}

/* "hoje, 01/10" e "2 dias atrás, 29/09" saem em vermelho; o resto em preto */
export function entregaEmTexto(iso: string): { texto: string; perto: boolean } {
  if (!iso) return { texto: 'sem data', perto: false }
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return { texto: iso, perto: false }
  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12)
  const dias = Math.round((d.getTime() - base.getTime()) / 86400000)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (dias < 0) return { texto: (dias === -1 ? '1 dia atrás' : -dias + ' dias atrás') + ', ' + data, perto: true }
  if (dias === 0) return { texto: 'hoje, ' + data, perto: true }
  if (dias === 1) return { texto: 'amanhã, ' + data, perto: false }
  return { texto: data, perto: false }
}
