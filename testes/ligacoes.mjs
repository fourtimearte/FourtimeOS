/* ==========================================================================
   AS LIGACOES: o nome aponta para alguma coisa?

   A conferencia de tokens le VALOR escrito na mao. Ela nao ve o contrario, que
   e pior: um nome que aponta para o vazio.

     background: var(--sup-2)      -> --sup-2 nao existe em lugar nenhum
     border: 1px solid var(--linha) -> --linha nao existe
     border-radius: var(--r-md)     -> --r-md nao existe

   O navegador nao reclama. Ele joga a declaracao inteira fora e o elemento
   fica sem fundo, sem borda e com canto reto, parecendo que ninguem estilizou.
   Foi assim que a tela de Ensaio ficou com quatro numeros soltos por cima do
   cartao. Esses nomes sao vocabulario do Design Kit V6, que morreu no V7:
   --ink-2, --linha, --sup-2, --r-md. Ninguem digitou errado, foi copia de
   codigo velho.

   O mesmo vale para classe: um className que nenhum CSS define e um elemento
   sem estilo nenhum, e ninguem percebe porque a pagina "quase" funciona.

   E a terceira: a mesma classe escrita duas vezes no mesmo arquivo com
   sentidos diferentes. As duas regras se somam, e o resultado nao e nenhuma
   das duas. Foi a outra metade do estrago do Ensaio: .cfg-conta era uma
   pastilha de 20px de altura E uma caixa de numero de 12px de recheio.

   Rodar:  node testes/ligacoes.mjs
   ========================================================================== */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname

function arquivos(dir, ext, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, achados)
    else if (ext.some((e) => nome.endsWith(e))) achados.push(caminho)
  }
  return achados
}

const curto = (c) => c.replace(RAIZ, '')
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const CSS = arquivos(join(RAIZ, 'src'), ['.css'])
const TSX = arquivos(join(RAIZ, 'src'), ['.tsx', '.ts'])

