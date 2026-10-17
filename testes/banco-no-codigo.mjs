/* ==========================================================================
   O QUE O CÓDIGO PEDE AO BANCO (17/10/2026, parte do cruzamento do banco).

   Lê o aplicativo (src), as funções do Supabase (supabase/functions) e a
   extensão (extensao) com o compilador do TypeScript, e acha cada conversa
   com o banco:

     tabela('cliente?select=id,nome&id=eq.x')      a tabela ou a view, as
     chamar('salvar_kit', { p_kit, p_ficha })      colunas, os filtros, a
     ler(`lead?select=...`)                        função e os argumentos
     lerDoBanco('regra_do_lead_do_site?...')
     fetch(`${URL}/rest/v1/rpc/registrar_...`)

   Devolve uma lista de usos. Quem confere é o testes/banco.mjs, contra o
   retrato do banco. Este arquivo só lê; não fala com o banco.
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const RAIZ = new URL('..', import.meta.url).pathname
const PASTAS = ['src', 'supabase/functions', 'extensao']
/* os ajudantes que levam um caminho do PostgREST como primeiro argumento */
const DE_TABELA = new Set(['tabela', 'ler', 'lerDoBanco'])
/* os que levam o nome de uma função do banco */
const DE_FUNCAO = new Set(['chamar'])

function arquivos(pasta) {
  const fora = []
  const andar = (p) => {
    for (const n of readdirSync(p)) {
      const c = join(p, n)
      if (n === 'node_modules' || n === '_metadata' || n.startsWith('.')) continue
      if (statSync(c).isDirectory()) andar(c)
      else if (/\.(ts|tsx|js|mjs)$/.test(n) && !/\.d\.ts$/.test(n)) fora.push(c)
    }
  }
  andar(join(RAIZ, pasta))
  return fora
}

/* --- o valor de um texto, quando dá para saber sem rodar ---------------- */
const BURACO = '\u0000'
function textoDe(no, consts, fundo = 0) {
  if (!no || fundo > 6) return null
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text
  if (ts.isParenthesizedExpression(no)) return textoDe(no.expression, consts, fundo + 1)
  if (ts.isTemplateExpression(no)) {
    let s = no.head.text
    for (const sp of no.templateSpans) {
      const v = textoDe(sp.expression, consts, fundo + 1)
      s += (v ?? BURACO) + sp.literal.text
    }
    return s
  }
  if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = textoDe(no.left, consts, fundo + 1)
    const b = textoDe(no.right, consts, fundo + 1)
    return (a ?? BURACO) + (b ?? BURACO)
  }
  if (ts.isIdentifier(no) && consts.has(no.text)) return textoDe(consts.get(no.text), consts, fundo + 1)
  return null
}

function chavesDoObjeto(no) {
  if (!no || !ts.isObjectLiteralExpression(no)) return null
  const k = []
  for (const p of no.properties) {
    if (ts.isSpreadAssignment(p)) {
      /* ...(x ? { a: 1 } : {}): as chaves dos dois lados */
      let e = p.expression
      while (ts.isParenthesizedExpression(e)) e = e.expression
      if (ts.isConditionalExpression(e) && [e.whenTrue, e.whenFalse].every((b) => ts.isObjectLiteralExpression(b))) {
        for (const b of [e.whenTrue, e.whenFalse]) {
          const dentro = chavesDoObjeto(b)
          if (!dentro || dentro.aberto) return { chaves: k, aberto: true }
          k.push(...dentro.chaves)
        }
        continue
      }
      if (ts.isObjectLiteralExpression(e)) {
        const dentro = chavesDoObjeto(e)
        if (!dentro || dentro.aberto) return { chaves: k, aberto: true }
        k.push(...dentro.chaves)
        continue
      }
      return { chaves: k, aberto: true }
    }
    if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) k.push(p.name.text)
  }
  return { chaves: k, aberto: false }
}

function propriedade(obj, nome) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return undefined
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name && p.name.text === nome) return p.initializer
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === nome) return p.name
  }
  return undefined
}

/* --- o caminho do PostgREST em pedaços ----------------------------------- */
export function lerCaminho(caminho) {
  const [alvo, busca = ''] = caminho.split('?')
  const partes = {}
  for (const par of busca.split('&')) {
    if (!par) continue
    const i = par.indexOf('=')
    const k = i < 0 ? par : par.slice(0, i)
    const v = i < 0 ? '' : par.slice(i + 1)
    ;(partes[k] ??= []).push(v)
  }
  return { alvo, partes }
}

