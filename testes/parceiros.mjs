/* ==========================================================================
   A PÁGINA PARCEIROS CONTRA AS PRANCHAS 6 A 10 DO WIREFRAME, VERSÃO 2.

   O Henrique aprovou a versão 2 do wireframe "Página do Parceiro" em
   04/10/2026 ("o wireframe novo está ótimo, pode implementar"). As pranchas
   foram desenhadas à mão com a cara do V7, e não com os componentes reais; por
   isso este teste copia delas o que elas decidem (o que aparece, em que ordem,
   com que texto e com que número) e deixa o desenho de cada controle com o
   Design System.

   O QUE ELE CONFERE
     1. em 1440 por 900, que é a largura das pranchas 6, 7 e 8, nos dois temas:
        as duas fileiras de controle, a lista com "Todos os parceiros", a visão
        geral, a aba Vendas com os meses em sanfona, o período, a aba Acordo e
        página com tudo o que ela grava, e o parceiro novo
     2. que a página lê o banco uma vez só, o histórico inteiro, e que trocar o
        período, o parceiro ou a aba, e voltar aos meses antigos, não lê de novo
     3. em 820 e em 390, que é a largura das pranchas 9 e 10: a lista entra na
        página, o parceiro vira a página com a volta em cima, e no celular a
        tabela dos meses vira lista e cada venda vira cartão
     4. parceiro sem acordo, que é como a loja está hoje: a parte diz "sem
        acordo" em vez de mostrar zero
     5. que quem só lê não vê botão de gravar, e quem não tem a página não
        entra nela
     6. que nada rola para o lado e que não houve erro de JavaScript

   O banco e a loja são de mentira (testes/parceiros-dados.mjs) e o relógio
   fica congelado no sábado, 3 de outubro de 2026, que é o dia do wireframe.

   Uso:  node testes/parceiros.mjs                 confere o site publicado
         node testes/parceiros.mjs http://localhost:4173
   As fotos ficam em testes/atual/parceiros/, fora do repositório.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
import * as P from './parceiros-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/parceiros'
mkdirSync(PASTA, { recursive: true })

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (r, corpo, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) })

/* o perfil de quem abre: 'tudo' edita, 'le' só vê, 'fora' nem tem a página */
function perfil(acesso) {
  const [p] = D.perfil('admin')
  if (acesso !== 'fora') {
    p.paineis = [...p.paineis, 'parceiros']
    p.permissoes.parceiros = acesso === 'le'
      ? { ver: true, editar: false, deletar: false, total: false }
      : { ver: true, editar: true, deletar: true, total: true }
  }
  if (acesso !== 'tudo') { p.papel = 'analista'; p.nome = 'Analista' }
  return [p]
}

async function abrir(nav, { largura, altura, tema, acesso = 'tudo', semAcordo = false, lojaCai = false, comExibicao = false }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: P.FUSO, locale: 'pt-BR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  const gravados = []
  let jaPerguntou = false
  await ctx.clock.setFixedTime(new Date(P.HOJE))
  /* a foto do produto mora no cdn da loja: aqui ela e um quadradinho de mentira */
  await ctx.route('**cdn.shopify.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#1f8a50"/></svg>' }))
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    const corpo = () => { try { return JSON.parse(req.postData() || '{}') } catch { return {} } }
    /* a RPC antes da tabela: os dois endereços têm "parceiro" no nome */
    if (u.includes('/functions/v1/loja')) {
      const c = corpo(); gravados.push(['funcao', c])
      if (c.acao === 'colecoes') return json(r, { ok: true, colecoes: P.colecoes })
      if (c.acao === 'produtos') return json(r, { ok: true, parceiros: [{ parceiro: c.parceiro, na_colecao: 8, produtos: 8 }] })
      return json(r, { ok: false, erro: 'Ação desconhecida.' }, 400)
    }
    if (u.includes('rpc/salvar_parceiro')) { const c = corpo(); gravados.push(['parceiro', c]); return json(r, c.p_id ?? 'p-novo') }
    if (u.includes('rpc/salvar_acordo_do_parceiro')) {
      const c = corpo(); gravados.push(['acordo', c])
      /* o banco de verdade recusa data no passado quando ha venda, ate vir a confirmacao */
      if (c.p_vale_desde < '2026-10-03' && !c.p_refazer && !jaPerguntou) { jaPerguntou = true; return json(r, { code: '23514', message: P.PEDE_CONFIRMACAO }, 400) }
      return json(r, 'acordo-novo')
    }
    if (u.includes('rpc/salvar_exibicao_do_parceiro')) { const c = corpo(); gravados.push(['exibicao', c]); return json(r, c.p_parceiro) }
    if (u.includes('rpc/trocar_senha_do_parceiro')) { gravados.push(['senha', corpo()]); return json(r, 'NOVASENH') }
    if (u.includes('rpc/trocar_link_do_parceiro')) { gravados.push(['link', corpo()]); return json(r, 'chavenova00000000000000000000000') }
    if (m !== 'GET') return json(r, u.includes('rpc/') ? {} : [])
    let lista = []
    if (u.includes('meu_perfil')) lista = perfil(acesso)
    else if (u.includes('parceiro_na_lista')) lista = semAcordo ? P.parceiros.map((x) => ({ ...x, acordo_tipo: null, acordo_valor: null, acordo_base: null, acordo_desde: null, ultimo_tipo: null, ultimo_valor: null, ultimo_base: null, ultimo_desde: null })) : comExibicao ? P.parceiros.map((x) => (x.id === 'p1' ? { ...x, imposto: '3.00', mostrar_desde: '2026-07-01' } : x)) : P.parceiros
    else if (u.includes('venda_da_loja')) {
      /* a linha do pedido da venda que nao conta, de onde sai o valor riscado */
      gravados.push(['leu-loja', u])
      if (lojaCai) return json(r, { message: 'caiu' }, 500)
      lista = P.linhasDaLoja
    }
    else if (u.includes('venda_do_parceiro')) {
      /* a leitura unica: tudo o que aparece, desde a primeira venda, em paginas de mil */
      gravados.push(['leu-vendas', u])
      const desde = /mes=gte\.(\d{4}-\d{2})/.exec(u)?.[1] ?? '0000-00'
      const pulo = Number(/offset=(\d+)/.exec(u)?.[1] ?? 0)
      lista = pulo > 0 ? [] : P.vendas.filter((v) => v.mes >= desde).map((v) => (semAcordo && v.conta ? { ...v, parte: null } : v))
    }
    else if (u.includes('aviso_da_loja')) lista = P.aviso
    return json(r, lista)
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
      fundo: c.backgroundColor, cor: c.color, texto: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 160),
    }
  }
  return o
}, seletores)
const todos = (pg, seletor) => pg.evaluate((seletor) => [...document.querySelectorAll(seletor)].filter((x) => x.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
  return { x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, baixo: r.bottom, raio: c.borderTopLeftRadius, fundo: c.backgroundColor, cor: c.color, letra: c.fontSize + '/' + c.fontWeight, texto: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 160), valor: 'value' in e ? e.value : '' }
}), seletor)
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
const igual = (a, b) => Math.abs(a - b) < 0.6
const linha = (cels) => cels.map((c) => c.texto).join(' | ')
const ultimo = (gravados, tipo) => [...gravados].reverse().find((g) => g[0] === tipo)?.[1]
const quantos = (gravados, tipo) => gravados.filter((g) => g[0] === tipo).length

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* ---------- as leituras de tela que se repetem ------------------------------ */
const textos = async (pg, seletor) => (await todos(pg, seletor)).map((e) => e.texto)
const numeros = (pg) => textos(pg, '.pa-numeros .kpi')
/* um gráfico: o que ele diz e como cada barra está desenhada */
const grafico = (pg, i) => pg.evaluate((i) => {
  const g = [...document.querySelectorAll('.pa-grafico')].filter((x) => x.getClientRects().length)[i]
  if (!g) return null
  const limpo = (e) => (e?.innerText || '').trim().replace(/\s+/g, ' ')
  return {
    titulo: limpo(g.querySelector('.cartao-titulo')), numero: limpo(g.querySelector('.pa-grafico-numero')), sub: limpo(g.querySelector('.pa-grafico-cabeca .pa-ajuda')),
    muitos: g.classList.contains('muitos'), y: g.getBoundingClientRect().top, x: g.getBoundingClientRect().left, w: g.getBoundingClientRect().width,
    eixo: [...g.querySelectorAll('.pa-grafico-eixo span')].map(limpo).join(' | '),
    meses: [...g.querySelectorAll('.pa-grafico-meses span')].map(limpo).join(' '),
    colunas: [...g.querySelectorAll('.pa-coluna')].map((c) => {
      const b = c.querySelector('.pa-coluna-barra'); const v = c.querySelector('.pa-coluna-valor')
      return { h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width, fundo: getComputedStyle(b).backgroundColor, opaca: getComputedStyle(b).opacity, visivel: getComputedStyle(v).visibility === 'visible', texto: limpo(v), falado: (c.getAttribute('aria-label') || '').replace(/\s+/g, ' ') }
    }),
    area: g.querySelector('.pa-grafico-barras').getBoundingClientRect().height,
  }
}, i)
/* a sanfona dos meses, em tabela: as linhas de mês, quem está aberto e o que há dentro */
const meses = (pg) => pg.evaluate(() => {
  const limpo = (e) => (e?.innerText || '').trim().replace(/\s+/g, ' ')
  const t = document.querySelector('table.pa-meses')
  if (!t) return null
  const linhas = [...t.querySelectorAll(':scope > tbody > tr')]
  const celulas = (tr) => [...tr.children].map(limpo).join(' | ')
  const dentro = linhas.filter((l) => l.classList.contains('pa-mes-dentro'))
  const i = linhas.findIndex((l) => l.classList.contains('pa-mes-dentro'))
  const v = dentro[0]?.querySelector('table.pa-vendas')
  const bordas = (tr) => [...tr.children].map((c) => c.getBoundingClientRect().right)
  return {
    cabecalho: [...t.querySelectorAll(':scope > thead th')].map(limpo).join(' | '),
    meses: linhas.filter((l) => l.classList.contains('pa-mes')).map((l) => ({ texto: celulas(l), aberto: l.classList.contains('aberto'), expandido: l.querySelector('button')?.getAttribute('aria-expanded'), h: l.getBoundingClientRect().height })),
    total: celulas(linhas[linhas.length - 1]),
    quantasAbertas: dentro.length, acimaDoAberto: i > 0 ? celulas(linhas[i - 1]) : '',
    vazio: limpo(dentro[0]?.querySelector('.pa-mes-vazio')),
    cabecalhoDasVendas: v ? [...v.querySelectorAll(':scope > thead th')].map(limpo).join(' | ') : '',
    vendas: v ? [...v.querySelectorAll(':scope > tbody > tr:not(.pa-mais)')].map((l) => ({ texto: celulas(l), h: l.getBoundingClientRect().height, fora: l.classList.contains('pa-fora'), riscado: [...l.querySelectorAll('.pa-riscado')].map(limpo).join(' | '), selo: limpo(l.querySelector('.selo')) })) : [],
    mais: v ? limpo(v.querySelector('.pa-ver-mais')) : '', maisH: v?.querySelector('.pa-ver-mais')?.getBoundingClientRect().height ?? 0,
    /* a linha dos meses antigos: o que ela diz, a altura dos botoes e quem vem antes e depois dela */
    maisMeses: limpo(t.querySelector(':scope > tbody > tr.pa-mais-meses')), maisMesesH: [...t.querySelectorAll(':scope > tbody > tr.pa-mais-meses .pa-ver-mais')].map((b) => b.getBoundingClientRect().height),
    depoisDosMeses: (() => { const k = linhas.findIndex((l) => l.classList.contains('pa-mais-meses')); return k > 0 ? [linhas[k - 1].className, linhas[k + 1]?.className].join(' > ') : '' })(),
    fundoDeDentro: dentro[0] ? getComputedStyle(dentro[0].children[0]).backgroundColor : '',
    /* a borda direita de Peças, Total vendido e Parte, e a de Qtd., Valor e Parte */
    foraDir: bordas(linhas[0]).slice(1), dentroDir: v ? bordas(v.querySelector(':scope > tbody > tr')).slice(3) : [],
    fotos: v ? [...v.querySelectorAll('.pa-foto')].map((f) => { const im = f.querySelector('img'); const r = f.getBoundingClientRect(); return { w: r.width, h: r.height, src: im ? im.getAttribute('src') : '', carregou: im ? im.complete && im.naturalWidth > 0 : false, desenho: !!f.querySelector('svg') } }) : [],
    cabe: (() => { const c = t.closest('.pa-quadro').getBoundingClientRect(); return [...t.querySelectorAll('*')].every((e) => { const r = e.getBoundingClientRect(); return !r.width || (r.right <= c.right + 0.6 && r.left >= c.left - 0.6) }) })(),
  }
})
const abrirMes = async (pg, nome) => { await pg.locator('table.pa-meses tr.pa-mes', { hasText: nome }).click(); await pausa(pg) }
const parceiroNaLista = async (pg, nome) => { await pg.locator('.pa-item', { hasText: nome }).click(); await pausa(pg) }
const aba = async (pg, nome) => { await pg.locator('.pa-abas button', { hasText: nome }).click(); await pausa(pg) }
const escolherPeriodo = async (pg, rotulo) => {
  await pg.locator('.sel .cb', { hasText: 'Últimos' }).first().click(); await pausa(pg, 300)
  const opcoes = (await textos(pg, '.mn.flutua .mn-item')).map((o) => o.replace(/\s*✓$/, ''))
  await pg.locator('.mn.flutua .mn-item', { hasText: rotulo }).first().click(); await pausa(pg)
  return opcoes
}
const CARTOES = '.pa-cartoes'

