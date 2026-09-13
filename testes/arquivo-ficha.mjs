/* ==========================================================================
   A conferencia do arquivo da ficha de producao.

   Duas perguntas, e as duas ja custaram caro na v4:

     1. o que sai volta igual? Uma ficha salva e aberta tem que ser a mesma
        ficha. Basta um campo esquecido no envelope para um pedido inteiro
        voltar sem o vendedor, e ninguem percebe ate a peca sair errada.

     2. o .ft da v3.375 abre? A fabrica tem milhares deles no Drive desde
        2012, e nenhum vai ser reescrito. Se o sistema novo nao le o acervo,
        o acervo morre no dia da virada.

   Rodar:  sh testes/arquivo-ficha.sh
   ========================================================================== */

import { deFt, paraFt, nomeDoArquivo } from './compilado-ficha/src/dominio/ficha/arquivo.js'
import { fichaEmBranco } from './compilado-ficha/src/dominio/ficha/tipos.js'
import { blocoEmBranco } from './compilado-ficha/src/dominio/layout/bloco.js'

let falhas = 0
function conferir(titulo, condicao, achado) {
  if (condicao) return
  falhas++
  console.error('FALHOU: ' + titulo + (achado === undefined ? '' : '\n   achado: ' + achado))
}

/* --- 1. a ida e a volta --------------------------------------------------- */

const cheia = fichaEmBranco()
cheia.cabecalho = {
  ...cheia.cabecalho,
  nome: 'ACAI NO COCO LTDA',
  cliente: 'Açai no Coco Ltda',
  documento: '12.345.678/0001-90',
  pedido: 'PD004052',
  envio: '2026-09-30',
  vendedor: 'Henrique',
  departamento: 'Comercial',
  entrega: 'Transportadora',
  embalagem: 'Sacola',
  pagamento: '50% + 50%',
  contato: '(62) 99999-0000',
  observacao: 'Conferir a <b>numeração</b> antes de cortar',
  marcas: ['URGENTE'],
}
const b = blocoEmBranco(1)
b.referencia = 'FT-010-000M'
b.nomeDaReferencia = 'CAMISETA'
b.genero = 'masculino'
b.faixa = 'adulto'
b.grade = { P: 4, M: 10, G: 6 }
b.tecidos = [{ nome: 'Dry fit', cor: 'Preto', hex: '#111111' }]
b.design = [
  { tag: 'DTF', tecnica: 'dtf', cores: [{ cod: '001', hex: '#FFFFFF' }] },
  { tag: 'Eti. Fourtime', tecnica: 'etiqueta', cores: [] },
]
b.observacao = 'Escudo no peito <span style="background-color:#FFF27A">esquerdo</span>'
cheia.pecas = [{ bloco: b, precoBase: 49.9, precoPorTamanho: { G: 54.9 } }]

const volta = deFt(paraFt(cheia))

conferir('o cabecalho volta inteiro', volta.cabecalho.vendedor === 'Henrique', volta.cabecalho.vendedor)
conferir('o pedido volta', volta.cabecalho.pedido === 'PD004052', volta.cabecalho.pedido)
conferir('as marcas voltam', volta.cabecalho.marcas.join() === 'URGENTE', volta.cabecalho.marcas)
conferir('a peca volta', volta.pecas.length === 1, volta.pecas.length)
conferir('a grade volta', volta.pecas[0].bloco.grade.M === 10, volta.pecas[0].bloco.grade.M)
conferir('o preco base volta', volta.pecas[0].precoBase === 49.9, volta.pecas[0].precoBase)
conferir('o preco por tamanho volta', volta.pecas[0].precoPorTamanho.G === 54.9)
conferir('o tecido volta', volta.pecas[0].bloco.tecidos[0].cor === 'Preto')
conferir('o design volta', volta.pecas[0].bloco.design.length === 2)
conferir(
  'a cor lancada volta',
  volta.pecas[0].bloco.design[0].cores[0].cod === '001',
  JSON.stringify(volta.pecas[0].bloco.design[0].cores),
)
conferir(
  'o marca-texto da observacao sobrevive a faxina',
  volta.pecas[0].bloco.observacao.includes('background-color'),
  volta.pecas[0].bloco.observacao,
)

