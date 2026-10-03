/* ==========================================================================
   ESTOQUE, FORNECEDORES E VERIFICADOR DE BOLETO CONTRA O WIREFRAME DE
   03/10/2026, MEDIDA POR MEDIDA.

   O Henrique aprovou o wireframe com a mesma ordem do kanban: ficar IGUAL no
   sistema, conferindo tamanhos, distancias, fontes, margens, recheios, cores,
   formatos e bordas. Este teste e essa conferencia, nas tres paginas.

   Cada numero aqui foi copiado da prancha do wireframe. Se o CSS mudar e o
   numero sair, o teste reprova e diz qual.

   O QUE ELE CONFERE
     1. as medidas em 1920 por 1080, com o menu aberto, nos dois temas
     2. que nada rola para o lado em 1920, 820 e 390
     3. que as tres paginas fazem o que o wireframe promete: a folha de
        movimento grava com o fornecedor, a ficha abre, o boleto fica verde,
        amarelo e vermelho, e o arquivo do boleto nunca sai do navegador
     4. que nao houve erro de JavaScript

   O banco e de mentira (testes/materiais-dados.mjs) e o PDF do boleto e
   montado aqui mesmo, com linha digitavel que fecha a conta.

   Uso:  node testes/materiais.mjs                 confere o site publicado
         node testes/materiais.mjs http://localhost:5173
   As fotos ficam em testes/atual/materiais/, fora do repositorio.
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import * as D from './materiais-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/materiais'
mkdirSync(PASTA, { recursive: true })

/* ---------- o boleto de mentira ------------------------------------------ */
function m10(n) { let s = 0; [...n].reverse().forEach((d, i) => { const p = Number(d) * (i % 2 === 0 ? 2 : 1); s += Math.floor(p / 10) + (p % 10) }); return (10 - (s % 10)) % 10 }
function m11(n) { let s = 0; [...n].reverse().forEach((d, i) => { s += Number(d) * ((i % 8) + 2) }); const d = 11 - (s % 11); return d > 9 || d === 0 ? 1 : d }
function linhaDe({ banco, vencimento, valor, livre = '1790010104351004791020150' }) {
  const fator = 1000 + Math.round((Date.parse(vencimento + 'T00:00:00Z') - Date.parse('2025-02-22T00:00:00Z')) / 86400000)
  const sem = banco + '9' + String(fator).padStart(4, '0') + String(Math.round(valor * 100)).padStart(10, '0') + livre
  const b = sem.slice(0, 4) + m11(sem) + sem.slice(4)
  const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44)
  return c1 + m10(c1) + c2 + m10(c2) + c3 + m10(c3) + b[4] + b.slice(5, 19)
}
const comPontos = (l) => `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`
const cnpjTela = (c) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
const dataBr = (iso) => iso.split('-').reverse().join('/')
const dinheiro = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

/* Um PDF de uma pagina, so com texto, escrito na mao: o teste nao pede
   biblioteca nenhuma alem do playwright. */
