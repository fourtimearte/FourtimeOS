/* ==========================================================================
   Teste visual do /kit.

   Tira uma foto de cada secao do kit, nos dois temas, e guarda em
   testes/atual/. Depois o comparar.py confere contra testes/fotos/, que sao as
   fotos aprovadas, e aponta o que mudou.

   Nao entra no `npm run build`: build e para publicar, e navegador dentro do
   build de publicacao so atrasa deploy. Este roda antes de subir.

   Uso:
     node testes/visual.mjs                     usa o site publicado
     node testes/visual.mjs http://127.0.0.1:5173   usa o servidor local
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const AQUI = dirname(fileURLToPath(import.meta.url))
const SAIDA = resolve(AQUI, 'atual')

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'

/* as secoes do kit, na ordem do rail */
const SECOES = [
  'cor',
  'tecnicas',
  'medida',
  'tipografia',
  'botoes',
  'chips',
  'campos',
  'marcacao',
  'segmentado',
  'cartoes',
  'selos',
  'tabela',
  'sobreposicoes',
  'recados',
  'buscaglobal',
  'estados',
  'menus',
]

const TEMAS = [
  ['light', 'gelo'],
  ['dark', 'grafite'],
]

/* telas do sistema que tambem entram na foto, alem do kit */
const TELAS = [
  ['/', 'inicio'],
  ['/clientes', 'clientes'],
  ['/cotacao', 'cotacao'],
  /* o editor com uma cotacao de exemplo. O numero e sempre o mesmo porque a
     base de exemplo nasce do mesmo molde toda vez */
  ['/cotacao/CT20260183', 'cotacao-editor'],
]

async function main() {
  await rm(SAIDA, { recursive: true, force: true })
  await mkdir(SAIDA, { recursive: true })

  const navegador = await chromium.launch()
  let erros = 0

  for (const [tema, rotulo] of TEMAS) {
    const ctx = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      /* sem animacao: foto de coisa que se move nunca bate duas vezes */
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem(
            'ft.sessao',
            JSON.stringify({ usuario: 'admin', desde: 1700000000000 }),
          )
          localStorage.setItem('ft.tema', t)
        } catch {
          /* armazenamento bloqueado */
        }
      },
      [tema],
    )
    /* a fonte vem do Google e pode nao existir no ambiente: nao vale travar a
       foto esperando por ela */
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA ' + rotulo + ': ' + e.message)
      erros++
    })
    await p.goto(SITE + '/kit', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(900)

    for (const id of SECOES) {
      const el = await p.$('#' + id)
      if (!el) {
        console.log('  secao sumiu: ' + id)
        erros++
        continue
      }
      await el.scrollIntoViewIfNeeded()
      /* rolagem quebrada em meio pixel muda o desenho da letra e faz a foto
         nao bater duas vezes: arredonda antes de fotografar */
      await p.evaluate(() => window.scrollTo(0, Math.round(window.scrollY)))
      await p.waitForTimeout(250)
      await el.screenshot({ path: SAIDA + '/' + id + '-' + rotulo + '.png' })
    }

    const rolando = await p.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    if (rolando) {
      console.log('  a pagina rola para o lado em 1440 no ' + rotulo)
      erros++
    }
    await ctx.close()
  }

  /* as telas do sistema, a pagina inteira, nos dois temas */
  for (const [tema, rotulo] of TEMAS) {
    const ctx = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem(
            'ft.sessao',
            JSON.stringify({ usuario: 'admin', desde: 1700000000000 }),
          )
          localStorage.setItem('ft.tema', t)
          localStorage.setItem('ft.menu', 'aberto')
        } catch {
          /* armazenamento bloqueado */
        }
      },
      [tema],
    )
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA ' + rotulo + ': ' + e.message)
      erros++
    })
    for (const [rota, nome] of TELAS) {
      await p.goto(SITE + rota, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(700)
      await p.screenshot({ path: SAIDA + '/tela-' + nome + '-' + rotulo + '.png', fullPage: true })
      const rolando = await p.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (rolando) {
        console.log('  a tela ' + nome + ' rola para o lado em 1440 no ' + rotulo)
        erros++
      }
    }
    await ctx.close()
  }

  /* o celular inteiro, numa foto so: e onde a largura quebra primeiro */
  for (const [largura, alt, nome] of [
    [390, 844, '390'],
    [820, 1180, '820'],
  ]) {
    const ctx = await navegador.newContext({
      viewport: { width: largura, height: alt },
      isMobile: largura < 500,
      hasTouch: largura < 500,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('ft.sessao', JSON.stringify({ usuario: 'admin', desde: 1700000000000 }))
        localStorage.setItem('ft.tema', 'light')
      } catch {
        /* idem */
      }
    })
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA em ' + nome + ': ' + e.message)
      erros++
    })
    for (const [rota, chapa] of [['/kit', 'pagina'], ...TELAS.map(([r, n]) => [r, 'tela-' + n])]) {
      await p.goto(SITE + rota, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(900)
      await p.screenshot({ path: SAIDA + '/' + chapa + '-' + nome + '.png', fullPage: true })
      const rolando = await p.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (rolando) {
        console.log('  ' + rota + ' rola para o lado em ' + nome)
        erros++
      }
    }
    await ctx.close()
  }

  await navegador.close()
  console.log('fotos tiradas em testes/atual')
  if (erros) {
    console.log('x ' + erros + ' problema(s) antes mesmo de comparar')
    process.exit(1)
  }
}

main()
