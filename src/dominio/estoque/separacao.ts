import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   A separação.

   A reserva (026) diz o que um pedido aprovado comprometeu. A separação é onde
   isso deixa de ser promessa: o material sai da prateleira de verdade, e o que
   não saiu vira um aviso que viaja com o pedido até o PCP.

   SEPARAR NÃO MEXE NO LIVRE, MEXE NA PRATELEIRA. O livre já estava descontado
   pela reserva, então a promessa virar fato não muda o total disponível. Se o
   livre caísse de novo aqui, o mesmo material teria sido descontado duas vezes.
   Separar MENOS do que foi reservado devolve a diferença para o livre, porque
   aquele pedaço de malha voltou a estar disponível para outro pedido.
   ========================================================================== */

export type EstadoDaSeparacao = 'aprovado' | 'separacao'

export type PedidoNaSeparacao = {
  id: string
  numero: string
  cliente: string
  estado: EstadoDaSeparacao
  aviso: string
  pecas: number
  entregaEm: string
  departamento: string
  /** quantos materiais o pedido reserva */
  materiais: number
  /** quantos já saíram da prateleira */
  separados: number
  /** quantos o sistema não consegue dimensionar */
  semConsumo: number
  /** quantos a prateleira não cobre */
  naoCobre: number
  tudoSeparado: boolean
}

type LinhaDaFila = {
  id: string
  numero: string
  cliente: string
  estado: EstadoDaSeparacao
  aviso: string
  pecas: number
  entrega_em: string | null
  departamento: string
  materiais: number | string
  separados: number | string
  sem_consumo: number | string
  nao_cobre: number | string
  tudo_separado: boolean
}

const COLUNAS =
  'id,numero,cliente,estado,aviso,pecas,entrega_em,departamento,' +
  'materiais,separados,sem_consumo,nao_cobre,tudo_separado'

function inteiro(v: number | string): number {
  return typeof v === 'number' ? v : Number(v) || 0
}

/* A ordem é a da entrega, e não a da aprovação: quem separa atende primeiro o
   que sai primeiro. Pedido sem data de entrega vai para o fim, porque ele não
   tem como disputar posição com quem tem prazo. */
export async function carregarFilaDaSeparacao(): Promise<PedidoNaSeparacao[]> {
  const linhas = await tabela<LinhaDaFila[]>(
    `pedido_na_separacao?select=${COLUNAS}&order=entrega_em.asc.nullslast,numero.asc`,
  )
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    cliente: l.cliente ?? '',
    estado: l.estado,
    aviso: l.aviso ?? '',
    pecas: Number(l.pecas) || 0,
    entregaEm: l.entrega_em ?? '',
    departamento: l.departamento ?? '',
    materiais: inteiro(l.materiais),
    separados: inteiro(l.separados),
    semConsumo: inteiro(l.sem_consumo),
    naoCobre: inteiro(l.nao_cobre),
    tudoSeparado: !!l.tudo_separado,
  }))
}

/* Marca que alguém começou. Serve para a fila não parecer parada enquanto uma
   pessoa está no meio dela com o carrinho, e é o degrau que a trava da 022
   exige antes do PCP. */
export async function comecarASeparacao(pedidoId: string): Promise<void> {
  await chamar('mover_pedido', { p_pedido: pedidoId, p_para: 'separacao' })
}

/* A quantidade vem de quem pesou, e não da conta. A reserva já vem escrita no
   campo, mas quem separa confirma ou corrige: a reserva é uma conta e a
   separação é uma pesagem, e quando as duas discordam quem está certo é a
   balança. */
export async function separarMaterial(
  reservaId: string,
  quantidade: number,
  observacao = '',
): Promise<void> {
  await chamar('separar_material', {
    p_reserva: reservaId,
    p_quantidade: quantidade,
    p_observacao: observacao,
  })
}

/* Desfazer é uma devolução, com linha própria no razão. Apagar o movimento
   original deixaria o saldo certo e a história errada, e é a história que
   responde por que o saldo é esse. */
export async function desfazerASeparacao(reservaId: string): Promise<void> {
  await chamar('desfazer_a_separacao', { p_reserva: reservaId })
}

/* Move o pedido para o PCP e carimba a falta. Não exige que tudo tenha saído:
   exigir isso pararia a fábrica no dia em que faltasse meio quilo de malha, e
   quem decide se o pedido desce assim é o PCP. Devolve o recado pronto. */
export async function concluirASeparacao(pedidoId: string): Promise<string> {
  return chamar<string>('concluir_a_separacao', { p_pedido: pedidoId })
}
