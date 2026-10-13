/* ==========================================================================
   O WHATSAPP DO FUNIL NAO RECARREGA (13/10/2026).

   O Henrique viu o WhatsApp do Funil abrir do zero toda vez que trocava de
   pagina no Fourtime OS. O quadro morava dentro da pagina do Funil e ia
   embora com ela. Agora ele mora na casca (whatsapp-vivo.tsx) e o Funil so
   marca o lugar.

   Com a extensao de verdade carregada e um WhatsApp de mentira, o teste conta
   quantas vezes o quadro do WhatsApp carregou e marca a janela dele (uma
   janela recarregada perde a marca). Confere:
     1. entrar no modo WhatsApp carrega o quadro uma vez, em cima do lugar
     2. Quadro e WhatsApp de novo: nao recarrega
     3. trocar de aba do navegador e voltar: nao recarrega
     4. em outra pagina o WhatsApp fica invisivel e nao pega clique
     5. voltar ao Funil: ele abre no modo em que foi deixado (WhatsApp ou
        Quadro), com o mesmo quadro, sem recarregar; ?lead= abre no Quadro
     7. recarregar a pagina abre no Quadro
     6. sem rolagem de lado e sem erro de JavaScript

   Uso:  node testes/whatsapp-fica.mjs http://127.0.0.1:4173
   ========================================================================== */
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = (() => { for (const o of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) { try { return require(o) } catch {} } })()
const SITE = process.argv[2] || 'http://127.0.0.1:4173'
const EXT = mkdtempSync(join(tmpdir(), 'ext-'))
cpSync(resolve('extensao'), EXT, { recursive: true })
writeFileSync(join(EXT, 'config.js'), "self.FOURTIME = { supabase: 'https://ensaio.supabase.co', chave: 'ensaio', sistema: '" + SITE + "' }\n")
const PERFIL_DIR = mkdtempSync(join(tmpdir(), 'perfil-'))
mkdirSync(join(PERFIL_DIR, 'Default'), { recursive: true })
writeFileSync(join(PERFIL_DIR, 'Default', 'Preferences'), JSON.stringify({ extensions: { ui: { developer_mode: true } } }))
const ctx = await chromium.launchPersistentContext(PERFIL_DIR, { channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] })
const PAG = ['inicio','funil','clientes','cotacao','kanban','estoque','config']
const perm = {}; PAG.forEach(k => perm[k] = { ver: true, editar: true, deletar: true, total: true })
const PERFIL = [{ id: '1', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: PAG, permissoes: perm, email: 't@f', foto_em: null }]
await ctx.route('https://web.whatsapp.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body><div id="app"><div id="main">WhatsApp de mentira</div></div></body></html>' }))
await ctx.route('**supabase.co/**', (r) => {
  const u = r.request().url()
  const corpo = u.includes('meu_perfil') ? PERFIL : u.includes('/lead?') ? [{ id: 'L1', nome: 'Teste', contato: 'R', telefone: '62999990001', estagio: 'novo', valor: 1, ultima_msg_em: new Date().toISOString(), nao_lidas: 0, teste: true, equipe: null, cotacao: [], pedido: [] }] : []
  return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
})
await ctx.addInitScript((c) => { try { localStorage.setItem('ft.sessao', JSON.stringify(c)) } catch {} }, { acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' })
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
let cargas = 0
const erros = []
const pg = await ctx.newPage()
pg.on('pageerror', (e) => erros.push(e.message))
pg.on('framenavigated', (f) => { if (f !== pg.mainFrame() && f.url().startsWith('https://web.whatsapp.com')) cargas++ })
const quadro = () => pg.frames().find((f) => f.url().startsWith('https://web.whatsapp.com'))
const mesmo = async () => (await quadro()?.evaluate(() => window.__mesmo === true).catch(() => false)) ?? false
/* o quadro cobre o lugar (por dentro da borda), visivel e clicavel? */
const posicao = () => pg.evaluate(() => {
  const v = document.querySelector('.fn-wa-vivo')
  const l = document.querySelector('.fn-wa:not(.fn-guardado) .fn-wa-quadro')
  if (!v) return { existe: false }
  const s = getComputedStyle(v)
  const a = v.getBoundingClientRect()
  const b = l?.getBoundingClientRect()
  const cobre = !!b && Math.abs(a.left - b.left - 1) <= 1 && Math.abs(a.top - b.top - 1) <= 1 && Math.abs(a.width - (b.width - 2)) <= 1 && Math.abs(a.height - (b.height - 2)) <= 1
  return { existe: true, visivel: s.visibility === 'visible', clique: s.pointerEvents !== 'none', cobre, l: Math.round(a.left), t: Math.round(a.top), w: Math.round(a.width), h: Math.round(a.height) }
})
const modoWhatsApp = () => pg.locator('button:has(.fn-modo)').nth(1).click()
const modoQuadro = () => pg.locator('button:has(.fn-modo)').nth(0).click()

await pg.goto(SITE + '/funil', { waitUntil: 'networkidle' })
await pg.waitForTimeout(1200)
await modoWhatsApp()
await pg.waitForTimeout(1500)
await quadro()?.evaluate(() => { window.__mesmo = true })
let p = await posicao()
conta(cargas === 1 && p.visivel && p.clique && p.cobre, `1. o modo WhatsApp carrega o quadro uma vez, em cima do lugar (${cargas} carga, ${JSON.stringify(p)})`)

await modoQuadro(); await pg.waitForTimeout(500)
p = await posicao()
conta(!p.visivel && !p.clique, '   no modo Quadro o WhatsApp some e nao pega clique')
await modoWhatsApp(); await pg.waitForTimeout(800)
conta(cargas === 1 && await mesmo() && (await posicao()).cobre, `2. Quadro e WhatsApp de novo: o mesmo quadro (${cargas} carga)`)

const outra = await ctx.newPage(); await outra.goto('about:blank'); await outra.bringToFront(); await pg.waitForTimeout(2500)
await pg.bringToFront(); await pg.waitForTimeout(2500)
conta(cargas === 1 && await mesmo(), `3. trocar de aba e voltar: o mesmo quadro (${cargas} carga)`)
await outra.close()

await pg.locator('a[href="/clientes"]').first().click()
await pg.waitForURL('**/clientes'); await pg.waitForTimeout(1200)
p = await posicao()
conta(p.existe && !p.visivel && !p.clique && cargas === 1, `4. em Clientes o WhatsApp fica ligado, invisivel e sem clique (${JSON.stringify(p)})`)
const rola = await pg.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.documentElement.scrollHeight, innerHeight])

