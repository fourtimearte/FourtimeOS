/* ==========================================================================
   O vocabulario de uma peca.

   Cinco listas curtas que descrevem como a peca e feita: o que se vende
   junto, a manga, a gola, a etiqueta e a numeracao. Elas moram aqui, ao lado
   do bloco, porque valem igual na cotacao e na ficha de producao: a mesma
   frase que o cliente le no PDF e a que a costura le na bancada.

   Sao listas, e nao texto livre, porque "gola careca" e "careca" e "gola
   redonda" escritos por tres pessoas viram tres pecas diferentes no
   relatorio e uma so na fabrica. Quando faltar alguma coisa aqui, a lista
   cresce; ela nao vira campo aberto.

   Elas viram cadastro no banco quando Configuracoes existir.
   ========================================================================== */

export const KITS = [
  'Camisa',
  'Camisa + calção',
  'Camisa + calção + meião',
  'Conjunto completo',
  'Calção / shorts',
  'Peça avulsa',
]

export const MANGAS = ['Curta', 'Longa', 'Regata', 'Raglan']

export const GOLAS = [
  'Gola careca, ribana na mesma cor',
  'Gola careca, ribana contrastante',
  'Gola V, ribana na mesma cor',
  'Gola polo retilínea',
  'Sem ribana (viés)',
]

export const ETIQUETAS = [
  'Etiqueta Fourtime tecida',
  'Etiqueta sublimada',
  'Etiqueta DTF',
  'Etiqueta do cliente',
  'Sem etiqueta',
]

export const NUMERACOES = [
  'Nome e número nas costas',
  'Só número nas costas',
  'Número frente e costas',
  'Sem nome e número',
]

/** Listas para o Seletor, que pede valor e rotulo. */
export const emOpcoes = (lista: string[]) => lista.map((x) => ({ valor: x, rotulo: x }))
