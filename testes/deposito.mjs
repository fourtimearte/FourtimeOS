/* ==========================================================================
   O DEPÓSITO DO ESTOQUE CONTRA O WIREFRAME DE 04/10/2026 (pranchas 42 a 50).

   O Henrique aprovou com a ordem "tenha certeza que está tudo certo com o
   visual e as animações". Este teste é essa conferência, na aba Depósito.

   O QUE ELE CONFERE
     1. o mapa: os lugares do desenho, quem tem material, quem está para
        comprar, o lugar aberto, a busca com os marcadores, os números e a
        lista de quem está sem lugar, nos dois temas
     2. marcar onde está: o clique no desenho, a prateleira vista de frente,
        o código escrito, mais de um lugar, e o que vai para o banco
     3. o editor: pôr prateleira, palete, grade e escada, arrastar, puxar a
        alça, mexer pelo teclado, escrever a medida, salvar, descartar e o
        aviso de quem perde o lugar
     4. quem só lê, o depósito que ainda não existe e o erro de leitura
     5. que nada rola para o lado em 1440, 820 e 390
     6. AS ANIMAÇÕES: quais são, quanto duram, o que mexem, o meio do caminho
        de cada uma, e que o "reduzir movimento" do sistema desliga todas
     7. que não houve erro de JavaScript

   O banco é de mentira (testes/deposito-dados.mjs).

   Uso:  node testes/deposito.mjs                 confere o site publicado
         node testes/deposito.mjs http://localhost:4173
   As fotos ficam em testes/atual/deposito/, fora do repositório.
   ========================================================================== */

import { mkdirSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
import { abrir, ir as irPara, chromium, sobra } from './deposito-base.mjs'

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/deposito'
mkdirSync(PASTA, { recursive: true })
const ir = (pg, rota, espera) => irPara(pg, SITE, rota, espera)
const pausa = (pg, ms = 350) => pg.waitForTimeout(ms)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
/* um caso que quebra no meio vira um RUIM com o motivo, e os outros casos rodam */
async function caso(nome, fn) {
  try { await fn() } catch (e) { conta(false, `${nome}: o caso parou no meio (${String(e).split('\n')[0].slice(0, 200)})`) }
}
const id = (nome) => D.materiais.find((m) => m.nome === nome).id
const perto = (a, b, folga = 0.011) => Math.abs(a - b) <= folga

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* a cor de um token, do jeito que o navegador a escreve */
const tokens = (pg, nomes) => pg.evaluate((nomes) => {
  const o = {}
  for (const n of nomes) { const e = document.createElement('i'); e.style.backgroundColor = `var(${n})`; document.body.append(e); o[n] = getComputedStyle(e).backgroundColor; e.remove() }
  return o
}, nomes)
/* quantos pixels vale um metro no desenho que está na tela */
const escalaDoDesenho = (pg, raiz = '') => pg.evaluate((raiz) => {
  const chao = document.querySelector(raiz + ' .dp-chao')
  return chao.getBoundingClientRect().width / 15
}, raiz)
const centro = async (pg, seletor) => {
  const c = await pg.locator(seletor).first().boundingBox()
  return { x: c.x + c.width / 2, y: c.y + c.height / 2, ...{ w: c.width, h: c.height, esq: c.x, topo: c.y } }
}

/* ==========================================================================
   1. O MAPA, NOS DOIS TEMAS, EM 1440
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema })
  const foto = (n, inteira = true) => pg.screenshot({ path: `${PASTA}/${n}-1440-${tema}.png`, fullPage: inteira })

  await caso(`${T} mapa`, async () => {
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    await foto('mapa')
    const K = await tokens(pg, ['--ink', '--brand', '--surface', '--ink-soft', '--nivel-1', '--nivel-2', '--nivel-3', '--nivel-4', '--on-nivel'])
    const lugares = await pg.locator('[data-mapa] [data-lugar]').evaluateAll((l) => l.map((e) => ({ nome: e.dataset.lugar, classe: e.getAttribute('class') })))
    conta(lugares.length === 29, `${T}: o desenho tem os 29 lugares, 8 vãos e 21 paletes (${lugares.length})`)
    const com = lugares.filter((l) => /\btem\b/.test(l.classe)).map((l) => l.nome).sort().join(' ')
    conta(com === 'A1 A2 A3 A4 D1 D2 D3 P01 P11 P21', `${T}: os lugares com material ficam cinza, e só eles (${com})`)
    const bolinhas = await pg.locator('[data-mapa] .dp-comprar').count()
    conta(bolinhas === 4, `${T}: quatro lugares guardam item para comprar e ganham a bolinha vermelha (${bolinhas})`)
    conta(await pg.locator('[data-mapa] [data-movel="Escada · entrada"] .dp-degrau').count() > 5, `${T}: a escada está desenhada, com os degraus`)
    const nomeDaEscada = await pg.locator('[data-movel="Escada · entrada"] text').boundingBox()
    const d4 = await pg.locator('[data-mapa] [data-lugar="D4"]').boundingBox()
    const bate = nomeDaEscada.x < d4.x + d4.width && nomeDaEscada.x + nomeDaEscada.width > d4.x && nomeDaEscada.y < d4.y + d4.height && nomeDaEscada.y + nomeDaEscada.height > d4.y
    conta(!bate, `${T}: o nome da escada não cai em cima da prateleira D`)
    const numeros = await pg.locator('.dp-numeros .kpi').allInnerTexts()
    conta(numeros.length === 3 && /29/.test(numeros[0]) && /22 de 26/.test(numeros[1]) && /19 de 29/.test(numeros[2]), `${T}: os três números: 29 lugares, 22 de 26 com lugar, 19 de 29 vazios (${numeros.map((n) => n.replace(/\s+/g, ' ')).join(' | ')})`)
    const cabem = await pg.locator('.dp-numeros .kpi').evaluateAll((l) => l.every((k) => k.scrollWidth <= k.clientWidth + 1))
    conta(cabem, `${T}: nenhum número estoura o cartão`)
    const sem = await pg.locator('.dp-linha .dp-marcar').count()
    conta(sem === 4, `${T}: a lista "Sem lugar marcado" tem os 4 materiais, cada um com o botão de marcar (${sem})`)

    /* --- abrir um lugar ---------------------------------------------------- */
    await pg.locator('[data-mapa] [data-lugar="D2"]').click(); await pausa(pg)
    const painel = pg.locator('.dp-painel[data-aberto="D2"]')
    conta(await painel.count() === 1 && /Prateleira D · vão 2/.test(await painel.innerText()) && /5 materiais/.test(await painel.innerText()), `${T}: o clique no vão D2 abre o lugar ao lado, com os 5 materiais`)
    const preto = await pg.locator('[data-mapa] [data-lugar="D2"] .dp-caixa').evaluate((e) => getComputedStyle(e).fill)
    conta(preto === K['--ink'], `${T}: o lugar aberto fica na tinta do sistema, token --ink (${preto})`)
    const secoes = await painel.locator('.dp-secao').allInnerTexts()
    conta(secoes.map((s) => s.match(/Nível (\d)/)?.[1]).join('') === '4321', `${T}: os níveis aparecem de cima para baixo: 4, 3, 2, 1`)
    const frente = await painel.locator('.dp-casa').evaluateAll((l) => l.map((e) => e.className))
    conta(frente.length === 16 && frente.filter((c) => /do-aberto/.test(c)).length === 4, `${T}: a prateleira vista de frente tem 4 vãos por 4 níveis, e o vão aberto em destaque (${frente.length})`)
    const nv = await painel.locator('.dp-secao .dp-nv').evaluateAll((l) => l.map((e) => ({ n: e.textContent.trim(), fundo: getComputedStyle(e).backgroundColor, cor: getComputedStyle(e).color })))
    conta(nv.every((x) => x.fundo === K['--nivel-' + x.n] && x.cor === K['--on-nivel']), `${T}: cada nível tem a sua cor e o número dentro dela (${nv.map((x) => x.n).join(', ')})`)
    conta(await painel.getByRole('button', { name: 'Mover de lugar' }).isDisabled(), `${T}: num vão com vários materiais, "Mover de lugar" espera a pessoa escolher um`)
    await painel.locator('.dp-linha.clica').first().click(); await pausa(pg, 200)
    conta(await painel.getByRole('button', { name: 'Mover de lugar' }).isEnabled() && await painel.locator('.dp-linha.escolhida').count() === 1, `${T}: escolhido o material, a linha fica preta e os botões do pé acendem`)
    await foto('aberto')
    await pg.locator('[data-mapa] [data-lugar="P21"]').click(); await pausa(pg)
    conta(/Palete P21/.test(await pg.locator('.dp-painel').innerText()) && await pg.locator('.dp-painel .dp-casa').count() === 0, `${T}: o palete abre como uma lista só, sem nível`)
    conta(await pg.locator('.dp-painel').getByRole('button', { name: 'Mover de lugar' }).isEnabled(), `${T}: num palete de um material só, "Mover de lugar" já vem pronto`)

    /* --- a busca ----------------------------------------------------------- */
    await pg.fill('.es-busca input', 'dryfit preto'); await pausa(pg, 500)
    const marcas = await pg.locator('[data-mapa] .dp-marcador').allTextContents()
    conta(marcas.join('') === '12', `${T}: a busca "dryfit preto" põe dois marcadores numerados no desenho (${marcas.join(', ')})`)
    const d2 = await pg.locator('[data-mapa] [data-lugar="D2"]').getAttribute('class')
    const p11 = await pg.locator('[data-mapa] [data-lugar="P11"]').getAttribute('class')
    conta(/aberto/.test(d2) && /achado/.test(p11), `${T}: o lugar principal abre sozinho e o outro fica vermelho`)
    const vermelho = await pg.locator('[data-mapa] [data-lugar="P11"] .dp-caixa').evaluate((e) => getComputedStyle(e).fill)
    conta(vermelho === K['--brand'], `${T}: o lugar achado é vermelho, token --brand (${vermelho})`)
    const achada = await pg.locator('.dp-painel .dp-linha.achada').innerText()
    conta(/Preto/.test(achada) && /é o que você procurou/.test(achada), `${T}: no lugar aberto, a linha do que foi procurado vem marcada`)
    conta(await pg.locator('.dp-painel').getByRole('button', { name: 'Mover de lugar' }).isEnabled(), `${T}: com a busca, "Mover de lugar" já vem pronto para o que foi procurado`)
    const tambem = await pg.locator('.dp-tela').innerText()
    conta(/Também está em/.test(tambem) && /Palete P11/.test(tambem), `${T}: "Também está em" mostra o segundo lugar, o palete P11`)
    await foto('busca')
    await pg.locator('.dp-linha.clica.achada', { hasText: 'Palete P11' }).click(); await pausa(pg)
    conta(/Palete P11/.test(await pg.locator('.dp-painel .cartao-titulo').innerText()), `${T}: o clique em "Também está em" abre o outro lugar`)
    await pg.fill('.es-busca input', 'helanca'); await pausa(pg, 400)
    conta(/HELANCA COLEGIAL · Azul Marinho ainda está sem lugar marcado/.test(await pg.locator('[data-mapa] .dp-pe').innerText()) && await pg.locator('.dp-marcador').count() === 0, `${T}: quem não tem lugar não ganha marcador, e a tela diz que está sem lugar`)
    await pg.fill('.es-busca input', 'xyzxyz'); await pausa(pg, 400)
    conta(/Nenhum material com esse nome/.test(await pg.locator('[data-mapa] .dp-pe').innerText()), `${T}: a busca que não acha nada diz isso`)
    await pg.fill('.es-busca input', ''); await pausa(pg, 300)
  })

  /* ------------------------------------------------------ MARCAR ONDE ESTÁ */
  await caso(`${T} marcar`, async () => {
    await pg.locator('.dp-linha', { hasText: 'HELANCA COLEGIAL' }).locator('.dp-marcar').click(); await pausa(pg, 500)
    const caixa = pg.locator('dialog[open]')
    conta(/Onde está HELANCA COLEGIAL · Azul Marinho\?/.test(await caixa.locator('.sobre-topo').innerText()), `${T} marcar: a caixa pergunta "Onde está HELANCA COLEGIAL · Azul Marinho?"`)
    const marcar = caixa.getByRole('button', { name: 'Marcar aqui' })
    conta(await marcar.isDisabled(), `${T} marcar: sem lugar apontado, "Marcar aqui" fica apagado`)
    await foto('marcar', false)
    await caixa.locator('[data-lugar="D3"]').click(); await pausa(pg)
    conta(await caixa.locator('.dp-casa').count() === 16, `${T} marcar: o clique na prateleira mostra ela de frente, para escolher o vão e o nível`)
    conta(await caixa.locator('input[aria-label="Código do lugar"]').inputValue() === 'D3', `${T} marcar: o código acompanha o clique (D3)`)
    await caixa.getByText('A Prateleira D vista de frente').click(); await pausa(pg, 200)
    conta(await caixa.locator('input[aria-label="Código do lugar"]').inputValue() === 'D3', `${T} marcar: o clique no rótulo da prateleira não aperta casa nenhuma (${await caixa.locator('input[aria-label="Código do lugar"]').inputValue()})`)
    await caixa.getByRole('button', { name: 'D3, nível 2, vazio' }).click(); await pausa(pg, 200)
    conta(await caixa.locator('input[aria-label="Código do lugar"]').inputValue() === 'D3-2', `${T} marcar: escolhido o nível, o código vira D3-2`)
    await foto('marcar-nivel', false)
    await caixa.getByRole('button', { name: 'Outro lugar' }).click(); await pausa(pg, 200)
    await caixa.locator('input[aria-label="Código do lugar"]').fill('p07'); await pausa(pg, 300)
    const lista = await caixa.locator('.dp-lugares').innerText()
    conta(/Prateleira D · vão 3/.test(lista) && /Palete P07/.test(lista), `${T} marcar: o segundo lugar entra pelo código escrito, e os dois aparecem na lista`)
    conta(await caixa.locator('.dp-marcador').count() === 2, `${T} marcar: o desenho numera os dois lugares`)
    await marcar.click(); await pausa(pg, 600)
    const g = gravados.find((x) => x.u === 'rpc/definir_lugares')
    const certo = g && JSON.stringify(g.corpo.p_materiais) === JSON.stringify([id('HELANCA COLEGIAL · Azul Marinho')]) &&
      JSON.stringify(g.corpo.p_lugares) === JSON.stringify([{ movel: 'prat-d', vao: 3, nivel: 2 }, { movel: 'pal-07', vao: null, nivel: null }])
    conta(certo, `${T} marcar: o banco recebe o material e os dois lugares, o principal primeiro (${JSON.stringify(g?.corpo.p_lugares)})`)
    conta(await pg.locator('dialog[open]').count() === 0, `${T} marcar: depois de gravar a caixa fecha`)

    /* mover: o lugar de antes vem preenchido, e tirar todos vira "Deixar sem lugar" */
    await pg.locator('[data-mapa] [data-lugar="P21"]').click(); await pausa(pg)
    await pg.locator('.dp-painel').getByRole('button', { name: 'Mover de lugar' }).click(); await pausa(pg, 500)
    conta(/Palete P21/.test(await caixa.locator('.dp-lugares').innerText()) && await caixa.getByRole('button', { name: 'Marcar aqui' }).isDisabled(), `${T} marcar: ao mover, o lugar de hoje vem preenchido e nada muda sem mexer`)
    await caixa.getByRole('button', { name: 'Tirar este lugar', exact: true }).click(); await pausa(pg, 200)
    conta(await caixa.getByRole('button', { name: 'Deixar sem lugar' }).isEnabled(), `${T} marcar: tirado o único lugar, o botão vira "Deixar sem lugar"`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
  })

  /* ---------------------------------------------------------------- EDITOR */
  await caso(`${T} editor`, async () => {
    gravados.length = 0
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
    const salvar = pg.getByRole('button', { name: 'Salvar o depósito' })
    conta(await salvar.isDisabled(), `${T} editor: sem mudança nenhuma, "Salvar o depósito" fica apagado`)
    conta(await pg.locator('[data-mapa] .dp-lugar.tem').count() === 10, `${T} editor: o desenho do editor continua dizendo onde há material`)
    await foto('editor')
    const S = await escalaDoDesenho(pg, '[data-mapa]')

    /* escolher e ver o painel */
    await pg.locator('[data-movel="A"]').click(); await pausa(pg)
    conta(await pg.locator('input[aria-label="Nome da prateleira"]').inputValue() === 'A' && await pg.locator('.dp-selecao .dp-alca').count() >= 4, `${T} editor: o clique escolhe a prateleira, com as alças em volta e o painel ao lado`)
    await foto('editor-prateleira')

    /* arrastar: 1 metro para a direita */
    const a = await centro(pg, '[data-movel="A"] .dp-moldura')
    await pg.mouse.move(a.x, a.y); await pg.mouse.down()
    for (let k = 1; k <= 8; k++) await pg.mouse.move(a.x + (S * k) / 8, a.y)
    await pg.mouse.up(); await pausa(pg, 200)
    const depois = await centro(pg, '[data-movel="A"] .dp-moldura')
    conta(Math.abs(depois.x - a.x - S) < 2 && Math.abs(depois.y - a.y) < 1, `${T} editor: arrastar leva a prateleira junto, 1 m para a direita (${Math.round(depois.x - a.x)} px de ${Math.round(S)})`)
    conta(await salvar.isEnabled(), `${T} editor: com o desenho mudado, o Salvar acende`)

    /* o teclado: seta anda 10 cm, com Shift anda 1 m */
    await pg.locator('[data-movel="A"]').focus()
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Shift+ArrowDown'); await pausa(pg, 200)

    /* a medida escrita e os vãos */
    await pg.locator('input[aria-label="Vãos"]').fill('5'); await pg.locator('input[aria-label="Vãos"]').blur(); await pausa(pg, 200)
    conta(await pg.locator('[data-movel="A"] [data-lugar]').count() === 5, `${T} editor: 5 no campo Vãos desenha cinco vãos na prateleira`)
    await pg.locator('input[aria-label="Nome do vão 5"]').fill('Zíper'); await pausa(pg, 200)
    conta(await pg.locator('[data-movel="A"] [data-lugar="Zíper"]').count() === 1, `${T} editor: o vão aceita o nome que a pessoa quiser`)

    /* puxar a alça da direita: a prateleira cresce */
    const alcas = await pg.locator('.dp-selecao .dp-alca').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }))
    const direita = alcas.reduce((m, p) => (p.x > m.x + 1 || (Math.abs(p.x - m.x) <= 1 && Math.abs(p.y - (alcas.reduce((s, q) => s + q.y, 0) / alcas.length)) < Math.abs(m.y - (alcas.reduce((s, q) => s + q.y, 0) / alcas.length))) ? p : m))
    const antes = (await pg.locator('[data-movel="A"] .dp-moldura').boundingBox()).width
    await pg.mouse.move(direita.x, direita.y); await pg.mouse.down()
    for (let k = 1; k <= 6; k++) await pg.mouse.move(direita.x + (S * k) / 6, direita.y)
    await pg.mouse.up(); await pausa(pg, 200)
    const cresceu = (await pg.locator('[data-movel="A"] .dp-moldura').boundingBox()).width - antes
    conta(Math.abs(cresceu - S) < 2, `${T} editor: puxar a alça da direita 1 m deixa a prateleira 1 m mais comprida (${Math.round(cresceu)} px de ${Math.round(S)})`)

    /* as peças novas */
    await pg.getByRole('button', { name: 'Prateleira', exact: true }).click(); await pausa(pg, 300)
    const nova = await pg.locator('input[aria-label="Nome da prateleira"]').inputValue()
    conta(nova === 'B', `${T} editor: a prateleira nova nasce com o próximo nome livre (${nova})`)
    await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 300)
    const palete = await pg.locator('input[aria-label="Nome do palete"]').inputValue()
    conta(palete === 'P22', `${T} editor: o palete novo continua a numeração (${palete})`)
    await pg.keyboard.press('Delete'); await pausa(pg, 300)
    conta(await pg.locator('[data-movel="P22"]').count() === 0, `${T} editor: Delete apaga a peça escolhida`)
    await foto('editor-novas')

    /* a grade */
    await pg.locator('[data-movel="P08"]').click(); await pausa(pg, 300)
    const painel = await pg.locator('.dp-tela').innerText()
    conta(/Grade de paletes/.test(painel) && /21 paletes/.test(painel) && await pg.locator('.dp-selecao .dp-contorno.tracejado').count() === 1, `${T} editor: o clique num palete da grade mostra a grade inteira, com os 21 paletes`)
    await foto('editor-grade')

    /* salvar: o desenho vai inteiro para o banco */
    await salvar.click(); await pausa(pg, 800)
    const g = gravados.find((x) => x.u === 'rpc/salvar_deposito')
    const pl = g?.corpo.p_planta
    const pa = pl?.moveis.find((m) => m.id === 'prat-a')
    conta(g && g.corpo.p_soltar === false && pl.largura === 15 && pl.fundo === 10 && pl.nome === 'Depósito de tecidos', `${T} editor: o Salvar manda o chão inteiro, sem soltar ninguém (${pl?.largura} x ${pl?.fundo})`)
    conta(pa && perto(pa.x, 2.1) && perto(pa.y, 1.25) && perto(pa.largura, 7) && pa.vaos === 5 && pa.nomes_dos_vaos[4] === 'Zíper', `${T} editor: a prateleira A vai com o arrasto, as setas, a alça, os 5 vãos e o nome escrito (x ${pa?.x}, y ${pa?.y}, ${pa?.largura} m, ${pa?.vaos} vãos)`)
    conta(pl?.moveis.length === 25 && pl.moveis.some((m) => m.nome === 'B' && m.tipo === 'prateleira'), `${T} editor: a prateleira B nova vai junto, e o palete apagado não vai (${pl?.moveis.length} peças)`)
    conta(await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 1, `${T} editor: depois de salvar a tela volta para o mapa`)
  })

  await caso(`${T} editor: perder o lugar e descartar`, async () => {
    gravados.length = 0
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
    await pg.locator('[data-movel="D"]').click({ position: { x: 10, y: 30 } }); await pausa(pg, 300)
    await pg.locator('input[aria-label="Vãos"]').fill('1'); await pg.locator('input[aria-label="Vãos"]').blur(); await pausa(pg, 200)
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 500)
    const aviso = pg.locator('dialog[open]')
    conta(/6 materiais perdem o lugar marcado/.test(await aviso.locator('.sobre-topo').innerText()), `${T} editor: tirar três vãos de uma prateleira com material pergunta antes, e conta os 6 materiais`)
    conta(!gravados.some((x) => x.u === 'rpc/salvar_deposito'), `${T} editor: antes da resposta, nada vai para o banco`)
    await pg.screenshot({ path: `${PASTA}/editor-perde-1440-${tema}.png` })
    await aviso.getByRole('button', { name: 'Salvar mesmo assim' }).click(); await pausa(pg, 800)
    const g = gravados.find((x) => x.u === 'rpc/salvar_deposito')
    conta(g?.corpo.p_soltar === true, `${T} editor: confirmado, o banco recebe a ordem de soltar (p_soltar ${g?.corpo.p_soltar})`)

    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
    await pg.getByRole('button', { name: 'Descartar' }).click(); await pausa(pg, 400)
    conta(await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 1, `${T} editor: Descartar sem ter mexido sai direto`)
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
    await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 300)
    await pg.getByRole('button', { name: 'Descartar' }).click(); await pausa(pg, 400)
    conta(/Descartar as mudanças\?/.test(await pg.locator('dialog[open] .sobre-topo').innerText()), `${T} editor: Descartar depois de mexer pergunta antes`)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Continuar editando' }).click(); await pausa(pg, 300)
    conta(await pg.locator('[data-movel="P22"]').count() === 1, `${T} editor: "Continuar editando" mantém o desenho como estava`)
    await pg.getByRole('button', { name: 'Descartar' }).click(); await pausa(pg, 300)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Descartar' }).click(); await pausa(pg, 400)
    conta(await pg.locator('[data-mapa] [data-movel="P22"]').count() === 0 && await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 1, `${T} editor: confirmado o descarte, o mapa volta sem a peça nova`)
  })

  conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado em 1440`)
  conta(erros.length === 0, `${T}: nenhum erro de JavaScript em 1440 (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
}

