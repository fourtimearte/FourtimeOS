/* ==========================================================================
   O TESTE DA COMPRA SUGERIDA POR FORNECEDOR (12/10/2026).

   Usa o banco de mentira do Estoque (materiais-dados e estoque-dados), onde
   ha material abaixo do minimo de mais de um fornecedor e um sem fornecedor.

   O QUE ELE MEDE:
     1. o botao "Compra sugerida" aparece quando ha material para comprar
     2. o modal separa por fornecedor, com o sem fornecedor no fim
     3. cada material sai com o que falta para o minimo, arredondado para cima
     4. "Copiar o pedido" copia o texto com a empresa, o fornecedor e as linhas
     5. "Mandar no WhatsApp" aparece para o fornecedor com telefone no contato
     6. "Escolher fornecedor" fecha o modal e abre o material
     7. nada e gravado

   Uso:  node testes/compra.mjs http://127.0.0.1:4173
   ========================================================================== */

import { abrir, ir, chromium } from './deposito-base.mjs'
import * as D from './materiais-dados.mjs'

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
let ruins = 0
const conta = (certo, texto) => { if (!certo) ruins++; console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

const nav = await chromium.launch()
const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1600, altura: 1000, tema: 'light' })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(SITE).origin })
await ir(pg, SITE, '/estoque', '.em-barra')

const abaixo = D.materiais.filter((m) => m.livre < m.minimo)
const botao = pg.getByRole('button', { name: 'Compra sugerida' })
conta(abaixo.length > 0 && await botao.count() === 1, `o botao aparece com ${abaixo.length} materiais abaixo do minimo`)
await botao.click()
await pg.waitForTimeout(400)
const dlg = pg.locator('dialog[open]')
const grupos = await dlg.locator('.es-compra-grupo').evaluateAll((l) => l.map((g) => ({
  nome: g.getAttribute('aria-label'),
  itens: [...g.querySelectorAll('.es-compra-item')].map((i) => ({ nome: i.querySelector('.es-compra-nome b').textContent, qtd: i.querySelector('.es-compra-qtd').textContent })),
  zap: [...g.querySelectorAll('button')].some((b) => /WhatsApp/.test(b.textContent)),
  escolher: [...g.querySelectorAll('button')].some((b) => /Escolher fornecedor/.test(b.textContent)),
})))
const total = grupos.reduce((s, g) => s + g.itens.length, 0)
conta(total === abaixo.length, `todo material abaixo do minimo esta num grupo (${total} de ${abaixo.length})`)
conta(grupos.length >= 2, 'mais de um fornecedor: ' + grupos.map((g) => g.nome + ' ' + g.itens.length).join(' | '))
const sem = grupos.findIndex((g) => g.nome === 'Sem fornecedor')
conta(sem === -1 || sem === grupos.length - 1, 'o sem fornecedor fica no fim')
if (sem >= 0) conta(grupos[sem].escolher && !grupos[sem].zap, 'o sem fornecedor oferece escolher, e nao WhatsApp')

/* a conta: o que falta, para cima */
let contaCerta = true
const exemplos = []
for (const g of grupos) for (const i of g.itens) {
  const m = abaixo.find((x) => x.nome === i.nome)
  const esperado = Math.ceil(m.minimo - m.livre - 1e-9)
  const lido = Number(i.qtd.replace(/[^\d,]/g, '').replace(',', '.'))
  if (lido !== esperado) contaCerta = false
  if (exemplos.length < 3) exemplos.push(`${i.nome}: tem ${m.livre}, minimo ${m.minimo}, compra ${i.qtd}`)
}
conta(contaCerta, 'cada um compra o que falta para o minimo, arredondado para cima (' + exemplos.join('; ') + ')')

const comZap = grupos.find((g) => g.zap)
conta(!!comZap, 'o fornecedor com telefone no contato ganha o WhatsApp (' + (comZap?.nome ?? 'nenhum') + ')')

const primeiro = grupos.find((g) => g.nome !== 'Sem fornecedor')
await dlg.locator(`.es-compra-grupo[aria-label="${primeiro.nome}"]`).getByRole('button', { name: 'Copiar o pedido' }).click()
await pg.waitForTimeout(300)
const copiado = await pg.evaluate(() => navigator.clipboard.readText())
conta(copiado.startsWith('Pedido de compra Fourtime') && copiado.includes('Para: ' + primeiro.nome) && copiado.includes(primeiro.itens[0].nome),
  'copiar o pedido: ' + copiado.replace(/\n/g, ' / ').slice(0, 160))
await dlg.screenshot({ path: 'testes/atual/compra-sugerida.png' })

if (sem >= 0) {
  const nome = grupos[sem].itens[0].nome
  await dlg.locator('.es-compra-grupo[aria-label="Sem fornecedor"]').getByRole('button', { name: 'Escolher fornecedor' }).first().click()
  await pg.waitForTimeout(600)
  conta(await pg.locator('dialog[open]').count() === 0, 'escolher fornecedor fecha o modal e volta ao material (' + nome + ')')
}

conta(!gravados.some((g) => /mexer_no_estoque|fornecedor|material/.test(String(g.u))), 'nada foi gravado')
conta(!erros.length, 'sem erro de JavaScript ' + erros.join(' | '))

await ctx.close()
await nav.close()
console.log(ruins ? `\nx ${ruins} reprovado(s)` : '\ntudo certo')
process.exit(ruins ? 1 : 0)