/* select=id,nome,pessoa:pessoa_id(nome),itens(*) -> árvore */
export function lerSelect(s) {
  const fora = []
  let i = 0
  function lista() {
    const itens = []
    let atual = ''
    while (i < s.length) {
      const c = s[i]
      if (c === '(') {
        i++
        const filhos = lista()
        itens.push(campo(atual, filhos))
        atual = ''
      } else if (c === ')') {
        i++
        if (atual.trim()) itens.push(campo(atual))
        return itens
      } else if (c === ',') {
        i++
        if (atual.trim()) itens.push(campo(atual))
        atual = ''
      } else {
        atual += c
        i++
      }
    }
    if (atual.trim()) itens.push(campo(atual))
    return itens
  }
  function campo(t, filhos) {
    t = t.trim()
    let nome = t
    let apelido = null
    const dois = t.indexOf(':')
    if (dois >= 0 && !t.includes('::')) {
      apelido = t.slice(0, dois)
      nome = t.slice(dois + 1)
    }
    nome = nome.replace(/::[a-z]+$/, '').replace(/->>?.*$/, '')
    const exc = nome.indexOf('!')
    const dica = exc >= 0 ? nome.slice(exc + 1) : null
    if (exc >= 0) nome = nome.slice(0, exc)
    return { nome, apelido, dica, filhos: filhos ?? null }
  }
  fora.push(...lista())
  return fora
}

