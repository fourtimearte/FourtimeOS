/* O navegador com o banco de mentira das provas do depósito. Quem usa:
   testes/deposito.mjs. Fica à parte para a prova e as fotos abrirem a página
   do mesmo jeito. */
import { createRequire } from 'node:module'
import * as D from './materiais-dados.mjs'
import * as P from './deposito-dados.mjs'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado: npm i, ou npm i -g playwright')
}
export const { chromium } = pegarPlaywright()

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const json = (r, corpo, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corpo) })

/* `deposito`: 'cheio' (o do wireframe), 'vazio' (ninguém desenhou ainda) ou
   'erro' (a leitura falha). `recusa`: quantas vezes o salvar_deposito recusa
   por material que ficaria sem lugar, do jeito que a função do banco recusa. */
export async function abrir(nav, { largura, altura, tema, papel = 'admin', deposito = 'cheio', movimento = false, recusa = 0 }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: movimento ? 'no-preference' : 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1 })
  const gravados = []
  let recusas = recusa
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    if (u.includes('rpc/salvar_deposito')) {
      const a = JSON.parse(req.postData())
      gravados.push({ u: 'rpc/salvar_deposito', corpo: a })
      if (recusas > 0 && !a.p_soltar) { recusas--; return json(r, { code: 'P0001', message: 'Há 2 materiais em lugares que deixam de existir neste desenho. Confirme para deixá-los sem lugar.' }, 400) }
      return json(r, P.DEPOSITO.id)
    }
    if (u.includes('rpc/definir_lugares')) {
      const a = JSON.parse(req.postData())
      gravados.push({ u: 'rpc/definir_lugares', corpo: a })
      return json(r, a.p_materiais.length)
    }
    if (m !== 'GET') {
      let corpo = null
      try { corpo = JSON.parse(req.postData() ?? 'null') } catch { /* corpo que não é JSON */ }
      gravados.push({ u: u.split('/rest/v1/')[1] ?? u, corpo })
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
    else if (u.includes('/tecido?')) corpo = D.tecidos
    else if (u.includes('/cor_de_tecido?')) corpo = D.cores
    else if (u.includes('lugar_do_material_na_lista')) { if (deposito === 'erro') return json(r, { message: 'permission denied for view lugar_do_material_na_lista' }, 403); corpo = deposito === 'cheio' ? P.lugares : [] }
    else if (u.includes('movel_do_deposito')) corpo = deposito === 'cheio' ? P.moveis : []
    else if (u.includes('/deposito?')) { if (deposito === 'erro') return json(r, { message: 'permission denied for table deposito' }, 403); corpo = deposito === 'cheio' ? [P.DEPOSITO] : [] }
    return json(r, corpo)
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
    localStorage.setItem('ft.empresa', JSON.stringify({ nome: 'Fourtime', razaoSocial: 'Fourtime Confecções Ltda', cnpj: '45.723.174/0001-10', cidade: 'Goiânia', uf: 'GO' }))
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  /* fonte e imagem que o ambiente do teste bloqueia não são erro da página */
  const ruido = (t) => /Failed to load resource|ERR_|fonts\.g|net::/i.test(t)
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 240)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PÁGINA ' + String(e).slice(0, 240)))
  return { ctx, pg, erros, gravados }
}

export async function ir(pg, site, rota, espera) {
  await pg.goto(site + rota, { waitUntil: 'networkidle' })
  await pg.waitForSelector(espera, { timeout: 15000 })
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(700)
}
export const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