await pg.locator('a[href="/funil"]').first().click()
await pg.waitForURL('**/funil'); await pg.waitForTimeout(1200)
p = await posicao()
conta(cargas === 1 && await mesmo() && p.visivel && p.cobre, `5. de volta ao Funil, ja no modo WhatsApp (sem clicar), o mesmo quadro em cima do lugar, sem recarregar (${cargas} carga, ${JSON.stringify(p)})`)

/* deixado no Quadro, volta no Quadro */
await modoQuadro(); await pg.waitForTimeout(400)
await pg.locator('a[href="/clientes"]').first().click(); await pg.waitForURL('**/clientes'); await pg.waitForTimeout(600)
await pg.locator('a[href="/funil"]').first().click(); await pg.waitForURL('**/funil'); await pg.waitForTimeout(1000)
p = await posicao()
conta(!p.visivel && await pg.evaluate(() => !!document.querySelector('.fn-mesa:not(.fn-guardado)')) && cargas === 1, '   deixado no Quadro, o Funil volta no Quadro')

/* o lead pedido pelo endereco abre no Quadro, mesmo com o Funil deixado no WhatsApp */
await modoWhatsApp(); await pg.waitForTimeout(600)
await pg.evaluate(() => { history.pushState({}, '', '/funil?lead=L1'); dispatchEvent(new PopStateEvent('popstate')) })
await pg.waitForTimeout(1200)
conta(!(await posicao()).visivel && await pg.evaluate(() => !!document.querySelector('.fn-mesa:not(.fn-guardado)') && !!document.querySelector('.fn-inbox')) && cargas === 1, '   /funil?lead= abre o lead no Quadro, com o inbox aberto')
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)
if (await pg.locator('.fn-inbox').count()) await pg.locator('.fn-inbox button[aria-label*="Fechar"]').first().click().catch(() => {})
await pg.waitForTimeout(300)
await modoWhatsApp(); await pg.waitForTimeout(800)

/* a janela muda de tamanho: o quadro segue o lugar */
await pg.setViewportSize({ width: 1200, height: 800 }); await pg.waitForTimeout(600)
p = await posicao()
conta(p.cobre && cargas === 1, `   a janela menor: o quadro segue o lugar (${JSON.stringify(p)})`)

/* recarregar a pagina volta ao Quadro (pedido de 12/10/2026) */
await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(1200)
conta(await pg.evaluate(() => !!document.querySelector('.fn-mesa:not(.fn-guardado)') && !document.querySelector('.fn-wa-vivo.na-pagina')), '7. recarregar a pagina abre o Funil no Quadro')

conta(rola[0] <= rola[1] + 1, `6. sem rolagem de lado em Clientes com o WhatsApp escondido (${rola[0]} em ${rola[1]})`)
conta(!erros.length, 'sem erro de JavaScript ' + erros.join(' | '))
await ctx.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
