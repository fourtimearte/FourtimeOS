/* ==========================================================================
   O TESTE DO FUNIL.

   Ele confere o que so aparece olhando: a faixa da janela de 24 horas nos tres
   estados, o botao certo conforme o lead ja tem cliente ou nao, e o caminho de
   criar cliente indo parar na lista com a ficha aberta. Em tres larguras e nos
   dois temas.

   O QUE ELE MEDE, e nao o que ele mostra:

     1. em nenhuma largura a pagina rola de lado
     2. lead sem fala de cliente NAO desenha faixa de janela
     3. janela aberta diz quanto falta; apertada e fechada mudam de cor
     4. lead sem cliente mostra "Cadastrar cliente"; com cliente, "Ver cliente"
     5. cadastrar cliente acha o cadastro parecido e liga o lead a ele, ou abre
        a ficha ja preenchida e grava pelo lead_vira_cliente (067); depois,
        "Ver cliente" leva para /clientes?abrir=
     6. o parametro sai da barra depois de abrir, senao a ficha nao fecha

   O item 6 e o que mais importa e o menos obvio: sem tirar o parametro, fechar
   a ficha e o React redesenhar reabre a mesma ficha, e a pessoa fica presa num
   modal que nao fecha.

   Uso:  node testes/funil.mjs
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

const daqui = (min) => new Date(Date.now() + min*60000).toISOString()
const atras = (min) => new Date(Date.now() - min*60000).toISOString()

/* Quatro leads, um por estado da janela, mais um que ja tem cliente. */
const LEADS = [
  { id:'L1', nome:'Futsal Vila Nova', contato:'Rafa', telefone:'62999990001', cliente_id:null,
    estagio:'novo', valor:1620, vendedor_id:null, ultima_msg:'Boa tarde, quanto fica 18 camisas?',
    ultima_msg_em:atras(30), nao_lidas:2, janela_ate:daqui(1380), teste:true, origem:'site-chat', prioridade:true, email:'rafa@futsal.exemplo', consentimento_em:atras(40), consentimento_texto:'politica-2026-09', briefing:{ tipo_peca:'kit_camiseta_short', quantidade_faixa:'50_100', prazo:'urgente', detalhe:'<b>logo</b> nas costas', produto:{ titulo:'Camiseta Raglan', url:'https://fourtimefit.com.br/products/raglan' }, utm:{ source:'instagram', campaign:'outubro' }, envio_numero:1 },
    equipe:null, cotacao:[], pedido:[] },
  { id:'L2', nome:'Supermercado Bom Preço', contato:'Ana', telefone:'62999990002', cliente_id:null,
    estagio:'atendimento', valor:2800, vendedor_id:null, ultima_msg:'Pode ser 40 camisetas polo',
    ultima_msg_em:atras(90), nao_lidas:0, janela_ate:daqui(45), teste:true,
    equipe:null, cotacao:[], pedido:[] },
  { id:'L3', nome:'Vôlei Clube Araras', contato:'Bia', telefone:'62999990003', cliente_id:'C9',
    estagio:'cotacao', valor:1860, vendedor_id:null, ultima_msg:'Recebi a cotação, vou mostrar',
    ultima_msg_em:atras(2880), nao_lidas:0, janela_ate:atras(1440), teste:true,
    equipe:{nome:'Dani Ribeiro'}, cotacao:[{id:'c0', numero:'CO2026-0003', criada_em:atras(5000)}, {id:'c1', numero:'CO2026-0007', criada_em:atras(100)}], pedido:[] },
  { id:'L4', nome:'Studio Pilates Flor', contato:'Flor', telefone:'62999990004', cliente_id:null,
    estagio:'negociando', valor:2400, vendedor_id:null, ultima_msg:'Vi o trabalho de vocês',
    ultima_msg_em:atras(120), nao_lidas:1, janela_ate:null, teste:true,
    equipe:null, cotacao:[], pedido:[] },
]

const DONOS = [
  { id:'P1', nome:'Dani Ribeiro' },
  { id:'P2', nome:'Lucas Garcia' },
]

