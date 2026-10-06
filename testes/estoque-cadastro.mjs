/* ==========================================================================
   TRÊS CONSERTOS DO CADASTRO DO ESTOQUE (pedidos do Henrique de 06/10/2026).

     1. no material novo, a unidade do tecido se escolhe: peso (kg) ou metro
     2. no Editar da lista, o lugar no depósito se escolhe no desenho
     3. no Estoque, o nome do tecido se edita

   Prova curta, do modo rápido: uma largura, os dois temas só nas fotos.
   A página inteira continua em testes/estoque.mjs.

   Uso:  node testes/estoque-cadastro.mjs                 confere o site publicado
         node testes/estoque-cadastro.mjs http://localhost:4173
   ========================================================================== */

import { mkdirSync } from 'node:fs'
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
const texto = async (pg, seletor) => (await pg.locator(seletor).first().innerText()).replace(/\s+/g, ' ').trim()
const DRY = '[data-arvore] .em-t[data-tecido="DRYFIT POLIESTER 100%"]'
const abrirGrupo = async (pg, nome = 'DRY FIT') => {
  const g = pg.locator(`[data-arvore] .em-g[data-grupo="${nome}"]`)
  if (await g.getAttribute('aria-expanded') !== 'true') { await g.click(); await pausa(pg, 250) }
}
const escolherNoSeletor = async (pg, gatilho, item) => {
  await gatilho.click(); await pausa(pg, 250)
  await pg.locator('.mn.flutua .mn-item', { hasText: item }).first().click(); await pausa(pg, 250)
}

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 1000, tema })
  const foto = (n) => pg.screenshot({ path: `${PASTA}/cadastro-${n}-1440-${tema}.png` })

  /* ---------- 1. a unidade do tecido novo --------------------------------- */
  await caso(`${T} unidade`, async () => {
    await ir(pg, '/estoque', '[data-arvore]')
    await pg.locator('.pagina-topo').getByRole('button', { name: 'Novo material', exact: true }).click(); await pausa(pg, 700)
    const tres = pg.locator('dialog[open] .es-novo-tres')
    const unidade = tres.locator('.campo', { hasText: 'Unidade' }).locator('button.cb')
    conta(await unidade.count() === 1 && await tres.locator('input[readonly]').count() === 0, `${T} unidade: no tecido novo a unidade é um seletor, e não mais um campo travado em kg`)
    conta(/kg · peso/.test(await unidade.innerText()) && /Mínimo no estoque, em kg/.test(await texto(pg, 'dialog[open] .es-novo-tres')), `${T} unidade: nasce em kg, e o mínimo diz "em kg"`)
    await unidade.click(); await pausa(pg, 250)
    /* o seletor do sistema sempre tem a linha vazia ("Escolha"), que aqui não faz nada */
    const opcoes = (await pg.locator('.mn.flutua .mn-item .nm').allInnerTexts()).map((o) => o.trim()).filter((o) => o !== 'Escolha').join(' | ')
    conta(opcoes === 'kg · peso | m · metro', `${T} unidade: as duas opções são peso e metro (${opcoes})`)
    await pg.locator('.mn.flutua .mn-item', { hasText: 'm · metro' }).click(); await pausa(pg, 250)
    conta(/m · metro/.test(await unidade.innerText()) && /Mínimo no estoque, em m\b/.test(await texto(pg, 'dialog[open] .es-novo-tres')), `${T} unidade: escolher metro troca o campo e o rótulo do mínimo`)
    await foto('unidade')

    /* um tecido que já tem cores em kg: a cor nova nasce em kg, e trocar avisa */
    await escolherNoSeletor(pg, pg.locator('dialog[open] .es-novo button.cb').first(), 'DRYFIT POLIESTER 100%')
    conta(/kg · peso/.test(await unidade.innerText()), `${T} unidade: escolher um tecido que já tem cores em kg volta a unidade para kg`)
    await escolherNoSeletor(pg, unidade, 'm · metro')
    conta(/As outras cores deste tecido estão em kg/.test(await texto(pg, 'dialog[open] .es-novo-tres')), `${T} unidade: trocar para metro ali avisa que as outras cores estão em kg`)

    /* criar em metro: o banco recebe "m" */
    const f = pg.locator('dialog[open] .es-familia').first()
    await f.click(); await pausa(pg, 250)
    const livre = pg.locator('dialog[open] .es-novo-chips .chip:not([disabled])').first()
    const qual = (await livre.innerText()).trim()
    await livre.click(); await pausa(pg, 250)
    gravados.length = 0
    await pg.locator('dialog[open] .sobre-pe .btn').last().click(); await pausa(pg, 800)
    const criado = gravados.find((g) => /^material(\?|$)/.test(g.u) && g.corpo && (Array.isArray(g.corpo) ? g.corpo[0] : g.corpo).unidade)
    const corpo = criado ? (Array.isArray(criado.corpo) ? criado.corpo[0] : criado.corpo) : null
    conta(corpo?.unidade === 'm' && corpo.categoria === 'tecido', `${T} unidade: o tecido criado em metro vai para o banco com a unidade "m" (${qual}: ${corpo?.unidade})`)
  })

  /* ---------- 2. o lugar no Editar da lista ------------------------------- */
  await caso(`${T} lugar`, async () => {
    await ir(pg, '/estoque', '[data-arvore]')
    await abrirGrupo(pg)
    await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 300)
    await pg.locator('.em-c[data-material="DRYFIT POLIESTER 100% · Preto"]').click(); await pausa(pg, 500)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    const onde = pg.locator('dialog[open] [data-editar-ficha] [data-onde-fica]')
    conta(await onde.count() === 1 && /Onde fica no depósito/.test(await onde.innerText()), `${T} lugar: o Editar da cor, na lista, tem "Onde fica no depósito"`)
    const etiqueta = await onde.locator('.dp-etiqueta').allInnerTexts()
    conta(etiqueta.length >= 1 && /Prateleira D · vão 2/.test(etiqueta[0]) && /Mudar o lugar/.test(await onde.innerText()), `${T} lugar: mostra onde a cor está hoje e o botão de mudar (${etiqueta.join(' | ')})`)
    await foto('lugar-na-ficha')
    await onde.getByRole('button', { name: 'Mudar o lugar' }).click(); await pausa(pg, 700)
    const marcar = pg.locator('dialog[open]', { has: pg.locator('input[aria-label="Código do lugar"]') })
    conta(await marcar.count() === 1 && await pg.locator('dialog[open]').count() === 2, `${T} lugar: o botão abre o desenho do depósito por cima da ficha, que continua aberta atrás`)
    await foto('lugar-no-desenho')
    gravados.length = 0
    await marcar.locator('input[aria-label="Código do lugar"]').fill('P07'); await pausa(pg, 300)
    await marcar.locator('.sobre-pe .btn').last().click(); await pausa(pg, 800)
    const g = gravados.find((x) => x.u === 'rpc/definir_lugares')
    conta(g && g.corpo.p_materiais.length === 1 && g.corpo.p_lugares.some((l) => l.movel === 'pal-07'), `${T} lugar: marcar grava o lugar na hora, sem esperar o Salvar da ficha (${JSON.stringify(g?.corpo.p_lugares ?? null).slice(0, 90)})`)
    conta(await pg.locator('dialog[open] [data-editar-ficha]').count() === 1 && await pg.locator('dialog[open]').count() === 1, `${T} lugar: depois de marcar, o desenho fecha e a ficha continua aberta`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)

    /* o tecido inteiro: o lugar de todas as cores de uma vez */
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    const lote = await texto(pg, 'dialog[open] [data-editar-ficha] [data-onde-fica]')
    conta(/com lugar/.test(lote) && /Definir o lugar dos 4/.test(lote), `${T} lugar: no Editar do tecido o botão define o lugar das 4 cores de uma vez (${lote.slice(0, 90)})`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)

    /* aviamento: o cadastro do grupo troca o texto livre pelo desenho */
    await pg.locator('.em-abas').getByRole('tab', { name: /Aviamentos/ }).click(); await pausa(pg)
    await pg.locator('[data-arvore] .em-g').first().click(); await pausa(pg, 300)
    await pg.locator('[data-arvore] .em-c').first().click(); await pausa(pg, 500)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    const grupo = pg.locator('dialog[open] .es-editar')
    conta(/Onde fica no depósito/.test(await grupo.innerText()) && await grupo.locator('[data-lugar-no-cadastro] .btn').count() >= 1 && await grupo.locator('input[placeholder="Prateleira, armário ou caixa"]').count() === 0, `${T} lugar: no cadastro do grupo de aviamento, cada linha tem o botão do desenho no lugar do texto livre`)
    conta(await pg.locator('dialog[open] .caixa').evaluate((e) => e.scrollWidth - e.clientWidth) <= 0, `${T} lugar: a caixa do grupo não rola para o lado`)
    await foto('lugar-no-grupo')
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
  })

  /* ---------- 3. o nome do tecido ---------------------------------------- */
  await caso(`${T} nome do tecido`, async () => {
    await ir(pg, '/estoque', '[data-arvore]')
    await abrirGrupo(pg)
    await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    const campo = pg.locator('dialog[open] input[aria-label="Nome do tecido"]')
    conta(await campo.count() === 1 && await campo.inputValue() === 'DRYFIT POLIESTER 100%', `${T} nome do tecido: o Editar do tecido tem o campo do nome, com o nome de hoje`)
    const salvar = pg.locator('dialog[open] .sobre-pe .btn').last()
    conta(await salvar.isDisabled(), `${T} nome do tecido: sem mexer em nada, o Salvar fica apagado`)
    await campo.fill('   '); await pausa(pg, 200)
    conta(await salvar.isDisabled(), `${T} nome do tecido: nome vazio não salva`)
    await campo.fill('DRY FIT POLIÉSTER'); await pausa(pg, 200)
    conta(/Muda em todas as cores de DRYFIT POLIESTER 100%/.test(await texto(pg, 'dialog[open] [data-editar-ficha]')) && await salvar.isEnabled(), `${T} nome do tecido: com o nome novo, a dica diz que muda em todas as cores, e o Salvar acende`)
    await foto('nome-do-tecido')
    gravados.length = 0
    await salvar.click(); await pausa(pg, 900)
    const doTecido = gravados.find((g) => /^tecido\?id=eq\./.test(g.u))
    const dasCores = gravados.filter((g) => /^material\?id=eq\./.test(g.u)).map((g) => g.corpo?.nome)
    conta(doTecido?.corpo?.nome === 'DRY FIT POLIÉSTER', `${T} nome do tecido: o catálogo recebe o nome novo (${doTecido?.corpo?.nome})`)
    conta(dasCores.length === 4 && dasCores.every((n) => /^DRY FIT POLIÉSTER · /.test(n)), `${T} nome do tecido: o nome guardado nas 4 cores acompanha (${dasCores.join(' | ')})`)
    conta(!gravados.some((g) => g.u === 'rpc/definir_cadastro'), `${T} nome do tecido: quem só mudou o nome não regrava a ficha das cores`)
    conta(await pg.locator('dialog[open]').count() === 0, `${T} nome do tecido: depois de salvar a caixa fecha`)

    /* a cor sozinha também mostra o nome do tecido; o lote da tabela, que só quer o mínimo, não */
    await pg.locator(`${DRY} .em-t-seta`).click().catch(() => {}); await pausa(pg, 300)
    if (await pg.locator('.em-c[data-material="DRYFIT POLIESTER 100% · Preto"]').count() === 0) { await pg.locator(`${DRY} .em-t-seta`).click(); await pausa(pg, 300) }
    await pg.locator('.em-c[data-material="DRYFIT POLIESTER 100% · Preto"]').click(); await pausa(pg, 500)
    await pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true }).click(); await pausa(pg, 600)
    conta(await pg.locator('dialog[open] input[aria-label="Nome do tecido"]').count() === 1, `${T} nome do tecido: o Editar de uma cor também tem o nome do tecido`)
    await pg.keyboard.press('Escape'); await pausa(pg, 300)
    conta((await sobra(pg)) <= 0, `${T}: a página não rola para o lado`)
  })
  conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
}

/* quem não mexe no catálogo (estoquista) não vê o nome do tecido, mas vê o lugar */
await caso('estoquista', async () => {
  const { ctx, pg } = await abrir(nav, { largura: 1440, altura: 1000, tema: 'light', papel: 'estoquista' })
  await ir(pg, '/estoque', '[data-arvore]')
  await abrirGrupo(pg)
  await pg.locator(`${DRY} .em-t-nome`).click(); await pausa(pg, 500)
  const editar = pg.locator('[data-ficha] .em-ficha-topo').getByRole('button', { name: 'Editar', exact: true })
  if (await editar.count()) {
    await editar.click(); await pausa(pg, 600)
    conta(await pg.locator('dialog[open] input[aria-label="Nome do tecido"]').count() === 0 && await pg.locator('dialog[open] [data-onde-fica]').count() === 1, 'estoquista: edita a ficha e o lugar, mas não vê o nome do tecido, que é do catálogo')
  } else conta(true, 'estoquista: este papel de teste não edita o estoque, então não há o que conferir')
  await ctx.close()
})

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram.`)
if (ruins.length) { console.log('\nNÃO PASSOU:'); ruins.forEach((r) => console.log('  ' + r.texto)); process.exit(1) }
