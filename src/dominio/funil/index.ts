/* A porta da frente do funil. */
export * from './tipos'
export { LEADS_DE_EXEMPLO, type LeadDeExemplo } from './exemplo'
export {
  acharLead,
  apagarLead,
  carregarConversa,
  carregarLeads,
  marcarLido,
  moverLead,
  porEstagio,
  registrarMensagem,
  salvarLead,
} from './repositorio'
