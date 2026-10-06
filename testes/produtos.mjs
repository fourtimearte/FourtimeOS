/* ==========================================================================
   A PÁGINA FICHAS TÉCNICAS CONTRA O WIREFRAME DE 05/10/2026 (pranchas 57 a 59,
   65, 66, 68 e 69 do canvas): as referências.

   O QUE ELA CONFERE
     1. a lista: os grupos em sanfona, abrir não é escolher, o grupo dos kits
        fora da lista, a ficha em branco calada e a começada com o ponto
     2. a ficha: o molde sobre papel branco nos dois temas, os detalhes, a
        tabela de medidas, a de tecido com a soma, o metro e o grama conferidos
        por uma conta escrita aqui, e os aviamentos
     3. o editor: a grade, a medida livre (sugestão, nome escrito, ordem pelo
        teclado e pelo arrasto, colar da planilha), a parte do molde, o
        aviamento, o molde que só sobe no Salvar, e o Salvar mandando a ficha
        inteira, em número, sem o tamanho desligado
     4. o que não deixa salvar, o banco recusando, e sair com mudança sem salvar
     5. nova referência, duplicar e excluir
     6. quem edita sem ser chefia, quem só lê e quem não tem a página
     6b. os kits (pranchas 60 e 61): a lista, a ficha de fabricação, o editor
        em três colunas com mais de um tecido por peça, o kit novo com o
        código que nasce das peças, o que não deixa salvar, excluir
     7. sem referência, com a leitura falhando e sem o apoio do Estoque
     8. o celular e o tablet: nada rola para o lado e a tabela fica em pé
     9. que não houve erro de JavaScript

   O banco é de mentira (testes/produtos-dados.mjs) e guarda o que a página
   grava, para a prova ver a página lendo de volta o que mandou.

   Uso:  node testes/produtos.mjs                 confere o site publicado
         node testes/produtos.mjs http://127.0.0.1:4173
   As fotos ficam em testes/atual/produtos/, fora do repositório.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import * as F from './produtos-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/produtos'
mkdirSync(PASTA, { recursive: true })

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

async function abrir(nav, { largura, altura, tema = 'light', acesso = 'chefe', estado = 'cheio', recusa = 0 }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1 })
  const banco = F.bancoDasFichas({ estado, recusa })
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    let corpo = null
    try { corpo = JSON.parse(req.postData() ?? 'null') } catch { /* corpo que não é JSON */ }
    const resp = banco.responder(m, u, corpo)
    if (resp) return r.fulfill({ status: resp.status, contentType: 'application/json', headers: CORS, body: resp.corpo === null ? '' : JSON.stringify(resp.corpo) })
    return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(u.includes('meu_perfil') ? F.perfil(acesso) : []) })
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  abertos.add(ctx)
  const pg = await ctx.newPage()
  pg.setDefaultTimeout(8000)
  const erros = []
  const ruido = (t) => /Failed to load resource|ERR_|fonts\.g|net::/i.test(t)
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 240)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PÁGINA ' + String(e).slice(0, 240)))
  return { ctx, pg, erros, banco, gravados: banco.gravados }
}

async function ir(pg, rota, espera) {
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector(espera, { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(500)
}
const pausa = (pg, ms = 300) => pg.waitForTimeout(ms)
const foto = (pg, nome) => pg.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true })
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const textos = (pg, seletor) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.getClientRects().length).map((e) => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ')), seletor)
const caixas = (pg, seletor) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, fundo: c.backgroundColor, cor: c.color, borda: c.borderTopColor } }), seletor)
const token = (pg, nome) => pg.evaluate((n) => { const e = document.createElement('i'); e.style.backgroundColor = `var(${n})`; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c }, nome)
/* a tabela à vista, em linhas de células de texto */
const tabela = (pg, seletor) => pg.evaluate((s) => { const t = document.querySelector(s); return t ? [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => { const campo = c.querySelector('input'); return campo && !c.matches('th') ? campo.value : (c.innerText || '').trim().replace(/\s+/g, ' ') })) : null }, seletor)
const recado = async (pg) => (await textos(pg, '.pilha-recados .recado')).join(' | ')
const ultimo = (gravados, u) => [...gravados].reverse().find((g) => g.u === u)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
const mesma = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const br = (v, casas) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/* Cada parte da prova roda dentro de uma seção. Se a página não fizer o que a
   prova espera e um clique ficar esperando para sempre, a seção acusa e a
   prova segue para a próxima, em vez de morrer ali e esconder o resto. */
