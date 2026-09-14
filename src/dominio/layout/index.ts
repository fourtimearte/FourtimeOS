/* A porta da frente do layout.

   O bloco de layout, a grade de tamanhos, a fileira do módulo com os cinco
   menus, a caixa de imagem e o copiar e colar: tudo que a cotação (.cft) e a
   ficha de produção (.ft) vão dividir. Escrito uma vez só, arrumado uma vez só.

   Regra: dominio/ pode importar de shared/ e de ds/, e NUNCA de modules/. */
export * from './grade'
/* bloco.ts ja exporta blocoEmBranco, migrarBloco e os tipos */
export * from './bloco'
export * from './banco'
export { sanitizarTextoRico } from './texto'
export { FileiraDoLayout, FileiraEmLeitura, ehIntruso } from './fileira'
export { GradeDeTamanhos, GradeEmLinha } from './grade-tamanhos'
export { ModuloDeLayout } from './modulo'
export { CaixaDeImagem } from './imagem'
export { comprimeImagem, jaEstaLeve, pesoDoDataUrl, prepararImagem } from './compressao'
export { colarBloco, copiarBloco, temCopia } from './copia'
export { compactarFolha, compactarPalco, NIVEIS_DA_TABELA } from './compactar'
export {
  ALTURA_DA_FOLHA,
  Folha,
  LARGURA_DA_FOLHA,
  Medidor,
  Palco,
  imprimir,
  usarPaginacao,
  type BlocoDaFolha,
} from './folha'
