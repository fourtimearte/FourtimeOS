import {
  DTF_CORES,
  GRUPOS_DE_COR,
  REFS,
  SB_CORES,
  refGenero,
} from '@ds/kit/banco-de-exemplo'
import type { Bloco, Design, Tecnica } from '../layout/bloco'
import { DEPARTAMENTOS, EMBALAGENS, ENTREGAS, PAGAMENTOS } from '../banco/dados'
import type { Faixa, Grade } from '../layout/grade'
import {
  VERSAO_DO_CFT,
  informesEmBranco,
  type Cotacao,
  type EstadoDaCotacao,
  type ProdutoCotado,
} from './tipos'

/* ==========================================================================
   As cotações de exemplo.

   ATENÇÃO: são inventadas. Nenhum cliente, valor ou layout aqui pertence a
   alguém de verdade.

   Elas não são mais a base do sistema: a base é o Supabase. Ficaram porque a
   base de verdade nasce vazia, e uma tela de cotações sem nenhuma cotação não
   diz se a busca, a ordenação e os seis números do topo funcionam.

   A semente (dominio/semente) grava esta lista dentro do banco, marcada como
   teste, e some inteira em um clique no dia do lançamento.
   ========================================================================== */

/* --- o sorteio que sempre da o mesmo resultado --------------------------- */
function sorteio(semente: number) {
  let x = semente
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const CORES_DE_TECIDO = GRUPOS_DE_COR.flatMap((g) => g.cores)

/* OS NOMES SAO OS DO CATALOGO, e nao parecidos com eles. Dois destes seis
   estavam escritos de cabeca (MOLETOM FLANELADO, SUPLEX 84% POLIESTER 16%
   ELASTANO) e nao existem na tabela tecido: o layout ficava pedindo uma malha
   que a fabrica nao tem, e o material nem chegava a ser cadastrado. Nome de
   tecido no ensaio e copia do catalogo, letra por letra. */
const TECIDOS_COMUNS = [
  'DRYFIT POLIESTER 100%',
  'ALGODAO 100%',
  'PIQUET COM ELASTANO',
  'MOLETOM',
  'POLIAMIDA FRESH',
  'SUPLEX POLIAMIDA',
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
    arte: ARTES[Math.floor(r() * ARTES.length)],
    imagem: '',
    observacao: '',
  }
}

/* --- as cotacoes de exemplo ---------------------------------------------- */

export type SementeDeCotacao = {
  numero: string
  estado: EstadoDaCotacao
  cliente: { id: string; nome: string; cidade: string; uf: string; contato: string }
  vendedor: string
  dias: number
  produtos: number
}

export const COTACOES_DE_EXEMPLO: SementeDeCotacao[] = [
  {
    numero: 'CO2026-0184',
    estado: 'rascunho',
    cliente: { id: 'C0001', nome: 'CrossBox Delta', cidade: 'Uberlândia', uf: 'MG', contato: 'Diego' },
    vendedor: 'Dani',
    dias: 1,
    produtos: 2,
  },
  {
    numero: 'CO2026-0183',
    estado: 'enviada',
    cliente: { id: 'C0002', nome: 'Escola Girassol', cidade: 'Goiânia', uf: 'GO', contato: 'Paulo' },
    vendedor: 'Lucas',
    dias: 3,
    produtos: 3,
  },
  {
    numero: 'CO2026-0182',
    estado: 'aprovada',
    cliente: { id: 'C0003', nome: 'Igreja Rio Claro', cidade: 'Rio Verde', uf: 'GO', contato: 'Renata' },
    vendedor: 'Dani',
    dias: 9,
    produtos: 1,
  },
  {
    numero: 'CO2026-0181',
    estado: 'enviada',
    cliente: { id: 'C0007', nome: 'Time Aliança', cidade: 'Anápolis', uf: 'GO', contato: 'Bruno' },
    vendedor: 'Lucas',
    dias: 12,
    produtos: 2,
  },
  {
    numero: 'CO2026-0180',
    estado: 'recusada',
    cliente: { id: 'C0011', nome: 'Academia Pulso', cidade: 'Brasília', uf: 'DF', contato: 'Sara' },
    vendedor: 'Dani',
    dias: 21,
    produtos: 1,
  },
  {
    numero: 'CO2026-0179',
    estado: 'vencida',
    cliente: { id: 'C0015', nome: 'Colégio Nova Era', cidade: 'Goiânia', uf: 'GO', contato: 'Heitor' },
    vendedor: 'Lucas',
    dias: 40,
    produtos: 2,
  },
]

