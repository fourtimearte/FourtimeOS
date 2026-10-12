/* ==========================================================================
   O TESTE DA EXTENSAO (0.2.0: a coluna lateral e o WhatsApp dentro do Fourtime OS).

   O WhatsApp Web de verdade pede QR Code, entao aqui ele e trocado por uma
   pagina falsa no mesmo endereco, com o que a extensao procura: o #main com
   mensagens que carregam o data-id da conversa, e um WhatsApp que "pega" o
   clique num link wa.me (como o de verdade faz com link recebido). Ele prova
   a LOGICA da extensao; se o WhatsApp de verdade se comporta igual, quem diz
   e a prova no Chrome do Henrique.

   O que ele mede:
     1. no WhatsApp: a classe do visual entra e a letra vira a do Fourtime OS
     2. a conversa aberta chega ao fundo da extensao com o telefone certo
     3. grupo vai como grupo, e nao como telefone
     4. o Fourtime OS sabe que a extensao esta no Chrome (a marca na raiz)
     5. o icone do WhatsApp no funil, com a extensao, NAO abre aba nova: pede
        a troca na aba do WhatsApp, que recebe o link do telefone certo; se o
        WhatsApp nao pegar o link, a aba vai pelo /send (recarrega, mas chega)
     6. a coluna sem sessao mostra a entrada; com sessao e conversa, o lead
     7. telefone que nao e lead nem cliente diz que a extensao nao registra

   Uso:  node testes/extensao.mjs [endereco do sistema]   (padrao: preview local)
   Antes: extensao/config.js com o endereco de ensaio (o teste escreve um).
   ========================================================================== */
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'http://127.0.0.1:4173'
const EXT = resolve('extensao')

/* o config de ensaio: so escreve se nao houver um, para nao pisar no de verdade */
const CONFIG = join(EXT, 'config.js')
const escreviConfig = !existsSync(CONFIG)
if (escreviConfig) {
  writeFileSync(CONFIG, "self.FOURTIME = { supabase: 'https://ensaio.supabase.co', chave: 'ensaio', sistema: '" + SITE + "' }\n")
} else if (!readFileSync(CONFIG, 'utf8').includes('ensaio.supabase.co')) {
  console.log('aviso: extensao/config.js nao e o de ensaio; a coluna vai falar com o banco de verdade, por isso o teste da coluna fica de fora')
}

const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

/* o body nasce com "dark", como o WhatsApp de quem usa o tema escuro */
const WA_FALSO = (jid) => `<!doctype html><html><head><title>WhatsApp</title></head><body class="dark">
<div id="app"><div id="main"><header><span title="Teste">Teste</span></header>
<div data-id="false_${jid}_3EB0AAAA">oi</div><div data-id="true_${jid}_3EB0BBBB">ola</div></div></div>
<script>
  window.__links = []
  /* o WhatsApp de mentira pega link wa.me como o de verdade pega link recebido */
  document.addEventListener('click', (e) => {
    if (window.__naoPega) return
    const a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]')
    if (a) { e.preventDefault(); window.__links.push(a.href) }
  })
</script></body></html>`

const PAGINAS = ['inicio','funil']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = {ver:true,editar:true,deletar:true,total:true})
const PERFIL = [{ id:'1', nome:'Henrique', papel:'admin', situacao:'aprovado', paineis:PAGINAS, permissoes, email:'t@f', foto_em:null }]
const LEAD = { id:'L1', nome:'Atlético Exemplo', contato:'Marcos', telefone:'(62) 99999-0001', cliente_id:null,
  estagio:'atendimento', valor:2880, vendedor_id:null, ultima_msg:'Áudio', ultima_msg_em:new Date(Date.now()-7200000).toISOString(),
  nao_lidas:0, janela_ate:null, teste:true, equipe:{ nome:'Dani Ribeiro' }, cotacao:[], pedido:[] }

const perfil = mkdtempSync(join(tmpdir(), 'ext-'))
const ctx = await chromium.launchPersistentContext(perfil, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 1440, height: 900 },
})

