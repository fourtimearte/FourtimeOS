import type { Cliente } from '../cliente/tipos'
import { carregarTransportadores, type Transportador } from '../transporte'

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

   DESDE 12/10/2026 A LISTA E O CADASTRO DE TRANSPORTE (tabela transportador,
   042), e nao mais a lista fixa que morava aqui. A cobertura sai do campo
   "Onde atende" de cada transportadora e motoboy, lido por `deCadastro`:
     "Brasil", "nacional" ou "todo o país"      o Brasil inteiro
     siglas de estado (GO, DF, SP)              o estado inteiro
     faixas de CEP (74000-000 a 74999-999)      a faixa
     o nome da cidade ("Goiânia e Aparecida")   a cidade
   Uber e taxi nao entram: nao levam encomenda.
   ========================================================================== */

export type Transportadora = {
  nome: string
  prazo: string
  observacao: string
  /** faixas de CEP, so digito, do menor ao maior */
  faixas?: [string, string][]
  /** siglas de UF, ou '*' para o Brasil inteiro */
  ufs?: string[]
  /** nomes de cidade, sem acento e em minuscula, tirados do "Onde atende" */
  cidades?: string[]
  /** a variavel de cor do Design System que pinta o icone */
  cor: string
}

/* A LISTA DE ANTES (ate 12/10/2026). Fica so como exemplo para o /kit e
   para os testes: a tela de clientes le o cadastro de transporte. */
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
  cidade: 'nome ou CEP da cidade',
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

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))
const CORES = ['--tec-ribana', '--tec-silk', '--tec-dtf', '--tec-subli', '--tec-bordado', '--tec-patch', '--tec-costura']

/* a cor segue a transportadora, e nao a posicao dela na lista: tirar uma do
   cadastro nao pode repintar as outras */
function corDe(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CORES[h % CORES.length]
}

/** Le o "Onde atende" escrito a mao e devolve a cobertura que ele descreve. */
export function coberturaDoTexto(texto: string): Pick<Transportadora, 'faixas' | 'ufs' | 'cidades'> {
  const t = texto || ''
  const faixas: [string, string][] = []
  const reFaixa = /(\d{5})-?(\d{3})\s*(?:a|até|ate|-)\s*(\d{5})-?(\d{3})/gi
  let m: RegExpExecArray | null
  while ((m = reFaixa.exec(t))) faixas.push([m[1] + m[2], m[3] + m[4]])
  const semFaixa = t.replace(reFaixa, ' ')
  const nacional = /brasil|nacional|todo o pa[ií]s/i.test(semFaixa)
  const ufs = nacional ? ['*'] : [...new Set((semFaixa.match(/\b[A-Z]{2}\b/g) ?? []).filter((x) => UFS.has(x)))]
  /* o resto, sem as siglas, separado por virgula, "e", "/" e ponto e
     virgula: cada pedaco que sobra e um nome de cidade */
  const cidades = nacional
    ? []
    : semAcento(semFaixa.replace(/\b[A-Z]{2}\b/g, ' '))
        .split(/,|;|\/|\s+e\s+|\(|\)|\n|\s+-\s+/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter((x) => x.length >= 3 && !/^(capita(l|is)|estado|regiao|interior|grande|so|somente|apenas)$/.test(x))
  return { faixas: faixas.length ? faixas : undefined, ufs: ufs.length ? ufs : undefined, cidades: cidades.length ? cidades : undefined }
}

/** O cadastro de transporte, na forma que a sugestao de frete usa. */
export function deCadastro(lista: Transportador[]): Transportadora[] {
  return lista
    .filter((t) => t.meio === 'transportadora' || t.meio === 'motoboy')
    .map((t) => ({
      nome: t.nome,
      prazo: t.prazo,
      observacao: t.observacao || t.ondeAtende,
      ...coberturaDoTexto(t.ondeAtende),
      cor: corDe(t.id),
    }))
}

export function transportadorasPara(
  c: Cliente,
  cepsDaCidade: Map<string, string[]>,
  lista: Transportadora[] = TRANSPORTADORAS,
): Sugestao[] {
  const cepDoCliente = so(c.cep)
  const daCidade = c.cidade ? (cepsDaCidade.get(chaveDaCidade(c.cidade, c.uf)) ?? []) : []
  const achadas: Sugestao[] = []
  const cidade = semAcento(c.cidade)
  lista.forEach((t) => {
    let origem: Origem | '' = ''
    if (t.faixas) {
      if (cepDoCliente.length === 8 && dentro(cepDoCliente, t.faixas)) origem = 'cep'
      else if (daCidade.some((cep) => dentro(cep, t.faixas!))) origem = 'cidade'
    }
    if (!origem && cidade && t.cidades?.includes(cidade)) origem = 'cidade'
    if (!origem && t.ufs && (t.ufs.includes('*') || (c.uf && t.ufs.includes(c.uf)))) origem = 'uf'
    if (origem) achadas.push({ transportadora: t, origem })
  })
  return achadas.sort((a, b) => ORDEM[a.origem] - ORDEM[b.origem])
}

/* UMA LEITURA POR ABA. A tela de clientes pergunta a cobertura de centenas de
   clientes de uma vez, e o cadastro de transporte muda pouco: a lista fica
   guardada ate a pagina recarregar. Falhou, tenta de novo na proxima vez. */
let guardada: Promise<Transportadora[]> | null = null
export function carregarTransportadorasDoCadastro(): Promise<Transportadora[]> {
  if (!guardada) {
    guardada = carregarTransportadores()
      .then(deCadastro)
      .catch((e) => {
        guardada = null
        throw e
      })
  }
  return guardada
}
