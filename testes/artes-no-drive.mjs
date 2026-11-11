/* AS ARTES DO ORÇAMENTO VÃO PARA O DRIVE (11/11/2026), do lado da tela.

   A ponte (worker/) tem a prova dela (testes/ponte-do-drive.mjs). Aqui a
   ponte é de mentira, montada nas rotas /api/arte do navegador, e o que se
   confere é o editor:

     1. com a ponte ligada, as artes que estão dentro da cotação sobem
        sozinhas, com o crachá e o hash, e o layout passa a guardar
        "drive:<id>"; a tela desenha pela ponte (/api/arte/<id>), com o
        crachá no cookie; salvar manda ao banco o texto curto
     2. com a ponte desligada, nada sobe e tudo fica como sempre foi
     3. na cotação aprovada, nada sobe
     4. arte recusada pela ponte fica dentro da cotação e não tenta de novo

   O banco é de mentira (testes/orcamento-dados.mjs).
   Uso: node testes/artes-no-drive.mjs http://127.0.0.1:4173 */

import { createRequire } from 'node:module'
import * as F from './orcamento-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of [
    'playwright',
    '/opt/npm-tools/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright',
  ]) {
    try {
      return require(onde)
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error('playwright não encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d4944415478da63f8cfc0f01f0005000201a2d9c4a20000000049454e44ae426082',
  'hex',
)

let ok = 0
const falhas = []
const conta = (cond, rot) => {
  console.log(`  ${cond ? 'ok  ' : 'RUIM'} ${rot}`)
  if (cond) ok++
  else falhas.push(rot)
}

async function abrir(nav, { ponte = true, recusa = false, cotacao = 'c1', aprovada = false } = {}) {
  const ctx = await nav.newContext({
    viewport: { width: 1600, height: 946 },
    reducedMotion: 'reduce',
    timezoneId: 'America/Sao_Paulo',
  })
  const banco = F.bancoDoOrcamento({ papel: 'admin', abertas: 6 })
  await ctx.route('**supabase.co/**', async r => {
    const req = r.request()
    const u = decodeURIComponent(req.url())
    const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    let corpo = null
    try {
      corpo = JSON.parse(req.postData() ?? 'null')
    } catch {
      /* não é JSON */
    }
    const resp = banco.responder(m, u, corpo)
    /* a cotação aprovada de verdade tem a aprovação no corpo (o banco de
       mentira só muda o estado da lista) */
    if (aprovada && resp && Array.isArray(resp.corpo)) {
      for (const linha of resp.corpo) {
        if (linha && linha.corpo && typeof linha.corpo === 'object') {
          linha.corpo = {
            ...linha.corpo,
            aprovacao: { em: '2026-10-08T11:00:00-03:00', quem: 'Dani', pedido: 'PD004410' },
          }
        }
      }
    }
    if (resp)
      return r.fulfill({
        status: resp.status,
        contentType: 'application/json',
        headers: CORS,
        body: resp.corpo === null ? '' : JSON.stringify(resp.corpo),
      })
    return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' })
  })
  const ponteLog = { subidas: [], entregas: [], saude: 0 }
  let n = 0
  await ctx.route('**/api/arte**', async r => {
    const req = r.request()
    const url = new URL(req.url())
    if (url.pathname === '/api/arte/saude') {
      ponteLog.saude++
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          ponte
            ? { pronto: true, modo: 'conta-de-servico' }
            : { pronto: false, motivo: 'sem-credencial' },
        ),
      })
    }
    if (url.pathname === '/api/arte' && req.method() === 'POST') {
      const h = req.headers()
      ponteLog.subidas.push({
        auth: h['authorization'],
        hash: h['x-arte-hash'],
        tipo: h['content-type'],
        nome: decodeURIComponent(h['x-arte-nome'] || ''),
        tamanho: (req.postDataBuffer() || Buffer.alloc(0)).length,
      })
      if (recusa)
        return r.fulfill({
          status: 415,
          contentType: 'application/json',
          body: JSON.stringify({ erro: 'Só imagem.' }),
        })
      return r.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'ARTE_DRIVE_' + String(++n).padStart(4, '0'), repetida: false }),
      })
    }
    if (url.pathname.startsWith('/api/arte/')) {
      ponteLog.entregas.push({ id: url.pathname.slice(10), cookie: req.headers()['cookie'] || '' })
      return r.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    }
    return r.fulfill({ status: 404, body: '' })
  })
  await ctx.addInitScript(
    c => {
      try {
        localStorage.setItem('ft.sessao', JSON.stringify(c))
        localStorage.setItem('ft.cotacoes.abertas', JSON.stringify(['c1', 'c6']))
      } catch {
        /* segue */
      }
    },
    {
      acesso: 'CRACHA_DE_TESTE',
      renovacao: 't',
      venceEm: Date.now() + 86400000,
      usuario: 't',
      email: 't@f',
    },
  )
  const pg = await ctx.newPage()
  await pg.clock.setFixedTime(new Date(F.HOJE_DA_PROVA))
  const erros = []
  pg.on('pageerror', e => erros.push(String(e).slice(0, 200)))
  await pg.goto(SITE + '/cotacao/' + cotacao, { waitUntil: 'networkidle' })
  await pg.waitForSelector('.ct-topo')
  await pg.waitForTimeout(1500)
  return { ctx, pg, banco, ponteLog, erros }
}

