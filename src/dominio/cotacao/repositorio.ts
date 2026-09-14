import { chamar, tabela } from '@shared/supabase'
import { VERSAO_DO_BLOCO } from '../layout/bloco'
import { arrumarCotacao } from './arquivo'
import {
  VERSAO_DO_CFT,
  pecasDaCotacao,
  totalDaCotacao,
  type Cotacao,
  type EstadoDaCotacao,
} from './tipos'

/* ==========================================================================
   A conversa da cotação com o Supabase.

   O DOCUMENTO INTEIRO VAI NUMA COLUNA SÓ, e isso está decidido na migração 011.
   O motivo, em uma frase: a cotação já é um formato versionado, o .cft, com
   uma escada de migração própria. Espalhar ele em cinco tabelas criaria uma
   SEGUNDA escada, a do banco, que teria que andar junto com a primeira para
   sempre, e o dia em que as duas discordassem seria o dia em que uma cotação
   aprovada abriria errada.

   A CONSEQUÊNCIA PRÁTICA, e ela não pode ser esquecida: dentro do corpo vão
   as imagens dos layouts. Uma lista de sessenta cotações pedindo o corpo
   baixaria dezenas de megabytes para desenhar sessenta linhas de texto.

   Por isso são DUAS leituras, e elas devolvem tipos diferentes de propósito:

     carregarCotacoes()  ->  CotacaoNaLista[]   sem corpo, para a tela de lista
     acharCotacao(id)    ->  Cotacao            com corpo, para o editor

   Tipos diferentes, e não o mesmo tipo pela metade: assim não existe o caminho
   em que alguém pega a lista e tenta desenhar um layout que não veio.
   ========================================================================== */

/* --- a lista ------------------------------------------------------------- */

export type CotacaoNaLista = {
  id: string
  numero: string
  clienteId: string
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  leadId: string
  estado: EstadoDaCotacao
  vendedor: string
  total: number
  pecas: number
  validaAte: string
  criadaEm: string
  alteradaEm: string
  /** o número do pedido, quando ela já virou um */
  pedido: string
  teste: boolean
}

type LinhaDaLista = {
  id: string
  numero: string
  cliente_id: string | null
  cliente_nome: string
  cliente_cidade: string
  cliente_uf: string
  lead_id: string | null
  estado: EstadoDaCotacao
  vendedor_nome: string
  total: number
  pecas: number
  valida_ate: string | null
  criada_em: string
  atualizado_em: string
  pedido_numero: string | null
  teste: boolean
}

export async function carregarCotacoes(): Promise<CotacaoNaLista[]> {
  const linhas = await tabela<LinhaDaLista[]>(
    'cotacao_na_lista?select=id,numero,cliente_id,cliente_nome,cliente_cidade,cliente_uf,' +
      'lead_id,estado,vendedor_nome,total,pecas,valida_ate,criada_em,atualizado_em,' +
      'pedido_numero,teste&order=criada_em.desc',
  )
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    clienteId: l.cliente_id ?? '',
    clienteNome: l.cliente_nome ?? '',
    clienteCidade: l.cliente_cidade ?? '',
    clienteUf: l.cliente_uf ?? '',
    leadId: l.lead_id ?? '',
    estado: l.estado,
    vendedor: l.vendedor_nome ?? '',
    total: Number(l.total) || 0,
    pecas: Number(l.pecas) || 0,
    validaAte: l.valida_ate ?? '',
    criadaEm: l.criada_em,
    alteradaEm: l.atualizado_em,
    pedido: l.pedido_numero ?? '',
    teste: !!l.teste,
  }))
}

/* --- o documento --------------------------------------------------------- */

type LinhaDaCotacao = {
  id: string
  numero: string
  corpo: Record<string, unknown>
  versao_do_formato: number
  estado: EstadoDaCotacao
  criada_em: string
  atualizado_em: string
}

/* O QUE ESTÁ GUARDADO TAMBÉM É ANTIGO.

   Uma cotação gravada ontem ficou parada no formato do dia em que foi gravada,
   enquanto o sistema andou. Por isso ela sobe a MESMA escada do arquivo .cft
   antes de chegar na tela, degrau por degrau. Uma que já esteja no formato de
   hoje não sobe nada: a escada só anda quando falta degrau.

   As colunas de fora mandam sobre o corpo no que elas sabem melhor: o número,
   o estado e as datas são gravados pelo banco, e o corpo pode estar com uma
   cópia velha deles se alguém gravou de duas abas. */
function deLinha(l: LinhaDaCotacao): Cotacao {
  const c = arrumarCotacao(l.corpo, Number(l.versao_do_formato ?? 0), VERSAO_DO_BLOCO)
  return {
    ...c,
    id: l.id,
    numero: l.numero,
    estado: l.estado,
    criadaEm: l.criada_em,
    alteradaEm: l.atualizado_em,
  }
}

