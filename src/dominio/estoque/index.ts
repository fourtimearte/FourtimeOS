import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   O estoque.

   Até a migração 025 esta pasta era uma lista de sete materiais escrita à mão,
   com os números do mockup. O cartão "abaixo do mínimo" do início lia dali, o
   que quer dizer que a primeira tela que a fábrica abre todo dia mostrava um
   alerta inventado. Agora ela lê do banco.

   O SALDO É UM CACHE, E O RAZÃO É A VERDADE. A coluna saldo existe para a
   tela não somar o histórico inteiro a cada leitura, e quem a mantém é o
   gatilho do razão. Nada daqui escreve no saldo: entrada, saída e ajuste
   passam por mexerNoEstoque, que grava uma linha no razão e deixa o gatilho
   fazer a conta. É por isso que dá para responder "por que o saldo é 9?".
   ========================================================================== */

export type Categoria = 'tecido' | 'aviamento' | 'insumo'

export const CATEGORIAS: Categoria[] = ['tecido', 'aviamento', 'insumo']

export const NOME_DA_CATEGORIA: Record<Categoria, string> = {
  tecido: 'Tecido',
  aviamento: 'Aviamento',
  insumo: 'Insumo',
}

export type Material = {
  id: string
  categoria: Categoria
  nome: string
  unidade: string
  minimo: number
  saldo: number
  tecidoId: string
  corId: string
  tecido: string
  cor: string
  corHex: string
  abaixoDoMinimo: boolean
  ultimoMovimento: string
}

/* Os cinco motivos que o banco aceita. A tela só oferece três: separação nasce
   da separação de material e devolução nasce do que voltou dela, e nenhuma das
   duas é alguém digitando. */
export type Motivo = 'entrada' | 'saida' | 'ajuste' | 'separacao' | 'devolucao'

export const NOME_DO_MOTIVO: Record<Motivo, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  separacao: 'Separação',
  devolucao: 'Devolução',
}

export type Movimento = {
  id: string
  materialId: string
  material: string
  unidade: string
  categoria: Categoria
  quantidade: number
  motivo: Motivo
  observacao: string
  pedidoId: string
  pedido: string
  quem: string
  quando: string
}

/* ---------- a leitura ---------------------------------------------------- */

type LinhaDoMaterial = {
  id: string
  categoria: Categoria
  nome: string
  unidade: string
  minimo: number | string
  saldo: number | string
  tecido_id: string | null
  cor_id: string | null
  tecido: string | null
  cor: string | null
  cor_hex: string | null
  abaixo_do_minimo: boolean
  ultimo_movimento: string | null
}

const COLUNAS_DO_MATERIAL =
  'id,categoria,nome,unidade,minimo,saldo,tecido_id,cor_id,tecido,cor,cor_hex,' +
  'abaixo_do_minimo,ultimo_movimento'

/* O Postgres devolve numeric como TEXTO no JSON, e não como número: numeric
   não cabe em double sem mentir, então o PostgREST manda "9.000" em vez de 9.
   Sem este Number() a barra de nível compararia texto com número e um material
   com 9 kg apareceria acima de um mínimo de 20. */
function numero(v: number | string | null): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0
}

function deLinha(l: LinhaDoMaterial): Material {
  return {
    id: l.id,
    categoria: l.categoria,
    nome: l.nome,
    unidade: l.unidade,
    minimo: numero(l.minimo),
    saldo: numero(l.saldo),
    tecidoId: l.tecido_id ?? '',
    corId: l.cor_id ?? '',
    tecido: l.tecido ?? '',
    cor: l.cor ?? '',
    corHex: l.cor_hex ?? '',
    abaixoDoMinimo: l.abaixo_do_minimo,
    ultimoMovimento: l.ultimo_movimento ?? '',
  }
}

export async function carregarMateriais(): Promise<Material[]> {
  const linhas = await tabela<LinhaDoMaterial[]>(
    `material_na_prateleira?select=${COLUNAS_DO_MATERIAL}&order=categoria.asc,nome.asc`,
  )
  return linhas.map(deLinha)
}

type LinhaDoMovimento = {
  id: string
  material_id: string
  material: string
  unidade: string
  categoria: Categoria
  quantidade: number | string
  motivo: Motivo
  observacao: string
  pedido_id: string | null
  pedido: string | null
  quem_nome: string | null
  quando: string
}

