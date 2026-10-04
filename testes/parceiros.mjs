/* ==========================================================================
   A PÁGINA PARCEIROS CONTRA A PRANCHA 5 DO WIREFRAME DE 03/10/2026.

   O Henrique aprovou o wireframe "Página do Parceiro" com a ordem de sempre:
   implementar como está desenhado. A prancha 5 foi desenhada à mão com a cara
   do V7, e não com os componentes reais; por isso este teste copia dela o que
   ela decide (o que aparece, em que ordem, com que texto, e as medidas de
   página: 40 de altura, 10 entre botões, 56 de linha, ficha de até 460) e
   deixa o desenho de cada controle com o Design System.

   O QUE ELE CONFERE
     1. a lista e a ficha em 1920 por 1080, com o menu aberto, nos dois temas
     2. que a página faz o que promete: salvar manda o cadastro e o acordo,
        acordo no passado pergunta antes, gerar outra senha e trocar o link
        perguntam antes, e o parceiro novo nasce pelo mesmo caminho
     3. que nada rola para o lado em 1920, 820 e 390, e que na tela estreita a
        ficha vira folha e a tabela vira lista
     4. que quem só lê não vê botão de gravar, e quem não tem a página não
        entra nela
     5. que não houve erro de JavaScript

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

async function abrir(nav, { largura, altura, tema, acesso = 'tudo' }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: P.FUSO, locale: 'pt-BR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  const gravados = []
  let jaPerguntou = false
  await ctx.clock.setFixedTime(new Date(P.HOJE))
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
    if (u.includes('rpc/trocar_senha_do_parceiro')) { gravados.push(['senha', corpo()]); return json(r, 'NOVASENH') }
    if (u.includes('rpc/trocar_link_do_parceiro')) { gravados.push(['link', corpo()]); return json(r, 'chavenova00000000000000000000000') }
    if (m !== 'GET') return json(r, u.includes('rpc/') ? {} : [])
    let lista = []
    if (u.includes('meu_perfil')) lista = perfil(acesso)
    else if (u.includes('parceiro_na_lista')) lista = P.parceiros
    else if (u.includes('venda_do_parceiro')) { gravados.push(['leu-vendas', u]); lista = u.includes('gte.2026-10-01') ? P.outubro : [] }
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

/* ==========================================================================
   1. A LISTA, A FICHA E OS FLUXOS, EM 1920 POR 1080, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const G = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1920, altura: 1080, tema })
  await ir(pg, '/parceiros', '.pa-tabela')

  /* ------------------------------------------------------------ O TOPO */
  const M = await medir(pg, ['.pagina-topo h1', '.pagina-topo .acima', '.pagina-topo .sub', '.pagina-topo .btn-primario', '.pa-aviso', '.pa-barra .sel .cb', '.pa-quadro', '.pa-ficha', '.pa-ficha-topo', '.pa-ficha-corpo', '.pa-ficha-pe'])
  conta(M['.pagina-topo h1'].texto === 'Parceiros' && M['.pagina-topo .acima'].texto === 'Gestão' && M['.pagina-topo .sub'].texto === 'Quem vende peças na loja e quanto recebe por venda.', `${G} topo: Gestão, Parceiros e a frase do wireframe`)
  conta(M['.pagina-topo .btn-primario'].texto === 'Novo parceiro' && igual(M['.pagina-topo .btn-primario'].h, 40), `${G} topo: o botão Novo parceiro é o vermelho, com 40 de altura (${M['.pagina-topo .btn-primario'].h})`)
  conta(M['.pa-aviso'].texto === 'Último aviso da loja: hoje às 14:32', `${G} barra: diz quando a loja avisou pela última vez (${M['.pa-aviso'].texto})`)
  conta(M['.pa-barra .sel .cb'].texto.includes('Outubro de 2026') && igual(M['.pa-barra .sel .cb'].h, 40), `${G} barra: o mês começa no de hoje, com 40 de altura`)

  /* ----------------------------------------------------------- A LISTA */
  const cab = await todos(pg, '.pa-tabela thead th')
  conta(linha(cab) === 'Parceiro | Acordo | Peças no mês | Vendido no mês | Parte do parceiro', `${G} lista: as cinco colunas do wireframe, na ordem (${linha(cab)})`)
  const linhas = await todos(pg, '.pa-tabela tbody tr')
  conta(linhas.length === 3 && linhas.every((l) => igual(l.h, 56)), `${G} lista: três parceiros, linha de 56 (${linhas.map((l) => l.h).join(', ')})`)
  const celulas = async (i) => linha(await todos(pg, `.pa-tabela tbody tr:nth-child(${i}) td`))
  conta(await celulas(1) === 'Saneago Goiás Vôlei Página ativa | 10% por peça | 6 | R$ 1.559,40 | R$ 155,94', `${G} lista: Goiás em primeiro, com 6 peças, R$ 1.559,40 e R$ 155,94 de parte, como no wireframe (${await celulas(1)})`)
  conta(await celulas(2) === 'Viapol Vôlei São José Página ativa | R$ 25,00 por peça | 2 | R$ 499,80 | R$ 50,00', `${G} lista: Viapol em segundo, com valor por peça (${await celulas(2)})`)
  conta(await celulas(3) === 'Colégio Professora Yolanda Página ligada, ainda não aberta | 15% por peça | 0 | R$ 0,00 | R$ 0,00', `${G} lista: quem não vendeu no mês vem por último, zerado, e a página nunca aberta diz isso (${await celulas(3)})`)
  conta(await pg.locator('.pa-tabela tbody tr.marcada').count() === 1 && (await pg.locator('.pa-tabela tbody tr.marcada').innerText()).includes('Saneago'), `${G} lista: na tela larga o primeiro, que é quem mais vendeu, já vem escolhido`)
  conta(igual(M['.pa-quadro'].baixo < M['.pa-ficha'].baixo ? M['.pa-quadro'].y : M['.pa-ficha'].y, M['.pa-ficha'].y) && igual(M['.pa-ficha'].x - M['.pa-quadro'].dir, 24), `${G} lista e ficha lado a lado, alinhadas em cima, com 24 entre as duas (${M['.pa-ficha'].x - M['.pa-quadro'].dir})`)

  /* ----------------------------------------------------------- A FICHA */
  await pg.locator('.pa-tabela tbody tr', { hasText: 'Saneago' }).click(); await pausa(pg)
  const F = await medir(pg, ['.pa-ficha', '.pa-ficha .cartao-titulo', '.pa-ficha-corpo', '.pa-ficha-pe'])
  conta(F['.pa-ficha'].w <= 460.5 && F['.pa-ficha'].raio === '14px' && F['.pa-ficha'].borda === '1px', `${G} ficha: caixa de até 460, raio 14, borda de 1 (${F['.pa-ficha'].w})`)
  conta(F['.pa-ficha .cartao-titulo'].texto === 'Saneago Goiás Vôlei' && F['.pa-ficha .cartao-titulo'].letra === '15px/600', `${G} ficha: o título é o nome do parceiro, 15/600 (${F['.pa-ficha .cartao-titulo'].letra})`)
  conta(F['.pa-ficha-corpo'].recheio === '20px 24px 24px 24px', `${G} ficha: recheio de 24 dos lados (${F['.pa-ficha-corpo'].recheio})`)
  const rotulos = (await todos(pg, '.pa-ficha-corpo .campo > span:first-child')).map((r) => r.texto)
  conta(rotulos.join(' | ') === 'Nome do parceiro | Coleção da loja | Acordo | Percentual por peça | Vale a partir de | O percentual é sobre | Link da página do parceiro | Senha da página', `${G} ficha: os campos do wireframe, na ordem, mais o "sobre o quê" (${rotulos.join(' | ')})`)
  const campos = await todos(pg, '.pa-ficha-corpo input')
  conta(campos[0].valor === 'Saneago Goiás Vôlei' && campos[1].valor === '10' && campos[2].valor === '01/10/2026', `${G} ficha: nome, 10% e a data 01/10/2026 (${campos.slice(0, 3).map((c) => c.valor).join(', ')})`)
  conta((await pg.locator('.pa-ficha-corpo .sel .cb').first().innerText()).replace(/\s+/g, ' ').includes('Saneago Goiás Vôlei Completo (8 produtos)'), `${G} ficha: a coleção mostra o nome e quantos produtos tem`)
  conta(campos[3].valor === `fourtimefit.com.br/pages/parceiro#k=${P.parceiros[1].chave}`, `${G} ficha: o link leva a chave depois do #, sem o https (${campos[3].valor})`)
  conta(await pg.locator('.pa-ficha-corpo input[aria-label="Senha da página"]').getAttribute('type') === 'password', `${G} ficha: a senha nasce escondida`)
  await pg.getByRole('button', { name: 'Mostrar' }).click(); await pausa(pg, 200)
  conta(await pg.locator('.pa-ficha-corpo input[aria-label="Senha da página"]').getAttribute('type') === 'text' && await pg.getByRole('button', { name: 'Esconder' }).count() === 1, `${G} ficha: Mostrar revela a senha e vira Esconder`)
  const altos = await todos(pg, '.pa-ficha-corpo .entrada, .pa-ficha-corpo .btn, .pa-ficha-corpo .sel .cb, .pa-ficha-corpo .seg, .pa-ficha-corpo .data')
  conta(altos.length >= 12 && altos.every((a) => igual(a.h, 40)), `${G} ficha: todo controle tem 40 de altura (${[...new Set(altos.map((a) => a.h))].join(', ')})`)
  const fileiraDoLink = await todos(pg, '.pa-ficha-corpo .campo:has(input[aria-label="Link da página do parceiro"]) .pa-com-botoes > *')
  conta(igual(fileiraDoLink[1].x - fileiraDoLink[0].dir, 10) && igual(fileiraDoLink[2].x - fileiraDoLink[1].dir, 10), `${G} ficha: 10 entre o campo do link e os botões dele`)
  conta((await pg.locator('.pa-ajuda').first().innerText()).endsWith('Mudar o acordo não mexe nas vendas já registradas.'), `${G} ficha: o acordo que já vale não ameaça recalcular nada`)
  conta(await pg.locator('.pa-chave .tgl.ligado').count() === 1 && (await pg.locator('.pa-chave').innerText()).includes('Página ativa'), `${G} ficha: a chave Página ativa vem ligada`)
  const pe = await todos(pg, '.pa-ficha-pe .btn')
  conta(linha(pe) === 'Abrir a página | Salvar' && igual(pe[1].x - pe[0].dir, 10) && pe[1].dir > pe[0].dir, `${G} ficha: Abrir a página e Salvar no pé, o vermelho por último, com 10 entre os dois`)
  conta(await sobra(pg) <= 0, `${G} 1920: nada rola para o lado`)
  await foto(pg, `larga-${tema}`)

  /* ------------------------------------------------- VALOR POR PEÇA */
  await pg.locator('.pa-tabela tbody tr', { hasText: 'Viapol' }).click(); await pausa(pg)
  const v = await todos(pg, '.pa-ficha-corpo input')
  conta((await pg.locator('.pa-ficha .cartao-titulo').innerText()) === 'Viapol Vôlei São José' && v[1].valor === '25,00' && await pg.locator('.pa-ficha-corpo .seg button.ligado', { hasText: 'Valor por peça' }).count() === 1, `${G} valor por peça: a ficha troca de parceiro e mostra R$ 25,00 (${v[1].valor})`)
  conta(!(await todos(pg, '.pa-ficha-corpo .campo > span:first-child')).some((r) => r.texto === 'O percentual é sobre'), `${G} valor por peça: some a pergunta "o percentual é sobre"`)

  /* ----------------------------------------------------------- SALVAR */
  await pg.locator('.pa-tabela tbody tr', { hasText: 'Saneago' }).click(); await pausa(pg)
  gravados.length = 0
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  conta(quantos(gravados, 'parceiro') === 1 && quantos(gravados, 'acordo') === 0, `${G} salvar sem mexer no acordo: grava o cadastro e não escreve acordo novo`)
  const c1 = ultimo(gravados, 'parceiro')
  conta(c1.p_id === 'p1' && c1.p_nome === 'Saneago Goiás Vôlei' && c1.p_colecao === 'saneago-goias-volei-completo' && c1.p_colecao_nome === 'Saneago Goiás Vôlei Completo' && c1.p_ativo === true, `${G} salvar: o cadastro vai com nome, coleção e a página ativa`)
  conta(JSON.stringify(ultimo(gravados, 'funcao')) === JSON.stringify({ acao: 'produtos', parceiro: 'p1' }), `${G} salvar: manda o porteiro reler os produtos da coleção`)

  gravados.length = 0
  await pg.locator('.pa-unidade input').fill('12,5'); await pg.locator('.pa-ficha-corpo .seg button', { hasText: 'Preço cheio' }).click()
  await pg.locator('.pa-ficha-corpo .data-campo').fill('03/10/2026'); await pausa(pg, 200)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const a1 = ultimo(gravados, 'acordo')
  conta(a1 && a1.p_parceiro === 'p1' && a1.p_tipo === 'percentual' && a1.p_valor === 12.5 && a1.p_base === 'preco_cheio' && a1.p_vale_desde === '2026-10-03' && a1.p_refazer === false, `${G} acordo novo: 12,5% sobre o preço cheio a partir de hoje (${JSON.stringify(a1)})`)
  conta(await pg.locator('dialog[open]').count() === 0, `${G} acordo de hoje em diante: salva sem perguntar nada`)

  /* --------------------------------------- ACORDO COM DATA NO PASSADO */
  gravados.length = 0
  await pg.locator('.pa-unidade input').fill('20'); await pg.locator('.pa-ficha-corpo .data-campo').fill('15/09/2026'); await pausa(pg, 200)
  conta((await pg.locator('.pa-ajuda').first().innerText()).includes('A data está no passado'), `${G} data no passado: a ficha avisa antes de salvar`)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  conta(await pg.locator('dialog[open] .t', { hasText: 'Refazer a conta das vendas?' }).count() === 1 && (await pg.locator('dialog[open] .pa-pergunta').innerText()).includes('6 venda(s)'), `${G} data no passado: a pergunta do banco aparece numa caixa própria, com o número de vendas`)
  await foto(pg, `pergunta-${tema}`, false)
  await pg.getByRole('button', { name: 'Confirmar e refazer' }).click(); await pausa(pg, 700)
  const acordos = gravados.filter((g) => g[0] === 'acordo').map((g) => g[1])
  conta(acordos.length === 2 && acordos[0].p_refazer === false && acordos[1].p_refazer === true && acordos[1].p_vale_desde === '2026-09-15' && acordos[1].p_valor === 20, `${G} data no passado: só grava depois de confirmar, e a confirmação vai ao banco`)
  conta(await pg.locator('dialog[open]').count() === 0, `${G} data no passado: confirmado, a caixa fecha`)

  /* ------------------------------------------- VALOR RUIM NÃO SALVA */
  await pg.locator('.pa-unidade input').fill('150'); await pausa(pg, 200)
  conta(await pg.getByRole('button', { name: 'Salvar' }).isDisabled() && (await pg.locator('.pa-ficha-corpo .campo.erro .dica').innerText()) === 'Um número de 0 a 100.', `${G} percentual acima de 100: o campo diz o que aceita e o Salvar apaga`)
  await pg.locator('.pa-unidade input').fill('10'); await pausa(pg, 200)

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

  /* --------------------------------------------------- PARCEIRO NOVO */
  gravados.length = 0
  await pg.getByRole('button', { name: 'Novo parceiro' }).click(); await pausa(pg)
  conta((await pg.locator('.pa-ficha .cartao-titulo').innerText()) === 'Novo parceiro' && await pg.getByRole('button', { name: 'Salvar' }).isDisabled(), `${G} novo: a ficha abre vazia e o Salvar espera o nome`)
  conta((await pg.locator('.pa-ficha-corpo').innerText()).includes('O link e a senha da página nascem quando você salvar.') && await pg.getByRole('button', { name: 'Abrir a página' }).count() === 0 && await pg.locator('.pa-chave .tgl.ligado').count() === 0, `${G} novo: sem link, sem senha e com a página desligada até salvar`)
  await foto(pg, `novo-${tema}`)
  await pg.locator('.pa-ficha-corpo input').first().fill('Vôlei Guarulhos')
  await pg.locator('.pa-ficha-corpo .sel .cb').first().click(); await pausa(pg, 300)
  conta((await todos(pg, '.mn.flutua .mn-item')).length === 5, `${G} novo: a lista traz as coleções da loja e a opção de não escolher`)
  await pg.locator('.mn.flutua .mn-item', { hasText: 'Fourtime Run' }).first().click(); await pausa(pg, 300)
  await pg.locator('.pa-unidade input').fill('8'); await pausa(pg, 200)
  await pg.getByRole('button', { name: 'Salvar' }).click(); await pausa(pg, 700)
  const novo = ultimo(gravados, 'parceiro'); const acordoDoNovo = ultimo(gravados, 'acordo')
  conta(novo.p_id === null && novo.p_nome === 'Vôlei Guarulhos' && novo.p_colecao === 'fourtime-run' && novo.p_colecao_nome === 'Fourtime Run' && novo.p_ativo === false, `${G} novo: nasce sem id, com a coleção escolhida e a página desligada (${JSON.stringify(novo)})`)
  conta(acordoDoNovo.p_parceiro === 'p-novo' && acordoDoNovo.p_valor === 8 && acordoDoNovo.p_vale_desde === '2026-10-03', `${G} novo: o acordo vai para o id que o banco devolveu, valendo de hoje`)

  /* --------------------------------------------------------- O MÊS */
  await pg.locator('.pa-barra .sel .cb').click(); await pausa(pg, 300)
  conta((await todos(pg, '.mn.flutua .mn-item')).length >= 12, `${G} mês: a lista oferece doze meses`)
  await pg.locator('.mn.flutua .mn-item', { hasText: 'Setembro de 2026' }).first().click(); await pausa(pg, 700)
  const setembro = [...gravados].reverse().find((g) => g[0] === 'leu-vendas')[1]
  conta(setembro.includes('gte.2026-09-01T03:00:00') && setembro.includes('lt.2026-10-01T03:00:00'), `${G} mês: setembro é pedido ao banco com os limites na hora de Goiânia`)
  conta((await celulas(2)).endsWith('| 0 | R$ 0,00 | R$ 0,00'), `${G} mês: sem venda no mês, os números zeram`)

  conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
}

