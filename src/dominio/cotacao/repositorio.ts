import {
  DTF_CORES,
  GRUPOS_DE_COR,
  REFS,
  SB_CORES,
  refGenero,
} from '@ds/kit/banco-de-exemplo'
import type { Bloco, Design, Tecnica } from '../layout/bloco'
import { ETIQUETAS, GOLAS, KITS, MANGAS, NUMERACOES } from '../layout/vocabulario'
import { ENTREGAS, PAGAMENTOS } from '../banco/dados'
import type { Faixa, Grade } from '../layout/grade'
import {
  VERSAO_DO_CFT,
  informesEmBranco,
  type Cotacao,
  type EstadoDaCotacao,
  type ProdutoCotado,
} from './tipos'

/* ==========================================================================
   A porta de entrada da cotacao.

   Igual a de cliente: hoje ela monta uma lista de exemplo aqui dentro e guarda
   as alteracoes no proprio navegador. Quando o Supabase entrar, SO ESTE
   ARQUIVO muda. A tela, o editor e a folha A4 continuam iguais, porque
   conversam com estas funcoes e nao com o banco.

   ATENCAO: as cotacoes abaixo sao inventadas.
   ========================================================================== */

export const DADO_DE_EXEMPLO = true

const CHAVE = 'ft.cotacoes'