/* ==========================================================================
   1. A PÁGINA EM 1440 POR 900, A LARGURA DAS PRANCHAS, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const G = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema })
  await ir(pg, '/parceiros', '.pa-lado')
  const tinta = await pg.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--ink)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c })

  /* --------------------------------------------- AS DUAS FILEIRAS DE CONTROLE */
  const M = await medir(pg, ['.pagina-topo h1', '.pagina-topo .acima', '.pagina-topo .sub', '.pagina-topo .btn-primario', '.pagina-topo .sel .cb', '.pa-lado', '.pa-miolo', '.pa-cabeca', '.pa-cabeca h2', '.pa-cabeca p'])
  conta(M['.pagina-topo h1'].texto === 'Parceiros' && M['.pagina-topo .acima'].texto === 'Gestão', `${G} topo: Gestão e Parceiros`)
  conta(M['.pagina-topo .sub'].texto === 'Quem vende peças na loja, quanto vendeu e quanto recebe. Último aviso da loja: hoje às 14:32', `${G} topo: o último aviso da loja virou texto do subtítulo, e não uma fileira de controle (${M['.pagina-topo .sub'].texto})`)
  conta(M['.pagina-topo .sel .cb'].texto.includes('Últimos 6 meses') && igual(M['.pagina-topo .sel .cb'].h, 40) && M['.pagina-topo .btn-primario'].texto === 'Novo parceiro' && igual(M['.pagina-topo .btn-primario'].h, 40), `${G} fileira 1: o período e Novo parceiro, com 40 de altura`)
  conta(igual(M['.pagina-topo .btn-primario'].x - M['.pagina-topo .sel .cb'].dir, 10) && igual(M['.pagina-topo .btn-primario'].y, M['.pagina-topo .sel .cb'].y), `${G} fileira 1: o vermelho por último, na mesma linha do período, com 10 entre os dois (${M['.pagina-topo .btn-primario'].x - M['.pagina-topo .sel .cb'].dir})`)
  conta(await pg.locator('.pa-barra').count() === 0 && await pg.getByRole('button', { name: 'Copiar o link' }).count() === 0 && await pg.getByRole('button', { name: 'Abrir a página' }).count() === 0, `${G} não existe mais a barra do aviso, nem Copiar o link e Abrir a página no cabeçalho`)

  /* ----------------------------------------------------------------- A LISTA */
  conta((await textos(pg, '.pa-lado-topo'))[0] === 'Parceiro Parte em outubro', `${G} lista: o cabeçalho diz Parceiro e Parte em outubro`)
  const itens = await todos(pg, '.pa-lado .pa-item')
  conta(itens.length === 4 && itens[0].texto === 'Todos os parceiros Visão geral da loja R$ 205,94 8 peças', `${G} lista: Todos os parceiros no topo, com a soma do mês (${itens[0].texto})`)
  conta(itens[1].texto === 'Saneago Goiás Vôlei 10% por peça · Página ativa R$ 155,94 6 peças', `${G} lista: Goiás em primeiro, com o acordo, a página, a parte e as peças (${itens[1].texto})`)
  conta(itens[2].texto === 'Viapol Vôlei São José R$ 25,00 por peça · Página ativa R$ 50,00 2 peças', `${G} lista: Viapol em segundo, com valor por peça (${itens[2].texto})`)
  conta(itens[3].texto === 'Colégio Professora Yolanda 15% por peça · Página ligada, ainda não aberta R$ 0,00 0 peças', `${G} lista: quem não vendeu no mês vem por último, zerado (${itens[3].texto})`)
  /* o escolhido se pinta igual ao item aberto do menu (07/10/2026): as quatro classes do DS e o degradê */
  const naTinta = await pg.locator('.pa-item').evaluateAll((l) => l.map((e) => ['luz', 'tinta', 'm-grafite', 'tinta-linha'].every((n) => e.classList.contains(n)) && getComputedStyle(e).backgroundImage.includes('gradient')))
  conta(itens.every((i) => i.h >= 64) && naTinta[0] === true && naTinta[1] === false && await pg.locator('.pa-item.ligado').count() === 1, `${G} lista: itens de 64, e Todos os parceiros vem escolhido, na tinta do menu`)
  conta(igual(M['.pa-lado'].w, 300) && igual(M['.pa-miolo'].x - M['.pa-lado'].dir, 24) && igual(M['.pa-lado'].y, M['.pa-miolo'].y), `${G} a lista de 300 ao lado do miolo, alinhados em cima, com 24 entre os dois (${M['.pa-lado'].w}, ${M['.pa-miolo'].x - M['.pa-lado'].dir})`)

  /* ----------------------------------------------------------- A VISÃO GERAL */
  conta(await pg.locator('.pa-cabeca').count() === 0 && await pg.locator('.pa-abas').count() === 0 && !(await pg.locator('.pa-miolo').innerText()).includes('Todos os parceiros'), `${G} geral: sem cabeçalho e sem abas`)
  const kg = await todos(pg, '.pa-numeros .kpi')
  conta(igual(kg[0].y, M['.pa-lado'].y), `${G} geral: a fileira dos quatro números começa na altura do topo do cartão da lista (${kg[0].y} e ${M['.pa-lado'].y})`)
  conta(kg.map((k) => k.texto).join(' | ') === 'Peças vendidas 66 | Total vendido R$ 14.353,40 | Parte dos parceiros R$ 1.489,45 | Fica com a Fourtime R$ 12.863,95', `${G} geral: os quatro números do período (${kg.map((k) => k.texto).join(' | ')})`)
  conta(kg.every((k) => igual(k.y, kg[0].y) && igual(k.h, kg[0].h)) && igual(kg[1].x - kg[0].dir, 16), `${G} geral: os quatro numa fileira só, da mesma altura, com 16 entre eles`)
  const gg = await grafico(pg, 0)
  conta(gg.titulo === 'Vendido por mês' && gg.numero === 'R$ 14.353,40' && gg.sub === 'em vendas de peças de parceiros, sem o frete', `${G} geral: o gráfico Vendido por mês com o total e a frase (${gg.numero})`)
  conta(gg.eixo === '6 mil | 4 mil | 2 mil | 0' && gg.meses === 'mai jun jul ago set out' && gg.colunas.length === 6, `${G} geral: seis barras, de maio a outubro, com o eixo de 6 mil (${gg.eixo})`)
  conta(igual(gg.area, 160) && Math.abs(gg.colunas[4].h - 160 * 3678.1 / 6000) < 0.6 && Math.abs(gg.colunas[5].h - 160 * 2059.2 / 6000) < 0.6 && gg.colunas.every((c) => igual(c.w, 24)), `${G} geral: a altura de cada barra é o valor do mês (${gg.colunas.map((c) => Math.round(c.h)).join(', ')})`)
  conta(gg.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === '. . . . R$ 3.678,10 R$ 2.059,20', `${G} geral: o número fica à mostra nas duas últimas barras (${gg.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ')})`)
  conta(gg.colunas.every((c) => c.fundo === tinta) && gg.colunas[5].opaca === '0.45' && gg.colunas[4].opaca === '1' && gg.colunas[5].falado === 'Outubro de 2026: R$ 2.059,20', `${G} geral: barras na tinta do sistema, o mês em andamento mais claro, e cada barra diz o mês e o valor`)
  await pg.locator('.pa-coluna').nth(1).hover(); await pausa(pg, 200)
  const apontado = await grafico(pg, 0)
  conta(apontado.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === '. R$ 2.579,00 . . . .', `${G} geral: apontar uma barra mostra o número dela e tira os fixos (${apontado.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ')})`)
  await pg.mouse.move(5, 5); await pausa(pg, 200)
  conta((await textos(pg, '.pa-miolo .pa-bloco-titulo')).join(' | ') === 'Por parceiro, no período', `${G} geral: a tabela Por parceiro, no período`)
  conta(linha(await todos(pg, '.pa-miolo table.tabela thead th')) === 'Parceiro | Acordo | Peças | Vendido | Parte do parceiro', `${G} geral: as cinco colunas da tabela do período`)
  const lp = async (i) => linha(await todos(pg, `.pa-miolo table.tabela tbody tr:nth-child(${i}) td`))
  conta(await lp(1) === 'Saneago Goiás Vôlei | 10% por peça | 43 | R$ 9.775,70 | R$ 977,57', `${G} geral: Goiás com 43 peças, R$ 9.775,70 e R$ 977,57 nos seis meses (${await lp(1)})`)
  conta(await lp(2) === 'Viapol Vôlei São José | R$ 25,00 por peça | 14 | R$ 3.498,60 | R$ 350,00' && await lp(3) === 'Colégio Professora Yolanda | 15% por peça | 9 | R$ 1.079,10 | R$ 161,88', `${G} geral: Viapol e Colégio Yolanda somados no período (${await lp(3)})`)
  conta(await lp(4) === 'Total |  | 66 | R$ 14.353,40 | R$ 1.489,45', `${G} geral: a linha do total fecha com os números de cima (${await lp(4)})`)
  const uc = await todos(pg, '.pa-ultimas .pa-compra')
  conta((await textos(pg, '.pa-ultimas .cartao-titulo'))[0] === 'Últimas compras' && uc.length === 6, `${G} geral: o cartão Últimas compras, com seis (${uc.length})`)
  conta(uc[0].texto === 'Camisa Saneago Goiás Vôlei 2026/2027 Verde hoje às 14:32 · Saneago Goiás Vôlei R$ 249,90', `${G} geral: a compra mais nova em cima, com a peça, o dia, o parceiro e o valor (${uc[0].texto})`)
  conta(uc[2].texto.includes('ontem às 21:48 · Saneago Goiás Vôlei · 2 peças') && uc[4].texto.includes('Viapol Vôlei São José'), `${G} geral: venda de duas peças diz que são duas, e as do Viapol entram na ordem do dia`)
  const fg = await pg.evaluate(() => [...document.querySelectorAll('.pa-ultimas .pa-foto')].map((f) => { const i = f.querySelector('img'); const r = f.getBoundingClientRect(); return { w: r.width, h: r.height, src: i ? i.getAttribute('src') : '', desenho: !!f.querySelector('svg') } }))
  conta(fg.length === 6 && fg.every((f) => f.w === 40 && f.h === 40) && fg[0].src === 'https://cdn.shopify.com/s/files/1/0000/exemplo/goias.jpg?v=1&width=96' && fg[5].src === '' && fg[5].desenho, `${G} geral: toda compra tem o quadro da foto de 40, e produto sem foto fica com a camiseta desenhada`)
  conta(await sobra(pg) <= 0, `${G} geral: nada rola para o lado`)
  await foto(pg, `geral-1440-${tema}`)

  /* ------------------------------------------------------ A LEITURA É UMA SÓ */
  const leitura = ultimo(gravados, 'leu-vendas')
  conta(quantos(gravados, 'leu-vendas') === 1 && !leitura.includes('mes=') && leitura.includes('aparece=is.true') && leitura.includes('order=vendido_em.desc') && leitura.includes('limit=1000') && leitura.includes('imagem') && leitura.includes('motivo'), `${G} leitura: uma vez só, as vendas de todos os parceiros desde a primeira, com a foto e o motivo, em páginas de mil`)
  conta(quantos(gravados, 'leu-loja') === 1 && ultimo(gravados, 'leu-loja').includes('item_id=in.(9006)'), `${G} leitura: o valor riscado é pedido só para a venda que não conta`)

  /* ------------------------------------------- UM PARCEIRO, A ABA VENDAS */
  await parceiroNaLista(pg, 'Saneago')
  const C = await medir(pg, ['.pa-cabeca h2', '.pa-cabeca p', '.pa-cabeca .pa-abas', '.pa-miolo'])
  conta(C['.pa-cabeca h2'].texto === 'Saneago Goiás Vôlei' && C['.pa-cabeca p'].texto === '10% por peça, sobre o valor pago · Página ativa, aberta ontem às 09:00', `${G} parceiro: o cabeçalho diz o nome, o acordo e a página (${C['.pa-cabeca p'].texto})`)
  const ab = await todos(pg, '.pa-cabeca .pa-abas button')
  conta(linha(ab) === 'Vendas | Acordo e página' && await pg.locator('.pa-abas button.ligado', { hasText: 'Vendas' }).count() === 1 && igual(C['.pa-cabeca .pa-abas'].h, 40), `${G} fileira 2: as abas Vendas e Acordo e página, com 40 de altura, e Vendas na frente`)
  conta(igual(C['.pa-cabeca .pa-abas'].dir, C['.pa-miolo'].dir) && C['.pa-cabeca .pa-abas'].y < C['.pa-cabeca h2'].baixo + 30, `${G} fileira 2: as abas à direita do nome, na mesma fileira`)
  conta((await todos(pg, '.pa-item.ligado'))[0].texto.startsWith('Saneago Goiás Vôlei'), `${G} parceiro: o escolhido fica preto na lista`)
  conta((await numeros(pg)).join(' | ') === 'Peças em outubro 6 | Vendido em outubro R$ 1.559,40 | Parte em outubro R$ 155,94 | Parte em 6 meses R$ 977,57', `${G} vendas: os quatro números do parceiro (${(await numeros(pg)).join(' | ')})`)
  const g1 = await grafico(pg, 0); const g2 = await grafico(pg, 1)
  conta(g1.titulo === 'Peças vendidas' && g1.numero === '43' && g1.sub === 'peças nos últimos 6 meses' && g1.eixo === '15 | 10 | 5 | 0', `${G} vendas: Peças vendidas, 43, com o eixo de 15 (${g1.eixo})`)
  conta(g1.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === '. . . . 12 6' && Math.abs(g1.colunas[4].h - 160 * 12 / 15) < 0.6, `${G} vendas: 12 em setembro e 6 em outubro em cima das barras`)
  conta(g2.titulo === 'Total vendido' && g2.numero === 'R$ 9.775,70' && g2.sub === 'em vendas nos últimos 6 meses' && g2.eixo === '3 mil | 2 mil | 1 mil | 0', `${G} vendas: Total vendido, R$ 9.775,70, com o eixo de 3 mil (${g2.eixo})`)
  conta(g2.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === '. . . . 2.319 1.559', `${G} vendas: 2.319 e 1.559 em cima das barras, como na prancha (${g2.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ')})`)
  conta(igual(g1.y, g2.y) && igual(g2.x - (g1.x + g1.w), 24), `${G} vendas: os dois gráficos lado a lado, com 24 entre eles`)

  /* ------------------------------------------------- OS MESES EM SANFONA */
  conta((await textos(pg, '.pa-bloco-titulo'))[0] === 'Vendas por mês' && (await textos(pg, '.pa-bloco-topo .pa-ajuda'))[0] === 'Clique num mês para abrir as vendas dele.', `${G} sanfona: o título Vendas por mês e a dica`)
  let S = await meses(pg)
  conta(S.cabecalho === 'Mês | Peças | Total vendido | Parte do parceiro', `${G} sanfona: o cabeçalho dos meses (${S.cabecalho})`)
  conta(S.meses.length === 6 && S.meses[0].texto === 'Outubro de 2026 (até o dia 03) | 6 | R$ 1.559,40 | R$ 155,94' && S.meses[1].texto === 'Setembro de 2026 | 12 | R$ 2.318,80 | R$ 231,88' && S.meses[5].texto === 'Maio de 2026 | 4 | R$ 999,60 | R$ 99,96', `${G} sanfona: seis meses, do mais novo para o mais velho, com as somas da prancha (${S.meses[0].texto})`)
  conta(S.total === 'Total | 43 | R$ 9.775,70 | R$ 977,57', `${G} sanfona: a linha do total (${S.total})`)
  conta(S.quantasAbertas === 1 && S.meses[0].aberto && S.meses[0].expandido === 'true' && S.meses.slice(1).every((m) => !m.aberto && m.expandido === 'false') && S.acimaDoAberto.startsWith('Outubro de 2026'), `${G} sanfona: o mês atual já vem aberto, e só ele`)
  conta(S.cabecalhoDasVendas === 'Data | Peça | Tamanho | Qtd. | Valor | Parte', `${G} sanfona: embaixo do mês aberto, o segundo cabeçalho, o das vendas (${S.cabecalhoDasVendas})`)
  conta(S.vendas.length === 5 && S.vendas[0].texto === '03/10 14:32 | Camisa Saneago Goiás Vôlei 2026/2027 Verde | M | 1 | R$ 249,90 | R$ 24,99', `${G} sanfona: as 5 vendas mais novas do mês, a primeira com dia, hora, peça, tamanho, quantidade, valor e parte (${S.vendas[0]?.texto})`)
  conta(S.vendas[2].texto === '02/10 21:48 | Camisa Saneago Goiás Vôlei 2026/2027 Verde Personalizado | GG | 2 | R$ 579,80 | R$ 57,98' && S.vendas[4].texto === '02/10 09:12 | Camisa Saneago Goiás Vôlei 2025 Verde | M | 1 | R$ 189,90 | R$ 18,99', `${G} sanfona: a venda de duas peças e a quinta venda`)
  conta(S.mais === 'Ver mais 1 venda de outubro' && S.maisH >= 44, `${G} sanfona: depois das 5, a linha de ver mais (${S.mais}, ${S.maisH})`)
  conta(S.vendas.every((v) => v.h >= 56) && S.meses.every((m) => igual(m.h, 48)), `${G} sanfona: mês com linha de 48 e venda com linha de 56`)
  conta(S.foraDir.length === 3 && S.dentroDir.length === 3 && S.foraDir.every((x, i) => igual(x, S.dentroDir[i])), `${G} sanfona: Qtd., Valor e Parte alinhadas embaixo de Peças, Total vendido e Parte do parceiro (${S.foraDir.map(Math.round).join(', ')} e ${S.dentroDir.map(Math.round).join(', ')})`)
  conta(S.fotos.length === 5 && S.fotos.every((f) => f.w === 40 && f.h === 40) && S.fotos[0].src.endsWith('goias.jpg?v=1&width=96') && S.fotos[0].carregou && S.fotos[4].src === '' && S.fotos[4].desenho, `${G} sanfona: cada venda com a foto do produto, e a sem foto com a camiseta desenhada`)
  conta(S.cabe && await sobra(pg) <= 0, `${G} sanfona: nada passa da borda da caixa e nada rola para o lado`)
  await foto(pg, `vendas-1440-${tema}`)

  await pg.locator('table.pa-vendas .pa-ver-mais').click(); await pausa(pg)
  S = await meses(pg)
  conta(S.vendas.length === 6 && S.mais === 'Ver menos', `${G} sanfona: ver mais mostra as 6 do mês e vira Ver menos`)
  conta(S.vendas[5].fora && S.vendas[5].selo === 'Devolvida' && S.vendas[5].texto === '01/10 18:40 | Camisa Saneago Goiás Vôlei 2026/2027 Verde Devolvida | G | 1 | R$ 249,90 | não conta' && S.vendas[5].riscado === 'Camisa Saneago Goiás Vôlei 2026/2027 Verde | R$ 249,90', `${G} sanfona: a devolvida aparece riscada, com o selo e o valor que tinha sido pago, e não conta (${S.vendas[5].texto})`)
  await foto(pg, `vendas-inteira-1440-${tema}`)
  await abrirMes(pg, 'Setembro de 2026')
  S = await meses(pg)
  conta(S.quantasAbertas === 1 && S.acimaDoAberto.startsWith('Setembro de 2026') && !S.meses[0].aberto && S.vendas.length === 1 && S.mais === '' && S.vendas[0].texto === '15/09 12:00 | Camisa Saneago Goiás Vôlei 2025 Verde | M | 12 | R$ 2.318,80 | R$ 231,88', `${G} sanfona: abrir setembro fecha outubro, e mês com até 5 vendas não tem ver mais (${S.vendas[0]?.texto})`)
  await abrirMes(pg, 'Setembro de 2026')
  S = await meses(pg)
  conta(S.quantasAbertas === 0, `${G} sanfona: clicar de novo no mês aberto fecha`)
  await pg.locator('table.pa-meses tr.pa-mes button', { hasText: 'Outubro' }).focus(); await pg.keyboard.press('Enter'); await pausa(pg)
  S = await meses(pg)
  conta(S.quantasAbertas === 1 && S.meses[0].aberto && S.vendas.length === 5, `${G} sanfona: pelo teclado, Enter no mês abre, e ele volta com as 5 primeiras`)

  /* ---------------------------------------------------- OS MESES ANTIGOS */
  conta(S.maisMeses === 'Ver mais 6 meses anteriores' && S.depoisDosMeses === 'pa-mes > total' && S.maisMesesH.every((h) => h >= 44), `${G} meses antigos: depois do último mês e antes do total, a linha "Ver mais 6 meses anteriores" (${S.maisMeses})`)
  await pg.locator('tr.pa-mais-meses .pa-ver-mais', { hasText: 'Ver mais' }).click(); await pausa(pg)
  S = await meses(pg)
  conta(S.meses.length === 12 && S.meses[5].texto.startsWith('Maio de 2026') && S.meses[6].texto === 'Abril de 2026 | 3 | R$ 749,70 | R$ 74,97' && S.meses[11].texto === 'Novembro de 2025 | 0 | R$ 0,00 | R$ 0,00', `${G} meses antigos: o clique traz os 6 meses de antes do período, na mesma tabela (${S.meses[6]?.texto})`)
  conta(S.total === 'Total de 12 meses | 46 | R$ 10.525,40 | R$ 1.052,54', `${G} meses antigos: o total passa a somar o que a tabela mostra, e diz de quantos meses é (${S.total})`)
  conta(S.maisMeses === 'Ver mais 3 meses anteriores Ver menos' && S.meses[0].aberto && S.vendas.length === 5, `${G} meses antigos: sobram 3 até a primeira venda do parceiro, aparece o Ver menos, e o mês aberto continua aberto (${S.maisMeses})`)
  conta((await numeros(pg)).join(' | ') === 'Peças em outubro 6 | Vendido em outubro R$ 1.559,40 | Parte em outubro R$ 155,94 | Parte em 6 meses R$ 977,57' && (await grafico(pg, 0)).colunas.length === 6, `${G} meses antigos: os quatro números e os gráficos continuam sendo os do período`)
  await pg.locator('tr.pa-mais-meses .pa-ver-mais', { hasText: 'Ver mais' }).click(); await pausa(pg)
  S = await meses(pg)
  conta(S.meses.length === 15 && S.meses[12].texto === 'Outubro de 2025 | 1 | R$ 249,90 | R$ 24,99' && S.meses[14].texto === 'Agosto de 2025 | 2 | R$ 499,80 | R$ 49,98' && S.total === 'Total de 15 meses | 49 | R$ 11.275,10 | R$ 1.127,51', `${G} meses antigos: o segundo clique chega no mês da primeira venda, agosto de 2025 (${S.total})`)
  conta(S.maisMeses === 'Ver menos' && S.cabe && await sobra(pg) <= 0, `${G} meses antigos: no fim só sobra o Ver menos, e nada passa da borda`)
  await abrirMes(pg, 'Agosto de 2025')
  S = await meses(pg)
  conta(S.quantasAbertas === 1 && S.acimaDoAberto.startsWith('Agosto de 2025') && S.vendas.length === 1 && S.vendas[0].texto === '15/08 12:00 | Camisa Saneago Goiás Vôlei 2025 Verde | M | 2 | R$ 499,80 | R$ 49,98', `${G} meses antigos: o mês antigo abre como os outros, com as vendas dele (${S.vendas[0]?.texto})`)
  await foto(pg, `meses-antigos-1440-${tema}`)
  await pg.locator('tr.pa-mais-meses .pa-ver-mais', { hasText: 'Ver menos' }).click(); await pausa(pg)
  S = await meses(pg)
  conta(S.meses.length === 6 && S.total === 'Total | 43 | R$ 9.775,70 | R$ 977,57' && S.maisMeses === 'Ver mais 6 meses anteriores' && S.quantasAbertas === 0, `${G} meses antigos: Ver menos volta aos meses do período`)
  await abrirMes(pg, 'Outubro de 2026')
  conta(quantos(gravados, 'leu-vendas') === 1, `${G} meses antigos: voltar no tempo não foi ao banco de novo`)

  /* ----------------------------------------- OUTRO PARCEIRO E O MÊS VAZIO */
  await parceiroNaLista(pg, 'Colégio')
  S = await meses(pg)
  conta((await numeros(pg)).join(' | ') === 'Peças em outubro 0 | Vendido em outubro R$ 0,00 | Parte em outubro R$ 0,00 | Parte em 6 meses R$ 161,88' && S.meses[0].aberto && S.vazio === 'Nenhuma venda em outubro até agora.' && S.total === 'Total | 9 | R$ 1.079,10 | R$ 161,88', `${G} parceiro sem venda no mês: os números zeram e o mês aberto diz que não houve venda (${S.vazio})`)
  conta(S.maisMeses === '', `${G} meses antigos: parceiro sem venda antes do período não tem a linha`)
  conta((await medir(pg, ['.pa-cabeca p']))['.pa-cabeca p'].texto === '15% por peça, sobre o valor pago · Página ligada, ainda não aberta', `${G} parceiro que nunca abriu a página: o cabeçalho diz isso`)

  /* --------------------------------------------------------------- O PERÍODO */
  await parceiroNaLista(pg, 'Saneago')
  const opcoes = await escolherPeriodo(pg, 'Últimos 12 meses')
  conta(opcoes.join(' | ') === 'Últimos 6 meses | Últimos 3 meses | Últimos 12 meses | Desde o início', `${G} período: 6, 3 ou 12 meses, e Desde o início (${opcoes.join(' | ')})`)
  S = await meses(pg)
  const g12 = await grafico(pg, 1)
  conta(S.meses.length === 12 && S.meses[6].texto === 'Abril de 2026 | 3 | R$ 749,70 | R$ 74,97' && S.meses[11].texto === 'Novembro de 2025 | 0 | R$ 0,00 | R$ 0,00' && S.total === 'Total | 46 | R$ 10.525,40 | R$ 1.052,54', `${G} 12 meses: doze linhas, abril entra e o total cresce (${S.total})`)
  conta(S.maisMeses === 'Ver mais 3 meses anteriores', `${G} 12 meses: a linha dos meses antigos conta o que sobra até a primeira venda (${S.maisMeses})`)
  conta((await numeros(pg))[3] === 'Parte em 12 meses R$ 1.052,54' && g12.colunas.length === 12 && g12.muitos && g12.meses.startsWith('nov dez jan') && g12.sub === 'em vendas nos últimos 12 meses', `${G} 12 meses: o número e o gráfico acompanham, com doze barras`)
  conta(g12.colunas.filter((c) => c.visivel).length === 0 && g12.colunas.every((c) => c.w >= 12), `${G} 12 meses: no cartão estreito, com as barras perto, nenhum número fica fixo, e nenhuma barra some (${Math.round(g12.colunas[0].w)} de largura)`)
  await pg.locator('.pa-grafico').nth(1).locator('.pa-coluna').nth(5).hover(); await pausa(pg, 200)
  const a12 = await grafico(pg, 1)
  conta(a12.colunas.filter((c) => c.visivel).length === 1 && a12.colunas[5].visivel && a12.colunas[5].texto === '750', `${G} 12 meses: apontar a barra mostra o número dela (${a12.colunas[5].texto})`)
  await pg.mouse.move(5, 5); await pausa(pg, 200)
  conta(await sobra(pg) <= 0, `${G} 12 meses: nada rola para o lado`)
  await foto(pg, `vendas-12-meses-1440-${tema}`)
  await pg.locator('.pa-item', { hasText: 'Todos os parceiros' }).click(); await pausa(pg)
  conta((await numeros(pg))[1] === 'Total vendido R$ 15.103,10', `${G} 12 meses: a visão geral acompanha o período`)
  const gg12 = await grafico(pg, 0)
  conta(gg12.colunas.length === 12 && gg12.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === '. . . . . . . . . . . 2.059', `${G} 12 meses: no gráfico largo só a última barra mostra o número, na forma curta (${gg12.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ')})`)
  await escolherPeriodo(pg, 'Últimos 3 meses')
  await parceiroNaLista(pg, 'Saneago')
  S = await meses(pg)
  conta(S.meses.length === 3 && S.total === 'Total | 27 | R$ 5.617,30 | R$ 561,73' && (await numeros(pg))[3] === 'Parte em 3 meses R$ 561,73' && (await textos(pg, '.pa-lado .pa-item'))[1].endsWith('R$ 155,94 6 peças'), `${G} 3 meses: três linhas, e a coluna da lista continua sendo o mês atual (${S.total})`)
  await parceiroNaLista(pg, 'Colégio')
  S = await meses(pg)
  conta(S.maisMeses === 'Ver mais 1 mês anterior', `${G} 3 meses: o Colégio, que vendeu pela primeira vez em julho, tem um mês só para voltar (${S.maisMeses})`)
  await pg.locator('tr.pa-mais-meses .pa-ver-mais').click(); await pausa(pg)
  S = await meses(pg)
  conta(S.meses.length === 4 && S.meses[3].texto === 'Julho de 2026 | 3 | R$ 269,70 | R$ 40,46' && S.total === 'Total de 4 meses | 9 | R$ 1.079,10 | R$ 161,88' && S.maisMeses === 'Ver menos', `${G} 3 meses: o clique traz julho e fecha a conta do parceiro (${S.total})`)
  await parceiroNaLista(pg, 'Saneago')
  await escolherPeriodo(pg, 'Últimos 6 meses')
  conta(quantos(gravados, 'leu-vendas') === 1, `${G} trocar de parceiro, de mês e de período não foi ao banco de novo (${quantos(gravados, 'leu-vendas')} leitura)`)

  /* ------------------------------------------------ A ABA ACORDO E PÁGINA */
  await aba(pg, 'Acordo e página')
  conta(await pg.locator('.pa-numeros').count() === 0 && await pg.locator('table.pa-meses').count() === 0, `${G} acordo: a aba troca o conteúdo, e as vendas saem`)
  const cartoes = await todos(pg, `${CARTOES} > .cartao`)
  const titulos = await todos(pg, `${CARTOES} .cartao-titulo`)
  conta(cartoes.length === 2 && linha(titulos) === 'Acordo | Página do parceiro' && titulos.every((t) => t.letra === '15px/600'), `${G} acordo: dois cartões, Acordo e Página do parceiro (${linha(titulos)})`)
  conta(igual(cartoes[0].y, cartoes[1].y) && igual(cartoes[1].x - cartoes[0].dir, 24) && cartoes.every((c) => c.raio === '14px'), `${G} acordo: os dois lado a lado, com 24 entre eles e raio 14`)
  const rotulos = async (i) => (await todos(pg, `${CARTOES} > .cartao:nth-child(${i}) .campo > span:first-child`)).map((r) => r.texto).join(' | ')
  conta(await rotulos(1) === 'Nome do parceiro | Coleção da loja | Acordo | Percentual por peça | Vale a partir de | O percentual é sobre | Imposto, só no texto', `${G} acordo: os campos do cartão Acordo, na ordem (${await rotulos(1)})`)
  conta(await rotulos(2) === 'Link da página do parceiro | Senha da página | Mostrar as vendas a partir de', `${G} acordo: o link, a senha e o dia em que o relatório começa no cartão da página (${await rotulos(2)})`)
  const campos = await todos(pg, `${CARTOES} input`)
  conta(campos[0].valor === 'Saneago Goiás Vôlei' && campos[1].valor === '10' && campos[2].valor === '01/10/2026', `${G} acordo: nome, 10% e a data 01/10/2026 (${campos.slice(0, 3).map((c) => c.valor).join(', ')})`)
  conta((await pg.locator(`${CARTOES} .sel .cb`).first().innerText()).replace(/\s+/g, ' ').includes('Saneago Goiás Vôlei Completo (8 produtos)'), `${G} acordo: a coleção mostra o nome e quantos produtos tem`)
  conta(campos[3].valor === '' && campos[6].valor === '' && campos[4].valor === `fourtimefit.com.br/pages/parceiro#k=${P.parceiros[1].chave}`, `${G} página: o link leva a chave depois do #, sem o https`)
  conta(await pg.locator(`${CARTOES} input[aria-label="Senha da página"]`).getAttribute('type') === 'password', `${G} página: a senha nasce escondida`)
  await pg.getByRole('button', { name: 'Mostrar' }).click(); await pausa(pg, 200)
  conta(await pg.locator(`${CARTOES} input[aria-label="Senha da página"]`).getAttribute('type') === 'text' && await pg.getByRole('button', { name: 'Esconder' }).count() === 1, `${G} página: Mostrar revela a senha e vira Esconder`)
  const altos = await todos(pg, `${CARTOES} .entrada, ${CARTOES} .btn, ${CARTOES} .sel .cb, ${CARTOES} .seg, ${CARTOES} .data, .pa-pe .btn`)
  conta(altos.length >= 14 && altos.every((a) => igual(a.h, 40)), `${G} acordo: todo controle tem 40 de altura (${[...new Set(altos.map((a) => a.h))].join(', ')})`)
  const fileiraDoLink = await todos(pg, `${CARTOES} .campo:has(input[aria-label="Link da página do parceiro"]) .pa-com-botoes > *`)
  conta(linha(fileiraDoLink.slice(1)) === 'Copiar | Trocar' && igual(fileiraDoLink[1].x - fileiraDoLink[0].dir, 10) && igual(fileiraDoLink[2].x - fileiraDoLink[1].dir, 10), `${G} página: Copiar e Trocar ao lado do link, com 10 entre eles`)
  conta((await pg.locator(`${CARTOES} > .cartao:nth-child(1) .pa-ajuda`).last().innerText()).endsWith('Mudar o acordo não mexe nas vendas já registradas.'), `${G} acordo: o acordo que já vale não ameaça recalcular nada`)
  conta(await pg.locator('.pa-chave .tgl.ligado').count() === 1 && (await pg.locator('.pa-chave').innerText()).includes('Página ativa'), `${G} página: a chave Página ativa vem ligada`)
  conta((await textos(pg, '.pa-notas .pa-ajuda')).join(' | ') === 'Aberta pelo parceiro pela última vez: ontem às 09:00. | O parceiro vê na página dele as mesmas vendas da aba Vendas.', `${G} página: diz quando o parceiro abriu pela última vez`)
  const pe = await todos(pg, '.pa-pe .btn')
  const miolo = (await medir(pg, ['.pa-miolo']))['.pa-miolo']
  conta(linha(pe) === 'Abrir a página | Salvar' && igual(pe[1].x - pe[0].dir, 10) && igual(pe[1].dir, miolo.dir) && pe[0].y > cartoes[0].baixo, `${G} acordo: Abrir a página e Salvar embaixo dos dois cartões, à direita, o vermelho por último`)
  conta(await sobra(pg) <= 0, `${G} acordo: nada rola para o lado`)
  await foto(pg, `acordo-1440-${tema}`)

  /* o que foi digitado não se perde ao olhar as vendas e voltar */
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('17'); await aba(pg, 'Vendas'); await aba(pg, 'Acordo e página')
  conta(await pg.locator('.pa-unidade:not([data-imposto]) input').inputValue() === '17', `${G} acordo: ir à aba Vendas e voltar não apaga o que foi digitado`)
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('10'); await pausa(pg, 200)

  /* ----------------------------------------------------------- SALVAR */
  gravados.length = 0
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  conta(quantos(gravados, 'parceiro') === 1 && quantos(gravados, 'acordo') === 0 && quantos(gravados, 'exibicao') === 0, `${G} salvar sem mexer no acordo: grava o cadastro e não escreve acordo novo, nem imposto, nem data`)
  const c1 = ultimo(gravados, 'parceiro')
  conta(c1.p_id === 'p1' && c1.p_nome === 'Saneago Goiás Vôlei' && c1.p_colecao === 'saneago-goias-volei-completo' && c1.p_colecao_nome === 'Saneago Goiás Vôlei Completo' && c1.p_ativo === true, `${G} salvar: o cadastro vai com nome, coleção e a página ativa`)
  conta(JSON.stringify(ultimo(gravados, 'funcao')) === JSON.stringify({ acao: 'produtos', parceiro: 'p1' }), `${G} salvar: manda o porteiro reler os produtos da coleção`)
  conta(await pg.locator('.pa-abas button.ligado', { hasText: 'Acordo e página' }).count() === 1 && quantos(gravados, 'leu-vendas') === 1, `${G} salvar: relê o banco e fica na aba do acordo`)

  gravados.length = 0
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('12,5'); await pg.locator(`${CARTOES} .seg button`, { hasText: 'Preço cheio' }).click()
  await pg.locator(`${CARTOES} > .cartao:nth-child(1) .data-campo`).fill('03/10/2026'); await pausa(pg, 200)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const a1 = ultimo(gravados, 'acordo')
  conta(a1 && a1.p_parceiro === 'p1' && a1.p_tipo === 'percentual' && a1.p_valor === 12.5 && a1.p_base === 'preco_cheio' && a1.p_vale_desde === '2026-10-03' && a1.p_refazer === false, `${G} acordo novo: 12,5% sobre o preço cheio a partir de hoje (${JSON.stringify(a1)})`)
  conta(await pg.locator('dialog[open]').count() === 0, `${G} acordo de hoje em diante: salva sem perguntar nada`)

  /* --------------------------------------- ACORDO COM DATA NO PASSADO */
  gravados.length = 0
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('20'); await pg.locator(`${CARTOES} > .cartao:nth-child(1) .data-campo`).fill('15/09/2026'); await pausa(pg, 200)
  conta((await pg.locator(`${CARTOES} > .cartao:nth-child(1) .pa-ajuda`).last().innerText()).includes('A data está no passado'), `${G} data no passado: o cartão avisa antes de salvar`)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  conta(await pg.locator('dialog[open] .t', { hasText: 'Refazer a conta das vendas?' }).count() === 1 && (await pg.locator('dialog[open] .pa-pergunta').innerText()).includes('6 venda(s)'), `${G} data no passado: a pergunta do banco aparece numa caixa própria, com o número de vendas`)
  await foto(pg, `pergunta-${tema}`, false)
  await pg.getByRole('button', { name: 'Confirmar e refazer' }).click(); await pausa(pg, 700)
  const acordos = gravados.filter((g) => g[0] === 'acordo').map((g) => g[1])
  conta(acordos.length === 2 && acordos[0].p_refazer === false && acordos[1].p_refazer === true && acordos[1].p_vale_desde === '2026-09-15' && acordos[1].p_valor === 20, `${G} data no passado: só grava depois de confirmar, e a confirmação vai ao banco`)
  conta(await pg.locator('dialog[open]').count() === 0, `${G} data no passado: confirmado, a caixa fecha`)

  /* ------------------------------------------- VALOR RUIM NÃO SALVA */
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('150'); await pausa(pg, 200)
  conta(await pg.getByRole('button', { name: 'Salvar' }).isDisabled() && (await pg.locator(`${CARTOES} .campo.erro .dica`).innerText()) === 'Um número de 0 a 100.', `${G} percentual acima de 100: o campo diz o que aceita e o Salvar apaga`)
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('10'); await pausa(pg, 200)

  /* ------------------------- O IMPOSTO NA FRASE E O DIA DO RELATÓRIO (057) */
  {
    const frase = async () => (await pg.locator('[data-frase-da-pagina]').innerText()).replace(/\s+/g, ' ').trim()
    const imposto = pg.locator('input[aria-label="Imposto, só no texto"]')
    await pg.locator(`${CARTOES} .seg button`, { hasText: 'Valor pago' }).click(); await pausa(pg, 200)
    conta(await frase() === 'Na página do parceiro: "Seu acordo: 10% do valor de cada peça". O imposto não entra na conta: a parte do parceiro continua saindo do percentual acima.', `${G} imposto em branco: a frase da página é a de sempre (${await frase()})`)
    const cx = await todos(pg, `${CARTOES} > .cartao:nth-child(1) .pa-unidade`)
    conta(cx.length === 2 && igual(cx[0].w, cx[1].w) && igual(cx[0].x, cx[1].x) && cx.every((c) => igual(c.h, 40)), `${G} imposto: o campo tem a largura e a altura do campo do percentual, embaixo dele (${cx.map((c) => c.w + 'x' + c.h).join(', ')})`)
    await imposto.fill('3'); await pausa(pg, 200)
    conta(await frase() === 'Na página do parceiro: "Seu acordo: 13% menos 3% de imposto / 10% do valor de cada peça". O imposto não entra na conta: a parte do parceiro continua saindo do percentual acima.', `${G} imposto 3 com acordo 10: a frase vira 13% menos 3% de imposto / 10% (${await frase()})`)
    await pg.locator('.pa-unidade:not([data-imposto]) input').fill('17'); await pausa(pg, 200)
    conta((await frase()).startsWith('Na página do parceiro: "Seu acordo: 20% menos 3% de imposto / 17% do valor de cada peça".'), `${G} imposto 3 com acordo 17: 20% menos 3% de imposto / 17% do valor de cada peça`)
    await foto(pg, `imposto-1440-${tema}`)
    await pg.locator('.pa-unidade:not([data-imposto]) input').fill('10'); await pausa(pg, 200)
    await imposto.fill('95'); await pausa(pg, 200)
    conta(await pg.getByRole('button', { name: 'Salvar' }).isDisabled() && (await pg.locator(`${CARTOES} .campo.erro .dica`).innerText()) === 'Um número de 0 a 100 que, somado ao acordo, não passe de 100.', `${G} imposto que estoura os 100 com o acordo: o campo diz o que aceita e o Salvar apaga`)
    await imposto.fill('3'); await pausa(pg, 200)
    const inicio = pg.locator(`${CARTOES} > .cartao:nth-child(2) .data-campo`)
    const nota = async () => (await pg.locator('[data-inicio-do-relatorio]').innerText()).replace(/\s+/g, ' ').trim()
    conta(await nota() === 'Em branco, a página do parceiro mostra desde a primeira venda.', `${G} início do relatório em branco: a ficha diz que a página mostra tudo`)
    await inicio.fill('01/07/2026'); await pausa(pg, 200)
    conta(await nota() === 'A página do parceiro só mostra as vendas de 01/07/2026 em diante. Aqui no sistema você continua vendo todas.', `${G} início do relatório em 01/07/2026: a ficha diz o que o parceiro passa a ver (${await nota()})`)
    gravados.length = 0
    await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
    const ex = ultimo(gravados, 'exibicao')
    conta(quantos(gravados, 'exibicao') === 1 && ex.p_parceiro === 'p1' && ex.p_imposto === 3 && ex.p_mostrar_desde === '2026-07-01', `${G} salvar: o imposto e a data vão numa chamada só (${JSON.stringify(ex)})`)
    const ordem = gravados.map((g) => g[0]).filter((t) => ['parceiro', 'exibicao', 'acordo'].includes(t))
    conta(ordem.indexOf('exibicao') === 1 && ordem.every((t, i) => t !== 'acordo' || i > 1), `${G} salvar: o imposto e a data vão logo depois do cadastro, antes do acordo, que pode parar para perguntar (${ordem.join(', ')})`)
    conta(gravados.filter((g) => g[0] === 'acordo').every((g) => g[1].p_valor === 10), `${G} salvar: o acordo que vai ao banco continua 10, sem o imposto dentro`)
    conta(await sobra(pg) <= 0, `${G} imposto e data: nada rola para o lado`)
  }

  /* ------------------------------------------- SENHA E LINK NOVOS */
  gravados.length = 0
  await pg.getByRole('button', { name: 'Gerar outra' }).click(); await pausa(pg)
  conta(await pg.locator('dialog[open] .t', { hasText: 'Gerar outra senha?' }).count() === 1 && quantos(gravados, 'senha') === 0, `${G} gerar outra senha: pergunta antes, e não gera nada enquanto não confirmar`)
  await pg.locator('dialog[open]').getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)
  conta(quantos(gravados, 'senha') === 0 && await pg.locator('dialog[open]').count() === 0, `${G} gerar outra senha: cancelar não gera`)
  await pg.getByRole('button', { name: 'Gerar outra' }).click(); await pausa(pg)
  await pg.locator('dialog[open]').getByRole('button', { name: 'Gerar outra' }).click(); await pausa(pg, 700)
  conta(quantos(gravados, 'senha') === 1 && ultimo(gravados, 'senha').p_parceiro === 'p1', `${G} gerar outra senha: confirmada, pede a senha nova ao banco`)
  await pg.getByRole('button', { name: 'Trocar' }).click(); await pausa(pg)
  await pg.locator('dialog[open]').getByRole('button', { name: 'Trocar o link' }).click(); await pausa(pg, 700)
  conta(quantos(gravados, 'link') === 1 && ultimo(gravados, 'link').p_parceiro === 'p1', `${G} trocar o link: pergunta, e confirmado pede o link novo ao banco`)

  /* a aba Vendas é sempre a primeira ao trocar de parceiro */
  await parceiroNaLista(pg, 'Viapol')
  conta(await pg.locator('.pa-abas button.ligado', { hasText: 'Vendas' }).count() === 1 && (await numeros(pg))[2] === 'Parte em outubro R$ 50,00', `${G} trocar de parceiro volta para a aba Vendas`)
  await aba(pg, 'Acordo e página')
  const v = await todos(pg, `${CARTOES} input`)
  conta(v[1].valor === '25,00' && await pg.locator(`${CARTOES} .seg button.ligado`, { hasText: 'Valor por peça' }).count() === 1 && !(await rotulos(1)).includes('O percentual é sobre') && !(await rotulos(1)).includes('Imposto') && await pg.locator('[data-frase-da-pagina]').count() === 0, `${G} valor por peça: mostra R$ 25,00 e somem a pergunta "o percentual é sobre" e o imposto (${v[1].valor})`)

  /* --------------------------------------------------- PARCEIRO NOVO */
  gravados.length = 0
  await pg.getByRole('button', { name: 'Novo parceiro' }).click(); await pausa(pg)
  const N = await medir(pg, ['.pa-cabeca h2', '.pa-cabeca p'])
  conta(N['.pa-cabeca h2'].texto === 'Novo parceiro' && N['.pa-cabeca p'].texto === 'O link e a senha da página nascem quando você salvar.' && await pg.locator('.pa-abas').count() === 0 && await pg.locator('.pa-item.ligado').count() === 0, `${G} novo: o cabeçalho diz Novo parceiro, sem abas, e ninguém fica escolhido na lista`)
  conta(linha(await todos(pg, `${CARTOES} .cartao-titulo`)) === 'Acordo | Página do parceiro' && await pg.getByRole('button', { name: 'Salvar' }).isDisabled(), `${G} novo: os mesmos dois cartões, vazios, e o Salvar espera o nome`)
  conta(linha(await todos(pg, '.pa-pe .btn')) === 'Cancelar | Salvar' && await pg.getByRole('button', { name: 'Abrir a página' }).count() === 0 && await pg.locator('.pa-chave .tgl.ligado').count() === 0, `${G} novo: sem link, sem senha, com a página desligada, e com Cancelar no pé`)
  await foto(pg, `novo-1440-${tema}`)
  await pg.locator(`${CARTOES} input`).first().fill('Vôlei Guarulhos')
  await pg.locator(`${CARTOES} .sel .cb`).first().click(); await pausa(pg, 300)
  conta((await todos(pg, '.mn.flutua .mn-item')).length === 5, `${G} novo: a lista traz as coleções da loja e a opção de não escolher`)
  await pg.locator('.mn.flutua .mn-item', { hasText: 'Fourtime Run' }).first().click(); await pausa(pg, 300)
  await pg.locator('.pa-unidade:not([data-imposto]) input').fill('8'); await pausa(pg, 200)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const novo = ultimo(gravados, 'parceiro'); const acordoDoNovo = ultimo(gravados, 'acordo')
  conta(novo.p_id === null && novo.p_nome === 'Vôlei Guarulhos' && novo.p_colecao === 'fourtime-run' && novo.p_colecao_nome === 'Fourtime Run' && novo.p_ativo === false, `${G} novo: nasce sem id, com a coleção escolhida e a página desligada (${JSON.stringify(novo)})`)
  conta(acordoDoNovo.p_parceiro === 'p-novo' && acordoDoNovo.p_valor === 8 && acordoDoNovo.p_vale_desde === '2026-10-03', `${G} novo: o acordo vai para o id que o banco devolveu, valendo de hoje`)
  await pg.getByRole('button', { name: 'Novo parceiro' }).click(); await pausa(pg)
  await pg.getByRole('button', { name: 'Cancelar' }).click(); await pausa(pg)
  conta(await pg.locator('.pa-cabeca').count() === 0 && (await todos(pg, '.pa-item.ligado'))[0].texto.startsWith('Todos os parceiros') && (await numeros(pg))[0].startsWith('Peças vendidas'), `${G} novo: Cancelar volta para a visão geral`)

  conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
}