/* --- 2. a faxina do texto rico -------------------------------------------- */

const suja = fichaEmBranco()
const bs = blocoEmBranco(1)
bs.observacao =
  'ok <script>roubar()</script><b onclick="mal()">negrito</b><span style="color:#C6161B">vermelho</span>'
suja.pecas = [{ bloco: bs, precoBase: 0, precoPorTamanho: {} }]
const limpa = deFt(paraFt(suja)).pecas[0].bloco.observacao
conferir('a etiqueta de script sai', !limpa.includes('<script'), limpa)
conferir('o miolo do script sai junto', !limpa.includes('roubar'), limpa)
conferir('o onclick sai', !limpa.includes('onclick'), limpa)
conferir('o negrito fica', limpa.includes('<b>negrito</b>'), limpa)
conferir('a cor fica', limpa.includes('color:#C6161B'), limpa)

/* os cantos da faxina, um por um */
function faxina(html) {
  const f = fichaEmBranco()
  const bb = blocoEmBranco(1)
  bb.observacao = html
  f.pecas = [{ bloco: bb, precoBase: 0, precoPorTamanho: {} }]
  return deFt(paraFt(f)).pecas[0].bloco.observacao
}

conferir('a quebra de linha fica', faxina('um<br>dois') === 'um<br>dois', faxina('um<br>dois'))
conferir(
  'etiqueta aberta e nao fechada fecha sozinha',
  faxina('<b>sem fim') === '<b>sem fim</b>',
  faxina('<b>sem fim'),
)
conferir(
  'fechamento sem abertura some',
  faxina('solto</b>') === 'solto',
  faxina('solto</b>'),
)
conferir(
  'a imagem de fora some e o texto fica',
  faxina('antes<img src=x onerror=alert(1)>depois') === 'antesdepois',
  faxina('antes<img src=x onerror=alert(1)>depois'),
)
conferir(
  'estilo que nao e cor nem fundo some',
  faxina('<span style="color:red;position:fixed;font-size:88px">x</span>') ===
    '<span style="color:red">x</span>',
  faxina('<span style="color:red;position:fixed;font-size:88px">x</span>'),
)
conferir(
  'cor com url() dentro some',
  faxina('<span style="background-color:url(javascript:mal())">x</span>') === '<span>x</span>',
  faxina('<span style="background-color:url(javascript:mal())">x</span>'),
)
conferir(
  'o marca-texto passa inteiro',
  faxina('<span style="background-color:#FFF27A">urgente</span>') ===
    '<span style="background-color:#FFF27A">urgente</span>',
  faxina('<span style="background-color:#FFF27A">urgente</span>'),
)
conferir(
  'script escondido dentro de etiqueta boa some com o miolo',
  faxina('<b>ok<script>mal()</script></b>') === '<b>ok</b>',
  faxina('<b>ok<script>mal()</script></b>'),
)

/* --- 3. o .ft da v3.375 --------------------------------------------------- */

const velho = {
  _formato: 'FOURTIME_ORCAMENTO',
  _versao: 2,
  salvoEm: '2025-04-10T12:00:00.000Z',
  header: {
    nomedoc: 'PREFEITURA DE GOIANIA',
    cliente: 'Prefeitura de Goiania',
    cpfcnpj: '01.612.092/0001-23',
    pedido: '4052',
    envio: '30/09/2026',
    vendedor: 'Henrique',
    departamento: 'Licitacao',
    entrega: 'Retirada',
    embalagem: 'Caixa',
    pagamento: 'Empenho',
    contato: '(62) 3524-0000',
    obs: 'Entregar no <b>almoxarifado</b>',
  },
  layouts: [
    {
      ref: 'FT-010-000M — CAMISETA',
      genero: 'masculino',
      tecidos: ['Dry fit', 'Ribana'],
      cores: ['Preto', 'Branco'],
      cor: 'Preto',
      design: [
        { tag: 'DTF', cores: ['001', '005'] },
        { tag: 'Gola Tecido', cores: [] },
      ],
      grade: 'adulto',
      tamanhos: {
        P: { q: '4', u: '32,50' },
        M: { q: '10', u: '32,50' },
        G: { q: '6', u: '32,50' },
      },
      obs: 'Escudo no peito',
      img: null,
      arte: 'camiseta-prefeitura.ai',
      info: false,
    },
    {
      ref: 'ANEXO',
      genero: '',
      tecidos: [],
      cores: [],
      design: [],
      grade: 'infantil',
      tamanhos: { '8A': { q: '2', u: '' } },
      obs: '',
      img: null,
      arte: '',
      info: true,
    },
  ],
}

