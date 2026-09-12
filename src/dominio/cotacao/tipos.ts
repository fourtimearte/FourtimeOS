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
export const VERSAO_DO_CFT = 2

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

/** o que a producao precisa saber, e que vai no cabecalho da folha A4 */
export type InformeDeProducao = {
  prazo: string
  entrega: string
  pagamento: string
  observacao: string
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
      prazo: '15 dias úteis após a aprovação da arte',
      entrega: '',
      pagamento: '50% na aprovação, 50% na entrega',
      observacao: '',
    },
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
