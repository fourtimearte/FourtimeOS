import { chamar, tabela } from '@shared/supabase'
import type { Etapa } from './tipos'

/* ==========================================================================
   O cartão do MARK45.

   O desenho está em claude/DECISAO-O-CARTAO-DO-MARK45.md, e a decisão que
   organiza este arquivo é: NÃO EXISTE UMA TELA DO OPERADOR. O chão de fábrica
   e o escritório usam o mesmo quadro, e o que muda entre eles é o que cada um
   pode fazer, que é uma pergunta que o banco já responde pela matriz de ações.

   O que mora aqui é o que o cartão precisa além do que o quadro já lia: as
   tags, a conversa, quem está com ele na mão, e a conferência do Terminei.

   NENHUMA REGRA MORA NESTE ARQUIVO. Quem diz se a tag vale naquele posto, se
   a pessoa pode escrever e o que falta antes de terminar é o banco, na
   migração 036. Aqui é só o jeito de perguntar.
   ========================================================================== */

/* --- as tags -------------------------------------------------------------
   O TOM É UMA CHAVE, e não uma cor. A cor literal é proibida fora dos tokens
   do V7, e uma cor guardada no banco atravessaria o sistema sem passar pelo
   tema: no Grafite ela ficaria ilegível. O banco guarda o nome do tom e quem
   sabe pintar é o CSS, em kanban.css. */
export const TONS_DE_TAG = [
  'cinza',
  'vermelha',
  'laranja',
  'amarela',
  'verde',
  'azul',
  'roxa',
] as const
export type TomDeTag = (typeof TONS_DE_TAG)[number]

export type Tag = {
  chave: string
  nome: string
  tom: TomDeTag
  emTodoPosto: boolean
  ordem: number
  ativa: boolean
  /** os postos onde ela aparece; vazio com emTodoPosto vale em todos */
  postos: Etapa[]
}

type LinhaDeTag = {
  chave: string
  nome: string
  tom: TomDeTag
  em_todo_posto: boolean
  ordem: number
  ativa: boolean
}

export async function carregarAsTags(): Promise<Tag[]> {
  const [tags, postos] = await Promise.all([
    tabela<LinhaDeTag[]>('tag?select=chave,nome,tom,em_todo_posto,ordem,ativa&order=ordem.asc'),
    tabela<{ tag: string; posto: Etapa }[]>('tag_do_posto?select=tag,posto'),
  ])
  const porTag = new Map<string, Etapa[]>()
  for (const p of postos) {
    const lista = porTag.get(p.tag) ?? []
    lista.push(p.posto)
    porTag.set(p.tag, lista)
  }
  return tags.map((t) => ({
    chave: t.chave,
    nome: t.nome,
    tom: t.tom,
    emTodoPosto: t.em_todo_posto,
    ordem: t.ordem,
    ativa: t.ativa,
    postos: porTag.get(t.chave) ?? [],
  }))
}

/** A tag aparece neste posto? É a mesma pergunta que por_a_tag faz no banco. */
export function tagValeNoPosto(tag: Tag, posto: Etapa): boolean {
  return tag.ativa && (tag.emTodoPosto || tag.postos.includes(posto))
}

export function porATag(fatiaId: string, tag: string) {
  return chamar<void>('por_a_tag', { p_fatia: fatiaId, p_tag: tag })
}

export function tirarATag(fatiaId: string, tag: string) {
  return chamar<void>('tirar_a_tag', { p_fatia: fatiaId, p_tag: tag })
}

/* --- as tags mestre ------------------------------------------------------
   Elas vêm do cabeçalho da cotação e valem para o pedido inteiro, em todo
   posto. Elas NÃO se criam na tela de tags: quem as define é a cotação, e uma
   tag mestre posta no chão de fábrica seria o vendedor descobrindo pelo
   quadro que o pedido dele virou VIP. */
