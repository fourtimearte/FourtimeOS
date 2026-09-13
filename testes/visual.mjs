/* ==========================================================================
   Teste visual do /kit.

   Tira uma foto de cada secao do kit, nos dois temas, e guarda em
   testes/atual/. Depois o comparar.py confere contra testes/fotos/, que sao as
   fotos aprovadas, e aponta o que mudou.

   Nao entra no `npm run build`: build e para publicar, e navegador dentro do
   build de publicacao so atrasa deploy. Este roda antes de subir.

   Uso:
     node testes/visual.mjs                     usa o site publicado
     node testes/visual.mjs http://127.0.0.1:5173   usa o servidor local
   ========================================================================== */

import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
/* playwright pode estar so na instalacao global: e o caso do contentor onde
   este codigo e escrito, que nao alcanca o registro do npm e por isso nao tem
   node_modules nenhum. Sem esta busca, o teste visual so roda na maquina de
   quem ja instalou as dependencias, e ninguem ve a tela antes de publicar. */
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try {
      return require(onde)
    } catch {
      /* tenta o proximo */
    }
  }
  throw new Error('playwright nao encontrado: npm i, ou npm i -g playwright')
}
const { chromium } = pegarPlaywright()

const AQUI = dirname(fileURLToPath(import.meta.url))
const SAIDA = resolve(AQUI, 'atual')

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'

/* O CRACHA DE TESTE TEM QUE TER A FORMA DE VERDADE. O antigo era
   {usuario, desde}, que nunca foi o formato: o arrumar() do auth.ts recusa e
   TODA tela protegida caia na entrada. As fotos das telas do sistema estavam
   fotografando a tela de login sem ninguem perceber. */
const CRACHA_DE_TESTE = {
  acesso: 'foto.de.teste',
  renovacao: 'foto.de.teste',
  /* longe de vencer: assim o crachaValido devolve na hora e nao tenta renovar
     contra o servidor, que numa foto nunca vai responder */
  venceEm: Date.now() + 86_400_000,
  usuario: 'teste',
  email: 'teste@fourtime',
}

const PERFIL_DE_TESTE = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    nome: 'Henrique',
    papel: 'admin',
    situacao: 'aprovado',
    paineis: [
      'inicio', 'funil', 'clientes', 'cotacao', 'ficha', 'kanban', 'produtos',
      'estoque', 'atividades', 'relatorio', 'banco', 'config', 'kit',
    ],
    email: 'teste@fourtime',
    foto_em: null,
  },
]

/* O BANCO NAO ENTRA NA FOTO. Ele responde de mentira: o perfil, para a casca
   abrir, e lista vazia para todo o resto. Foto que depende do banco muda
   quando o banco muda, e ai a comparacao aponta diferenca onde nao houve
   mudanca nenhuma de codigo. */
async function fingirOBanco(ctx) {
  await ctx.route('**supabase.co/**', (r) => {
    const alvo = r.request().url()
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(alvo.includes('meu_perfil') ? PERFIL_DE_TESTE : []),
    })
  })
}

/* as secoes do kit, na ordem do rail */
const SECOES = [
  'cor',
  'tecnicas',
  'medida',
  'tipografia',
  'botoes',
  'chips',
  'campos',
  'marcacao',
  'segmentado',
  'cartoes',
  'selos',
  'tabela',
  'sobreposicoes',
  'recados',
  'buscaglobal',
  'estados',
  /* faltava: a secao do seletor, do KPI e do paginador nunca tinha sido
     fotografada, entao mudanca nessas tres pecas passava sem ninguem ver */
  'filtros',
  'menus',
]

const TEMAS = [
  ['light', 'gelo'],
  ['dark', 'grafite'],
]

/* telas do sistema que tambem entram na foto, alem do kit */
const TELAS = [
  ['/', 'inicio'],
  ['/clientes', 'clientes'],
  ['/cotacao', 'cotacao'],
  /* o editor com uma cotacao de exemplo. O numero e sempre o mesmo porque a
     base de exemplo nasce do mesmo molde toda vez */
  ['/cotacao/CT20260183', 'cotacao-editor'],
  ['/cotacao/CT20260183/folha', 'cotacao-folha'],
  /* uma cotacao ja aprovada: e o unico jeito de a trava aparecer na foto */
  ['/cotacao/CT20260182', 'cotacao-aprovada'],
  ['/funil', 'funil'],
  /* a ficha de producao: o editor da v3.375 no visual novo */
  ['/ficha', 'ficha'],
]