/* --- o sorteio que sempre da o mesmo resultado --------------------------- */
function sorteio(semente: number) {
  let x = semente
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const CORES_DE_TECIDO = GRUPOS_DE_COR.flatMap((g) => g.cores)

const TECIDOS_COMUNS = [
  'DRYFIT POLIESTER 100%',
  'ALGODAO 100%',
  'PIQUET COM ELASTANO',
  'MOLETOM FLANELADO',
  'POLIAMIDA FRESH',
  'SUPLEX 84% POLIESTER 16% ELASTANO',
]

const TAG_DA_TECNICA: Record<Tecnica, string> = {
  dtf: 'DTF',
  subli: 'Subli',
  silk: 'Silk',
  patch: 'Patch',
  bordado: 'Bordado',
  gola: 'Gola Tecido',
  ribana: 'Ribana',
  etiqueta: 'Eti. Fourtime',
}

const ARTES = [
  'uniforme-2026-frente',
  'escudo-peito',
  'manga-patrocinio',
  'costas-numeracao',
  'logo-bordado',
]

function gradeSorteada(faixa: Faixa, r: () => number): Grade {
  const tamanhos: string[] =
    faixa === 'adulto' ? ['P', 'M', 'G', 'GG', 'XG', 'G1'] : ['4A', '6A', '8A', '10A', '12A']
  const g: Grade = {}
  for (const t of tamanhos) {
    const n = Math.round(r() * 26)
    if (n > 0) (g as Record<string, number>)[t] = n
  }
  /* grade vazia nao existe na vida real: o M sempre tem alguem */
  if (!Object.keys(g).length) (g as Record<string, number>)[faixa === 'adulto' ? 'M' : '8A'] = 12
  return g
}

function designSorteado(r: () => number): Design[] {
  const lista: Design[] = []
  const principal: Tecnica = r() > 0.5 ? 'dtf' : 'subli'
  const banco = principal === 'dtf' ? DTF_CORES : SB_CORES
  const quantas = 2 + Math.floor(r() * 3)
  const cores: { cod: string; hex: string }[] = []
  for (let i = 0; i < quantas; i++) {
    const [cod, hex] = banco[Math.floor(r() * banco.length)]
    if (!cores.some((c) => c.cod === cod)) cores.push({ cod, hex })
  }
  lista.push({ tag: TAG_DA_TECNICA[principal], tecnica: principal, cores })
  if (r() > 0.6) lista.push({ tag: TAG_DA_TECNICA.bordado, tecnica: 'bordado', cores: [] })
  if (r() > 0.75) lista.push({ tag: TAG_DA_TECNICA.etiqueta, tecnica: 'etiqueta', cores: [] })
  return lista
}

function blocoSorteado(n: number, semente: number): Bloco {
  const r = sorteio(semente)
  const ref = REFS[Math.floor(r() * REFS.length)]
  const [codigo, nome] = ref.split(' — ')
  const genero = refGenero(codigo)
  const faixa: Faixa = genero === 'infantil' ? 'infantil' : 'adulto'
  const tecido = TECIDOS_COMUNS[Math.floor(r() * TECIDOS_COMUNS.length)]
  const [corNome, corHex] = CORES_DE_TECIDO[Math.floor(r() * CORES_DE_TECIDO.length)]
  return {
    id: 'B' + semente.toString(36) + n,
    n,
    referencia: codigo,
    nomeDaReferencia: nome ?? '',
    genero,
    faixa,
    grade: gradeSorteada(faixa, r),
    tecidos: [{ nome: tecido, cor: corNome, hex: corHex }],
    design: designSorteado(r),
    kit: KITS[Math.floor(r() * 2)],
    manga: MANGAS[Math.floor(r() * 2)],
    gola: GOLAS[Math.floor(r() * GOLAS.length)],
    etiqueta: ETIQUETAS[0],
    numeracao: NUMERACOES[Math.floor(r() * NUMERACOES.length)],
    arte: ARTES[Math.floor(r() * ARTES.length)],
    imagem: '',
    observacao: '',
  }
}

/* --- as cotacoes de exemplo ---------------------------------------------- */

type Semente = {
  numero: string
  estado: EstadoDaCotacao
  cliente: { id: string; nome: string; cidade: string; uf: string; contato: string }
  vendedor: string
  dias: number
  produtos: number
}

const SEMENTES: Semente[] = [
  {
    numero: '2026-0184',
    estado: 'rascunho',
    cliente: { id: 'C0001', nome: 'CrossBox Delta', cidade: 'Uberlândia', uf: 'MG', contato: 'Diego' },
    vendedor: 'Dani',
    dias: 1,
    produtos: 2,
  },
  {
    numero: '2026-0183',
    estado: 'enviada',
    cliente: { id: 'C0002', nome: 'Escola Girassol', cidade: 'Goiânia', uf: 'GO', contato: 'Paulo' },
    vendedor: 'Lucas',
    dias: 3,
    produtos: 3,
  },
  {
    numero: '2026-0182',
    estado: 'aprovada',
    cliente: { id: 'C0003', nome: 'Igreja Rio Claro', cidade: 'Rio Verde', uf: 'GO', contato: 'Renata' },
    vendedor: 'Dani',
    dias: 9,
    produtos: 1,
  },
  {
    numero: '2026-0181',
    estado: 'enviada',
    cliente: { id: 'C0007', nome: 'Time Aliança', cidade: 'Anápolis', uf: 'GO', contato: 'Bruno' },
    vendedor: 'Lucas',
    dias: 12,
    produtos: 2,
  },
  {
    numero: '2026-0180',
    estado: 'recusada',
    cliente: { id: 'C0011', nome: 'Academia Pulso', cidade: 'Brasília', uf: 'DF', contato: 'Sara' },
    vendedor: 'Dani',
    dias: 21,
    produtos: 1,
  },
  {
    numero: '2026-0179',
    estado: 'vencida',
    cliente: { id: 'C0015', nome: 'Colégio Nova Era', cidade: 'Goiânia', uf: 'GO', contato: 'Heitor' },
    vendedor: 'Lucas',
    dias: 40,
    produtos: 2,
  },
]

const DIA = 24 * 60 * 60 * 1000

function montarExemplo(s: Semente, i: number): Cotacao {
  const semente = 7919 * (i + 3)
  const r = sorteio(semente)
  const criada = new Date(Date.now() - s.dias * DIA)
  const validade = new Date(criada.getTime() + 15 * DIA)

  const produtos: ProdutoCotado[] = []
  for (let n = 1; n <= s.produtos; n++) {
    const bloco = blocoSorteado(n, semente + n * 101)
    produtos.push({
      bloco,
      precoPorTamanho: {},
      precoBase: 45 + Math.round(r() * 70),
    })
  }

  return {
    id: 'CT' + s.numero.replace('-', ''),
    numero: s.numero,
    versaoDoFormato: VERSAO_DO_CFT,
    estado: s.estado,
    criadaEm: criada.toISOString(),
    alteradaEm: criada.toISOString(),
    validaAte: validade.toISOString().slice(0, 10),
    vendedor: s.vendedor,
    cliente: {
      id: s.cliente.id,
      nome: s.cliente.nome,
      documento: '',
      contato: s.cliente.contato,
      telefone: '',
      email: '',
      cidade: s.cliente.cidade,
      uf: s.cliente.uf,
    },
    produtos,
    ajustes:
      s.estado === 'aprovada'
        ? [{ id: 'AJ1', descricao: 'Desconto fechamento', tipo: 'porcento', valor: -5 }]
        : [],
    informe: {
      prazo: '12 dias úteis',
      pagamento: PAGAMENTOS[0],
      envio: ENTREGAS[1],
      tabelaDePreco: 'Atacado 2026',
    },
    informes: informesEmBranco(),
    enviadas:
      s.estado === 'rascunho'
        ? []
        : [
            {
              numero: 1,
              data: new Date(criada.getTime() + DIA).toISOString(),
              total: produtos.reduce(
                (soma, p) =>
                  soma +
                  Object.entries(p.bloco.grade).reduce(
                    (t, [, q]) => t + (q ?? 0) * p.precoBase,
                    0,
                  ),
                0,
              ),
              pecas: produtos.reduce(
                (soma, p) =>
                  soma + Object.values(p.bloco.grade).reduce((t: number, q) => t + (q ?? 0), 0),
                0,
              ),
              para: s.cliente.contato,
              observacao: 'Primeiro envio',
            },
          ],
    aprovacao:
      s.estado === 'aprovada'
        ? {
            pedido: 'PD' + new Date().getFullYear() + '0001',
            versao: 1,
            quem: s.vendedor,
            em: new Date(criada.getTime() + 3 * DIA).toISOString(),
          }
        : null,
  }
}

/* --- a base viva --------------------------------------------------------- */

function lerGuardado(): Cotacao[] | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const lista = JSON.parse(cru) as Cotacao[]
    return Array.isArray(lista) ? lista : null
  } catch {
    return null
  }
}

