import { linkDoWhatsApp as linkDoZap } from '@shared'

/* O que e um cliente para o sistema.

   Mora em dominio/ porque nao pertence a uma tela so: a cotacao vai precisar
   do mesmo tipo, e a ficha tambem. Se ele morasse dentro de modules/clientes,
   a cotacao teria que atravessar a porta de outro modulo para falar de cliente,
   e a regra do passo 4 nao deixa. */

export type Segmento =
  | 'escola'
  | 'academia'
  | 'time'
  | 'empresa'
  | 'orgao'
  | 'igreja'
  | 'evento'
  | 'outros'

export const NOME_DO_SEGMENTO: Record<Segmento, string> = {
  escola: 'Escola',
  academia: 'Academia',
  time: 'Time',
  empresa: 'Empresa',
  orgao: 'Órgão público',
  igreja: 'Igreja',
  evento: 'Evento',
  outros: 'Outros',
}

export type Cliente = {
  id: string
  nome: string
  /** CPF ou CNPJ, guardado so com digito, formatado na hora de mostrar */
  documento: string
  contato: string
  /** so digito, com DDD */
  telefone: string
  email: string
  cidade: string
  uf: string
  cep: string
  segmento: Segmento
  vendedor: string
  /** quantos pedidos ja fez */
  pedidos: number
  /** soma de tudo que ja comprou, em reais */
  total: number
  /** data do ultimo pedido, no formato ISO, ou vazio para quem nunca pediu */
  ultimoPedido: string
  criadoEm: string
}

/* --- as tres situacoes, que sao os KPIs clicaveis da tela ---------------- */
export type Situacao = 'ativo' | 'parado' | 'novo' | 'sem-pedido'

const DIA = 24 * 60 * 60 * 1000

/* A ordem importa: quem entrou este mes e novo mesmo que ja tenha pedido, e
   quem nunca pediu nao e parado, e outra conversa. */
export function situacaoDoCliente(c: Cliente, hoje = Date.now()): Situacao {
  const naCasa = (hoje - new Date(c.criadoEm).getTime()) / DIA
  if (naCasa <= 30) return 'novo'
  if (!c.ultimoPedido) return 'sem-pedido'
  const desdeOPedido = (hoje - new Date(c.ultimoPedido).getTime()) / DIA
  return desdeOPedido > 180 ? 'parado' : 'ativo'
}

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  ativo: 'Ativo',
  novo: 'Novo',
  parado: 'Parado',
  'sem-pedido': 'Sem pedido',
}

/* --- como o documento e o telefone aparecem na tela ---------------------- */
/* Os formatadores moram em shared/, porque telefone e telefone em qualquer
   tela. Ficam reexportados aqui para nenhuma tela precisar mudar de import. */
export {
  formatarCep,
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  formatarTelefone,
} from '@shared'

/* O link do WhatsApp com a mensagem pronta, que foi a decisao 1 do passo 1. */
export function linkDoWhatsApp(c: Cliente, mensagem: string) {
  return linkDoZap(c.telefone, mensagem)
}

