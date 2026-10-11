/* A porta da frente do funil. */
export * from './tipos'
export { LEADS_DE_EXEMPLO, type LeadDeExemplo } from './exemplo'
export {
  acharLead,
  apagarLead,
  carregarConversa,
  carregarDonosPossiveis,
  carregarLeads,
  leadViraCliente,
  marcarLido,
  moverLead,
  porEstagio,
  registrarMensagem,
  salvarLead,
} from './repositorio'
export type { DonoPossivel } from './repositorio'
export {
  carregarRegraDoLeadDoSite,
  salvarRegraDoLeadDoSite,
  type ModoDoLeadDoSite,
  type RegraDoLeadDoSite,
} from './regra'
export { fichaDoSite, temFichaDoSite, type BlocoDaFicha, type LinhaDaFicha } from './site'
