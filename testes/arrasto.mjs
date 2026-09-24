/* ==========================================================================
   O TESTE DO ARRASTO DO MARK45.

   Foto nao prova arrasto. Este teste dirige o quadro de verdade com Pointer
   Events, com um banco de mentira que GUARDA o que mudou, e confere quatro
   coisas:

     1. a seta empurra o cartao para o proximo posto DA ROTA dele
     2. arrastar mostra o cartao fantasma e apaga as colunas fora da rota
     3. o quadro rola sozinho quando o dedo fica na beira, ate a coluna de
        destino aparecer, e ai o cartao anda
     4. largar numa coluna fora da rota NAO manda nada para o banco

   Foi ele que achou o buraco: sao treze postos, e o proximo posto da rota
   quase nunca esta na tela. Sem o auto-rolar, arrastar so funcionava para a
   coluna do lado.

   Uso:  node testes/arrasto.mjs
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
const PAGINAS = ['inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban','produtos','estoque','atividades','relatorio','banco','config','kit']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = {ver:true,editar:true,deletar:true,total:true})
const PERFIL = [{ id:'1', nome:'Henrique', papel:'admin', situacao:'aprovado', paineis:PAGINAS, permissoes, email:'t@f', foto_em:null }]
const ROTAS = []
const põe = (t, postos) => postos.forEach((p,i) => ROTAS.push({tecnica:t, ordem:(i+1)*10, posto:p}))
põe('subli', ['subli','calandra','corte','conferencia','cd-costura','costura','embalagem','finalizado'])
põe('dtf', ['corte','dtf','prensa','conferencia','cd-costura','costura','embalagem','finalizado'])
const ha = (d) => new Date(Date.now() - d*86400000).toISOString()
let FATIAS = [
  { id:'1', pedido_id:'p1', numero:'PD-0401', cliente:'Santa Clara', vendedor:'Ana', tecnica:'subli',
    etapa:'subli', etapa_em:ha(0), fechado_em:null, layouts:[1], pecas:180, entrega_em:null,
    aviso:'', estado:'producao', teste:false, nome:'Uniforme Santa Clara',
    marcas:['URGENTE'], tags:['montagem'], pego_por:null, pego_por_nome:'', pego_em:null, falas:0 },
  { id:'2', pedido_id:'p2', numero:'PD-0402', cliente:'Fortize', vendedor:'Ana', tecnica:'dtf',
    etapa:'corte', etapa_em:ha(1), fechado_em:null, layouts:[1], pecas:96, entrega_em:null,
    aviso:'', estado:'producao', teste:false, nome:'Camiseta Fortize',
    marcas:[], tags:[], pego_por:null, pego_por_nome:'', pego_em:null, falas:0 },
]
const TAGS = [
  { chave:'montagem', nome:'montagem', tom:'verde', em_todo_posto:false, ordem:10, ativa:true },
  { chave:'falta_tecido', nome:'falta tecido', tom:'vermelha', em_todo_posto:true, ordem:20, ativa:true },
]
const TAGS_POSTO = [{ tag:'montagem', posto:'dtf' }, { tag:'montagem', posto:'subli' }]
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' })
let patches = []
await ctx.route('**supabase.co/**', async (r) => {
  const req = r.request(); const u = req.url()
  if (req.method() === 'PATCH' && u.includes('/fatia?')) {
    const id = decodeURIComponent(u.split('id=eq.')[1].split('&')[0])
    const corpo = JSON.parse(req.postData() || '{}')
    patches.push({ id, etapa: corpo.etapa })
    const f = FATIAS.find(x => x.id === id)
    if (f) { f.etapa = corpo.etapa; f.etapa_em = new Date().toISOString() }
    return r.fulfill({ status:204, headers:{'access-control-allow-origin':'*'}, body:'' })
  }
  /* A CONFERENCIA DO TERMINEI VEM DO BANCO, entao o banco de mentira responde
     ela: e o mesmo formato que conferir_a_saida devolve, com um item de cada
     tom, para o teste ver os tres desenhados. */
  let corpo = []
  if (u.includes('rpc/conferir_a_saida')) {
    const id = JSON.parse(req.postData() || '{}').p_fatia
    const f = FATIAS.find(x => x.id === id)
    const rota = ROTAS.filter(r => r.tecnica === f.tecnica).sort((a,b)=>a.ordem-b.ordem).map(r=>r.posto)
    corpo = {
      fatia:id, numero:f.numero, posto:f.etapa,
      proximo: rota[rota.indexOf(f.etapa)+1] ?? null,
      itens:[
        { tom:'ok', titulo:'O material saiu da prateleira', linha:'tudo baixado' },
        { tom:'atencao', titulo:'Tag ainda posta: montagem', linha:'tire antes de mandar' },
        { tom:'nota', titulo:'Este pedido tem mais 1 cartao aberto', linha:'so fecha com o ultimo' },
      ],
      pode:true,
    }
  }
  else if (u.includes('meu_perfil')) corpo = PERFIL
  else if (u.includes('fatia_na_fabrica')) corpo = FATIAS
  else if (u.includes('tag_do_posto')) corpo = TAGS_POSTO
  else if (u.includes('/tag?')) corpo = TAGS
  else if (u.includes('rota_da_tecnica')) corpo = ROTAS
  return r.fulfill({ status:200, contentType:'application/json',
    headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
})
await ctx.addInitScript(([c])=>{ try{ localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema','light') }catch{} },
  [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }])
const pg = await ctx.newPage()
await pg.goto(SITE + '/kanban', { waitUntil:'networkidle' })
await pg.waitForTimeout(1200)

const onde = async (numero) => pg.evaluate((n) => {
  const c = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes(n))
  return c ? c.closest('[data-posto]').dataset.posto : null
}, numero)

