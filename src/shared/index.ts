/* Peças sem domínio: utilidades, formatadores, peças de apoio.
   Regra: shared/ só pode importar de ds/. Nunca de dominio/ nem de modules/. */
export {
  formatarCep,
  formatarData,
  formatarDinheiro,
  formatarDinheiroExato,
  formatarDocumento,
  formatarTelefone,
  linkDoWhatsApp,
  semAcento,
} from './formatar'
