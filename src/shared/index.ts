/* Peças sem domínio: utilidades, formatadores, peças de apoio.
   Regra: shared/ só pode importar de ds/. Nunca de dominio/ nem de modules/. */
export {
  formatarCep,
  diaEmBrasilia,
  formatarData,
  lerNumero,
  formatarDinheiro,
  formatarDinheiroExato,
  formatarNumeroExato,
  formatarDocumento,
  formatarTelefone,
  linkDoWhatsApp,
  linkDoWhatsAppWeb,
  abrirNoWhatsApp,
  noComputador,
  versaoDaExtensao,
  semAcento,
} from './formatar'

export { quadradoPequeno } from './imagem'
export { ehUuid, vinculo } from './id'
export { usarConsulta } from './tela'
export {
  chaveDoMes,
  hojeEmData,
  lerMes,
  limitesDoMes,
  MES_LONGO,
  mesesAte,
  mesesEntre,
  nomeDoMes,
  quandoFoi,
  ultimosMeses,
} from './meses'
