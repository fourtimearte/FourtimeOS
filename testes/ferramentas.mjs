/* ==========================================================================
   O TESTE DAS FERRAMENTAS.

   A calculadora de DTF e o menu de Configuracoes, em tres larguras e nos dois
   temas, contra o site no ar e com um banco de mentira.

   O QUE ELE MEDE:

     1. em nenhuma largura a pagina rola de lado
     2. 2 m e 16 cm a R$ 60,00 da R$ 129,60, partido em 120,00 + 9,60
     3. o preco abre com o de Configuracoes, e trocar na tela avisa que e
        manual; "Voltar para ele" desfaz
     4. o atalho +50 cm soma, e nao troca
     5. numero torto mostra o aviso, e nao um valor inventado
     6. as duas caixas da medida tem a mesma altura; no computador o
        resultado fica ao lado, no celular embaixo
     7. o menu lateral mostra a secao Ferramentas e as NOVE paginas de
        Configuracoes (era quatro)
     8. Configuracoes > Ferramentas grava dtf.metro na regulagem

   Uso:  node testes/ferramentas.mjs
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

const PAGINAS = ['inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban','produtos','estoque','atividades','relatorio','banco','config','kit']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = {ver:true,editar:true,deletar:true,total:true})
const PERFIL = [{ id:'1', nome:'Henrique', papel:'admin', situacao:'aprovado', paineis:PAGINAS, permissoes, email:'t@f', foto_em:null }]

const CONFIG_ESPERADA = ['Pessoas','Acessos','Tags do quadro','Banco de dados','Empresa','Páginas','Ferramentas','Ensaio','Design System']

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440,900,'computador'], [768,1024,'tablet'], [390,844,'celular']]) {
    const ctx = await nav.newContext({
      viewport:{width:larg,height:alt}, reducedMotion:'reduce', hasTouch: nome !== 'computador',
    })
    let gravou = null
    await ctx.route('**supabase.co/**', async (r) => {
      const req = r.request(); const u = req.url(); const m = req.method()
      let corpo = []
      if (u.includes('meu_perfil')) corpo = PERFIL
      else if (u.includes('/regulagem') && m === 'POST') {
        try { gravou = JSON.parse(req.postData() || 'null') } catch { gravou = 'ilegivel' }
        corpo = [{ valor: gravou?.valor, atualizado_em: new Date().toISOString() }]
      }
      else if (u.includes('/regulagem') && u.includes('dtf.metro')) corpo = [{ valor:'60.00', atualizado_em:'2026-09-29T14:30:00Z' }]
      return r.fulfill({ status:200, contentType:'application/json',
        headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
    })
    await ctx.addInitScript(([c, t])=>{ try{
      localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
    }catch{} }, [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }, tema])

    const pg = await ctx.newPage()
    await pg.goto(SITE + '/ferramentas', { waitUntil:'networkidle' })
    await pg.waitForTimeout(1200)
    const aqui = `${tema} ${nome}:`

    conta(pg.url().endsWith('/ferramentas/dtf'), `${aqui} /ferramentas leva para a calculadora`)

    /* 1 */
    const lado = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    conta(lado <= 1, `${aqui} sem rolagem de lado (${lado}px a mais)`)

    const campos = pg.locator('.dtf-caixa input')
    const valor = () => pg.locator('.dtf-valor').textContent().then(limpo)
    const preco = () => campos.nth(2).inputValue()

    /* 3, a origem */
    conta((await preco()) === '60,00', `${aqui} o preco abre com o de Configuracoes (${await preco()})`)

    /* 2 */
    await campos.nth(0).fill('2')
    await campos.nth(1).fill('16')
    await pg.waitForTimeout(250)
    conta((await valor()) === 'R$ 129,60', `${aqui} 2 m e 16 cm a 60 = R$ 129,60 (${await valor()})`)
    const como = limpo(await pg.locator('.dtf-como').textContent())
    conta(como === '2 m e 16 cm × R$ 60,00 o metro', `${aqui} a conta escrita: "${como}"`)
    const partes = limpo(await pg.locator('.dtf-partes').textContent().catch(() => ''))
    conta(partes.includes('R$ 120,00') && partes.includes('R$ 9,60'), `${aqui} partida em 120,00 + 9,60 ("${partes}")`)

    /* 6 */
    const caixas = await pg.$$eval('.dtf-medidas .dtf-caixa', (els) => els.map((e) => e.getBoundingClientRect().height))
    conta(caixas.length === 2 && caixas[0] === caixas[1], `${aqui} as duas caixas da medida com a mesma altura (${caixas.join(', ')})`)
    const lados = await pg.$$eval('.dtf-lado', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top } }))
    const juntos = Math.abs(lados[0].y - lados[1].y) < 2 && lados[1].x > lados[0].x
    if (nome === 'celular') conta(!juntos && lados[1].y > lados[0].y, `${aqui} no celular o resultado fica embaixo`)
    if (nome === 'computador') conta(juntos, `${aqui} no computador o resultado fica ao lado`)

    /* 3, o manual */
    await campos.nth(2).fill('55')
    await pg.waitForTimeout(250)
    conta((await valor()) === 'R$ 118,80', `${aqui} preco manual 55 da R$ 118,80 (${await valor()})`)
    const aviso = limpo(await pg.locator('.dtf-origem').textContent())
    conta(aviso.startsWith('Preço manual') && aviso.includes('R$ 60,00'), `${aqui} avisa que o preco e manual`)
    await pg.locator('.dtf-voltar').click()
    await pg.waitForTimeout(250)
    conta((await preco()) === '60,00' && (await valor()) === 'R$ 129,60', `${aqui} "Voltar para ele" desfaz`)

    /* 4 */
    await pg.locator('.dtf-atalhos button', { hasText: '+50 cm' }).click()
    await pg.waitForTimeout(250)
    conta((await valor()) === 'R$ 159,60' && (await campos.nth(1).inputValue()) === '66',
      `${aqui} +50 cm soma: 2 m e 66 cm = ${await valor()}`)

    /* toque: os atalhos tem que caber o dedo */
    if (nome !== 'computador') {
      const alt = await pg.$$eval('.dtf-atalhos button', (els) => Math.min(...els.map((e) => e.getBoundingClientRect().height)))
      conta(alt >= 40, `${aqui} atalhos com ${alt}px de altura`)
    }

    await pg.screenshot({ path: `${PASTA}/ferramentas-dtf-${tema}-${nome}.png`, fullPage: true })

    /* 5 */
    await campos.nth(0).fill('2,1,6')
    await pg.waitForTimeout(250)
    const erro = await pg.locator('.dtf-erro').count()
    conta(erro === 1 && (await pg.locator('.dtf-resultado.apagado').count()) === 1,
      `${aqui} numero torto mostra aviso e apaga o resultado`)

    /* 7: o menu lateral mora no computador; no toque, a barra de baixo */
    if (nome === 'computador') {
      const tudo = await pg.evaluate(() => document.body.innerText)
      conta(tudo.includes('Ferramentas') && tudo.includes('Calculadora de DTF'), `${aqui} secao Ferramentas no menu`)
      /* abre o galho de Configuracoes e le os filhos */
      await pg.goto(SITE + '/config/ferramentas', { waitUntil:'networkidle' })
      await pg.waitForTimeout(1200)
      const filhos = await pg.evaluate((esperados) => {
        const textos = [...document.querySelectorAll('a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim())
        return esperados.filter((e) => textos.filter((t) => t === e).length < 2)
      }, CONFIG_ESPERADA)
      conta(filhos.length === 0, `${aqui} as nove paginas de Configuracoes no menu E nas abas${filhos.length ? ' (faltam: ' + filhos.join(', ') + ')' : ''}`)
    } else {
      /* a barra de baixo: nenhum nome cortado, e a calculadora nos tres pontos */
      const barra = await pg.$$eval('.rodape-nav > a, .rodape-nav > button', (els) => els.map((e) => {
        const s = e.querySelector('span')
        return { texto: e.textContent.trim(), cortado: !!s && s.scrollWidth > s.clientWidth + 1 }
      }))
      const cortados = barra.filter((b) => b.cortado).map((b) => b.texto)
      conta(barra.length > 0 && !cortados.length, `${aqui} barra de baixo sem nome cortado${cortados.length ? ' (' + cortados.join(', ') + ')' : ''}`)
      await pg.locator('.rodape-nav button', { hasText: 'Mais' }).click()
      await pg.waitForTimeout(400)
      const noMais = await pg.locator('.pe-arvore', { hasText: 'Calculadora de DTF' }).count()
      conta(noMais === 1, `${aqui} a calculadora mora nos tres pontos da barra`)
      await pg.goto(SITE + '/config/ferramentas', { waitUntil:'networkidle' })
      await pg.waitForTimeout(1200)
    }

    /* 8 */
    const campo = pg.locator('.cfg-grade input')
    conta((await campo.inputValue()) === '60,00', `${aqui} Configuracoes le 60,00`)
    await campo.fill('62,5')
    await pg.getByRole('button', { name: 'Salvar' }).click()
    await pg.waitForTimeout(700)
    conta(gravou?.chave === 'dtf.metro' && gravou?.valor === '62.50', `${aqui} Salvar grava dtf.metro = 62.50 (${JSON.stringify(gravou)})`)
    const lado2 = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    conta(lado2 <= 1, `${aqui} Configuracoes > Ferramentas sem rolagem de lado`)
    await pg.screenshot({ path: `${PASTA}/ferramentas-config-${tema}-${nome}.png`, fullPage: true })

    await ctx.close()
  }
}
await nav.close()

const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} medidas certas`)
process.exit(ruins.length ? 1 : 0)
