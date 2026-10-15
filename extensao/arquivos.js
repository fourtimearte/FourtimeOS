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
