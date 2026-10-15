/* ==========================================================================
   A SEPARAÇÃO CONTRA O WIREFRAME (pranchas 82 e 83; parte S1 de 11/10/2026,
   FOURTIME OS - 12, 4.0c).

   O QUE ELA CONFERE
     1. a barra de cima: as abas Na fila, Com falta e Concluídas com as contas,
        a busca e a ordem; a fila em Separando e Esperando, com a miniatura,
        a entrega e "x de y separados"
     2. nada escolhido: os quatro números, a Soma da fila (falta em vermelho,
        os cobertos abrem com um clique) e a Falta na prateleira
     3. a busca pelo material acha os pedidos que pedem ele; a ordem por cliente
     4. o pedido escolhido: o cabeçalho com o estado, os layouts, o vendedor,
        Ver o orçamento, Concluir e Fechar; separar uma linha manda a pesagem
     5. Com falta e Concluídas
     6. antes da 061: a fila funciona e a soma avisa
     7. 1920, 1440, 820 e 390 nos dois temas: nada rola de lado

   Uso:  node testes/separacao.mjs http://127.0.0.1:4173
   As fotos ficam em testes/atual/separacao/, fora do repositório.
   ========================================================================== */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
import * as E from './estoque-dados.mjs'
import { cotacaoDoAtletico } from './orcamento-dados.mjs'

const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/separacao'
mkdirSync(PASTA, { recursive: true })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

/* a fila do estoque, com as colunas da 061 */
const COTACAO = (n) => '00000000-0000-4000-9000-00000000' + n.slice(-4)
const VENDEDOR = { 'PD-0412': 'Dani', 'PD-0415': 'Lucas' }
const fila = E.fila.map((p, i) => ({ ...p, cotacao_id: COTACAO(p.numero), layouts: 1 + (i % 3), vendedor_nome: VENDEDOR[p.numero] ?? 'Dani' }))
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function materialDaFila() {
  const porMat = new Map()
  for (const r of E.reservasDoPedido) {
    const p = fila.find((x) => x.id === r.pedido_id)
    if (!p || r.baixada) continue
    const m = D.materiais.find((x) => x.id === r.material_id)
    const a = porMat.get(m.id) ?? { material_id: m.id, material: m.nome, categoria: m.categoria, unidade: m.unidade, cor_hex: m.cor_hex ?? '', onde_fica: 'Palete A' + (porMat.size + 1), saldo: m.saldo, pede: 0, pedidos: 0, sem_consumo: 0, numeros: [] }
    a.pede += r.sem_consumo ? 0 : r.quantidade
    a.pedidos += 1
    a.sem_consumo += r.sem_consumo ? 1 : 0
    a.numeros.push(p.numero)
    porMat.set(m.id, a)
  }
  return [...porMat.values()].map((a) => ({ ...a, depois: a.saldo - a.pede })).sort((x, y) => x.depois - y.depois)
}
const separados = [
  { id: D.idDoPedido('PD-0410'), numero: 'PD-0410', cliente: 'Oficina Exemplo', estado: 'pcp', aviso: '', pecas: 30, layouts: 1, entrega_em: null, cotacao_id: COTACAO('PD-0410'), materiais: 1, separados: 1, separado_em: '2026-10-09T14:00:00Z' },
  { id: D.idDoPedido('PD-0409'), numero: 'PD-0409', cliente: 'Banda Exemplo', estado: 'producao', aviso: 'falta-material', pecas: 52, layouts: 2, entrega_em: null, cotacao_id: COTACAO('PD-0409'), materiais: 2, separados: 1, separado_em: '2026-10-08T10:00:00Z' },
]

/* o material de cada layout (062) do PD-0415: o tecido do L-01 já separado,
   o algodão do L-02 a separar, e a linha nos dois */
const M = (nome) => D.materiais.find((m) => m.nome === nome)
const consumo = (ordem, nome, quantidade, como, extra = {}) => {
  const m = M(nome)
  return { ordem, material_id: m.id, quantidade, unidade: m.unidade, sem_consumo: !!extra.sem, como, material: { nome: m.nome, categoria: m.categoria, cor_de_tecido: m.cor_hex ? { hex: m.cor_hex } : null } }
}
const CONSUMO = {
  [D.idDoPedido('PD-0415')]: [
    consumo(1, 'DRYFIT POLIESTER 100% · Azul Marinho', 4, 'Tecido · a peça inteira · 25,0 m² pela ficha'),
    consumo(1, 'Linha poliéster 120 preta', 1.78, 'Aviamento · 0,02 cone por peça'),
    consumo(2, 'ALGODAO 100% · Preto', 8, 'Tecido · a peça inteira · pelo consumo cadastrado'),
    consumo(2, 'Linha poliéster 120 preta', 1.78, 'Aviamento · 0,02 cone por peça'),
  ],
}

