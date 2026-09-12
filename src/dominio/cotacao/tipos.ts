import type { Bloco } from '../layout/bloco'
import { totalDaGrade } from '../layout/grade'

/* ==========================================================================
   A cotacao de venda.

   Ela e um documento proprio, o .cft, e nao a mesma coisa que a ficha de
   producao. A decisao esta em claude/DECISAO-COTACAO-E-FICHA-DOIS-EDITORES.md:
   sao dois editores ligados, porque as duas telas sao completamente
   diferentes. O que os dois compartilham e o bloco de layout, que mora em
   dominio/layout.
   ========================================================================== */

/* 1: o formato de nascimento.
   2: entrou o pedido. Enviar passou a gravar uma versao com o total que saiu,
      e aprovar passou a gerar numero de pedido, travar a grade e registrar
      quem aprovou e quando. */
/* 3: os informes viraram lista.
      "entrega" virou "envio", entrou "tabela de preco", e a observacao solta
      deu lugar a uma lista de informes, cada um com a sua marca de ir ou nao
      ir para o PDF. O vendedor tira um informe do documento sem apagar o
      texto, e e isso que faz a lista valer a pena. */
export const VERSAO_DO_CFT = 3

export type EstadoDaCotacao = 'rascunho' | 'enviada' | 'aprovada' | 'recusada' | 'vencida'

export const NOME_DO_ESTADO_DA_COTACAO: Record<EstadoDaCotacao, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  vencida: 'Vencida',
}

/** um produto cotado: o bloco de layout mais o que so a venda precisa saber */
export type ProdutoCotado = {
  bloco: Bloco
  /** preco por tamanho. Tamanho sem preco usa o precoBase */
  precoPorTamanho: Partial<Record<string, number>>
  precoBase: number
}

/** um acrescimo ou desconto no total, em reais ou em por cento */
export type Ajuste = {
  id: string
  descricao: string
  /** 'reais' soma o valor; 'porcento' aplica sobre o subtotal */
  tipo: 'reais' | 'porcento'
  valor: number
}

/** as condicoes, que vao no cabecalho da pagina 1 do documento */
export type InformeDeProducao = {
  prazo: string
  pagamento: string
  envio: string
  tabelaDePreco: string
}

/* Um informe e uma frase que o cliente le antes de aprovar. Desmarcar tira ela
   do PDF sem apagar o texto: a frase continua guardada e volta com um clique,
   que e o contrario de reescrever da memoria toda vez. */
export type InformeDoDocumento = {
  id: string
  texto: string
  noDocumento: boolean
}

/* Os nove informes que a Fourtime manda hoje. Eles nascem junto com a cotacao
   e cada uma leva a sua copia: mexer num informe de uma cotacao nao pode mexer
   na cotacao que ja foi enviada para outro cliente. */
export const INFORMES_PADRAO: { texto: string; noDocumento: boolean }[] = [
  {
    texto:
      'O prazo de produção começa a contar a partir da aprovação da arte final e da confirmação do pagamento da entrada.',
    noDocumento: true,
  },
  {
    texto:
      'Esta cotação é válida até a data indicada no cabeçalho. Após o prazo, valores e disponibilidade de tecido podem ser revistos.',
    noDocumento: true,
  },
  {
    texto:
      'Pagamento: 50% na aprovação e 50% na retirada ou envio. Pedidos abaixo de R$ 500,00 são pagos integralmente na aprovação.',
    noDocumento: true,
  },
  {
    texto:
      'Tolerância de até 2 cm nas medidas de cada peça e variação de tonalidade entre lotes de tecido, conforme prática do setor têxtil.',
    noDocumento: true,
  },
  {
    texto:
      'A arte aprovada pelo cliente é de sua responsabilidade: nomes, números e textos aprovados com erro não geram refação sem custo.',
    noDocumento: true,
  },
  {
    texto:
      'Alterações de grade, cor, tecido ou arte depois da aprovação geram nova cotação e novo prazo de entrega.',
    noDocumento: true,
  },
  {
    texto:
      'Quantidade mínima por modelo: 10 peças. Tamanhos acima de GG têm acréscimo já incluído na tabela de valores.',
    noDocumento: true,
  },
  {
    texto:
      'Frete por conta do cliente, salvo combinação em contrário. Entregas em Goiânia e Aparecida de Goiânia por motoboy.',
    noDocumento: false,
  },
  {
    texto:
      'Garantia de 90 dias contra defeitos de fabricação, nos termos do Código de Defesa do Consumidor. Não cobre desgaste de uso ou lavagem inadequada.',
    noDocumento: true,
  },
]

export function informesEmBranco(): InformeDoDocumento[] {
  return INFORMES_PADRAO.map((x, i) => ({ id: 'IF' + (i + 1), ...x }))
}

/** cada envio guarda o que foi enviado, para a conversa nao virar palavra
    contra palavra tres semanas depois */
export type VersaoEnviada = {
  numero: number
  data: string
  /* o total daquele envio, congelado. Ele NAO e recalculado depois: a conversa
     tres semanas depois e sobre o numero que o cliente viu, e nao sobre o de
     hoje */
  total: number
  pecas: number
  para: string
  observacao: string
}

