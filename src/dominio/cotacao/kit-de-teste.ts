import { hexDaCor, hexDoTecido } from '../layout/banco'
import type { Bloco, Design } from '../layout/bloco'
import type { Grade } from '../layout/grade'
import { VERSAO_DO_CFT, informesEmBranco, type Cotacao, type ProdutoCotado } from './tipos'

/* ==========================================================================
   O KIT DE TESTE

   Um orçamento inteiro montado com um toque, para conferir o documento sem
   digitar nada. Ele veio do editor v3.375, e a ideia dele é a razão de
   existir: a folha impressa só quebra em casos, e o caso quase nunca é o que
   a gente digitou para testar. Então o kit monta SEMPRE OS MESMOS casos, e
   os casos são escolhidos por serem os que já quebraram.

   TRÊS FOLHAS DE LAYOUT, dois layouts em cada, na ordem da v3.375:

     folha A   duas imagens BAIXAS   (paisagem)  o caso comum
     folha B   duas imagens ALTAS    (retrato)   o caso que estoura a folha
     folha C   uma ALTA e uma BAIXA              o caso misto, o mais traiçoeiro

   O caso misto é o mais traiçoeiro porque as duas colunas do módulo têm
   alturas diferentes, e quem decide a altura da folha passa a ser o layout
   de cima em vez do de baixo. Foi assim que a última linha de uma tabela
   sumiu na v3.364.

   AS IMAGENS SÃO DESENHADAS NA HORA, e não guardadas no código. Três motivos,
   nesta ordem: arte de cliente não entra num teste, nem como exemplo; seis
   fotos em base64 engordariam o aplicativo que todo mundo baixa para usar; e
   uma imagem desenhada diz o tamanho dela na própria cara, então quando a
   folha sai errada dá para ler na foto qual era a peça.

   Elas são PNG de verdade, desenhadas em canvas, e não SVG: o caminho do
   arquivo colado passa pela compressão, e um teste que pula a compressão não
   testa o que acontece na mesa.
   ========================================================================== */

/** os dois formatos que o kit usa, em pixel */
const BAIXA = { l: 1600, a: 1000 }
const ALTA = { l: 1000, a: 1600 }

/* Desenha uma imagem de teste do tamanho pedido e devolve o data URL.

   O desenho não é decoração: as faixas e a moldura mostram se a imagem foi
   esticada, cortada ou espremida, coisa que uma foto de camiseta esconde. O
   texto no meio diz o tamanho, então a foto da folha errada já vem com a
   prova dentro. */
function desenharImagem(n: number, l: number, a: number, cor: string): string {
  const c = document.createElement('canvas')
  c.width = l
  c.height = a
  const g = c.getContext('2d')
  if (!g) return ''

  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, l, a)

  /* faixas na diagonal: qualquer esticão vira um ângulo diferente */
  g.save()
  g.strokeStyle = cor
  g.globalAlpha = 0.14
  g.lineWidth = Math.round(Math.min(l, a) / 28)
  for (let x = -a; x < l + a; x += g.lineWidth * 3) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + a, a)
    g.stroke()
  }
  g.restore()

  /* a moldura mostra se sobrou ou faltou borda */
  g.strokeStyle = cor
  g.lineWidth = Math.round(Math.min(l, a) / 60)
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, l - g.lineWidth, a - g.lineWidth)

  /* uma cruz de centro: se a imagem for cortada, ela sai fora do meio */
  g.globalAlpha = 0.45
  g.beginPath()
  g.moveTo(l / 2, a * 0.2)
  g.lineTo(l / 2, a * 0.8)
  g.moveTo(l * 0.2, a / 2)
  g.lineTo(l * 0.8, a / 2)
  g.stroke()
  g.globalAlpha = 1

  const corpo = Math.round(Math.min(l, a) / 9)
  g.fillStyle = cor
  g.textAlign = 'center'
  g.font = '700 ' + corpo + 'px system-ui, sans-serif'
  g.fillText('L-' + String(n).padStart(2, '0'), l / 2, a / 2 - corpo * 0.15)
  g.font = '500 ' + Math.round(corpo * 0.46) + 'px system-ui, sans-serif'
  g.fillText(l + ' x ' + a, l / 2, a / 2 + corpo * 0.62)
  g.fillText(a > l ? 'ALTA' : 'BAIXA', l / 2, a / 2 + corpo * 1.15)

  return c.toDataURL('image/jpeg', 0.9)
}

/* --- as seis peças, uma a uma ---------------------------------------------
   Cada uma existe para um motivo escrito ao lado dela. Peça de teste sem
   motivo é peça que alguém apaga na primeira limpeza, e aí o caso volta. */