let jidDaPagina = '5562999990001@c.us'
await ctx.route('https://web.whatsapp.com/**', (r) =>
  /* SEM o X-Frame-Options: resposta montada pelo teste nao passa pela regra
     da extensao (declarativeNetRequest), entao a trava e provada a parte, com
     rede de verdade, em testes/extensao-trava.mjs */
  r.fulfill({ status: 200, contentType: 'text/html', body: WA_FALSO(jidDaPagina) }))
let leadsDoBanco = [LEAD]
await ctx.route('**ensaio.supabase.co/**', (r) => {
  const u = r.request().url()
  let corpo = []
  if (u.includes('meu_perfil')) corpo = PERFIL
  else if (u.includes('/lead?')) corpo = leadsDoBanco
  else if (u.includes('/auth/v1/token')) corpo = { access_token:'a', refresh_token:'r', expires_in:3600, user:{ email:'dani@fourtime' } }
  return r.fulfill({ status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}, body: JSON.stringify(corpo) })
})

let [fundo] = ctx.serviceWorkers()
if (!fundo) fundo = await ctx.waitForEvent('serviceworker', { timeout: 10000 })
const idExt = new URL(fundo.url()).host
conta(!!idExt, 'a extensão carregou no Chromium (' + idExt + ')')

/* --- 1, 2: o WhatsApp ------------------------------------------------- */
const wa = await ctx.newPage()
await wa.goto('https://web.whatsapp.com/')
await wa.waitForTimeout(1500)
const visual = await wa.evaluate(() => ({
  classe: document.documentElement.classList.contains('fourtime-os'),
  letra: getComputedStyle(document.body).fontFamily,
  fonte: !!document.getElementById('fourtime-fonte'),
  faixa: getComputedStyle(document.body, '::before').content,
  dark: document.body.classList.contains('dark'),
}))
conta(visual.classe && /Urbanist/.test(visual.letra), 'no WhatsApp entra a cara do Fourtime OS (' + visual.letra + ')')
conta(visual.fonte, 'no WhatsApp entra o link da letra Urbanist')
conta(visual.faixa === '""' && visual.dark, 'na aba comum a faixa vermelha continua, e o tema do WhatsApp não é mexido (' + visual.faixa + ')')
const conversa = await fundo.evaluate(() => chrome.storage.session.get('conversa'))
conta(conversa.conversa?.telefone === '5562999990001', 'a conversa aberta chega ao fundo com o telefone (' + conversa.conversa?.telefone + ')')

/* --- 3: grupo --------------------------------------------------------- */
jidDaPagina = '120363000000000000@g.us'
await wa.reload(); await wa.waitForTimeout(1500)
const grupo = await fundo.evaluate(() => chrome.storage.session.get('conversa'))
conta(grupo.conversa?.jid.endsWith('@g.us') && !grupo.conversa?.telefone, 'grupo chega como grupo, sem telefone')
jidDaPagina = '5562999990001@c.us'
await wa.reload(); await wa.waitForTimeout(1500)

/* --- 4, 5: o Fourtime OS --------------------------------------------- */
const os = await ctx.newPage()
await os.addInitScript(() => { try {
  localStorage.setItem('ft.sessao', JSON.stringify({ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }))
} catch { /* sem armazenamento */ } })
await os.goto(SITE + '/funil?lead=L1', { waitUntil: 'networkidle' })
await os.waitForTimeout(1500)
const marca = await os.evaluate(() => document.documentElement.dataset.fourtimeExtensao || '')
const VERSAO = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8')).version
conta(marca === VERSAO, 'o Fourtime OS enxerga a extensão (' + marca + ')')
const abriuOLead = await os.evaluate(() => !!document.querySelector('.fn-inbox'))
conta(abriuOLead, '/funil?lead=L1 abre o inbox daquele lead')
conta(!new URL(os.url()).searchParams.has('lead'), 'o ?lead= sai da barra depois de usado')

/* a aba comum do WhatsApp: o pedido de uma pagina que nao tem o WhatsApp
   dentro (a ficha do cliente, por exemplo) vai para a aba aberta */