const DIA = 24 * 60 * 60 * 1000

export function montarCotacaoDeExemplo(s: SementeDeCotacao, i: number): Cotacao {
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
    id: 'CT' + s.numero.replace(/\D/g, ''),
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
      entrega: ENTREGAS[1],
      tabelaDePreco: 'Atacado 2026',
    },
    informes: informesEmBranco(),
    /* o bloco que veio da ficha de producao. Na base de exemplo ele so tem
       numero de pedido depois do sim do cliente, que e quando ele nasce */
    producao: {
      pedido: s.estado === 'aprovada' ? 'PD004052' : '',
      dataDeEnvio: '',
      departamento: DEPARTAMENTOS[3],
      embalagem: EMBALAGENS[0],
      marcas: [],
      observacao: '',
    },
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



/* ==========================================================================
   O ENSAIO GRANDE.

   As seis cotações acima são escritas à mão de propósito: cada uma existe para
   pôr um estado específico na tela (rascunho, enviada, aprovada, recusada,
   vencida). Elas não servem para encher a fábrica, e encher é outra pergunta:
   com quatro pedidos não dá para ver se o kanban aguenta treze colunas cheias,
   se a fila da separação ordena direito, nem se o painel da semana fica
   legível com cinquenta linhas.

   Então o resto nasce de gerador, em cima dos clientes de verdade que já estão
   no banco. Não é uma lista maior escrita à mão: é a mesma função que monta as
   seis, chamada com outro índice, e por isso o documento sai com a mesma forma
   e passa pelas mesmas contas.

   A MAIORIA NASCE PRONTA PARA VIRAR PEDIDO. O ensaio aprova o que está em
   enviada ou aprovada, e é dali que saem os cinquenta pedidos; o resto fica
   como está para a tela de cotação ter os outros estados também.
   ========================================================================== */

export type ClienteDoEnsaio = { nome: string; cidade: string; uf: string; contato: string }

const VENDEDORES_DO_ENSAIO = ['Dani', 'Lucas', 'Marcos', 'Paula']

/* cinco de cada sete viram pedido. O resto pinta a tela de cotação. */
const ESTADOS_DO_ENSAIO: EstadoDaCotacao[] = [
  'aprovada',
  'enviada',
  'aprovada',
  'enviada',
  'aprovada',
  'rascunho',
  'recusada',
  'aprovada',
  'enviada',
  'aprovada',
  'enviada',
  'aprovada',
  'vencida',
  'enviada',
]

export function cotacoesDoEnsaioGrande(
  clientes: ClienteDoEnsaio[],
  quantas: number,
): SementeDeCotacao[] {
  const fora: SementeDeCotacao[] = []
  if (!clientes.length) return fora

  for (let i = 0; i < quantas; i++) {
    const c = clientes[i % clientes.length]
    fora.push({
      numero: '',
      estado: ESTADOS_DO_ENSAIO[i % ESTADOS_DO_ENSAIO.length],
      cliente: { id: '', nome: c.nome, cidade: c.cidade, uf: c.uf, contato: c.contato },
      vendedor: VENDEDORES_DO_ENSAIO[i % VENDEDORES_DO_ENSAIO.length],
      /* espalhadas por uns três meses para trás: a lista de cotação e o
         relatório mensal precisam de mais de um mês para dizer alguma coisa */
      dias: 2 + ((i * 7) % 88),
      produtos: 1 + (i % 4),
    })
  }
  return fora
}
