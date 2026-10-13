/* A porta da frente da producao. */
export * from './tipos'
export * from './semana'
export {
  acharPedido,
  carregarPedidos,
  carregarTodosOsPedidos,
  darNomeAoPedido,
  finalizarEm,
  liberarParaProducao,
  moverEtapa,
  moverPedido,
  mudarAviso,
  mudarEntrega,
  planejarPara,
  reabrir,
} from './repositorio'
export type { PassoDoPedido } from './repositorio'
export { avisoDoCaminho, botoesDoCaminho, type BotaoDoCaminho } from './caminho'

export {
  LIBERADOS_A_VISTA,
  abrirNoPcp,
  carregarLiberados,
  carregarOPcp,
  desmarcarDoPcp,
  devolverAoVendedor,
  devolverDoPcp,
  diasAte,
  marcarParaAprovacao,
  voltarAConferir,
} from './pcp'
export type { PedidoLiberado, PedidoNoPcp } from './pcp'


export {
  COLUNAS,
  carregarAsFatiasDoPedido,
  carregarAsRotas,
  carregarOQuadro,
  corDoPosto,
  diasParaAEntrega,
  estaNaRota,
  faltamPostos,
  moverAFatia,
  nomeDoPosto,
  paradoHa,
  pedidosDoQuadro,
  quemSeguraOPedido,
  rotaDe,
  vizinhoNaRota,
} from './kanban'
export type { FatiaNoQuadro, PedidoNoTrilho, Rota } from './kanban'

export { BlocoDaFatia } from './degraus'

export { compararOsComponentes, quanto } from './comparacao'
export { carregarConversa, carregarEquipeParaConversa, falarNoPedido } from './conversa'
export type { MensagemDoPedido, PessoaDaEquipe } from './conversa'
export type {
  ComparacaoDoLayout,
  ConsumoParaComparar,
  EstadoDaLinha,
  FichaParaComparar,
  LinhaDaComparacao,
  ReservaParaComparar,
} from './comparacao'

export {
  TONS_DE_TAG,
  TOM_DA_MARCA,
  apagarTag,
  buscarPedidosParaComparar,
  carregarALinhaDoTempo,
  carregarAsTags,
  chaveDaTag,
  comentarNoCartao,
  conferirASaida,
  cotacaoDoPedido,
  destravarOCartao,
  pedidosDoCliente,
  pegarOCartao,
  pontosDeAtencao,
  porATag,
  salvarPostosDaTag,
  salvarTag,
  separarDoCartao,
  soltarOCartao,
  tagValeNoPosto,
  tirarATag,
  tomDaMarca,
  travarOCartao,
} from './cartao'
export type {
  Conferencia,
  PedidoParaComparar,
  EventoDoCartao,
  ItemDaConferencia,
  Tag,
  TipoDeEvento,
  TomDaConferencia,
  TomDeTag,
} from './cartao'
