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

/* ==========================================================================
   O WHATSAPP DENTRO DAS ABAS DO FOURTIME OS.

   O WhatsApp Web recusa ser aberto num quadro de tres formas: manda
   X-Frame-Options: DENY e Content-Security-Policy com frame-ancestors (o
   navegador recusa: "a conexao foi recusada"), e, quando o pedido diz que e
   de um quadro (Sec-Fetch-Dest: iframe), o servidor dele responde 400 com
   "Sorry, something went wrong". O cabecalho de CSP nao da para editar, so
   tirar inteiro: dentro do quadro do Fourtime OS o WhatsApp roda sem a CSP
   dele (decisao do Henrique, 12/10/2026; a aba comum do WhatsApp nao muda). A regra fixa (regras.json) cuida da
   primeira carga, quando quem pede e o Fourtime OS. Esta regra por aba cuida
   do resto: toda troca de endereco do WhatsApp DENTRO do quadro (quem pede
   ai e o proprio WhatsApp). Vale so para abas que se anunciaram como o
   Fourtime OS (anuncio.js), e sai quando a aba fecha ou vai para outro site.
   ========================================================================== */
const SISTEMA = /^(https:\/\/fourtimeos\.arte-adc\.workers\.dev|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)\//

async function liberarNaAba(tabId) {
  await chrome.declarativeNetRequest
    .updateSessionRules({
      removeRuleIds: [tabId],
      addRules: [
        {
          id: tabId,
          priority: 2,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [
              { header: 'x-frame-options', operation: 'remove' },
              { header: 'content-security-policy', operation: 'remove' },
            ],
            requestHeaders: [{ header: 'sec-fetch-dest', operation: 'set', value: 'document' }],
          },
          condition: { urlFilter: '||web.whatsapp.com/', resourceTypes: ['sub_frame'], tabIds: [tabId] },
        },
      ],
    })
    .catch(() => {})
}
const tirarDaAba = (tabId) => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {})

chrome.tabs.onRemoved.addListener((tabId) => void tirarDaAba(tabId))
chrome.tabs.onUpdated.addListener((tabId, mudou) => {
  if (mudou.url && !SISTEMA.test(mudou.url)) void tirarDaAba(tabId)
})

chrome.runtime.onMessage.addListener((m, quem) => {
  /* uma aba do Fourtime OS se anunciou: so vale se o endereco dela confere */
  if (m && m.tipo === 'sou-o-sistema' && quem.tab && SISTEMA.test(quem.tab.url || '')) {
    void liberarNaAba(quem.tab.id)
    return
  }
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
