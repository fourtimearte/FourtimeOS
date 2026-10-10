/* ==========================================================================
   O EDITOR DO ORÇAMENTO CONTRA O WIREFRAME FECHADO (pranchas 109 e 75,
   decisões 155, 156, 159, 161 e 163). Parte 2 da construção: a casca.

   O QUE ELA CONFERE
     1. o cabeçalho com o resumo: 84 px, as portas, as células e os números da
        cotação; os quatro botões em duas fileiras, a de cima no topo do
        cabeçalho e a de baixo no pé; tudo dentro dos 946 px de uma tela 1080p
     2. a fileira das cotações abertas: a aberta com o X, as que não cabem nos
        três pontos (decisão 138), a engrenagem só para o administrador
     3. o modal dos dados: abre pelas duas portas, foco no X, clicar fora NÃO
        fecha, Cancelar e Esc devolvem o que estava, Concluir aplica e deixa a
        cotação "não salva"; cabe inteiro nos 946 px
     4. o Salvar grava e a seta salva e baixa o .cft
     5. o Apagar mora nos três pontos e pergunta antes, com o Cancelar em foco
     6. as larguras de 390, 820, 1440 e 1920 nos dois temas: nada rola de lado
     7. que não houve erro de JavaScript

   O banco é de mentira (testes/orcamento-dados.mjs).

   Uso:  node testes/orcamento.mjs                 confere o site publicado
         node testes/orcamento.mjs http://127.0.0.1:4173
   As fotos ficam em testes/atual/orcamento/, fora do repositório.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import * as F from './orcamento-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/orcamento'
mkdirSync(PASTA, { recursive: true })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

const abertos = new Set()
async function abrir(nav, { largura, altura = 946, tema = 'light', papel = 'admin', abertas = 6 }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo', acceptDownloads: true })
  const banco = F.bancoDoOrcamento({ papel, abertas })
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    let corpo = null
    try { corpo = JSON.parse(req.postData() ?? 'null') } catch { /* corpo que não é JSON */ }
    const resp = banco.responder(m, u, corpo)
    if (resp) return r.fulfill({ status: resp.status, contentType: 'application/json', headers: CORS, body: resp.corpo === null ? '' : JSON.stringify(resp.corpo) })
    return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' })
  })
  await ctx.addInitScript(([c, t, ids]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
    localStorage.setItem('ft.cotacoes.abertas', JSON.stringify(ids))
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema, Array.from({ length: abertas }, (_, i) => 'c' + (i + 1))])
  abertos.add(ctx)
  const pg = await ctx.newPage()
  await pg.clock.setFixedTime(new Date(F.HOJE_DA_PROVA))
  pg.setDefaultTimeout(8000)
  const erros = []
  const ruido = (t) => /Failed to load resource|ERR_|fonts\.g|net::/i.test(t)
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 240)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PÁGINA ' + String(e).slice(0, 240)))
  return { ctx, pg, erros, banco }
}

async function ir(pg, rota = '/cotacao/c1') {
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector('.ct-topo', { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(500)
}
const pausa = (pg, ms = 300) => pg.waitForTimeout(ms)
const foto = (pg, nome, cheia = true) => pg.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: cheia })
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const caixa = (pg, s) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, d: r.right } }, s)
const texto = (pg, s) => pg.evaluate((s) => (document.querySelector(s)?.innerText ?? '').replace(/\s+/g, ' ').trim(), s)
const naModal = (pg) => pg.locator('dialog.modal[open]')

