/* ==========================================================================
   O TESTE DO CARTÃO DO MARK45.

   Ele confere o que só aparece olhando: a fileira das tags mestre, as tags do
   posto, o cartão aberto com os layouts, e a confirmação do Terminei. Em três
   larguras e nos dois temas.

   O QUE ELE MEDE, e não o que ele mostra:

     1. em nenhuma largura a página rola de lado
     2. o número do pedido nunca quebra em duas linhas
     3. a faixa das tags mestre existe e é separada das tags do posto
     4. no cartão aberto, as duas colunas têm larguras iguais ou empilham
     5. a tag que não vale no posto aparece apagada, e não some
     6. o alvo de toque tem 44px onde o V7 pede

   As fotos ficam em testes/fotos/ para olhar depois, mas quem reprova é a
   medida: foto ninguém compara com a de ontem, e medida o terminal compara.

   Uso:  node testes/cartao.mjs
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
const FATIAS = [
  { id:'1', pedido_id:'p1', numero:'PD-TESTE-0029', nome:'Uniforme Equipe Verão', cliente:'Drogaria Viver Bem',
    cliente_id:'C1',
    vendedor:'Dani', tecnica:'subli', etapa:'subli', etapa_em:ha(0), fechado_em:null, layouts:[1,2],
    pecas:299, entrega_em:null, aviso:'', estado:'producao', teste:true,
    marcas:['VIP','PRIORIDADE'], tags:['montagem','prova_de_cor'],
    pego_por:'1', pego_por_nome:'Henrique', pego_em:ha(0), falas:2 },
  { id:'2', pedido_id:'p2', numero:'PD-TESTE-0057', nome:'Camisa Congresso 2026', cliente:'Igreja Araguaia',
    cliente_id:'C2',
    vendedor:'Lucas', tecnica:'dtf', etapa:'corte', etapa_em:ha(4), fechado_em:null, layouts:[1],
    pecas:160, entrega_em:null, aviso:'falta-material', estado:'producao', teste:true,
    marcas:['EVENTO','URGENTE'], tags:['falta_tecido'],
    pego_por:null, pego_por_nome:'', pego_em:null, falas:0 },
]
const TAGS = [
  { chave:'falta_tecido', nome:'falta tecido', tom:'vermelha', em_todo_posto:true,  ordem:10, ativa:true },
  { chave:'montagem',     nome:'montagem',     tom:'verde',    em_todo_posto:false, ordem:30, ativa:true },
  { chave:'prova_de_cor', nome:'prova de cor', tom:'azul',     em_todo_posto:false, ordem:40, ativa:true },
  { chave:'revisao',      nome:'revisão',      tom:'roxa',     em_todo_posto:false, ordem:60, ativa:true },
]
const TAGS_POSTO = [
  { tag:'montagem', posto:'subli' }, { tag:'montagem', posto:'dtf' },
  { tag:'prova_de_cor', posto:'subli' },
  { tag:'revisao', posto:'conferencia' },
]
const BLOCO = (n, ref, nome, genero, faixa, grade) => ({
  id:'B'+n, n, referencia:ref, nomeDaReferencia:nome, genero, faixa, grade,
  tecidos:[{ nome:'DRYFIT POLIESTER 100%', cor:'Azul Royal', hex:'#1d4ed8' }],
  design:[{ tag:'Subli', tecnica:'subli', cores:[{cod:'SB-214',hex:'#1d4ed8'},{cod:'SB-001',hex:'#f5f5f5'}] }],
  arte:'uniforme-2026', imagem:'', observacao:'Gola em ribana preta.',
})
const COTACAO = [{
  id:'c1', numero:'CO2026-0100', versao_do_formato:4, estado:'aprovada',
  criada_em:ha(9), atualizado_em:ha(1),
  corpo: {
    numero:'CO2026-0100', versaoDoFormato:4, estado:'aprovada', vendedor:'Dani',
    cliente:{ id:'C1', nome:'Drogaria Viver Bem', documento:'', contato:'', telefone:'', email:'', cidade:'Goiânia', uf:'GO' },
    produtos:[
      { bloco: BLOCO(1,'FT-010-000M','CAMISETA MASC TRAD','masculino','adulto',{P:4,M:10,G:12,GG:6,XG:2}), precoPorTamanho:{}, precoBase:60 },
      { bloco: BLOCO(2,'FT-010-000F','CAMISETA FEM TRAD','feminino','adulto',{P:6,M:8,G:4,GG:2}), precoPorTamanho:{}, precoBase:60 },
    ],
    ajustes:[], informe:{}, informes:[], enviadas:[],
    producao:{ pedido:'', dataDeEnvio:'', departamento:'', embalagem:'', marcas:['VIP','PRIORIDADE'], observacao:'' },
  },
}]

/* O pedido antigo da comparação: mesmo cliente, um layout só, e um código de
   cor diferente. Ele existe para o teste ver os DOIS lados desenhados. */