/* ==========================================================================
   2. A TELA ESTREITA: 820 E 390, NOS DOIS TEMAS
   ========================================================================== */
for (const [nome, largura, altura] of [['820', 820, 1180], ['390', 390, 844]]) {
  for (const tema of ['light', 'dark']) {
    const G = `${nome} ${tema === 'light' ? 'gelo' : 'grafite'}`
    const estreito = largura < 768
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema })
    await ir(pg, '/parceiros', estreito ? '.pa-lista' : '.pa-tabela')
    conta(await sobra(pg) <= 0, `${G}: nada rola para o lado`)
    conta(await pg.locator('.pa-ficha').count() === 0, `${G}: a ficha não fica ao lado`)
    if (estreito) {
      const itens = await todos(pg, '.pa-item')
      conta(itens.length === 3 && itens.every((i) => i.h >= 44), `${G}: a tabela vira lista de três, com alvo de toque (${itens.map((i) => i.h).join(', ')})`)
      conta(itens[0].texto.includes('Saneago Goiás Vôlei') && itens[0].texto.includes('R$ 155,94') && itens[0].texto.includes('6 peças'), `${G}: a linha traz o nome, a parte e as peças (${itens[0].texto})`)
    } else {
      conta((await todos(pg, '.pa-tabela tbody tr')).length === 3 && await pg.locator('.pa-tabela td.pa-seta').count() === 3, `${G}: a tabela continua, com a seta de abrir`)
    }
    await foto(pg, `lista-${nome}-${tema}`)
    await pg.locator(estreito ? '.pa-item' : '.pa-tabela tbody tr', { hasText: 'Saneago' }).click(); await pausa(pg, 600)
    const folha = await medir(pg, ['dialog.gaveta[open] .caixa', 'dialog.gaveta[open] .t', 'dialog.gaveta[open] .sobre-pe'])
    conta(!!folha['dialog.gaveta[open] .caixa'] && folha['dialog.gaveta[open] .t'].texto === 'Saneago Goiás Vôlei', `${G}: tocar no parceiro abre a ficha numa folha, com o nome no topo`)
    conta(linha(await todos(pg, 'dialog.gaveta[open] .sobre-pe .btn')) === 'Abrir a página | Salvar', `${G}: Abrir a página e Salvar ficam no pé da folha`)
    const dentro = await todos(pg, 'dialog.gaveta[open] .entrada, dialog.gaveta[open] .btn:not(.icone), dialog.gaveta[open] .sel .cb')
    const caixa = folha['dialog.gaveta[open] .caixa']
    conta(dentro.every((d) => d.dir <= caixa.dir + 0.6 && d.x >= caixa.x - 0.6), `${G}: nada passa da borda da folha`)
    conta(await sobra(pg) <= 0, `${G}: com a folha aberta, nada rola para o lado`)
    await foto(pg, `folha-${nome}-${tema}`, false)
    conta(erros.length === 0, `${G}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
    await ctx.close()
  }
}

/* ==========================================================================
   3. O ACESSO: QUEM SÓ LÊ E QUEM NÃO TEM A PÁGINA
   ========================================================================== */
{
  const { ctx, pg, gravados } = await abrir(nav, { largura: 1920, altura: 1080, tema: 'light', acesso: 'le' })
  await ir(pg, '/parceiros', '.pa-tabela')
  conta(await pg.getByRole('button', { name: 'Novo parceiro' }).count() === 0 && await pg.getByRole('button', { name: 'Salvar' }).count() === 0, `quem só lê: sem Novo parceiro e sem Salvar`)
  conta(await pg.getByRole('button', { name: 'Gerar outra' }).count() === 0 && await pg.getByRole('button', { name: 'Trocar' }).count() === 0, `quem só lê: não gera senha nem troca o link`)
  conta((await todos(pg, '.pa-tabela tbody tr')).length === 3 && await pg.getByRole('button', { name: 'Abrir a página' }).count() === 1, `quem só lê: vê a lista e abre a página do parceiro`)
  conta(await pg.locator('.pa-ficha-corpo input').first().isDisabled() && quantos(gravados, 'funcao') === 0, `quem só lê: os campos ficam apagados e a loja não é consultada`)
  await ctx.close()
}
{
  const { ctx, pg } = await abrir(nav, { largura: 1920, altura: 1080, tema: 'light', acesso: 'fora' })
  await pg.goto(SITE + '/parceiros', { waitUntil: 'networkidle' }); await pausa(pg, 1200)
  conta(await pg.locator('.pa-barra').count() === 0, `quem não tem a página: /parceiros não abre`)
  conta(!(await pg.locator('nav, aside').first().innerText()).includes('Parceiros'), `quem não tem a página: Parceiros não aparece no menu`)
  await ctx.close()
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length} conferencias em ${SITE}: ${achados.length - ruins.length} certas, ${ruins.length} ruins`)
if (ruins.length) { console.log('\nO QUE NAO BATEU'); ruins.forEach((a) => console.log('  ' + a.texto)); process.exit(1) }
