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
     8. a página 1 da folha no template padrão (parte 5, FOURTIME OS - 14):
        cabeçalho 4, resumo 22, condições 2, informes 2, aceite 2 e rodapé 1,
        com valor e sem valor, e o resumo em duas tabelas acima de 10 layouts

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
async function abrir(nav, { largura, altura = 946, tema = 'light', papel = 'admin', abertas = 6, muitos = false }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo', acceptDownloads: true })
  const banco = F.bancoDoOrcamento({ papel, abertas, muitos })
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

/* 3b. o corpo do editor (parte 3): a referência, a arte, a grade, a ficha e a coluna dos layouts */
await secao(async () => {
  const { pg, erros, banco } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  await pg.waitForSelector('.ct-fab-pares', { timeout: 8000 })
  const rf = await caixa(pg, '.ct-rf')
  const ficha = await caixa(pg, '.ct-ly-ficha')
  const col = await caixa(pg, '.ct-ly-coluna')
  const lys = await caixa(pg, '.ct-lys')
  const arte = await caixa(pg, '.ct-arte')
  const acoes = await caixa(pg, '.ct-ly-acoes')
  conta(rf && Math.round(rf.w) === 680 && Math.round(rf.h) === 40, `a barra de referência tem 680 x 40 (${rf && [Math.round(rf.w), Math.round(rf.h)]})`)
  conta(arte && Math.abs(arte.x - rf.x) < 1 && Math.round(arte.w) === 680, 'a arte começa com a barra e tem a mesma largura')
  conta(ficha && Math.abs(ficha.x - (rf.d + 16)) < 1 && Math.abs(acoes.x - ficha.x) < 1 && Math.abs(acoes.d - ficha.d) < 1, 'as ações começam e acabam com a ficha')
  conta(col && Math.round(col.w) === 360 && Math.abs(lys.y - rf.y) < 1, `a coluna dos layouts tem 360 e começa na altura da barra (${col && Math.round(col.w)})`)
  const conta1 = await caixa(pg, '.ct-ly-conta')
  const setas = await pg.evaluate(() => { const b = [...document.querySelectorAll('.ct-ly-setas')].map((x) => x.getBoundingClientRect()); return b.length === 2 ? [b[0].right, b[1].left] : null })
  conta(setas && conta1 && Math.abs((conta1.x + conta1.w / 2) - (setas[0] + setas[1]) / 2) < 2, '"Layout 1 de 3" no meio do vão entre as setas e o Duplicar')
  conta((await texto(pg, '.ct-rf')).includes('CAMISETA MASC TRAD') && (await texto(pg, '.ct-rf')).includes('FT-010-000M'), 'a barra diz o nome e o código')
  conta(await pg.locator('.ct-rf-q[aria-checked="true"][aria-label="Masculino"]').count() === 1, 'o gênero do layout no aro preto')
  const lista = await caixa(pg, '.ct-lys-lista')
  conta(lista && Math.round(lista.h) === 320, `a lista tem a altura de cinco linhas com três layouts (${lista && Math.round(lista.h)})`)
  conta(await pg.locator('.ct-ly-linha').count() === 3 && await pg.locator('.ct-ly-linha[aria-selected="true"]').count() === 1, 'três layouts na lista, o primeiro escolhido')
  conta(/1 com algo por preencher/.test(await texto(pg, '.ct-lys')) && /falta a etiqueta/.test(await texto(pg, '.ct-ly-linha:nth-child(3)')), 'o L-03 sem etiqueta é o que falta preencher')
  const colB = await caixa(pg, '.ct-ly-coluna')
  conta(colB && colB.b <= 946, `com as sanfonas fechadas a coluna cabe nos 946 (${colB && Math.round(colB.b)})`)
  /* a ficha */
  conta(await pg.locator('.ct-chave[aria-pressed="true"]', { hasText: 'Fourtime' }).count() === 1 && await pg.locator('.ct-chaves-3 .ct-chave[aria-pressed="true"]', { hasText: 'Silk' }).count() === 1, 'a etiqueta do L-01: Fourtime em Silk')
  conta(await pg.locator('.ct-chaves-5 .ct-chave[aria-pressed="true"]').count() === 1 && /S14/.test(await texto(pg, '.ct-paletas')), 'o design do L-01: Sub ligado, com a cor S14 na paleta')
  conta(/Redonda/.test(await texto(pg, '.ct-fab-pares')) && /ribana 1x1 de 2 cm/.test(await texto(pg, '.ct-fab-pares')) && /Linha poliéster 120/.test(await texto(pg, '.ct-fab-avi')) && /Reforço de ombro a ombro/.test(await texto(pg, '.ct-fab-atencao')), 'a construção e os aviamentos lidos da ficha da referência')
  await foto(pg, '1920-corpo', false)
  await pg.locator('.ct-chaves-2 .ct-chave', { hasText: 'Cliente' }).click()
  await pausa(pg, 200)
  conta(await pg.locator('.ct-chave[aria-pressed="true"]', { hasText: 'Fourtime' }).count() === 0 && await pg.locator('.ct-chaves-2 .ct-chave[aria-pressed="true"]', { hasText: 'Cliente' }).count() === 1, 'ligar Cliente desliga Fourtime (uma etiqueta só)')
  await pg.locator('.ct-chaves-5 .ct-chave', { hasText: 'Silk' }).click()
  await pg.locator('.ct-chaves-5 .ct-chave', { hasText: 'Sub' }).click()
  await pausa(pg, 200)
  conta(await pg.locator('.ct-paleta').count() === 0, 'desligar o Sub tira a paleta dele')
  await pg.locator('.ct-chaves-5 .ct-chave', { hasText: 'Sub' }).click()
  await pausa(pg, 200)
  conta(/S14/.test(await texto(pg, '.ct-paletas')), 'religado na mesma visita, o Sub volta com a cor que tinha')
  /* a grade */
  const p = pg.locator('input[aria-label="Peças no P"]')
  await p.fill('12')
  await p.press('Enter')
  await pausa(pg, 200)
  conta(/188 peças/.test(await texto(pg, '.ct-cb')), 'mudar as peças na grade muda o resumo do cabeçalho (188 peças)')
  const vM = pg.locator('input[aria-label="Valor do M"]')
  await vM.fill('70')
  await vM.press('Enter')
  await pausa(pg, 200)
  conta(/2\.240,00/.test(await texto(pg, '.ct-gd-total')) && !(await pg.locator('input[aria-label="Valor do M"]').getAttribute('class')).includes('ct-gd-base'), 'o valor próprio do M vale só nele (32 x 70 = 2.240,00) e sai do cinza')
  /* a alça repete o número nas vizinhas */
  const a1 = await caixa(pg, 'td[data-col="1"] .ct-gd-alca')
  await pg.hover('input[aria-label="Peças no P"]')
  const a3 = await caixa(pg, 'input[aria-label="Peças no G"]')
  await pg.mouse.move(a1.x + 3, a1.y + 3)
  await pg.mouse.down()
  await pg.mouse.move(a3.x + a3.w / 2, a3.y + a3.h / 2, { steps: 6 })
  await pg.mouse.up()
  await pausa(pg, 200)
  conta(await pg.inputValue('input[aria-label="Peças no M"]') === '12' && await pg.inputValue('input[aria-label="Peças no G"]') === '12', 'a alça do P repete o 12 no M e no G')
  /* trocar de layout */
  await pg.locator('.ct-ly-linha').nth(1).click()
  await pausa(pg, 400)
  conta(/CALÇAO MASC SEM BOLSO/.test(await texto(pg, '.ct-rf')) && /Layout 2 de 3/.test(await texto(pg, '.ct-ly-conta')), 'escolher o L-02 na lista abre ele')
  const quadro = await caixa(pg, '.ct-arte-quadro')
  conta(quadro && Math.round(quadro.h) === 511, `a arte alta ganha o quadro de 511 (${quadro && Math.round(quadro.h)})`)
  conta(await pg.locator('.ct-chaves-2 .ct-chave[aria-pressed="true"]', { hasText: 'Cliente' }).count() === 1 && await pg.locator('.ct-chaves-3 .ct-chave[aria-pressed="true"]', { hasText: 'DTF' }).count() === 1, 'a etiqueta do L-02: Cliente em DTF')
  /* duplicar e remover */
  await pg.getByRole('button', { name: 'Próximo layout' }).click()
  await pg.getByRole('button', { name: 'Layout anterior' }).click()
  await pg.locator('.ct-ly-linha').nth(0).click()
  await pg.getByRole('button', { name: 'Duplicar layout' }).click()
  await pausa(pg, 300)
  conta(await pg.locator('.ct-ly-linha').count() === 4 && /Layout 2 de 4/.test(await texto(pg, '.ct-ly-conta')) && /L-02 · CAMISETA MASC TRAD/.test(await texto(pg, '.ct-ly-linha:nth-child(2)')), 'duplicar põe a cópia logo depois, já aberta')
  await pg.getByRole('button', { name: 'Remover layout' }).click()
  await pausa(pg, 300)
  conta(await pg.locator('.ct-ly-linha').count() === 3, 'remover tira o layout aberto')
  /* as sanfonas */
  conta(await pg.locator('.ct-sf-ponto').count() === 1, 'o L-01 tem observação: o ponto na sanfona')
  await pg.getByRole('button', { name: 'Observações do layout' }).click()
  await pausa(pg, 200)
  conta(/Reforço de ombro a ombro/.test(await texto(pg, '.ct-sf-aberta')), 'a sanfona das observações abre com o texto do layout')
  await pg.getByRole('button', { name: 'Materiais reservados para este orçamento' }).click()
  await pausa(pg, 200)
  conta(await pg.locator('.ct-sf-aberta').count() === 1 && /reservados no Estoque/.test(await texto(pg, '.ct-sf-aberta')), 'abrir os materiais fecha as observações')
  await foto(pg, '1920-corpo-mexido', false)
  /* salvar leva tudo */
  await pg.getByRole('button', { name: 'Salvar, há mudança não salva' }).click()
  await pausa(pg, 700)
  const g = banco.gravados.filter((x) => x.metodo === 'PATCH').at(-1)
  const b1 = g?.corpo.corpo.produtos[0].bloco
  conta(b1 && b1.design.some((d) => d.tag === 'Eti. Cliente') && !b1.design.some((d) => d.tag === 'Eti. Fourtime') && b1.design.some((d) => d.tag === 'Silk') && b1.grade.P === 12 && b1.grade.G === 12 && g.corpo.corpo.produtos[0].precoPorTamanho.M === 70, 'o Salvar leva a etiqueta, a técnica, a grade e o valor mudados')
  conta(!erros.length, 'sem erro de JavaScript (3b): ' + erros.join(' | '))
})

/* 3c. o highlight do mockup (parte 4, decisão 164) */
await secao(async () => {
  const { pg, erros, banco } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  const modo = () => pg.locator('.ct-arte-bts button', { hasText: /Destacar região|Pronto/ })
  const arrastar = async (x0, y0, x1, y1) => {
    if (!(await pg.locator('.ct-hl-sel').count())) await modo().click()
    await pausa(pg, 150)
    const a = await pg.evaluate(() => { const i = document.querySelector('.ct-hl-arte').getBoundingClientRect(); return { x: i.left, y: i.top, w: i.width, h: i.height } })
    await pg.mouse.move(a.x + x0 * a.w, a.y + y0 * a.h)
    await pg.mouse.down()
    await pg.mouse.move(a.x + x1 * a.w, a.y + y1 * a.h, { steps: 6 })
    await pg.mouse.up()
    await pausa(pg, 250)
  }
  const thumbs = () => pg.evaluate(() => { const a = document.querySelector('.ct-hl-area').getBoundingClientRect(); return [...document.querySelectorAll('.ct-hl-th')].map((t) => { const r = t.getBoundingClientRect(); return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, bp: t.style.backgroundPosition, bs: t.style.backgroundSize } }) })
  await modo().click()
  await pausa(pg, 200)
  conta(await pg.locator('.ct-hl-sel').count() === 1 && (await modo().getAttribute('aria-pressed')) === 'true', 'Destacar região liga o modo de escolher em cima da arte')
  await arrastar(0.1, 0.3, 0.3, 0.42)
  let t = await thumbs()
  const arte = await pg.evaluate(() => { const a = document.querySelector('.ct-hl-area').getBoundingClientRect(); const i = document.querySelector('.ct-hl-arte').getBoundingClientRect(); return { x: i.left - a.left, w: i.width, aw: a.width, ah: a.height } })
  conta(t.length === 1 && arte.x < 2, 'a primeira região vira destaque e a arte desliza para a esquerda')
  conta(await pg.locator('.ct-hl-sel').count() === 0, 'depois de escolher a região o modo de destacar termina')
  await arrastar(0.55, 0.2, 0.85, 0.7)
  await arrastar(0.3, 0.05, 0.7, 0.15)
  t = await thumbs()
  conta(t.length === 3 && t.every((c) => c.x >= arte.w - 1 && c.x + c.w <= arte.aw + 1 && c.y >= -1 && c.y + c.h <= arte.ah + 1), `três destaques na sobra da direita, dentro da caixa (${t.length})`)
  const formatos = await pg.evaluate(() => { const im = document.querySelector('.ct-hl-arte'); return [...document.querySelectorAll('.ct-hl-th')].map((x) => x.getBoundingClientRect()).map((r) => r.width / r.height) })
  const regsTela = [[0.2, 0.12], [0.3, 0.5], [0.4, 0.1]].map(([w, h]) => (w * 1000) / (h * 857))
  conta(formatos.every((f, i) => Math.abs(f - regsTela[i]) / regsTela[i] < 0.03), 'cada destaque com o formato da região (erro < 3%)')
  /* ajustar um destaque */
  await pg.locator('.ct-hl-th').nth(1).click()
  await pausa(pg, 150)
  conta(/Destaque 2/.test(await texto(pg, '.ct-hl-barra')) && /100%/.test(await texto(pg, '.ct-hl-barra')), 'clicar no destaque 2 mostra a barra dele com o zoom dele')
  const antes = (await thumbs())[1]
  await pg.locator('.ct-hl-zoom input').fill('200')
  await pausa(pg, 150)
  conta((await thumbs())[1].bs !== antes.bs && /200%/.test(await texto(pg, '.ct-hl-barra')), 'a régua muda o zoom só dele')
  await pg.locator('.ct-hl-th').nth(1).focus()
  await pg.keyboard.press('ArrowLeft')
  await pausa(pg, 100)
  conta((await thumbs())[1].bp !== antes.bp, 'a seta do teclado move a arte dentro do destaque')
  await pg.locator('.ct-hl-th').nth(0).click()
  await pausa(pg, 100)
  conta(/Destaque 1/.test(await texto(pg, '.ct-hl-barra')) && /100%/.test(await texto(pg, '.ct-hl-barra')), 'trocar para o destaque 1 traz o zoom dele de volta à régua')
  await foto(pg, '1920-destaques', false)
  /* travar */
  await pg.locator('.ct-arte-bts button', { hasText: 'Travar o mural' }).click()
  await pausa(pg, 200)
  conta(await pg.locator('.ct-hl-marca').count() === 0 && await pg.locator('.ct-hl-barra').count() === 0 && /Mural travado/.test(await texto(pg, '.ct-arte-cab')), 'travar esconde as marcas e a barra')
  const p1 = (await thumbs())[0].bp
  const th0 = await caixa(pg, '.ct-hl-th')
  await pg.mouse.move(th0.x + 10, th0.y + 10); await pg.mouse.down(); await pg.mouse.move(th0.x + 40, th0.y + 30, { steps: 3 }); await pg.mouse.up()
  conta((await thumbs())[0].bp === p1, 'travado, o arrasto não mexe no destaque')
  await foto(pg, '1920-destaques-travado', false)
  await pg.getByRole('button', { name: 'Salvar, há mudança não salva' }).click()
  await pausa(pg, 700)
  const g = banco.gravados.filter((x) => x.metodo === 'PATCH').at(-1)
  const m = g?.corpo.corpo.produtos[0].bloco.destaques
  conta(m && m.regs.length === 3 && m.travado === true && m.regs[1].z === 2, 'o Salvar leva o mural: três regiões, o zoom do 2 e a trava')
  /* o mural volta do banco depois de salvar (a cotação é relida) */
  conta(await pg.locator('.ct-hl-th').count() === 3, 'relido do banco, o mural continua lá')
  await pg.locator('.ct-arte-bts button', { hasText: 'Destravar' }).click()
  await pausa(pg, 150)
  await pg.locator('.ct-hl-th').nth(2).click()
  await pg.locator('.ct-hl-barra button', { hasText: 'Tirar' }).click()
  await pausa(pg, 150)
  conta(await pg.locator('.ct-hl-th').count() === 2, 'Tirar remove o destaque escolhido')
  /* o outro layout tem o mural dele */
  await pg.locator('.ct-ly-linha').nth(1).click()
  await pausa(pg, 400)
  conta(await pg.locator('.ct-hl-th').count() === 0 && await pg.locator('.ct-arte-caixa').count() === 1, 'o L-02 abre sem destaques, com a caixa de sempre')
  const altaH = await caixa(pg, '.ct-arte-caixa')
  conta(altaH && Math.round(altaH.h) === 483, `na arte alta a caixa cresce (${altaH && Math.round(altaH.h)})`)
  conta(!erros.length, 'sem erro de JavaScript (3c): ' + erros.join(' | '))
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

/* 6. A FOLHA, PÁGINA 1 (parte 5): o template padrão do FOURTIME OS - 14 */
async function irFolha(pg, rota = '/cotacao/c1/folha') {
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector('.fl .dc-topo', { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(700)
}
const pagina1 = (pg) => pg.evaluate(() => {
  const f = document.querySelector('.fl')
  const t = (s) => [...f.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, ' ').trim())
  const corpo = f.querySelector('.fl-corpo')
  return {
    numg: t('.dc-numg').join(''), campos: t('.dc-cel'), titulos: t('.dc-t'), nums: t('.dc-num'), gens: t('.dc-gen'), linhas: f.querySelectorAll('.dc-tab tbody tr').length,
    tabelas: f.querySelectorAll('.dc-tab').length, colunas: t('.dc-tab th'), totais: t('.dc-tf > div'), cond: t('.dc-cond > div'), inf: t('.dc-inf li'), aceite: t('.dc-ace').join(''),
    pe: t('.dc-pe').join(''), texto: f.innerText, fonte: getComputedStyle(f.querySelector('.dc-n')).fontFamily, sobra: corpo.scrollHeight - corpo.clientHeight,
    folhas: document.querySelectorAll('.fl').length, pes: [...document.querySelectorAll('.fl .dc-pe')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
    corta: [...f.querySelectorAll('.dc-n *')].filter((e) => { const r = e.getBoundingClientRect(), c = corpo.getBoundingClientRect(); return r.width && (r.right > c.right + 1) }).length,
  }
})

await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1440, altura: 900 })
  await irFolha(pg)
  const p = await pagina1(pg)
  conta(/Roboto/.test(p.fonte), 'a página 1 sai em Roboto (' + p.fonte + ')')
  conta(/Cotação\s*CO2026-0131\s*criada em 01\/10\/2026/i.test(p.numg), 'cabeçalho 4: o número grande à direita, com a data (' + p.numg + ')')
  conta(p.campos.length === 8 && /^Cliente Atlético Exemplo/i.test(p.campos[0]) && /^Total R\$ 9\.034,50/i.test(p.campos[7]) && !p.campos.some((x) => /^Pedido/i.test(x)), 'os campos com valor, na ordem do 14, sem o pedido que ainda não existe: ' + p.campos.map((x) => x.split(' ')[0]).join(', '))
  conta(p.titulos.join('|') === 'Resumo do orçamento|Condições|Informes e termos|Aprovação'.toUpperCase(), 'as quatro partes na ordem: ' + p.titulos.join(' | '))
  conta(p.linhas === 3 && p.nums.join(',') === '01,02,03' && p.gens.every((g) => /Masculino/i.test(g)), 'resumo 22: uma linha por layout, o número de borda e o gênero')
  conta(p.colunas.join('|').toUpperCase() === 'LAYOUT|PRODUTO|GÊNERO|PEÇAS|POR PEÇA|VALOR', 'resumo 22: as seis colunas (' + p.colunas.join(', ') + ')')
  conta(!/FT-010-000M/.test(p.texto), 'resumo 22: o nome sem a referência na frente')
  conta(/R\$ 5\.536,00/.test(p.texto) && /R\$ 3\.382,00/.test(p.texto) && /R\$ 592,00/.test(p.texto), 'o valor de cada layout: 5.536, 3.382 e 592')
  conta(p.totais.length === 4 && /Peças 186/i.test(p.totais[0]) && /Subtotal R\$ 9\.510,00/i.test(p.totais[1]) && /Fidelidade \(5%\) - R\$ 475,50/i.test(p.totais[2]) && /Total R\$ 9\.034,50/i.test(p.totais[3]), 'os totais em faixa: ' + p.totais.join(' | '))
  conta(p.cond.length === 3 && /Envio TRANSPORTADORA/i.test(p.cond[0]) && /Tabela de preço Atacado 2026/i.test(p.cond[1]) && /Validade desta proposta 20\/10\/2026/i.test(p.cond[2]), 'condições 2: sem repetir o prazo e o pagamento do cabeçalho; a validade sem perder um dia: ' + p.cond.join(' | '))
  conta(p.inf.length === 2 && /^1 A produção/.test(p.inf[0]) && /^2 Cores/.test(p.inf[1]), 'informes 2: só os marcados, numerados')
  conta(/responda SIM no WhatsApp da Fourtime, citando a cotação CO2026-0131/i.test(p.aceite) && /Atlético Exemplo/.test(p.aceite) && /Data/.test(p.aceite), 'aceite 2: o WhatsApp e a assinatura lado a lado')
  conta(/Fourtime · Goiânia, GO/.test(p.pe) && /186 peças · R\$ 9\.034,50 · página 1 de \d/.test(p.pe), 'rodapé 1: a empresa à esquerda; peças, total e página à direita (' + p.pe + ')')
  conta(p.pes.length === p.folhas && p.pes.every((x, i) => new RegExp('R\\$ 9\\.034,50 · página ' + (i + 1) + ' de ' + p.folhas).test(x)), 'o rodapé com o total em TODA folha (' + p.folhas + ' folhas)')
  conta(p.sobra <= 0 && p.corta === 0, `nada da página 1 passa da folha (sobra ${p.sobra}, ${p.corta} saindo de lado)`)
  const lados = await pg.evaluate(() => { const a = document.querySelector('.dc-wa').getBoundingClientRect(), b = document.querySelector('.dc-caixa').getBoundingClientRect(); return [a.top, a.height, b.top, b.height].map(Math.round) })
  conta(lados[0] === lados[2] && lados[1] === lados[3], 'o WhatsApp e a assinatura na mesma altura (' + lados.join(', ') + ')')
  const risco = await pg.evaluate(() => { const c = document.querySelector('.dc-campos'); const s = getComputedStyle(c); return [s.borderTopWidth, s.borderBottomWidth] })
  conta(risco.join() === '1px,1px', 'a faixa dos campos entre dois riscos de 1 px')
  await foto(pg, 'folha-1440-com-valor')
  await pg.getByRole('tab', { name: 'Sem valor' }).click()
  await pausa(pg, 700)
  const s = await pagina1(pg)
  conta(/Folha da produção\s*CO2026-0131/i.test(s.numg), 'sem valor: o título vira Folha da produção')
  conta(s.campos.map((x) => x.split(' ')[0]).join(',') === 'Cliente,CPF,Pedido,Vendedor,Contato,Departamento,Embalagem,Data,Peças'.toUpperCase() && /Data de envio 20\/10\/2026/i.test(s.campos[7]) && /Pedido -/i.test(s.campos[2]), 'sem valor: os campos da produção, com o pedido que falta à vista: ' + s.campos.join(' | '))
  conta(!/R\$/.test(s.texto), 'sem valor: nenhum R$ na página 1')
  conta(s.titulos.join('|') === 'Resumo do pedido|Condições|Informes à produção'.toUpperCase(), 'sem valor: sem aceite, e os títulos da produção (' + s.titulos.join(' | ') + ')')
  conta(s.colunas.join('|').toUpperCase() === 'LAYOUT|PRODUTO|GÊNERO|PEÇAS', 'sem valor: o resumo sem preço')
  conta(s.cond.length === 2 && /Prazo de produção 12 dias úteis/i.test(s.cond[0]) && /Envio TRANSPORTADORA/i.test(s.cond[1]), 'sem valor: as condições sem repetir departamento, embalagem e data: ' + s.cond.join(' | '))
  conta(s.totais.length === 1 && /Peças 186/i.test(s.totais[0]), 'sem valor: a faixa só com as peças')
  conta(s.pes.every((x) => /186 peças · página/.test(x) && !/R\$/.test(x)), 'sem valor: o rodapé sem o total em reais')
  await foto(pg, 'folha-1440-sem-valor')
  conta(!erros.length, 'sem erro de JavaScript (folha): ' + erros.join(' | '))
})

