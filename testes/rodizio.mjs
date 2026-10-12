/* ==========================================================================
   O RODIZIO DOS LEADS E QUEM RECEBE O LEAD DO SITE (12/10/2026), na pagina
   Configuracoes, com o banco de mentira: a fila na ordem, de quem e a vez
   (quem levou menos), tirar e por na fila, mudar de lugar, zerar a contagem
   com pergunta, e a regra do lead do site em Pessoa fixa ou Rodizio.
   Fotos em 1440 e 390, nos dois temas.

   Uso:  node testes/rodizio.mjs http://127.0.0.1:4173
   ========================================================================== */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/fotos'
mkdirSync(PASTA, { recursive: true })

const PAGINAS = ['inicio', 'config']
const permissoes = {}; PAGINAS.forEach((k) => (permissoes[k] = { ver: true, editar: true, deletar: true, total: true }))
const PERFIL = [{ id: 'A0', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
const pessoa = (id, nome, papel) => ({ id, nome, email: nome.toLowerCase().replace(/\s/g, '') + '@f', papel, situacao: 'aprovado', paineis: null, criado_em: '2026-09-01T10:00:00Z', aprovado_em: '2026-09-01T10:00:00Z', foto_em: null })
const EQUIPE = [pessoa('A0', 'Henrique', 'admin'), pessoa('V1', 'Dani Ribeiro', 'vendedor'), pessoa('V2', 'Lucas Garcia', 'vendedor'), pessoa('V3', 'Rafa Lima', 'vendedor'), pessoa('P1', 'Bruna da Produção', 'producao')]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir({ tema, larg, alt }) {
  /* a fila: Dani levou 4, Lucas 2 (a vez e dele), Rafa esta fora */
  const fila = [
    { pessoa_id: 'V1', ordem: 1, ativo: true, levou: 4, ultimo_em: '2026-10-11T15:00:00Z' },
    { pessoa_id: 'V2', ordem: 2, ativo: true, levou: 2, ultimo_em: '2026-10-10T15:00:00Z' },
    { pessoa_id: 'V3', ordem: 3, ativo: false, levou: 1, ultimo_em: null },
  ]
  const regra = { modo: 'pessoa_fixa', pessoa_id: 'V1' }
  const gravados = []
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, reducedMotion: 'reduce', hasTouch: larg < 1024 })
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    let corpo = []
    let dados = null; try { dados = JSON.parse(req.postData() ?? 'null') } catch { /* sem corpo */ }
    if (u.includes('meu_perfil')) corpo = PERFIL
    else if (u.includes('/pessoa?')) corpo = EQUIPE
    else if (u.includes('/rodizio')) {
      if (m === 'POST') {
        gravados.push({ u: 'rodizio', m, dados })
        for (const d of dados) { const f = fila.find((x) => x.pessoa_id === d.pessoa_id); if (f) Object.assign(f, d); else fila.push({ levou: 0, ultimo_em: null, ...d }) }
        corpo = dados
      } else if (m === 'PATCH') { gravados.push({ u: 'rodizio', m, dados }); fila.forEach((f) => (f.levou = 0)); corpo = null }
      else corpo = [...fila].sort((a, b) => a.ordem - b.ordem)
    }
    else if (u.includes('/regra_do_lead_do_site')) {
      if (m === 'PATCH') { gravados.push({ u: 'regra', dados }); Object.assign(regra, dados); corpo = [regra] }
      else corpo = [regra]
    }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: corpo === null ? '' : JSON.stringify(corpo) })
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
  } catch { /* sem armazenamento */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  await pg.goto(SITE + '/config', { waitUntil: 'networkidle' })
  await pg.waitForSelector('.cfg-rod-lista', { timeout: 15000 })
  await pg.waitForTimeout(500)
  return { ctx, pg, erros, gravados, fila }
}

