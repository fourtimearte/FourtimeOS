import type { Design, TamanhoDeAplique, Tecnica } from '@dominio/layout'

/* ==========================================================================
   AS CONTAS DO DESIGN DE UM LAYOUT, divididas pela ficha do layout e pela
   tabela do editor (14/10/2026). As duas mexem no mesmo bloco.design, e a
   regra de ordem e de cor não pode existir em dois lugares.
   ========================================================================== */

export type DaTecnica = {
  tecnica: Tecnica
  tag: string
  rotulo: string
  /** a técnica lança códigos de cor do banco */
  cor: boolean
  aba: string
  tom: string
  /** bordado e patch têm tamanho P, M ou G (botão direito no interruptor) */
  porTamanho?: boolean
}

export const TECNICAS: DaTecnica[] = [
  { tecnica: 'subli', tag: 'Subli', rotulo: 'Sub', cor: true, aba: 'sub', tom: 'ct-ch-subli' },
  { tecnica: 'dtf', tag: 'DTF', rotulo: 'DTF', cor: true, aba: 'dtf', tom: 'ct-ch-dtf' },
  { tecnica: 'silk', tag: 'Silk', rotulo: 'Silk', cor: false, aba: '', tom: 'ct-ch-silk' },
  {
    tecnica: 'bordado',
    tag: 'Bordado',
    rotulo: 'Bordado',
    cor: false,
    aba: '',
    tom: 'ct-ch-bordado',
    porTamanho: true,
  },
  {
    tecnica: 'patch',
    tag: 'Patch',
    rotulo: 'Patch',
    cor: false,
    aba: '',
    tom: 'ct-ch-patch',
    porTamanho: true,
  },
]

export const TAMANHOS_DE_APLIQUE: { valor: TamanhoDeAplique; nome: string }[] = [
  { valor: 'P', nome: 'Pequeno' },
  { valor: 'M', nome: 'Médio' },
  { valor: 'G', nome: 'Grande' },
]

/** O rótulo do interruptor: "Patch" ou, com tamanho, "Patch M". */
export function rotuloDaTecnica(t: DaTecnica, d: Design | undefined): string {
  return d?.tamanho ? `${t.rotulo} ${d.tamanho}` : t.rotulo
}

/** Liga a técnica (com o que ela tinha antes, se tinha) na ordem da fábrica:
    as etiquetas, depois as técnicas na ordem dos interruptores, depois o resto. */
export function ligarTecnica(design: Design[], t: DaTecnica, volta?: Design): Design[] {
  const nova = volta ?? { tag: t.tag, tecnica: t.tecnica, cores: [] }
  const outras = design.filter(d => !TECNICAS.some(x => x.tag === d.tag))
  const tecnicas = TECNICAS.map(x =>
    x.tag === t.tag ? nova : design.find(d => d.tag === x.tag),
  ).filter((d): d is Design => !!d)
  const etiquetas = outras.filter(d => d.tecnica === 'etiqueta')
  const acabamentos = outras.filter(d => d.tecnica !== 'etiqueta')
  return [...etiquetas, ...tecnicas, ...acabamentos]
}

export function desligarTecnica(design: Design[], t: DaTecnica): Design[] {
  return design.filter(d => d.tag !== t.tag)
}

/** O tamanho do bordado ou do patch. Escolher o tamanho de uma técnica
    desligada liga ela já com o tamanho; '' tira o tamanho. */
export function comTamanho(
  design: Design[],
  t: DaTecnica,
  tamanho: TamanhoDeAplique | '',
): Design[] {
  const tem = design.find(d => d.tag === t.tag)
  if (!tem)
    return tamanho
      ? ligarTecnica(design, t, { tag: t.tag, tecnica: t.tecnica, cores: [], tamanho })
      : design
  return design.map(d => {
    if (d.tag !== t.tag) return d
    const { tamanho: _velho, ...resto } = d
    void _velho
    return tamanho ? { ...resto, tamanho } : resto
  })
}

/** Põe ou tira um código de cor de uma técnica. */
export function alternarCor(design: Design[], tag: string, cod: string, hex: string): Design[] {
  return design.map(d =>
    d.tag === tag
      ? {
          ...d,
          cores: d.cores.some(c => c.cod === cod)
            ? d.cores.filter(c => c.cod !== cod)
            : [...d.cores, { cod, hex }],
        }
      : d,
  )
}

/** Tira um código de cor de uma técnica (o botão direito em cima da cor). */
export function tirarCor(design: Design[], tag: string, cod: string): Design[] {
  return design.map(d => (d.tag === tag ? { ...d, cores: d.cores.filter(c => c.cod !== cod) } : d))
}