export async function carregarMovimentos(limite = 200): Promise<Movimento[]> {
  const linhas = await tabela<LinhaDoMovimento[]>(
    'movimento_do_estoque?select=id,material_id,material,unidade,categoria,quantidade,' +
      `motivo,observacao,pedido_id,pedido,quem_nome,quando&order=quando.desc&limit=${limite}`,
  )
  return linhas.map((l) => ({
    id: l.id,
    materialId: l.material_id,
    material: l.material,
    unidade: l.unidade,
    categoria: l.categoria,
    quantidade: numero(l.quantidade),
    motivo: l.motivo,
    observacao: l.observacao ?? '',
    pedidoId: l.pedido_id ?? '',
    pedido: l.pedido ?? '',
    quem: l.quem_nome ?? '',
    quando: l.quando,
  }))
}

/* ---------- a escrita ---------------------------------------------------- */

/* A quantidade vai COM SINAL: positivo entra, negativo sai. Quem chama decide
   o sinal, porque só quem chama sabe se o operador digitou "20 de entrada" ou
   "20 de saída", e uma função que adivinhasse pelo motivo erraria no ajuste,
   que é o único que anda para os dois lados. */
export async function mexerNoEstoque(
  materialId: string,
  quantidade: number,
  motivo: Motivo,
  observacao = '',
  pedidoId = '',
): Promise<void> {
  await chamar('mexer_no_estoque', {
    p_material: materialId,
    p_quantidade: quantidade,
    p_motivo: motivo,
    p_observacao: observacao,
    p_pedido: pedidoId || null,
  })
}

export type MaterialNovo = {
  categoria: Categoria
  nome: string
  unidade: string
  minimo: number
  tecidoId?: string
  corId?: string
  teste?: boolean
}

export async function cadastrarMaterial(m: MaterialNovo): Promise<string> {
  const linhas = await tabela<{ id: string }[]>('material?select=id', {
    metodo: 'POST',
    devolver: true,
    corpo: {
      categoria: m.categoria,
      nome: m.nome,
      unidade: m.unidade,
      minimo: m.minimo,
      tecido_id: m.tecidoId || null,
      cor_id: m.corId || null,
      teste: m.teste ?? false,
    },
  })
  return linhas[0]?.id ?? ''
}

/* O saldo NÃO está aqui de propósito. Mudar o quanto tem é movimento, e
   movimento passa por mexerNoEstoque. O que esta função edita é o cadastro:
   o nome, a unidade e o mínimo. */
export async function salvarCadastroDoMaterial(
  id: string,
  m: { nome: string; unidade: string; minimo: number },
): Promise<void> {
  await tabela<void>(`material?id=eq.${id}`, {
    metodo: 'PATCH',
    corpo: { nome: m.nome, unidade: m.unidade, minimo: m.minimo, atualizado_em: new Date().toISOString() },
  })
}

/* A prova de que o cache não virou segunda verdade: devolve as linhas em que o
   saldo guardado e a soma do razão discordam. O esperado é nenhuma. */
export async function conferirORazao(): Promise<
  { material: string; saldo_guardado: number; soma_do_razao: number }[]
> {
  return chamar('conferir_o_razao', {})
}

/* ---------- as regras de leitura ----------------------------------------- */

export function abaixoDoMinimo(lista: Material[]): Material[] {
  return lista.filter((m) => m.saldo < m.minimo)
}

/** Quanto da barra encher: o mínimo fica na metade, para o olho comparar. */
export function nivel(m: Material): number {
  if (m.minimo <= 0) return m.saldo > 0 ? 100 : 0
  return Math.max(0, Math.min(100, (m.saldo / (m.minimo * 2)) * 100))
}

export function corDoNivel(m: Material): string {
  if (m.saldo < m.minimo) return 'var(--brand)'
  if (m.saldo < m.minimo * 1.3) return 'var(--warn)'
  return 'var(--ok)'
}

/* Quilo e litro andam em decimal e cone e botão não: "0,6 L" faz sentido e
   "1.450,0 un" só polui. A casa decimal sai da unidade, e não do número, para
   que 2 kg apareça como "2,0 kg" e fique na mesma coluna de "0,6 kg". */
export function casasDaUnidade(unidade: string): number {
  return ['kg', 'l', 'm'].includes(unidade.toLowerCase()) ? 1 : 0
}

export function quantidade(m: Material): string {
  return numeroNaUnidade(m.saldo, m.unidade)
}

export function numeroNaUnidade(valor: number, unidade: string): string {
  const casas = casasDaUnidade(unidade)
  return (
    valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) +
    ' ' +
    unidade
  )
}
