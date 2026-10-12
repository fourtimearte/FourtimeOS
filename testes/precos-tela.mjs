/* ==========================================================================
   AS TABELAS DE PREÇO NA TELA (pranchas 134, 135 e 138), com o banco de
   mentira: a página, a grade (regra, à mão, kit pela soma), escrever numa
   célula, mudar em lote, salvar, a tabela nova, a folha impressa, e o aviso
   de antes da 068. Fotos em 1440, 820 e 390, nos dois temas.

   Uso:  node testes/precos-tela.mjs http://127.0.0.1:4173
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

const PAGINAS = ['inicio', 'cotacao', 'produtos']
const permissoes = {}; PAGINAS.forEach((k) => (permissoes[k] = { ver: true, editar: true, deletar: true, total: true }))
const perfil = (papel) => [{ id: '1', nome: 'Henrique', papel, situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]

const ITENS = [
  { codigo: 'CT01', tipo: 'referencia', base: 49.9, precos: [null, null, null, null] },
  { codigo: 'CT02', tipo: 'referencia', base: 54.9, precos: [null, 48.9, null, null] },
  { codigo: 'SH01', tipo: 'referencia', base: 39.9, precos: [null, null, null, null] },
  { codigo: 'KT01', tipo: 'kit', base: null, precos: [null, null, null, null] },
]
const FAIXAS = [{ de: 10, ate: 20 }, { de: 21, ate: 50 }, { de: 51, ate: 100 }, { de: 101, ate: null }]
const REGRAS = { passo_pct: -10, arredondar: '90', plus_reais: 6, infantil_pct: -10, kit_pct: -8 }
const tabelasIniciais = () => [
  { id: 'T1', nome: 'Atacado 2026', situacao: 'ativa', padrao: true, vale_ate: '2026-12-31', so_gerente: false, faixas: FAIXAS, regras: REGRAS, itens: ITENS, observacao: '', teste: true, atualizado_em: new Date().toISOString() },
  { id: 'T2', nome: 'Varejo 2026', situacao: 'ativa', padrao: false, vale_ate: null, so_gerente: false, faixas: FAIXAS, regras: REGRAS, itens: ITENS.slice(0, 2), observacao: '', teste: true, atualizado_em: new Date().toISOString() },
  { id: 'T3', nome: 'Licitação velha', situacao: 'arquivada', padrao: false, vale_ate: null, so_gerente: true, faixas: FAIXAS, regras: REGRAS, itens: [], observacao: '', teste: true, atualizado_em: new Date().toISOString() },
]
const GRUPOS = [{ cod: 'CAM', nome: 'Camisetas', ordem: 1 }, { cod: 'SHO', nome: 'Shorts', ordem: 2 }]
const REFS = [
  { id: 'r1', cod: 'CT01', nome: 'Camiseta tradicional dry', grupo: 'CAM', genero: 'U', ordem: 1, ativo: true },
  { id: 'r2', cod: 'CT02', nome: 'Camiseta raglan dry', grupo: 'CAM', genero: 'U', ordem: 2, ativo: true },
  { id: 'r3', cod: 'SH01', nome: 'Short esportivo', grupo: 'SHO', genero: 'M', ordem: 3, ativo: true },
  { id: 'r4', cod: 'RG01', nome: 'Regata dry', grupo: 'CAM', genero: 'F', ordem: 4, ativo: true },
]
const KITS = [{ id: 'k1', cod: 'KT01', nome: 'Kit camiseta e short', genero: 'U', ativo: true, ficha_em: null, pecas: 2, pecas_cod: ['CT01', 'SH01'], pecas_sem_tecido: 0, pecas_sem_etiqueta: 0, tem_desenho: false }]

const nav = await chromium.launch()
const achados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir({ tema, larg, alt, papel = 'admin', semBanco = false, tabelas = null }) {
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, reducedMotion: 'reduce', hasTouch: larg < 1024 })
  const estado = { tabelas: tabelas ?? tabelasIniciais(), gravado: null, criado: null, padrao: null }
  await ctx.route('**supabase.co/**', async (r) => {
    const req = r.request(); const u = req.url(); const m = req.method()
    let corpo = []
    let status = 200
    if (u.includes('meu_perfil')) corpo = perfil(papel)
    else if (u.includes('rpc/tabela_de_preco_padrao')) {
      estado.padrao = JSON.parse(req.postData() || '{}').p_id
      estado.tabelas = estado.tabelas.map((t) => ({ ...t, padrao: t.id === estado.padrao }))
      corpo = null
    } else if (u.includes('/tabela_de_preco')) {
      if (semBanco) { status = 404; corpo = { code: 'PGRST205', message: "Could not find the table 'public.tabela_de_preco' in the schema cache" } }
      else if (m === 'PATCH') {
        const id = /id=eq\.([^&]+)/.exec(u)?.[1]
        estado.gravado = JSON.parse(req.postData() || '{}')
        estado.tabelas = estado.tabelas.map((t) => (t.id === id ? { ...t, ...estado.gravado, atualizado_em: new Date().toISOString() } : t))
        corpo = estado.tabelas.filter((t) => t.id === id)
      } else if (m === 'DELETE') {
        const id = /id=eq\.([^&]+)/.exec(u)?.[1]
        estado.apagado = id
        corpo = estado.tabelas.filter((t) => t.id === id)
        estado.tabelas = estado.tabelas.filter((t) => t.id !== id)
      } else if (m === 'POST') {
        const novo = { ...JSON.parse(req.postData() || '[{}]')[0], id: 'T9', padrao: false, teste: true, atualizado_em: new Date().toISOString() }
        estado.criado = novo
        estado.tabelas.push(novo)
        corpo = [novo]
      } else corpo = estado.tabelas
    }
    else if (u.includes('grupo_de_referencia')) corpo = GRUPOS
    else if (u.includes('referencia_na_ficha')) corpo = REFS
    else if (u.includes('kit_na_ficha')) corpo = KITS
    return r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: corpo === null ? '' : JSON.stringify(corpo) })
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
  } catch { /* sem armazenamento */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  return { ctx, pg, estado, erros }
}

