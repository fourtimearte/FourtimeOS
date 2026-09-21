/* Um pedaco falso do Design System, so para este teste compilar.

   `tipos.ts` importa daqui um tipo so, `Tecnica`, e o caminho de verdade
   (`@ds`) puxa a arvore inteira do kit, que e TSX e precisa dos tipos do
   React. Nada disso tem relacao com a conta que esta sendo conferida, entao o
   teste troca aquele caminho por este arquivo. O que ele confere e a
   aritmetica da semana, e ela nao sabe o que e uma tecnica. */
export type Tecnica = string
