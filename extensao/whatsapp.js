/* ==========================================================================
   A extensao dentro do WhatsApp Web (0.6.0).

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
        WhatsApp aceitar;
     4. (0.4.0) a MENSAGEM RAPIDA: escreve o texto no campo da conversa
        aberta e, quando pedem, aperta o enviar do WhatsApp. So na conversa
        do telefone que a pagina disse: se a conversa aberta for outra,
        nao escreve nada (mandar para a pessoa errada e o pior erro daqui).
     5. (0.6.0) O VIGIA: quando nao acha o que procura (o campo de escrever,
        o botao de enviar, a identidade da conversa), conta o erro com o
        esqueleto da pagina em volta: so etiquetas e marcadores do proprio
        WhatsApp, NENHUM texto, nome ou numero. A pagina (ou o fundo) grava.
     6. (0.6.0) O REGISTRO NO LEAD (W3): quando a PAGINA do Fourtime OS pede,
        e so para a conversa que ela disse (a de um lead do funil), le as
        mensagens que estao na tela: quem mandou, a hora, o texto, e de foto,
        audio, video e documento so o fato. Conversa que nao e de lead a
        pagina nem pede, e a extensao nem le.
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
  const RE_ID = /^(true|false)_([^_]+@(?:c\.us|s\.whatsapp\.net|lid|g\.us))_(.+)$/
  function conversaAberta() {
    const main = document.querySelector('#main')
    if (!main) return { jid: '', telefone: '', nome: '', aberta: false }
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
    /* o nome que o topo da conversa mostra (o contato salvo), para a mensagem
       rapida preencher o {nome} quando a conversa nao e de um lead */
    const topo = main.querySelector('header span[title], header [dir="auto"]')
    const nomeDoTopo = ((topo && (topo.getAttribute('title') || topo.textContent)) || '').trim()
    const nome = /^\+?[\d\s()-]+$/.test(nomeDoTopo) ? '' : nomeDoTopo.slice(0, 80)
    return { jid, telefone, nome, aberta: !!main.querySelector('footer') }
  }

  let ultima = ''
  let marcado = 0
  function olhar() {
    marcado = 0
    const c = conversaAberta()
    const chave = c.jid + '|' + c.telefone + '|' + c.nome + '|' + c.aberta
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

  /* --- o tema do Fourtime OS dentro do WhatsApp ------------------------
     As variaveis novas (--WDS-*) o whatsapp.css troca pela classe no html.
     As antigas o WhatsApp troca pela classe "dark" do body, e o texto do
     campo de escrever ainda usa uma delas: com o WhatsApp do vendedor em
     escuro e o Fourtime OS em Gelo, ele saia branco no branco (12/10/2026).
     Entao o body segue o tema da pagina, e volta a seguir se o WhatsApp
     mexer nele de novo. */
  let temaDaPagina = ''
  function aplicarTema() {
    if (!temaDaPagina) return
    const escuro = temaDaPagina === 'escuro'
    document.documentElement.classList.toggle('fourtime-escuro', escuro)
    document.documentElement.classList.toggle('fourtime-claro', !escuro)
    const b = document.body
    if (b && b.classList.contains('dark') !== escuro) b.classList.toggle('dark', escuro)
  }
  if (dentro) {
    const vigiarBody = () => {
      if (!document.body) return
      new MutationObserver(aplicarTema).observe(document.body, { attributes: true, attributeFilter: ['class'] })
      aplicarTema()
    }
    if (document.body) vigiarBody()
    else document.addEventListener('DOMContentLoaded', vigiarBody, { once: true })
  }

  /* --- escrever (e enviar) na conversa aberta -------------------------
     O campo do WhatsApp e um editor proprio: texto posto direto no HTML ele
     nao enxerga. Colar ele entende (com as quebras de linha), entao o texto
     entra como uma colagem; se nao pegar, vai pelo insertText do navegador.
     Enviar e o botao de enviar do proprio WhatsApp; sem achar o botao, o
     Enter. Devolve o que aconteceu, com o motivo quando nao deu. */
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const campoDeEscrever = () =>
    document.querySelector('#main footer div[contenteditable="true"]') ||
    document.querySelector('#main div[contenteditable="true"][data-tab]')
  const botaoDeEnviar = () => {
    const f = document.querySelector('#main footer')
    if (!f) return null
    const porNome = f.querySelector('button[aria-label="Enviar"], button[aria-label="Send"], [role="button"][aria-label="Enviar"], [role="button"][aria-label="Send"]')
    if (porNome) return porNome
    const icone = f.querySelector('[data-icon="send"], [data-icon="wds-ic-send-filled"], [data-icon^="send"]')
    return icone ? icone.closest('button, [role="button"]') : null
  }
  const textoDoCampo = (c) => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim()
  /* QUAL CONVERSA (0.4.1): pela identidade da conversa (jid), que existe
     tambem no contato que o WhatsApp so mostra pelo nome (@lid, sem o
     numero); o telefone so confere quando os dois lados o tem. */
  async function escrever(jid, telefone, texto, enviar) {
    const aberta = conversaAberta()
    const fimDe = (t) => String(t || '').replace(/\D/g, '').slice(-8)
    if (!aberta.aberta) return { ok: false, motivo: 'sem-campo' }
    if (jid && aberta.jid && jid !== aberta.jid) return { ok: false, motivo: 'outra-conversa' }
    if (telefone && aberta.telefone && fimDe(aberta.telefone) !== fimDe(telefone)) return { ok: false, motivo: 'outra-conversa' }
    const campo = campoDeEscrever()
    if (!campo) {
      reportar('campo-de-escrever', 'a conversa esta aberta e nao achei o campo de escrever', document.querySelector('#main footer'))
      return { ok: false, motivo: 'sem-campo' }
    }
    campo.focus()
    document.execCommand('selectAll', false)
    const dt = new DataTransfer()
    dt.setData('text/plain', texto)
    campo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    await espera(80)
    const comeco = texto.replace(/\s+/g, ' ').trim().slice(0, 12)
    if (!textoDoCampo(campo).includes(comeco)) {
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, texto)
      await espera(80)
    }
    if (!textoDoCampo(campo).includes(comeco)) {
      reportar('escrever', 'o texto colado nao entrou no campo', document.querySelector('#main footer'))
      return { ok: false, motivo: 'nao-escreveu' }
    }
    if (!enviar) return { ok: true, enviado: false }
    await espera(120)
    const b = botaoDeEnviar()
    if (!b) reportar('botao-de-enviar', 'nao achei o botao de enviar; fui pelo Enter', document.querySelector('#main footer'))
    if (b) b.click()
    else campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
    await espera(300)
    const saiu = !textoDoCampo(campoDeEscrever() || campo).includes(comeco)
    if (!saiu) reportar('enviar', 'o texto continuou no campo depois de enviar', document.querySelector('#main footer'))
    return saiu ? { ok: true, enviado: true } : { ok: false, motivo: 'nao-enviou' }
  }

  /* --- o vigia (0.6.0) ---------------------------------------------------
     O ESQUELETO: a arvore de etiquetas em volta do que sumiu, com os
     marcadores do proprio WhatsApp (data-testid, data-icon, role, o id das
     caixas grandes, contenteditable). Nada de texto, title ou aria-label,
     que levam nome de contato. No maximo 300 pecas. Cada erro vai uma vez
     por hora por pagina; o banco junta o dia. */
  const VERSAO = chrome.runtime.getManifest().version
  const desde = Date.now()
  const contados = new Map()
  function esqueleto(raiz) {
    let pecas = 0
    const olhar = (el, fundo) => {
      if (!el || pecas >= 300 || fundo > 6) return null
      pecas++
      const o = { t: el.tagName.toLowerCase() }
      const tid = el.getAttribute('data-testid')
      if (tid) o.i = tid.slice(0, 60)
      const ic = el.getAttribute('data-icon')
      if (ic) o.c = ic.slice(0, 60)
      const r = el.getAttribute('role')
      if (r) o.r = r.slice(0, 30)
      if (el.id && /^[a-z][\w-]{0,30}$/i.test(el.id) && !/\d{3,}/.test(el.id)) o.id = el.id
      if (el.getAttribute('contenteditable') === 'true') o.e = 1
      if (el.hasAttribute('data-tab')) o.d = String(el.getAttribute('data-tab')).slice(0, 4)
      const filhos = [...el.children].slice(0, 10).map((f) => olhar(f, fundo + 1)).filter(Boolean)
      if (filhos.length) o.f = filhos
      if (el.children.length > 10) o.mais = el.children.length - 10
      return o
    }
    return olhar(raiz, 0)
  }
  function reportar(onde, oque, raiz) {
    const chave = onde + '|' + oque
    if (Date.now() - (contados.get(chave) || 0) < 3_600_000) return
    contados.set(chave, Date.now())
    contar({ tipo: 'erro', versao: VERSAO, onde, oque, estrutura: raiz ? esqueleto(raiz) : null })
  }
  function conferirAPagina() {
    const app = document.querySelector('#app')
    if (!app || !app.children.length) return
    const main = document.querySelector('#main')
    const lista = document.querySelector('#pane-side')
    const qr = document.querySelector('canvas, [data-ref]')
    if (!main && !lista && !qr && Date.now() - desde > 90_000)
      reportar('lista-de-conversas', 'nao achei a lista de conversas (#pane-side), a conversa (#main) nem o QR Code', app)
    if (!main) return
    const rodape = main.querySelector('footer')
    if (rodape && !campoDeEscrever()) reportar('campo-de-escrever', 'a conversa tem rodape e nao achei o campo de escrever', rodape)
    const ids = [...main.querySelectorAll('[data-id]')]
    if (ids.length && !ids.some((el) => RE_ID.test(el.getAttribute('data-id') || '')))
      reportar('identidade-da-conversa', 'as mensagens tem data-id num formato que nao conheco', main)
  }
  setInterval(conferirAPagina, 60_000)
  setTimeout(conferirAPagina, 95_000)

  /* --- o registro no lead (W3, 0.6.0) -----------------------------------
     So quando a pagina pede, e so a conversa que ela disse. A hora sai do
     data-pre-plain-text ("[14:32, 13/10/2026] Nome: "); o nome nao sai daqui.
     Sem a hora, vai vazio e o banco usa a hora do registro. */
  function horaDe(t) {
    const m = /\[(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?\s*[Mm]\.?)?,\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]/.exec(t || '')
    if (!m) return ''
    let h = Number(m[1])
    const ampm = (m[3] || '').toLowerCase()
    if (ampm === 'p' && h < 12) h += 12
    if (ampm === 'a' && h === 12) h = 0
    /* com AM/PM a data vem mes/dia (ingles); sem, dia/mes */
    const dia = ampm ? Number(m[5]) : Number(m[4])
    const mes = ampm ? Number(m[4]) : Number(m[5])
    const d = new Date(Number(m[6]), mes - 1, dia, h, Number(m[2]))
    return isNaN(d.getTime()) ? '' : d.toISOString()
  }
  function lerUma(el, id, eu) {
    const pre = el.querySelector('[data-pre-plain-text]')
    const corpo = el.querySelector('.selectable-text, [data-pre-plain-text] span[dir]')
    const texto = corpo ? (corpo.innerText || corpo.textContent || '').trim().slice(0, 4000) : ''
    let tipo = 'texto'
    if (el.querySelector('audio, [data-icon*="audio"], [data-icon*="ptt"]')) tipo = 'audio'
    else if (el.querySelector('video, [data-icon*="video"]')) tipo = 'video'
    else if (el.querySelector('[data-icon*="document"], [data-icon*="doc-"]')) tipo = 'arquivo'
    else if (el.querySelector('img[src^="blob:"]:not(.emoji)')) tipo = 'imagem'
    if (tipo === 'texto' && !texto) return null /* figurinha, apagada, localizacao: fica de fora */
    return { id, eu, em: horaDe(pre && pre.getAttribute('data-pre-plain-text')), tipo, texto }
  }
  function lerMensagens(jidPedido) {
    const main = document.querySelector('#main')
    const aberta = conversaAberta()
    if (!main || !aberta.jid || aberta.jid !== jidPedido) return { ok: false, motivo: 'outra-conversa', mensagens: [] }
    const vistas = new Set()
    const lista = []
    for (const el of main.querySelectorAll('[data-id]')) {
      const id = el.getAttribute('data-id') || ''
      const m = RE_ID.exec(id)
      if (!m || m[2] !== jidPedido || vistas.has(id)) continue
      vistas.add(id)
      const uma = lerUma(el, id, m[1] === 'true')
      if (uma) lista.push(uma)
    }
    return { ok: true, mensagens: lista.slice(-80) }
  }

  if (dentro) {
    /* o pedido vem da pagina do Fourtime OS, e de mais ninguem */
    window.addEventListener('message', (e) => {
      if (e.origin !== pai || e.source !== parent) return
      const d = e.data
      if (!d || d.fourtime !== 'pedido') return
      /* o tema do Fourtime OS (Gelo ou Grafite): as cores do whatsapp.css */
      if (d.tipo === 'tema') {
        temaDaPagina = d.tema === 'dark' ? 'escuro' : 'claro'
        aplicarTema()
        return
      }
      if (d.tipo === 'ler-mensagens') {
        contar({ tipo: 'mensagens', marca: d.marca, jid: String(d.jid || ''), ...lerMensagens(String(d.jid || '')) })
        return
      }
      if (d.tipo === 'escrever') {
        escrever(String(d.jid || ''), String(d.telefone || ''), String(d.texto || ''), !!d.enviar).then((r) =>
          contar({ tipo: 'escreveu', marca: d.marca, ...r }),
        )
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
