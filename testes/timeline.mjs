/* ==========================================================================
   O TESTE DO MODAL DA TIMELINE, no painel de atividades.

   Ele confere o que só aparece olhando: o botão na linha, a rota desenhada em
   degraus, o degrau de agora em destaque, o que já andou apagado e não sumido,
   e a tarja vermelha na fatia que está segurando o pedido. Em três larguras e
   nos dois temas.

   O QUE ELE MEDE, e não o que ele mostra:

     1. em nenhuma largura a página rola de lado
     2. o botão da timeline existe na linha e tem 44px no toque
     3. o modal desenha uma seção por fatia, com a rota inteira em degraus
     4. exatamente um degrau por fatia está marcado como "agora"
     5. o degrau de agora diz há quanto tempo a fatia está ali
     6. a fatia mais longe do fim da rota leva a tarja de "segura o pedido"
     7. o pedido sem fatia nenhuma explica que ainda não desceu para o quadro

   A regra do item 6 é a de 21/09: a fatia que segura é a mais longe do fim da
   rota DELA, e não a que está no posto de nome mais atrasado. No cenário do
   teste, a subli está em Calandra (faltam 5 postos de 8) e a DTF está em Corte
   (faltam 7 de 8), então quem segura é a DTF. Um teste que só olhasse o nome
   do posto passaria com a conta errada.

   Uso:  node testes/timeline.mjs
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
const põe = (t, postos) => postos.forEach((p,i) => ROTAS.push({tecnica:t, ordem:(i+1)*10, posto:p}))
põe('subli', ['subli','calandra','futurize','conferencia','cd-costura','costura','embalagem','finalizado'])
põe('dtf', ['corte','dtf','prensa','conferencia','cd-costura','costura','embalagem','finalizado'])

const ha = (d) => new Date(Date.now() - d*86400000).toISOString()
const dia = (d) => new Date(Date.now() - d*86400000).toISOString().slice(0,10)

/* HOJE, E NAO UMA DATA ESCRITA NA MAO. O painel monta a semana a partir do dia
   de hoje, entao um pedido com data fixa sai da semana assim que o calendario
   anda e o teste passa a reprovar por envelhecer, e nao por quebrar. */
const hoje = new Date()
const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7))
const planejado = segunda.toISOString().slice(0,10)

const PEDIDOS = [
  { id:'p1', numero:'PD-TESTE-0029', cliente:'Drogaria Viver Bem', vendedor:'Dani',
    departamento:'Uniformes', etapa:'corte', etapa_em:ha(4), entrega_em:dia(-6),
    planejado_em:planejado, planejamento_manual:true, aviso:'', pecas:299, layouts:3,
    tecnicas:['subli','dtf'], total:0, pecas_subli:180, pecas_personalizadas:119,
    valor_subli:0, valor_personalizado:0, fechado_em:null, teste:true, cotacao_id:'c1',
    tag:'Corte', fatias_abertas:'subli:calandra, dtf:corte' },
  { id:'p2', numero:'PD-TESTE-0057', cliente:'Igreja Araguaia', vendedor:'Lucas',
    departamento:'Eventos', etapa:'corte', etapa_em:ha(1), entrega_em:dia(-9),
    planejado_em:planejado, planejamento_manual:true, aviso:'', pecas:160, layouts:1,
    tecnicas:[], total:0, pecas_subli:0, pecas_personalizadas:160,
    valor_subli:0, valor_personalizado:0, fechado_em:null, teste:true, cotacao_id:'c2',
    tag:'', fatias_abertas:'' },
]

/* As fatias do PD-TESTE-0029. A subli ja andou um posto, a DTF nao saiu do
   primeiro: e a DTF que segura. */