export const TOM_DA_MARCA: Record<string, TomDeTag> = {
  URGENTE: 'vermelha',
  ATRASADO: 'laranja',
  EVENTO: 'roxa',
  VIP: 'amarela',
  PRIORIDADE: 'laranja',
}

export function tomDaMarca(marca: string): TomDeTag {
  return TOM_DA_MARCA[marca.toUpperCase()] ?? 'cinza'
}

/* --- a linha do tempo ----------------------------------------------------
   A fala e o fato na mesma lista, de propósito: um comentário lido sem saber
   que o cartão mudou de posto três minutos antes é meio comentário. */
export type TipoDeEvento = 'fala' | 'posto' | 'tag' | 'pegou' | 'soltou' | 'nasceu'

export type EventoDoCartao = {
  id: string
  tipo: TipoDeEvento
  texto: string
  em: string
  quem: string
  quemNome: string
}

type LinhaDeEvento = {
  id: string
  tipo: TipoDeEvento
  texto: string
  em: string
  quem: string | null
  quem_nome: string
}

export async function carregarALinhaDoTempo(fatiaId: string): Promise<EventoDoCartao[]> {
  const linhas = await tabela<LinhaDeEvento[]>(
    `linha_do_tempo_da_fatia?select=id,tipo,texto,em,quem,quem_nome&fatia_id=eq.${fatiaId}&order=em.desc&limit=80`,
  )
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    texto: l.texto,
    em: l.em,
    quem: l.quem ?? '',
    quemNome: l.quem_nome || '',
  }))
}

export function comentarNoCartao(fatiaId: string, texto: string) {
  return chamar<unknown>('comentar_na_fatia', { p_fatia: fatiaId, p_texto: texto })
}

/* --- quem está com o cartão ---------------------------------------------- */
export function pegarOCartao(fatiaId: string) {
  return chamar<unknown>('pegar_a_fatia', { p_fatia: fatiaId })
}

export function soltarOCartao(fatiaId: string) {
  return chamar<unknown>('soltar_a_fatia', { p_fatia: fatiaId })
}

/* --- a conferência do Terminei -------------------------------------------
   A TELA NÃO DECIDE NADA: ela desenha o que esta resposta trouxe. Se a regra
   morasse aqui, o mesmo Terminei dado por um PATCH direto no PostgREST
   passaria sem conferir coisa nenhuma. */
export type TomDaConferencia = 'ok' | 'atencao' | 'nota'

export type ItemDaConferencia = {
  tom: TomDaConferencia
  titulo: string
  linha: string
}

export type Conferencia = {
  fatia: string
  numero: string
  posto: Etapa
  proximo: Etapa | null
  itens: ItemDaConferencia[]
  pode: boolean
}

export async function conferirASaida(fatiaId: string): Promise<Conferencia> {
  const r = await chamar<{
    fatia: string
    numero: string
    posto: Etapa
    proximo: Etapa | null
    itens: ItemDaConferencia[]
    pode: boolean
  }>('conferir_a_saida', { p_fatia: fatiaId })
  return {
    fatia: r.fatia,
    numero: r.numero ?? '',
    posto: r.posto,
    proximo: r.proximo,
    itens: Array.isArray(r.itens) ? r.itens : [],
    pode: !!r.pode,
  }
}

/** Quantos itens pedem atenção. Zero quer dizer que dá para terminar direto. */
export function pontosDeAtencao(c: Conferencia): number {
  return c.itens.filter((i) => i.tom === 'atencao').length
}

/* --- o cadastro das tags, em Configurações ------------------------------- */
export async function salvarTag(t: {
  chave: string
  nome: string
  tom: TomDeTag
  emTodoPosto: boolean
  ordem: number
  ativa: boolean
}): Promise<void> {
  await tabela('tag?on_conflict=chave', {
    metodo: 'POST',
    mesclar: true,
    corpo: {
      chave: t.chave,
      nome: t.nome,
      tom: t.tom,
      em_todo_posto: t.emTodoPosto,
      ordem: t.ordem,
      ativa: t.ativa,
    },
  })
}

