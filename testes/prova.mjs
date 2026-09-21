/* ==========================================================================
   A BANCADA: uma peca sozinha, com o CSS de verdade, fotografada.

   A conferencia de tokens le texto e nao ve tela torta. Esta ve: ela monta uma
   pagina com as folhas REAIS do sistema (tokens, base, menus, casca, mais a do
   modulo que voce pedir), poe o seu pedaco de HTML dentro, e fotografa em tres
   larguras e nos dois temas.

   E a diferenca entre "mudei o CSS" e "olhei o que mudou". Quase todo conserto
   bobo dos ultimos dez dias teria morrido aqui: texto invisivel sobre fundo
   escuro, borda que some, item que pula 1px, coluna que estoura em 390.

   Uso:
     node testes/prova.mjs pedaco.html                      so o DS
     node testes/prova.mjs pedaco.html modules/funil/funil  com a folha do modulo

   O pedaco.html e so o corpo. Sem <html>, sem <head>, sem <style>.
   As fotos saem em testes/prova/.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try {
      return require(onde)
    } catch {
      /* tenta o proximo */
    }
  }
  throw new Error('playwright nao encontrado')
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const [, , pedacoArg, ...folhas] = process.argv
if (!pedacoArg) {
  console.error('uso: node testes/prova.mjs pedaco.html [modules/funil/funil ...]')
  process.exit(1)
}

/* As folhas do Design System entram SEMPRE e nesta ordem, que e a mesma de
   estilo.css. Ordem trocada aqui daria um resultado que a tela de verdade nao
   da, e uma bancada que mente e pior que bancada nenhuma. */
const DO_SISTEMA = ['ds/tokens', 'ds/base', 'ds/menus', 'ds/casca']

const LARGURAS = [
  { nome: '390', largura: 390, altura: 900 },
  { nome: '820', largura: 820, altura: 900 },
  { nome: '1440', largura: 1440, altura: 950 },
]

const pedaco = await readFile(resolve(pedacoArg), 'utf8')
const css = [...DO_SISTEMA, ...folhas]
  .map((f) => '<link rel="stylesheet" href="file://' + join(raiz, 'src', f + '.css') + '">')
  .join('\n')

const pagina = `<!doctype html><html data-theme="light"><head><meta charset="utf-8">
${css}
<style>
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:14.5px;line-height:1.45}
  /* a regua: quem passar disto no celular estourou a tela */
  .prova-regua{position:fixed;inset:0 auto 0 390px;width:1px;background:color-mix(in srgb,var(--brand) 40%,transparent);z-index:9999;pointer-events:none}
</style></head><body>${pedaco}<i class="prova-regua"></i></body></html>`

const saida = join(raiz, 'testes/prova')
await rm(saida, { recursive: true, force: true })
await mkdir(saida, { recursive: true })
const arquivoDaPagina = join(saida, 'pagina.html')
await writeFile(arquivoDaPagina, pagina)

const { chromium } = pegarPlaywright()
const navegador = await chromium.launch()
const problemas = []

for (const tema of ['light', 'dark']) {
  for (const { nome, largura, altura } of LARGURAS) {
    const pg = await navegador.newPage({
      viewport: { width: largura, height: altura },
      deviceScaleFactor: 2,
    })
    await pg.goto('file://' + arquivoDaPagina)
    await pg.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
    await pg.waitForTimeout(250)

    /* ---------- o que da para medir sozinho ---------------------------- */
    const medidas = await pg.evaluate((larg) => {
      const achados = []
      /* 1. rolagem horizontal: o V7 proibe em 390, e a tabela e o kanban
            rolam DENTRO do conteiner, e nao na pagina. */
      if (document.documentElement.scrollWidth > larg + 1) {
        achados.push('a pagina rola para o lado: ' + document.documentElement.scrollWidth + 'px em ' + larg)
      }
      for (const el of document.querySelectorAll('body *')) {
        const c = getComputedStyle(el)
        if (c.display === 'none' || c.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (!r.width && !r.height) continue
        const onde = el.className && typeof el.className === 'string'
          ? el.tagName.toLowerCase() + '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
          : el.tagName.toLowerCase()

        /* 2. alvo de toque: 44px onde ha ponteiro grosso */
        const clicavel = el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button'
        if (clicavel && larg <= 820 && (r.height < 44 || r.width < 44) && r.height > 0) {
          achados.push('alvo de toque pequeno em ' + onde + ': ' + Math.round(r.width) + 'x' + Math.round(r.height))
        }

        /* 3. texto transbordando o proprio pai */
        if (r.right > document.documentElement.clientWidth + 1) {
          achados.push(onde + ' passa da borda direita em ' + Math.round(r.right - document.documentElement.clientWidth) + 'px')
        }
      }
      return [...new Set(achados)]
    }, largura)

    for (const m of medidas) problemas.push(tema + ' ' + nome + ': ' + m)
    await pg.screenshot({ path: join(saida, tema + '-' + nome + '.png'), fullPage: true })
    await pg.close()
  }
}
await navegador.close()

console.log('fotos em testes/prova/ (6: dois temas x 390, 820 e 1440)')
if (problemas.length) {
  console.log('\nmedido automaticamente:')
  for (const p of problemas) console.log('  ' + p)
}
console.log('\nAGORA OLHE AS FOTOS. O que a medicao nao ve: contraste, alinhamento,')
console.log('peso de fonte, espaco que ficou torto, cor que sumiu no tema escuro.')
