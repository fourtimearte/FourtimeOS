/* ==========================================================================
   O TESTE DOS BOTOES DE GESTAO QUE ERAM SO RECADO (12/10/2026).

   Antes, quatro botoes so mostravam um aviso de "entra depois":
     Painel de atividades  "Conferir agora" e "Impressão"
     Relatório             "Imprimir A4" e "Gerar / atualizar"

   O QUE ELE MEDE:
     1. Painel: "Atualizar" pede os pedidos ao banco de novo
     2. Painel: "Imprimir" chama a impressao com a pagina em tema claro e a
        classe imprimindo-pagina, e devolve tudo como estava depois
     3. Relatorio: "Baixar planilha" baixa um CSV com o nome do periodo, o
        cabecalho e uma linha por pedido do mes
     4. Relatorio: "Imprimir" tambem imprime
     5. Relatorio sem pedido no periodo: os dois botoes ficam desligados
     6. Painel (075): o nome do pedido no lugar do cliente, as marcas ao lado,
        a etapa travada no pedido com fatia, e o modal que da nome
     7. Painel sem a 075 no banco: a leitura repete sem as colunas novas

   Uso:  node testes/gestao.mjs http://127.0.0.1:4173
   ========================================================================== */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'

const PAGINAS = ['inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban','produtos','estoque','atividades','relatorio','banco','config','kit']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = {ver:true,editar:true,deletar:true,total:true})
const PERFIL = [{ id:'1', nome:'Henrique', papel:'admin', situacao:'aprovado', paineis:PAGINAS, permissoes, email:'t@f', foto_em:null }]

const hoje = new Date()
const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7))
const planejado = segunda.toISOString().slice(0,10)
/* fechado neste mes: o relatorio abre no mes de hoje */
const fechado = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12).toISOString().slice(0,10)
const ano = hoje.getFullYear()
const mes = String(hoje.getMonth() + 1).padStart(2, '0')

const base = {
  departamento:'Uniformes', etapa:'corte', etapa_em:new Date().toISOString(), entrega_em:planejado,
  planejado_em:planejado, planejamento_manual:true, aviso:'', layouts:1, tecnicas:['subli'], total:0,
  fechado_em:fechado, teste:true, cotacao_id:'c1', tag:'', fatias_abertas:'',
}
const PEDIDOS = [
  { ...base, id:'p1', numero:'PD-TESTE-0101', cliente:'Drogaria "Viver" Bem', vendedor:'Dani', pecas:100,
    pecas_subli:100, pecas_personalizadas:0, valor_subli:2500.5, valor_personalizado:0 },
  { ...base, id:'p2', numero:'PD-TESTE-0102', cliente:'Igreja Araguaia', vendedor:'Lucas', pecas:40,
    pecas_subli:0, pecas_personalizadas:40, valor_subli:0, valor_personalizado:800 },
]

