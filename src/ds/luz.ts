/* A luz que segue o ponteiro.

   UM OUVINTE NO DOCUMENTO INTEIRO, e nao um por cartao. Uma tela de kanban
   cheia tem facil sessenta cartoes: sessenta ouvintes de pointermove seriam
   sessenta funcoes chamadas a cada movimento do mouse. Aqui e sempre uma so,
   que pergunta qual cartao esta embaixo do ponteiro e escreve duas variaveis
   nele.

   O trabalho por quadro e escrever --px e --py num elemento. Quem desenha e o
   CSS, em base.css. Nada de canvas, nada de filtro, nada de calculo de cor
   aqui dentro.

   Desliga sozinho em dois casos: quando nao existe ponteiro, que e o celular
   e o tablet do galpao, e quando a pessoa pediu menos movimento no sistema
   operacional. Nos dois a tela continua correta, so sem a luz. */

const ALVOS = '.cartao, .kpi, .luz'

export function ligarLuz(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  if (!window.matchMedia('(hover: hover)').matches) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  let pedido = 0
  let alvo: HTMLElement | null = null
  let x = 0
  let y = 0

  /* Escrever no meio do pointermove e escrever varias vezes no mesmo quadro
     de tela, de graca. Guardamos a ultima posicao e pintamos uma vez so. */
  function pintar() {
    pedido = 0
    if (!alvo) return
    alvo.style.setProperty('--px', x + 'px')
    alvo.style.setProperty('--py', y + 'px')
  }

  function aoMover(ev: PointerEvent) {
    const de = ev.target as Element | null
    const achado = de && typeof de.closest === 'function' ? de.closest(ALVOS) : null
    if (!(achado instanceof HTMLElement)) {
      alvo = null
      return
    }
    const caixa = achado.getBoundingClientRect()
    alvo = achado
    x = Math.round(ev.clientX - caixa.left)
    y = Math.round(ev.clientY - caixa.top)
    if (!pedido) pedido = requestAnimationFrame(pintar)
  }

  document.addEventListener('pointermove', aoMover, { passive: true })
  return () => {
    document.removeEventListener('pointermove', aoMover)
    if (pedido) cancelAnimationFrame(pedido)
  }
}
