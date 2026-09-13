import { blocoEmBranco, migrarBloco, type Bloco } from '@dominio/layout'
import { totalDaGrade } from '@dominio/layout'

/* ==========================================================================
   A ficha de produção.

   É o editor da v3.375, e o mesmo documento que lá se chamava orçamento. O
   nome mudou porque no Fourtime OS o orçamento de venda é outra coisa, que
   nunca existiu no editor v4: aquele fala com o cliente, este fala com a
   fábrica.

   Ela guarda o cabeçalho, as peças e as marcas. E linha no banco, não
   arquivo: o `.ft` continua existindo, mas como exportação, e não como o
   lugar onde a ficha mora.
   ========================================================================== */

export const VERSAO_DA_FICHA = 1

/* As marcas do cabeçalho. Duas, as mesmas da v3.375, e a lista é fechada de
   propósito: marca que cada um escreve do seu jeito não filtra nada. */
export const MARCAS = ['URGENTE', 'ATRASADO'] as const
export type Marca = (typeof MARCAS)[number]

export const COR_DA_MARCA: Record<string, string> = {
  URGENTE: 'var(--brand)',
  ATRASADO: '#e8590c',
}

export type CabecalhoDaFicha = {
  /** o nome do documento. Espelha o cliente, em maiúsculo */
  nome: string
  cliente: string
  /** CPF ou CNPJ, com a máscara conforme o tamanho */
  documento: string
  /** PD mais seis dígitos. É a chave de negócio do pedido */
  pedido: string
  /** a data de envio, em ISO. A tela mostra dd/mm/aaaa */
  envio: string
  vendedor: string
  departamento: string
  entrega: string
  embalagem: string
  pagamento: string
  contato: string
  observacao: string
  marcas: string[]
}

/* Uma peça da ficha: o bloco mais o preço.

   O preço fica aqui, e não dentro do bloco, porque o bloco é o que a fábrica
   costura e vale igual com dinheiro e sem. Este embrulho tem a mesma forma do
   ProdutoCotado da cotação, e isso é de propósito: no dia em que os dois
   precisarem ser o mesmo, ele sobe para dominio/layout. Enquanto a ficha
   estiver nascendo, dois embrulhos parecidos custam menos que um embrulho
   compartilhado cedo demais. */
export type PecaDaFicha = {
  bloco: Bloco
  /** o valor que vale para os tamanhos sem valor próprio */
  precoBase: number
  precoPorTamanho: Partial<Record<string, number>>
}

export type Ficha = {
  id: string
  versao: number
  cabecalho: CabecalhoDaFicha
  pecas: PecaDaFicha[]
  criadaEm: string
  mudadaEm: string
}

export function cabecalhoEmBranco(): CabecalhoDaFicha {
  return {
    nome: '',
    cliente: '',
    documento: '',
    pedido: '',
    envio: '',
    vendedor: '',
    departamento: '',
    entrega: '',
    embalagem: '',
    pagamento: '',
    contato: '',
    observacao: '',
    marcas: [],
  }
}

export function pecaEmBranco(n: number): PecaDaFicha {
  return { bloco: blocoEmBranco(n), precoBase: 0, precoPorTamanho: {} }
}

export function fichaEmBranco(): Ficha {
  const agora = new Date().toISOString()
  return {
    id: 'F' + Math.random().toString(36).slice(2, 9),
    versao: VERSAO_DA_FICHA,
    cabecalho: cabecalhoEmBranco(),
    pecas: [pecaEmBranco(1)],
    criadaEm: agora,
    mudadaEm: agora,
  }
}

/* --- as contas ------------------------------------------------------------ */

export function pecasDaFicha(f: Ficha): number {
  return f.pecas.reduce((s, p) => s + totalDaGrade(p.bloco.grade), 0)
}

export function valorDaPeca(p: PecaDaFicha): number {
  return Object.entries(p.bloco.grade).reduce((soma, [tam, qtd]) => {
    const preco = p.precoPorTamanho[tam] ?? p.precoBase
    return soma + (qtd ?? 0) * preco
  }, 0)
}

export function valorDaFicha(f: Ficha): number {
  return f.pecas.reduce((s, p) => s + valorDaPeca(p), 0)
}

/* --- o número do pedido ---------------------------------------------------
   PD mais seis dígitos, como na v3.375. Aceita o que a pessoa digitar e
   devolve o formato: "4052" vira "PD004052", "pd4052" também. Existe porque a
   base antiga tem pedido cru e pedido com PD, e os dois apontando para o
   mesmo pedido é o começo de duas fichas para um pedido só. */
export function formataPedido(bruto: string): string {
  const so = String(bruto || '').replace(/\D/g, '')
  if (!so) return ''
  return 'PD' + so.slice(-6).padStart(6, '0')
}

/* --- CPF e CNPJ -----------------------------------------------------------
   A máscara acompanha o que está sendo digitado em vez de decidir de saída
   qual dos dois é: até onze dígitos ela escreve CPF, daí em diante CNPJ. E ela
   NÃO reescreve o campo inteiro a cada tecla, que era o defeito da versão
   antiga do editor: quem digitava no meio do número via o cursor pular para o
   fim. Aqui a máscara é uma função pura, e quem chama decide quando aplicar. */
export function mascaraDeDocumento(bruto: string): string {
  const d = String(bruto || '').replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** true quando o documento tem tamanho de CPF ou de CNPJ, ou está vazio */
export function documentoCompleto(bruto: string): boolean {
  const n = String(bruto || '').replace(/\D/g, '').length
  return n === 0 || n === 11 || n === 14
}

/* --- o nome do documento --------------------------------------------------
   Ele espelha o cliente, em maiúsculo, como na v3.375. Espelhar para de valer
   assim que alguém escreve um nome próprio: o automático serve para poupar
   digitação, não para desfazer o que a pessoa escolheu. */
export function nomeEspelhado(nomeAtual: string, clienteAntes: string, clienteAgora: string) {
  const igual = nomeAtual.trim() === '' || nomeAtual.trim() === clienteAntes.trim().toUpperCase()
  return igual ? clienteAgora.toUpperCase() : nomeAtual
}

/* --- a escada de migração ------------------------------------------------- */

type Bruto = Record<string, unknown>

const DEGRAUS: ((f: Bruto) => Bruto)[] = [
  /* de 0 para 1: nada a fazer, só carimbar */
  (f) => f,
]

export function migrarFicha(bruto: Bruto): Ficha {
  let v = Number(bruto.versao ?? 0)
  let atual = bruto
  while (v < VERSAO_DA_FICHA) {
    atual = DEGRAUS[v](atual)
    v++
  }
  const f = atual as unknown as Ficha
  return {
    ...f,
    versao: VERSAO_DA_FICHA,
    cabecalho: { ...cabecalhoEmBranco(), ...(f.cabecalho ?? {}) },
    pecas: (f.pecas ?? []).map((p) => ({
      ...p,
      precoBase: p.precoBase ?? 0,
      precoPorTamanho: p.precoPorTamanho ?? {},
      bloco: migrarBloco(p.bloco as unknown as Bruto),
    })),
  }
}