const lida = deFt(JSON.stringify(velho))

conferir('o cliente da v4 entra', lida.cabecalho.cliente === 'Prefeitura de Goiania')
conferir('o pedido cru vira PD', lida.cabecalho.pedido === 'PD004052', lida.cabecalho.pedido)
conferir('a data vira ISO', lida.cabecalho.envio === '2026-09-30', lida.cabecalho.envio)
conferir('a observacao do cabecalho fica', lida.cabecalho.observacao.includes('almoxarifado'))
conferir('os dois layouts entram', lida.pecas.length === 2, lida.pecas.length)

const p1 = lida.pecas[0].bloco
conferir('o codigo da referencia separa', p1.referencia === 'FT-010-000M', p1.referencia)
conferir('o nome da referencia separa', p1.nomeDaReferencia === 'CAMISETA', p1.nomeDaReferencia)
conferir('o genero entra', p1.genero === 'masculino')
conferir('os dois tecidos entram', p1.tecidos.length === 2, p1.tecidos.length)
conferir('a cor do segundo tecido entra', p1.tecidos[1].cor === 'Branco')
conferir('o hex da cor do tecido e achado pelo nome', p1.tecidos[0].hex !== '', p1.tecidos[0].hex)
conferir('a grade entra', p1.grade.M === 10, JSON.stringify(p1.grade))
conferir('a tecnica da tag e deduzida', p1.design[0].tecnica === 'dtf', p1.design[0].tecnica)
conferir('o acabamento entra como gola', p1.design[1].tecnica === 'gola', p1.design[1].tecnica)
conferir('a cor lancada ganha hex', p1.design[0].cores[1].hex !== '#cccccc', p1.design[0].cores[1])
conferir('o nome da arte entra', p1.arte === 'camiseta-prefeitura.ai')
conferir(
  'valor igual em todos os tamanhos vira preco base',
  lida.pecas[0].precoBase === 32.5 && Object.keys(lida.pecas[0].precoPorTamanho).length === 0,
  lida.pecas[0].precoBase + ' / ' + JSON.stringify(lida.pecas[0].precoPorTamanho),
)

const p2 = lida.pecas[1].bloco
conferir('o modulo de informacoes entra marcado', p2.informacoes === true)
conferir('a grade infantil entra', p2.faixa === 'infantil', p2.faixa)
conferir('o numero do layout e renumerado', p2.n === 2, p2.n)

/* --- 4. o que nao e ficha ------------------------------------------------- */

let recusou = false
try {
  deFt('{"marca":"outra.coisa"}')
} catch {
  recusou = true
}
conferir('arquivo de outro sistema e recusado', recusou)

recusou = false
try {
  deFt('isto nao e json')
} catch {
  recusou = true
}
conferir('texto solto e recusado', recusou)

recusou = false
try {
  deFt(JSON.stringify({ marca: 'fourtime.ficha', versao: 99, ficha: {} }))
} catch {
  recusou = true
}
conferir('versao do futuro e recusada', recusou)

/* --- 5. o nome do arquivo ------------------------------------------------- */

conferir(
  'o nome do arquivo sai sem acento e com o pedido',
  nomeDoArquivo(cheia) === 'ficha-PD004052-acai-no-coco-ltda.ft',
  nomeDoArquivo(cheia),
)

if (falhas) {
  console.error('\n' + falhas + ' conferencia(s) falharam')
  process.exit(1)
}
console.log('arquivo da ficha ok: ida e volta, faxina, .ft da v3.375, recusas e nome')
