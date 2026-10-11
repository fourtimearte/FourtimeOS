/* ==========================================================================
   A TRAVA DO WHATSAPP, COM REDE DE VERDADE.

   O WhatsApp Web manda "X-Frame-Options: DENY": o navegador recusa mostrar
   ele dentro de outro site. A extensao Fourtime OS tira essa trava SO quando
   quem abre o quadro e o endereco do Fourtime OS (extensao/regras.json).

   Resposta montada pelo Playwright nao passa pela regra da extensao, entao
   este teste sobe um servidor HTTPS de mentira no lugar do web.whatsapp.com
   (o Chromium e apontado para ele), com a mesma trava, e confere tres coisas:
     1. sem a extensao, o Fourtime OS NAO consegue abrir o WhatsApp no quadro;
     2. com a extensao, consegue;
     3. com a extensao, OUTRO SITE continua sem conseguir.

   Uso:  node testes/extensao-trava.mjs   (pede o openssl)
   ========================================================================== */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer as https } from 'node:https'
import { createServer as http } from 'node:http'
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
const EXT = resolve('extensao')

const pasta = mkdtempSync(join(tmpdir(), 'trava-'))
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(pasta, 'k.pem'),
  '-out', join(pasta, 'c.pem'), '-days', '1', '-subj', '/CN=web.whatsapp.com'], { stdio: 'ignore' })

const WA = '<!doctype html><html><body><div id="app"><div id="main">o WhatsApp de mentira</div></div></body></html>'
const falso = https({ key: readFileSync(join(pasta, 'k.pem')), cert: readFileSync(join(pasta, 'c.pem')) }, (_q, r) => {
  r.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'DENY' })
  r.end(WA)
}).listen(8443, '127.0.0.1')

/* o Fourtime OS (127.0.0.1, que a regra aceita) e um intruso (127.0.0.3) */
const QUADRO = '<!doctype html><iframe src="https://web.whatsapp.com/" style="width:500px;height:300px"></iframe>'
const sistema = http((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(QUADRO) }).listen(8098, '127.0.0.1')
const intruso = http((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(QUADRO) }).listen(8099, '127.0.0.3')

const achados = []
const conta = (certo, texto) => { achados.push(certo); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abre(comExtensao, endereco) {
  const args = ['--host-resolver-rules=MAP web.whatsapp.com:443 127.0.0.1:8443', '--ignore-certificate-errors', '--no-proxy-server']
  if (comExtensao) args.push(`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`)
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'trava-perfil-')), {
    channel: 'chromium', headless: true, args, ignoreHTTPSErrors: true,
  })
  if (comExtensao && !ctx.serviceWorkers().length) await ctx.waitForEvent('serviceworker', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 1200))
  const p = await ctx.newPage()
  await p.goto(endereco)
  await p.waitForTimeout(2500)
  const f = p.frames().find((x) => x.url().startsWith('https://web.whatsapp.com'))
  const abriu = f ? await f.evaluate(() => !!document.querySelector('#main')).catch(() => false) : false
  await ctx.close()
  return abriu
}

try {
  conta(!(await abre(false, 'http://127.0.0.1:8098/')), 'sem a extensão, o WhatsApp não abre dentro do Fourtime OS (a trava vale)')
  conta(await abre(true, 'http://127.0.0.1:8098/'), 'com a extensão, o WhatsApp abre dentro do Fourtime OS')
  conta(!(await abre(true, 'http://127.0.0.3:8099/')), 'com a extensão, outro site continua sem conseguir')
} finally {
  falso.close(); sistema.close(); intruso.close()
}
const ruins = achados.filter((x) => !x).length
console.log(`\n${achados.length - ruins} de ${achados.length} certos`)
process.exit(ruins ? 1 : 0)
