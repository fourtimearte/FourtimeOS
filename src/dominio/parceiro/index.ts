import { chamar, funcao, tabela } from '@shared/supabase'
import { formatarDinheiroExato, limitesDoMes } from '@shared'

/* ==========================================================================
   Os parceiros da loja.

   Quem vende peças na loja da Fourtime (fourtimefit.com.br) e recebe parte de
   cada venda: o Goiás Vôlei, o Viapol, o Colégio Yolanda. Cada um tem a sua
   coleção na loja e o seu acordo.

   O QUE O SISTEMA NÃO FAZ AQUI: buscar venda na loja. Quem traz a venda é a
   loja, que avisa cada pedido a uma função do Supabase (o porteiro). Esta
   página lê o que já chegou.

   A PARTE DO PARCEIRO NÃO É GRAVADA. Ela é conta, feita pelo banco na hora de
   ler (view venda_do_parceiro), com o acordo que valia no dia da venda. Por
   isso este arquivo soma e não calcula: a regra mora num lugar só.

   O ACORDO TEM DATA. "Vale a partir de" é o que deixa trocar o acordo sem
   mexer no que já foi vendido. Data no passado muda venda já registrada, e o
   banco só aceita com confirmação.
   ========================================================================== */

export type TipoDeAcordo = 'percentual' | 'valor_por_peca'
export type BaseDoAcordo = 'valor_pago' | 'preco_cheio'

export const NOME_DO_TIPO: Record<TipoDeAcordo, string> = {
  percentual: 'Percentual',
  valor_por_peca: 'Valor por peça',
}

export const NOME_DA_BASE: Record<BaseDoAcordo, string> = {
  valor_pago: 'Valor pago',
  preco_cheio: 'Preço cheio',
}

export type Acordo = {
  tipo: TipoDeAcordo
  /** o percentual, de 0 a 100, ou o valor em reais por peça */
  valor: number
  /** sobre o que o percentual incide; no valor por peça não muda nada */
  base: BaseDoAcordo
  /** AAAA-MM-DD */
  desde: string
}

export type Parceiro = {
  id: string
  nome: string
  /** o endereço da coleção na loja, e o nome dela para ler */
  colecao: string
  colecaoNome: string
  /** a parte secreta do link e a senha que abre a página */
  chave: string
  senha: string
  /** a página ligada ou desligada; desligada, o link não abre */
  ativo: boolean
  /** a última vez que o parceiro abriu a página com a senha certa */
  abertaEm: string | null
  travadoAte: string | null
  produtos: number
  /** o acordo que vale hoje, e o último escrito (que pode começar depois) */
  acordo: Acordo | null
  ultimo: Acordo | null
}

/** Uma linha de pedido da loja que é de um parceiro, com a conta feita. */
export type VendaDoParceiro = {
  id: string
  parceiroId: string
  quando: string
  produto: string
  variante: string
  quantidade: number
  /** a quantidade que conta: a vendida menos a devolvida */
  pecas: number
  /** o que o cliente pagou por essas peças, sem o frete */
  valor: number
  /** nula quando não havia acordo no dia da venda */
  parte: number | null
  conta: boolean
}

export type Colecao = { colecao: string; nome: string }

export type AvisoDaLoja = { quando: string; topico: string; resultado: string }

/** O endereço da página do parceiro na loja. A chave vai depois do #, que o
    navegador não manda ao servidor: assim ela não fica em registro de acesso. */
export const PAGINA_DO_PARCEIRO = 'https://fourtimefit.com.br/pages/parceiro'

export function linkDaPagina(chave: string): string {
  return `${PAGINA_DO_PARCEIRO}#k=${chave}`
}

/* ---------- a leitura ----------------------------------------------------- */

type LinhaDoParceiro = {
  id: string
  nome: string
  colecao: string | null
  colecao_nome: string | null
  chave: string
  senha: string
  ativo: boolean
  aberta_em: string | null
  travado_ate: string | null
  produtos: number | string | null
  acordo_tipo: TipoDeAcordo | null
  acordo_valor: number | string | null
  acordo_base: BaseDoAcordo | null
  acordo_desde: string | null
  ultimo_tipo: TipoDeAcordo | null
  ultimo_valor: number | string | null
  ultimo_base: BaseDoAcordo | null
  ultimo_desde: string | null
}

function acordoDe(
  tipo: TipoDeAcordo | null,
  valor: number | string | null,
  base: BaseDoAcordo | null,
  desde: string | null,
): Acordo | null {
  if (!tipo || valor === null || !desde) return null
  /* numeric chega como texto no JSON */
  return { tipo, valor: Number(valor) || 0, base: base ?? 'valor_pago', desde }
}