const nav = await chromium.launch()
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir(rota, pedidos, { sem075 = false, gravados = [] } = {}) {
  const ctx = await nav.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce', acceptDownloads:true })
  const pedidosLidos = { n: 0 }
  await ctx.route('**supabase.co/**', async (r) => {
    const u = r.request().url()
    let corpo = []
    if (u.includes('meu_perfil')) corpo = PERFIL
    else if (u.includes('pedido_na_fabrica') && sem075 && u.includes('tem_fatias')) {
      return r.fulfill({ status:400, contentType:'application/json', headers:{'access-control-allow-origin':'*'},
        body: JSON.stringify({ code:'42703', message:'column pedido_na_fabrica.nome does not exist' }) })
    }
    else if (u.includes('pedido_na_fabrica')) { pedidosLidos.n++; corpo = pedidos }
    else if (u.includes('/rpc/')) {
      const corpoPedido = r.request().postDataJSON()
      gravados.push({ rpc: u.split('/rpc/')[1].split('?')[0], corpo: corpoPedido })
      corpo = u.includes('dar_nome_ao_pedido') ? corpoPedido.p_nome.trim().replace(/\s+/g, ' ') : null
    }
    return r.fulfill({ status:200, contentType:'application/json',
      headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript((c) => {
    try { localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', 'dark') } catch {}
    /* a impressao de verdade abriria a janela do sistema: aqui ela so anota
       como a pagina estava no instante de imprimir, e avisa o fim */
    window.__impressoes = []
    window.print = () => {
      window.__impressoes.push({
        tema: document.documentElement.dataset.theme,
        classe: document.body.classList.contains('imprimindo-pagina'),
      })
      window.dispatchEvent(new Event('afterprint'))
    }
  }, { acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' })
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => conta(false, 'erro de pagina em ' + rota + ': ' + e.message))
  await pg.goto(SITE + rota, { waitUntil:'networkidle' })
  await pg.waitForTimeout(1200)
  return { ctx, pg, pedidosLidos }
}

const botao = (pg, nome) => pg.getByRole('button', { name: nome, exact: true })
const depois = (pg) => pg.evaluate(() => ({
  tema: document.documentElement.dataset.theme,
  classe: document.body.classList.contains('imprimindo-pagina'),
  impressoes: window.__impressoes,
}))

/* ---- painel de atividades ---- */
{
  const { ctx, pg, pedidosLidos } = await abrir('/atividades', PEDIDOS)
  conta(await botao(pg, 'Conferir agora').count() === 0 && await botao(pg, 'Impressão').count() === 0,
    'painel: os dois botoes de recado sumiram')
  const antes = pedidosLidos.n
  await botao(pg, 'Atualizar').click()
  await pg.waitForTimeout(800)
  conta(pedidosLidos.n > antes, `painel: Atualizar pediu os pedidos de novo (${antes} para ${pedidosLidos.n})`)
  conta(await pg.getByText('Pedidos lidos de novo.').count() > 0, 'painel: Atualizar avisa que leu')

  await botao(pg, 'Imprimir').click()
  await pg.waitForTimeout(300)
  const d = await depois(pg)
  conta(d.impressoes.length === 1 && d.impressoes[0].tema === 'light' && d.impressoes[0].classe,
    'painel: imprimiu em tema claro e com a classe de impressao (' + JSON.stringify(d.impressoes) + ')')
  conta(d.tema === 'dark' && !d.classe, 'painel: depois de imprimir volta ao Grafite e tira a classe')
  await ctx.close()
}

/* ---- relatorio ---- */
{
  const { ctx, pg } = await abrir('/relatorio', PEDIDOS)
  conta(await botao(pg, 'Gerar / atualizar').count() === 0 && await botao(pg, 'Imprimir A4').count() === 0,
    'relatorio: os dois botoes de recado sumiram')
  const [baixa] = await Promise.all([pg.waitForEvent('download'), botao(pg, 'Baixar planilha').click()])
  const nome = baixa.suggestedFilename()
  conta(nome === `relatorio-${ano}-${mes}.csv`, 'relatorio: o arquivo tem o nome do periodo (' + nome + ')')
  const texto = readFileSync(await baixa.path(), 'utf8')
  const linhas = texto.replace(/^﻿/, '').split('\r\n')
  conta(texto.startsWith('﻿'), 'relatorio: o CSV comeca com BOM (o Excel le o acento)')
  conta(linhas[0].startsWith('"Mês";"Dia";"Pedido";"Cliente"') && linhas[0].endsWith('"Total R$"'), 'relatorio: o cabecalho certo')
  conta(linhas.length === 3, 'relatorio: uma linha por pedido do mes (' + (linhas.length - 1) + ')')
  conta(texto.includes('"Drogaria ""Viver"" Bem"'), 'relatorio: aspas no nome viram aspas duplas')
  conta(texto.includes('"2500,50"') && texto.includes('"800,00"'), 'relatorio: dinheiro com virgula')

  await botao(pg, 'Imprimir').click()
  await pg.waitForTimeout(300)
  const d = await depois(pg)
  conta(d.impressoes.length === 1 && d.impressoes[0].classe, 'relatorio: Imprimir imprime')
  await ctx.close()
}

/* ---- relatorio vazio ---- */
{
  const { ctx, pg } = await abrir('/relatorio', [])
  conta(await botao(pg, 'Baixar planilha').isDisabled() && await botao(pg, 'Imprimir').isDisabled(),
    'relatorio vazio: Baixar e Imprimir ficam desligados')
  await ctx.close()
}

/* ---- painel: nome, marcas e a trava (075) ---- */
{
  const COM = [
    { ...PEDIDOS[0], planejado_em: planejado, fechado_em: null, etapa: 'calandra', nome: 'Uniforme Equipe Verão', marcas: ['VIP', 'EVENTO'],
      tem_fatias: true, tag: 'Impressão', fatias_abertas: 'subli:calandra, dtf:corte' },
    { ...PEDIDOS[1], planejado_em: planejado, fechado_em: null, nome: '', marcas: [], tem_fatias: false },
  ]
  const gravados = []
  const { ctx, pg } = await abrir('/atividades', COM, { gravados })
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('.at-linha')].map((l) => ({
    texto: l.querySelector('.at-quem').innerText.replace(/\s+/g, ' '),
    fixa: l.querySelector('.at-etapa-fixa')?.innerText ?? null,
    titulo: l.querySelector('.at-etapa-fixa')?.title ?? '',
    seletor: !!l.querySelector('.at-etapa .sel'),
    marcas: l.querySelectorAll('.at-nome-linha .etq, .at-nome-linha [class*=etiq]').length,
  })))
  const a = linhas.find((l) => l.texto.includes('PD-TESTE-0101')) ?? linhas[0]
  const b = linhas.find((l) => l.texto.includes('PD-TESTE-0102')) ?? linhas[1]
  conta(/Uniforme Equipe Verão/.test(a.texto) && /Drogaria "Viver" Bem · Dani/.test(a.texto), 'painel: o nome no lugar do cliente, e o cliente desce (' + a.texto + ')')
  conta(/VIP/.test(a.texto) && /EVENTO/.test(a.texto), 'painel: as marcas da cotacao ao lado do nome')
  conta(/Igreja Araguaia/.test(b.texto) && !/·.*Igreja/.test(b.texto), 'painel: sem nome, vale o cliente (' + b.texto + ')')
  conta(a.fixa === 'Impressão' && !a.seletor && /subli em calandra, dtf em corte/.test(a.titulo), 'painel: com fatia, a etapa fica travada e mostra a tag (' + a.fixa + ' / ' + a.titulo + ')')
  conta(b.fixa === null && b.seletor, 'painel: sem fatia, o seletor de etapa continua')

  await pg.locator('.at-nome').first().click()
  await pg.waitForTimeout(300)
  const campo = pg.getByLabel('Nome do pedido')
  conta(await campo.inputValue() === 'Uniforme Equipe Verão', 'painel: o modal abre com o nome de agora')
  await campo.fill('  Time   Azul ')
  await pg.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pg.waitForTimeout(600)
  const g = gravados.find((x) => x.rpc === 'dar_nome_ao_pedido')
  conta(!!g && g.corpo.p_pedido === 'p1' && g.corpo.p_nome === '  Time   Azul ', 'painel: Salvar chama dar_nome_ao_pedido')
  conta(await pg.locator('.at-linha', { hasText: 'Time Azul' }).count() === 1 && await pg.getByRole('dialog').count() === 0,
    'painel: a linha mostra o nome que o banco devolveu e o modal fecha')
  await pg.screenshot({ path: 'testes/atual/gestao-painel-nome.png' })
  await ctx.close()
}

/* ---- painel sem a 075 ---- */
{
  const { ctx, pg, pedidosLidos } = await abrir('/atividades', PEDIDOS.map((p) => ({ ...p, planejado_em: planejado, fechado_em: null })), { sem075: true })
  conta(pedidosLidos.n >= 1 && await pg.locator('.at-linha').count() === 2, 'painel sem a 075: le de novo sem as colunas novas e desenha as linhas')
  await ctx.close()
}

await nav.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