await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1440, altura: 900, muitos: true })
  await irFolha(pg)
  const p = await pagina1(pg)
  conta(p.tabelas === 2 && p.linhas === 14, `14 layouts: o resumo vira duas tabelas (${p.tabelas} tabelas, ${p.linhas} linhas)`)
  conta(!p.colunas.some((c) => /por peça/i.test(c)), '14 layouts: o preço por peça sai das tabelas pela metade')
  conta(p.gens.some((g) => /Feminino/i.test(g)) && p.gens.some((g) => /Infantil/i.test(g)), '14 layouts: as tags de gênero de cada um')
  const corte = await pg.evaluate(() => { const td = [...document.querySelectorAll('.fl .dc-tab-prod')].find((e) => /BABY LOOK/.test(e.textContent)); return td ? [td.scrollWidth > td.clientWidth, Math.round(td.getBoundingClientRect().height)] : null })
  conta(corte && corte[0] && corte[1] < 30, '14 layouts: o nome comprido corta com reticência, sem quebrar a linha (' + corte + ')')
  conta(p.sobra <= 0 && p.corta === 0, `14 layouts: nada da página 1 passa da folha (sobra ${p.sobra})`)
  await foto(pg, 'folha-1440-14-layouts')
  conta(!erros.length, 'sem erro de JavaScript (folha com 14): ' + erros.join(' | '))
})

for (const tema of ['light', 'dark']) {
  await secao(async () => {
    const { pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema })
    await irFolha(pg)
    conta(await sobra(pg) <= 0, `folha 390 ${tema}: nada rola de lado (${await sobra(pg)})`)
    const fundo = await pg.evaluate(() => getComputedStyle(document.querySelector('.fl')).backgroundColor)
    conta(fundo === 'rgb(255, 255, 255)', `folha 390 ${tema}: o papel é branco (${fundo})`)
    await foto(pg, `folha-390-${tema}`)
    conta(!erros.length, `sem erro de JavaScript (folha 390 ${tema}): ` + erros.join(' | '))
  })
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram`)
if (ruins.length) { console.log('RUINS:\n' + ruins.map((r) => '  ' + r.t).join('\n')); process.exit(1) }