const CLIENTES = [
  { id:'C9', nome:'Vôlei Clube Araras', fantasia:'', tipo:'J', documento:'', contato:'Bia',
    celular:'62999990003', telefone:'', email:'', cep:'', endereco:'', numero:'', bairro:'',
    cidade:'Goiânia', uf:'GO', tipo_de_contato:[], observacao:'', vendedor_id:null,
    criado_em:atras(9000), atualizado_em:atras(9000), teste:true },
  { id:'C7', nome:'Studio Pilates Flor', fantasia:'', tipo:'J', documento:'', contato:'Flor',
    celular:'62999990004', telefone:'', email:'', cep:'', endereco:'', numero:'', bairro:'',
    cidade:'Goiânia', uf:'GO', tipo_de_contato:[], observacao:'', vendedor_id:null,
    criado_em:atras(10), atualizado_em:atras(10), teste:true },
]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440,900,'computador'], [768,1024,'tablet'], [390,844,'celular']]) {
    const ctx = await nav.newContext({
      viewport:{width:larg,height:alt}, reducedMotion:'reduce', hasTouch: nome !== 'computador',
    })
    let chamouVirar = null
    let ligado = false
    let gravou = null
    let leituras = 0
    let cotacaoGravada = null
    await ctx.route('**supabase.co/**', async (r) => {
      const req = r.request(); const u = req.url(); const m = req.method()
      let corpo = []
      if (u.includes('meu_perfil')) corpo = PERFIL
      /* A RPC VEM ANTES. A url dela e rpc/lead_vira_cliente, e um teste que
         casasse por '/lead' engoliria a chamada da funcao junto com a gravacao
         da tabela: foi o que aconteceu na primeira rodada. */
      else if (u.includes('rpc/lead_vira_cliente')) {
        try { chamouVirar = JSON.parse(req.postData() || '{}') } catch { chamouVirar = {} }
        ligado = true
        corpo = { id:'C7' }
      }
      else if (u.includes('/equipe?')) corpo = DONOS
      else if (/\/rest\/v1\/cotacao(\?|$)/.test(u) && m === 'POST') {
        try { cotacaoGravada = JSON.parse(req.postData() || 'null') } catch { cotacaoGravada = 'corpo ilegivel' }
        corpo = []
      }
      else if (u.includes('/lead') && (m === 'POST' || m === 'PATCH')) {
        try { gravou = JSON.parse(req.postData() || 'null') } catch { gravou = 'corpo ilegivel' }
        corpo = [{ id:'L9' }]
      }
      else if (u.includes('/lead?')) {
        leituras++
        /* depois de cadastrar, o Studio Pilates Flor (L4) fica ligado ao C7 */
        corpo = ligado ? LEADS.map(x => x.id === 'L4' ? { ...x, cliente_id:'C7' } : x) : LEADS
      }
      else if (u.includes('/mensagem?') && u.includes('lead_id=eq.L1')) corpo = [
        { id:'s1', quem:'cliente', tipo:'texto', texto:'Quero um orçamento', arquivo:'', nome_do_arquivo:'', situacao:'', em:atras(45), canal:'site' },
        { id:'s2', quem:'sistema', tipo:'texto', texto:'Ótimo! Qual peça?', arquivo:'', nome_do_arquivo:'', situacao:'', em:atras(44), canal:'site' },
        { id:'s3', quem:'cliente', tipo:'texto', texto:'Boa tarde, quanto fica 18 camisas?', arquivo:'', nome_do_arquivo:'', situacao:'', em:atras(30), canal:'whatsapp' },
      ]
      else if (u.includes('/mensagem?')) corpo = [
        { id:'m1', quem:'cliente', tipo:'texto', texto:'Boa tarde, quanto fica 18 camisas?',
          arquivo:'', nome_do_arquivo:'', situacao:'', em:atras(30) },
      ]
      else if (u.includes('cliente')) {
        /* acharCliente pede um so, por id=eq. */
        const id = /[?&]id=eq\.([^&]+)/.exec(u)?.[1]
        corpo = id ? CLIENTES.filter(c => c.id === decodeURIComponent(id)) : CLIENTES
      }
      return r.fulfill({ status:200, contentType:'application/json',
        headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
    })
    await ctx.addInitScript(([c, t])=>{ try{
      localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
    }catch{} }, [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }, tema])

    const pg = await ctx.newPage()
    await pg.goto(SITE + '/funil', { waitUntil:'networkidle' })
    await pg.waitForTimeout(1500)

    /* 1. a pagina nao rola de lado */
    const largura = await pg.evaluate(() => ({
      rola: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth,
    }))
    conta(!largura.rola, `${tema} ${nome}: funil sem rolagem de lado (${largura.s} em ${largura.c})`)

    /* a etiqueta da cotacao no cartao e o NUMERO da mais nova, e nao o id */
    const etiqueta = await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Vôlei Clube Araras'))
      return c ? [...c.querySelectorAll('.fn-tag')].map(t => t.textContent).join(',') : 'sem cartao'
    })
    conta(etiqueta === 'CO2026-0007', `${tema} ${nome}: a etiqueta da cotação no cartão mostra o número da mais nova (${etiqueta})`)

    /* o endereco que nao existe e a saudacao do inicio (12, secao 2, itens 8 e 9) */
    if (tema === 'light' && nome === 'computador') {
      await pg.goto(SITE + '/endereco-que-nao-existe', { waitUntil: 'networkidle' })
      const nao = await pg.evaluate(() => ({ h1: document.querySelector('h1')?.innerText ?? '', menu: !!document.querySelector('.lado, nav') }))
      conta(nao.h1 === 'Esta página não existe' && nao.menu, `${tema} ${nome}: endereço que não existe mostra a página própria, dentro da casca (${nao.h1})`)
      await pg.goto(SITE + '/', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(600)
      const ola = await pg.evaluate(() => document.querySelector('h1')?.innerText ?? '')
      const h = new Date().getHours()
      const esperado = (h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite') + ', Henrique'
      conta(ola === esperado, `${tema} ${nome}: o início cumprimenta pelo nome e pela hora (${ola})`)
      await pg.goto(SITE + '/funil', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(1200)
    }

    /* a busca do topo acha lead e cliente, sem acento, e a caixa vazia so mostra telas */
    if (tema === 'light' && nome === 'computador') {
      await pg.keyboard.press('Control+k')
      await pg.waitForTimeout(1200)
      const vazia = await pg.evaluate(() => [...document.querySelectorAll('dialog.cmdk .grupo')].map(g => g.textContent))
      await pg.keyboard.type('volei')
      await pg.waitForTimeout(300)
      const achou = await pg.evaluate(() => [...document.querySelectorAll('dialog.cmdk .cmdk-lista > div')].map(d => d.querySelector('.grupo')?.textContent + ':' + [...d.querySelectorAll('.item span:first-child')].map(x => x.textContent).join('|')))
      conta(vazia.join() === 'Telas' && achou.some(x => /^Leads:.*Vôlei Clube Araras/.test(x)) && achou.some(x => /^Clientes:.*Vôlei Clube Araras/.test(x)),
        `${tema} ${nome}: a busca do topo acha lead e cliente sem acento, e vazia mostra só as telas (${vazia.join()} / ${achou.join(' ; ')})`)
      await pg.keyboard.press('Control+a'); await pg.keyboard.type('futsal')
      await pg.waitForTimeout(300)
      await pg.keyboard.press('Enter')
      await pg.waitForTimeout(1500)
      const foi = await pg.evaluate(() => ({ url: location.pathname + location.search, inbox: document.querySelector('.fn-inbox')?.innerText ?? '' }))
      conta(foi.url === '/funil' && /Futsal Vila Nova/.test(foi.inbox), `${tema} ${nome}: escolher o lead na busca abre a conversa dele no funil (${foi.url})`)
      await pg.goto(SITE + '/funil', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(1200)
    }

    /* a aba volta para a frente: o funil rele na hora, sem esperar os 30 s */
    if (tema === 'light' && nome === 'computador') {
      const antes = leituras
      await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await pg.waitForTimeout(600)
      conta(leituras > antes, `${tema} ${nome}: a aba volta para a frente e o funil rele os leads na hora (${antes} para ${leituras})`)
    }

    /* --- prancha 125: a barra do topo, a origem e o "esperando" --- */
    const barra = await pg.evaluate(() => {
      const seg = [...document.querySelectorAll('.fn-barra .seg button')].map(b => b.innerText.replace(/\s+/g, ' ').trim())
      const cards = () => [...document.querySelectorAll('.fn-card .fn-nome')].map(n => n.textContent)
      const futsal = [...document.querySelectorAll('.fn-card')].find(c => c.textContent.includes('Futsal'))
      const super_ = [...document.querySelectorAll('.fn-card')].find(c => c.textContent.includes('Supermercado'))
      return {
        seg, cards: cards(),
        origem: futsal?.querySelector('.fn-origem')?.textContent ?? '',
        semSeloNoPadrao: ![...(super_?.querySelectorAll('.fn-origem') ?? [])].some(x => /WhatsApp/.test(x.textContent)),
        esperando: super_?.querySelector('.fn-tempo')?.textContent ?? '',
        aviso: document.body.innerText.includes('Você precisa da extensão Fourtime OS'),
        titulo: document.querySelector('h1')?.textContent ?? '',
      }
    })
    conta(barra.titulo === 'Funil e WhatsApp', `${tema} ${nome}: o título é Funil e WhatsApp`)
    conta(barra.seg.join('|') === 'Meus 0|Todos 4|Esperando 1', `${tema} ${nome}: Meus, Todos e Esperando com as contas (${barra.seg.join(' | ')})`)
    conta(barra.cards.length === 4, `${tema} ${nome}: quem não tem lead começa em Todos (${barra.cards.length} cartões)`)
    conta(barra.origem === 'Site', `${tema} ${nome}: o lead do site leva o selo Site`)
    conta(barra.semSeloNoPadrao, `${tema} ${nome}: a origem padrão (WhatsApp) não leva selo`)
    conta(/^esperando há 2 h$/.test(barra.esperando), `${tema} ${nome}: o cartão atrasado diz "esperando há" (${barra.esperando})`)
    conta(barra.aviso === (nome === 'computador'), `${tema} ${nome}: o aviso da extensão só no computador sem ela`)

    await pg.evaluate(() => [...document.querySelectorAll('.fn-barra .seg button')].find(b => /Esperando/.test(b.innerText)).click())
    await pg.waitForTimeout(400)
    const soEsperando = await pg.evaluate(() => [...document.querySelectorAll('.fn-card .fn-nome')].map(n => n.textContent))
    conta(soEsperando.join() === 'Supermercado Bom Preço', `${tema} ${nome}: Esperando mostra só quem espera resposta (${soEsperando.join(', ')})`)
    await pg.evaluate(() => [...document.querySelectorAll('.fn-barra .seg button')].find(b => /Todos/.test(b.innerText)).click())
    await pg.fill('.fn-barra input[type=search]', '99990003')
    await pg.waitForTimeout(400)
    const achou = await pg.evaluate(() => [...document.querySelectorAll('.fn-card .fn-nome')].map(n => n.textContent))
    conta(achou.join() === 'Vôlei Clube Araras', `${tema} ${nome}: a busca acha pelo telefone (${achou.join(', ')})`)
    await pg.fill('.fn-barra input[type=search]', 'xyz nada')
    await pg.waitForTimeout(400)
    const vazio = await pg.evaluate(() => document.body.innerText.includes('Nada com esse filtro'))
    conta(vazio, `${tema} ${nome}: busca sem resultado diz "Nada com esse filtro"`)
    await pg.fill('.fn-barra input[type=search]', '')
    await pg.waitForTimeout(400)
    await pg.screenshot({ path: `${PASTA}/funil-barra-${tema}-${nome}.png`, fullPage:false })

    /* --- 065: os selos, a ficha do site e o canal da fala (prancha 127) --- */
    const selos = await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Futsal'))
      return [...c.querySelectorAll('.fn-origem')].map(x => x.textContent)
    })
    conta(selos.join() === 'Site,PRIORIDADE,TESTE', `${tema} ${nome}: o lead do site leva Site, PRIORIDADE e TESTE (${selos.join(', ')})`)
    await pg.evaluate(() => [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Futsal')).click())
    await pg.waitForTimeout(900)
    const site = await pg.evaluate(() => ({
      abas: [...document.querySelectorAll('.fn-in-abas .seg button')].map(b => b.innerText.trim()),
      canais: [...document.querySelectorAll('.fn-canal')].map(c => c.textContent),
      robo: !!document.querySelector('.fn-balao.robo'),
    }))
    conta(site.abas.join() === 'Conversa,Ficha do site', `${tema} ${nome}: o lead do site tem as abas Conversa e Ficha do site`)
    conta(site.canais.join('|') === 'No site, pelo chat da loja|WhatsApp da Fourtime', `${tema} ${nome}: a conversa separa o site do WhatsApp (${site.canais.join(' | ')})`)
    conta(site.robo, `${tema} ${nome}: a fala do roteiro do chat aparece como robô`)
    if (nome === 'computador') {
      const mesa = await pg.evaluate(() => {
        const q = document.querySelector('.fn-quadro').getBoundingClientRect()
        const i = document.querySelector('.fn-inbox').getBoundingClientRect()
        return { q: Math.round(q.right), i: Math.round(i.left) }
      })
      conta(mesa.q <= mesa.i, `${tema} ${nome}: a conversa aberta não tapa o quadro (quadro até ${mesa.q}, conversa de ${mesa.i})`)
    }
    await pg.evaluate(() => [...document.querySelectorAll('.fn-in-abas .seg button')].find(b => /Ficha/.test(b.innerText)).click())
    await pg.waitForTimeout(400)
    const ficha = await pg.evaluate(() => ({
      texto: document.querySelector('.fn-in-ficha')?.innerText ?? '',
      link: document.querySelector('.fn-in-ficha a')?.getAttribute('href') ?? '',
      html: !!document.querySelector('.fn-in-ficha b'),
    }))
    conta(/Kit camiseta e short/.test(ficha.texto) && /50 a 100 peças/.test(ficha.texto) && /Urgente/.test(ficha.texto),
      `${tema} ${nome}: a ficha mostra o nome de cada código do orçamento`)
    conta(/politica-2026-09/.test(ficha.texto) && /rafa@futsal/.test(ficha.texto) && /instagram · outubro/.test(ficha.texto),
      `${tema} ${nome}: a ficha traz o aceite da LGPD, o e-mail e o anúncio`)
    conta(ficha.link === 'https://fourtimefit.com.br/products/raglan' && /<b>logo<\/b>/.test(ficha.texto) && !ficha.html,
      `${tema} ${nome}: o produto tem link, e o texto do cliente aparece como texto, nunca HTML`)
    await pg.screenshot({ path: `${PASTA}/funil-ficha-${tema}-${nome}.png`, fullPage:false })
    /* a cotacao que nasce do lead do site leva o e-mail e o que o cliente respondeu no chat */
    if (tema === 'light' && nome === 'computador') {
      await pg.evaluate(() => [...document.querySelectorAll('.fn-inbox button')].find(b => /Criar cotação/.test(b.innerText)).click())
      await pg.waitForTimeout(1200)
      const corpo = Array.isArray(cotacaoGravada) ? cotacaoGravada[0]?.corpo : null
      const obs = corpo?.producao?.observacao ?? ''
      conta(corpo?.cliente?.email === 'rafa@futsal.exemplo', `${tema} ${nome}: a cotação do lead do site já sai com o e-mail do cliente (${corpo?.cliente?.email})`)
      conta(/^Do site: Kit camiseta e short, 50 a 100 peças, Prazo: Urgente/.test(obs) && /Viu: Camiseta Raglan/.test(obs) && /Detalhe: <b>logo<\/b> nas costas/.test(obs),
        `${tema} ${nome}: a cotação do lead do site leva o pedido do chat na observação interna (${obs})`)
    }
    await pg.evaluate(() => [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Supermercado')).click())
    await pg.waitForTimeout(900)
    const zap = await pg.evaluate(() => ({ abas: !!document.querySelector('.fn-in-abas'), canais: document.querySelectorAll('.fn-canal').length }))
    conta(!zap.abas && zap.canais === 0, `${tema} ${nome}: lead só do WhatsApp fica como antes, sem abas e sem separação`)

    /* --- a janela, nos quatro casos --- */
    const janela = async (texto) => {
      await pg.evaluate((t) => {
        const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes(t))
        c.click()
      }, texto)
      await pg.waitForTimeout(900)
      return pg.evaluate(() => {
        const f = document.querySelector('.fn-janela')
        return {
          tem: !!f,
          texto: f?.innerText.replace(/\n/g, ' ') ?? '',
          classe: f?.className ?? '',
          acoes: [...document.querySelectorAll('.fn-in-acoes button')].map(b => b.innerText.trim()),
        }
      })
    }

    const j1 = await janela('Futsal Vila Nova')
    conta(j1.tem && /fecha em/.test(j1.texto) && !/aperta|fechada/.test(j1.classe),
      `${tema} ${nome}: janela aberta diz quanto falta (${j1.texto.slice(0,34)})`)
    conta(j1.acoes.includes('Cadastrar cliente'),
      `${tema} ${nome}: lead sem cliente oferece Cadastrar cliente`)

    await pg.screenshot({ path: `${PASTA}/funil-${tema}-${nome}.png`, fullPage:false })

    const j2 = await janela('Supermercado Bom Preço')
    conta(j2.tem && /aperta/.test(j2.classe),
      `${tema} ${nome}: janela com menos de 2 h sai marcada (${j2.classe})`)

    const j3 = await janela('Vôlei Clube Araras')
    conta(j3.tem && /fechada/.test(j3.classe) && /Janela fechada/.test(j3.texto),
      `${tema} ${nome}: janela vencida diz que fechou`)
    conta(j3.acoes.includes('Ver cliente'),
      `${tema} ${nome}: lead que já tem cliente oferece Ver cliente`)

    /* 2. SEM FALA DE CLIENTE NAO E JANELA FECHADA: e janela nenhuma */
    const j4 = await janela('Studio Pilates Flor')
    conta(!j4.tem, `${tema} ${nome}: lead sem fala de cliente não desenha faixa de janela`)

    /* --- W1: o icone do WhatsApp no topo do inbox (plano 16, 11/10/2026) ---
       No computador vai direto ao WhatsApp Web, sem a pagina do meio do wa.me;
       no toque, o wa.me, que abre o aplicativo. O window.open e trocado por um
       gravador: o teste quer saber PARA ONDE iria, e nao abrir aba nenhuma. */
    const wa = await pg.evaluate(() => {
      window.__abriu = []
      window.open = (u, alvo, jeito) => { window.__abriu.push([u, alvo, jeito]); return null }
      const b = document.querySelector('.fn-in-wa')
      if (!b) return null
      const r = b.getBoundingClientRect()
      b.click()
      return { abriu: window.__abriu, rotulo: b.getAttribute('aria-label') || '', w: r.width, h: r.height }
    })
    conta(!!wa && wa.abriu.length === 1, `${tema} ${nome}: o ícone do WhatsApp existe e abre uma aba só`)
    const destino = wa?.abriu[0]?.[0] || ''
    conta(nome === 'computador'
      ? destino === 'https://web.whatsapp.com/send?phone=5562999990004'
      : destino === 'https://wa.me/5562999990004',
      `${tema} ${nome}: abre ${nome === 'computador' ? 'o WhatsApp Web direto' : 'o aplicativo (wa.me)'}, sem texto (${destino})`)
    conta(wa?.abriu[0]?.[2] === 'noopener', `${tema} ${nome}: a aba nova não fica presa ao sistema (noopener)`)
    conta(/Studio Pilates Flor/.test(wa?.rotulo || ''), `${tema} ${nome}: o ícone diz com quem é a conversa`)

    /* --- o dono no cartao --- */
    const donos = await pg.evaluate(() => {
      const ler = (t) => {
        const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes(t))
        const d = c?.querySelector('.fn-dono')
        return d ? { texto: d.textContent.trim(), orfao: d.classList.contains('orfao'), titulo: d.title } : null
      }
      return { comDono: ler('Vôlei Clube Araras'), semDono: ler('Futsal Vila Nova') }
    })
    conta(donos.comDono?.texto === 'DR' && !donos.comDono.orfao,
      `${tema} ${nome}: o cartão mostra de quem é o lead (${donos.comDono?.texto})`)
    conta(!!donos.semDono?.orfao && donos.semDono.texto === '?',
      `${tema} ${nome}: lead sem dono sai tracejado, e não sem nada`)

    /* --- criar um lead --- */
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Novo lead/.test(x.innerText))
      b.click()
    })
    await pg.waitForTimeout(1500)
    const form = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      if (!d) return null
      return {
        campos: [...d.querySelectorAll('.campo > span:first-child')].map(e => e.textContent.trim()),
        entradas: d.querySelectorAll('.fn-form input').length,
        salvarTravado: [...d.querySelectorAll('button')].find(b => /Criar lead/.test(b.innerText))?.disabled,
        apagar: [...d.querySelectorAll('button')].some(b => /Apagar/.test(b.innerText)),
      }
    })
    conta(!!form && form.campos.length === 6,
      `${tema} ${nome}: o formulário do lead tem os 6 campos (${form?.campos.join(', ')})`)
    /* SEM NOME NAO GRAVA. A unica trava da tabela e lead_nome_nao_vazio, e a
       tela tranca o botao em vez de deixar o banco recusar depois. */
    conta(form?.salvarTravado === true,
      `${tema} ${nome}: Criar lead fica travado enquanto o nome está vazio`)
    conta(form?.apagar === false, `${tema} ${nome}: lead novo não oferece Apagar`)

    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const i = d.querySelector('.fn-form input')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(i, 'Time do Bairro')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await pg.waitForTimeout(700)
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      ;[...d.querySelectorAll('button')].find(b => /Criar lead/.test(b.innerText)).click()
    })
    await pg.waitForTimeout(2000)
    conta(!!gravou && JSON.stringify(gravou).includes('Time do Bairro'),
      `${tema} ${nome}: o lead novo foi para o banco com o nome digitado`)

    /* --- editar pelo lápis do inbox --- */
    await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Vôlei Clube Araras'))
      c.click()
    })
    await pg.waitForTimeout(1200)
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('.fn-in-topo button')].find(x => /Editar/.test(x.getAttribute('aria-label') || ''))
      b.click()
    })
    await pg.waitForTimeout(1500)
    const edicao = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      if (!d) return null
      return {
        titulo: d.querySelector('.modal-topo b, h2, header')?.textContent ?? d.innerText.slice(0, 40),
        nome: d.querySelector('.fn-form input')?.value ?? '',
        apagar: [...d.querySelectorAll('button')].some(b => /Apagar/.test(b.innerText)),
      }
    })
    conta(edicao?.nome === 'Vôlei Clube Araras',
      `${tema} ${nome}: o lápis abre o lead com os dados dele (${edicao?.nome})`)
    conta(edicao?.apagar === true, `${tema} ${nome}: lead que existe oferece Apagar para o admin`)

    /* A CONFIRMACAO DE APAGAR ENTRA DENTRO DO MODAL, e nao num segundo modal:
       modal sobre modal esconde o que se esta prestes a apagar. */
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      ;[...d.querySelectorAll('button')].find(b => /Apagar/.test(b.innerText)).click()
    })
    await pg.waitForTimeout(900)
    const conf = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      return {
        aviso: !!d.querySelector('.fn-apagar'),
        formAindaVisivel: !!d.querySelector('.fn-form'),
        modais: document.querySelectorAll('dialog[open]').length,
      }
    })
    /* TRES MEDIDAS, e nao uma com tres condicoes. Medida que junta condicoes
       reprova sem dizer qual delas quebrou, e foi exatamente o que aconteceu na
       primeira rodada: gastei uma bancada de depuracao para descobrir que as
       outras duas estavam certas. */
    conta(conf.aviso, `${tema} ${nome}: a confirmação de apagar aparece`)
    conta(conf.formAindaVisivel,
      `${tema} ${nome}: o formulário continua à vista enquanto se confirma`)
    conta(conf.modais === 1,
      `${tema} ${nome}: não abre um segundo modal por cima (${conf.modais} aberto)`)

    await pg.screenshot({ path: `${PASTA}/funil-editar-${tema}-${nome}.png`, fullPage:false })
    await pg.keyboard.press('Escape')
    await pg.waitForTimeout(800)

    /* --- cadastrar o cliente do lead (067) --- */
    await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Studio Pilates Flor'))
      c.click()
    })
    await pg.waitForTimeout(1300)
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('.fn-in-acoes button')].find(x => /Cadastrar cliente/.test(x.innerText))
      b.click()
    })
    await pg.waitForTimeout(1500)
    const parecido = await pg.evaluate(() => ({
      titulo: document.querySelector('dialog[open]')?.innerText ?? '',
      itens: [...document.querySelectorAll('.fn-cad-item')].map(x => x.innerText),
    }))
    conta(/já pode estar cadastrado/.test(parecido.titulo) && parecido.itens.length === 1 && /Studio Pilates Flor/.test(parecido.itens[0]),
      `${tema} ${nome}: cadastrar cliente acha o cadastro parecido (mesmo telefone e nome) antes de criar outro`)
    await pg.screenshot({ path: `${PASTA}/funil-parecido-${tema}-${nome}.png`, fullPage:false })

    if (tema === 'light' && nome === 'computador') {
      /* o caminho do cadastro novo: a ficha ja vem preenchida com o lead */
      await pg.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find(b => /Cadastrar novo/.test(b.innerText)).click())
      await pg.waitForTimeout(800)
      const ficha = await pg.evaluate(() => {
        const d = document.querySelector('dialog[open]')
        const campos = [...d.querySelectorAll('input')].map(i => i.value)
        return { texto: d.innerText, campos }
      })
      conta(/Cadastrar cliente do lead/.test(ficha.texto) && ficha.campos.includes('Studio Pilates Flor') && ficha.campos.includes('62999990004'),
        `${tema} ${nome}: Cadastrar novo abre a ficha de cliente já preenchida com o lead`)
      await pg.screenshot({ path: `${PASTA}/funil-cadastro-${tema}-${nome}.png`, fullPage:false })
      await pg.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find(b => /^Cadastrar$/.test(b.innerText.trim())).click())
      await pg.waitForTimeout(1500)
      conta(chamouVirar?.p_lead === 'L4' && chamouVirar?.p_cadastro?.nome === 'Studio Pilates Flor' && chamouVirar?.p_cadastro?.celular === '62999990004',
        `${tema} ${nome}: a ficha grava pelo lead_vira_cliente com o cadastro inteiro (${JSON.stringify(chamouVirar)?.slice(0, 90)})`)
    } else {
      /* o caminho do cadastro que ja existe: liga o lead a ele */
      await pg.evaluate(() => [...document.querySelectorAll('.fn-cad-item button')][0].click())
      await pg.waitForTimeout(1500)
      conta(chamouVirar?.p_lead === 'L4' && chamouVirar?.p_cliente === 'C7' && !chamouVirar?.p_cadastro,
        `${tema} ${nome}: Ligar a este liga o lead ao cliente que já existe (${JSON.stringify(chamouVirar)})`)
    }
    const fechou = await pg.evaluate(() => ({
      modal: !!document.querySelector('dialog[open]'),
      acoes: [...document.querySelectorAll('.fn-in-acoes button')].map(b => b.innerText.trim()),
    }))
    conta(!fechou.modal && fechou.acoes.includes('Ver cliente'),
      `${tema} ${nome}: depois de cadastrar, o lead mostra Ver cliente (${fechou.acoes.join(', ')})`)

    /* com cadastro, a cotacao sai com o cabecalho do cliente */
    cotacaoGravada = null
    await pg.evaluate(() => [...document.querySelectorAll('.fn-in-acoes button')].find(b => /Criar cotação/.test(b.innerText)).click())
    await pg.waitForTimeout(1500)
    const cab = Array.isArray(cotacaoGravada) ? cotacaoGravada[0]?.corpo?.cliente : null
    conta(cab?.id === 'C7' && cab?.cidade === 'Goiânia' && cab?.uf === 'GO' && cab?.nome === 'Studio Pilates Flor',
      `${tema} ${nome}: com cadastro, o cabeçalho da cotação sai do cliente (${JSON.stringify(cab)})`)

    /* e o Ver cliente leva para a lista com a ficha aberta */
    await pg.evaluate(() => [...document.querySelectorAll('.fn-in-acoes button')].find(b => /Ver cliente/.test(b.innerText)).click())
    await pg.waitForTimeout(2500)

    const depois = await pg.evaluate(() => ({
      url: location.pathname + location.search,
      ficha: !!document.querySelector('dialog[open], .gaveta') || /Studio Pilates Flor/.test(document.querySelector('.cl-lado h2')?.textContent ?? ''),
      texto: document.body.innerText.includes('Studio Pilates Flor'),
    }))
    conta(depois.url.startsWith('/clientes'), `${tema} ${nome}: Ver cliente vai para a tela de clientes (${depois.url})`)
    /* 6. O PARAMETRO SAI DA BARRA. Sem isso a ficha reabre sozinha ao fechar. */
    conta(!depois.url.includes('abrir='),
      `${tema} ${nome}: o parâmetro abrir saiu da barra depois de abrir (${depois.url})`)
    conta(depois.ficha, `${tema} ${nome}: a ficha do cliente abriu`)

    await pg.screenshot({ path: `${PASTA}/funil-cliente-${tema}-${nome}.png`, fullPage:false })
    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter(a => !a.certo)
console.log('\nfotos em ' + PASTA + '/')
if (ruins.length) {
  console.log('\nfunil REPROVOU: ' + ruins.length + ' de ' + achados.length)
  ruins.forEach(a => console.log('  - ' + a.texto))
  process.exit(1)
}
console.log('funil ok: ' + achados.length + ' medidas, todas passaram')
