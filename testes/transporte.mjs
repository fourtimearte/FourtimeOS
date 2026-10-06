/* ==========================================================================
   A PÁGINA DE TRANSPORTE CONTRA O WIREFRAME DE 03/10/2026, MEDIDA POR MEDIDA.

   O Henrique aprovou o wireframe com a ordem de sempre: implementar
   EXATAMENTE como está desenhado. Este teste é essa conferência. Cada número
   aqui foi copiado da prancha do wireframe (26 a 36 do canvas); se o CSS
   mudar e o número sair, o teste reprova e diz qual.

   O QUE ELE CONFERE
     1. as medidas em 1920 por 1080, com o menu aberto, nos dois temas
     2. que a página faz o que o wireframe promete: lançar manda o que foi
        preenchido, acertar marca como pago, o cadastro com CNPJ vai inteiro,
        a planilha sai com uma linha por lançamento
     3. que nada rola para o lado em 1920, 820 e 390, e que no celular a
        tabela vira lista
     4. que quem só lê não vê botão de gravar, e quem não tem a página não
        entra nela
     5. que não houve erro de JavaScript

   O banco é de mentira (testes/transporte-dados.mjs) e o relógio fica
   congelado na sexta, 23 de outubro de 2026, que é o dia do wireframe.

   Uso:  node testes/transporte.mjs                 confere o site publicado
         node testes/transporte.mjs http://localhost:5173
   As fotos ficam em testes/atual/transporte/, fora do repositório.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
import * as T from './transporte-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/transporte'
mkdirSync(PASTA, { recursive: true })

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (r, corpo, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) })

/* o perfil de quem abre: 'tudo' edita, 'le' só vê, 'fora' nem tem a página */
function perfil(acesso) {
  const [p] = D.perfil('admin')
  if (acesso === 'le') p.permissoes.transporte = { ver: true, editar: false, deletar: false, total: false }
  if (acesso === 'fora') { delete p.permissoes.transporte; p.paineis = p.paineis.filter((k) => k !== 'transporte') }
  if (acesso !== 'tudo') { p.papel = 'analista'; p.nome = 'Analista' }
  return [p]
}

async function abrir(nav, { largura, altura, tema, acesso = 'tudo' }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, acceptDownloads: true })
  const { extra, gravados } = T.bancoDoTransporte()
  await ctx.clock.setFixedTime(new Date(T.HOJE))
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    if (u.includes('rpc/salvar_transportador')) { gravados.push(['salvar', JSON.parse(req.postData())]); return json(r, 'novo-id') }
    const x = await extra(u, m, req)
    if (x !== undefined) return json(r, x)
    if (m !== 'GET') return json(r, u.includes('rpc/') ? {} : [])
    let corpo = []
    if (u.includes('meu_perfil')) corpo = perfil(acesso)
    else if (u.includes('fornecedor_na_lista')) corpo = D.fornecedores
    else if (u.includes('material_fornecedor')) corpo = D.ligacoes
    else if (u.includes('tipo_de_fornecedor')) corpo = D.tipos
    return json(r, corpo)
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: 4102444800000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  const ruido = (t) => /Failed to load resource|ERR_|fonts\.g|net::/i.test(t)
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 240)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PAGINA ' + String(e).slice(0, 240)))
  return { ctx, pg, erros, gravados }
}

async function ir(pg, rota, espera) {
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector(espera, { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(700)
}
const pausa = (pg, ms = 400) => pg.waitForTimeout(ms)
const foto = (pg, nome, inteira = true) => pg.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: inteira })