const abertos = new Set()
async function abrir(nav, { largura, altura = 946, tema = 'light', sem061 = false }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo' })
  const gravados = []
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    let corpo = null
    const json = (c, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: c === null ? '' : JSON.stringify(c) })
    const falta = (t) => json({ code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` }, 404)
    if (u.includes('/rest/v1/meu_perfil')) corpo = D.perfil('admin')
    else if (u.includes('/rest/v1/regulagem')) corpo = []
    else if (u.includes('/rest/v1/pedido_na_separacao')) {
      if (sem061 && u.includes('vendedor_nome')) return json({ code: '42703', message: 'column pedido_na_separacao.vendedor_nome does not exist' }, 400)
      corpo = sem061 ? E.fila : fila
    } else if (u.includes('/rest/v1/material_da_fila')) { if (sem061) return falta('material_da_fila'); corpo = materialDaFila() }
    else if (u.includes('/rest/v1/pedido_separado')) { if (sem061) return falta('pedido_separado'); corpo = separados }
    else if (u.includes('/rest/v1/reserva_do_pedido')) { const id = (u.match(/pedido_id=eq\.([^&]+)/) ?? [])[1]; corpo = E.reservasDoPedido.filter((x) => x.pedido_id === id) }
    else if (u.includes('/rest/v1/cotacao?') && u.includes('imagem:')) corpo = fila.slice(0, 3).map((p) => ({ id: p.cotacao_id, imagem: PNG }))
    else if (u.includes('/rest/v1/cotacao?') && u.includes('id=eq.')) {
      const id = u.split('id=eq.')[1].split('&')[0]
      const c = cotacaoDoAtletico()
      corpo = [{ id, numero: 'CO2026-0131', corpo: { ...c, produtos: c.produtos.slice(0, 2) }, versao_do_formato: 6, estado: 'aprovada', criada_em: '2026-10-01T12:00:00Z', atualizado_em: '2026-10-02T12:00:00Z' }]
    } else if (u.includes('/rest/v1/lugar_do_material_na_lista')) {
      corpo = D.materiais.slice(0, 40).map((m, i) => ({ material_id: m.id, codigo: 'Palete A' + (i + 1), principal: true }))
    } else if (u.includes('/rest/v1/material?select=id,onde_fica')) {
      corpo = []
    } else if (u.includes('/rest/v1/consumo_do_layout')) {
      if (sem061) return falta('consumo_do_layout')
      const id = (u.match(/pedido_id=eq\.([^&]+)/) ?? [])[1]
      corpo = CONSUMO[id] ?? []
    }
    else if (u.includes('/rest/v1/rpc/')) { gravados.push({ rpc: u.split('/rpc/')[1].split('?')[0], corpo: req.postDataJSON() }); corpo = u.includes('concluir') ? 'Separação concluída.' : null }
    else corpo = []
    return json(corpo)
  })
  await ctx.addInitScript(([t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify({ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }))
    localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
  } catch { /* segue */ } }, [tema])
  abertos.add(ctx)
  const pg = await ctx.newPage()
  pg.setDefaultTimeout(8000)
  const erros = []
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g|net::/i.test(m.text())) erros.push(m.text().slice(0, 200)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PÁGINA ' + String(e).slice(0, 200)))
  return { pg, erros, gravados }
}
const achados = []
const conta = (certo, t) => { achados.push({ certo: !!certo, t }); console.log((certo ? 'ok   ' : 'RUIM ') + t) }
async function secao(parte) {
  try { await parte() } catch (e) { conta(false, 'A PROVA PAROU NO MEIO: ' + String(e?.message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 220)) }
  for (const c of abertos) await c.close().catch(() => {})
  abertos.clear()
}
const ir = async (pg) => { await pg.goto(SITE + '/separacao', { waitUntil: 'networkidle' }); await pg.waitForSelector('.sp-fila .sp-item', { timeout: 15000 }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400) }
const texto = (pg, s) => pg.evaluate((s) => (document.querySelector(s)?.innerText ?? '').replace(/\s+/g, ' ').trim(), s)
const foto = (pg, n, cheia = true) => pg.screenshot({ path: `${PASTA}/${n}.png`, fullPage: cheia })
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const pausa = (pg, ms = 300) => pg.waitForTimeout(ms)

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  const abas = await pg.evaluate(() => [...document.querySelectorAll('.sp-abas button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
  conta(abas.join(' | ') === 'Na fila 7 | Com falta 1 | Concluídas 2', 'as abas com as contas: ' + abas.join(' | '))
  const grupos = await pg.evaluate(() => [...document.querySelectorAll('.sp-g')].map((g) => g.innerText.replace(/\s+/g, ' ').trim()))
  conta(grupos.length === 2 && /^SEPARANDO 1 pedido · já começou/i.test(grupos[0]) && /^ESPERANDO 6 · pela entrega mais próxima/i.test(grupos[1]), 'a fila em Separando e Esperando: ' + grupos.join(' | '))
  const primeiro = await texto(pg, '[data-pedido="PD-0412"]')
  conta(/Atlético Exemplo/.test(primeiro) && /PD-0412 · 329 pçs · 1 layout/.test(primeiro) && /entrega/.test(primeiro) && /0 de 3 separados · falta/.test(primeiro), 'a linha: cliente, pedido, peças, layouts, entrega e "x de y separados": ' + primeiro)
  conta(await pg.locator('.sp-mini img').count() === 3, 'a miniatura da arte nas linhas que têm imagem')
  const kpis = await pg.evaluate(() => [...document.querySelectorAll('.sp-kpis .kpi')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()))
  conta(kpis.length === 4 && /^Na fila 7\s*pedidos/.test(kpis[0]) && /1\.302\s*pçs/.test(kpis[1]) && /Entrega mais próxima/.test(kpis[2]) && /A prateleira não cobre 1\s*pedido/.test(kpis[3]), 'os quatro números: ' + kpis.join(' | '))
  const soma = await pg.evaluate(() => [...document.querySelectorAll('.sp-soma tbody tr')].map((t) => [t.className, t.innerText.replace(/\s+/g, ' ').trim()]))
  const total = materialDaFila().length
  conta(soma.length === Math.min(8, total) && soma[0][0] === 'falta' && /falta/.test(soma[0][1]) && soma.slice(1).every((x) => /sobra|sem consumo/.test(x[1])), `a soma da fila: a falta primeiro e em vermelho, ${soma.length} de ${total} à vista: ` + soma[0][1])
  if (total > 8) conta(new RegExp('^Ver os ' + total + ' materiais').test(await texto(pg, '.sp-mais')), 'os cobertos abrem com um clique')
  const falta = await texto(pg, '.sp-falta')
  conta(/Falta na prateleira 1 material/.test(falta) && /PD-0412/.test(falta), 'o cartão Falta na prateleira: ' + falta.slice(0, 120))
  await foto(pg, '1920-fila', false)
  /* a busca pelo material */
  await pg.getByPlaceholder('Buscar pedido, cliente ou material').fill('moletom')
  await pausa(pg)
  const achou = await pg.evaluate(() => [...document.querySelectorAll('.sp-fila .sp-item')].map((b) => b.dataset.pedido))
  conta(achou.join(',') === 'PD-0412,PD-0422', 'a busca pelo material acha os pedidos que pedem ele: ' + achou.join(','))
  await pg.getByPlaceholder('Buscar pedido, cliente ou material').fill('')
  /* o pedido */
  await pg.locator('[data-pedido="PD-0415"]').click()
  await pausa(pg, 500)
  const cab = await texto(pg, '.sp-ped-topo')
  conta(/em separação/.test(cab) && /PD-0415 › 2 layouts/.test(cab) && /Auto Peças Exemplo/.test(cab) && /230 peças · Comercial · entrega/.test(cab) && /vendido por Lucas/.test(cab), 'o cabeçalho do pedido: ' + cab.slice(0, 160))
  conta(await pg.getByRole('button', { name: 'Ver o orçamento' }).count() === 1 && await pg.locator('.sp-ped-topo').getByRole('button', { name: 'Concluir a separação' }).count() === 1, 'Ver o orçamento e Concluir a separação')
  conta(await pg.locator('.sp-kpis').count() === 0 && await pg.locator('.sp-item.escolhido').count() === 1, 'com um pedido escolhido, o resumo da fila sai e a linha fica escolhida')
  /* S2: um cartão por layout, com o material dele */
  const lays = await pg.evaluate(() => [...document.querySelectorAll('.sp-lay')].map((l) => ({ cab: l.querySelector('.sp-cab').innerText.replace(/\s+/g, ' ').trim(), linhas: [...l.querySelectorAll('tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()), img: !!l.querySelector('.sp-lay-arte img'), dados: l.querySelector('.sp-lay-dados').innerText.replace(/\s+/g, ' ').trim() })))
  conta(lays.length === 2 && /^L-01 · CAMISETA MASC TRAD 89 peças · FT-010-000M/.test(lays[0].cab), 'um cartão por layout, com o nome, as peças e a referência: ' + lays.map((l) => l.cab).join(' | '))
  conta(/Tecido DRYFIT POLIESTER 100%/.test(lays[0].dados) && /Grade/.test(lays[0].dados) && /G 30/.test(lays[0].dados), 'à esquerda o que foi negociado: tecido, design e grade: ' + lays[0].dados.slice(0, 120))
  conta(lays[0].linhas.length === 2 && /DRYFIT POLIESTER 100% · Azul Marinho Tecido · a peça inteira · 25,0 m² pela ficha 4,0 kg separado/.test(lays[0].linhas[0]) && /0,02 cone por peça/.test(lays[0].linhas[1]), 'o material deste layout com a conta e como está: ' + lays[0].linhas[0])
  conta(/a separar/.test(lays[1].linhas[0]), 'o tecido do L-02 ainda a separar: ' + lays[1].linhas[0])
  conta(/Soma de tudo/.test(await texto(pg, '.sp-quadro .sp-cab')), 'a Soma de tudo no fim')
  await foto(pg, '1920-pedido', false)
  const cabSoma = await pg.evaluate(() => [...document.querySelectorAll('.sp-quadro thead th')].map((t) => t.innerText.trim()))
  conta(cabSoma.join('|') === 'Material|Precisa|Na prateleira|Onde fica|Pesado|', 'a Soma de tudo com onde fica: ' + cabSoma.join(' | '))
  const linhaSoma = await texto(pg, '.sp-quadro tbody tr:last-child')
  conta(/ALGODAO 100% · Preto/.test(linhaSoma) && /Tecido · L-02/.test(linhaSoma) && /Palete A/.test(linhaSoma), 'cada material diz de quais layouts vem e onde fica: ' + linhaSoma)
  conta(await pg.locator('.sp-pe-fim').getByRole('button', { name: 'Concluir a separação' }).count() === 1, 'Concluir também no pé da Soma de tudo')
  /* a ficha do layout por cima */
  await pg.getByRole('button', { name: 'Ver a ficha do layout' }).first().click()
  await pausa(pg, 400)
  const modal = pg.locator('dialog.modal[open]')
  conta(await modal.count() === 1 && await modal.locator('.lr').count() === 1 && /DRYFIT POLIESTER 100% · Azul Marinho/.test(await modal.innerText()), 'Ver a ficha do layout abre o layout sem valor e o material dele, por cima')
  await foto(pg, '1920-ficha-do-layout', false)
  await pg.keyboard.press('Escape')
  await pausa(pg)
  await pg.getByRole('button', { name: 'Pesar e guardar', exact: true }).first().click()
  await pausa(pg, 500)
  const g = gravados.find((x) => x.rpc === 'separar_material')
  conta(g && g.corpo.p_quantidade === 8, 'Separar manda a pesagem do campo (' + JSON.stringify(g?.corpo ?? {}) + ')')
  await pg.locator('.sp-ped-topo').getByRole('button', { name: 'Fechar' }).click()
  await pausa(pg)
  conta(await pg.locator('.sp-kpis').count() === 1, 'Fechar volta ao resumo da fila')
  /* ordem por cliente */
  await pg.locator('.sel', { hasText: 'ORDEM' }).locator('button.cb').click()
  await pg.locator('[popover]:popover-open .mn-item', { hasText: 'Cliente' }).click()
  await pausa(pg)
  const esperando = await pg.evaluate(() => [...document.querySelectorAll('.sp-grupo:last-child .sp-item .sp-cliente')].map((b) => b.textContent))
  conta(esperando[0] === 'Academia Exemplo', 'a ordem por cliente: ' + esperando.slice(0, 3).join(', '))
  /* com falta e concluídas */
  await pg.locator('.sp-abas button', { hasText: 'Com falta' }).click()
  await pausa(pg)
  conta((await pg.evaluate(() => [...document.querySelectorAll('.sp-fila .sp-item')].map((b) => b.dataset.pedido))).join(',') === 'PD-0412', 'Com falta: só o que a prateleira não cobre')
  await pg.locator('.sp-abas button', { hasText: 'Concluídas' }).click()
  await pausa(pg)
  const conc = await pg.evaluate(() => [...document.querySelectorAll('.sp-fila .sp-item')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
  conta(conc.length === 2 && /no PCP/.test(conc[0]) && /separado 09\/10/.test(conc[0]) && /desceu com falta/.test(conc[1]), 'Concluídas: o estado de agora, quando separou e se desceu com falta: ' + conc.join(' | '))
  await pg.locator('[data-pedido="PD-0410"]').click()
  await pausa(pg, 500)
  conta(/PIQUET 100% · Branco/.test(await texto(pg, '.sp-direita [data-passado]')), 'a concluída abre o que saiu da prateleira para ela, só para ler')
  await foto(pg, '1920-concluidas', false)
  conta(!erros.length, 'sem erro de JavaScript: ' + erros.join(' | '))
})

/* S3: separar o que tem, e pedir a compra */
await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  await pg.locator('[data-pedido="PD-0412"]').click()
  await pausa(pg, 600)
  const curta = pg.locator('.sp-quadro tbody tr', { hasText: 'DRYFIT POLIESTER 100% · Preto' })
  conta(/falta 14,6 kg/.test(await curta.innerText()) && await curta.getByRole('button', { name: 'Pesar o que tem' }).count() === 1, 'a linha que a prateleira não cobre mostra a falta e oferece Pesar o que tem')
  await curta.getByRole('button', { name: 'Pesar o que tem' }).click()
  await pausa(pg, 500)
  const g = gravados.find((x) => x.rpc === 'separar_material')
  conta(g && g.corpo.p_quantidade === 9, 'Pesar o que tem manda o saldo da prateleira (' + JSON.stringify(g?.corpo ?? {}) + ')')
  await pg.locator('.sp-ped-topo').getByRole('button', { name: 'Fechar' }).click()
  await pausa(pg)
  await pg.getByRole('button', { name: 'Pedir a compra' }).click()
  await pausa(pg, 400)
  const u = new URL(pg.url())
  conta(u.pathname === '/estoque' && u.searchParams.get('busca') === 'DRYFIT POLIESTER 100% · Preto', 'Pedir a compra abre o material no Estoque: ' + u.pathname + u.search)
  conta(!erros.length, 'sem erro de JavaScript (S3): ' + erros.join(' | '))
})

await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1440, sem061: true })
  await ir(pg)
  conta(await pg.locator('.sp-fila .sp-item').count() === 7 && /ainda não existe no banco/.test(await texto(pg, '.sp-soma')), 'antes da 061: a fila funciona e a soma avisa')
  conta(!erros.length, 'sem erro de JavaScript (antes da 061): ' + erros.join(' | '))
})

for (const tema of ['light', 'dark']) {
  for (const [largura, altura] of [[1920, 946], [1440, 900], [820, 1180], [390, 844]]) {
    await secao(async () => {
      const { pg, erros } = await abrir(nav, { largura, altura, tema })
      await ir(pg)
      conta(await sobra(pg) <= 0, `${largura} ${tema}: nada rola de lado (${await sobra(pg)})`)
      await foto(pg, `${largura}-${tema}`)
      await pg.locator('[data-pedido="PD-0412"]').click()
      await pausa(pg, 500)
      conta(await sobra(pg) <= 0, `${largura} ${tema}: com o pedido aberto, nada rola de lado (${await sobra(pg)})`)
      await foto(pg, `${largura}-${tema}-pedido`)
      conta(!erros.length, `sem erro de JavaScript (${largura} ${tema}): ` + erros.join(' | '))
    })
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram`)
if (ruins.length) { console.log('RUINS:'); ruins.forEach((r) => console.log('  ' + r.t)); process.exit(1) }