/* a tela maior: as duas colunas continuam e nada rola para o lado */
{
  const { ctx, pg, erros } = await abrir(nav, { largura: 1920, altura: 1080, tema: 'light' })
  await ir(pg, '/parceiros', '.pa-lado')
  await parceiroNaLista(pg, 'Saneago')
  const S = await meses(pg)
  conta(await sobra(pg) <= 0 && S.cabe && S.foraDir.every((x, i) => igual(x, S.dentroDir[i])) && erros.length === 0, '1920: as duas colunas, a sanfona alinhada e nada rola para o lado')
  await foto(pg, 'vendas-1920-light')
  await ctx.close()
}

/* ==========================================================================
   2. A TELA QUE NÃO CABE AS DUAS COLUNAS: 820 E 390, NOS DOIS TEMAS
   ========================================================================== */
for (const [nome, largura, altura] of [['820', 820, 1180], ['390', 390, 844]]) {
  for (const tema of ['light', 'dark']) {
    const G = `${nome} ${tema === 'light' ? 'gelo' : 'grafite'}`
    const cel = largura < 768
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura, altura, tema })
    await ir(pg, '/parceiros', '.pa-lista')

    /* ------------------------------------------------------- A VISÃO GERAL */
    conta(await sobra(pg) <= 0, `${G} geral: nada rola para o lado`)
    conta(await pg.locator('.pa-lado').count() === 0 && await pg.locator('.pa-cabeca').count() === 0, `${G} geral: a lista não fica ao lado, e a página é a visão geral`)
    const T = await medir(pg, ['.pagina-topo .sel .cb', '.pagina-topo .btn-primario', '.pagina-topo .sub'])
    conta(igual(T['.pagina-topo .sel .cb'].y, T['.pagina-topo .btn-primario'].y) && T['.pagina-topo .btn-primario'].x > T['.pagina-topo .sel .cb'].dir && T['.pagina-topo .sub'].texto.endsWith('Último aviso da loja: hoje às 14:32'), `${G} geral: uma fileira só, com o período e Novo parceiro`)
    const k = await todos(pg, '.pa-numeros .kpi')
    conta(k.length === 4 && (cel ? igual(k[0].y, k[1].y) && k[2].y > k[0].y && igual(k[2].y, k[3].y) : k.every((x) => igual(x.y, k[0].y))), `${G} geral: os quatro números ${cel ? 'dois e dois' : 'numa fileira'}, nunca três e um`)
    conta(k.map((x) => x.texto).join(' | ') === 'Peças vendidas 66 | Total vendido R$ 14.353,40 | Parte dos parceiros R$ 1.489,45 | Fica com a Fourtime R$ 12.863,95', `${G} geral: os mesmos quatro números`)
    const itens = await todos(pg, '.pa-lista .pa-item')
    conta((await textos(pg, '.pa-bloco-titulo')).join(' | ') === 'Parceiros' && itens.length === 3 && itens.every((i) => i.h >= 64) && await pg.locator('.pa-item.ligado').count() === 0, `${G} geral: a lista de três parceiros dentro da página, com alvo de toque, e sem "Todos os parceiros"`)
    conta(itens[0].texto === 'Saneago Goiás Vôlei 10% por peça · Página ativa R$ 155,94 6 peças' && (await textos(pg, '.pa-bloco > .pa-ajuda'))[0] === 'Toque num parceiro para ver as vendas e o acordo dele.', `${G} geral: a linha traz o nome, o acordo, a parte e as peças, e a dica embaixo`)
    const g = await grafico(pg, 0)
    const ordem = await medir(pg, ['.pa-numeros', '.pa-lista', '.pa-grafico', '.pa-ultimas'])
    conta(ordem['.pa-numeros'].y < ordem['.pa-lista'].y && ordem['.pa-lista'].y < ordem['.pa-grafico'].y && ordem['.pa-grafico'].y < ordem['.pa-ultimas'].y, `${G} geral: a ordem da prancha, números, parceiros, gráfico e últimas compras`)
    conta(g.titulo === 'Vendido por mês' && g.colunas.length === 6 && g.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ') === (cel ? '. . . . 3.678 2.059' : '. . . . R$ 3.678,10 R$ 2.059,20') && igual(g.area, cel ? 140 : 160), `${G} geral: o gráfico${cel ? ', com o número curto em cima das barras' : ''} (${g.colunas.map((c) => (c.visivel ? c.texto : '.')).join(' ')})`)
    conta(await pg.locator('.pa-miolo table.tabela').count() === 0 && (await todos(pg, '.pa-ultimas .pa-compra')).length === (cel ? 4 : 6), `${G} geral: sem a tabela do período, e ${cel ? 'quatro' : 'seis'} últimas compras`)
    await foto(pg, `geral-${nome}-${tema}`)

    /* ---------------------------------------------- O PARCEIRO É A PÁGINA */
    await pg.evaluate(() => window.scrollTo(0, 400))
    await parceiroNaLista(pg, 'Saneago')
    const V = await medir(pg, ['.pa-volta', '.pa-volta-fileira .sel .cb', '.pa-cabeca h1', '.pa-cabeca p', '.pa-abas', '.pa-miolo'])
    conta(await pg.locator('.pagina-topo').count() === 0 && V['.pa-volta'].texto === 'Parceiros' && V['.pa-volta'].h >= 44, `${G} parceiro: a página passa a ser a dele, com a volta para Parceiros em cima`)
    conta(V['.pa-volta-fileira .sel .cb'].texto.includes('Últimos 6 meses') && Math.abs((V['.pa-volta'].y + V['.pa-volta'].h / 2) - (V['.pa-volta-fileira .sel .cb'].y + V['.pa-volta-fileira .sel .cb'].h / 2)) < 1, `${G} parceiro: a volta e o período na mesma fileira`)
    conta(V['.pa-cabeca h1'].texto === 'Saneago Goiás Vôlei' && V['.pa-cabeca h1'].letra === '22px/600' && V['.pa-cabeca p'].texto.startsWith('10% por peça, sobre o valor pago · Página ativa'), `${G} parceiro: o nome é o título da página (${V['.pa-cabeca h1'].letra})`)
    conta(linha(await todos(pg, '.pa-abas button')) === 'Vendas | Acordo e página' && (cel ? igual(V['.pa-abas'].w, V['.pa-miolo'].w) && V['.pa-abas'].h >= 44 : igual(V['.pa-abas'].dir, V['.pa-miolo'].dir)), `${G} parceiro: as abas ${cel ? 'na largura inteira, com alvo de toque' : 'à direita do nome'} (${Math.round(V['.pa-abas'].w)} de ${Math.round(V['.pa-miolo'].w)}, ${V['.pa-abas'].h} de altura)`)
    const rolado = await pg.evaluate(() => window.scrollY)
    conta(rolado < 5, `${G} parceiro: a página nova começa do topo (${rolado})`)
    const kp = await todos(pg, '.pa-numeros .kpi')
    conta(kp.map((x) => x.texto).join(' | ') === 'Peças em outubro 6 | Vendido em outubro R$ 1.559,40 | Parte em outubro R$ 155,94 | Parte em 6 meses R$ 977,57' && (cel ? igual(kp[0].y, kp[1].y) && kp[2].y > kp[0].y : kp.every((x) => igual(x.y, kp[0].y))), `${G} vendas: os quatro números do parceiro`)
    const g1 = await grafico(pg, 0); const g2 = await grafico(pg, 1)
    conta(g1.numero === '43' && g2.numero === 'R$ 9.775,70' && (cel ? g2.y > g1.y + 100 : igual(g1.y, g2.y)), `${G} vendas: os dois gráficos ${cel ? 'um embaixo do outro' : 'lado a lado'}`)
    if (cel) {
      const linhas = await todos(pg, '.pa-meses-cel .pa-mes-linha')
      conta(await pg.locator('table.pa-meses').count() === 0 && linhas.length === 8 && linhas[0].texto === 'Mês Peças Vendido Parte', `${G} sanfona: no celular a tabela vira lista, com o cabeçalho curto (${linhas[0].texto})`)
      conta(linhas[1].texto === 'out/26 6 1.559,40 155,94' && linhas[2].texto === 'set/26 12 2.318,80 231,88' && linhas[7].texto === 'Total 43 9.775,70 977,57', `${G} sanfona: o mês curto e o dinheiro sem o R$ (${linhas[1].texto})`)
      conta(linhas.slice(1, 7).every((l) => l.h >= 44) && await pg.locator('.pa-mes-linha.aberto').count() === 1 && await pg.locator('.pa-mes-linha.aberto').getAttribute('aria-expanded') === 'true', `${G} sanfona: cada mês é um alvo de toque, e o atual já vem aberto`)
      const cartoes = await todos(pg, 'div.pa-mes-dentro .pa-venda')
      conta(cartoes.length === 5 && cartoes[0].texto === '03/10 às 14:32 Tamanho M, 1 peça Camisa Saneago Goiás Vôlei 2026/2027 Verde R$ 249,90 Parte: R$ 24,99', `${G} sanfona: cada venda vira um cartão, com dia, tamanho, peça, valor e parte (${cartoes[0]?.texto})`)
      conta(cartoes[2].texto.includes('Tamanho GG, 2 peças') && await pg.locator('div.pa-mes-dentro .pa-foto').count() === 5, `${G} sanfona: a venda de duas peças diz que são duas, e todas têm a foto`)
      const mais = await todos(pg, 'div.pa-mes-dentro .pa-ver-mais')
      conta(mais.length === 1 && mais[0].texto === 'Ver mais 1 venda de outubro' && mais[0].h >= 44, `${G} sanfona: a linha de ver mais, com alvo de toque`)
      conta((await textos(pg, '.pa-bloco > .pa-ajuda'))[0] === 'Valores em reais. Toque num mês para abrir as vendas dele.', `${G} sanfona: a dica diz que os valores são em reais`)
      await pg.locator('div.pa-mes-dentro .pa-ver-mais').click(); await pausa(pg)
      const todas = await todos(pg, 'div.pa-mes-dentro .pa-venda')
      conta(todas.length === 6 && todas[5].texto === '01/10 às 18:40 Devolvida Camisa Saneago Goiás Vôlei 2026/2027 Verde R$ 249,90 não conta', `${G} sanfona: ver mais traz a devolvida, com o selo, e ela não conta (${todas[5]?.texto})`)
      await pg.locator('button.pa-mes-linha', { hasText: 'set/26' }).click(); await pausa(pg)
      conta(await pg.locator('.pa-mes-linha.aberto').count() === 1 && (await pg.locator('.pa-mes-linha.aberto').innerText()).includes('set/26') && (await todos(pg, 'div.pa-mes-dentro .pa-venda')).length === 1, `${G} sanfona: tocar em setembro fecha outubro e abre setembro`)
      const maisM = await todos(pg, '.pa-mes-mais .pa-ver-mais')
      conta(maisM.length === 1 && maisM[0].texto === 'Ver mais 6 meses anteriores' && maisM[0].h >= 44, `${G} meses antigos: a linha "Ver mais 6 meses anteriores" antes do total, com alvo de toque (${maisM[0]?.texto})`)
      await pg.locator('.pa-mes-mais .pa-ver-mais').click(); await pausa(pg)
      const antigas = await todos(pg, '.pa-meses-cel .pa-mes-linha')
      conta(antigas.length === 14 && antigas[7].texto === 'abr/26 3 749,70 74,97' && antigas[13].texto === 'Total de 12 meses 46 10.525,40 1.052,54' && linha(await todos(pg, '.pa-mes-mais .pa-ver-mais')) === 'Ver mais 3 meses anteriores | Ver menos', `${G} meses antigos: o toque traz 6 meses, o total diz de quantos meses é, e aparece o Ver menos (${antigas[13]?.texto})`)
      await foto(pg, `meses-antigos-${nome}-${tema}`)
      const cabe = await pg.evaluate(() => { const c = document.querySelector('.pa-meses-cel').getBoundingClientRect(); return [...document.querySelectorAll('.pa-meses-cel *')].every((e) => { const r = e.getBoundingClientRect(); return !r.width || (r.right <= c.right + 0.6 && r.left >= c.left - 0.6) }) })
      conta(cabe, `${G} sanfona: nada passa da borda da caixa`)
      await pg.locator('.pa-mes-mais .pa-ver-mais', { hasText: 'Ver menos' }).click(); await pausa(pg)
      conta((await todos(pg, '.pa-meses-cel .pa-mes-linha')).length === 8, `${G} meses antigos: Ver menos volta aos meses do período`)
      await pg.locator('button.pa-mes-linha', { hasText: 'out/26' }).click(); await pausa(pg)
    } else {
      const S = await meses(pg)
      conta(S && S.meses.length === 6 && S.meses[0].aberto && S.vendas.length === 5 && S.mais === 'Ver mais 1 venda de outubro' && S.cabe && S.foraDir.every((x, i) => igual(x, S.dentroDir[i])), `${G} sanfona: no tablet a tabela continua, inteira dentro da caixa e alinhada`)
      conta(S.maisMeses === 'Ver mais 6 meses anteriores', `${G} meses antigos: a linha também está na tabela do tablet`)
    }
    conta(await sobra(pg) <= 0, `${G} vendas: nada rola para o lado`)
    await foto(pg, `vendas-${nome}-${tema}`)

    /* doze meses na tela estreita: as barras afinam e nada estoura */
    await escolherPeriodo(pg, 'Últimos 12 meses')
    const g12 = await grafico(pg, 1)
    conta(g12.colunas.length === 12 && g12.colunas.every((c) => c.w >= 8) && await sobra(pg) <= 0, `${G} 12 meses: doze barras cabem, com ${Math.round(g12.colunas[0].w)} de largura, e nada rola para o lado`)
    await foto(pg, `vendas-12-meses-${nome}-${tema}`)
    await escolherPeriodo(pg, 'Últimos 6 meses')

    /* ------------------------------------------------ A ABA ACORDO E PÁGINA */
    await aba(pg, 'Acordo e página')
    const cs = await todos(pg, `${CARTOES} > .cartao`)
    conta(cs.length === 2 && (cel ? cs[1].y > cs[0].baixo : igual(cs[0].y, cs[1].y)), `${G} acordo: os dois cartões ${cel ? 'um embaixo do outro' : 'lado a lado'}`)
    conta(linha(await todos(pg, '.pa-pe .btn')) === 'Abrir a página | Salvar', `${G} acordo: Abrir a página e Salvar no pé`)
    const dentro = await todos(pg, `${CARTOES} .entrada, ${CARTOES} .btn, ${CARTOES} .sel .cb, .pa-pe .btn`)
    const m = (await medir(pg, ['.pa-miolo']))['.pa-miolo']
    conta(dentro.every((d) => d.dir <= m.dir + 0.6 && d.x >= m.x - 0.6) && await sobra(pg) <= 0, `${G} acordo: nada passa da borda e nada rola para o lado`)
    await foto(pg, `acordo-${nome}-${tema}`)

    /* --------------------------------------------------------------- A VOLTA */
    await pg.locator('.pa-volta').click(); await pausa(pg)
    conta(await pg.locator('.pagina-topo h1', { hasText: 'Parceiros' }).count() === 1 && await pg.locator('.pa-lista .pa-item').count() === 3 && await pg.locator('.pa-volta').count() === 0, `${G} a volta devolve a visão geral`)
    await pg.getByRole('button', { name: 'Novo parceiro' }).first().click(); await pausa(pg)
    conta((await medir(pg, ['.pa-cabeca h1']))['.pa-cabeca h1'].texto === 'Novo parceiro' && await pg.locator('.pa-volta').count() === 1 && await pg.locator('.pa-volta-fileira .sel').count() === 0 && await sobra(pg) <= 0, `${G} novo: vira a página, com a volta em cima e sem o período`)
    await foto(pg, `novo-${nome}-${tema}`)
    conta(quantos(gravados, 'leu-vendas') === 1, `${G}: uma leitura só do banco`)
    conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
    await ctx.close()
  }
}