function guardar(lista: Cotacao[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    /* navegador anonimo ou armazenamento cheio: a base vive so nesta aba */
  }
}

let base: Cotacao[] = lerGuardado() ?? SEMENTES.map(montarExemplo)

export function listarCotacoes(): Cotacao[] {
  return base
}

export function acharCotacao(id: string): Cotacao | null {
  return base.find((c) => c.id === id) ?? null
}

/** O proximo numero da serie, no formato ano-sequencia. */
export function proximoNumero(): string {
  const ano = new Date().getFullYear()
  const doAno = base
    .map((c) => c.numero)
    .filter((n) => n.startsWith(ano + '-'))
    .map((n) => Number(n.slice(5)) || 0)
  const proximo = (doAno.length ? Math.max(...doAno) : 0) + 1
  return ano + '-' + String(proximo).padStart(4, '0')
}

export function salvarCotacao(c: Cotacao): Cotacao {
  const salva: Cotacao = { ...c, alteradaEm: new Date().toISOString() }
  const i = base.findIndex((x) => x.id === salva.id)
  if (i >= 0) base = base.map((x, k) => (k === i ? salva : x))
  else base = [salva, ...base]
  guardar(base)
  return salva
}

export function apagarCotacao(id: string) {
  base = base.filter((c) => c.id !== id)
  guardar(base)
}

/** Volta a base ao exemplo de fabrica. Existe para a conferencia da tela. */
export function recomecarDoExemplo() {
  base = SEMENTES.map(montarExemplo)
  guardar(base)
}
