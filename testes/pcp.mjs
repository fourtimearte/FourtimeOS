/* ==========================================================================
   O PCP CONTRA O WIREFRAME (pranchas 87 a 89; parte P1 de 11/10/2026,
   FOURTIME OS - 12, 4.0c).

   O QUE ELA CONFERE
     1. as abas No portão, Devolvidos e Liberados com as contas; a fila em
        Conferindo e Esperando o diretor, com o que está acontecendo em cada
        linha (ainda não aberto, com quem confere, devolvido pelo diretor,
        conferido por)
     2. nada escolhido: os quatro números, as Entregas mais próximas e a Mesa
        do diretor (o com falta nasce desmarcado; Aprovar pede confirmação e
        manda a liberação)
     3. o pedido escolhido: abrir anota quem confere; Marcar como conferido e
        Devolver ao vendedor (com motivo); no marcado, Aprovar para a
        produção, Devolver ao PCP e Tirar a marca
     4. Devolvidos (Voltar a conferir) e Liberados (quem aprovou)
     5. a produção confere e não aprova; o vendedor só olha
     6. antes da 063: a fila funciona e os Liberados avisam
     7. 1920, 1440, 820 e 390 nos dois temas: nada rola de lado

   Uso:  node testes/pcp.mjs http://127.0.0.1:4173
   As fotos ficam em testes/atual/pcp/, fora do repositório.
   ========================================================================== */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { cotacaoDoAtletico } from './orcamento-dados.mjs'