/* ==========================================================================
   2. O BANCO RECUSA, QUEM SÓ LÊ, O DEPÓSITO QUE NÃO EXISTE E O ERRO
   ========================================================================== */
await caso('recusa do banco', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', recusa: 1 })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
  await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 300)
  await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 800)
  const tela = await pg.locator('.vista').innerText()
  conta(/deixam de existir/.test(tela) && await pg.getByRole('button', { name: 'Salvar o depósito' }).count() === 1, 'recusa: se o banco recusa o desenho, a tela mostra o motivo e continua no editor')
  conta(gravados.filter((x) => x.u === 'rpc/salvar_deposito').length === 1, 'recusa: a tela não tenta de novo sozinha')
  conta(erros.length === 0, `recusa: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

await caso('quem só lê', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', papel: 'vendedor' })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  conta(await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 0, 'quem só lê: não vê o botão de editar o depósito')
  conta(await pg.locator('.dp-marcar').count() === 0, 'quem só lê: não vê o botão de marcar o lugar')
  await pg.locator('[data-mapa] [data-lugar="P21"]').click(); await pausa(pg)
  conta(/Palete P21/.test(await pg.locator('.dp-painel').innerText()) && await pg.locator('.dp-painel .btn').count() === 0, 'quem só lê: abre o lugar e vê o que tem, sem os botões de mover')
  await pg.fill('.es-busca input', 'piquet'); await pausa(pg, 500)
  conta(await pg.locator('.dp-marcador').count() === 3, `quem só lê: a busca acha do mesmo jeito: os dois piquets e a gola de piquet (${await pg.locator('.dp-marcador').count()} marcadores)`)
  await pg.screenshot({ path: `${PASTA}/so-le-1440-light.png`, fullPage: true })
  conta(erros.length === 0, `quem só lê: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

for (const tema of ['light', 'dark']) {
  await caso('depósito que ainda não existe', async () => {
    const T = tema === 'light' ? 'gelo' : 'grafite'
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema, deposito: 'vazio' })
    await ir(pg, '/estoque?aba=deposito', '.dp-quadro')
    conta(/O depósito ainda não foi desenhado/.test(await pg.locator('.dp-quadro').innerText()), `${T} sem depósito: a tela convida a desenhar`)
    await pg.screenshot({ path: `${PASTA}/sem-deposito-1440-${tema}.png`, fullPage: true })
    await pg.locator('.dp-quadro').getByRole('button', { name: 'Desenhar o depósito' }).click(); await pausa(pg, 600)
    const tela = await pg.locator('.vista').innerText()
    conta(/O chão está vazio/.test(tela) && /Como montar/.test(tela), `${T} sem depósito: o editor abre no chão vazio, com o passo a passo`)
    const passos = await pg.locator('.dp-passo-linha .dp-passo').evaluateAll((l) => l.map((e) => e.className.replace('dp-passo ', '')))
    conta(passos.join(' ') === 'feito falta falta falta', `${T} sem depósito: no "Como montar", o chão já vem feito e os outros três passos esperam em cinza (${passos.join(' ')})`)
    await pg.screenshot({ path: `${PASTA}/editor-zero-1440-${tema}.png`, fullPage: true })
    await pg.locator('input[aria-label="Largura"]').fill('12,5'); await pg.locator('input[aria-label="Largura"]').blur(); await pausa(pg, 200)
    await pg.getByRole('button', { name: 'Grade de paletes' }).click(); await pausa(pg, 400)
    const quantos = await pg.locator('[data-mapa] [data-lugar]').count()
    conta(quantos > 1 && /Grade de paletes/.test(await pg.locator('.dp-tela').innerText()), `${T} sem depósito: a grade põe vários paletes de uma vez (${quantos})`)
    await pg.locator('.dp-topo.ferramentas').getByRole('button', { name: /Escada ou porta/ }).click(); await pausa(pg, 300)
    await pg.locator('.mn-item', { hasText: 'Escada' }).click(); await pausa(pg, 300)
    conta(await pg.locator('[data-mapa] .dp-escada').count() === 1, `${T} sem depósito: a escada entra pelo menu "Escada ou porta"`)
    await pg.screenshot({ path: `${PASTA}/editor-zero-montado-1440-${tema}.png`, fullPage: true })
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 800)
    const g = gravados.find((x) => x.u === 'rpc/salvar_deposito')
    conta(g && perto(g.corpo.p_planta.largura, 12.5) && g.corpo.p_planta.moveis.length === quantos + 1, `${T} sem depósito: o primeiro Salvar manda o chão de 12,5 m com as peças (${g?.corpo.p_planta.largura} m, ${g?.corpo.p_planta.moveis.length} peças)`)
    conta(erros.length === 0, `${T} sem depósito: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

await caso('erro de leitura', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', deposito: 'erro' })
  await ir(pg, '/estoque?aba=deposito', '.vazio')
  const tela = await pg.locator('.vista').innerText()
  conta(/Não consegui ler o depósito/.test(tela) && await pg.getByRole('button', { name: 'Tentar de novo' }).count() === 1, 'erro: se o depósito não lê, a aba diz isso e oferece tentar de novo')
  conta(await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 0, 'erro: sem o desenho lido, não há o que editar')
  await pg.screenshot({ path: `${PASTA}/erro-1440-light.png`, fullPage: true })
  await pg.getByRole('tab', { name: 'Materiais' }).click(); await pausa(pg, 500)
  conta(await pg.locator('[data-arvore]').count() === 1, 'erro: a lista de materiais continua de pé')
  conta(erros.length === 0, `erro: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* ==========================================================================
   3. O TABLET E O CELULAR
   ========================================================================== */
for (const [largura, altura] of [[820, 1180], [390, 844]]) {
  for (const tema of ['light', 'dark']) {
    await caso(`${largura} ${tema}`, async () => {
      const T = `${largura} ${tema === 'light' ? 'gelo' : 'grafite'}`
      const { ctx, pg, erros, gravados } = await abrir(nav, { largura, altura, tema })
      const foto = (n, inteira = true) => pg.screenshot({ path: `${PASTA}/${n}-${largura}-${tema}.png`, fullPage: inteira })
      await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
      await foto('mapa')
      conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
      const desenho = await pg.locator('[data-mapa] svg.dp-planta').boundingBox()
      const cartao = await pg.locator('[data-mapa]').boundingBox()
      conta(desenho.x >= cartao.x && desenho.x + desenho.width <= cartao.x + cartao.width + 0.5, `${T}: o desenho cabe inteiro no cartão (${Math.round(desenho.width)} de ${Math.round(cartao.width)})`)
      if (largura >= 768) {
        const aba = await pg.evaluate(() => { const s = document.querySelector('.es-aba'), i = s.querySelector('.ind'), b = s.querySelector('button.ligado'); const a = i.getBoundingClientRect(), c = b.getBoundingClientRect(), d = s.getBoundingClientRect(); return { fora: a.right - d.right, desvio: Math.abs(a.left - c.left) + Math.abs(a.width - c.width) } })
        conta(aba.fora <= 0.5 && aba.desvio < 1, `${T}: o indicador das abas fica em cima da aba Depósito, dentro da caixa (${aba.fora.toFixed(1)}, ${aba.desvio.toFixed(1)})`)
      } else {
        const chip = await pg.locator('.em-secoes .chip.ligado').innerText()
        conta(chip.trim() === 'Depósito', `${T}: no celular as abas são chips, e o ligado é o Depósito (${chip.trim()})`)
      }
      const alvos = await pg.locator('[data-mapa] [data-lugar] .dp-alvo').evaluateAll((l) => Math.min(...l.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))))
      conta(alvos >= 43.5, `${T}: cada lugar do desenho tem alvo de toque de 44 px (${alvos.toFixed(1)})`)

      await pg.fill('.es-busca input', 'dryfit preto'); await pausa(pg, 500)
      const painel = await pg.locator('.dp-painel').boundingBox()
      const mapa = await pg.locator('[data-mapa]').boundingBox()
      conta(await pg.locator('.dp-marcador').count() === 2 && painel.y >= mapa.y + mapa.height, `${T}: a busca marca os dois lugares e o lugar aberto desce para baixo do desenho`)
      await foto('busca')
      conta((await sobra(pg)) <= 0, `${T}: com o lugar aberto, nada rola para o lado`)
      await pg.fill('.es-busca input', ''); await pausa(pg, 300)

      /* marcar pelo celular e pelo tablet */
      const botao = pg.locator('.dp-linha', { hasText: 'HELANCA COLEGIAL' }).locator('.dp-marcar')
      const caixaDoBotao = await botao.boundingBox()
      conta(caixaDoBotao && caixaDoBotao.height >= 34, `${T}: o botão de marcar o lugar está na lista (${Math.round(caixaDoBotao?.width ?? 0)} por ${Math.round(caixaDoBotao?.height ?? 0)})`)
      await botao.click(); await pausa(pg, 600)
      const caixa = pg.locator('dialog[open]')
      await caixa.locator('[data-lugar="P07"]').click({ force: true }); await pausa(pg, 300)
      await foto('marcar', false)
      const larguraDaCaixa = await caixa.evaluate((e) => e.scrollWidth - e.clientWidth)
      conta(larguraDaCaixa <= 0, `${T}: a caixa de marcar não rola para o lado`)
      await caixa.getByRole('button', { name: 'Marcar aqui' }).click(); await pausa(pg, 600)
      const g = gravados.find((x) => x.u === 'rpc/definir_lugares')
      conta(JSON.stringify(g?.corpo.p_lugares) === JSON.stringify([{ movel: 'pal-07', vao: null, nivel: null }]), `${T}: o toque no palete marca o lugar (${JSON.stringify(g?.corpo.p_lugares)})`)

      if (largura >= 768) {
        await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
        await pg.locator('[data-movel="D"]').click({ position: { x: 10, y: 30 } }); await pausa(pg, 300)
        await foto('editor')
        conta((await sobra(pg)) <= 0 && await pg.locator('input[aria-label="Nome da prateleira"]').count() === 1, `${T}: o editor abre no tablet, com o painel embaixo do desenho, sem rolar para o lado`)
      } else {
        conta(await pg.getByRole('button', { name: 'Editar o depósito' }).count() === 0, `${T}: o editor do depósito não abre no celular`)
      }
      conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
      await ctx.close()
    })
  }
}

