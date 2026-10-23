/* ==========================================================================
   A SEÇÃO COMPORTAMENTO DA ROTA /kit (23/10/2026): a Tabela do Design System
   com a seleção de linhas, e a pergunta de apagar na página.

   O QUE ELA MEDE, com o mouse e o teclado de verdade:

     1. clique na linha marca e alterna; a caixa também
     2. Shift + clique pega a faixa desde a última clicada
     3. Ctrl + clique junta uma linha solta sem perder as outras
     4. Esc solta todas; Ctrl + A marca as à vista; a caixa do cabeçalho marca
        e solta todas, e fica "meio marcada" quando só parte está
     5. ordenar uma coluna muda a faixa do Shift (a ordem é a da tela)
     6. Apagar abre a pergunta na página, Manter fecha sem apagar, Apagar tira
        as linhas marcadas
     7. nada rola de lado, em 390, 820 e 1440, nos dois temas, sem erro de
        JavaScript, com uma foto de cada

   Uso:  node testes/kit-comportamento.mjs http://127.0.0.1:4173
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/fotos'
mkdirSync(PASTA, { recursive: true })

const CRACHA = { acesso: 'kit.de.teste', renovacao: 'kit.de.teste', venceEm: Date.now() + 86_400_000, usuario: 'teste', email: 'teste@fourtime' }
const PERFIL = [{ id: '00000000-0000-0000-0000-000000000001', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: ['inicio', 'kit'], email: 'teste@fourtime', foto_em: null }]

let certos = 0
let ruins = 0
const conta = (ok, texto) => { if (ok) certos++; else ruins++; console.log((ok ? 'ok   ' : 'RUIM ') + texto) }

const navegador = await chromium.launch()

async function abrir(tema, largura) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(([t, c]) => {
    try { localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t) } catch { /* sem armazenamento */ }
  }, [tema, CRACHA])
  await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
  await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
  await ctx.route('**supabase.co/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(r.request().url().includes('meu_perfil') ? PERFIL : []),
  }))
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  await pg.goto(SITE + '/kit#comportamento', { waitUntil: 'networkidle' })
  await pg.locator('#comportamento').scrollIntoViewIfNeeded()
  await pg.waitForTimeout(400)
  return { ctx, pg, erros }
}

const secao = (pg) => pg.locator('#comportamento')
const marcadas = (pg) => secao(pg).evaluate((s) => [...s.querySelectorAll('tbody tr[aria-selected="true"]')].map((t) => t.querySelector('td:nth-child(2)').innerText.trim()))
const linha = (pg, pedido) => secao(pg).locator('tbody tr', { hasText: pedido }).locator('td:nth-child(3)')

