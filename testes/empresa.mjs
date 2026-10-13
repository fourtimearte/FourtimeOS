/* ==========================================================================
   O TESTE DA EMPRESA NO BANCO (075, 12/10/2026).

   Os dados da fabrica (CNPJ, endereco) saem do localStorage de cada um e
   passam a morar na tabela empresa. O que ele mede:

     1. banco com dados: a tela mostra o que o banco tem, e a copia do
        navegador e atualizada
     2. banco vazio e navegador com dados de antes: a tela avisa que eles
        estao so neste navegador; Salvar chama salvar_empresa e o aviso some
     3. banco sem a 075: a tela diz que falta a migracao, e Salvar grava so
        no navegador, como antes

   Uso:  node testes/empresa.mjs http://127.0.0.1:4173
   ========================================================================== */

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'

const PAGINAS = ['inicio', 'config']
const permissoes = {}; PAGINAS.forEach(k => permissoes[k] = { ver: true, editar: true, deletar: true, total: true })
const PERFIL = [{ id: '1', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]

const nav = await chromium.launch()
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir({ banco, local, semTabela = false }) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const gravados = []
  const ja = { dados: banco }
  await ctx.route('**supabase.co/**', async (r) => {
    const u = r.request().url()
    const json = (corpo, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
    if (u.includes('meu_perfil')) return json(PERFIL)
    if (u.includes('/rest/v1/empresa')) {
      if (semTabela) return json({ code: 'PGRST205', message: "Could not find the table 'public.empresa' in the schema cache" }, 404)
      return json([{ dados: ja.dados }])
    }
    if (u.includes('/rpc/salvar_empresa')) {
      if (semTabela) return json({ code: 'PGRST202', message: 'Could not find the function public.salvar_empresa(p_dados) in the schema cache' }, 404)
      const corpo = r.request().postDataJSON()
      gravados.push(corpo)
      ja.dados = Object.fromEntries(Object.entries(corpo.p_dados).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v).trim()]))
      return json(ja.dados)
    }
    return json([])
  })
  await ctx.addInitScript(([c, l]) => {
    try {
      localStorage.setItem('ft.sessao', JSON.stringify(c))
      if (l) localStorage.setItem('ft.empresa', JSON.stringify(l))
    } catch {}
  }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, local])
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => conta(false, 'erro de pagina: ' + e.message))
  await pg.goto(SITE + '/config/empresa', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(900)
  return { ctx, pg, gravados }
}

const cnpj = (pg) => pg.getByLabel('CNPJ').inputValue()
const pagina = (pg) => pg.evaluate(() => document.querySelector('.pagina').innerText.replace(/\s+/g, ' '))
const copia = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('ft.empresa') || '{}'))

/* 1. banco com dados */
{
  const { ctx, pg } = await abrir({ banco: { cnpj: '12.ABC.345/0001-90', cidade: 'Goiânia', endereco: 'Rua 1' }, local: { cnpj: '00.000.000/0000-00' } })
  conta(await cnpj(pg) === '12.ABC.345/0001-90', 'banco com dados: a tela mostra o CNPJ do banco, e nao o velho do navegador')
  conta((await copia(pg)).cnpj === '12.ABC.345/0001-90', 'banco com dados: a copia do navegador e atualizada')
  const t = await pagina(pg)
  conta(!/só neste navegador/.test(t) && /valem para todo mundo da fábrica/.test(t), 'banco com dados: sem aviso de navegador')
  await ctx.close()
}

/* 2. banco vazio, navegador com dados de antes */
{
  const { ctx, pg, gravados } = await abrir({ banco: {}, local: { cnpj: '11.222.333/0001-44', endereco: 'Av. Velha' } })
  conta(await cnpj(pg) === '11.222.333/0001-44', 'banco vazio: o que o navegador tinha continua na tela')
  conta(/Estes dados ainda estão só neste navegador/.test(await pagina(pg)), 'banco vazio: avisa que falta salvar para valer para todos')
  await pg.getByLabel('Cidade').fill('Goiânia ')
  await pg.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pg.waitForTimeout(700)
  conta(gravados.length === 1 && gravados[0].p_dados.cnpj === '11.222.333/0001-44' && gravados[0].p_dados.endereco === 'Av. Velha',
    'banco vazio: Salvar manda tudo para salvar_empresa')
  const t = await pagina(pg)
  conta(!/só neste navegador/.test(t) && /salvos para a fábrica inteira/.test(await pg.evaluate(() => document.body.innerText)), 'banco vazio: depois de salvar o aviso some e o recado diz fabrica inteira')
  conta(await pg.getByLabel('Cidade').inputValue() === 'Goiânia', 'banco vazio: a tela fica com o que o banco devolveu (aparado)')
  await ctx.close()
}

/* 3. sem a 075 */
{
  const { ctx, pg } = await abrir({ banco: null, local: { cnpj: '11.222.333/0001-44' }, semTabela: true })
  conta(/falta a migração 075/.test(await pagina(pg)), 'sem a 075: a tela diz que falta a migracao')
  await pg.getByLabel('Bairro').fill('Centro')
  await pg.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pg.waitForTimeout(700)
  conta((await copia(pg)).bairro === 'Centro' && /salvos só neste navegador/.test(await pg.evaluate(() => document.body.innerText)),
    'sem a 075: Salvar grava no navegador e diz isso')
  await ctx.close()
}

await nav.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
