import { DETALHES, chaveNova, type ChaveDeDetalhe } from './contas'

/* ==========================================================================
   AS LISTAS DOS DETALHES DA PEÇA (07/10/2026).

   Pedido do Henrique: "na referência, o detalhes de peça onde usa dropdown,
   quero um editor onde eu possa adicionar itens para esses detalhes de peça em
   cada dropdown". Gola, manga, punho, barra e costura eram texto livre; agora
   cada um tem a sua lista, e a lista é do usuário: ele acrescenta, muda o
   nome, muda a ordem e tira (wireframe, pranchas 113 e 114).

   O QUE A REFERÊNCIA E O KIT GUARDAM CONTINUA SENDO O TEXTO. A lista é o
   catálogo dos nomes que se pode escolher. Por isso um texto antigo, que não
   está em lista nenhuma, continua aparecendo no seletor: nada do que já foi
   digitado se perde.

   Este arquivo não conhece o banco nem o navegador: são os tipos, o rascunho
   do editor das listas e as frases. Quem fala com o banco é o index.ts.
   ========================================================================== */

export type ItemDeDetalhe = {
  id: string
  detalhe: ChaveDeDetalhe
  nome: string
  ordem: number
  /** quantas referências usam este item, e quantas peças de kit */
  referencias: number
  kits: number
}

export type ListasDeDetalhe = Record<ChaveDeDetalhe, ItemDeDetalhe[]>

export const listasVazias = (): ListasDeDetalhe => ({
  gola: [],
  manga: [],
  punho: [],
  barra: [],
  costura: [],
})

/** "golas", "mangas": para dizer "Editar a lista de golas". */
export const PLURAL_DO_DETALHE: Record<ChaveDeDetalhe, string> = {
  gola: 'golas',
  manga: 'mangas',
  punho: 'punhos',
  barra: 'barras',
  costura: 'costuras',
}

const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Os itens que vieram do banco, cada um na lista do seu detalhe e na ordem dela. */
export function emListas(itens: ItemDeDetalhe[]): ListasDeDetalhe {
  const sai = listasVazias()
  for (const i of itens) if (sai[i.detalhe]) sai[i.detalhe].push(i)
  for (const d of DETALHES)
    sai[d.chave].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  return sai
}

/** As opções do seletor de um detalhe: os itens da lista, na ordem dela. Se o
    que está escrito hoje não é de lista nenhuma (texto de antes das listas, ou
    item que saiu dela), ele entra no fim: o seletor não pode esconder o que a
    ficha diz. O valor da opção é o próprio nome, que é o que fica guardado. */
export function opcoesDoDetalhe(
  lista: ItemDeDetalhe[],
  atual: string,
): { valor: string; rotulo: string }[] {
  const sai = lista.map(i => ({ valor: i.nome, rotulo: i.nome }))
  const texto = atual.trim()
  if (texto && !lista.some(i => mesmoNome(i.nome, texto)))
    sai.push({ valor: texto, rotulo: `${texto} (fora da lista)` })
  return sai
}

/** O nome como está na lista, quando o que foi escrito já existe nela em outra
    caixa ("redonda" vira "Redonda"). Senão, o próprio texto, aparado. */
export function nomeNaLista(lista: ItemDeDetalhe[], texto: string): string {
  return lista.find(i => mesmoNome(i.nome, texto))?.nome ?? texto.trim()
}

/** "58 referências", "1 referência e 2 kits", "sem uso". */
export function quemUsa(i: { referencias: number; kits: number }): string {
  const r = i.referencias === 1 ? '1 referência' : `${i.referencias} referências`
  const k = i.kits === 1 ? '1 kit' : `${i.kits} kits`
  if (i.referencias && i.kits) return `${r} e ${k}`
  if (i.kits) return k
  if (i.referencias) return r
  return 'sem uso'
}

/** Um item que mudou de nome no editor das listas. O banco troca o texto nas
    fichas guardadas; quem está com uma ficha aberta na tela troca com isto. */
export type Renome = { detalhe: ChaveDeDetalhe; de: string; para: string }