export async function acharCotacao(id: string): Promise<Cotacao | null> {
  if (!id) return null
  const linhas = await tabela<LinhaDaCotacao[]>(
    'cotacao?select=id,numero,corpo,versao_do_formato,estado,criada_em,atualizado_em&id=eq.' +
      encodeURIComponent(id),
  )
  return linhas.length ? deLinha(linhas[0]) : null
}

/* O corpo vai sem as colunas que são do banco.

   O id e as datas moram fora, e mandar eles de volta dentro do corpo criaria
   duas verdades sobre a mesma coisa. O dia em que elas discordassem, ninguém
   saberia qual abrir. */
function corpoDe(c: Cotacao) {
  const { id: _id, criadaEm: _criadaEm, alteradaEm: _alteradaEm, ...resto } = c
  return resto
}

/* As ligacoes de LINHA, que nao sao conteudo do documento.

   O lead de onde a cotacao veio e um vinculo entre duas linhas do banco, e nao
   um campo do orcamento: ele nao sai impresso, o cliente nunca o ve, e um .cft
   aberto em outro computador nao deveria carregar o id de um lead que la nao
   existe. Por isso ele entra por FORA do corpo.

   O que se ganha com isso e a escada do .cft ficar parada: acrescentar um campo
   ao documento obriga a um degrau novo, e degrau e para sempre. Um vinculo de
   banco nao merece um degrau. */
export type LigacoesDaCotacao = { leadId?: string }

function colunasDe(c: Cotacao, l: LigacoesDaCotacao = {}) {
  return {
    ...(l.leadId ? { lead_id: l.leadId } : {}),
    corpo: corpoDe(c),
    versao_do_formato: VERSAO_DO_CFT,
    cliente_id: c.cliente.id || null,
    cliente_nome: c.cliente.nome,
    cliente_cidade: c.cliente.cidade,
    cliente_uf: c.cliente.uf,
    estado: c.estado,
    vendedor_nome: c.vendedor,
    /* O total e as peças são recalculados AQUI, e não lidos de um campo. São a
       mesma conta que a tela mostra, feita pela mesma função: se a lista e o
       editor discordassem sobre o total de uma cotação, quem veria primeiro
       seria o cliente. */
    total: totalDaCotacao(c),
    pecas: pecasDaCotacao(c),
    valida_ate: c.validaAte || null,
  }
}

export async function salvarCotacao(
  c: Cotacao,
  ligacoes: LigacoesDaCotacao = {},
): Promise<Cotacao> {
  if (c.id) {
    await tabela(`cotacao?id=eq.${encodeURIComponent(c.id)}`, {
      metodo: 'PATCH',
      corpo: colunasDe(c, ligacoes),
    })
    const salva = await acharCotacao(c.id)
    if (!salva) throw new Error('Gravei, mas não consegui ler a cotação de volta.')
    return salva
  }

  const criada = await tabela<{ id: string }[]>('cotacao', {
    metodo: 'POST',
    devolver: true,
    corpo: [{ numero: c.numero, ...colunasDe(c, ligacoes) }],
  })
  const id = criada[0]?.id
  if (!id) throw new Error('O banco aceitou mas não devolveu a linha.')
  const salva = await acharCotacao(id)
  if (!salva) throw new Error('Gravei, mas não consegui ler a cotação de volta.')
  return salva
}

export async function apagarCotacao(id: string): Promise<void> {
  await tabela(`cotacao?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/* O número sai do banco, e não de uma conta sobre a lista.

   Contar do lado de cá funcionaria enquanto uma pessoa estivesse mexendo. Duas
   pessoas criando cotação no mesmo minuto leriam a mesma lista, achariam o
   mesmo maior número e tirariam o mesmo próximo, e aí existiriam duas
   CO2026-0184. O contador no banco é uma linha só, e o update dele é atômico. */
export async function proximoNumero(): Promise<string> {
  return chamar<string>('proximo_numero_de_cotacao')
}

/* O SIM DO CLIENTE ACONTECE NO BANCO, NUMA CHAMADA SÓ.

   Aprovar não é só carimbar a cotação: é tirar o número do pedido, congelar o
   percentual de comissão do vendedor daquele dia, criar a linha do pedido e
   fechar o lead. As cinco coisas têm que acontecer juntas ou nenhuma, senão
   sobra uma cotação que a tela mostra aprovada e a fábrica nunca vê.

   Enquanto o sistema estiver em ensaio, o número volta como PD-TESTE-0001. */
export type PedidoGerado = { numero: string; teste: boolean; comissao_pct: number }

export async function aprovarNoBanco(cotacaoId: string, versao: number): Promise<PedidoGerado> {
  const p = await chamar<PedidoGerado | PedidoGerado[]>('aprovar_cotacao', {
    p_cotacao: cotacaoId,
    p_versao: versao,
  })
  return Array.isArray(p) ? p[0] : p
}
