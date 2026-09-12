/* A porta da frente do layout.

   O bloco de layout e a grade de tamanhos sao o que a cotacao (.cft) e a ficha
   de producao (.ft) vao compartilhar. Eles moram aqui, e nao dentro de um dos
   dois, para os dois lerem a mesma coisa e a escada de migracao ser uma so.

   Regra: dominio/ pode importar de shared/ e de ds/, e NUNCA de modules/. */
export * from './grade'
export * from './bloco'
