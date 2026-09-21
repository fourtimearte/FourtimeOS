/* ==========================================================================
   O banco de dados da fábrica: dez categorias, três grupos.

   A arrumação é a do editor v3.375, olhada na tela e copiada:

     LAYOUT      Referências, Tecidos
     CABEÇALHO   Formas de pagamento, Formas de entrega, Embalagem,
                 Vendedores, Departamentos
     CORES       Tecido, DTF, Sublimação

   Aqui mora o que a tela precisa para agrupar, contar e ordenar. Quem guarda
   o conteúdo é o Supabase; quem conversa com ele é repositorio.ts.
   ========================================================================== */

export * from './dados'
export * from './tipos'
export * from './repositorio'

import type {
  Banco,
  Categoria,
  CorDeImpressao,
  CorDeTecido,
  Grupo,
  ItemDeLista,
  Referencia,
  Tecido,
  TipoDeLista,
} from './tipos'
import { grupoDoCodigo } from './tipos'

/* --- o menu da esquerda --------------------------------------------------- */

export type SecaoDoBanco = { titulo: string; itens: Categoria[] }

export const SECOES: SecaoDoBanco[] = [
  { titulo: 'Layout', itens: ['referencias', 'tecidos', 'consumo'] },
  {
    titulo: 'Cabeçalho',
    itens: ['pagamento', 'entrega', 'embalagem', 'vendedor', 'departamento'],
  },
  { titulo: 'Cores', itens: ['cor-tecido', 'dtf', 'sublimacao'] },
]

export const NOME_DA_CATEGORIA: Record<Categoria, string> = {
  referencias: 'Referências',
  tecidos: 'Tecidos',
  consumo: 'Consumo de tecido',
  pagamento: 'Formas de pagamento',
  entrega: 'Formas de entrega',
  embalagem: 'Embalagem',
  vendedor: 'Vendedores',
  departamento: 'Departamentos',
  'cor-tecido': 'Tecido',
  dtf: 'DTF',
  sublimacao: 'Sublimação',
}

/** O que a tela escreve embaixo do título, para cada categoria. */
export const LINHA_DA_CATEGORIA: Record<Categoria, string> = {
  referencias:
    'O código FT-GGG-NNNX é a identidade da peça na fábrica: grupo, sequencial e gênero. Ele não muda.',
  tecidos: 'Agrupados pela família comercial, que é como o vendedor pergunta, e não pela construção.',
  consumo:
    'Quanto uma peça come, por referência e por tamanho. É daqui que sai a reserva do pedido aprovado, e o que não estiver cadastrado aparece como falta em vez de virar zero.',
  pagamento: 'O que aparece no menu de pagamento do orçamento.',
  entrega: 'O que aparece no menu de entrega do orçamento.',
  embalagem: 'Como o pedido sai da fábrica.',
  vendedor: 'Quem assina o orçamento.',
  departamento: 'Por onde a peça passa na produção.',
  'cor-tecido': 'A cor da malha. Tem nome porque é assim que o cliente pede.',
  dtf: 'Tabela fixa da máquina: o número não muda. O nome é o que vai para o orçamento do cliente.',
  sublimacao:
    'Tabela fixa da máquina: S mais o número, e ele não muda. O nome é o que vai para o orçamento.',
}

export const TIPOS_DE_LISTA: TipoDeLista[] = [
  'pagamento',
  'entrega',
  'embalagem',
  'vendedor',
  'departamento',
]

export function ehListaSimples(c: Categoria): c is TipoDeLista {
  return (TIPOS_DE_LISTA as string[]).includes(c)
}

