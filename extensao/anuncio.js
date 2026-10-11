/* ==========================================================================
   A extensao dentro do Fourtime OS.

   1. AVISA QUE ESTA AQUI. Uma pagina nao enxerga extensao nenhuma; quem avisa
      e a propria extensao, marcando a versao na raiz da pagina antes de o
      sistema carregar. O sistema le essa marca para trocar o "abrir uma aba
      nova do WhatsApp" por "trocar de conversa na aba que ja esta aberta".

   2. LEVA O PEDIDO DE ABRIR UMA CONVERSA. O sistema manda uma mensagem para a
      propria janela; este arquivo pega e entrega ao fundo da extensao, que
      acha a aba do WhatsApp. So aceita mensagem da propria pagina.
   ========================================================================== */
document.documentElement.dataset.fourtimeExtensao = chrome.runtime.getManifest().version

/* 3. AVISA O FUNDO QUE ESTA ABA E O FOURTIME OS. O fundo libera o WhatsApp
      dentro dos quadros DESTA aba (inclusive quando o proprio WhatsApp troca
      de endereco dentro do quadro, o que a regra fixa nao cobre). */
chrome.runtime.sendMessage({ tipo: 'sou-o-sistema' }).catch(() => {})

window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== location.origin) return
  const d = e.data
  if (!d || d.fourtime !== 'abrir-whatsapp') return
  const telefone = String(d.telefone || '').replace(/\D/g, '')
  if (!/^\d{12,13}$/.test(telefone)) return
  chrome.runtime.sendMessage({ tipo: 'abrir', telefone, texto: String(d.texto || '') })
})
