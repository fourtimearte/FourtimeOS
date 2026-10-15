/* ==========================================================================
   OS ARQUIVOS DO WHATSAPP DE DENTRO (0.6.3, 15/10/2026).

   O defeito, nas palavras do Henrique: "ele nao carrega PDF na tela, se no
   chat alguem me enviar um PDF e eu clicar nele ele nao abre no visualizador,
   fica dando carregar para sempre; e ao fazer download ele so faz em um PDF,
   se tiver varios, assim que tento fazer o download do segundo ele nao baixa,
   ai eu tenho que recarregar a pagina".

   POR QUE: dentro do Fourtime OS o WhatsApp vive num iframe de outro site. O
   WhatsApp entrega o arquivo como um endereco blob: criado DENTRO do iframe,
   e o Chrome separa esses enderecos por site de cima (particao): a aba nova
   que o WhatsApp abre para o PDF nao enxerga o blob e fica carregando para
   sempre. E o download sem gesto dentro de um iframe de outro site e barrado
   depois do primeiro, sem o aviso de "baixar varios arquivos" aparecer.

   O CONSERTO: este arquivo roda no MUNDO DA PAGINA do WhatsApp, so quando ele
   esta dentro do Fourtime OS, e pega os tres jeitos de o WhatsApp entregar um
   arquivo: window.open de um blob (abrir), o clique num link com download
   (baixar) e o clique num link blob com alvo novo (abrir). Le o arquivo aqui
   dentro, onde o blob existe, e manda os bytes para a pagina do Fourtime OS,
   que abre o PDF no proprio visor e baixa pela pagina de cima, onde o Chrome
   deixa e pergunta quando precisa.

   No WhatsApp aberto numa aba sozinho nada muda.
   ========================================================================== */