/** O que aconteceu quando o cliente disse sim. */
export type Aprovacao = {
  /** o numero do pedido, que passa a ser o nome da coisa la na producao */
  pedido: string
  /** qual das versoes enviadas foi aprovada */
  versao: number
  quem: string
  em: string
}

export type Cotacao = {
  id: string
  numero: string
  versaoDoFormato: number
  estado: EstadoDaCotacao
  criadaEm: string
  alteradaEm: string
  validaAte: string
  vendedor: string
  cliente: {
    id: string
    nome: string
    documento: string
    contato: string
    telefone: string
    email: string
    cidade: string
    uf: string
  }
  produtos: ProdutoCotado[]
  ajustes: Ajuste[]
  informe: InformeDeProducao
  informes: InformeDoDocumento[]
  enviadas: VersaoEnviada[]
  /** existe a partir do sim do cliente; antes disso e null */
  aprovacao: Aprovacao | null
}

/* Depois de aprovada, a grade nao se mexe mais. Nao e capricho de sistema: a
   producao ja cortou por ela, e mudar quantidade depois do corte e o jeito
   classico de sobrar pano e faltar peca. Mudanca depois do sim vira cotacao
   nova, e e por isso que ela nao e bloqueada em silencio: a tela diz por que. */
export function travada(c: Cotacao): boolean {
  return !!c.aprovacao
}

/* --- as contas ----------------------------------------------------------- */

export function pecasDoProduto(p: ProdutoCotado): number {
  return totalDaGrade(p.bloco.grade)
}

export function totalDoProduto(p: ProdutoCotado): number {
  return Object.entries(p.bloco.grade).reduce((soma, [tam, qtd]) => {
    const n = qtd ?? 0
    const preco = p.precoPorTamanho[tam] ?? p.precoBase
    return soma + n * preco
  }, 0)
}

export function subtotal(c: Cotacao): number {
  return c.produtos.reduce((s, p) => s + totalDoProduto(p), 0)
}

/* Os ajustes em por cento valem sobre o subtotal, nunca sobre o total ja
   ajustado: dois descontos de 10 por cento nao viram 19, viram 20. */
export function valorDoAjuste(a: Ajuste, base: number): number {
  return a.tipo === 'reais' ? a.valor : (base * a.valor) / 100
}

export function totalDaCotacao(c: Cotacao): number {
  const base = subtotal(c)
  return c.ajustes.reduce((s, a) => s + valorDoAjuste(a, base), base)
}

export function pecasDaCotacao(c: Cotacao): number {
  return c.produtos.reduce((s, p) => s + pecasDoProduto(p), 0)
}

export function precoMedioPorPeca(c: Cotacao): number {
  const n = pecasDaCotacao(c)
  return n ? totalDaCotacao(c) / n : 0
}

/* --- o molde de uma cotacao nova ---------------------------------------- */

export function cotacaoEmBranco(numero: string): Cotacao {
  const hoje = new Date()
  const validade = new Date(hoje.getTime() + 15 * 24 * 60 * 60 * 1000)
  return {
    id: 'CT' + Math.random().toString(36).slice(2, 9),
    numero,
    versaoDoFormato: VERSAO_DO_CFT,
    estado: 'rascunho',
    criadaEm: hoje.toISOString(),
    alteradaEm: hoje.toISOString(),
    validaAte: validade.toISOString().slice(0, 10),
    vendedor: '',
    cliente: {
      id: '',
      nome: '',
      documento: '',
      contato: '',
      telefone: '',
      email: '',
      cidade: '',
      uf: '',
    },
    produtos: [],
    ajustes: [],
    informe: {
      prazo: '12 dias úteis',
      pagamento: '50% entrada + 50% na entrega',
      envio: 'Correios PAC',
      tabelaDePreco: 'Atacado 2026',
    },
    informes: informesEmBranco(),
    enviadas: [],
    aprovacao: null,
  }
}

/* --- enviar e aprovar ---------------------------------------------------- */

/** Grava o que foi enviado, com o total daquele momento. */
export function registrarEnvio(c: Cotacao, para: string, observacao: string): Cotacao {
  const versao: VersaoEnviada = {
    numero: c.enviadas.length + 1,
    data: new Date().toISOString(),
    total: totalDaCotacao(c),
    pecas: pecasDaCotacao(c),
    para,
    observacao,
  }
  return { ...c, estado: 'enviada', enviadas: [...c.enviadas, versao] }
}

/** O numero do pedido: ano mais sequencia, do mesmo jeito que a cotacao. */
export function numeroDePedido(usados: string[]): string {
  const ano = new Date().getFullYear()
  const doAno = usados
    .filter((n) => n.startsWith('PD' + ano))
    .map((n) => Number(n.slice(6)) || 0)
  const proximo = (doAno.length ? Math.max(...doAno) : 0) + 1
  return 'PD' + ano + String(proximo).padStart(4, '0')
}

export function aprovar(c: Cotacao, pedido: string, quem: string): Cotacao {
  return {
    ...c,
    estado: 'aprovada',
    aprovacao: {
      pedido,
      /* a versao aprovada e a ultima que saiu. Quando nao saiu nenhuma, o
         cliente aprovou o que estava na tela, e isso vira a versao 1 */
      versao: c.enviadas.length || 1,
      quem,
      em: new Date().toISOString(),
    },
  }
}
