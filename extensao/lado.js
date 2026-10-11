/* ==========================================================================
   A coluna lateral: quem e o telefone da conversa aberta no Fourtime OS.

   A ENTRADA E PROPRIA. O vendedor entra aqui com o mesmo e-mail e a mesma
   senha do Fourtime OS, uma vez so. Pegar a sessao da aba do sistema parece
   mais simples e quebra: a renovacao do Supabase queima o bilhete usado, e as
   duas pontas renovando com o mesmo bilhete derrubariam o vendedor do sistema
   no meio do dia. Duas sessoes, cada uma renovando a sua.

   SO LEITURA, com as regras de quem le do proprio banco (RLS): o vendedor ve
   aqui exatamente o que veria no funil.
   ========================================================================== */
const CFG = self.FOURTIME || {}
const API = String(CFG.supabase || '').replace(/\/+$/, '')
const CHAVE = String(CFG.chave || '')
const SISTEMA = String(CFG.sistema || 'https://fourtimeos.arte-adc.workers.dev').replace(/\/+$/, '')

const NOME_DO_ESTAGIO = {
  novo: 'Novo lead',
  atendimento: 'Em atendimento',
  cotacao: 'Cotação enviada',
  negociando: 'Negociando',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

const miolo = document.getElementById('miolo')
const pe = document.getElementById('pe')
const quem = document.getElementById('quem')

/* --- montar sem innerHTML: nada que vem do banco vira HTML --------------- */
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : String(v))
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f)
  return n
}
const trocar = (...filhos) => miolo.replaceChildren(...filhos)
const linha = (rotulo, valor) => el('div', { class: 'linha' }, el('span', {}, rotulo), el('b', {}, valor))

/* --- a sessao --------------------------------------------------------- */
async function sessao() {
  const { sessao: s } = await chrome.storage.local.get('sessao')
  if (!s) return null
  if (Date.now() < s.venceEm - 60_000) return s
  try {
    return await pedirCracha('refresh_token', { refresh_token: s.renovacao })
  } catch {
    await chrome.storage.local.remove('sessao')
    return null
  }
}