/* --- quem DEFINE um nome de variavel ------------------------------------- */
const definidas = new Set()
for (const f of CSS)
  for (const m of semComentario(readFileSync(f, 'utf8')).matchAll(
    /(?:^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:/g,
  ))
    definidas.add(m[1])

/* O componente tambem define, por estilo em linha: style={{ '--tom': cor }}.
   Sem ler isto, metade do sistema viraria falso positivo. */
for (const f of TSX) {
  const txt = readFileSync(f, 'utf8')
  for (const m of txt.matchAll(/['"](--[a-zA-Z0-9_-]+)['"]\s*:/g)) definidas.add(m[1])
  /* e por setProperty, que costuma quebrar a linha depois do parenteses */
  for (const m of txt.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9_-]+)['"]/g)) definidas.add(m[1])
}

/* --- quem DEFINE uma classe ---------------------------------------------- */
/* O texto entre a chave anterior e a proxima e o selecionador. Contar a chave
   de ABERTURA tambem, e nao so a de fechamento, senao toda regra dentro de
   @media fica de fora e vira orfa mentirosa: foi o que aconteceu com .cl-some,
   que existe, mora dentro de um @media, e a conferencia jurava que nao. */
function selecionadores(css) {
  const fora = []
  let inicio = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{' || css[i] === '}') {
      const sel = css.slice(inicio, i).trim()
      if (css[i] === '{' && sel && !sel.startsWith('@')) fora.push(sel)
      inicio = i + 1
    }
  }
  return fora
}

const classesCss = new Set()
for (const f of CSS)
  for (const sel of selecionadores(semComentario(readFileSync(f, 'utf8'))))
    for (const c of sel.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) classesCss.add(c[1])

/* --- quem USA uma classe, do lado do componente --------------------------- */
const classesUsadas = new Set()
for (const f of TSX) {
  const txt = readFileSync(f, 'utf8')
  for (const m of txt.matchAll(/className=(?:"([^"]*)"|\{'([^']*)'\}|\{"([^"]*)"\})/g))
    for (const c of (m[1] ?? m[2] ?? m[3]).split(/\s+/).filter(Boolean)) classesUsadas.add(c)
  /* className montado em lista, em template, em variavel: pega a aspa solta */
  for (const m of txt.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g))
    for (const c of (m[1] ?? m[2] ?? '').split(/[^a-zA-Z0-9_-]+/).filter(Boolean))
      classesUsadas.add(c)
  for (const m of txt.matchAll(/`([^`]*)`/g))
    for (const c of m[1].split(/[\s${}]+/).filter(Boolean)) classesUsadas.add(c)
}

const achados = { fantasma: [], orfa: [], dobrada: [], morta: [] }

/* ========================================================================
   1. VARIAVEL FANTASMA: usada e definida em lugar nenhum.
   ======================================================================== */
for (const f of CSS) {
  semComentario(readFileSync(f, 'utf8'))
    .split('\n')
    .forEach((linha, i) => {
      for (const m of linha.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
        if (definidas.has(m[1])) continue
        achados.fantasma.push({
          onde: curto(f) + ':' + (i + 1),
          que: m[1] + (m[2] === ',' ? ' (tem reserva, mas o nome esta morto)' : ''),
          linha: linha.trim().slice(0, 96),
        })
      }
    })
}

/* ========================================================================
   2. CLASSE ORFA: escrita no className e definida em CSS nenhum.
   ======================================================================== */
for (const f of TSX) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((linha, i) => {
      for (const m of linha.matchAll(
        /className=(?:"([^"]*)"|\{'([^']*)'\}|\{"([^"]*)"\})/g,
      )) {
        for (const c of (m[1] ?? m[2] ?? m[3]).split(/\s+/).filter(Boolean)) {
          if (classesCss.has(c)) continue
          achados.orfa.push({
            onde: curto(f) + ':' + (i + 1),
            que: '.' + c,
            linha: linha.trim().slice(0, 96),
          })
        }
      }
    })
}

/* ========================================================================
   3. CLASSE DOBRADA: a mesma classe, sozinha, com dois blocos no mesmo
      arquivo que mandam COISAS DIFERENTES na mesma propriedade.

      Dois blocos da mesma classe nao e erro por si: um grupo que da a grade e
      um bloco que da o recheio convivem bem. Erro e quando os dois escrevem a
      mesma propriedade com valores diferentes, porque ai o resultado nao e
      nenhum dos dois e quem le o arquivo ve so metade. Dentro de @media
      redefinir e o proposito, entao @media fica de fora.
   ======================================================================== */
for (const f of CSS) {
  const limpo = semComentario(readFileSync(f, 'utf8'))
  const blocos = new Map()
  let profundidade = 0
  let inicioSel = 0
  let abertura = 0
  let emMedia = false
  let pendentes = []
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (c === '{') {
      if (profundidade === 0) {
        const sel = limpo.slice(inicioSel, i).trim()
        emMedia = sel.startsWith('@')
        abertura = i
        if (!emMedia) guardarSelector(sel, i)
      }
      profundidade++
    } else if (c === '}') {
      profundidade--
      if (profundidade === 0) {
        if (!emMedia) fecharBloco(i)
        inicioSel = i + 1
      }
    }
  }
  function guardarSelector(sel, pos) {
    pendentes = []
    for (const parte of sel.split(',')) {
      const p = parte.trim()
      if (!/^\.[a-zA-Z][a-zA-Z0-9_-]*$/.test(p)) continue /* so a classe sozinha */
      pendentes.push(p)
    }
  }
  function fecharBloco(fim) {
    if (!pendentes.length) return
    const corpo = limpo.slice(abertura + 1, fim)
    const linha = limpo.slice(0, abertura).split('\n').length
    const props = new Map()
    for (const m of corpo.matchAll(/(^|;)\s*([a-z-]+)\s*:([^;]*)/g))
      props.set(m[2].trim(), m[3].trim())
    for (const p of pendentes) {
      if (!blocos.has(p)) blocos.set(p, [])
      blocos.get(p).push({ linha, props })
    }
    pendentes = []
  }
  for (const [classe, lista] of blocos) {
    if (lista.length < 2) continue
    const briga = []
    for (let a = 0; a < lista.length; a++)
      for (let b = a + 1; b < lista.length; b++)
        for (const [prop, val] of lista[a].props)
          if (lista[b].props.has(prop) && lista[b].props.get(prop) !== val)
            briga.push(prop + ': ' + val + '  (linha ' + lista[a].linha + ')  contra  ' + lista[b].props.get(prop) + '  (linha ' + lista[b].linha + ')')
    if (!briga.length) continue
    achados.dobrada.push({
      onde: curto(f),
      que: classe + ', ' + lista.length + ' blocos: linhas ' + lista.map((x) => x.linha).join(', '),
      linha: briga.slice(0, 4).join('\n      '),
    })
  }
}

/* ========================================================================
   4. CSS MORTO: classe escrita no CSS que componente nenhum usa. Nao quebra
      nada; e peso, e mascara achado de verdade nas outras conferencias.
   ======================================================================== */
for (const f of CSS) {
  if (f.includes('/ds/tokens.css')) continue
  const limpo = semComentario(readFileSync(f, 'utf8'))
  const minhas = new Set()
  for (const sel of selecionadores(limpo))
    for (const c of sel.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) minhas.add(c[1])
  const sobrando = [...minhas].filter((c) => !classesUsadas.has(c)).sort()
  if (sobrando.length)
    achados.morta.push({ onde: curto(f), que: sobrando.length + ' classes', linha: sobrando.join(' ') })
}

/* --- o relatorio ---------------------------------------------------------- */
const TITULO = {
  fantasma: 'Variavel que aponta para o vazio',
  orfa: 'Classe usada que CSS nenhum define',
  dobrada: 'Mesma classe brigando consigo mesma no mesmo arquivo',
  morta: 'CSS que componente nenhum usa',
}
let total = 0
for (const chave of ['fantasma', 'orfa', 'dobrada', 'morta']) {
  const lista = achados[chave]
  if (!lista.length) continue
  console.log('\n' + TITULO[chave] + '  (' + lista.length + ')')
  for (const a of lista) {
    if (chave !== 'morta') total++
    console.log('  ' + a.onde)
    console.log('      ' + a.que)
    console.log('      ' + a.linha)
  }
}
console.log('\n' + (total ? total + ' achados' : 'ligacoes ok: todo nome aponta para alguma coisa'))
process.exit(total ? 1 : 0)