const celulas = (pg, cod) => pg.evaluate((c) => {
  const tr = [...document.querySelectorAll('.pr-grade tbody tr')].find((x) => x.querySelector('.pr-cod')?.textContent === c)
  return tr ? [...tr.querySelectorAll('td .pr-pc')].map((b) => b.textContent.trim() + (b.className.includes('pr-pc-mao') ? '*' : b.className.includes('pr-pc-regra') ? '~' : b.className.includes('pr-pc-kit') ? 'k' : '')) : []
}, cod)

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440, 900, 'computador'], [820, 1180, 'tablet'], [390, 844, 'celular']]) {
    const { ctx, pg, estado, erros } = await abrir({ tema, larg, alt })
    await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
    await pg.waitForTimeout(900)
    const T = `${tema} ${nome}:`
    const rola = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    conta(!rola, `${T} a página não rola de lado`)
    const lista = await pg.evaluate(() => [...document.querySelectorAll('.pr-secao')].map((sc) => sc.querySelector('.pr-g').firstChild.textContent + ': ' + [...sc.querySelectorAll('.pr-item b')].map((b) => b.textContent).join(', ')))
    conta(lista.join(' | ') === 'Ativas: Atacado 2026, Varejo 2026 | Arquivadas: Licitação velha', `${T} a coluna separa as tabelas em seções, a padrão primeiro (${lista.join(' | ')})`)
    const escolhida = await pg.evaluate(() => { const c = document.querySelector('.pr-item-caixa.tinta'); return c ? c.innerText.split('\n')[0] : '' })
    conta(escolhida === 'Atacado 2026', `${T} a escolhida leva o desenho do item aberto do menu (${escolhida})`)
    const ct = await celulas(pg, 'CT01'); const ct2 = await celulas(pg, 'CT02'); const kt = await celulas(pg, 'KT01')
    conta(ct.join() === '49,90,44,90~,40,90~,36,90~', `${T} a padrão abre sozinha: base e a regra nas faixas (${ct.join(' ')})`)
    conta(ct2[1] === '48,90*', `${T} o escrito à mão aparece com ponto (${ct2.join(' ')})`)
    conta(kt[0] === '82,90k', `${T} o kit sem base vem pela soma das peças menos 8% (${kt.join(' ')})`)
    const grupos = await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tr.pr-grupo td')].map((t) => t.textContent))
    conta(grupos.join() === 'CAMCamisetas,SHOShorts,KITKits', `${T} a grade agrupa como a ficha técnica, kits no fim (${grupos.join(', ')})`)
    await pg.screenshot({ path: `${PASTA}/precos-${tema}-${nome}.png`, fullPage: true })

    if (tema === 'light' && nome === 'computador') {
      /* escrever numa celula: a primeira faixa vira a base e a regra segue */
      await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tbody tr')].find((x) => x.querySelector('.pr-cod')?.textContent === 'CT01').querySelector('td .pr-pc').click())
      await pg.keyboard.press('Control+a'); await pg.keyboard.type('59,90'); await pg.keyboard.press('Enter')
      await pg.waitForTimeout(200)
      const novo = await celulas(pg, 'CT01')
      conta(novo.join() === '59,90,53,90~,48,90~,43,90~', `${T} escrever a base refaz a regra das outras faixas (${novo.join(' ')})`)
      /* lote: marcar SH01 e subir 10% */
      await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tbody tr')].find((x) => x.querySelector('.pr-cod')?.textContent === 'SH01').querySelector('.ck input').click())
      await pg.waitForTimeout(200)
      await pg.fill('.pr-lote input', '10')
      await pg.evaluate(() => [...document.querySelectorAll('.pr-lote button')].find((b) => /Aplicar/.test(b.innerText)).click())
      await pg.waitForTimeout(200)
      const sh = await celulas(pg, 'SH01')
      conta(sh[0] === '43,90', `${T} mudar em lote: mais 10% na base, arredondado (${sh.join(' ')})`)
      await pg.evaluate(() => [...document.querySelectorAll('.pr-cab button')].find((b) => b.innerText.trim() === 'Salvar').click())
      await pg.waitForTimeout(700)
      const ct01 = estado.gravado?.itens?.find((i) => i.codigo === 'CT01')
      conta(ct01?.base === 59.9 && estado.gravado?.itens?.find((i) => i.codigo === 'SH01')?.base === 43.9 && estado.gravado?.regras?.arredondar === '90',
        `${T} Salvar grava a tabela inteira (${JSON.stringify(ct01)})`)
      /* tornar padrao a Varejo */
      await pg.evaluate(() => [...document.querySelectorAll('.pr-item')].find((b) => /Varejo/.test(b.innerText)).click())
      await pg.waitForTimeout(500)
      await pg.evaluate(() => [...document.querySelectorAll('.pr-cab button')].find((b) => /Tornar padrão/.test(b.innerText)).click())
      await pg.waitForTimeout(800)
      conta(estado.padrao === 'T2', `${T} Tornar padrão chama o banco numa chamada só (${estado.padrao})`)
      /* tabela nova copiando a Atacado com mais 8% */
      await pg.evaluate(() => [...document.querySelectorAll('.pagina-topo button')].find((b) => /Nova tabela/.test(b.innerText)).click())
      await pg.waitForTimeout(500)
      await pg.fill('dialog[open] input[placeholder="Parceiro Goiás"]', 'Parceiro Goiás')
      await pg.screenshot({ path: `${PASTA}/precos-nova-${tema}-${nome}.png` })
      await pg.evaluate(() => {
        const campos = [...document.querySelectorAll('dialog[open] .campo')]
        const pct = campos.find((c) => /ajuste/.test(c.innerText))?.querySelector('input')
        if (pct) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(pct, '8'); pct.dispatchEvent(new Event('input', { bubbles: true })) }
      })
      await pg.waitForTimeout(150)
      await pg.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /Criar a tabela/.test(b.innerText)).click())
      await pg.waitForTimeout(900)
      const criado = estado.criado
      conta(criado?.nome === 'Parceiro Goiás' && criado?.situacao === 'rascunho' && criado?.itens?.length === 2 && criado?.itens?.find((i) => i.codigo === 'CT02')?.base === 58.9,
        `${T} Nova tabela copia a padrão (agora a Varejo) com mais 8% e nasce rascunho (${criado?.nome}, ${criado?.itens?.length} itens, CT02 ${criado?.itens?.find((i) => i.codigo === 'CT02')?.base})`)
      /* a folha impressa */
      await pg.goto(SITE + '/tabelas/T1/imprimir', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(900)
      const folha = await pg.evaluate(() => ({
        titulo: document.querySelector('.pr-folha h1')?.textContent ?? '',
        linhas: [...document.querySelectorAll('.pr-f-tab tbody tr:not(.pr-f-g)')].map((t) => t.innerText.replace(/\s+/g, ' ')),
        branca: getComputedStyle(document.querySelector('.pr-folha')).backgroundColor,
        fonte: getComputedStyle(document.querySelector('.pr-folha')).fontFamily,
      }))
      conta(/Atacado 2026/.test(folha.titulo) && folha.linhas.some((l) => /CT01 .*R\$ 59,90 R\$ 53,90/.test(l)) && folha.branca === 'rgb(255, 255, 255)' && /Roboto/.test(folha.fonte),
        `${T} a folha impressa: título, preços da grade, branca e em Roboto (${folha.linhas[0]})`)
      await pg.screenshot({ path: `${PASTA}/precos-impressa-${tema}-${nome}.png`, fullPage: true })
    }
    conta(!erros.length, `${T} nenhum erro de JavaScript ${erros.join(' | ')}`)
    await ctx.close()
  }
}

