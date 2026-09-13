import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as EventoDeTecla, ReactNode } from 'react'

export type ItemBusca = {
  id: string
  titulo: string
  /** texto miúdo na ponta direita: atalho, contagem, data */
  lado?: ReactNode
  grupo: string
  /** palavras que também devem encontrar este item */
  termos?: string
  aoEscolher: () => void
}

/* A busca global. Abre com Ctrl K ou Cmd K, anda com as setas, escolhe com
   Enter e sai com Esc. Ela nunca fica no meio do caminho: some assim que
   escolhe. */
export function BuscaGlobal({
  aberto,
  aoFechar,
  itens,
  convite = 'Buscar pedido, cliente, referência ou tela',
}: {
  aberto: boolean
  aoFechar: () => void
  itens: ItemBusca[]
  convite?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(0)

  const achados = useMemo(() => {
    const t = texto.trim().toLowerCase()
    if (!t) return itens
    return itens.filter((i) => `${i.titulo} ${i.termos ?? ''} ${i.grupo}`.toLowerCase().includes(t))
  }, [itens, texto])

  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemBusca[]>()
    achados.forEach((i) => {
      const lista = mapa.get(i.grupo) ?? []
      lista.push(i)
      mapa.set(i.grupo, lista)
    })
    return [...mapa.entries()]
  }, [achados])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) {
      d.showModal()
      setTexto('')
      setFoco(0)
      setTimeout(() => campo.current?.focus(), 10)
    }
    if (!aberto && d.open) d.close()
  }, [aberto])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const fechou = () => aoFechar()
    d.addEventListener('close', fechou)
    return () => d.removeEventListener('close', fechou)
  }, [aoFechar])

  useEffect(() => {
    setFoco(0)
  }, [texto])

  function escolher(i: ItemBusca) {
    aoFechar()
    i.aoEscolher()
  }

  function tecla(e: EventoDeTecla) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFoco((f) => Math.min(f + 1, achados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFoco((f) => Math.max(f - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = achados[foco]
      if (alvo) escolher(alvo)
    }
  }

  let indice = -1

  return (
    <dialog
      ref={ref}
      className="sobrepoe cmdk"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div className="caixa" onKeyDown={tecla}>
        <div className="cmdk-topo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={convite}
            aria-label={convite}
          />
          <span className="tecla">esc</span>
        </div>

        <div className="cmdk-lista">
          {grupos.length === 0 ? (
            <div className="vazio">
              <h3>Nada com esse nome</h3>
              <p>Tente o número do pedido, o nome do cliente ou o código da referência.</p>
            </div>
          ) : (
            grupos.map(([nome, lista]) => (
              <div key={nome}>
                <div className="grupo">{nome}</div>
                {lista.map((i) => {
                  indice += 1
                  const meu = indice
                  return (
                    <button
                      type="button"
                      key={i.id}
                      className={['item', meu === foco ? 'ligado' : ''].filter(Boolean).join(' ')}
                      onMouseEnter={() => setFoco(meu)}
                      onClick={() => escolher(i)}
                    >
                      <span>{i.titulo}</span>
                      {i.lado ? <span className="cmdk-lado">{i.lado}</span> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-pe">
          <span>
            <span className="tecla">↑</span> <span className="tecla">↓</span> andar
          </span>
          <span>
            <span className="tecla">enter</span> abrir
          </span>
          <span>
            <span className="tecla">esc</span> sair
          </span>
        </div>
      </div>
    </dialog>
  )
}

/* Liga o atalho Ctrl K, ou Cmd K no Mac. */
export function usarAtalhoDaBusca(abrir: () => void) {
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        abrir()
      }
    }
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [abrir])
}