const achados = []
const conta = (certo, t) => { achados.push({ certo: !!certo, t }); console.log((certo ? 'ok   ' : 'RUIM ') + t) }
async function secao(parte) {
  try { await parte() } catch (e) {
    conta(false, 'A PROVA PAROU NO MEIO DE UMA PARTE: ' + String(e?.message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 220))
  }
  for (const ctx of abertos) await ctx.close().catch(() => {})
  abertos.clear()
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* 1. o cabeçalho e os botões, em 1920 x 946 */
await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  const cb = await caixa(pg, '.ct-cb')
  const bts = await caixa(pg, '.ct-bts')
  conta(cb && Math.round(cb.h) === 84, `o resumo do cabeçalho tem 84 px (${cb && Math.round(cb.h)})`)
  conta(bts && Math.abs(bts.y - cb.y) < 1 && Math.abs(bts.b - cb.b) < 1, 'os botões encostam no topo e no pé do cabeçalho')
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('.ct-bts > *')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width), (b.innerText || '').trim()] }))
  conta(linhas.length === 4 && linhas[0][0] === linhas[1][0] && linhas[2][0] === linhas[3][0] && linhas[2][0] - linhas[0][0] === 44, 'duas fileiras de 40 com 4 px entre elas: ' + linhas.map((l) => l[2]).join(' | '))
  conta(linhas[0][1] === linhas[1][1] && linhas[1][1] === linhas[2][1], 'as duas colunas de botão têm a mesma largura')
  conta(/Imprimir/.test(linhas[0][2]) && /Aprovar e gerar ficha/.test(linhas[1][2]) && /Enviar ao cliente/.test(linhas[2][2]) && /Salvar/.test(linhas[3][2]), 'arranjo 1: Imprimir e Aprovar em cima, Enviar e Salvar embaixo')
  const t = await texto(pg, '.ct-cb')
  conta(/CO2026-0131/.test(t) && /Atlético Exemplo/.test(t) && /criada em/.test(t), 'o azulejo diz número, cliente e data')
  conta(/Dados do pedido/.test(t) && /Dani · vale até 20\/10/.test(t), 'a porta dos dados diz o vendedor e o vale até')
  conta(/1 desconto/.test(t) && /2 informes · 1 envio/.test(t), 'a porta do fechamento conta descontos, informes e envios')
  /* 186 peças; subtotal 89*62+3*6 (XG a 68) + 89*38 + 8*74 = 5536 + 3382 + 592 = 9510; total com 5% de desconto 9034,50 */
  conta(/Layouts\s*3\s*186 peças/i.test(t), 'a célula dos layouts: 3 e 186 peças')
  conta(/R\$\s*9\.510,00/.test(t) && /fidelidade 5%: - R\$\s*475,50/.test(t), 'o subtotal e o desconto que tirou dele')
  conta(/R\$\s*9\.034,50/.test(t) && /entrada 50%: R\$\s*4\.517,25/.test(t), 'o total e a entrada')
  conta(await pg.locator('.ct-porta-ok').count() === 1, 'o visto verde na porta dos dados, com tudo preenchido')
  const faixa = await caixa(pg, '.ct-faixa')
  conta(faixa && faixa.b <= 946, `o cabeçalho e as abas cabem nos 946 px (${faixa && Math.round(faixa.b)})`)
  conta(await pg.locator('.ct-docs > .ct-docs-seg .ct-doc').count() === 6, 'as seis cotações abertas à vista em 1920')
  conta(await pg.locator('.ct-doc[aria-selected="true"] .ct-doc-x').count() === 1, 'a aberta tem o X')
  conta(await pg.getByRole('button', { name: 'Ferramentas do administrador' }).count() === 1, 'o administrador vê a engrenagem')
  conta(await pg.getByText('Esconder os valores').count() === 0 && !(await pg.evaluate(() => [...document.querySelectorAll('button, span')].some((e) => /^Apagar cotação$/.test(e.textContent.trim()) && e.checkVisibility()))), 'nem Esconder os valores nem Apagar à vista')
  await foto(pg, '1920-editor', false)
  conta(!erros.length, 'sem erro de JavaScript (1): ' + erros.join(' | '))
})

