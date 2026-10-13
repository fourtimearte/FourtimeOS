/* O tema vive num atributo no <html>, que é onde os tokens estão pendurados.
   Gelo é o padrão. A escolha fica guardada no navegador de quem está usando. */

export type Tema = 'light' | 'dark'
const CHAVE = 'ft.tema'

export function temaAtual(): Tema {
  const t = document.documentElement.getAttribute('data-theme')
  return t === 'dark' ? 'dark' : 'light'
}

export function aplicarTema(t: Tema) {
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    /* armazenamento bloqueado: o tema vale só enquanto a aba estiver aberta */
  }
}

export function temaGuardado(): Tema | null {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'dark' || t === 'light' ? t : null
  } catch {
    return null
  }
}

/* IMPRIMIR A PAGINA DE TELA (12/10/2026): o Painel de atividades e o
   Relatorio mensal. Sai no tema claro mesmo com o Grafite ligado (papel nao
   e tela escura), sem o menu, o topo e os botoes; depois volta tudo como
   estava. A folha A4 da cotacao tem o caminho dela (folha.tsx). */
export function imprimirAPagina() {
  const raiz = document.documentElement
  const antes = raiz.getAttribute('data-theme')
  raiz.setAttribute('data-theme', 'light')
  document.body.classList.add('imprimindo-pagina')
  let feito = false
  const limpar = () => {
    if (feito) return
    feito = true
    document.body.classList.remove('imprimindo-pagina')
    if (antes) raiz.setAttribute('data-theme', antes)
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  window.print()
  /* navegador que nao dispara afterprint nao pode deixar a tela presa no claro */
  setTimeout(limpar, 4000)
}
