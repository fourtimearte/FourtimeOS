/* ==========================================================================
   O TESTE DO TRAVOU AQUI, DO SEPARAR E DA RELEITURA DO KANBAN (076,
   12/10/2026).

   O QUE ELE MEDE:
     1. o cartao travado aparece vermelho no quadro, com o motivo, e conta
        nos numeros do topo
     2. "Travou aqui" no cartao aberto pede o motivo e chama travar_a_fatia
     3. o cartao travado mostra o motivo e "Destravar" chama destravar_a_fatia
     4. "Separar layouts" soma as pecas pela grade da cotacao, recusa separar
        todos, e chama separar_da_fatia com os layouts, as pecas e o posto
     5. /kanban?cartao=<id> (o link do sino) abre o cartao
     6. o quadro se rele sozinho a cada 30 segundos
     7. quem so ve o kanban nao ve os botoes

   Uso:  node testes/travou.mjs http://127.0.0.1:4173
   ========================================================================== */

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'

const PAGINAS = ['inicio', 'kanban']
const perfil = (editar) => {
  const permissoes = {}
  PAGINAS.forEach(k => permissoes[k] = { ver: true, editar, deletar: editar, total: editar })
  return [{ id: '1', nome: 'Henrique', papel: editar ? 'admin' : 'vendedor', situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
}

const ROTAS = []
const poe = (t, postos) => postos.forEach((p, i) => ROTAS.push({ tecnica: t, ordem: (i + 1) * 10, posto: p }))
poe('subli', ['subli', 'calandra', 'futurize', 'conferencia', 'cd-costura', 'costura', 'embalagem', 'finalizado'])
poe('dtf', ['corte', 'dtf', 'prensa', 'conferencia', 'cd-costura', 'costura', 'embalagem', 'finalizado'])

const ha = (d) => new Date(Date.now() - d * 86400000).toISOString()
const base = { cliente_id: 'C1', fechado_em: null, entrega_em: null, aviso: '', estado: 'producao', teste: true, marcas: [], tags: [],
  pego_por: null, pego_por_nome: '', pego_em: null, falas: 0, travada_em: null, travada_motivo: '', travada_por_nome: '' }
const FATIAS = [
  { ...base, id: 'f1', pedido_id: 'p1', numero: 'PD-TESTE-0101', nome: 'Uniforme Equipe Verão', cliente: 'Drogaria Viver Bem',
    vendedor: 'Dani', tecnica: 'subli', etapa: 'calandra', etapa_em: ha(1), layouts: [1, 2], pecas: 54 },
  { ...base, id: 'f2', pedido_id: 'p2', numero: 'PD-TESTE-0102', nome: 'Camisa Congresso', cliente: 'Igreja Araguaia',
    vendedor: 'Lucas', tecnica: 'dtf', etapa: 'dtf', etapa_em: ha(0), layouts: [1], pecas: 160,
    travada_em: ha(0.05), travada_motivo: 'a prensa quebrou', travada_por_nome: 'Bruna' },
]
const BLOCO = (n, grade) => ({
  id: 'B' + n, n, referencia: 'FT-010-000M', nomeDaReferencia: 'CAMISETA', genero: 'masculino', faixa: 'adulto', grade,
  tecidos: [], design: [{ tag: 'Subli', tecnica: 'subli', cores: [] }], arte: '', imagem: '', observacao: '',
})
const COTACAO = [{
  id: 'c1', numero: 'CO2026-0100', versao_do_formato: 4, estado: 'aprovada', criada_em: ha(9), atualizado_em: ha(1),
  corpo: {
    numero: 'CO2026-0100', versaoDoFormato: 4, estado: 'aprovada', vendedor: 'Dani',
    cliente: { id: 'C1', nome: 'Drogaria Viver Bem', documento: '', contato: '', telefone: '', email: '', cidade: 'Goiânia', uf: 'GO' },
    produtos: [
      { bloco: BLOCO(1, { P: 4, M: 10, G: 12, GG: 6, XG: 2 }), precoPorTamanho: {}, precoBase: 60 },
      { bloco: BLOCO(2, { P: 6, M: 8, G: 4, GG: 2 }), precoPorTamanho: {}, precoBase: 60 },
    ],
    ajustes: [], informe: {}, informes: [], enviadas: [],
    producao: { pedido: '', dataDeEnvio: '', departamento: '', embalagem: '', marcas: [], observacao: '' },
  },
}]

const nav = await chromium.launch()
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir(rota = '/kanban', { editar = true, relogio = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
  const gravados = []
  const lidos = { quadro: 0 }
  await ctx.route('**supabase.co/**', async (r) => {
    const u = r.request().url()
    let corpo = []
    if (u.includes('/rpc/')) {
      gravados.push({ rpc: u.split('/rpc/')[1].split('?')[0], corpo: r.request().postDataJSON() })
      corpo = null
    } else if (u.includes('meu_perfil')) corpo = perfil(editar)
    else if (u.includes('fatia_na_fabrica')) { lidos.quadro++; corpo = FATIAS }
    else if (u.includes('rota_da_tecnica')) corpo = ROTAS
    else if (u.includes('/pedido?')) corpo = [{ cotacao_id: 'c1' }]
    else if (u.includes('/cotacao?')) corpo = COTACAO
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript((c) => {
    try { localStorage.setItem('ft.sessao', JSON.stringify(c)) } catch {}
  }, { acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000 * 30, usuario: 't', email: 't@f' })
  const pg = await ctx.newPage()
  if (relogio) await pg.clock.install()
  pg.on('pageerror', (e) => conta(false, 'erro de pagina: ' + e.message))
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForTimeout(900)
  return { ctx, pg, gravados, lidos }
}

const abrirCartao = async (pg, numero) => {
  await pg.locator('.kb-cartao', { hasText: numero }).locator('.kb-abrir').click()
  await pg.waitForSelector('.ca', { timeout: 5000 })
  await pg.waitForTimeout(500)
}

/* 1. o quadro */
{
  const { ctx, pg } = await abrir()
  const c = await pg.evaluate(() => {
    const k = [...document.querySelectorAll('.kb-cartao')].find((x) => x.textContent.includes('PD-TESTE-0102'))
    const o = [...document.querySelectorAll('.kb-cartao')].find((x) => x.textContent.includes('PD-TESTE-0101'))
    return { travado: k?.classList.contains('travado'), texto: k?.querySelector('.kb-travou')?.innerText ?? '', outro: o?.classList.contains('travado'),
      borda: k ? getComputedStyle(k).borderColor : '' }
  })
  conta(c.travado && /Travou: a prensa quebrou/.test(c.texto) && !c.outro, 'quadro: o cartao travado tem a marca e o motivo (' + c.texto + ')')
  conta(/1 travado/.test(await pg.locator('.kb-dado.alerta').allInnerTexts().then((x) => x.join(' ').replace(/\s+/g, ' '))), 'quadro: os numeros contam 1 travado')
  await pg.locator('.kb-cartao.travado').screenshot({ path: 'testes/atual/travou-cartao.png' })
  await ctx.close()
}

/* 2 a 4. o cartao aberto */
{
  const { ctx, pg, gravados } = await abrir()
  await abrirCartao(pg, 'PD-TESTE-0101')
  await pg.getByRole('button', { name: 'Travou aqui' }).click()
  await pg.waitForTimeout(300)
  const marcar = pg.getByRole('button', { name: 'Marcar que travou' })
  conta(await marcar.isDisabled(), 'travou: sem motivo o botao fica desligado')
  await pg.getByLabel('O que travou').fill('falta a arte do L-02')
  await marcar.click()
  await pg.waitForTimeout(600)
  const t = gravados.find((g) => g.rpc === 'travar_a_fatia')
  conta(!!t && t.corpo.p_fatia === 'f1' && t.corpo.p_motivo === 'falta a arte do L-02', 'travou: chama travar_a_fatia com o motivo')

  await pg.getByRole('button', { name: 'Separar layouts' }).click()
  await pg.waitForTimeout(400)
  const dlg = pg.locator('dialog[open]').last()
  await dlg.getByText('L-01 · 34 pçs').click()
  await dlg.getByText('L-02 · 20 pçs').click()
  conta(/Deixe pelo menos um layout/.test(await dlg.locator('.ca-sep-recado').innerText()) && await dlg.getByRole('button', { name: 'Separar', exact: true }).isDisabled(),
    'separar: escolher todos e recusado na tela')
  await dlg.getByText('L-01 · 34 pçs').click()
  await dlg.getByLabel('Por quê').fill('reimpressão da manga')
  const recado = await dlg.locator('.ca-sep-recado').innerText()
  conta(/L-02 saem com 20 peças para Impressão sublimação; o cartão fica com 34\./.test(recado), 'separar: a conta sai da grade (' + recado + ')')
  await dlg.screenshot({ path: 'testes/atual/travou-separar.png' })
  await dlg.getByRole('button', { name: 'Separar', exact: true }).click()
  await pg.waitForTimeout(600)
  const s = gravados.find((g) => g.rpc === 'separar_da_fatia')
  conta(!!s && JSON.stringify(s.corpo.p_layouts) === '[2]' && s.corpo.p_pecas === 20 && s.corpo.p_posto === 'subli' && s.corpo.p_motivo === 'reimpressão da manga',
    'separar: chama separar_da_fatia com layouts, pecas, posto e motivo (' + JSON.stringify(s?.corpo) + ')')
  await ctx.close()
}

/* 3 e 5. o travado aberto pelo link do sino */
{
  const { ctx, pg, gravados } = await abrir('/kanban?cartao=f2')
  await pg.waitForTimeout(500)
  const caixa = await pg.locator('.ca-travou').innerText().catch(() => '')
  conta(/Travou aqui/.test(caixa) && /a prensa quebrou/.test(caixa) && /Bruna/.test(caixa), 'sino: /kanban?cartao=f2 abre o cartao travado, com o motivo e quem (' + caixa.replace(/\s+/g, ' ') + ')')
  conta(!new URL(pg.url()).search.includes('cartao'), 'sino: o parametro sai do endereco')
  conta(await pg.getByRole('button', { name: 'Separar layouts' }).count() === 0, 'separar: cartao com um layout so nao oferece separar')
  await pg.locator('.ca-dir').screenshot({ path: 'testes/atual/travou-aberto.png' })
  await pg.getByRole('button', { name: 'Destravar' }).click()
  await pg.waitForTimeout(500)
  conta(gravados.some((g) => g.rpc === 'destravar_a_fatia' && g.corpo.p_fatia === 'f2'), 'destravar: chama destravar_a_fatia')
  await ctx.close()
}

/* 6. a releitura */
{
  const { ctx, pg, lidos } = await abrir('/kanban', { relogio: true })
  const antes = lidos.quadro
  await pg.clock.fastForward(31_000)
  await pg.waitForTimeout(800)
  conta(lidos.quadro > antes, `releitura: depois de 30 segundos o quadro foi lido de novo (${antes} para ${lidos.quadro})`)
  await ctx.close()
}

/* 7. quem so ve */
{
  const { ctx, pg } = await abrir('/kanban', { editar: false })
  await abrirCartao(pg, 'PD-TESTE-0102')
  conta(await pg.locator('.ca-travou').count() === 1 && await pg.getByRole('button', { name: /Destravar|Travou aqui|Separar/ }).count() === 0,
    'so ve: le o motivo, sem os botoes')
  await ctx.close()
}

await nav.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