/* Os postos de uma tag entram por substituição, e não por diferença: apagar
   tudo e gravar a lista nova é uma operação que não tem estado no meio. Somar
   e subtrair daria o mesmo resultado em três chamadas, e a segunda falhando
   deixaria a tag com metade dos postos. */
export async function salvarPostosDaTag(chave: string, postos: Etapa[]): Promise<void> {
  await tabela(`tag_do_posto?tag=eq.${encodeURIComponent(chave)}`, { metodo: 'DELETE' })
  if (!postos.length) return
  await tabela('tag_do_posto', {
    metodo: 'POST',
    corpo: postos.map((p) => ({ tag: chave, posto: p })),
  })
}

export async function apagarTag(chave: string): Promise<void> {
  await tabela(`tag?chave=eq.${encodeURIComponent(chave)}`, { metodo: 'DELETE' })
}

/* A chave é o nome sem acento, sem espaço e sem maiúscula. Ela é a identidade
   da tag no banco, então mudar o nome na tela não pode mudar a chave: o
   histórico de quem já pôs aquela tag aponta para ela. */
export function chaveDaTag(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

/* --- de qual cotação veio este pedido ------------------------------------
   O cartão precisa dos layouts, e os layouts moram na cotação. A view do
   quadro não devolve o cotacao_id de propósito: ela é a lista, e lista carrega
   o que se lê de longe. Quem abre um cartão paga esta consulta a mais, e quem
   só olha o quadro não paga nada. */
export async function cotacaoDoPedido(pedidoId: string): Promise<string> {
  if (!pedidoId) return ''
  const linhas = await tabela<{ cotacao_id: string | null }[]>(
    `pedido?select=cotacao_id&id=eq.${encodeURIComponent(pedidoId)}&limit=1`,
  )
  return linhas[0]?.cotacao_id ?? ''
}

/* --- achar outro pedido para comparar -------------------------------------
   A BUSCA NÃO É TRAVADA PELO CARTÃO ABERTO, e isso é o ponto: quem está com um
   pedido na frente e quer conferir contra o do ano passado não pode ter que
   fechar o que está olhando para procurar o outro.

   Ela varre TODOS os estados, inclusive entregue e cancelado. Comparar com um
   pedido que ainda está na fábrica é o caso raro; o caso comum é o pedido
   antigo do mesmo cliente, e ele já saiu faz meses. */
export type PedidoParaComparar = {
  id: string
  numero: string
  nome: string
  cliente: string
  estado: string
  cotacaoId: string
  entregaEm: string
}

export async function buscarPedidosParaComparar(
  termo: string,
  foraId: string,
): Promise<PedidoParaComparar[]> {
  const t = termo.trim()
  if (t.length < 2) return []
  /* O ponto e a vírgula quebram o or= do PostgREST, e o % é o curinga dele:
     deixar os três passarem é deixar quem digita "PD-01, 02" receber um erro
     de sintaxe em vez de nenhum resultado. */
  const limpo = t.replace(/[,.*()%]/g, ' ').trim()
  if (!limpo) return []
  const busca = encodeURIComponent(`*${limpo}*`)
  const linhas = await tabela<
    {
      id: string
      numero: string
      nome: string | null
      cliente: string | null
      estado: string
      cotacao_id: string | null
      entrega_em: string | null
    }[]
  >(
    'pedido_na_fabrica?select=id,numero,nome,cliente,estado,cotacao_id,entrega_em' +
      `&or=(numero.ilike.${busca},cliente.ilike.${busca},nome.ilike.${busca})` +
      '&order=numero.desc&limit=8',
  )
  return linhas
    .filter((l) => l.id !== foraId)
    .map((l) => ({
      id: l.id,
      numero: l.numero,
      nome: l.nome || l.cliente || '',
      cliente: l.cliente || '',
      estado: l.estado,
      cotacaoId: l.cotacao_id ?? '',
      entregaEm: l.entrega_em ?? '',
    }))
}