export function usosDoBanco() {
  const usos = []
  for (const pasta of PASTAS) {
    for (const arq of arquivos(pasta)) {
      const texto = readFileSync(arq, 'utf8')
      const fonte = ts.createSourceFile(arq, texto, ts.ScriptTarget.Latest, true, arq.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const rel = relative(RAIZ, arq)
      /* os textos fixos do arquivo (const COLUNAS = '...') */
      const consts = new Map()
      const juntar = (n) => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) consts.set(n.name.text, n.initializer)
        ts.forEachChild(n, juntar)
      }
      juntar(fonte)
      /* tabela e chamar só valem quando vêm da camada do Supabase: a folha A4
         tem uma função tabela() que desenha uma tabela, e não fala com banco */
      const importados = new Set()
      for (const st of fonte.statements) {
        if (ts.isImportDeclaration(st) && /supabase|@shared/.test(st.moduleSpecifier.text) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
          for (const el of st.importClause.namedBindings.elements) importados.add(el.name.text)
      }
      const vale = (nome) => {
        if (rel.startsWith('src/shared/supabase/')) return false
        if (rel.startsWith('src/')) return importados.has(nome) && (nome === 'tabela' || nome === 'chamar')
        if (rel.startsWith('extensao/')) return nome === 'ler'
        if (rel.startsWith('supabase/')) return nome === 'lerDoBanco' || nome === 'chamar'
        return false
      }
      /* o corpo que vem de uma função do arquivo (colunasDe(c), paraLinha(t)):
         as chaves são as do objeto que ela devolve */
      const funcoes = new Map()
      const juntarFuncoes = (n) => {
        if (ts.isFunctionDeclaration(n) && n.name) funcoes.set(n.name.text, n)
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) funcoes.set(n.name.text, n.initializer)
        ts.forEachChild(n, juntarFuncoes)
      }
      juntarFuncoes(fonte)
      const objetoDaFuncao = (no) => {
        if (!no) return no
        if (ts.isObjectLiteralExpression(no)) {
          /* { numero, ...colunasDe(c) }: o espalhado vira as chaves da função */
          const extra = []
          for (const p of no.properties)
            if (ts.isSpreadAssignment(p) && ts.isCallExpression(p.expression) && ts.isIdentifier(p.expression.expression) && funcoes.has(p.expression.expression.text)) {
              const dentro = objetoDaFuncao(p.expression)
              if (dentro && ts.isObjectLiteralExpression(dentro)) extra.push(dentro)
            }
          if (!extra.length) return no
          return ts.factory.createObjectLiteralExpression([...no.properties.filter((p) => !ts.isSpreadAssignment(p) || !extra.length), ...extra.flatMap((e) => e.properties)])
        }
        if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && funcoes.has(no.expression.text)) {
          const fn = funcoes.get(no.expression.text)
          const corpo = fn.body
          if (corpo && !ts.isBlock(corpo)) return objetoDaFuncao(ts.isParenthesizedExpression(corpo) ? corpo.expression : corpo)
          let achado = null
          const olhar = (m) => {
            if (ts.isReturnStatement(m) && m.expression && ts.isObjectLiteralExpression(m.expression)) achado = m.expression
            else if (!ts.isFunctionLike(m)) ts.forEachChild(m, olhar)
          }
          if (corpo) ts.forEachChild(corpo, olhar)
          return achado ? objetoDaFuncao(achado) : no
        }
        return no
      }
      /* o laço em volta: await dentro de for/while/map é uma ida ao banco por volta */
      const dentroDeLaco = (n) => {
        for (let p = n.parent; p; p = p.parent) {
          if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) return true
          if (ts.isFunctionLike(p)) {
            const pai = p.parent
            if (pai && ts.isCallExpression(pai) && ts.isPropertyAccessExpression(pai.expression) && ['forEach'].includes(pai.expression.name.text)) return true
            return false
          }
        }
        return false
      }
      /* EMBRULHOS: uma função do arquivo que passa o próprio primeiro
         parâmetro para tabela(), como lerTudo(caminho) do produto. Quem chama
         o embrulho fala com o banco; a chamada de dentro não diz nada sozinha. */
      const embrulhos = new Map()
      const acharEmbrulho = (n) => {
        const fn = ts.isFunctionDeclaration(n) ? n : ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) ? n.initializer : null
        const nome = ts.isFunctionDeclaration(n) ? n.name?.text : ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) ? n.name.text : null
        if (fn && nome && fn.parameters.length && ts.isIdentifier(fn.parameters[0].name)) {
          const par = fn.parameters[0].name.text
          let resto = null
          const olhar = (m) => {
            if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && vale(m.expression.text) && DE_TABELA.has(m.expression.text) && m.arguments[0]) {
              const a = m.arguments[0]
              if (ts.isIdentifier(a) && a.text === par) resto = ''
              else if (ts.isTemplateExpression(a) && a.head.text === '' && ts.isIdentifier(a.templateSpans[0].expression) && a.templateSpans[0].expression.text === par) resto = BURACO
            }
            ts.forEachChild(m, olhar)
          }
          olhar(fn.body ?? fn)
          if (resto !== null && !DE_TABELA.has(nome)) embrulhos.set(nome, resto)
        }
        ts.forEachChild(n, acharEmbrulho)
      }
      acharEmbrulho(fonte)
      const dentroDeEmbrulho = (n) => {
        for (let p = n.parent; p; p = p.parent) {
          const nome = ts.isFunctionDeclaration(p) ? p.name?.text : (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) ? p.parent.name.text : null
          if (nome && embrulhos.has(nome)) return true
        }
        return false
      }
      const visitar = (n) => {
        if (ts.isCallExpression(n)) {
          const nomeDaChamada = ts.isIdentifier(n.expression) ? n.expression.text : null
          if (nomeDaChamada && embrulhos.has(nomeDaChamada) && n.arguments.length) {
            const caminho = textoDe(n.arguments[0], consts)
            const linha = fonte.getLineAndCharacterOfPosition(n.getStart()).line + 1
            usos.push({ arquivo: rel, linha, jeito: nomeDaChamada, tipo: 'rest', caminho: caminho == null ? null : caminho + embrulhos.get(nomeDaChamada), metodo: 'GET', corpo: null, mesclar: false, laco: false })
          }
          const linha = fonte.getLineAndCharacterOfPosition(n.getStart()).line + 1
          const laco = dentroDeLaco(n) && n.parent && ts.isAwaitExpression(n.parent)
          if (nomeDaChamada && DE_TABELA.has(nomeDaChamada) && vale(nomeDaChamada) && n.arguments.length && !dentroDeEmbrulho(n)) {
            const caminho = textoDe(n.arguments[0], consts)
            const pedido = n.arguments[1]
            const met = textoDe(propriedade(pedido, 'metodo'), consts) ?? 'GET'
            const corpo = propriedade(pedido, 'corpo')
            let corpoNo = corpo
            if (corpoNo && ts.isIdentifier(corpoNo) && consts.has(corpoNo.text)) corpoNo = consts.get(corpoNo.text)
            if (corpoNo && ts.isArrayLiteralExpression(corpoNo) && corpoNo.elements.length) corpoNo = corpoNo.elements[0]
            corpoNo = objetoDaFuncao(corpoNo)
            usos.push({
              arquivo: rel, linha, jeito: nomeDaChamada, tipo: caminho && caminho.startsWith('rpc/') ? 'rpc' : 'rest',
              caminho, metodo: met, corpo: chavesDoObjeto(corpoNo), mesclar: !!propriedade(pedido, 'mesclar'), laco,
            })
          } else if (nomeDaChamada && DE_FUNCAO.has(nomeDaChamada) && vale(nomeDaChamada) && n.arguments.length) {
            const nome = textoDe(n.arguments[0], consts)
            usos.push({ arquivo: rel, linha, jeito: nomeDaChamada, tipo: 'rpc', caminho: nome == null ? null : 'rpc/' + nome, metodo: 'POST', corpo: n.arguments[1] ? chavesDoObjeto(n.arguments[1]) : { chaves: [], aberto: false }, laco })
          } else if (nomeDaChamada === 'fetch' && n.arguments.length) {
            const u = textoDe(n.arguments[0], consts)
            const m = u && /\/rest\/v1\/(rpc\/[a-z_]+)/.exec(u)
            if (m) {
              const corpoTexto = propriedade(n.arguments[1], 'body')
              let obj = null
              if (corpoTexto && ts.isCallExpression(corpoTexto) && corpoTexto.arguments[0]) obj = chavesDoObjeto(corpoTexto.arguments[0])
              usos.push({ arquivo: rel, linha, jeito: 'fetch', tipo: 'rpc', caminho: m[1], metodo: 'POST', corpo: obj, laco })
            }
          }
        }
        ts.forEachChild(n, visitar)
      }
      visitar(fonte)
    }
  }
  return usos
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const u = usosDoBanco()
  console.log(JSON.stringify(u, null, 1))
}
