/* ==========================================================================
   A PAGINA CLIENTES (prancha 147, ideia A), com o banco de mentira: a busca,
   as situacoes, os seletores, a placa dos cadastros para arrumar, a tabela,
   a ficha AO LADO (Resumo, Cadastro, Pedidos) e, abaixo de 1280 px, a ficha
   por cima. Fotos em 1920, 1440, 820 e 390, nos dois temas.

   Uso:  node testes/clientes.mjs http://127.0.0.1:4173
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

const PAGINAS = ['inicio', 'clientes', 'cotacao']
const permissoes = {}; PAGINAS.forEach((k) => (permissoes[k] = { ver: true, editar: true, deletar: true, total: true }))
const PERFIL = [{ id: '1', nome: 'Henrique', papel: 'admin', situacao: 'aprovado', paineis: PAGINAS, permissoes, email: 't@f', foto_em: null }]
const dias = (n) => new Date(Date.now() - n * 86400000).toISOString()
const base = (o) => ({ fantasia: '', tipo: 'J', documento: '', contato: '', telefone: '', celular: '', email: '', endereco: '', complemento: '', bairro: '',
  cidade: 'Goiânia', uf: 'GO', cep: '', tipo_de_contato: 'Cliente', segmento: 'outros', vendedor: '', teste: true, criado_em: dias(900), pedidos: 0, total: 0, ultimo_pedido: '', ...o })
const CLIENTES = [
  base({ id: 'C1', nome: 'Colégio Exemplo', documento: '12345678000190', contato: 'Ana Paula', celular: '62999991111', email: 'ana@exemplo.com.br', segmento: 'escola', vendedor: 'Dani', vendedor_id: '00000000-0000-4000-8000-0000000000a1', pedidos: 14, total: 48210, ultimo_pedido: dias(60), endereco: 'Rua Exemplo, 100', bairro: 'Setor Bueno', cep: '74000000' }),
  base({ id: 'C2', nome: 'Academia Exemplo', contato: 'Bruno', celular: '62988880000', segmento: 'academia', cidade: 'Aparecida de Goiânia', vendedor: 'Dani Ribeiro', pedidos: 3, total: 6180, ultimo_pedido: dias(12) }),
  base({ id: 'C3', nome: 'Atlético Exemplo', documento: '98765432000110', contato: 'Marcos', celular: '62977770000', segmento: 'time', cidade: 'Anápolis', vendedor: 'Henrique', pedidos: 2, total: 3940, ultimo_pedido: dias(220) }),
  base({ id: 'C4', nome: 'Marina Souza', tipo: 'F', documento: '12345678900', celular: '62966660000', criado_em: dias(7), pedidos: 1, total: 640, ultimo_pedido: dias(7), vendedor: 'Lucas' }),
  base({ id: 'C5', nome: 'Time da Firma Exemplo', segmento: 'time', criado_em: dias(90) }),
  base({ id: 'C6', nome: 'Igreja Exemplo', documento: '11222333000144', email: 'igreja@exemplo.com', segmento: 'igreja', cidade: 'Trindade', pedidos: 1, total: 2210, ultimo_pedido: dias(300) }),
]
const PEDIDOS = [
  { numero: 'PD004120', aprovado_em: '2026-08-12T10:00:00Z', pecas: 240, total: 9860, estado: 'entregue', departamento: 'Camiseta dry e calção', teste: true, cotacao: null },
  { numero: 'PD003877', aprovado_em: '2026-02-20T10:00:00Z', pecas: 120, total: 8560, estado: 'entregue', departamento: 'Agasalho', teste: true, cotacao: null },
  { numero: 'PD003500', aprovado_em: '2025-08-05T10:00:00Z', pecas: 180, total: 7300, estado: 'entregue', departamento: 'Interclasse', teste: true, cotacao: null },
]
const COTACOES = [{ id: 'Q1', numero: 'CO2026-0131', cliente_id: 'C1', cliente_nome: 'Colégio Exemplo', cliente_cidade: 'Goiânia', cliente_uf: 'GO', lead_id: null, estado: 'enviada',
  vendedor_nome: 'Dani', total: 5940, pecas: 180, valida_ate: null, criada_em: dias(3), atualizado_em: dias(3), pedido_numero: null, teste: true }]

const nav = await chromium.launch()
const achados = []
const gravados = []
const importados = []
const conta = (certo, texto) => { achados.push({ certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }

async function abrir({ tema, larg, alt }) {
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, reducedMotion: 'reduce', hasTouch: larg < 1024, acceptDownloads: true })
  await ctx.route('**supabase.co/**', async (r) => {
    const u = r.request().url()
    let corpo = []
    if (r.request().method() === 'PATCH' && u.includes('/cliente?')) { gravados.push(JSON.parse(r.request().postData() ?? '{}')); corpo = [] }
    else if (r.request().method() === 'POST' && /\/rest\/v1\/cliente(\?|$)/.test(u)) { importados.push(...JSON.parse(r.request().postData() ?? '[]')); corpo = [] }
    else if (u.includes('/equipe?')) corpo = [{ id: '00000000-0000-4000-8000-0000000000a1', nome: 'Dani Ribeiro' }, { id: '00000000-0000-4000-8000-0000000000a2', nome: 'Rafa Lima' }]
    else if (u.includes('meu_perfil')) corpo = PERFIL
    else if (u.includes('cliente_na_lista')) corpo = u.includes('id=eq.') ? CLIENTES.filter((c) => u.includes(c.id)) : CLIENTES
    else if (u.includes('/pedido?')) corpo = u.includes('C1') ? PEDIDOS : []
    else if (u.includes('/cliente?select=pedidos_antigos')) corpo = [{ pedidos_antigos: u.includes('C1') ? 6 : 0, total_antigo: 14300, ultimo_pedido_antigo: '2025-02-01' }]
    else if (u.includes('cotacao_na_lista')) corpo = u.includes('C1') ? COTACOES : []
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) })
  })
  await ctx.addInitScript(([c, t]) => { try {
    localStorage.setItem('ft.sessao', JSON.stringify(c)); localStorage.setItem('ft.tema', t)
  } catch { /* sem armazenamento */ } }, [{ acesso: 't', renovacao: 't', venceEm: Date.now() + 86400000, usuario: 't', email: 't@f' }, tema])
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  return { ctx, pg, erros }
}