export async function carregarParceiros(): Promise<Parceiro[]> {
  const linhas = await tabela<LinhaDoParceiro[]>('parceiro_na_lista?select=*&order=nome.asc')
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    colecao: l.colecao ?? '',
    colecaoNome: l.colecao_nome ?? '',
    chave: l.chave,
    senha: l.senha,
    ativo: !!l.ativo,
    abertaEm: l.aberta_em,
    travadoAte: l.travado_ate,
    produtos: Number(l.produtos) || 0,
    acordo: acordoDe(l.acordo_tipo, l.acordo_valor, l.acordo_base, l.acordo_desde),
    ultimo: acordoDe(l.ultimo_tipo, l.ultimo_valor, l.ultimo_base, l.ultimo_desde),
  }))
}

type LinhaDaVenda = {
  item_id: number | string
  parceiro_id: string
  vendido_em: string
  produto: string | null
  variante: string | null
  quantidade: number | string
  pecas: number | string
  valor: number | string
  parte: number | string | null
  conta: boolean
}

/** As vendas de todos os parceiros num mês ("2026-10"), da mais nova para a mais velha. */
export async function carregarVendasDoMes(mes: string): Promise<VendaDoParceiro[]> {
  const { de, ate } = limitesDoMes(mes)
  const linhas = await tabela<LinhaDaVenda[]>(
    'venda_do_parceiro?select=item_id,parceiro_id,vendido_em,produto,variante,quantidade,pecas,valor,parte,conta' +
      `&aparece=is.true&vendido_em=gte.${encodeURIComponent(de)}&vendido_em=lt.${encodeURIComponent(ate)}&order=vendido_em.desc`,
  )
  return linhas.map((l) => ({
    id: String(l.item_id),
    parceiroId: l.parceiro_id,
    quando: l.vendido_em,
    produto: l.produto ?? '',
    variante: l.variante ?? '',
    quantidade: Number(l.quantidade) || 0,
    pecas: Number(l.pecas) || 0,
    valor: Number(l.valor) || 0,
    parte: l.parte === null ? null : Number(l.parte) || 0,
    conta: !!l.conta,
  }))
}

/* O último aviso que a loja mandou. A carga das vendas antigas não é aviso da
   loja, e fica de fora. Apoio: se não vier, a página só deixa de dizer quando
   foi; ela não cai por isso. */
export async function ultimoAvisoDaLoja(): Promise<AvisoDaLoja | null> {
  try {
    const linhas = await tabela<{ recebido_em: string; topico: string | null; resultado: string | null }[]>(
      'aviso_da_loja?select=recebido_em,topico,resultado&topico=neq.carga&order=id.desc&limit=1',
    )
    const l = linhas[0]
    return l ? { quando: l.recebido_em, topico: l.topico ?? '', resultado: l.resultado ?? '' } : null
  } catch {
    return null
  }
}

/* ---------- a gravação ---------------------------------------------------- */

export type ParceiroNovo = {
  id?: string
  nome: string
  colecao: string
  colecaoNome: string
  ativo: boolean
}

/** Salva o cadastro e devolve o id. O link e a senha nascem no banco. */
export async function salvarParceiro(n: ParceiroNovo): Promise<string> {
  return chamar<string>('salvar_parceiro', {
    p_id: n.id ?? null,
    p_nome: n.nome.trim(),
    p_colecao: n.colecao,
    p_colecao_nome: n.colecaoNome,
    p_ativo: n.ativo,
  })
}

/* O banco recusa acordo com data no passado quando já há venda do parceiro
   daquela data em diante, e a recusa é uma PERGUNTA, não um erro: ela volta
   para a tela como `confirmar`, com a frase do banco, e a tela pergunta. */
const PEDE_CONFIRMACAO = /Confirme para refazer/

export async function salvarAcordo(
  parceiroId: string,
  acordo: Acordo,
  refazer = false,
): Promise<{ confirmar?: string }> {
  try {
    await chamar('salvar_acordo_do_parceiro', {
      p_parceiro: parceiroId,
      p_tipo: acordo.tipo,
      p_valor: acordo.valor,
      p_base: acordo.base,
      p_vale_desde: acordo.desde,
      p_refazer: refazer,
    })
    return {}
  } catch (e) {
    const recado = e instanceof Error ? e.message : ''
    if (!refazer && PEDE_CONFIRMACAO.test(recado)) return { confirmar: recado }
    throw e
  }
}

