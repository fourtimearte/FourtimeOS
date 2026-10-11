/* ==========================================================================
   O TESTE DA EXTENSAO (prova 0.1.0, coluna lateral).

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

const WA_FALSO = (jid) => `<!doctype html><html><head><title>WhatsApp</title></head><body>
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
}))
conta(visual.classe && /Urbanist/.test(visual.letra), 'no WhatsApp entra a cara do Fourtime OS (' + visual.letra + ')')
conta(visual.fonte, 'no WhatsApp entra o link da letra Urbanist')
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
conta(marca === '0.1.0', 'o Fourtime OS enxerga a extensão (' + marca + ')')
const abriuOLead = await os.evaluate(() => !!document.querySelector('.fn-inbox'))
conta(abriuOLead, '/funil?lead=L1 abre o inbox daquele lead')
conta(!new URL(os.url()).searchParams.has('lead'), 'o ?lead= sai da barra depois de usado')

const abasAntes = ctx.pages().length
await os.click('.fn-in-wa')
await os.waitForTimeout(1500)
const links = await wa.evaluate(() => window.__links)
conta(ctx.pages().length === abasAntes, 'com a extensão, o ícone não abre aba nova (' + ctx.pages().length + ' abas)')
conta(links.length === 1 && links[0] === 'https://wa.me/5562999990001', 'a aba do WhatsApp recebe o pedido do telefone certo (' + links.join(' ') + ')')

/* 5b. o WhatsApp nao pegou o link: a aba vai pelo endereco */
await wa.evaluate(() => { window.__naoPega = true })
await os.bringToFront()
await os.click('.fn-in-wa')
await wa.waitForURL(/send\?phone=5562999990001/, { timeout: 5000 }).catch(() => {})
conta(wa.url().includes('/send?phone=5562999990001'), 'se o WhatsApp não pega o link, a aba vai pelo /send (' + wa.url() + ')')
await wa.waitForTimeout(1200)

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
