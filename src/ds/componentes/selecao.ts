import { useRef } from 'react'

/* ==========================================================================
   A SELEÇÃO DE LINHAS (Kit de Comportamento, item 1; 14/10/2026).

   Toda tabela ou lista que marca linhas para mexer em lote se comporta igual,
   como o explorador de arquivos:

   - a CAIXA de marcar, o CLIQUE NA LINHA (fora de botão, campo ou link) e o
     CTRL (ou Cmd) + clique alternam aquela linha e deixam as outras como
     estão: é assim que se junta um grupo de linhas soltas;
   - SHIFT + clique (na linha ou na caixa) pega a faixa desde a última linha
     clicada e põe toda ela no estado novo da linha clicada (marca ou solta);
   - ESC solta todas, e CTRL+A marca todas as que estão à vista, com o foco
     dentro da tabela e fora de um campo de escrever.

   Nasceu do `usarMarcarEmFaixa` das Tabelas de preço (pedido de 12/10/2026:
   "Shift mais clique marca ou desmarca tudo entre a última marcada e esta;
   Ctrl ou só o clique troca uma por uma") e virou peça do Design System para
   nenhuma tabela nova nascer sem ela.

   Quem guarda o que está marcado é a tela (lista ou Set de ids): esta peça
   só calcula o novo conjunto e entrega em `aplicar`.
   ========================================================================== */

export type CliqueDeSelecao = {
  shiftKey: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  target?: EventTarget | null
}

/** O alvo do clique é um controle (botão, campo, link, caixa)? Aí o clique é
    dele, e não da linha. */
export function cliqueEmControle(alvo: EventTarget | null | undefined): boolean {
  if (!(alvo instanceof Element)) return false
  return !!alvo.closest(
    'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"], [data-sem-selecao]',
  )
}

export type SelecaoDeLinhas = {
  /** a caixa de marcar da linha (ponha no onClick do input da Marcacao) */
  naCaixa: (id: string, e: CliqueDeSelecao) => void
  /** o clique na linha (ponha no onClick do tr ou do item); clique em botão,
      campo ou link dentro dela não conta */
  naLinha: (id: string, e: CliqueDeSelecao) => void
  /** Esc e Ctrl+A (ponha no onKeyDown da caixa que envolve a tabela) */
  naTecla: (e: {
    key: string
    ctrlKey: boolean
    metaKey: boolean
    target: EventTarget | null
    preventDefault: () => void
  }) => void
  /** a caixa do cabeçalho: marca todas as à vista, ou solta todas */
  todas: (sim: boolean) => void
}

export function useSelecaoDeLinhas(
  /** as linhas à vista, na ordem da tela */
  ordem: string[],
  /** o que está marcado agora */
  marcados: Iterable<string>,
  aplicar: (novos: string[]) => void,
): SelecaoDeLinhas {
  const ancora = useRef<string | null>(null)
  const atual = () => [...marcados]

  const faixaAte = (id: string): string[] | null => {
    const a = ancora.current
    if (!a || a === id) return null
    const i = ordem.indexOf(a)
    const j = ordem.indexOf(id)
    if (i < 0 || j < 0) return null
    /* o Shift do navegador também seleciona o texto entre os dois cliques */
    window.getSelection()?.removeAllRanges()
    return ordem.slice(Math.min(i, j), Math.max(i, j) + 1)
  }

  /* alterna a linha; com Shift, a faixa inteira vai para o estado novo dela */
  const alternar = (id: string, e: CliqueDeSelecao) => {
    const agora = atual()
    const sim = !agora.includes(id)
    const ids = (e.shiftKey && faixaAte(id)) || [id]
    ancora.current = id
    aplicar(sim ? [...new Set([...agora, ...ids])] : agora.filter(x => !ids.includes(x)))
  }

  return {
    naCaixa: alternar,
    naLinha(id, e) {
      if (cliqueEmControle(e.target)) return
      alternar(id, e)
    },
    naTecla(e) {
      const alvo = e.target
      /* a caixa de marcar não é campo de escrever: com o foco nela, Esc e Ctrl+A valem */
      const escrevendo =
        alvo instanceof HTMLInputElement
          ? alvo.type !== 'checkbox'
          : alvo instanceof Element && !!alvo.closest('textarea, [contenteditable="true"]')
      if (escrevendo) return
      if (e.key === 'Escape' && atual().length) {
        e.preventDefault()
        aplicar([])
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        aplicar([...ordem])
      }
    },
    todas(sim) {
      ancora.current = null
      aplicar(sim ? [...new Set([...atual(), ...ordem])] : atual().filter(x => !ordem.includes(x)))
    },
  }
}
