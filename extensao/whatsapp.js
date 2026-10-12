/* ==========================================================================
   A extensao dentro do WhatsApp Web (0.3.0).

   DOIS LUGARES, O MESMO TRABALHO:
     - DENTRO DO FOURTIME OS (pranchas 131 a 133): o WhatsApp Web aberto num
       quadro da pagina Funil e WhatsApp. Conversa com a pagina por mensagem
       entre janelas, e SO com o endereco do Fourtime OS.
     - NA ABA COMUM DO WHATSAPP: a coluna lateral do Chrome (prancha 129),
       pelo fundo da extensao.
   Em quadro de qualquer outro site, nada.

   O que ela faz, e nada alem disso:
     1. a cara do Fourtime OS (whatsapp.css): dentro, nas cores do tema que
        a pagina manda (Gelo ou Grafite);
     2. conta QUAL conversa esta aberta: so o telefone dela, lido do
        identificador das mensagens. Nao le texto nenhum;
     3. troca de conversa quando o Fourtime OS pede, sem recarregar se o
        WhatsApp aceitar.
   O registro das mensagens no lead e a W3.
   ========================================================================== */
;(() => {
  const SISTEMA = [
    'https://fourtimeos.arte-adc.workers.dev',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]
  const dentro = window.top !== window
  const pai = dentro ? (location.ancestorOrigins && location.ancestorOrigins[0]) || '' : ''
  if (dentro && !SISTEMA.includes(pai)) return

  /* --- a letra do Fourtime OS: o WhatsApp deixa carregar do Google Fonts --- */
  const fonte = () => {
    if (document.getElementById('fourtime-fonte')) return
    const l = document.createElement('link')
    l.id = 'fourtime-fonte'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap'
    ;(document.head || document.documentElement).appendChild(l)
  }
  document.documentElement.classList.add('fourtime-os')
  if (dentro) document.documentElement.classList.add('fourtime-dentro')
  if (document.head) fonte()
  else document.addEventListener('DOMContentLoaded', fonte, { once: true })

  /* para a pagina do Fourtime OS (quando dentro) ou para o fundo (aba comum) */
  function contar(dados) {
    if (dentro) parent.postMessage({ fourtime: 'whatsapp', ...dados }, pai)
    else chrome.runtime.sendMessage(dados).catch(() => {})
  }
  if (dentro) {
    const pronto = () => contar({ tipo: 'pronto', versao: chrome.runtime.getManifest().version })
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pronto, { once: true })
    else pronto()
  }

  /* --- qual conversa esta aberta ---------------------------------------
     Cada mensagem da conversa aberta carrega um identificador como
     "false_5562999990001@c.us_3EB0...". O pedaco do meio e a conversa. Grupo
     termina em @g.us e fica de fora. Conversa que o WhatsApp identifica por
     @lid nao traz o numero: ai tenta o titulo do topo, que mostra o numero
     quando o contato nao esta salvo. */
  function conversaAberta() {
    const main = document.querySelector('#main')
    if (!main) return { jid: '', telefone: '' }
    let jid = ''
    for (const el of main.querySelectorAll('[data-id]')) {
      const m = /^(?:true|false)_([^_]+@(?:c\.us|s\.whatsapp\.net|lid|g\.us))_/.exec(el.getAttribute('data-id') || '')
      if (m) {
        jid = m[1]
        break
      }
    }
    let telefone = ''
    const pelaId = /^(\d{10,15})@(?:c\.us|s\.whatsapp\.net)$/.exec(jid)
    if (pelaId) telefone = pelaId[1]
    else if (!jid.endsWith('@g.us')) {
      const titulo = main.querySelector('header span[title], header [dir="auto"]')
      const t = (titulo && (titulo.getAttribute('title') || titulo.textContent)) || ''
      const digitos = t.replace(/\D/g, '')
      if (/^\+?[\d\s()-]{10,}$/.test(t.trim()) && digitos.length >= 10) telefone = digitos
    }
    return { jid, telefone }
  }

  let ultima = ''
  let marcado = 0
  function olhar() {
    marcado = 0
    const c = conversaAberta()
    const chave = c.jid + '|' + c.telefone
    if (chave === ultima) return
    ultima = chave
    contar({ tipo: 'conversa', ...c })
  }
  new MutationObserver(() => {
    if (!marcado) marcado = setTimeout(olhar, 400)
  }).observe(document.documentElement, { childList: true, subtree: true })

  /* --- trocar de conversa ----------------------------------------------
     Um link wa.me clicado DENTRO do WhatsApp, como um link recebido numa
     conversa. Se o WhatsApp pegar o clique, abre a conversa ali mesmo, sem
     recarregar. O vigia fica na janela, o ultimo a ver o clique: se o
     WhatsApp nao pegou, o vigia impede a navegacao e devolve "nao". */
  function trocarDeConversa(n, texto) {
    const a = document.createElement('a')
    a.href = 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '')
    a.style.display = 'none'
    let pegou = false
    const vigia = (ev) => {
      if (ev.target !== a) return
      pegou = ev.defaultPrevented
      if (!pegou) ev.preventDefault()
    }
    window.addEventListener('click', vigia)
    ;(document.querySelector('#app') || document.body).appendChild(a)
    a.click()
    window.removeEventListener('click', vigia)
    a.remove()
    return pegou
  }
  const numero = (t) => {
    const n = String(t || '').replace(/\D/g, '')
    return /^\d{12,13}$/.test(n) ? n : ''
  }

  if (dentro) {
    /* o pedido vem da pagina do Fourtime OS, e de mais ninguem */
    window.addEventListener('message', (e) => {
      if (e.origin !== pai || e.source !== parent) return
      const d = e.data
      if (!d || d.fourtime !== 'pedido') return
      /* o tema do Fourtime OS (Gelo ou Grafite): as cores do whatsapp.css */
      if (d.tipo === 'tema') {
        const escuro = d.tema === 'dark'
        document.documentElement.classList.toggle('fourtime-escuro', escuro)
        document.documentElement.classList.toggle('fourtime-claro', !escuro)
        return
      }
      if (d.tipo !== 'abrir') return
      const n = numero(d.telefone)
      if (!n) return
      const texto = String(d.texto || '')
      if (trocarDeConversa(n, texto)) return contar({ tipo: 'abriu', jeito: 'sem-recarregar', telefone: n })
      /* o WhatsApp nao pegou: vai pelo endereco, que recarrega o quadro mas chega */
      contar({ tipo: 'abriu', jeito: 'recarregando', telefone: n })
      location.href = '/send?phone=' + n + (texto ? '&text=' + encodeURIComponent(texto) : '')
    })
  } else {
    chrome.runtime.onMessage.addListener((m, _quem, responder) => {
      if (!m || m.tipo !== 'abrir') return
      const n = numero(m.telefone)
      responder({ ok: n ? trocarDeConversa(n, String(m.texto || '')) : false })
    })
  }
})()