console.log('antes:', 'PD-0401 em', await onde('PD-0401'))

// ---- 1. o Terminei empurra para o proximo posto da rota, com confirmacao ----
// O TERMINEI NUNCA E UM TOQUE SO: ele abre a conferencia, e so o segundo
// toque move o cartao. O teste confere as duas coisas, porque um Terminei que
// move direto seria o desenho de 22/09 desfeito sem ninguem notar.
await pg.evaluate(() => {
  const c = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-0402'))
  /* O BOTAO NAO TEM MAIS TEXTO: desde 24/09 ele e quadrado e so com a seta, e
     procurar por "Terminei" acharia nada. A classe e o que sobrou de estavel. */
  c.querySelector('.kb-terminei').click()
})
await pg.waitForTimeout(700)
const semConfirmar = await onde('PD-0402')
const conferencia = await pg.evaluate(() => {
  const d = document.querySelector('dialog[open]')
  if (!d) return { aberto:false }
  return {
    aberto: true,
    ok: d.querySelectorAll('.cs-ok').length,
    atencao: d.querySelectorAll('.cs-atencao').length,
    nota: d.querySelectorAll('.cs-nota').length,
    botao: [...d.querySelectorAll('button')].map(b => b.textContent.trim()).join(' | '),
  }
})
console.log('terminei: abriu a conferencia =', conferencia.aberto,
  '| ok', conferencia.ok, 'atencao', conferencia.atencao, 'nota', conferencia.nota)
console.log('terminei: o cartao NAO andou antes de confirmar =', semConfirmar === 'corte')
await pg.evaluate(() => {
  const d = document.querySelector('dialog[open]')
  ;[...d.querySelectorAll('button')].find(b => /Terminar assim mesmo|Sim, terminei/.test(b.textContent)).click()
})
await pg.waitForTimeout(900)
console.log('seta:   PD-0402 foi para', await onde('PD-0402'), '| esperado dtf')

// ---- 2. arrastar para uma coluna DA ROTA ----
const cartao = await pg.evaluateHandle(() =>
  [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-0401')))
const cx = await cartao.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x + r.width/2, r.y + 20] })
const alvo = await pg.evaluate(() => {
  const col = document.querySelector('[data-posto="calandra"]')
  const r = col.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]
})
await pg.mouse.move(cx[0], cx[1])
await pg.mouse.down()
await pg.mouse.move(cx[0]+30, cx[1]+10, {steps:4})
const fantasma = await pg.evaluate(() => !!document.querySelector('.kb-fantasma'))
const apagadas = await pg.evaluate(() => document.querySelectorAll('.kb-coluna.fora').length)
// segura o dedo na beira direita e espera o quadro rolar sozinho ate a coluna aparecer
const beira = await pg.evaluate(() => {
  const r = document.querySelector('.kb-quadro').getBoundingClientRect()
  return [r.right - 20, r.top + r.height/2]
})
await pg.mouse.move(beira[0], beira[1], {steps:6})
let achou = false
for (let i = 0; i < 40 && !achou; i++) {
  await pg.waitForTimeout(100)
  achou = await pg.evaluate(() => {
    const col = document.querySelector('[data-posto="calandra"]')
    const r = col.getBoundingClientRect()
    return r.left > 0 && r.right < window.innerWidth
  })
}
console.log('auto-rolar: a calandra entrou na tela sozinha =', achou)
const destino = await pg.evaluate(() => {
  const r = document.querySelector('[data-posto="calandra"]').getBoundingClientRect()
  return [r.x + r.width/2, r.y + r.height/2]
})
await pg.mouse.move(destino[0], destino[1], {steps:6})
await pg.waitForTimeout(200)
const marcouAlvo = await pg.evaluate(() => !!document.querySelector('.kb-coluna.alvo'))
await pg.mouse.up()
await pg.waitForTimeout(900)
console.log('arrasto: fantasma apareceu =', fantasma, '| colunas fora da rota apagadas =', apagadas,
            '| coluna alvo acesa =', marcouAlvo)
console.log('arrasto: PD-0401 foi para', await onde('PD-0401'), '| esperado calandra')

// ---- 3. arrastar para uma coluna FORA da rota nao move ----
const c2 = await pg.evaluate(() => {
  const el = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-0402'))
  const r = el.getBoundingClientRect(); return [r.x + r.width/2, r.y + 20]
})
const fora = await pg.evaluate(() => {
  const col = document.querySelector('[data-posto="silk"]')
  const r = col.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]
})
await pg.mouse.move(c2[0], c2[1]); await pg.mouse.down()
await pg.mouse.move(fora[0], fora[1], {steps:10}); await pg.mouse.up()
await pg.waitForTimeout(900)
console.log('fora da rota: PD-0401 continua em', await onde('PD-0401'), '| esperado calandra')
console.log('patches enviados ao banco:', JSON.stringify(patches))
await nav.close()
