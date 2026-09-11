/* O Design System V7.
   Regra: ds/ NUNCA importa de dominio/ nem de modules/. Ele não conhece o domínio.
   Os componentes (botão, campo, tabela, menu) entram no passo 5. */
export { TelaKit } from './kit/tela-kit'
export { aplicarTema, temaAtual, temaGuardado, type Tema } from './kit/tema'