type Receita = {
  formato: typeof BAIXA
  cor: string
  referencia: string
  nome: string
  genero: string
  faixa: 'adulto' | 'infantil'
  grade: Grade
  tecidos: { nome: string; cor: string }[]
  design: { tag: string; tecnica: Design['tecnica']; cores: string[] }[]
  arte: string
  observacao: string
  precoBase: number
  precoPorTamanho: Record<string, number>
  /** por que esta peça está no kit */
  porque: string
}

const RECEITAS: Receita[] = [
  {
    porque: 'o caso comum: imagem baixa, grade cheia, uma técnica com quatro cores',
    formato: BAIXA,
    cor: '#C6161B',
    referencia: 'FT-010-000M',
    nome: 'CAMISETA MASC TRAD MC',
    genero: 'masculino',
    faixa: 'adulto',
    grade: { PP: 6, P: 18, M: 32, G: 27, GG: 14, XG: 5 },
    tecidos: [{ nome: 'DRYFIT POLIESTER 100%', cor: 'Preto' }],
    design: [
      { tag: 'DTF', tecnica: 'dtf', cores: ['001', '012', '108', '252'] },
      { tag: 'Eti. Fourtime', tecnica: 'etiqueta', cores: [] },
    ],
    arte: 'camiseta-frente-2026.ai',
    observacao: 'Escudo no peito <b>esquerdo</b>, 9 cm de largura.',
    precoBase: 57,
    precoPorTamanho: {},
  },
  {
    porque: 'imagem baixa com preço por tamanho: o GG e o XG custam mais que a base',
    formato: BAIXA,
    cor: '#1F6FEB',
    referencia: 'FT-130-001M',
    nome: 'CAMISA SOCIAL MC',
    genero: 'masculino',
    faixa: 'adulto',
    grade: { P: 12, M: 20, G: 15, GG: 9, XG: 4 },
    tecidos: [
      { nome: 'PIQUET COM ELASTANO', cor: 'Branco' },
      { nome: 'RIBANA', cor: 'Azul Marinho' },
    ],
    design: [
      { tag: 'Bordado', tecnica: 'bordado', cores: [] },
      { tag: 'Gola Tecido', tecnica: 'gola', cores: [] },
    ],
    arte: 'social-bordado.cdr',
    observacao:
      'Bordado no punho. <span style="background-color:#FFF27A">Conferir a numeração antes de cortar.</span>',
    precoBase: 99,
    precoPorTamanho: { GG: 109, XG: 115 },
  },
  {
    porque: 'imagem ALTA: em largura total ela não cabe na folha e tem que encolher',
    formato: ALTA,
    cor: '#0B7A3B',
    referencia: 'FT-020-001M',
    nome: 'RAGLAN MASC COM PUNHO',
    genero: 'masculino',
    faixa: 'adulto',
    grade: { P: 19, M: 22, G: 16, GG: 13, XG: 25, G1: 19 },
    tecidos: [{ nome: 'SUPLEX 84% POLIESTER 16% ELASTANO', cor: 'Amarelo Limão' }],
    design: [
      { tag: 'Subli', tecnica: 'subli', cores: ['S10', 'S13', 'S05', 'S34', 'S12'] },
      { tag: 'Eti. Cliente', tecnica: 'etiqueta', cores: [] },
    ],
    arte: 'raglan-sublimacao-total.psd',
    observacao: 'Sublimação total. Punho na cor do corpo.',
    precoBase: 77,
    precoPorTamanho: {},
  },
  {
    porque: 'a segunda ALTA na mesma folha: é aqui que a folha estoura, se for estourar',
    formato: ALTA,
    cor: '#E0218A',
    referencia: 'FT-040-004C',
    nome: 'MOLETOM INFANTIL COM CAPUZ E BOLSO CANGURU',
    genero: 'infantil',
    faixa: 'infantil',
    grade: { '4A': 8, '6A': 14, '8A': 22, '10A': 18, '12A': 11, '14A': 5 },
    tecidos: [{ nome: 'MOLETOM FLANELADO', cor: 'Cinza Mescla' }],
    design: [
      { tag: 'Silk', tecnica: 'silk', cores: ['004', '011'] },
      { tag: 'Patch', tecnica: 'patch', cores: [] },
      { tag: 'Ribana', tecnica: 'ribana', cores: [] },
    ],
    arte: 'moletom-capuz-escola.ai',
    observacao:
      'Nome do aluno no bolso. <span style="color:#C6161B"><b>Não estampar as costas.</b></span>',
    precoBase: 128,
    precoPorTamanho: { '14A': 139 },
  },
  {
    porque: 'o caso misto: ALTA em cima de uma BAIXA, com as colunas de alturas diferentes',
    formato: ALTA,
    cor: '#B7791F',
    referencia: 'FT-070-002F',
    nome: 'REGATA FEM CAVADA',
    genero: 'feminino',
    faixa: 'adulto',
    grade: { PP: 4, P: 9, M: 11, G: 7 },
    tecidos: [{ nome: 'POLIAMIDA FRESH', cor: 'Off White' }],
    design: [{ tag: 'DTF', tecnica: 'dtf', cores: ['002'] }],
    arte: 'regata-cavada.ai',
    observacao: '',
    precoBase: 62,
    precoPorTamanho: {},
  },
  {
    porque: 'a peça magra: grade curta, sem observação e sem etiqueta, para o vão aparecer',
    formato: BAIXA,
    cor: '#494B59',
    referencia: 'FT-090-005U',
    nome: 'BONE ABA CURVA',
    genero: '',
    faixa: 'adulto',
    grade: { M: 40 },
    tecidos: [{ nome: 'ALGODAO 100%', cor: 'Preto' }],
    design: [{ tag: 'Bordado', tecnica: 'bordado', cores: [] }],
    arte: '',
    observacao: '',
    precoBase: 34,
    precoPorTamanho: {},
  },
]

