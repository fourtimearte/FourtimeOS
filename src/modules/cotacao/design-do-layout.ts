import { NOME_DO_TIPO_DE_PATCH, detalheDoAplique, type Design, type TamanhoDeAplique, type Tecnica, type TipoDePatch } from '@dominio/layout'

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
  /** o botão direito no interruptor: o bordado escolhe o tamanho P, M ou G;
      o patch escolhe o tipo (liso, relevo, 3D) e a quantidade (16/10/2026) */
  menu?: 'tamanho' | 'patch'
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
    menu: 'tamanho',
  },
  {
    tecnica: 'patch',
    tag: 'Patch',
    rotulo: 'Patch',
    cor: false,
    aba: '',
    tom: 'ct-ch-patch',
    menu: 'patch',
  },
]

export const TAMANHOS_DE_APLIQUE: { valor: TamanhoDeAplique; nome: string }[] = [
  { valor: 'P', nome: 'Pequeno' },
  { valor: 'M', nome: 'Médio' },
  { valor: 'G', nome: 'Grande' },
]

export const TIPOS_DE_PATCH: { valor: TipoDePatch; nome: string }[] = (
  Object.keys(NOME_DO_TIPO_DE_PATCH) as TipoDePatch[]
).map(valor => ({ valor, nome: NOME_DO_TIPO_DE_PATCH[valor] }))

/** O rótulo do interruptor: "Bordado M", "Patch Relevo ×2" ou só o nome. */
export function rotuloDaTecnica(t: DaTecnica, d: Design | undefined): string {
  const det = d ? detalheDoAplique(d) : ''
  return det ? `${t.rotulo} ${det}` : t.rotulo
}

/** O texto da dica do botão direito, para o interruptor e para o lote. */
export function dicaDoMenu(t: DaTecnica): string {
  return t.menu === 'patch'
    ? 'Botão direito: o tipo (liso, relevo ou 3D) e quantos patches'
    : t.menu === 'tamanho'
      ? 'Botão direito: o tamanho (P, M ou G)'
      : ''
}

/** Muda um campo do aplique; a técnica desligada liga já com ele. */
function comAplique(design: Design[], t: DaTecnica, parte: Partial<Design>, tirar: (keyof Design)[]): Design[] {
  const limpa = (d: Design): Design => {
    const novo = { ...d, ...parte }
    for (const k of tirar) delete novo[k]
    return novo
  }
  const tem = design.find(d => d.tag === t.tag)
  if (!tem) return ligarTecnica(design, t, limpa({ tag: t.tag, tecnica: t.tecnica, cores: [] }))
  return design.map(d => (d.tag === t.tag ? limpa(d) : d))
}

/** O tipo do patch; '' tira o tipo. O tamanho antigo (P, M, G) sai junto. */
export function comTipoDePatch(design: Design[], t: DaTecnica, tipo: TipoDePatch | ''): Design[] {
  if (!tipo && !design.some(d => d.tag === t.tag)) return design
  return comAplique(design, t, tipo ? { tipoDePatch: tipo } : {}, tipo ? ['tamanho', 'opcaoNome'] : ['tamanho', 'tipoDePatch', 'opcaoNome'])
}

/** Quantos em cada peça (patches, bordados, telas do Silk), de 1 a 20; 1 não
    precisa ser guardado. No patch o tamanho antigo (P, M, G) sai junto; no
    bordado o tamanho fica (16/10/2026: o bordado tem tamanho E quantidade). */
export function comQuantidade(design: Design[], t: DaTecnica, n: number): Design[] {
  const q = Math.max(1, Math.min(20, Math.round(n) || 1))
  const velho: (keyof Design)[] = t.menu === 'patch' ? ['tamanho'] : []
  return comAplique(design, t, q > 1 ? { quantidade: q } : {}, q > 1 ? velho : [...velho, 'quantidade'])
}

/** A técnica pelo nome dela (silk, dtf, patch, bordado). */
export const daTecnica = (tecnica: Tecnica): DaTecnica => TECNICAS.find(x => x.tecnica === tecnica)!

/** A opção da tabela de preço (083): o tipo do patch ou o tamanho do bordado,
    com o nome como a tabela chama, para a folha e o interruptor dizerem igual. */
export function comOpcaoDoAplique(design: Design[], t: DaTecnica, opcao: string, nome: string): Design[] {
  if (t.menu === 'patch') return comAplique(design, t, { tipoDePatch: opcao, opcaoNome: nome }, ['tamanho'])
  return comAplique(design, t, { tamanho: opcao, opcaoNome: nome }, [])
}

/** O DTF do layout (083): uma combinação da tabela, ou vendido na metragem
    com o preço por peça escrito aqui. */
export function comDtf(
  design: Design[],
  escolha: { combinacao: string; nome: string } | { porPeca: number },
): Design[] {
  const t = daTecnica('dtf')
  return 'porPeca' in escolha
    ? comAplique(design, t, { dtfPorPeca: escolha.porPeca }, ['combinacao', 'combinacaoNome'])
    : comAplique(design, t, { combinacao: escolha.combinacao, combinacaoNome: escolha.nome }, ['dtfPorPeca'])
}

/** A quantidade que está no aplique (1 quando não tem o campo). */
export const quantidadeDe = (d: Design | undefined) => (d?.quantidade && d.quantidade > 1 ? d.quantidade : 1)

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
    const { tamanho: _velho, opcaoNome: _nome, ...resto } = d
    void _velho
    void _nome
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