/* 2. o modal dos dados */
await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  await pg.locator('.ct-porta', { hasText: 'Dados do pedido' }).click()
  await pausa(pg, 400)
  conta(await naModal(pg).count() === 1, 'a porta Dados do pedido abre o modal')
  conta(await pg.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Fechar', 'ao abrir, o foco vai para o X')
  conta(await pg.locator('.ct-porta-aberta', { hasText: 'Dados do pedido' }).count() === 1, 'a porta fica em tinta com o modal aberto')
  const caixaModal = await caixa(pg, 'dialog.modal[open] .caixa')
  conta(caixaModal && caixaModal.w <= 1760.5 && caixaModal.y >= 23 && caixaModal.b <= 946 - 23, `o modal tem até 1760 de largura e cabe nos 946 (${caixaModal && [Math.round(caixaModal.w), Math.round(caixaModal.y), Math.round(caixaModal.b)].join(', ')})`)
  const rolaDentro = await pg.evaluate(() => { const c = document.querySelector('dialog.modal[open] .sobre-corpo'); return c ? c.scrollHeight - c.clientHeight : -1 })
  conta(rolaDentro <= 1, `o miolo do modal não rola em 1920 x 946 (${rolaDentro})`)
  const titulos = await pg.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .ct-mc-cab')].map((h) => h.innerText.split('\n')[0].trim()))
  conta(titulos.join('|') === 'Quem compra|O que foi combinado|O que a fábrica precisa saber|Ajustes no valor|Informes sobre a produção|O que já foi enviado', 'os seis cartões na ordem do modelo B: ' + titulos.join(', '))
  const metades = await pg.evaluate(() => [...document.querySelectorAll('.ct-md-metade')].map((m) => Math.round(m.getBoundingClientRect().left)))
  conta(metades.length === 2 && metades[1] > metades[0] + 600, 'meio a meio: o pedido à esquerda, o fechamento à direita')
  await foto(pg, '1920-modal', false)
  /* clicar fora não fecha */
  await pg.mouse.click(8, 470)
  await pausa(pg)
  conta(await naModal(pg).count() === 1, 'clicar fora NÃO fecha o modal')
  /* Cancelar devolve */
  const cliente = naModal(pg).locator('.campo', { hasText: 'Cliente' }).locator('input').first()
  await cliente.fill('Atlético Mudado')
  await naModal(pg).getByRole('button', { name: 'Cancelar' }).click()
  await pausa(pg)
  conta(await naModal(pg).count() === 0 && /Atlético Exemplo/.test(await texto(pg, '.ct-cb-id')) && await pg.locator('.ct-ponto-sujo').count() === 0, 'Cancelar fecha e devolve o que estava')
  /* Esc devolve */
  await pg.locator('.ct-porta', { hasText: 'Fechamento' }).click()
  await pausa(pg)
  await naModal(pg).locator('.campo', { hasText: 'Cliente' }).locator('input').first().fill('Pelo Esc')
  await pg.keyboard.press('Escape')
  await pausa(pg)
  conta(await naModal(pg).count() === 0 && !/Pelo Esc/.test(await texto(pg, '.ct-cb-id')), 'Esc fecha sem aplicar')
  /* Concluir aplica, e a cotação fica não salva */
  await pg.locator('.ct-porta', { hasText: 'Dados do pedido' }).click()
  await pausa(pg)
  await naModal(pg).locator('.campo', { hasText: 'Cliente' }).locator('input').first().fill('Atlético Novo')
  await naModal(pg).getByRole('button', { name: 'Concluir' }).click()
  await pausa(pg)
  conta(await naModal(pg).count() === 0 && /Atlético Novo/.test(await texto(pg, '.ct-cb-id')), 'Concluir aplica o que foi digitado')
  conta(await pg.locator('.ct-ponto-sujo').count() === 1, 'o Salvar ganha o ponto de "não salva"')
  conta(!erros.length, 'sem erro de JavaScript (2): ' + erros.join(' | '))
})

/* 3. salvar, a seta, e apagar */
await secao(async () => {
  const { pg, erros, banco } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  await pg.locator('.ct-porta', { hasText: 'Dados do pedido' }).click()
  await pausa(pg)
  await naModal(pg).locator('.campo', { hasText: 'Contato' }).locator('input').first().fill('Paula')
  await naModal(pg).getByRole('button', { name: 'Concluir' }).click()
  await pausa(pg)
  await pg.getByRole('button', { name: 'Salvar, há mudança não salva' }).click()
  await pausa(pg, 700)
  const g = banco.gravados.filter((x) => x.metodo === 'PATCH')
  conta(g.length === 1 && g[0].corpo.corpo.cliente.contato === 'Paula', 'Salvar manda a cotação com o que veio do modal')
  conta(await pg.locator('.ct-ponto-sujo').count() === 0, 'depois de salvar, o ponto some')
  const [baixa] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }), pg.getByRole('button', { name: 'Salvar e baixar o .cft' }).click()])
  conta(/\.cft$/.test(baixa.suggestedFilename()) && banco.gravados.filter((x) => x.metodo === 'PATCH').length === 2, 'a seta salva e baixa o .cft: ' + baixa.suggestedFilename())
  /* o apagar */
  await pg.getByRole('button', { name: 'Mais ações da cotação' }).click()
  await pausa(pg)
  await foto(pg, '1920-mais-acoes', false)
  await pg.getByRole('button', { name: 'Apagar cotação' }).click()
  await pausa(pg, 400)
  conta(await naModal(pg).count() === 1 && /Apagar esta cotação\?/.test(await naModal(pg).innerText()), 'Apagar abre a pergunta, e não apaga')
  conta(/CO2026-0131/.test(await naModal(pg).innerText()) && /9\.034,50/.test(await naModal(pg).innerText()), 'a pergunta diz o número e o total')
  conta(await pg.evaluate(() => document.activeElement?.textContent?.trim()) === 'Cancelar', 'o foco nasce no Cancelar')
  await foto(pg, '1920-apagar', false)
  await pg.keyboard.press('Escape')
  await pausa(pg)
  conta(await naModal(pg).count() === 0 && !banco.gravados.some((x) => x.metodo === 'DELETE'), 'Esc fecha a pergunta sem apagar')
  await pg.getByRole('button', { name: 'Mais ações da cotação' }).click()
  await pausa(pg)
  await pg.getByRole('button', { name: 'Apagar cotação' }).click()
  await pausa(pg)
  await naModal(pg).getByRole('button', { name: 'Apagar cotação' }).click()
  await pausa(pg, 800)
  conta(banco.gravados.some((x) => x.metodo === 'DELETE' && x.id === 'c1') && /\/cotacao$/.test(pg.url()), 'confirmado, apaga e volta para a lista')
  conta(!erros.length, 'sem erro de JavaScript (3): ' + erros.join(' | '))
})