/** Quantos itens cada categoria tem, para o número do lado do menu. */
export function contar(banco: Banco): Record<Categoria, number> {
  const daLista = (t: TipoDeLista) => banco.listas.filter((i) => i.tipo === t).length
  return {
    referencias: banco.referencias.length,
    tecidos: banco.tecidos.length,
    /* referências com pelo menos um tamanho cadastrado, e não linhas: o que o
       menu precisa dizer é para quantas peças o sistema sabe responder. */
    consumo: new Set(banco.consumo.map((c) => c.referenciaId)).size,
    pagamento: daLista('pagamento'),
    entrega: daLista('entrega'),
    embalagem: daLista('embalagem'),
    vendedor: daLista('vendedor'),
    departamento: daLista('departamento'),
    'cor-tecido': banco.coresDeTecido.length,
    dtf: banco.coresDeImpressao.filter((c) => c.tecnica === 'dtf').length,
    sublimacao: banco.coresDeImpressao.filter((c) => c.tecnica === 'sublimacao').length,
  }
}

/* --- agrupar -------------------------------------------------------------
   Os três agrupamentos têm a mesma forma e o mesmo problema: o que não se
   encaixa em nenhum grupo não pode sumir. No editor ele vira "Sem código" e
   "Sem grupo", no fim da lista, e aqui também. Esconder cadastro torto é o
   jeito de ele nunca ser consertado. */

export type Bloco<T> = { cod: string; nome: string; itens: T[] }

function agrupar<T>(
  grupos: Grupo[],
  itens: T[],
  grupoDo: (i: T) => string,
  nomeDoResto: string,
): Bloco<T>[] {
  const caixa = new Map<string, T[]>()
  grupos.forEach((g) => caixa.set(g.cod, []))
  const resto: T[] = []

  itens.forEach((i) => {
    const cod = grupoDo(i)
    const lista = caixa.get(cod)
    if (lista) lista.push(i)
    else resto.push(i)
  })

  const blocos: Bloco<T>[] = grupos.map((g) => ({
    cod: g.cod,
    nome: g.nome,
    itens: caixa.get(g.cod) ?? [],
  }))
  if (resto.length > 0) blocos.push({ cod: '', nome: nomeDoResto, itens: resto })
  return blocos
}

export function referenciasPorGrupo(banco: Banco): Bloco<Referencia>[] {
  return agrupar(
    banco.gruposDeReferencia,
    banco.referencias,
    (r) => r.grupo || grupoDoCodigo(r.cod),
    'Sem código',
  )
}

export function tecidosPorGrupo(banco: Banco): Bloco<Tecido>[] {
  return agrupar(banco.gruposDeTecido, banco.tecidos, (t) => t.grupo ?? '', 'Sem grupo')
}

/** A sublimação do editor fica fora dos grupos: ela não é cor de malha, e a
    tela precisa saber disso para pregar ela no topo em vez de jogar no resto. */
export const COR_FORA_DO_GRUPO = 'SUB'

export function coresDeTecidoPorGrupo(banco: Banco): Bloco<CorDeTecido>[] {
  const dentro = banco.coresDeTecido.filter((c) => c.grupo !== COR_FORA_DO_GRUPO)
  const grupos = banco.gruposDeCor.filter((g) => g.cod !== COR_FORA_DO_GRUPO)
  return agrupar(grupos, dentro, (c) => c.grupo ?? '', 'Sem grupo')
}

export function corDaSublimacao(banco: Banco): CorDeTecido | null {
  return banco.coresDeTecido.find((c) => c.grupo === COR_FORA_DO_GRUPO) ?? null
}

export function coresDaTecnica(banco: Banco, tecnica: 'dtf' | 'sublimacao'): CorDeImpressao[] {
  return banco.coresDeImpressao.filter((c) => c.tecnica === tecnica)
}

export function itensDaLista(banco: Banco, tipo: TipoDeLista): ItemDeLista[] {
  return banco.listas.filter((i) => i.tipo === tipo)
}

/* --- buscar --------------------------------------------------------------
   Sem acento e sem caixa, porque ninguém digita "Sublimação" com o til para
   procurar, e porque o banco do editor mistura MAIÚSCULA e minúscula na mesma
   lista. */
export function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function combina(procurado: string, ...campos: string[]): boolean {
  const p = chave(procurado)
  if (!p) return true
  return campos.some((c) => chave(c).includes(p))
}
export {
  SeloDeDepartamento,
  familiaDoDepartamento,
  opcoesDeDepartamento,
  pilulaDoDepartamento,
} from './departamento'
