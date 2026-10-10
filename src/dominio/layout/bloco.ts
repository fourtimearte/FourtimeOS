import { sanitizarTextoRico } from './texto'
import { limparMural, muralVazio, type Mural } from './destaques'
import type { Faixa, Grade } from './grade'

/* ==========================================================================
   O bloco de layout.

   Este e o pedaco que a cotacao (.cft) e a ficha de producao (.ft) vao
   compartilhar. Ele mora aqui, em dominio/layout, e nao dentro de um dos dois,
   exatamente para os dois lerem a mesma coisa e a escada de migracao ser uma
   so. Quando a fase 2 comecar, a ficha importa daqui sem copiar nada.

   Um bloco e uma peca cotada: referencia, tecido, cor, grade, design e imagem.
   ========================================================================== */

/* 1: o formato de nascimento.
   2: entraram cinco campos que eu inventei a partir do mockup: tipo de kit,
      manga, gola/ribana, etiqueta e numeracao.
   3: os cinco sairam. Eles nao existem no editor v3.375, que e o que a
      fabrica usa todo dia, e campo que ninguem preenche vira campo que todo
      mundo ignora. O que descreve como a peca e feita e o cartao de design,
      com as tres familias da v3.375: etiqueta, tecnica e acabamento. Gola e
      ribana ja moram la, como acabamento.
   4: entrou a marca de MODULO DE INFORMACOES, que na v3.375 e o anexo do
      pedido: ele nao tem tecido, design nem grade, e nao entra em soma
      nenhuma. Ate a v3.330 o editor adivinhava isso pela imagem, e
      atrapalhava quem estava montando; virou botao, e a decisao fica
      gravada.
   5: a observacao virou HTML.
   6: entrou o MURAL DOS DESTAQUES (o highlight do mockup, decisao 164): as
      regioes da arte que viram miniatura, com o zoom e a posicao de cada uma,
      e a trava. Mora no bloco porque e da arte daquele layout, e vai junto
      para o .cft, para a copia de layout e para a folha A4. */
export const VERSAO_DO_BLOCO = 6

export type Tecnica =
  | 'dtf'
  | 'subli'
  | 'silk'
  | 'patch'
  | 'bordado'
  | 'gola'
  | 'ribana'
  | 'etiqueta'

/** uma tecnica marcada no bloco, com as cores lancadas nela */
export type Design = {
  /** o nome como a fabrica fala: DTF, Subli, Silk, Eti. Fourtime, Gola Tecido */
  tag: string
  /** a familia de cor, que decide a pilula e a faixa */
  tecnica: Tecnica
  /** codigos do banco: 001 a 300 no DTF, S01 a S87 na sublimacao */
  cores: { cod: string; hex: string }[]
}

export type TecidoDoBloco = {
  nome: string
  cor: string
  hex: string
}

export type Bloco = {
  id: string
  /** a ordem na folha, comecando em 1 */
  n: number
  referencia: string
  nomeDaReferencia: string
  genero: string
  faixa: Faixa
  grade: Grade
  tecidos: TecidoDoBloco[]
  design: Design[]
  /** true quando o modulo e anexo do pedido, e nao peca de producao */
  informacoes?: boolean
  /** o nome da arte, que e o que liga o bloco ao arquivo de arte */
  arte: string
  /** a imagem em data URL, ou vazio */
  imagem: string
  observacao: string
  /** as regioes da arte que viram destaque, em fracoes da imagem original */
  destaques: Mural
  /** o formato em que o bloco foi gravado; carimbado na leitura */
  versao?: number
}

export function blocoEmBranco(n: number): Bloco {
  return {
    id: 'B' + Math.random().toString(36).slice(2, 9),
    n,
    referencia: '',
    nomeDaReferencia: '',
    genero: '',
    faixa: 'adulto',
    grade: {},
    tecidos: [],
    design: [],
    informacoes: false,
    arte: '',
    imagem: '',
    observacao: '',
    destaques: muralVazio(),
  }
}

