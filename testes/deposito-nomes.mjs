/* ==========================================================================
   O NOME DENTRO DA FORMA, E OS DOIS CAMPOS DO PALETE.

   Pedido do Henrique de 06/10/2026: "o nome de palete ou prateleira tem que
   sempre ficar dentro da forma, então quebre linha se necessário; quero dois
   campos por palete, uma referência e um nome; a referência é o P01, P02,
   fica no canto superior esquerdo, e o nome fica no canto inferior direito,
   alinhado, com quantas linhas for necessária para caber tudo".

   O depósito deste teste é o DELE (testes/deposito-dados.mjs, o "comprido"):
   16 paletes com nome de tecido, a prateleira A de 20 vãos em pé e a
   prateleira "B - AVIAMENTOS" de meio metro. Foi nele que o nome saía do
   quadrado e caía em cima do vizinho.

   O QUE ELE CONFERE
     1. que todo texto do desenho está DENTRO da forma dele, perguntando ao
        navegador onde cada texto ficou: no mapa, na caixa de marcar o lugar
        e no editor, em 1440 e em 820, nos dois temas
     2. a referência em cima, à esquerda, e o nome embaixo, à direita, com o
        nome inteiro (nenhuma letra perdida) e sem um cair em cima do outro
     3. o nome da prateleira dentro da moldura, sem cobrir vão nenhum
     4. o lugar aberto, a dica e o código escrito, que agora aceita o nome
     5. o editor: os dois campos, o limite de 60 letras, o palete novo, a
        cópia, a referência vazia, e o que vai para o banco
     6. o palete pequeno com nome comprido, e o marcador da busca no canto

   Uso:  node testes/deposito-nomes.mjs                 confere o site publicado
         node testes/deposito-nomes.mjs http://localhost:4173
         node testes/deposito-nomes.mjs http://localhost:4173 editor   só os casos com esse nome
   As fotos ficam em testes/atual/deposito/, fora do repositório.
   ========================================================================== */

import { mkdirSync } from 'node:fs'
import { abrir, ir as irPara, chromium, sobra } from './deposito-base.mjs'

const SITE = process.argv[2] || 'https://fourtimeos.arte-adc.workers.dev'
const PASTA = 'testes/atual/deposito'
mkdirSync(PASTA, { recursive: true })
const ir = (pg, rota, espera) => irPara(pg, SITE, rota, espera)
const pausa = (pg, ms = 350) => pg.waitForTimeout(ms)

const achados = []
const conta = (certo, texto) => { achados.push({ certo: !!certo, texto }); console.log((certo ? 'ok   ' : 'RUIM ') + texto) }
/* o terceiro argumento escolhe os casos pelo nome: node testes/deposito-nomes.mjs http://localhost:4173 editor */
const SO = process.argv[3] ? new RegExp(process.argv[3]) : null
async function caso(nome, fn) {
  if (SO && !SO.test(nome)) return
  try { await fn() } catch (e) { conta(false, `${nome}: o caso parou no meio (${String(e).split('\n')[0].slice(0, 200)})`) }
}

/* os 16 paletes do Henrique, como a migração 055 os deixou: a referência na ordem de leitura */
const PALETES = {
  P01: 'POLIAMIDA C/ ELASTANO', P02: 'POLIAMIDA S/ ELASTANO', P03: 'MOLETOM ESPORTIVO', P04: 'PIQUE',
  P05: 'SUPLEX', P06: 'CREPE', P07: 'POLIAMIDA FUR C/ ELASTANO', P08: 'POLIAMIDA FLOW',
  P09: 'POLIAMIDA FURADINHA SUB', P10: 'POLIAMIDA FURADINHA', P11: 'TACTEL', P12: 'VISCOLICRA',
  P13: 'ALGODÃO', P14: 'DRY DE SUBLIMAÇÃO', P15: 'BRIM', P16: 'MOLETON',
}

