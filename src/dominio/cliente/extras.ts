import { chamar, tabela } from '@shared/supabase'
import type { Cliente, TipoDePessoa } from './tipos'

/* ==========================================================================
   O CLIENTE DE MUITOS CADASTROS (082).

   O principal continua nas colunas da ficha: documento, contato, endereço.
   Os OUTROS (o segundo CNPJ da filial, o endereço da quadra, o contato do
   financeiro) moram em três listas ao lado, e cada cotação escolhe qual usa.

   Antes da 082 rodar no banco, as leituras devolvem listas vazias e o frete
   preferido vem null: a ficha continua funcionando como sempre.
   ========================================================================== */

export type DocumentoExtra = { id?: string; tipo: TipoDePessoa; documento: string; nome: string }
export type EnderecoExtra = {
  id?: string
  /** como a pessoa chama: "Filial Anápolis", "Quadra do time" */
  apelido: string
  endereco: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}
export type ContatoExtra = {
  id?: string
  nome: string
  /** financeiro, compras, o técnico do time */
  cargo: string
  celular: string
  telefone: string
  email: string
}

export type ExtrasDoCliente = {
  documentos: DocumentoExtra[]
  enderecos: EnderecoExtra[]
  contatos: ContatoExtra[]
}

export const EXTRAS_VAZIOS: ExtrasDoCliente = { documentos: [], enderecos: [], contatos: [] }

export const documentoEmBranco = (): DocumentoExtra => ({ tipo: 'J', documento: '', nome: '' })
export const enderecoEmBranco = (): EnderecoExtra => ({
  apelido: '',
  endereco: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
})
export const contatoEmBranco = (): ContatoExtra => ({ nome: '', cargo: '', celular: '', telefone: '', email: '' })

const so = (s: string) => (s || '').replace(/\D/g, '')

/** A linha que a pessoa deixou em branco não conta, e não vai para o banco. */
export const documentoVazio = (d: DocumentoExtra) => !so(d.documento)
export const enderecoVazio = (e: EnderecoExtra) => !(e.endereco.trim() || e.cidade.trim() || so(e.cep))
export const contatoVazio = (k: ContatoExtra) => !(k.nome.trim() || so(k.celular) || so(k.telefone) || k.email.trim())

type LinhaDosExtras = {
  documentos: { id: string; tipo: TipoDePessoa; documento: string; nome: string }[]
  enderecos: EnderecoExtra[]
  contatos: ContatoExtra[]
}

export async function carregarExtras(clienteId: string): Promise<ExtrasDoCliente> {
  if (!clienteId) return EXTRAS_VAZIOS
  try {
    const l = await tabela<LinhaDosExtras[]>(
      `extras_do_cliente?select=documentos,enderecos,contatos&cliente_id=eq.${encodeURIComponent(clienteId)}`,
    )
    const x = l[0]
    if (!x) return EXTRAS_VAZIOS
    return {
      documentos: (x.documentos ?? []).map((d) => ({ ...d, nome: d.nome ?? '' })),
      enderecos: x.enderecos ?? [],
      contatos: x.contatos ?? [],
    }
  } catch {
    return EXTRAS_VAZIOS
  }
}

/** Grava as três listas inteiras, como estão na tela: o que não veio sai. */
export async function salvarExtras(clienteId: string, x: ExtrasDoCliente): Promise<void> {
  await chamar('salvar_extras_do_cliente', {
    p_cliente: clienteId,
    p_documentos: x.documentos.filter((d) => !documentoVazio(d)).map(({ tipo, documento, nome }) => ({ tipo, documento: so(documento), nome })),
    p_enderecos: x.enderecos.filter((e) => !enderecoVazio(e)).map(({ id: _id, ...e }) => e),
    p_contatos: x.contatos.filter((k) => !contatoVazio(k)).map(({ id: _id, ...k }) => k),
  })
}

export const temExtras = (x: ExtrasDoCliente) => !!(x.documentos.length || x.enderecos.length || x.contatos.length)

/* --- trocar o principal --------------------------------------------------
   Tornar um extra principal é TROCAR DE LUGAR: o da ficha desce para a lista
   e o escolhido sobe. Nada fica em dois lugares, e nada some. */
export function tornarDocumentoPrincipal(c: Cliente, x: ExtrasDoCliente, i: number): [Cliente, ExtrasDoCliente] {
  const d = x.documentos[i]
  const desce: DocumentoExtra = { tipo: c.tipo, documento: c.documento, nome: d.nome ? c.nome : '' }
  const resto = x.documentos.filter((_, k) => k !== i)
  return [
    { ...c, tipo: d.tipo, documento: so(d.documento) },
    { ...x, documentos: documentoVazio(desce) ? resto : [desce, ...resto] },
  ]
}

export function tornarEnderecoPrincipal(c: Cliente, x: ExtrasDoCliente, i: number): [Cliente, ExtrasDoCliente] {
  const e = x.enderecos[i]
  const desce: EnderecoExtra = {
    apelido: 'Endereço anterior',
    endereco: c.endereco,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    cep: c.cep,
  }
  const resto = x.enderecos.filter((_, k) => k !== i)
  return [
    { ...c, endereco: e.endereco, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: e.cep },
    { ...x, enderecos: enderecoVazio(desce) ? resto : [desce, ...resto] },
  ]
}