async function main() {
  await rm(SAIDA, { recursive: true, force: true })
  await mkdir(SAIDA, { recursive: true })

  const navegador = await chromium.launch()
  let erros = 0

  for (const [tema, rotulo] of TEMAS) {
    const ctx = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      /* sem animacao: foto de coisa que se move nunca bate duas vezes */
      reducedMotion: 'reduce',
    })
    /* O CRACHA VAI PELO ARGUMENTO, e nao pelo fecho. O addInitScript manda a
       FONTE da funcao para o navegador: variavel de fora nao viaja junto, e
       uma referencia a ela vira ReferenceError la dentro, engolido pelo
       try/catch. Foi assim que a sessao deixou de ser posta sem ninguem ver. */
    await ctx.addInitScript(
      ([t, cracha]) => {
        try {
          localStorage.setItem('ft.sessao', JSON.stringify(cracha))
          localStorage.setItem('ft.tema', t)
        } catch {
          /* armazenamento bloqueado */
        }
      },
      [tema, CRACHA_DE_TESTE],
    )
    /* a fonte vem do Google e pode nao existir no ambiente: nao vale travar a
       foto esperando por ela */
    await fingirOBanco(ctx)
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA ' + rotulo + ': ' + e.message)
      erros++
    })
    await p.goto(SITE + '/kit', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(900)

    for (const id of SECOES) {
      const el = await p.$('#' + id)
      if (!el) {
        console.log('  secao sumiu: ' + id)
        erros++
        continue
      }
      await el.scrollIntoViewIfNeeded()
      /* rolagem quebrada em meio pixel muda o desenho da letra e faz a foto
         nao bater duas vezes: arredonda antes de fotografar */
      await p.evaluate(() => window.scrollTo(0, Math.round(window.scrollY)))
      await p.waitForTimeout(250)
      await el.screenshot({ path: SAIDA + '/' + id + '-' + rotulo + '.png' })
    }

    const rolando = await p.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    if (rolando) {
      console.log('  a pagina rola para o lado em 1440 no ' + rotulo)
      erros++
    }
    await ctx.close()
  }

  /* as telas do sistema, a pagina inteira, nos dois temas */
  for (const [tema, rotulo] of TEMAS) {
    const ctx = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript(
      ([t, cracha]) => {
        try {
          localStorage.setItem('ft.sessao', JSON.stringify(cracha))
          localStorage.setItem('ft.tema', t)
          localStorage.setItem('ft.menu', 'aberto')
        } catch {
          /* armazenamento bloqueado */
        }
      },
      [tema, CRACHA_DE_TESTE],
    )
    await fingirOBanco(ctx)
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA ' + rotulo + ': ' + e.message)
      erros++
    })
    for (const [rota, nome] of TELAS) {
      await p.goto(SITE + rota, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(700)
      await p.screenshot({ path: SAIDA + '/tela-' + nome + '-' + rotulo + '.png', fullPage: true })
      const rolando = await p.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (rolando) {
        console.log('  a tela ' + nome + ' rola para o lado em 1440 no ' + rotulo)
        erros++
      }
    }
    await ctx.close()
  }

  /* o celular inteiro, numa foto so: e onde a largura quebra primeiro */
  for (const [largura, alt, nome] of [
    [390, 844, '390'],
    [820, 1180, '820'],
  ]) {
    const ctx = await navegador.newContext({
      viewport: { width: largura, height: alt },
      isMobile: largura < 500,
      hasTouch: largura < 500,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript((cracha) => {
      try {
        localStorage.setItem('ft.sessao', JSON.stringify(cracha))
        localStorage.setItem('ft.tema', 'light')
      } catch {
        /* idem */
      }
    }, CRACHA_DE_TESTE)
    await fingirOBanco(ctx)
    await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort())
    const p = await ctx.newPage()
    p.on('pageerror', (e) => {
      console.log('  ERRO DE PAGINA em ' + nome + ': ' + e.message)
      erros++
    })
    for (const [rota, chapa] of [['/kit', 'pagina'], ...TELAS.map(([r, n]) => [r, 'tela-' + n])]) {
      await p.goto(SITE + rota, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(900)
      await p.screenshot({ path: SAIDA + '/' + chapa + '-' + nome + '.png', fullPage: true })
      const rolando = await p.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      if (rolando) {
        console.log('  ' + rota + ' rola para o lado em ' + nome)
        erros++
      }
    }
    await ctx.close()
  }

  await navegador.close()
  console.log('fotos tiradas em testes/atual')
  if (erros) {
    console.log('x ' + erros + ' problema(s) antes mesmo de comparar')
    process.exit(1)
  }
}

main()