/* ONDE CADA TEXTO FICOU. Quem responde é o navegador: a caixa de cada lugar e
   o retângulo de cada texto, em pixels da tela. A folga de meio pixel é o
   arredondamento do próprio navegador. */
const medir = (pg, raiz) => pg.evaluate((raiz) => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, d: b.right, b: b.bottom, w: b.width, h: b.height } }
  const dentro = (a, c, f = 0.5) => a.x >= c.x - f && a.y >= c.y - f && a.d <= c.d + f && a.b <= c.b + f
  const cruza = (a, c) => a.x < c.d - 0.5 && a.d > c.x + 0.5 && a.y < c.b - 0.5 && a.b > c.y + 0.5
  const base = document.querySelector(raiz)
  const lugares = [...base.querySelectorAll('[data-lugar]')].map((g) => {
    const caixa = r(g.querySelector('.dp-caixa'))
    const textos = [...g.querySelectorAll('text[data-texto]')].map((t) => ({
      qual: t.dataset.texto, ...r(t), letra: parseFloat(t.getAttribute('font-size')),
      linhas: [...t.querySelectorAll('tspan')].map((s) => s.textContent),
      ancora: t.getAttribute('text-anchor'), cor: getComputedStyle(t).fill, peso: getComputedStyle(t).fontWeight,
    }))
    const ref = textos.find((t) => t.qual === 'referencia'); const nome = textos.find((t) => t.qual === 'nome')
    return {
      lugar: g.dataset.lugar, apelido: g.dataset.nome ?? '', palete: !!g.querySelector('.dp-ripa') || g.dataset.nome !== undefined,
      caixa, textos, fora: textos.filter((t) => !dentro(t, caixa)).map((t) => t.qual),
      refENome: ref && nome ? cruza(ref, nome) : false, dica: g.querySelector('title')?.textContent ?? '',
      fundo: getComputedStyle(g.querySelector('.dp-caixa')).fill,
    }
  })
  const tarjas = [...base.querySelectorAll('text[data-texto="tarja"]')].map((t) => {
    const movel = t.closest('[data-movel]')
    const moldura = r(movel.querySelector('.dp-moldura'))
    const caixas = [...movel.querySelectorAll('.dp-caixa')].map(r)
    const eu = r(t)
    return { movel: movel.dataset.movel, linhas: [...t.querySelectorAll('tspan')].map((s) => s.textContent), dentro: dentro(eu, moldura), cobre: caixas.filter((c) => cruza(eu, c)).length, letra: parseFloat(t.getAttribute('font-size')), deLado: t.parentElement.getAttribute('transform')?.includes('rotate') ?? false }
  })
  /* texto solto que ficou do lado de fora da peça dele (a legenda antiga da prateleira) */
  const soltos = [...base.querySelectorAll('[data-movel] > text:not([data-texto])')].filter((t) => {
    const movel = t.parentElement
    return movel.querySelector('.dp-moldura') !== null
  }).length
  return { lugares, tarjas, soltos }
}, raiz)

const semEspaco = (s) => s.replace(/\s+/g, '')
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