/* ==========================================================================
   3. SEM ACORDO, QUE É COMO A LOJA ESTÁ HOJE, E A LEITURA DE APOIO QUE CAI
   ========================================================================== */
{
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', semAcordo: true })
  await ir(pg, '/parceiros', '.pa-lado')
  const itens = await textos(pg, '.pa-lado .pa-item')
  conta(itens[0] === 'Todos os parceiros Visão geral da loja sem acordo 8 peças' && itens[1] === 'Saneago Goiás Vôlei Sem acordo · Página ativa sem acordo 6 peças' && itens[3].endsWith('R$ 0,00 0 peças'), `sem acordo: a lista diz "sem acordo" no lugar da parte, e zero só para quem não vendeu (${itens[1]})`)
  const k = await numeros(pg)
  conta(k[2] === 'Parte dos parceiros sem acordo' && k[3] === 'Fica com a Fourtime R$ 14.353,40 sem descontar 66 peças sem acordo', `sem acordo: a visão geral não inventa parte, e diz que nada foi descontado (${k[3]})`)
  conta(linha(await todos(pg, '.pa-miolo table.tabela tbody tr:nth-child(1) td')) === 'Saneago Goiás Vôlei | Sem acordo | 43 | R$ 9.775,70 | sem acordo', `sem acordo: a tabela do período também`)
  await parceiroNaLista(pg, 'Saneago')
  const S = await meses(pg)
  conta((await numeros(pg)).slice(2).join(' | ') === 'Parte em outubro sem acordo | Parte em 6 meses sem acordo' && S.meses[0].texto.endsWith('| R$ 1.559,40 | sem acordo') && S.vendas[0].texto.endsWith('| R$ 249,90 | sem acordo') && S.total.endsWith('| sem acordo'), `sem acordo: os números, os meses e cada venda dizem "sem acordo"`)
  conta((await medir(pg, ['.pa-cabeca p']))['.pa-cabeca p'].texto.startsWith('Sem acordo · Página ativa') && await sobra(pg) <= 0 && erros.length === 0, `sem acordo: o cabeçalho diz Sem acordo, e a página fica de pé`)
  await foto(pg, 'sem-acordo-1440-light')
  await ctx.close()
}
{
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', lojaCai: true })
  await ir(pg, '/parceiros', '.pa-lado')
  await parceiroNaLista(pg, 'Saneago')
  await pg.locator('table.pa-vendas .pa-ver-mais').click(); await pausa(pg)
  const S = await meses(pg)
  conta(S.vendas.length === 6 && S.vendas[5].texto === '01/10 18:40 | Camisa Saneago Goiás Vôlei 2026/2027 Verde Devolvida | G | 1 |  | não conta' && erros.length === 0, `se a leitura do valor riscado cai, a devolvida aparece sem o valor e a página continua de pé (${S.vendas[5]?.texto})`)
  await ctx.close()
}