/* --- o comportamento, uma vez, no computador -------------------------------- */
{
  const { ctx, pg, erros } = await abrir('light', 1440)
  conta(JSON.stringify(await marcadas(pg)) === '["2.480"]', 'abre com a 2.480 marcada: ' + await marcadas(pg))
  await linha(pg, '2.480').click()
  conta((await marcadas(pg)).length === 0, 'clique na linha marcada solta ela')
  await linha(pg, '2.481').click()
  await linha(pg, '2.478').click({ modifiers: ['Shift'] })
  conta(JSON.stringify(await marcadas(pg)) === '["2.481","2.480","2.479","2.478"]', 'Shift + clique pega a faixa toda: ' + await marcadas(pg))
  await linha(pg, '2.479').click({ modifiers: ['Control'] })
  conta(JSON.stringify(await marcadas(pg)) === '["2.481","2.480","2.478"]', 'Ctrl + clique tira uma do meio e deixa as outras: ' + await marcadas(pg))
  const meio = await secao(pg).locator('thead input[type="checkbox"]').evaluate((i) => i.indeterminate)
  conta(meio, 'com parte marcada, a caixa do cabeçalho fica meio marcada')
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(100)
  conta((await marcadas(pg)).length === 0, 'Esc solta todas')
  await pg.keyboard.press('Control+a')
  await pg.waitForTimeout(100)
  conta((await marcadas(pg)).length === 4, 'Ctrl + A marca as quatro à vista: ' + (await marcadas(pg)).length)
  await secao(pg).locator('thead .ck').click()
  conta((await marcadas(pg)).length === 0, 'a caixa do cabeçalho solta todas')
  await secao(pg).locator('thead .ck').click()
  conta((await marcadas(pg)).length === 4, 'e marca todas de novo')
  await secao(pg).locator('thead .ck').click()
  /* a caixa da linha alterna só ela */
  await secao(pg).locator('tbody tr', { hasText: '2.479' }).locator('.ck').click()
  conta(JSON.stringify(await marcadas(pg)) === '["2.479"]', 'a caixa da linha marca só ela')
  /* a ordem da tela: ordenando por cliente, a faixa do Shift segue a nova ordem */
  await secao(pg).locator('thead th', { hasText: 'Cliente' }).click()
  await pg.waitForTimeout(150)
  await secao(pg).locator('tbody tr', { hasText: '2.479' }).locator('.ck').click()
  await linha(pg, '2.481').click()
  await linha(pg, '2.478').click({ modifiers: ['Shift'] })
  const ordem = await marcadas(pg)
  conta(JSON.stringify(ordem) === '["2.481","2.478"]', 'ordenado por cliente, o Shift pega a faixa na ordem da tela (Delta, Prefeitura): ' + ordem)
  /* apagar pergunta na página */
  await secao(pg).getByRole('button', { name: 'Apagar' }).click()
  await pg.waitForTimeout(150)
  const perg = await secao(pg).locator('.pergunta-apagar').innerText().catch(() => '')
  conta(/Apagar os pedidos/.test(perg) && /2\.481/.test(perg) && /2\.478/.test(perg), 'Apagar abre a pergunta na página, com os pedidos: ' + perg.replace(/\s+/g, ' '))
  await secao(pg).locator('.pergunta-apagar').getByRole('button', { name: 'Manter' }).click()
  conta(await secao(pg).locator('.pergunta-apagar').count() === 0 && await secao(pg).locator('tbody tr').count() === 4, 'Manter fecha a pergunta e não apaga nada')
  await secao(pg).getByRole('button', { name: 'Apagar' }).click()
  await secao(pg).locator('.pergunta-apagar').getByRole('button', { name: 'Apagar' }).click()
  await pg.waitForTimeout(150)
  conta(await secao(pg).locator('tbody tr').count() === 2 && (await marcadas(pg)).length === 0, 'Apagar tira as duas marcadas e solta a seleção')
  await secao(pg).getByRole('button', { name: 'Trazer o exemplo de volta' }).click()
  conta(await secao(pg).locator('tbody tr').count() === 4, 'o exemplo volta inteiro')
  conta(!erros.length, 'sem erro de JavaScript: ' + erros.join(' | '))
  await ctx.close()
}

/* --- a cara, em três larguras e dois temas -------------------------------- */
for (const tema of ['light', 'dark']) {
  for (const largura of [390, 820, 1440]) {
    const { ctx, pg, erros } = await abrir(tema, largura)
    await linha(pg, '2.481').click()
    await secao(pg).getByRole('button', { name: 'Apagar' }).click()
    await pg.waitForTimeout(200)
    const sobra = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    conta(sobra <= 0, `${tema} ${largura}: a página não rola de lado (${sobra})`)
    conta(!erros.length, `${tema} ${largura}: sem erro de JavaScript ${erros.join(' | ')}`)
    await secao(pg).screenshot({ path: `${PASTA}/kit-comportamento-${largura}-${tema}.png` })
    await ctx.close()
  }
}

await navegador.close()
console.log(`\n${certos} de ${certos + ruins} certos`)
process.exit(ruins ? 1 : 0)
