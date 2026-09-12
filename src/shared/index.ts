/* Peças sem domínio: utilidades, formatadores, peças de apoio.
   Regra: shared/ só pode importar de ds/. Nunca de dominio/ nem de modules/. */
export {
  formatarCep,
  formatarData,
  formatarDinheiro,
  formatarDinheiroExato,
  formatarNumeroExato,
  formatarDocumento,
  formatarTelefone,
  linkDoWhatsApp,
  semAcento,
} from './formatar'
