import {
  areaDaPeca,
  codigoCurto,
  naOrdemDaFabrica,
  tamanhosDaReferencia,
  type Detalhes,
  type MaterialDaPeca,
  type Parte,
} from './contas'

/* ==========================================================================
   O kit: duas ou mais referências numa ficha de fabricação só.

   É o que o vendedor oferece no funil (camiseta e calção, agasalho). No
   cadastro o kit é uma referência do grupo KIT, e o código dele é feito do
   código das peças: FT-KIT-020-000M-090-000M.

   O QUE É DO KIT E O QUE É DA PEÇA. Gola, manga, punho, barra e costura são
   da referência: a mesma camiseta não muda de gola por estar num kit. O kit
   guarda, peça por peça, o que muda de kit para kit: o papel da peça, os
   tecidos de cada parte do molde, o design impresso e onde vai, a etiqueta e
   a observação para a fábrica.

   O KIT NÃO TEM NÚMERO PRÓPRIO DE TECIDO NEM DE AVIAMENTO. Ele soma a ficha
   de cada peça, tecido por tecido. Mudou a referência, mudou o kit.

   AS PEÇAS NÃO MUDAM DEPOIS DE CRIADO: o código é feito delas, e código não
   muda. Kit com outras peças é outro kit.
   ========================================================================== */

export type TecnicaDoKit = 'subli' | 'dtf' | 'silk' | 'bordado' | 'patch'
export const TECNICAS: { chave: TecnicaDoKit; nome: string }[] = [
  { chave: 'subli', nome: 'Sublimação' },
  { chave: 'dtf', nome: 'DTF' },
  { chave: 'silk', nome: 'Silk' },
  { chave: 'bordado', nome: 'Bordado' },
  { chave: 'patch', nome: 'Patch' },
]
export const NOME_DA_TECNICA = Object.fromEntries(TECNICAS.map(t => [t.chave, t.nome])) as Record<
  TecnicaDoKit,
  string
>

/** vazio: ainda não escolhida. sem: o kit vai sem etiqueta, de propósito. */
export type EtiquetaDoKit = '' | 'silk' | 'dtf' | 'subli' | 'sem'
export const ETIQUETAS: { chave: Exclude<EtiquetaDoKit, ''>; nome: string }[] = [
  { chave: 'silk', nome: 'Silk' },
  { chave: 'dtf', nome: 'DTF' },
  { chave: 'subli', nome: 'Sublimação' },
  { chave: 'sem', nome: 'Sem etiqueta' },
]
export const NOME_DA_ETIQUETA: Record<EtiquetaDoKit, string> = {
  '': 'não escolhida',
  silk: 'Silk',
  dtf: 'DTF',
  subli: 'Sublimação',
  sem: 'Sem etiqueta',
}

export const PAPEIS = ['Parte de cima', 'Parte de baixo', 'Acessório']

/** o papel que a peça ganha ao entrar, pela posição dela no kit */
export const papelDaPosicao = (posicao: number) => PAPEIS[Math.min(posicao, PAPEIS.length - 1)]

/** a parte que quer dizer "todas as partes de pano desta peça" */
export const A_PECA_INTEIRA = 'A peça inteira'

/** O kit como a lista o conhece. */
export type KitNaLista = {
  id: string
  cod: string
  nome: string
  genero: string
  ativo: boolean
  /** quando a ficha do kit foi salva pela última vez; nulo, ninguém mexeu nela */
  fichaEm: string | null
  pecas: number
  /** o código de cada peça, na ordem do kit */
  pecasCod: string[]
  pecasSemTecido: number
  pecasSemEtiqueta: number
  temDesenho: boolean
}

export type TecidoDaPeca = { parte: string; tecidoId: string; tecido: string }
export type DesignDaPeca = { tecnica: TecnicaDoKit; onde: string }

/** Uma peça dentro do kit: quem ela é, e a ficha de fabricação dela neste kit. */
export type PecaDoKit = {
  referenciaId: string
  cod: string
  nome: string
  genero: string
  /** os detalhes da REFERÊNCIA: o que vale quando o kit não escolhe outro */
  detalhes: Detalhes
  /** O QUE O KIT ESCOLHE POR CIMA DA REFERÊNCIA (07/10/2026; H: "o kit pode dar
      override nos detalhes da referência"). Só os detalhes em que este kit
      disse outra coisa; o que está em branco aqui vale o da referência. */
  detalhesDoKit: Detalhes
  /** a grade que a ficha da referência ligou; vazia se ela está em branco */
  tamanhos: string[]
  papel: string
  tecidos: TecidoDaPeca[]
  design: DesignDaPeca[]
  etiqueta: EtiquetaDoKit
  etiquetaOnde: string
  observacao: string
}

export type Kit = { nome: string; pecas: PecaDoKit[] }

/** Em que kit uma referência entra. */
export type KitDaReferencia = { kitId: string; kitCod: string; kitNome: string; papel: string }

