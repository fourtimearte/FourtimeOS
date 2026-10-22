/* ==========================================================================
   O DADO DOS ADICIONAIS (083), sem nenhuma conta e sem importar nada: a
   tabela de preço (tipos.ts) nasce com ele, e a conta (adicionais.ts) lê a
   tabela. Separado assim para os dois não se importarem em roda.
   ========================================================================== */

export type OpcaoDeExtra = {
  id: string
  nome: string
  /** a medida, quando faz sentido (o Bordado: 6 x 6 cm) */
  medida: string
  /** o preço de cada um; null = ainda sem preço */
  valor: number | null
}

/** patch e bordado são os que a ficha do layout já conhece; '' é um extra novo */
export type TecnicaDoExtra = 'patch' | 'bordado' | ''

export type Extra = { id: string; nome: string; tecnica: TecnicaDoExtra; opcoes: OpcaoDeExtra[] }

export type CombinacaoDeDtf = { id: string; nome: string; posicoes: string[]; valor: number | null }

/* --- os TAMANHOS de DTF (pedido dele em 22/10/2026: "preciso poder criar
   tamanhos de DTF, depois combiná-los para criar os templates com preço").
   Cada tabela tem os seus, editáveis: o nome, o lado da camisa, a medida
   real em cm e o lugar no desenho (o centro, de 0 a 100). A combinação
   guarda os ids dos tamanhos em `posicoes`, como antes. */
export type LadoDaCamisa = 'frente' | 'costas'
export type TamanhoDeDtf = { id: string; nome: string; lado: LadoDaCamisa; largura: number; altura: number; x: number; y: number }

/** Os seis de partida: os mesmos lugares das posições fixas de antes da
    edição, agora com a medida em cm. */
export function tamanhosPadrao(): TamanhoDeDtf[] {
  return [
    { id: 'peito-pequeno', nome: 'Peito pequeno', lado: 'frente', largura: 10, altura: 10, x: 62, y: 30 },
    { id: 'peito-grande', nome: 'Peito grande', lado: 'frente', largura: 21, altura: 29.7, x: 50, y: 44 },
    { id: 'manga-direita', nome: 'Manga direita', lado: 'frente', largura: 8, altura: 8, x: 17, y: 28 },
    { id: 'manga-esquerda', nome: 'Manga esquerda', lado: 'frente', largura: 8, altura: 8, x: 83, y: 28 },
    { id: 'nuca', nome: 'Nuca', lado: 'costas', largura: 10, altura: 4, x: 50, y: 16.5 },
    { id: 'costas-grande', nome: 'Costas grande', lado: 'costas', largura: 29.7, altura: 42, x: 50, y: 46 },
  ]
}

export type PrecoDoTecido = { tecido: string; valor: number | null }

export type Adicionais = { materiais: PrecoDoTecido[]; extras: Extra[]; dtf: CombinacaoDeDtf[]; tamanhosDtf: TamanhoDeDtf[] }

/* --- os extras de partida ------------------------------------------------------ */
export function extrasPadrao(): Extra[] {
  return [
    {
      id: 'patch',
      nome: 'Patch',
      tecnica: 'patch',
      opcoes: [
        { id: 'liso', nome: 'Liso', medida: '', valor: null },
        { id: 'relevo', nome: 'Relevo', medida: '', valor: null },
        { id: '3d', nome: '3D', medida: '', valor: null },
      ],
    },
    {
      id: 'bordado',
      nome: 'Bordado',
      tecnica: 'bordado',
      opcoes: [
        { id: 'P', nome: 'P', medida: '3 x 3 cm', valor: null },
        { id: 'M', nome: 'M', medida: '6 x 6 cm', valor: null },
        { id: 'G', nome: 'G', medida: '9 x 9 cm', valor: null },
      ],
    },
  ]
}

export function adicionaisEmBranco(): Adicionais {
  return { materiais: [], extras: extrasPadrao(), dtf: [], tamanhosDtf: tamanhosPadrao() }
}

