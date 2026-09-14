/* A porta da frente da cotacao de venda. */
export * from './tipos'
export {
  abrirCft,
  arrumarCotacao,
  ArquivoRecusado,
  baixarCft,
  deCft,
  EXTENSAO,
  nomeDoArquivo,
  paraCft,
} from './arquivo'
export { montarKitDeTeste, MOTIVOS_DO_KIT } from './kit-de-teste'
export {
  COTACOES_DE_EXEMPLO,
  montarCotacaoDeExemplo,
  type SementeDeCotacao,
} from './exemplo'
export {
  acharCotacao,
  apagarCotacao,
  aprovarNoBanco,
  carregarCotacoes,
  proximoNumero,
  salvarCotacao,
  type CotacaoNaLista,
  type LigacoesDaCotacao,
  type PedidoGerado,
} from './repositorio'
