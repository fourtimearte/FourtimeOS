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

export function situacaoDoCliente(c: Cliente, hoje = Date.now()): Situacao {
  if (!c.ultimoPedido) return 'sem-pedido'
  const dias = (hoje - new Date(c.ultimoPedido).getTime()) / DIA
  if (dias <= 90) {
    const desde = (hoje - new Date(c.criadoEm).getTime()) / DIA
    return desde <= 30 ? 'novo' : 'ativo'
  }
  if (dias > 180) return 'parado'
  return 'ativo'
}

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  ativo: 'Ativo',
  novo: 'Novo',
  parado: 'Parado',
  'sem-pedido': 'Sem pedido',
}

/* --- como o documento e o telefone aparecem na tela ---------------------- */
export function formatarDocumento(d: string) {
  const n = d.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d
}

export function formatarTelefone(t: string) {
  const n = t.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return t
}

export function formatarDinheiro(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatarData(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* O link do WhatsApp com a mensagem pronta, que foi a decisao 1 do passo 1:
   wa.me agora, API oficial depois. */
export function linkDoWhatsApp(c: Cliente, mensagem: string) {
  const n = c.telefone.replace(/\D/g, '')
  const numero = n.startsWith('55') ? n : '55' + n
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)
}
