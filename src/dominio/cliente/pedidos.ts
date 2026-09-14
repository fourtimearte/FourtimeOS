import { tabela } from '@shared/supabase'

/* ==========================================================================
   O histórico de pedidos do cliente.

   Até 14/09/2026 este arquivo INVENTAVA o histórico: um sorteio partindo do id
   do cliente montava os pedidos a partir do total comprado, para a ficha ter o
   que mostrar antes de existir tabela de pedido.

   Ele saiu, e não foi só porque a tabela passou a existir. Um histórico
   inventado numa tela que alguém pode mostrar para um cliente é o tipo de
   conteúdo que um dia sai da tela e vira conversa: "Entregue, R$ 3.809" é uma
   frase sobre dinheiro que nunca aconteceu.

   O que ficou no lugar é o que se sabe de verdade, e as duas coisas são
   diferentes e ficam separadas:

     o que este sistema fechou   ->  linhas da tabela pedido, uma a uma
     o que veio do Bling         ->  três números somados, sem detalhe nenhum,
                                     porque detalhe é o que a importação não traz
   ========================================================================== */

export type EstadoDoPedido =
  | 'aprovado'
  | 'producao'
  | 'pronto'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

export const NOME_DO_ESTADO: Record<EstadoDoPedido, string> = {
  aprovado: 'Aprovado',
  producao: 'Em produção',
  pronto: 'Pronto',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export type Pedido = {
  numero: string
  data: string
  pecas: number
  valor: number
  estado: EstadoDoPedido
  resumo: string
  teste: boolean
}

type LinhaDoPedido = {
  numero: string
  aprovado_em: string
  pecas: number
  total: number
  estado: EstadoDoPedido
  departamento: string
  teste: boolean
  cotacao: { numero: string } | null
}

export async function pedidosDoCliente(clienteId: string): Promise<Pedido[]> {
  if (!clienteId) return []
  const linhas = await tabela<LinhaDoPedido[]>(
    'pedido?select=numero,aprovado_em,pecas,total,estado,departamento,teste,' +
      'cotacao(numero)&cliente_id=eq.' +
      encodeURIComponent(clienteId) +
      '&order=aprovado_em.desc',
  )
  return linhas.map((l) => ({
    numero: l.numero,
    data: (l.aprovado_em ?? '').slice(0, 10),
    pecas: Number(l.pecas) || 0,
    valor: Number(l.total) || 0,
    estado: l.estado,
    /* O resumo é o departamento, que é a técnica que a peça usou. Quando ele
       está em branco, o número da cotação de origem diz mais do que uma frase
       inventada sobre o que o pedido era. */
    resumo: l.departamento || (l.cotacao ? 'Cotação ' + l.cotacao.numero : ''),
    teste: !!l.teste,
  }))
}

/** Quantos pedidos vieram de antes do sistema, para a ficha poder dizer. */
export type AntesDoSistema = { pedidos: number; total: number; ultimo: string }

export async function historicoAntigo(clienteId: string): Promise<AntesDoSistema> {
  if (!clienteId) return { pedidos: 0, total: 0, ultimo: '' }
  const linhas = await tabela<
    { pedidos_antigos: number; total_antigo: number; ultimo_pedido_antigo: string | null }[]
  >(
    'cliente?select=pedidos_antigos,total_antigo,ultimo_pedido_antigo&id=eq.' +
      encodeURIComponent(clienteId),
  )
  const l = linhas[0]
  return {
    pedidos: Number(l?.pedidos_antigos) || 0,
    total: Number(l?.total_antigo) || 0,
    ultimo: l?.ultimo_pedido_antigo ?? '',
  }
}
