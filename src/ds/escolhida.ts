/* A linha escolhida.

   Toda linha escolhida de lista, de sanfona ou de fila se pinta igual ao item
   aberto do menu: o degrade da tinta grafite, com o pontilhado que segue o
   ponteiro (07/10/2026, decisao 136). Sao quatro classes do Design System, e
   elas moram aqui para ninguem escrever o conjunto de cor: faltando uma, a
   linha fica sem fundo ou sem a luz, e nada avisa.

   Uso, ao lado da classe do proprio modulo, que continua mandando no texto:

     className={escolhido ? 'em-t em-sel ' + LINHA_ESCOLHIDA : 'em-t'}

   O desenho esta em base.css, em TINTA. */
export const LINHA_ESCOLHIDA = 'luz tinta m-grafite tinta-linha'