const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o próximo */ }
  }
  throw new Error('playwright não encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/pcp'
mkdirSync(PASTA, { recursive: true })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

/* o dia de hoje em Goiânia, e um dia daqui a n */
const dia = (n) => {
  const d = new Date(Date.now() + n * 86400000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}
const ID = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0')
const COT = (n) => '00000000-0000-4000-9000-0000000' + String(n).padStart(5, '0')
const AGORA = new Date(Date.now() - 3600000).toISOString()

const linha = (n, numero, cliente, pecas, entrega, extra = {}) => ({
  id: ID(n), numero, cotacao_id: COT(n), cliente_id: null, cliente, estado: 'pcp', aviso: '', pecas, total: pecas * 50,
  entrega_em: entrega, departamento: 'Comercial', layouts: 3, tecnicas: ['subli'], teste: false, criado_em: AGORA,
  marcado_em: null, marcado_por_nome: '', devolvido_motivo: '', devolvido_em: null, devolvido_por_nome: '', marcado: false,
  materiais: 3, faltando: 0, cotacao_numero: 'CO2026-0' + n, vendedor_nome: 'Dani', conferindo_em: null, conferindo_por_nome: '',
  com_o_vendedor: false, vendedor_motivo: '', vendedor_em: null, vendedor_por_nome: '', ...extra,
})
const FILA = [
  linha(413, 'PD004413', 'Atlético Exemplo', 186, dia(14), { conferindo_em: AGORA, conferindo_por_nome: 'Bruna' }),
  linha(409, 'PD004409', 'Banda Exemplo', 52, dia(10)),
  linha(410, 'PD004410', 'Grêmio Exemplo', 90, dia(13), { devolvido_motivo: 'Falta conferir a grade do goleiro.', devolvido_em: AGORA, devolvido_por_nome: 'Henrique', conferindo_por_nome: 'Bruna', conferindo_em: AGORA }),
  linha(401, 'PD004401', 'Auto Peças Exemplo', 36, dia(6), { marcado: true, marcado_em: AGORA, marcado_por_nome: 'Bruna' }),
  linha(405, 'PD004405', 'Clínica Exemplo', 36, dia(9), { marcado: true, marcado_em: AGORA, marcado_por_nome: 'Bruna', faltando: 1 }),
  linha(420, 'PD004420', 'Escola Exemplo', 40, dia(20), { com_o_vendedor: true, vendedor_motivo: 'O L-03 está sem etiqueta.', vendedor_em: AGORA, vendedor_por_nome: 'Bruna', conferindo_por_nome: 'Bruna', conferindo_em: AGORA }),
]
/* antes da 063: só as colunas da 032 */
const COLUNAS_032 = ['id', 'numero', 'cotacao_id', 'cliente_id', 'cliente', 'estado', 'aviso', 'pecas', 'total', 'entrega_em', 'departamento', 'layouts', 'tecnicas', 'teste', 'criado_em', 'marcado_em', 'marcado_por_nome', 'devolvido_motivo', 'devolvido_em', 'devolvido_por_nome', 'marcado', 'materiais', 'faltando']
const LIBERADOS = [
  { id: ID(398), numero: 'PD004398', cotacao_id: COT(398), cliente: 'Padaria Exemplo', estado: 'producao', etapa: 'subli', pecas: 60, total: 3000, entrega_em: dia(4), layouts: 2, tecnicas: ['subli'], teste: false, aviso: '', liberado_em: AGORA, liberado_por_nome: 'Henrique', marcado_por_nome: 'Bruna' },
  { id: ID(390), numero: 'PD004390', cotacao_id: COT(390), cliente: 'Oficina Exemplo', estado: 'pronto', etapa: 'finalizado', pecas: 30, total: 1500, entrega_em: dia(-2), layouts: 1, tecnicas: ['dtf'], teste: false, aviso: 'falta-material', liberado_em: '2026-09-20T12:00:00Z', liberado_por_nome: '', marcado_por_nome: '' },
]

const PAGINAS = ['inicio', 'funil', 'clientes', 'cotacao', 'separacao', 'pcp', 'ficha', 'kanban', 'produtos', 'estoque', 'atividades', 'relatorio', 'transporte', 'banco', 'config', 'kit']
function perfil(papel) {
  const permissoes = {}
  for (const k of PAGINAS) {
    permissoes[k] = papel === 'admin'
      ? { ver: true, editar: true, deletar: true, total: true }
      : papel === 'producao'
        ? { ver: true, editar: k === 'pcp' || k === 'kanban', deletar: false, total: false }
        : { ver: true, editar: false, deletar: false, total: false }
  }
  const nome = { admin: 'Henrique', producao: 'Bruna', vendedor: 'Dani' }[papel]
  return [{ id: '1', nome, papel, situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
}

const abertos = new Set()
async function abrir(nav, { largura, altura = 946, tema = 'light', papel = 'admin', sem063 = false }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, reducedMotion: 'reduce', hasTouch: largura < 800, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo' })
  const gravados = []
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url()); const m = req.method()
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS })
    const json = (c, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: c === null ? '' : JSON.stringify(c) })
    let corpo = []
    if (u.includes('/rest/v1/meu_perfil')) corpo = perfil(papel)
    else if (u.includes('/rest/v1/pedido_no_pcp')) corpo = sem063 ? FILA.map((l) => Object.fromEntries(COLUNAS_032.map((k) => [k, l[k]]))) : FILA
    else if (u.includes('/rest/v1/pedido_liberado')) {
      if (sem063) return json({ code: 'PGRST205', message: "Could not find the table 'public.pedido_liberado' in the schema cache" }, 404)
      corpo = LIBERADOS
    } else if (u.includes('/rest/v1/cotacao?') && u.includes('id=eq.')) {
      const id = u.split('id=eq.')[1].split('&')[0]
      corpo = [{ id, numero: 'CO2026-0131', corpo: cotacaoDoAtletico(), versao_do_formato: 6, estado: 'aprovada', criada_em: AGORA, atualizado_em: AGORA }]
    } else if (u.includes('/rest/v1/rpc/')) {
      const rpc = u.split('/rpc/')[1].split('?')[0]
      gravados.push({ rpc, corpo: req.postDataJSON() })
      if (sem063 && rpc === 'abrir_no_pcp') return json({ code: 'PGRST202', message: 'Could not find the function public.abrir_no_pcp' }, 404)
      corpo = null
    }
    return json(corpo)
  })
  await ctx.addInitScript(([t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify({ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }))
    localStorage.setItem('ft.tema', t); localStorage.setItem('ft.menu', 'aberto')
  } catch { /* segue */ } }, [tema])
  abertos.add(ctx)
  const pg = await ctx.newPage()
  pg.setDefaultTimeout(8000)
  const erros = []
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g|net::/i.test(m.text())) erros.push(m.text().slice(0, 200)) })
  pg.on('pageerror', (e) => erros.push('ERRO DA PÁGINA ' + String(e).slice(0, 200)))
  return { pg, erros, gravados }
}
const achados = []
const conta = (certo, t) => { achados.push({ certo: !!certo, t }); console.log((certo ? 'ok   ' : 'RUIM ') + t) }
async function secao(parte) {
  try { await parte() } catch (e) { conta(false, 'A PROVA PAROU NO MEIO: ' + String(e?.message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 220)) }
  for (const c of abertos) await c.close().catch(() => {})
  abertos.clear()
}
const ir = async (pg) => { await pg.goto(SITE + '/pcp', { waitUntil: 'networkidle' }); await pg.waitForSelector('.pc-fila .pc-item', { timeout: 15000 }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400) }
const texto = (pg, s) => pg.evaluate((s) => (document.querySelector(s)?.innerText ?? '').replace(/\s+/g, ' ').trim(), s)
const foto = (pg, n, cheia = true) => pg.screenshot({ path: `${PASTA}/${n}.png`, fullPage: cheia })
const sobra = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const pausa = (pg, ms = 300) => pg.waitForTimeout(ms)
const itens = (pg) => pg.evaluate(() => [...document.querySelectorAll('.pc-fila .pc-item')].map((b) => b.dataset.pedido))

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* 1 e 2: a fila e o resumo, pelo diretor */
await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  const abas = await pg.evaluate(() => [...document.querySelectorAll('.pc-abas button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
  conta(abas.join(' | ') === 'No portão 5 | Devolvidos 1 | Liberados 2', 'as abas com as contas: ' + abas.join(' | '))
  const grupos = await pg.evaluate(() => [...document.querySelectorAll('.pc-g')].map((g) => g.innerText.replace(/\s+/g, ' ').trim()))
  conta(grupos.length === 2 && /^CONFERINDO 3 · com o PCP$/i.test(grupos[0]) && /^ESPERANDO O DIRETOR 2 · já conferidos$/i.test(grupos[1]), 'Conferindo e Esperando o diretor: ' + grupos.join(' | '))
  conta((await itens(pg)).join(',') === 'PD004409,PD004410,PD004413,PD004401,PD004405', 'cada grupo pela entrega mais próxima: ' + (await itens(pg)).join(','))
  const banda = await texto(pg, '[data-pedido="PD004409"]')
  const atl = await texto(pg, '[data-pedido="PD004413"]')
  const gre = await texto(pg, '[data-pedido="PD004410"]')
  const auto = await texto(pg, '[data-pedido="PD004401"]')
  conta(/Banda Exemplo PD004409 · 52 pçs ainda não aberto \d\d\/\d\d entrega/.test(banda), 'a linha do que ninguém abriu: ' + banda)
  conta(/com Bruna/.test(atl), 'a linha diz com quem está: ' + atl)
  conta(/devolvido pelo diretor/.test(gre) && await pg.locator('[data-pedido="PD004410"] .pc-alerta').count() === 1, 'a devolução do diretor em vermelho: ' + gre)
  conta(/conferido por Bruna/.test(auto) && await pg.locator('[data-pedido="PD004401"] .pc-perto').count() === 1, 'o conferido diz por quem, e a entrega em 6 dias fica vermelha: ' + auto)
  const kpis = await pg.evaluate(() => [...document.querySelectorAll('.pc-kpis .kpi')].map((k) => k.innerText.replace(/\s+/g, ' ').trim()))
  conta(kpis.length === 4 && /^No portão 5\s*pedidos/.test(kpis[0]) && /Na mesa do diretor 2/.test(kpis[1]) && /Com diferença ou falta 2/.test(kpis[2]) && /Já atrasado 0/.test(kpis[3]), 'os quatro números: ' + kpis.join(' | '))
  const ent = await pg.evaluate(() => [...document.querySelectorAll('.pc-entregas .pc-linha')].map((l) => l.innerText.replace(/\s+/g, ' ').trim()))
  conta(ent.length === 6 && /^Auto Peças Exemplo PD004401 · 36 pçs · esperando o diretor em 6 dias/.test(ent[0]) && ent.some((x) => /Escola Exemplo .* com o vendedor/.test(x)), 'as entregas mais próximas, com em que pé está: ' + ent[0])
  conta(/contando de hoje, \d\d\/\d\d/.test(await texto(pg, '.pc-entregas .pc-cab')), 'contando de hoje')
  const mesa = await pg.evaluate(() => [...document.querySelectorAll('.pc-mesa-linha')].map((l) => [l.dataset.mesa, l.querySelector('input')?.checked]))
  conta(JSON.stringify(mesa) === JSON.stringify([['PD004401', true], ['PD004405', false]]), 'a mesa do diretor: o sem falta marcado, o com falta não: ' + JSON.stringify(mesa))
  conta(/só o diretor vê os botões/.test(await texto(pg, '.pc-mesa-diretor .pc-cab')) && /por Bruna, e um desce com falta/.test(await texto(pg, '.pc-mesa-pe')), 'a mesa diz quem conferiu e a falta: ' + (await texto(pg, '.pc-mesa-pe')).slice(0, 110))
  await foto(pg, '1920-portao', false)
  await pg.getByRole('button', { name: 'Aprovar o marcado' }).click()
  await pausa(pg, 400)
  const modal = pg.locator('dialog.modal[open]')
  conta(await modal.count() === 1 && /Descer PD004401 para a fábrica\?/.test(await modal.innerText()) && /PD004401 · Auto Peças Exemplo · 36 pçs/.test(await modal.innerText()), 'Aprovar pergunta antes, com a lista do que desce')
  await modal.getByRole('button', { name: 'Descer para a fábrica' }).click()
  await pausa(pg, 800)
  const lib = gravados.find((g) => g.rpc === 'liberar_para_producao')
  conta(lib && lib.corpo.p_pedido === ID(401) && Array.isArray(lib.corpo.p_fatias) && lib.corpo.p_fatias.length > 0, 'descer manda a liberação com as fatias da cotação (' + JSON.stringify(lib?.corpo?.p_fatias ?? []).slice(0, 80) + ')')
  /* busca e ordem */
  await pg.getByPlaceholder('Buscar pedido ou cliente').fill('gremio')
  await pausa(pg)
  conta((await itens(pg)).join(',') === 'PD004410', 'a busca sem acento acha o Grêmio')
  await pg.getByPlaceholder('Buscar pedido ou cliente').fill('')
  await pg.locator('.sel', { hasText: 'ORDEM' }).locator('button.cb').click()
  await pg.locator('[popover]:popover-open .mn-item', { hasText: 'Cliente' }).click()
  await pausa(pg)
  conta((await itens(pg)).join(',') === 'PD004413,PD004409,PD004410,PD004401,PD004405', 'a ordem por cliente: ' + (await itens(pg)).join(','))
  conta(!erros.length, 'sem erro de JavaScript: ' + erros.join(' | '))
})

/* 3: o pedido escolhido */
await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1920 })
  await ir(pg)
  await pg.locator('[data-pedido="PD004409"]').click()
  await pausa(pg, 600)
  const cab = await texto(pg, '.pc-ped-topo')
  conta(/conferindo PD004409 › CO2026-0409 Banda Exemplo 52 peças · 3 layouts · R\$\s?2\.600,00 · entrega \d\d\/\d\d, em 10 dias/.test(cab), 'o cabeçalho: estado, pedido e cotação, cliente e a linha: ' + cab.slice(0, 150))
  conta(await pg.getByRole('button', { name: 'Abrir a folha' }).count() === 1 && await pg.locator('.pc-ped-topo').getByRole('button', { name: 'Fechar' }).count() === 1, 'Abrir a folha e Fechar')
  const abriu = gravados.filter((g) => g.rpc === 'abrir_no_pcp')
  conta(abriu.length === 1 && abriu[0].corpo.p_pedido === ID(409), 'abrir o que ninguém abriu anota quem confere')
  conta(/Aprovações as duas, nesta ordem/.test(await texto(pg, '.pc-aprovacoes .pc-cab')) && /Só abre depois que o PCP marcar/.test(await texto(pg, '[data-passo="diretor"]')), 'as aprovações em ordem, e o diretor fechado até o PCP marcar')
  await foto(pg, '1920-conferindo', false)
  await pg.getByRole('button', { name: 'Devolver ao vendedor' }).click()
  await pausa(pg)
  const enviar = pg.getByRole('button', { name: 'Devolver com este motivo' })
  conta(await enviar.isDisabled(), 'sem motivo não devolve')
  await pg.getByLabel('Motivo da devolução').fill('O L-03 está sem etiqueta.')
  await enviar.click()
  await pausa(pg, 500)
  const dv = gravados.find((g) => g.rpc === 'devolver_ao_vendedor')
  conta(dv && dv.corpo.p_motivo === 'O L-03 está sem etiqueta.' && dv.corpo.p_pedido === ID(409), 'Devolver ao vendedor manda o motivo')
  await pg.getByRole('button', { name: 'Marcar como conferido' }).click()
  await pausa(pg, 500)
  conta(gravados.some((g) => g.rpc === 'marcar_para_aprovacao' && g.corpo.p_pedido === ID(409)), 'Marcar como conferido')
  /* o devolvido pelo diretor mostra o motivo */
  await pg.locator('[data-pedido="PD004410"]').click()
  await pausa(pg, 400)
  conta(/Devolvido pelo diretor \(Henrique\): Falta conferir a grade do goleiro\./.test(await texto(pg, '[data-passo="pcp"]')), 'o motivo do diretor aparece para quem confere')
  conta(gravados.filter((g) => g.rpc === 'abrir_no_pcp').length === 1, 'abrir o que já tem quem confere não anota de novo')
  /* o marcado: a vez do diretor */
  await pg.locator('[data-pedido="PD004401"]').click()
  await pausa(pg, 400)
  const dir = await texto(pg, '[data-passo="diretor"]')
  conta(/Henrique decide/.test(dir) && /Conferido por Bruna, hoje/.test(await texto(pg, '[data-passo="pcp"]')), 'no marcado, o PCP diz quem conferiu e o diretor decide: ' + dir.slice(0, 80))
  conta(await pg.getByRole('button', { name: 'Aprovar para a produção' }).count() === 1 && await pg.getByRole('button', { name: 'Devolver ao PCP' }).count() === 1 && await pg.getByRole('button', { name: 'Tirar a marca' }).count() === 1, 'Aprovar para a produção, Devolver ao PCP e Tirar a marca')
  await foto(pg, '1920-diretor', false)
  await pg.getByRole('button', { name: 'Devolver ao PCP' }).click()
  await pg.getByLabel('Motivo da devolução').fill('Confirmar a malha.')
  await pg.getByRole('button', { name: 'Devolver ao PCP com este motivo' }).click()
  await pausa(pg, 500)
  conta(gravados.some((g) => g.rpc === 'devolver_do_pcp' && g.corpo.p_motivo === 'Confirmar a malha.'), 'Devolver ao PCP manda o motivo')
  await pg.getByRole('button', { name: 'Aprovar para a produção' }).click()
  await pausa(pg, 300)
  conta(/Descer PD004401 para a fábrica\?/.test(await pg.locator('dialog.modal[open]').innerText()), 'Aprovar para a produção também pergunta antes')
  await pg.keyboard.press('Escape')
  await pausa(pg)
  /* devolvidos e liberados */
  await pg.locator('.pc-abas button', { hasText: 'Devolvidos' }).click()
  await pausa(pg)
  conta((await itens(pg)).join(',') === 'PD004420' && /com Dani: O L-03 está sem etiqueta\./.test(await texto(pg, '[data-pedido="PD004420"]')), 'Devolvidos: com quem está e por quê')
  await pg.locator('[data-pedido="PD004420"]').click()
  await pausa(pg, 400)
  conta(/com o vendedor/.test(await texto(pg, '.pc-ped-topo')) && /O L-03 está sem etiqueta\./.test(await texto(pg, '.pc-motivo')), 'o devolvido aberto mostra o motivo')
  await pg.getByRole('button', { name: 'Voltar a conferir' }).click()
  await pausa(pg, 500)
  conta(gravados.some((g) => g.rpc === 'voltar_a_conferir' && g.corpo.p_pedido === ID(420)), 'Voltar a conferir')
  await foto(pg, '1920-devolvido', false)
  await pg.locator('.pc-abas button', { hasText: 'Liberados' }).click()
  await pausa(pg)
  const libs = await pg.evaluate(() => [...document.querySelectorAll('.pc-fila .pc-item')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
  conta(libs.length === 2 && /na produção aprovado por Henrique/.test(libs[0]) && /pronto aprovado antes do registro/.test(libs[1]), 'Liberados: o estado de agora e quem aprovou: ' + libs.join(' | '))
  await pg.locator('[data-pedido="PD004398"]').click()
  await pausa(pg, 400)
  conta(/Aprovado por Henrique, hoje/.test(await texto(pg, '.pc-aprovacoes')) && /Conferido por Bruna/.test(await texto(pg, '.pc-aprovacoes')), 'o liberado aberto: quem conferiu e quem aprovou')
  conta(!erros.length, 'sem erro de JavaScript (pedido): ' + erros.join(' | '))
})

