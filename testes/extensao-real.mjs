/* ==========================================================================
   O WHATSAPP DE VERDADE DENTRO DE UM QUADRO DO FOURTIME OS.

   Abre o web.whatsapp.com real num quadro de uma pagina no endereco do
   Fourtime OS (montada pelo teste), com a extensao carregada, e diz se o
   QR Code apareceu. Pede internet; num ambiente com proxy, usa o HTTPS_PROXY.
   Foi este teste que confirmou a 0.2.2 em 12/10/2026, depois do "a conexao
   foi recusada" da 0.2.1 no Chrome do Henrique.

   Uso:  node testes/extensao-real.mjs [foto.png]
   ========================================================================== */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
}
const { chromium } = pegarPlaywright()
import { mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
const EXT = resolve('extensao')
const px = process.env.HTTPS_PROXY ? new URL(process.env.HTTPS_PROXY) : null
const ctx = await chromium.launchPersistentContext(mkdtempSync('/tmp/real-'), {
  channel: 'chromium', headless: true, ignoreHTTPSErrors: true,
  ...(px ? { proxy: { server: px.protocol + '//' + px.host } } : {}),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 1300, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
})
if (!ctx.serviceWorkers().length) await ctx.waitForEvent('serviceworker')
await new Promise(r => setTimeout(r, 1500))
const p = await ctx.newPage()
p.on('console', m => { if (/error/i.test(m.type())) console.log('console:', m.text().slice(0, 200)) })
await p.route('https://fourtimeos.arte-adc.workers.dev/teste-whatsapp', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><iframe id="f" src="https://web.whatsapp.com/" style="width:1200px;height:800px"></iframe>' }))
await p.goto('https://fourtimeos.arte-adc.workers.dev/teste-whatsapp')
await p.waitForTimeout(20000)
const f = p.frames().find(x => x.url().startsWith('https://web.whatsapp.com'))
console.log('frame url:', f && f.url())
const r = f ? await f.evaluate(() => ({ qr: !!document.querySelector('canvas'), erro: /something went wrong/i.test(document.body.innerText), dentro: document.documentElement.classList.contains('fourtime-dentro') })).catch(() => null) : null
const certo = !!r && r.qr && !r.erro && r.dentro
console.log((certo ? 'ok   ' : 'RUIM ') + 'o WhatsApp de verdade abre dentro do Fourtime OS e mostra o QR Code (' + JSON.stringify(r) + ')')
process.exitCode = certo ? 0 : 1
if (process.argv[2]) await p.screenshot({ path: process.argv[2] })
await ctx.close()