;(() => {
  if (window.top === window) return
  const SISTEMAS = [
    'https://fourtimeos.arte-adc.workers.dev',
    'http://127.0.0.1',
    'http://localhost',
  ]
  const pai = (location.ancestorOrigins && location.ancestorOrigins[0]) || ''
  const doSistema = SISTEMAS.some((s) => pai === s || pai.startsWith(s + ':'))
  if (!doSistema) return

  /* O DIARIO (0.6.4, 15/10/2026): o PDF continuava girando dentro do
     WhatsApp, e o defeito nao aparece em teste. Anota o que o WhatsApp faz
     quando a pessoa abre um arquivo: elementos que carregam algo (iframe,
     embed, object, img, video), workers, o service worker, os erros e as
     respostas que falharam. SO O ESQUELETO: a etiqueta, o esquema e o
     comeco do endereco, nunca texto de conversa. A pagina do Fourtime OS
     guarda em window.__ftWhatsAppDiario. */
  const anotar = (oque, extra) => {
    try {
      window.parent.postMessage({ fourtime: 'whatsapp', tipo: 'diario', oque: String(oque).slice(0, 60), extra: extra || {} }, pai)
    } catch (e) { /* o diario nunca quebra o WhatsApp */ }
  }
  const curto = (u) => {
    const t = String(u || '')
    if (/^blob:/i.test(t)) return 'blob:' + t.replace(/^blob:/i, '').split('/').slice(0, 3).join('/') + '/...'
    if (/^data:/i.test(t)) return t.slice(0, 30)
    try { const x = new URL(t, location.href); return x.protocol + '//' + x.host + x.pathname.slice(0, 40) } catch (e) { return t.slice(0, 40) }
  }
  try {
    const sw = navigator.serviceWorker
    anotar('inicio', { sw: !!sw, controlado: !!(sw && sw.controller), versao: '0.6.4' })
    if (sw) sw.addEventListener('controllerchange', () => anotar('sw-trocou', {}))
  } catch (e) { anotar('sw-erro', { m: String(e).slice(0, 80) }) }
  const olharEl = (el, como) => {
    if (!el || !el.tagName) return
    const tag = el.tagName.toLowerCase()
    if (!['iframe', 'embed', 'object', 'video', 'img', 'canvas'].includes(tag)) return
    const src = el.getAttribute('src') || el.getAttribute('data') || ''
    if (tag === 'img' && !/^blob:/i.test(src)) return
    if (tag === 'canvas') { if (el.width > 300 && el.height > 300) anotar('canvas-grande', { como, w: el.width, h: el.height }); return }
    anotar('elemento', { como, tag, src: curto(src), tipo: el.getAttribute('type') || '' })
  }
  try {
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'attributes') olharEl(m.target, 'mudou-' + m.attributeName)
        else m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return
          olharEl(n, 'entrou')
          if (n.querySelectorAll) n.querySelectorAll('iframe,embed,object,video,canvas').forEach((x) => olharEl(x, 'entrou-dentro'))
        })
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data'] })
  } catch (e) { anotar('observador-erro', { m: String(e).slice(0, 80) }) }
  try {
    for (const nome of ['Worker', 'SharedWorker']) {
      const Orig = window[nome]
      if (!Orig) continue
      window[nome] = function (url, ...resto) {
        anotar('worker', { nome, url: curto(url) })
        try { return new Orig(url, ...resto) } catch (e) { anotar('worker-erro', { nome, m: String(e && e.message || e).slice(0, 120) }); throw e }
      }
      window[nome].prototype = Orig.prototype
    }
  } catch (e) { /* segue */ }
  try {
    const fetchOrig = window.fetch
    window.fetch = function (rec, ...resto) {
      const u = typeof rec === 'string' ? rec : (rec && rec.url) || ''
      const p = fetchOrig.call(this, rec, ...resto)
      if (/pdf|document|blob:|\/stream|mms|media/i.test(u)) {
        p.then((r) => anotar('fetch', { url: curto(u), status: r.status, tipo: (r.headers.get('content-type') || '').slice(0, 40) }),
               (e) => anotar('fetch-falhou', { url: curto(u), m: String(e && e.message || e).slice(0, 100) }))
      }
      return p
    }
  } catch (e) { /* segue */ }
  window.addEventListener('error', (e) => anotar('erro', { m: String(e.message || '').slice(0, 140), arq: curto(e.filename) }), true)
  window.addEventListener('unhandledrejection', (e) => anotar('promessa', { m: String(e.reason && (e.reason.message || e.reason) || '').slice(0, 140) }))
  window.addEventListener('securitypolicyviolation', (e) => anotar('csp', { dir: e.violatedDirective, url: curto(e.blockedURI) }))
  window.addEventListener('pointerdown', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-icon],[role="button"],a,button') : null
    if (t) anotar('clique', { tag: t.tagName.toLowerCase(), icone: t.getAttribute('data-icon') || '', role: t.getAttribute('role') || '' })
  }, true)

  /* o nome do arquivo: o do link, ou o texto "algo.pdf" perto do ultimo clique */
  let ultimoAlvo = null
  window.addEventListener('pointerdown', (e) => { ultimoAlvo = e.target }, true)
  const NOME = /[^\n/\\]{1,120}\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|cdr|ai|psd|png|jpe?g)(?![a-z0-9])/i
  const nomePerto = () => {
    let el = ultimoAlvo && ultimoAlvo.nodeType === 1 ? ultimoAlvo : ultimoAlvo && ultimoAlvo.parentElement
    for (let i = 0; el && i < 12; i++, el = el.parentElement) {
      /* texto por texto, porque o nome e o resto do balao vem colados no innerText */
      const passeio = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = passeio.nextNode(), k = 0; n && k < 200; n = passeio.nextNode(), k++) {
        const m = (n.nodeValue || '').match(NOME)
        if (m) return m[0].trim()
      }
      const titulo = el.getAttribute && (el.getAttribute('title') || el.getAttribute('aria-label') || '')
      const mt = titulo && titulo.match(NOME)
      if (mt) return mt[0].trim()
    }
    return ''
  }

  const entregar = async (endereco, acao, nome) => {
    try {
      const resposta = await fetch(endereco)
      const dados = await resposta.arrayBuffer()
      const mime = resposta.headers.get('content-type') || ''
      window.parent.postMessage(
        { fourtime: 'whatsapp', tipo: 'arquivo', acao, nome: nome || nomePerto() || 'arquivo', mime, dados },
        pai,
        [dados],
      )
    } catch (e) {
      window.parent.postMessage(
        { fourtime: 'whatsapp', tipo: 'erro', versao: '0.6.3', onde: 'arquivos', oque: 'nao li o arquivo: ' + String(e && e.message || e) },
        pai,
      )
    }
  }

  const ehBlob = (u) => typeof u === 'string' && /^blob:/i.test(u)

  /* 1. window.open(blob): abrir. Tambem o jeito de abrir em branco e depois
     mandar a janela para o blob. */
  const abrirOriginal = window.open
  window.open = function (url, ...resto) {
    const u = url == null ? '' : String(url)
    anotar('window-open', { url: curto(u) })
    if (ehBlob(u)) {
      void entregar(u, 'abrir', '')
      return null
    }
    if (u === '' || u === 'about:blank') {
      let real = null
      const pegar = (destino) => {
        const d = String(destino || '')
        if (ehBlob(d)) void entregar(d, 'abrir', '')
        else {
          real = real || abrirOriginal.call(window, d, ...resto)
        }
      }
      const lugar = { assign: pegar, replace: pegar, set href(v) { pegar(v) }, get href() { return 'about:blank' } }
      return new Proxy({ closed: false, close() {}, focus() {}, blur() {}, opener: null, document: { write() {}, close() {}, title: '' } }, {
        get(alvo, p) { return p === 'location' ? lugar : alvo[p] },
        set(alvo, p, v) { if (p === 'location') pegar(v); else alvo[p] = v; return true },
      })
    }
    return abrirOriginal.call(window, url, ...resto)
  }

  /* 2 e 3. o link blob: com download, baixar; com alvo novo, abrir */
  const doLink = (a) => {
    if (a && a.href) anotar('link', { url: curto(a.href), download: a.hasAttribute('download'), alvo: a.target || '' })
    if (!a || !ehBlob(a.href)) return false
    if (a.hasAttribute('download')) { void entregar(a.href, 'baixar', a.getAttribute('download') || ''); return true }
    if ((a.target || '').toLowerCase() === '_blank') { void entregar(a.href, 'abrir', ''); return true }
    return false
  }
  const cliqueOriginal = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (doLink(this)) return
    return cliqueOriginal.call(this)
  }
  const disparoOriginal = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && doLink(this)) return false
    return disparoOriginal.call(this, ev)
  }
  /* o clique de verdade num link blob que esteja na tela */
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="blob:"]') : null
    if (a && doLink(a)) { e.preventDefault(); e.stopPropagation() }
  }, true)
})()
