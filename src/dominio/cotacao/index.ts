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
  fatiasDaCotacao,
  numerosDaFabrica,
  type FatiaNova,
  type NumerosDaFabrica,
} from './fabrica'
export {
  COTACOES_DE_EXEMPLO,
  cotacoesDoEnsaioGrande,
  montarCotacaoDeExemplo,
  type ClienteDoEnsaio,
  type SementeDeCotacao,
} from './exemplo'
export {
  acharCotacao,
  apagarCotacao,
  aprovarNoBanco,
  carregarCotacoes,
  carregarPedidosDasCotacoes,
  pedidoDaCotacao,
  proximoNumero,
  salvarCotacao,
  type CotacaoNaLista,
  type EstadoDoPedidoNoComercial,
  type PedidoDaCotacao,
  type LigacoesDaCotacao,
  type PedidoGerado,
} from './repositorio'
export {
  CAMPOS_DO_CABECALHO,
  MODULOS_DA_PAGINA_UM,
  MODULOS_DO_LAYOUT,
  PRESET_CLIENTE,
  PRESET_PRODUCAO,
  PRESETS_DA_FABRICA,
  apagarPreset,
  carregarPresets,
  criarPreset,
  mudancas,
  presetQueAbre,
  salvarPreset,
  soComValor,
  vistaDe,
  type AbreEm,
  type CampoDoCabecalho,
  type ModuloDaFolha,
  type OndeMoram,
  type PresetDeImpressao,
  type PresetNovo,
  type VistaDaFolha,
} from './presets'
export {
  ESTADOS_DA_ABA,
  ONDE_ESTA_O_PEDIDO,
  diaDe,
  diasEntre,
  estatisticasDoComercial,
  naAba,
  nomeDoMes,
  nomeDoMesComAno,
  passoDoCaminho,
  quandoDaCotacao,
  ultimosMeses,
  type AbaDoComercial,
  type EstatisticasDoComercial,
} from './comercial'