async function pedirCracha(tipo, corpo) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=${tipo}`, {
    method: 'POST',
    headers: { apikey: CHAVE, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error_description || d.msg || 'Não consegui entrar')
  const s = {
    acesso: d.access_token,
    renovacao: d.refresh_token,
    venceEm: Date.now() + (d.expires_in || 3600) * 1000,
    email: (d.user && d.user.email) || '',
  }
  await chrome.storage.local.set({ sessao: s })
  return s
}

async function ler(caminho) {
  const s = await sessao()
  if (!s) throw Object.assign(new Error('fora'), { fora: true })
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    headers: { apikey: CHAVE, authorization: 'Bearer ' + s.acesso },
  })
  if (r.status === 401) {
    await chrome.storage.local.remove('sessao')
    throw Object.assign(new Error('fora'), { fora: true })
  }
  if (!r.ok) throw new Error('O Fourtime OS não respondeu (' + r.status + ')')
  return r.json()
}

/* --- o telefone --------------------------------------------------------
   O banco compara pelos 8 ultimos digitos (fim_do_telefone, 011), o que
   ignora 55, DDD e o nono digito escrito ou nao. A coluna faz igual. */
const so = (t) => String(t || '').replace(/\D/g, '')
const fim = (t) => so(t).slice(-8)
function formatar(t) {
  const n = so(t).replace(/^55(?=\d{10,11}$)/, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return t
}
const dinheiro = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
function haQuanto(iso) {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return 'há ' + min + ' min'
  if (min < 1440) return 'há ' + Math.round(min / 60) + ' h'
  return 'há ' + Math.round(min / 1440) + ' dias'
}

/* --- o que a coluna mostra ------------------------------------------- */
let pedido = 0

async function mostrar() {
  const meu = ++pedido
  if (!API || !CHAVE) {
    trocar(el('div', { class: 'cartao' }, el('p', { class: 'erro' }, 'A extensão veio sem o endereço do Fourtime OS (config.js).')))
    return
  }
  const s = await sessao()
  quem.textContent = s ? s.email : ''
  rodape(s)
  if (!s) return telaDeEntrar()

  const { conversa } = await chrome.storage.session.get('conversa')
  if (!conversa || (!conversa.jid && !conversa.telefone)) {
    return trocar(
      el('div', { class: 'cartao' },
        el('p', { class: 'sobre' }, 'Nenhuma conversa aberta'),
        el('p', { class: 'apoio' }, 'Abra uma conversa no WhatsApp e quem é aquele telefone no Fourtime OS aparece aqui.')),
    )
  }
  if (conversa.jid.endsWith('@g.us')) {
    return trocar(el('div', { class: 'cartao' }, el('p', { class: 'sobre' }, 'Grupo'), el('p', { class: 'apoio' }, 'Grupo não é lead. A extensão não lê grupos.')))
  }
  if (!conversa.telefone) {
    return trocar(
      el('div', { class: 'cartao' },
        el('p', { class: 'sobre' }, 'Sem o número desta conversa'),
        el('p', { class: 'apoio' }, 'O WhatsApp não mostrou o telefone desta conversa. Anote na prova: é um contato salvo?')),
    )
  }

  trocar(el('div', { class: 'cartao' }, el('p', { class: 'apoio' }, 'Procurando ' + formatar(conversa.telefone) + ' no Fourtime OS...')))
  try {
    const ultimos4 = so(conversa.telefone).slice(-4)
    const [leads, clientes] = await Promise.all([
      ler(`lead?select=id,nome,contato,telefone,estagio,valor,ultima_msg,ultima_msg_em,equipe(nome),cotacao(id),pedido(numero)&telefone=like.*${ultimos4}&order=atualizado_em.desc&limit=20`),
      ler(`cliente?select=id,nome,contato,celular,telefone&or=(celular.like.*${ultimos4},telefone.like.*${ultimos4})&limit=20`),
    ])
    if (meu !== pedido) return
    const alvo = fim(conversa.telefone)
    const doTelefone = leads.filter((l) => fim(l.telefone) === alvo)
    const aberto = doTelefone.find((l) => l.estagio !== 'fechado' && l.estagio !== 'perdido')
    const cliente = clientes.find((c) => fim(c.celular) === alvo || fim(c.telefone) === alvo)
    if (aberto) return trocar(cartaoDoLead(aberto, conversa.telefone))
    if (cliente) return trocar(cartaoDoCliente(cliente, doTelefone[0], conversa.telefone))
    trocar(
      el('div', { class: 'cartao' },
        el('p', { class: 'sobre' }, formatar(conversa.telefone)),
        el('h1', {}, 'Não é lead nem cliente'),
        el('p', { class: 'apoio' }, 'Conversa de fora do sistema. A extensão não registra nada dela.')),
    )
  } catch (e) {
    if (e.fora) return telaDeEntrar()
    trocar(el('div', { class: 'cartao' }, el('p', { class: 'erro' }, e.message)))
  }
}

function cartaoDoLead(l, telefone) {
  const vendedor = l.equipe && l.equipe.nome ? l.equipe.nome : 'sem vendedor'
  const cotacoes = Array.isArray(l.cotacao) ? l.cotacao.length : 0
  const pedidos = Array.isArray(l.pedido) ? l.pedido.map((p) => p.numero).filter(Boolean) : []
  return el('div', { class: 'cartao' },
    el('p', { class: 'sobre' }, 'Lead · ' + formatar(telefone)),
    el('h1', {}, l.nome || 'Lead sem nome'),
    l.contato ? el('p', { class: 'apoio' }, l.contato) : null,
    el('span', { class: 'selo' }, NOME_DO_ESTAGIO[l.estagio] || l.estagio),
    linha('Vendedor', vendedor),
    l.valor ? linha('Valor', dinheiro(l.valor)) : null,
    linha('Cotações', cotacoes ? String(cotacoes) : 'nenhuma'),
    pedidos.length ? linha('Pedidos', pedidos.join(', ')) : null,
    l.ultima_msg_em ? linha('Última mensagem', haQuanto(l.ultima_msg_em)) : null,
    el('button', { class: 'btn forte', type: 'button', onclick: () => chrome.tabs.create({ url: SISTEMA + '/funil?lead=' + encodeURIComponent(l.id) }) }, 'Abrir no Fourtime OS'),
  )
}

function cartaoDoCliente(c, leadAntigo, telefone) {
  return el('div', { class: 'cartao' },
    el('p', { class: 'sobre' }, 'Cliente · ' + formatar(telefone)),
    el('h1', {}, c.nome || 'Cliente'),
    c.contato ? el('p', { class: 'apoio' }, c.contato) : null,
    leadAntigo ? linha('Último lead', NOME_DO_ESTAGIO[leadAntigo.estagio] || leadAntigo.estagio) : linha('Lead aberto', 'nenhum'),
    el('button', { class: 'btn forte', type: 'button', onclick: () => chrome.tabs.create({ url: SISTEMA + '/clientes?abrir=' + encodeURIComponent(c.id) }) }, 'Abrir o cliente no Fourtime OS'),
  )
}

/* --- entrar --------------------------------------------------------- */
function telaDeEntrar(erro = '') {
  quem.textContent = ''
  rodape(null)
  const email = el('input', { type: 'email', autocomplete: 'username', required: true })
  const senha = el('input', { type: 'password', autocomplete: 'current-password', required: true })
  const botao = el('button', { class: 'btn forte', type: 'submit' }, 'Entrar')
  const form = el('form', { class: 'cartao' },
    el('p', { class: 'sobre' }, 'Entrar'),
    el('p', { class: 'apoio' }, 'Use o mesmo e-mail e a mesma senha do Fourtime OS. É uma vez só neste computador.'),
    erro ? el('p', { class: 'erro' }, erro) : null,
    el('label', {}, 'E-mail', email),
    el('label', {}, 'Senha', senha),
    botao,
  )
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    botao.disabled = true
    try {
      await pedirCracha('password', { email: email.value.trim(), password: senha.value })
      void mostrar()
    } catch (e) {
      telaDeEntrar(e.message)
    }
  })
  trocar(form)
}

function rodape(s) {
  pe.replaceChildren(
    el('span', {}, 'Prova ' + chrome.runtime.getManifest().version),
    s ? el('button', { class: 'btn limpo', type: 'button', onclick: async () => { await chrome.storage.local.remove('sessao'); void mostrar() } }, 'Sair') : '',
  )
}

chrome.storage.onChanged.addListener((mudou, area) => {
  if (area === 'session' && mudou.conversa) void mostrar()
})
void mostrar()