for (const tema of ['light', 'dark']) {
  for (const [larg, alt, nome] of [[1920, 1080, 'grande'], [1440, 900, 'computador'], [820, 1180, 'tablet'], [390, 844, 'celular']]) {
    const { ctx, pg, erros } = await abrir({ tema, larg, alt })
    await pg.goto(SITE + '/clientes', { waitUntil: 'networkidle' })
    await pg.waitForTimeout(800)
    const T = `${tema} ${nome}:`
    const rola = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    conta(!rola, `${T} a página não rola de lado`)
    const linhas = await pg.evaluate(() => [...document.querySelectorAll('.cl-tab tbody tr')].map((t) => t.querySelector('.cl-titulo')?.childNodes[0]?.textContent))
    conta(linhas[0] === 'Marina Souza' && linhas.length === 6, `${T} a lista vem pelo último pedido, o mais novo em cima (${linhas.join(', ')})`)
    const placa = await pg.evaluate(() => document.querySelector('.aviso')?.innerText ?? '')
    conta(/1\s+cadastro incompleto/.test(placa), `${T} a placa amarela conta os cadastros incompletos (${placa.slice(0, 60)})`)
    const largo = larg >= 1280
    if (largo) {
      const retrato = await pg.evaluate(() => document.querySelector('.cl-lado')?.innerText ?? '')
      conta(/Por segmento/i.test(retrato) && /Onde estão/i.test(retrato), `${T} sem ninguém escolhido, a coluna mostra o retrato da base`)
    }
    if (tema === 'light' || nome === 'grande') await pg.screenshot({ path: `${PASTA}/clientes-${tema}-${nome}.png` })
    await pg.evaluate(() => [...document.querySelectorAll('.cl-tab tbody tr')].find((t) => t.innerText.includes('Colégio Exemplo')).click())
    await pg.waitForTimeout(700)
    if (largo) {
      const ficha = await pg.evaluate(() => ({ t: document.querySelector('.cl-lado')?.innerText ?? '', modal: !!document.querySelector('dialog[open]'), ligada: document.querySelector('.cl-tab tr.ligado')?.innerText ?? '' }))
      conta(!ficha.modal && /Colégio Exemplo/.test(ficha.t) && /Colégio Exemplo/.test(ficha.ligada), `${T} clicar numa linha abre a ficha AO LADO, sem modal, e marca a linha`)
      conta(/Quando ele compra/i.test(ficha.t) && /ago/.test(ficha.t) && /PD004120/.test(ficha.t) && /CO2026-0131/.test(ficha.t), `${T} o resumo traz quando ele compra, os últimos pedidos e a cotação aberta`)
      conta(/Ana Paula/.test(ficha.t) && /Motoboy|Correios|Jadlog|Braspress|Total|Sem CEP/.test(ficha.t), `${T} o resumo traz quem fala com a gente e a entrega`)
      await pg.screenshot({ path: `${PASTA}/clientes-ficha-${tema}-${nome}.png` })
      if (tema === 'light' && nome === 'grande') {
        await pg.evaluate(() => [...document.querySelectorAll('.cl-lado-abas button')].find((b) => /Pedidos/.test(b.innerText)).click())
        await pg.waitForTimeout(300)
        const ped = await pg.evaluate(() => document.querySelector('.cl-lado')?.innerText ?? '')
        conta(/6\s+pedidos de antes do Fourtime OS/.test(ped) && /PD003500/.test(ped), '147: a aba Pedidos tem o Bling numa frase e os pedidos do sistema')
        await pg.locator('.cl-lado button', { hasText: 'Editar' }).first().click()
        await pg.waitForTimeout(400)
        const form = await pg.evaluate(() => !!document.querySelector('dialog[open] .ficha-form'))
        conta(form, '147: Editar abre o formulário de sempre, já editando')
        /* a carteira é de uma pessoa (12/10/2026): o nome vem da equipe, e trocar grava o id */
        const carteira = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .campo')].find((c) => /Vendedor da carteira/.test(c.innerText))?.innerText ?? '')
        conta(/Dani Ribeiro/.test(carteira), 'a carteira mostra a pessoa pelo nome da equipe (' + carteira.replace(/\s+/g, ' ').slice(0, 80) + ')')
        await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .campo')].find((c) => /Vendedor da carteira/.test(c.innerText)).querySelector('button').click())
        await pg.waitForTimeout(200)
        await pg.locator('.mn-item', { hasText: 'Rafa Lima' }).first().click()
        await pg.waitForTimeout(200)
        await pg.locator('dialog[open] button', { hasText: 'Salvar' }).first().click()
        await pg.waitForTimeout(600)
        conta(gravados.length === 1 && gravados[0].vendedor_id === '00000000-0000-4000-8000-0000000000a2' && gravados[0].vendedor === 'Rafa Lima', 'trocar a carteira grava a pessoa e o nome (' + JSON.stringify(gravados.map((g) => [g.vendedor_id, g.vendedor])) + ')')
        await pg.keyboard.press('Escape')
        await pg.waitForTimeout(300)
        /* importar do Bling (12/10/2026): os montes antes de gravar */
        await pg.locator('.pagina-topo button', { hasText: 'Importar do Bling' }).click()
        await pg.waitForTimeout(300)
        const CSV = [
          'ID;Código;Nome;Fantasia;Endereço;Número;Complemento;Bairro;CEP;Cidade;UF;Contatos;Fone;Celular;E-mail;Tipo pessoa;CNPJ / CPF;Situação;Vendedor',
          '1;;Colégio Exemplo Matriz;;Rua A;10;;Centro;74000-000;Goiânia;GO;;;;;J;12.345.678/0001-90;Ativo;Marcela',
          '2;;Academia Nova;;Rua B;20;;Centro;;Goiânia;GO;;;(62) 98888-0000;;F;;Ativo;',
          '3;;atletico exemplo;;;;;;;Anápolis;GO;;;;;J;;Ativo;',
          '4;;"Padaria São João; Filial";;Av. Brasil;300;;Setor Sul;74100-000;Goiânia;GO;João;(62) 3333-4444;(62) 97777-1111;padaria@exemplo.com;F;123.456.789-09;Ativo;Rafael',
          '5;;Padaria Sao Joao Dois;;;;;;;Goiânia;GO;;;;;F;123.456.789-09;Ativo;',
          '6;;;;;;;;;Goiânia;GO;;;;;F;;Ativo;',
          '7;;Time Novo da Vila;;;;;;;Trindade;GO;Bia;;62955554444;;J;11.222.333/0001-81;Ativo;Marcela',
        ].join('\r\n')
        await pg.locator('dialog[open] input[type=file]').setInputFiles({ name: 'contatos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'latin1') })
        await pg.waitForTimeout(500)
        const montes = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .seg button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
        conta(montes.join('|') === 'Entram 2|Já existem 3|Repetidos 1|Sem nome 1', 'importar: os montes antes de gravar (' + montes.join(' | ') + ')')
        conta(!importados.length, 'importar: nada é gravado só por escolher o arquivo')
        await pg.screenshot({ path: `${PASTA}/clientes-importar.png` })
        const entram = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .cl-imp-tab tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()))
        conta(entram.length === 2 && /Padaria São João; Filial 12345678909 \(62\) 97777-1111 Goiânia, GO/.test(entram[0]), 'importar: o CSV em Latin-1, com aspas e ponto e vírgula dentro do nome (' + entram[0] + ')')
        await pg.locator('dialog[open] .seg button', { hasText: 'Já existem' }).click()
        await pg.waitForTimeout(200)
        const existem = await pg.evaluate(() => [...document.querySelectorAll('dialog[open] .cl-imp-tab tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()))
        conta(existem.length === 3 && /mesmo CNPJ de Colégio Exemplo/.test(existem[0]) && /mesmo telefone de Academia Exemplo/.test(existem[1]) && /mesmo nome de Atlético Exemplo/.test(existem[2]), 'importar: já existe pelo CNPJ, pelo final do telefone e pelo nome sem acento (' + existem.join(' | ') + ')')
        await pg.locator('dialog[open] .seg button', { hasText: 'Repetidos' }).click()
        await pg.waitForTimeout(200)
        conta(/mesmo CPF da linha 5/.test(await pg.locator('dialog[open] .cl-imp-tab').innerText()), 'importar: o mesmo CPF duas vezes no arquivo: entra a primeira')
        const [rel] = await Promise.all([pg.waitForEvent('download', { timeout: 4000 }).catch(() => null), pg.locator('dialog[open] button', { hasText: 'Baixar o que ficou de fora' }).click()])
        conta(!!rel && rel.suggestedFilename() === 'bling-o-que-ficou-de-fora.csv', 'importar: o relatório do que ficou de fora baixa para aprovar')
        await pg.locator('dialog[open] button', { hasText: 'Importar 2 clientes novos' }).click()
        await pg.waitForTimeout(200)
        conta(!importados.length && /Vão entrar 2 clientes de verdade/.test(await pg.locator('dialog[open]').innerText()), 'importar: pergunta antes de gravar')
        await pg.locator('dialog[open] button', { hasText: 'Sim, gravar 2 clientes' }).click()
        await pg.waitForTimeout(800)
        conta(importados.length === 2 && importados.map((c) => c.nome).join('|') === 'Padaria São João; Filial|Time Novo da Vila' && importados[0].documento === '12345678909' && importados[0].endereco === 'Av. Brasil, 300' && importados[1].tipo === 'J' && importados[1].vendedor === 'Marcela', 'importar: grava só os novos, com o documento limpo e o endereço com número (' + JSON.stringify(importados.map((c) => [c.nome, c.documento, c.tipo])) + ')')
        /* filtros */
        await pg.evaluate(() => [...document.querySelectorAll('.cl-ferr .seg button')].find((b) => /Parados/.test(b.innerText)).click())
        await pg.waitForTimeout(300)
        const parados = await pg.evaluate(() => [...document.querySelectorAll('.cl-tab tbody .cl-titulo')].map((t) => t.childNodes[0].textContent))
        conta(parados.join() === 'Atlético Exemplo,Igreja Exemplo', '147: o segmentado Parados mostra só quem passou de 6 meses sem pedir (' + parados.join(', ') + ')')
        await pg.evaluate(() => [...document.querySelectorAll('.cl-ferr .seg button')].find((b) => /Todos/.test(b.innerText)).click())
        await pg.fill('.cl-busca input', 'anapolis')
        await pg.waitForTimeout(300)
        const busca = await pg.evaluate(() => [...document.querySelectorAll('.cl-tab tbody .cl-titulo')].map((t) => t.childNodes[0].textContent))
        conta(busca.join() === 'Atlético Exemplo', '147: a busca acha sem acento, pela cidade (' + busca.join(', ') + ')')
        await pg.fill('.cl-busca input', '')
        const [baixa] = await Promise.all([pg.waitForEvent('download', { timeout: 4000 }).catch(() => null), pg.locator('button', { hasText: 'Exportar' }).click()])
        conta(!!baixa && /clientes-.*\.csv/.test(baixa.suggestedFilename()), '147: Exportar baixa a planilha do que está filtrado (' + (baixa?.suggestedFilename() ?? 'nada') + ')')
      }
    } else {
      const modal = await pg.evaluate(() => document.querySelector('dialog[open]')?.innerText ?? '')
      conta(/Colégio Exemplo/.test(modal), `${T} abaixo de 1280 px a ficha abre por cima`)
      await pg.screenshot({ path: `${PASTA}/clientes-ficha-${tema}-${nome}.png` })
    }
    conta(!erros.length, `${T} nenhum erro de JavaScript ` + erros.join(' | '))
    await ctx.close()
  }
}
await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} certos`)
process.exit(ruins.length ? 1 : 0)