/** Os detalhes que VALEM para uma peça dentro do kit: o que o kit escolheu e,
    onde ele não escolheu, o que a referência diz. É o que a página do kit e a
    folha impressa mostram. */
export function detalhesDaPecaDoKit(p: { detalhes: Detalhes; detalhesDoKit: Detalhes }): Detalhes {
  const sai: Detalhes = { ...p.detalhes }
  for (const [chave, texto] of Object.entries(p.detalhesDoKit) as [keyof Detalhes, string][])
    if (texto?.trim()) sai[chave] = texto.trim()
  return sai
}

/* --- o código, o gênero e a grade -------------------------------------------- */

/** FT-KIT e o código de cada peça sem o FT- da frente. Vazio com menos de duas peças. */
export function codigoDoKit(cods: string[]): string {
  if (cods.length < 2 || cods.some(c => !c)) return ''
  return 'FT-KIT-' + cods.map(codigoCurto).join('-')
}

/** O gênero das peças quando todas concordam; senão, unissex. */
export function generoDoKit(generos: string[]): string {
  const unicos = new Set(generos)
  return unicos.size === 1 && generos[0] ? generos[0] : 'U'
}

/** A grade do kit: os tamanhos que TODAS as peças têm. */
export function gradeDoKit(pecas: { tamanhos: string[]; genero: string; nome: string }[]): string[] {
  if (!pecas.length) return []
  const grades = pecas.map(p => tamanhosDaReferencia(p))
  return naOrdemDaFabrica(grades[0].filter(t => grades.every(g => g.includes(t))))
}

/* --- o que falta -------------------------------------------------------------- */

/** O kit que veio do catálogo e ninguém preencheu ainda. */
export function kitEmBranco(k: KitNaLista): boolean {
  return !k.fichaEm && !k.temDesenho
}

/** Quantas coisas faltam num kit, pela lista: peça sem tecido, peça sem etiqueta e o desenho. */
export function faltasDoKit(k: KitNaLista): number {
  return k.pecasSemTecido + k.pecasSemEtiqueta + (k.temDesenho ? 0 : 1)
}

export type Pendencia = {
  /** impede salvar: sem isto o kit não existe */
  impede: boolean
  /** de quem é: o papel ou o nome da peça; vazio quando é do kit */
  deQuem: string
  texto: string
}

const rotuloDaPeca = (p: { papel: string; nome: string }) => p.papel.trim() || p.nome

/** O que falta no kit que está na tela. O que impede vem primeiro. */
export function pendenciasDoKit(kit: Kit, temDesenho: boolean): Pendencia[] {
  const sai: Pendencia[] = []
  if (!kit.nome.trim()) sai.push({ impede: true, deQuem: '', texto: 'O kit precisa de um nome.' })
  if (kit.pecas.length < 2)
    sai.push({ impede: true, deQuem: '', texto: 'Um kit tem pelo menos duas peças.' })
  for (const p of kit.pecas) {
    const quem = rotuloDaPeca(p)
    const incompleto = p.tecidos.find(t => !t.parte.trim() || !t.tecidoId)
    if (incompleto)
      sai.push({ impede: true, deQuem: quem, texto: 'tem um tecido sem a parte do molde ou sem o tecido escolhido.' })
    const partes = p.tecidos.map(t => t.parte.trim().toLowerCase()).filter(Boolean)
    if (new Set(partes).size !== partes.length)
      sai.push({ impede: true, deQuem: quem, texto: 'tem a mesma parte do molde com dois tecidos. Cada parte usa um só.' })
  }
  for (const p of kit.pecas) {
    const quem = rotuloDaPeca(p)
    if (!p.tecidos.length) sai.push({ impede: false, deQuem: quem, texto: 'falta escolher o tecido.' })
    const semOnde = p.design.filter(d => !d.onde.trim())
    if (semOnde.length)
      sai.push({
        impede: false,
        deQuem: quem,
        texto: 'falta dizer onde vai ' + semOnde.map(d => NOME_DA_TECNICA[d.tecnica]).join(' e ') + '.',
      })
    if (!p.etiqueta) sai.push({ impede: false, deQuem: quem, texto: 'falta escolher a etiqueta.' })
  }
  if (!temDesenho) sai.push({ impede: false, deQuem: '', texto: 'Falta o desenho do kit, em SVG.' })
  return sai
}

/* --- o tecido de um kit -------------------------------------------------------- */

export type PecaComFicha = {
  papel: string
  nome: string
  tecidos: TecidoDaPeca[]
  /** as partes do molde da referência, com a área de cada uma por tamanho */
  partes: Parte[]
  materiais: MaterialDaPeca[]
}

export type TecidoDoKit = {
  tecidoId: string
  tecido: string
  /** onde ele vai, em palavras: "frente e costas da parte de cima, e a parte de baixo" */
  onde: string
  /** a área em m² por tamanho, na ordem pedida; nulo onde nenhuma parte tem número */
  areas: (number | null)[]
}

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** O tecido de UM kit em cada tamanho: a soma da ficha de cada peça, tecido por tecido.
    Tecidos diferentes nunca se somam: são compras diferentes. */