/* ==========================================================================
   4. AS ANIMAÇÕES

   O contexto das outras partes pede "reduzir movimento", para as fotos não
   pegarem o meio de uma transição. Aqui o movimento está ligado, e cada
   animação é lida pelo relógio dela: o nome, a duração, o que ela mexe, como
   está na metade e como termina. Depois o mesmo contexto com o movimento
   reduzido tem que zerar todas.
   ========================================================================== */
const lerAnimacao = (pg, seletor) => pg.evaluate((seletor) => {
  const e = document.querySelector(seletor)
  if (!e) return null
  const a = e.getAnimations().find((x) => x.animationName)
  if (!a) return { nome: '' }
  const t = a.effect.getComputedTiming()
  const quadros = a.effect.getKeyframes()
  const mexe = [...new Set(quadros.flatMap((q) => Object.keys(q)))].filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)).sort()
  const caixa = (el) => { const r = el.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width } }
  a.pause()
  a.currentTime = t.duration / 2
  const meio = { opacidade: Number(getComputedStyle(e).opacity), ...caixa(e) }
  a.finish()
  const fim = { opacidade: Number(getComputedStyle(e).opacity), ...caixa(e) }
  return { nome: a.animationName, duracao: t.duration, vezes: t.iterations, mexe, meio, fim }
}, seletor)
const lerTransicoes = (pg, seletores) => pg.evaluate((seletores) => seletores.map((s) => {
  const e = document.querySelector(s)
  if (!e) return { s, falta: true }
  const c = getComputedStyle(e)
  return { s, o_que: c.transitionProperty, quanto: c.transitionDuration }
}), seletores)
const SO_PODE = ['opacity', 'transform']