const ANTIGA = [{
  id:'c9', numero:'CO2026-0044', versao_do_formato:4, estado:'aprovada',
  criada_em:ha(200), atualizado_em:ha(190),
  corpo: {
    numero:'CO2026-0044', versaoDoFormato:4, estado:'aprovada', vendedor:'Dani',
    cliente:{ id:'C1', nome:'Drogaria Viver Bem', documento:'', contato:'', telefone:'', email:'', cidade:'Goiânia', uf:'GO' },
    produtos:[
      { bloco: BLOCO(1,'FT-010-000M','CAMISETA MASC TRAD','masculino','adulto',{P:3,M:9,G:11,GG:5}), precoPorTamanho:{}, precoBase:55 },
    ],
    ajustes:[], informe:{}, informes:[], enviadas:[],
    producao:{ pedido:'', dataDeEnvio:'', departamento:'', embalagem:'', marcas:[], observacao:'' },
  },
}]

/* TRES PEDIDOS ANTERIORES DO MESMO CLIENTE, um deles com a cotacao que o
   comparar ja usa. A demonstracao no banco de verdade nao serve para provar
   esta lista: a semente da um pedido por cliente, entao la ela sai sempre
   vazia e o vazio passaria por certo sem nunca ter desenhado uma linha. */
const ANTERIORES = [
  { id:'p9', numero:'PD-TESTE-0084', nome:'Uniforme Equipe Inverno',
    cliente:'Drogaria Viver Bem', estado:'entregue', cotacao_id:'c9', entrega_em:'2025-11-20' },
  { id:'p8', numero:'PD-TESTE-0061', nome:'Camiseta Campanha',
    cliente:'Drogaria Viver Bem', estado:'enviado', cotacao_id:'c9', entrega_em:'2025-08-02' },
  { id:'p7', numero:'PD-TESTE-0042', nome:'Jaleco Balcao',
    cliente:'Drogaria Viver Bem', estado:'entregue', cotacao_id:'c9', entrega_em:'2025-03-14' },
]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440,900,'computador'], [768,1024,'tablet'], [390,844,'celular']]) {
    /* hasTouch liga o `pointer: coarse` do CSS, que e o que faz o alvo de toque
       crescer. Sem ele o teste mediria o botao de mouse no tablet. */
    const ctx = await nav.newContext({
      viewport:{width:larg,height:alt}, reducedMotion:'reduce', hasTouch: nome !== 'computador',
    })
    await ctx.route('**supabase.co/**', async (r) => {
      const req = r.request(); const u = req.url()
      let corpo = []
      if (u.includes('rpc/conferir_a_saida')) corpo = {
        fatia:'1', numero:'PD-TESTE-0029', posto:'subli', proximo:'calandra',
        itens:[
          { tom:'ok', titulo:'O material saiu da prateleira', linha:'4 linhas de reserva, todas baixadas.' },
          { tom:'atencao', titulo:'Tag ainda posta: montagem, prova de cor', linha:'Se já resolveu, tire a tag antes de mandar para a frente.' },
          { tom:'nota', titulo:'Este pedido tem mais 1 cartão aberto', linha:'O pedido só fecha quando o último fechar.' },
        ], pode:true }
      else if (u.includes('meu_perfil')) corpo = PERFIL
      else if (u.includes('fatia_na_fabrica')) corpo = FATIAS
      else if (u.includes('linha_do_tempo')) corpo = [
        { id:'e1', tipo:'fala', texto:'Comparei com o PD-TESTE-0084 antes de imprimir.', em:ha(0), quem:'1', quem_nome:'Henrique' },
        { id:'e2', tipo:'tag', texto:'pôs montagem', em:ha(0), quem:'1', quem_nome:'Rita' },
        { id:'e3', tipo:'posto', texto:'cd-costura para subli', em:ha(1), quem:'1', quem_nome:'Marcos' },
      ]
      else if (u.includes('tag_do_posto')) corpo = TAGS_POSTO
      else if (u.includes('/tag?')) corpo = TAGS
      else if (u.includes('rota_da_tecnica')) corpo = ROTAS
      else if (u.includes('pedido_na_fabrica') && u.includes('cliente_id=eq')) corpo = ANTERIORES
      else if (u.includes('pedido_na_fabrica')) corpo = [
        { id:'p9', numero:'PD-TESTE-0084', nome:'Uniforme Equipe Inverno',
          cliente:'Drogaria Viver Bem', estado:'entregue', cotacao_id:'c9', entrega_em:null },
      ]
      else if (u.includes('/pedido?')) corpo = [{ cotacao_id:'c1' }]
      else if (u.includes('/cotacao?')) corpo = u.includes('c9') ? ANTIGA : COTACAO
      return r.fulfill({ status:200, contentType:'application/json',
        headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(corpo) })
    })
    await ctx.addInitScript(([c, t])=>{ try{
      localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
    }catch{} }, [{ acesso:'t', renovacao:'t', venceEm: Date.now()+86400000, usuario:'t', email:'t@f' }, tema])

    const pg = await ctx.newPage()
    await pg.goto(SITE + '/kanban', { waitUntil:'networkidle' })
    await pg.waitForTimeout(1400)

    /* 1. a pagina nao rola de lado em largura nenhuma */
    const largura = await pg.evaluate(() => ({
      rola: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth,
    }))
    conta(!largura.rola, `${tema} ${nome}: quadro sem rolagem de lado (${largura.s} em ${largura.c})`)

    /* 2. o numero nunca quebra, e 3. a faixa das mestres existe */
    const cartao = await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-TESTE-0029'))
      if (!c) return null
      const n = c.querySelector('.kb-cartao-topo > b')
      const linhas = Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight || '20'))
      const mestres = c.querySelector('.kb-mestres')
      return {
        linhasDoNumero: linhas,
        mestres: mestres ? [...mestres.querySelectorAll('.etiqueta')].map(e => e.textContent.trim()) : [],
        temBorda: mestres ? getComputedStyle(mestres).borderTopWidth !== '0px' : false,
        tags: [...c.querySelectorAll('.kb-tags .etiqueta')].map(e => e.textContent.trim()),
        botao: (() => {
          const b = c.querySelector('.kb-terminei')
          if (!b) return null
          const cx = b.getBoundingClientRect(); const e = getComputedStyle(b)
          return {
            alt: Math.round(cx.height), larg: Math.round(cx.width),
            fundo: e.backgroundColor, borda: e.borderTopWidth,
            texto: b.textContent.trim(),
          }
        })(),
      }
    })
    conta(!!cartao && cartao.linhasDoNumero <= 1, `${tema} ${nome}: o número do pedido cabe em uma linha`)
    conta(!!cartao && cartao.mestres.length === 2 && cartao.temBorda,
      `${tema} ${nome}: a faixa das mestres tem ${cartao?.mestres.length} tags e divisor`)
    conta(!!cartao && cartao.tags.length === 2, `${tema} ${nome}: as tags do posto aparecem (${cartao?.tags.join(', ')})`)

    /* O BOTAO DE TERMINAR E QUADRADO, SEM TEXTO E SEM VERMELHO.

       O vermelho e a marca, e no V7 marca quer dizer acao e ATRASO. Repetido
       em cada cartao de um quadro de treze colunas ele para de querer dizer
       qualquer coisa, e o que precisa gritar la e o cartao empacado. A medida
       do fundo pega justamente quem voltar a pintar o botao de marca. */
    const bt = cartao?.botao
    conta(!!bt && bt.texto === '', `${tema} ${nome}: o botão de terminar não tem texto`)
    conta(!!bt && Math.abs(bt.alt - bt.larg) <= 1,
      `${tema} ${nome}: o botão é quadrado (${bt?.larg}x${bt?.alt})`)
    conta(!!bt && bt.borda !== '0px', `${tema} ${nome}: o botão tem borda`)
    conta(!!bt && !/(198, 22, 27)|(224, 38, 46)/.test(bt.fundo),
      `${tema} ${nome}: o botão não é vermelho de marca (${bt?.fundo})`)
    /* 44px onde ha dedo, 30 onde ha mouse: trinta num tablet e um botao que se
       erra, e quarenta e quatro no computador rouba a largura do nome. */
    conta(!!bt && (nome === 'computador' ? bt.alt === 30 : bt.alt === 44),
      `${tema} ${nome}: o alvo do botão é o do ponteiro (${bt?.alt}px)`)

    await pg.screenshot({ path: `${PASTA}/quadro-${tema}-${nome}.png`, fullPage:false })

    /* ---- o cartao aberto ---- */
    await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.kb-cartao')].find(x => x.textContent.includes('PD-TESTE-0029'))
      c.querySelector('.kb-abrir').click()
    })
    await pg.waitForTimeout(1800)

    const modal = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      if (!d) return null
      const esq = d.querySelector('.ca-esq')?.getBoundingClientRect()
      const dir = d.querySelector('.ca-dir')?.getBoundingClientRect()
      return {
        layouts: d.querySelectorAll('.ca-layout').length,
        modulos: d.querySelectorAll('.mod').length,
        empilhado: !!esq && !!dir && Math.abs(esq.top - dir.top) > 40,
        esq: Math.round(esq?.width ?? 0),
        dir: Math.round(dir?.width ?? 0),
        rolaDeLado: d.scrollWidth > d.clientWidth + 1,
      }
    })
    conta(!!modal && modal.layouts === 2 && modal.modulos === 2,
      `${tema} ${nome}: o cartão aberto traz os 2 layouts pelo módulo do editor`)
    conta(!!modal && !modal.rolaDeLado, `${tema} ${nome}: o cartão aberto não rola de lado`)

    await pg.screenshot({ path: `${PASTA}/cartao-${tema}-${nome}.png`, fullPage:false })

    /* ---- o escolhedor de tags: a que nao vale aparece APAGADA ---- */
    const escolher = await pg.evaluate(async () => {
      const d = document.querySelector('dialog[open]')
      const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'tag')
      if (!b) return { semBotao: true }
      b.click()
      await new Promise(r => setTimeout(r, 400))
      const linha = document.querySelector('.ca-escolher')
      return {
        todas: [...linha.querySelectorAll('.etiqueta')].map(e => e.textContent.trim()),
        foras: [...linha.querySelectorAll('.etiqueta.fora')].map(e => e.textContent.trim()),
      }
    })
    conta(escolher.foras?.includes('revisão'),
      `${tema} ${nome}: a tag que não vale no posto aparece apagada, e não some`)

    /* ---- a confirmacao do Terminei ---- */
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const b = [...d.querySelectorAll('.ca-botoes button')].find(x => x.textContent.includes('Terminei'))
      if (b) b.click()
    })
    await pg.waitForTimeout(1500)
    const conf = await pg.evaluate(() => {
      const ds = [...document.querySelectorAll('dialog[open]')]
      const d = ds[ds.length - 1]
      return {
        ok: d.querySelectorAll('.cs-ok').length,
        atencao: d.querySelectorAll('.cs-atencao').length,
        nota: d.querySelectorAll('.cs-nota').length,
        tirar: [...d.querySelectorAll('button')].some(b => /Tirar as? /.test(b.textContent)),
        botao: [...d.querySelectorAll('.sobre-pe button')].map(b => b.textContent.trim()).join(' | '),
      }
    })
    conta(conf.ok === 1 && conf.atencao === 1 && conf.nota === 1,
      `${tema} ${nome}: a confirmação desenha os três tons`)
    conta(conf.tirar, `${tema} ${nome}: tem o botão de tirar a tag e terminar`)

    await pg.screenshot({ path: `${PASTA}/confirmar-${tema}-${nome}.png`, fullPage:false })

    /* ---- comparar com outro pedido ---- */
    await pg.evaluate(() => {
      const ds = [...document.querySelectorAll('dialog[open]')]
      const d = ds[ds.length - 1]
      const b = [...d.querySelectorAll('.sobre-pe button')].find(x => x.textContent.includes('Voltar'))
      if (b) b.click()
    })
    await pg.waitForTimeout(600)

    /* ---- os ultimos pedidos do cliente ---- */
    const hist = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const h = d.querySelector('.ca-historico')
      if (!h) return null
      const linhas = [...h.querySelectorAll('.ca-antigo')]
      const conversa = d.querySelector('.ca-conversa')
      return {
        titulo: h.querySelector('.ca-rot')?.textContent.trim() ?? '',
        quantas: linhas.length,
        primeira: linhas[0]?.innerText.replace(/\n/g, ' ') ?? '',
        botoesDaPrimeira: [...(linhas[0]?.querySelectorAll('button') ?? [])].map((b) =>
          b.getAttribute('aria-label'),
        ),
        /* ABAIXO DA CONVERSA, e nao acima: a conversa e sobre ESTE cartao,
           agora, e e ela que a pessoa veio ler. */
        abaixoDaConversa:
          !!conversa &&
          (conversa.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        rolaDeLado: h.scrollWidth > h.clientWidth + 1,
      }
    })
    conta(!!hist && hist.titulo === 'Últimos pedidos do cliente',
      `${tema} ${nome}: a seção dos pedidos do cliente existe`)
    conta(!!hist && hist.quantas === 3,
      `${tema} ${nome}: ela lista os 3 pedidos anteriores (${hist?.quantas})`)
    conta(!!hist && hist.botoesDaPrimeira.length === 2,
      `${tema} ${nome}: cada pedido tem dois botões (${hist?.botoesDaPrimeira.join(', ')})`)
    conta(!!hist && hist.abaixoDaConversa,
      `${tema} ${nome}: ela fica abaixo da conversa`)
    conta(!!hist && !hist.rolaDeLado, `${tema} ${nome}: a lista não rola de lado`)

    /* O COMPARAR DA LISTA E O MESMO COMPARAR DA BUSCA. Se fossem dois caminhos
       diferentes para a mesma tela, um deles ia divergir do outro. */
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      d.querySelector('.ca-antigo-botoes button').click()
    })
    await pg.waitForTimeout(1600)
    const daLista = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      return {
        comparando: !!d.querySelector('.ca-outro'),
        semDireita: !d.querySelector('.ca-dir'),
      }
    })
    conta(daLista.comparando && daLista.semDireita,
      `${tema} ${nome}: o botão comparar da lista abre a comparação`)

    /* volta ao normal para a busca do comparar ser medida do zero */
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const b = [...d.querySelectorAll('button')].find(x => /Fechar a compara/.test(x.innerText))
      if (b) b.click()
    })
    await pg.waitForTimeout(900)
    await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const i = d.querySelector('.ca-caixa-busca input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, 'PD-TESTE-0084')
      i.dispatchEvent(new Event('input', { bubbles:true }))
    })
    await pg.waitForTimeout(1200)
    const achou = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const li = [...d.querySelectorAll('.ca-achados button')]
      if (!li.length) return { achou:0 }
      li[0].click()
      return { achou: li.length }
    })
    conta(achou.achou > 0, `${tema} ${nome}: a busca do comparar acha o pedido antigo`)
    await pg.waitForTimeout(1500)

    const comp = await pg.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const esq = d.querySelector('.ca-esq')?.getBoundingClientRect()
      const outro = d.querySelector('.ca-outro')?.getBoundingClientRect()
      return {
        temOutro: !!outro,
        acaoSumiu: !d.querySelector('.ca-acao'),
        conversaSumiu: !d.querySelector('.ca-conversa'),
        layoutsDele: d.querySelector('.ca-outro')?.querySelectorAll('.mod').length ?? 0,
        iguais: !!esq && !!outro && Math.abs(esq.width - outro.width) <= 2,
        empilhado: !!esq && !!outro && Math.abs(esq.top - outro.top) > 40,
        rolaDeLado: d.scrollWidth > d.clientWidth + 1,
      }
    })
    conta(comp.temOutro && comp.layoutsDele === 1,
      `${tema} ${nome}: o pedido comparado entra com os layouts dele`)
    conta(comp.acaoSumiu && comp.conversaSumiu,
      `${tema} ${nome}: a ação e a conversa saem de cena enquanto se compara`)
    conta(comp.iguais || comp.empilhado,
      `${tema} ${nome}: as duas metades são iguais, ou empilham (${comp.iguais ? 'iguais' : 'pilha'})`)
    conta(!comp.rolaDeLado, `${tema} ${nome}: comparando, não rola de lado`)

    await pg.screenshot({ path: `${PASTA}/comparar-${tema}-${nome}.png`, fullPage:false })
    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter(a => !a.certo)
console.log('')
console.log(`fotos em ${PASTA}/`)
if (ruins.length) {
  console.log(`${ruins.length} de ${achados.length} reprovaram`)
  process.exit(1)
}
console.log(`cartao ok: ${achados.length} medidas, todas passaram`)
