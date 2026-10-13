/* ==========================================================================
   O TESTE DA EXTENSAO QUE SE ATUALIZA SOZINHA (0.5.0, 13/10/2026).

   A extensao e carregada sem compactacao de uma pasta. O teste copia a
   extensao para uma pasta de mentira, abre o Fourtime OS (local) e um
   WhatsApp de mentira, troca a versao no manifest.json da pasta, como o
   Claude faz ao gravar a versao nova, e confere:

     1. em ate 40 segundos a extensao recarrega sozinha com a versao nova
     2. a aba do Fourtime OS ganha a marca da versao nova sem recarregar a
        pagina (o anuncio.js de novo)
     3. a aba do WhatsApp recarrega (o tema e o envio voltam a funcionar)
     4. sem mudar a versao, nada recarrega

   Uso:  node testes/extensao-atualiza.mjs http://127.0.0.1:4173
   ========================================================================== */

import { createRequire } from 'node:module'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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

let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

const EXT = mkdtempSync(join(tmpdir(), 'ext-pasta-'))
cpSync(resolve('extensao'), EXT, { recursive: true })
writeFileSync(join(EXT, 'config.js'), "self.FOURTIME = { supabase: 'https://ensaio.supabase.co', chave: 'ensaio', sistema: '" + SITE + "' }\n")
const MANIFEST = join(EXT, 'manifest.json')
const VERSAO = JSON.parse(readFileSync(MANIFEST, 'utf8')).version

/* O MODO DO DESENVOLVEDOR LIGADO, como no Chrome dele: sem ele o Chrome
   desliga a extensao sem compactacao na primeira recarga
   (DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION), e o teste mediria outra coisa. */
const PERFIL = mkdtempSync(join(tmpdir(), 'ext-perfil-'))
mkdirSync(join(PERFIL, 'Default'), { recursive: true })
writeFileSync(join(PERFIL, 'Default', 'Preferences'), JSON.stringify({ extensions: { ui: { developer_mode: true } } }))
const ctx = await chromium.launchPersistentContext(PERFIL, {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
})
await ctx.route('https://web.whatsapp.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body><div id="app">WhatsApp de mentira</div></body></html>' }))
await ctx.route('**ensaio.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }))

let [fundo] = ctx.serviceWorkers()
if (!fundo) fundo = await ctx.waitForEvent('serviceworker', { timeout: 10000 })
const versaoDe = (sw) => Promise.race([sw.evaluate(() => chrome.runtime.getManifest().version).catch(() => ''), new Promise((r) => setTimeout(() => r(''), 1500))])
const versaoRodando = () => versaoDe(fundo)
const novos = []
ctx.on('serviceworker', (sw) => novos.push(sw))

const sistema = await ctx.newPage()
await sistema.goto(SITE + '/entrar', { waitUntil: 'domcontentloaded' })
await sistema.waitForTimeout(800)
await sistema.evaluate(() => {
  window.__mesmaPagina = true
  const q = document.createElement('iframe'); q.src = 'https://web.whatsapp.com/'; q.id = 'wa-quadro'; document.body.append(q)
})
await sistema.waitForTimeout(1200)
const quadro = () => sistema.frames().find((fr) => fr.url().startsWith('https://web.whatsapp.com'))
await quadro()?.evaluate(() => { window.__antes = true })
const wa = await ctx.newPage()
await wa.goto('https://web.whatsapp.com/')
await wa.evaluate(() => { window.__antes = true })

conta(await versaoRodando() === VERSAO && await sistema.evaluate(() => document.documentElement.dataset.fourtimeExtensao) === VERSAO,
  'a extensao carregou da pasta, na ' + VERSAO)

/* 4. sem mudar nada, 35 segundos depois continua a mesma, e o WhatsApp nao recarregou */
await sistema.waitForTimeout(35_000)
conta(await versaoRodando() === VERSAO && await wa.evaluate(() => window.__antes === true), 'sem versao nova, nada recarrega')

/* 1. a versao nova gravada na pasta */
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const NOVA = VERSAO.replace(/\d+$/, (n) => String(Number(n) + 1))
m.version = NOVA
writeFileSync(MANIFEST, JSON.stringify(m, null, 2))
const inicio = Date.now()
let novo = null
while (Date.now() - inicio < 45_000) {
  for (const sw of novos) if ((await versaoDe(sw)) === NOVA) novo = sw
  if (novo) break
  await sistema.waitForTimeout(1000)
}
conta(!!novo, `a extensao recarregou sozinha com a ${NOVA} em ${Math.round((Date.now() - inicio) / 1000)} s`)
await sistema.waitForTimeout(2500)

/* 2. o Fourtime OS sabe da versao nova, sem recarregar a pagina */
const marca = await sistema.evaluate(() => [document.documentElement.dataset.fourtimeExtensao, window.__mesmaPagina === true])
conta(marca[0] === NOVA && marca[1], 'a aba do Fourtime OS ganhou a marca da ' + NOVA + ' sem recarregar (' + marca.join(', ') + ')')

/* 3. o WhatsApp recarregou, na aba dele e no quadro dentro do Fourtime OS */
conta(await quadro()?.evaluate(() => window.__antes !== true).catch(() => false) && marca[1], 'o WhatsApp dentro do Fourtime OS recarregou, e a pagina do sistema nao')
conta(await wa.evaluate(() => window.__antes !== true).catch(() => false), 'a aba do WhatsApp recarregou com a extensao nova')

await ctx.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
