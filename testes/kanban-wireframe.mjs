/* ==========================================================================
   O KANBAN CONTRA O WIREFRAME DE 01/10/2026, MEDIDA POR MEDIDA.

   O Henrique aprovou o wireframe com uma ordem só: ficar IDÊNTICO no
   sistema, conferindo bordas, margens, recheios e tamanhos de fonte. Este
   teste é essa conferência. Cada número aqui foi copiado do wireframe, e não
   do código: se o CSS mudar e o número sair, o teste reprova.

   Roda em 1920 por 1080, que é a tela em que o wireframe foi desenhado, com
   o menu lateral aberto, nos dois temas. Os dados são os do wireframe, com as
   datas contadas a partir de hoje.

   Uso:  node testes/kanban-wireframe.mjs
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/fotos'
mkdirSync(PASTA, { recursive: true })

const PAGINAS = ['inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban','produtos','estoque','atividades','relatorio','banco','config','kit']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = {ver:true,editar:true,deletar:true,total:true})
const PERFIL = [{ id:'1', nome:'Henrique', papel:'admin', situacao:'aprovado', paineis:PAGINAS, permissoes, email:'t@f', foto_em:null }]

const ROTAS = []
const poe = (t, postos) => postos.forEach((p,i) => ROTAS.push({tecnica:t, ordem:(i+1)*10, posto:p}))
poe('subli', ['subli','calandra','corte','conferencia','cd-costura','costura','embalagem','finalizado'])
poe('dtf', ['corte','dtf','prensa','conferencia','cd-costura','costura','embalagem','finalizado'])
poe('silk', ['corte','silk','conferencia','cd-costura','costura','embalagem','finalizado'])
poe('bordado', ['bordado','cd-costura','costura','embalagem','finalizado'])
poe('patch', ['prensa','cd-costura','costura','embalagem','finalizado'])

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const ha = (d) => new Date(Date.now() - d*86400000 - 3600000).toISOString()

/* os pedidos do wireframe, com as mesmas datas relativas */
const PEDIDOS = [
  ['p1','PD-0398','Interclasse Colégio Atena',-2,180,['URGENTE'],[['subli','costura',[1,2],1,0,[]],['dtf','prensa',[3],4,3,['falta_tecido']]]],
  ['p2','PD-0405','Uniforme Equipe Verão',0,299,['VIP','PRIORIDADE'],[['subli','calandra',[1,2],0,2,['prova_de_cor']],['dtf','dtf',[3,4],2,0,[]]]],
  ['p3','PD-0407','Camisa Congresso 2026',0,160,['EVENTO'],[['dtf','embalagem',[1,2],0,0,[]]]],
  ['p4','PD-0410','Corrida Solidária 10K',1,420,[],[['subli','subli',[1,2,3],1,1,[]]]],
  ['p5','PD-0412','Futsal Vila Nova',2,36,[],[['silk','corte',[1],3,0,['montagem']],['bordado','bordado',[2],1,0,[]]]],
  ['p6','PD-0415','Studio Pilates Flor',2,60,[],[['dtf','corte',[1],0,0,[]]]],
  ['p7','PD-0418','Escola Girassol',5,540,[],[['subli','subli',[1,2,3],0,0,[]],['silk','silk',[4,5],2,1,[]]]],
  ['p8','PD-0420','Vôlei Clube Araras',5,48,[],[['subli','conferencia',[1,2],1,0,[]]]],
  ['p9','PD-0423','Clínica Bem Viver',7,90,[],[['patch','prensa',[1],0,0,[]]]],
]
const FATIAS = []
for (const [pid, numero, nome, d, pecas, marcas, fatias] of PEDIDOS) {
  const nLay = fatias.reduce((s, f) => s + f[2].length, 0)
  fatias.forEach(([tecnica, etapa, layouts, parado, falas, tags], i) => FATIAS.push({
    id: pid + '-' + i, pedido_id: pid, numero, nome, cliente: nome, cliente_id: null, vendedor: 'Dani',
    tecnica, etapa, etapa_em: ha(parado), fechado_em: null, layouts,
    pecas: Math.round(pecas * layouts.length / nLay), entrega_em: dia(d), aviso: '', estado: 'producao',
    teste: false, marcas, tags, pego_por: null, pego_por_nome: '', pego_em: null, falas,
  }))
}
const TAGS = [
  { chave:'falta_tecido', nome:'falta tecido', tom:'vermelha', em_todo_posto:true,  ordem:10, ativa:true },
  { chave:'montagem',     nome:'montagem',     tom:'verde',    em_todo_posto:true,  ordem:30, ativa:true },
  { chave:'prova_de_cor', nome:'prova de cor', tom:'azul',     em_todo_posto:true,  ordem:40, ativa:true },
]
const BLOCO = (n, ref, nome, genero, grade, hex, cor) => ({
  id:'B'+n, n, referencia:ref, nomeDaReferencia:nome, genero, faixa:'adulto', grade,
  tecidos:[{ nome:'DRYFIT POLIÉSTER 100%', cor, hex }],
  design:[{ tag:'Subli', tecnica:'subli', cores:[{cod:'SB-214',hex},{cod:'SB-001',hex:'#ffffff'}] }],
  arte:'', imagem:'', observacao:'Gola em ribana preta.',
})
const COTACAO = [{
  id:'c1', numero:'CO2026-0100', versao_do_formato:4, estado:'aprovada', criada_em:ha(9), atualizado_em:ha(1),
  corpo: {
    numero:'CO2026-0100', versaoDoFormato:4, estado:'aprovada', vendedor:'Dani',
    cliente:{ id:'', nome:'Drogaria Viver Bem', documento:'', contato:'', telefone:'', email:'', cidade:'Goiânia', uf:'GO' },
    produtos:[
      { bloco: BLOCO(1,'FT-010-000M','CAMISETA MASC TRAD','masculino',{P:4,M:10,G:12,GG:6,XG:2},'#1d4ed8','Azul Royal'), precoPorTamanho:{}, precoBase:60 },
      { bloco: BLOCO(2,'FT-010-000F','CAMISETA FEM TRAD','feminino',{P:6,M:8,G:4,GG:2},'#1d4ed8','Azul Royal'), precoPorTamanho:{}, precoBase:60 },
      { bloco: BLOCO(3,'FT-030-000M','REGATA MASC','masculino',{P:3,M:9,G:11,GG:5},'#111827','Preto'), precoPorTamanho:{}, precoBase:60 },
      { bloco: BLOCO(4,'FT-050-000I','CAMISETA INFANTIL','infantil',{P:8,M:10,G:12},'#f8fafc','Branco'), precoPorTamanho:{}, precoBase:60 },
    ],
    ajustes:[], informe:{}, informes:[], enviadas:[],
    producao:{ pedido:'', dataDeEnvio:'', departamento:'', embalagem:'', marcas:['VIP','PRIORIDADE'], observacao:'' },
  },
}]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
/* a medida bate quando a diferença é menor que meio pixel */
const igual = (a, b) => Math.abs(a - b) < 0.6
const px = (v) => parseFloat(v)