const pedirPelaAba = () => os.evaluate(() => window.postMessage({ fourtime: 'abrir-whatsapp', telefone: '5562999990001', texto: '' }, location.origin))
const abasAntes = ctx.pages().length
await pedirPelaAba()
await os.waitForTimeout(1500)
const links = await wa.evaluate(() => window.__links)
conta(ctx.pages().length === abasAntes, 'com a extensão, o ícone não abre aba nova (' + ctx.pages().length + ' abas)')
conta(links.length === 1 && links[0] === 'https://wa.me/5562999990001', 'a aba do WhatsApp recebe o pedido do telefone certo (' + links.join(' ') + ')')

/* 5b. o WhatsApp nao pegou o link: a aba vai pelo endereco */
await wa.evaluate(() => { window.__naoPega = true })
await os.bringToFront()
await pedirPelaAba()
await wa.waitForURL(/send\?phone=5562999990001/, { timeout: 5000 }).catch(() => {})
conta(wa.url().includes('/send?phone=5562999990001'), 'se o WhatsApp não pega o link, a aba vai pelo /send (' + wa.url() + ')')
await wa.waitForTimeout(1200)

/* --- 8 a 11: o WhatsApp DENTRO do Fourtime OS (pranchas 131 a 133) --- */
jidDaPagina = '5562999990001@c.us'
/* mais dois leads para a coluna da direita: um do site esperando ha 3 horas,
   outro do site que acabou de chegar */
const LEAD_ESPERANDO = { ...LEAD, id:'L2', nome:'Clube Esperando', telefone:'(62) 98888-0002', estagio:'novo', origem:'site-chat',
  ultima_msg_em:new Date(Date.now()-3*3600000).toISOString() }
const LEAD_NOVO = { ...LEAD, id:'L3', nome:'Escola Nova', telefone:'(62) 97777-0003', estagio:'novo', origem:'site-chat',
  ultima_msg_em:new Date(Date.now()-600000).toISOString() }
const leadsGuardados = leadsDoBanco
leadsDoBanco = [LEAD, LEAD_ESPERANDO, LEAD_NOVO]
await os.bringToFront()
await os.goto(SITE + '/funil', { waitUntil: 'networkidle' })
await os.waitForTimeout(1200)
await os.evaluate(() => [...document.querySelectorAll('.fn-card')].find(c => c.textContent.includes('Atlético')).click())
await os.waitForTimeout(800)
await os.click('.fn-in-wa')
await os.waitForTimeout(3000)
const quadroWa = os.frames().find(f => f.url().startsWith('https://web.whatsapp.com'))
const dentro = quadroWa ? await quadroWa.evaluate(() => ({
  main: !!document.querySelector('#main'),
  classe: document.documentElement.classList.contains('fourtime-dentro'),
  links: window.__links,
})).catch(() => null) : null
conta(!!dentro?.main, 'o WhatsApp abre DENTRO do Fourtime OS, no modo WhatsApp')
conta(!!dentro?.classe, 'dentro do Fourtime OS, o WhatsApp ganha a cara do sistema')
conta(dentro?.links?.[0] === 'https://wa.me/5562999990001', 'o botão do WhatsApp no funil troca a conversa no WhatsApp daqui de dentro (' + (dentro?.links ?? []).join(' ') + ')')
const coluna = await os.evaluate(() => ({
  texto: document.querySelector('.fn-wa-lado')?.innerText ?? '',
  modo: [...document.querySelectorAll('.seg button')].find(b => /WhatsApp/.test(b.innerText))?.className ?? '',
  inbox: !!document.querySelector('.fn-inbox'),
}))
conta(/Atlético Exemplo/.test(coluna.texto) && /Em atendimento/.test(coluna.texto), 'a coluna da direita mostra o lead da conversa aberta')
conta(/Cadastrar cliente/.test(coluna.texto) && /Montar cotação/.test(coluna.texto), 'a coluna oferece Cadastrar cliente e Montar cotação para o lead sem cadastro')
conta(/ligado/.test(coluna.modo) && !coluna.inbox, 'a página passou para o modo WhatsApp, sem a conversa do quadro por cima')
await os.screenshot({ path: 'testes/fotos/extensao-dentro.png' }).catch(() => {})

