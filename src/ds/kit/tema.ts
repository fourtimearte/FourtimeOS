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