const nav = await chromium.launch()

console.log('\n  --- 1. a ponte ligada')
{
  const { ctx, pg, banco, ponteLog, erros } = await abrir(nav)
  const blocos = F.cotacaoDoAtletico().produtos.length
  conta(ponteLog.saude === 1, 'pergunta à ponte uma vez só: ' + ponteLog.saude)
  conta(
    ponteLog.subidas.length === blocos,
    'as ' + blocos + ' artes de dentro da cotação subiram sozinhas: ' + ponteLog.subidas.length,
  )
  conta(
    ponteLog.subidas.every(s => s.auth === 'Bearer CRACHA_DE_TESTE'),
    '  com o crachá de quem entrou',
  )
  conta(
    ponteLog.subidas.every(s => /^[a-f0-9]{64}$/.test(s.hash)),
    '  com o hash SHA-256 de cada uma',
  )
  conta(
    ponteLog.subidas.every(s => s.tipo.startsWith('image/') && s.tamanho > 0),
    '  com o tipo e os bytes da imagem',
  )
  const srcs = await pg.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map(i => i.getAttribute('src') || '')
      .filter(s => s.includes('/api/arte/') || s.startsWith('data:image')),
  )
  conta(
    srcs.length > 0 && srcs.every(s => s.startsWith('/api/arte/ARTE_DRIVE_')),
    'a tela desenha as artes pela ponte: ' + srcs.slice(0, 3).join(', '),
  )
  conta(
    ponteLog.entregas.length > 0 &&
      ponteLog.entregas.every(e => /(^|;\s*)ft_arte=CRACHA_DE_TESTE/.test(e.cookie)),
    'o <img> leva o crachá no cookie ft_arte',
  )
  conta(
    (await pg.locator('.ct-ponto-sujo').count()) === 1,
    'a cotação fica "não salva" (o banco ainda tem a arte inteira)',
  )
  await pg.getByRole('button', { name: 'Salvar, há mudança não salva' }).click()
  await pg.waitForTimeout(800)
  const salvo = banco.gravados.filter(x => x.u === 'cotacao' && x.corpo).pop()
  const corpo = JSON.stringify(salvo ? salvo.corpo : '')
  conta(
    !!salvo &&
      !corpo.includes('data:image') &&
      (corpo.match(/drive:ARTE_DRIVE_/g) || []).length === blocos,
    'salvar manda ao banco só "drive:<id>", sem nenhuma imagem dentro',
  )
  conta(corpo.length < 30000, '  e o corpo salvo ficou leve: ' + corpo.length + ' caracteres')
  conta(!erros.length, 'sem erro de JavaScript: ' + erros.join(' | '))
  await ctx.close()
}

console.log('\n  --- 2. a ponte desligada')
{
  const { ctx, pg, ponteLog, erros } = await abrir(nav, { ponte: false })
  conta(ponteLog.subidas.length === 0, 'nada sobe')
  const srcs = await pg.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map(i => i.getAttribute('src') || '')
      .filter(s => s.startsWith('data:image')),
  )
  conta(srcs.length > 0, 'as artes continuam dentro da cotação, como sempre')
  conta((await pg.locator('.ct-ponto-sujo').count()) === 0, 'e a cotação não fica "não salva"')
  conta(!erros.length, 'sem erro de JavaScript')
  await ctx.close()
}

console.log('\n  --- 3. a cotação aprovada')
{
  const { ctx, pg, ponteLog } = await abrir(nav, { aprovada: true })
  conta((await pg.locator('.ct-topo').count()) === 1, 'a cotação aprovada abriu')
  conta(ponteLog.subidas.length === 0, 'nada sobe: ela não se salva mais')
  await ctx.close()
}

console.log('\n  --- 4. a ponte recusa')
{
  const { ctx, pg, ponteLog, erros } = await abrir(nav, { recusa: true })
  const primeira = ponteLog.subidas.length
  conta(primeira > 0, 'tentou subir: ' + primeira)
  await pg.waitForTimeout(1200)
  conta(ponteLog.subidas.length === primeira, 'e não tenta de novo na mesma visita')
  const srcs = await pg.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map(i => i.getAttribute('src') || '')
      .filter(s => s.startsWith('data:image')),
  )
  conta(srcs.length > 0, 'a arte fica dentro da cotação')
  conta(!erros.length, 'sem erro de JavaScript')
  await ctx.close()
}

await nav.close()
console.log(`\n  ${ok} conferências passaram`)
if (falhas.length) {
  console.log(`  FALHARAM ${falhas.length}:\n    - ${falhas.join('\n    - ')}`)
  process.exit(1)
}
console.log('  artes no Drive: tudo certo')
