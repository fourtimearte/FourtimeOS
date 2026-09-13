/* O Design System V7. A porta de entrada da camada.

   Regra: ds/ NUNCA importa de dominio/ nem de modules/. Ele não conhece o
   domínio, e é isso que torna impossível mexer numa tela e torcer um botão.

   Regra do kit: nenhum componente aparece numa tela do sistema antes de nascer
   na rota /kit, com todos os seus estados e nos dois temas. */

export { Botao, Chip } from './componentes/botao'
export { BotaoComMenu } from './componentes/botao-menu'
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

export { CalendarioFlutuante, CampoDeData, DataEmPilula, dataParaTela, telaParaData } from './componentes/data'

export { RedeDeSeguranca } from './componentes/rede'

export { Aviso, Esqueleto, Vazio } from './componentes/estado'
export type { TomAviso } from './componentes/estado'

export { Tabela } from './componentes/tabela'
export type { Coluna } from './componentes/tabela'

export { Gaveta, Modal } from './componentes/sobreposicao'

export { avisar, fecharRecado, PilhaDeRecados } from './componentes/recados'
export type { TomRecado } from './componentes/recados'

export { BuscaGlobal, usarAtalhoDaBusca } from './componentes/busca-global'
export type { ItemBusca } from './componentes/busca-global'

export {
  Amostra,
  Avatar,
  Cartao,
  ChipTecnica,
  PilulaTecnica,
  Selo,
  Tag,
  TituloCartao,
} from './componentes/superficie'
export type { Tecnica, TomSelo } from './componentes/superficie'

export { abrirDica, fecharDica, Flutuante, semAcento } from './componentes/flutuante'
export type { OpcoesFlutuante } from './componentes/flutuante'

export {
  BolinhasDeGenero,
  estiloDaTecnica,
  FaixaDeCores,
  MenuCodigoDeCor,
  MenuCorDeTecido,
  MenuDeContexto,
  MenuReferencia,
  MenuTecido,
  MenuTecnica,
} from './componentes/menus'
export type {
  AbaDeCores,
  GrupoDeCor,
  ItemDeContexto,
  Referencia,
  SecaoDeTecnica,
  TipoDeTecido,
} from './componentes/menus'

export { Kpi, Paginador, Seletor } from './componentes/seletor'
export type { OpcaoDoSeletor } from './componentes/seletor'

export { Casca, Pagina } from './componentes/casca'
export type { ItemDeNavegacao, SecaoDeNavegacao } from './componentes/casca'

export { TelaKit } from './kit/tela-kit'
export { aplicarTema, temaAtual, temaGuardado, type Tema } from './kit/tema'