/* confere um desenho inteiro: serve para o mapa, para a caixa de marcar e para o editor */
function conferirDesenho(T, m, { paletes = PALETES, prateleiras = ['A', 'B - AVIAMENTOS'] } = {}) {
  const comTexto = m.lugares.filter((l) => l.textos.length)
  conta(comTexto.length === m.lugares.length && m.lugares.length > 0, `${T}: todo lugar do desenho tem o texto dele (${comTexto.length} de ${m.lugares.length})`)
  const fora = m.lugares.filter((l) => l.fora.length)
  conta(fora.length === 0, `${T}: nenhum texto sai da forma (${fora.map((l) => l.lugar + ' ' + l.fora.join('+')).join(', ') || 'todos dentro'})`)
  const pal = m.lugares.filter((l) => l.lugar in paletes)
  conta(pal.length === Object.keys(paletes).length, `${T}: os ${Object.keys(paletes).length} paletes estão no desenho pela referência (${pal.length})`)
  const semRef = pal.filter((l) => l.textos.find((t) => t.qual === 'referencia')?.linhas.join('') !== l.lugar)
  conta(semRef.length === 0, `${T}: cada palete mostra a referência dele (${semRef.map((l) => l.lugar).join(', ') || 'os ' + pal.length})`)
  const foraDoCanto = pal.filter((l) => { const t = l.textos.find((x) => x.qual === 'referencia'); return !t || t.x - l.caixa.x > 9 || t.y - l.caixa.y > 9 || t.ancora !== 'start' })
  conta(foraDoCanto.length === 0, `${T}: a referência fica no canto de cima, à esquerda (${foraDoCanto.map((l) => l.lugar).join(', ') || 'a menos de 9 px do canto'})`)
  const comNome = pal.filter((l) => paletes[l.lugar])
  const perdeu = comNome.filter((l) => semEspaco(l.textos.find((t) => t.qual === 'nome')?.linhas.join('') ?? '') !== semEspaco(paletes[l.lugar]))
  conta(perdeu.length === 0, `${T}: o nome aparece inteiro, sem perder letra (${perdeu.map((l) => l.lugar + ' "' + (l.textos.find((t) => t.qual === 'nome')?.linhas.join('|') ?? '') + '"').join(', ') || 'os ' + comNome.length})`)
  const foraDoNome = comNome.filter((l) => { const t = l.textos.find((x) => x.qual === 'nome'); return !t || l.caixa.d - t.d > 9 || l.caixa.b - t.b > 9 || t.ancora !== 'end' })
  conta(foraDoNome.length === 0, `${T}: o nome fica no canto de baixo, à direita, alinhado pela direita (${foraDoNome.map((l) => l.lugar).join(', ') || 'a menos de 9 px do canto'})`)
  const quebrados = comNome.filter((l) => (l.textos.find((t) => t.qual === 'nome')?.linhas.length ?? 0) > 1).length
  conta(quebrados >= 5, `${T}: os nomes compridos quebram em mais de uma linha (${quebrados} paletes)`)
  conta(pal.every((l) => !l.refENome), `${T}: a referência e o nome não caem um em cima do outro`)
  const semDica = comNome.filter((l) => l.dica !== `Palete ${l.lugar} · ${paletes[l.lugar]}`)
  conta(semDica.length === 0, `${T}: a dica do navegador diz a referência e o nome inteiro (${semDica.map((l) => l.dica).join(', ') || 'as ' + comNome.length})`)
  const miudas = m.lugares.flatMap((l) => l.textos).filter((t) => !(t.letra >= 6.5)).length
  conta(miudas === 0, `${T}: nenhuma letra do desenho é menor que 6,5 px (${miudas})`)
  conta(m.tarjas.length === prateleiras.length && prateleiras.every((n) => semEspaco(m.tarjas.find((t) => t.movel === n)?.linhas.join('') ?? '') === semEspaco(n)), `${T}: cada prateleira leva o nome inteiro (${m.tarjas.map((t) => t.linhas.join('|')).join(' ; ')})`)
  conta(m.tarjas.every((t) => t.dentro), `${T}: o nome da prateleira fica dentro da moldura dela (${m.tarjas.filter((t) => !t.dentro).map((t) => t.movel).join(', ') || 'todos'})`)
  conta(m.tarjas.every((t) => t.cobre === 0), `${T}: o nome da prateleira não cobre vão nenhum`)
  conta(m.soltos === 0, `${T}: não sobrou legenda de prateleira do lado de fora (${m.soltos})`)
}