/* 12/10/2026: a faixa escura saiu; o estado do WhatsApp mora no topo da coluna */
const semFaixa = await os.evaluate(() => ({
  faixa: !!document.querySelector('.fn-wa-faixa'),
  status: document.querySelector('.fn-wa-lado .fn-wa-status')?.innerText ?? '',
}))
conta(!semFaixa.faixa && /WhatsApp aberto aqui dentro/.test(semFaixa.status), 'sem faixa escura em cima do WhatsApp; o estado fica no topo da coluna (' + semFaixa.status + ')')

/* a coluna nunca fica vazia: quem espera resposta e quem chegou pelo site */
conta(/Esperando resposta/i.test(coluna.texto) && /Clube Esperando/.test(coluna.texto), 'a coluna lista quem está esperando resposta')
conta(/Novos do site/i.test(coluna.texto) && /Escola Nova/.test(coluna.texto), 'a coluna lista os leads novos do site')
conta(!/Esperando resposta[\s\S]*Atlético Exemplo/i.test(coluna.texto), 'o lead da conversa aberta não se repete nas listas')
await os.evaluate(() => [...document.querySelectorAll('.fn-wa-item')].find(b => b.innerText.includes('Escola Nova')).click())
await os.waitForTimeout(600)
const linksDaLista = await quadroWa.evaluate(() => window.__links).catch(() => [])
conta(linksDaLista.at(-1) === 'https://wa.me/5562977770003', 'clicar num nome da lista troca a conversa no WhatsApp ao lado (' + linksDaLista.join(' ') + ')')

/* a cara do Fourtime OS: o tema da página vai para dentro do WhatsApp */
const corDentro = () => quadroWa.evaluate(() => ({
  dark: document.body.classList.contains('dark'),
  faixa: getComputedStyle(document.body, '::before').content,
  destaque: getComputedStyle(document.documentElement).getPropertyValue('--WDS-surface-highlight').trim(),
  claro: document.documentElement.classList.contains('fourtime-claro'),
  escuro: document.documentElement.classList.contains('fourtime-escuro'),
  acento: getComputedStyle(document.documentElement).getPropertyValue('--WDS-accent').trim(),
  fundo: getComputedStyle(document.documentElement).getPropertyValue('--WDS-app-wash').trim(),
})).catch(() => null)
const temaDaPagina = await os.evaluate(() => document.documentElement.getAttribute('data-theme'))
const cor1 = await corDentro()
const esperado1 = temaDaPagina === 'dark' ? { escuro: true, acento: '#E0262E' } : { claro: true, acento: '#C6161B' }
conta(!!cor1 && (esperado1.escuro ? cor1.escuro : cor1.claro) && cor1.acento.toUpperCase() === esperado1.acento,
  'o WhatsApp de dentro ganha as cores do tema da página (' + temaDaPagina + ': ' + JSON.stringify(cor1) + ')')
conta(!!cor1 && cor1.dark === (temaDaPagina === 'dark') && cor1.faixa === 'none',
  'o body do WhatsApp segue o tema da página (a classe dark das cores antigas) e a faixa vermelha não aparece dentro (' + JSON.stringify({ dark: cor1?.dark, faixa: cor1?.faixa }) + ')')
conta(!!cor1 && (temaDaPagina === 'dark' ? /255, 255, 255/.test(cor1.destaque) : /194, 189, 184/.test(cor1.destaque)),
  'o tema de dentro é inteiro: até as cores que o Fourtime OS não recolore seguem o tema da página (' + cor1?.destaque + ')')
const outro = temaDaPagina === 'dark' ? 'light' : 'dark'
await os.evaluate((t) => document.documentElement.setAttribute('data-theme', t), outro)
await os.waitForTimeout(400)
const cor2 = await corDentro()
conta(!!cor2 && (outro === 'dark' ? cor2.escuro && cor2.fundo.toUpperCase() === '#131416' : cor2.claro && cor2.fundo.toUpperCase() === '#EBEDF1'),
  'trocar o tema da página repinta o WhatsApp de dentro (' + outro + ': ' + JSON.stringify(cor2) + ')')
await quadroWa.evaluate(() => { document.body.className = 'dark' })
await os.waitForTimeout(200)
const cor3 = await corDentro()
conta(!!cor3 && cor3.dark === (outro === 'dark'),
  'se o WhatsApp mexer na classe do body, ela volta para o tema da página (' + JSON.stringify({ dark: cor3?.dark }) + ')')
