/* A porta da frente do dominio de cliente. */
export * from './tipos'
export * from './pedidos'
export {
  acharCliente,
  apagarCliente,
  carregarClientes,
  clienteEmBranco,
  salvarCliente,
} from './repositorio'
export { CLIENTES_DE_EXEMPLO } from './exemplo'