for (const movimento of [true, false]) {
  await caso(movimento ? 'animações' : 'movimento reduzido', async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', movimento })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    /* o painel do lugar */
    await pg.locator('[data-mapa] [data-lugar="D2"]').click()
    const painel = await lerAnimacao(pg, '.dp-painel')
    /* os marcadores da busca */
    await pg.fill('.es-busca input', 'dryfit preto'); await pg.waitForSelector('.dp-marcador')
    const marcador = await lerAnimacao(pg, '.dp-marcador')
    const linhas = await lerTransicoes(pg, ['.dp-linha.clica'])
    await pg.fill('.es-busca input', '')
    /* a casa da frente, na caixa de marcar */
    await pg.locator('.dp-linha', { hasText: 'HELANCA COLEGIAL' }).locator('.dp-marcar').click(); await pausa(pg, 500)
    await pg.locator('dialog[open] [data-lugar="D3"]').click(); await pausa(pg, 200)
    const casa = await lerTransicoes(pg, ['dialog[open] button.dp-casa', 'dialog[open] .dp-miudo'])
    await pg.keyboard.press('Escape'); await pausa(pg, 400)
    /* a seleção do editor */
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 500)
    await pg.locator('[data-movel="A"]').click()
    const selecao = await lerAnimacao(pg, '.dp-selecao')

    if (movimento) {
      conta(painel?.nome === 'dp-surge' && painel.duracao === 200 && painel.vezes === 1, `animação: o painel do lugar entra com dp-surge em 200 ms, uma vez (${painel?.nome}, ${painel?.duracao} ms)`)
      conta(painel.mexe.every((k) => SO_PODE.includes(k)), `animação: o painel só mexe em opacidade e posição (${painel.mexe.join(', ')})`)
      conta(painel.meio.opacidade > 0.2 && painel.meio.opacidade < 1 && painel.meio.cy > painel.fim.cy && painel.meio.cy - painel.fim.cy < 6 && painel.fim.opacidade === 1, `animação: na metade o painel está meio transparente e a menos de 6 px do lugar; no fim, inteiro e no lugar (${painel.meio.opacidade.toFixed(2)}, ${(painel.meio.cy - painel.fim.cy).toFixed(1)} px)`)
      conta(marcador?.nome === 'dp-pino' && marcador.duracao === 260 && marcador.vezes === 1, `animação: o marcador da busca salta com dp-pino em 260 ms, uma vez (${marcador?.nome}, ${marcador?.duracao} ms)`)
      conta(marcador.mexe.every((k) => SO_PODE.includes(k)), `animação: o marcador só mexe em opacidade e tamanho (${marcador.mexe.join(', ')})`)
      conta(marcador.meio.w < marcador.fim.w && marcador.meio.w > marcador.fim.w * 0.4 && Math.abs(marcador.meio.cx - marcador.fim.cx) < 1 && Math.abs(marcador.meio.cy - marcador.fim.cy) < 1, `animação: o marcador cresce a partir do próprio centro, sem escorregar pelo desenho (${marcador.meio.w.toFixed(1)} de ${marcador.fim.w.toFixed(1)} px, desvio ${Math.abs(marcador.meio.cx - marcador.fim.cx).toFixed(2)} px)`)
      conta(selecao?.nome === 'dp-surge' && selecao.duracao === 150, `animação: a seleção do editor entra com dp-surge em 150 ms (${selecao?.nome}, ${selecao?.duracao} ms)`)
      const todas = [...linhas, ...casa]
      conta(todas.every((t) => !t.falta && t.quanto === '0.15s' && ['background-color', 'transform'].includes(t.o_que)), `animação: as transições de linha, casa e botão miúdo duram 150 ms e só mexem em fundo ou escala (${todas.map((t) => t.o_que + ' ' + t.quanto).join(' | ')})`)
      const fora = await pg.evaluate(() => {
        const ruins = []
        for (const folha of document.styleSheets) {
          let regras = []
          try { regras = [...folha.cssRules] } catch { continue }
          const ver = (r) => {
            if (r.cssRules && !(r instanceof CSSStyleRule)) { [...r.cssRules].forEach(ver); return }
            if (!(r instanceof CSSStyleRule) || !/\.dp-/.test(r.selectorText)) return
            const t = r.style.transition || r.style.transitionProperty
            if (t && /\ball\b|width|height|top|left|margin|padding|box-shadow|border/.test(t)) ruins.push(r.selectorText + ' { ' + t + ' }')
          }
          regras.forEach(ver)
        }
        return ruins
      })
      conta(fora.length === 0, `animação: nenhuma regra do depósito anima largura, altura, margem, borda ou sombra (${fora.join(' ; ') || 'nenhuma'})`)
    } else {
      const zerou = [painel, marcador, selecao].every((a) => a && a.duracao < 1)
      conta(zerou, `movimento reduzido: com o "reduzir movimento" do sistema, as três animações duram menos de 1 ms (${[painel, marcador, selecao].map((a) => a?.duracao).join(', ')})`)
      conta([...linhas, ...casa].every((t) => parseFloat(t.quanto) < 0.001), `movimento reduzido: as transições também zeram (${[...linhas, ...casa].map((t) => t.quanto).join(', ')})`)
    }
    conta(erros.length === 0, `${movimento ? 'animação' : 'movimento reduzido'}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* o arrasto com o movimento ligado: a peça acompanha o ponteiro quadro a quadro, sem transição no caminho */
await caso('arrasto', async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', movimento: true })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 500)
  const S = await escalaDoDesenho(pg, '[data-mapa]')
  const a = await centro(pg, '[data-movel="A"] .dp-moldura')
  await pg.mouse.move(a.x, a.y); await pg.mouse.down()
  const atraso = []
  for (let k = 1; k <= 10; k++) {
    await pg.mouse.move(a.x + (S * 2 * k) / 10, a.y)
    await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    const agora = await centro(pg, '[data-movel="A"] .dp-moldura')
    atraso.push(Math.abs(agora.x - a.x - (S * 2 * k) / 10))
  }
  await pg.screenshot({ path: `${PASTA}/arrastando-1440-light.png` })
  await pg.mouse.up()
  /* o encaixe é de 10 cm: a peça nunca fica a mais de meio encaixe do ponteiro */
  conta(Math.max(...atraso) <= S * 0.05 + 1.5, `arrasto: a peça acompanha o ponteiro no mesmo quadro, só com o encaixe de 10 cm (maior distância ${Math.max(...atraso).toFixed(1)} px)`)
  await ctx.close()
})

/* A GRADE ESTICADA (defeito achado pelo Henrique em 05/10/2026): a grade que foi
   puxada pelo canto até ocupar o chão não deixava mudar as fileiras e as
   colunas. O campo voltava para 2 e 3, porque a conta só sabia estender, e a
   fileira nova caía fora do chão. O depósito do teste é o que ele tinha salvo. */
await caso('grade esticada', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1536, altura: 864, tema: 'light', deposito: 'esticado' })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
  await pg.locator('[data-movel="P05"]').click(); await pausa(pg, 300)
  const campo = (rotulo) => pg.locator(`input[aria-label="${rotulo}"]`)
  const escrever = async (rotulo, valor) => { const c = campo(rotulo); await c.click(); await c.press('Control+a'); await pg.keyboard.type(valor); await pausa(pg, 300); await c.blur(); await pausa(pg, 300) }
  const estado = async () => ({ f: await campo('Fileiras').inputValue(), c: await campo('Colunas').inputValue(), ex: await campo('Espaço entre colunas').inputValue(), ey: await campo('Espaço entre fileiras').inputValue(), n: await pg.locator('[data-movel^="P"]').count() })
  const recado = async () => (await pg.locator('.pilha-recados').innerText()).replace(/\s+/g, ' ').trim()
  let e = await estado()
  conta(e.f === '2' && e.c === '3' && e.ex === '4,3' && e.ey === '4,3' && e.n === 6, `grade esticada: o painel lê a grade de 2 por 3, com 4,3 m entre os paletes nos dois sentidos (${JSON.stringify(e)})`)

  /* mais uma fileira, sem chão para estender: reparte no mesmo espaço */
  await escrever('Fileiras', '3')
  e = await estado()
  conta(e.f === '3' && e.c === '3' && e.n === 9 && e.ey === '1,55' && e.ex === '4,3', `grade esticada: pedir 3 fileiras cria as 3, repartidas no espaço que a grade já ocupava, e as colunas não saem do lugar (${JSON.stringify(e)})`)
  conta(/as 3 fileiras foram repartidas no espaço que a grade já ocupava.*de 4,3 para 1,55 m/.test(await recado()), `grade esticada: a tela diz o que fez com o vão (${(await recado()).slice(0, 150)})`)
  await pg.screenshot({ path: `${PASTA}/grade-esticada-3-fileiras-1536-light.png`, fullPage: false })

  /* mais uma coluna: o mesmo, no outro sentido */
  await escrever('Colunas', '4')
  e = await estado()
  conta(e.f === '3' && e.c === '4' && e.n === 12 && e.ex === '2,46' && e.ey === '1,55', `grade esticada: pedir 4 colunas cria as 4 no mesmo espaço, sem mexer nas fileiras (${JSON.stringify(e)})`)

  /* menos: tira as últimas e o vão fica */
  await escrever('Fileiras', '2')
  e = await estado()
  conta(e.f === '2' && e.n === 8 && e.ey === '1,55', `grade esticada: voltar para 2 fileiras tira a última e não mexe no vão (${JSON.stringify(e)})`)

  /* o que não cabe nem encostado é dito, e nada muda */
  await escrever('Fileiras', '9')
  e = await estado()
  conta(e.f === '2' && e.n === 8 && /Não cabem 9 fileiras de 1,2 m daqui até a parede/.test(await recado()), `grade esticada: 9 fileiras de 1,2 m não cabem em 10 m de chão; nada muda e a tela diz por quê (${(await recado()).slice(-150)})`)

  /* o vão de cada sentido se escreve à parte */
  await escrever('Espaço entre fileiras', '3')
  e = await estado()
  conta(e.ey === '3' && e.ex === '2,46' && e.n === 8, `grade esticada: o espaço entre fileiras muda sem mexer no espaço entre colunas (${JSON.stringify(e)})`)

  /* o que foi desenhado é o que vai para o banco */
  await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 900)
  const pl = gravados.find((x) => x.u === 'rpc/salvar_deposito')?.corpo.p_planta
  const pal = (pl?.moveis ?? []).filter((m) => m.tipo === 'palete')
  const xs = [...new Set(pal.map((m) => m.x))].sort((a, b) => a - b).join(' ')
  const ys = [...new Set(pal.map((m) => m.y))].sort((a, b) => a - b).join(' ')
  const nomes = pal.map((m) => m.nome).sort().join(' ')
  conta(pal.length === 8 && xs === '2 5.66 9.32 12.98' && ys === '1.1 5.3' && new Set(pal.map((m) => m.nome)).size === 8, `grade esticada: o Salvar manda os 8 paletes nos lugares novos, cada um com um nome (x ${xs}; y ${ys}; ${nomes})`)
  conta(['pe-1', 'pe-2', 'pe-3'].every((id) => pal.some((m) => m.id === id)), 'grade esticada: os paletes que já existiam continuam sendo os mesmos (guardam o que estiver marcado neles)')
  conta(erros.length === 0, `grade esticada: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* A GRADE NOVA continua estendendo, que é o que se espera de quem acabou de pôr */
await caso('grade nova', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', deposito: 'vazio' })
  await ir(pg, '/estoque?aba=deposito', '.dp-quadro')
  await pg.locator('.dp-quadro').getByRole('button', { name: 'Desenhar o depósito' }).click(); await pausa(pg, 600)
  await pg.getByRole('button', { name: 'Grade de paletes' }).click(); await pausa(pg, 400)
  const campo = (rotulo) => pg.locator(`input[aria-label="${rotulo}"]`)
  const escrever = async (rotulo, valor) => { const c = campo(rotulo); await c.click(); await c.press('Control+a'); await pg.keyboard.type(valor); await pausa(pg, 300); await c.blur(); await pausa(pg, 300) }
  await escrever('Fileiras', '4'); await escrever('Colunas', '6')
  const e = { f: await campo('Fileiras').inputValue(), c: await campo('Colunas').inputValue(), ex: await campo('Espaço entre colunas').inputValue(), ey: await campo('Espaço entre fileiras').inputValue(), n: await pg.locator('[data-mapa] [data-movel]').count() }
  conta(e.f === '4' && e.c === '6' && e.n === 24 && e.ex === '0,8' && e.ey === '0,8' && await pg.locator('.pilha-recados .recado').count() === 0, `grade nova: com chão de sobra, 4 fileiras por 6 colunas estendem a grade com o mesmo vão de 0,8 m, sem recado (${JSON.stringify(e)})`)
  /* a nona coluna de 1,2 m com 0,8 m de vão não cabe em 15 m: vai até a parede */
  await escrever('Colunas', '8')
  const ex = await campo('Espaço entre colunas').inputValue()
  conta(await campo('Colunas').inputValue() === '8' && ex === '0,7' && /foram até a parede/.test((await pg.locator('.pilha-recados').innerText())), `grade nova: 8 colunas não cabem estendendo; a grade vai até a parede e o vão cai para ${ex} m, dito na tela`)
  /* o vão grande demais vira o maior que cabe, em vez de a última coluna sumir */
  await escrever('Espaço entre colunas', '2')
  const depois = { c: await campo('Colunas').inputValue(), ex: await campo('Espaço entre colunas').inputValue(), n: await pg.locator('[data-mapa] [data-movel]').count() }
  conta(depois.c === '8' && depois.ex === '0,7' && depois.n === 32 && /o maior vão que cabe daqui até a parede é 0,7 m/.test(await pg.locator('.pilha-recados').innerText()), `grade nova: pedir 2 m entre 8 colunas não cabe; o vão fica no maior que cabe e as 8 colunas continuam lá (${JSON.stringify(depois)})`)
  conta(erros.length === 0, `grade nova: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* DESFAZER E REFAZER no editor do depósito (pedido do Henrique, 05/10/2026:
   "quero capacidade de dar Ctrl+Z na edição do depósito"). */
await caso('desfazer', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
  const desfazer = pg.getByRole('button', { name: 'Desfazer', exact: true })
  const refazer = pg.getByRole('button', { name: 'Refazer', exact: true })
  const salvar = pg.getByRole('button', { name: 'Salvar o depósito' })
  const pecas = () => pg.locator('[data-mapa] [data-movel]').count()
  const lugarDe = (nome) => pg.locator(`[data-movel="${nome}"]`).boundingBox().then((b) => (b ? Math.round(b.x) + ',' + Math.round(b.y) : 'sumiu'))
  const de = await pecas()
  conta(await desfazer.isDisabled() && await refazer.isDisabled() && await salvar.isDisabled(), 'desfazer: o editor abre sem nada para desfazer nem refazer')

  /* pôr uma peça e desfazer */
  await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 1000)
  conta(await pecas() === de + 1 && !(await desfazer.isDisabled()), 'desfazer: pôr um palete acende o botão de desfazer')
  await pg.keyboard.press('Control+z'); await pausa(pg, 300)
  conta(await pecas() === de && await pg.locator('[data-movel="P22"]').count() === 0 && await desfazer.isDisabled() && !(await refazer.isDisabled()) && await salvar.isDisabled(), 'desfazer: Ctrl+Z tira o palete que acabou de entrar, o desenho volta ao salvo e o Salvar apaga')
  await pg.keyboard.press('Control+Shift+z'); await pausa(pg, 300)
  conta(await pecas() === de + 1 && await pg.locator('[data-movel="P22"]').count() === 1 && await refazer.isDisabled(), 'desfazer: Ctrl+Shift+Z põe o palete de volta')
  await pg.keyboard.press('Control+z'); await pausa(pg, 300)
  await pg.keyboard.press('Control+y'); await pausa(pg, 300)
  conta(await pecas() === de + 1, 'desfazer: Ctrl+Y também refaz')
  await desfazer.click(); await pausa(pg, 1000)
  conta(await pecas() === de, 'desfazer: o botão faz o mesmo que o atalho')

  /* um arrasto inteiro é um passo só */
  const antes = await lugarDe('A')
  const a = await pg.locator('[data-movel="A"]').boundingBox()
  await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await pg.mouse.down()
  for (let i = 1; i <= 8; i++) { await pg.mouse.move(a.x + a.width / 2 + i * 12, a.y + a.height / 2 + i * 9); await pausa(pg, 40) }
  await pg.mouse.up(); await pausa(pg, 1000)
  const arrastada = await lugarDe('A')
  await pg.keyboard.press('Control+z'); await pausa(pg, 300)
  conta(arrastada !== antes && await lugarDe('A') === antes && await desfazer.isDisabled(), `desfazer: o arrasto inteiro da prateleira A volta num Ctrl+Z só (de ${antes} para ${arrastada} e de volta)`)

  /* as setas em sequência também */
  await pg.locator('[data-movel="A"]').focus(); await pausa(pg, 200)
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('ArrowRight'); await pausa(pg, 60) }
  await pausa(pg, 1000)
  const andou = await lugarDe('A')
  await pg.keyboard.press('Control+z'); await pausa(pg, 300)
  conta(andou !== antes && await lugarDe('A') === antes, 'desfazer: cinco toques de seta seguidos são um passo só')

  /* dentro de um campo: o desenho volta e o campo relê */
  await pg.locator('[data-movel="P08"]').click(); await pausa(pg, 1000)
  const fileiras = pg.locator('input[aria-label="Fileiras"]')
  const tinha = await fileiras.inputValue()
  await fileiras.click(); await fileiras.press('Control+a'); await pg.keyboard.type('2'); await pausa(pg, 300)
  const com2 = await pecas()
  await pg.keyboard.press('Control+z'); await pausa(pg, 400)
  conta(com2 < de && await pecas() === de && await fileiras.inputValue() === tinha, `desfazer: com o foco no campo Fileiras, Ctrl+Z devolve a grade e o campo volta a mostrar ${tinha} (${com2} peças com 2 fileiras, ${await pecas()} depois)`)

  /* dois passos separados voltam um de cada vez, e mexer de novo apaga o refazer */
  await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 1000)
  await pg.getByRole('button', { name: 'Prateleira', exact: true }).click(); await pausa(pg, 1000)
  await pg.keyboard.press('Control+z'); await pausa(pg, 300)
  conta(await pecas() === de + 1 && await pg.locator('[data-movel="P22"]').count() === 1, 'desfazer: duas peças postas uma depois da outra voltam uma de cada vez')
  await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 400)
  const comOSegundo = await pecas()
  await pg.keyboard.press('Control+y'); await pausa(pg, 300)
  conta(await refazer.isDisabled() && await pecas() === comOSegundo && await pg.locator('[data-movel="B"]').count() === 0, 'desfazer: mexer no desenho depois de desfazer apaga o que havia para refazer (a prateleira desfeita não volta com Ctrl+Y)')
  await pg.screenshot({ path: `${PASTA}/editor-desfazer-1440-light.png`, fullPage: false })

  /* o que vai para o banco é o desenho que está na tela */
  await salvar.click(); await pausa(pg, 900)
  const pl = gravados.find((x) => x.u === 'rpc/salvar_deposito')?.corpo.p_planta
  conta(pl && pl.moveis.length === de + 2 && pl.moveis.filter((m) => m.nome === 'P22' || m.nome === 'P23').length === 2, `desfazer: o Salvar manda o desenho que ficou na tela, com os dois paletes novos (${pl?.moveis.length} peças)`)
  conta(erros.length === 0, `desfazer: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* ==========================================================================
   9. A PRATELEIRA DE ATÉ NOVE NÍVEIS (pedido do Henrique de 06/10/2026)

   O limite era seis, porque seis era quantas cores de nível havia. Agora são
   nove cores e nove níveis. Aqui se confere que os nove aparecem, cada um com
   a sua cor e o número dentro, que nada estoura no computador nem no celular,
   que o editor aceita 9 e recusa 10, e que o nível 9 chega ao banco.
   ========================================================================== */
const NOVE = Array.from({ length: 9 }, (_, i) => '--nivel-' + (i + 1))
for (const tema of ['light', 'dark']) {
  const T = `nove níveis ${tema === 'light' ? 'gelo' : 'grafite'}`
  await caso(T, async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema, deposito: 'nove' })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    const K = await tokens(pg, [...NOVE, '--on-nivel'])
    conta(new Set(NOVE.map((n) => K[n])).size === 9 && NOVE.every((n) => K[n] !== 'rgba(0, 0, 0, 0)'), `${T}: o Design System tem nove cores de nível, todas diferentes (${new Set(NOVE.map((n) => K[n])).size})`)

    /* o lugar aberto: os nove níveis de cima para baixo, e a prateleira de frente */
    await pg.locator('[data-mapa] [data-lugar="D2"]').click(); await pausa(pg)
    const painel = pg.locator('.dp-painel[data-aberto="D2"]')
    const secoes = await painel.locator('.dp-secao').allInnerTexts()
    conta(secoes.map((s) => s.match(/Nível (\d+)/)?.[1]).join('') === '987654321', `${T}: o vão aberto lista os nove níveis de cima para baixo (${secoes.map((s) => s.match(/Nível (\d+)/)?.[1]).join('')})`)
    const nv = await painel.locator('.dp-secao .dp-nv').evaluateAll((l) => l.map((e) => ({ n: e.textContent.trim(), fundo: getComputedStyle(e).backgroundColor, cor: getComputedStyle(e).color })))
    conta(nv.length === 9 && nv.every((x) => x.fundo === K['--nivel-' + x.n] && x.cor === K['--on-nivel']), `${T}: cada um dos nove níveis tem a sua cor, com o número dentro dela (${nv.map((x) => x.n).join(', ')})`)
    const casas = await painel.locator('.dp-casa').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return { classe: e.className, w: r.width, h: r.height, borda: getComputedStyle(e).borderTopColor } }))
    conta(casas.length === 36 && casas.every((c) => c.w >= 20 && c.h >= 20), `${T}: a prateleira de frente tem 4 vãos por 9 níveis, e nenhuma casa some (${casas.length}, menor ${Math.min(...casas.map((c) => Math.round(c.w)))} por ${Math.min(...casas.map((c) => Math.round(c.h)))})`)
    const cheias = casas.filter((c) => /do-aberto/.test(c.classe) && /\btem\b/.test(c.classe)).length
    conta(cheias === 9, `${T}: no vão D2 as nove casas têm material, uma por nível (${cheias})`)
    conta(new Set(casas.filter((c) => /do-aberto/.test(c.classe)).map((c) => c.borda)).size === 9, `${T}: as nove casas do vão aberto têm nove cores de borda diferentes`)
    const cabe = await painel.evaluate((e) => e.scrollWidth - e.clientWidth)
    conta(cabe <= 0 && (await sobra(pg)) <= 0, `${T}: com nove níveis o painel não estoura e nada rola para o lado (${cabe})`)
    await pg.screenshot({ path: `${PASTA}/nove-aberto-1440-${tema}.png`, fullPage: true })

    /* marcar no nível 9 */
    await pg.locator('.dp-linha', { hasText: 'HELANCA COLEGIAL' }).locator('.dp-marcar').click(); await pausa(pg, 500)
    const caixa = pg.locator('dialog[open]')
    await caixa.locator('[data-lugar="D3"]').click(); await pausa(pg)
    conta(await caixa.locator('.dp-casa').count() === 36, `${T} marcar: a prateleira aparece de frente com as 36 casas`)
    await caixa.getByRole('button', { name: 'D3, nível 9, vazio' }).click(); await pausa(pg, 200)
    conta(await caixa.locator('input[aria-label="Código do lugar"]').inputValue() === 'D3-9', `${T} marcar: o clique na casa de cima dá o código D3-9`)
    await pg.screenshot({ path: `${PASTA}/nove-marcar-1440-${tema}.png`, fullPage: false })
    const dentro = await caixa.evaluate((e) => { const c = e.querySelector('.caixa') ?? e; const r = c.getBoundingClientRect(); return { fundo: r.bottom, tela: innerHeight, lado: e.scrollWidth - e.clientWidth } })
    conta(dentro.fundo <= dentro.tela + 0.5 && dentro.lado <= 0, `${T} marcar: a caixa com nove níveis cabe na tela de 900 px de altura (${Math.round(dentro.fundo)} de ${dentro.tela})`)
    await caixa.getByRole('button', { name: 'Marcar aqui' }).click(); await pausa(pg, 600)
    const g = gravados.find((x) => x.u === 'rpc/definir_lugares')
    conta(JSON.stringify(g?.corpo.p_lugares) === JSON.stringify([{ movel: 'prat-d', vao: 3, nivel: 9 }]), `${T} marcar: o banco recebe o nível 9 (${JSON.stringify(g?.corpo.p_lugares)})`)

    /* o código escrito: D1-9 existe, D1-10 não */
    await pg.locator('.dp-linha', { hasText: 'Tela de silk' }).locator('.dp-marcar').click(); await pausa(pg, 500)
    await caixa.locator('input[aria-label="Código do lugar"]').fill('d1-10'); await pausa(pg, 300)
    const semDez = await caixa.getByRole('button', { name: 'Marcar aqui' }).isDisabled()
    await caixa.locator('input[aria-label="Código do lugar"]').fill('d1-9'); await pausa(pg, 300)
    conta(semDez && await caixa.getByRole('button', { name: 'Marcar aqui' }).isEnabled() && /nível 9/.test(await caixa.locator('.dp-lugares').innerText()), `${T} marcar: o código D1-9 escrito é aceito, e o D1-10 não aponta lugar nenhum`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })

  /* o editor: de 4 para 9, e 10 não passa */
  await caso(`${T} editor`, async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    const K = await tokens(pg, [...NOVE, '--on-nivel'])
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 600)
    await pg.locator('[data-movel="D"]').click({ position: { x: 10, y: 30 } }); await pausa(pg)
    const campo = pg.locator('input[aria-label="Níveis"]')
    conta(await campo.inputValue() === '4', `${T} editor: a prateleira D chega com 4 níveis`)
    /* com o foco ainda no campo: ao sair, o campo volta a mostrar o último número que valeu */
    await campo.fill('10'); await pausa(pg, 200)
    const dica = await pg.locator('.campo', { has: campo }).last().innerText()
    conta(await campo.getAttribute('aria-invalid') === 'true' && /De 1 a 9/.test(dica) && await pg.locator('.dp-cores-dos-niveis .dp-nv').count() === 4, `${T} editor: 10 níveis é recusado, a dica diz "De 1 a 9" e o desenho continua com 4 (${dica.replace(/\s+/g, ' ').trim()})`)
    await campo.blur(); await pausa(pg, 200)
    conta(await campo.inputValue() === '4', `${T} editor: saindo do campo sem corrigir, ele volta a mostrar 4`)
    await campo.fill('9'); await campo.blur(); await pausa(pg, 200)
    const cores = await pg.locator('.dp-cores-dos-niveis .dp-cor-do-nivel').evaluateAll((l) => l.map((e) => { const i = e.querySelector('.dp-nv'); return { n: i.textContent.trim(), fundo: getComputedStyle(i).backgroundColor, cor: getComputedStyle(i).color, texto: e.textContent.replace(/\s+/g, ' ').trim() } }))
    conta(cores.map((c) => c.n).join('') === '987654321' && cores.every((c) => c.fundo === K['--nivel-' + c.n] && c.cor === K['--on-nivel']), `${T} editor: com 9 no campo, "A cor de cada nível" mostra os nove, de cima para baixo, cada um na sua cor (${cores.map((c) => c.n).join('')})`)
    conta(/em cima/.test(cores[0].texto) && /embaixo/.test(cores[8].texto), `${T} editor: o nível 9 é o de cima e o 1 é o de baixo (${cores[0].texto} | ${cores[8].texto})`)
    conta((await sobra(pg)) <= 0, `${T} editor: com nove níveis nada rola para o lado`)
    await pg.screenshot({ path: `${PASTA}/nove-editor-1440-${tema}.png`, fullPage: true })
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 800)
    const pd = gravados.find((x) => x.u === 'rpc/salvar_deposito')?.corpo.p_planta.moveis.find((m) => m.id === 'prat-d')
    conta(pd?.niveis === 9 && pd.vaos === 4, `${T} editor: o Salvar manda a prateleira D com 9 níveis (${pd?.niveis})`)
    conta(erros.length === 0, `${T} editor: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })

  /* o celular */
  await caso(`${T} no celular`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema, deposito: 'nove' })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    await pg.locator('[data-mapa] [data-lugar="D2"]').click({ force: true }); await pausa(pg)
    const painel = pg.locator('.dp-painel[data-aberto="D2"]')
    const casas = await painel.locator('.dp-casa').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, dir: r.right } }))
    const largura = await painel.evaluate((e) => e.getBoundingClientRect().right)
    conta(casas.length === 36 && casas.every((c) => c.w >= 20 && c.h >= 20 && c.dir <= largura + 0.5), `${T}: em 390 px as 36 casas cabem dentro do painel (menor ${Math.min(...casas.map((c) => Math.round(c.w)))} por ${Math.min(...casas.map((c) => Math.round(c.h)))})`)
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
    await pg.screenshot({ path: `${PASTA}/nove-aberto-390-${tema}.png`, fullPage: true })
    await pg.locator('.dp-linha', { hasText: 'HELANCA COLEGIAL' }).locator('.dp-marcar').click(); await pausa(pg, 600)
    const caixa = pg.locator('dialog[open]')
    await caixa.locator('[data-lugar="D3"]').click({ force: true }); await pausa(pg, 400)
    const alvo = await caixa.getByRole('button', { name: 'D3, nível 9, vazio' }).boundingBox()
    conta(await caixa.locator('.dp-casa').count() === 36 && alvo && alvo.height >= 36, `${T} marcar: as 36 casas aparecem e cada uma tem altura de toque (${Math.round(alvo?.height ?? 0)} px)`)
    await caixa.getByRole('button', { name: 'D3, nível 9, vazio' }).click(); await pausa(pg, 200)
    conta(await caixa.locator('input[aria-label="Código do lugar"]').inputValue() === 'D3-9' && await caixa.evaluate((e) => e.scrollWidth - e.clientWidth) <= 0, `${T} marcar: o toque na casa de cima dá D3-9, e a caixa não rola para o lado`)
    await pg.screenshot({ path: `${PASTA}/nove-marcar-390-${tema}.png`, fullPage: false })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram.`)
if (ruins.length) { console.log('\nNÃO PASSOU:'); ruins.forEach((r) => console.log('  ' + r.texto)); process.exit(1) }