/* 4. o vendedor não vê a engrenagem; as abas que não cabem vão para os três pontos */
await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1180, papel: 'vendedor', abertas: 8 })
  await ir(pg, '/cotacao/c8')
  conta(await pg.getByRole('button', { name: 'Ferramentas do administrador' }).count() === 0, 'o vendedor não vê a engrenagem')
  const vistas = await pg.locator('.ct-docs > .ct-docs-seg .ct-doc').count()
  conta(vistas < 8 && await pg.locator('.ct-doc-mais').count() === 1, `em 1180 as abas que não cabem vão para os três pontos (${vistas} de 8 à vista)`)
  conta(await pg.locator('.ct-docs > .ct-docs-seg .ct-doc[aria-selected="true"]').count() === 1, 'a aberta (a última da fila) continua à vista')
  const seg = await caixa(pg, '.ct-docs > .ct-docs-seg')
  const faixa = await caixa(pg, '.ct-faixa')
  conta(seg && faixa && seg.d <= faixa.d, 'o segmentado não passa da fileira')
  await pg.locator('.ct-doc-mais').click()
  await pausa(pg)
  await foto(pg, '1180-abas-escondidas', false)
  conta(await pg.locator('.mn-ctx .mn-item').count() === 8 - vistas, 'o menu dos três pontos lista as escondidas')
  conta(!erros.length, 'sem erro de JavaScript (4): ' + erros.join(' | '))
})

/* 5. as larguras e os dois temas */
for (const tema of ['light', 'dark']) {
  for (const [largura, altura] of [[1920, 946], [1440, 900], [820, 1180], [390, 844]]) {
    await secao(async () => {
      const { pg, erros } = await abrir(nav, { largura, altura, tema })
      await ir(pg)
      conta(await sobra(pg) <= 0, `${largura} ${tema}: nada rola de lado (${await sobra(pg)})`)
      const fora = await pg.evaluate(() => [...document.querySelectorAll('.ct-topo *, .ct-faixa *')].filter((e) => !e.closest('.ct-docs-regua') && e.checkVisibility({ visibilityProperty: true })).filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 0.5 }).length)
      conta(fora === 0, `${largura} ${tema}: nada do cabeçalho sai da tela (${fora})`)
      const alvos = largura < 800 ? await pg.evaluate(() => [...document.querySelectorAll('.ct-topo button, .ct-faixa button')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 34).length) : 0
      conta(alvos === 0, `${largura} ${tema}: nenhum botão do cabeçalho baixo demais para o dedo (${alvos})`)
      await foto(pg, `${largura}-${tema}`)
      await pg.locator('.ct-porta', { hasText: 'Dados do pedido' }).click()
      await pausa(pg, 400)
      await foto(pg, `${largura}-${tema}-modal`, false)
      const sobraModal = await pg.evaluate(() => { const c = document.querySelector('dialog.modal[open] .caixa'); return c ? c.scrollWidth - c.clientWidth : 0 })
      conta(sobraModal <= 0, `${largura} ${tema}: o modal não rola de lado (${sobraModal})`)
      conta(!erros.length, `sem erro de JavaScript (${largura} ${tema}): ` + erros.join(' | '))
    })
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram`)
if (ruins.length) { console.log('RUINS:\n' + ruins.map((r) => '  ' + r.t).join('\n')); process.exit(1) }
