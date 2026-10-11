/* ==========================================================================
   A extensao dentro do WhatsApp Web (prova, 0.1.0).

   SO A ABA PRINCIPAL. Se o WhatsApp estiver dentro de outra pagina, nada.

   O QUE ELA FAZ NA PROVA, e nada alem disso:
     1. a cara do Fourtime OS (whatsapp.css);
     2. conta para a coluna lateral QUAL conversa esta aberta: so o telefone
        dela, lido do identificador das mensagens. Nao le texto nenhum;
     3. troca de conversa quando o Fourtime OS pede, sem recarregar se o
        WhatsApp aceitar, e responde se conseguiu.
   O registro das mensagens no lead e a W3, depois da prova.
   ========================================================================== */
;(() => {
  if (window.top !== window) return

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
  if (document.head) fonte()
  else document.addEventListener('DOMContentLoaded', fonte, { once: true })

  /* --- qual conversa esta aberta ---------------------------------------
     Cada mensagem da conversa aberta carrega um identificador como
     "false_5562999990001@c.us_3EB0...". O pedaco do meio e a conversa. Grupo
     termina em @g.us e fica de fora. Conversa que o WhatsApp identifica por
     @lid nao traz o numero: ai a coluna tenta o titulo do topo, que mostra o
     numero quando o contato nao esta salvo. */
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
    chrome.runtime.sendMessage({ tipo: 'conversa', ...c }).catch(() => {})
  }
  new MutationObserver(() => {
    if (!marcado) marcado = setTimeout(olhar, 400)
  }).observe(document.documentElement, { childList: true, subtree: true })

  /* --- trocar de conversa a pedido do Fourtime OS ----------------------
     Um link wa.me clicado DENTRO do WhatsApp, como um link recebido numa
     conversa. Se o WhatsApp pegar o clique, ele abre a conversa ali mesmo,
     sem recarregar. O vigia fica na janela, o ultimo a ver o clique: se o
     WhatsApp nao pegou, o vigia impede a navegacao e responde "nao", e o
     fundo da extensao vai pelo endereco (que recarrega, mas chega). */
  chrome.runtime.onMessage.addListener((m, _quem, responder) => {
    if (!m || m.tipo !== 'abrir') return
    const n = String(m.telefone || '').replace(/\D/g, '')
    if (!/^\d{12,13}$/.test(n)) {
      responder({ ok: false })
      return
    }
    const a = document.createElement('a')
    a.href = 'https://wa.me/' + n + (m.texto ? '?text=' + encodeURIComponent(m.texto) : '')
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
    responder({ ok: pegou })
  })
})()
