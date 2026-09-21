/* ==========================================================================
   A CONFERENCIA DE TOKENS DO DESIGN SYSTEM V7

   Ela existe por um motivo repetido: toda alteracao visual dos ultimos dez
   dias veio com alguma coisa boba quebrada junto. Cor escrita na mao, raio
   fora da escala, travessao no meio do texto, elemento padrao do navegador
   voltando. Nada disso da erro em lugar nenhum: so fica errado, e so alguem
   olhando descobre.

   O QUE ELA CONFERE, e cada regra vem do V7:

     1. Cor literal fora de tokens.css   "nenhuma cor literal em componente"
     2. Raio fora dos cinco degraus      5, 7, 10, 14, 18, 999
     3. Fonte escrita na mao             Urbanist na tela, Roboto so no A4
     4. Travessao e meia-risca           regra permanente do Henrique
     5. Elemento padrao do navegador     select, checkbox cru, alert, confirm
     6. outline: none sem substituto     foco tem que continuar visivel
     7. Transicao fora de 150 a 260ms

   O QUE ELA NAO CONFERE, de proposito: alinhamento, sobreposicao e o que so
   se ve olhando. Isso e a outra metade, e ela e foto: `npm run visual`, ou a
   bancada de `testes/prova.mjs` para uma peca sozinha. Conferencia de texto
   nao ve tela torta.

   Rode com: npm run tokens
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ---------- onde a regra NAO vale, e por que -----------------------------
   tokens.css e a origem de todo valor: e o unico lugar onde cor literal e o
   certo. A folha A4 e outra peca de proposito, com papel branco nos dois
   temas e Roboto em vez de Urbanist, entao ela tem licenca escrita. */
const LIVRES = [
  'src/ds/tokens.css',
  'src/dominio/layout/folha.css',
  'src/modules/cotacao/documento.css',
  /* A TELA DE ENTRADA e escura nos DOIS temas, de proposito: ela e uma foto
     com um veu por cima, e ainda nao existe tema para escolher porque ninguem
     entrou. Cor de tema ali seria cor que muda sozinha atras do login. */
  'src/modules/entrar/entrar.css',
]

/* O PAPEL A4 MORA DENTRO DE modulo.css. folha.css e documento.css ja tinham
   licenca; as regras .papel do modulo sao a mesma peca, com escala propria em
   milimetro e papel branco nos dois temas. Licenca por SELECIONADOR, e nao
   pelo arquivo inteiro, porque o mesmo arquivo desenha a tela tambem. */
const LIVRE_POR_SELETOR = {
  'src/dominio/layout/modulo.css': /(^|[\s,>])\.papel\b/,
}

/* A RODA DE COR E ARCO-IRIS POR SIGNIFICADO. O icone da sublimacao e do banco
   de cores e um disco com o espectro inteiro: ali as seis paradas SAO o
   assunto, e nao decoracao que deveria virar de tema. */