/** Os detalhes com os nomes novos no lugar dos antigos. Devolve o mesmo objeto
    se nada mudou. */
export function comNomesTrocados<T extends Partial<Record<ChaveDeDetalhe, string>>>(
  detalhes: T,
  renomes: Renome[],
): T {
  let sai = detalhes
  for (const n of renomes)
    if (mesmoNome(sai[n.detalhe] ?? '', n.de) && sai[n.detalhe] !== n.para)
      sai = { ...sai, [n.detalhe]: n.para }
  return sai
}

/* --- o rascunho do editor das listas ------------------------------------------ */

export type ItemNoRascunho = {
  /** segura a linha no lugar quando a ordem muda */
  chave: number
  /** nulo: item que nasceu no editor e ainda não foi salvo */
  id: string | null
  nome: string
  referencias: number
  kits: number
}
export type RascunhoDasListas = Record<ChaveDeDetalhe, ItemNoRascunho[]>

export function abrirListas(l: ListasDeDetalhe): RascunhoDasListas {
  const sai = {} as RascunhoDasListas
  for (const d of DETALHES)
    sai[d.chave] = l[d.chave].map(i => ({
      chave: chaveNova(),
      id: i.id,
      nome: i.nome,
      referencias: i.referencias,
      kits: i.kits,
    }))
  return sai
}

/** Um item novo no fim da lista. Devolve a lista como está se o nome é vazio ou
    já existe nela. */
export function comItemNovo(lista: ItemNoRascunho[], nome: string): ItemNoRascunho[] {
  const n = nome.trim()
  if (!n || lista.some(i => mesmoNome(i.nome, n))) return lista
  return [...lista, { chave: chaveNova(), id: null, nome: n, referencias: 0, kits: 0 }]
}

export type ListasParaOBanco = Record<ChaveDeDetalhe, { id?: string; nome: string }[]>
export type ListasFechadas =
  | { listas: ListasParaOBanco; erro: ''; onde: null }
  | { listas: null; erro: string; onde: ChaveDeDetalhe }

/** Fecha o rascunho no que o banco espera, ou diz o que falta e em que lista. */
export function fecharListas(r: RascunhoDasListas): ListasFechadas {
  const listas = {} as ListasParaOBanco
  for (const d of DETALHES) {
    const vistos = new Set<string>()
    const itens: { id?: string; nome: string }[] = []
    for (const i of r[d.chave]) {
      const nome = i.nome.trim()
      const nao = (erro: string): ListasFechadas => ({ listas: null, erro, onde: d.chave })
      if (!nome) return nao(`Tem um item sem nome na lista de ${PLURAL_DO_DETALHE[d.chave]}.`)
      if (nome.length > 200)
        return nao(`Na lista de ${PLURAL_DO_DETALHE[d.chave]}, o nome "${nome.slice(0, 40)}..." passa de 200 letras.`)
      if (vistos.has(nome.toLowerCase()))
        return nao(`"${nome}" está duas vezes na lista de ${PLURAL_DO_DETALHE[d.chave]}.`)
      vistos.add(nome.toLowerCase())
      itens.push(i.id ? { id: i.id, nome } : { nome })
    }
    if (itens.length > 200)
      return { listas: null, erro: `A lista de ${PLURAL_DO_DETALHE[d.chave]} leva até 200 itens.`, onde: d.chave }
    listas[d.chave] = itens
  }
  return { listas, erro: '', onde: null }
}

/** Uma lista do rascunho mudou em relação à que veio do banco? */
export function listaMudou(a: ItemDeDetalhe[], b: ItemNoRascunho[]): boolean {
  return a.length !== b.length || a.some((x, i) => x.id !== b[i].id || x.nome !== b[i].nome.trim())
}

/** O rascunho mudou alguma coisa em relação ao que veio do banco? */
export function listasMudaram(l: ListasDeDetalhe, r: RascunhoDasListas): boolean {
  return DETALHES.some(d => listaMudou(l[d.chave], r[d.chave]))
}