function pdfDeTexto(linhas) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const corpo = linhas.map((l) => `BT /${l.forte ? 'F2' : 'F1'} ${l.tam ?? 10} Tf ${l.x} ${l.y} Td (${esc(l.t)}) Tj ET`).join('\n')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(corpo, 'latin1')} >>\nstream\n${corpo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  let pdf = '%PDF-1.4\n'
  const onde = []
  objetos.forEach((o, i) => { onde.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const tabela = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + onde.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('')
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${tabela}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
function pdfDoBoleto(nome, { banco = '341', bancoNome = 'Banco Itau S.A.', beneficiario, cnpj, valor, vencimento, pagador = 'FOURTIME CONFECCOES LTDA', pagadorCnpj = '45723174000110', valorEscrito }) {
  const l = linhaDe({ banco, vencimento, valor })
  const t = []
  let y = 780
  const p = (texto, x = 40, forte = false, tam = 10) => t.push({ t: texto, x, y, forte, tam })
  p(bancoNome, 40, true, 13); p(banco + '-7', 200, true, 13); p(comPontos(l), 270, true, 11); y -= 30
  p('Local de pagamento'); y -= 14; p('Pagavel em qualquer banco ate o vencimento', 40, true); y -= 24
  p('Beneficiario'); p('Vencimento', 420); y -= 14
  p(`${beneficiario} - CNPJ: ${cnpjTela(cnpj)}`, 40, true); p(dataBr(vencimento), 420, true); y -= 24
  p('Data do documento'); p('Nosso numero', 220); p('Valor do documento', 420); y -= 14
  p('01/10/2026', 40, true); p('109/00012345-6', 220, true); p('R$ ' + dinheiro(valorEscrito ?? valor), 420, true); y -= 24
  p('Pagador'); y -= 14
  p(`${pagador} - CNPJ ${cnpjTela(pagadorCnpj)}`, 40, true); y -= 14
  p('Rua Exemplo, 100 - Goiania GO - 74000-000'); y -= 30
  p('Autenticacao mecanica - Ficha de compensacao', 40, false, 8)
  return { name: nome, mimeType: 'application/pdf', buffer: pdfDeTexto(t), linha: l }
}
const malharia = D.fornecedores.find((f) => f.nome === 'Malharia Exemplo Ltda')
const transportadora = D.fornecedores.find((f) => f.nome === 'Transportadora Exemplo Ltda')
const PDF_VERDE = pdfDoBoleto('boleto-malharia-outubro.pdf', { beneficiario: 'MALHARIA EXEMPLO LTDA', cnpj: malharia.cnpj, valor: 1847.5, vencimento: dia(7) })
const PDF_AMARELO = pdfDoBoleto('boleto-frete.pdf', { banco: '001', bancoNome: 'Banco do Brasil S.A.', beneficiario: 'TRANSPORTADORA EXEMPLO LTDA', cnpj: transportadora.cnpj, valor: 640, vencimento: dia(6) })
const PDF_VERMELHO = pdfDoBoleto('boleto-cobranca.pdf', { banco: '260', bancoNome: 'Nu Pagamentos', beneficiario: 'MALHARIA EXEMPLO LTDA', cnpj: D.cn('556677880001'), valor: 1847.5, valorEscrito: 1487.5, vencimento: dia(1), pagador: 'JOAO DA SILVA', pagadorCnpj: D.cn('998877660001') })

/* o historico da malharia: sete boletos do mesmo banco, de 900 a 2.400 */
const PASSADO = [900, 1200, 1350, 1800, 2100, 2250, 2400].map((v, i) => ({
  ...D.conferencias[0], id: 'h' + i, linha: String(9000 + i).padEnd(47, '2'), beneficiario: 'Malharia Exemplo Ltda',
  cnpj: malharia.cnpj, valor: v, banco: '341', quando: new Date(Date.now() - (20 + i * 28) * 86400000).toISOString(),
  resultado: 'pode_pagar', situacao: 'conferido',
}))

/* ---------- o navegador com o banco de mentira --------------------------- */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (r, corpo, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) })

async function abrir(nav, { largura, altura, tema, papel = 'admin' }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1 })
  const gravados = []
  const pedidos = []
  let registro = [...D.conferencias]
  let n = 0
  ctx.on('request', (q) => pedidos.push({ u: q.url(), m: q.method(), tamanho: (q.postDataBuffer() ?? Buffer.alloc(0)).length }))
  await ctx.route('**brasilapi.com.br/**', async (r) => {
    const c = r.request().url().split('/').pop()
    const f = D.fornecedores.find((x) => x.cnpj === c)
    if (!f) return json(r, { message: 'nao encontrado' }, 404)
    return json(r, { razao_social: f.razao_social.toUpperCase(), nome_fantasia: '', descricao_situacao_cadastral: 'ATIVA', data_inicio_atividade: f.receita?.abertura ?? '2011-03-14', cnae_fiscal_descricao: f.receita?.atividade ?? '', municipio: f.cidade.toUpperCase(), uf: f.uf })
  })
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    if (u.includes('conferencia_de_boleto') && m === 'POST') {
      const c = JSON.parse(req.postData())
      gravados.push({ m, u: 'conferencia_de_boleto', corpo: c })
      const f = D.fornecedores.find((x) => x.cnpj === c.cnpj)
      let resultado = c.resultado
      /* o mesmo juizo do gatilho carimbar_a_conferencia, da migracao 041 */
      if (f?.situacao === 'bloqueado') resultado = 'nao_pague'
      else if ((!f || f.situacao !== 'confiavel') && resultado === 'pode_pagar') resultado = 'precisa_aprovacao'
      const linha = { ...c, id: 'novo' + (++n), quando: new Date().toISOString(), quem_nome: 'Financeiro', resultado, situacao: 'conferido', motivo: '', decidido_por_nome: '', decidido_em: null, nota_da_decisao: '', fornecedor_id: f?.id ?? null }
      registro = [linha, ...registro]
      return json(r, [linha])
    }
    if (u.includes('rpc/pedir_aprovacao_do_boleto')) {
      const a = JSON.parse(req.postData())
      gravados.push({ m, u: 'rpc/pedir_aprovacao_do_boleto', corpo: a })
      registro = registro.map((c) => c.id === a.p_conferencia ? { ...c, situacao: 'esperando', motivo: a.p_motivo } : c)
      return json(r, registro.find((c) => c.id === a.p_conferencia))
    }
    if (m !== 'GET') {
      let corpo = null
      try { corpo = JSON.parse(req.postData() ?? 'null') } catch { /* corpo que nao e JSON */ }
      gravados.push({ m, u: u.split('/rest/v1/')[1] ?? u, corpo })
      return json(r, u.includes('rpc/') ? {} : [{ id: 'novo-' + gravados.length }])
    }
    let corpo = []
    if (u.includes('meu_perfil')) corpo = D.perfil(papel)
    else if (u.includes('material_na_prateleira')) corpo = D.materiais
    else if (u.includes('movimento_do_estoque')) corpo = D.movimentos
    else if (u.includes('reserva_em_aberto')) corpo = D.reservas
    else if (u.includes('fornecedor_na_lista')) corpo = D.fornecedores
    else if (u.includes('material_fornecedor')) corpo = D.ligacoes
    else if (u.includes('tipo_de_fornecedor')) corpo = D.tipos
    else if (u.includes('conferencia_de_boleto') && u.includes('or=(')) corpo = [...PASSADO, ...registro]
    else if (u.includes('conferencia_de_boleto')) corpo = registro
    else if (u.includes('/tecido?')) corpo = D.tecidos
    else if (u.includes('/cor_de_tecido?')) corpo = D.cores
    return json(r, corpo)
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
    localStorage.setItem('ft.empresa', JSON.stringify({ nome: 'Fourtime', razaoSocial: 'Fourtime Confecções Ltda', cnpj: '45.723.174/0001-10', cidade: 'Goiânia', uf: 'GO' }))
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  /* fonte e imagem que o ambiente do teste bloqueia nao sao erro da pagina */
  const ruido = (t) => /Failed to load resource|ERR_|fonts\.g|net::/i.test(t)
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 240)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PAGINA ' + String(e).slice(0, 240)))
  return { ctx, pg, erros, gravados, pedidos }
}

async function ir(pg, rota, espera) {
  await pg.goto(SITE + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector(espera, { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(700)
}
const pausa = (pg, ms = 400) => pg.waitForTimeout(ms)
const foto = (pg, nome, inteira = true) => pg.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: inteira })

/* A medida de um seletor: a caixa, a letra, o raio, a borda, o recheio e as
   cores. Sempre do primeiro que estiver visivel. */
const medir = (pg, seletores) => pg.evaluate((seletores) => {
  const o = {}
  for (const s of seletores) {
    const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length)
    if (!e) { o[s] = null; continue }
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
    o[s] = {
      x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, baixo: r.bottom,
      letra: c.fontSize + '/' + c.fontWeight, raio: c.borderTopLeftRadius, borda: c.borderTopWidth, estilo: c.borderTopStyle,
      recheio: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(' '),
      fundo: c.backgroundColor, cor: c.color, texto: (e.innerText || '').trim().slice(0, 80),
    }
  }
  return o
}, seletores)
/* a cor de um token, do jeito que o navegador a escreve */
const tokens = (pg, nomes) => pg.evaluate((nomes) => {
  const o = {}
  for (const n of nomes) { const e = document.createElement('i'); e.style.backgroundColor = `var(${n})`; document.body.append(e); o[n] = getComputedStyle(e).backgroundColor; e.remove() }
  return o
}, nomes)
const todos = (pg, seletor) => pg.evaluate((seletor) => [...document.querySelectorAll(seletor)].filter((x) => x.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e)
  return { x: r.left, y: r.top, w: r.width, h: r.height, dir: r.right, raio: c.borderTopLeftRadius, fundo: c.backgroundColor, letra: c.fontSize + '/' + c.fontWeight, texto: (e.innerText || '').trim().slice(0, 60) }
}), seletor)
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
/* a medida bate quando a diferenca e menor que meio pixel */
const igual = (a, b) => Math.abs(a - b) < 0.6
const folga = (lista) => lista.slice(1).map((b, i) => Math.round((b.x - lista[i].dir) * 10) / 10)

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* ==========================================================================
   1. AS MEDIDAS, EM 1920 POR 1080, NOS DOIS TEMAS
   ========================================================================== */
