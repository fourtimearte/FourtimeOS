/* ==========================================================================
   O fundo da extensao: o carteiro entre o Fourtime OS, o WhatsApp Web e a
   coluna lateral.

   A COLUNA SO EXISTE NA ABA DO WHATSAPP. Em qualquer outra aba o painel
   lateral fica desligado, para a extensao nao aparecer onde nao tem o que
   mostrar.
   ========================================================================== */
const WHATSAPP = 'https://web.whatsapp.com/'
/* o endereco do banco e a chave publicavel (config.js, escrito pelo
   empacotar.sh); sem ele o fundo so nao grava os erros da aba comum */
try {
  importScripts('config.js')
} catch {
  /* pacote sem config.js */
}
const CFG = self.FOURTIME || {}

chrome.runtime.onInstalled.addListener((d) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
  if (d.reason === 'update') void religarAsAbas()
})

/* ==========================================================================
   A ATUALIZACAO SOZINHA (0.5.0, 13/10/2026; a conferencia e da 0.6.0).

   No computador do Henrique a extensao e carregada SEM COMPACTACAO de uma
   pasta (D:\CLAUDE\extensao fourtime os), e o Claude grava a versao nova
   direto nessa pasta. Extensao sem compactacao le os arquivos do disco, mas
   so troca o codigo que esta rodando quando alguem aperta "Recarregar" em
   chrome://extensions. Este relogio faz isso sozinho: a cada 30 segundos le
   o manifest.json DO DISCO e, se a versao escrita la nao e a que esta
   rodando, recarrega a extensao.

   Instalada pela loja (ou de um zip que ninguem mexe), o manifest do disco e
   sempre o mesmo, e o relogio nunca faz nada.
   ========================================================================== */
chrome.alarms.create('procurar-versao-nova', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'procurar-versao-nova') void procurarVersaoNova()
})

/* A CONFERENCIA (0.6.0, 13/10/2026). A pasta pode ser do Google Drive, que
   baixa os arquivos um a um e em qualquer ordem: recarregar so porque o
   manifest.json mudou pegaria a versao nova pela metade. O pacote leva o
   versao.json, gravado POR ULTIMO, com a impressao (SHA-256) de cada arquivo.
   A extensao so recarrega quando o versao.json diz outra versao E todo
   arquivo da lista ja chegou com a impressao certa. Pasta sem versao.json (a
   0.5.x) cai no jeito antigo: o manifest. */
const lerDoDisco = (nome) => fetch(chrome.runtime.getURL(nome) + '?t=' + Date.now(), { cache: 'no-store' })
const hexa = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function procurarVersaoNova() {
  const rodando = chrome.runtime.getManifest().version
  let conferencia = null
  try {
    conferencia = await (await lerDoDisco('versao.json')).json()
  } catch {
    conferencia = null
  }
  try {
    if (!conferencia || !conferencia.versao || !conferencia.arquivos) {
      const noDisco = (await (await lerDoDisco('manifest.json')).json()).version
      if (noDisco && noDisco !== rodando) chrome.runtime.reload()
      return
    }
    if (conferencia.versao === rodando) return
    for (const [nome, impressao] of Object.entries(conferencia.arquivos)) {
      const conteudo = await (await lerDoDisco(nome)).arrayBuffer()
      if (hexa(await crypto.subtle.digest('SHA-256', conteudo)) !== impressao) return /* ainda chegando */
    }
    const manifest = await (await lerDoDisco('manifest.json')).json()
    if (manifest.version === conferencia.versao) chrome.runtime.reload()
  } catch {
    /* arquivo pela metade ou ainda sem existir: tenta no proximo relogio */
  }
}

/* DEPOIS DE RECARREGAR, AS ABAS ABERTAS CONTINUAM COM O CODIGO VELHO, que
   perdeu a ligacao com a extensao. As do Fourtime OS ganham o anuncio.js
   novo (ele so marca a versao e avisa o fundo, pode rodar de novo sem
   estrago). O WhatsApp, que tem o tema e o envio das mensagens rapidas, e
   recarregado: dentro do Fourtime OS so o quadro dele recarrega, e a pagina
   do sistema fica como estava. */
async function religarAsAbas() {
  const sistema = await chrome.tabs.query({}).catch(() => [])
  for (const aba of sistema) {
    if (!aba.id || !aba.url) continue
    if (SISTEMA.test(aba.url)) {
      await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['anuncio.js'] }).catch(() => {})
      await chrome.scripting
        .executeScript({
          target: { tabId: aba.id, allFrames: true },
          func: () => {
            if (location.hostname === 'web.whatsapp.com') location.reload()
          },
        })
        .catch(() => {})
    } else if (aba.url.startsWith(WHATSAPP)) {
      await chrome.tabs.reload(aba.id).catch(() => {})
    }
  }
}

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
  /* o WhatsApp da aba comum nao achou o que procura (0.6.0): grava com a
     entrada da coluna, se houver. Dentro do Fourtime OS quem grava e a pagina */
  if (m && m.tipo === 'erro' && quem.tab) void gravarErro(m)
})

/* --- o erro da aba comum, gravado com a entrada da coluna (lado.js) ------- */
async function entradaDaColuna() {
  const { sessao: s } = await chrome.storage.local.get('sessao')
  if (!s || !CFG.supabase) return null
  if (Date.now() < s.venceEm - 60_000) return s
  const r = await fetch(`${CFG.supabase}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: CFG.chave, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.renovacao }),
  }).catch(() => null)
  const d = r && r.ok ? await r.json().catch(() => null) : null
  if (!d || !d.access_token) return null
  const nova = { ...s, acesso: d.access_token, renovacao: d.refresh_token, venceEm: Date.now() + (d.expires_in || 3600) * 1000 }
  await chrome.storage.local.set({ sessao: nova })
  return nova
}

async function gravarErro(m) {
  const s = await entradaDaColuna().catch(() => null)
  if (!s) return
  await fetch(`${CFG.supabase}/rest/v1/rpc/registrar_erro_da_extensao`, {
    method: 'POST',
    headers: { apikey: CFG.chave, authorization: 'Bearer ' + s.acesso, 'content-type': 'application/json' },
    body: JSON.stringify({ p_versao: String(m.versao || ''), p_onde: String(m.onde || ''), p_o_que: String(m.oque || ''), p_estrutura: m.estrutura || null }),
  }).catch(() => {})
}

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