export function tornarContatoPrincipal(c: Cliente, x: ExtrasDoCliente, i: number): [Cliente, ExtrasDoCliente] {
  const k = x.contatos[i]
  const desce: ContatoExtra = { nome: c.contato, cargo: '', celular: c.celular, telefone: c.telefone, email: c.email }
  const resto = x.contatos.filter((_, n) => n !== i)
  return [
    { ...c, contato: k.nome, celular: k.celular, telefone: k.telefone, email: k.email },
    { ...x, contatos: contatoVazio(desce) ? resto : [desce, ...resto] },
  ]
}

/* --- o endereço numa linha so ------------------------------------------- */
export function enderecoEmLinha(e: Pick<EnderecoExtra, 'endereco' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep'>): string {
  const cep = so(e.cep)
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/')
  return [e.endereco, e.complemento, e.bairro, cidade, cep.length === 8 ? 'CEP ' + cep.slice(0, 5) + '-' + cep.slice(5) : cep]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ')
}

/* --- as opções que a cotação escolhe -------------------------------------
   'principal' é o da ficha; os outros são o id do extra. */
export type OpcaoDoCadastro<T> = { valor: string; rotulo: string; dado: T }

export function documentosDoCliente(c: Cliente, x: ExtrasDoCliente): OpcaoDoCadastro<DocumentoExtra>[] {
  const lista: OpcaoDoCadastro<DocumentoExtra>[] = []
  if (so(c.documento)) lista.push({ valor: 'principal', rotulo: 'Principal', dado: { tipo: c.tipo, documento: c.documento, nome: c.nome } })
  x.documentos.forEach((d, i) => lista.push({ valor: d.id || 'd' + i, rotulo: d.nome || 'Outro ' + (d.tipo === 'F' ? 'CPF' : 'CNPJ'), dado: d }))
  return lista
}

export function enderecosDoCliente(c: Cliente, x: ExtrasDoCliente): OpcaoDoCadastro<EnderecoExtra>[] {
  const lista: OpcaoDoCadastro<EnderecoExtra>[] = []
  const principal: EnderecoExtra = { apelido: 'Principal', endereco: c.endereco, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, uf: c.uf, cep: c.cep }
  if (!enderecoVazio(principal)) lista.push({ valor: 'principal', rotulo: 'Principal', dado: principal })
  x.enderecos.forEach((e, i) => lista.push({ valor: e.id || 'e' + i, rotulo: e.apelido || 'Outro endereço', dado: e }))
  return lista
}

export function contatosDoCliente(c: Cliente, x: ExtrasDoCliente): OpcaoDoCadastro<ContatoExtra>[] {
  const lista: OpcaoDoCadastro<ContatoExtra>[] = []
  const principal: ContatoExtra = { nome: c.contato, cargo: '', celular: c.celular, telefone: c.telefone, email: c.email }
  if (!contatoVazio(principal)) lista.push({ valor: 'principal', rotulo: c.contato || 'Principal', dado: principal })
  x.contatos.forEach((k, i) => lista.push({ valor: k.id || 'k' + i, rotulo: [k.nome, k.cargo].filter(Boolean).join(' · ') || 'Outro contato', dado: k }))
  return lista
}

/* --- juntar duas fichas --------------------------------------------------
   Quem FICA guarda o nome e o principal; o principal de quem SAI vira extra,
   o vazio de quem fica é preenchido, e as cotações, os pedidos e os leads
   passam para quem fica. A ficha que sai vai inteira para o registro. */
export async function juntarClientes(fica: string, sai: string): Promise<void> {
  await chamar('juntar_clientes', { p_fica: fica, p_sai: sai })
}

/* --- o frete de costume ------------------------------------------------- */
export type FreteDoCliente = {
  /** o modo de entrega que mais aparece nos últimos 10 pedidos */
  modo: string
  vezes: number
  pedidos: number
  ultimoEnvio: string
  ultimoTransportador: string
}

export async function carregarFreteDoCliente(clienteId: string): Promise<FreteDoCliente | null> {
  if (!clienteId) return null
  try {
    const l = await tabela<
      { modo: string | null; vezes: number; pedidos: number; ultimo_envio: string | null; ultimo_transportador: string | null }[]
    >(`frete_do_cliente?select=modo,vezes,pedidos,ultimo_envio,ultimo_transportador&cliente_id=eq.${encodeURIComponent(clienteId)}`)
    const x = l[0]
    if (!x) return null
    return {
      modo: x.modo ?? '',
      vezes: Number(x.vezes) || 0,
      pedidos: Number(x.pedidos) || 0,
      ultimoEnvio: x.ultimo_envio ?? '',
      ultimoTransportador: x.ultimo_transportador ?? '',
    }
  } catch {
    return null
  }
}

/** "Transportadora em 4 de 6 pedidos" */
export function frasesDoFrete(f: FreteDoCliente | null): string[] {
  if (!f || !f.pedidos) return []
  const linhas: string[] = []
  if (f.modo) {
    const modo = f.modo.charAt(0) + f.modo.slice(1).toLowerCase()
    linhas.push(modo + ' em ' + f.vezes + ' de ' + f.pedidos + (f.pedidos === 1 ? ' pedido' : ' pedidos'))
  }
  if (f.ultimoTransportador) linhas.push('Da última vez levou: ' + f.ultimoTransportador)
  else if (f.ultimoEnvio) linhas.push('Último envio: ' + f.ultimoEnvio)
  return linhas
}