const abertos = new Set()
async function secao(parte) {
  try { await parte() } catch (e) {
    conta(false, 'A PROVA PAROU NO MEIO DE UMA PARTE: ' + String(e?.message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 220))
    for (const ctx of abertos) await ctx.close().catch(() => {})
  }
  abertos.clear()
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

const escolherRef = async (pg, curto) => { await pg.locator(`[data-ref="${curto}"] .pd-t-nome`).click(); await pg.waitForSelector('[data-ficha="referencia"]'); await pausa(pg, 400) }
const abrirGrupo = async (pg, cod) => { await pg.locator(`[data-grupo="${cod}"]`).click(); await pausa(pg, 250) }
const abaDoModulo = async (pg, nome) => { await pg.locator('.pd-abas-do-modulo button', { hasText: nome }).click(); await pausa(pg, 300) }
const editar = async (pg) => { await pg.locator('[data-ficha="referencia"] .pd-ficha-topo button', { hasText: 'Editar' }).click(); await pg.waitForSelector('[data-ficha="editar"]'); await pausa(pg, 300) }
const salvar = async (pg) => { await pg.getByRole('button', { name: 'Salvar referência' }).click(); await pausa(pg, 700) }
const naModal = (pg) => pg.locator('dialog.modal[open]')

/* ==========================================================================
   1. A LISTA E A FICHA, NO COMPUTADOR, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) await secao(async () => {
  const G = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros } = await abrir(nav, { largura: 1536, altura: 900, tema })
  await ir(pg, '/produtos', '[data-arvore]')

  conta((await textos(pg, '.pagina-topo h1'))[0] === 'Fichas técnicas' && (await textos(pg, '.pagina-topo .acima'))[0] === 'Materiais', `${G} topo: Materiais, Fichas técnicas`)
  conta((await textos(pg, '.pagina-topo .sub'))[0] === '8 referências · 1 kit · 1 com a ficha completa', `${G} topo: conta as peças sem o kit, os kits, e diz quantas têm a ficha completa (${(await textos(pg, '.pagina-topo .sub'))[0]})`)
  conta(mesma(await textos(pg, '.pd-abas-da-pagina button'), ['Referências e kits', 'Movimento', 'Depósito', 'Estatísticas']), `${G} barra: as quatro abas da página`)
  conta(mesma(await textos(pg, '[data-arvore] .pd-abas button'), ['Referências 8', 'Kits 1']), `${G} árvore: Referências e Kits, cada uma com a conta`)
  const grupos = await textos(pg, '.pd-g')
  conta(grupos.length === 5 && !grupos.some((g) => /KIT/.test(g)), `${G} árvore: cinco gavetas, e o grupo dos kits não é uma delas (${grupos.join(' / ')})`)
  conta(/^010 Camisetas e polos 4 referências 1$/.test(grupos[0]) && /^020 Raglan 1 referência$/.test(grupos[1]) && /^sem Sem grupo 1 referência/.test(grupos[4]), `${G} árvore: o código, o nome, quantas referências e quantas começadas e incompletas`)
  const alertas = await pg.evaluate(() => [...document.querySelectorAll('.pd-g .pd-alerta')].map((a) => getComputedStyle(a).visibility))
  conta(mesma(alertas, ['visible', 'hidden', 'visible', 'hidden', 'hidden']), `${G} árvore: o ponto vermelho só no grupo que tem ficha começada e incompleta`)
  conta(await pg.locator('.pd-t').count() === 0 && await pg.locator('[data-nada-escolhido]').count() === 1, `${G} árvore: nasce fechada, com o convite do lado direito`)

  await abrirGrupo(pg, '010')
  const linhas = await textos(pg, '.pd-t')
  conta(linhas.length === 4 && await pg.locator('[data-nada-escolhido]').count() === 1, `${G} abrir não é escolher: o grupo abre com as quatro peças e o lado direito continua o mesmo`)
  conta(linhas[0] === 'CAMISETA MASC TRAD 010-000M · masculino' && linhas[1] === 'CAMISETA MASC TRAD GOLA V 010-001M · masculino · ficha em branco', `${G} linha: a completa só com código e gênero, a em branco dizendo que está em branco`)
  conta(linhas[2] === 'BABY LOOK 010-004F · feminino · faltam tecido e molde 2' && linhas[3] === 'CAMISETA INFANTIL UNISSEX 010-008C · infantil · ficha em branco', `${G} linha: a começada diz o que falta e quantas coisas são`)
  const faltas = await pg.evaluate(() => [...document.querySelectorAll('.pd-t')].map((t) => [!!t.querySelector('small.pd-falta'), !!t.querySelector('.pd-alerta')]))
  conta(mesma(faltas, [[false, false], [false, false], [true, true], [false, false]]), `${G} linha: ficha em branco não é alerta; só a começada e incompleta ganha a cor e o ponto`)
  await foto(pg, `lista-${tema}`)

  /* ---- a ficha ---- */
  await escolherRef(pg, '010-000M')
  conta(new URL(pg.url()).searchParams.get('ref') === 'FT-010-000M', `${G} ficha: o endereço guarda a peça aberta`)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'CAMISETA MASC TRAD' && (await textos(pg, '.pd-ficha-nome p'))[0] === 'FT-010-000M · masculino · grade adulta, PP a G4', `${G} ficha: o nome, o código, o gênero e a grade`)
  conta((await textos(pg, '.pd-trilha'))[0] === '010 Camisetas e polos › referência', `${G} ficha: a trilha com o grupo`)
  conta(mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Editar', 'Duplicar', 'Fechar']), `${G} ficha: Editar, Duplicar e Fechar`)
  const sel = (await caixas(pg, '.pd-t.pd-sel'))[0]
  conta(sel && sel.fundo === await token(pg, '--ink') && sel.cor === await token(pg, '--on-ink'), `${G} árvore: a peça aberta fica na tinta`)

  const titulos = await pg.evaluate(() => [...document.querySelectorAll('[data-ficha] .pd-topo .cartao-titulo')].map((h) => [h.textContent.trim(), !!h.querySelector('.cartao-icone svg')]))
  conta(mesma(titulos.map((t) => t[0]), ['Molde', 'Detalhes da peça', 'Medidas e tecido', 'Aviamentos e insumos por peça', 'Onde esta peça entra']) && titulos.every((t) => t[1]), `${G} ficha: os cinco cartões, cada título com o ícone`)

  const papel = (await caixas(pg, '.pd-molde-caixa'))[0]
  const img = await pg.evaluate(() => { const i = document.querySelector('.pd-molde'); return { src: i.src.slice(0, 34), largura: i.naturalWidth, alt: i.alt } })
  conta(papel.fundo === 'rgb(255, 255, 255)', `${G} molde: o papel é branco neste tema (${papel.fundo})`)
  conta(img.src.startsWith('data:image/svg+xml') && img.largura > 0 && img.alt === 'Molde de CAMISETA MASC TRAD', `${G} molde: o SVG é mostrado como imagem, e carregou`)
  conta(await pg.evaluate(() => !document.querySelector('.pd-molde-caixa svg')), `${G} molde: o SVG não é colado dentro da página`)
  conta(mesma(await textos(pg, '.pd-partes .pd-tag'), ['Frente 1x', 'Costas 1x', 'Mangas 2x', 'Ribana da gola 1x']), `${G} molde: as partes e quantas vezes cada uma é cortada`)

  const detalhes = await textos(pg, '.pd-linhas > div')
  conta(detalhes.length === 6 && detalhes[0] === 'Gola Redonda, ribana 1x1 de 2 cm' && detalhes[4] === 'Costura Overloque de 4 fios e galoneira' && detalhes[5].startsWith('Observação Reforço de ombro a ombro.'), `${G} detalhes: gola, manga, punho, barra, costura e a observação`)
  conta((await textos(pg, '[data-cartao="detalhes"] .pd-rodape'))[0].includes('A etiqueta não entra na referência'), `${G} detalhes: a nota de que a etiqueta é do kit e do orçamento`)

  /* ---- medidas: a aba da frente ---- */
  conta(await pg.locator('[data-modulo="medidas"]').count() === 1, `${G} módulo: Medidas é a aba da frente`)
  const med = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(mesma(med[0], ['Medida, em cm', ...F.ADULTA]), `${G} medidas: uma coluna por tamanho, PP a G4`)
  conta(med.length === 4 && mesma(med[1], ['Comprimento do ombro à barra', '66,0', '68,0', '70,0', '72,0', '74,0', '76,0', '78,0', '80,0', '82,0', '84,0']), `${G} medidas: o nome, como medir e os dez números do Comprimento`)
  conta(med[3][0] === 'Manga do ombro à bainha' && med[3][10] === '28,5', `${G} medidas: a meia medida aparece (28,5)`)
  conta(await pg.locator('[data-modulo] .pd-grade.pd-em-pe').count() === 0, `${G} medidas: no computador a tabela fica deitada`)
  await foto(pg, `referencia-${tema}`)

  /* ---- tecido: a conta conferida por fora ---- */
  await abaDoModulo(pg, 'Tecido')
  const tec = await tabela(pg, '[data-modulo] table.pd-grade')
  const quatro = (v) => Math.round(v * 10000) / 10000
  const fatias = [0.36, 0.37, 0.27].map((f) => F.BRUTA.map((a) => quatro(a * f)))
  const soma = F.BRUTA.map((_, i) => fatias[0][i] + fatias[1][i] + fatias[2][i])
  conta(mesma(tec.map((l) => l[0]), ['Parte do molde, em m²', 'Frente cortada 1 vez', 'Costas cortada 1 vez', 'Mangas cortada 2 vezes', 'A peça inteira em m², já com a perda do corte', 'dá em metros, com 1,60 m de largura', 'dá em gramas, com malha de 180 g/m²', 'Ribana da gola em metros']), `${G} tecido: as partes, a soma, o metro, o grama e a ribana, nesta ordem`)
  conta(mesma(tec[1].slice(1), fatias[0].map((v) => br(v, 3))), `${G} tecido: a Frente com três casas na linha inteira (${tec[1].slice(1, 4).join(' ')})`)
  conta(mesma(tec[4].slice(1), soma.map((v) => br(v, 3))) && soma.every((v, i) => Math.abs(v - F.BRUTA[i]) < 0.0002), `${G} tecido: a peça inteira é a soma das três partes de pano, e bate com o estudo de moldes (PP ${tec[4][1]}, G4 ${tec[4][10]})`)
  conta(mesma(tec[5].slice(1), soma.map((v) => br(v / 1.6, 2))), `${G} tecido: os metros são a área dividida por 1,60 (PP ${tec[5][1]})`)
  conta(mesma(tec[6].slice(1), soma.map((v) => br(Math.round(v * 180), 0))), `${G} tecido: os gramas são a área vezes 180 (PP ${tec[6][1]})`)
  conta(mesma(tec[7].slice(1), ['0,44', '0,45', '0,46', '0,47', '0,48', '0,49', '0,50', '0,51', '·', '·']), `${G} tecido: a ribana em metros, e o tamanho sem número com o ponto`)
  const apagada = await pg.evaluate(() => { const tr = document.querySelector('[data-modulo] tr.apagada'); return [getComputedStyle(tr.children[1]).color, getComputedStyle(document.querySelector('[data-modulo] tr.soma').children[1]).fontWeight] })
  conta(apagada[0] === await token(pg, '--text-3') && apagada[1] === '700', `${G} tecido: a conta de apoio aparece apagada e a soma em negrito`)
  if (tema === 'light') {
    await pg.locator('[data-tecido-de-conta] .cb').click(); await pausa(pg)
    const opcoes = await textos(pg, '.mn-item')
    conta(mesma(opcoes.map((o) => o.replace(/\s*✓$/, '')), ['Não converter', 'DRYFIT POLIESTER 100%', 'MOLETOM 3 CABOS']), `tecido de conta: só entra tecido com largura e gramatura (o Jakar fica de fora)`)
    await pg.locator('.mn-item:visible', { hasText: 'MOLETOM 3 CABOS' }).click(); await pausa(pg)
    const comMoletom = await tabela(pg, '[data-modulo] table.pd-grade')
    conta(comMoletom[5][0] === 'dá em metros, com 1,85 m de largura' && comMoletom[5][1] === br(soma[0] / 1.85, 2) && comMoletom[6][0] === 'dá em gramas, com malha de 310 g/m²' && comMoletom[6][1] === br(Math.round(soma[0] * 310), 0), `tecido de conta: trocou o tecido, trocaram o metro e o grama (PP ${comMoletom[5][1]} m e ${comMoletom[6][1]} g)`)
    await pg.locator('[data-tecido-de-conta] .cb').click(); await pausa(pg)
    await pg.locator('.mn-item:visible', { hasText: 'Não converter' }).click(); await pausa(pg)
    conta((await tabela(pg, '[data-modulo] table.pd-grade')).length === 6, `tecido de conta: sem converter, as duas linhas de conta saem`)
  }
  await foto(pg, `referencia-tecido-${tema}`)

  const avi = await textos(pg, '[data-cartao="aviamentos"] .pd-lin')
  conta(mesma(avi, ['Linha poliéster 120 Aviamento · Linha 0,02 cone por peça', 'Fio texturizado, na cor do tecido pelo nome, sem ligação com o Estoque 0,03 cone por peça', 'Saco de embalagem 30x40 Insumo · Embalagem 1 un por peça']), `${G} aviamentos: de onde vem cada um e quanto vai por peça`)

  const arv = (await caixas(pg, '[data-arvore]'))[0]; const lado = (await caixas(pg, '.pd-largo'))[0]
  conta(Math.abs(arv.w / lado.w - 1.5 / 3) < 0.03 && Math.abs(arv.y - lado.y) < 1, `${G} desenho: a árvore ocupa uma coluna e meia e a ficha as outras três (${Math.round(arv.w)} e ${Math.round(lado.w)})`)
  const dois = await caixas(pg, '[data-ficha] .pd-dois > section')
  conta(dois.length === 4 && Math.abs(dois[0].y - dois[1].y) < 1 && dois[0].w > dois[1].w && Math.abs(dois[2].y - dois[3].y) < 1, `${G} desenho: o molde e os detalhes lado a lado, o molde mais largo; os aviamentos e onde a peça entra lado a lado`)
  conta((await textos(pg, '[data-cartao="onde-entra"] .pd-nota'))[0] === 'Esta peça não está em nenhum kit.', `${G} onde a peça entra: a camiseta não está em nenhum kit, e a ficha diz`)
  conta(await sobra(pg) <= 0, `${G} ficha: nada rola para o lado`)

  /* ---- fechar, e as outras abas ---- */
  await pg.locator('.pd-ficha-topo button', { hasText: 'Fechar' }).click(); await pausa(pg)
  conta(await pg.locator('[data-nada-escolhido]').count() === 1 && !new URL(pg.url()).searchParams.get('ref'), `${G} fechar: volta o convite e o endereço esquece a peça`)
  await pg.locator('[data-arvore] .pd-abas button', { hasText: 'Kits' }).click(); await pausa(pg)
  conta(mesma(await textos(pg, '[data-arvore] .pd-kits .pd-t'), ['KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO 2 peças · 020-000M + 090-000M · ficha em branco']) && await pg.locator('[data-arvore] .pd-kits .pd-alerta').count() === 0, `${G} kits: a aba lista o kit do catálogo, com as peças lidas do código, e em branco não é alerta`)
  conta((await textos(pg, '[data-nada-escolhido] h3'))[0] === 'Escolha um kit', `${G} kits: com a aba Kits à vista, o convite do lado direito é o do kit`)
  for (const [aba, titulo] of [['Movimento', 'O Movimento ainda não chegou'], ['Depósito', 'O Depósito de peças prontas ainda não chegou'], ['Estatísticas', 'As Estatísticas ainda não chegaram']]) {
    await pg.locator('.pd-abas-da-pagina button', { hasText: aba }).click(); await pausa(pg)
    conta((await textos(pg, '[data-ainda-nao] h3'))[0] === titulo && await pg.locator('.pd-busca').count() === 0, `${G} ${aba}: diz o que vai ter ali, sem busca de enfeite`)
  }
  conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   2. A BUSCA, E A PEÇA QUE CHEGA PELO ENDEREÇO
   ========================================================================== */
await secao(async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1536, altura: 900 })
  await ir(pg, '/produtos', '[data-arvore]')
  await pg.fill('.pd-busca input', 'baby'); await pausa(pg)
  conta(mesma(await textos(pg, '.pd-t .pd-nomes b'), ['BABY LOOK']) && (await textos(pg, '.pd-g')).length === 1, `busca pelo nome: só o grupo que tem, já aberto`)
  await pg.fill('.pd-busca input', '000m'); await pausa(pg)
  conta(mesma(await textos(pg, '.pd-t .pd-nomes b'), ['CAMISETA MASC TRAD', 'RAGLAN MASC SEM PUNHO', 'CALÇA MOLETOM MASC TRAD CORTE RETO SEM PUNHO', 'CALÇAO MASC SEM BOLSO']), `busca por um pedaço do código: as quatro 000M, cada uma no seu grupo`)
  await pg.fill('.pd-busca input', 'calcao'); await pausa(pg)
  conta(mesma(await textos(pg, '.pd-t .pd-nomes b'), ['CALÇAO MASC SEM BOLSO']), `busca sem acento: calcao acha CALÇAO`)
  await pg.fill('.pd-busca input', 'zzz'); await pausa(pg)
  conta((await textos(pg, '[data-arvore] .vazio h3'))[0] === 'Nada com esse nome', `busca sem resultado: diz que não achou`)
  await pg.fill('.pd-busca input', ''); await pausa(pg)
  conta((await textos(pg, '.pd-g')).length === 5, `busca limpa: as cinco gavetas de volta`)

  await ir(pg, '/produtos?ref=FT-070-000M', '[data-ficha="referencia"]')
  conta((await textos(pg, '.pd-ficha-nome h2'))[0].startsWith('CALÇA MOLETOM') && await pg.locator('[data-ref="070-000M"].pd-sel').count() === 1, `pelo endereço: a página abre na peça, com o grupo dela aberto`)
  conta((await textos(pg, '.pd-ficha-nome p'))[0] === 'FT-070-000M · masculino · PP a GG e 10A a 14A', `grade com as duas faixas: dita em palavras`)
  const faixas = await textos(pg, '[data-modulo] .pd-topo .seg:not(.pd-abas-do-modulo) button')
  conta(mesma(faixas, ['Adulta', 'Infantil']), `grade com as duas faixas: o módulo ganha a troca entre Adulta e Infantil`)
  const adulta = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(mesma(adulta[0], ['Medida, em cm', 'PP', 'P', 'M', 'G', 'GG']) && adulta.length === 6 && adulta[1][0] === 'Cintura de lado a lado, sem esticar', `medidas livres: a calça tem cintura, quadril, gancho, entrepernas e boca, só nos tamanhos ligados`)
  await pg.locator('[data-modulo] .pd-topo .seg button', { hasText: 'Infantil' }).click(); await pausa(pg)
  const infantil = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(mesma(infantil[0], ['Medida, em cm', '10A', '12A', '14A']) && mesma(infantil[1].slice(1), ['28,0', '30,0', '32,0']) && mesma(infantil[3].slice(1), ['·', '·', '·']), `faixa infantil: os três tamanhos ligados, e a medida que ninguém tirou com o ponto`)
  conta(await pg.locator('[data-cartao="molde"] .pd-solta').count() === 1 && await pg.locator('.pd-molde').count() === 0, `peça sem molde: a caixa para soltar o SVG no lugar do desenho`)
  conta(mesma((await textos(pg, '.pd-linhas > div')).slice(0, 2), ['Gola não informado', 'Manga não informado']), `detalhe que ninguém preencheu: diz não informado`)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-nota'))[0].startsWith('Nenhum aviamento nem insumo'), `peça sem aviamento: diz que não tem`)
  conta(erros.length === 0, `busca e endereço: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   3. O EDITOR
   ========================================================================== */
await secao(async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 900 })
  await ir(pg, '/produtos?ref=FT-010-000M', '[data-ficha="referencia"]')
  await editar(pg)
  const titulos = await pg.evaluate(() => [...document.querySelectorAll('[data-ficha="editar"] .pd-topo .cartao-titulo')].map((h) => [h.textContent.trim(), !!h.querySelector('.cartao-icone svg')]))
  conta(mesma(titulos.map((t) => t[0]), ['Identificação', 'Grade', 'Molde', 'Detalhes da peça', 'Medidas e tecido', 'Aviamentos e insumos por peça', 'Excluir a referência']) && titulos.every((t) => t[1]), `editor: os sete cartões do wireframe, cada título com o ícone`)
  conta(mesma(await textos(pg, '[data-ficha="editar"] .pd-ficha-topo .btn'), ['Cancelar', 'Salvar referência']) && (await textos(pg, '.pd-trilha'))[0].endsWith('editando a referência'), `editor: Cancelar e Salvar referência no topo`)
  const ident = await pg.evaluate(() => { const c = document.querySelector('[data-cartao="identificacao"]'); return { campos: c.querySelectorAll('input').length, valor: c.querySelector('input').value, nota: c.querySelector('.pd-nota').innerText } })
  conta(ident.campos === 1 && ident.valor === 'CAMISETA MASC TRAD' && ident.nota.includes('FT-010-000M') && ident.nota.includes('não muda'), `identificação: só o nome se edita, e o código é dito como coisa que não muda`)
  conta(await pg.locator('[data-ficha="editar"] button', { hasText: 'Editar' }).count() === 0, `editor: toma o lugar da ficha, sem os botões dela`)

  /* ---- a grade ---- */
  const tam = () => pg.evaluate(() => [...document.querySelectorAll('.pd-tam')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '+' : '')))
  conta(mesma(await tam(), [...F.ADULTA.map((t) => t + '+'), ...F.INFANTIL]) && mesma(await textos(pg, '[data-cartao="grade"] .pd-campo-topo'), ['Adulta 10 de 10 ligados', 'Infantil nenhum ligado']), `grade: os dez de adulto ligados e os sete de infantil desligados`)
  await pg.locator('.pd-tam', { hasText: /^G4$/ }).click(); await pausa(pg)
  const semG4 = await tabela(pg, '[data-modulo-ed] table.pd-grade')
  conta(semG4[0].length === 10 && !semG4[0].includes('G4') && (await textos(pg, '[data-cartao="grade"] .pd-campo-topo'))[0] === 'Adulta 9 de 10 ligados', `grade: desligou o G4, a coluna dele sai da tabela`)
  await pg.locator('.pd-tam', { hasText: /^G4$/ }).click(); await pausa(pg)
  const comG4 = await tabela(pg, '[data-modulo-ed] table.pd-grade')
  conta(comG4[0][10] === 'G4' && comG4[1][10] === '84', `grade: ligou de novo, o número que estava lá voltou (${comG4[1][10]})`)

  /* ---- as medidas livres ---- */
  conta(mesma(comG4.slice(1).map((l) => l[0]), ['', '', '']) && mesma(await pg.evaluate(() => [...document.querySelectorAll('.pd-nome-da-medida')].map((i) => i.value)), ['Comprimento', 'Largura', 'Manga']), `medidas: três linhas, cada uma com o nome num campo`)
  const sug = await textos(pg, '.pd-chips-soltos .chip')
  conta(sug.includes('Ombro a ombro') && sug.includes('Cintura') && !sug.includes('Comprimento') && !sug.includes('Manga'), `medidas: as sugestões são as que a peça ainda não tem`)
  await pg.locator('.pd-chips-soltos .chip', { hasText: 'Ombro a ombro' }).click(); await pausa(pg)
  const nomes = () => pg.evaluate(() => [...document.querySelectorAll('.pd-nome-da-medida')].map((i) => i.value))
  conta(mesma(await nomes(), ['Comprimento', 'Largura', 'Manga', 'Ombro a ombro']) && !(await textos(pg, '.pd-chips-soltos .chip')).includes('Ombro a ombro'), `medidas: tocar na sugestão adiciona a linha e a sugestão sai`)
  conta(await pg.evaluate(() => document.querySelectorAll('tr[data-medida]')[3].querySelector('.pd-como').value) === 'de costura a costura', `medidas: a sugestão já traz o como medir`)
  const vazias = await pg.evaluate(() => { const tr = document.querySelectorAll('tr[data-medida]')[3]; const c = tr.querySelector('td.vazia input'); return [tr.querySelectorAll('td.vazia').length, getComputedStyle(c).borderTopColor, getComputedStyle(c).backgroundColor] })
  conta(vazias[0] === 10 && vazias[1] === await token(pg, '--brand') && vazias[2] === await token(pg, '--brand-soft'), `medidas: a linha nova tem os dez campos em vermelho, que é tamanho ligado sem número`)
  await pg.fill('.pd-outra input', 'Altura do bolso'); await pg.press('.pd-outra input', 'Enter'); await pausa(pg)
  conta((await nomes())[4] === 'Altura do bolso' && await pg.inputValue('.pd-outra input') === '', `medidas: escrever o nome e dar Enter adiciona uma medida que não estava na lista`)
  await pg.fill('.pd-outra input', 'largura'); await pg.locator('.pd-outra button').click(); await pausa(pg)
  conta((await nomes()).length === 5 && (await recado(pg)).includes('já está na tabela'), `medidas: a mesma medida duas vezes não entra, e a página avisa`)
  await pg.fill('.pd-outra input', '')

  /* a ordem: pelo teclado e pelo arrasto */
  await pg.locator('tr[data-medida] .pd-pega').nth(4).focus(); await pg.keyboard.press('ArrowUp'); await pausa(pg, 150)
  conta(mesma(await nomes(), ['Comprimento', 'Largura', 'Manga', 'Altura do bolso', 'Ombro a ombro']), `ordem pelo teclado: seta para cima sobe a medida uma linha`)
  await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pausa(pg, 150)
  conta((await nomes())[0] === 'Altura do bolso', `ordem pelo teclado: chega no topo e para ali`)
  {
    const alca = await pg.locator('tr[data-medida] .pd-pega').nth(0).boundingBox()
    const alvo = await pg.locator('tr[data-medida]').nth(3).boundingBox()
    await pg.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2); await pg.mouse.down()
    await pg.mouse.move(alca.x + alca.width / 2, alvo.y + alvo.height / 2, { steps: 8 }); await pausa(pg, 150)
    const presa = await pg.locator('tr[data-medida].presa').count()
    await pg.mouse.up(); await pausa(pg, 150)
    conta(presa === 1 && mesma(await nomes(), ['Comprimento', 'Largura', 'Manga', 'Altura do bolso', 'Ombro a ombro']) && await pg.locator('tr[data-medida].presa').count() === 0, `ordem pelo arrasto: puxada pela alça até a quarta linha, a medida fica lá (${(await nomes()).join(', ')})`)
  }
  await pg.locator('tr[data-medida]').nth(3).getByRole('button', { name: 'Tirar a medida Altura do bolso' }).click(); await pausa(pg)
  conta(mesma(await nomes(), ['Comprimento', 'Largura', 'Manga', 'Ombro a ombro']), `medidas: a lixeira tira a linha`)
  await pg.locator('.pd-nome-da-medida').nth(2).fill('Manga curta'); await pausa(pg, 150)

  /* colar da planilha */
  await pg.evaluate(() => {
    const campo = document.querySelectorAll('tr[data-medida]')[3].querySelector('td input')
    const dt = new DataTransfer(); dt.setData('text/plain', '41\t42\t43,5\t44\t45\t46\t47\t48\t49\t50\r\n')
    campo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }); await pausa(pg)
  const colada = (await tabela(pg, '[data-modulo-ed] table.pd-grade'))[4]
  conta(mesma(colada.slice(1), ['41', '42', '43,5', '44', '45', '46', '47', '48', '49', '50']), `colar: uma linha copiada da planilha se distribui pelos dez tamanhos`)
  await pg.evaluate(() => {
    const campo = document.querySelectorAll('tr[data-medida]')[0].querySelectorAll('td input')[8]
    const dt = new DataTransfer(); dt.setData('text/plain', '90\t91\t92\n93\t94\t95')
    campo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }); await pausa(pg)
  const bloco = await tabela(pg, '[data-modulo-ed] table.pd-grade')
  conta(bloco[1][9] === '90' && bloco[1][10] === '91' && bloco[2][9] === '93' && bloco[2][10] === '94' && bloco[3][9] === '27', `colar: um bloco de duas linhas desce pelas medidas, e o que passa da última coluna fica de fora`)
  await foto(pg, 'editor-medidas')

  /* ---- o que não deixa salvar ---- */
  const campoDe = (linha, coluna) => pg.locator('tr[data-medida]').nth(linha).locator('td input').nth(coluna)
  await campoDe(1, 2).fill('5x'); await pausa(pg, 150)
  conta(await campoDe(1, 2).getAttribute('aria-invalid') === 'true' && await pg.locator('tr[data-medida]').nth(1).locator('td.erro').count() === 1, `campo com letra: marcado na hora`)
  await abaDoModulo(pg, 'Tecido')
  const antes = gravados.length
  await salvar(pg)
  conta(gravados.length === antes && (await textos(pg, '.aviso'))[0]?.includes('Em "Largura", o tamanho M não é um número.'), `não salva com letra no lugar de número: diz a medida e o tamanho, e nada vai para o banco`)
  conta(await pg.locator('[data-modulo-ed="medidas"]').count() === 1, `o erro leva para a aba onde ele está: a página voltou para Medidas`)
  await campoDe(1, 2).fill('53')
  await pg.fill('[data-cartao="identificacao"] input', '   '); await salvar(pg)
  conta(gravados.length === antes && (await textos(pg, '.aviso'))[0]?.includes('precisa de um nome'), `não salva sem nome`)
  await pg.fill('[data-cartao="identificacao"] input', 'CAMISETA MASC TRADICIONAL')

  /* ---- o tecido e as partes ---- */
  await abaDoModulo(pg, 'Tecido')
  const tecEd = await tabela(pg, '[data-modulo-ed] table.pd-grade')
  conta(mesma(tecEd.map((l) => l[0]), ['Parte do molde, em m²', 'Frente cortada 1 vez', 'Costas cortada 1 vez', 'Mangas cortada 2 vezes', 'A peça inteira em m², só o pano, já com a perda do corte', 'dá em metros, com 1,60 m de largura', 'dá em gramas, com malha de 180 g/m²', 'Ribana da gola em metros']), `tecido no editor: o pano, a soma, a conta e a fita, como na ficha`)
  conta(await pg.locator('tr[data-parte="Ribana da gola"] td.vazia').count() === 2, `tecido no editor: os dois tamanhos da ribana sem número em vermelho`)
  const frentePP = pg.locator('tr[data-parte="Frente"] td input').first()
  const somaAntes = (await tabela(pg, '[data-modulo-ed] table.pd-grade'))[4][1]
  await frentePP.fill('0,5'); await pausa(pg, 200)
  const somaDepois = (await tabela(pg, '[data-modulo-ed] table.pd-grade'))[4]
  const esperada = 0.5 + Math.round(F.BRUTA[0] * 0.37 * 10000) / 10000 + Math.round(F.BRUTA[0] * 0.27 * 10000) / 10000
  conta(somaAntes !== somaDepois[1] && somaDepois[1] === br(esperada, 3), `tecido no editor: a soma anda junto com o que é digitado (PP de ${somaAntes} para ${somaDepois[1]})`)
  await frentePP.fill('0,'); await pausa(pg, 200)
  conta((await tabela(pg, '[data-modulo-ed] table.pd-grade'))[4][1] === br(esperada - 0.5, 3) && await pg.locator('tr[data-parte="Frente"] td.erro').count() === 1, `tecido no editor: número pela metade não entra na soma e fica marcado`)
  await frentePP.fill('0,3602')

  await pg.locator('[data-modulo-ed] button', { hasText: 'Parte do molde' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Nova parte do molde', `parte do molde: abre a caixa da parte nova`)
  await naModal(pg).getByRole('button', { name: 'Guardar' }).click(); await pausa(pg, 150)
  conta((await naModal(pg).locator('.campo.erro .dica').innerText()).includes('Dê um nome'), `parte do molde: sem nome não guarda`)
  await naModal(pg).locator('input').nth(0).fill('frente'); await naModal(pg).getByRole('button', { name: 'Guardar' }).click(); await pausa(pg, 150)
  conta((await naModal(pg).locator('.campo.erro .dica').innerText()).includes('Já existe uma parte chamada'), `parte do molde: nome repetido não guarda`)
  await naModal(pg).locator('input').nth(0).fill('Bolso'); await naModal(pg).locator('input').nth(1).fill('2')
  await naModal(pg).getByRole('button', { name: 'Guardar' }).click(); await pausa(pg)
  conta((await tabela(pg, '[data-modulo-ed] table.pd-grade'))[4][0] === 'Bolso cortada 2 vezes' && (await textos(pg, '[data-cartao="molde"] .pd-tag')).includes('Bolso 2x'), `parte do molde: a parte nova entra na tabela, acima da soma, e nas etiquetas do molde`)
  await pg.locator('tr[data-parte="Bolso"] td input').first().fill('0,012')
  await pg.locator('[data-cartao="molde"] .pd-tag-nome', { hasText: 'Ribana da gola' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Parte do molde' && await naModal(pg).locator('input').nth(0).inputValue() === 'Ribana da gola' && (await naModal(pg).locator('.seg button.ligado').innerText()) === 'Fita, em metros', `parte do molde: a etiqueta abre a parte que existe, com a unidade dela`)
  await naModal(pg).locator('input').nth(0).fill('Ribana'); await naModal(pg).getByRole('button', { name: 'Guardar' }).click(); await pausa(pg)
  conta((await textos(pg, '[data-cartao="molde"] .pd-tag')).includes('Ribana 1x') && await pg.locator('tr[data-parte="Ribana"]').count() === 1, `parte do molde: mudar o nome não perde os números da parte`)
  await pg.getByRole('button', { name: 'Tirar Costas' }).click(); await pausa(pg)
  conta(!(await textos(pg, '[data-cartao="molde"] .pd-tag')).some((t) => t.startsWith('Costas')) && await pg.locator('tr[data-parte="Costas"]').count() === 0, `parte do molde: o X da etiqueta tira a parte da tabela também`)
  await foto(pg, 'editor-tecido')

  /* ---- os aviamentos ---- */
  await pg.locator('[data-cartao="aviamentos"] .sel .cb').click(); await pausa(pg)
  const livres = (await textos(pg, '.mn-item')).map((o) => o.replace(/\s*✓$/, ''))
  conta(mesma(livres, ['Adicionar um material do Estoque', 'Elástico 30 mm · Elástico', 'Cordão de poliéster · Cordão']), `aviamentos: o seletor só oferece o que a ficha ainda não tem`)
  await pg.locator('.mn-item:visible', { hasText: 'Elástico 30 mm' }).click(); await pausa(pg)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-lin'))[3]?.startsWith('Elástico 30 mm Aviamento · Elástico') && await pg.locator('[data-material="Elástico 30 mm"] small').last().innerText() === 'm', `aviamentos: o do Estoque entra com a unidade do Estoque`)
  await salvar(pg)
  conta(gravados.length === antes && (await textos(pg, '.aviso'))[0]?.includes('Diga quanto de "Elástico 30 mm"'), `não salva com aviamento sem quantidade`)
  await pg.locator('[data-material="Elástico 30 mm"] input').fill('0,7')
  await pg.fill('.pd-outro-material input[aria-label="Nome do aviamento"]', 'Etiqueta de composição'); await pg.locator('.pd-outro-material button').click(); await pausa(pg)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-lin'))[4]?.startsWith('Etiqueta de composição pelo nome, sem ligação com o Estoque') && await pg.locator('[data-material="Etiqueta de composição"] small').last().innerText() === 'un', `aviamentos: pelo nome, entra sem ligação com o Estoque e com a unidade un`)
  await pg.locator('[data-material="Etiqueta de composição"] input').fill('1')
  await pg.getByRole('button', { name: 'Tirar Saco de embalagem 30x40' }).click(); await pausa(pg)

  /* ---- o molde no editor: só sobe no Salvar ---- */
  await pg.setInputFiles('[data-ficha="editar"] [data-arquivo-do-molde]', { name: 'molde.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(F.OUTRO_MOLDE) }); await pausa(pg, 400)
  conta(!gravados.some((g) => g.u === 'rpc/salvar_molde_da_referencia') && (await textos(pg, '[data-cartao="molde"] .pd-topo-n'))[0] === 'sobe ao salvar' && await pg.evaluate(() => decodeURIComponent(document.querySelector('.pd-molde').src).includes('<rect')), `molde no editor: o desenho novo aparece e espera o Salvar`)
  await pg.setInputFiles('[data-ficha="editar"] [data-arquivo-do-molde]', { name: 'ruim.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg><script>alert(1)</script></svg>') }); await pausa(pg, 400)
  conta((await recado(pg)).includes('programa dentro') && await pg.evaluate(() => decodeURIComponent(document.querySelector('.pd-molde').src).includes('<rect')), `molde no editor: SVG com script é recusado, e o desenho que estava continua`)
  await pg.setInputFiles('[data-ficha="editar"] [data-arquivo-do-molde]', { name: 'foto.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('isto não é um desenho') }); await pausa(pg, 400)
  conta((await recado(pg)).includes('não é um SVG'), `molde no editor: arquivo que não é SVG é recusado`)

  /* ---- os detalhes ---- */
  await pg.locator('[data-cartao="detalhes"] .campo', { hasText: 'Punho' }).locator('input').fill('  ')
  await pg.locator('[data-cartao="detalhes"] .campo', { hasText: 'Gola' }).locator('input').fill('Gola V')
  await pg.locator('[data-cartao="detalhes"] textarea').fill('Reforço de ombro a ombro.')
  await pg.locator('.pd-tam', { hasText: /^G4$/ }).click(); await pausa(pg, 150)

  /* ---- salvar ---- */
  await salvar(pg)
  const ficha = ultimo(gravados, 'rpc/salvar_ficha_da_referencia')?.corpo
  const f = ficha?.p_ficha
  conta(!!f && ficha.p_referencia === 'r000' && mesma(Object.keys(f).sort(), ['detalhes', 'materiais', 'medidas', 'nome', 'observacao', 'partes', 'tamanhos']), `salvar: a ficha vai inteira, numa chamada só`)
  conta(f?.nome === 'CAMISETA MASC TRADICIONAL' && mesma(f.tamanhos, F.ADULTA.slice(0, 9)), `salvar: o nome novo e a grade sem o G4`)
  conta(mesma(f?.detalhes, { gola: 'Gola V', manga: 'Curta, com bainha', barra: 'Bainha de 2 cm', costura: 'Overloque de 4 fios e galoneira' }) && f.observacao === 'Reforço de ombro a ombro.', `salvar: o detalhe apagado não vai, e o texto vai aparado`)
  conta(mesma(f?.medidas.map((m) => m.nome), ['Comprimento', 'Largura', 'Manga curta', 'Ombro a ombro']) && f.medidas[3].como_medir === 'de costura a costura', `salvar: as medidas na ordem da tela, com o nome trocado`)
  conta(mesma(f?.medidas[3].valores, { PP: 41, P: 42, M: 43.5, G: 44, GG: 45, XG: 46, G1: 47, G2: 48, G3: 49 }) && f.medidas[0].valores.G3 === 90 && !('G4' in f.medidas[0].valores), `salvar: os números vão como número, com a vírgula virando ponto, e o tamanho desligado fica de fora`)
  conta(mesma(f?.partes.map((p) => [p.nome, p.vezes, p.unidade]), [['Frente', 1, 'm2'], ['Mangas', 2, 'm2'], ['Ribana', 1, 'm'], ['Bolso', 2, 'm2']]) && f.partes[0].quantidades.PP === 0.3602 && f.partes[3].quantidades.PP === 0.012 && Object.keys(f.partes[3].quantidades).length === 1, `salvar: as partes, com a que saiu fora e a nova dentro`)
  conta(mesma(f?.materiais, [{ material_id: 'av1', nome: 'Linha poliéster 120', quantidade: 0.02, unidade: 'cone' }, { material_id: null, nome: 'Fio texturizado, na cor do tecido', quantidade: 0.03, unidade: 'cone' }, { material_id: 'av2', nome: 'Elástico 30 mm', quantidade: 0.7, unidade: 'm' }, { material_id: null, nome: 'Etiqueta de composição', quantidade: 1, unidade: 'un' }]), `salvar: os aviamentos, com o do Estoque ligado pelo id e o outro só pelo nome`)
  const iFicha = gravados.findIndex((g) => g.u === 'rpc/salvar_ficha_da_referencia'); const iMolde = gravados.findIndex((g) => g.u === 'rpc/salvar_molde_da_referencia')
  conta(iMolde > iFicha && gravados[iMolde].corpo.p_referencia === 'r000' && gravados[iMolde].corpo.p_svg === F.OUTRO_MOLDE, `salvar: o molde novo sobe depois da ficha, inteiro`)
  conta(await pg.locator('[data-ficha="referencia"]').count() === 1 && (await recado(pg)).includes('Ficha de CAMISETA MASC TRADICIONAL salva'), `salvar: volta para a ficha e avisa`)

  /* a página lê de volta o que mandou */
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'CAMISETA MASC TRADICIONAL' && (await textos(pg, '.pd-ficha-nome p'))[0].endsWith('grade adulta, PP a G3') && (await textos(pg, '[data-ref="010-000M"] .pd-nomes b'))[0] === 'CAMISETA MASC TRADICIONAL', `depois de salvar: o nome novo na ficha e na árvore, e a grade até o G3`)
  const lida = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(lida[0].length === 10 && lida[4][0] === 'Ombro a ombro de costura a costura' && lida[4][3] === '43,5' && lida[3][0] === 'Manga curta do ombro à bainha', `depois de salvar: a tabela de medidas com a linha nova e o nome trocado`)
  conta(await pg.evaluate(() => decodeURIComponent(document.querySelector('.pd-molde').src).includes('<rect')), `depois de salvar: o molde novo na ficha`)
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-ficha="referencia"]'); await pausa(pg, 400)
  await abaDoModulo(pg, 'Tecido')
  const relida = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(mesma(relida.map((l) => l[0].split(' ')[0]), ['Parte', 'Frente', 'Mangas', 'Bolso', 'A', 'dá', 'dá', 'Ribana']) && relida[3][1] === '0,012' && relida[3][2] === '·', `depois de recarregar: o banco devolve as partes como foram salvas, com o bolso de 0,012`)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-lin')).length === 4 && (await textos(pg, '.pd-linhas > div'))[2] === 'Punho não informado', `depois de recarregar: os quatro aviamentos, e o punho apagado como não informado`)

  /* ---- trocar o molde direto da ficha ---- */
  const moldesAntes = gravados.filter((g) => g.u === 'rpc/salvar_molde_da_referencia').length
  await pg.setInputFiles('[data-ficha="referencia"] [data-arquivo-do-molde]', { name: 'molde.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(F.MOLDE) }); await pausa(pg, 600)
  conta(gravados.filter((g) => g.u === 'rpc/salvar_molde_da_referencia').length === moldesAntes + 1 && ultimo(gravados, 'rpc/salvar_molde_da_referencia').corpo.p_svg === F.MOLDE && (await recado(pg)).includes('Molde trocado') && await pg.evaluate(() => decodeURIComponent(document.querySelector('.pd-molde').src).includes('<path')), `molde na ficha: Trocar o SVG grava na hora e mostra o desenho novo`)
  conta(erros.length === 0, `editor: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   4. O BANCO RECUSANDO, COPIAR DE OUTRA, E SAIR SEM SALVAR
   ========================================================================== */
await secao(async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 900, recusa: 1 })
  await ir(pg, '/produtos?ref=FT-010-001M', '[data-ficha="referencia"]')
  conta((await textos(pg, '[data-modulo] .pd-nota'))[0].startsWith('Esta peça ainda não tem tabela de medidas') && await pg.locator('[data-modulo] table').count() === 0, `ficha em branco: sem tabela, com o convite para a primeira medida`)
  await pg.locator('[data-modulo] button', { hasText: 'Adicionar medida' }).click(); await pg.waitForSelector('[data-ficha="editar"]'); await pausa(pg)
  conta(await pg.locator('[data-modulo-ed="medidas"]').count() === 1 && await pg.locator('[data-modulo-ed] table').count() === 0, `Adicionar medida na ficha: abre o editor já na aba Medidas`)

  /* cancelar sem ter mexido sai direto */
  await pg.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)
  conta(await pg.locator('[data-ficha="referencia"]').count() === 1 && await naModal(pg).count() === 0, `cancelar sem mudança: sai sem perguntar`)
  await editar(pg)

  /* copiar as medidas de outra */
  await pg.locator('[data-modulo-ed] button', { hasText: 'Copiar as medidas de outra referência' }).click(); await pausa(pg)
  const fontes = await naModal(pg).locator('.pd-lin').allInnerTexts()
  conta(fontes.length === 3 && fontes.every((t) => !t.includes('GOLA V')) && fontes.some((t) => /BABY LOOK[\s\S]*2 medidas/.test(t)) && fontes.some((t) => /CALÇA MOLETOM[\s\S]*5 medidas/.test(t)), `copiar medidas: lista quem tem tabela de medidas, e não a própria peça`)
  await naModal(pg).locator('input[type=search]').fill('baby'); await pausa(pg, 200)
  await naModal(pg).locator('.pd-lin').first().click(); await pausa(pg, 500)
  const copiadas = await tabela(pg, '[data-modulo-ed] table.pd-grade')
  conta(copiadas.length === 3 && copiadas[1][1] === '56' && copiadas[1][7] === '' && (await recado(pg)).includes('Medidas copiadas de BABY LOOK'), `copiar medidas: as duas medidas da Baby Look entram, e o tamanho que ela não tem fica vazio`)
  conta(!gravados.some((g) => g.u.startsWith('rpc/salvar')), `copiar medidas: nada foi salvo ainda`)

  /* sair com mudança sem salvar */
  await pg.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Sair sem salvar?', `cancelar com mudança: a página pergunta antes`)
  await naModal(pg).getByRole('button', { name: 'Continuar editando' }).click(); await pausa(pg)
  conta(await pg.locator('[data-ficha="editar"]').count() === 1 && (await tabela(pg, '[data-modulo-ed] table.pd-grade')).length === 3, `continuar editando: o que foi digitado está lá`)
  await pg.locator('[data-ref="010-004F"] .pd-t-nome').click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Sair sem salvar?' && (await textos(pg, '.pd-ficha-nome h2'))[0] === 'CAMISETA MASC TRAD GOLA V', `trocar de peça com mudança: pergunta antes, e a peça não troca`)
  await naModal(pg).getByRole('button', { name: 'Continuar editando' }).click(); await pausa(pg)
  await pg.locator('.pd-abas-da-pagina button', { hasText: 'Movimento' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Sair sem salvar?' && await pg.locator('[data-ainda-nao]').count() === 0, `trocar de aba com mudança: pergunta antes, e a aba não troca`)
  await naModal(pg).getByRole('button', { name: 'Continuar editando' }).click(); await pausa(pg)

  /* o banco recusa */
  await salvar(pg)
  conta(gravados.filter((g) => g.u === 'rpc/salvar_ficha_da_referencia').length === 1 && (await textos(pg, '.aviso'))[0]?.includes('A medida "Comprimento" está duas vezes na tabela.') && await pg.locator('[data-ficha="editar"]').count() === 1, `o banco recusa: a frase dele aparece e o editor fica aberto, com tudo`)
  await salvar(pg)
  conta(gravados.filter((g) => g.u === 'rpc/salvar_ficha_da_referencia').length === 2 && await pg.locator('[data-ficha="referencia"]').count() === 1, `salvar de novo: passa`)
  conta((await textos(pg, '[data-ref="010-001M"]'))[0] === 'CAMISETA MASC TRAD GOLA V 010-001M · masculino · faltam tecido e molde 2' && (await textos(pg, '.pagina-topo .sub'))[0] === '8 referências · 1 kit · 1 com a ficha completa', `depois de salvar: a linha da árvore deixa de dizer em branco e passa a dizer o que falta`)
  conta((await textos(pg, '.pd-g'))[0].endsWith('2'), `depois de salvar: o grupo conta duas fichas começadas e incompletas`)

  /* descartar */
  await editar(pg)
  await pg.locator('.pd-nome-da-medida').first().fill('Outra coisa'); await pausa(pg, 150)
  await pg.locator('[data-ref="010-004F"] .pd-t-nome').click(); await pausa(pg)
  await naModal(pg).getByRole('button', { name: 'Descartar as mudanças' }).click(); await pausa(pg, 500)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'BABY LOOK' && await pg.locator('[data-ficha="referencia"]').count() === 1, `descartar: sai do editor e abre a peça que foi pedida`)
  await escolherRef(pg, '010-001M')
  conta((await tabela(pg, '[data-modulo] table.pd-grade'))[1][0].startsWith('Comprimento'), `descartar: o que foi digitado e não salvo não ficou`)
  conta(erros.length === 0, `recusa e saída: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   5. NOVA REFERÊNCIA, DUPLICAR E EXCLUIR
   ========================================================================== */
await secao(async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 900 })
  await ir(pg, '/produtos', '[data-arvore]')
  await pg.getByRole('button', { name: 'Nova referência' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Nova referência', `nova referência: abre a caixa`)
  await naModal(pg).getByRole('button', { name: 'Criar a referência' }).click(); await pausa(pg, 150)
  conta((await naModal(pg).locator('.pd-nota.pd-erro').innerText()).includes('Dê um nome'), `nova referência: sem nome não cria`)
  await naModal(pg).locator('input').first().fill('CAMISETA FEM OVERSIZE')
  await naModal(pg).locator('.sel .cb').click(); await pausa(pg)
  const gruposDaCaixa = (await textos(pg, '.mn-item')).map((o) => o.replace(/\s*✓$/, ''))
  conta(mesma(gruposDaCaixa, ['Escolha o grupo', '010 · Camisetas e polos', '020 · Raglan', '070 · Calças', '090 · Calções']), `nova referência: os grupos de peça, sem o dos kits`)
  await pg.locator('.mn-item:visible', { hasText: '010 · Camisetas e polos' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('input[inputmode=numeric]').inputValue() === '002', `nova referência: o número já vem com o primeiro livre do grupo (000 e 001 usados, vem 002)`)
  await naModal(pg).locator('.seg button', { hasText: 'Feminino' }).click(); await pausa(pg, 150)
  conta((await naModal(pg).locator('.pd-nota').last().innerText()).includes('FT-010-002F'), `nova referência: o código vai se formando com o grupo, o número e o gênero`)
  await naModal(pg).locator('input[inputmode=numeric]').fill('4'); await pausa(pg, 150)
  conta((await naModal(pg).locator('.pd-nota.pd-erro').innerText()).includes('FT-010-004F já é de BABY LOOK'), `nova referência: código que já existe é avisado na hora`)
  await naModal(pg).getByRole('button', { name: 'Criar a referência' }).click(); await pausa(pg, 200)
  conta(!gravados.some((g) => g.u === 'referencia'), `nova referência: com o código repetido não cria`)
  await naModal(pg).locator('input[inputmode=numeric]').fill('12'); await pausa(pg, 150)
  await naModal(pg).getByRole('button', { name: 'Criar a referência' }).click(); await pg.waitForSelector('[data-ficha="editar"]'); await pausa(pg, 400)
  conta(mesma(ultimo(gravados, 'referencia')?.corpo, [{ cod: 'FT-010-012F', nome: 'CAMISETA FEM OVERSIZE', grupo: '010', genero: 'F' }]), `nova referência: cria com o código FT-010-012F, o nome, o grupo e o gênero`)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'CAMISETA FEM OVERSIZE' && await pg.locator('[data-ref="010-012F"].pd-sel').count() === 1 && (await textos(pg, '.pagina-topo .sub'))[0].startsWith('9 referências'), `nova referência: entra na árvore, com o grupo aberto, e abre já no editor`)
  conta(mesma(await pg.evaluate(() => [...document.querySelectorAll('.pd-tam.on')].map((b) => b.textContent)), F.ADULTA), `nova referência: peça feminina nasce com a grade adulta ligada`)
  await pg.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)

  /* duplicar */
  await escolherRef(pg, '010-000M')
  await pg.locator('.pd-ficha-topo button', { hasText: 'Duplicar' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Duplicar CAMISETA MASC TRAD' && await naModal(pg).locator('input').first().inputValue() === 'CAMISETA MASC TRAD' && await naModal(pg).locator('input[inputmode=numeric]').inputValue() === '002', `duplicar: a caixa vem com o nome, o grupo e o gênero da peça, e o primeiro número livre`)
  await naModal(pg).locator('input').first().fill('CAMISETA MASC TRAD COM BOLSO')
  const antes = gravados.length
  await naModal(pg).getByRole('button', { name: 'Criar a cópia' }).click(); await pg.waitForSelector('[data-ficha="editar"]'); await pausa(pg, 500)
  const novos = gravados.slice(antes)
  const copia = novos.find((g) => g.u === 'rpc/salvar_ficha_da_referencia')?.corpo
  conta(mesma(novos.map((g) => g.u), ['referencia', 'rpc/salvar_ficha_da_referencia', 'rpc/salvar_molde_da_referencia']) && novos[0].corpo[0].cod === 'FT-010-002M', `duplicar: cria a peça, copia a ficha e copia o molde, nesta ordem`)
  conta(copia?.p_referencia === 'novo2' && copia.p_ficha.nome === 'CAMISETA MASC TRAD COM BOLSO' && copia.p_ficha.medidas.length === 3 && copia.p_ficha.partes.length === 4 && copia.p_ficha.materiais.length === 3 && novos[2].corpo.p_svg === F.MOLDE, `duplicar: a ficha copiada vai para a peça nova, com o nome novo, as medidas, as partes, os aviamentos e o molde`)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'CAMISETA MASC TRAD COM BOLSO' && (await tabela(pg, '[data-modulo-ed] table.pd-grade')).length === 4, `duplicar: abre a cópia no editor, com as medidas lá`)
  await foto(pg, 'duplicada-no-editor')

  /* excluir */
  await pg.getByRole('button', { name: 'Excluir a referência' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Excluir CAMISETA MASC TRAD COM BOLSO?' && (await naModal(pg).locator('.pd-nota').innerText()).includes('Isso não volta atrás'), `excluir: pergunta antes, e diz o que vai junto`)
  await naModal(pg).getByRole('button', { name: 'Manter' }).click(); await pausa(pg)
  conta(!gravados.some((g) => g.u === 'referencia DELETE') && await pg.locator('[data-ficha="editar"]').count() === 1, `excluir: Manter não apaga nada`)
  await pg.getByRole('button', { name: 'Excluir a referência' }).click(); await pausa(pg)
  await naModal(pg).getByRole('button', { name: 'Excluir', exact: true }).click(); await pausa(pg, 700)
  conta(ultimo(gravados, 'referencia DELETE')?.corpo === 'novo2' && await pg.locator('[data-ref="010-002M"]').count() === 0 && await pg.locator('[data-nada-escolhido]').count() === 1 && (await textos(pg, '.pagina-topo .sub'))[0].startsWith('9 referências'), `excluir: apaga a peça, ela sai da árvore e o lado direito volta para o convite`)
  conta(erros.length === 0, `nova, duplicar e excluir: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   6. O ACESSO
   ========================================================================== */
await secao(async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1536, altura: 900, acesso: 'edita' })
  await ir(pg, '/produtos?ref=FT-010-000M', '[data-ficha="referencia"]')
  conta(await pg.getByRole('button', { name: 'Nova referência' }).count() === 0 && mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Editar', 'Fechar']), `quem edita sem ser chefia: muda a ficha, mas não cria nem duplica referência`)
  await editar(pg)
  conta(await pg.locator('[data-cartao="excluir"]').count() === 0 && await pg.getByRole('button', { name: 'Salvar referência' }).count() === 1, `quem edita sem ser chefia: salva, e não vê o Excluir`)
  const ultimaFileira = await caixas(pg, '[data-ficha="editar"] > .pd-dois:last-of-type > section')
  conta(ultimaFileira.length === 1, `quem edita sem ser chefia: sem o Excluir, os aviamentos ocupam a fileira inteira`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg, gravados } = await abrir(nav, { largura: 1536, altura: 900, acesso: 'le' })
  await ir(pg, '/produtos?ref=FT-010-000M', '[data-ficha="referencia"]')
  conta(await pg.getByRole('button', { name: 'Nova referência' }).count() === 0 && mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Fechar']), `quem só lê: sem Nova referência, sem Editar e sem Duplicar`)
  conta(await pg.getByRole('button', { name: 'Trocar o SVG' }).count() === 0 && await pg.locator('[data-arquivo-do-molde]').count() === 0 && await pg.locator('[data-modulo] button', { hasText: 'Adicionar medida' }).count() === 0, `quem só lê: sem Trocar o SVG e sem Adicionar medida`)
  conta((await tabela(pg, '[data-modulo] table.pd-grade')).length === 4 && gravados.length === 0, `quem só lê: vê a ficha inteira e não grava nada`)
  await escolherRef(pg, '010-001M')
  conta((await textos(pg, '[data-cartao="molde"] .pd-solta'))[0] === 'Esta peça ainda não tem o desenho do molde.' && await pg.locator('[data-cartao="molde"] .btn').count() === 0, `quem só lê: peça sem molde diz que não tem, sem botão de enviar`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1536, altura: 900, acesso: 'fora' })
  await pg.goto(SITE + '/produtos', { waitUntil: 'networkidle' }); await pausa(pg, 1200)
  conta(await pg.locator('[data-arvore]').count() === 0 && await pg.locator('.pd-barra').count() === 0, `quem não tem a página: /produtos não abre`)
  conta(!(await pg.locator('nav, aside').first().innerText()).includes('Fichas técnicas'), `quem não tem a página: Fichas técnicas não aparece no menu`)
  await ctx.close()
})

