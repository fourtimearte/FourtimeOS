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
    11. A FICHA TÉCNICA DA COR: o cartão, o editor de uma cor e de várias, um
        símbolo de cuidado por grupo, só o que foi mexido indo para o banco, e
        a recusa do banco deixando a ficha aberta
    12. A TABELA COM A SELEÇÃO E O LOTE: fornecedor, mínimo, ficha técnica e
        lugar para todos os marcados de uma vez
    13. AS ESTATÍSTICAS: o uso por tecido e por cor nos três períodos, a
        prioridade de compra pela cobertura e o mês a mês, e o mesmo para
        aviamento e insumo, sem somar unidades diferentes
    14. A TABELA IGUAL À LISTA: os mesmos grupos e tecidos do catálogo, com o
        que não tem estoque apagado e a "Nova cor" ao lado
    15. O LUGAR NO CADASTRO: a cor nova aponta o lugar no desenho do depósito
    16. O MÍNIMO RECOMENDADO, pela média do último mês e dos últimos três
    17. A COR PELA FAMÍLIA no cadastro de material: a fileira das famílias, as
        pílulas só da família aberta, a cor nova na família e a edição da que
        existe, para quem pode mexer no catálogo

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
/* a cor do cadastro se escolhe pela família (05/10/2026): abre a família, clica na cor */
const escolherCor = async (pg, familia, nome) => {
  const f = pg.locator(`dialog[open] .es-familia[data-familia="${familia}"]`)
  if (await f.getAttribute('aria-pressed') !== 'true') { await f.click(); await pausa(pg, 200) }
  await pg.locator('dialog[open] .es-novo-chips .chip', { hasText: new RegExp('^' + nome + '$') }).click(); await pausa(pg, 200)
}

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
    conta(igual(abas.x + abas.w / 2, deDentro.x + deDentro.w / 2, 1), `${T}: Materiais, Movimentos, Depósito e Estatísticas ficam pareadas com Tecido, Aviamentos e Insumo`)
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
    conta(await pg.locator('table.es-tb tbody tr.es-folha').count() === 2 && /Tecido 2 Aviamentos 1 Insumo 1/.test(await texto(pg, '[data-tabela-topo] .em-seg')) && /ligado/.test(await pg.locator('[data-tabela-topo] .chip', { hasText: 'Para comprar' }).getAttribute('class')), `${T} comprar: "Ver mais" abre a tabela só com os 4 para comprar (2 tecidos à vista e já abertos, 1 aviamento e 1 insumo nas outras abas)`)
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Lista' }).click(); await pausa(pg, 300)

    /* últimos movimentos */
    const mv = await texto(pg, '[data-coluna="movimentos"] .em-lin')
    conta(/DRYFIT POLIESTER 100% Preto hoje, 14:10 · Separação · pedido PD-0412 -4 kg/.test(mv), `${T} movimentos: a linha diz o material, quando, o motivo, o pedido e quanto (${mv})`)
    await pg.locator('[data-coluna="movimentos"] .em-pe').click(); await pausa(pg, 400)
    conta(/ligado/.test(await pg.locator('[data-barra] > .em-seg button', { hasText: 'Movimentos' }).getAttribute('class')) && await pg.locator('table.tabela tbody tr:not(.grupo)').count() === 17, `${T} movimentos: "Ver mais" leva à aba Movimentações, com os 17`)
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

  /* A FICHA TÉCNICA É DE CADA COR (pedido do Henrique, 05/10/2026): a
     composição, a gramatura, a largura, os detalhes e os símbolos de cuidado
     moram na cor, e "Editar" abre essa ficha, não a tabela de quantidades. */
  await caso(`${T} ficha técnica`, async () => {
    const PRETO = 'DRYFIT POLIESTER 100% · Preto'
    const ultimo = () => gravados.filter((g) => g.u === 'rpc/definir_cadastro').at(-1)
    const ligados = () => pg.locator('dialog[open] .ft-botao.ligado').evaluateAll((l) => l.map((e) => e.dataset.cod))
    gravados.length = 0
    await pg.locator('.em-abas').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 200)
    await abrirGrupo(pg)
    if (await pg.locator(cor(PRETO)).count() === 0) { await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 250) }
    await pg.locator(cor(PRETO)).click(); await pausa(pg, 500)

    /* o cartão */
    const cartao = await texto(pg, '[data-ficha-tecnica]')
    conta(/Composição 96% Poliéster · 4% Elastano/.test(cartao) && /Gramatura 190 g\/m²/.test(cartao) && /Largura 1,20 m/.test(cartao) && /Rendimento 4,4 m por kg calculado/.test(cartao) && /Proteção UV 50\+ Secagem rápida/.test(cartao), `${T} ficha técnica: a ficha da cor mostra a composição, a gramatura, a largura, o rendimento e os detalhes dela (${cartao.slice(0, 150)})`)
    const simbolos = await pg.locator('[data-ficha-tecnica] .ft-simbolo').evaluateAll((l) => ({ n: l.length, fileiras: new Set(l.map((e) => Math.round(e.getBoundingClientRect().top))).size, desenho: l.every((e) => e.querySelector('svg')) }))
    conta(simbolos.n === 6 && simbolos.fileiras === 1 && simbolos.desenho && /Lavar a 40 °C, ciclo suave/.test(cartao) && /Não limpar a seco/.test(cartao), `${T} ficha técnica: os 6 símbolos de cuidado numa fileira só, desenhados, com a frase de cada um (${simbolos.n} em ${simbolos.fileiras} fileira)`)
    await foto('ficha-tecnica')

    /* Editar abre A FICHA, e não a tabela de quantidades */
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    const editor = await caixa(pg, 'dialog[open] .caixa')
    conta(await pg.locator('dialog[open] [data-editar-ficha]').count() === 1 && await pg.locator('dialog[open] table').count() === 0 && /^Ficha de DRYFIT POLIESTER 100% · Preto/.test(await texto(pg, 'dialog[open] .sobre-topo')) && igual(editor.w, 980), `${T} ficha técnica: "Editar" na cor abre a ficha dela, no modal de 980, e não a tabela de cores (${await texto(pg, 'dialog[open] .sobre-topo')})`)
    const esquerda = await texto(pg, 'dialog[open] [data-editar-ficha] .ft-coluna')
    conta(/Vale só para esta cor/.test(esquerda) && /Fornecedor desta cor Malharia Exemplo Ltda/.test(esquerda) && /Mínimo no estoque, em kg/.test(esquerda) && /Composição soma 100%/.test(esquerda) && /Rendimento 4,4 m por kg/.test(esquerda) && await pg.locator('dialog[open] input[aria-label="Gramatura"]').inputValue() === '190' && await pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]').inputValue() === '20', `${T} ficha técnica: o editor abre com o fornecedor, o mínimo, a composição e a gramatura que a cor tem hoje`)
    conta(await pg.locator('dialog[open] .ft-botao').count() === 38 && await pg.locator('dialog[open] [data-cuidados] .ft-grupo').count() === 6 && (await ligados()).join(' ') === 'lavar-40-suave nao-alvejar nao-tambor varal-sombra passar-1 nao-seco', `${T} ficha técnica: os 38 símbolos em 6 grupos, com os 6 da cor marcados (${(await ligados()).join(' ')})`)
    const pe = pg.locator('dialog[open] .sobre-pe')
    conta(/Nada mudou ainda/.test(await pe.innerText()) && await pe.getByRole('button', { name: 'Salvar a ficha' }).isDisabled(), `${T} ficha técnica: sem mexer em nada, não há o que salvar`)
    await foto('editar-ficha', false)

    /* um símbolo por grupo */
    await pg.locator('dialog[open] .ft-botao[data-cod="lavar-30"]').click(); await pausa(pg, 200)
    let l = await ligados()
    conta(l.includes('lavar-30') && !l.includes('lavar-40-suave') && l.length === 6 && /30/.test(await texto(pg, 'dialog[open] .ft-previa')), `${T} ficha técnica: marcar outra lavagem troca a que estava, um símbolo por grupo, e a etiqueta acompanha (${l.join(' ')})`)
    await pg.locator('dialog[open] .ft-botao[data-cod="nao-seco"]').click(); await pausa(pg, 200)
    conta((await ligados()).length === 5, `${T} ficha técnica: clicar de novo num símbolo marcado tira ele`)
    await pg.locator('dialog[open] .ft-botao[data-cod="nao-seco"]').click(); await pausa(pg, 200)

    /* a conta do rendimento e a trava da composição */
    await pg.locator('dialog[open] input[aria-label="Gramatura"]').fill('200'); await pausa(pg, 200)
    conta(/4,2 m por kg/.test(await texto(pg, 'dialog[open] [data-rendimento]')), `${T} ficha técnica: mudar a gramatura refaz o rendimento na hora (${await texto(pg, 'dialog[open] [data-rendimento]')})`)
    await pg.locator('dialog[open] input[aria-label^="Porcentagem de"]').first().fill('90'); await pausa(pg, 200)
    conta(/A composição tem de somar 100%/.test(await texto(pg, 'dialog[open] [data-composicao]')) && await pe.getByRole('button', { name: 'Salvar a ficha' }).isDisabled(), `${T} ficha técnica: composição que não soma 100 trava o salvar e diz o motivo`)
    await pg.locator('dialog[open] input[aria-label^="Porcentagem de"]').first().fill('96'); await pausa(pg, 200)
    await pe.getByRole('button', { name: 'Salvar a ficha' }).click(); await pausa(pg, 800)
    let g = ultimo()
    conta(g && JSON.stringify(g.corpo.p_materiais) === JSON.stringify([id(PRETO)]) && Object.keys(g.corpo.p_mudanca).sort().join(',') === 'composicao,cuidados,gramatura' && g.corpo.p_mudanca.gramatura === 200 && g.corpo.p_mudanca.cuidados.includes('lavar-30') && g.corpo.p_mudanca.cuidados.length === 6, `${T} ficha técnica: só o que foi mexido vai para o banco, e só para esta cor (${g ? JSON.stringify(g.corpo).slice(0, 200) : 'nada gravado'})`)
    conta(await pg.locator('dialog[open]').count() === 0, `${T} ficha técnica: salva, a ficha fecha`)

    /* a cor sem ficha, e copiar de outra */
    await pg.locator(cor('DRYFIT POLIESTER 100% · Azul Marinho')).click(); await pausa(pg, 500)
    const vazia = await texto(pg, '[data-ficha-tecnica]')
    conta(/ainda não tem ficha técnica/.test(vazia) && /Gramatura 160 g\/m² do catálogo de tecidos/.test(vazia) && await pg.locator('[data-ficha-tecnica] .ft-simbolo').count() === 0, `${T} ficha técnica: a cor sem ficha diz que não tem, e mostra a gramatura do catálogo dizendo de onde vem (${vazia.slice(0, 130)})`)
    await pg.locator('[data-ficha-tecnica]').getByRole('button', { name: 'Editar a ficha' }).click(); await pausa(pg, 600)
    conta((await ligados()).length === 0 && await pg.locator('dialog[open] input[aria-label="Gramatura"]').inputValue() === '', `${T} ficha técnica: a ficha da cor que não tem nada abre vazia`)
    await pg.locator('dialog[open] [data-copiar] .sel-gatilho, dialog[open] [data-copiar] button').first().click(); await pausa(pg, 300)
    await pg.locator('.mn.flutua').getByText('Preto', { exact: true }).click(); await pausa(pg, 300)
    conta((await ligados()).length === 6 && await pg.locator('dialog[open] input[aria-label="Gramatura"]').inputValue() === '190' && await pg.locator('dialog[open] .ft-fibra').count() === 2, `${T} ficha técnica: "Copiar a ficha de outra cor" traz a composição, a gramatura e os cuidados da outra`)
    await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Salvar a ficha' }).click(); await pausa(pg, 800)
    g = ultimo()
    conta(g && JSON.stringify(g.corpo.p_materiais) === JSON.stringify([id('DRYFIT POLIESTER 100% · Azul Marinho')]) && Object.keys(g.corpo.p_mudanca).sort().join(',') === 'composicao,cuidados,detalhes,gramatura,largura', `${T} ficha técnica: a ficha copiada grava na cor que estava aberta, e não na de origem (${g ? Object.keys(g.corpo.p_mudanca).sort().join(',') : 'nada gravado'})`)

    /* o fornecedor é da cor, e o fornecedor novo abre ao lado */
    await pg.locator('[data-ficha] .em-col:has(.em-fornecedor)').getByRole('button', { name: 'Trocar' }).click(); await pausa(pg, 600)
    conta(await pg.locator('dialog[open] [data-editar-ficha]').count() === 1 && await pg.locator('dialog[open] [data-cuidados]').count() === 1, `${T} ficha técnica: "Trocar" no fornecedor da cor abre a mesma ficha`)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Novo fornecedor', exact: true }).click(); await pausa(pg, 400)
    conta(await pg.locator('dialog[open] [data-novo-fornecedor]').count() === 1 && await pg.locator('dialog[open] [data-cuidados]').count() === 0 && await pg.locator('dialog[open]').count() === 1, `${T} ficha técnica: "Novo fornecedor" abre a coluna ao lado, no lugar dos cuidados, sem sair da ficha`)
    await foto('editar-ficha-fornecedor', false)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Fechar o novo fornecedor' }).click(); await pausa(pg, 300)
    conta(await pg.locator('dialog[open] [data-cuidados]').count() === 1, `${T} ficha técnica: fechada a coluna, os cuidados voltam`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)

    /* o tecido inteiro: várias cores de uma vez, e só muda o que for mexido */
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    const resumo = await texto(pg, '[data-fichas-das-cores]')
    conta(/2 cores têm ficha técnica/.test(resumo) && /Faltam: Azul Marinho, Vermelho Fourtime/.test(resumo), `${T} ficha técnica: a ficha do tecido diz quantas cores têm ficha e quais faltam (${resumo.slice(0, 110)})`)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    conta(/^Ficha das 4 cores de DRYFIT POLIESTER 100%/.test(await texto(pg, 'dialog[open] .sobre-topo')) && await pg.locator('dialog[open] [data-lote] .ft-lote-item').count() === 4 && await pg.locator('dialog[open] table').count() === 0, `${T} ficha técnica: "Editar" no tecido abre a ficha das 4 cores de uma vez (${await texto(pg, 'dialog[open] .sobre-topo')})`)
    const varia = await pg.locator('dialog[open] .es-campo-topo small', { hasText: 'varia' }).count()
    conta(varia >= 3 && await pg.locator('dialog[open] input[aria-label="Gramatura"]').inputValue() === '' && await pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]').inputValue() === '', `${T} ficha técnica: onde as cores diferem o campo vem vazio e diz "varia" (${varia} campos)`)
    await pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]').fill('30'); await pausa(pg, 200)
    conta(/Vai mudar o mínimo em 4 materiais/.test(await texto(pg, 'dialog[open] .sobre-pe')), `${T} ficha técnica: o pé diz o que vai mudar, e em quantos (${await texto(pg, 'dialog[open] .sobre-pe')})`)
    await foto('editar-ficha-lote', false)
    await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Aplicar em 4' }).click(); await pausa(pg, 800)
    g = ultimo()
    conta(g && g.corpo.p_materiais.length === 4 && JSON.stringify(g.corpo.p_mudanca) === '{"minimo":30}', `${T} ficha técnica: o mínimo vai para as 4 cores, e a gramatura e os cuidados de cada uma ficam como estavam (${g ? JSON.stringify(g.corpo.p_mudanca) : 'nada gravado'})`)
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
    await escolherCor(pg, 'LR', 'Laranja')
    await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').fill('25'); await pausa(pg, 150)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Novo fornecedor', exact: true }).click(); await pausa(pg, 500)
    const largo = await caixa(pg, 'dialog[open] .caixa')
    const lados = await pg.locator('dialog[open] .es-novo-lados').evaluate((e) => [...e.children].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)] }))
    conta(igual(largo.w, 980) && lados.length === 2 && lados[1][0] > lados[0][1] && await pg.locator('dialog[open]').count() === 1, `${T} novo material: "Novo fornecedor" abre uma coluna ao lado, na mesma caixa, que alarga para 980 (${Math.round(largo.w)}; colunas ${JSON.stringify(lados)})`)
    conta(await pg.locator('dialog[open] .es-novo-chips .chip.ligado', { hasText: /^Laranja$/ }).count() === 1 && await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').inputValue() === '25' && await pg.locator('dialog[open]').getByRole('button', { name: 'Novo fornecedor', exact: true }).isDisabled(), `${T} novo material: a cor e o mínimo que a pessoa já tinha escolhido continuam lá, com a coluna aberta`)
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
    conta(await pg.locator('dialog[open] .es-novo-chips .chip.ligado', { hasText: /^Laranja$/ }).count() === 1 && await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').inputValue() === '25', `${T} novo material: o cadastro da cor continua de onde parou`)
    await pg.keyboard.press('Escape'); await pausa(pg)
  })

  await caso(`${T} tabela e lote`, async () => {
    /* A TABELA (prancha 41): as três abas, nada aberto, e a caixa de marcar */
    const TB = 'table.es-tb'
    const PRETO = 'DRYFIT POLIESTER 100% · Preto'
    const folhas = () => pg.locator(`${TB} tbody tr.es-folha`).count()
    const lote = () => pg.locator('[data-lote-da-tabela]')
    const meio = (seletor) => pg.locator(seletor).first().evaluate((e) => (e.indeterminate ? 'meio' : e.checked ? 'cheia' : 'vazia'))
    const cadastro = () => gravados.filter((g) => g.u === 'rpc/definir_cadastro').at(-1)
    gravados.length = 0
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
    const faixas = await pg.locator(`${TB} tr[data-faixa]`).evaluateAll((l) => l.map((e) => e.dataset.faixa + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
    conta(faixas.join(' | ') === 'ALGODÃO | DRY FIT | PIQUE | MOLETOM | SUPLEX | VISCOSE | Sem tipo' && await folhas() === 0 && await pg.locator(`${TB} tr.es-malha.es-recolhe`).count() === 0, `${T} tabela: abre na aba Tecido com os grupos fechados, sem tecido nem cor à vista (${faixas.join(' | ')})`)
    const abas = await texto(pg, '[data-tabela-topo] .em-seg')
    const chips = (await pg.locator('[data-tabela-topo] .chip').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ')
    conta(/Tecido 10 Aviamentos 7 Insumo 9/.test(abas) && chips === 'Para comprar 2 | Sem fornecedor 1 | Sem lugar marcado 1 | Sem ficha técnica 8' && await pg.locator('[data-barra] .es-chips').count() === 0, `${T} tabela: as três abas com a conta, e os filtros dentro do cartão da tabela (${abas}; ${chips})`)
    const cab = (await pg.locator(`${TB} thead th`).allInnerTexts()).map((c) => c.trim()).join(' | ')
    conta(cab === ' | Grupo, tecido e cor | Fornecedor | Onde está | Livre | Na prateleira | Reservado | Mínimo | Situação' && (await sobra(pg)) <= 0, `${T} tabela: a caixa de marcar na frente, e as oito colunas da prancha (${cab})`)
    await foto('tabela')
    await pg.locator(`${TB} tr[data-faixa="DRY FIT"]`).click(); await pausa(pg, 300)
    conta(await pg.locator(`${TB} tr.es-malha.es-recolhe`).count() === 1 && await pg.locator(`${TB} tr.es-malha.es-vazia`).count() === 1 && await folhas() === 0, `${T} tabela: abrir o grupo mostra o tecido que tem estoque, ainda fechado, e o do catálogo que não tem`)
    await pg.locator(`${TB} tr.es-malha.es-recolhe`).click(); await pausa(pg, 300)
    const linha = await texto(pg, `${TB} tr.es-folha[data-material="${PRETO}"]`)
    conta(await folhas() === 4 && /^Preto Malharia Exemplo Ltda .*3 kg 9 kg 6 kg 20 kg comprar$/.test(linha), `${T} tabela: abrir o tecido mostra as 4 cores, cada uma com o fornecedor, o lugar, o livre, a prateleira, o reservado, o mínimo e a situação (${linha})`)

    /* marcar o tecido marca as cores dele */
    await pg.locator(`${TB} tr.es-malha.es-recolhe td.es-ck .ck`).click(); await pausa(pg, 400)
    const K = await tokens(pg, ['--ink'])
    const faixa = await lote().evaluate((e) => ({ fundo: getComputedStyle(e).backgroundColor, t: e.innerText.replace(/\s+/g, ' ').trim() }))
    conta(await pg.locator(`${TB} tr.es-folha.marcada`).count() === 4 && faixa.fundo === K['--ink'] && /^4 selecionados 4 cores de DRYFIT POLIESTER 100% Definir fornecedor Definir mínimo Ficha técnica Definir onde está Limpar a seleção$/.test(faixa.t), `${T} lote: marcar o tecido marca as 4 cores, e a faixa na tinta do sistema diz quantas e oferece as ações (${faixa.t})`)
    conta(await meio(`${TB} tr.es-malha.es-recolhe td.es-ck input`) === 'cheia' && await meio(`${TB} tr[data-faixa="DRY FIT"].grupo td.es-ck input`) === 'cheia' && await meio(`${TB} thead th.es-ck input`) === 'meio' && await pg.locator(`${TB} tr.es-malha.es-recolhe`).getAttribute('aria-expanded') === 'true', `${T} lote: a caixa do tecido e a do grupo ficam cheias, a do cabeçalho pela metade, e marcar não fecha a sanfona`)
    await pg.locator(`${TB} tr.es-folha[data-material="${PRETO}"]`).click(); await pausa(pg, 300)
    conta(/^3 selecionados/.test(await lote().innerText()) && await meio(`${TB} tr.es-malha.es-recolhe td.es-ck input`) === 'meio', `${T} lote: clicar na linha da cor desmarca só ela, e a caixa do tecido fica pela metade`)
    await pg.locator(`${TB} tr.es-folha[data-material="${PRETO}"] td.es-ck .ck`).click(); await pausa(pg, 300)
    conta(/^4 selecionados/.test(await lote().innerText()), `${T} lote: a caixa da cor marca de volta, uma vez só`)
    await foto('tabela-lote')

    /* definir o mínimo: só esse campo, nas 4 de uma vez */
    await lote().getByRole('button', { name: 'Definir mínimo' }).click(); await pausa(pg, 600)
    let cx = await caixa(pg, 'dialog[open] .caixa')
    conta(/^Mínimo de 4 materiais/.test(await texto(pg, 'dialog[open] .sobre-topo')) && igual(cx.w, 560) && await pg.locator('dialog[open] [data-editar-ficha] input').count() === 1 && await pg.locator('dialog[open] [data-cuidados]').count() === 0 && await pg.locator('dialog[open] .fn-gatilho').count() === 0, `${T} lote: "Definir mínimo" abre uma caixa de 560 só com o campo do mínimo (${await texto(pg, 'dialog[open] .sobre-topo')})`)
    await pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]').fill('25'); await pausa(pg, 200)
    await foto('lote-minimo', false)
    await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Aplicar em 4' }).click(); await pausa(pg, 800)
    let g = cadastro()
    conta(g && g.corpo.p_materiais.length === 4 && g.corpo.p_materiais.includes(id(PRETO)) && JSON.stringify(g.corpo.p_mudanca) === '{"minimo":25}' && /^4 selecionados/.test(await lote().innerText()), `${T} lote: o mínimo vai para as 4 cores e mais nada muda, e a seleção continua (${g ? JSON.stringify(g.corpo.p_mudanca) : 'nada gravado'})`)

    /* definir o fornecedor, poupando quem já tem */
    await lote().getByRole('button', { name: 'Definir fornecedor' }).click(); await pausa(pg, 600)
    conta(/^Fornecedor de 4 materiais/.test(await texto(pg, 'dialog[open] .sobre-topo')) && await pg.locator('dialog[open] .fn-gatilho').count() === 1 && await pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]').count() === 0, `${T} lote: "Definir fornecedor" abre só o campo do fornecedor, com o "Novo fornecedor" ao lado`)
    await pg.locator('dialog[open] .fn-gatilho').click(); await pausa(pg)
    await pg.locator('.mn.flutua').getByText('Tecidos Exemplo S.A.', { exact: false }).first().click(); await pausa(pg)
    const trocar = pg.locator('dialog[open] .ck', { hasText: 'Trocar também' })
    conta(/nos 4 que já têm fornecedor/.test(await trocar.innerText()), `${T} lote: como as 4 já têm fornecedor, a caixa pergunta se troca também nelas (${(await trocar.innerText()).trim()})`)
    await trocar.click(); await pausa(pg, 200)
    await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Aplicar em 4' }).click(); await pausa(pg, 800)
    g = cadastro()
    conta(g && Object.keys(g.corpo.p_mudanca).sort().join(',') === 'fornecedor,so_sem_fornecedor' && g.corpo.p_mudanca.so_sem_fornecedor === true && g.corpo.p_materiais.length === 4, `${T} lote: desmarcada a caixa, o fornecedor só entra em quem não tinha (${g ? JSON.stringify(g.corpo.p_mudanca) : 'nada gravado'})`)

    /* a ficha técnica em lote, que é o que o Henrique pediu pela tabela */
    await lote().getByRole('button', { name: 'Ficha técnica' }).click(); await pausa(pg, 600)
    cx = await caixa(pg, 'dialog[open] .caixa')
    conta(/^Ficha de 4 cores marcadas na tabela/.test(await texto(pg, 'dialog[open] .sobre-topo')) && igual(cx.w, 980) && await pg.locator('dialog[open] .ft-botao').count() === 38 && await pg.locator('dialog[open] [data-lote] .ft-lote-item').count() === 4, `${T} lote: "Ficha técnica" abre a ficha inteira para as 4 cores, com os 38 símbolos`)
    await pg.locator('dialog[open] .ft-botao[data-cod="nao-alvejar"]').click(); await pausa(pg, 150)
    await pg.locator('dialog[open] .ft-botao[data-cod="lavar-30"]').click(); await pausa(pg, 150)
    await pg.locator('dialog[open] input[aria-label="Gramatura"]').fill('165'); await pausa(pg, 150)
    await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Aplicar em 4' }).click(); await pausa(pg, 800)
    g = cadastro()
    conta(g && g.corpo.p_materiais.length === 4 && Object.keys(g.corpo.p_mudanca).sort().join(',') === 'cuidados,gramatura' && g.corpo.p_mudanca.gramatura === 165 && g.corpo.p_mudanca.cuidados.join(' ') === 'lavar-30 nao-alvejar', `${T} lote: a gramatura e os cuidados vão para as 4 de uma vez, e a composição de cada uma fica como estava (${g ? JSON.stringify(g.corpo.p_mudanca) : 'nada gravado'})`)

    /* o lugar no depósito, para todos os marcados */
    await lote().getByRole('button', { name: 'Definir onde está' }).click(); await pausa(pg, 600)
    conta(/^Onde estão os 4 materiais\?/.test(await texto(pg, 'dialog[open] .sobre-topo')) && await pg.locator('dialog[open] [data-lote-de-lugar]').count() === 1 && await pg.locator('dialog[open]').getByRole('button', { name: 'Marcar aqui' }).isDisabled(), `${T} lote: "Definir onde está" abre o desenho do depósito para os 4, e não marca sem lugar apontado`)
    await pg.locator('dialog[open] [data-lugar="P07"]').click(); await pausa(pg, 300)
    await pg.locator('dialog[open]').getByRole('button', { name: 'Marcar aqui' }).click(); await pausa(pg, 700)
    const lg = gravados.filter((x) => x.u === 'rpc/definir_lugares').at(-1)
    conta(lg && lg.corpo.p_materiais.length === 4 && lg.corpo.p_lugares.length === 1 && lg.corpo.p_lugares[0].movel === 'pal-07', `${T} lote: o palete apontado vira o lugar das 4 cores (${lg ? JSON.stringify(lg.corpo.p_lugares) : 'nada gravado'})`)

    /* a seleção não sobrevive ao que sai da vista */
    await pg.locator('[data-tabela-topo] .em-seg').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg, 400)
    const cabAv = (await pg.locator(`${TB} thead th`).allInnerTexts())[1].trim()
    conta(await lote().count() === 0 && cabAv === 'Grupo e item' && await pg.locator(`${TB} tr[data-faixa]`).count() > 0 && await folhas() === 0, `${T} lote: trocar de aba solta a seleção, e a aba de aviamentos abre fechada (${cabAv})`)
    await pg.locator('[data-tabela-topo] .em-seg').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 400)
    conta(await lote().count() === 0 && await pg.locator(`${TB} tr.marcada`).count() === 0 && await meio(`${TB} thead th.es-ck input`) === 'vazia', `${T} lote: voltar para a aba Tecido não traz de volta as 4 cores que estavam marcadas antes`)
    await pg.locator('[data-tabela-topo] .em-seg').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg, 400)
    await pg.locator(`${TB} tr[data-faixa]`).first().click(); await pausa(pg, 300)
    await pg.locator(`${TB} tr.es-folha td.es-ck .ck`).first().click(); await pausa(pg, 300)
    const botoes = (await lote().getByRole('button').allInnerTexts()).map((b) => b.trim()).join(' | ')
    conta(botoes === 'Definir fornecedor | Definir mínimo | Definir onde está | Limpar a seleção' && /^1 selecionado 1 item de /.test((await lote().innerText()).replace(/\s+/g, ' ')), `${T} lote: no aviamento a faixa não oferece a ficha técnica, que é do tecido (${botoes})`)
    await lote().getByRole('button', { name: 'Limpar a seleção' }).click(); await pausa(pg, 300)
    conta(await lote().count() === 0 && await pg.locator(`${TB} tr.marcada`).count() === 0, `${T} lote: "Limpar a seleção" tira a faixa e desmarca tudo`)
    await pg.locator('[data-tabela-topo] .em-seg').getByRole('tab', { name: /Tecido/ }).click(); await pausa(pg, 400)
    await pg.locator(`${TB} thead th.es-ck .ck`).click(); await pausa(pg, 300)
    conta(/^10 selecionados/.test(await lote().innerText()), `${T} lote: a caixa do cabeçalho marca tudo o que está na aba (${(await lote().innerText()).replace(/\s+/g, ' ').slice(0, 60)})`)
    await pg.locator(`${TB} thead th.es-ck .ck`).click(); await pausa(pg, 300)

    /* os filtros e a busca abrem o que sobrou */
    await pg.locator('[data-tabela-topo] .chip', { hasText: 'Sem ficha técnica' }).click(); await pausa(pg, 400)
    conta(await folhas() === 8 && await pg.locator(`${TB} tr[data-faixa][aria-expanded="false"]`).count() === 0 && /Tecido 8 /.test(await texto(pg, '[data-tabela-topo] .em-seg')), `${T} tabela: "Sem ficha técnica" deixa as 8 cores que faltam, já abertas`)
    await pg.locator('[data-tabela-topo] .chip', { hasText: 'Sem ficha técnica' }).click(); await pausa(pg, 400)
    await pg.fill('[data-barra] .em-busca input', 'dryfit'); await pausa(pg, 500)
    conta(await folhas() === 4 && await pg.locator(`${TB} tr[data-faixa][aria-expanded="true"]`).count() === 2, `${T} tabela: com busca, o que sobrou já vem aberto (as 4 cores do dry fit)`)
    await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 400)
    conta(await folhas() === 0, `${T} tabela: tirada a busca, a tabela volta fechada`)

    /* a seta da linha leva à ficha da cor, na Lista */
    await pg.locator(`${TB} tr[data-faixa="DRY FIT"]`).click(); await pausa(pg, 250)
    await pg.locator(`${TB} tr.es-malha.es-recolhe`).click(); await pausa(pg, 250)
    await pg.locator(`${TB} tr.es-folha[data-material="${PRETO}"] .es-abrir`).click(); await pausa(pg, 500)
    conta(await pg.locator('[data-tabela-topo]').count() === 0 && /› cor/.test(await texto(pg, '[data-ficha] .em-trilha')) && await pg.locator('[data-ficha-tecnica]').count() === 1 && await lote().count() === 0, `${T} tabela: a seta da linha abre a ficha da cor na Lista, com a ficha técnica dela, sem marcar a linha`)
    await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
    conta(await pg.locator('[data-coluna]').count() === 3, `${T} tabela: fechada a ficha, as colunas voltam`)
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
  conta(await pg.locator('[data-ficha-tecnica]').count() === 1 && await pg.locator('[data-ficha-tecnica]').getByRole('button').count() === 0 && await pg.locator('[data-ficha] .em-col:has(.em-fornecedor)').getByRole('button', { name: 'Trocar' }).count() === 0, 'quem só lê: vê a ficha técnica da cor, sem o botão de editar nem o de trocar o fornecedor')
  await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)
  await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
  await pg.locator('table.es-tb tr[data-faixa="DRY FIT"]').click(); await pausa(pg, 250)
  await pg.locator('table.es-tb tr.es-malha.es-recolhe').click(); await pausa(pg, 250)
  conta(await pg.locator('table.es-tb .es-ck').count() === 0 && await pg.locator('table.es-tb thead th').count() === 8 && await pg.locator('table.es-tb tbody tr.es-folha').count() === 4, 'quem só lê: a tabela não tem caixa de marcar, e continua com as oito colunas')
  await pg.locator('table.es-tb tr.es-folha[data-material="DRYFIT POLIESTER 100% · Preto"]').click(); await pausa(pg, 500)
  conta(await pg.locator('[data-lote-da-tabela]').count() === 0 && /› cor/.test(await texto(pg, '[data-ficha] .em-trilha')), 'quem só lê: clicar na linha da tabela abre a ficha da cor, e nenhuma faixa de lote aparece')
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
  await pg.locator('dialog[open] .es-familia[data-familia="BR"]').click(); await pausa(pg, 200)
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
    conta(chips.map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ') === 'Materiais | Separação 7 | Comprar 4 | Movimentos | Depósito | Estatísticas', `${T}: os seis assuntos viram chips, com a conta (${chips.map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ')})`)
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

/* A TABELA NÃO ROLA DE LADO: ela perde coluna. Em 1440 cabem as oito; em 1366
   saem "Na prateleira" e "Reservado"; em 1100 sai também "Onde está". O nome,
   o livre, o mínimo, a situação e a seta da ficha ficam sempre à vista. */
for (const [largura, esperadas] of [[1440, 'Grupo, tecido e cor | Fornecedor | Onde está | Livre | Na prateleira | Reservado | Mínimo | Situação'], [1366, 'Grupo, tecido e cor | Fornecedor | Onde está | Livre | Mínimo | Situação'], [1100, 'Grupo, tecido e cor | Fornecedor | Livre | Mínimo | Situação']]) {
  await caso(`tabela ${largura}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura: 800, tema: 'light', estoque: 'grande' })
    await ir(pg, '/estoque', '[data-barra]')
    await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
    await pg.fill('[data-barra] .em-busca input', 'e'); await pausa(pg, 600)
    const m = await pg.locator('.tabela-rola').evaluate((e) => {
      const caixa = e.getBoundingClientRect()
      const setas = [...e.querySelectorAll('.es-abrir')]
      return {
        sobra: e.scrollWidth - e.clientWidth,
        colunas: [...e.querySelectorAll('thead th')].filter((t) => t.offsetWidth > 0 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' | '),
        cortadas: [...e.querySelectorAll('thead th')].filter((t) => t.offsetWidth > 0 && t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent.trim()),
        setas: setas.length, setasFora: setas.filter((s) => s.getBoundingClientRect().right > caixa.right + 0.5).length,
      }
    })
    conta(m.sobra <= 0 && m.colunas === esperadas && m.cortadas.length === 0, `tabela ${largura}: a tabela cabe na caixa sem rolar de lado, com as colunas certas e nenhum título cortado (sobra ${m.sobra}; ${m.colunas}; cortadas: ${m.cortadas.join(', ') || 'nenhuma'})`)
    conta(m.setas > 20 && m.setasFora === 0 && (await sobra(pg)) <= 0, `tabela ${largura}: a seta que abre a ficha fica à vista em todas as ${m.setas} linhas`)
    await pg.locator('table.es-tb tr.es-malha.es-recolhe td.es-ck .ck').first().click(); await pausa(pg, 300)
    const lote = await pg.locator('[data-lote-da-tabela]').evaluate((e) => ({ sobra: e.scrollWidth - e.clientWidth, botoes: [...e.querySelectorAll('.btn')].filter((b) => b.getBoundingClientRect().right > e.getBoundingClientRect().right).length }))
    conta(lote.sobra <= 0 && lote.botoes === 0, `tabela ${largura}: a faixa do lote quebra em duas linhas em vez de estourar`)
    await pg.screenshot({ path: `${PASTA}/tabela-${largura}-light.png`, fullPage: false })
    conta(erros.length === 0, `tabela ${largura}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* A COR ARQUIVADA VOLTA: cadastrar de novo uma cor que foi arquivada reativa a
   que já existe, em vez de bater na trava do nome repetido. */
for (const arquivada of [true, false]) {
  await caso(arquivada ? 'cor arquivada volta' : 'cor nova nasce', async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', arquivada })
    await ir(pg, '/estoque', '[data-arvore]')
    await abrirGrupo(pg)
    await pg.locator('[data-arvore] .em-t[data-tecido="DRYFIT JAKAR 100%"] .em-t-nova').click(); await pausa(pg, 700)
    await escolherCor(pg, 'LR', 'Laranja')
    await pg.locator('dialog[open] .es-novo-tres input[inputmode=decimal]').fill('25'); await pausa(pg, 150)
    await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 900)
    const criou = gravados.filter((g) => /^material\?select=id$/.test(String(g.u)))
    const reativou = gravados.filter((g) => /^material\?id=eq\.arquivado-1/.test(String(g.u)))
    const aviso = await pg.locator('.toast, [role="status"]').allInnerTexts().then((t) => t.join(' ').replace(/\s+/g, ' '))
    if (arquivada) conta(criou.length === 0 && reativou.length === 1 && reativou[0].corpo.ativo === true && reativou[0].corpo.minimo === 25 && /estava arquivado e voltou/.test(aviso), `cor arquivada volta: o cadastro reativa a cor que já existia, com o mínimo novo, e não cria outra (${JSON.stringify(reativou[0]?.corpo ?? null)}; ${aviso.slice(0, 90)})`)
    else conta(criou.length === 1 && reativou.length === 0 && criou[0].corpo.minimo === 25 && /entrou no estoque, com saldo zero/.test(aviso), `cor nova nasce: sem arquivada igual, o cadastro cria o material como sempre (${aviso.slice(0, 80)})`)
    conta(erros.length === 0, `${arquivada ? 'cor arquivada volta' : 'cor nova nasce'}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* SEM DEPÓSITO DESENHADO (é o estado da produção em 05/10/2026) a Tabela não
   mostra a coluna "Onde está" vazia, nem oferece "Definir onde está". */
await caso('tabela sem depósito', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', deposito: 'vazio' })
  await ir(pg, '/estoque', '[data-barra]')
  await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
  await pg.locator('table.es-tb tr[data-faixa="DRY FIT"]').click(); await pausa(pg, 250)
  await pg.locator('table.es-tb tr.es-malha.es-recolhe').click(); await pausa(pg, 250)
  const cab = (await pg.locator('table.es-tb thead th').allInnerTexts()).map((c) => c.trim()).join(' | ')
  const celulas = await pg.locator('table.es-tb tbody tr').evaluateAll((l) => [...new Set(l.map((tr) => tr.children.length))].join(','))
  const chips = (await pg.locator('[data-tabela-topo] .chip').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim()).join(' | ')
  conta(cab === ' | Grupo, tecido e cor | Fornecedor | Livre | Na prateleira | Reservado | Mínimo | Situação' && celulas === '8' && !/Sem lugar/.test(chips), `tabela sem depósito: a coluna "Onde está" e o filtro "Sem lugar marcado" não aparecem, e toda linha tem as mesmas 8 células (${cab}; ${celulas} células; ${chips})`)
  await pg.locator('table.es-tb tr.es-malha.es-recolhe td.es-ck .ck').click(); await pausa(pg, 300)
  const botoes = (await pg.locator('[data-lote-da-tabela]').getByRole('button').allInnerTexts()).map((b) => b.trim()).join(' | ')
  conta(botoes === 'Definir fornecedor | Definir mínimo | Ficha técnica | Limpar a seleção', `tabela sem depósito: o lote não oferece "Definir onde está" (${botoes})`)
  conta(erros.length === 0, `tabela sem depósito: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* O BANCO É QUEM TRAVA A FICHA: se ele recusa, a ficha fica aberta com o
   motivo, e o que a pessoa escreveu não se perde. */
await caso('ficha recusada', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', recusa: 1 })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 250)
  await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 500)
  await pg.locator('[data-ficha-tecnica]').getByRole('button', { name: 'Editar a ficha' }).click(); await pausa(pg, 600)
  await pg.locator('dialog[open] input[aria-label="Gramatura"]').fill('205'); await pausa(pg, 150)
  await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Salvar a ficha' }).click(); await pausa(pg, 800)
  conta(await pg.locator('dialog[open] [data-editar-ficha]').count() === 1 && /A composição soma 90%, e tem de somar 100/.test(await texto(pg, 'dialog[open] [data-editar-ficha]')) && await pg.locator('dialog[open] input[aria-label="Gramatura"]').inputValue() === '205', `ficha recusada: quando o banco recusa, a ficha continua aberta, mostra o motivo e guarda o que foi escrito`)
  await pg.screenshot({ path: `${PASTA}/ficha-recusada-1440-light.png`, fullPage: false })
  await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Salvar a ficha' }).click(); await pausa(pg, 800)
  conta(await pg.locator('dialog[open]').count() === 0 && gravados.filter((g) => g.u === 'rpc/definir_cadastro').length === 2, 'ficha recusada: salvar de novo passa, e a ficha fecha')
  conta(erros.length === 0, `ficha recusada: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* A FICHA NO CELULAR: as duas colunas viram uma, e nada estoura */
await caso('ficha técnica 390', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema: 'dark' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 250)
  await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 500)
  conta(await pg.locator('[data-ficha-tecnica] .ft-simbolo').count() === 6 && (await sobra(pg)) <= 0, 'ficha técnica 390: o cartão da ficha cabe no celular, com os 6 símbolos')
  await pg.screenshot({ path: `${PASTA}/ficha-tecnica-390-dark.png`, fullPage: true })
  await pg.locator('[data-ficha-tecnica]').getByRole('button', { name: 'Editar a ficha' }).click(); await pausa(pg, 600)
  const ed = await pg.locator('dialog[open] [data-editar-ficha]').evaluate((e) => ({ colunas: getComputedStyle(e).gridTemplateColumns.split(' ').length, sobra: e.scrollWidth - e.clientWidth, botao: Math.round(e.querySelector('.ft-botao').getBoundingClientRect().width) }))
  conta(ed.colunas === 1 && ed.sobra <= 0 && ed.botao >= 40 && await pg.locator('dialog[open] .ft-botao').count() === 38, `ficha técnica 390: no celular o editor fica em uma coluna, os 38 símbolos com 40 px de toque, sem rolar para o lado (${JSON.stringify(ed)})`)
  await pg.screenshot({ path: `${PASTA}/editar-ficha-390-dark.png`, fullPage: false })
  conta(erros.length === 0, `ficha técnica 390: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* ESTATÍSTICAS (pedido do Henrique, 05/10/2026): quanto tecido saiu por tecido
   e por cor, no mês, em 3 meses e no semestre, para saber o que comprar. */
for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  await caso(`estatísticas ${T}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema })
    const K = await (async () => { await ir(pg, '/estoque', '[data-arvore]'); return tokens(pg, ['--ink', '--brand-text', '--text-3']) })()
    const abas = (await pg.locator('[data-barra] > .em-seg button').allInnerTexts()).map((b) => b.trim()).join(' | ')
    const seg = await pg.locator('[data-barra] > .em-seg').evaluate((e) => ({ cabe: e.scrollWidth <= e.clientWidth + 1, cortado: [...e.querySelectorAll('button')].some((b) => b.scrollWidth > b.clientWidth + 1) }))
    conta(abas === 'Materiais | Movimentos | Depósito | Estatísticas' && seg.cabe && !seg.cortado, `${T} estatísticas: a barra tem as quatro abas, e nenhuma fica cortada (${abas})`)
    await pg.locator('[data-barra] > .em-seg').getByRole('tab', { name: 'Estatísticas' }).click(); await pg.waitForSelector('[data-estatisticas]'); await pausa(pg, 500)
    const periodo = (await pg.locator('[data-barra] .em-barra-fim button').allInnerTexts()).map((b) => b.trim()).join(' | ')
    conta(periodo === 'Mês | 3 meses | Semestre' && /ligado/.test(await pg.locator('[data-barra] .em-barra-fim button', { hasText: 'Mês' }).getAttribute('class')), `${T} estatísticas: o período fica no fim da barra, e abre no mês (${periodo})`)
    const numeros = (await pg.locator('[data-numeros] .kpi').allInnerTexts()).map((k) => k.replace(/\s+/g, ' ').trim())
    conta(/^Tecido usado 60 ?kg nos últimos 30 dias$/.test(numeros[0]) && /^O tecido que mais sai 42 ?kg DRYFIT POLIESTER 100% · 70% do total$/.test(numeros[1]) && /^Acabam em menos de 30 dias 1 ?cor/.test(numeros[2]) && /^Paradas 6 ?cores/.test(numeros[3]), `${T} estatísticas: os quatro números do período (${numeros.join(' | ')})`)
    conta(/aviso/.test(await pg.locator('[data-numeros] .kpi').nth(2).getAttribute('class')), `${T} estatísticas: o número das cores que acabam em menos de 30 dias vem em aviso`)

    /* por tecido, o que mais sai primeiro, fechado */
    const tecidos = await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido]').evaluateAll((l) => l.map((e) => e.dataset.tecido + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
    conta(tecidos.join(' | ') === 'DRYFIT POLIESTER 100% | MOLETOM | PIQUET 100% | ALGODAO 100% | ALGODAO MESCLA SEM ELASTANO | HELANCA COLEGIAL' && await pg.locator('[data-uso-por-tecido] .eu-cor').count() === 0, `${T} estatísticas: os tecidos em ordem do que mais saiu, com as sanfonas fechadas (${tecidos.join(' | ')})`)
    const dry = await texto(pg, '.eu-linha[data-tecido="DRYFIT POLIESTER 100%"]')
    conta(/DRYFIT POLIESTER 100% 4 cores 42 kg 70% livre 81 kg dá para 58 dias$/.test(dry), `${T} estatísticas: a linha do tecido diz o usado, a parte do total, o livre e quanto dura (${dry})`)
    const barras = await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido] .eu-barra').evaluateAll((l) => l.map((e) => Math.round(e.firstElementChild.getBoundingClientRect().width / e.getBoundingClientRect().width * 100)))
    const tinta = await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido] .eu-barra i').first().evaluate((e) => getComputedStyle(e).backgroundColor)
    conta(barras[0] === 100 && Math.abs(barras[1] - 36) <= 1 && Math.abs(barras[2] - 7) <= 1 && barras[3] === 0 && tinta === K['--ink'], `${T} estatísticas: a barra é proporcional ao tecido que mais saiu, na tinta do sistema (${barras.join(' ')})`)

    /* abre nas cores */
    await pg.locator('.eu-linha[data-tecido="DRYFIT POLIESTER 100%"]').click(); await pausa(pg, 300)
    const cores = await pg.locator('[data-uso-por-tecido] .eu-cor').evaluateAll((l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
    conta(cores.length === 4 && /^Preto comprar 30 kg 71% livre 3 kg dá para 3 dias$/.test(cores[0]) && /^Branco 12 kg 29% livre 42 kg dá para 4 meses$/.test(cores[1]) && /^Azul Marinho 0 kg livre 24 kg sem saída no período$/.test(cores[2]), `${T} estatísticas: o tecido abre nas cores, a que mais sai primeiro, cada uma com a parte dela dentro do tecido (${cores.join(' | ')})`)
    const curta = await pg.locator('.eu-cor[data-material="DRYFIT POLIESTER 100% · Preto"] .eu-dias').evaluate((e) => getComputedStyle(e).color)
    const corBarra = await pg.locator('.eu-cor[data-material="DRYFIT POLIESTER 100% · Preto"] .eu-barra').evaluate((e) => Math.round(e.firstElementChild.getBoundingClientRect().width / e.getBoundingClientRect().width * 100))
    conta(curta === K['--brand-text'] && Math.abs(corBarra - 71) <= 1, `${T} estatísticas: a cor que acaba em 3 dias vem em vermelho, e a barra dela usa a mesma régua do tecido (${corBarra}%)`)

    /* a prioridade de compra */
    const pri = await pg.locator('[data-prioridade] .eu-pri').evaluateAll((l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
    conta(pri.length === 4 && /^DRYFIT POLIESTER 100% · Preto livre 3 kg · saem 30 kg por mês · abaixo do mínimo 3 dias$/.test(pri[0]) && /^MOLETOM · Preto .* 32 dias$/.test(pri[1]) && /2 meses$/.test(pri[2]) && /4 meses$/.test(pri[3]), `${T} estatísticas: a prioridade de compra põe na frente a cor que acaba antes, e não a que tem menos (${pri.join(' | ')})`)

    /* o mês a mês */
    const meses = await pg.locator('[data-mes-a-mes] .eu-mes').evaluateAll((l) => l.map((e) => ({ v: e.querySelector('.eu-mes-valor').textContent.trim(), alto: Math.round(e.querySelector('i').getBoundingClientRect().height), corrente: e.classList.contains('corrente') })))
    conta(meses.length === 6 && meses.map((m) => m.v).join(' ') === '40 41 36 43 41 60' && meses[5].corrente && meses[5].alto > meses[3].alto && meses[3].alto > meses[2].alto && /média de 40,2 kg por mês/.test(await texto(pg, '[data-mes-a-mes] .eu-topo')), `${T} estatísticas: os seis meses com o valor em cima de cada coluna, o corrente marcado, e a média dos cinco fechados (${meses.map((m) => m.v + ':' + m.alto).join(' ')})`)
    await pg.screenshot({ path: `${PASTA}/estatisticas-1440-${tema}.png`, fullPage: true })
    conta((await sobra(pg)) <= 0, `${T} estatísticas: nada rola para o lado`)

    /* trocar o período refaz tudo */
    await pg.locator('[data-barra] .em-barra-fim button', { hasText: '3 meses' }).click(); await pausa(pg, 400)
    const tres = (await pg.locator('[data-numeros] .kpi').first().innerText()).replace(/\s+/g, ' ').trim()
    const pri3 = await texto(pg, '[data-prioridade] .eu-pri')
    conta(/^Tecido usado 144 ?kg nos últimos 90 dias$/.test(tres) && /DRYFIT POLIESTER 100% · Preto livre 3 kg · saem 28 kg por mês · abaixo do mínimo 3 dias$/.test(pri3) && await pg.locator('[data-uso-por-tecido] .eu-cor').count() === 4, `${T} estatísticas: em 3 meses o total passa a 144 kg, o ritmo por mês é recalculado e o tecido aberto continua aberto (${tres}; ${pri3})`)
    await pg.locator('[data-barra] .em-barra-fim button', { hasText: 'Semestre' }).click(); await pausa(pg, 400)
    conta(/^Tecido usado 261 ?kg nos últimos 180 dias$/.test((await pg.locator('[data-numeros] .kpi').first().innerText()).replace(/\s+/g, ' ').trim()), `${T} estatísticas: no semestre, 261 kg`)

    /* a busca filtra a lista, e abre o que sobrou */
    await pg.fill('[data-barra] .em-busca input', 'moletom'); await pausa(pg, 500)
    conta(await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido]').count() === 1 && await pg.locator('[data-uso-por-tecido] .eu-cor').count() === 1 && await pg.locator('[data-prioridade] .eu-pri').count() === 1 && /^Tecido usado 261/.test((await pg.locator('[data-numeros] .kpi').first().innerText()).replace(/\s+/g, ' ').trim()), `${T} estatísticas: a busca deixa só o moletom na lista e na prioridade, já aberto, e os números do alto continuam sendo do estoque inteiro`)
    await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 400)

    /* clicar na cor abre a ficha dela */
    await pg.locator('[data-prioridade] .eu-pri').first().click(); await pausa(pg, 600)
    conta(/› cor/.test(await texto(pg, '[data-ficha] .em-trilha')) && /Preto/.test(await texto(pg, '[data-ficha] .em-ficha-topo')), `${T} estatísticas: clicar numa cor da prioridade abre a ficha dela em Materiais`)
    conta(erros.length === 0, `${T} estatísticas: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

await caso('estatísticas, estoque grande', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1366, altura: 800, tema: 'light', estoque: 'grande' })
  await ir(pg, '/estoque?aba=uso', '[data-estatisticas]')
  conta(/ligado/.test(await pg.locator('[data-barra] > .em-seg button', { hasText: 'Estatísticas' }).getAttribute('class')), 'estatísticas grande: o endereço ?aba=uso abre direto nas estatísticas')
  const barra = await pg.locator('[data-barra]').evaluate((e) => ({ cabe: [...e.children].every((c) => c.scrollWidth <= c.clientWidth + 1), cortado: [...e.querySelectorAll('.seg button')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim()) }))
  conta(barra.cabe && barra.cortado.length === 0, `estatísticas grande: em 1366 as quatro abas e os três períodos cabem na barra sem corte (${barra.cortado.join(', ') || 'nenhum cortado'})`)
  await pg.locator('.eu-linha[data-tecido="DRYFIT POLIESTER 100%"]').click(); await pausa(pg, 300)
  conta(await pg.locator('[data-uso-por-tecido] .eu-cor').count() === 2 && /Ver as 28 cores sem saída no período/.test(await texto(pg, '[data-paradas="DRYFIT POLIESTER 100%"]')), 'estatísticas grande: num tecido de 30 cores, abrem as 2 que saíram, e as 28 paradas ficam atrás de um botão')
  await pg.screenshot({ path: `${PASTA}/estatisticas-grande-1366-light.png`, fullPage: true })
  await pg.locator('[data-paradas="DRYFIT POLIESTER 100%"]').click(); await pausa(pg, 300)
  conta(await pg.locator('[data-uso-por-tecido] .eu-cor').count() === 30 && await pg.locator('[data-paradas]').count() === 0 && (await sobra(pg)) <= 0, 'estatísticas grande: o botão mostra as 30, e nada rola para o lado')
  conta(erros.length === 0, `estatísticas grande: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

for (const [nome, uso, espera] of [['sem uso', 'vazio', /Nada saiu neste período/], ['com erro', 'erro', /Não consegui ler as estatísticas/]]) {
  await caso(`estatísticas ${nome}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', uso })
    await ir(pg, '/estoque?aba=uso', '[data-barra]'); await pausa(pg, 600)
    const corpo = await texto(pg, '.pagina')
    conta(espera.test(corpo), `estatísticas ${nome}: a tela diz o que houve (${(corpo.match(espera) ?? ['nada'])[0]})`)
    if (uso === 'vazio') conta(/^Tecido usado 0 ?kg/.test((await pg.locator('[data-numeros] .kpi').first().innerText()).replace(/\s+/g, ' ').trim()) && /Sem previsão/.test(await texto(pg, '[data-prioridade]')) && await pg.locator('[data-mes-a-mes] .eu-mes').count() === 6, 'estatísticas sem uso: os números zeram, a prioridade diz que não há previsão e o mês a mês continua com os seis meses')
    else conta(await pg.getByRole('button', { name: 'Tentar de novo' }).count() === 1 && await pg.locator('[data-estatisticas]').count() === 0 && await pg.locator('[data-barra] > .em-seg').count() === 1, 'estatísticas com erro: sobra o botão de tentar de novo, e o resto da página continua de pé')
    await pg.screenshot({ path: `${PASTA}/estatisticas-${uso}-1440-light.png`, fullPage: true })
    conta(erros.length === 0, `estatísticas ${nome}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

for (const [largura, altura, tema] of [[820, 1100, 'light'], [390, 844, 'dark']]) {
  await caso(`estatísticas ${largura}`, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema })
    await ir(pg, '/estoque?aba=uso', '[data-estatisticas]')
    const periodo = await pg.locator('.eu-periodo button').count()
    const colunas = await pg.locator('.eu-dois').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
    const kpis = await pg.locator('[data-numeros]').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
    conta(periodo === 3 && colunas === 1 && kpis === (largura < 600 ? 2 : 4) && (await sobra(pg)) <= 0, `estatísticas ${largura}: o período desce para a página, os cartões ficam em uma coluna, os números em ${largura < 600 ? 'dois a dois' : 'uma fileira'}, e nada rola para o lado (${periodo} períodos, ${colunas} coluna, ${kpis} números por fileira)`)
    await pg.locator('.eu-linha[data-tecido]').first().click(); await pausa(pg, 300)
    if (largura < 600) {
      const linha = await pg.locator('.eu-cor').first().evaluate((e) => { const n = e.querySelector('.eu-nome').getBoundingClientRect(); const b = e.querySelector('.eu-barra').getBoundingClientRect(); return { embaixo: b.top >= n.bottom - 1, cabeca: getComputedStyle(document.querySelector('.eu-cabeca')).display } })
      conta(linha.embaixo && linha.cabeca === 'none', `estatísticas ${largura}: no celular a barra desce para baixo do nome, e o cabeçalho de colunas some`)
      const alvos = await pg.locator('.eu-linha, .eu-pri, .eu-resto').evaluateAll((l) => l.filter((e) => e.getBoundingClientRect().height < 40).length)
      conta(alvos === 0, `estatísticas ${largura}: toda linha tem altura de toque (${alvos} abaixo de 40 px)`)
    }
    await pg.locator('.eu-periodo button', { hasText: 'Semestre' }).click(); await pausa(pg, 400)
    conta(/261/.test(await pg.locator('[data-numeros] .kpi').first().innerText()), `estatísticas ${largura}: o período da página troca os números`)
    await pg.screenshot({ path: `${PASTA}/estatisticas-${largura}-${tema}.png`, fullPage: true })
    conta(erros.length === 0, `estatísticas ${largura}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* A TABELA TEM OS MESMOS GRUPOS E TECIDOS DA LISTA (pedido do Henrique,
   05/10/2026): o catálogo inteiro, com o tecido sem cor nenhuma apagado. */
await caso('tabela igual à lista', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque', '[data-arvore]')
  const daLista = await pg.locator('[data-arvore] .em-g').evaluateAll((l) => l.map((e) => e.dataset.grupo))
  await abrirGrupo(pg)
  const tecidosDaLista = await pg.locator('[data-arvore] .em-t').evaluateAll((l) => l.map((e) => e.dataset.tecido + (e.hasAttribute('data-sem-estoque') ? ' (vazio)' : '')))
  await pg.locator('[data-barra] .em-barra-fim').getByRole('tab', { name: 'Tabela' }).click(); await pausa(pg, 400)
  const TB = 'table.es-tb'
  const daTabela = await pg.locator(`${TB} tr[data-faixa]`).evaluateAll((l) => l.map((e) => e.dataset.faixa))
  conta(daTabela.join(' | ') === daLista.join(' | ') && daTabela.includes('SUPLEX') && daTabela.includes('VISCOSE'), `tabela igual à lista: os mesmos grupos, na mesma ordem, inclusive os que não têm estoque (${daTabela.join(' | ')})`)
  const suplex = await texto(pg, `${TB} tr[data-faixa="SUPLEX"]`)
  conta(/SUPLEX 1 tecido · sem estoque$/.test(suplex) && await pg.locator(`${TB} tr[data-faixa="SUPLEX"] .ck`).count() === 0, `tabela igual à lista: o grupo sem estoque diz isso, e não tem caixa de marcar (${suplex})`)
  await pg.locator(`${TB} tr[data-faixa="DRY FIT"]`).click(); await pausa(pg, 300)
  const tecidosDaTabela = await pg.locator(`${TB} tr.es-malha`).evaluateAll((l) => l.map((e) => (e.dataset.faixa ?? e.dataset.semEstoque) + (e.hasAttribute('data-sem-estoque') ? ' (vazio)' : '')))
  conta(tecidosDaTabela.join(' | ') === tecidosDaLista.join(' | ') && tecidosDaTabela.join(' | ') === 'DRYFIT POLIESTER 100% | DRYFIT JAKAR 100% (vazio)', `tabela igual à lista: os mesmos tecidos do grupo, o que tem estoque primeiro (${tecidosDaTabela.join(' | ')})`)
  const vazio = pg.locator(`${TB} tr[data-sem-estoque="DRYFIT JAKAR 100%"]`)
  const celulas = await pg.locator(`${TB} tbody tr`).evaluateAll((l) => [...new Set(l.map((tr) => tr.children.length))].join(','))
  conta(/^DRYFIT JAKAR 100% sem estoque Nova cor$/.test((await vazio.innerText()).replace(/\s+/g, ' ').trim()) && await vazio.locator('.ck').count() === 0 && celulas === '9', `tabela igual à lista: o tecido sem cor vem apagado, com "sem estoque" e "Nova cor", sem caixa de marcar e com as mesmas 9 células das outras linhas (${celulas})`)
  await pg.screenshot({ path: `${PASTA}/tabela-catalogo-1440-light.png`, fullPage: true })
  /* a caixa do cabeçalho continua marcando só o que existe */
  await pg.locator(`${TB} thead th.es-ck .ck`).click(); await pausa(pg, 300)
  conta(/^10 selecionados/.test(await pg.locator('[data-lote-da-tabela]').innerText()), 'tabela igual à lista: marcar tudo marca as 10 cores que existem, e os tecidos vazios não entram na conta')
  await pg.locator(`${TB} thead th.es-ck .ck`).click(); await pausa(pg, 300)
  /* filtro ligado: só o que passa nele */
  await pg.locator('[data-tabela-topo] .chip', { hasText: 'Para comprar' }).click(); await pausa(pg, 400)
  conta(await pg.locator(`${TB} tr[data-sem-estoque]`).count() === 0 && !(await pg.locator(`${TB} tr[data-faixa]`).evaluateAll((l) => l.map((e) => e.dataset.faixa))).includes('SUPLEX'), 'tabela igual à lista: com um filtro ligado, o grupo e o tecido sem estoque saem, porque não passam em filtro nenhum')
  await pg.locator('[data-tabela-topo] .chip', { hasText: 'Para comprar' }).click(); await pausa(pg, 400)
  /* a busca pelo nome do tecido vazio acha ele, como na lista */
  await pg.fill('[data-barra] .em-busca input', 'jakar'); await pausa(pg, 500)
  conta(await pg.locator(`${TB} tr[data-sem-estoque="DRYFIT JAKAR 100%"]`).count() === 1 && await pg.locator(`${TB} tr.es-folha`).count() === 0, 'tabela igual à lista: a busca pelo nome acha o tecido sem estoque')
  await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 400)
  /* "Nova cor" abre o cadastro já naquele tecido */
  await pg.locator(`${TB} tr[data-faixa="DRY FIT"]`).click(); await pausa(pg, 300)
  await pg.locator(`${TB} tr[data-sem-estoque="DRYFIT JAKAR 100%"] .es-nova-cor`).click(); await pausa(pg, 700)
  conta(/DRYFIT JAKAR 100%/.test(await texto(pg, 'dialog[open] .es-novo')) && await pg.locator('dialog[open] .es-familia').count() === 13, 'tabela igual à lista: "Nova cor" abre o cadastro já na malha daquele tecido, com as famílias de cor')
  await pg.keyboard.press('Escape'); await pausa(pg, 300)
  conta(erros.length === 0, `tabela igual à lista: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* O LUGAR NO CADASTRO DA COR (pedido do Henrique, 05/10/2026): com o depósito
   desenhado, "onde fica" abre o desenho para clicar no lugar e já marcar. */
await caso('cor nova com lugar', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator('[data-arvore] .em-t[data-tecido="DRYFIT JAKAR 100%"] .em-t-nova').click(); await pausa(pg, 700)
  const onde = pg.locator('dialog[open] [data-onde-fica]')
  conta(await onde.count() === 1 && /ainda sem lugar/.test(await onde.innerText()) && await onde.getByRole('button', { name: 'Marcar no depósito' }).isDisabled() && await pg.locator('dialog[open] input[placeholder="Prateleira, armário ou caixa"]').count() === 0, 'cor nova com lugar: com o depósito desenhado, o cadastro troca o texto livre pelo botão de marcar, que espera a cor ser escolhida')
  await escolherCor(pg, 'LR', 'Laranja')
  await onde.getByRole('button', { name: 'Marcar no depósito' }).click(); await pausa(pg, 600)
  const caixaDeMarcar = pg.locator('dialog[open]').last()
  conta(await pg.locator('dialog[open]').count() === 2 && /^Onde vai ficar DRYFIT JAKAR 100% · Laranja\?/.test((await caixaDeMarcar.locator('.sobre-topo').innerText()).trim()) && await caixaDeMarcar.locator('[data-lugar]').count() > 20 && await caixaDeMarcar.getByRole('button', { name: 'Usar este lugar' }).isDisabled(), 'cor nova com lugar: o botão abre o desenho do depósito por cima do cadastro, com o nome da cor, e não deixa confirmar sem lugar apontado')
  await pg.screenshot({ path: `${PASTA}/cor-nova-marcar-1440-light.png`, fullPage: false })
  await caixaDeMarcar.locator('[data-lugar="P07"]').click(); await pausa(pg, 300)
  await caixaDeMarcar.getByRole('button', { name: 'Usar este lugar' }).click(); await pausa(pg, 500)
  conta(await pg.locator('dialog[open]').count() === 1 && /Palete P07/.test(await onde.innerText()) && await onde.getByRole('button', { name: 'Mudar o lugar' }).count() === 1 && !gravados.some((g) => g.u === 'rpc/definir_lugares'), `cor nova com lugar: escolhido o lugar, a caixa fecha, o cadastro mostra onde vai ficar e nada foi para o banco ainda (${(await onde.innerText()).replace(/\s+/g, ' ').trim().slice(0, 110)})`)
  conta(await pg.locator('dialog[open] .es-novo-chips .chip.ligado', { hasText: /^Laranja$/ }).count() === 1, 'cor nova com lugar: a cor escolhida continua lá depois de marcar o lugar')
  await pg.screenshot({ path: `${PASTA}/cor-nova-com-lugar-1440-light.png`, fullPage: false })
  await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 900)
  const criou = gravados.findIndex((g) => /^material\?select=id$/.test(String(g.u)))
  const marcou = gravados.findIndex((g) => g.u === 'rpc/definir_lugares')
  const lg = gravados[marcou]?.corpo ?? {}
  conta(criou >= 0 && marcou > criou && JSON.stringify(lg.p_materiais) === JSON.stringify(['novo-' + (criou + 1)]) && JSON.stringify(lg.p_lugares) === JSON.stringify([{ movel: 'pal-07', vao: null, nivel: null }]), `cor nova com lugar: o material nasce e, logo depois, o lugar apontado vai para o banco no id dele (${JSON.stringify(lg)})`)
  conta(erros.length === 0, `cor nova com lugar: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

await caso('cor nova sem depósito', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', deposito: 'vazio' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator('[data-arvore] .em-t[data-tecido="DRYFIT JAKAR 100%"] .em-t-nova').click(); await pausa(pg, 700)
  conta(await pg.locator('dialog[open] [data-onde-fica]').count() === 0 && await pg.locator('dialog[open] input[placeholder="Prateleira, armário ou caixa"]').count() === 1, 'cor nova sem depósito: sem depósito desenhado, o cadastro continua com o texto livre de onde fica')
  await escolherCor(pg, 'LR', 'Laranja')
  await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 900)
  conta(gravados.some((g) => /^material\?select=id$/.test(String(g.u))) && !gravados.some((g) => g.u === 'rpc/definir_lugares'), 'cor nova sem depósito: o material nasce e nenhum lugar é gravado')
  conta(erros.length === 0, `cor nova sem depósito: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* ESTATÍSTICAS DE AVIAMENTO E INSUMO (pedido do Henrique, 05/10/2026) */
await caso('estatísticas de aviamento e insumo', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque?aba=uso', '[data-estatisticas]')
  const abas = await texto(pg, '[data-estatisticas-alto] .eu-categoria')
  conta(/Tecido 10 Aviamentos 7 Insumo 9/.test(abas) && /ligado/.test(await pg.locator('[data-estatisticas-alto] .eu-categoria button', { hasText: 'Tecido' }).getAttribute('class')) && await pg.locator('input[placeholder="Buscar material, cor ou fornecedor"]').count() === 1, `estatísticas: as três abas da árvore e da tabela, com a conta, abrindo em Tecido (${abas})`)
  const kpis = async () => (await pg.locator('[data-numeros] .kpi').allInnerTexts()).map((k) => k.replace(/\s+/g, ' ').trim())
  const linhas = () => pg.locator('[data-uso-por-tecido] .eu-linha').evaluateAll((l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  const abrirTudo = async () => { for (const l of await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido]').all()) if (await l.getAttribute('aria-expanded') !== 'true') await l.click(); await pausa(pg, 300) }

  /* aviamentos: uma unidade só por grupo, então o grupo tem soma */
  await pg.locator('[data-estatisticas-alto] .eu-categoria').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg, 500)
  let k = await kpis()
  conta(/^Itens que saíram 1 ?item de 7 · nos últimos 30 dias$/.test(k[0]) && /^O que acaba primeiro 5 ?meses Linha poliéster 120 branca$/.test(k[1]) && /^Acabam em menos de 30 dias 0 ?itens/.test(k[2]) && /^Parados 6 ?itens/.test(k[3]), `estatísticas aviamento: os números falam em itens, sem somar unidades diferentes (${k.join(' | ')})`)
  const grupos = await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido]').evaluateAll((l) => l.map((e) => e.dataset.tecido + (e.getAttribute('aria-expanded') === 'true' ? '*' : '')))
  conta(grupos[0] === 'Linha' && grupos.length === 5 && grupos.every((g) => !g.endsWith('*')) && /Uso por grupo/.test(await texto(pg, '[data-uso-por-tecido] .eu-topo')) && /^Grupo e item/.test(await texto(pg, '[data-uso-por-tecido] .eu-cabeca')), `estatísticas aviamento: os grupos do cadastro, fechados, com o que teve saída na frente (${grupos.join(' | ')})`)
  await abrirTudo()
  let l = await linhas()
  conta(/^Linha 2 itens 4 cone livre 29 cone dá para 7 meses$/.test(l[0]) && /^Linha poliéster 120 branca 4 cone 100% livre 18 cone dá para 5 meses$/.test(l[1]) && /^Linha poliéster 120 preta 0 cone livre 11 cone sem saída no período$/.test(l[2]), `estatísticas aviamento: o grupo de uma unidade só soma, e cada item mostra o usado na unidade dele (${l.slice(0, 3).join(' | ')})`)
  const pri = await pg.locator('[data-prioridade] .eu-pri').evaluateAll((x) => x.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  conta(pri.length === 1 && /^Linha poliéster 120 branca livre 18 cone · saem 4 cone por mês 5 meses$/.test(pri[0]), `estatísticas aviamento: a prioridade de compra vale também aqui, na unidade do item (${pri.join(' | ')})`)
  conta(/média de 4 cone por mês/.test(await texto(pg, '[data-mes-a-mes] .eu-topo')) && await pg.locator('[data-mes-a-mes] .eu-mes').count() === 6 && /Em cone\./.test(await texto(pg, '[data-mes-a-mes]')), 'estatísticas aviamento: o mês a mês sai na unidade do que saiu (cone)')
  await pg.screenshot({ path: `${PASTA}/estatisticas-aviamento-1440-light.png`, fullPage: true })

  /* insumo: grupos com unidades misturadas não somam */
  await pg.locator('[data-estatisticas-alto] .eu-categoria').getByRole('tab', { name: /Insumo/ }).click(); await pausa(pg, 500)
  k = await kpis()
  conta(/^Itens que saíram 1 ?item de 9/.test(k[0]) && /^O que acaba primeiro 45 ?dias Tinta sublimática magenta$/.test(k[1]) && /^Parados 8 ?itens/.test(k[3]), `estatísticas insumo: os números (${k.join(' | ')})`)
  await abrirTudo()
  l = await linhas()
  conta(/^Sublimação 3 itens 1 item saiu unidades diferentes, sem soma$/.test(l[0]) && /^Tinta sublimática magenta comprar 0,4 L livre 0,6 L dá para 45 dias$/.test(l[1]) && /^Papel sublimático 100 g 0 m livre 380 m sem saída no período$/.test(l[2]) && l.some((x) => /^DTF 3 itens sem saída no período unidades diferentes, sem soma$/.test(x)) && l.some((x) => /^Embalagem 1 item 0 un livre 900 un/.test(x)), `estatísticas insumo: o grupo que mistura litro, metro e quilo não soma, e diz isso; o item mostra o dele (${l.slice(0, 3).join(' | ')})`)
  const barras = await pg.locator('[data-uso-por-tecido] .eu-cor .eu-barra').evaluateAll((x) => x.map((e) => Math.round(e.firstElementChild.getBoundingClientRect().width / e.getBoundingClientRect().width * 100)))
  conta(barras[0] === 100 && barras.slice(1).every((b) => b === 0), `estatísticas insumo: a barra compara só dentro da mesma unidade (a tinta magenta, única em litro com saída, enche a régua) (${barras.join(' ')})`)
  conta(/média de 0,4 L por mês/.test(await texto(pg, '[data-mes-a-mes] .eu-topo')), 'estatísticas insumo: o mês a mês sai em litro')
  await pg.screenshot({ path: `${PASTA}/estatisticas-insumo-1440-light.png`, fullPage: true })

  /* a busca leva para a aba onde achou */
  await pg.fill('[data-barra] .em-busca input', 'moletom'); await pausa(pg, 600)
  conta(/ligado/.test(await pg.locator('[data-estatisticas-alto] .eu-categoria button', { hasText: 'Tecido' }).getAttribute('class')) && await pg.locator('[data-uso-por-tecido] .eu-linha[data-tecido]').count() === 1, 'estatísticas: a busca por um tecido, feita na aba Insumo, leva para a aba Tecido')
  await pg.fill('[data-barra] .em-busca input', ''); await pausa(pg, 400)
  /* clicar no item abre a ficha dele */
  await pg.locator('[data-estatisticas-alto] .eu-categoria').getByRole('tab', { name: /Insumo/ }).click(); await pausa(pg, 400)
  await pg.locator('[data-prioridade] .eu-pri').first().click(); await pausa(pg, 600)
  conta(/Insumo › Sublimação › item/.test(await texto(pg, '[data-ficha] .em-trilha')), 'estatísticas insumo: clicar no item da prioridade abre a ficha dele em Materiais')
  conta(erros.length === 0, `estatísticas de aviamento e insumo: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* O MÍNIMO RECOMENDADO (pedido do Henrique, 05/10/2026): a média do que saiu no
   último mês e do mês médio dos últimos três, escrita ao lado do campo. */
await caso('mínimo recomendado', async () => {
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 250)
  const editar = async () => { await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pg.waitForSelector('dialog[open] [data-recomendado]'); await pausa(pg, 400) }
  const rec = () => texto(pg, 'dialog[open] [data-recomendado]')
  const minimo = pg.locator('dialog[open] input[aria-label="Mínimo no estoque"]')

  /* uma cor: saiu 30 no mês e 84 em três (28 por mês): a média é 29 */
  await pg.locator(cor('DRYFIT POLIESTER 100% · Preto')).click(); await pausa(pg, 400)
  await editar()
  conta(/^Recomendado: 29 kg Usar É a média entre o que saiu no último mês \(30 kg\) e o mês médio dos últimos três \(28 kg\)\.$/.test(await rec()) && await minimo.inputValue() === '20', `mínimo recomendado: debaixo do campo, o recomendado de 29 kg e de onde ele vem (${await rec()})`)
  await pg.screenshot({ path: `${PASTA}/minimo-recomendado-1440-light.png`, fullPage: false })
  await pg.locator('dialog[open] [data-recomendado]').getByRole('button', { name: 'Usar' }).click(); await pausa(pg, 300)
  conta(await minimo.inputValue() === '29' && await pg.locator('dialog[open] [data-recomendado]').getByRole('button', { name: 'Usar' }).count() === 0 && /Nada mudou ainda/.test(await texto(pg, 'dialog[open] .sobre-pe')) === false, 'mínimo recomendado: "Usar" põe o número no campo, e o botão some porque já é ele')
  await pg.locator('dialog[open] .sobre-pe').getByRole('button', { name: 'Salvar a ficha' }).click(); await pausa(pg, 800)
  const g = gravados.filter((x) => x.u === 'rpc/definir_cadastro').at(-1)
  conta(g && JSON.stringify(g.corpo.p_mudanca) === '{"minimo":29}', `mínimo recomendado: salvar grava só o mínimo, com o recomendado (${g ? JSON.stringify(g.corpo.p_mudanca) : 'nada gravado'})`)

  /* a cor que não saiu em três meses não tem recomendação */
  await pg.locator(cor('DRYFIT POLIESTER 100% · Vermelho Fourtime')).click(); await pausa(pg, 400)
  await editar()
  conta(/^Ainda sem mínimo recomendado: este material não teve saída nos últimos 3 meses\./.test(await rec()) && await pg.locator('dialog[open] [data-recomendado]').getByRole('button').count() === 0, `mínimo recomendado: sem saída em três meses não há recomendação, e a tela diz (${await rec()})`)
  await pg.keyboard.press('Escape'); await pausa(pg, 300)

  /* a que parou de sair no último mês: a média cai, e arredonda para cima */
  await pg.locator(cor('DRYFIT POLIESTER 100% · Azul Marinho')).click(); await pausa(pg, 400)
  await editar()
  conta(/^Recomendado: 1 kg Usar É a média entre o que saiu no último mês \(0 kg\) e o mês médio dos últimos três \(2 kg\)\.$/.test(await rec()), `mínimo recomendado: quem não saiu no último mês tem a média menor (${await rec()})`)
  await pg.keyboard.press('Escape'); await pausa(pg, 300)

  /* várias de uma vez: a faixa, sem botão */
  await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 400)
  await editar()
  conta(/^Recomendado: de 1 a 29 kg Cada um tem o seu.*3 de 4 tiveram saída/.test(await rec()) && await pg.locator('dialog[open] [data-recomendado]').getByRole('button').count() === 0, `mínimo recomendado: com várias cores, a faixa do menor ao maior e quantas tiveram saída, sem botão de usar (${(await rec()).slice(0, 110)})`)
  await pg.keyboard.press('Escape'); await pausa(pg, 300)
  await pg.locator('[data-ficha]').getByRole('button', { name: 'Fechar' }).click(); await pausa(pg, 300)

  /* aviamento, no editor do grupo: o recomendado debaixo do campo de cada item */
  await pg.locator('.em-abas').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg, 300)
  await pg.locator('[data-arvore] .em-g[data-grupo="Linha"]').click(); await pausa(pg, 300)
  await pg.locator(cor('Linha poliéster 120 branca')).click(); await pausa(pg, 400)
  await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pg.waitForSelector('dialog[open] [data-recomendado]'); await pausa(pg, 300)
  const botoes = await pg.locator('dialog[open] [data-recomendado]').evaluateAll((x) => x.map((e) => e.dataset.recomendado + ': ' + e.innerText.trim()))
  conta(botoes.join(' | ') === 'Linha poliéster 120 branca: recomendado 4', `mínimo recomendado: no editor do grupo de aviamento, o recomendado aparece só no item que saiu (${botoes.join(' | ')})`)
  await pg.locator('dialog[open] [data-recomendado]').click(); await pausa(pg, 200)
  conta(await pg.locator('dialog[open] input[aria-label="Mínimo, em cone"]').first().inputValue() === '4', 'mínimo recomendado: clicar no recomendado põe o número no campo do item')
  await pg.screenshot({ path: `${PASTA}/minimo-recomendado-grupo-1440-light.png`, fullPage: false })
  conta(erros.length === 0, `mínimo recomendado: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* A COR PELA FAMÍLIA (prancha 55, escolhida pelo Henrique em 05/10/2026), com
   a cor nova na família e a edição da que existe (pedido dele na escolha). */
const abrirNovaCor = async (pg, malha) => {
  await pg.locator('.pagina-topo').getByRole('button', { name: 'Novo material', exact: true }).click(); await pausa(pg, 700)
  await pg.locator('dialog[open] .es-novo button.cb').first().click(); await pausa(pg, 300)
  await pg.locator('dialog[open] .mn.flutua .mn-item', { hasText: malha }).click(); await pausa(pg, 400)
}
const COR_DO_CADASTRO = 'dialog[open] [data-escolher-cor]'
for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  await caso(`cor pela família, ${T}`, async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 1000, tema })
    await ir(pg, '/estoque', '[data-arvore]')
    await abrirNovaCor(pg, 'DRYFIT POLIESTER 100%')
    const cor = pg.locator(COR_DO_CADASTRO)
    const chips = () => cor.locator('.es-novo-chips .chip').evaluateAll((l) => l.map((e) => e.innerText.trim() + (e.disabled ? ' (apagada)' : '') + (e.classList.contains('ligado') ? ' (ligada)' : '')))
    const criar = pg.locator('dialog[open] .sobre-pe .btn').last()

    /* em repouso: só a fileira das famílias */
    const familias = await cor.locator('.es-familia').evaluateAll((l) => l.map((e) => e.getAttribute('aria-label')))
    const repouso = await cor.evaluate((e) => Math.round(e.getBoundingClientRect().height))
    conta(familias.join(' | ') === 'Branco e Cru | Preto e Cinza | Vermelho | Rosa | Laranja | Amarelo | Verde | Azul | Roxo e Lilás | Marrom e Terra | Bege e Nude | Metálicos e Especiais | Outras' && await cor.locator('.chip').count() === 0, `${T} cor: em repouso aparece a fileira das 13 famílias, na ordem do catálogo, e nenhuma pílula (${familias.length} famílias)`)
    conta(repouso < 90 && /Clique numa família para ver as cores dela\. São 13 famílias e 122 cores\./.test(await cor.innerText()) && await sobra(pg) <= 0, `${T} cor: o bloco da cor ocupa ${repouso} px em repouso (eram 1.696 com as 122 pílulas), e diz o que fazer`)
    const rostos = await cor.locator('.es-familia .es-rosto').evaluateAll((l) => l.map((e) => e.classList.contains('varias') ? 'arco' : getComputedStyle(e).backgroundColor))
    conta(rostos[0] === 'rgb(255, 255, 255)' && rostos[7] === 'rgb(30, 70, 180)' && rostos[12] === 'arco' && new Set(rostos).size === 13, `${T} cor: cada família tem o rosto da cor que leva o nome dela, e "Outras" tem o arco (${rostos[7]})`)
    await pg.screenshot({ path: `${PASTA}/cor-familias-1440-${tema}.png` })

    /* a família aberta: só as cores dela, com a que já está no estoque apagada */
    await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
    let lista = await chips()
    const titulo = (await cor.locator('.es-familia-titulo').innerText()).replace(/\s+/g, ' ').trim()
    conta(lista.join(' | ') === 'Azul Royal | Azul Marinho (apagada) | Azul Celeste | Azul Turquesa | Azul Petróleo | Azul Bebê | Ciano | Azul Piscina | Azul Cobalto | Azul Jeans | Nova cor' && /^Azul 10 cores · 1 já está no estoque Editar cores$/.test(titulo), `${T} cor: aberta a família Azul, só as 10 cores dela, a que o tecido já tem apagada, e a pílula "Nova cor" no fim (${titulo})`)
    conta(await criar.isDisabled(), `${T} cor: sem cor escolhida o material não é criado`)
    await cor.locator('.chip', { hasText: /^Azul Royal$/ }).click(); await pausa(pg, 300)
    conta((await chips())[0] === 'Azul Royal (ligada)' && await criar.isEnabled() && await cor.locator('.es-familia[data-familia="AZ"]').getAttribute('aria-pressed') === 'true', `${T} cor: clicar na pílula escolhe a cor, e o material já pode ser criado`)
    const aberta = await cor.evaluate((e) => Math.round(e.getBoundingClientRect().height))
    conta(aberta < 300, `${T} cor: com a família aberta o bloco ocupa ${aberta} px`)
    await pg.screenshot({ path: `${PASTA}/cor-familia-aberta-1440-${tema}.png` })
    /* fechar a família guarda a escolha à vista */
    await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
    conta(await cor.locator('.chip').count() === 0 && /^Azul Royal é a cor escolhida$/.test((await cor.locator('[data-cor-escolhida]').innerText()).replace(/\s+/g, ' ').trim()) && await criar.isEnabled(), `${T} cor: fechada a família, a cor escolhida continua escrita`)
    /* outra família não desfaz a escolha, e a escolha nova troca */
    await cor.locator('.es-familia[data-familia="VM"]').click(); await pausa(pg, 300)
    lista = await chips()
    conta(lista.includes('Vermelho Fourtime (apagada)') && lista.length === 11 && !lista.some((c) => / \(ligada\)/.test(c)) && await criar.isEnabled(), `${T} cor: abrir outra família mostra as dela, sem perder a cor já escolhida`)

    /* COR NOVA NA FAMÍLIA */
    await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
    gravados.length = 0
    await cor.locator('.chip', { hasText: 'Nova cor' }).click(); await pausa(pg, 300)
    const ficha = cor.locator('[data-ficha-da-cor]')
    const gravarCor = ficha.locator('.btn-forte')
    conta(await ficha.getAttribute('data-ficha-da-cor') === 'nova' && /^Nova cor em Azul/.test((await ficha.innerText()).trim()) && await gravarCor.isDisabled() && /Adicionar a cor/.test(await gravarCor.innerText()) && /^Azul$/.test((await ficha.locator('.sel .v').innerText()).trim()), `${T} cor nova: "Nova cor" abre a ficha debaixo das pílulas, já na família Azul, e não grava vazia`)
    await ficha.getByPlaceholder('Azul Bic').fill('azul royal'); await ficha.getByPlaceholder('#1E46B4').fill('#1E46B4'); await pausa(pg, 200)
    conta(await gravarCor.isDisabled() && /Já existe uma cor com esse nome no catálogo\./.test(await ficha.innerText()), `${T} cor nova: nome que já existe, mesmo escrito de outro jeito, é recusado na hora`)
    await ficha.getByPlaceholder('Azul Bic').fill('Azul Bic'); await ficha.getByPlaceholder('#1E46B4').fill('12zz'); await pausa(pg, 200)
    conta(await gravarCor.isDisabled() && /O hexadecimal é # e seis dígitos/.test(await ficha.innerText()), `${T} cor nova: hexadecimal que não é cor é recusado, e a ficha diz como é`)
    await ficha.getByPlaceholder('#1E46B4').fill('2a52be'); await pausa(pg, 200)
    const amostra = await ficha.locator('.es-amostra').evaluate((e) => getComputedStyle(e).backgroundColor)
    conta(amostra === 'rgb(42, 82, 190)' && await gravarCor.isEnabled(), `${T} cor nova: o hexadecimal sem o "#" vale, e a amostra mostra a cor (${amostra})`)
    conta(await criar.isDisabled() && await pg.locator('dialog[open] .btn-primario').count() === 1, `${T} cor nova: com a ficha da cor aberta, "Criar material" espera, e o único botão vermelho da caixa é ele`)
    await pg.screenshot({ path: `${PASTA}/cor-nova-na-familia-1440-${tema}.png` })
    await gravarCor.click(); await pausa(pg, 900)
    const criou = gravados.find((g) => /^cor_de_tecido(\?|$)/.test(String(g.u)) && Array.isArray(g.corpo))
    conta(criou && JSON.stringify(criou.corpo) === '[{"nome":"Azul Bic","hex":"#2A52BE","grupo":"AZ"}]', `${T} cor nova: vai para o catálogo com o nome, o hexadecimal em maiúscula e a família (${criou ? JSON.stringify(criou.corpo) : 'nada gravado'})`)
    lista = await chips()
    conta(lista.includes('Azul Bic (ligada)') && lista.length === 12 && await cor.locator('[data-ficha-da-cor]').count() === 0 && /^Azul 11 cores/.test((await cor.locator('.es-familia-titulo').innerText()).replace(/\s+/g, ' ').trim()) && await criar.isEnabled(), `${T} cor nova: nasce na família, já escolhida, e a ficha fecha (${lista.filter((c) => /Bic/.test(c)).join('')})`)
    conta(await pg.locator('dialog[open] [data-onde-fica] .btn').isEnabled(), `${T} cor nova: com a cor nova escolhida o cadastro segue, e o lugar já pode ser marcado`)

    /* EDITAR A COR QUE EXISTE */
    gravados.length = 0
    await cor.getByRole('button', { name: 'Editar cores' }).click(); await pausa(pg, 300)
    lista = await chips()
    conta(/Clique na cor que você quer editar\./.test(await cor.innerText()) && !lista.includes('Nova cor') && !lista.some((c) => /apagada/.test(c)) && await cor.locator('.es-chip-editar svg').count() === 11 && await cor.getByRole('button', { name: 'Pronto' }).count() === 1, `${T} editar cor: "Editar cores" troca o clique: toda cor da família fica clicável, com o lápis, inclusive a que já está no estoque`)
    await cor.locator('.chip', { hasText: /^Azul Celeste$/ }).click(); await pausa(pg, 300)
    conta(await ficha.getAttribute('data-ficha-da-cor') === 'editar' && /^Editar Azul Celeste/.test((await ficha.innerText()).trim()) && await ficha.getByPlaceholder('Azul Bic').inputValue() === 'Azul Celeste' && /^#[0-9A-F]{6}$/.test(await ficha.getByPlaceholder('#1E46B4').inputValue()) && /mesmo catálogo de Configurações/.test(await ficha.innerText()), `${T} editar cor: clicar na cor abre a ficha dela com o nome, o hexadecimal e a família`)
    conta((await chips()).filter((c) => / \(ligada\)/.test(c)).join('') === 'Azul Celeste (ligada)', `${T} editar cor: a cor em edição fica marcada, e a escolhida do material não muda de lugar`)
    await ficha.getByPlaceholder('Azul Bic').fill('Azul Céu'); await pausa(pg, 200)
    conta(/O nome antigo continua escrito nos pedidos e nos materiais que já existem\./.test(await ficha.innerText()), `${T} editar cor: trocar o nome avisa que o nome antigo continua nos pedidos e materiais já escritos`)
    await ficha.locator('.sel button.cb').click(); await pausa(pg, 300)
    await pg.locator('dialog[open] .mn.flutua .mn-item', { hasText: /^Verde/ }).click(); await pausa(pg, 300)
    await pg.screenshot({ path: `${PASTA}/cor-editar-1440-${tema}.png` })
    await ficha.locator('.btn-forte').click(); await pausa(pg, 900)
    const mudou = gravados.find((g) => /^cor_de_tecido\?id=eq\./.test(String(g.u)))
    conta(mudou && /id=eq\.k\d+$/.test(mudou.u) && JSON.stringify(mudou.corpo) === JSON.stringify({ nome: 'Azul Céu', hex: mudou.corpo.hex, grupo: 'VD' }), `${T} editar cor: salva o nome, o hexadecimal e a família nova naquela cor (${mudou ? JSON.stringify(mudou.corpo) : 'nada gravado'})`)
    lista = await chips()
    conta(/^Verde 11 cores/.test((await cor.locator('.es-familia-titulo').innerText()).replace(/\s+/g, ' ').trim()) && lista.some((c) => c.startsWith('Azul Céu')) && await cor.locator('[data-ficha-da-cor]').count() === 0, `${T} editar cor: a cor muda de família na hora, e a família nova abre com ela`)
    await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
    conta((await chips()).includes('Azul Bic (ligada)') && await criar.isEnabled(), `${T} editar cor: a cor escolhida para o material continua escolhida`)
    await cor.locator('.es-familia[data-familia="VD"]').click(); await pausa(pg, 300)
    conta((await chips()).includes('Nova cor') && await cor.locator('.es-chip-editar').count() === 0, `${T} editar cor: trocar de família sai do modo de editar, para o clique voltar a escolher`)
    /* cancelar não grava */
    await cor.getByRole('button', { name: 'Editar cores' }).click(); await pausa(pg, 200)
    gravados.length = 0
    await cor.locator('.chip', { hasText: /^Verde Musgo$/ }).click(); await pausa(pg, 200)
    await ficha.getByPlaceholder('Azul Bic').fill('Outro nome'); await ficha.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg, 300)
    conta(await cor.locator('[data-ficha-da-cor]').count() === 0 && !gravados.some((g) => /cor_de_tecido/.test(String(g.u))) && (await chips()).some((c) => c.startsWith('Verde Musgo')), `${T} editar cor: Cancelar fecha a ficha sem gravar`)
    await cor.getByRole('button', { name: 'Pronto' }).click(); await pausa(pg, 200)
    conta((await chips()).includes('Nova cor') && await cor.locator('.es-chip-editar').count() === 0, `${T} editar cor: "Pronto" devolve o clique que escolhe`)
    /* a sublimação não é cor de malha: aparece em Outras e não se edita */
    await cor.locator('.es-familia[data-familia="outras"]').click(); await pausa(pg, 300)
    await cor.getByRole('button', { name: 'Editar cores' }).click(); await pausa(pg, 200)
    const outras = await cor.locator('.es-novo-chips .chip').evaluateAll((l) => l.map((e) => e.innerText.trim() + (e.disabled ? ' (fixa)' : '')))
    conta(outras.join(' | ') === 'SUBLIMAÇÃO (fixa) | AMARELO MANTEIGA', `${T} editar cor: em "Outras" a sublimação não se edita, e a cor sem família sim (${outras.join(' | ')})`)
    conta(erros.length === 0, `cor pela família, ${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* QUEM NÃO É ADMINISTRADOR NEM GERENTE escolhe a cor, e não mexe no catálogo */
await caso('cor pela família, sem mexer no catálogo', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 1000, tema: 'light', papel: 'producao' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirNovaCor(pg, 'DRYFIT POLIESTER 100%')
  const cor = pg.locator(COR_DO_CADASTRO)
  await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
  const lista = await cor.locator('.es-novo-chips .chip').allInnerTexts()
  conta(lista.length === 10 && !lista.some((c) => /Nova cor/.test(c)) && await cor.getByRole('button', { name: 'Editar cores' }).count() === 0, `cor sem catálogo: quem não é administrador nem gerente não vê "Nova cor" nem "Editar cores" (${lista.length} pílulas)`)
  await cor.locator('.chip', { hasText: /^Azul Royal$/ }).click(); await pausa(pg, 300)
  conta(await pg.locator('dialog[open] .sobre-pe .btn').last().isEnabled(), 'cor sem catálogo: escolher a cor e criar o material continua valendo')
  conta(erros.length === 0, `cor sem catálogo: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* O CELULAR: a fileira das famílias enrola, e cada família cabe no dedo */
await caso('cor pela família, celular', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema: 'light' })
  await ir(pg, '/estoque', '.pagina')
  await pg.getByRole('button', { name: /Novo material|Novo/ }).first().click(); await pausa(pg, 800)
  if (!(await pg.locator('dialog[open] .es-novo').count())) { await pg.locator('.mn.flutua .mn-item, [role="menuitem"]', { hasText: 'Novo material' }).first().click(); await pausa(pg, 800) }
  await pg.locator('dialog[open] .es-novo button.cb').first().click(); await pausa(pg, 300)
  await pg.locator('.mn.flutua .mn-item', { hasText: 'DRYFIT POLIESTER 100%' }).click(); await pausa(pg, 400)
  const cor = pg.locator(COR_DO_CADASTRO)
  const alvos = await cor.locator('.es-familia').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)] }))
  conta(alvos.length === 13 && alvos.every(([w, h]) => w >= 44 && h >= 44) && new Set(alvos.map((a) => a[2])).size === 2 && await sobra(pg) <= 0, `cor no celular: as 13 famílias em duas fileiras, cada uma com 44 px ou mais, sem rolar de lado (${alvos[0][0]} x ${alvos[0][1]})`)
  await cor.locator('.es-familia[data-familia="AZ"]').click(); await pausa(pg, 300)
  await cor.locator('.chip', { hasText: 'Nova cor' }).click(); await pausa(pg, 300)
  const campos = await cor.locator('.es-cor-ficha-campos > *').evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().top)))
  conta(await sobra(pg) <= 0 && campos.length === 3 && campos[2] > campos[1] + 20, 'cor no celular: a ficha da cor cabe, com o hexadecimal debaixo do nome')
  await pg.screenshot({ path: `${PASTA}/cor-familia-390-light.png` })
  conta(erros.length === 0, `cor no celular: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram.`)
if (ruins.length) { console.log('\nNÃO PASSOU:'); ruins.forEach((r) => console.log('  ' + r.texto)); process.exit(1) }
