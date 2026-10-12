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

async function abrir({ tema, larg, alt, papel = 'admin', semBanco = false }) {
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, reducedMotion: 'reduce', hasTouch: larg < 1024 })
  const estado = { tabelas: tabelasIniciais(), gravado: null, criado: null, padrao: null }
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
  return tr ? [...tr.querySelectorAll('td .pr-v')].map((b) => b.textContent.trim() + (b.className.includes('pr-v-mao') ? '*' : b.className.includes('pr-v-regra') ? '~' : b.className.includes('pr-v-kit') ? 'k' : '')) : []
}, cod)

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1440, 900, 'computador'], [820, 1180, 'tablet'], [390, 844, 'celular']]) {
    const { ctx, pg, estado, erros } = await abrir({ tema, larg, alt })
    await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
    await pg.waitForTimeout(900)
    const T = `${tema} ${nome}:`
    const rola = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    conta(!rola, `${T} a página não rola de lado`)
    const lista = await pg.evaluate(() => [...document.querySelectorAll('.pr-item b')].map((b) => b.textContent))
    conta(lista.join() === 'Atacado 2026,Varejo 2026', `${T} a lista mostra as tabelas da casa, sem a arquivada (${lista.join(', ')})`)
    const ct = await celulas(pg, 'CT01'); const ct2 = await celulas(pg, 'CT02'); const kt = await celulas(pg, 'KT01')
    conta(ct.join() === '49,90,44,90~,40,90~,36,90~', `${T} a padrão abre sozinha: base e a regra nas faixas (${ct.join(' ')})`)
    conta(ct2[1] === '48,90*', `${T} o escrito à mão aparece com ponto (${ct2.join(' ')})`)
    conta(kt[0] === '82,90k', `${T} o kit sem base vem pela soma das peças menos 8% (${kt.join(' ')})`)
    const grupos = await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tr.pr-grupo td')].map((t) => t.textContent))
    conta(grupos.join() === 'Camisetas,Shorts,Kits', `${T} a grade agrupa como a ficha técnica, kits no fim (${grupos.join(', ')})`)
    await pg.screenshot({ path: `${PASTA}/precos-${tema}-${nome}.png`, fullPage: true })

    if (tema === 'light' && nome === 'computador') {
      /* escrever numa celula: a primeira faixa vira a base e a regra segue */
      await pg.evaluate(() => [...document.querySelectorAll('.pr-grade tbody tr')].find((x) => x.querySelector('.pr-cod')?.textContent === 'CT01').querySelector('td .pr-v').click())
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
    celulaTravada: document.querySelector('.pr-grade td .pr-v')?.disabled ?? false,
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

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} certos`)
process.exit(ruins.length ? 1 : 0)
