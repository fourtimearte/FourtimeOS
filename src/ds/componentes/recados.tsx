import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

export type TomRecado = 'brand' | 'ok' | 'warn' | 'info'
type Recado = { id: number; texto: ReactNode; tom: TomRecado }

/* Uma pilha só para o sistema inteiro, guardada aqui no módulo. Assim qualquer
   tela avisa com uma chamada de função, sem precisar carregar um provedor de
   contexto para dentro de cada módulo. */
let proximoId = 1
let pilha: Recado[] = []
const ouvintes = new Set<(r: Recado[]) => void>()

function espalhar() {
  ouvintes.forEach((o) => o(pilha))
}

/** Mostra um recado que some sozinho. Devolve a função que fecha antes da hora. */
export function avisar(texto: ReactNode, tom: TomRecado = 'brand', segundos = 4) {
  const r: Recado = { id: proximoId++, texto, tom }
  pilha = [...pilha, r]
  espalhar()
  const fecha = () => fecharRecado(r.id)
  if (segundos > 0) setTimeout(fecha, segundos * 1000)
  return fecha
}

export function fecharRecado(id: number) {
  pilha = pilha.filter((r) => r.id !== id)
  espalhar()
}

const COR: Record<TomRecado, string> = {
  brand: 'var(--brand)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  info: 'var(--info)',
}

/* A pilha mora uma vez só, na casca do app. */
export function PilhaDeRecados() {
  const [recados, setRecados] = useState<Recado[]>(pilha)
  useEffect(() => {
    ouvintes.add(setRecados)
    return () => {
      ouvintes.delete(setRecados)
    }
  }, [])

  if (!recados.length) return null
  return (
    <div className="pilha-recados" role="status" aria-live="polite">
      {recados.map((r) => (
        <div key={r.id} className="recado" style={{ '--c': COR[r.tom] } as CSSProperties}>
          <span className="pt" />
          <span>{r.texto}</span>
          <button
            type="button"
            className="fechar"
            aria-label="Fechar o aviso"
            onClick={() => fecharRecado(r.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