await os.screenshot({ path: 'testes/fotos/extensao-dentro-' + outro + '.png' }).catch(() => {})
await os.evaluate((t) => document.documentElement.setAttribute('data-theme', t), temaDaPagina)
leadsDoBanco = leadsGuardados

/* trocar de modo esconde um e mostra o outro (o defeito que o Henrique achou em 11/10/2026:
   o WhatsApp ficava sempre e o quadro ia para baixo dele) */
const visto = () => os.evaluate(() => {
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0
  const f = document.querySelector('.fn-wa-frame')?.getBoundingClientRect()
  return { wa: vis(document.querySelector('.fn-wa')), quadro: vis(document.querySelector('.fn-quadro')), frame: f ? Math.round(f.width) + 'x' + Math.round(f.height) : '' }
})
const antes = await visto()
await os.evaluate(() => [...document.querySelectorAll('.seg button')].find(b => /Quadro/.test(b.innerText)).click())
await os.waitForTimeout(500)
const noQuadro = await visto()
/* o "pulo" que o Henrique viu em 12/10/2026: escondido, o WhatsApp ficava
   com tamanho zero e se redesenhava ao voltar. Agora o quadro dele nao muda
   de tamanho ao trocar de modo. */
conta(!!antes.frame && noQuadro.frame === antes.frame, 'escondido, o WhatsApp mantém o mesmo tamanho e não se redesenha ao voltar (' + antes.frame + ' e ' + noQuadro.frame + ')')
const clicavel = await os.evaluate(() => {
  const c = document.querySelector('.fn-card'); if (!c) return false
  const r = c.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 10)
  return !!el && c.contains(el)
})
conta(clicavel, 'com o WhatsApp guardado por baixo, os cartões do quadro continuam clicáveis')
conta(!noQuadro.wa && noQuadro.quadro, 'no modo Quadro o WhatsApp some e o quadro aparece (' + JSON.stringify(noQuadro) + ')')
await os.evaluate(() => [...document.querySelectorAll('.seg button')].find(b => /WhatsApp/.test(b.innerText)).click())
await os.waitForTimeout(500)
const noZap = await visto()
conta(noZap.wa && !noZap.quadro, 'no modo WhatsApp o quadro some e o WhatsApp volta (' + JSON.stringify(noZap) + ')')


/* --- 6, 7: a coluna lateral ------------------------------------------ */
const lado = await ctx.newPage()
await lado.setViewportSize({ width: 400, height: 760 })
await lado.goto(`chrome-extension://${idExt}/lado.html`)
await lado.waitForTimeout(800)
const entrar = await lado.evaluate(() => !!document.querySelector('input[type=password]'))
conta(entrar, 'a coluna sem sessão mostra a entrada')
await lado.fill('input[type=email]', 'dani@fourtime')
await lado.fill('input[type=password]', 'teste-falso')
await lado.click('button[type=submit]')
await lado.waitForTimeout(1200)
const cartao = await lado.evaluate(() => document.querySelector('main')?.innerText || '')
conta(/Atlético Exemplo/.test(cartao) && /Em atendimento/.test(cartao) && /Dani Ribeiro/.test(cartao),
  'a coluna mostra o lead da conversa aberta (nome, etapa, vendedor)')
await lado.screenshot({ path: 'testes/fotos/extensao-coluna-lead.png' }).catch(() => {})

leadsDoBanco = []
await fundo.evaluate(() => chrome.storage.session.set({ conversa: { jid:'5562988887777@c.us', telefone:'5562988887777', em: Date.now() } }))
await lado.waitForTimeout(1200)
const fora = await lado.evaluate(() => document.querySelector('main')?.innerText || '')
conta(/Não é lead nem cliente/.test(fora) && /não registra/.test(fora), 'telefone de fora do sistema: a coluna diz que não registra')
await lado.screenshot({ path: 'testes/fotos/extensao-coluna-fora.png' }).catch(() => {})

await ctx.close()
if (escreviConfig) { const { unlinkSync } = await import('node:fs'); unlinkSync(CONFIG) }
const ruins = achados.filter((a) => !a.certo).length
console.log(`\n${achados.length - ruins} de ${achados.length} certos`)
process.exit(ruins ? 1 : 0)
