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

export type PrecoDoTecido = { tecido: string; valor: number | null }

export type Adicionais = { materiais: PrecoDoTecido[]; extras: Extra[]; dtf: CombinacaoDeDtf[] }

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
  return { materiais: [], extras: extrasPadrao(), dtf: [] }
}

