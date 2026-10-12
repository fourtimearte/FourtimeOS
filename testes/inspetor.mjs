/* ==========================================================================
   O INSPETOR (temporário): Ctrl+Shift+X liga, a moldura segue o mouse, o
   clique copia o endereço do elemento e não chega na página; só o admin liga.

   Uso:  node testes/inspetor.mjs http://127.0.0.1:4173
   ========================================================================== */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function pegarPlaywright() {
  for (const onde of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(onde) } catch { /* tenta o proximo */ }
  }
  throw new Error('playwright nao encontrado')
}
const { chromium } = pegarPlaywright()
const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PAGINAS = ['inicio', 'cotacao', 'produtos']
const permissoes = {}; PAGINAS.forEach((k) => (permissoes[k] = { ver: true, editar: true, deletar: true, total: true }))
const perfil = (papel) => [{ id: '1', nome: 'Henrique', papel, situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
const TABELA = [{ id: 'T1', nome: 'Atacado 2026', situacao: 'ativa', padrao: true, vale_ate: null, so_gerente: false,
  faixas: [{ de: 10, ate: 20 }, { de: 21, ate: null }], regras: { passo_pct: -10, arredondar: '90', plus_reais: 6, infantil_pct: -10, kit_pct: -8 },
  itens: [{ codigo: 'CT01', tipo: 'referencia', base: 49.9, precos: [null, null] }], observacao: '', teste: true, atualizado_em: new Date().toISOString() }]

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())
const achados = []
const conta = (certo, texto) => { achados.push({ certo }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir(papel) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(SITE).origin })
  await ctx.route('**supabase.co/**', (r) => {
    const u = r.request().url()
    const corpo = u.includes('meu_perfil') ? perfil(papel) : u.includes('/tabela_de_preco') ? TABELA : []
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript((c) => { try { localStorage.setItem('ft.sessao', JSON.stringify(c)) } catch { /* sem armazenamento */ } },
    { acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' })
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  await pg.goto(SITE + '/tabelas', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(600)
  return { ctx, pg, erros }
}

{
  const { ctx, pg, erros } = await abrir('admin')
  conta(await pg.locator('[data-ft^="modules/precos/"]').count() > 5, 'os elementos da página carregam a marca de fonte (data-ft)')
  await pg.keyboard.press('Control+Shift+X')
  await pg.waitForTimeout(200)
  conta(await pg.locator('.insp:popover-open').count() === 1, 'Ctrl+Shift+X liga o inspetor, na camada de cima')
  const bt = pg.getByRole('button', { name: /Nova tabela/ }).first()
  const caixa = await bt.boundingBox()
  await pg.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2)
  await pg.waitForTimeout(150)
  const rotulo = await pg.locator('.insp-rotulo').innerText()
  conta(/button/.test(rotulo) && /modules\/precos\/tela\.tsx/.test(rotulo), 'a moldura segue o mouse e diz o elemento e o arquivo: ' + rotulo)
  await pg.keyboard.press('ArrowUp')
  await pg.waitForTimeout(100)
  const pai = await pg.locator('.insp-rotulo').innerText()
  conta(pai !== rotulo, 'seta para cima sobe para o pai: ' + pai)
  await pg.keyboard.press('ArrowDown')
  await pg.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2)
  await pg.waitForTimeout(400)
  const copiado = await pg.evaluate(() => navigator.clipboard.readText())
  console.log(copiado.split('\n').map((l) => '       ' + l).join('\n'))
  conta(/^\[FOURTIME OS · elemento escolhido\]/.test(copiado) && /Página: Tabelas de preço \(\/tabelas/.test(copiado) && /Código: src\/ds\/componentes\/botao\.tsx:\d+ Botao/.test(copiado) && /Usado em: src\/modules\/precos\/tela\.tsx:\d+ TelaTabelasDePreco/.test(copiado),
    'o clique copia a página, o arquivo do elemento e o componente de fora')
  conta(/var\(--/.test(copiado), 'as cores vêm com o nome do token')
  conta(await pg.locator('dialog[open]').count() === 0 && await pg.locator('.insp').count() === 0, 'o clique não chegou no botão (o modal não abriu) e o inspetor desligou')
  await pg.keyboard.press('Control+Shift+X')
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(150)
  conta(await pg.locator('.insp').count() === 0, 'Esc desliga')
  conta(!erros.length, 'sem erro de JavaScript: ' + erros.join(' | '))
  await ctx.close()
}
{
  const { ctx, pg } = await abrir('vendedor')
  await pg.keyboard.press('Control+Shift+X')
  await pg.waitForTimeout(200)
  conta(await pg.locator('.insp').count() === 0, 'para quem não é admin, o atalho não faz nada')
  await ctx.close()
}
await nav.close()
const ruins = achados.filter((a) => !a.certo).length
console.log(`\n${achados.length - ruins} de ${achados.length} certos`)
process.exit(ruins ? 1 : 0)
