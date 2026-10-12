/* ==========================================================================
   O WHATSAPP NAO ROUBA O FOCO DO SISTEMA (0.4.3).

   Dentro do Fourtime OS o WhatsApp vive num iframe, e ele devolve o foco para
   o proprio campo de escrever quando o perde: a pessoa clica no Titulo de uma
   mensagem rapida, no painel ao lado, e o que ela digita vai parar na
   conversa. Este arquivo roda no MUNDO DA PAGINA do WhatsApp (o whatsapp.js
   roda isolado e nao alcanca o focus() dele) e so faz uma coisa: enquanto o
   foco esta FORA do iframe, um focus() pedido pelo codigo do WhatsApp nao
   acontece. Quando a pessoa clica dentro dele, tudo volta ao normal.

   O focus() do whatsapp.js (escrever uma mensagem pedida pelo sistema) mora
   no mundo isolado, com o proprio prototipo, e por isso nao passa por aqui.
   Fora do iframe (o WhatsApp numa aba sozinho) nada muda.
   ========================================================================== */
;(() => {
  if (window.top === window) return
  let fora = false
  const naoPode = () => fora || !document.hasFocus()
  window.addEventListener('blur', () => { fora = true }, true)
  window.addEventListener('focus', () => { fora = false }, true)
  // A pessoa voltou para o WhatsApp: o clique ou a tecla chegam antes do focus.
  for (const tipo of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    window.addEventListener(tipo, () => { fora = false }, true)
  }

  const original = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function (...args) {
    if (naoPode()) return
    return original.apply(this, args)
  }
  const originalSvg = SVGElement.prototype.focus
  if (originalSvg) {
    SVGElement.prototype.focus = function (...args) {
      if (naoPode()) return
      return originalSvg.apply(this, args)
    }
  }
  const janela = window.focus
  window.focus = function () {
    if (naoPode()) return
    return janela.call(window)
  }
})()