const medir = (pg, seletores) => pg.evaluate((seletores) => {
  const o = {}
  for (const s of seletores) {
    const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length)
    if (!e) { o[s] = null; continue }
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
    o[s] = {
      x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, baixo: r.bottom,
      letra: c.fontSize + '/' + c.fontWeight, raio: c.borderTopLeftRadius, borda: c.borderTopWidth,
      recheio: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(' '),
      fundo: c.backgroundColor, cor: c.color, texto: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    }
  }
  return o
}, seletores)
const tokens = (pg, nomes) => pg.evaluate((nomes) => {
  const o = {}
  for (const n of nomes) { const e = document.createElement('i'); e.style.backgroundColor = `var(${n})`; document.body.append(e); o[n] = getComputedStyle(e).backgroundColor; e.remove() }
  return o
}, nomes)
const todos = (pg, seletor) => pg.evaluate((seletor) => [...document.querySelectorAll(seletor)].filter((x) => x.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
  return { x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, baixo: r.bottom, raio: c.borderTopLeftRadius, fundo: c.backgroundColor, cor: c.color, letra: c.fontSize + '/' + c.fontWeight, texto: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80) }
}), seletor)
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
const igual = (a, b) => Math.abs(a - b) < 0.6
const folga = (lista) => lista.slice(1).map((b, i) => Math.round((b.x - lista[i].dir) * 10) / 10)
const escolher = async (pg, gatilho, opcao) => {
  await pg.locator('dialog[open] .sel .cb', { hasText: gatilho }).click(); await pausa(pg, 300)
  await pg.locator('.mn.flutua .mn-item', { hasText: opcao }).first().click(); await pausa(pg, 300)
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* ==========================================================================
   1. AS MEDIDAS E OS FLUXOS, EM 1920 POR 1080, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const G = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1920, altura: 1080, tema })

  /* --------------------------------------------------------- LANÇAMENTOS */
  await ir(pg, '/transporte', '.tp-tabela')
  const K = await tokens(pg, ['--bg', '--surface', '--surface-2', '--surface-3', '--brand', '--brand-text', '--text', '--text-2', '--text-3', '--ink', '--ok', '--warn', '--icon-accent'])
  let m = await medir(pg, ['body', '.pagina-topo', '.pagina-topo .acima', '.pagina-topo h1', '.pagina-topo .sub', '.tp-barra', '.tp-aba', '.tp-aba button', '.tp-busca', '.tp-fim', '.tp-duas', '.tp-quadro', '.tp-lado', 'table.tabela thead th', 'table.tabela tr.grupo td', '.tp-linha', '.tp-grupo b', '.tp-do-grupo', '.tp-nome b', '.tp-nome small', '.tp-situacao', '.tp-heroi', '.tp-heroi-numero', '.tp-heroi h2', '.tp-heroi p', '.tp-caixa-topo', '.cartao-titulo', '.cartao-titulo .cartao-icone', '.tp-linha-caixa', '.tp-linha-caixa .btn', '.tp-trilho', '.tp-cheio'])
  conta(m.body.fundo === K['--bg'], `${G}: o fundo da página é o token --bg`)
  conta(igual(m['.pagina-topo'].x, 280) && igual(m['.pagina-topo'].w, 1598), `${G}: a página vai de 280 a 1878 (${m['.pagina-topo'].x}, ${m['.pagina-topo'].w})`)
  conta(m['.pagina-topo .acima'].letra === '12.5px/600' && m['.pagina-topo .acima'].texto.toLowerCase() === 'gestão' && m['.pagina-topo .acima'].cor === K['--text-3'], `${G}: sobrelinha "Gestão" 12.5/600 em --text-3`)
  conta(m['.pagina-topo h1'].letra === '24px/600' && m['.pagina-topo h1'].texto === 'Transporte', `${G}: título "Transporte" 24/600`)
  conta(m['.pagina-topo .sub'].letra === '14px/400' && m['.pagina-topo .sub'].cor === K['--text-2'], `${G}: subtítulo 14/400 em --text-2`)
  let botoes = await todos(pg, '.pagina-topo .btn')
  conta(botoes.length === 2 && botoes.every((b) => igual(b.h, 40) && b.raio === '10px') && igual(folga(botoes)[0], 10), `${G}: dois botões no topo, 40 de altura, raio 10, 10 entre eles (${botoes.map((b) => b.texto).join(', ')})`)
  conta(botoes[1].fundo === K['--brand'] && botoes[1].texto === 'Lançar transporte' && igual(botoes[1].dir, 1878), `${G}: a ação principal é a última, vermelha, encostada na margem`)
  conta(igual(m['.tp-barra'].y - m['.pagina-topo'].baixo, 24) && igual(m['.tp-duas'].y - m['.tp-barra'].baixo, 16), `${G}: 24 do topo até a barra e 16 da barra até as caixas`)
  conta(igual(m['.tp-aba'].h, 40) && m['.tp-aba'].raio === '10px' && m['.tp-aba'].recheio === '4px 4px 4px 4px' && m['.tp-aba'].fundo === K['--surface-3'], `${G}: segmentado 40, raio 10, recheio 4, --surface-3`)
  conta(igual(m['.tp-aba button'].h, 34) && m['.tp-aba button'].raio === '7px' && m['.tp-aba button'].letra === '13px/600', `${G}: botão do segmentado 34, raio 7, 13/600`)
  const abas = await todos(pg, '.tp-aba button')
  conta(abas.map((a) => a.texto).join('|') === 'Lançamentos|Quem transporta|Relatório', `${G}: as três abas, nesta ordem (${abas.map((a) => a.texto).join(', ')})`)
  conta(igual(m['.tp-busca'].w, 300) && igual(m['.tp-busca'].h, 40) && m['.tp-busca'].raio === '10px' && m['.tp-busca'].borda === '1px', `${G}: busca 300 por 40, raio 10, borda 1`)
  let chips = await todos(pg, '.tp-chips .chip')
  conta(chips.map((c) => c.texto).join(' | ') === 'Todos 35 | Motoboy 20 | Uber 7 | Táxi 2 | Transportadora 6 | A pagar 10', `${G}: seis filtros com a contagem (${chips.map((c) => c.texto).join(' | ')})`)
  conta(chips.every((c) => igual(c.h, 40) && c.raio === '999px' && c.letra === '13px/500') && folga(chips).every((f) => igual(f, 10)) && chips[0].fundo === K['--ink'], `${G}: chips em pílula, 40, 13/500, 10 entre eles, o ligado em --ink`)
  conta(igual(m['.tp-fim'].dir, 1878) && igual(m['.tp-fim'].h, 40) && /Outubro de 2026/.test(m['.tp-fim'].texto), `${G}: o mês encosta na margem direita (${m['.tp-fim'].texto})`)
  conta(igual(m['.tp-quadro'].w, 1142) && m['.tp-quadro'].raio === '14px' && m['.tp-quadro'].borda === '1px' && m['.tp-quadro'].fundo === K['--surface'], `${G}: caixa da lista com 1142, raio 14, borda 1`)
  conta(igual(m['.tp-lado'].w, 440) && igual(m['.tp-lado'].x - m['.tp-quadro'].dir, 16) && igual(m['.tp-lado'].dir, 1878), `${G}: o lado tem 440, a 16 da lista, até a margem`)
  conta(igual(m['table.tabela thead th'].h, 44) && m['table.tabela thead th'].letra === '13px/600' && m['table.tabela thead th'].cor === K['--text-2'], `${G}: cabeçalho da tabela 44, 13/600, --text-2`)
  conta(igual(m['table.tabela tr.grupo td'].h, 36) && m['table.tabela tr.grupo td'].fundo === K['--surface-2'], `${G}: faixa do dia com 36 em --surface-2`)
  conta(m['.tp-grupo b'].letra === '14px/600' && m['.tp-grupo b'].texto === 'Hoje, sexta 23 de outubro', `${G}: o dia por extenso, 14/600 (${m['.tp-grupo b'].texto})`)
  conta(m['.tp-do-grupo'].letra === '14px/600' && m['.tp-do-grupo'].cor === K['--text'] && m['.tp-do-grupo'].texto.replace(/\s/g, ' ') === 'R$ 716,90', `${G}: o total do dia, 14/600 em --text (${m['.tp-do-grupo'].texto})`)
  conta(igual(m['.tp-linha'].h, 48) && m['.tp-nome b'].letra === '14px/600' && m['.tp-nome small'].letra === '12.5px/400' && m['.tp-nome small'].cor === K['--text-2'], `${G}: linha de 48, nome 14/600, apoio 12.5/400 em --text-2`)
  conta(m['.tp-situacao'].letra === '13px/600', `${G}: situação em ponto e texto, 13/600`)
  const linhas = await todos(pg, '.tp-linha'); const grupos = await todos(pg, 'table.tabela tr.grupo')
  conta(linhas.length === 35 && grupos.length === 16, `${G}: 35 corridas em 16 dias (${linhas.length}, ${grupos.length})`)
  conta(m['.tp-heroi'].raio === '14px' && m['.tp-heroi'].recheio === '20px 24px 20px 24px' && igual(m['.tp-heroi'].w, 440), `${G}: caixa do gasto raio 14, recheio 20 e 24`)
  conta(m['.tp-heroi-numero'].letra === '56px/600' && m['.tp-heroi-numero'].texto.replace(/\s/g, ' ') === 'R$ 2.412,80' && m['.tp-heroi-numero'].cor === K['--text'], `${G}: o gasto do mês em 56/600 (${m['.tp-heroi-numero'].texto})`)
  conta(m['.tp-heroi h2'].letra === '20px/600' && /18% a mais que até o dia 23 de setembro/.test(m['.tp-heroi p'].texto), `${G}: a comparação é contra o mesmo dia do mês anterior (${m['.tp-heroi p'].texto})`)
  const minis = await todos(pg, '.tp-numero-caixa'); const numeros = await todos(pg, '.tp-numero-caixa b')
  conta(minis.length === 3 && minis.every((x) => igual(x.w, 136) && x.raio === '14px' && x.fundo === K['--surface']) && folga(minis).every((f) => igual(f, 16)), `${G}: três caixas de número de 136, 16 entre elas`)
  conta(numeros.map((x) => x.texto.replace(/\s/g, ' ')).join(' | ') === '35 | R$ 68,94 | R$ 979,50' && numeros.every((x) => x.letra === '24px/600') && numeros[2].cor === K['--brand-text'], `${G}: 35 corridas, R$ 68,94 por corrida e R$ 979,50 a pagar em vermelho (${numeros.map((x) => x.texto).join(' | ')})`)
  const doLado = await todos(pg, '.tp-lado > *')
  conta(doLado.length === 4 && doLado.slice(1).every((x, i) => igual(x.y - doLado[i].baixo, 16)), `${G}: quatro blocos no lado, 16 entre eles`)
  conta(igual(m['.tp-caixa-topo'].h, 44) && m['.cartao-titulo'].letra === '15px/600' && igual(m['.cartao-titulo .cartao-icone'].w, 20) && m['.cartao-titulo .cartao-icone'].cor === K['--icon-accent'], `${G}: topo de caixa com 44 e título 15/600 com o ícone na cor de ícone do tema`)
  const aPagar = await todos(pg, '.tp-linha-caixa')
  conta(aPagar.length === 4 && aPagar.every((x) => igual(x.h, 56)) && /^Transportadora Exemplo Ltda .* R\$ 640,00 Acertar$/.test(aPagar[0].texto.replace(/\s/g, ' ')) && /^João 6 corridas, desde 19\/10 R\$ 149,00/.test(aPagar[1].texto.replace(/\s/g, ' ')), `${G}: A pagar junta por quem recebe, do maior para o menor (${aPagar.map((x) => x.texto.replace(/\s/g, ' ').slice(0, 28)).join(' / ')})`)
  conta(igual(m['.tp-linha-caixa .btn'].h, 34) && m['.tp-linha-caixa .btn'].raio === '10px', `${G}: botão Acertar com 34`)
  const trilhos = await todos(pg, '.tp-lado .tp-trilho'); const cheios = await todos(pg, '.tp-lado .tp-cheio')
  conta(trilhos.length === 4 && trilhos.every((t) => igual(t.h, 8) && t.raio === '5px' && t.fundo === K['--surface-3'] && igual(t.w, 398)) && cheios.every((c) => c.fundo === K['--ink']), `${G}: quatro barras de 8, raio 5, trilho --surface-3 e cheio --ink`)
  conta(igual(cheios[3].w, 398) && igual(cheios[0].w, 398 * 465 / 1677.7), `${G}: a barra é proporcional: transportadora cheia, motoboy com ${Math.round(cheios[0].w)} de 398`)
  conta(await sobra(pg) <= 0, `${G} lançamentos: nada rola para o lado`)
  await foto(pg, `lancamentos-${G}`)

  /* a corrida escolhida */
  await pg.locator('.tp-linha', { hasText: 'Transportadora Exemplo Ltda' }).first().click(); await pausa(pg)
  m = await medir(pg, ['.tp-ficha', '.tp-ficha-topo h2', '.tp-ficha-topo p', '.tp-ficha-corpo', '.tp-dado', '.tp-ficha-pe', '.tp-fechar'])
  conta(igual(m['.tp-ficha'].w, 440) && m['.tp-ficha'].raio === '14px' && igual(m['.tp-ficha'].dir, 1878), `${G} corrida: a ficha toma o lugar do resumo, 440, raio 14`)
  conta(m['.tp-ficha-topo h2'].letra === '28px/600' && m['.tp-ficha-topo h2'].texto.replace(/\s/g, ' ') === 'R$ 640,00' && m['.tp-ficha-topo p'].letra === '13.5px/400', `${G} corrida: valor 28/600 e quem levou 13.5/400`)
  conta(m['.tp-ficha-corpo'].recheio === '16px 24px 24px 24px' && igual(m['.tp-dado'].h, 34) && igual(m['.tp-fechar'].w, 40), `${G} corrida: corpo com recheio 24, linha de dado 34, fechar de 40`)
  botoes = await todos(pg, '.tp-ficha-pe .btn')
  conta(igual(m['.tp-ficha-pe'].h, 73) && botoes.length === 2 && botoes.every((b) => igual(b.h, 40)) && igual(botoes[0].x - m['.tp-ficha'].x, 25) && igual(m['.tp-ficha'].dir - botoes[1].dir, 25) && botoes[1].fundo === K['--brand'], `${G} corrida: pé de 73, Editar à esquerda e Marcar como pago vermelho à direita`)
  await foto(pg, `corrida-${G}`, false)
  await pg.locator('.tp-ficha-pe .btn', { hasText: 'Marcar como pago' }).click(); await pausa(pg, 700)
  const acerto = gravados.find((g) => g[0] === 'acertar')
  conta(acerto && acerto[1].p_lancamentos.length === 1, `${G} corrida: Marcar como pago manda o lançamento para acertar (${acerto ? acerto[1].p_lancamentos.join(',') : 'nada'})`)
  conta((await todos(pg, '.tp-chips .chip')).at(-1).texto === 'A pagar 9', `${G} corrida: depois de pagar, A pagar cai para 9`)
  if (await pg.locator('.tp-fechar').count()) { await pg.locator('.tp-fechar').click(); await pausa(pg, 300) }

  /* lançar */
  await pg.getByRole('button', { name: 'Lançar transporte' }).first().click(); await pausa(pg, 700)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .sobre-topo .t', 'dialog[open] .sobre-corpo', 'dialog[open] .sobre-pe', 'dialog[open] .tp-seg-cheio', 'dialog[open] .tp-dois-campos', 'dialog[open] input[inputmode=decimal]', 'dialog[open] .tp-ajuda'])
  conta(igual(m['dialog[open] .caixa'].w, 440) && igual(m['dialog[open] .caixa'].h, 1080) && igual(m['dialog[open] .caixa'].dir, 1910), `${G} lançar: gaveta de 440 na direita, de cima a baixo`)
  conta(m['dialog[open] .sobre-topo .t'].letra === '16px/700' && m['dialog[open] .sobre-topo .t'].texto === 'Lançar transporte' && m['dialog[open] .sobre-corpo'].recheio === '24px 24px 24px 24px', `${G} lançar: título 16/700 e corpo com recheio 24`)
  conta(igual(m['dialog[open] .tp-seg-cheio'].w, 391) && igual(m['dialog[open] .tp-seg-cheio'].h, 40), `${G} lançar: o segmentado ocupa a largura da folha`)
  const segs = await todos(pg, 'dialog[open] .tp-seg-cheio')
  const meios = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .tp-seg-cheio')[0].querySelectorAll('button')].map((b) => ({ texto: b.innerText.trim() })))
  conta(segs.length === 3 && meios.map((x) => x.texto).join('|') === 'Motoboy|Uber|Táxi|Transportadora', `${G} lançar: três segmentados, e o primeiro é Motoboy, Uber, Táxi, Transportadora`)
  conta(igual(m['dialog[open] input[inputmode=decimal]'].w, 148) && igual(m['dialog[open] input[inputmode=decimal]'].h, 40) && m['dialog[open] .tp-ajuda'].letra === '12.5px/400', `${G} lançar: valor com 148 por 40, ajuda 12.5`)
  botoes = await todos(pg, 'dialog[open] .sobre-pe .btn')
  conta(igual(m['dialog[open] .sobre-pe'].h, 73) && botoes.length === 2 && botoes.every((b) => igual(b.h, 40)) && igual(folga(botoes)[0], 10), `${G} lançar: pé de 73, Cancelar e a ação, 10 entre eles`)
  /* Uber nasce pago no cartão; motoboy nasce em aberto no Pix */
  await pg.locator('dialog[open] .tp-seg-cheio').first().locator('button', { hasText: 'Uber' }).click(); await pausa(pg, 300)
  let estado = await pg.evaluate(() => ({ pago: document.querySelector('dialog[open] .ck input').checked }))
  conta(estado.pago === true && /Entra no gasto do mês/.test(await pg.locator('dialog[open] .tp-ajuda').innerText()), `${G} lançar: Uber já nasce pago`)
  await pg.locator('dialog[open] .tp-seg-cheio').first().locator('button', { hasText: 'Motoboy' }).click(); await pausa(pg, 300)
  estado = await pg.evaluate(() => ({ pago: document.querySelector('dialog[open] .ck input').checked }))
  conta(estado.pago === false && /Fica em A pagar/.test(await pg.locator('dialog[open] .tp-ajuda').innerText()), `${G} lançar: motoboy nasce em A pagar`)
  await escolher(pg, 'Escolha o motoboy', 'João')
  await escolher(pg, 'Sem pedido', 'PD-0412')
  await pg.locator('dialog[open] input[placeholder^="Setor Bueno"]').fill('Vila Nova, Goiânia')
  await pg.locator('dialog[open] input[inputmode=decimal]').fill('25,00'); await pausa(pg, 300)
  botoes = await todos(pg, 'dialog[open] .sobre-pe .btn')
  conta(botoes[1].texto.replace(/\s/g, ' ') === 'Lançar R$ 25,00' && botoes[1].fundo === K['--brand'], `${G} lançar: o botão diz o valor (${botoes[1].texto})`)
  await foto(pg, `lancar-${G}`, false)
  await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 800)
  const lancado = gravados.find((g) => g[0] === 'lancar')?.[1]
  conta(lancado && lancado.p_id === null && lancado.p_transportador === 't1' && lancado.p_motivo === 'entrega' && lancado.p_pedido === 'PD-0412' && lancado.p_valor === 25 && lancado.p_forma === 'pix' && lancado.p_pago === false && lancado.p_destino === 'Vila Nova, Goiânia' && lancado.p_fornecedor === null && String(lancado.p_quando).startsWith('2026-10-23'), `${G} lançar: grava quem levou, o pedido, o valor, a forma e o dia (${lancado ? JSON.stringify(lancado).slice(0, 160) : 'nada gravado'})`)
  conta((await todos(pg, '.tp-chips .chip'))[0].texto === 'Todos 36' && await pg.locator('dialog[open]').count() === 0, `${G} lançar: a folha fecha e a lista passa a 36`)

  /* a planilha */
  const [baixado] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }).catch(() => null), pg.getByRole('button', { name: 'Baixar planilha' }).click()])
  let planilha = ''
  if (baixado) { const caminho = await baixado.path(); planilha = readFileSync(caminho, 'utf8') }
  const linhasDaPlanilha = planilha.replace(/^﻿/, '').split('\r\n').filter(Boolean)
  conta(baixado && baixado.suggestedFilename() === 'transporte-2026-10.csv' && linhasDaPlanilha.length === 37 && linhasDaPlanilha[0].startsWith('"Data";"Hora";"Meio";"Quem levou"'), `${G} planilha: transporte-2026-10.csv com o cabeçalho e uma linha por lançamento (${linhasDaPlanilha.length - 1})`)

  /* ----------------------------------------------------- QUEM TRANSPORTA */
  await pg.locator('.tp-aba button', { hasText: 'Quem transporta' }).click(); await pausa(pg)
  m = await medir(pg, ['.tp-barra > .btn', '.tp-quadro', 'table.tabela thead th', 'table.tabela tr.grupo td', '.tp-linha', '.tp-grupo-fim .btn'])
  conta(m['.tp-barra > .btn'].texto === 'Novo cadastro' && igual(m['.tp-barra > .btn'].h, 40), `${G} quem: botão Novo cadastro na barra, 40`)
  conta(igual(m['.tp-quadro'].w, 1598) && m['.tp-quadro'].raio === '14px', `${G} quem: um quadro só, na largura inteira`)
  const faixas = await todos(pg, 'table.tabela tr.grupo'); const cadastros = await todos(pg, '.tp-linha')
  conta(faixas.length === 4 && cadastros.length === 10 && igual(m['.tp-linha'].h, 48) && igual(m['table.tabela tr.grupo td'].h, 36), `${G} quem: quatro meios e dez cadastros, faixa de 36 e linha de 48`)
  conta(faixas.map((f) => f.texto.split(' ')[0]).join('|') === 'Motoboy|Uber|Táxi|Transportadora', `${G} quem: a ordem dos meios é Motoboy, Uber, Táxi, Transportadora`)
  conta(igual(m['.tp-grupo-fim .btn'].h, 34) && m['.tp-grupo-fim .btn'].texto === 'Novo motoboy', `${G} quem: cada faixa tem o seu botão de novo, com 34`)
  conta(/falta o CNPJ/.test(cadastros.find((c) => c.texto.startsWith('Correios')).texto) && /67\.890\.123\/0001-/.test(cadastros.find((c) => c.texto.startsWith('Transportadora Exemplo')).texto), `${G} quem: transportadora mostra o CNPJ, ou diz que falta`)
  conta(await sobra(pg) <= 0, `${G} quem: nada rola para o lado`)
  await foto(pg, `quem-${G}`)
  await pg.locator('.tp-linha', { hasText: 'João' }).first().click(); await pausa(pg, 600)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .tp-dado', 'dialog[open] .tp-acerto', 'dialog[open] .tp-lista', 'dialog[open] .sobre-topo .t'])
  conta(igual(m['dialog[open] .caixa'].w, 440) && m['dialog[open] .sobre-topo .t'].texto === 'João' && igual(m['dialog[open] .tp-dado'].h, 34), `${G} ficha: gaveta de 440 com o nome, linha de dado 34`)
  conta(m['dialog[open] .tp-acerto'].raio === '10px' && m['dialog[open] .tp-acerto'].fundo === K['--surface-2'] && /a pagar/.test(m['dialog[open] .tp-acerto'].texto), `${G} ficha: a caixa do que falta acertar, raio 10 em --surface-2 (${m['dialog[open] .tp-acerto'].texto})`)
  conta((await todos(pg, 'dialog[open] .tp-lista-linha')).length === 6 && m['dialog[open] .tp-lista'].raio === '10px', `${G} ficha: as seis últimas corridas`)
  await foto(pg, `quem-ficha-${G}`, false)
  const antesDoAcerto = gravados.filter((g) => g[0] === 'acertar').length
  await pg.getByRole('button', { name: 'Acertar tudo' }).click(); await pausa(pg, 700)
  const tudo = gravados.filter((g) => g[0] === 'acertar')[antesDoAcerto]
  conta(tudo && tudo[1].p_lancamentos.length >= 6, `${G} ficha: Acertar tudo manda as corridas abertas dele de uma vez (${tudo ? tudo[1].p_lancamentos.length : 0})`)
  await pg.keyboard.press('Escape'); await pausa(pg)
  await pg.getByRole('button', { name: 'Nova transportadora' }).click(); await pausa(pg, 600)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .tp-seg-cheio', 'dialog[open] .tp-dois-iguais', 'dialog[open] input[aria-label=CNPJ]'])
  conta(igual(m['dialog[open] .caixa'].w, 560) && m['dialog[open] .caixa'].raio === '18px', `${G} novo cadastro: modal de 560, raio 18`)
  conta(m['dialog[open] input[aria-label=CNPJ]'] !== null && igual(m['dialog[open] .tp-seg-cheio'].w, 510) && igual(m['dialog[open] .tp-dois-iguais'].w, 510), `${G} novo cadastro: transportadora pede o CNPJ, e os campos ocupam a largura`)
  await pg.locator('dialog[open] input[placeholder="Jadlog"]').fill('Rodoviário Exemplo Ltda')
  await pg.locator('dialog[open] input[aria-label=CNPJ]').fill('11.111.111/1111-11'); await pausa(pg, 200)
  conta(await pg.locator('dialog[open] .sobre-pe .btn').last().isDisabled(), `${G} novo cadastro: CNPJ que não fecha a conta trava o Salvar`)
  await pg.locator('dialog[open] input[aria-label=CNPJ]').fill(D.cn('778899000001')); await pausa(pg, 200)
  await foto(pg, `quem-novo-${G}`, false)
  await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 700)
  const salvo = gravados.find((g) => g[0] === 'salvar')?.[1]
  conta(salvo && salvo.p_id === null && salvo.p_meio === 'transportadora' && salvo.p_nome === 'Rodoviário Exemplo Ltda' && salvo.p_cnpj === D.cn('778899000001'), `${G} novo cadastro: salva o nome, o meio e o CNPJ só com os 14 caracteres (${salvo ? salvo.p_cnpj : 'nada'})`)
  if (await pg.locator('dialog[open]').count()) { await pg.keyboard.press('Escape'); await pausa(pg) }

  /* ----------------------------------------------------------- RELATÓRIO */
  await pg.locator('.tp-aba button', { hasText: 'Relatório' }).click(); await pausa(pg)
  m = await medir(pg, ['.tp-relatorio', '.kpi', '.kpi .val', '.kpi .rot', '.kpi .sub', '.tp-rel-duas', '.tp-caixa', '.tp-barra-linha', '.tp-trilho', '.tp-colunas', '.tp-coluna-vao', '.tp-coluna-valor', '.tp-coluna-nome b', '.tp-rodape', '.tp-relatorio table.tabela thead th', '.tp-relatorio table.tabela tbody tr'])
  const kpis = await todos(pg, '.kpi'); const valores = await todos(pg, '.kpi .val')
  conta(kpis.length === 4 && kpis.every((k) => igual(k.w, 387.5) && k.raio === '14px') && folga(kpis).every((f) => igual(f, 16)), `${G} relatório: quatro números iguais, 16 entre eles`)
  conta(valores.every((v) => v.letra === '28px/600') && m['.kpi .rot'].letra === '13px/500' && m['.kpi .sub'].letra === '12.5px/400', `${G} relatório: os quatro valores em 28/600, rótulo 13/500, apoio 12.5`)
  conta(valores.length === 4 && valores[3].cor === K['--brand-text'], `${G} relatório: A pagar com o número em vermelho (${valores.map((v) => v.texto).join(' | ')})`)
  const blocos = await todos(pg, '.tp-relatorio > *')
  conta(blocos.length === 5 && blocos.slice(1).every((b, i) => igual(b.y - blocos[i].baixo, 16)), `${G} relatório: cinco blocos, 16 entre eles`)
  const caixas = await todos(pg, '.tp-kpis + .tp-rel-duas .tp-caixa')
  conta(caixas.length === 2 && igual(caixas[0].w, 791) && igual(caixas[1].x - caixas[0].dir, 16) && igual(caixas[1].dir, 1878), `${G} relatório: Por meio e Para quê lado a lado, 791 cada`)
  conta(igual(m['.tp-barra-linha'].h, 44) && igual(m['.tp-trilho'].h, 8) && igual(m['.tp-trilho'].w, 445), `${G} relatório: linha de barra com 44 e trilho de 445 por 8`)
  const colunas = await todos(pg, '.tp-coluna'); const cheias = await todos(pg, '.tp-coluna-cheia')
  conta(colunas.length === 5 && igual(m['.tp-coluna-vao'].h, 160) && cheias.every((c) => igual(c.w, 56) && c.fundo === K['--ink'] && c.raio === '5px'), `${G} relatório: cinco semanas, coluna de 56 com 160 de altura útil, em --ink`)
  conta(m['.tp-coluna-valor'].letra === '13.5px/600' && m['.tp-coluna-nome b'].letra === '13px/600' && m['.tp-rodape'].letra === '12.5px/400', `${G} relatório: valor da semana 13.5/600, nome 13/600, rodapé 12.5`)
  const tabelas = await pg.evaluate(() => [...document.querySelectorAll('.tp-relatorio table.tabela')].map((t) => t.querySelectorAll('tbody tr').length))
  conta(tabelas.join(',') === '6,6' && igual(m['.tp-relatorio table.tabela thead th'].h, 44) && igual(m['.tp-relatorio table.tabela tbody tr'].h, 48), `${G} relatório: quem mais recebeu e pedidos que mais gastaram, seis linhas cada, cabeçalho 44 e linha 48`)
  conta(await sobra(pg) <= 0, `${G} relatório: nada rola para o lado`)
  await foto(pg, `relatorio-${G}`)

  conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
}

