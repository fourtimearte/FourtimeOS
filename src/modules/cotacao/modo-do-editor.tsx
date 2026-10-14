import { useState } from 'react'
import type { ReactNode } from 'react'
import { ListBullets, Table } from '@phosphor-icons/react'
import { Segmentado } from '@ds'

/* ==========================================================================
   OS DOIS MODOS DO EDITOR DE COTAÇÃO (14/10/2026, opção C do wireframe).

   Lista é o editor de sempre, um layout aberto por vez. Tabela é a lista dos
   layouts aberta na largura toda, uma linha por layout, para mexer em vários
   de uma vez. O seletor mora no cabeçalho do cartão Layouts, com nome e
   ícone, e fica no mesmo lugar nos dois modos. O modo escolhido fica guardado
   neste navegador: quem trabalha na tabela volta para a tabela.
   ========================================================================== */

export type ModoDoEditor = 'lista' | 'tabela'

const CHAVE = 'ft-cotacao-modo'

function lerModo(): ModoDoEditor {
  try {
    return localStorage.getItem(CHAVE) === 'tabela' ? 'tabela' : 'lista'
  } catch {
    return 'lista'
  }
}

export function useModoDoEditor(): [ModoDoEditor, (m: ModoDoEditor) => void] {
  const [modo, setModo] = useState<ModoDoEditor>(lerModo)
  const guardar = (m: ModoDoEditor) => {
    setModo(m)
    try {
      localStorage.setItem(CHAVE, m)
    } catch {
      /* navegador sem armazenamento: o modo vale só nesta visita */
    }
  }
  return [modo, guardar]
}

const OPCOES: { valor: ModoDoEditor; rotulo: ReactNode }[] = [
  {
    valor: 'lista',
    rotulo: (
      <span className="ct-modo-op">
        <ListBullets size={16} />
        Lista
      </span>
    ),
  },
  {
    valor: 'tabela',
    rotulo: (
      <span className="ct-modo-op">
        <Table size={16} />
        Tabela
      </span>
    ),
  },
]

export function SeletorDoModo({
  modo,
  aoMudar,
}: {
  modo: ModoDoEditor
  aoMudar: (m: ModoDoEditor) => void
}) {
  return <Segmentado className="ct-modo" valor={modo} opcoes={OPCOES} aoMudar={aoMudar} />
}