/* 5: a produção confere e não aprova; o vendedor só olha */
await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1440, papel: 'producao' })
  await ir(pg)
  conta(await pg.locator('.pc-mesa-diretor input').count() === 0 && await pg.getByRole('button', { name: /^Aprovar/ }).count() === 0 && /quem aprova é o diretor/.test(await texto(pg, '.pc-mesa-diretor .pc-cab')), 'a produção vê a mesa do diretor sem caixa nem Aprovar')
  await pg.locator('[data-pedido="PD004401"]').click()
  await pausa(pg, 400)
  conta(await pg.getByRole('button', { name: 'Aprovar para a produção' }).count() === 0 && await pg.getByRole('button', { name: 'Tirar a marca' }).count() === 1 && /O diretor decide/.test(await texto(pg, '[data-passo="diretor"]')), 'no marcado, a produção só tira a marca')
  await pg.locator('[data-pedido="PD004409"]').click()
  await pausa(pg, 400)
  conta(gravados.some((g) => g.rpc === 'abrir_no_pcp') && await pg.getByRole('button', { name: 'Marcar como conferido' }).count() === 1, 'a produção abre para conferir e marca')
  await foto(pg, '1440-producao', false)
  conta(!erros.length, 'sem erro de JavaScript (produção): ' + erros.join(' | '))
})
await secao(async () => {
  const { pg, erros, gravados } = await abrir(nav, { largura: 1440, papel: 'vendedor' })
  await ir(pg)
  await pg.locator('[data-pedido="PD004409"]').click()
  await pausa(pg, 400)
  conta(!gravados.some((g) => g.rpc === 'abrir_no_pcp') && await pg.locator('.pc-aprovacoes button').count() === 0, 'o vendedor abre só para ler: nada é anotado e não há botão')
  conta(!erros.length, 'sem erro de JavaScript (vendedor): ' + erros.join(' | '))
})

