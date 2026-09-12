import type { Cliente } from '../cliente/tipos'

/* ==========================================================================
   Quem leva a encomenda ate o cliente.

   A pergunta que esta tela responde e uma so: para esta cidade, quem entrega?
   A resposta sai do CEP, e o CEP vem de dois lugares. O do proprio cliente,
   quando existe, e o melhor. Quando ele nao existe, servem os CEPs dos outros
   clientes da mesma cidade, que a base ja tem: se tres vizinhos dele estao na
   faixa da Jadlog, ele tambem esta. E quando nem isso ha, sobra a cobertura
   por estado, que e mais grossa mas nunca mente.

   Por isso cada sugestao vem com a origem escrita. Uma transportadora achada
   pelo CEP do cliente e uma promessa; achada pela cobertura estadual e um
   palpite bom. Quem esta no atendimento precisa saber qual das duas esta
   olhando antes de prometer prazo para alguem.

   A tabela de faixas e provisoria e sai daqui quando Configuracoes existir.
   ========================================================================== */

export type Transportadora = {
  nome: string
  prazo: string
  observacao: string
  /** faixas de CEP, so digito, do menor ao maior */
  faixas?: [string, string][]
  /** siglas de UF, ou '*' para o Brasil inteiro */
  ufs?: string[]
  /** a variavel de cor do Design System que pinta o icone */
  cor: string
}

export const TRANSPORTADORAS: Transportadora[] = [
  {
    nome: 'Correios · PAC / SEDEX',
    prazo: '2 a 8 dias úteis',
    observacao: 'Cobertura nacional, padrão',
    ufs: ['*'],
    cor: '--tec-ribana',
  },
  {
    nome: 'Motoboy Fourtime',
    prazo: 'mesmo dia',
    observacao: 'Goiânia e Aparecida de Goiânia',
    faixas: [['74000000', '74999999']],
    cor: '--tec-silk',
  },
  {
    nome: 'Jadlog',
    prazo: '1 a 3 dias úteis',
    observacao: 'GO e DF',
    faixas: [
      ['70000000', '73699999'],
      ['72800000', '76799999'],
    ],
    cor: '--tec-dtf',
  },
  {
    nome: 'Braspress',
    prazo: '2 a 5 dias úteis',
    observacao: 'Capitais SP e GO',
    faixas: [
      ['01000000', '09999999'],
      ['74000000', '74899999'],
    ],
    cor: '--tec-subli',
  },
  {
    nome: 'Total Express',
    prazo: '1 a 4 dias úteis',
    observacao: 'Estado de São Paulo',
    faixas: [['01000000', '19999999']],
    cor: '--tec-bordado',
  },
]

/** De onde veio a sugestao. A ordem aqui e a ordem de confianca. */
export type Origem = 'cep' | 'cidade' | 'uf'

export const NOME_DA_ORIGEM: Record<Origem, string> = {
  cep: 'CEP do cliente',
  cidade: 'CEP da cidade',
  uf: 'cobertura estadual',
}

export type Sugestao = { transportadora: Transportadora; origem: Origem }

const so = (s: string) => (s || '').replace(/\D/g, '')
const semAcento = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const chaveDaCidade = (cidade: string, uf: string) => semAcento(cidade) + '|' + (uf || '')

/** Os CEPs conhecidos de cada cidade, tirados da propria base de clientes. */
export function cepsPorCidade(clientes: Cliente[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  clientes.forEach((c) => {
    if (!c.cidade) return
    const cep = so(c.cep)
    if (cep.length !== 8) return
    const k = chaveDaCidade(c.cidade, c.uf)
    const ja = mapa.get(k) ?? []
    if (!ja.includes(cep)) mapa.set(k, [...ja, cep])
  })
  return mapa
}

const dentro = (cep: string, faixas: [string, string][]) =>
  faixas.some(([a, b]) => cep >= a && cep <= b)

const ORDEM: Record<Origem, number> = { cep: 0, cidade: 1, uf: 2 }

export function transportadorasPara(c: Cliente, cepsDaCidade: Map<string, string[]>): Sugestao[] {
  const cepDoCliente = so(c.cep)
  const daCidade = c.cidade ? (cepsDaCidade.get(chaveDaCidade(c.cidade, c.uf)) ?? []) : []
  const achadas: Sugestao[] = []
  TRANSPORTADORAS.forEach((t) => {
    let origem: Origem | '' = ''
    if (t.faixas) {
      if (cepDoCliente.length === 8 && dentro(cepDoCliente, t.faixas)) origem = 'cep'
      else if (daCidade.some((cep) => dentro(cep, t.faixas!))) origem = 'cidade'
    }
    if (!origem && t.ufs && (t.ufs.includes('*') || (c.uf && t.ufs.includes(c.uf)))) origem = 'uf'
    if (origem) achadas.push({ transportadora: t, origem })
  })
  return achadas.sort((a, b) => ORDEM[a.origem] - ORDEM[b.origem])
}
