/* O navegador com o banco de mentira das provas do depósito. Quem usa:
   testes/deposito.mjs. Fica à parte para a prova e as fotos abrirem a página
   do mesmo jeito. */
import { createRequire } from 'node:module'
import * as D from './materiais-dados.mjs'
import * as P from './deposito-dados.mjs'
import * as E from './estoque-dados.mjs'
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

/* `deposito`: 'cheio' (o do wireframe), 'nove' (o mesmo, com a prateleira D em
   nove níveis e material do 1 ao 9 no vão D2), 'esticado' (a grade puxada pelo canto
   até ocupar o chão, sem lugar marcado), 'vazio' (ninguém desenhou ainda) ou
   'erro' (a leitura falha). `recusa`: quantas vezes o salvar_deposito recusa
   por material que ficaria sem lugar, do jeito que a função do banco recusa. */
/* `estoque`: 'cheio' (a hierarquia do catálogo e a fila da separação da página
   Materiais), 'sem-apoio' (as duas leituras falham, e a página tem de
   continuar de pé) ou 'grande' (um tecido de trinta cores e um grupo com seis
   tecidos, para ver que nada estoura). */
/* `arquivada`: o cadastro de material novo encontra um arquivado igual. */
export async function abrir(nav, { largura, altura, tema, papel = 'admin', deposito = 'cheio', movimento = false, recusa = 0, estoque = 'cheio', uso = 'cheio', arquivada = false }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: movimento ? 'no-preference' : 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1 })
  const gravados = []
  /* o fornecedor criado no teste aparece na lista seguinte, como no banco */
  const criados = []
  const coresCriadas = []
  const coresMudadas = {}
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
    if (u.includes('rpc/uso_do_estoque')) {
      if (uso === 'erro') return json(r, { message: 'permission denied for function uso_do_estoque' }, 403)
      return json(r, uso === 'vazio' ? [] : E.usos)
    }
    if (u.includes('rpc/definir_cadastro')) {
      const a = JSON.parse(req.postData())
      gravados.push({ u: 'rpc/definir_cadastro', corpo: a })
      if (recusas > 0) { recusas--; return json(r, { code: '23514', message: 'A composição soma 90%, e tem de somar 100.' }, 400) }
      return json(r, a.p_materiais.length)
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
      const novoId = 'novo-' + gravados.length
      /* a cor criada ou mudada no cadastro aparece na leitura seguinte, como no banco */
      if (m === 'POST' && /\/cor_de_tecido(\?|$)/.test(u) && Array.isArray(corpo)) coresCriadas.push({ id: novoId, ordem: 999, ativo: true, ...corpo[0] })
      if (m === 'PATCH' && /\/cor_de_tecido\?id=eq\./.test(u) && corpo) { const qual = u.match(/id=eq\.([^&]+)/)[1]; coresMudadas[qual] = { ...(coresMudadas[qual] ?? {}), ...corpo }; return json(r, [{ id: qual, ...corpo }]) }
      if (m === 'POST' && /\/fornecedor\?/.test(u) && corpo && !Array.isArray(corpo)) criados.push({ ...D.fornecedores[0], id: novoId, nome: corpo.nome, cnpj: corpo.cnpj ?? null, situacao: 'novo', gravada: 'novo', tipos: [] })
      return json(r, u.includes('rpc/') ? {} : [{ id: novoId }])
    }
    let corpo = []
    if (u.includes('meu_perfil')) corpo = D.perfil(papel)
    /* o material arquivado que o cadastro procura antes de criar um novo */
    else if (/\/material\?select=id&ativo=is\.false/.test(u)) corpo = arquivada ? [{ id: 'arquivado-1' }] : []
    else if (u.includes('material_na_prateleira')) corpo = E.comFicha(estoque === 'grande' ? [...D.materiais, ...E.coresAMais, ...E.materiaisDosTecidosAMais] : estoque === 'folgado' ? D.materiais.map((x) => ({ ...x, saldo: Number(x.minimo) * 3 + 5, reservado: 0, livre: Number(x.minimo) * 3 + 5, abaixo_do_minimo: false })) : estoque === 'sem-minimo' ? D.materiais.map((x) => ({ ...x, minimo: 0, saldo: 5, reservado: 0, livre: 5, abaixo_do_minimo: false })) : D.materiais)
    else if (u.includes('movimento_do_estoque')) corpo = D.movimentos
    else if (u.includes('reserva_em_aberto')) corpo = D.reservas
    else if (u.includes('fornecedor_na_lista')) corpo = [...D.fornecedores, ...criados]
    else if (u.includes('material_fornecedor')) corpo = E.ligacoes
    else if (u.includes('grupo_de_tecido')) { if (estoque === 'sem-apoio') return json(r, { message: 'permission denied for table grupo_de_tecido' }, 403); corpo = E.gruposDeTecido }
    else if (u.includes('pedido_na_separacao')) { if (estoque === 'sem-apoio') return json(r, { message: 'permission denied for view pedido_na_separacao' }, 403); corpo = E.fila }
    else if (u.includes('reserva_do_pedido')) { const id = (u.match(/pedido_id=eq\.([^&]+)/) ?? [])[1]; corpo = E.reservasDoPedido.filter((x) => x.pedido_id === id) }
    else if (u.includes('tipo_de_fornecedor')) corpo = D.tipos
    else if (u.includes('/tecido?')) corpo = (estoque === 'grande' ? [...E.tecidos, ...E.tecidosAMais] : E.tecidos).filter((t) => !u.includes('ativo=is.true') || t.ativo)
    else if (u.includes('/cor_de_tecido?')) corpo = [...E.coresDoCatalogo.map((c) => ({ ...c, ...(coresMudadas[c.id] ?? {}) })), ...coresCriadas.map((c) => ({ ...c, ...(coresMudadas[c.id] ?? {}) }))]
    else if (u.includes('grupo_de_cor')) corpo = E.gruposDeCor
    else if (u.includes('lugar_do_material_na_lista')) { if (deposito === 'erro') return json(r, { message: 'permission denied for view lugar_do_material_na_lista' }, 403); corpo = deposito === 'cheio' ? P.lugares : deposito === 'nove' ? P.lugaresDeNove : [] }
    else if (u.includes('movel_do_deposito')) corpo = deposito === 'cheio' ? P.moveis : deposito === 'nove' ? P.moveisDeNove : deposito === 'esticado' ? P.moveisEsticados : []
    else if (u.includes('/deposito?')) { if (deposito === 'erro') return json(r, { message: 'permission denied for table deposito' }, 403); corpo = deposito === 'cheio' || deposito === 'nove' || deposito === 'esticado' ? [P.DEPOSITO] : [] }
    return json(r, corpo)
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
    localStorage.setItem('ft.empresa', JSON.stringify({ nome: 'Fourtime', razaoSocial: 'Fourtime Confecções Ltda', cnpj: '45.723.174/0001-10', cidade: 'Goiânia', uf: 'GO' }))
  } catch { /* sem armazenamento, segue */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  /* o que não aparece em 8 segundos não vai aparecer: sem isto, um seletor que
     mudou de nome segura o caso por 30 segundos, e o teste inteiro por minutos */
  pg.setDefaultTimeout(8000)
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