/* 6: antes da 063 */
await secao(async () => {
  const { pg, erros } = await abrir(nav, { largura: 1440, sem063: true })
  await ir(pg)
  conta((await itens(pg)).length === 6 && /Devolvidos 0/.test(await texto(pg, '.pc-abas')), 'antes da 063: a fila inteira no portão, sem devolvidos')
  await pg.locator('[data-pedido="PD004409"]').click()
  await pausa(pg, 400)
  conta(/Marcar como conferido/.test(await texto(pg, '.pc-aprovacoes')), 'antes da 063: o pedido abre e o PCP marca')
  await pg.locator('.pc-abas button', { hasText: 'Liberados' }).click()
  await pausa(pg)
  conta(/Falta rodar a migração 063/.test(await texto(pg, '.pc-fila')), 'antes da 063: os Liberados dizem o que falta')
  conta(!erros.length, 'sem erro de JavaScript (antes da 063): ' + erros.join(' | '))
})

/* 7: as larguras */
for (const tema of ['light', 'dark']) {
  for (const [largura, altura] of [[1920, 946], [1440, 900], [820, 1180], [390, 844]]) {
    await secao(async () => {
      const { pg, erros } = await abrir(nav, { largura, altura, tema })
      await ir(pg)
      conta(await sobra(pg) <= 0, `${largura} ${tema}: nada rola de lado (${await sobra(pg)})`)
      await foto(pg, `${largura}-${tema}`)
      await pg.locator('[data-pedido="PD004401"]').click()
      await pausa(pg, 400)
      conta(await sobra(pg) <= 0, `${largura} ${tema}: com o pedido aberto, nada rola de lado (${await sobra(pg)})`)
      await foto(pg, `${largura}-${tema}-pedido`)
      conta(!erros.length, `sem erro de JavaScript (${largura} ${tema}): ` + erros.join(' | '))
    })
  }
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram`)
process.exit(ruins.length ? 1 : 0)
