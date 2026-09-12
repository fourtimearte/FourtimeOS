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

/* Pessoa fisica ou juridica. Vem gravado, nao adivinhado pelo tamanho do
   documento: mais da metade da base do Bling nao tem documento nenhum, e
   adivinhar faria todos eles virarem pessoa fisica. */
export type TipoDePessoa = 'F' | 'J'

export type Cliente = {
  id: string
  nome: string
  /** o nome fantasia, quando existe. So a pessoa juridica costuma ter. */
  fantasia: string
  tipo: TipoDePessoa
  /** CPF ou CNPJ, guardado so com digito, formatado na hora de mostrar */
  documento: string
  contato: string
  /** so digito, com DDD. O fixo. */
  telefone: string
  /** so digito, com DDD. E por ele que sai o WhatsApp. */
  celular: string
  email: string
  endereco: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  /** "Cliente", "Cliente, Fornecedor", "Cliente, Funcionario" */
  tipoDeContato: string
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

/* --- a qualidade do cadastro ---------------------------------------------
   Estes seis numeros sao os KPIs do topo da tela, e todos eles saem de uma
   pergunta so: da para falar com esta pessoa? A base veio do Bling com muito
   cadastro pela metade, e esconder isso e como nunca arrumar. */

const so = (s: string) => (s || '').replace(/\D/g, '')

export function temContato(c: Cliente) {
  return !!(c.telefone || c.celular || c.email)
}

/** O numero de onze digitos, que e o unico que abre conversa no WhatsApp. */
export function numeroDeWhatsApp(c: Cliente) {
  return [c.celular, c.telefone].map(so).find((d) => d.length === 11) || ''
}

/** Sem documento e sem nenhuma forma de falar com a pessoa: so o nome. */
export function cadastroIncompleto(c: Cliente) {
  return !c.documento && !temContato(c)
}

export function temPedidoNoSistema(c: Cliente) {
  return c.pedidos > 0
}

const DIA_EM_MS = 24 * 60 * 60 * 1000

export function entrouNosUltimos30(c: Cliente, hoje = Date.now()) {
  if (!c.criadoEm) return false
  return (hoje - new Date(c.criadoEm).getTime()) / DIA_EM_MS <= 30
}

/* Duplicado nao e propriedade de um cliente: e de um par. Por isso a conta
   precisa da lista inteira, e devolve o conjunto de quem esbarrou em alguem. */
export function idsDuplicados(lista: Cliente[]): Set<string> {
  const porDocumento = new Map<string, string[]>()
  const porNome = new Map<string, string[]>()
  const chaveDoNome = (n: string) =>
    n
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
  lista.forEach((c) => {
    const d = so(c.documento)
    if (d) porDocumento.set(d, [...(porDocumento.get(d) ?? []), c.id])
    const n = chaveDoNome(c.nome)
    if (n) porNome.set(n, [...(porNome.get(n) ?? []), c.id])
  })
  const fora = new Set<string>()
  for (const grupo of [...porDocumento.values(), ...porNome.values()]) {
    if (grupo.length > 1) grupo.forEach((id) => fora.add(id))
  }
  return fora
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
  return linkDoZap(numeroDeWhatsApp(c) || c.celular || c.telefone, mensagem)
}

