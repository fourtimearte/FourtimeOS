/* ==========================================================================
   O funil de vendas.

   Um lead e uma conversa que ainda nao virou pedido. Ele anda por estagios,
   guarda o que foi dito, e em algum momento vira cotacao. O funil nao e um
   quadro bonito: ele existe para ninguem esquecer de responder.
   ========================================================================== */

import { formatarDinheiro as dinheiro, linkDoWhatsApp as linkDoZap } from '@shared'

export type Estagio = 'novo' | 'contato' | 'orcando' | 'enviado' | 'ganho' | 'perdido'

export const ESTAGIOS: Estagio[] = ['novo', 'contato', 'orcando', 'enviado', 'ganho', 'perdido']

export const NOME_DO_ESTAGIO: Record<Estagio, string> = {
  novo: 'Novo',
  contato: 'Em contato',
  orcando: 'Orçando',
  enviado: 'Proposta enviada',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

export const EXPLICACAO_DO_ESTAGIO: Record<Estagio, string> = {
  novo: 'Chegou e ninguém falou ainda',
  contato: 'Conversa aberta, sem número ainda',
  orcando: 'Montando a cotação',
  enviado: 'Proposta na mão do cliente',
  ganho: 'Aprovou',
  perdido: 'Não foi desta vez',
}

/** Os dois estagios em que o relogio nao corre mais. */
export const ESTAGIO_FECHADO: Estagio[] = ['ganho', 'perdido']

export type Origem = 'whatsapp' | 'instagram' | 'indicacao' | 'site' | 'loja' | 'outro'

export const NOME_DA_ORIGEM: Record<Origem, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  indicacao: 'Indicação',
  site: 'Site',
  loja: 'Loja',
  outro: 'Outro',
}

export type Mensagem = {
  id: string
  quem: 'nos' | 'cliente'
  texto: string
  em: string
}

export type Lead = {
  id: string
  nome: string
  contato: string
  telefone: string
  cidade: string
  origem: Origem
  estagio: Estagio
  vendedor: string
  /** quantas pecas o cliente falou, mesmo que por alto */
  pecas: number
  /** o quanto a conversa vale, por alto, antes de existir cotacao */
  valor: number
  criadoEm: string
  /** quando alguem mexeu nele pela ultima vez: e o que conta o esquecimento */
  mexidoEm: string
  /** id da cotacao, quando ja existe uma */
  cotacao: string
  clienteId: string
  observacao: string
  conversa: Mensagem[]
}

const DIA = 24 * 60 * 60 * 1000

/** Ha quantos dias ninguem encosta neste lead. */
export function diasParado(l: Lead, hoje = Date.now()): number {
  return Math.floor((hoje - new Date(l.mexidoEm).getTime()) / DIA)
}

/* Esquecer um lead custa mais caro do que perder: perdido a gente sabe por que.
   Tres dias sem resposta ja e muito numa fabrica que responde no WhatsApp. */
export function esquecido(l: Lead, hoje = Date.now()): boolean {
  return !ESTAGIO_FECHADO.includes(l.estagio) && diasParado(l, hoje) >= 3
}

export function leadEmBranco(): Lead {
  const agora = new Date().toISOString()
  return {
    id: 'LD' + Math.random().toString(36).slice(2, 9),
    nome: '',
    contato: '',
    telefone: '',
    cidade: '',
    origem: 'whatsapp',
    estagio: 'novo',
    vendedor: '',
    pecas: 0,
    valor: 0,
    criadoEm: agora,
    mexidoEm: agora,
    cotacao: '',
    clienteId: '',
    observacao: '',
    conversa: [],
  }
}

/* --- as respostas rapidas -----------------------------------------------
   Elas nao sao enfeite: o que faz um lead esfriar e a demora em mandar a
   primeira frase. Os buracos em chaves sao trocados na hora de usar. */
export type RespostaRapida = { id: string; titulo: string; texto: string }

export const RESPOSTAS: RespostaRapida[] = [
  {
    id: 'ola',
    titulo: 'Primeiro contato',
    texto:
      'Olá, {contato}! Aqui quem fala é {vendedor}, da Fourtime. Vi que você procurou a gente sobre uniformes. Me conta o que você precisa: quantas peças, qual modelo e para quando?',
  },
  {
    id: 'arte',
    titulo: 'Pedir a arte',
    texto:
      'Oi, {contato}! Para montar o orçamento certinho preciso da arte ou de uma referência do que vocês querem, e da grade de tamanhos. Pode mandar por aqui mesmo.',
  },
  {
    id: 'enviei',
    titulo: 'Avisar que enviou',
    texto:
      'Oi, {contato}! Acabei de te mandar a proposta por e-mail. Qualquer dúvida me chama por aqui que eu ajusto.',
  },
  {
    id: 'lembrete',
    titulo: 'Cutucar sem incomodar',
    texto:
      'Oi, {contato}, tudo bem? Passando para saber se você chegou a ver a proposta. Se precisar mudar alguma coisa, é só falar.',
  },
  {
    id: 'prazo',
    titulo: 'Avisar do prazo',
    texto:
      'Oi, {contato}! Lembrando que o prazo de produção começa a contar depois da aprovação da arte. Se fecharmos esta semana, dá tempo tranquilo.',
  },
]

export function preencher(texto: string, l: Lead): string {
  return texto
    .replace(/\{contato\}/g, l.contato || l.nome || 'tudo bem')
    .replace(/\{vendedor\}/g, l.vendedor || 'Fourtime')
    .replace(/\{nome\}/g, l.nome || '')
}

export function linkDoWhatsApp(l: Lead, mensagem: string): string {
  return linkDoZap(l.telefone, mensagem)
}

export const formatarDinheiro = dinheiro