/* ==========================================================================
   3b. DESDE O INÍCIO, E O AVISO DA DATA DO ACORDO (06/10/2026)

   O Henrique pôs 17% no Saneago com a data de hoje, que é a que o campo traz,
   e a página do parceiro continuou em zero: todas as vendas eram de antes. E
   pediu o período "o tempo todo desde o início".
   ========================================================================== */
{
  const I = 'desde o início:'
  const { ctx, pg, erros } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light' })
  await ir(pg, '/parceiros', '.pa-lado')
  await escolherPeriodo(pg, 'Desde o início')
  /* na visão geral, da primeira venda de qualquer parceiro (agosto de 2025) até hoje: 15 meses */
  const geral = await grafico(pg, 0)
  const nomes = geral.meses.split(/\s+/).filter(Boolean)
  conta(nomes.join(' ') === 'out/25 jan/26 abr/26 jul/26 out/26' && (await pg.locator('.pa-grafico').first().locator('.pa-coluna').count()) === 15, `${I} na visão geral o gráfico vai de agosto de 2025 a outubro de 2026, 15 barras, com um nome a cada três e o ano junto (${nomes.join(' ')})`)
  await parceiroNaLista(pg, 'Saneago')
  const S = await meses(pg)
  const k = await numeros(pg)
  const g = await grafico(pg, 0)
  conta(k[3] === 'Parte desde o início R$ 1.127,51' && g.sub === 'peças desde agosto de 2025' && g.numero === '49', `${I} no parceiro: 49 peças desde agosto de 2025 e a parte do tempo todo (${k[3]}; ${g.numero} ${g.sub})`)
  conta(S.meses.length === 15 && S.meses[14].texto === 'Agosto de 2025 | 2 | R$ 499,80 | R$ 49,98' && S.total === 'Total | 49 | R$ 11.275,10 | R$ 1.127,51' && S.maisMeses === '', `${I} a tabela lista os 15 meses até o da primeira venda, soma tudo, e não sobra mês antigo para pedir (${S.total})`)
  await parceiroNaLista(pg, 'Viapol')
  const V2 = await meses(pg)
  conta(V2.meses.length === 6 && V2.meses[5].texto.startsWith('Maio de 2026'), `${I} trocar de parceiro troca o início: o Viapol começa em maio de 2026 (${V2.meses.length} meses)`)
  conta(await sobra(pg) <= 0 && erros.length === 0, `${I} nada rola para o lado e nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await foto(pg, 'desde-o-inicio-1440-light')
  await ctx.close()
}
{
  const D = 'data do acordo:'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', semAcordo: true })
  await ir(pg, '/parceiros', '.pa-lado')
  await parceiroNaLista(pg, 'Saneago'); await aba(pg, 'Acordo e página')
  const fora = pg.locator('[data-fora-do-acordo]')
  conta(await fora.count() === 0, `${D} sem valor digitado, a ficha não avisa nada`)
  await pg.locator('input[aria-label="Percentual por peça"]').fill('17'); await pausa(pg, 200)
  const aviso = (await fora.innerText()).replace(/\s+/g, ' ').trim()
  conta(aviso === '47 peças foram vendidas antes de 03/10/2026 e ficam sem parte: na página do parceiro elas aparecem como "sem acordo". A primeira é de 15/08/2025.', `${D} com o valor e a data de hoje, a ficha diz quantas peças ficam sem parte (as 2 de hoje não entram na conta) e de quando é a primeira (${aviso})`)
  await foto(pg, 'data-do-acordo-1440-light')
  await pg.getByRole('button', { name: 'Valer desde a primeira venda' }).click(); await pausa(pg, 300)
  conta(await fora.count() === 0 && /A data está no passado/.test(await pg.locator(`${CARTOES}`).first().innerText()), `${D} o botão leva a data para a primeira venda, e o aviso sai`)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const confirmar = pg.getByRole('button', { name: 'Confirmar e refazer' })
  if (await confirmar.count()) { await confirmar.click(); await pausa(pg, 700) }
  const ac = gravados.filter((x) => x[0] === 'acordo').map((x) => x[1])
  conta(ac.length >= 1 && ac[ac.length - 1].p_vale_desde === '2025-08-15' && Number(ac[ac.length - 1].p_valor) === 17, `${D} salvar manda o acordo valendo desde a primeira venda (${JSON.stringify(ac[ac.length - 1] ?? null).slice(0, 140)})`)
  conta(erros.length === 0, `${D} nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
}

/* O PARCEIRO QUE JÁ TEM IMPOSTO E DIA DE INÍCIO (057): a ficha mostra os dois,
   e apagar os dois manda zero e vazio ao banco */
{
  const X = 'imposto e início já salvos:'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', comExibicao: true })
  await ir(pg, '/parceiros', '.pa-lado')
  await parceiroNaLista(pg, 'Saneago'); await aba(pg, 'Acordo e página')
  const imposto = pg.locator('input[aria-label="Imposto, só no texto"]')
  const inicio = pg.locator(`${CARTOES} > .cartao:nth-child(2) .data-campo`)
  conta(await imposto.inputValue() === '3' && await inicio.inputValue() === '01/07/2026', `${X} a ficha abre com 3 e 01/07/2026 (${await imposto.inputValue()}, ${await inicio.inputValue()})`)
  conta((await pg.locator('[data-frase-da-pagina]').innerText()).replace(/\s+/g, ' ').startsWith('Na página do parceiro: "Seu acordo: 13% menos 3% de imposto / 10% do valor de cada peça".'), `${X} a frase já vem com o imposto`)
  conta((await textos(pg, '.pa-notas .pa-ajuda'))[1] === 'O parceiro vê na página dele as vendas de 01/07/2026 em diante. A aba Vendas, aqui, mostra todas.', `${X} a nota do pé diz que o parceiro vê menos que a aba Vendas`)
  await foto(pg, 'inicio-do-relatorio-1440-light')
  /* a aba Vendas, aqui no sistema, continua com tudo: os mesmos números de quem não tem data */
  await aba(pg, 'Vendas')
  conta((await numeros(pg))[2] === 'Parte em outubro R$ 155,94', `${X} a aba Vendas do sistema não corta nada pela data (${(await numeros(pg))[2]})`)
  await aba(pg, 'Acordo e página')
  gravados.length = 0
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  conta(quantos(gravados, 'exibicao') === 0, `${X} salvar sem mexer não escreve imposto nem data de novo`)
  await imposto.fill(''); await inicio.fill(''); await pausa(pg, 300)
  conta((await pg.locator('[data-inicio-do-relatorio]').innerText()).trim() === 'Em branco, a página do parceiro mostra desde a primeira venda.', `${X} apagar a data volta a dizer "desde a primeira venda"`)
  gravados.length = 0
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const ex = ultimo(gravados, 'exibicao')
  conta(quantos(gravados, 'exibicao') === 1 && ex.p_imposto === 0 && ex.p_mostrar_desde === null, `${X} apagar os dois manda imposto 0 e data vazia (${JSON.stringify(ex)})`)
  conta(erros.length === 0, `${X} nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
}

/* ==========================================================================
   4. O ACESSO: QUEM SÓ LÊ E QUEM NÃO TEM A PÁGINA
   ========================================================================== */
{
  const { ctx, pg, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', acesso: 'le' })
  await ir(pg, '/parceiros', '.pa-lado')
  conta(await pg.getByRole('button', { name: 'Novo parceiro' }).count() === 0 && (await todos(pg, '.pa-lado .pa-item')).length === 4 && (await numeros(pg)).length === 4, `quem só lê: vê a lista e os números, sem Novo parceiro`)
  await parceiroNaLista(pg, 'Saneago'); await aba(pg, 'Acordo e página')
  conta(await pg.getByRole('button', { name: 'Salvar' }).count() === 0 && await pg.getByRole('button', { name: 'Gerar outra' }).count() === 0 && await pg.getByRole('button', { name: 'Trocar' }).count() === 0, `quem só lê: não salva, não gera senha nem troca o link`)
  conta(await pg.getByRole('button', { name: 'Abrir a página' }).count() === 1 && await pg.getByRole('button', { name: 'Copiar' }).count() === 1, `quem só lê: abre a página do parceiro e copia o link`)
  conta(await pg.locator(`${CARTOES} input`).first().isDisabled() && quantos(gravados, 'funcao') === 0, `quem só lê: os campos ficam apagados e a loja não é consultada`)
  await ctx.close()
}
{
  const { ctx, pg } = await abrir(nav, { largura: 1440, altura: 900, tema: 'light', acesso: 'fora' })
  await pg.goto(SITE + '/parceiros', { waitUntil: 'networkidle' }); await pausa(pg, 1200)
  conta(await pg.locator('.pa-miolo').count() === 0 && await pg.locator('.pa-lado').count() === 0, `quem não tem a página: /parceiros não abre`)
  conta(!(await pg.locator('nav, aside').first().innerText()).includes('Parceiros'), `quem não tem a página: Parceiros não aparece no menu`)
  await ctx.close()
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length} conferencias em ${SITE}: ${achados.length - ruins.length} certas, ${ruins.length} ruins`)
if (ruins.length) { console.log('\nO QUE NAO BATEU'); ruins.forEach((a) => console.log('  ' + a.texto)); process.exit(1) }