const FATIAS = [
  { id:'f1', pedido_id:'p1', numero:'PD-TESTE-0029', nome:'Uniforme Equipe Verão',
    cliente:'Drogaria Viver Bem', vendedor:'Dani', tecnica:'subli', etapa:'calandra',
    etapa_em:ha(1), fechado_em:null, layouts:[1,2], pecas:180, entrega_em:dia(-6),
    aviso:'', estado:'producao', teste:true, marcas:['VIP'], tags:[],
    pego_por:null, pego_por_nome:'', pego_em:null, falas:0 },
  { id:'f2', pedido_id:'p1', numero:'PD-TESTE-0029', nome:'Uniforme Equipe Verão',
    cliente:'Drogaria Viver Bem', vendedor:'Dani', tecnica:'dtf', etapa:'corte',
    etapa_em:ha(4), fechado_em:null, layouts:[3], pecas:119, entrega_em:dia(-6),
    aviso:'falta-material', estado:'producao', teste:true, marcas:['VIP'], tags:['falta_tecido'],
    pego_por:null, pego_por_nome:'', pego_em:null, falas:0 },
]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440,900,'computador'], [768,1024,'tablet'], [390,844,'celular']]) {
    /* hasTouch liga o `pointer: coarse` do CSS, que e o que faz o alvo de
       toque crescer. Sem ele o teste mediria o botao de mouse e reprovaria a
       regra dos 44px por medir a tela errada. */
    const ctx = await nav.newContext({
      viewport:{width:larg,height:alt}, reducedMotion:'reduce', hasTouch: nome !== 'computador',
    })
    await ctx.route('**supabase.co/**', async (r) => {
      const u = r.request().url()
      let corpo = []
      if (u.includes('meu_perfil')) corpo = PERFIL
      /* fatia_na_fabrica com pedido_id e o modal; sem ele seria o quadro */
      else if (u.includes('fatia_na_fabrica')) corpo = u.includes('pedido_id=eq.p1') ? FATIAS : []
      else if (u.includes('rota_da_tecnica')) corpo = ROTAS
      else if (u.includes('pedido_na_fabrica')) corpo = PEDIDOS
      return r.fulfill({ status:200, contentType:'application/json',
        headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
    })
    await ctx.addInitScript(([c, t])=>{ try{
      localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
    }catch{} }, [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }, tema])

    const pg = await ctx.newPage()
    await pg.goto(SITE + '/atividades', { waitUntil:'networkidle' })
    await pg.waitForTimeout(1400)

    /* 1. a pagina nao rola de lado */
    const largura = await pg.evaluate(() => ({
      rola: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth,
    }))
    conta(!largura.rola, `${tema} ${nome}: painel sem rolagem de lado (${largura.s} em ${largura.c})`)

    /* 2. o botao existe na linha, e tem alvo de toque no celular */
    const botao = await pg.evaluate(() => {
      const l = [...document.querySelectorAll('.at-linha')].find(x => x.textContent.includes('PD-TESTE-0029'))
      if (!l) return null
      const b = l.querySelector('.at-timeline')
      if (!b) return { existe:false }
      const c = b.getBoundingClientRect()
      return { existe:true, alt: Math.round(c.height), larg: Math.round(c.width) }
    })
    conta(!!botao?.existe, `${tema} ${nome}: a linha tem o botão da timeline`)
    /* O ALVO DE TOQUE SO VALE ONDE HA DEDO. O celular e o tablet do galpao sao
       ponteiro grosso; o computador tem mouse, e 44px ali seria um botao de
       icone gordo no meio de uma tabela densa. */
    if (nome !== 'computador') {
      conta(!!botao && botao.alt >= 44 && botao.larg >= 44,
        `${tema} ${nome}: o botão tem alvo de toque de 44px (${botao?.larg}x${botao?.alt})`)
    }

    await pg.screenshot({ path: `${PASTA}/painel-${tema}-${nome}.png`, fullPage:false })

    /* ---- o modal ---- */
    await pg.evaluate(() => {
      const l = [...document.querySelectorAll('.at-linha')].find(x => x.textContent.includes('PD-TESTE-0029'))
      l.querySelector('.at-timeline').click()
    })
    await pg.waitForTimeout(1500)

    const m = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      if (!d) return null
      const fatias = [...d.querySelectorAll('.tl-fatia')].map(f => ({
        tecnica: f.querySelector('.tec')?.textContent.trim() ?? '',
        layouts: f.querySelector('.tl-lay')?.textContent.trim() ?? '',
        passos: f.querySelectorAll('.tl-passo').length,
        agora: [...f.querySelectorAll('.tl-passo.agora')].map(p => ({
          posto: p.querySelector('.tl-posto')?.textContent.trim() ?? '',
          quando: p.querySelector('.tl-quando')?.textContent.trim() ?? '',
        })),
        andou: f.querySelectorAll('.tl-passo.andou').length,
        falta: f.querySelectorAll('.tl-passo.falta').length,
        segura: f.classList.contains('segura'),
        pe: f.querySelector('.tl-pe')?.textContent.trim() ?? '',
      }))
      return { fatias, rolaDeLado: d.scrollWidth > d.clientWidth + 1 }
    })

    conta(!!m && m.fatias.length === 2, `${tema} ${nome}: o modal traz as 2 fatias do pedido`)
    conta(!!m && m.fatias.every(f => f.passos === 8),
      `${tema} ${nome}: cada fatia desenha a rota inteira em degraus (${m?.fatias.map(f=>f.passos).join(' e ')})`)
    conta(!!m && m.fatias.every(f => f.agora.length === 1),
      `${tema} ${nome}: exatamente um degrau de cada fatia é o de agora`)
    conta(!!m && m.fatias.every(f => /há \d+ dia|chegou hoje/.test(f.agora[0]?.quando ?? '')),
      `${tema} ${nome}: o degrau de agora diz há quanto tempo (${m?.fatias.map(f=>f.agora[0]?.quando).join(' / ')})`)
    /* o que andou continua desenhado, apagado: a rota inteira e o que
       responde quanto falta */
    conta(!!m && m.fatias.some(f => f.andou > 0) && m.fatias.every(f => f.andou + f.agora.length + f.falta === f.passos),
      `${tema} ${nome}: o que já andou fica apagado e não some`)
    /* A DTF esta em Corte, 7 postos do fim; a subli em Calandra, 5 do fim */
    const segurando = m?.fatias.filter(f => f.segura) ?? []
    conta(segurando.length === 1 && /DTF/i.test(segurando[0]?.tecnica ?? ''),
      `${tema} ${nome}: quem segura o pedido é a fatia mais longe do fim (${segurando[0]?.tecnica})`)
    conta(!!m && m.fatias.some(f => f.layouts.includes('L-01')),
      `${tema} ${nome}: cada fatia diz quais layouts estão dentro dela`)
    conta(!!m && !m.rolaDeLado, `${tema} ${nome}: o modal não rola de lado`)

    await pg.screenshot({ path: `${PASTA}/timeline-${tema}-${nome}.png`, fullPage:false })

    /* ---- o pedido que nunca desceu para o quadro ---- */
    await pg.keyboard.press('Escape')
    await pg.waitForTimeout(600)
    await pg.evaluate(() => {
      const l = [...document.querySelectorAll('.at-linha')].find(x => x.textContent.includes('PD-TESTE-0057'))
      l.querySelector('.at-timeline').click()
    })
    await pg.waitForTimeout(1200)
    const vazio = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      return d ? { fatias: d.querySelectorAll('.tl-fatia').length, texto: d.textContent } : null
    })
    conta(!!vazio && vazio.fatias === 0 && /ainda não desceu/.test(vazio.texto),
      `${tema} ${nome}: pedido sem fatia explica que não desceu para o quadro`)

    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter(a => !a.certo)
console.log('\nfotos em ' + PASTA + '/')
if (ruins.length) {
  console.log('\ntimeline REPROVOU: ' + ruins.length + ' de ' + achados.length)
  ruins.forEach(a => console.log('  - ' + a.texto))
  process.exit(1)
}
console.log('timeline ok: ' + achados.length + ' medidas, todas passaram')
