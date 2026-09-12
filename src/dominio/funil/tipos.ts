import { formatarDinheiro as dinheiro, linkDoWhatsApp as linkDoZap } from '@shared'

/* ==========================================================================
   O funil de vendas, do jeito que o mockup v5 desenhou.

   Seis colunas, e o lead e uma CONVERSA de WhatsApp que ainda nao virou
   pedido. Por isso o cartao mostra o trecho da ultima mensagem e o tempo
   desde ela, e nao um resumo de cadastro: quem olha o funil esta perguntando
   de quem a conversa esta esperando.
   ========================================================================== */

export type Estagio = 'novo' | 'atendimento' | 'cotacao' | 'negociando' | 'fechado' | 'perdido'

export const ESTAGIOS: Estagio[] = [
  'novo',
  'atendimento',
  'cotacao',
  'negociando',
  'fechado',
  'perdido',
]

export const NOME_DO_ESTAGIO: Record<Estagio, string> = {
  novo: 'Novo lead',
  atendimento: 'Em atendimento',
  cotacao: 'Cotação enviada',
  negociando: 'Negociando',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

/** Os dois estagios em que o relogio nao corre mais. */
export const ESTAGIO_FECHADO: Estagio[] = ['fechado', 'perdido']

/** A cor da barra de cada coluna, como no v5: fechado verde, perdido apagado. */
export function corDoEstagio(e: Estagio): string {
  if (e === 'fechado') return 'var(--ok)'
  if (e === 'perdido') return 'var(--text-3)'
  return 'var(--ink)'
}

export type Mensagem = {
  id: string
  quem: 'nos' | 'cliente'
  texto: string
  /** minutos atras, para a conversa nao envelhecer sozinha entre recargas */
  min: number
  lida?: boolean
}

export type Lead = {
  id: string
  /** id do cliente cadastrado, quando ja existe */
  clienteId: string
  /** o nome quando o lead ainda nao virou cliente */
  nomeLivre: string
  contato: string
  telefone: string
  estagio: Estagio
  /** a ultima mensagem, que e o que o cartao mostra */
  msg: string
  /** minutos desde a ultima mensagem */
  min: number
  /** quantas nao lidas: o numero vermelho no cartao */
  novo: number
  valor: number
  /** numero da cotacao ligada, quando existe */
  cotacao: string
  /** numero do pedido, quando fechou */
  pedido: string
  conversa: Mensagem[]
}

/** O tempo do cartao: 12 min, 3 h, 1 d. */
export function tempoCurto(min: number): string {
  if (min < 60) return min + ' min'
  if (min < 1440) return Math.round(min / 60) + ' h'
  return Math.round(min / 1440) + ' d'
}

/* No v5 o vermelho do tempo so aparece nas duas primeiras colunas: uma hora
   sem responder quem acabou de chegar e ruim, uma hora esperando o cliente
   decidir e normal. */
export function semResposta(l: Lead): boolean {
  return (l.estagio === 'novo' || l.estagio === 'atendimento') && l.min > 60
}

export function nomeDoLead(l: Lead): string {
  return l.nomeLivre
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function leadEmBranco(): Lead {
  return {
    id: 'L-' + Math.random().toString(36).slice(2, 7),
    clienteId: '',
    nomeLivre: 'Novo lead',
    contato: '',
    telefone: '',
    estagio: 'novo',
    msg: '',
    min: 0,
    novo: 0,
    valor: 0,
    cotacao: '',
    pedido: '',
    conversa: [],
  }
}

/* --- as respostas rapidas -----------------------------------------------
   As quatro do v5, na mesma ordem. Elas nao enviam sozinhas: escrevem a frase
   no campo, para a pessoa ler antes de mandar. */
export type RespostaRapida = { id: string; titulo: string; texto: string }

export const RESPOSTAS: RespostaRapida[] = [
  {
    id: 'precos',
    titulo: 'Tabela de preços',
    texto:
      'Oi {contato}! Nossa tabela começa em 10 peças. O valor por peça depende do modelo, do tecido e da técnica de estampa. Me diz o que você precisa que eu fecho o número certinho.',
  },
  {
    id: 'grade',
    titulo: 'Pedir grade',
    texto:
      'Oi {contato}! Para eu montar o orçamento preciso da grade de tamanhos, tipo 2 P, 6 M, 5 G, 1 GG. Pode mandar por aqui mesmo.',
  },
  {
    id: 'prazo',
    titulo: 'Prazo médio',
    texto:
      'O prazo de produção é de 12 dias úteis, contando a partir da aprovação da arte final e da confirmação do pagamento da entrada.',
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    texto:
      'Oi {contato}! Te mando o catálogo com os modelos e tecidos que a gente trabalha. Qualquer peça de lá sai personalizada com a sua arte.',
  },
]

export function preencher(texto: string, l: Lead): string {
  return texto.replace(/\{contato\}/g, l.contato || nomeDoLead(l) || 'tudo bem')
}

export function linkDoWhatsApp(l: Lead, mensagem: string): string {
  return linkDoZap(l.telefone, mensagem)
}

/** O v5 escreve dinheiro sem centavos no cartao e no topo da coluna. */
export const formatarDinheiro = dinheiro

/** R$ 16,1 mil, como sai no subtitulo da tela. */
export function emMil(v: number): string {
  return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
}