/* ---------- 1. o mapa -------------------------------------------------------- */
for (const [largura, altura, tema] of [[1440, 900, 'light'], [1440, 900, 'dark'], [820, 1180, 'light'], [820, 1180, 'dark']]) {
  const T = `mapa ${largura} ${tema === 'light' ? 'gelo' : 'grafite'}`
  await caso(T, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema, deposito: 'comprido' })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    await pg.locator('[data-mapa]').screenshot({ path: `${PASTA}/nomes-mapa-${largura}-${tema}.png` })
    const m = await medir(pg, '[data-mapa]')
    conferirDesenho(T, m)
    const a1 = m.lugares.find((l) => l.lugar === 'A1'); const b1 = m.lugares.find((l) => l.lugar === 'B1')
    conta(a1?.textos[0]?.linhas.join('') === 'A1' && b1?.textos[0]?.linhas.join('') === 'B1', `${T}: o vão da prateleira mostra o nome dele no meio`)
    conta((await sobra(pg)) <= 0, `${T}: nada rola para o lado`)

    /* o texto se lê em cima do fundo do lugar: a cor dele não é a do fundo */
    const p13 = m.lugares.find((l) => l.lugar === 'P13')
    conta(p13.textos.every((t) => t.cor !== p13.fundo), `${T}: a letra não tem a cor do fundo do palete (${p13.textos[0].cor} sobre ${p13.fundo})`)
    conta(Number(p13.textos.find((t) => t.qual === 'referencia').peso) >= 700, `${T}: a referência é em negrito`)

    /* --- o lugar aberto diz a referência e o nome ----------------------------- */
    const rotulo = await pg.locator('[data-mapa] [data-lugar="P13"]').getAttribute('aria-label')
    conta(rotulo === 'Palete P13 · ALGODÃO, vazio', `${T}: quem usa leitor de tela ouve a referência e o nome (${rotulo})`)
    await pg.locator('[data-mapa] [data-lugar="P09"]').click(); await pausa(pg)
    const painel = await pg.locator('.dp-painel').first().innerText()
    conta(/Palete P09 · POLIAMIDA FURADINHA SUB/.test(painel), `${T}: o lugar aberto tem a referência e o nome no título (${painel.split('\n')[0].slice(0, 60)})`)
    const aberto = await medir(pg, '[data-mapa]')
    const p09 = aberto.lugares.find((l) => l.lugar === 'P09')
    conta(p09.fora.length === 0 && p09.textos.every((t) => t.cor !== p09.fundo) && p09.fundo !== p13.fundo, `${T}: o palete aberto muda de fundo e a letra continua dentro e legível`)
    await pg.screenshot({ path: `${PASTA}/nomes-aberto-${largura}-${tema}.png`, fullPage: true })
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* ---------- 2. o celular: o desenho continua sem texto, e nada estoura --------- */
await caso('celular', async () => {
  const { ctx, pg, erros } = await abrir(nav, { largura: 390, altura: 844, tema: 'light', deposito: 'comprido' })
  await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
  const m = await medir(pg, '[data-mapa]')
  conta(m.lugares.length === 37 && m.lugares.every((l) => l.fora.length === 0), `celular: os 37 lugares estão no desenho e nenhum texto sai da forma (${m.lugares.filter((l) => l.textos.length).length} com texto)`)
  conta((await sobra(pg)) <= 0, 'celular: nada rola para o lado')
  await pg.locator('[data-mapa] [data-lugar="P13"]').click({ force: true }); await pausa(pg)
  conta(/Palete P13 · ALGODÃO/.test(await pg.locator('.dp-painel').first().innerText()), 'celular: o toque no palete abre o lugar com a referência e o nome')
  await pg.screenshot({ path: `${PASTA}/nomes-celular-390-light.png`, fullPage: true })
  conta(erros.length === 0, `celular: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
  await ctx.close()
})

/* ---------- 3. marcar o lugar: o desenho da caixa e o nome escrito -------------- */
for (const tema of ['light', 'dark']) {
  const T = `marcar ${tema === 'light' ? 'gelo' : 'grafite'}`
  await caso(T, async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema, deposito: 'comprido' })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    await pg.locator('.dp-linha .dp-marcar').first().click(); await pausa(pg, 600)
    const caixa = pg.locator('dialog[open]')
    conferirDesenho(T, await medir(pg, 'dialog[open]'))
    const campo = caixa.locator('input[aria-label="Código do lugar"]')
    await campo.fill('algodão'); await pausa(pg, 300)
    const lista = await caixa.locator('.dp-lugares').innerText()
    conta(/Palete P13 · ALGODÃO/.test(lista), `${T}: escrever o nome do palete escolhe o palete, e a lista diz a referência e o nome (${lista.replace(/\s+/g, ' ').slice(0, 60)})`)
    await campo.fill('p07'); await pausa(pg, 300)
    conta(/Palete P07 · POLIAMIDA FUR C\/ ELASTANO/.test(await caixa.locator('.dp-lugares').innerText()), `${T}: a referência escrita continua escolhendo o palete`)
    const escolhido = (await medir(pg, 'dialog[open]')).lugares.find((l) => l.lugar === 'P07')
    conta(escolhido.fora.length === 0 && escolhido.textos.every((t) => t.cor !== escolhido.fundo), `${T}: o palete escolhido na caixa continua com a letra dentro e legível`)
    await pg.screenshot({ path: `${PASTA}/nomes-marcar-1440-${tema}.png` })
    await caixa.getByRole('button', { name: 'Marcar aqui' }).click(); await pausa(pg, 600)
    const ido = gravados.find((g) => g.u === 'rpc/definir_lugares')
    conta(JSON.stringify(ido?.corpo.p_lugares) === JSON.stringify([{ movel: 'pc-07', vao: null, nivel: null }]), `${T}: o que vai para o banco é o palete, pelo id dele (${JSON.stringify(ido?.corpo.p_lugares ?? null).slice(0, 80)})`)
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* ---------- 4. o editor ------------------------------------------------------- */
for (const tema of ['light', 'dark']) {
  const T = `editor ${tema === 'light' ? 'gelo' : 'grafite'}`
  await caso(T, async () => {
    const { ctx, pg, erros, gravados } = await abrir(nav, { largura: 1440, altura: 900, tema, deposito: 'comprido' })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 700)
    conferirDesenho(T, await medir(pg, '[data-mapa]'))
    await pg.screenshot({ path: `${PASTA}/nomes-editor-1440-${tema}.png`, fullPage: true })

    /* os dois campos */
    await pg.locator('[data-mapa] [data-movel="P13"]').click({ position: { x: 12, y: 30 } }); await pausa(pg, 300)
    const ref = pg.locator('input[aria-label="Referência do palete"]'); const nome = pg.locator('input[aria-label="Nome do palete"]')
    conta(await ref.inputValue() === 'P13' && await nome.inputValue() === 'ALGODÃO', `${T}: o palete escolhido tem dois campos, a referência e o nome (${await ref.inputValue().catch(() => '?')} e ${await nome.inputValue().catch(() => '?')})`)
    const rotulos = await pg.locator('.dp-lado label, .dp-lado .campo-rotulo').allInnerTexts().catch(() => [])
    const lado = await pg.locator('.cartao', { has: ref }).innerText()
    conta(/Referência/.test(lado) && /\nNome\n|Nome/.test(lado) && /Palete P13/.test(lado), `${T}: os campos se chamam Referência e Nome, e o título do cartão é a referência`)

    /* um nome comprido: quebra em mais linhas e continua dentro */
    const comprido = 'ALGODÃO PENTEADO FIO 30 BRANCO E CORES CLARAS DO COLEGIAL'
    await nome.fill(comprido); await pausa(pg, 300)
    let m = await medir(pg, '[data-mapa]'); let p13 = m.lugares.find((l) => l.lugar === 'P13')
    const linhas = p13.textos.find((t) => t.qual === 'nome')
    conta(p13.fora.length === 0 && !p13.refENome && linhas.linhas.length >= 4 && semEspaco(linhas.linhas.join('')) === semEspaco(comprido), `${T}: o nome comprido quebra em quantas linhas precisar e fica dentro (${linhas.linhas.length} linhas, letra de ${linhas.letra} px)`)
    await pg.screenshot({ path: `${PASTA}/nomes-editor-comprido-1440-${tema}.png`, fullPage: true })

    /* o limite de 60 letras */
    await nome.fill(''); await nome.pressSequentially('x'.repeat(70), { delay: 0 }); await pausa(pg, 200)
    conta((await nome.inputValue()).length === 60, `${T}: o campo do nome para em 60 letras (${(await nome.inputValue()).length})`)
    m = await medir(pg, '[data-mapa]'); p13 = m.lugares.find((l) => l.lugar === 'P13')
    conta(p13.fora.length === 0 && !p13.refENome, `${T}: a palavra de 60 letras, que não cabe em linha nenhuma, é partida e fica dentro`)

    /* o palete pequeno com nome comprido: a letra diminui, o texto é cortado, e a dica guarda o nome inteiro */
    await nome.fill(comprido)
    for (const rotulo of ['Largura', 'Fundo']) { const c = pg.locator('.cartao', { has: ref }).getByLabel(rotulo, { exact: true }); await c.fill('0,6'); await c.blur(); await pausa(pg, 200) }
    m = await medir(pg, '[data-mapa]'); p13 = m.lugares.find((l) => l.lugar === 'P13')
    const pequeno = p13.textos.find((t) => t.qual === 'nome')
    conta(p13.caixa.w < 40 && p13.fora.length === 0 && !p13.refENome, `${T}: no palete de 0,6 m o texto continua dentro (palete de ${Math.round(p13.caixa.w)} px)`)
    conta(pequeno && pequeno.letra === 6.5 && pequeno.linhas.at(-1).endsWith('…') && p13.dica === `Palete P13 · ${comprido}`, `${T}: ali o nome encolhe até 6,5 px, termina em reticências, e a dica guarda o nome inteiro (${pequeno?.linhas.join('|')})`)
    await pg.screenshot({ path: `${PASTA}/nomes-editor-pequeno-1440-${tema}.png`, fullPage: true })

    /* a cópia é outro palete */
    await pg.getByRole('button', { name: 'Duplicar' }).click(); await pausa(pg, 300)
    conta(await ref.inputValue() === 'P17' && await nome.inputValue() === '', `${T}: a cópia ganha a próxima referência e nasce sem nome (${await ref.inputValue()} e "${await nome.inputValue()}")`)
    await nome.fill('  Retalhos  ')

    /* o palete novo */
    await pg.getByRole('button', { name: 'Palete', exact: true }).click(); await pausa(pg, 300)
    conta(await ref.inputValue() === 'P18' && await nome.inputValue() === '', `${T}: o palete novo nasce com a próxima referência e sem nome (${await ref.inputValue()})`)
    m = await medir(pg, '[data-mapa]')
    const novo = m.lugares.find((l) => l.lugar === 'P18')
    conta(novo && novo.textos.length === 1 && novo.textos[0].qual === 'referencia' && novo.fora.length === 0, `${T}: o palete sem nome mostra só a referência, no canto`)

    /* a referência vazia e a repetida não salvam */
    await ref.fill(''); await pausa(pg, 150)
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 300)
    conta(/Todo palete precisa de uma referência, como P01/.test(await pg.locator('.pagina').innerText()) && !gravados.some((g) => g.u === 'rpc/salvar_deposito'), `${T}: sem referência o desenho não salva, e a frase diz o que falta`)
    await ref.fill('P01'); await pausa(pg, 150)
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 300)
    conta(/A referência P01 aparece em mais de um lugar/.test(await pg.locator('.pagina').innerText()) && !gravados.some((g) => g.u === 'rpc/salvar_deposito'), `${T}: referência repetida também não salva`)
    await ref.fill('P18'); await pausa(pg, 150)

    /* a prateleira: o nome novo, comprido, continua dentro */
    await pg.locator('[data-mapa] [data-movel="B - AVIAMENTOS"]').click({ position: { x: 6, y: 6 } }); await pausa(pg, 300)
    await pg.locator('input[aria-label="Nome da prateleira"]').fill('B - AVIAMENTOS E LINHAS DE COSTURA'); await pausa(pg, 300)
    m = await medir(pg, '[data-mapa]')
    const b = m.tarjas.find((t) => t.movel === 'B - AVIAMENTOS E LINHAS DE COSTURA')
    conta(b && b.dentro && b.cobre === 0, `${T}: o nome comprido da prateleira fica dentro da moldura e não cobre o vão (${b?.linhas.join('|')})`)
    const b1 = m.lugares.find((l) => l.lugar === 'B1')
    conta(b1 && b1.fora.length === 0 && b1.caixa.w >= 20, `${T}: e o vão B1 continua com lugar para o nome dele (${Math.round(b1?.caixa.w ?? 0)} px)`)
    await pg.screenshot({ path: `${PASTA}/nomes-editor-prateleira-1440-${tema}.png`, fullPage: true })

    /* o que vai para o banco */
    await pg.getByRole('button', { name: 'Salvar o depósito' }).click(); await pausa(pg, 700)
    const sim = pg.getByRole('button', { name: /^Salvar assim|^Confirmar|^Salvar mesmo/ })
    if (await sim.count()) { await sim.first().click(); await pausa(pg, 500) }
    const ido = gravados.filter((g) => g.u === 'rpc/salvar_deposito').at(-1)?.corpo.p_planta.moveis ?? []
    const por = Object.fromEntries(ido.map((x) => [x.nome, x]))
    conta(ido.length >= 20 && por.P13?.apelido === comprido && por.P13.id === 'pc-13', `${T}: salvar manda a referência em "nome" e o nome em "apelido", no mesmo palete (${ido.length} peças; P13: ${por.P13?.apelido?.slice(0, 24)})`)
    conta(por.P17?.apelido === 'Retalhos' && por.P18?.apelido === '' && por.P01?.apelido === 'POLIAMIDA C/ ELASTANO', `${T}: o nome vai sem espaço na ponta, o palete sem nome vai vazio, e quem não foi tocado vai como estava`)
    conta(ido.filter((x) => x.tipo !== 'palete').every((x) => x.apelido === ''), `${T}: prateleira e escada vão sem nome de palete`)
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

/* ---------- 5. o depósito do wireframe: paletes sem nome, e o marcador da busca -- */
const SEM_NOME = Object.fromEntries(Array.from({ length: 21 }, (_, i) => ['P' + String(i + 1).padStart(2, '0'), '']))
for (const [largura, altura, tema] of [[1440, 900, 'light'], [1440, 900, 'dark'], [820, 1180, 'light']]) {
  const T = `wireframe ${largura} ${tema === 'light' ? 'gelo' : 'grafite'}`
  await caso(T, async () => {
    const { ctx, pg, erros } = await abrir(nav, { largura, altura, tema })
    await ir(pg, '/estoque?aba=deposito', '[data-mapa]')
    let m = await medir(pg, '[data-mapa]')
    conta(m.lugares.length === 29 && m.lugares.every((l) => l.textos.length && l.fora.length === 0), `${T}: os 29 lugares têm texto e nenhum sai da forma`)
    const pal = m.lugares.filter((l) => l.lugar in SEM_NOME)
    conta(pal.length === 21 && pal.every((l) => l.textos.length === 1 && l.textos[0].qual === 'referencia' && l.textos[0].x - l.caixa.x <= 9 && l.textos[0].y - l.caixa.y <= 9), `${T}: os 21 paletes sem nome mostram só a referência, no canto de cima, à esquerda`)
    conta(m.tarjas.length === 2 && m.tarjas.every((t) => t.dentro && t.cobre === 0) && m.soltos === 0, `${T}: as prateleiras A e D levam o nome dentro da moldura (${m.tarjas.map((t) => t.movel + (t.deLado ? ' de lado' : '')).join(', ')})`)
    const tem = pal.find((l) => l.lugar === 'P01'); const vazio = pal.find((l) => l.lugar === 'P02')
    conta(tem.fundo !== vazio.fundo && tem.textos[0].cor !== tem.fundo && vazio.textos[0].cor !== vazio.fundo, `${T}: palete com material e palete vazio têm fundos diferentes, e a letra se lê nos dois`)

    /* a busca põe o marcador no canto de cima, à esquerda: a referência chega para o lado */
    await pg.locator('.busca input, input[type="search"]').first().fill('dry'); await pausa(pg, 700)
    const sobre = await pg.evaluate(() => {
      const r = (e) => e.getBoundingClientRect()
      const cruza = (a, c) => a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5
      const marcas = [...document.querySelectorAll('[data-mapa] .dp-marcador circle')].map(r)
      const refs = [...document.querySelectorAll('[data-mapa] text[data-texto="referencia"]')]
      return { marcas: marcas.length, cobertas: refs.filter((t) => marcas.some((c) => cruza(r(t), c))).map((t) => t.textContent) }
    })
    conta(sobre.marcas >= 2 && sobre.cobertas.length === 0, `${T}: o marcador da busca não cobre a referência do palete (${sobre.marcas} marcadores; cobertas: ${sobre.cobertas.join(', ') || 'nenhuma'})`)
    m = await medir(pg, '[data-mapa]')
    conta(m.lugares.every((l) => l.fora.length === 0), `${T}: com a busca ligada, todo texto continua dentro`)
    await pg.locator('[data-mapa]').screenshot({ path: `${PASTA}/nomes-busca-${largura}-${tema}.png` })

    /* a grade de paletes fala em referências, e o palete da grade também tem os dois campos */
    if (largura === 1440) {
      await pg.locator('.busca input, input[type="search"]').first().fill(''); await pausa(pg, 300)
      await pg.getByRole('button', { name: 'Editar o depósito' }).click(); await pausa(pg, 700)
      await pg.locator('[data-mapa] [data-movel="P05"]').click({ position: { x: 12, y: 30 } }); await pausa(pg, 400)
      const lado = await pg.locator('.pagina').innerText()
      conta(/As referências começam em/.test(lado) && /Ordem das referências/.test(lado) && !/Os nomes começam em|Ordem dos nomes/.test(lado), `${T}: a grade de paletes fala em referências, e não mais em nomes`)
      const ref = pg.locator('input[aria-label="Referência do palete"]'); const nome = pg.locator('input[aria-label="Nome do palete"]')
      conta(await ref.inputValue() === 'P05' && await nome.inputValue() === '', `${T}: o palete da grade também tem a referência e o nome (${await ref.inputValue().catch(() => '?')})`)
      await nome.fill('DRY FIT BRANCO E PRETO'); await pausa(pg, 300)
      const e = await medir(pg, '[data-mapa]'); const p05 = e.lugares.find((l) => l.lugar === 'P05')
      conta(p05.fora.length === 0 && !p05.refENome && semEspaco(p05.textos.find((t) => t.qual === 'nome')?.linhas.join('') ?? '') === 'DRYFITBRANCOEPRETO', `${T}: o nome escrito no palete da grade aparece inteiro, dentro dele (${p05.textos.find((t) => t.qual === 'nome')?.linhas.join('|')})`)
      await pg.screenshot({ path: `${PASTA}/nomes-grade-1440-${tema}.png`, fullPage: true })
    }
    conta(erros.length === 0, `${T}: nenhum erro de JavaScript (${erros.join(' | ') || 'limpo'})`)
    await ctx.close()
  })
}

await nav.close()
const ruins = achados.filter((a) => !a.certo)
console.log(`\n${achados.length - ruins.length} de ${achados.length} conferências passaram.`)
if (ruins.length) { console.log('\nNÃO PASSOU:'); ruins.forEach((r) => console.log('  ' + r.texto)); process.exit(1) }