/* ==========================================================================
   A escada de migracao do bloco.

   Ela nasce com um degrau so, que nao faz nada, e isso e de proposito: a hora
   de escrever a escada e antes de existir o segundo formato, nao depois. Cada
   mudanca de formato vira um degrau novo aqui, e nenhum arquivo antigo deixa
   de abrir.
   ========================================================================== */

type Bruto = Record<string, unknown>

const DEGRAUS: ((b: Bruto) => Bruto)[] = [
  /* de 0 (antes de existir versao) para 1: nada a fazer, so carimbar */
  (b) => b,

  /* de 1 para 2: kit, manga, gola, etiqueta e numeracao.
     Elas entram vazias, e nao chutadas a partir do codigo da referencia. Campo
     vazio a tela mostra como "a definir", que e a verdade; campo preenchido
     por chute vira instrucao de costura que ninguem escreveu. */
  (b) => ({ kit: '', manga: '', gola: '', etiqueta: '', numeracao: '', ...b }),

  /* de 2 para 3: os cinco saem.
     O degrau nao apaga em silencio: o que a pessoa tinha escrito em gola e em
     etiqueta vai para a observacao do bloco, com o rotulo na frente. Campo que
     some levando junto o que estava dentro e a pior forma de migrar. */
  (b) => {
    const resto = [
      ['Kit', b.kit],
      ['Manga', b.manga],
      ['Gola', b.gola],
      ['Etiqueta', b.etiqueta],
      ['Numeração', b.numeracao],
    ]
      .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      .map(([r, v]) => r + ': ' + v)
      .join('. ')

    const anterior = typeof b.observacao === 'string' ? b.observacao : ''
    const nova = [anterior, resto].filter((x) => x.trim() !== '').join('. ')

    const limpo: Bruto = { ...b, observacao: nova }
    for (const k of ['kit', 'manga', 'gola', 'etiqueta', 'numeracao']) delete limpo[k]
    return limpo
  },

  /* de 3 para 4: a marca de informacoes.
     Ela entra desligada, e nao deduzida. A deducao antiga (imagem, e nada
     preenchido alem dela) so vale para arquivo .ft salvo antes da v3.329, e
     esse caminho e a importacao do .ft, nao esta escada. */
  (b) => ({ informacoes: false, ...b }),

  /* de 4 para 5: a observacao vira HTML.
     Ela ganhou marca-texto e cor de letra, e para isso precisa guardar
     marcacao. O que ja estava escrito e texto puro: passa escapado, senao um
     "<" digitado por alguem viraria etiqueta e comeria o resto da frase. A
     quebra de linha vira <br> porque no texto puro ela era a quebra. */
  (b) => {
    const cru = typeof b.observacao === 'string' ? b.observacao : ''
    const html = cru
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    return { ...b, observacao: html }
  },

  /* de 5 para 6: o mural dos destaques entra vazio. Arte antiga nunca teve
     regiao escolhida, e chutar uma seria inventar o que o vendedor nao fez. */
  (b) => ({ destaques: muralVazio(), ...b }),
]

export function migrarBloco(bruto: Bruto): Bloco {
  let v = Number(bruto.versao ?? 0)
  let atual = bruto
  while (v < VERSAO_DO_BLOCO) {
    atual = DEGRAUS[v](atual)
    v++
  }
  const b = { ...(atual as unknown as Bloco) }
  /* A PORTA DE ENTRADA E AQUI. Um bloco que ja chega na versao de hoje nao
     passa por degrau nenhum, e e justamente ele que pode trazer HTML escrito
     por outra mao: a faxina vale para todos, e nao so para os antigos. */
  b.observacao = sanitizarTextoRico(b.observacao)
  /* O MURAL TAMBEM PASSA PELA PENEIRA, sempre. Bloco que chega sem a versao
     gravada e tratado como sendo de hoje (a leitura do banco faz isso com os
     blocos novos, que nasciam sem carimbo), e ai nenhum degrau roda: sem esta
     linha ele chegaria sem mural e a tela cairia no primeiro b.destaques.regs.
     E o mural que veio de fora pode trazer numero fora da faixa. */
  b.destaques = limparMural(b.destaques)
  b.versao = VERSAO_DO_BLOCO
  return b
}
