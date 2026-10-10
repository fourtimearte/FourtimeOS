import type { Design } from './bloco'

/* ==========================================================================
   A ETIQUETA DO LAYOUT (decisões 142 e 152).

   A peça tem UMA etiqueta só, sempre a da nuca, por dentro: ou é a padrão da
   Fourtime, ou é a personalizada do cliente, ou não tem. E ela tem uma
   técnica: Silk, Sub ou DTF.

   O dado não mudou de lugar. Desde a 3.375 a etiqueta mora no design do
   bloco, como as tags "Eti. Fourtime", "Eti. Cliente", "Eti. Silk", "Eti.
   Subli" e "Eti. DTF", e é assim que o .ft antigo chega, que o kanban lê e que
   a folha de hoje desenha. Em vez de mudar o formato (e obrigar todas as telas
   a mudarem no mesmo dia), a regra nova mora aqui: quem quer a etiqueta lê
   com etiquetaDoDesign, e quem muda escreve com comEtiqueta, que garante uma
   só de cada.
   ========================================================================== */

export type TipoDeEtiqueta = '' | 'fourtime' | 'cliente'
export type TecnicaDaEtiqueta = '' | 'silk' | 'sub' | 'dtf'
export type EtiquetaDoLayout = { tipo: TipoDeEtiqueta; tecnica: TecnicaDaEtiqueta }

export const TAG_DO_TIPO: Record<Exclude<TipoDeEtiqueta, ''>, string> = {
  fourtime: 'Eti. Fourtime',
  cliente: 'Eti. Cliente',
}

export const TAG_DA_TECNICA_DA_ETIQUETA: Record<Exclude<TecnicaDaEtiqueta, ''>, string> = {
  silk: 'Eti. Silk',
  sub: 'Eti. Subli',
  dtf: 'Eti. DTF',
}

export const NOME_DO_TIPO: Record<Exclude<TipoDeEtiqueta, ''>, string> = { fourtime: 'Fourtime', cliente: 'Cliente' }
export const NOME_DA_TECNICA_DA_ETIQUETA: Record<Exclude<TecnicaDaEtiqueta, ''>, string> = {
  silk: 'Silk',
  sub: 'Sub',
  dtf: 'DTF',
}

const TODAS = [...Object.values(TAG_DO_TIPO), ...Object.values(TAG_DA_TECNICA_DA_ETIQUETA)]

/** A tag é de etiqueta? */
export const ehTagDeEtiqueta = (tag: string): boolean => TODAS.includes(tag)

/* A leitura. Ficha antiga pode trazer as duas etiquetas, ou duas técnicas
   (a 3.375 deixava marcar quantas quisesse): vale a primeira na ordem das
   tags, e o cliente ganha da Fourtime, porque etiqueta de cliente é pedido
   explícito e a da Fourtime é o padrão. Técnica de etiqueta sem o tipo quer
   dizer a da Fourtime, que era o único caso na 3.375. */
export function etiquetaDoDesign(design: Design[]): EtiquetaDoLayout {
  const tags = design.map((d) => d.tag)
  const tipo: TipoDeEtiqueta = tags.includes(TAG_DO_TIPO.cliente)
    ? 'cliente'
    : tags.includes(TAG_DO_TIPO.fourtime)
      ? 'fourtime'
      : ''
  const tecnica =
    (Object.entries(TAG_DA_TECNICA_DA_ETIQUETA).find(([, t]) => tags.includes(t))?.[0] as TecnicaDaEtiqueta) ?? ''
  return { tipo: tipo || (tecnica ? 'fourtime' : ''), tecnica }
}

/* A escrita. Tira toda tag de etiqueta e põe no máximo duas, o tipo e a
   técnica, no começo da lista (a ordem da 3.375: etiqueta primeiro). Sem tipo
   não há técnica: etiqueta desligada leva a técnica junto. */
export function comEtiqueta(design: Design[], e: EtiquetaDoLayout): Design[] {
  const resto = design.filter((d) => !ehTagDeEtiqueta(d.tag))
  if (!e.tipo) return resto
  const novas: Design[] = [{ tag: TAG_DO_TIPO[e.tipo], tecnica: 'etiqueta', cores: [] }]
  if (e.tecnica) novas.push({ tag: TAG_DA_TECNICA_DA_ETIQUETA[e.tecnica], tecnica: 'etiqueta', cores: [] })
  return [...novas, ...resto]
}