function blocoDaReceita(r: Receita, n: number, imagem: string): Bloco {
  return {
    id: 'KT' + n,
    n,
    referencia: r.referencia,
    nomeDaReferencia: r.nome,
    genero: r.genero,
    faixa: r.faixa,
    grade: r.grade,
    tecidos: r.tecidos.map((t) => ({ nome: t.nome, cor: t.cor, hex: hexDoTecido(t.cor) })),
    design: r.design.map((d) => ({
      tag: d.tag,
      tecnica: d.tecnica,
      cores: d.cores.map((cod) => ({ cod, hex: hexDaCor(cod) })),
    })),
    informacoes: false,
    arte: r.arte,
    imagem,
    observacao: r.observacao,
  }
}

/**
 * Monta o orçamento de teste por cima da cotação aberta.
 *
 * O NÚMERO, O ID E O ESTADO NÃO SÃO TOCADOS. O kit troca o conteúdo, e não a
 * identidade: uma cotação de teste que muda de número some da aba em que
 * estava sendo olhada, e quem clicou perde o lugar.
 */
export async function montarKitDeTeste(atual: Cotacao): Promise<Cotacao> {
  const produtos: ProdutoCotado[] = RECEITAS.map((r, i) => ({
    bloco: blocoDaReceita(r, i + 1, desenharImagem(i + 1, r.formato.l, r.formato.a, r.cor)),
    precoBase: r.precoBase,
    precoPorTamanho: r.precoPorTamanho,
  }))

  return {
    ...atual,
    versaoDoFormato: VERSAO_DO_CFT,
    validaAte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    vendedor: 'Henrique',
    cliente: {
      id: 'KT',
      nome: 'CLIENTE DE TESTE LTDA ME',
      documento: '12.345.678/0001-90',
      contato: 'Fulano de Tal',
      telefone: '(62) 99999-0000',
      email: 'teste@fourtime',
      cidade: 'Goiânia',
      uf: 'GO',
    },
    produtos,
    /* um desconto e um acréscimo: a folha 1 tem que somar os dois na ordem
       certa, e o de porcento tem que incidir sobre o subtotal e não sobre o
       total já ajustado */
    ajustes: [
      { id: 'KT1', descricao: 'Desconto de fechamento', tipo: 'porcento', valor: -7 },
      { id: 'KT2', descricao: 'Frete para Anápolis', tipo: 'reais', valor: 180 },
    ],
    informe: {
      prazo: '12 dias úteis',
      pagamento: 'ENTRADA + SAIDA',
      entrega: 'CORREIOS',
      tabelaDePreco: 'Atacado 2026',
    },
    informes: informesEmBranco(),
    producao: {
      ...atual.producao,
      pedido: 'PD009999',
      dataDeEnvio: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      departamento: atual.producao.departamento || 'DTF + Sublimação',
      embalagem: atual.producao.embalagem || 'Fardo',
      marcas: ['URGENTE'],
      observacao: 'Documento montado pelo kit de teste. Nada aqui é pedido de verdade.',
    },
  }
}

/** o motivo de cada peça, para quem for mexer no kit depois */
export const MOTIVOS_DO_KIT = RECEITAS.map((r, i) => 'L-' + String(i + 1).padStart(2, '0') + ': ' + r.porque)