/* ==========================================================================
   7. SEM REFERÊNCIA, COM A LEITURA FALHANDO E SEM O APOIO
   ========================================================================== */
await secao(async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1536, altura: 900, estado: 'vazio' })
  await ir(pg, '/produtos', '[data-arvore]')
  conta((await textos(pg, '[data-arvore] .vazio h3'))[0] === 'Nenhuma referência cadastrada' && (await textos(pg, '.pagina-topo .sub'))[0] === '0 referências · 0 kits · 0 com a ficha completa', `sem referência: a árvore diz que não tem nenhuma`)
  conta(erros.length === 0, `sem referência: nenhum erro de JavaScript`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1536, altura: 900, estado: 'erro' })
  await ir(pg, '/produtos', '.vazio')
  conta((await textos(pg, '.vazio h3'))[0] === 'Não consegui ler as fichas técnicas' && await pg.getByRole('button', { name: 'Tentar de novo' }).count() === 1 && await pg.locator('[data-arvore]').count() === 0, `leitura falhando: diz que não leu e oferece tentar de novo`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1536, altura: 900, estado: 'sem-apoio' })
  await ir(pg, '/produtos?ref=FT-010-000M', '[data-ficha="referencia"]')
  await abaDoModulo(pg, 'Tecido')
  const semConta = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(semConta.length === 6 && (await textos(pg, '[data-modulo] .pd-nota'))[0].startsWith('Nenhum tecido do catálogo tem largura e gramatura'), `sem o catálogo de tecidos: a ficha continua de pé, só sem o metro e o grama, e diz por quê`)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-lin'))[0] === 'Linha poliéster 120 do Estoque 0,02 cone por peça', `sem o Estoque: o aviamento continua na ficha, só sem o grupo`)
  await editar(pg)
  conta((await textos(pg, '[data-cartao="aviamentos"] .pd-nota'))[0] === 'O Estoque ainda não tem aviamento nem insumo cadastrado.' && await pg.locator('[data-cartao="aviamentos"] .sel').count() === 0, `sem o Estoque no editor: diz que não há o que escolher, e deixa adicionar pelo nome`)
  conta(erros.length === 0, `sem o apoio: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   7b. OS KITS
   ========================================================================== */
const abrirKit = async (pg, curto) => { await pg.locator(`[data-kit="${curto}"] .pd-t-nome`).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 400) }
const editarKit = async (pg) => { await pg.locator('[data-ficha="kit"] .pd-ficha-topo button', { hasText: 'Editar a ficha' }).click(); await pg.waitForSelector('[data-editor-do-kit]'); await pausa(pg, 400) }
const resumo = (pg) => pg.evaluate(() => { const d = document.querySelector('.pd-resumo'); const o = {}; [...d.querySelectorAll('dt')].forEach((dt) => { o[dt.textContent.trim()] = dt.nextElementSibling.textContent.trim() }); return o })
const fabricacao = (pg) => tabela(pg, '[data-ficha="kit"] table.pd-fab')
const escolherNoSeletor = async (pg, gatilho, opcao) => { await gatilho.click(); await pausa(pg, 200); await pg.locator('.mn-item:visible', { hasText: opcao }).first().click(); await pausa(pg, 200) }

await secao(async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 900 })
  await ir(pg, '/produtos', '[data-arvore]')

  /* a busca que só o kit responde troca de aba sozinha */
  await pg.fill('.pd-busca input', 's/ bolso'); await pausa(pg)
  conta(await pg.locator('[data-arvore] .pd-kits .pd-t').count() === 1 && (await textos(pg, '[data-arvore] .pd-abas button.ligado'))[0] === 'Kits 1', `busca que só o kit responde: a árvore passa para a aba Kits sozinha`)
  await pg.fill('.pd-busca input', '090-000m'); await pausa(pg)
  conta(mesma(await textos(pg, '.pd-t .pd-nomes b'), ['CALÇAO MASC SEM BOLSO']) && mesma(await textos(pg, '[data-arvore] .pd-abas button'), ['Referências 1', 'Kits 1']), `busca pelo código de uma peça: acha a referência, e conta também o kit que tem essa peça`)
  await pg.fill('.pd-busca input', ''); await pausa(pg)

  /* ---- a ficha do kit que veio do catálogo ---- */
  await pg.locator('[data-arvore] .pd-abas button', { hasText: 'Kits' }).click(); await pausa(pg)
  await abrirKit(pg, 'KIT-020-000M-090-000M')
  conta(new URL(pg.url()).searchParams.get('kit') === 'FT-KIT-020-000M-090-000M', `kit: o endereço guarda o kit aberto`)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO' && (await textos(pg, '.pd-ficha-nome p'))[0] === 'KIT-020-000M-090-000M · masculino · grade adulta, PP a G4' && (await textos(pg, '.pd-trilha'))[0] === 'KIT Kits › 2 peças', `kit: o nome, o código sem o FT, o gênero e a grade que as peças têm em comum`)
  conta(mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Editar a ficha', 'Fechar']), `kit: Editar a ficha e Fechar`)
  const titulosDoKit = await pg.evaluate(() => [...document.querySelectorAll('[data-ficha="kit"] .pd-topo .cartao-titulo')].map((h) => [h.textContent.trim(), !!h.querySelector('.cartao-icone svg')]))
  conta(mesma(titulosDoKit.map((t) => t[0]), ['Desenho do kit', 'Peças do kit', 'Ficha de fabricação', 'Tecido de um kit, em cada tamanho', 'Aviamentos e insumos de um kit']) && titulosDoKit.every((t) => t[1]), `kit: os cinco cartões, cada título com o ícone`)
  conta(mesma(await textos(pg, '[data-cartao="pecas"] .pd-lin'), ['PARTE DE CIMA RAGLAN MASC SEM PUNHO 020-000M · masculino Abrir', 'PARTE DE BAIXO CALÇAO MASC SEM BOLSO 090-000M · masculino Abrir']), `kit: as duas peças, cada uma com o papel dela e o Abrir`)
  const fab = await fabricacao(pg)
  conta(mesma(fab[0], ['Característica', 'Parte de cima RAGLAN MASC SEM PUNHO', 'Parte de baixo CALÇAO MASC SEM BOLSO']) && mesma(fab.slice(1).map((l) => l[0]), ['Tecidos', 'Gola', 'Manga', 'Punho', 'Barra', 'Costura', 'Design impresso', 'Etiqueta']), `ficha de fabricação: uma coluna por peça, e as oito características`)
  conta(mesma(fab[1].slice(1), ['não escolhido', 'não escolhido']) && mesma(fab[2].slice(1), ['não informado', 'não informado']) && mesma(fab[7].slice(1), ['nenhum', 'nenhum']) && mesma(fab[8].slice(1), ['não escolhida', 'não escolhida']), `ficha de fabricação em branco: cada célula diz o que ainda não foi dito`)
  conta((await textos(pg, '[data-cartao="tecido-do-kit"] .pd-nota'))[0].includes('falta escolher o tecido de cada peça') && await pg.locator('[data-cartao="tecido-do-kit"] table').count() === 0, `tecido de um kit sem tecido escolhido: diz o que falta, sem tabela vazia`)
  conta(await pg.locator('[data-cartao="molde"] .pd-solta').count() === 1 && (await textos(pg, '[data-cartao="molde"] .pd-solta'))[0].startsWith('Solte aqui o SVG do kit'), `kit sem desenho: a caixa para soltar o SVG do kit`)
  await foto(pg, 'kit-em-branco')

  /* a peça abre a referência, e a referência sabe em que kit entra */
  await pg.locator('[data-peca="020-000M"]').getByRole('button', { name: 'Abrir' }).click(); await pg.waitForSelector('[data-ficha="referencia"]'); await pausa(pg, 400)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'RAGLAN MASC SEM PUNHO' && (await textos(pg, '[data-arvore] .pd-abas button.ligado'))[0] === 'Referências 8' && await pg.locator('[data-ref="020-000M"].pd-sel').count() === 1, `Abrir a peça: vai para a ficha da referência, com a aba Referências e o grupo dela abertos`)
  conta(mesma(await textos(pg, '[data-cartao="onde-entra"] .pd-lin'), ['KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO parte de cima do kit Abrir']), `onde a peça entra: o raglan diz em que kit está, e com que papel`)
  await editar(pg)
  conta((await textos(pg, '[data-cartao="excluir"] .pd-nota'))[0].startsWith('Esta referência está em 1 kit. Excluir tira a peça das listas e do kit'), `excluir a referência que está num kit: o aviso diz em quantos kits ela está`)
  await pg.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)
  await pg.locator('[data-cartao="onde-entra"]').getByRole('button', { name: 'Abrir' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 400)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0].startsWith('KIT RAGLAN') && (await textos(pg, '[data-arvore] .pd-abas button.ligado'))[0] === 'Kits 1', `Abrir o kit pela referência: volta para a ficha do kit`)

  /* ---- o editor do kit que existe ---- */
  await editarKit(pg)
  conta((await textos(pg, '.pagina-topo h1'))[0] === 'Editor da ficha do kit' && (await textos(pg, '.pagina-topo .acima'))[0] === 'Fichas técnicas · Kits' && (await textos(pg, '.pagina-topo .sub'))[0] === 'KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO · 2 peças · 5 pendências', `editor do kit: toma a página, com o nome, as peças e as pendências no subtítulo`)
  conta(mesma(await textos(pg, '.pagina-topo .btn'), ['Voltar', 'Excluir o kit', 'Salvar o kit']) && await pg.locator('.pd-barra, [data-arvore]').count() === 0, `editor do kit: Voltar, Excluir o kit e Salvar o kit; a barra e a árvore saem`)
  const colunas = await caixas(pg, '.pd-editor-kit > *')
  conta(colunas.length === 3 && Math.round(colunas[0].w) === 320 && Math.round(colunas[2].w) === 320 && colunas[1].w > 480 && Math.abs(colunas[0].y - colunas[1].y) < 1 && Math.abs(colunas[1].y - colunas[2].y) < 1 && Math.round(colunas[1].x - colunas[0].dir) === 16, `editor do kit: três colunas, 320 de cada lado e a ficha no meio, com 16 px entre elas (${colunas.map((c) => Math.round(c.w)).join(' / ')})`)
  const titulosDoEditor = await pg.evaluate(() => [...document.querySelectorAll('.pd-editor-kit .pd-topo .cartao-titulo')].map((h) => [h.textContent.trim(), !!h.querySelector('.cartao-icone svg')]))
  conta(mesma(titulosDoEditor.map((t) => t[0]), ['Peças do kit', 'Ficha de fabricação da parte de cima', 'Resumo do kit', 'Para salvar']) && titulosDoEditor.every((t) => t[1]), `editor do kit que existe: os quatro cartões com ícone, e sem o Adicionar peça`)
  conta(await pg.locator('.pd-peca-tira').count() === 0 && (await textos(pg, '[data-cartao="pecas-do-kit"] .pd-rodape'))[0].startsWith('As peças não mudam depois que o kit é criado'), `editor do kit que existe: as peças estão travadas, e a página diz por quê`)
  conta(mesma(await resumo(pg), { 'Código': 'KIT-020-000M-090-000M', 'Peças': '2', 'Grade': 'grade adulta, PP a G4', 'Tecidos': 'nenhum escolhido', 'Design impresso': 'nenhum', 'Etiqueta': 'não escolhida' }), `resumo do kit: o código, as peças, a grade, e o que ainda não foi escolhido`)
  conta(mesma(await textos(pg, '[data-ainda-falta] li'), ['Parte de cima: falta escolher o tecido.', 'Parte de cima: falta escolher a etiqueta.', 'Parte de baixo: falta escolher o tecido.', 'Parte de baixo: falta escolher a etiqueta.', 'Falta o desenho do kit, em SVG.']) && await pg.locator('[data-impede]').count() === 0 && (await textos(pg, '[data-cartao="para-salvar"] .pd-nota'))[0].startsWith('Dá para salvar assim e completar depois.'), `para salvar: as cinco coisas por fazer, nenhuma impede`)
  conta((await textos(pg, '[data-da-referencia] .pd-campo-topo'))[0] === 'Da ficha da referência muda lá, e não aqui' && await pg.locator('[data-da-referencia] input').count() === 0, `editor do kit: gola, manga, punho, barra e costura são mostrados, e não editados`)

  /* os tecidos */
  conta((await textos(pg, '[data-tecidos-da-peca] .pd-nota'))[0].startsWith('A ficha desta referência ainda não tem as partes do molde'), `tecidos: a referência sem partes no molde só deixa dizer a peça inteira, e a página diz`)
  await pg.locator('[data-tecidos-da-peca]').getByRole('button', { name: 'Tecido', exact: true }).click(); await pausa(pg)
  const primeira = pg.locator('.pd-tecido-lin').first()
  conta((await primeira.locator('.sel .v').first().innerText()) === 'A peça inteira' && (await primeira.locator('.sel .v').nth(1).innerText()) === 'Escolha o tecido', `tecidos: o primeiro tecido já nasce como a peça inteira`)
  conta(await pg.locator('[data-impede]').count() === 1 && (await textos(pg, '[data-impede]'))[0].includes('tem um tecido sem a parte do molde ou sem o tecido escolhido'), `tecidos: a linha sem tecido escolhido impede de salvar, e diz de quem é`)
  conta(await pg.locator('[data-tecidos-da-peca]').getByRole('button', { name: 'Tecido', exact: true }).isDisabled(), `tecidos: sem outra parte livre, não dá para pôr outro tecido`)
  await escolherNoSeletor(pg, primeira.locator('.sel .cb').nth(1), 'DRYFIT POLIESTER 100%')
  conta(await pg.locator('[data-impede]').count() === 0 && (await resumo(pg)).Tecidos === '1 tecido', `tecidos: escolhido o tecido, a pendência some e o resumo conta`)

  /* o design impresso e a etiqueta */
  await pg.locator('[data-design] .chip', { hasText: 'Patch' }).click(); await pg.locator('[data-design] .chip', { hasText: 'Sublimação' }).click(); await pausa(pg)
  conta(mesma(await textos(pg, '[data-onde-vai] .pd-onde .tec-soft'), ['Sublimação', 'Patch']) && (await resumo(pg))['Design impresso'] === 'Sublimação, Patch', `design impresso: mais de um, na ordem da lista e não na do clique`)
  conta((await textos(pg, '[data-ainda-falta] li')).includes('Parte de cima: falta dizer onde vai Sublimação e Patch.'), `design impresso: marcou a técnica, falta dizer onde vai`)
  await pg.locator('[data-onde-vai] input').nth(0).fill('peça inteira'); await pg.locator('[data-onde-vai] input').nth(1).fill('  escudo no peito  '); await pausa(pg, 150)
  await pg.locator('[data-design] .chip', { hasText: 'DTF' }).click(); await pausa(pg, 150)
  await pg.locator('[data-design] .chip', { hasText: 'DTF' }).click(); await pausa(pg, 150)
  conta(mesma(await pg.evaluate(() => [...document.querySelectorAll('[data-onde-vai] input')].map((i) => i.value)), ['peça inteira', '  escudo no peito  ']), `design impresso: ligar e desligar outra técnica não apaga o que já foi escrito`)
  await pg.locator('[data-etiqueta] .chip', { hasText: 'Silk' }).click(); await pausa(pg, 150)
  conta(await pg.locator('[data-etiqueta] input').count() === 1, `etiqueta: escolhida a técnica, aparece o campo de onde ela vai`)
  await pg.locator('[data-etiqueta] input').fill('no decote, por dentro')
  await pg.locator('[data-etiqueta] .chip', { hasText: 'Sem etiqueta' }).click(); await pausa(pg, 150)
  conta(await pg.locator('[data-etiqueta] input').count() === 0 && (await resumo(pg)).Etiqueta === 'Sem etiqueta', `etiqueta: sem etiqueta é uma escolha, e não tem lugar`)
  await pg.locator('[data-etiqueta] .chip', { hasText: 'Silk' }).click(); await pausa(pg, 150)
  await pg.locator('[data-etiqueta] input').fill('no decote, por dentro')
  await pg.locator('[data-cartao="fabricacao-da-peca"] textarea').fill('Patch depois da costura.')

  /* a outra peça */
  await pg.locator('[data-peca="090-000M"] .pd-peca-nome').click(); await pausa(pg)
  conta((await textos(pg, '[data-cartao="fabricacao-da-peca"] .cartao-titulo'))[0] === 'Ficha de fabricação da parte de baixo' && (await textos(pg, '[data-cartao="fabricacao-da-peca"] .pd-topo-nome'))[0] === 'CALÇAO MASC SEM BOLSO' && await pg.locator('.pd-tecido-lin').count() === 0, `editor do kit: tocar na outra peça abre a ficha dela, em branco`)
  await escolherNoSeletor(pg, pg.locator('[data-cartao="fabricacao-da-peca"] .pd-form .sel .cb'), 'Acessório')
  conta((await textos(pg, '[data-peca="090-000M"] .pd-papel'))[0] === 'ACESSÓRIO' && (await textos(pg, '[data-cartao="fabricacao-da-peca"] .cartao-titulo'))[0] === 'Ficha de fabricação da acessório', `papel no kit: trocado no seletor, muda na lista de peças`)
  await escolherNoSeletor(pg, pg.locator('[data-cartao="fabricacao-da-peca"] .pd-form .sel .cb'), 'Parte de baixo')
  await pg.locator('[data-peca="020-000M"] .pd-peca-nome').click(); await pausa(pg)
  conta(await pg.locator('[data-etiqueta] input').inputValue() === 'no decote, por dentro' && await pg.locator('.pd-tecido-lin').count() === 1, `editor do kit: voltar para a primeira peça encontra o que foi preenchido`)
  await foto(pg, 'editor-do-kit')

  /* sair com mudança pergunta */
  await pg.getByRole('button', { name: 'Voltar' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Sair sem salvar?', `editor do kit: Voltar com mudança pergunta antes`)
  await naModal(pg).getByRole('button', { name: 'Continuar editando' }).click(); await pausa(pg)

  /* o desenho do kit só sobe no Salvar */
  await pg.setInputFiles('[data-editor-do-kit] [data-arquivo-do-molde]', { name: 'kit.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(F.OUTRO_MOLDE) }); await pausa(pg, 400)
  conta(!gravados.some((g) => g.u === 'rpc/salvar_molde_da_referencia') && (await textos(pg, '[data-cartao="resumo"] .pd-topo-n'))[0] === 'sobe ao salvar' && !(await textos(pg, '[data-ainda-falta] li')).includes('Falta o desenho do kit, em SVG.'), `desenho do kit no editor: aparece, espera o Salvar, e a pendência do desenho some`)

  /* salvar */
  await pg.getByRole('button', { name: 'Salvar o kit' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 600)
  const salvo = ultimo(gravados, 'rpc/salvar_kit')?.corpo
  conta(salvo?.p_kit === 'rkit' && mesma(Object.keys(salvo.p_ficha).sort(), ['nome', 'pecas']) && salvo.p_ficha.nome === 'KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO' && mesma(salvo.p_ficha.pecas.map((p) => p.referencia_id), ['r020', 'r090']), `salvar o kit: vai inteiro, numa chamada só, com as duas peças na ordem`)
  conta(mesma(salvo?.p_ficha.pecas[0], { referencia_id: 'r020', papel: 'Parte de cima', tecidos: [{ parte: 'A peça inteira', tecido_id: 't1' }], design: [{ tecnica: 'subli', onde: 'peça inteira' }, { tecnica: 'patch', onde: 'escudo no peito' }], etiqueta: 'silk', etiqueta_onde: 'no decote, por dentro', observacao: 'Patch depois da costura.' }), `salvar o kit: a peça de cima com o tecido pelo id, as duas técnicas com o texto aparado, a etiqueta e a observação`)
  conta(mesma(salvo?.p_ficha.pecas[1], { referencia_id: 'r090', papel: 'Parte de baixo', tecidos: [], design: [], etiqueta: '', etiqueta_onde: '', observacao: '' }), `salvar o kit: a peça que ninguém preencheu vai em branco, com o papel de volta`)
  const iKit = gravados.findIndex((g) => g.u === 'rpc/salvar_kit'); const iDes = gravados.findIndex((g) => g.u === 'rpc/salvar_molde_da_referencia')
  conta(iDes > iKit && gravados[iDes].corpo.p_referencia === 'rkit' && gravados[iDes].corpo.p_svg === F.OUTRO_MOLDE, `salvar o kit: o desenho sobe depois, para o kit`)

  /* a página lê de volta */
  const fab2 = await fabricacao(pg)
  conta(fab2[1][1] === 'DRYFIT POLIESTER 100% a peça inteira' && fab2[7][1] === 'Sublimação Patch sublimação: peça inteira; patch: escudo no peito' && fab2[8][1] === 'Silk no decote, por dentro' && fab2[9][0] === 'Observação' && fab2[9][1] === 'Patch depois da costura.' && fab2[9][2] === 'nenhuma', `depois de salvar: a ficha de fabricação mostra o tecido, as técnicas com o lugar, a etiqueta e a observação`)
  conta(await pg.locator('[data-ficha="kit"] .pd-fab .tec-soft').count() === 3, `depois de salvar: as técnicas e a etiqueta saem em pílula de técnica`)
  conta(await pg.evaluate(() => decodeURIComponent(document.querySelector('[data-ficha="kit"] .pd-molde')?.src ?? '').includes('<rect')) && (await caixas(pg, '[data-ficha="kit"] .pd-molde-caixa'))[0].fundo === 'rgb(255, 255, 255)', `depois de salvar: o desenho do kit aparece, sobre papel branco`)
  conta(mesma(await textos(pg, '[data-arvore] .pd-kits .pd-t'), ['KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO 2 peças · 020-000M + 090-000M · 2 coisas por fazer 2']) && await pg.locator('[data-arvore] .pd-kits .pd-sel').count() === 1, `depois de salvar: a linha do kit deixa de dizer em branco e conta o que falta (o tecido e a etiqueta da parte de baixo)`)
  conta((await textos(pg, '[data-cartao="tecido-do-kit"] .pd-nota'))[0].includes('falta medir o tecido') && await pg.locator('[data-cartao="tecido-do-kit"] table').count() === 0, `tecido de um kit com tecido escolhido e referência sem medida: diz que falta medir na referência`)
  await foto(pg, 'kit-salvo')
  conta(erros.length === 0, `kit que existe: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ---- o kit novo: mais de um tecido na mesma peça, e o código que nasce das peças ---- */
await secao(async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 900 })
  await ir(pg, '/produtos', '[data-arvore]')
  conta(mesma(await textos(pg, '.pagina-topo .btn'), ['Novo kit', 'Nova referência']), `topo: Novo kit e Nova referência, a principal por último`)
  await pg.getByRole('button', { name: 'Novo kit' }).click(); await pg.waitForSelector('[data-editor-do-kit="novo"]'); await pausa(pg)
  conta((await textos(pg, '.pagina-topo h1'))[0] === 'Novo kit' && mesma(await textos(pg, '.pagina-topo .btn'), ['Voltar', 'Criar o kit']) && (await textos(pg, '.pagina-topo .sub'))[0] === 'kit sem nome · 0 peças · 3 pendências', `kit novo: Voltar e Criar o kit, sem Excluir`)
  conta(mesma((await textos(pg, '[data-impede]')), ['O kit precisa de um nome.', 'Um kit tem pelo menos duas peças.']) && (await resumo(pg))['Código'] === 'nasce com duas peças', `kit novo vazio: o nome e as duas peças impedem, e o código ainda não existe`)
  await pg.getByRole('button', { name: 'Criar o kit' }).click(); await pausa(pg)
  conta(!gravados.some((g) => g.u === 'rpc/salvar_kit') && (await textos(pg, '[data-cartao="para-salvar"] [role=alert]'))[0]?.includes('O kit precisa de um nome.'), `kit novo vazio: Criar o kit não manda nada, e diz o que impede`)

  /* as peças entram pela busca, e o código vai se formando */
  await pg.fill('[data-cartao="adicionar-peca"] input', 'raglan'); await pausa(pg)
  conta(mesma(await textos(pg, '[data-cartao="adicionar-peca"] .pd-lin .pd-txt b'), ['RAGLAN MASC SEM PUNHO']), `adicionar peça: a busca acha a referência, e o kit que tem raglan no nome não entra`)
  await pg.locator('[data-cartao="adicionar-peca"] .pd-lin').first().click(); await pausa(pg)
  conta(await pg.locator('.pd-peca').count() === 1 && (await textos(pg, '.pd-peca .pd-papel'))[0] === 'PARTE DE CIMA' && await pg.inputValue('[data-cartao="adicionar-peca"] input') === '' && (await resumo(pg))['Código'] === 'nasce com duas peças', `adicionar peça: a primeira entra como parte de cima, e a busca limpa`)
  await pg.fill('[data-cartao="adicionar-peca"] input', 'calçao'); await pausa(pg)
  await pg.locator('[data-cartao="adicionar-peca"] .pd-lin').first().click(); await pausa(pg)
  conta((await resumo(pg))['Código'] === 'KIT-020-000M-090-000M' && (await textos(pg, '[data-impede]')).some((t) => t.includes('Já existe um kit com estas peças, nesta ordem: KIT RAGLAN S/ PUNHO E CALÇAO S/ BOLSO.')), `kit novo com as peças de um que já existe: o código se forma, e a página avisa na hora`)
  await pg.getByRole('button', { name: 'Tirar RAGLAN MASC SEM PUNHO do kit' }).click(); await pausa(pg)
  conta(await pg.locator('.pd-peca').count() === 1 && (await textos(pg, '.pd-peca .pd-peca-nome b'))[0] === 'CALÇAO MASC SEM BOLSO' && !(await textos(pg, '[data-impede]')).some((t) => t.includes('Já existe')), `kit novo: o X tira a peça, e o aviso de repetido sai`)
  await pg.getByRole('button', { name: 'Tirar CALÇAO MASC SEM BOLSO do kit' }).click(); await pausa(pg)
  await pg.fill('[data-cartao="adicionar-peca"] input', '010-000m'); await pausa(pg)
  await pg.locator('[data-cartao="adicionar-peca"] .pd-lin').first().click(); await pausa(pg)
  await pg.fill('[data-cartao="adicionar-peca"] input', 'calça moletom'); await pausa(pg)
  await pg.locator('[data-cartao="adicionar-peca"] .pd-lin').first().click(); await pausa(pg, 500)
  const r = await resumo(pg)
  conta(r['Código'] === 'KIT-010-000M-070-000M' && r['Peças'] === '2' && r['Grade'] === 'grade adulta, PP a GG', `kit novo: o código é o das peças na ordem em que entraram, e a grade é a que as duas têm em comum (a calça vai só até o GG)`)
  await pg.fill('[data-cartao="adicionar-peca"] input', 'camiseta masc trad'); await pausa(pg)
  conta(mesma(await textos(pg, '[data-cartao="adicionar-peca"] .pd-lin .pd-txt b'), ['CAMISETA MASC TRAD GOLA V']), `adicionar peça: quem já está no kit não aparece de novo na busca`)
  await pg.fill('[data-cartao="adicionar-peca"] input', '')

  /* mais de um tecido na mesma peça: a camiseta tem as partes do molde na ficha */
  await pg.locator('[data-peca="010-000M"] .pd-peca-nome').click(); await pausa(pg, 500)
  conta((await textos(pg, '[data-tecidos-da-peca] .pd-nota'))[0].startsWith('As partes são as do molde da referência'), `tecidos: a camiseta tem as partes do molde, e a página passa a oferecer`)
  await pg.locator('[data-tecidos-da-peca]').getByRole('button', { name: 'Tecido', exact: true }).click(); await pausa(pg)
  await pg.locator('.pd-tecido-lin').nth(0).locator('.sel .cb').nth(0).click(); await pausa(pg, 200)
  conta(mesma((await textos(pg, '.mn-item')).map((o) => o.replace(/\s*✓$/, '')), ['Escolha a parte', 'A peça inteira', 'Frente', 'Costas', 'Mangas']), `tecidos: as partes são as de pano do molde (a ribana, que é fita, não entra)`)
  await pg.locator('.mn-item:visible', { hasText: 'Frente' }).click(); await pausa(pg, 200)
  await escolherNoSeletor(pg, pg.locator('.pd-tecido-lin').nth(0).locator('.sel .cb').nth(1), 'DRYFIT POLIESTER 100%')
  await pg.locator('[data-tecidos-da-peca]').getByRole('button', { name: 'Tecido', exact: true }).click(); await pausa(pg)
  await pg.locator('.pd-tecido-lin').nth(1).locator('.sel .cb').nth(0).click(); await pausa(pg, 200)
  conta(mesma((await textos(pg, '.mn-item')).map((o) => o.replace(/\s*✓$/, '')), ['Escolha a parte', 'A peça inteira', 'Costas', 'Mangas']), `tecidos: a parte que já tem tecido não é oferecida para outro`)
  await pg.locator('.mn-item:visible', { hasText: 'Mangas' }).click(); await pausa(pg, 200)
  await escolherNoSeletor(pg, pg.locator('.pd-tecido-lin').nth(1).locator('.sel .cb').nth(1), 'DRYFIT JAKAR 100%')
  await pg.locator('[data-tecidos-da-peca]').getByRole('button', { name: 'Tecido', exact: true }).click(); await pausa(pg)
  await escolherNoSeletor(pg, pg.locator('.pd-tecido-lin').nth(2).locator('.sel .cb').nth(0), 'Costas')
  await escolherNoSeletor(pg, pg.locator('.pd-tecido-lin').nth(2).locator('.sel .cb').nth(1), 'DRYFIT POLIESTER 100%')
  conta((await textos(pg, '[data-tecidos-da-peca] .pd-campo-topo'))[0] === 'Tecidos da peça 3 tecidos · pode ter quantos precisar' && (await resumo(pg)).Tecidos === '2 diferentes', `mais de um tecido na mesma peça: três partes, dois tecidos diferentes`)
  await pg.getByRole('button', { name: 'Tirar este tecido' }).nth(2).click(); await pausa(pg)
  conta(await pg.locator('.pd-tecido-lin').count() === 2, `tecidos: a lixeira tira a linha`)
  await pg.locator('[data-etiqueta] .chip', { hasText: 'DTF' }).click()
  await pg.fill('[data-cartao="resumo"] input:not([type=file])', '  KIT CAMISETA TRAD E CALÇA MOLETOM  '); await pausa(pg)
  conta(await pg.locator('[data-impede]').count() === 0, `kit novo com nome e duas peças: nada mais impede`)
  await foto(pg, 'kit-novo')

  await pg.getByRole('button', { name: 'Criar o kit' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 700)
  const criado = ultimo(gravados, 'rpc/salvar_kit')?.corpo
  conta(criado?.p_kit === null && criado.p_ficha.nome === 'KIT CAMISETA TRAD E CALÇA MOLETOM' && mesma(criado.p_ficha.pecas.map((p) => [p.referencia_id, p.papel]), [['r000', 'Parte de cima'], ['r070', 'Parte de baixo']]), `criar o kit: sem id, com o nome aparado e as peças na ordem, cada uma com o papel`)
  conta(mesma(criado?.p_ficha.pecas[0].tecidos, [{ parte: 'Frente', tecido_id: 't1' }, { parte: 'Mangas', tecido_id: 't3' }]) && criado.p_ficha.pecas[0].etiqueta === 'dtf', `criar o kit: os dois tecidos da camiseta, cada um na sua parte`)
  conta((await textos(pg, '.pd-ficha-nome h2'))[0] === 'KIT CAMISETA TRAD E CALÇA MOLETOM' && (await textos(pg, '.pd-ficha-nome p'))[0] === 'KIT-010-000M-070-000M · masculino · grade adulta, PP a GG' && (await textos(pg, '.pagina-topo .sub'))[0].startsWith('8 referências · 2 kits') && mesma(await textos(pg, '[data-arvore] .pd-abas button'), ['Referências 8', 'Kits 2']), `criar o kit: a página volta, na aba Kits, com o kit novo aberto e contado`)
  const fab = await fabricacao(pg)
  conta(fab[1][1] === 'DRYFIT POLIESTER 100% frente DRYFIT JAKAR 100% mangas' && fab[2][1] === 'Redonda, ribana 1x1 de 2 cm' && fab[6][2] === 'Overloque de 4 fios, reta no cós' && fab[2][2] === 'não informado', `ficha de fabricação: os dois tecidos da camiseta com a parte de cada um, e a gola e a costura vindas da ficha de cada referência`)

  /* o tecido de um kit: a soma da ficha de cada peça, tecido por tecido, conferida por fora */
  const tk = await tabela(pg, '[data-cartao="tecido-do-kit"] table.pd-grade')
  const quatro = (v) => Math.round(v * 10000) / 10000
  conta(mesma(tk[0], ['Tecido, em m²', 'PP', 'P', 'M', 'G', 'GG']) && tk.length === 3 && tk[1][0] === 'DRYFIT POLIESTER 100% frente da parte de cima' && tk[2][0] === 'DRYFIT JAKAR 100% mangas da parte de cima', `tecido de um kit: uma linha por tecido, dizendo onde ele vai, nos tamanhos que as peças têm em comum`)
  conta(mesma(tk[1].slice(1), F.BRUTA.slice(0, 5).map((a) => br(quatro(a * 0.36), 3))) && mesma(tk[2].slice(1), F.BRUTA.slice(0, 5).map((a) => br(quatro(a * 0.27), 3))), `tecido de um kit: o dryfit é a frente da camiseta e o jakar as mangas, com os números da ficha dela (PP ${tk[1][1]} e ${tk[2][1]})`)
  conta(mesma(await textos(pg, '[data-cartao="aviamentos-do-kit"] .pd-lin'), ['Linha poliéster 120 da parte de cima 0,02 cone por kit', 'Fio texturizado, na cor do tecido da parte de cima 0,03 cone por kit', 'Saco de embalagem 30x40 da parte de cima 1 un por kit']), `aviamentos de um kit: os da ficha de cada peça, dizendo de qual vêm`)
  conta(await sobra(pg) <= 0, `kit: nada rola para o lado`)
  await foto(pg, 'kit-com-dois-tecidos')

  /* a camiseta agora sabe que está num kit */
  await pg.locator('[data-peca="010-000M"]').getByRole('button', { name: 'Abrir' }).click(); await pg.waitForSelector('[data-ficha="referencia"]'); await pausa(pg, 400)
  conta(mesma(await textos(pg, '[data-cartao="onde-entra"] .pd-lin'), ['KIT CAMISETA TRAD E CALÇA MOLETOM parte de cima do kit Abrir']), `onde a peça entra: depois de criado o kit, a camiseta passa a dizer que está nele`)
  await pg.locator('[data-cartao="onde-entra"]').getByRole('button', { name: 'Abrir' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 400)

  /* excluir o kit */
  await editarKit(pg)
  await pg.getByRole('button', { name: 'Excluir o kit' }).click(); await pausa(pg)
  conta(await naModal(pg).locator('h2').innerText() === 'Excluir KIT CAMISETA TRAD E CALÇA MOLETOM?' && (await naModal(pg).locator('.pd-nota').innerText()).includes('As referências que são as peças continuam como estão'), `excluir o kit: pergunta antes, e diz que as peças ficam`)
  await naModal(pg).getByRole('button', { name: 'Excluir', exact: true }).click(); await pg.waitForSelector('[data-arvore]'); await pausa(pg, 600)
  conta(ultimo(gravados, 'referencia DELETE')?.corpo === 'kit1' && mesma(await textos(pg, '[data-arvore] .pd-abas button'), ['Referências 8', 'Kits 1']) && await pg.locator('[data-nada-escolhido]').count() === 1, `excluir o kit: apaga o kit, ele sai da lista, e as oito referências continuam`)
  conta(erros.length === 0, `kit novo: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ---- o banco recusando o kit, o acesso, e a página sem a lista de kits ---- */
await secao(async () => {
  const { ctx, pg, gravados } = await abrir(nav, { largura: 1536, altura: 900, recusa: 1 })
  await ir(pg, '/produtos?kit=FT-KIT-020-000M-090-000M', '[data-ficha="kit"]')
  conta((await textos(pg, '[data-arvore] .pd-abas button.ligado'))[0] === 'Kits 1' && await pg.locator('[data-kit="KIT-020-000M-090-000M"].pd-sel').count() === 1, `pelo endereço: a página abre no kit, com a aba Kits`)
  await editarKit(pg)
  await pg.locator('[data-etiqueta] .chip', { hasText: 'Sem etiqueta' }).click(); await pausa(pg, 150)
  await pg.getByRole('button', { name: 'Salvar o kit' }).click(); await pausa(pg, 600)
  conta(gravados.filter((g) => g.u === 'rpc/salvar_kit').length === 1 && (await textos(pg, '[data-cartao="para-salvar"] [role=alert]'))[0]?.includes('escolha o tecido de "Mangas" no catálogo') && await pg.locator('[data-editor-do-kit]').count() === 1, `o banco recusa o kit: a frase dele aparece no Para salvar e o editor fica aberto`)
  await pg.getByRole('button', { name: 'Salvar o kit' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg, 500)
  conta((await fabricacao(pg))[8][1] === 'Sem etiqueta', `salvar de novo: passa, e a ficha mostra a escolha de ir sem etiqueta`)
  /* trocar o desenho direto da ficha do kit */
  await pg.setInputFiles('[data-ficha="kit"] [data-arquivo-do-molde]', { name: 'kit.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(F.MOLDE) }); await pausa(pg, 600)
  conta(ultimo(gravados, 'rpc/salvar_molde_da_referencia')?.corpo.p_referencia === 'rkit' && (await recado(pg)).includes('Desenho do kit trocado') && await pg.locator('[data-ficha="kit"] .pd-molde').count() === 1, `desenho na ficha do kit: soltar o arquivo grava na hora e mostra`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1536, altura: 900, acesso: 'edita' })
  await ir(pg, '/produtos?kit=FT-KIT-020-000M-090-000M', '[data-ficha="kit"]')
  conta(await pg.getByRole('button', { name: 'Novo kit' }).count() === 0 && mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Editar a ficha', 'Fechar']), `quem edita sem ser chefia: edita a ficha do kit, mas não cria kit`)
  await editarKit(pg)
  conta(mesma(await textos(pg, '.pagina-topo .btn'), ['Voltar', 'Salvar o kit']), `quem edita sem ser chefia: salva o kit, e não vê o Excluir`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg, gravados } = await abrir(nav, { largura: 1536, altura: 900, acesso: 'le' })
  await ir(pg, '/produtos?kit=FT-KIT-020-000M-090-000M', '[data-ficha="kit"]')
  conta(mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Fechar']) && await pg.locator('[data-ficha="kit"] [data-arquivo-do-molde]').count() === 0 && (await textos(pg, '[data-cartao="molde"] .pd-solta'))[0] === 'Este kit ainda não tem desenho.' && gravados.length === 0, `quem só lê: vê a ficha do kit, sem Editar a ficha e sem enviar desenho`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1536, altura: 900, estado: 'sem-kits' })
  await ir(pg, '/produtos', '[data-arvore]')
  conta((await textos(pg, '.pagina-topo .sub'))[0] === '8 referências · 0 kits · 1 com a ficha completa' && (await textos(pg, '.pd-g')).length === 5, `sem a lista de kits: as referências continuam de pé`)
  await pg.locator('[data-arvore] .pd-abas button', { hasText: 'Kits' }).click(); await pausa(pg)
  conta((await textos(pg, '[data-arvore] .vazio h3'))[0] === 'Nenhum kit cadastrado', `sem kits: a aba diz que não tem nenhum, e aponta o Novo kit`)
  conta(erros.length === 0, `sem a lista de kits: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

/* ==========================================================================
   8. O CELULAR E O TABLET
   ========================================================================== */
for (const tema of ['light', 'dark']) await secao(async () => {
  const G = 'celular ' + (tema === 'light' ? 'gelo' : 'grafite')
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema })
  await ir(pg, '/produtos', '[data-arvore]')
  conta(await sobra(pg) <= 0, `${G} lista: nada rola para o lado`)
  conta(mesma(await textos(pg, '.pd-secoes .chip'), ['Referências e kits', 'Movimento', 'Depósito', 'Estatísticas']) && await pg.locator('.pd-abas-da-pagina').count() === 0, `${G}: as abas da página viram chips`)
  const acoes = await caixas(pg, '.pd-acoes .btn')
  conta(acoes.length === 2 && acoes[0].w > 200 && acoes[0].w > acoes[1].w * 2 && mesma(await textos(pg, '.pd-acoes .btn'), ['Nova referência', 'Novo kit']) && await pg.locator('.pagina-topo .btn').count() === 0, `${G}: Nova referência e Novo kit descem do topo, a primeira com a largura que sobra`)
  await abrirGrupo(pg, '010')
  const alvos = await caixas(pg, '.pd-g, .pd-t')
  conta(alvos.every((a) => a.h >= 43.5), `${G}: toda linha da árvore tem pelo menos 44 px de altura (a menor tem ${Math.min(...alvos.map((a) => Math.round(a.h)))})`)
  await foto(pg, `celular-lista-${tema}`)
  await escolherRef(pg, '010-000M')
  conta(await pg.locator('[data-arvore]').count() === 0 && mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Voltar', 'Editar']), `${G} ficha: toma o lugar da lista, com Voltar e Editar`)
  conta(await sobra(pg) <= 0, `${G} ficha: nada rola para o lado`)
  const emPe = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(await pg.locator('[data-modulo] .pd-grade.pd-em-pe').count() === 1 && mesma(emPe[0], ['Tamanho', 'Comprimento', 'Largura', 'Manga']) && emPe.length === 11 && mesma(emPe[1], ['PP', '66,0', '47,0', '19,0']) && mesma(emPe[10], ['G4', '84,0', '74,0', '28,5']), `${G} medidas: a tabela fica em pé, um tamanho por linha e uma coluna por medida`)
  await abaDoModulo(pg, 'Tecido')
  const tecEmPe = await tabela(pg, '[data-modulo] table.pd-grade')
  conta(mesma(tecEmPe[0], ['Tamanho', 'Frente', 'Costas', 'Mangas', 'A peça', 'Metros', 'Gramas', 'Ribana da gola']) && await sobra(pg) <= 0, `${G} tecido: em pé, com os nomes curtos no cabeçalho, e rola dentro da própria caixa`)
  await foto(pg, `celular-referencia-${tema}`)
  await pg.locator('.pd-ficha-topo button', { hasText: 'Voltar' }).click(); await pausa(pg)
  conta(await pg.locator('[data-arvore]').count() === 1 && await pg.locator('[data-ficha]').count() === 0, `${G}: Voltar devolve a lista`)
  await escolherRef(pg, '010-004F')
  await pg.fill('.pd-busca input', 'raglan'); await pausa(pg)
  conta(await pg.locator('[data-arvore]').count() === 1 && mesma(await textos(pg, '.pd-t .pd-nomes b'), ['RAGLAN MASC SEM PUNHO']), `${G}: buscar com a ficha aberta fecha a ficha e mostra o que achou`)
  conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})
await secao(async () => {
  /* O EDITOR NO CELULAR, NUMA ABERTURA SÓ DELE E MEDIDO ANTES DA FOTO: a foto
     da página inteira desliga a emulação de toque do navegador de teste, e
     depois dela o alvo de dedo mede como se fosse mouse. */
  const G = 'celular gelo'
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844 })
  await ir(pg, '/produtos?ref=FT-010-000M', '[data-ficha="referencia"]')
  await editar(pg)
  conta(await sobra(pg) <= 0, `${G} editor: nada rola para o lado na página`)
  const rola = await pg.evaluate(() => { const r = document.querySelector('[data-modulo-ed] .pd-grade-rola'); return r.scrollWidth > r.clientWidth })
  conta(rola, `${G} editor: a tabela de campos rola dentro da própria caixa`)
  const tams = await caixas(pg, '.pd-tam')
  conta(tams.every((t) => t.h >= 43.5) && Math.abs(tams[0].y - tams[4].y) < 1 && tams[5].y > tams[0].y, `${G} editor: os tamanhos vão cinco por fileira, com alvo de dedo (${tams.slice(0, 6).map((t) => Math.round(t.x) + ',' + Math.round(t.y) + ' ' + Math.round(t.w) + 'x' + t.h.toFixed(1)).join(' / ')})`)
  const dedo = await caixas(pg, '[data-ficha="editar"] .pd-pega, [data-ficha="editar"] .pd-tag-nome')
  conta(dedo.length >= 7 && dedo.every((t) => t.h >= 43.5), `${G} editor: a alça da medida e a etiqueta da parte também têm alvo de dedo`)
  await foto(pg, 'celular-editor')
  conta(erros.length === 0, `${G} editor: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})
await secao(async () => {
  const G = 'celular gelo'
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844 })
  await ir(pg, '/produtos?kit=FT-KIT-020-000M-090-000M', '[data-ficha="kit"]')
  conta(await sobra(pg) <= 0 && await pg.locator('[data-arvore]').count() === 0 && mesma(await textos(pg, '.pd-ficha-topo .btn'), ['Voltar', 'Editar a ficha']), `${G} kit: a ficha toma a tela, com Voltar e Editar a ficha, e nada rola para o lado`)
  const rolaFab = await pg.evaluate(() => { const r = document.querySelector('[data-cartao="fabricacao"] .pd-grade-rola'); return r.scrollWidth > r.clientWidth })
  conta(rolaFab, `${G} kit: a ficha de fabricação, com uma coluna por peça, rola dentro da própria caixa`)
  await editarKit(pg)
  const pilha = await caixas(pg, '.pd-editor-kit > *')
  conta(await sobra(pg) <= 0 && pilha.length === 3 && pilha[1].y > pilha[0].y && pilha[2].y > pilha[1].y, `${G} editor do kit: as três colunas empilham, e nada rola para o lado`)
  const dedo = await caixas(pg, '.pd-peca-nome')
  conta(dedo.length === 2 && dedo.every((d) => d.h >= 43.5), `${G} editor do kit: cada peça da lista é alvo de dedo`)
  await foto(pg, 'celular-editor-do-kit')
  await pg.getByRole('button', { name: 'Voltar' }).click(); await pg.waitForSelector('[data-ficha="kit"]'); await pausa(pg)
  await pg.locator('.pd-ficha-topo button', { hasText: 'Voltar' }).click(); await pausa(pg)
  conta(await pg.locator('[data-arvore] .pd-kits .pd-t').count() === 1 && await pg.locator('[data-ficha]').count() === 0, `${G} kit: Voltar devolve a lista, na aba Kits`)
  conta(erros.length === 0, `${G} kit: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})
await secao(async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 820, altura: 1180 })
  await ir(pg, '/produtos?ref=FT-070-000M', '[data-ficha="referencia"]')
  conta(await sobra(pg) <= 0, `tablet: nada rola para o lado`)
  const arv = (await caixas(pg, '[data-arvore]'))[0]; const lado = (await caixas(pg, '.pd-largo'))[0]
  conta(arv && lado && Math.abs(arv.y - lado.y) < 1 && lado.w > arv.w, `tablet: a árvore de um lado e a ficha do outro, a ficha mais larga`)
  conta(await pg.locator('[data-modulo] .pd-grade.pd-em-pe').count() === 1 && mesma((await tabela(pg, '[data-modulo] table.pd-grade'))[0], ['Tamanho', 'Cintura', 'Quadril', 'Gancho', 'Entrepernas', 'Boca da perna']), `tablet: na coluna estreita a tabela também fica em pé, pela largura da caixa e não da janela`)
  const pilha = await caixas(pg, '[data-ficha] .pd-dois > section')
  conta(pilha[1].y > pilha[0].y, `tablet: o molde e os detalhes empilham`)
  await foto(pg, 'tablet-referencia')
  conta(erros.length === 0, `tablet: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
})

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length} conferências em ${SITE}: ${achados.length - ruins.length} certas, ${ruins.length} ruins`)
if (ruins.length) { console.log('\nO QUE NÃO BATEU'); ruins.forEach((a) => console.log('  ' + a.texto)); process.exit(1) }
