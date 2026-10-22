/* A porta da frente das tabelas de preço (068). */
export * from './tipos'
export { apagarTabelaDePreco, carregarTabelasDePreco, salvarTabelaDePreco, tornarPadrao } from './repositorio'
export { gravarCustoDoDtf, lerCustoDoDtf } from './custo-do-dtf'
export * from './adicionais'
export { CamisaDoDtf, CamisaDosTamanhos, CamisasDoDtf, type MudancaDoTamanho } from './camisa'
