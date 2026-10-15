/* A porta da frente do dominio de cliente. */
export * from './tipos'
export * from './pedidos'
export {
  acharCliente,
  apagarCliente,
  carregarClientes,
  clienteEmBranco,
  importarClientes,
  paraLinha,
  salvarCliente,
} from './repositorio'
export * from './importar'
export { CLIENTES_DE_EXEMPLO } from './exemplo'
export * from './extras'