/* ==========================================================================
   2. O TABLET E O CELULAR
   ========================================================================== */
for (const [largura, altura, nome] of [[820, 1180, 'tablet'], [390, 844, 'celular']]) {
  for (const tema of ['light', 'dark']) {
    const G = `${nome} ${tema === 'light' ? 'gelo' : 'grafite'}`
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema })
    const estreito = largura < 768
    await ir(pg, '/transporte', '.tp-tabela, .tp-dias')
    conta(await sobra(pg) <= 0, `${G} lançamentos: nada rola para o lado`)
    let m = await medir(pg, ['.pagina-topo h1', '.tp-aba', '.tp-busca', '.tp-lado', '.tp-quadro', '.tp-heroi-numero', '.tp-item', '.tp-faixa', '.tp-linha'])
    conta(m['.pagina-topo h1'].letra === '24px/600' && igual(m['.tp-aba'].h, 40) && igual(m['.tp-busca'].h, 40), `${G}: título 24/600 e controles de 40`)
    conta(m['.tp-lado'].y < m['.tp-quadro'].y, `${G}: o resumo sobe e a lista vem depois`)
    if (estreito) {
      conta(m['.tp-item'] !== null && m['.tp-linha'] === null && m['.tp-item'].h >= 56 && igual(m['.tp-faixa'].h, 36), `${G}: a tabela vira lista, linha de ${m['.tp-item'] ? m['.tp-item'].h : 0} e faixa do dia de 36`)
      conta(m['.tp-heroi-numero'].letra === '44px/600' && igual(m['.tp-quadro'].x, 20) && igual(m['.tp-quadro'].w, 340), `${G}: o gasto em 44/600 e a lista na largura da tela, com 20 de margem`)
      conta((await todos(pg, '.tp-item')).length === 35, `${G}: as 35 corridas na lista`)
    }
    await foto(pg, `lancamentos-${nome}-${tema}`)
    await pg.locator('.tp-item, .tp-linha', { hasText: 'Transportadora Exemplo Ltda' }).first().click(); await pausa(pg, 600)
    m = await medir(pg, ['dialog[open] .caixa'])
    conta(m['dialog[open] .caixa'] !== null && m['dialog[open] .caixa'].dir <= largura && /R\$ 640,00/.test((await pg.locator('dialog[open]').innerText()).replace(/\s/g, ' ')), `${G}: a corrida abre numa folha que cabe na tela`)
    await pg.keyboard.press('Escape'); await pausa(pg)
    await pg.getByRole('button', { name: 'Lançar transporte' }).first().click(); await pausa(pg, 700)
    m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .tp-seg-cheio', 'dialog[open] .sobre-pe .btn'])
    conta(m['dialog[open] .caixa'].dir <= largura && m['dialog[open] .caixa'].baixo <= altura + 1 && m['dialog[open] .tp-seg-cheio'].dir <= m['dialog[open] .caixa'].dir && igual(m['dialog[open] .sobre-pe .btn'].h, 40), `${G} lançar: a folha e o segmentado cabem na tela (${Math.round(m['dialog[open] .caixa'].w)} por ${Math.round(m['dialog[open] .caixa'].h)})`)
    await foto(pg, `lancar-${nome}-${tema}`, false)
    await pg.keyboard.press('Escape'); await pausa(pg)
    await pg.locator('.tp-aba button', { hasText: 'Quem transporta' }).click(); await pausa(pg)
    conta(await sobra(pg) <= 0 && await pg.getByRole('button', { name: 'Novo cadastro' }).count() === 1, `${G} quem: nada rola para o lado, e o Novo cadastro está na barra`)
    if (estreito) conta((await todos(pg, '.tp-item')).length === 10 && (await todos(pg, '.tp-faixa')).length === 4, `${G} quem: dez cadastros em quatro faixas`)
    await foto(pg, `quem-${nome}-${tema}`)
    await pg.locator('.tp-aba button', { hasText: 'Relatório' }).click(); await pausa(pg)
    conta(await sobra(pg) <= 0, `${G} relatório: nada rola para o lado`)
    if (estreito) {
      const kpis = await todos(pg, '.kpi')
      conta(kpis.length === 4 && igual(kpis[0].y, kpis[1].y) && igual(kpis[2].y, kpis[3].y) && kpis[2].y > kpis[0].y, `${G} relatório: os quatro números vão dois a dois`)
    }
    await foto(pg, `relatorio-${nome}-${tema}`)
    conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
    await ctx.close()
  }
}