const linhas = (pg) => pg.evaluate(() => [...document.querySelectorAll('.cfg-rod-lin')].map((l) => l.innerText.replace(/\s+/g, ' ').trim()))

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440, 900, 'computador'], [390, 844, 'celular']]) {
    const { ctx, pg, erros, gravados } = await abrir({ tema, larg, alt })
    const T = `${tema} ${nome}:`
    const rola = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    conta(!rola, `${T} a página não rola de lado`)
    const ls = await linhas(pg)
    conta(ls.length === 4 && /^1 Dani Ribeiro levou 4 leads/.test(ls[0]) && /^2 Lucas Garcia é a vez levou 2 leads/.test(ls[1]) && /^- Henrique nunca entrou na fila/.test(ls[2]) && /^- Rafa Lima levou 1 lead/.test(ls[3]), `${T} a fila na ordem, a vez de quem levou menos, quem está fora no fim (${ls.join(' | ')})`)
    conta(!ls.some((l) => /Bruna/.test(l)), `${T} quem não vende (produção) não aparece`)
    await pg.locator('.cfg-rod').scrollIntoViewIfNeeded()
    await pg.screenshot({ path: `${PASTA}/rodizio-${tema}-${nome}.png`, fullPage: true })
    if (tema === 'light' && nome === 'computador') {
      /* mudar de lugar: Lucas sobe, Dani desce; grava as duas ordens */
      await pg.locator('.cfg-rod-lin button[aria-label="Subir Lucas Garcia"]').click()
      await pg.waitForTimeout(500)
      const subiu = gravados.filter((g) => g.u === 'rodizio' && g.m === 'POST').flatMap((g) => g.dados)
      conta(subiu.length === 2 && subiu.some((d) => d.pessoa_id === 'V2' && d.ordem === 1) && subiu.some((d) => d.pessoa_id === 'V1' && d.ordem === 2), 'subir troca as duas ordens (' + JSON.stringify(subiu) + ')')
      conta(/^1 Lucas Garcia/.test((await linhas(pg))[0]), 'a lista relê e mostra o Lucas em primeiro')
      /* por o Rafa na fila: entra no fim */
      gravados.length = 0
      await pg.locator('.cfg-rod-lin', { hasText: 'Rafa Lima' }).locator('[role=switch], .interruptor, button').last().click()
      await pg.waitForTimeout(500)
      const entrou = gravados.flatMap((g) => g.dados ?? [])
      conta(entrou.length === 1 && entrou[0].pessoa_id === 'V3' && entrou[0].ativo === true && entrou[0].ordem === 3, 'ligar põe na fila, no fim (' + JSON.stringify(entrou) + ')')
      conta(/^3 Rafa Lima é a vez/.test((await linhas(pg))[2]), 'o Rafa levou menos (1): passa a ser a vez dele')
      /* zerar pergunta antes */
      gravados.length = 0
      await pg.locator('.cfg-rod button', { hasText: 'Zerar a contagem' }).click()
      await pg.waitForTimeout(300)
      conta(await pg.locator('dialog[open]', { hasText: 'Zerar a contagem do rodízio?' }).count() === 1 && !gravados.length, 'zerar pergunta antes, e nada é gravado ainda')
      await pg.locator('dialog[open] button', { hasText: /^Zerar$/ }).click()
      await pg.waitForTimeout(500)
      conta(gravados.length === 1 && gravados[0].m === 'PATCH' && gravados[0].dados.levou === 0, 'Zerar recomeça a contagem de todos')
      /* o lead do site em rodizio */
      gravados.length = 0
      await pg.locator('.cfg-lead-do-site .seg button', { hasText: 'Rodízio' }).click()
      await pg.waitForTimeout(500)
      conta(gravados.length === 1 && gravados[0].u === 'regra' && gravados[0].dados.modo === 'rodizio', 'o lead do site passa a seguir o rodízio (' + JSON.stringify(gravados) + ')')
      conta(/quem é a vez na fila/.test(await pg.locator('.cfg-lead-do-site').innerText()) && await pg.locator('.cfg-lead-do-site .campo').count() === 0, 'em rodízio, sai a pessoa fixa e entra a explicação da fila')
    }
    conta(!erros.length, `${T} sem erro de JavaScript (${erros.join(' | ')})`)
    await ctx.close()
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} certos`)
process.exit(ruins.length ? 1 : 0)
