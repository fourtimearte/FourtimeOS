/* ==========================================================================
   O fundo da extensao: o carteiro entre o Fourtime OS, o WhatsApp Web e a
   coluna lateral.

   A COLUNA SO EXISTE NA ABA DO WHATSAPP. Em qualquer outra aba o painel
   lateral fica desligado, para a extensao nao aparecer onde nao tem o que
   mostrar.
   ========================================================================== */
const WHATSAPP = 'https://web.whatsapp.com/'

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

async function ajustarPainel(tabId, url) {
  const noWhatsApp = typeof url === 'string' && url.startsWith(WHATSAPP)
  await chrome.sidePanel
    .setOptions({ tabId, path: 'lado.html', enabled: noWhatsApp })
    .catch(() => {})
}

chrome.tabs.onUpdated.addListener((tabId, mudou, tab) => {
  if (mudou.url || mudou.status === 'complete') void ajustarPainel(tabId, tab.url)
})
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (tab) void ajustarPainel(tabId, tab.url)
})

chrome.runtime.onMessage.addListener((m, quem) => {
  /* o WhatsApp contou qual conversa esta aberta: a coluna escuta o storage */
  if (m && m.tipo === 'conversa' && quem.tab) {
    chrome.storage.session.set({ conversa: { jid: m.jid || '', telefone: m.telefone || '', em: Date.now() } })
    return
  }
  /* o Fourtime OS pediu para abrir uma conversa */
  if (m && m.tipo === 'abrir') void abrir(m.telefone, m.texto)
})

/* ACHA A ABA DO WHATSAPP E TROCA A CONVERSA LA DENTRO. Sem aba aberta, abre
   uma; com aba aberta, traz ela para a frente e pede ao whatsapp.js para
   trocar de conversa sem recarregar. */
async function abrir(telefone, texto) {
  const [aba] = await chrome.tabs.query({ url: WHATSAPP + '*' })
  const endereco = WHATSAPP + 'send?phone=' + telefone + (texto ? '&text=' + encodeURIComponent(texto) : '')
  if (!aba) {
    await chrome.tabs.create({ url: endereco })
    return
  }
  await chrome.tabs.update(aba.id, { active: true })
  await chrome.windows.update(aba.windowId, { focused: true }).catch(() => {})
  const r = await chrome.tabs.sendMessage(aba.id, { tipo: 'abrir', telefone, texto }).catch(() => null)
  /* o whatsapp.js nao respondeu (aba carregando, ou ainda sem a extensao):
     vai pelo endereco, que recarrega mas chega */
  if (!r || !r.ok) await chrome.tabs.update(aba.id, { url: endereco })
}
