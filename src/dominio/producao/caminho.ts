/* ==========================================================================
   O FIM DO CAMINHO DO PEDIDO: enviar, entregar, voltar um passo e cancelar
   (12/10/2026; a pendencia mais antiga do 12, secao 2, item 1).

   O banco ja tinha tudo desde a 022 e a 030: `mover_pedido` muda o estado, o
   gatilho confere a passagem e a matriz de acoes diz quem pode cada uma
   (`pedido.enviar`, `pedido.entregar`, `pedido.voltar`, `pedido.cancelar`).
   Faltava o botao. Esta conta, sem banco e sem tela, diz QUAIS botoes um
   pedido mostra em cada estado; quem pode apertar continua sendo o banco.

   Voltar de PRONTO para a producao NAO entra aqui: pronto e o pedido com a
   etapa "finalizado", e o gatilho devolve o estado para pronto enquanto a
   etapa for essa. Quem desfaz um pronto tira o cartao do finalizado no
   kanban (ou troca a etapa no painel de atividades), e o estado volta junto.
   ========================================================================== */

export type PassoDoPedido =
  | 'aprovado'
  | 'separacao'
  | 'pcp'
  | 'producao'
  | 'pronto'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

export type BotaoDoCaminho = {
  para: PassoDoPedido
  /** a chave da matriz de acoes (030) */
  acao: 'pedido.enviar' | 'pedido.entregar' | 'pedido.voltar' | 'pedido.cancelar'
  rotulo: string
  tom: 'forte' | 'contorno' | 'perigo'
  /** quando existe, a tela pergunta antes */
  pergunta?: string
}

const CANCELAR: BotaoDoCaminho = {
  para: 'cancelado',
  acao: 'pedido.cancelar',
  rotulo: 'Cancelar o pedido',
  tom: 'perigo',
  pergunta:
    'O pedido sai do caminho e para de contar como venda. A reserva de material continua até alguém desfazer na Separação. Só o administrador consegue reabrir depois.',
}

export function botoesDoCaminho(estado: PassoDoPedido): BotaoDoCaminho[] {
  switch (estado) {
    case 'pronto':
      return [{ para: 'enviado', acao: 'pedido.enviar', rotulo: 'Marcar como enviado', tom: 'forte' }, CANCELAR]
    case 'enviado':
      return [
        { para: 'entregue', acao: 'pedido.entregar', rotulo: 'Marcar como entregue', tom: 'forte' },
        { para: 'pronto', acao: 'pedido.voltar', rotulo: 'Voltar para pronto', tom: 'contorno' },
        CANCELAR,
      ]
    case 'entregue':
      return [{ para: 'enviado', acao: 'pedido.voltar', rotulo: 'Voltar para enviado', tom: 'contorno' }]
    case 'cancelado':
      return []
    default:
      return [CANCELAR]
  }
}

/** O que o aviso diz depois que o banco aceitou. */
export function avisoDoCaminho(numero: string, para: PassoDoPedido): string {
  switch (para) {
    case 'enviado':
      return 'Pedido ' + numero + ' marcado como enviado.'
    case 'entregue':
      return 'Pedido ' + numero + ' entregue. O caminho dele terminou.'
    case 'pronto':
      return 'Pedido ' + numero + ' voltou para pronto.'
    case 'cancelado':
      return 'Pedido ' + numero + ' cancelado.'
    default:
      return 'Pedido ' + numero + ' mudou de passo.'
  }
}
