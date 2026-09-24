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
     4. lead sem cliente mostra "Criar cliente"; com cliente, "Ver cliente"
     5. criar cliente chama lead_vira_cliente e leva para /clientes?abrir=
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
    ultima_msg_em:atras(30), nao_lidas:2, janela_ate:daqui(1380), teste:true,
    equipe:null, cotacao:[], pedido:[] },
  { id:'L2', nome:'Supermercado Bom Preço', contato:'Ana', telefone:'62999990002', cliente_id:null,
    estagio:'atendimento', valor:2800, vendedor_id:null, ultima_msg:'Pode ser 40 camisetas polo',
    ultima_msg_em:atras(90), nao_lidas:0, janela_ate:daqui(45), teste:true,
    equipe:null, cotacao:[], pedido:[] },
  { id:'L3', nome:'Vôlei Clube Araras', contato:'Bia', telefone:'62999990003', cliente_id:'C9',
    estagio:'cotacao', valor:1860, vendedor_id:null, ultima_msg:'Recebi a cotação, vou mostrar',
    ultima_msg_em:atras(2880), nao_lidas:0, janela_ate:atras(1440), teste:true,
    equipe:{nome:'Dani Ribeiro'}, cotacao:[{id:'c1'}], pedido:[] },
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
    let chamouVirar = false
    let gravou = null
    await ctx.route('**supabase.co/**', async (r) => {
      const req = r.request(); const u = req.url(); const m = req.method()
      let corpo = []
      if (u.includes('meu_perfil')) corpo = PERFIL
      /* A RPC VEM ANTES. A url dela e rpc/lead_vira_cliente, e um teste que
         casasse por '/lead' engoliria a chamada da funcao junto com a gravacao
         da tabela: foi o que aconteceu na primeira rodada. */
      else if (u.includes('rpc/lead_vira_cliente')) { chamouVirar = true; corpo = { id:'C7' } }
      else if (u.includes('/equipe?')) corpo = DONOS
      else if (u.includes('/lead') && (m === 'POST' || m === 'PATCH')) {
        try { gravou = JSON.parse(req.postData() || 'null') } catch { gravou = 'corpo ilegivel' }
        corpo = [{ id:'L9' }]
      }
      else if (u.includes('/lead?')) corpo = LEADS
      else if (u.includes('/mensagem?')) corpo = [
        { id:'m1', quem:'cliente', tipo:'texto', texto:'Boa tarde, quanto fica 18 camisas?',
          arquivo:'', nome_do_arquivo:'', situacao:'', em:atras(30) },
      ]
      else if (u.includes('cliente')) corpo = CLIENTES
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
    conta(j1.acoes.includes('Criar cliente'),
      `${tema} ${nome}: lead sem cliente oferece Criar cliente`)

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

    /* --- criar cliente, e cair na lista com a ficha aberta --- */
    await pg.evaluate(() => {
      const c = [...document.querySelectorAll('.fn-card')].find(x => x.textContent.includes('Studio Pilates Flor'))
      c.click()
    })
    await pg.waitForTimeout(1300)
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('.fn-in-acoes button')].find(x => /Criar cliente/.test(x.innerText))
      b.click()
    })
    await pg.waitForTimeout(2500)

    const depois = await pg.evaluate(() => ({
      url: location.pathname + location.search,
      ficha: !!document.querySelector('dialog[open], .gaveta'),
      texto: document.body.innerText.includes('Studio Pilates Flor'),
    }))
    conta(chamouVirar, `${tema} ${nome}: o botão chamou lead_vira_cliente no banco`)
    conta(depois.url.startsWith('/clientes'), `${tema} ${nome}: foi para a tela de clientes (${depois.url})`)
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
