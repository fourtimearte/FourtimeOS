/* ==========================================================================
   ESQUECI A SENHA (12/10/2026), com o Supabase de mentira: o link na tela de
   entrada, o pedido do link (/auth/v1/recover, que volta para /nova-senha), o
   link vencido, e a senha nova gravada (/auth/v1/user) entrando no sistema.
   Fotos em 1440 e 390, nos dois temas.

   Uso:  node testes/senha.mjs http://127.0.0.1:4173
   ========================================================================== */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/fotos'
mkdirSync(PASTA, { recursive: true })

const PAGINAS = ['inicio']
const permissoes = { inicio: { ver: true, editar: true, deletar: true, total: true } }
const PERFIL = [{ id: 'U1', nome: 'Dani', papel: 'vendedor', situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 'dani@f', foto_em: null }]
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir({ tema, larg, alt }) {
  const pedidos = []
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, reducedMotion: 'reduce', hasTouch: larg < 1024 })
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    let corpo = []
    if (u.includes('/auth/v1/recover')) { pedidos.push({ u, corpo: JSON.parse(req.postData() ?? '{}') }); corpo = {} }
    else if (u.includes('/auth/v1/user') && m === 'GET') corpo = { id: 'U1', email: 'dani@fourtimefit.com.br' }
    else if (u.includes('/auth/v1/user') && m === 'PUT') { pedidos.push({ u: 'trocar', corpo: JSON.parse(req.postData() ?? '{}'), auth: req.headers()['authorization'] }); corpo = { id: 'U1' } }
    else if (u.includes('meu_perfil')) corpo = PERFIL
    return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript((t) => { try { localStorage.setItem('ft.tema', t) } catch { /* sem armazenamento */ } }, tema)
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  return { ctx, pg, erros, pedidos }
}

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440, 900, 'computador'], [390, 844, 'celular']]) {
    const T = `${tema} ${nome}:`
    const { ctx, pg, erros, pedidos } = await abrir({ tema, larg, alt })
    await pg.goto(SITE + '/entrar', { waitUntil: 'networkidle' })
    await pg.locator('.ent-pe a', { hasText: 'Esqueci a senha' }).click()
    await pg.waitForURL(/\/esqueci-a-senha$/)
    conta(true, `${T} a entrada leva a Esqueci a senha`)
    await pg.locator('.ent-botao').click()
    conta(/Escreva o e-mail/.test(await pg.locator('.ent-recado').innerText()), `${T} sem e-mail, pede o e-mail`)
    await pg.fill('input[name=email]', ' Dani@FourtimeFit.com.br ')
    await pg.locator('.ent-botao').click()
    await pg.waitForSelector('.ent-certo')
    const p = pedidos[0]
    conta(!!p && p.corpo.email === 'dani@fourtimefit.com.br' && p.u.includes('redirect_to=' + SITE + '/nova-senha'), `${T} manda o pedido com o e-mail limpo e a volta para /nova-senha (${p?.u.split('?')[1]})`)
    conta(/Se este e-mail tem conta/.test(await pg.locator('.ent-certo').innerText()), `${T} a resposta não conta se a conta existe`)
    conta(await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${T} não rola de lado`)
    await pg.screenshot({ path: `${PASTA}/senha-pedido-${tema}-${nome}.png` })

    /* o link vencido */
    await pg.goto(SITE + '/nova-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'networkidle' })
    await pg.waitForSelector('.ent-recado')
    conta(/já venceu ou já foi usado/.test(await pg.locator('.ent-recado').innerText()) && await pg.locator('.ent-pe a', { hasText: 'Pedir um link novo' }).count() === 1, `${T} o link vencido explica e oferece pedir outro`)

    /* o link bom: senha curta, diferente, e a certa (o link chega numa aba
       nova; mudar so o fragmento na mesma pagina nao recarrega) */
    await pg.goto('about:blank')
    await pg.goto(SITE + '/nova-senha#access_token=tok-acesso&refresh_token=tok-renova&expires_in=3600&token_type=bearer&type=recovery', { waitUntil: 'networkidle' })
    await pg.waitForSelector('input[name=senha]')
    conta(!/access_token/.test(pg.url()) && /\/nova-senha$/.test(pg.url()), `${T} o cracha sai do endereço depois de lido (${pg.url().replace(SITE, '')})`)
    conta(/dani@fourtimefit\.com\.br/.test(await pg.locator('.ent-linha').innerText()), `${T} diz de qual conta é a senha`)
    await pg.screenshot({ path: `${PASTA}/senha-nova-${tema}-${nome}.png` })
    await pg.fill('input[name=senha]', 'curta')
    await pg.locator('.ent-botao').click()
    conta(/pelo menos 8/.test(await pg.locator('.ent-recado').innerText()), `${T} senha curta não vai`)
    await pg.fill('input[name=senha]', 'senha-nova-123')
    await pg.fill('input[name=repetida]', 'senha-nova-12')
    await pg.locator('.ent-botao').click()
    conta(/não são iguais/.test(await pg.locator('.ent-recado').innerText()), `${T} as duas precisam ser iguais`)
    await pg.fill('input[name=repetida]', 'senha-nova-123')
    await pg.locator('.ent-botao').click()
    await pg.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {})
    const troca = pedidos.find((x) => x.u === 'trocar')
    conta(!!troca && troca.corpo.password === 'senha-nova-123' && troca.auth === 'Bearer tok-acesso', `${T} grava a senha nova com o crachá do link`)
    await pg.waitForTimeout(800)
    conta(new URL(pg.url()).pathname === '/' && !(await pg.locator('.ent-cartao').count()), `${T} depois de gravar, já entra no sistema (${pg.url().replace(SITE, '')})`)
    /* o link que cai na raiz (endereco fora da lista do Supabase) vai para /nova-senha */
    await ctx.clearCookies()
    await pg.evaluate(() => localStorage.removeItem('ft.sessao'))
    await pg.goto('about:blank')
    await pg.goto(SITE + '/#access_token=tok-2&refresh_token=r-2&expires_in=3600&type=recovery', { waitUntil: 'networkidle' })
    await pg.waitForSelector('input[name=senha]', { timeout: 8000 }).catch(() => {})
    conta(/\/nova-senha$/.test(pg.url()) && await pg.locator('input[name=senha]').count() === 1, `${T} o link que cai na raiz vai para a senha nova (${pg.url().replace(SITE, '')})`)
    conta(!erros.length, `${T} sem erro de JavaScript (${erros.join(' | ')})`)
    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} certos`)
process.exit(ruins.length ? 1 : 0)