/* a vendedora le e nao mexe; antes da 068 a pagina avisa */
{
  const { ctx, pg } = await abrir({ tema: 'light', larg: 1440, alt: 900, papel: 'vendedor' })
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  const v = await pg.evaluate(() => ({
    nova: [...document.querySelectorAll('button')].some((b) => /Nova tabela/.test(b.innerText)),
    salvar: [...document.querySelectorAll('button')].some((b) => /^Salv/.test(b.innerText.trim())),
    celulaTravada: document.querySelector('.pr-grade td .pr-pc')?.disabled ?? false,
  }))
  conta(!v.nova && !v.salvar && v.celulaTravada, 'vendedora: vê a tabela, sem Nova tabela, sem Salvar e com as células travadas')
  await ctx.close()
}
{
  const { ctx, pg } = await abrir({ tema: 'light', larg: 1440, alt: 900, semBanco: true })
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  const t = await pg.evaluate(() => document.querySelector('.pagina')?.innerText ?? '')
  conta(/migração 068/.test(t), 'antes da 068: a página diz o que falta, e não cai')
  await ctx.close()
}

/* ==========================================================================
   A REVISÃO DE 12/10/2026 (pranchas 139 a 143)
   ========================================================================== */
const linhaDe = (pg, cod) => pg.evaluate((c) => !!document.querySelector(`.pr-grade [data-celula="${c}:0"]`), cod)
{
  const { ctx, pg, estado, erros } = await abrir({ tema: 'light', larg: 1440, alt: 900 })
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  /* 139: a busca acha no catálogo o que a tabela não tem */
  await pg.fill('.pr-ferr input[type=search]', 'regata')
  await pg.waitForTimeout(200)
  const fora = await pg.evaluate(() => [...document.querySelectorAll('.pr-fora-linha')].map((t) => t.innerText.replace(/\s+/g, ' ')))
  conta(fora.length === 1 && /RG01/.test(fora[0]) && /Pôr na tabela/.test(fora[0]), '139: a busca acha no catálogo o que a tabela não tem, com Pôr na tabela (' + fora.join(' | ') + ')')
  await pg.locator('.pr-fora-linha button', { hasText: 'Pôr na tabela' }).click()
  await pg.fill('.pr-ferr input[type=search]', '')
  await pg.waitForTimeout(200)
  const rg = await celulas(pg, 'RG01')
  const aviso = await pg.evaluate(() => document.querySelector('.pr-aviso')?.innerText ?? '')
  const falta = await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tbody tr')].find((x) => x.querySelector('.pr-cod')?.textContent === 'RG01')?.querySelector('.pr-falta')?.textContent ?? '')
  conta(rg.join() === 'R$ 0,00,da base,da base,da base' && /1 peça sem preço base/.test(aviso) && /falta o preço base/.test(falta), '139: sem base, o campo vazio, as faixas "da base", a linha avisa e o aviso conta (' + rg.join(' ') + ')')
  await pg.locator('.pr-aviso button').click()
  await pg.waitForTimeout(150)
  const so = await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tbody .pr-cod')].map((c) => c.textContent))
  conta(so.join() === 'RG01', '139: "Mostrar só ela" deixa só a sem preço (' + so.join() + ')')
  await pg.locator('.pr-aviso button').click()
  /* digitar direto no campo: Enter grava e desce */
  await pg.locator('[data-celula="RG01:0"]').click()
  await pg.keyboard.type('44,90'); await pg.keyboard.press('Enter')
  await pg.waitForTimeout(150)
  const rg2 = await celulas(pg, 'RG01')
  const abertoAgora = await pg.evaluate(() => document.querySelector('.pr-pc-campo')?.getAttribute('aria-label') ?? '')
  conta(rg2[0] === '44,90' && rg2[1] === '40,90~' && abertoAgora !== '', '139: escrever a base no campo, e o Enter desce para a peça de baixo (' + rg2.join(' ') + ' · aberto: ' + abertoAgora + ')')
  await pg.keyboard.press('Escape')
  await pg.screenshot({ path: `${PASTA}/precos-139.png`, fullPage: true })

  /* 141: mudar as faixas de uma tabela que já existe */
  await pg.locator('aside button', { hasText: 'Mudar as faixas' }).click()
  await pg.waitForTimeout(300)
  await pg.locator('dialog[open] .chip', { hasText: '1 a 30, 31 a 100, 101 ou mais' }).click()
  await pg.fill('dialog[open] input[aria-label="Fim da faixa 1"]', '25')
  await pg.waitForTimeout(150)
  const auto = await pg.evaluate(() => document.querySelector('dialog[open] .pr-fx-auto')?.textContent)
  const previa = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .pr-fx .selo')].map((c) => c.textContent).join(', '))
  conta(auto === '26' && previa === '1 a 25, 26 a 100, 101 ou mais', '141: escrever onde a faixa acaba, e a seguinte começa sozinha (' + previa + ')')
  await pg.screenshot({ path: `${PASTA}/precos-141.png` })
  await pg.locator('dialog[open] button', { hasText: 'Usar estas faixas' }).click()
  await pg.waitForTimeout(250)
  const cab = await pg.evaluate(() => [...document.querySelectorAll('.pr-grade thead th')].slice(2).map((t) => t.innerText.replace(/\s+/g, ' ')))
  const ct2 = await celulas(pg, 'CT02')
  conta(cab.join(' | ') === 'Preço base 1 a 25 peças | 26 a 100 peças | 101 ou mais peças' && ct2[0] === '54,90' && !ct2[1].includes('*'), '141: a grade troca de faixas, a base fica e o à mão da faixa que mudou volta para a regra (' + cab.join(' | ') + ' · ' + ct2.join(' ') + ')')

  /* 140: adicionar agrupado (abre num contexto novo, com a tabela de antes) */
  conta(!erros.length, 'revisão, lista: nenhum erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}
{
  const { ctx, pg, erros } = await abrir({ tema: 'dark', larg: 1440, alt: 900 })
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  await pg.locator('.pr-ferr button', { hasText: 'Adicionar referência ou kit' }).click()
  await pg.waitForTimeout(300)
  const grupos = await pg.evaluate(() => [...document.querySelectorAll('.pr-ad .pr-ad-gcab')].map((g) => g.innerText.replace(/\s+/g, ' ')))
  conta(grupos.length === 2 && /CAM Camisetas 3 peças · 2 já na tabela/.test(grupos[0]), '140: os grupos da ficha técnica com o código e quantas já estão na tabela (' + grupos.join(' | ') + ')')
  await pg.locator('.pr-ad .pr-ad-gcab').first().locator('input[type=checkbox]').evaluate((el) => el.click())
  await pg.locator('.pr-ad .pr-ad-gcab').first().locator('.pr-ad-seta').click()
  await pg.waitForTimeout(150)
  const pecas = await pg.evaluate(() => [...document.querySelectorAll('.pr-ad .pr-ad-p')].map((p) => p.className + ':' + p.querySelector('.pr-cod').textContent))
  conta(pecas.some((p) => /ja:CT01/.test(p)) && pecas.some((p) => /marcada:RG01/.test(p)), '140: marcar o grupo marca só o que falta; o que já está aparece apagado (' + pecas.join(' ') + ')')
  await pg.fill('.pr-ad input[aria-label^="Preço base"]', '44,90')
  await pg.screenshot({ path: `${PASTA}/precos-140.png` })
  await pg.locator('.pr-ad button', { hasText: 'Pôr na tabela' }).click()
  await pg.waitForTimeout(300)
  const rg = await celulas(pg, 'RG01')
  conta(rg[0] === '44,90' && (await pg.locator('.pr-ad').isVisible()) === false, '140: as marcadas entram com o preço base e o menu fecha (' + rg.join(' ') + ')')

  /* 142: o modo tabela */
  await pg.locator('.pr-ferr .seg button, .pr-ferr [role=radio]', { hasText: 'Tabela' }).first().click()
  await pg.waitForTimeout(400)
  conta(new URL(pg.url()).searchParams.get('modo') === 'tabela' && (await pg.locator('.pr-mt-tab').count()) === 1 && (await pg.locator('.pr-mesa').count()) === 0, '142: o modo tabela troca a página inteira e fica no endereço')
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('.pr-mt-tab tbody tr:not(.pr-mt-g)')].map((t) => t.querySelector('.pr-cod')?.textContent + ':' + (t.querySelector('[role=switch]')?.getAttribute('aria-checked') ?? '')))
  conta(linhas.join() === 'CT01:true,CT02:true,RG01:true,SH01:true,KT01:true', '142: o catálogo inteiro, por grupo, com a chave Na tabela (' + linhas.join(' ') + ')')
  await pg.locator('.pr-mt-tab tr', { hasText: 'RG01' }).locator('[role=switch]').click()
  await pg.waitForTimeout(150)
  await pg.locator('.pr-mt-filtros .chip', { hasText: 'Fora da tabela' }).click()
  await pg.waitForTimeout(150)
  const soFora = await pg.evaluate(() => [...document.querySelectorAll('.pr-mt-tab tbody .pr-cod')].map((c) => c.textContent))
  conta(soFora.join() === 'RG01', '142: a chave tira da tabela, e o filtro Fora da tabela mostra só ela (' + soFora.join() + ')')
  await pg.locator('.pr-mt-filtros .chip', { hasText: 'Todas' }).click()
  await pg.locator('.pr-mt-tab tr.pr-mt-g', { hasText: 'Camisetas' }).locator('input[type=checkbox]').evaluate((el) => el.click())
  await pg.waitForTimeout(150)
  await pg.fill('.pr-mt-lote input[aria-label="Preço base das marcadas"]', '47,90')
  await pg.locator('.pr-mt-lote button', { hasText: /Aplicar nas 3/ }).click()
  await pg.waitForTimeout(200)
  const bases = await pg.evaluate(() => ['CT01', 'CT02', 'RG01'].map((c) => document.querySelector(`[data-celula="${c}:0"]`)?.textContent))
  conta(bases.join() === '47,90,47,90,47,90', '142: marcar o grupo e dar o mesmo preço base às 3, pondo de volta a que estava fora (' + bases.join(' ') + ')')
  await pg.screenshot({ path: `${PASTA}/precos-142.png`, fullPage: true })
  /* colar da planilha numa célula: desce pelas peças à vista */
  await pg.locator('[data-celula="CT02:0"]').click()
  await pg.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text/plain', '50\n60,5\t55')
    document.querySelector('.pr-pc-campo').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await pg.waitForTimeout(250)
  const col = await pg.evaluate(() => ['CT02:0', 'RG01:0', 'RG01:1'].map((c) => document.querySelector(`[data-celula="${c}"]`)?.textContent))
  conta(col.join() === '50,00,60,50,55,00', '142: colar da planilha preenche para baixo e para o lado (' + col.join(' ') + ')')
  conta(!erros.length, 'revisão, adicionar e modo tabela: nenhum erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}
{
  /* 143: a tabela nova não nasce em branco */
  const vazia = [{ id: 'T7', nome: 'Parceiro Goiás', situacao: 'rascunho', padrao: false, vale_ate: null, so_gerente: false, faixas: FAIXAS, regras: REGRAS, itens: [], observacao: '', teste: true, atualizado_em: new Date().toISOString() },
    ...tabelasIniciais()]
  const { ctx, pg, erros } = await abrir({ tema: 'light', larg: 1440, alt: 900, tabelas: vazia })
  await pg.goto(SITE + '/tabelas?t=T7', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  const ops = await pg.evaluate(() => [...document.querySelectorAll('.pr-comeco .pr-op b')].map((b) => b.textContent))
  conta(ops.join() === 'Escolher no catálogo,Modo tabela,Copiar de outra tabela', '143: três jeitos de começar (' + ops.join(', ') + ')')
  await pg.screenshot({ path: `${PASTA}/precos-143.png`, fullPage: true })
  await pg.locator('.pr-comeco .pr-op', { hasText: 'Copiar de outra tabela' }).locator('button', { hasText: 'Copiar' }).click()
  await pg.waitForTimeout(250)
  const n = await pg.evaluate(() => document.querySelectorAll('.pr-grade tbody .pr-cod').length)
  conta(n === 4, '143: copiar da padrão traz as 4 peças (' + n + ')')
  conta(!erros.length, 'revisão, tabela nova: nenhum erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}

{
  /* editar e excluir uma tabela salva ou um rascunho (o menu de cada item e o do cabeçalho) */
  const comRascunho = [...tabelasIniciais(), { id: 'T8', nome: 'Tabela teste', situacao: 'rascunho', padrao: false, vale_ate: null, so_gerente: false, faixas: FAIXAS, regras: REGRAS, itens: [], observacao: '', teste: true, atualizado_em: new Date().toISOString() }]
  const { ctx, pg, estado, erros } = await abrir({ tema: 'light', larg: 1440, alt: 900, tabelas: comRascunho })
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  await pg.locator('.pr-item-caixa', { hasText: 'Tabela teste' }).locator('.pr-item-mais').click()
  await pg.waitForTimeout(250)
  const itens = await pg.evaluate(() => [...document.querySelectorAll('.mn-ctx .mn-item')].map((b) => b.innerText.trim()))
  conta(itens.some((i) => /mudar o nome/.test(i)) && itens.includes('Duplicar') && itens.some((i) => /^Arquivar/.test(i)) && itens.includes('Excluir de vez'), 'menu do item: editar, faixas, duplicar, arquivar e excluir (' + itens.join(' | ') + ')')
  await pg.screenshot({ path: `${PASTA}/precos-menu.png` })
  await pg.locator('.mn-ctx .mn-item', { hasText: 'Excluir de vez' }).click()
  await pg.waitForTimeout(250)
  await pg.locator('dialog[open] button', { hasText: 'Excluir de vez' }).click()
  await pg.waitForTimeout(400)
  const lista = await pg.evaluate(() => [...document.querySelectorAll('.pr-item b')].map((b) => b.textContent))
  conta(estado.apagado === 'T8' && !lista.includes('Tabela teste'), 'excluir de vez o rascunho apaga no banco e some da lista (' + lista.join(', ') + ')')
  await pg.locator('.pr-item-caixa', { hasText: 'Atacado 2026' }).locator('.pr-item-mais').click()
  await pg.waitForTimeout(200)
  const daPadrao = await pg.evaluate(() => [...document.querySelectorAll('.mn-ctx .mn-item')].map((b) => b.innerText.trim()))
  conta(!daPadrao.includes('Excluir de vez'), 'a padrão não tem Excluir (' + daPadrao.join(' | ') + ')')
  await pg.keyboard.press('Escape')
  conta(!erros.length, 'menus: nenhum erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}
{
  /* modo tabela: a alça que arrasta o valor e copiar os preços de uma peça */
  const { ctx, pg, erros } = await abrir({ tema: 'light', larg: 1440, alt: 900 })
  await pg.goto(SITE + '/tabelas?modo=tabela', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(800)
  const val = (cods) => pg.evaluate((cs) => cs.map((c) => document.querySelector(`[data-celula="${c}"] .pr-pc`)?.textContent.trim()), cods)
  async function arrastar(de, ate) {
    await pg.locator(`[data-celula="${de}"]`).hover()
    const a = await pg.locator(`[data-celula="${de}"] .pr-pc-alca`).boundingBox()
    const b = await pg.locator(`[data-celula="${ate}"]`).boundingBox()
    await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await pg.mouse.down()
    await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 })
    return pg
  }
  /* Shift mais clique marca o intervalo, como em qualquer lista */
  const linhaCk = (c) => pg.locator(`.pr-mt-tab label.ck:has(input[aria-label="Marcar ${c}"])`)
  await linhaCk('CT01').click()
  await linhaCk('SH01').click({ modifiers: ['Shift'] })
  await pg.waitForTimeout(150)
  const faixaMarcada = await pg.evaluate(() => [...document.querySelectorAll('.pr-mt-tab tbody tr:not(.pr-mt-g)')].filter((t) => t.querySelector('input[type=checkbox]')?.checked).map((t) => t.querySelector('.pr-cod').textContent))
  await linhaCk('CT02').click({ modifiers: ['Control'] })
  await pg.waitForTimeout(150)
  const comCtrl = await pg.evaluate(() => [...document.querySelectorAll('.pr-mt-tab tbody tr:not(.pr-mt-g)')].filter((t) => t.querySelector('input[type=checkbox]')?.checked).map((t) => t.querySelector('.pr-cod').textContent))
  conta(faixaMarcada.join() === 'CT01,CT02,RG01,SH01' && comCtrl.join() === 'CT01,RG01,SH01', 'Shift marca o intervalo e Ctrl tira uma (' + faixaMarcada.join() + ' / ' + comCtrl.join() + ')')
  await pg.locator('button[aria-label="Desmarcar todas"]').click()
  await pg.waitForTimeout(150)
  await arrastar('CT01:0', 'CT02:0')
  const sel = await pg.evaluate(() => document.querySelectorAll('.pr-pc-sel').length)
  await pg.screenshot({ path: `${PASTA}/precos-alca.png` })
  await pg.mouse.up()
  await pg.waitForTimeout(200)
  conta(sel === 2 && (await val(['CT02:0'])).join() === '49,90', 'alça: arrastar para baixo marca o caminho e repete a base na de baixo (' + sel + ' marcadas, ' + (await val(['CT02:0'])).join() + ')')
  await arrastar('CT02:1', 'CT02:3')
  await pg.mouse.up()
  await pg.waitForTimeout(200)
  const lado = await val(['CT02:1', 'CT02:2', 'CT02:3'])
  conta(lado.join() === '48,90,48,90,48,90', 'alça: arrastar para o lado repete o valor nas faixas seguintes (' + lado.join(' ') + ')')
  await arrastar('CT01:1', 'CT02:2')
  const selD = await pg.evaluate(() => [...document.querySelectorAll('.pr-pc-sel')].map((e) => e.dataset.celula).sort().join())
  await pg.screenshot({ path: `${PASTA}/precos-alca-diagonal.png` })
  await pg.mouse.up()
  await pg.waitForTimeout(200)
  const diag = await val(['CT01:1', 'CT01:2', 'CT02:1', 'CT02:2'])
  conta(selD === 'CT01:1,CT01:2,CT02:1,CT02:2' && diag.join() === '44,90,44,90,44,90,44,90', 'alça: arrastar na diagonal preenche o retângulo inteiro (' + selD + ' · ' + diag.join(' ') + ')')
  /* devolve o 48,90 da CT02 para o copiar e colar de baixo */
  await pg.locator('[data-celula="CT02:1"] .pr-pc').click()
  await pg.keyboard.press('Control+a'); await pg.keyboard.type('48,90'); await pg.keyboard.press('Enter')
  await pg.waitForTimeout(150)
  await arrastar('CT02:1', 'CT02:3')
  await pg.mouse.up()
  await pg.waitForTimeout(200)
  await pg.locator('button[aria-label="Copiar os preços da CT02"]').click()
  await pg.waitForTimeout(150)
  conta(await pg.locator('.pr-mt-copia').isVisible(), 'copiar: a faixa "Preços da CT02 copiados" aparece')
  await pg.locator('.pr-mt-colar-g', { hasText: 'no grupo' }).nth(1).click()
  await pg.waitForTimeout(200)
  const sh = await val(['SH01:0', 'SH01:1', 'SH01:2', 'SH01:3'])
  conta(sh.join() === '49,90,48,90,48,90,48,90', 'colar no grupo Shorts leva os 4 preços da CT02 (' + sh.join(' ') + ')')
  await pg.locator('.pr-mt-tab tr', { hasText: 'RG01' }).locator('.pr-mt-copiar', { hasText: 'Colar' }).click()
  await pg.waitForTimeout(200)
  const rg = await val(['RG01:0', 'RG01:3'])
  conta(rg.join() === '49,90,48,90', 'colar numa peça fora da tabela põe ela com os preços (' + rg.join(' ') + ')')
  await pg.screenshot({ path: `${PASTA}/precos-copiar.png`, fullPage: true })
  conta(!erros.length, 'alça e copiar: nenhum erro de JavaScript ' + erros.join(' | '))
  await ctx.close()
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} certos`)
process.exit(ruins.length ? 1 : 0)
