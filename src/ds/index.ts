/* O Design System V7. A porta de entrada da camada.

   Regra: ds/ NUNCA importa de dominio/ nem de modules/. Ele não conhece o
   domínio, e é isso que torna impossível mexer numa tela e torcer um botão.

   Regra do kit: nenhum componente aparece numa tela do sistema antes de nascer
   na rota /kit, com todos os seus estados e nos dois temas. */

export { Botao, Chip } from './componentes/botao'
export type { TomBotao, TamanhoBotao } from './componentes/botao'

export {
  AreaTexto,
  Busca,
  Campo,
  Entrada,
  Escolha,
  Interruptor,
  Marcacao,
  Segmentado,
} from './componentes/formulario'

export {
  Amostra,
  Cartao,
  ChipTecnica,
  PilulaTecnica,
  Selo,
  Tag,
  TituloCartao,
} from './componentes/superficie'
export type { Tecnica, TomSelo } from './componentes/superficie'

export { TelaKit } from './kit/tela-kit'
export { aplicarTema, temaAtual, temaGuardado, type Tema } from './kit/tema'