/* ==========================================================================
   3. O ACESSO: QUEM SÓ LÊ E QUEM NÃO TEM A PÁGINA
   ========================================================================== */
{
  const { ctx, pg } = await abrir(nav, { largura: 1920, altura: 1080, tema: 'light', acesso: 'le' })
  await ir(pg, '/transporte', '.tp-tabela')
  conta(await pg.getByRole('button', { name: 'Lançar transporte' }).count() === 0 && await pg.getByRole('button', { name: 'Acertar' }).count() === 0, `quem só lê: sem Lançar transporte e sem Acertar`)
  conta(await pg.getByRole('button', { name: 'Baixar planilha' }).count() === 1 && (await todos(pg, '.tp-linha')).length === 35, `quem só lê: vê os lançamentos e baixa a planilha`)
  await pg.locator('.tp-linha').first().click(); await pausa(pg)
  conta(await pg.locator('.tp-ficha').count() === 1 && await pg.locator('.tp-ficha-pe .btn').count() === 0, `quem só lê: abre a corrida e não vê Editar nem Marcar como pago`)
  await pg.locator('.tp-aba button', { hasText: 'Quem transporta' }).click(); await pausa(pg)
  conta(await pg.getByRole('button', { name: 'Novo cadastro' }).count() === 0 && await pg.locator('.tp-grupo-fim .btn').count() === 0, `quem só lê: sem botão de novo cadastro`)
  await ctx.close()
}
{
  const { ctx, pg } = await abrir(nav, { largura: 1920, altura: 1080, tema: 'light', acesso: 'fora' })
  await pg.goto(SITE + '/transporte', { waitUntil: 'networkidle' }); await pausa(pg, 1200)
  conta(await pg.locator('.tp-barra').count() === 0, `quem não tem a página: /transporte não abre`)
  conta(!(await pg.locator('nav, aside').first().innerText()).includes('Transporte'), `quem não tem a página: Transporte não aparece no menu`)
  await ctx.close()
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length} conferencias em ${SITE}: ${achados.length - ruins.length} certas, ${ruins.length} ruins`)
if (ruins.length) { console.log('\nO QUE NAO BATEU'); ruins.forEach((a) => console.log('  ' + a.texto)); process.exit(1) }