for (const tema of ['light', 'dark']) {
  const T = tema === 'light' ? 'gelo' : 'grafite'
  const { ctx, pg, erros, gravados, pedidos } = await abrir(nav, { largura: 1920, altura: 1080, tema })

  /* ------------------------------------------------------------ ESTOQUE */
  await ir(pg, '/estoque', '.es-duas')
  const K = await tokens(pg, ['--bg', '--surface', '--surface-2', '--surface-3', '--brand', '--text', '--text-2', '--text-3', '--border', '--ink'])
  let m = await medir(pg, ['body', '.pagina-topo', '.pagina-topo .acima', '.pagina-topo h1', '.pagina-topo .sub', '.es-barra', '.es-aba', '.es-aba button', '.es-busca', '.es-ver', '.es-duas', '.es-lista', '.es-lado', '.es-faixa', '.es-item', '.es-item .es-vao', '.cartao-titulo', '.cartao-titulo .marca', '.es-heroi-numero', '.es-numero'])
  conta(m.body.fundo === K['--bg'], `${T} estoque: o fundo da pagina e o token --bg (${m.body.fundo})`)
  conta(igual(m['.pagina-topo'].x, 280) && igual(m['.pagina-topo'].w, 1598), `${T} estoque: a pagina vai de 280 a 1878 (${m['.pagina-topo'].x}, ${m['.pagina-topo'].w})`)
  conta(m['.pagina-topo .acima'].letra === '12.5px/600' && m['.pagina-topo .acima'].texto.toLowerCase() === 'materiais' && m['.pagina-topo .acima'].cor === K['--text-3'], `${T} estoque: sobrelinha "Materiais" 12.5/600 em --text-3`)
  conta(m['.pagina-topo h1'].letra === '24px/600' && m['.pagina-topo h1'].texto === 'Estoque', `${T} estoque: titulo "Estoque" 24/600 (${m['.pagina-topo h1'].letra})`)
  conta(m['.pagina-topo .sub'].letra === '14px/400' && m['.pagina-topo .sub'].cor === K['--text-2'], `${T} estoque: subtitulo 14/400 em --text-2`)
  let botoes = await todos(pg, '.pagina-topo .cb, .pagina-topo .btn')
  conta(botoes.length === 3 && botoes.every((b) => igual(b.h, 40) && b.raio === '10px'), `${T} estoque: tres botoes no topo, 40 de altura e raio 10 (${botoes.map((b) => b.texto.replace(/\s+/g, ' ')).join(', ')})`)
  conta(folga(botoes).every((f) => igual(f, 10)), `${T} estoque: 10 entre os botoes do topo (${folga(botoes).join(', ')})`)
  conta(botoes.at(-1).fundo === K['--brand'] && botoes.at(-1).texto === 'Registrar movimento', `${T} estoque: a acao principal e a ultima e e vermelha (${botoes.at(-1).texto})`)
  conta(igual(m['.es-barra'].y - m['.pagina-topo'].baixo, 24) && igual(m['.es-duas'].y - m['.es-barra'].baixo, 16), `${T} estoque: 24 do topo ate a barra e 16 da barra ate as caixas (${m['.es-barra'].y - m['.pagina-topo'].baixo}, ${m['.es-duas'].y - m['.es-barra'].baixo})`)
  conta(igual(m['.es-aba'].h, 40) && m['.es-aba'].raio === '10px' && m['.es-aba'].recheio === '4px 4px 4px 4px' && m['.es-aba'].fundo === K['--surface-3'], `${T} estoque: segmentado 40 de altura, raio 10, recheio 4, fundo --surface-3`)
  conta(igual(m['.es-aba button'].h, 34) && m['.es-aba button'].raio === '7px' && m['.es-aba button'].letra === '13px/600', `${T} estoque: botao do segmentado 34, raio 7, 13/600`)
  conta(igual(m['.es-busca'].w, 300) && igual(m['.es-busca'].h, 40) && m['.es-busca'].raio === '10px' && m['.es-busca'].borda === '1px' && m['.es-busca'].fundo === K['--surface'], `${T} estoque: busca 300 por 40, raio 10, borda 1, fundo --surface`)
  let chips = await todos(pg, '.es-chips .chip')
  conta(chips.length === 5 && chips.every((c) => igual(c.h, 40) && c.raio === '999px' && c.letra === '13px/500'), `${T} estoque: cinco chips em pilula, 40 de altura, 13/500 (${chips.map((c) => c.texto.replace(/\s+/g, ' ')).join(' | ')})`)
  conta(chips[0].fundo === K['--ink'], `${T} estoque: o chip ligado e preto, token --ink`)
  conta(igual(m['.es-ver'].dir, m['.es-barra'].dir) && igual(m['.es-ver'].h, 40), `${T} estoque: Lista e Tabela encostam na margem direita (${m['.es-ver'].dir})`)
  conta(igual(m['.es-lista'].w, 400) && m['.es-lista'].raio === '14px' && m['.es-lista'].borda === '1px' && m['.es-lista'].fundo === K['--surface'], `${T} estoque: caixa da lista 400 de largura, raio 14, borda 1 (${m['.es-lista'].w})`)
  conta(igual(m['.es-lado'].x - m['.es-lista'].dir, 16) && igual(m['.es-lado'].dir, 1878), `${T} estoque: 16 entre a lista e o lado, e o lado vai ate a margem (${m['.es-lado'].x - m['.es-lista'].dir})`)
  conta(igual(m['.es-faixa'].h, 36) && m['.es-faixa'].letra === '12.5px/600' && m['.es-faixa'].fundo === K['--surface-2'] && m['.es-faixa'].cor === K['--text-2'], `${T} estoque: faixa de categoria 36, 12.5/600, cinza --surface-2`)
  conta(igual(m['.es-item'].h, 48) && m['.es-item'].recheio === '4px 20px 4px 20px', `${T} estoque: linha da lista 48 de altura, recheio lateral 20 (${m['.es-item'].h})`)
  conta(igual(m['.es-item .es-vao'].w, 14) && igual(m['.es-item .es-vao'].h, 26) && m['.es-item .es-vao'].raio === '5px', `${T} estoque: vao pequeno da lista 14 por 26, raio 5`)
  const faixas = await todos(pg, '.es-faixa'); const itens = await todos(pg, '.es-item')
  conta(faixas.length === 3 && itens.length === 15, `${T} estoque: 3 categorias e 15 grupos na lista (${faixas.length}, ${itens.length})`)
  const comFornecedor = itens.filter((i) => /Exemplo/.test(i.texto)).length
  const semFornecedor = itens.filter((i) => /falta escolher o fornecedor/.test(i.texto)).length
  conta(comFornecedor === 13 && semFornecedor === 2, `${T} estoque: toda linha da lista diz o fornecedor, ou que falta escolher (${comFornecedor} com, ${semFornecedor} sem)`)
  conta(m['.es-heroi-numero'].letra === '56px/600', `${T} estoque: numero do que comprar 56/600 (${m['.es-heroi-numero'].letra})`)
  conta(m['.cartao-titulo'].letra === '15px/600' && igual(m['.cartao-titulo .marca'].w, 6) && igual(m['.cartao-titulo .marca'].h, 6) && m['.cartao-titulo .marca'].fundo === K['--brand'], `${T} estoque: titulo de cartao 15/600 com o quadradinho vermelho de 6`)
  conta(m['.es-numero'].raio === '14px' && m['.es-numero'].borda === '1px' && m['.es-numero'].recheio === '16px 20px 16px 20px' && m['.es-numero'].fundo === K['--surface-2'], `${T} estoque: caixa de numero raio 14, borda 1, recheio 16 e 20, cinza --surface-2`)
  conta((await todos(pg, '.es-tabua')).length === 6, `${T} estoque: a prateleira tem as 6 malhas`)
  conta(await sobra(pg) <= 0, `${T} estoque: nada rola para o lado`)
  await foto(pg, `estoque-geral-${T}`)

  /* o tecido escolhido */
  await pg.locator('.es-item', { hasText: 'DRYFIT' }).click(); await pausa(pg)
  m = await medir(pg, ['.es-nome', '.es-nome-botoes .btn', '.es-cor', '.es-cor .es-vao', '.es-cor .btn', '.es-cor-nome', '.es-etiqueta-comprar', '.es-etiqueta-minimo', '.es-caixa', '.es-caixa-topo', '.es-reservado', '.es-linha', '.es-mov', '.es-fornecedor'])
  conta(m['.es-nome'].raio === '14px' && m['.es-nome'].recheio === '20px 24px 20px 24px' && m['.es-nome'].borda === '1px', `${T} estoque: caixa do nome raio 14, recheio 20 e 24`)
  conta(/Malharia Exemplo/.test((await todos(pg, '.es-nome'))[0].texto) || m['.es-fornecedor'] !== null, `${T} estoque: o fornecedor aparece no tecido escolhido`)
  const cores = await todos(pg, '.es-cor')
  conta(cores.length === 4 && cores.every((c) => c.raio === '14px' && igual(c.w, cores[0].w)), `${T} estoque: quatro cores, todas da mesma largura (${cores.map((c) => Math.round(c.w)).join(', ')})`)
  conta(folga(cores.slice(0, 4)).every((f) => igual(f, 16)), `${T} estoque: 16 entre as caixas de cor (${folga(cores.slice(0, 4)).join(', ')})`)
  conta(igual(m['.es-cor .es-vao'].h, 190), `${T} estoque: vao da cor com 190 de altura (${m['.es-cor .es-vao'].h})`)
  conta(igual(m['.es-cor .btn'].h, 40) && igual(m['.es-cor .btn'].w, m['.es-cor'].w - 42), `${T} estoque: Movimentar ocupa a largura da caixa, 20 de cada lado (${m['.es-cor .btn'].w})`)
  conta(m['.es-etiqueta-comprar'].letra === '11.5px/700' && m['.es-etiqueta-comprar'].fundo === K['--brand'] && m['.es-etiqueta-comprar'].raio === '7px', `${T} estoque: etiqueta COMPRAR vermelha, 11.5/700, raio 7`)
  conta(m['.es-etiqueta-minimo'].letra === '11.5px/600' && m['.es-etiqueta-minimo'].raio === '5px' && m['.es-etiqueta-minimo'].borda === '1px', `${T} estoque: etiqueta do minimo 11.5/600, raio 5, borda 1`)
  conta(igual(m['.es-caixa-topo'].h, 44) && m['.es-caixa'].raio === '14px', `${T} estoque: topo das caixas de baixo com 44`)
  conta(igual(m['.es-linha'].h, 56) && igual(m['.es-mov'].h, 48), `${T} estoque: linha de reserva 56 e linha de movimento 48 (${m['.es-linha'].h}, ${m['.es-mov'].h})`)
  conta(igual(m['.es-reservado'].dir, 1878) && igual(m['.es-reservado'].x - m['.es-caixa'].dir, 16), `${T} estoque: movimentos e reservas lado a lado, 16 entre eles`)
  conta(await sobra(pg) <= 0, `${T} estoque, tecido: nada rola para o lado`)
  await foto(pg, `estoque-tecido-${T}`)

  /* a folha de movimento */
  await pg.locator('.es-cor', { hasText: 'Preto' }).getByRole('button', { name: 'Movimentar' }).click(); await pausa(pg, 500)
  await pg.locator('dialog[open] input[inputmode=decimal]').fill('40'); await pausa(pg, 300)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .sobre-topo .t', 'dialog[open] .sobre-corpo', 'dialog[open] .sobre-pe', 'dialog[open] .seg', 'dialog[open] input[inputmode=decimal]', 'dialog[open] .fn-gatilho', 'dialog[open] .es-antes-depois'])
  conta(igual(m['dialog[open] .caixa'].w, 440) && igual(m['dialog[open] .caixa'].h, 1080) && igual(m['dialog[open] .caixa'].dir, 1910), `${T} folha: gaveta de 440 na direita, de cima a baixo (${m['dialog[open] .caixa'].w})`)
  conta(m['dialog[open] .sobre-topo .t'].letra === '16px/700' && m['dialog[open] .sobre-corpo'].recheio === '24px 24px 24px 24px', `${T} folha: titulo 16/700 e corpo com recheio 24`)
  conta(igual(m['dialog[open] .sobre-pe'].h, 73) && m['dialog[open] .sobre-pe'].fundo === K['--surface-2'], `${T} folha: pe de 73 em --surface-2`)
  botoes = await todos(pg, 'dialog[open] .sobre-pe .btn')
  conta(botoes.length === 2 && botoes.every((b) => igual(b.h, 40)) && igual(folga(botoes)[0], 10) && botoes[1].fundo === K['--brand'], `${T} folha: Cancelar e a acao vermelha, 40 de altura, 10 entre eles`)
  conta(igual(m['dialog[open] .seg'].h, 40) && igual(m['dialog[open] input[inputmode=decimal]'].h, 40) && m['dialog[open] input[inputmode=decimal]'].raio === '10px', `${T} folha: segmentado e campo na mesma altura, 40`)
  conta(m['dialog[open] .es-antes-depois'].raio === '10px' && m['dialog[open] .es-antes-depois'].fundo === K['--surface-2'] && /de 3 kg para 43 kg/.test(m['dialog[open] .es-antes-depois'].texto.replace(/\s+/g, ' ')), `${T} folha: o antes e depois mostra 3 kg livres virando 43 (${m['dialog[open] .es-antes-depois'].texto.replace(/\s+/g, ' ')})`)
  conta(m['dialog[open] .fn-gatilho'].raio === '10px' && m['dialog[open] .fn-gatilho'].borda === '1px', `${T} folha: campo do fornecedor raio 10, borda 1`)
  await foto(pg, `estoque-folha-${T}`, false)
  await pg.locator('dialog[open] .fn-gatilho').click(); await pausa(pg)
  const menu = await pg.locator('.mn.flutua').innerText()
  conta(/já fornecem este tecido/i.test(menu) && /Malharia Exemplo Ltda/.test(menu) && /outros de tecido/i.test(menu), `${T} folha: o menu de fornecedor abre com quem ja fornece a malha`)
  await pg.locator('.mn.flutua').getByText('Malharia Exemplo Ltda', { exact: false }).first().click(); await pausa(pg)
  await botoesDaFolha(pg).last().click(); await pausa(pg, 600)
  const mov = gravados.find((g) => String(g.u).includes('rpc/mexer_no_estoque'))
  conta(mov && mov.corpo.p_quantidade === 40 && mov.corpo.p_motivo === 'entrada' && mov.corpo.p_fornecedor === malharia.id, `${T} folha: a entrada grava 40 kg com o fornecedor escolhido (${mov ? JSON.stringify(mov.corpo) : 'nada gravado'})`)
  if (await pg.locator('dialog[open]').count()) { await pg.keyboard.press('Escape'); await pausa(pg) }

  /* novo material, tabela e movimentacoes */
  await pg.getByRole('button', { name: 'Novo material', exact: true }).first().click(); await pausa(pg, 600)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .sobre-topo .t'])
  conta(igual(m['dialog[open] .caixa'].w, 560) && m['dialog[open] .caixa'].raio === '18px' && m['dialog[open] .caixa'].borda === '1px', `${T} novo material: modal de 560, raio 18 (${m['dialog[open] .caixa'].w})`)
  await foto(pg, `estoque-novo-${T}`, false)
  await pg.keyboard.press('Escape'); await pausa(pg)
  await pg.locator('.es-ver button', { hasText: 'Tabela' }).click(); await pausa(pg)
  m = await medir(pg, ['table.tabela thead th', 'table.tabela tr.grupo td', 'table.tabela tbody tr:not(.grupo)', '.es-quadro'])
  conta(igual(m['table.tabela thead th'].h, 44) && m['table.tabela thead th'].letra === '13px/600' && m['table.tabela thead th'].cor === K['--text-2'], `${T} tabela: cabecalho 44, 13/600, --text-2`)
  conta(igual(m['table.tabela tr.grupo td'].h, 36) && m['table.tabela tr.grupo td'].fundo === K['--surface-2'] && m['table.tabela tr.grupo td'].letra === '12.5px/600', `${T} tabela: linha de grupo 36 em --surface-2, 12.5/600`)
  conta(igual(m['table.tabela tbody tr:not(.grupo)'].h, 48), `${T} tabela: linha de material 48 (${m['table.tabela tbody tr:not(.grupo)'].h})`)
  conta((await todos(pg, 'table.tabela tbody tr.es-folha')).length === 26 && await sobra(pg) <= 0, `${T} tabela: os 26 materiais, sem rolar para o lado (${(await todos(pg, 'table.tabela tbody tr.es-folha')).length})`)
  await foto(pg, `estoque-tabela-${T}`)
  await pg.locator('.es-aba button', { hasText: 'Movimentações' }).click(); await pausa(pg)
  m = await medir(pg, ['.es-quadro', 'table.tabela tr.grupo td', 'table.tabela tbody tr:not(.grupo)'])
  conta(m['.es-quadro'].raio === '14px' && m['.es-quadro'].borda === '1px' && igual(m['.es-quadro'].w, 1598), `${T} movimentacoes: um quadro so, raio 14, na largura inteira`)
  conta((await todos(pg, 'table.tabela tbody tr:not(.grupo)')).length === 17 && igual(m['table.tabela tbody tr:not(.grupo)'].h, 48) && igual(m['table.tabela tr.grupo td'].h, 36), `${T} movimentacoes: 17 movimentos em linhas de 48, com o dia em faixa de 36`)
  conta(await sobra(pg) <= 0, `${T} movimentacoes: nada rola para o lado`)
  await foto(pg, `estoque-movimentacoes-${T}`)

  /* -------------------------------------------------------- FORNECEDORES */
  await ir(pg, '/fornecedores', '.fo-linha')
  m = await medir(pg, ['.pagina-topo .acima', '.pagina-topo h1', '.fo-barra', '.pagina-topo', '.fo-busca', '.fo-vista', '.fo-quadro', '.fo-grupo', '.fo-linha', '.fn-situacao'])
  conta(m['.pagina-topo h1'].letra === '24px/600' && m['.pagina-topo h1'].texto === 'Fornecedores' && m['.pagina-topo .acima'].letra === '12.5px/600', `${T} fornecedores: titulo 24/600 com a sobrelinha 12.5/600`)
  botoes = await todos(pg, '.pagina-topo .btn')
  conta(botoes.every((b) => igual(b.h, 40) && b.raio === '10px') && folga(botoes).every((f) => igual(f, 10)) && botoes.at(-1).fundo === K['--brand'], `${T} fornecedores: botoes do topo 40, 10 entre eles, a ultima vermelha (${botoes.map((b) => b.texto).join(', ')})`)
  conta(igual(m['.fo-barra'].y - m['.pagina-topo'].baixo, 24) && igual(m['.fo-quadro'].y - m['.fo-barra'].baixo, 16), `${T} fornecedores: 24 do topo ate a barra e 16 ate o quadro`)
  conta(igual(m['.fo-busca'].w, 340) && igual(m['.fo-busca'].h, 40) && m['.fo-busca'].raio === '10px' && igual(m['.fo-vista'].h, 40), `${T} fornecedores: busca 340 por 40 e segmentado 40`)
  chips = await todos(pg, '.fo-chips .chip')
  conta(chips.length === 6 && chips.every((c) => igual(c.h, 40) && c.raio === '999px' && c.letra === '13px/500'), `${T} fornecedores: seis chips em pilula, 40, 13/500 (${chips.map((c) => c.texto.replace(/\s+/g, ' ')).join(' | ')})`)
  conta(m['.fo-quadro'].raio === '14px' && m['.fo-quadro'].borda === '1px' && igual(m['.fo-quadro'].w, 1598) && m['.fo-quadro'].fundo === K['--surface'], `${T} fornecedores: quadro raio 14, borda 1, largura inteira`)
  conta(m['.fo-grupo'].letra === '12.5px/600' && m['.fo-grupo'].cor === K['--text-2'], `${T} fornecedores: nome do tipo 12.5/600 em --text-2`)
  conta(igual(m['.fo-linha'].h, 48) && m['.fn-situacao'].letra === '13px/600', `${T} fornecedores: linha de 48 e situacao 13/600`)
  conta((await todos(pg, '.fo-linha')).length === 14 && await sobra(pg) <= 0, `${T} fornecedores: 13 fornecedores, a malharia em dois tipos, sem rolar para o lado (${(await todos(pg, '.fo-linha')).length} linhas)`)
  await foto(pg, `fornecedores-tipo-${T}`)
  await pg.locator('.fo-vista button', { hasText: 'Por fornecedor' }).click(); await pausa(pg, 300)
  await pg.locator('.fo-linha', { hasText: 'Malharia Exemplo Ltda' }).first().click(); await pausa(pg, 600)
  m = await medir(pg, ['.fo-duas', '.fo-ficha', '.fo-ficha-topo h2', '.fo-ficha-corpo', '.fo-dado', '.fo-ficha-pe', '.fo-quadro'])
  conta(igual(m['.fo-ficha'].w, 520) && m['.fo-ficha'].raio === '14px' && m['.fo-ficha'].borda === '1px' && igual(m['.fo-ficha'].dir, 1878), `${T} ficha: 520 de largura na direita, raio 14 (${m['.fo-ficha'].w})`)
  conta(igual(m['.fo-ficha'].x - m['.fo-quadro'].dir, 16), `${T} ficha: 16 entre a lista e a ficha (${m['.fo-ficha'].x - m['.fo-quadro'].dir})`)
  conta(m['.fo-ficha-topo h2'].letra === '20px/600' && m['.fo-ficha-topo h2'].texto === 'Malharia Exemplo Ltda', `${T} ficha: nome 20/600`)
  conta(m['.fo-ficha-corpo'].recheio === '16px 24px 24px 24px' && igual(m['.fo-dado'].h, 34), `${T} ficha: corpo com recheio 24 e linha de dado 34`)
  botoes = await todos(pg, '.fo-ficha-pe .btn')
  const daDireita = await todos(pg, '.fo-ficha-botoes .btn')
  conta(igual(m['.fo-ficha-pe'].h, 73) && botoes.length === 3 && botoes.every((b) => igual(b.h, 40)) && folga(daDireita).every((f) => igual(f, 10)) && igual(botoes[0].x - m['.fo-ficha'].x, 25) && igual(m['.fo-ficha'].dir - daDireita.at(-1).dir, 25), `${T} ficha: pe de 73, Bloquear na esquerda e os outros na direita, 40 de altura, 10 entre eles (${botoes.map((b) => b.texto).join(', ')})`)
  conta(await sobra(pg) <= 0, `${T} ficha: nada rola para o lado`)
  await foto(pg, `fornecedores-ficha-${T}`)
  await pg.getByRole('button', { name: 'Novo fornecedor' }).click(); await pausa(pg, 500)
  await pg.locator('dialog[open] input[aria-label=CNPJ]').fill(D.cn('890123450001')); await pausa(pg, 200)
  await pg.getByRole('button', { name: 'Buscar na Receita' }).click(); await pausa(pg, 800)
  m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .fo-cnpj-campo', 'dialog[open] .fo-receita', 'dialog[open] .chip'])
  conta(igual(m['dialog[open] .caixa'].w, 980) && m['dialog[open] .caixa'].raio === '18px', `${T} novo fornecedor: modal largo de 980, raio 18 (${m['dialog[open] .caixa'].w})`)
  conta(igual(m['dialog[open] .fo-cnpj-campo'].w, 240) && igual(m['dialog[open] .fo-cnpj-campo'].h, 40) && igual(m['dialog[open] .chip'].h, 40), `${T} novo fornecedor: CNPJ 240 por 40 e chips de 40`)
  conta(m['dialog[open] .fo-receita'] !== null && /MALHAS EXEMPLO DO SUL/i.test(m['dialog[open] .fo-receita'].texto + (await pg.locator('dialog[open]').innerText())), `${T} novo fornecedor: Buscar na Receita traz a razao social`)
  await foto(pg, `fornecedores-novo-${T}`, false)
  await pg.keyboard.press('Escape'); await pausa(pg)

  /* -------------------------------------------------------------- BOLETO */
  await ir(pg, '/ferramentas/boleto', '.bo-tabela')
  m = await medir(pg, ['.pagina-topo', '.pagina-topo h1', '.pagina-topo .acima', '.bo-duas', '.bo-caixa', '.bo-solta', '.bo-ou', '.bo-nivel', '.bo-registro', '.bo-tabela thead th', '.bo-tabela tbody tr', '.bo-resultado', '.cartao-titulo', '.cartao-titulo .marca'])
  conta(m['.pagina-topo h1'].letra === '24px/600' && m['.pagina-topo h1'].texto === 'Verificador de Boleto' && m['.pagina-topo .acima'].letra === '12.5px/600', `${T} boleto: titulo 24/600 com a sobrelinha`)
  conta(igual(m['.bo-duas'].y - m['.pagina-topo'].baixo, 24), `${T} boleto: 24 do topo ate as caixas (${m['.bo-duas'].y - m['.pagina-topo'].baixo})`)
  conta(igual(m['.bo-caixa'].w, 600) && m['.bo-caixa'].raio === '14px' && m['.bo-caixa'].borda === '1px' && m['.bo-caixa'].recheio === '24px 24px 24px 24px' && m['.bo-caixa'].fundo === K['--surface'], `${T} boleto: caixa da entrada 600, raio 14, borda 1, recheio 24`)
  const caixas = await todos(pg, '.bo-duas > .bo-caixa')
  conta(caixas.length === 2 && igual(caixas[1].x - caixas[0].dir, 16) && igual(caixas[1].dir, 1878), `${T} boleto: as duas caixas com 16 entre elas, ate a margem`)
  conta(m['.bo-solta'].raio === '10px' && m['.bo-solta'].borda === '1px' && m['.bo-solta'].estilo === 'dashed' && m['.bo-solta'].fundo === K['--surface-2'] && igual(m['.bo-solta'].h, 176), `${T} boleto: area de soltar tracejada, raio 10, 176 de altura, --surface-2 (${m['.bo-solta'].estilo}, ${m['.bo-solta'].h})`)
  conta(m['.cartao-titulo'].letra === '15px/600' && igual(m['.cartao-titulo .marca'].w, 6), `${T} boleto: titulo de cartao 15/600 com o quadradinho`)
  const niveis = await todos(pg, '.bo-nivel')
  conta(niveis.length === 3 && niveis.every((n) => n.raio === '10px' && igual(n.w, niveis[0].w)) && folga(niveis).every((f) => igual(f, 12)), `${T} boleto: tres niveis iguais, raio 10, 12 entre eles (${folga(niveis).join(', ')})`)
  conta(m['.bo-registro'].raio === '14px' && igual(m['.bo-registro'].w, 1598) && igual(m['.bo-registro'].y - m['.bo-duas'].baixo, 16), `${T} boleto: registro na largura inteira, 16 abaixo das caixas`)
  conta(igual(m['.bo-tabela thead th'].h, 44) && m['.bo-tabela thead th'].letra === '13px/600' && igual(m['.bo-tabela tbody tr'].h, 48) && m['.bo-resultado'].letra === '13px/600', `${T} boleto: cabecalho 44, linha 48, resultado 13/600`)
  conta((await todos(pg, '.bo-tabela tbody tr')).length === 4 && await sobra(pg) <= 0, `${T} boleto: quatro conferencias no registro, sem rolar para o lado`)
  botoes = await todos(pg, '.bo-pe-botoes .btn')
  conta(botoes.length === 2 && botoes.every((b) => igual(b.h, 40)) && igual(folga(botoes)[0], 10) && botoes[1].fundo === K['--brand'], `${T} boleto: Limpar e Conferir boleto, 40, 10 entre eles, a ultima vermelha`)
  await foto(pg, `boleto-entrada-${T}`)

  const soltar = async (pdf) => {
    await pg.locator('.bo-solta input[type=file]').setInputFiles({ name: pdf.name, mimeType: pdf.mimeType, buffer: pdf.buffer })
    await pg.waitForSelector('.bo-veredito', { timeout: 20000 }); await pausa(pg, 500)
  }
  const veredito = async () => {
    const v = await medir(pg, ['.bo-veredito', '.bo-veredito h2', '.bo-oito', '.bo-checagem', '.bo-linha'])
    const oito = await todos(pg, '.bo-checagem')
    return { v, oito }
  }
  /* verde */
  const antes = pedidos.length
  await soltar(PDF_VERDE)
  let r = await veredito()
  conta(r.v['.bo-veredito h2'].texto === 'Pode pagar', `${T} boleto verde: "${r.v['.bo-veredito h2'].texto}" para o boleto da malharia confiavel`)
  conta(r.oito.length === 8 && r.v['.bo-veredito'].raio === '10px', `${T} boleto verde: as oito conferencias aparecem e o veredito tem raio 10 (${r.oito.length}, ${r.v['.bo-veredito'].raio})`)
  conta(r.v['.bo-linha'] && r.v['.bo-linha'].texto.replace(/\D/g, '') === PDF_VERDE.linha, `${T} boleto verde: a linha digitavel lida do PDF e a mesma do boleto`)
  const reg = gravados.filter((g) => g.u === 'conferencia_de_boleto').at(-1)
  conta(reg && reg.corpo.arquivo === 'boleto-malharia-outubro.pdf' && reg.corpo.cnpj === malharia.cnpj && Number(reg.corpo.valor) === 1847.5 && reg.corpo.linha === PDF_VERDE.linha, `${T} boleto verde: o registro leva linha, CNPJ, valor e so o NOME do arquivo`)
  const maior = Math.max(0, ...pedidos.slice(antes).map((p) => p.tamanho))
  conta(maior < PDF_VERDE.buffer.length && JSON.stringify(reg?.corpo ?? {}).length < 6000, `${T} boleto verde: o arquivo nao sai do navegador (maior envio ${maior} bytes, o PDF tem ${PDF_VERDE.buffer.length})`)
  conta(await sobra(pg) <= 0, `${T} boleto verde: nada rola para o lado`)
  await foto(pg, `boleto-verde-${T}`)
  /* amarelo */
  await pg.getByRole('button', { name: 'Conferir outro boleto' }).first().click(); await pausa(pg, 300)
  await soltar(PDF_AMARELO)
  r = await veredito()
  conta(r.v['.bo-veredito h2'].texto === 'Precisa de aprovação' && r.oito.length === 8, `${T} boleto amarelo: "${r.v['.bo-veredito h2'].texto}" para quem ainda nao e confiavel`)
  conta(await pg.locator('.bo-linha.escondida').count() === 1 && !(await pg.locator('.bo-caixa').first().innerText()).replace(/\D/g, '').includes(PDF_AMARELO.linha), `${T} boleto amarelo: a linha digitavel fica escondida`)
  await foto(pg, `boleto-amarelo-${T}`)
  await pg.locator('.bo-motivo').fill('Frete da malha do pedido PD-0412, combinado com a transportadora.')
  await pg.locator('.bo-acao .btn').last().click(); await pausa(pg, 700)
  const ped = gravados.find((g) => g.u === 'rpc/pedir_aprovacao_do_boleto')
  conta(ped && /PD-0412/.test(ped.corpo.p_motivo), `${T} boleto amarelo: pedir aprovacao manda o motivo para o administrador`)
  if (await pg.locator('dialog[open]').count()) { await foto(pg, `boleto-aprovar-${T}`, false); await pg.keyboard.press('Escape'); await pausa(pg) }
  /* vermelho */
  await pg.getByRole('button', { name: 'Conferir outro boleto' }).first().click(); await pausa(pg, 300)
  await soltar(PDF_VERMELHO)
  r = await veredito()
  conta(r.v['.bo-veredito h2'].texto === 'Não pague' && r.oito.length === 8, `${T} boleto vermelho: "${r.v['.bo-veredito h2'].texto}" quando o valor escrito nao e o da linha e o pagador e outro`)
  conta(await pg.locator('.bo-linha.escondida').count() === 1, `${T} boleto vermelho: a linha digitavel fica escondida`)
  await foto(pg, `boleto-vermelho-${T}`)

  conta(erros.length === 0, `${T}: nenhum erro de JavaScript nas tres paginas${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
  await ctx.close()
}

/* os dois botoes do pe da folha aberta */
function botoesDaFolha(pg) { return pg.locator('dialog[open] .sobre-pe .btn') }

/* ==========================================================================
   2. O TABLET E O CELULAR: NADA ROLA PARA O LADO, E O QUE MUDA DE LUGAR MUDA
   ========================================================================== */
for (const [largura, altura, nome] of [[820, 1180, 'tablet'], [390, 844, 'celular']]) {
  for (const tema of ['light', 'dark']) {
    const T = `${nome} ${tema === 'light' ? 'gelo' : 'grafite'}`
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema })
    const estreito = largura < 800

    await ir(pg, '/estoque', '.es-duas')
    conta(await sobra(pg) <= 0, `${T} estoque: nada rola para o lado`)
    let m = await medir(pg, ['.pagina-topo h1', '.es-busca', '.es-aba', '.es-item', '.es-lista'])
    conta(m['.pagina-topo h1'].letra === '24px/600' && igual(m['.es-busca'].h, 40) && igual(m['.es-aba'].h, 40), `${T} estoque: titulo 24/600 e controles de 40`)
    conta(m['.es-item'].h >= (estreito ? 50 : 48), `${T} estoque: linha da lista com ${m['.es-item'].h} de altura para o dedo`)
    if (estreito) conta(igual(m['.es-lista'].x, 20) && igual(m['.es-lista'].w, 340), `${T} estoque: a lista ocupa a largura, com 20 de margem (${m['.es-lista'].x}, ${m['.es-lista'].w})`)
    await foto(pg, `estoque-geral-${nome}-${tema}`)
    await pg.locator('.es-item', { hasText: 'DRYFIT' }).click(); await pausa(pg, 500)
    conta(await sobra(pg) <= 0, `${T} estoque, tecido: nada rola para o lado`)
    conta(await pg.locator('.es-volta').count() === 1, `${T} estoque: o tecido aberto ocupa a tela e tem o botao de voltar`)
    if (estreito) {
      const cores = await todos(pg, '.es-cor')
      conta(cores.length === 4 && igual(cores[0].w, 164) && igual(cores[1].x - cores[0].dir, 12), `${T} estoque: as cores em duas colunas de 164, 12 entre elas (${cores[0].w}, ${cores[1].x - cores[0].dir})`)
    }
    await pg.evaluate(() => scrollTo(0, 0)); await foto(pg, `estoque-tecido-${nome}-${tema}`)
    await pg.locator('.es-cor', { hasText: 'Preto' }).getByRole('button', { name: 'Movimentar' }).click(); await pausa(pg, 600)
    m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] .sobre-pe .btn'])
    conta(m['dialog[open] .caixa'].dir <= largura && m['dialog[open] .caixa'].baixo <= altura + 1 && igual(m['dialog[open] .sobre-pe .btn'].h, 40), `${T} folha: cabe na tela (${Math.round(m['dialog[open] .caixa'].w)} por ${Math.round(m['dialog[open] .caixa'].h)})`)
    await foto(pg, `estoque-folha-${nome}-${tema}`, false)
    await pg.keyboard.press('Escape'); await pausa(pg)
    if (await pg.locator('.es-volta').count()) { await pg.locator('.es-volta').click(); await pausa(pg, 300) }
    await pg.locator('.es-aba button', { hasText: 'Movimentações' }).click(); await pausa(pg)
    conta(await sobra(pg) <= 0, `${T} movimentacoes: nada rola para o lado`)
    await foto(pg, `estoque-movimentacoes-${nome}-${tema}`)

    await ir(pg, '/fornecedores', '.fo-linha')
    conta(await sobra(pg) <= 0, `${T} fornecedores: nada rola para o lado`)
    m = await medir(pg, ['.fo-linha', '.fo-busca'])
    conta(m['.fo-linha'].h >= 48 && igual(m['.fo-busca'].h, 40), `${T} fornecedores: linha de ${m['.fo-linha'].h} e busca de 40`)
    await foto(pg, `fornecedores-tipo-${nome}-${tema}`)
    await pg.locator('.fo-linha', { hasText: 'Malharia Exemplo Ltda' }).first().click(); await pausa(pg, 600)
    m = await medir(pg, ['dialog[open] .caixa', 'dialog[open] h2'])
    conta(m['dialog[open] .caixa'] !== null && m['dialog[open] .caixa'].dir <= largura && /Malharia Exemplo Ltda/.test(await pg.locator('dialog[open]').innerText()), `${T} fornecedores: a ficha abre numa folha que cabe na tela`)
    await foto(pg, `fornecedores-ficha-${nome}-${tema}`, false)
    await pg.keyboard.press('Escape'); await pausa(pg)

    await ir(pg, '/ferramentas/boleto', '.bo-tabela')
    conta(await sobra(pg) <= 0, `${T} boleto: nada rola para o lado`)
    const caixas = await todos(pg, '.bo-duas > .bo-caixa')
    if (estreito) conta(caixas.length === 2 && igual(caixas[0].w, 340) && caixas[1].y > caixas[0].y + caixas[0].h - 1, `${T} boleto: as duas caixas empilham, na largura da tela (${caixas[0].w})`)
    await foto(pg, `boleto-entrada-${nome}-${tema}`)
    await pg.locator('.bo-solta input[type=file]').setInputFiles({ name: PDF_VERDE.name, mimeType: PDF_VERDE.mimeType, buffer: PDF_VERDE.buffer })
    await pg.waitForSelector('.bo-veredito', { timeout: 20000 }); await pausa(pg, 500)
    conta((await pg.locator('.bo-veredito h2').innerText()) === 'Pode pagar' && await sobra(pg) <= 0, `${T} boleto verde: Pode pagar, sem rolar para o lado`)
    await pg.evaluate(() => scrollTo(0, 0)); await foto(pg, `boleto-verde-${nome}-${tema}`)

    conta(erros.length === 0, `${T}: nenhum erro de JavaScript${erros.length ? ' (' + erros.slice(0, 3).join(' // ') + ')' : ''}`)
    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length} conferencias em ${SITE}: ${achados.length - ruins.length} certas, ${ruins.length} ruins`)
if (ruins.length) { console.log('\nO QUE NAO BATEU'); ruins.forEach((a) => console.log('  ' + a.texto)); process.exit(1) }