/** Gera outra senha. A antiga para de abrir na hora, e a página destrava. */
export function trocarSenha(parceiroId: string): Promise<string> {
  return chamar<string>('trocar_senha_do_parceiro', { p_parceiro: parceiroId })
}

/** Troca a parte secreta do link. O link antigo para de abrir na hora. */
export function trocarLink(parceiroId: string): Promise<string> {
  return chamar<string>('trocar_link_do_parceiro', { p_parceiro: parceiroId })
}

/* ---------- o que vem da loja, pelo porteiro ------------------------------- */

/** As coleções da loja, para escolher a do parceiro. */
export async function colecoesDaLoja(): Promise<Colecao[]> {
  const r = await funcao<{ colecoes?: Colecao[] }>('loja', { acao: 'colecoes' })
  return (r?.colecoes ?? []).filter((c) => !!c.colecao)
}

/** Manda o porteiro reler os produtos da coleção de um parceiro. Devolve
    quantos produtos ele tem depois da leitura. */
export async function relerProdutos(parceiroId: string): Promise<number> {
  const r = await funcao<{ parceiros?: { parceiro: string; produtos?: number; erro?: string }[] }>('loja', {
    acao: 'produtos',
    parceiro: parceiroId,
  })
  const dele = (r?.parceiros ?? []).find((p) => p.parceiro === parceiroId)
  if (!dele) throw new Error('A loja não devolveu os produtos deste parceiro.')
  if (dele.erro) throw new Error(dele.erro)
  return Number(dele.produtos) || 0
}

/* ---------- as frases e as contas, todas puras ----------------------------- */

/** "10%", "12,5%". */
export function percentualNaTela(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/** "10% por peça", "R$ 25,00 por peça", "Sem acordo". */
export function fraseDoAcordo(a: Acordo | null): string {
  if (!a) return 'Sem acordo'
  return a.tipo === 'percentual' ? `${percentualNaTela(a.valor)} por peça` : `${formatarDinheiroExato(a.valor)} por peça`
}

/** A segunda linha do nome na lista: o estado da página do parceiro. */
export function situacaoDaPagina(p: Parceiro, agora = new Date()): string {
  if (!p.ativo) return 'Página desligada'
  if (p.travadoAte && new Date(p.travadoAte).getTime() > agora.getTime()) return 'Página travada por senha errada'
  if (!p.abertaEm) return 'Página ligada, ainda não aberta'
  return 'Página ativa'
}

export type SomaDoParceiro = { pecas: number; valor: number; parte: number; semAcordo: number }

/** A soma do mês de cada parceiro. Só entra o que conta. */
export function somarPorParceiro(vendas: VendaDoParceiro[]): Map<string, SomaDoParceiro> {
  const mapa = new Map<string, SomaDoParceiro>()
  for (const v of vendas) {
    if (!v.conta) continue
    const ja = mapa.get(v.parceiroId) ?? { pecas: 0, valor: 0, parte: 0, semAcordo: 0 }
    ja.pecas += v.pecas
    ja.valor += v.valor
    if (v.parte === null) ja.semAcordo += v.pecas
    else ja.parte += v.parte
    mapa.set(v.parceiroId, ja)
  }
  /* soma de dinheiro em ponto flutuante junta poeira: arredonda no fim */
  for (const s of mapa.values()) {
    s.valor = Math.round(s.valor * 100) / 100
    s.parte = Math.round(s.parte * 100) / 100
  }
  return mapa
}

/** "10", "12,5", "25,00": o número que a pessoa digitou, ou nulo. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/^R\$/i, '').replace(/%$/, '')
  if (!limpo) return null
  /* 1.250,50 e 1250,50 e 1250.50 valem a mesma coisa */
  const padrao = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  if (!/^\d+(\.\d+)?$/.test(padrao)) return null
  return Number(padrao)
}

/** O número no campo, do jeito que a pessoa escreveria: "10", "12,5", "25,00". */
export function numeroNoCampo(valor: number, tipo: TipoDeAcordo): string {
  return tipo === 'percentual'
    ? valor.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false })
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
}

export function mesmoAcordo(a: Acordo | null, b: Acordo | null): boolean {
  if (!a || !b) return a === b
  return (
    a.tipo === b.tipo &&
    a.valor === b.valor &&
    a.desde === b.desde &&
    /* no valor por peça a base não muda nada */
    (a.tipo === 'valor_por_peca' || a.base === b.base)
  )
}