export function tecidoDoKit(pecas: PecaComFicha[], tamanhos: string[]): TecidoDoKit[] {
  const porTecido = new Map<string, { tecido: string; ondes: string[]; areas: (number | null)[] }>()
  for (const p of pecas) {
    const quem = rotuloDaPeca(p).toLowerCase()
    /* as partes desta peça que vão em cada tecido */
    const doTecido = new Map<string, { tecido: string; partes: string[]; inteira: boolean }>()
    for (const t of p.tecidos) {
      if (!t.tecidoId) continue
      const e = doTecido.get(t.tecidoId) ?? { tecido: t.tecido, partes: [], inteira: false }
      if (igual(t.parte, A_PECA_INTEIRA)) e.inteira = true
      else e.partes.push(t.parte.trim())
      doTecido.set(t.tecidoId, e)
    }
    for (const [tecidoId, e] of doTecido) {
      const pano = p.partes.filter(x => x.unidade === 'm2')
      const escolhidas = e.inteira ? pano : pano.filter(x => e.partes.some(n => igual(n, x.nome)))
      const soma = porTecido.get(tecidoId) ?? {
        tecido: e.tecido,
        ondes: [],
        areas: tamanhos.map(() => null as number | null),
      }
      tamanhos.forEach((t, i) => {
        const a = areaDaPeca(escolhidas, t)
        if (a !== null) soma.areas[i] = (soma.areas[i] ?? 0) + a
      })
      soma.ondes.push(e.inteira ? 'a ' + quem : e.partes.join(' e ').toLowerCase() + ' da ' + quem)
      porTecido.set(tecidoId, soma)
    }
  }
  return [...porTecido].map(([tecidoId, s]) => ({
    tecidoId,
    tecido: s.tecido,
    onde: s.ondes.join(', e '),
    areas: s.areas,
  }))
}

/* --- os aviamentos de um kit ---------------------------------------------------- */

export type AviamentoDoKit = {
  nome: string
  unidade: string
  quantidade: number
  /** de que peças ele vem: "das duas peças", "da parte de baixo" */
  deQuem: string
}

/** Os aviamentos de UM kit: os de cada peça somados, o mesmo material numa linha só. */
export function aviamentosDoKit(pecas: PecaComFicha[]): AviamentoDoKit[] {
  const linhas = new Map<string, { nome: string; unidade: string; quantidade: number; quem: string[] }>()
  for (const p of pecas) {
    for (const m of p.materiais) {
      const chave = (m.materialId ?? 'nome:' + m.nome.trim().toLowerCase()) + '|' + m.unidade
      const l = linhas.get(chave) ?? { nome: m.nome, unidade: m.unidade, quantidade: 0, quem: [] }
      l.quantidade += m.quantidade
      l.quem.push(rotuloDaPeca(p).toLowerCase())
      linhas.set(chave, l)
    }
  }
  return [...linhas.values()].map(l => ({
    nome: l.nome,
    unidade: l.unidade,
    /* a soma de 0,02 com 0,04 não pode virar 0,06000000000000001 */
    quantidade: Math.round(l.quantidade * 10000) / 10000,
    deQuem:
      l.quem.length === pecas.length && pecas.length > 1
        ? pecas.length === 2
          ? 'das duas peças'
          : `das ${pecas.length} peças`
        : 'da ' + l.quem.join(' e da '),
  }))
}

/* --- o kit pronto para salvar ---------------------------------------------------- */

/** O kit como a função do banco espera. */
export function kitParaOBanco(kit: Kit) {
  return {
    nome: kit.nome.trim(),
    pecas: kit.pecas.map(p => ({
      referencia_id: p.referenciaId,
      papel: p.papel.trim(),
      tecidos: p.tecidos.map(t => ({ parte: t.parte.trim(), tecido_id: t.tecidoId })),
      design: p.design.map(d => ({ tecnica: d.tecnica, onde: d.onde.trim() })),
      etiqueta: p.etiqueta,
      etiqueta_onde: p.etiquetaOnde.trim(),
      observacao: p.observacao.trim(),
      /* só o que o kit escolheu: em branco não vai, e vale o da referência */
      detalhes: Object.fromEntries(
        Object.entries(p.detalhesDoKit)
          .map(([chave, texto]) => [chave, (texto ?? '').trim()])
          .filter(([, texto]) => texto),
      ),
    })),
  }
}

/** Uma peça entrando num kit novo, com a ficha em branco. */
export function pecaNova(
  r: { id: string; cod: string; nome: string; genero: string; detalhes: Detalhes; tamanhos: string[] },
  posicao: number,
): PecaDoKit {
  return {
    referenciaId: r.id,
    cod: r.cod,
    nome: r.nome,
    genero: r.genero,
    detalhes: r.detalhes,
    detalhesDoKit: {},
    tamanhos: r.tamanhos,
    papel: papelDaPosicao(posicao),
    tecidos: [],
    design: [],
    etiqueta: '',
    etiquetaOnde: '',
    observacao: '',
  }
}
