/* ==========================================================================
   A ABA MATERIAIS DO ESTOQUE CONTRA O WIREFRAME DE 04/10/2026 (pranchas 37 a
   40, 46 e 47): as quatro colunas, a sanfona, as fichas e o celular.

   O Henrique aprovou com a ordem "tenha certeza que está tudo certo com o
   visual e as animações". Este teste é essa conferência.

   O QUE ELE CONFERE
     1. a barra na grade das quatro colunas: as abas da página com a largura
        da primeira coluna, a busca sobre a segunda e a terceira, Lista e
        Tabela sobre a quarta
     2. as quatro colunas, as três baixas com 368 de altura, rolando sem barra
        à vista e terminando no "Ver mais", e o trilho do que está acabando
        debaixo das três
     3. a sanfona: grupo, tecido e cor; abrir não é escolher; as três abas;
        a busca que troca de aba sozinha; o fornecedor da cor só quando é outro
     4. para separação, para comprar e últimos movimentos, e para onde cada
        "Ver mais" leva
     5. a ficha do tecido e a da cor, com "Onde está" e a ida ao depósito
     6. a folha de movimento, o material novo, a tabela e as movimentações
     7. quem só lê, e a página de pé quando o catálogo e a separação não leem
     8. o tablet e o celular, sem rolar para o lado
     9. AS ANIMAÇÕES, e o "reduzir movimento" desligando todas
    10. que não houve erro de JavaScript

   O banco é de mentira (testes/materiais-dados.mjs, estoque-dados.mjs e
   deposito-dados.mjs).

   Uso:  node testes/estoque.mjs                 confere o site publicado
         node testes/estoque.mjs http://localhost:4173
   As fotos ficam em testes/atual/estoque/, fora do repositório.
   ========================================================================== */

import { mkdirSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
import { abrir, ir as irPara, chromium, sobra } from './deposito-base.mjs'

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/estoque'
mkdirSync(PASTA, { recursive: true })
const ir = (pg, rota, espera) => irPara(pg, SITE, rota, espera)
const pausa = (pg, ms = 350) => pg.waitForTimeout(ms)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
async function caso(nome, fn) {
  try { await fn() } catch (e) { conta(false, `${nome}: o caso parou no meio (${String(e).split('\n')[0].slice(0, 200)})`) }
}
const igual = (a, b, folga = 0.6) => Math.abs(a - b) < folga
const caixa = async (pg, seletor) => {
  const c = await pg.locator(seletor).first().boundingBox()
  return c ? { x: c.x, y: c.y, w: c.width, h: c.height, dir: c.x + c.width, baixo: c.y + c.height } : null
}
const tokens = (pg, nomes) => pg.evaluate((nomes) => {
  const o = {}
  for (const n of nomes) { const e = document.createElement('i'); e.style.backgroundColor = `var(${n})`; document.body.append(e); o[n] = getComputedStyle(e).backgroundColor; e.remove() }
  return o
}, nomes)
const texto = async (pg, seletor) => (await pg.locator(seletor).first().innerText()).replace(/\s+/g, ' ').trim()
const id = (nome) => D.materiais.find((m) => m.nome === nome).id
const DRY = '[data-tecido="DRYFIT POLIESTER 100%"]'
/* nada vem aberto (05/10/2026): quem precisa de um grupo aberto, abre */
const abrirGrupo = async (pg, nome = 'DRY FIT') => {
  const g = pg.locator(`[data-arvore] .em-g[data-grupo="${nome}"]`)
  if (await g.getAttribute('aria-expanded') !== 'true') { await g.click(); await pausa(pg, 250) }
}
const cor = (nome) => `.em-c[data-material="${nome}"]`

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* ==========================================================================
   1. A TELA LARGA, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema })
  const foto = (n, inteira = true) => pg.screenshot({ path: `${PASTA}/${n}-1440-${tema}.png`, fullPage: inteira })

  await caso(`${T} grade`, async () => {
    await ir(pg, '/estoque', '[data-arvore]')
    await foto('geral')
    const K = await tokens(pg, ['--ink', '--brand', '--surface'])
    const arvore = await caixa(pg, '[data-arvore]')
    const sep = await caixa(pg, '[data-coluna="separacao"]')
    const comp = await caixa(pg, '[data-coluna="comprar"]')
    const mov = await caixa(pg, '[data-coluna="movimentos"]')
    const est = await caixa(pg, '[data-trilho]')
    const abas = await caixa(pg, '[data-barra] > .em-seg')
    const busca = await caixa(pg, '[data-barra] > .em-busca')
    const vista = await caixa(pg, '[data-barra] .em-barra-fim')
    const deDentro = await caixa(pg, '.em-abas .em-seg')

    conta(igual(abas.x, arvore.x) && igual(abas.w, arvore.w), `${T}: as abas da página têm a largura da primeira coluna (${Math.round(abas.w)} e ${Math.round(arvore.w)})`)
    conta(igual(abas.x + abas.w / 2, deDentro.x + deDentro.w / 2, 1), `${T}: Materiais, Movimentações e Depósito ficam pareadas com Tecido, Aviamentos e Insumo`)
    conta(igual(busca.x, sep.x) && igual(busca.dir, comp.dir), `${T}: a busca ocupa a segunda e a terceira coluna (${Math.round(busca.w)})`)
    conta(igual(vista.dir, mov.dir) && vista.x >= mov.x - 0.6, `${T}: Lista e Tabela ficam sobre a quarta coluna, encostadas na margem`)
    conta(igual(abas.h, 40) && igual(busca.h, 40), `${T}: abas e busca com 40 de altura`)

    conta(igual(sep.y, arvore.y) && igual(comp.y, arvore.y) && igual(mov.y, arvore.y), `${T}: as quatro colunas começam na mesma linha`)
    conta(igual(sep.x - arvore.dir, 16) && igual(comp.x - sep.dir, 16) && igual(mov.x - comp.dir, 16), `${T}: 16 entre as colunas (${[sep.x - arvore.dir, comp.x - sep.dir, mov.x - comp.dir].map((n) => Math.round(n * 10) / 10).join(', ')})`)
    conta(igual(sep.w, comp.w) && igual(comp.w, mov.w) && igual(arvore.w, sep.w * 1.5, 1), `${T}: três colunas iguais, e a primeira uma vez e meia mais larga (${Math.round(arvore.w)} e ${Math.round(sep.w)})`)
    conta([sep, comp, mov].every((c) => igual(c.h, 368)), `${T}: as três colunas da direita são baixas, 368 de altura (${[sep, comp, mov].map((c) => Math.round(c.h)).join(', ')})`)
    conta(igual(est.x, sep.x) && igual(est.dir, mov.dir) && igual(est.y - sep.baixo, 16), `${T}: o trilho do que está acabando fica debaixo das três, na largura das três, a 16 delas`)

    /* rolam sem barra à vista, e terminam no Ver mais */
    const rolagens = await pg.locator('.em-curta .em-rolagem').evaluateAll((l) => l.map((e) => ({
      y: getComputedStyle(e).overflowY, barra: getComputedStyle(e).scrollbarWidth, sobraDeBarra: e.offsetWidth - e.clientWidth, cabe: e.scrollHeight <= e.clientHeight,
    })))
    conta(rolagens.length === 3 && rolagens.every((r) => r.y === 'auto' && r.barra === 'none' && r.sobraDeBarra === 0), `${T}: as três rolam por dentro e nenhuma mostra barra de rolagem`)
    conta(!rolagens[0].cabe && !rolagens[2].cabe, `${T}: separação e movimentos têm mais do que cabe, e por isso rolam`)
    const antes = await pg.locator('[data-coluna="movimentos"] .em-rolagem').evaluate((e) => e.scrollTop)
    const m2 = await caixa(pg, '[data-coluna="movimentos"] .em-rolagem')
    await pg.mouse.move(m2.x + m2.w / 2, m2.y + m2.h / 2); await pg.mouse.wheel(0, 240); await pausa(pg, 250)
    const depois = await pg.locator('[data-coluna="movimentos"] .em-rolagem').evaluate((e) => e.scrollTop)
    const daPagina = await pg.evaluate(() => scrollY)
    conta(depois > antes && daPagina === 0, `${T}: a roda do mouse rola a coluna, e não a página (${antes} para ${depois})`)
    const pes = await pg.locator('.em-curta .em-pe').allInnerTexts()
    conta(pes.length === 3 && /Ver mais · os 7 na Separação/.test(pes[0]) && /Ver mais · os 4 para comprar/.test(pes[1]) && /Ver mais · todas as movimentações/.test(pes[2]), `${T}: cada coluna termina no seu "Ver mais" (${pes.join(' | ')})`)
    conta(K['--surface'] && await pg.locator('.em-curta .em-pe').first().evaluate((e) => getComputedStyle(e, '::before').height) === '36px', `${T}: o esfumado em cima do pé diz que a lista continua`)
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
  })

  await caso(`${T} sanfona`, async () => {
    const abas = await texto(pg, '.em-abas')
    conta(/Tecido 10/.test(abas) && /Aviamentos 7/.test(abas) && /Insumo 9/.test(abas), `${T} sanfona: três abas com a conta de cada uma (${abas})`)
    const grupos = await pg.locator('[data-arvore] .em-g').evaluateAll((l) => l.map((e) => e.dataset.grupo + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
    conta(grupos.join(' | ') === 'ALGODÃO | DRY FIT | PIQUE | MOLETOM | SUPLEX | VISCOSE | Sem tipo', `${T} sanfona: os grupos na ordem do catálogo, com os dois que não têm estoque e o Sem tipo por último, e NENHUM aberto ao entrar (${grupos.join(' | ')})`)
    conta(await pg.locator('[data-arvore] .em-t').count() === 0 && await pg.locator('[data-arvore] .em-c').count() === 0 && await pg.locator('[data-arvore] [aria-expanded="true"]').count() === 0, `${T} sanfona: ao abrir a página, nenhum tecido e nenhuma cor à vista`)
    const alg = await texto(pg, '[data-arvore] .em-g[data-grupo="ALGODÃO"]')
    conta(/ALG/.test(alg) && /2 tecidos · 2 cores/.test(alg), `${T} sanfona: o grupo diz o código, quantos tecidos e quantas cores (${alg})`)
    const st = await texto(pg, '[data-arvore] .em-g[data-grupo="Sem tipo"]')
    conta(/S\/T/.test(st), `${T} sanfona: tecido sem grupo no catálogo cai no Sem tipo, com S/T no lugar do código`)
    await abrirGrupo(pg)
    const dry = await texto(pg, DRY)
    conta(/Malharia Exemplo Ltda · 1 cor de outro/.test(dry) && /81 kg/.test(dry) && /4 cores/.test(dry), `${T} sanfona: o tecido diz o fornecedor, que uma cor vem de outro, o livre e as cores (${dry})`)

    /* abrir não é escolher */
    conta(await pg.locator('[data-arvore] .em-c').count() === 0, `${T} sanfona: grupo aberto mostra os tecidos, com as cores ainda fechadas`)
    await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg)
    conta(await pg.locator('[data-arvore] .em-c').count() === 4 && await pg.locator('[data-ficha]').count() === 0 && await pg.locator('[data-coluna]').count() === 3, `${T} sanfona: a seta abre as 4 cores sem escolher nada: as colunas continuam à vista`)
    const preto = await texto(pg, cor('DRYFIT POLIESTER 100% · Preto'))
    conta(/Preto/.test(preto) && /D2/.test(preto) && /3 kg/.test(preto) && !/Exemplo/.test(preto), `${T} sanfona: a cor mostra o nome, o lugar e o livre, e cala o fornecedor quando é o do tecido (${preto})`)
    const etiqueta = await pg.locator(cor('DRYFIT POLIESTER 100% · Preto') + ' .dp-etiqueta .dp-nv').innerText()
    conta(etiqueta === '2', `${T} sanfona: o lugar vem com o quadradinho do nível (D2, nível ${etiqueta})`)
    conta(/Tecidos Exemplo S\.A\./.test(await texto(pg, cor('DRYFIT POLIESTER 100% · Vermelho Fourtime'))), `${T} sanfona: a cor que vem de outro fornecedor diz qual`)
    const pouco = await pg.locator(cor('DRYFIT POLIESTER 100% · Preto') + ' .em-q').getAttribute('class')
    conta(/pouco/.test(pouco) && !/pouco/.test(await pg.locator(cor('DRYFIT POLIESTER 100% · Branco') + ' .em-q').getAttribute('class')), `${T} sanfona: o livre fica vermelho só na cor abaixo do mínimo`)
    await pg.locator('[data-arvore] .em-g[data-grupo="Sem tipo"]').click(); await pausa(pg)
    conta(/falta escolher o fornecedor/.test(await texto(pg, '[data-tecido="HELANCA COLEGIAL"]')), `${T} sanfona: o tecido sem fornecedor diz que falta escolher`)
    await foto('sanfona')

    /* as outras abas */
    await pg.locator('.em-abas').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg)
    const av = await pg.locator('[data-arvore] .em-g').evaluateAll((l) => l.map((e) => e.dataset.grupo + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
    conta(av.join(' | ') === 'Botão | Elástico e cadarço | Etiqueta | Gola | Linha', `${T} sanfona: Aviamentos tem os grupos do cadastro, todos fechados (${av.join(' | ')})`)
    await pg.locator('[data-arvore] .em-g[data-grupo="Gola"]').click(); await pausa(pg)
    const gola = await texto(pg, cor('Gola retilínea piquet marinho'))
    conta(/Malharia Exemplo Ltda/.test(gola) && /40 un/.test(gola) && /A2/.test(gola), `${T} sanfona: o item diz o fornecedor, o lugar e o livre (${gola})`)
    await foto('aviamentos')

    /* a busca troca de aba sozinha */
    await pg.locator('.em-abas').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 200)
    await pg.fill('[data-barra] .em-busca input', 'linha'); await pausa(pg, 500)
    const ligada = await texto(pg, '.em-abas button.ligado')
    const achadas = await pg.locator('[data-arvore] .em-c').count()
    conta(/Aviamentos 2/.test(ligada) && achadas === 2, `${T} sanfona: a busca "linha" leva sozinha para Aviamentos e abre o que achou (${ligada}, ${achadas} itens)`)
    await pg.fill('[data-barra] .em-busca input', 'tecidos exemplo'); await pausa(pg, 500)
    conta(/Tecido 3/.test(await texto(pg, '.em-abas button.ligado')) && await pg.locator('[data-arvore] .em-c').count() === 3, `${T} sanfona: a busca acha pelo nome do fornecedor (3 cores da Tecidos Exemplo)`)
    await pg.fill('[data-barra] .em-busca input', 'xyzxyz'); await pausa(pg, 400)
    conta(/Nada com esse nome nesta aba/.test(await texto(pg, '[data-arvore]')), `${T} sanfona: a busca que não acha nada diz isso`)
    await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 300)
  })

  await caso(`${T} colunas`, async () => {
    const sep = pg.locator('[data-coluna="separacao"]')
    conta(/7 pedidos/.test(await texto(pg, '[data-coluna="separacao"] .em-topo')) && await sep.locator('[data-pedido]').count() === 7, `${T} separação: os 7 pedidos que esperam material`)
    const primeiro = await texto(pg, '[data-pedido="PD-0412"]')
    conta(/Atlético Exemplo/.test(primeiro) && /329 pçs · entrega/.test(primeiro) && /0 de 3/.test(primeiro) && /falta tecido/.test(primeiro), `${T} separação: a linha diz o cliente, as peças, a entrega e "0 de 3 · falta tecido" (${primeiro})`)
    conta(await sep.locator('[aria-expanded]').count() === 0 && await sep.locator('.em-mat').count() === 0 && await sep.getByRole('button', { name: 'Ver no mapa' }).count() === 0, `${T} separação: nenhuma linha abre para baixo, e não há material nem botão dentro da coluna`)
    const linhaAlta = await sep.locator('[data-pedido]').evaluateAll((l) => l.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), tag: e.tagName })))
    conta(linhaAlta.every((x) => x.h >= 56 && x.tag === 'BUTTON'), `${T} separação: cada pedido é um botão da largura da coluna, com pelo menos 56 de altura (${[...new Set(linhaAlta.map((x) => x.h))].join(', ')})`)
    await sep.locator('[data-pedido="PD-0418"]').click(); await pg.waitForSelector('.sp-kpis'); await pausa(pg, 700)
    conta(new URL(pg.url()).pathname === '/separacao' && new URL(pg.url()).searchParams.get('pedido') === D.idDoPedido('PD-0418'), `${T} separação: o clique leva à página Separação com o pedido no endereço (${pg.url().split('/').pop()})`)
    const escolhido = await texto(pg, '.sp-item.escolhido')
    const quadro = await texto(pg, '.sp-quadro .sp-topo')
    conta(/PD-0418/.test(escolhido) && /PD-0418 · Escola Exemplo/.test(quadro) && await pg.locator('[data-passado]').count() === 0, `${T} separação: a Separação abre naquele pedido, e não no primeiro da fila (${escolhido.slice(0, 40)})`)
    await foto('separacao-no-pedido', false)
    await ir(pg, '/estoque', '[data-arvore]')

    /* para comprar */
    const linhas = await pg.locator('[data-coluna="comprar"] .em-lin').evaluateAll((l) => l.map((e) => e.dataset.material))
    conta(linhas.join(' | ') === 'DRYFIT POLIESTER 100% · Preto | PIQUET 100% · Branco | Tinta sublimática magenta | Gola retilínea piquet marinho', `${T} comprar: os 4 abaixo do mínimo, o mais urgente primeiro (${linhas.join(' | ')})`)
    const um = await texto(pg, '[data-coluna="comprar"] .em-lin')
    conta(/tem 3 kg · mínimo 20 kg/.test(um) && /Malharia Exemplo Ltda/.test(um) && /17 kg faltam/.test(um), `${T} comprar: a linha diz o que tem, o mínimo, o fornecedor e quanto falta (${um})`)
    conta(/Para comprar 4 materiais$/.test(await texto(pg, '[data-coluna="comprar"] .em-topo')) && await pg.locator('[data-coluna="comprar"] .em-topo-n').getAttribute('title') === '4 abaixo do mínimo', `${T} comprar: o topo diz quantos estão abaixo do mínimo, na escrita breve da caixa estreita e com a inteira na dica (${await texto(pg, '[data-coluna="comprar"] .em-topo')})`)
    await pg.locator('[data-coluna="comprar"] .em-pe').click(); await pausa(pg, 400)
    conta(await pg.locator('table.tabela tbody tr.es-folha').count() === 4 && /ligado/.test(await pg.locator('.es-chips .chip', { hasText: 'Para comprar' }).getAttribute('class')), `${T} comprar: "Ver mais" abre a tabela só com os 4 para comprar`)
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Lista' }).click(); await pausa(pg, 300)

    /* últimos movimentos */
    const mv = await texto(pg, '[data-coluna="movimentos"] .em-lin')
    conta(/DRYFIT POLIESTER 100% Preto hoje, 14:10 · Separação · pedido PD-0412 -4 kg/.test(mv), `${T} movimentos: a linha diz o material, quando, o motivo, o pedido e quanto (${mv})`)
    await pg.locator('[data-coluna="movimentos"] .em-pe').click(); await pausa(pg, 400)
    conta(/ligado/.test(await pg.locator('[data-barra] > .em-seg button', { hasText: 'Movimentações' }).getAttribute('class')) && await pg.locator('table.tabela tbody tr:not(.grupo)').count() === 17, `${T} movimentos: "Ver mais" leva à aba Movimentações, com os 17`)
    await foto('movimentacoes')
    /* a coluna "Por quê", e o pedido que abre a Separação */
    const cab = (await pg.locator('table.es-tabela thead th').allInnerTexts()).join(' | ')
    conta(cab === 'Hora | Motivo | Material | Quanto | Por quê | Fornecedor | Quem', `${T} movimentos: a tabela tem a coluna "Por quê" no lugar de Pedido e Observação (${cab})`)
    const porques = await pg.locator('table.es-tabela [data-porque]').evaluateAll((l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
    conta(porques[0] === 'pedido PD-0412' && porques.includes('NF 4512') && porques.some((x) => /^pedido PD-0398 sobra do corte$/.test(x)), `${T} movimentos: o "Por quê" diz o pedido, a nota ou o que a pessoa escreveu (${porques.slice(0, 6).join(' ; ')})`)
    conta(porques.every((x) => x !== ''), `${T} movimentos: nenhuma linha fica sem o porquê (${porques.filter((x) => x === '').length} vazias)`)
    const botao = await pg.locator('table.es-tabela .es-pedido').first().evaluate((e) => ({ tag: e.tagName, alto: e.getBoundingClientRect().height, linha: e.closest('tr').getBoundingClientRect().height }))
    conta(botao.tag === 'BUTTON' && botao.alto >= 28 && botao.linha <= 50, `${T} movimentos: o pedido é um botão, e a linha continua com uma altura só (botão ${Math.round(botao.alto)}, linha ${Math.round(botao.linha)})`)
    /* o PD-0410 já saiu da fila: a Separação mostra o registro dele */
    await pg.locator('table.es-tabela .es-pedido', { hasText: 'PD-0410' }).click(); await pg.waitForSelector('[data-passado]'); await pausa(pg, 600)
    const passado = await texto(pg, '[data-passado]')
    conta(new URL(pg.url()).searchParams.get('pedido') === D.idDoPedido('PD-0410') && /O pedido PD-0410 não está mais na fila da Separação/.test(passado) && /PIQUET 100% · Branco/.test(passado) && /9,0 kg/.test(passado), `${T} movimentos: o pedido que já saiu da fila abre a Separação com o registro do que saiu para ele (${passado.slice(0, 110)})`)
    conta(await pg.locator('.sp-item').count() === 7 && await pg.locator('[data-passado] input').count() === 0, `${T} movimentos: o registro é só para ler, e a fila continua embaixo`)
    await foto('separacao-pedido-passado', false)
    await pg.locator('[data-passado]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
    conta(await pg.locator('[data-passado]').count() === 0 && !pg.url().includes('pedido='), `${T} movimentos: Fechar tira o registro e limpa o endereço`)
    /* o que está na fila abre escolhido */
    await ir(pg, '/estoque?aba=razao', 'table.es-tabela')
    await pg.locator('table.es-tabela .es-pedido', { hasText: 'PD-0412' }).first().click(); await pg.waitForSelector('.sp-item.escolhido'); await pausa(pg, 500)
    conta(/PD-0412/.test(await texto(pg, '.sp-item.escolhido')) && await pg.locator('[data-passado]').count() === 0, `${T} movimentos: o pedido que ainda está na fila abre escolhido nela`)
    await ir(pg, '/estoque', '[data-arvore]')
  })

  await caso(`${T} trilho`, async () => {
    const K = await tokens(pg, ['--ink', '--brand-text'])
    conta(await pg.locator('[data-estante]').count() === 0 && await pg.locator('[data-trilho] [aria-expanded]').count() === 0, `${T} trilho: a prateleira em sanfona saiu, e o trilho não tem gaveta nenhuma`)
    const topo = await texto(pg, '[data-trilho] .em-topo')
    conta(/O que está acabando 4 abaixo do mínimo · 2 perto dele · o mais urgente primeiro/.test(topo), `${T} trilho: o topo diz quantos caíram abaixo do mínimo e quantos estão perto (${topo})`)
    const paradas = await pg.locator('[data-trilho] .em-parada').evaluateAll((l) => l.map((e) => ({ nome: e.dataset.parada, comprar: e.classList.contains('comprar'), n: e.querySelector('.em-parada-n').textContent, texto: e.innerText.replace(/\s+/g, ' ').trim(), x: e.getBoundingClientRect().left, y: e.getBoundingClientRect().top })))
    conta(paradas.map((x) => x.nome).join(' | ') === 'DRYFIT POLIESTER 100% · Preto | PIQUET 100% · Branco | Tinta sublimática magenta | Gola retilínea piquet marinho | DRYFIT POLIESTER 100% · Vermelho Fourtime | Tinta DTF branca', `${T} trilho: tecidos e materiais juntos, o que falta mais em proporção ao mínimo primeiro, e depois os que estão perto (${paradas.map((x) => x.nome).join(' | ')})`)
    conta(paradas.map((x) => x.n).join('') === '123456' && paradas.slice(0, 4).every((x) => x.comprar) && paradas.slice(4).every((x) => !x.comprar), `${T} trilho: cada parada tem o número da ordem, e só as 4 abaixo do mínimo ficam em vermelho`)
    conta(paradas.every((x, i) => i === 0 || (x.x > paradas[i - 1].x && igual(x.y, paradas[0].y))), `${T} trilho: uma fileira só, da esquerda para a direita`)
    conta(/^1 3 kg DRYFIT POLIESTER 100% Preto faltam 17 kg$/.test(paradas[0].texto) && /^5 12 kg DRYFIT POLIESTER 100% Vermelho Fourtime mínimo 10 kg$/.test(paradas[4].texto), `${T} trilho: a parada diz o livre, o tecido, a cor e quanto falta; a que está perto diz o mínimo (${paradas[0].texto} ; ${paradas[4].texto})`)
    const vaos = await pg.locator('[data-trilho] .em-parada .es-vao').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(e, '::after').borderTopWidth].join('x') }))
    conta(vaos.length === 6 && vaos.every((v) => v === '52x116x1px'), `${T} trilho: um vão de 52 por 116 em cada parada, com o contorno para o tecido branco não sumir (${[...new Set(vaos)].join(', ')})`)
    const risco = await pg.locator('[data-trilho]').evaluate((c) => {
      const qs = [...c.querySelectorAll('.em-parada-q')].map((e) => e.getBoundingClientRect())
      const resto = c.querySelector('.em-trilho-resto').getBoundingClientRect()
      const faixa = c.querySelector('.em-trilho-faixa').getBoundingClientRect()
      return { emenda: qs.every((q, i) => i === 0 || Math.abs(q.left - qs[i - 1].right) < 0.6), nivel: Math.abs(resto.top - qs[0].top) < 0.6, grosso: [getComputedStyle(c.querySelector('.em-parada-q')).borderTopWidth, resto.height], ate: Math.round(faixa.right - resto.right), cor: getComputedStyle(c.querySelector('.em-parada-q')).borderTopColor }
    })
    conta(risco.emenda && risco.nivel && risco.grosso[0] === '3px' && risco.grosso[1] === 3 && risco.ate <= 14 && risco.cor === K['--ink'], `${T} trilho: o risco de 3 px passa por baixo de todos os vãos sem emenda e continua até a borda da caixa (sobram ${risco.ate} px, ${risco.grosso.join(' e ')})`)
    conta(await pg.locator('[data-trilho] .em-trilho-seta').count() === 0 && (await sobra(pg)) <= 0, `${T} trilho: com 6 paradas não há seta nas pontas, e a página não rola para o lado`)
    await pg.locator('[data-trilho] .em-parada').nth(1).click(); await pausa(pg, 500)
    conta(/PIQUE › PIQUET 100% › cor/.test(await texto(pg, '[data-ficha] .em-trilha')) && await pg.locator(cor('PIQUET 100% · Branco') + '.em-sel').count() === 1, `${T} trilho: o clique numa parada abre a ficha daquela cor, e a árvore abre até ela`)
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
    await pg.locator('[data-arvore] .em-g[data-grupo="PIQUE"]').click(); await pausa(pg, 200)
    await abrirGrupo(pg)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    conta(await pg.locator('[data-ficha="tecido"]').count() === 1, `${T} trilho: de volta à árvore, o nome do tecido abre a ficha dele`)
  })

  await caso(`${T} ficha do tecido`, async () => {
    const K = await tokens(pg, ['--ink', '--brand'])
    await foto('tecido')
    const topo = await texto(pg, '[data-ficha] .em-ficha-topo')
    conta(/DRY DRY FIT › tecido/.test(topo) && /DRYFIT POLIESTER 100%/.test(topo) && /4 cores · 160 g\/m² · 1,60 m de largura/.test(topo), `${T} tecido: a trilha, o nome e as medidas (${topo.slice(0, 90)})`)
    const botoes = await pg.locator('[data-ficha] .em-ficha-topo .btn').allInnerTexts()
    conta(botoes.map((b) => b.trim()).join(' | ') === 'Editar | Registrar movimento | Fechar', `${T} tecido: Editar, Registrar movimento e Fechar (${botoes.map((b) => b.trim()).join(' | ')})`)
    const nums = await pg.locator('[data-ficha] .em-num').allInnerTexts()
    const n = nums.map((x) => x.replace(/\s+/g, ' '))
    conta(/Livre 81 kg nas 4 cores/.test(n[0]) && /Na prateleira 91 kg/.test(n[1]) && /Reservado 10 kg para 3 pedidos/.test(n[2]) && /Para comprar 1 cor Preto, faltam 17 kg/.test(n[3]), `${T} tecido: os quatro números (${n.join(' | ')})`)
    conta(await pg.locator('[data-ficha] .em-cor-col').count() === 4 && await pg.locator('[data-ficha] .em-cor-nova').count() === 1, `${T} tecido: as 4 cores lado a lado, e a caixa de Nova cor`)
    const forn = await texto(pg, '[data-ficha] .em-col:has(.em-fornecedor)')
    conta(/Fornecedor do tecido Malharia Exemplo Ltda/.test(forn) && /Vermelho Fourtime vem de outro fornecedor Tecidos Exemplo S\.A\. só esta cor/.test(forn), `${T} tecido: o fornecedor do tecido, e a cor que vem de outro marcada "só esta cor"`)
    const onde = await texto(pg, '[data-ficha] .em-col:has(.em-planta)')
    conta(/Prateleira D · vão 2 as 4 cores, do nível 1 ao 4/.test(onde) && /Palete P11 Preto/.test(onde), `${T} tecido: "Onde está" lista os lugares, com as cores e os níveis de cada um (${onde.slice(0, 120)})`)
    const acesos = await pg.locator('[data-ficha] .em-planta .dp-lugar.aberto').evaluateAll((l) => l.map((e) => e.dataset.lugar).sort())
    const apagados = await pg.locator('[data-ficha] .em-planta .dp-lugar.apagado').count()
    conta(acesos.join(' ') === 'D2 P11' && apagados === 27, `${T} tecido: na planta miúda só os lugares do tecido ficam acesos (${acesos.join(' ')})`)
    const sel = await pg.locator(DRY).evaluate((e) => getComputedStyle(e).backgroundColor)
    conta(sel === K['--ink'] && await pg.locator('[data-arvore] .em-c').count() === 4, `${T} tecido: na árvore o tecido escolhido fica na tinta do sistema, com as cores abertas`)
    conta(await pg.locator('[data-ficha] .em-col', { hasText: 'O que andou' }).locator('.em-lin').count() === 5 && /Preto hoje, 14:10 · Separação · pedido PD-0412/.test(await texto(pg, '[data-ficha] .em-col:has-text("O que andou") .em-lin')), `${T} tecido: "O que andou" mostra os 5 últimos, com a cor em negrito`)
    conta((await sobra(pg)) <= 0, `${T} tecido: nada rola para o lado`)

    await pg.locator('[data-ficha]').getByRole('button', { name: 'Ver no depósito' }).click(); await pausa(pg, 600)
    conta(await pg.locator('.dp-marcador').count() === 2 && /onde está DRYFIT POLIESTER 100%/.test(await texto(pg, '[data-mapa] .dp-pe')), `${T} tecido: "Ver no depósito" marca os lugares do tecido no mapa`)
    await foto('ver-no-mapa')
    await pg.getByRole('button', { name: 'Tirar os marcadores' }).click(); await pausa(pg, 300)
    conta(await pg.locator('.dp-marcador').count() === 0, `${T} tecido: "Tirar os marcadores" limpa o mapa`)
    await pg.locator('[data-barra]').getByRole('tab', { name: 'Materiais' }).click(); await pausa(pg, 400)
    await abrirGrupo(pg)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 400)
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 400)
    conta(await pg.locator('[data-ficha]').count() === 0 && await pg.locator('[data-coluna]').count() === 3 && await pg.locator('[data-arvore] .em-c').count() === 4, `${T} tecido: Fechar volta para as colunas e deixa a gaveta aberta`)
  })

  await caso(`${T} ficha da cor`, async () => {
    const K = await tokens(pg, ['--ink', '--brand'])
    await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 500)
    await foto('cor')
    const topo = await texto(pg, '[data-ficha] .em-ficha-topo')
    conta(/DRY DRY FIT › DRYFIT POLIESTER 100% › cor/.test(topo) && /Preto comprar/.test(topo), `${T} cor: a trilha até o tecido, o nome e a marca "comprar" (${topo.slice(0, 80)})`)
    const heroi = await texto(pg, '[data-ficha] .em-heroi')
    conta(/Livre, já tirando o que está reservado 3 kg na prateleira 9 kg reservado 6 kg mínimo 20 kg faltam 17 kg/.test(heroi), `${T} cor: o número grande é o livre, com a conta ao lado (${heroi})`)
    const numero = await pg.locator('[data-ficha] .em-heroi-numero').evaluate((e) => ({ t: getComputedStyle(e).fontSize, c: e.className }))
    conta(numero.t === '40px' && /pouco/.test(numero.c), `${T} cor: o livre em 40 px, vermelho por estar abaixo do mínimo`)
    const res = await texto(pg, '[data-ficha] .em-col:has-text("Reservas em aberto")')
    conta(/2 pedidos/.test(res) && /PD-0412/.test(res) && /PD-0418/.test(res), `${T} cor: as reservas em aberto, pedido por pedido`)
    const onde = pg.locator('[data-ficha] .em-col', { hasText: 'Onde está guardado' })
    const tags = await onde.locator('.dp-etiqueta').evaluateAll((l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim() + (e.className.includes('forte') ? '*' : '')))
    conta(tags.length === 2 && /Prateleira D · vão 2.*nível 2\*/.test(tags[0]) && /Palete P11$/.test(tags[1]), `${T} cor: os dois lugares por extenso, o principal em destaque (${tags.join(' | ')})`)
    const achados2 = await onde.locator('.dp-lugar.achado').evaluateAll((l) => l.map((e) => e.dataset.lugar).sort())
    conta(achados2.join(' ') === 'D2 P11', `${T} cor: a planta miúda acende os dois lugares em vermelho`)
    conta(/É o mesmo fornecedor do tecido/.test(await texto(pg, '[data-ficha] .em-col:has(.em-fornecedor)')), `${T} cor: o fornecedor da cor, e que é o mesmo do tecido`)
    const sel = await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).evaluate((e) => getComputedStyle(e).backgroundColor)
    conta(sel === K['--ink'] && await pg.locator('[data-arvore] .em-sel').count() === 1, `${T} cor: na árvore só a cor escolhida fica na tinta`)

    /* mudar o lugar e outro lugar */
    await onde.getByRole('button', { name: 'Mudar o lugar' }).click(); await pausa(pg, 500)
    const lista = await texto(pg, 'dialog[open] .dp-lugares')
    conta(/Prateleira D · vão 2/.test(lista) && /Palete P11/.test(lista) && !/clique no desenho/.test(lista), `${T} cor: "Mudar o lugar" abre a caixa com os dois lugares de hoje`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
    await onde.getByRole('button', { name: 'Outro lugar' }).click(); await pausa(pg, 500)
    conta(/clique no desenho/.test(await texto(pg, 'dialog[open] .dp-lugares')), `${T} cor: "Outro lugar" abre a caixa já pedindo o terceiro lugar`)
    await pg.locator('dialog[open] [data-lugar="P07"]').click(); await pausa(pg, 300)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Marcar aqui' }).click(); await pausa(pg, 600)
    const g = gravados.find((x) => x.u === 'rpc/definir_lugares')
    conta(g && JSON.stringify(g.corpo.p_materiais) === JSON.stringify([id('DRYFIT POLIESTER 100% · Preto')]) && g.corpo.p_lugares.length === 3 && g.corpo.p_lugares[2].movel === 'pal-07', `${T} cor: o lugar novo vai para o banco depois dos dois que já existiam (${JSON.stringify(g?.corpo.p_lugares)})`)

    /* a trilha volta para o tecido, e o clique de novo solta */
    await pg.locator('[data-ficha] .em-trilha-volta').click(); await pausa(pg, 400)
    conta(await pg.locator('[data-ficha="tecido"]').count() === 1, `${T} cor: o nome do tecido na trilha leva à ficha do tecido`)
    await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 300)
    await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 400)
    conta(await pg.locator('[data-ficha]').count() === 0 && await pg.locator('[data-coluna]').count() === 3, `${T} cor: clicar de novo na cor escolhida solta e volta para as colunas`)

    /* escolher pela coluna Para comprar revela na árvore */
    await pg.locator('[data-coluna="comprar"] .em-lin[data-material="Tinta sublimática magenta"]').click(); await pausa(pg, 500)
    const aba = await texto(pg, '.em-abas button.ligado')
    conta(/Insumo/.test(aba) && await pg.locator(cor('Tinta sublimática magenta') + '.em-sel').count() === 1 && /Insumo › Sublimação › item/.test(await texto(pg, '[data-ficha] .em-trilha')), `${T} cor: escolher pela coluna Para comprar troca a aba, abre o grupo e marca o item na árvore`)
    await foto('item')
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
  })

  await caso(`${T} movimento, novo e tabela`, async () => {
    gravados.length = 0
    await pg.locator('.em-abas').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 200)
    if (await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).count() === 0) {
      if (await pg.locator(DRY).count() === 0) { await pg.locator('[data-arvore] .em-g[data-grupo="DRY FIT"]').click(); await pausa(pg, 200) }
      if (await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).count() === 0) { await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 200) }
    }
    await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 400)
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Registrar movimento' }).click(); await pausa(pg, 500)
    await pg.locator('dialog[open] input[inputmode=decimal]').fill('40'); await pausa(pg, 300)
    const folha = await caixa(pg, 'dialog[open] .caixa')
    conta(igual(folha.w, 440) && igual(folha.dir, 1430) && /de 3 kg para 43 kg/.test(await texto(pg, 'dialog[open] .es-antes-depois')), `${T} folha: a gaveta de 440 abre na cor escolhida, e o antes e depois mostra 3 kg virando 43`)
    await foto('folha', false)
    await pg.locator('dialog[open] .fn-gatilho').click(); await pausa(pg)
    await pg.locator('.mn.flutua').getByText('Malharia Exemplo Ltda', { exact: false }).first().click(); await pausa(pg)
    await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 600)
    const mov = gravados.find((g) => String(g.u).includes('rpc/mexer_no_estoque'))
    conta(mov && mov.corpo.p_material === id('DRYFIT POLIESTER 100% · Preto') && mov.corpo.p_quantidade === 40 && mov.corpo.p_motivo === 'entrada', `${T} folha: a entrada grava 40 kg na cor escolhida (${mov ? JSON.stringify(mov.corpo) : 'nada gravado'})`)
    if (await pg.locator('dialog[open]').count()) { await pg.keyboard.press('Escape'); await pausa(pg) }

    /* O MATERIAL NOVO, COM O FORNECEDOR CRIADO AO LADO */
    gravados.length = 0
    await pg.getByRole('button', { name: 'Novo material', exact: true }).first().click(); await pausa(pg, 700)
    const novo = await caixa(pg, 'dialog[open] .caixa')
    conta(igual(novo.w, 560), `${T} novo material: o modal de 560 abre (${Math.round(novo.w)})`)
    const campos = await texto(pg, 'dialog[open] .es-novo-tres')
    conta(/Unidade/.test(campos) && /Mínimo no estoque, em kg/.test(campos) && /quando o livre cai abaixo dele/i.test(await texto(pg, 'dialog[open] .es-novo')), `${T} novo material: o cadastro do tecido tem o campo do mínimo no estoque, e diz para que ele serve (${campos})`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
    /* pela "Nova cor" de um tecido do catálogo, que já abre na malha */
    await pg.locator('.em-abas').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 200)
    await abrirGrupo(pg)
    await pg.locator('[data-arvore] .em-t[data-tecido="DRYFIT JAKAR 100%"] .em-t-nova').click(); await pausa(pg, 700)
    await pg.locator('dialog[open] .es-novo-chips .chip', { hasText: 'Laranja' }).click(); await pausa(pg, 200)
    await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').fill('25'); await pausa(pg, 150)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Novo fornecedor', exact: true }).click(); await pausa(pg, 500)
    const largo = await caixa(pg, 'dialog[open] .caixa')
    const lados = await pg.locator('dialog[open] .es-novo-lados').evaluate((e) => [...e.children].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)] }))
    conta(igual(largo.w, 980) && lados.length === 2 && lados[1][0] > lados[0][1] && await pg.locator('dialog[open]').count() === 1, `${T} novo material: "Novo fornecedor" abre uma coluna ao lado, na mesma caixa, que alarga para 980 (${Math.round(largo.w)}; colunas ${JSON.stringify(lados)})`)
    conta(await pg.locator('dialog[open] .es-novo-chips .chip.ligado', { hasText: 'Laranja' }).count() === 1 && await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').inputValue() === '25' && await pg.locator('dialog[open]').getByRole('button', { name: 'Novo fornecedor', exact: true }).isDisabled(), `${T} novo material: a cor e o mínimo que a pessoa já tinha escolhido continuam lá, com a coluna aberta`)
    const lado = pg.locator('dialog[open] [data-novo-fornecedor]')
    conta(/Entra como fornecedor de tecido/.test(await lado.innerText()) && await lado.getByRole('button', { name: 'Salvar fornecedor' }).isDisabled(), `${T} novo material: a coluna diz que ele entra como fornecedor de tecido, e não salva sem nome e sem CNPJ`)
    await foto('novo-fornecedor-ao-lado', false)
    await lado.getByRole('button', { name: /Ele não tem CNPJ/ }).click(); await pausa(pg, 150)
    await lado.getByPlaceholder('Como a fábrica chama este fornecedor').fill('Malharia de Prova'); await pausa(pg, 150)
    await lado.getByPlaceholder('Nome de quem atende e o número').fill('Vendas'); await pausa(pg, 150)
    await lado.getByRole('button', { name: 'Salvar fornecedor' }).click(); await pausa(pg, 900)
    const criado = gravados.find((g) => /^fornecedor\?/.test(String(g.u)))
    conta(criado && criado.corpo.nome === 'Malharia de Prova' && criado.corpo.entrou_por === 'estoque' && criado.corpo.cnpj === null && gravados.some((g) => String(g.u).startsWith('fornecedor_tipo') && JSON.stringify(g.corpo).includes('"tipo":"tecido"')), `${T} novo material: o fornecedor vai para o banco como "entrou pelo estoque", do tipo tecido (${criado ? JSON.stringify(criado.corpo).slice(0, 110) : 'nada gravado'})`)
    const depois = await caixa(pg, 'dialog[open] .caixa')
    conta(await pg.locator('dialog[open] [data-novo-fornecedor]').count() === 0 && igual(depois.w, 560) && /Malharia de Prova/.test(await texto(pg, 'dialog[open] .fn-gatilho')), `${T} novo material: salvo, a coluna fecha, a caixa volta a 560 e o fornecedor novo já está escolhido (${await texto(pg, 'dialog[open] .fn-gatilho')})`)
    conta(await pg.locator('dialog[open] .es-novo-chips .chip.ligado', { hasText: 'Laranja' }).count() === 1 && await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').inputValue() === '25', `${T} novo material: o cadastro da cor continua de onde parou`)
    await pg.keyboard.press('Escape'); await pausa(pg)

    /* A TABELA NASCE FECHADA */
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
    const faixas = await pg.locator('table.tabela tr[data-faixa]').evaluateAll((l) => l.map((e) => e.dataset.faixa + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
    conta(faixas.join(' | ') === 'Tecido | Aviamento | Insumo' && await pg.locator('table.tabela tbody tr.es-folha').count() === 0 && await pg.locator('table.tabela tr.es-malha').count() === 0, `${T} tabela: abre com as três faixas fechadas, sem malha nem material à vista (${faixas.join(' | ')})`)
    conta(await pg.locator('.es-chips .chip').count() === 5 && (await sobra(pg)) <= 0, `${T} tabela: os chips de filtro só aparecem na tabela`)
    await foto('tabela')
    await pg.locator('table.tabela tr[data-faixa="Tecido"]').click(); await pausa(pg, 300)
    conta(await pg.locator('table.tabela tr.es-malha').count() === 2 && await pg.locator('table.tabela tbody tr.es-folha').count() === 4, `${T} tabela: abrir Tecido mostra as malhas ainda fechadas (e as de uma cor só, que são uma linha) (${await pg.locator('table.tabela tr.es-malha').count()} malhas, ${await pg.locator('table.tabela tbody tr.es-folha').count()} linhas)`)
    await pg.locator('table.tabela tr.es-malha').first().click(); await pausa(pg, 300)
    conta(await pg.locator('table.tabela tbody tr.es-folha').count() > 4, `${T} tabela: abrir a malha mostra as cores dela`)
    await pg.fill('[data-barra] .em-busca input', 'dryfit'); await pausa(pg, 500)
    conta(await pg.locator('table.tabela tbody tr.es-folha').count() === 4 && await pg.locator('table.tabela tr[data-faixa][aria-expanded="true"]').count() === 1, `${T} tabela: com busca, o que sobrou já vem aberto (4 cores do dry fit)`)
    await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 400)
    conta(await pg.locator('table.tabela tbody tr.es-folha').count() === 0, `${T} tabela: tirada a busca, a tabela volta fechada`)
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Lista' }).click(); await pausa(pg, 300)
    conta(await pg.locator('.es-chips').count() === 0 && await pg.locator('[data-coluna]').count() === 3, `${T} tabela: de volta à lista, os chips somem e as colunas voltam`)
  })

  conta(erros.length === 0, `${T}: nenhum erro de JavaScript em 1440 (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
}

/* ==========================================================================
   2. QUEM SÓ LÊ, E A PÁGINA DE PÉ SEM O APOIO
   ========================================================================== */
await caso('quem só lê', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', papel: 'vendedor' })
  await ir(pg, '/estoque', '[data-arvore]')
  conta(await pg.getByRole('button', { name: 'Registrar movimento' }).count() === 0 && await pg.getByRole('button', { name: 'Novo material' }).count() === 0, 'quem só lê: não vê Registrar movimento nem Novo material no topo')
  await abrirGrupo(pg)
  await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 400)
  const botoes = await pg.locator('[data-ficha] .em-ficha-topo .btn').allInnerTexts()
  conta(botoes.map((b) => b.trim()).join('|') === 'Fechar' && await pg.locator('[data-ficha] .em-cor-nova').count() === 0, `quem só lê: a ficha do tecido só tem Fechar (${botoes.map((b) => b.trim()).join('|')})`)
  await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 400)
  conta(await pg.locator('[data-ficha]').getByRole('button', { name: 'Mudar o lugar' }).count() === 0 && await pg.locator('[data-ficha]').getByRole('button', { name: 'Ver no depósito' }).count() === 1, 'quem só lê: vê onde a cor está, sem o botão de mudar o lugar')
  await pg.screenshot({ path: `${PASTA}/so-le-1440-light.png`, fullPage: true })
  conta(erros.length === 0, `quem só lê: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

await caso('sem o apoio', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', estoque: 'sem-apoio', deposito: 'erro' })
  await ir(pg, '/estoque', '[data-arvore]')
  const grupos = await pg.locator('[data-arvore] .em-g').evaluateAll((l) => l.map((e) => e.dataset.grupo))
  conta(grupos.length >= 1 && await pg.locator('[data-arvore]').count() === 1, `sem o apoio: se o catálogo não lê, a árvore continua de pé (${grupos.join(' | ')})`)
  conta(/Nenhum pedido esperando material/.test(await texto(pg, '[data-coluna="separacao"]')), 'sem o apoio: se a fila da separação não lê, a coluna fica vazia e a página não cai')
  await pg.locator('[data-arvore] .em-g').first().click().catch(() => {}); await pausa(pg, 200)
  if (await pg.locator('[data-arvore] .em-t').count() === 0) { await pg.locator('[data-arvore] .em-g').first().click(); await pausa(pg, 200) }
  await pg.locator('[data-arvore] .em-t-seta').first().click(); await pausa(pg, 300)
  conta(await pg.locator('[data-arvore] .em-c .dp-etiqueta').count() === 0, 'sem o apoio: sem o depósito lido, a linha da cor não inventa "sem lugar"')
  await pg.screenshot({ path: `${PASTA}/sem-apoio-1440-light.png`, fullPage: true })
  conta(erros.length === 0, `sem o apoio: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* O CATÁLOGO INTEIRO NA ÁRVORE (pedido do Henrique, 04/10/2026): os grupos e os
   tecidos do catálogo aparecem mesmo sem nada no estoque; a cor, não. */
const SEM = (nome) => `[data-arvore] .em-t[data-tecido="${nome}"]`
await caso('catálogo inteiro', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque', '[data-arvore]')
  const T = 'catálogo inteiro'
  const K = await tokens(pg, ['--text-2', '--ink', '--surface'])
  const vis = await texto(pg, '[data-arvore] .em-g[data-grupo="VISCOSE"]')
  const dry = await texto(pg, '[data-arvore] .em-g[data-grupo="DRY FIT"]')
  conta(/VIS VISCOSE 2 tecidos · sem estoque/.test(vis) && /DRY DRY FIT 2 tecidos · 4 cores/.test(dry), `${T}: o grupo sem estoque diz "sem estoque", e o que tem conta também o tecido vazio (${vis} | ${dry})`)
  conta(/Tecido 10/.test(await texto(pg, '.em-abas')), `${T}: a conta da aba continua sendo a dos materiais (${(await texto(pg, '.em-abas')).slice(0, 30)})`)
  await abrirGrupo(pg)
  const doDry = await pg.locator('[data-arvore] .em-gaveta:has(.em-g[data-grupo="DRY FIT"]) .em-t').evaluateAll((l) => l.map((e) => e.dataset.tecido))
  conta(doDry.join(' | ') === 'DRYFIT POLIESTER 100% | DRYFIT JAKAR 100%', `${T}: dentro do grupo vem primeiro o tecido que tem estoque, e depois o vazio, mesmo ele sendo o primeiro do catálogo (${doDry.join(' | ')})`)
  const linha = await pg.locator(SEM('DRYFIT JAKAR 100%')).evaluate((e) => {
    const b = e.querySelector('.em-nomes b'); const cs = getComputedStyle(b); const nova = e.querySelector('.em-t-nova'); const r = e.getBoundingClientRect(); const n = nova.getBoundingClientRect()
    return { sem: e.hasAttribute('data-sem-estoque'), texto: e.innerText.replace(/\s+/g, ' ').trim(), setas: e.querySelectorAll('button.em-t-seta').length, cor: cs.color, peso: cs.fontWeight, alto: r.height, botao: n.height, dentro: n.right <= r.right - 13.5 && n.top >= r.top && n.bottom <= r.bottom, recuo: e.querySelector('.em-t-nome').getBoundingClientRect().left - r.left }
  })
  conta(linha.sem && linha.texto === 'DRYFIT JAKAR 100% sem estoque Nova cor' && linha.setas === 0, `${T}: o tecido vazio diz "sem estoque", tem o atalho Nova cor e não tem seta para abrir (${linha.texto}; ${linha.setas} setas)`)
  conta(linha.cor === K['--text-2'] && linha.peso === '500', `${T}: o nome do tecido vazio vem apagado, no tom do texto de apoio e sem negrito (${linha.cor}, peso ${linha.peso})`)
  const recuoDoCheio = await pg.locator(`${DRY}`).evaluate((e) => e.querySelector('.em-t-nome').getBoundingClientRect().left - e.getBoundingClientRect().left)
  conta(linha.alto >= 52 && linha.botao === 34 && linha.dentro && igual(linha.recuo, recuoDoCheio), `${T}: a linha tem a altura das outras, o botão de 34 cabe dentro dela, e o nome começa onde o dos outros tecidos começa (${Math.round(linha.alto)}, ${linha.botao}, recuo ${Math.round(linha.recuo)} e ${Math.round(recuoDoCheio)})`)
  await pg.locator('[data-arvore] .em-g[data-grupo="ALGODÃO"]').click(); await pausa(pg, 300)
  const doAlg = await pg.locator('[data-arvore] .em-gaveta:has(.em-g[data-grupo="ALGODÃO"]) .em-t').evaluateAll((l) => l.map((e) => e.dataset.tecido))
  conta(doAlg.length === 2 && !doAlg.includes('ALGODAO DESLIGADO') && await pg.getByText('ALGODAO DESLIGADO').count() === 0, `${T}: o tecido desligado no catálogo não aparece no grupo aberto (${doAlg.join(' | ')})`)

  /* o trilho é só do que tem estoque: tecido vazio não tem o que acabar */
  conta(await pg.locator('[data-trilho] .em-parada').count() === 6 && await pg.locator('[data-trilho] [data-parada*="JAKAR"]').count() === 0, `${T}: o tecido sem estoque não entra no trilho do que está acabando`)

  /* a ficha do tecido vazio */
  await pg.locator(`${SEM('DRYFIT JAKAR 100%')} .em-t-nome`).click(); await pausa(pg, 500)
  const ficha = await texto(pg, '[data-ficha="tecido"]')
  const botoes = (await pg.locator('[data-ficha] .em-ficha-topo .btn').allInnerTexts()).map((b) => b.trim()).join('|')
  conta(await pg.locator('[data-ficha="tecido"][data-sem-estoque]').count() === 1 && /DRY FIT › tecido DRYFIT JAKAR 100% sem estoque/.test(ficha) && /nenhuma cor dele foi cadastrada no estoque/.test(ficha), `${T}: o nome abre a ficha, que diz que o tecido é do catálogo e não tem cor no estoque (${ficha.slice(0, 90)})`)
  conta(botoes === 'Nova cor|Fechar' && await pg.locator('[data-ficha] .em-nums').count() === 0 && await pg.locator('[data-ficha] .em-cor-nova').count() === 1, `${T}: a ficha vazia tem Nova cor e Fechar, sem Editar, sem Registrar movimento e sem os quatro números (${botoes})`)
  const sel = await pg.locator(`${SEM('DRYFIT JAKAR 100%')}`).evaluate((e) => ({ c: e.className, f: getComputedStyle(e).backgroundColor }))
  conta(/em-sel/.test(sel.c) && sel.f === K['--ink'], `${T}: o tecido vazio escolhido fica marcado na árvore como os outros`)
  await pg.screenshot({ path: `${PASTA}/sem-estoque-1440-light.png`, fullPage: true })
  await pg.locator(`${SEM('DRYFIT JAKAR 100%')} .em-t-nome`).click(); await pausa(pg, 400)
  conta(await pg.locator('[data-ficha]').count() === 0, `${T}: clicar de novo no tecido vazio escolhido solta`)

  /* a medida do catálogo aparece mesmo sem estoque */
  await pg.locator('[data-arvore] .em-g[data-grupo="PIQUE"]').click(); await pausa(pg, 250)
  await pg.locator(`${SEM('PIQUET MISTO')} .em-t-nome`).click(); await pausa(pg, 500)
  conta(/PIQUET MISTO sem estoque · 200 g\/m² · 1,20 m de largura/.test(await texto(pg, '[data-ficha="tecido"]')), `${T}: a gramatura e a largura do catálogo aparecem na ficha vazia (${(await texto(pg, '[data-ficha="tecido"]')).slice(0, 80)})`)
  await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)

  /* Nova cor abre o cadastro já no tecido, e grava nele */
  await pg.locator(`${SEM('DRYFIT JAKAR 100%')} .em-t-nova`).click(); await pausa(pg, 700)
  const modal = await texto(pg, 'dialog[open] .caixa')
  conta(/Malha[^]*DRYFIT JAKAR 100%/.test(modal) && await pg.locator('dialog[open] .es-ja-tem').count() === 0, `${T}: Nova cor abre o cadastro com a malha já escolhida e nenhuma cor apagada (${modal.slice(0, 80)})`)
  await pg.locator('dialog[open] .es-novo-chips .chip').first().click(); await pausa(pg, 200)
  await pg.locator('dialog[open] .btn-primario').click(); await pausa(pg, 800)
  const criado = gravados.find((x) => /^material(\?|$)/.test(x.u))
  conta(criado && JSON.stringify(criado.corpo).includes('"tecido_id":"ts1"'), `${T}: a cor nova vai para o banco apontando para o tecido do catálogo (${criado ? JSON.stringify(criado.corpo).slice(0, 120) : 'nada gravado'})`)
  if (await pg.locator('dialog[open]').count()) { await pg.keyboard.press('Escape'); await pausa(pg) }
  if (await pg.locator('[data-ficha]').count()) { await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300) }

  /* a busca acha o tecido do catálogo pelo nome e pelo grupo */
  const busca = pg.locator('[data-barra] input[type="search"], [data-barra] input').first()
  await busca.fill('viscose'); await pausa(pg, 500)
  const achou = await pg.locator('[data-arvore] .em-t').evaluateAll((l) => l.map((e) => e.dataset.tecido))
  conta(achou.join(' | ') === 'VISCOSE PV ANTIPILING | VISCOSE COM ELASTANO PROTEÇÃO UV50' && await pg.locator('[data-arvore] .em-g').count() === 1, `${T}: a busca por "viscose" traz os dois tecidos do catálogo, já abertos, e só o grupo deles (${achou.join(' | ')})`)
  await busca.fill('dry fit'); await pausa(pg, 500)
  const comEspaco = await pg.locator('[data-arvore] .em-t').evaluateAll((l) => l.map((e) => e.dataset.tecido))
  conta(comEspaco.join(' | ') === 'DRYFIT POLIESTER 100% | DRYFIT JAKAR 100%' && await pg.locator('[data-arvore] .em-c').count() === 4, `${T}: a busca pelo nome do grupo ("dry fit", com espaço) traz o tecido com estoque, com as 4 cores, e o vazio (${comEspaco.join(' | ')})`)
  await busca.fill('preto'); await pausa(pg, 500)
  conta(await pg.locator('[data-arvore] .em-t[data-sem-estoque]').count() === 0 && await pg.locator('[data-arvore] .em-c').count() > 0, `${T}: a busca por uma cor não traz tecido vazio`)
  await busca.fill(''); await pausa(pg, 300)
  await pg.locator('.em-abas').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg, 300)
  await busca.fill('viscose'); await pausa(pg, 600)
  conta(/Tecido/.test(await texto(pg, '.em-abas button.ligado')) && await pg.locator('[data-arvore] .em-t').count() === 2, `${T}: procurar "viscose" na aba Aviamentos leva para a aba Tecido`)
  await busca.fill(''); await pausa(pg, 300)
  conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

await caso('catálogo inteiro, quem só lê', async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1440, altura: 900, tema: 'dark', papel: 'vendedor' })
  await ir(pg, '/estoque', '[data-arvore]')
  const T = 'catálogo inteiro, quem só lê'
  await abrirGrupo(pg)
  conta(await pg.locator(SEM('DRYFIT JAKAR 100%')).count() === 1 && await pg.locator('[data-arvore] .em-t-nova').count() === 0, `${T}: vê o tecido vazio, sem o atalho Nova cor`)
  await pg.locator(`${SEM('DRYFIT JAKAR 100%')} .em-t-nome`).click(); await pausa(pg, 500)
  const botoes = (await pg.locator('[data-ficha] .em-ficha-topo .btn').allInnerTexts()).map((b) => b.trim()).join('|')
  conta(botoes === 'Fechar' && await pg.locator('[data-ficha] .em-cor-nova').count() === 0, `${T}: a ficha vazia só tem Fechar (${botoes})`)
  await pg.screenshot({ path: `${PASTA}/sem-estoque-so-le-1440-dark.png`, fullPage: true })
  await ctx.close()
})

for (const [largura, altura] of [[820, 1180], [390, 844]]) {
  await caso(`catálogo inteiro ${largura}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema: 'light' })
    await ir(pg, '/estoque', '[data-arvore]')
    const T = `catálogo inteiro em ${largura}`
    await pg.locator('[data-arvore] .em-g[data-grupo="VISCOSE"]').click(); await pausa(pg, 300)
    const m = await pg.locator(SEM('VISCOSE PV ANTIPILING')).evaluate((e) => {
      const r = e.getBoundingClientRect(); const n = e.querySelector('.em-t-nova').getBoundingClientRect(); const b = e.querySelector('.em-nomes b')
      return { dentro: n.right <= r.right && n.left >= r.left, alto: r.height, botao: n.height, nome: b.getBoundingClientRect().width, cortado: b.scrollWidth > b.clientWidth }
    })
    conta(m.dentro && m.alto >= 48 && m.nome > 90 && (await sobra(pg)) <= 0, `${T}: a linha do tecido vazio cabe, com o botão dentro e o nome legível, sem rolar para o lado (linha ${Math.round(m.alto)}, botão ${Math.round(m.botao)}, nome com ${Math.round(m.nome)} px${m.cortado ? ', com reticências' : ''})`)
    const longo = await pg.locator(`${SEM('VISCOSE COM ELASTANO PROTEÇÃO UV50')} .em-nomes b`).evaluate((b) => ({ cortado: b.scrollWidth > b.clientWidth + 0.5, alto: b.getBoundingClientRect().height }))
    conta(!longo.cortado, `${T}: o nome comprido do catálogo aparece inteiro, quebrando de linha em vez de ganhar reticências (${Math.round(longo.alto)} de altura)`)
    await pg.screenshot({ path: `${PASTA}/sem-estoque-arvore-${largura}-light.png`, fullPage: true })
    await pg.locator(`${SEM('VISCOSE PV ANTIPILING')} .em-t-nome`).click(); await pausa(pg, 500)
    if (largura < 768) {
      const topo = await texto(pg, '.pagina-topo')
      conta(/VISCOSE PV ANTIPILING/.test(topo) && /sem estoque/.test(topo) && await pg.locator('.es-volta').count() === 1, `${T}: a ficha do tecido vazio toma a página, com o nome, "sem estoque" e a volta no topo (${topo.slice(0, 80)})`)
    }
    conta(await pg.locator('[data-ficha="tecido"][data-sem-estoque]').count() === 1 && (await sobra(pg)) <= 0, `${T}: a ficha vazia abre e nada rola para o lado`)
    await pg.screenshot({ path: `${PASTA}/sem-estoque-ficha-${largura}-light.png`, fullPage: true })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* o trilho quando não há o que avisar: diz por quê, e não fica uma caixa vazia */
for (const [estoque, frase, nome] of [['folgado', /Nada abaixo do mínimo nem perto dele\./, 'tudo acima do mínimo'], ['sem-minimo', /Nenhum material tem a quantidade mínima marcada/, 'nenhum mínimo marcado']]) {
  await caso(`trilho vazio, ${nome}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', estoque })
    await ir(pg, '/estoque', '[data-arvore]')
    const t = await texto(pg, '[data-trilho]')
    conta(frase.test(t) && await pg.locator('[data-trilho] .em-parada').count() === 0 && await pg.locator('[data-trilho] .em-trilho-seta').count() === 0, `trilho vazio, ${nome}: a caixa explica em vez de ficar vazia (${t})`)
    conta(/Para comprar/.test(await texto(pg, '[data-coluna="comprar"]')) && await pg.locator('[data-coluna="comprar"] .em-lin').count() === 0, `trilho vazio, ${nome}: a coluna Para comprar também fica sem linhas`)
    await pg.screenshot({ path: `${PASTA}/trilho-vazio-${estoque}-1440-light.png`, fullPage: true })
    conta(erros.length === 0, `trilho vazio, ${nome}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* um tecido de trinta cores e um grupo com seis tecidos: nada estoura */
for (const [largura, altura] of [[1440, 900], [390, 844]]) {
  await caso(`estoque grande ${largura}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema: 'light', estoque: 'grande' })
    await ir(pg, '/estoque', '[data-arvore]')
    const T = `estoque grande em ${largura}`
    conta(/Tecido 66/.test(await texto(pg, '.em-abas')), `${T}: 66 tecidos na aba (${(await texto(pg, '.em-abas')).slice(0, 40)})`)
    /* o trilho com 26 paradas: anda de lado dentro da caixa, e a página não */
    const faixa = pg.locator('[data-trilho] .em-trilho-faixa')
    const antes = await faixa.evaluate((e) => ({ n: e.querySelectorAll('.em-parada').length, cabe: e.scrollWidth <= e.clientWidth, x: e.scrollLeft, foco: e.tabIndex, barra: getComputedStyle(e).scrollbarWidth, sobra: e.offsetHeight - e.clientHeight }))
    conta(antes.n === 26 && !antes.cabe && antes.x === 0 && antes.foco === 0 && antes.barra === 'none' && antes.sobra === 0, `${T}: as 26 paradas não cabem, e o trilho rola por dentro, sem barra à vista e alcançável pelo teclado (${antes.n} paradas)`)
    conta(await pg.locator('[data-trilho] .em-trilho-seta.depois').count() === 1 && await pg.locator('[data-trilho] .em-trilho-seta.antes').count() === 0, `${T}: no começo só existe a seta de avançar`)
    await pg.locator('[data-trilho] .em-trilho-seta.depois').click(); await pausa(pg, 700)
    const andou = await faixa.evaluate((e) => e.scrollLeft)
    conta(andou > 100 && await pg.locator('[data-trilho] .em-trilho-seta.antes').count() === 1 && await pg.evaluate(() => scrollX) === 0, `${T}: a seta anda o trilho (${Math.round(andou)} px), a de voltar aparece, e a página não sai do lugar`)
    await faixa.evaluate((e) => { e.scrollLeft = e.scrollWidth }); await pausa(pg, 400)
    conta(await pg.locator('[data-trilho] .em-trilho-seta.depois').count() === 0, `${T}: no fim do trilho a seta de avançar some`)
    await faixa.evaluate((e) => { e.scrollLeft = 0 }); await pausa(pg, 300)
    await abrirGrupo(pg)
    const doGrupo = await pg.locator('[data-arvore] .em-gaveta:has(.em-g[data-grupo="DRY FIT"]) .em-t').count()
    conta(doGrupo === 7, `${T}: o grupo aberto mostra os 6 tecidos com estoque e o do catálogo (${doGrupo})`)
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    const ficha = await caixa(pg, '[data-ficha]')
    const cores = await pg.locator('[data-ficha] .em-cor-col').evaluateAll((l) => Math.max(...l.map((e) => e.getBoundingClientRect().right)))
    conta(await pg.locator('[data-ficha] .em-cor-col').count() === 30 && cores <= ficha.dir + 0.5 && (await sobra(pg)) <= 0, `${T}: a ficha do tecido mostra as 30 cores em grade, sem rolar para o lado`)
    await pg.screenshot({ path: `${PASTA}/grande-${largura}-light.png`, fullPage: true })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* o topo das três caixas baixas: a conta nunca encosta na borda. Achado no dia
   04/10/2026: "16 abaixo do mínimo" passava do recheio da caixa em 1440 */
for (const [largura, espera] of [[1366, /^16 materiais$/], [1440, /^16 materiais$/], [1536, /^16 abaixo do mínimo$/], [1680, /^16 abaixo do mínimo$/]]) {
  await caso(`topo das caixas ${largura}`, async () => {
    const { ctx, pg } = await abrir(nav, { largura, altura: 900, tema: 'light', estoque: 'grande' })
    await ir(pg, '/estoque', '[data-arvore]')
    const m = await pg.locator('.em-quatro > .em-curta .em-topo').evaluateAll((l) => l.map((t) => {
      const fim = t.lastElementChild.getBoundingClientRect().right
      const c = t.getBoundingClientRect(); const cs = getComputedStyle(t)
      return { sobra: fim - (c.right - parseFloat(cs.paddingRight)), alto: c.height }
    }))
    const conta_ = await texto(pg, '[data-coluna="comprar"] .em-topo-n')
    conta(m.length === 3 && m.every((x) => x.sobra <= 0.5), `topo das caixas em ${largura}: nenhuma conta passa do recheio do topo (${m.map((x) => Math.round(x.sobra)).join(', ')})`)
    conta(m.every((x) => igual(x.alto, m[0].alto)), `topo das caixas em ${largura}: os três topos têm a mesma altura (${m.map((x) => Math.round(x.alto)).join(', ')})`)
    conta(espera.test(conta_), `topo das caixas em ${largura}: a conta do para comprar aparece na escrita que cabe (${conta_})`)
    await ctx.close()
  })
}

/* a árvore aberta fica mais comprida que as caixas do lado: a sobra de altura
   desce para a última fileira, e não abre um buraco entre as caixas baixas e o
   trilho. Achado no dia 04/10/2026 com o estoque de verdade (34 cores de
   dry fit abertas na árvore empurravam a prateleira 160 px para baixo) */
for (const [largura, altura] of [[1440, 900], [820, 1180]]) {
  await caso(`árvore comprida ${largura}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema: 'light', estoque: 'grande' })
    await ir(pg, '/estoque', '[data-arvore]')
    const T = `árvore comprida em ${largura}`
    if (await pg.locator(DRY).count() === 0) { await pg.locator('[data-arvore] .em-g[data-grupo="DRY FIT"]').click(); await pausa(pg, 250) }
    if (await pg.locator('[data-arvore] .em-c').count() === 0) { await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 350) }
    const arvore = await caixa(pg, '[data-arvore]')
    const baixas = await pg.locator('.em-quatro > .em-curta').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return { y: r.top, baixo: r.bottom } }))
    const est = await caixa(pg, '[data-trilho]')
    conta(await pg.locator('[data-arvore] .em-c').count() === 30 && arvore.h > 1300, `${T}: a árvore está aberta nas 30 cores e é a peça mais comprida da página (${Math.round(arvore.h)} de altura)`)
    if (largura >= 1440) {
      conta(igual(est.y - baixas[0].baixo, 16, 1), `${T}: o trilho fica 16 px abaixo das três caixas, sem buraco (${Math.round(est.y - baixas[0].baixo)})`)
    } else {
      const vaos = [baixas[1].y - baixas[0].baixo, baixas[2].y - baixas[1].baixo]
      conta(vaos.every((v) => igual(v, 16, 1)), `${T}: as três caixas empilhadas ficam a 16 px uma da outra, sem buraco (${vaos.map(Math.round).join(' e ')})`)
    }
    await pg.screenshot({ path: `${PASTA}/arvore-comprida-${largura}-light.png`, fullPage: true })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* ==========================================================================
   3. O TABLET E O CELULAR
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  await caso(`tablet ${tema}`, async () => {
    const T = `tablet ${tema === 'light' ? 'gelo' : 'grafite'}`
    const { ctx, pg, erros } = await abrir(nav, { largura: 820, altura: 1180, tema })
    await ir(pg, '/estoque', '[data-arvore]')
    await pg.screenshot({ path: `${PASTA}/geral-820-${tema}.png`, fullPage: true })
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
    const arvore = await caixa(pg, '[data-arvore]'); const sep = await caixa(pg, '[data-coluna="separacao"]'); const comp = await caixa(pg, '[data-coluna="comprar"]'); const est = await caixa(pg, '[data-trilho]')
    conta(igual(sep.y, arvore.y) && sep.x > arvore.dir && igual(comp.x, sep.x) && comp.y > sep.baixo, `${T}: a árvore de um lado e as três caixas empilhadas do outro`)
    conta(igual(est.x, arvore.x) && igual(est.dir, sep.dir) && est.y > arvore.baixo, `${T}: o trilho embaixo, na largura inteira`)
    conta(await pg.locator('[data-barra] > .em-seg').count() === 1 && await pg.locator('[data-barra] .em-barra-fim').count() === 0, `${T}: as três abas continuam, e a tabela não é oferecida`)
    await abrirGrupo(pg)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    const ficha = await caixa(pg, '[data-ficha]')
    conta(ficha.x > arvore.dir && (await sobra(pg)) <= 0 && await pg.locator('.es-volta').count() === 0, `${T}: a ficha abre ao lado da árvore, sem rolar para o lado`)
    await pg.screenshot({ path: `${PASTA}/tecido-820-${tema}.png`, fullPage: true })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })

  await caso(`celular ${tema}`, async () => {
    const T = `celular ${tema === 'light' ? 'gelo' : 'grafite'}`
    const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema })
    const foto = (n, inteira = true) => pg.screenshot({ path: `${PASTA}/${n}-390-${tema}.png`, fullPage: inteira })
    await ir(pg, '/estoque', '[data-arvore]')
    await foto('geral')
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)
    const chips = await pg.locator('.em-secoes .chip').allInnerTexts()
    conta(chips.map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ') === 'Materiais | Separação 7 | Comprar 4 | Movimentos | Depósito', `${T}: os cinco assuntos viram chips, com a conta (${chips.map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ')})`)
    conta(await pg.locator('[data-coluna]').count() === 0 && await pg.locator('[data-trilho]').count() === 1, `${T}: em Materiais ficam a sanfona e o trilho; as colunas viram telas`)
    const tr = await pg.locator('[data-trilho] .em-trilho-faixa').evaluate((e) => ({ rola: e.scrollWidth > e.clientWidth, dentro: e.getBoundingClientRect().right <= innerWidth }))
    conta(tr.rola && tr.dentro && (await sobra(pg)) <= 0, `${T}: no celular o trilho anda de lado dentro da caixa, e a página não`)
    await abrirGrupo(pg)
    const alturas = await pg.locator('[data-arvore] .em-g, [data-arvore] .em-t').evaluateAll((l) => Math.min(...l.map((e) => e.getBoundingClientRect().height)))
    conta(alturas >= 48, `${T}: linha da sanfona com ${alturas} de altura para o dedo`)
    await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 300)
    const linha = await caixa(pg, cor('DRYFIT POLIESTER 100% · Preto'))
    const partes = await pg.locator(cor('DRYFIT POLIESTER 100% · Vermelho Fourtime')).evaluate((e) => { const r = e.getBoundingClientRect(); return [...e.children].every((c) => { const k = c.getBoundingClientRect(); return k.left >= r.left - 0.5 && k.right <= r.right + 0.5 }) })
    conta(linha.h >= 44 && partes && (await sobra(pg)) <= 0, `${T}: a linha da cor cabe na tela, com o lugar, a barra e o livre (${Math.round(linha.h)} de altura)`)
    await foto('sanfona')

    await pg.locator('.em-secoes .chip', { hasText: 'Separação' }).click(); await pausa(pg, 500)
    conta(await pg.locator('[data-coluna="separacao"] [data-pedido]').count() === 7 && await pg.locator('[data-coluna="separacao"].em-curta').count() === 0 && await pg.locator('[data-barra] .em-busca').count() === 0, `${T}: Separação é uma tela, com a lista inteira e sem a busca`)
    const toque = await pg.locator('[data-coluna="separacao"] [data-pedido]').first().evaluate((e) => ({ tag: e.tagName, alto: e.getBoundingClientRect().height }))
    conta(toque.tag === 'BUTTON' && toque.alto >= 56 && await pg.locator('[data-coluna="separacao"] [aria-expanded]').count() === 0, `${T}: cada pedido é uma linha inteira para o dedo, sem abrir para baixo (${Math.round(toque.alto)} de altura)`)
    await foto('separacao')
    await pg.locator('.em-secoes .chip', { hasText: 'Comprar' }).click(); await pausa(pg, 400)
    conta(await pg.locator('[data-coluna="comprar"] .em-lin').count() === 4 && await pg.locator('[data-coluna="comprar"] .em-pe').count() === 0, `${T}: Comprar é uma tela, com os 4, sem "Ver mais"`)
    await foto('comprar')

    /* a ficha toma a página */
    await pg.locator('[data-coluna="comprar"] .em-lin').first().click(); await pausa(pg, 500)
    conta(await pg.locator('[data-ficha="material"]').count() === 1 && await pg.locator('.es-volta').count() === 1 && await pg.locator('[data-arvore]').count() === 0 && await pg.locator('.em-secoes').count() === 0, `${T}: a ficha toma a página, com a volta no topo`)
    conta((await texto(pg, '.pagina-topo h1')) === 'Preto' && await pg.locator('[data-ficha] h2').count() === 0 && await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).count() === 0, `${T}: o nome vai para o título da página, e a ficha não repete nem o nome nem o Fechar`)
    conta((await sobra(pg)) <= 0, `${T}: com a ficha aberta, nada rola para o lado`)
    await pg.evaluate(() => scrollTo(0, 0)); await foto('cor')
    await pg.locator('.es-volta').click(); await pausa(pg, 400)
    conta(await pg.locator('[data-arvore]').count() === 1 && await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).count() === 1, `${T}: a volta devolve a sanfona, aberta na cor que foi vista`)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    conta(await pg.locator('[data-ficha="tecido"]').count() === 1 && (await sobra(pg)) <= 0, `${T}: a ficha do tecido cabe na tela`)
    await pg.evaluate(() => scrollTo(0, 0)); await foto('tecido')
    await pg.locator('.es-volta').click(); await pausa(pg, 300)
    await pg.locator('.em-secoes .chip', { hasText: 'Movimentos' }).click(); await pausa(pg, 400)
    conta((await sobra(pg)) <= 0 && await pg.locator('.es-quadro').count() === 1, `${T}: Movimentos é a lista das movimentações, sem rolar para o lado`)
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* ==========================================================================
   4. AS ANIMAÇÕES
   ========================================================================== */
const lerAnimacao = (pg, seletor) => pg.evaluate((seletor) => {
  const e = document.querySelector(seletor)
  if (!e) return null
  const a = e.getAnimations().find((x) => x.animationName)
  if (!a) return { nome: '' }
  const t = a.effect.getComputedTiming()
  const mexe = [...new Set(a.effect.getKeyframes().flatMap((q) => Object.keys(q)))].filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)).sort()
  const mede = () => { const r = e.getBoundingClientRect(); return { opacidade: Number(getComputedStyle(e).opacity), topo: r.top, altura: r.height } }
  a.pause(); a.currentTime = t.duration / 2
  const meio = mede()
  a.finish()
  return { nome: a.animationName, duracao: t.duration, vezes: t.iterations, mexe, meio, fim: mede() }
}, seletor)
const lerTransicao = (pg, seletor) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { o_que: c.transitionProperty, quanto: c.transitionDuration } }, seletor)

for (const movimento of [true, false]) {
  await caso(movimento ? 'animações' : 'movimento reduzido', async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', movimento })
    await ir(pg, '/estoque', '[data-arvore]')
    /* a gaveta do tecido */
    await abrirGrupo(pg); await pausa(pg, 300)
    await pg.locator(`${DRY} .em-t-seta`).click()
    const gaveta = await lerAnimacao(pg, '[data-arvore] .em-cores.em-dentro')
    const seta = await lerTransicao(pg, `${DRY} .em-seta`)
    await pausa(pg, 400)
    const giro = await pg.locator(`${DRY} .em-seta`).evaluate((e) => getComputedStyle(e).transform)
    /* a ficha, e o tecido subindo no vão das cores dela */
    await pg.locator(`${DRY} .em-t-nome`).click()
    const ficha = await lerAnimacao(pg, '[data-ficha]')
    const vao = await lerAnimacao(pg, '[data-ficha] .em-grade-cores .es-vao-tecido')
    const linhas = [await lerTransicao(pg, '[data-arvore] .em-g'), await lerTransicao(pg, '[data-arvore] .em-c'), await lerTransicao(pg, `${DRY}`)]
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
    const pe = await lerTransicao(pg, '.em-pe')

    if (movimento) {
      conta(gaveta?.nome === 'em-abre' && gaveta.duracao === 200 && gaveta.vezes === 1 && gaveta.mexe.join(',') === 'opacity,transform', `animação: a gaveta entra com em-abre em 200 ms, só opacidade e posição (${gaveta?.nome}, ${gaveta?.duracao} ms, ${gaveta?.mexe})`)
      conta(gaveta.meio.opacidade > 0.2 && gaveta.meio.opacidade < 1 && gaveta.meio.topo < gaveta.fim.topo && gaveta.fim.topo - gaveta.meio.topo < 4 && igual(gaveta.meio.altura, gaveta.fim.altura), `animação: na metade a gaveta está meio transparente, a menos de 4 px do lugar, e a altura não é animada (${gaveta.meio.opacidade.toFixed(2)}, ${(gaveta.fim.topo - gaveta.meio.topo).toFixed(1)} px)`)
      conta(seta?.o_que === 'transform' && seta.quanto === '0.15s' && /^matrix\((0|-?\d(\.\d+)?e-\d+), 1, -1, /.test(giro), `animação: a seta gira 90 graus em 150 ms (${seta?.o_que} ${seta?.quanto}, ${giro})`)
      conta(vao?.nome === 'em-enche' && vao.duracao === 260 && vao.mexe.join(',') === 'transform' && vao.meio.topo > vao.fim.topo && igual(vao.meio.altura, vao.fim.altura), `animação: o tecido sobe dentro do vão em 260 ms, só por posição (${vao?.nome}, ${vao?.duracao} ms)`)
      conta(ficha?.nome === 'em-surge' && ficha.duracao === 200 && ficha.mexe.join(',') === 'opacity,transform' && ficha.fim.opacidade === 1, `animação: a ficha entra com em-surge em 200 ms (${ficha?.nome}, ${ficha?.duracao} ms)`)
      conta([...linhas, pe].every((t) => t && t.o_que === 'background-color' && t.quanto === '0.15s'), `animação: grupo, tecido, cor e "Ver mais" só animam o fundo, em 150 ms (${[...linhas, pe].map((t) => t?.o_que + ' ' + t?.quanto).join(' | ')})`)
      const fora = await pg.evaluate(() => {
        const ruins = []
        for (const folha of document.styleSheets) {
          let regras = []
          try { regras = [...folha.cssRules] } catch { continue }
          const ver = (r) => {
            if (r.cssRules && !(r instanceof CSSStyleRule)) { [...r.cssRules].forEach(ver); return }
            if (!(r instanceof CSSStyleRule) || !/\.em-/.test(r.selectorText)) return
            const t = r.style.transition || r.style.transitionProperty
            if (t && /\ball\b|width|height|top|left|margin|padding|box-shadow|border/.test(t)) ruins.push(r.selectorText + ' { ' + t + ' }')
          }
          regras.forEach(ver)
        }
        return ruins
      })
      conta(fora.length === 0, `animação: nenhuma regra da página anima largura, altura, margem, borda ou sombra (${fora.join(' ; ') || 'nenhuma'})`)
    } else {
      conta([gaveta, vao, ficha].every((a) => a && a.duracao < 1), `movimento reduzido: as três animações duram menos de 1 ms (${[gaveta, vao, ficha].map((a) => a?.duracao).join(', ')})`)
      conta([seta, ...linhas, pe].every((t) => t && parseFloat(t.quanto) < 0.001), `movimento reduzido: as transições também zeram (${[seta, ...linhas, pe].map((t) => t?.quanto).join(', ')})`)
    }
    conta(erros.length === 0, `${movimento ? 'animação' : 'movimento reduzido'}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram.`)
if (ruins.length) { console.log('\nNÃO PASSOU:'); ruins.forEach((r) => console.log('  ' + r.texto)); process.exit(1) }
