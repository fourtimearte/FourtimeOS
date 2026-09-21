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
  /** o que está na prateleira: a soma do razão */
  saldo: number
  /** o que os pedidos aprovados já comprometeram (026) */
  reservado: number
  /** saldo menos reservado: é por este número que o mínimo é julgado */
  livre: number
  pedidosReservando: number
  /** algum pedido reserva este material sem consumo cadastrado */
  reservaSemConsumo: boolean
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
  reservado: number | string
  livre: number | string
  pedidos_reservando: number | string
  reserva_sem_consumo: boolean
  tecido_id: string | null
  cor_id: string | null
  tecido: string | null
  cor: string | null
  cor_hex: string | null
  abaixo_do_minimo: boolean
  ultimo_movimento: string | null
}

const COLUNAS_DO_MATERIAL =
  'id,categoria,nome,unidade,minimo,saldo,reservado,livre,pedidos_reservando,' +
  'reserva_sem_consumo,tecido_id,cor_id,tecido,cor,cor_hex,' +
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
    reservado: numero(l.reservado),
    livre: numero(l.livre),
    pedidosReservando: numero(l.pedidos_reservando),
    reservaSemConsumo: !!l.reserva_sem_consumo,
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

/* O MÍNIMO É JULGADO PELO LIVRE, E NÃO PELO SALDO. Decisão do Henrique em
   21/09: a reserva tira. Não adianta ter 42 kg na prateleira se 30 já saíram em
   pedido aprovado; a pergunta de compra é sobre o que sobra, e é ela que o
   cartão do início precisa responder. */
export function abaixoDoMinimo(lista: Material[]): Material[] {
  return lista.filter((m) => m.livre < m.minimo)
}

/** Quanto da barra encher: o mínimo fica na metade, para o olho comparar. */
export function nivel(m: Material): number {
  if (m.minimo <= 0) return m.livre > 0 ? 100 : 0
  return Math.max(0, Math.min(100, (m.livre / (m.minimo * 2)) * 100))
}

export function corDoNivel(m: Material): string {
  if (m.livre < m.minimo) return 'var(--brand)'
  if (m.livre < m.minimo * 1.3) return 'var(--warn)'
  return 'var(--ok)'
}

/* Quilo e litro andam em decimal e cone e botão não: "0,6 L" faz sentido e
   "1.450,0 un" só polui. A casa decimal sai da unidade, e não do número, para
   que 2 kg apareça como "2,0 kg" e fique na mesma coluna de "0,6 kg". */
export function casasDaUnidade(unidade: string): number {
  return ['kg', 'l', 'm'].includes(unidade.toLowerCase()) ? 1 : 0
}

export function quantidade(m: Material): string {
  return numeroNaUnidade(m.livre, m.unidade)
}

export function numeroNaUnidade(valor: number, unidade: string): string {
  const casas = casasDaUnidade(unidade)
  return (
    valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) +
    ' ' +
    unidade
  )
}

/* ---------- a reserva ---------------------------------------------------- */

/* O que um pedido aprovado comprometeu. Não é movimento: a malha continua na
   prateleira, e sair dela é a separação (passo 8). */
export type ReservaDoPedido = {
  id: string
  pedidoId: string
  pedido: string
  materialId: string
  material: string
  categoria: Categoria
  quantidade: number
  unidade: string
  pecas: number
  semConsumo: boolean
  baixada: boolean
  /** o que saiu da prateleira de verdade; 0 enquanto não separou */
  separado: number
  saldo: number
  oEstoqueCobre: boolean
}

type LinhaDaReserva = {
  id: string
  pedido_id: string
  pedido: string
  material_id: string
  material: string
  categoria: Categoria
  quantidade: number | string
  unidade: string
  pecas: number
  sem_consumo: boolean
  baixada: boolean
  separado: number | string | null
  saldo: number | string
  o_estoque_cobre: boolean
}

const COLUNAS_DA_RESERVA =
  'id,pedido_id,pedido,material_id,material,categoria,quantidade,unidade,pecas,' +
  'sem_consumo,baixada,separado,saldo,o_estoque_cobre'

export async function carregarReservasDoPedido(pedidoId: string): Promise<ReservaDoPedido[]> {
  const linhas = await tabela<LinhaDaReserva[]>(
    `reserva_do_pedido?select=${COLUNAS_DA_RESERVA}&pedido_id=eq.${pedidoId}` +
      '&order=categoria.asc,material.asc',
  )
  return linhas.map((l) => ({
    id: l.id,
    pedidoId: l.pedido_id,
    pedido: l.pedido ?? '',
    materialId: l.material_id,
    material: l.material,
    categoria: l.categoria,
    quantidade: numero(l.quantidade),
    unidade: l.unidade,
    pecas: Number(l.pecas) || 0,
    semConsumo: !!l.sem_consumo,
    baixada: !!l.baixada,
    separado: numero(l.separado),
    saldo: numero(l.saldo),
    oEstoqueCobre: !!l.o_estoque_cobre,
  }))
}

/* Refaz a reserva de um pedido a partir do documento e do consumo cadastrado.
   É o que se chama depois de cadastrar um consumo que faltava: sem isso, a
   reserva continuaria com a falta registrada no dia da aprovação. */
export async function refazerAReserva(pedidoId: string): Promise<number> {
  return chamar<number>('reservar_o_pedido', { p_pedido: pedidoId })
}

/* A reserva nasce com o consumo que existia no dia da aprovação. Cadastrar
   depois o consumo que faltava não conserta sozinho o pedido que já passou, e
   um número que só fica certo para quem chegou na ordem certa não é um número
   em que alguém confia. Isto refaz todos os pedidos que ainda estão na fábrica,
   e devolve quantos. */
export async function refazerAsReservasAbertas(): Promise<number> {
  return chamar<number>('refazer_as_reservas_abertas', {})
}

export { concluirASeparacao, comecarASeparacao, carregarFilaDaSeparacao, desfazerASeparacao, separarMaterial } from './separacao'
export type { PedidoNaSeparacao } from './separacao'