for (const tema of ['light', 'dark']) {
  const ctx = await nav.newContext({ viewport:{ width:1920, height:1080 }, reducedMotion:'reduce' })
  await ctx.route('**supabase.co/**', async (r) => {
    const u = r.request().url()
    let corpo = []
    if (u.includes('meu_perfil')) corpo = PERFIL
    else if (u.includes('fatia_na_fabrica')) corpo = FATIAS
    else if (u.includes('linha_do_tempo')) corpo = [
      { id:'e1', tipo:'fala', texto:'Comparei com o PD-0362 antes de imprimir.', em:ha(0.1), quem:'1', quem_nome:'Henrique' },
      { id:'e2', tipo:'posto', texto:'subli para calandra', em:ha(0.08), quem:'1', quem_nome:'Henrique' },
    ]
    else if (u.includes('tag_do_posto')) corpo = []
    else if (u.includes('/tag?')) corpo = TAGS
    else if (u.includes('rota_da_tecnica')) corpo = ROTAS
    else if (u.includes('pedido_na_fabrica')) corpo = []
    else if (u.includes('/pedido?')) corpo = [{ cotacao_id:'c1' }]
    else if (u.includes('/cotacao?')) corpo = COTACAO
    return r.fulfill({ status:200, contentType:'application/json',
      headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript(([c, t])=>{ try{
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
    localStorage.setItem('ft.menu', 'aberto')
  }catch{} }, [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }, tema])

  const pg = await ctx.newPage()
  await pg.goto(SITE + '/kanban', { waitUntil:'networkidle' })
  await pg.waitForTimeout(1500)
  const T = tema

  /* ---------- 1. a faixa de cima ---------- */
  const cima = await pg.evaluate(() => {
    const cx = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null }
    const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null }
    const caixas = [...document.querySelectorAll('.kb-caixa')].map(e => e.getBoundingClientRect())
    const t = cs('.kb-trilho')
    const titulo = [...document.querySelectorAll('h1')].find(h => h.offsetParent !== null && h.getBoundingClientRect().height > 2)
    return {
      tituloVisivel: !!titulo,
      cima: cx('.kb-cima'), trilho: cx('.kb-trilho'), janela: cx('.kb-trilho-janela'),
      tPad: t.paddingTop, tRaio: t.borderTopLeftRadius, tBorda: t.borderTopWidth,
      setas: [...document.querySelectorAll('.kb-trilho .kb-seta')].map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(e).borderTopLeftRadius] }),
      caixas: caixas.map(r => [r.left, r.width, r.height]),
      cxPad: [cs('.kb-caixa').paddingTop, cs('.kb-caixa').paddingRight, cs('.kb-caixa').paddingBottom],
      cxRaio: cs('.kb-caixa').borderTopLeftRadius,
      cxRot: [cs('.kb-caixa-rot').fontSize, cs('.kb-caixa-rot').fontWeight],
      cxN: [cs('.kb-caixa-n').fontSize, cs('.kb-caixa-n').fontWeight],
      cxSub: [cs('.kb-caixa-sub').fontSize, cs('.kb-caixa-sub').marginTop],
      /* a borda direita da área útil: a vista termina antes da calha de 10px
         que o sistema guarda para a barra de rolagem */
      larg: document.querySelector('.vista').getBoundingClientRect().right,
    }
  })
  conta(!cima.tituloVisivel, `${T}: sem cabeçalho MARK45 visível`)
  conta(igual(cima.cima.top, 88), `${T}: a faixa começa 28px abaixo do topo de 60 (${cima.cima.top})`)
  conta(igual(cima.cima.height, 148) && igual(cima.trilho.height, 148), `${T}: trilho e faixa com 148 de altura (${cima.trilho.height})`)
  conta(igual(cima.trilho.left, 280), `${T}: o trilho começa em 280, depois do menu de 248 e 32 de margem (${cima.trilho.left})`)
  conta(cima.tPad === '10px' && cima.tRaio === '14px' && cima.tBorda === '1px', `${T}: trilho com recheio 10, raio 14, borda 1 (${cima.tPad} ${cima.tRaio} ${cima.tBorda})`)
  conta(igual(cima.janela.height, 126), `${T}: a janela do trilho tem 126 (${cima.janela.height})`)
  conta(cima.setas.length === 2 && cima.setas.every(s => s[0] === 44 && s[1] === 44 && s[2] === '10px'), `${T}: as duas setas do trilho são 44x44 raio 10`)
  conta(cima.caixas.length === 4 && cima.caixas.every(c => igual(c[1], 148) && igual(c[2], 148)), `${T}: as quatro caixas são quadradas, 148x148`)
  conta(cima.caixas.length === 4 && cima.caixas.slice(1).every((c, i) => igual(c[0] - (cima.caixas[i][0] + 148), 12)), `${T}: 12 entre as caixas`)
  conta(igual(cima.caixas[0][0] - cima.trilho.right, 16), `${T}: 16 entre o trilho e as caixas (${cima.caixas[0][0] - cima.trilho.right})`)
  /* o sistema guarda 10px de calha para a barra de rolagem (base.css), que o
     wireframe não tinha: a margem de 32 é contada a partir dela */
  conta(igual(cima.caixas[3][0] + 148, cima.larg - 32), `${T}: a última caixa encosta na margem de 32 (${cima.caixas[3][0] + 148} de ${cima.larg})`)
  conta(cima.cxPad.join(' ') === '14px 14px 12px' && cima.cxRaio === '14px', `${T}: caixa com recheio 14 14 12 e raio 14 (${cima.cxPad.join(' ')})`)
  conta(cima.cxRot.join(' ') === '12.5px 600' && cima.cxN.join(' ') === '30px 600' && cima.cxSub.join(' ') === '11.5px 6px',
    `${T}: fontes da caixa 12.5/600, 30/600, 11.5 com 6 em cima`)

  /* ---------- 2. o trilho, fechado ---------- */
  const tr = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const dias = [...document.querySelectorAll('.kb-dia-rot')].map(e => e.firstChild.textContent.trim())
    const c = document.querySelector('.kb-tr')
    const r = c.getBoundingClientRect()
    const rot = document.querySelector('.kb-dia-rot')
    const fita = document.querySelector('.kb-trilho-fita')
    const cartoes = [...document.querySelectorAll('.kb-dia-cartoes')].find(e => e.children.length > 1)
    const doisCartoes = cartoes ? cartoes.children[1].getBoundingClientRect().left - cartoes.children[0].getBoundingClientRect().right : null
    return {
      dias, w: r.width, h: r.height, borda: cs(c).borderTopWidth, raio: cs(c).borderTopLeftRadius,
      pad: cs(c.querySelector('.kb-tr-esq')).paddingTop,
      num: [cs(c.querySelector('.kb-tr-topo b')).fontSize, cs(c.querySelector('.kb-tr-topo b')).fontWeight],
      prazo: [cs(c.querySelector('.kb-tr-prazo')).fontSize, cs(c.querySelector('.kb-tr-prazo')).fontWeight],
      nome: [cs(c.querySelector('.kb-tr-nome')).fontSize, cs(c.querySelector('.kb-tr-nome')).fontWeight],
      pe: [cs(c.querySelector('.kb-tr-pe')).fontSize, c.querySelector('.kb-tr-pe').getBoundingClientRect().height],
      rot: [cs(rot).fontSize, cs(rot).fontWeight, cs(rot).textTransform, rot.getBoundingClientRect().height],
      gapGrupo: cs(fita).columnGap, doisCartoes,
      rolagem: document.querySelector('.kb-trilho-janela').scrollWidth > document.querySelector('.kb-trilho-janela').clientWidth
        && cs(document.querySelector('.kb-trilho-janela')).overflowX !== 'hidden',
    }
  })
  conta(tr.dias[0] === 'Atrasado' && tr.dias[1] === 'Hoje' && tr.dias[2] === 'Amanhã', `${T}: grupos por data em ordem (${tr.dias.slice(0,4).join(', ')})`)
  conta(igual(tr.w, 156) && igual(tr.h, 104), `${T}: cartão do trilho fechado 156x104 (${tr.w}x${tr.h})`)
  /* 1.5px vira 1px na tela de densidade 1, no wireframe e no sistema igual */
  conta(['1px', '1.5px'].includes(tr.borda) && tr.raio === '14px' && tr.pad === '12px', `${T}: borda 1.5, raio 14, recheio 12 (${tr.borda} ${tr.raio} ${tr.pad})`)
  conta(tr.num.join(' ') === '12.5px 700' && tr.prazo.join(' ') === '11.5px 600' && tr.nome.join(' ') === '13.5px 600',
    `${T}: fontes do cartão do trilho 12.5/700, 11.5/600, 13.5/600`)
  conta(tr.pe[0] === '11.5px' && igual(tr.pe[1], 16), `${T}: pé do cartão 11.5 em 16 de altura`)
  conta(tr.rot.join(' ') === '11px 700 uppercase 14', `${T}: rótulo do dia 11/700 maiúsculo em 14 (${tr.rot.join(' ')})`)
  conta(tr.gapGrupo === '16px' && igual(tr.doisCartoes, 8), `${T}: 16 entre datas e 8 entre cartões (${tr.gapGrupo}, ${tr.doisCartoes})`)
  conta(!tr.rolagem, `${T}: o trilho não tem barra de rolagem`)

  /* ---------- 3. o quadro ---------- */
  const q = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const topo = document.querySelector('.kb-postos-topo')
    const cols = [...document.querySelectorAll('.kb-coluna')]
    const quadro = document.querySelector('.kb-quadro').getBoundingClientRect()
    const vis = cols.filter(c => { const r = c.getBoundingClientRect(); return r.left >= quadro.left - 1 && r.right <= quadro.right + 1 })
    const h = cols[0].querySelector('.kb-topo')
    const pil = h.querySelector('.kb-topo-nome')
    const n = h.querySelector('.kb-conta')
    const card = document.querySelector('.kb-cartao')
    const tag = document.querySelector('.kb-tag')
    const bt = document.querySelector('.kb-terminei')
    return {
      topoH: topo.getBoundingClientRect().height, h2: [cs(topo.querySelector('h2')).fontSize, cs(topo.querySelector('h2')).fontWeight],
      faixa: cs(topo.querySelector('.kb-faixa')).fontSize,
      visiveis: vis.length, largura: vis[0]?.getBoundingClientRect().width, quadroW: quadro.width,
      vao: vis[1].getBoundingClientRect().left - vis[0].getBoundingClientRect().right,
      bordas: [vis[0].getBoundingClientRect().left - quadro.left, quadro.right - vis[vis.length - 1].getBoundingClientRect().right],
      cab: [cs(h).paddingTop, cs(h).paddingRight, cs(h).paddingBottom, cs(h).borderBottomWidth],
      pil: [cs(pil).fontSize, cs(pil).fontWeight, cs(pil).paddingTop, cs(pil).paddingLeft],
      conta: [cs(n).fontSize, cs(n).fontWeight, cs(n).paddingTop, cs(n).paddingLeft],
      card: [cs(card).paddingTop, cs(card).borderTopWidth, cs(card).borderTopLeftRadius, cs(card).rowGap],
      av: card.querySelector('.kb-avatar').getBoundingClientRect().width,
      nome: [cs(card.querySelector('.kb-nome')).fontSize, cs(card.querySelector('.kb-nome')).fontWeight],
      origem: [cs(card.querySelector('.kb-origem')).fontSize, cs(card.querySelector('.kb-origem')).fontWeight],
      pe: cs(card.querySelector('.kb-pe')).fontSize, pecas: [cs(card.querySelector('.kb-pecas')).fontSize, cs(card.querySelector('.kb-pecas')).fontWeight],
      tag: tag ? [cs(tag).fontSize, cs(tag).paddingTop, cs(tag).paddingLeft] : null,
      bt: [bt.getBoundingClientRect().width, bt.getBoundingClientRect().height, cs(bt).borderTopLeftRadius],
    }
  })
  conta(igual(q.topoH, 44) && q.h2.join(' ') === '15px 600' && q.faixa === '13px', `${T}: barra dos postos 44, título 15/600, faixa 13`)
  conta(q.visiveis === 7, `${T}: sete colunas à vista em 1080p (${q.visiveis})`)
  conta(Math.abs(q.largura - (q.quadroW - 72) / 7) < 0.6 && q.largura > 217, `${T}: sete colunas iguais de ~219 (${q.largura?.toFixed(1)})`)
  conta(igual(q.vao, 12) && q.bordas.every(b => Math.abs(b) < 1), `${T}: 12 entre colunas, encostando nas duas bordas (${q.vao}, ${q.bordas})`)
  conta(q.cab.join(' ') === '10px 2px 12px 2px', `${T}: cabeçalho da coluna 10 2 12 com filete de 2 (${q.cab.join(' ')})`)
  conta(q.pil.join(' ') === '12.5px 700 4px 10px', `${T}: pílula do posto 12.5/700, 4 10 (${q.pil.join(' ')})`)
  conta(q.conta.join(' ') === '12px 600 2px 8px', `${T}: contador 12/600, 2 8`)
  conta(q.card.join(' ') === '14px 2px 14px 8px', `${T}: cartão com recheio 14, borda 2, raio 14, vão 8 (${q.card.join(' ')})`)
  conta(q.av === 28 && q.nome.join(' ') === '14.5px 600' && q.origem.join(' ') === '11.5px 600',
    `${T}: bolinha 28, nome 14.5/600, origem 11.5/600`)
  conta(q.pe === '12.5px' && q.pecas.join(' ') === '13px 700', `${T}: pé 12.5, peças 13/700`)
  conta(!!q.tag && q.tag.join(' ') === '11.5px 3px 9px', `${T}: tag do posto 11.5 com 3 9 (${q.tag?.join(' ')})`)
  conta(q.bt[0] === 32 && q.bt[1] === 32 && q.bt[2] === '7px', `${T}: seta do Terminei 32x32 raio 7`)

  await pg.screenshot({ path: `${PASTA}/wf-quadro-${T}.png` })

  /* ---------- 4. a sanfona ---------- */
  await pg.evaluate(() => {
    const c = [...document.querySelectorAll('.kb-tr')].find(x => x.textContent.includes('PD-0405'))
    c.querySelector('.kb-tr-bt').click()
  })
  await pg.waitForTimeout(700)
  const s = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const c = document.querySelector('.kb-tr.aberto')
    const g = c.querySelector('.kb-tr-grafico')
    const postos = [...c.querySelectorAll('.kb-gm-posto')]
    const linhas = [...c.querySelectorAll('.kb-gm-linha:not(.kb-gm-eixo)')]
    const outros = [...document.querySelectorAll('.kb-tr')].filter(x => x !== c)
    const escuros = [...document.querySelectorAll('.kb-cartao.escuro')]
    const apagados = [...document.querySelectorAll('.kb-cartao.apagado')]
    const r = g.getBoundingClientRect(); const cr = c.getBoundingClientRect()
    return {
      w: cr.width, fundo: cs(c).backgroundColor, texto: cs(c).color,
      gMargem: [cs(g).marginTop, cs(g).paddingLeft, cs(g).borderLeftWidth],
      postos: postos.map(p => p.textContent), pFonte: postos[0] ? [cs(postos[0]).fontSize, cs(postos[0]).fontWeight, postos[0].getBoundingClientRect().height] : null,
      pCor: postos[0] ? cs(postos[0]).backgroundColor : '',
      linhas: linhas.length, rotFonte: linhas[0] ? cs(linhas[0].querySelector('.kb-gm-rot')).fontSize : '',
      cabeDentro: r.bottom <= cr.bottom && r.top >= cr.top,
      aqui: c.querySelectorAll('.kb-gm-ponto.aqui').length,
      outrosOp: outros.map(o => cs(o).opacity),
      escuros: escuros.length, escuroFundo: escuros[0] ? cs(escuros[0]).backgroundColor : '',
      apagadoOp: apagados[0] ? cs(apagados[0]).opacity : '',
      chip: document.querySelector('.kb-aceso')?.textContent ?? '',
      escurosVisiveis: escuros.filter(e => { const q = document.querySelector('.kb-quadro').getBoundingClientRect(); const x = e.getBoundingClientRect(); return x.left >= q.left && x.right <= q.right }).length,
    }
  })
  conta(igual(s.w, 580), `${T}: a sanfona abre para 580 (${s.w})`)
  conta(s.fundo === (T === 'light' ? 'rgb(34, 37, 43)' : 'rgb(52, 56, 64)') && s.texto === 'rgb(255, 255, 255)',
    `${T}: a sanfona tem o fundo do cartão escolhido (${s.fundo})`)
  conta(s.gMargem.join(' ') === '12px 12px 1px', `${T}: gráfico com margem 12, recheio 12 e linha de 1 (${s.gMargem.join(' ')})`)
  conta(s.postos.join(',') === 'Corte,Subli,DTF,Prensa,Calan.,Conf.,C.cost,Cost.,Emb.,Fim', `${T}: um rótulo por posto, na ordem do quadro (${s.postos.join(',')})`)
  conta(!!s.pFonte && s.pFonte.join(' ') === '9px 700 15', `${T}: rótulo do posto 9/700 em 15 (${s.pFonte?.join(' ')})`)
  conta(!/rgba?\(0, 0, 0, 0\)/.test(s.pCor), `${T}: o rótulo do posto é colorido (${s.pCor})`)
  conta(s.linhas === 4 && s.rotFonte === '10px', `${T}: um gráfico só, uma linha por layout (${s.linhas}), rótulo 10`)
  conta(s.aqui === 4, `${T}: os quatro layouts têm o ponto de onde estão`)
  conta(s.cabeDentro, `${T}: o gráfico cabe dentro do cartão`)
  conta(s.outrosOp.every(o => o === '0.45'), `${T}: os outros pedidos do trilho apagam para 0.45`)
  conta(s.escuros === 2 && s.escuroFundo === s.fundo, `${T}: os 2 cartões do pedido ficam escuros no quadro (${s.escuros})`)
  conta(s.apagadoOp === '0.28', `${T}: os outros cartões apagam para 0.28`)
  conta(s.escurosVisiveis >= 1, `${T}: o quadro mostra os cartões do pedido aberto`)
  conta(/Acesos: PD-0405 · 2 cartões/.test(s.chip), `${T}: a pílula diz o que está aceso (${s.chip})`)

  await pg.screenshot({ path: `${PASTA}/wf-sanfona-${T}.png` })

  /* ---------- 5. o pedido inteiro ---------- */
  await pg.evaluate(() => document.querySelector('.kb-tr-abrir').click())
  await pg.waitForTimeout(1500)
  const p = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const d = document.querySelector('dialog[open]')
    const caixa = d.querySelector('.caixa').getBoundingClientRect()
    const topo = d.querySelector('.ca-topo')
    const esq = d.querySelector('.ca-esq').getBoundingClientRect()
    const dir = d.querySelector('.ca-outro').getBoundingClientRect()
    const linha = d.querySelector('.kb-gg-linha:not(.kb-gg-eixo)')
    const L = document.querySelector('.vista').getBoundingClientRect().right
    return {
      caixa: [caixa.left, caixa.top, caixa.width, caixa.height, cs(d.querySelector('.caixa')).borderTopLeftRadius],
      margens: [caixa.left, L - caixa.right],
      topo: [cs(topo).paddingTop, cs(topo).paddingRight, cs(topo).paddingBottom],
      numero: [cs(d.querySelector('.ca-numero')).fontSize, cs(d.querySelector('.ca-numero')).fontWeight],
      nome: [cs(d.querySelector('.ca-nome')).fontSize, cs(d.querySelector('.ca-nome')).fontWeight],
      meta: cs(d.querySelector('.ca-meta')).fontSize,
      fechar: [d.querySelector('.mk-fechar').getBoundingClientRect().width, d.querySelector('.mk-fechar').getBoundingClientRect().height],
      grafico: [cs(d.querySelector('.pi-grafico')).paddingTop, cs(d.querySelector('.pi-grafico')).paddingLeft, cs(d.querySelector('.pi-grafico')).paddingBottom],
      linhaH: linha.getBoundingClientRect().height, rotW: linha.firstElementChild.getBoundingClientRect().width,
      linhas: d.querySelectorAll('.kb-gg-linha:not(.kb-gg-eixo)').length,
      metades: [esq.width, dir.width], lrs: [d.querySelectorAll('.ca-esq .lr').length, d.querySelectorAll('.ca-outro .lr').length],
      col: [cs(d.querySelector('.ca-esq')).paddingTop, cs(d.querySelector('.ca-esq')).paddingLeft, cs(d.querySelector('.ca-esq')).rowGap],
    }
  })
  conta(p.margens.every(m => igual(m, 40)) && igual(p.caixa[1], 32) && igual(p.caixa[3], 1016) && p.caixa[4] === '18px',
    `${T}: o modal tem 40 dos lados, 32 em cima, 1016 de altura e raio 18 (${p.margens.map(Math.round)} ${Math.round(p.caixa[1])} ${Math.round(p.caixa[3])})`)
  conta(p.topo.join(' ') === '22px 32px 18px', `${T}: cabeçalho com 22 32 18 (${p.topo.join(' ')})`)
  conta(p.numero.join(' ') === '24px 700' && p.nome.join(' ') === '24px 400' && p.meta === '13.5px', `${T}: título 24/700 e 24/400, linha de dados 13.5`)
  conta(p.fechar.join('x') === '44x44', `${T}: fechar 44x44`)
  conta(p.grafico.join(' ') === '20px 32px 24px', `${T}: o gráfico grande com 20 32 24`)
  conta(igual(p.linhaH, 40) && igual(p.rotW, 170) && p.linhas === 4, `${T}: linhas de 40, rótulo de 170, 4 layouts`)
  conta(Math.abs(p.metades[0] - p.metades[1]) <= 1.5 && p.lrs.join(',') === '2,2', `${T}: layouts em duas colunas iguais (${p.metades.map(Math.round)}) ${p.lrs}`)
  conta(p.col.join(' ') === '24px 32px 28px', `${T}: coluna com 24 32 e 28 entre layouts`)
  await pg.screenshot({ path: `${PASTA}/wf-pedido-${T}.png` })

  /* ---------- 6. o layout em leitura ---------- */
  const l = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const lr = document.querySelector('dialog[open] .lr')
    const arte = lr.querySelector('.lr-arte').getBoundingClientRect()
    const grade = lr.querySelector('.lr-grade').getBoundingClientRect()
    return {
      arte: [arte.width, arte.height], grade: grade.width,
      n: [lr.querySelector('.lr-n').getBoundingClientRect().height, cs(lr.querySelector('.lr-n')).fontSize, cs(lr.querySelector('.lr-n')).fontWeight],
      ref: cs(lr.querySelector('.lr-ref')).fontSize,
      linha: [lr.querySelector('.lr-grade-linha').getBoundingClientRect().height, cs(lr.querySelector('.lr-grade-linha')).fontSize],
      total: lr.querySelector('.lr-grade-total').getBoundingClientRect().height,
      rot: [cs(lr.querySelector('.lr-rot')).fontSize, cs(lr.querySelector('.lr-rot')).fontWeight],
      pb: cs(lr).paddingBottom, gap: cs(lr).rowGap, corpoGap: cs(lr.querySelector('.lr-corpo')).columnGap,
    }
  })
  conta(igual(l.arte[0], 340) && igual(l.arte[1], 300) && igual(l.grade, 120), `${T}: arte 340x300 e grade 120 (${l.arte.join('x')}, ${l.grade})`)
  conta(l.n.join(' ') === '30 12.5px 800' && l.ref === '13px', `${T}: L-01 de 30 com 12.5/800, referência 13`)
  conta(l.linha.join(' ') === '34 13.5px' && l.total === 38, `${T}: linha da grade 34 e total 38`)
  conta(l.rot.join(' ') === '11.5px 700', `${T}: rótulos 11.5/700`)
  conta(l.pb === '28px' && l.gap === '16px' && l.corpoGap === '20px', `${T}: 28 embaixo, 16 entre topo e corpo, 20 entre as partes`)

  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(600)

  /* ---------- 7. o cartão aberto ---------- */
  await pg.evaluate(() => {
    const c = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-0405') && x.textContent.includes('Sublimação'))
    c.querySelector('.kb-abrir').click()
  })
  await pg.waitForTimeout(1500)
  const a = await pg.evaluate(() => {
    const cs = (e) => getComputedStyle(e)
    const d = document.querySelector('dialog[open]')
    const esq = d.querySelector('.ca-esq').getBoundingClientRect()
    const dir = d.querySelector('.ca-dir').getBoundingClientRect()
    const cols = [...d.querySelectorAll('.ca-dir-col')].map(c => c.getBoundingClientRect())
    const acao = d.querySelector('.ca-acao')
    const bts = [...d.querySelectorAll('.ca-botoes button')].map(b => b.getBoundingClientRect().height)
    const tags = d.querySelector('.ca-tags')
    return {
      metades: [esq.width, dir.width], subcols: cols.length, vaoSub: cols[1] ? cols[1].left - cols[0].right : 0,
      tags: [cs(tags).paddingTop, cs(tags).paddingLeft],
      mestre: [cs(d.querySelector('.mk-mestre')).height, cs(d.querySelector('.mk-mestre')).fontSize],
      tag: [cs(d.querySelector('.ca-tag')).height, cs(d.querySelector('.ca-tag')).fontSize],
      acao: [cs(acao).paddingTop, cs(acao).borderTopLeftRadius, cs(acao).rowGap],
      bts, busca: [d.querySelector('.ca-busca').getBoundingClientRect().width, d.querySelector('.ca-busca').getBoundingClientRect().height],
      passo: d.querySelector('.ca-passo').getBoundingClientRect().height,
      antigos: d.querySelectorAll('.ca-antigo').length,
    }
  })
  conta(Math.abs(a.metades[0] - a.metades[1]) <= 1.5, `${T}: cartão aberto em duas metades iguais (${a.metades.map(Math.round)})`)
  conta(a.subcols === 2 && igual(a.vaoSub, 32), `${T}: a direita em duas colunas com 32 entre elas`)
  conta(a.tags.join(' ') === '12px 32px', `${T}: linha das tags com 12 32`)
  conta(a.mestre.join(' ') === '26px 11px' && a.tag.join(' ') === '28px 12.5px', `${T}: tag mestre 26/11 e tag do posto 28/12.5`)
  conta(a.acao.join(' ') === '20px 14px 14px', `${T}: bloco da ação com 20, raio 14 e 14 entre as partes`)
  conta(a.bts.length === 2 && a.bts.every(h => h === 44), `${T}: botões da ação com 44`)
  conta(a.busca.join('x') === '340x40', `${T}: busca do comparar 340x40`)
  conta(igual(a.passo, 34), `${T}: passos da rota com 34`)
  await pg.screenshot({ path: `${PASTA}/wf-cartao-${T}.png` })

  await ctx.close()
}

await nav.close()
const ruins = achados.filter(a => !a.certo)
console.log('')
if (ruins.length) {
  console.log(`${ruins.length} de ${achados.length} medidas fora do wireframe`)
  process.exit(1)
}
console.log(`kanban igual ao wireframe: ${achados.length} medidas`)