const ARCO_IRIS = /conic-gradient\(/

/* O traco do editor e DADO, e nao texto: "FT-010-000M — CAMISETA" e o formato
   que o v3.375 grava, e o separador ali dentro e o que parte o codigo do
   nome. A regra do travessao nao alcanca linha que esta partindo ou juntando
   esse formato. */
const TRACO_E_DADO = /\.split\(|\.indexOf\(|\.join\(|SEPARADOR|\.replace\(|FT-[0-9]{3}-[0-9]{3}/

/* A caixa de marcacao do Design System tem um input de verdade por baixo,
   escondido, porque e ele que traz teclado e leitor de tela de graca. O que o
   V7 proibe e o checkbox CRU na tela, e nao a peca que o substitui. */
const CONSTROI_A_MARCACAO = 'src/ds/componentes/formulario.tsx'

function arquivos(pasta, fim) {
  const saida = []
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, fim))
    else if (fim.some((f) => nome.endsWith(f))) saida.push(caminho)
  }
  return saida
}

const achados = []
function achar(regra, arquivo, linha, texto, porque) {
  achados.push({
    regra,
    arquivo: relative(raiz, arquivo),
    linha,
    texto: texto.trim().slice(0, 92),
    porque,
  })
}

/* COMENTARIO NAO E CODIGO, e um bloco /* ... *\/ pode ter linha de dentro
   que nao comeca com asterisco. Sem contar a abertura e o fechamento, o
   proprio comentario que diz "nunca um <select> do navegador" virava achado,
   e a conferencia passava a acusar quem estava documentando a regra. */
function marcadorDeComentario() {
  let dentro = false
  return (linha) => {
    const comecou = dentro
    const abre = linha.lastIndexOf('/*')
    const fecha = linha.lastIndexOf('*\/')
    if (abre > fecha) dentro = true
    else if (fecha > abre) dentro = false
    return comecou || abre >= 0 || /^\s*(\*|\/\/)/.test(linha)
  }
}
const TEM_TRACO = /[—–]/

/* ---------- as escalas, lidas do proprio tokens.css ----------------------
   Nada decorado aqui: se o raio mudar em tokens.css, esta conferencia muda
   junto. Numero decorado dentro de um teste e a mesma doenca que ele existe
   para curar. */
const tokens = readFileSync(join(raiz, 'src/ds/tokens.css'), 'utf8')
const RAIOS = new Set([...tokens.matchAll(/--radius[a-z-]*:\s*([0-9]+)px/g)].map((m) => Number(m[1])))
RAIOS.add(0)
const ESCALA_RAIO = [...RAIOS].sort((a, b) => a - b).join('/')

/* ========================================================================== */
for (const arq of arquivos(join(raiz, 'src'), ['.css'])) {
  const rel = relative(raiz, arq)
  const livre = LIVRES.includes(rel)
  const soltoNesteSeletor = LIVRE_POR_SELETOR[rel]
  const linhas = readFileSync(arq, 'utf8').split('\n')
  const ehComentario = marcadorDeComentario()

  /* de que regra esta linha faz parte. Sem isto nao da para dar licenca ao
     papel sem dar licenca a tela inteira que mora no mesmo arquivo. */
  let seletor = ''
  let juntando = ''

  linhas.forEach((linha, i) => {
    const n = i + 1
    if (ehComentario(linha)) {
      if (TEM_TRACO.test(linha)) achar('travessao', arq, n, linha, 'travessao ou meia-risca')
      return
    }
    const limpa = linha.replace(/\/\*.*?\*\//g, '')
    if (TEM_TRACO.test(limpa)) achar('travessao', arq, n, linha, 'travessao ou meia-risca')

    if (limpa.includes('{')) {
      seletor = (juntando + ' ' + limpa.slice(0, limpa.indexOf('{'))).trim()
      juntando = ''
    } else if (limpa.includes('}')) {
      seletor = ''
      juntando = ''
    } else if (limpa.trim() && !limpa.includes(':')) {
      juntando += ' ' + limpa
    }

    if (livre) return
    if (soltoNesteSeletor && soltoNesteSeletor.test(seletor)) return

    /* 1. cor literal. Fora de tokens.css, cor e sempre var() ou color-mix de
          var(): e a unica forma de a peca virar no tema sem ninguem lembrar. */
    const cor = limpa.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/)
    if (cor && !/^\s*--/.test(limpa) && !ARCO_IRIS.test(limpa))
      achar('cor', arq, n, linha, 'cor na mao: ' + cor[0])

    /* 2. raio fora da escala */
    const raio = limpa.match(/border-radius:\s*([^;]+)/)
    if (raio && !/var\(|inherit/.test(raio[1])) {
      for (const v of raio[1].matchAll(/([0-9.]+)px/g)) {
        const num = Number(v[1])
        if (!RAIOS.has(num)) achar('raio', arq, n, linha, num + 'px fora da escala ' + ESCALA_RAIO)
      }
    }

    /* 3. fonte na mao */
    /* O valor e capturado e depois olhado. Com lookahead o \s* retrocedia
       para zero e a regra casava ate em `font-family: var(--font)`, que e
       justamente o jeito certo. */
    const fonte = limpa.match(/font-family:\s*([^;]+)/)
    if (fonte && !/^(var\(|inherit)/.test(fonte[1].trim())) {
      achar('fonte', arq, n, linha, 'font-family sem token: ' + fonte[1].trim().slice(0, 40))
    }

    /* 7. TRANSICAO fora de 150 a 260ms.
          So transicao. Animacao que roda em laco (o girador, a pulsacao) nao
          e movimento de interface, e o 0.01ms de prefers-reduced-motion e
          justamente a regra sendo obedecida. */
    if (/transition/.test(limpa)) {
      for (const v of limpa.matchAll(/(?<![\w.-])([0-9]+)ms/g)) {
        const ms = Number(v[1])
        if (ms > 0 && (ms < 150 || ms > 260)) {
          achar('movimento', arq, n, linha, ms + 'ms fora de 150 a 260')
        }
      }
    }

    /* 6. outline: none sem substituto por perto */
    if (/outline:\s*none/.test(limpa)) {
      const perto = linhas.slice(Math.max(0, i - 6), i + 7).join('\n')
      if (!/box-shadow|outline-offset|border-color|outline:\s*[0-9]/.test(perto)) {
        achar('foco', arq, n, linha, 'outline: none sem substituto visivel por perto')
      }
    }
  })
}

/* ---------- 5. elemento padrao do navegador ------------------------------ */
for (const arq of arquivos(join(raiz, 'src'), ['.tsx', '.ts'])) {
  const rel = relative(raiz, arq)
  const linhas = readFileSync(arq, 'utf8').split('\n')
  const ehComentario = marcadorDeComentario()
  linhas.forEach((linha, i) => {
    const n = i + 1
    if (ehComentario(linha)) return
    if (TEM_TRACO.test(linha) && !TRACO_E_DADO.test(linha)) {
      achar('travessao', arq, n, linha, 'travessao ou meia-risca')
    }
    if (/<select[\s>]/.test(linha)) achar('padrao', arq, n, linha, '<select> do navegador')
    if (/type="checkbox"/.test(linha) && rel !== CONSTROI_A_MARCACAO) {
      achar('padrao', arq, n, linha, 'checkbox cru')
    }
    if (/\balert\(|\bconfirm\(|\bprompt\(/.test(linha)) {
      achar('padrao', arq, n, linha, 'caixa do navegador')
    }
  })
}

/* ========================================================================== */
const ORDEM = ['travessao', 'padrao', 'foco', 'fonte', 'cor', 'raio', 'movimento']
const NOME = {
  travessao: 'Travessao ou meia-risca',
  padrao: 'Elemento padrao do navegador',
  foco: 'Foco sem substituto visivel',
  fonte: 'Fonte escrita na mao',
  cor: 'Cor escrita na mao',
  raio: 'Raio fora da escala',
  movimento: 'Transicao fora de 150 a 260ms',
}

if (!achados.length) {
  console.log('tokens ok: nada fora do Design System V7')
  process.exit(0)
}

for (const regra of ORDEM) {
  const desta = achados.filter((a) => a.regra === regra)
  if (!desta.length) continue
  console.log('\n' + NOME[regra] + '  (' + desta.length + ')')
  const porArquivo = new Map()
  for (const a of desta) {
    if (!porArquivo.has(a.arquivo)) porArquivo.set(a.arquivo, [])
    porArquivo.get(a.arquivo).push(a)
  }
  /* Modulo primeiro: e onde a regra e mais dura e onde o conserto nao mexe no
     sistema inteiro. */
  const ordenado = [...porArquivo].sort((a, b) => {
    const mod = (x) => (x[0].startsWith('src/modules') ? 0 : 1)
    return mod(a) - mod(b) || b[1].length - a[1].length
  })
  for (const [arquivo, lista] of ordenado) {
    console.log('  ' + arquivo + '  (' + lista.length + ')')
    for (const a of lista.slice(0, 5)) {
      console.log('    ' + String(a.linha).padStart(5) + '  ' + a.porque)
      console.log('           ' + a.texto)
    }
    if (lista.length > 5) console.log('           ... mais ' + (lista.length - 5))
  }
}
console.log('\n' + achados.length + ' achados')
process.exit(1)
