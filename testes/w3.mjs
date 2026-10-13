/* ==========================================================================
   O REGISTRO DO WHATSAPP NO LEAD (W3) E O VIGIA DA EXTENSAO (0.6.0, 078).

   Com a extensao de verdade carregada, o Fourtime OS local e um WhatsApp de
   mentira com uma conversa do lead L1 (62 99999-0001) aberta, o teste confere:

     1. o topo do painel diz que a conversa fica registrada no lead
     2. a pagina grava no lead as mensagens da tela: duas do cliente (texto e
        audio como fato) e uma nossa, com a hora lida do WhatsApp; a so de
        emoji fica de fora; o nome do contato nao vai
     3. a leitura seguinte (15 s) nao manda de novo o que ja foi
     4. trocando para uma conversa que NAO e de lead, nada e pedido nem gravado
     5. o vigia: sem o campo de escrever, pedir para escrever grava o erro
        "campo-de-escrever" com o esqueleto do rodape, sem texto nenhum
     5b. (0.6.1) canal e lista de transmissao (@newsletter, @broadcast) nao
        disparam o vigia; um data-id de formato novo dispara, com a FORMA dele
        sem numero nem codigo
     6. sem a 078 no banco, o topo avisa e para de tentar
     7. sem erro de JavaScript

   Uso:  node testes/w3.mjs http://127.0.0.1:4173
   ========================================================================== */
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = (() => {
  for (const o of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(o) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
})()
const SITE = process.argv[2] || 'http://127.0.0.1:4173'
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

const VERSAO = JSON.parse(readFileSync(resolve('extensao/manifest.json'), 'utf8')).version
const EXT = mkdtempSync(join(tmpdir(), 'ext-'))
cpSync(resolve('extensao'), EXT, { recursive: true })
writeFileSync(join(EXT, 'config.js'), "self.FOURTIME = { supabase: 'https://ensaio.supabase.co', chave: 'ensaio', sistema: '" + SITE + "' }\n")
const PERFIL_DIR = mkdtempSync(join(tmpdir(), 'perfil-'))
mkdirSync(join(PERFIL_DIR, 'Default'), { recursive: true })
writeFileSync(join(PERFIL_DIR, 'Default', 'Preferences'), JSON.stringify({ extensions: { ui: { developer_mode: true } } }))

async function rodada(comBanco) {
  const ctx = await chromium.launchPersistentContext(PERFIL_DIR + (comBanco ? '' : '-sem'), {
    channel: 'chromium', headless: true, viewport: { width: 1600, height: 950 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })
  const PAG = ['inicio', 'funil', 'clientes', 'cotacao']
  const perm = {}; PAG.forEach((k) => (perm[k] = { ver: true, editar: true, deletar: true, total: true }))
  const PERFIL = [{ id: '1', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: PAG, permissoes: perm, email: 't@f', foto_em: null }]
  const WA = `<!doctype html><html><body><div id="app"><div id="pane-side"></div><div id="main">
    <header><span title="Rafa Futsal" dir="auto">Rafa Futsal</span></header>
    <div class="msgs">
      <div data-id="false_5562999990001@c.us_AAA1"><div data-pre-plain-text="[14:30, 13/10/2026] Rafa Futsal: "><span class="selectable-text"><span>Oi, quanto fica 18 camisas?</span></span></div></div>
      <div data-id="false_5562999990001@c.us_AAA2"><span data-icon="audio-play"></span><audio></audio></div>
      <div data-id="true_5562999990001@c.us_AAA3"><div data-pre-plain-text="[2:35 PM, 10/13/2026] Henrique: "><span class="selectable-text">Fica R$ 1.200,00</span></div></div>
      <div data-id="false_5562999990001@c.us_AAA4"><img class="emoji" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>
    </div>
    <footer><div contenteditable="true" data-tab="10" aria-label="Digite uma mensagem para Rafa"></div><button aria-label="Enviar"><span data-icon="send"></span></button></footer>
  </div></div></body></html>`
  await ctx.route('https://web.whatsapp.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: WA }))
  const rpc = { conversa: [], erro: [] }
  await ctx.route('**supabase.co/**', (r) => {
    const req = r.request(); const u = req.url()
    if (u.includes('rpc/registrar_conversa_do_whatsapp')) {
      if (!comBanco) return r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.registrar_conversa_do_whatsapp' }) })
      const b = JSON.parse(req.postData() || '{}'); rpc.conversa.push(b)
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: String(b.p_mensagens.length) })
    }
    if (u.includes('rpc/registrar_erro_da_extensao')) {
      rpc.erro.push(JSON.parse(req.postData() || '{}'))
      return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' })
    }
    const corpo = u.includes('meu_perfil') ? PERFIL
      : u.includes('/lead?') ? [{ id: 'L1', nome: 'Futsal Vila Nova', contato: 'Rafa', telefone: '62999990001', estagio: 'novo', valor: 1620, ultima_msg_em: new Date().toISOString(), nao_lidas: 0, teste: true, equipe: null, cotacao: [], pedido: [] }]
      : []
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript((c) => { try { localStorage.setItem('ft.sessao', JSON.stringify(c)) } catch { /* sem */ } }, { acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' })
  const erros = []
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => erros.push(e.message))
  await pg.goto(SITE + '/funil', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(1000)
  await pg.locator('button:has(.fn-modo)').nth(1).click()
  await pg.waitForTimeout(3500)
  return { ctx, pg, rpc, erros }
}

/* ---------- com a 078 no banco ---------- */
{
  const { ctx, pg, rpc, erros } = await rodada(true)
  const topo = await pg.locator('.fn-wa-status').first().innerText().catch(() => '')
  conta(/fica registrada no lead/.test(topo), '1. o topo diz que a conversa fica registrada no lead (' + topo.replace(/\s+/g, ' ') + ')')
  const diario = await pg.evaluate(() => window.__ftWhatsApp?.cargas ?? [])
  conta(diario.length === 1 && diario[0].carga === 'navigate', '   o diario das cargas anota a primeira, como navigate (' + JSON.stringify(diario) + ')')

  /* 0.6.2: a coluna e so da aba do WhatsApp, e nao do navegador inteiro */
  const [sw] = ctx.serviceWorkers()
  const wa = await ctx.newPage()
  await wa.goto('https://web.whatsapp.com/')
  await wa.waitForTimeout(1500)
  const opcoes = await sw.evaluate(async () => {
    const abas = await chrome.tabs.query({})
    const daAba = async (pedaco) => { const a = abas.find((x) => (x.url || '').includes(pedaco)); return a ? chrome.sidePanel.getOptions({ tabId: a.id }) : null }
    return { geral: await chrome.sidePanel.getOptions({}), whatsapp: await daAba('web.whatsapp.com'), sistema: await daAba('/funil') }
  })
  conta(opcoes.geral.enabled === false && opcoes.whatsapp?.enabled === true && opcoes.whatsapp?.path === 'lado.html' && opcoes.sistema?.enabled === false,
    '   a coluna: desligada no geral e no sistema, ligada so na aba do WhatsApp (' + JSON.stringify(opcoes) + ')')
  await wa.close()
  await pg.bringToFront()

  const primeira = rpc.conversa[0]
  const ms = primeira?.p_mensagens ?? []
  const resumo = ms.map((m) => `${m.eu ? 'nos' : 'cliente'}:${m.tipo}:${m.texto}`).join(' | ')
  const horaCerta = ms[0] && new Date(ms[0].em).getHours() === 14 && new Date(ms[0].em).getMinutes() === 30
  const horaAmPm = ms[2] && new Date(ms[2].em).getHours() === 14 && new Date(ms[2].em).getMinutes() === 35 && new Date(ms[2].em).getDate() === 13
  conta(primeira?.p_lead === 'L1' && ms.length === 3 && ms[0].tipo === 'texto' && ms[1].tipo === 'audio' && ms[1].texto === '' && ms[2].eu === true && horaCerta && horaAmPm
    && !JSON.stringify(primeira).includes('Rafa Futsal'),
    `2. grava no lead L1 as 3 da tela (o emoji sozinho fica de fora), com a hora do WhatsApp e sem o nome do contato (${resumo})`)

  await pg.waitForTimeout(16_000)
  conta(rpc.conversa.length === 1, `3. a leitura seguinte nao manda de novo o que ja foi (${rpc.conversa.length} gravacao)`)

  /* 4. outra conversa, de quem nao e lead */
  const quadro = () => pg.frames().find((f) => f.url().startsWith('https://web.whatsapp.com'))
  await quadro().evaluate(() => {
    document.querySelector('header span').setAttribute('title', 'Mae')
    document.querySelector('header span').textContent = 'Mae'
    document.querySelector('.msgs').innerHTML = '<div data-id="false_5511988887777@c.us_BBB1"><div data-pre-plain-text="[15:00, 13/10/2026] Mae: "><span class="selectable-text">conversa pessoal</span></div></div>'
  })
  await pg.waitForTimeout(17_000)
  const pessoal = JSON.stringify(rpc.conversa).includes('conversa pessoal')
  const topo2 = await pg.locator('.fn-wa-status').first().innerText().catch(() => '')
  conta(!pessoal && rpc.conversa.length === 1 && !/registrada/.test(topo2), `4. conversa de quem nao e lead: nada pedido nem gravado, e o topo nao fala em registro (${rpc.conversa.length})`)

  /* 5. o vigia: o WhatsApp mudou e o campo de escrever sumiu */
  await quadro().evaluate(() => {
    document.querySelector('.msgs').innerHTML = '<div data-id="false_5562999990001@c.us_AAA1"><div data-pre-plain-text="[14:30, 13/10/2026] Rafa Futsal: "><span class="selectable-text">Oi, quanto fica 18 camisas?</span></div></div>'
    document.querySelector('footer [contenteditable]').remove()
  })
  await pg.waitForTimeout(1200)
  await pg.evaluate(() => document.querySelector('.fn-wa-frame').contentWindow.postMessage({ fourtime: 'pedido', tipo: 'escrever', jid: '5562999990001@c.us', telefone: '5562999990001', texto: 'teste', enviar: false, marca: 7 }, 'https://web.whatsapp.com'))
  await pg.waitForTimeout(1500)
  const e = rpc.erro.find((x) => x.p_onde === 'campo-de-escrever')
  const esq = JSON.stringify(e?.p_estrutura ?? null)
  conta(!!e && e.p_versao === VERSAO && /"t":"footer"/.test(esq) && /"c":"send"/.test(esq) && !/Rafa|Digite|camisas|Enviar/.test(esq),
    `5. o vigia grava "campo-de-escrever" com o esqueleto do rodape, sem texto (${esq.slice(0, 140)})`)

  /* 5b. o canal nao e alarme; o formato novo e, com a forma sem numero */
  const conferir = () => pg.evaluate(() => document.querySelector('.fn-wa-frame').contentWindow.postMessage({ fourtime: 'pedido', tipo: 'conferir' }, 'https://web.whatsapp.com'))
  await quadro().evaluate(() => {
    document.querySelector('.msgs').innerHTML = '<div data-id="false_120363041234567890@newsletter_3EB0ABCDEF1234567890"><span class="selectable-text">post do canal</span></div>'
  })
  await pg.waitForTimeout(800)
  await conferir(); await pg.waitForTimeout(800)
  const doCanal = rpc.erro.filter((x) => x.p_onde === 'identidade-da-conversa').length
  await quadro().evaluate(() => {
    document.querySelector('.msgs').innerHTML = '<div data-id="msg:5562999990001:3EB0ABCDEF1234567890"><span class="selectable-text">formato novo</span></div>'
  })
  await pg.waitForTimeout(800)
  await conferir(); await pg.waitForTimeout(1000)
  const novo = rpc.erro.find((x) => x.p_onde === 'identidade-da-conversa')
  const formas = JSON.stringify(novo?.p_estrutura?.formas ?? null)
  conta(doCanal === 0 && !!novo && /msg:X:X/.test(formas) && !/5562|3EB0|formato novo/.test(JSON.stringify(novo.p_estrutura)),
    `5b. canal nao dispara; formato novo dispara com a forma sem numero (${formas})`)
  conta(!erros.length, '7. sem erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}

/* ---------- sem a 078 no banco ---------- */
{
  const { ctx, pg, rpc, erros } = await rodada(false)
  await pg.waitForTimeout(1500)
  const topo = await pg.locator('.fn-wa-status').first().innerText().catch(() => '')
  await pg.waitForTimeout(16_000)
  conta(/ainda não está ligado/.test(topo) && rpc.conversa.length === 0, '6. sem a 078, o topo avisa e para de tentar (' + topo.replace(/\s+/g, ' ') + ')')
  conta(!erros.length, '   sem erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}

console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
