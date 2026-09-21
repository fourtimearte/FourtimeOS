import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   Os acessos: quem é cada papel e o que ele pode em cada página.

   ESTA PASTA NÃO IMPORTA DA SESSÃO, e é de propósito: a sessão importa daqui
   para esquentar o cache dos papéis, e se as duas se importassem viraria
   ciclo, que é justamente o que a trava de arquitetura recusa.

   A ESCADA TAMBÉM MORA AQUI, mas como conveniência da tela, e não como
   regra: quem manda é a constraint da migração 028. O banco recusa deletar
   sem ver venha de onde vier, e salvar_permissao arruma antes de gravar.
   ========================================================================== */

export type Nivel = 'ver' | 'editar' | 'deletar' | 'total'

export const NIVEIS: Nivel[] = ['ver', 'editar', 'deletar', 'total']

export const NOME_DO_NIVEL: Record<Nivel, string> = {
  ver: 'Ver',
  editar: 'Editar',
  deletar: 'Deletar',
  total: 'Controle total',
}

export type Permissao = {
  ver: boolean
  editar: boolean
  deletar: boolean
  total: boolean
}

export const NADA: Permissao = { ver: false, editar: false, deletar: false, total: false }

export type PapelDoSistema = {
  chave: string
  nome: string
  linha: string
  /** o admin: não se apaga e não troca de chave */
  fixo: boolean
  ordem: number
}

/** Uma linha da matriz: papel, página e os quatro níveis. */
export type LinhaDaMatriz = Permissao & { papel: string; painel: string }

/** A matriz inteira, indexada por papel e depois por página. */
export type Matriz = Record<string, Record<string, Permissao>>

/* ---------- a escada -----------------------------------------------------
   Marcar um nível acende os de baixo; desmarcar apaga os de cima. É a mesma
   conta que a constraint do banco cobra, escrita aqui só para a caixa de
   marcação responder na hora, sem esperar a viagem. */
export function escada(atual: Permissao, nivel: Nivel, ligado: boolean): Permissao {
  const p = { ...atual }
  if (ligado) {
    if (nivel === 'total') return { ver: true, editar: true, deletar: true, total: true }
    if (nivel === 'deletar') return { ...p, ver: true, editar: true, deletar: true }
    if (nivel === 'editar') return { ...p, ver: true, editar: true }
    return { ...p, ver: true }
  }
  if (nivel === 'ver') return { ...NADA }
  if (nivel === 'editar') return { ...p, editar: false, deletar: false, total: false }
  if (nivel === 'deletar') return { ...p, deletar: false, total: false }
  return { ...p, total: false }
}

/** O nível mais alto que esta permissão alcança, para a tela resumir. */
export function altura(p: Permissao | undefined): Nivel | null {
  if (!p) return null
  if (p.total) return 'total'
  if (p.deletar) return 'deletar'
  if (p.editar) return 'editar'
  if (p.ver) return 'ver'
  return null
}

/* ---------- o cache dos papéis -------------------------------------------
   Três telas mostram o NOME do papel de alguém (a barra lateral, o perfil e a
   equipe). Antes isso era uma constante no código; agora o papel mora no
   banco e pode nascer pela tela, então a constante viraria mentira no dia em
   que alguém criasse um papel novo.

   A sessão enche este cache junto com o perfil. Enquanto ele estiver vazio, o
   nome cai para a própria chave, que é legível ("gerente") e é melhor que um
   espaço em branco. */
let CACHE: PapelDoSistema[] = []

export function papeisEmMemoria(): PapelDoSistema[] {
  return CACHE
}

export function nomeDoPapel(chave: string): string {
  return CACHE.find((p) => p.chave === chave)?.nome || chave
}

export function linhaDoPapel(chave: string): string {
  return CACHE.find((p) => p.chave === chave)?.linha || ''
}

type LinhaDoPapel = { chave: string; nome: string; linha: string; fixo: boolean; ordem: number }

export async function carregarPapeis(): Promise<PapelDoSistema[]> {
  const linhas = await tabela<LinhaDoPapel[]>(
    'papel_do_sistema?select=chave,nome,linha,fixo,ordem&order=ordem.asc',
  )
  CACHE = linhas.map((l) => ({
    chave: l.chave,
    nome: l.nome,
    linha: l.linha ?? '',
    fixo: !!l.fixo,
    ordem: l.ordem,
  }))
  return CACHE
}

/** Esquenta o cache sem derrubar nada se o banco não responder. */
export async function esquentarPapeis(): Promise<void> {
  try {
    await carregarPapeis()
  } catch {
    /* o nome cai para a chave, e o sistema segue */
  }
}

/* ---------- a matriz ------------------------------------------------------ */
type LinhaCrua = {
  papel: string
  painel: string
  ver: boolean
  editar: boolean
  deletar: boolean
  total: boolean
}

export async function carregarMatriz(): Promise<Matriz> {
  const linhas = await tabela<LinhaCrua[]>(
    'permissao?select=papel,painel,ver,editar,deletar,total',
  )
  const m: Matriz = {}
  for (const l of linhas) {
    if (!m[l.papel]) m[l.papel] = {}
    m[l.papel][l.painel] = {
      ver: !!l.ver,
      editar: !!l.editar,
      deletar: !!l.deletar,
      total: !!l.total,
    }
  }
  return m
}

export function permissaoDe(m: Matriz, papel: string, painel: string): Permissao {
  return m[papel]?.[painel] ?? NADA
}

export async function salvarPermissao(
  papel: string,
  painel: string,
  p: Permissao,
): Promise<void> {
  await chamar('salvar_permissao', {
    p_papel: papel,
    p_painel: painel,
    p_ver: p.ver,
    p_editar: p.editar,
    p_deletar: p.deletar,
    p_total: p.total,
  })
}

export async function criarPapel(
  chave: string,
  nome: string,
  linha: string,
): Promise<PapelDoSistema> {
  const r = await chamar<LinhaDoPapel>('criar_papel', {
    p_chave: chave,
    p_nome: nome,
    p_linha: linha,
  })
  await esquentarPapeis()
  return { chave: r.chave, nome: r.nome, linha: r.linha ?? '', fixo: !!r.fixo, ordem: r.ordem }
}

export async function salvarPapel(
  chave: string,
  chaveNova: string,
  nome: string,
  linha: string,
): Promise<PapelDoSistema> {
  const r = await chamar<LinhaDoPapel>('salvar_papel', {
    p_chave: chave,
    p_chave_nova: chaveNova,
    p_nome: nome,
    p_linha: linha,
  })
  await esquentarPapeis()
  return { chave: r.chave, nome: r.nome, linha: r.linha ?? '', fixo: !!r.fixo, ordem: r.ordem }
}

export async function apagarPapel(chave: string): Promise<string> {
  const recado = await chamar<string>('apagar_papel', { p_chave: chave })
  await esquentarPapeis()
  return recado
}

export type AvisoDoAcesso = { aviso: string; detalhe: string }

export async function conferirOsAcessos(): Promise<AvisoDoAcesso[]> {
  return chamar<AvisoDoAcesso[]>('conferir_os_acessos', {})
}

/* ---------- a chave que o Postgres aceita --------------------------------
   Minúscula, sem acento, sem espaço, começando por letra. É o mesmo formato
   que a constraint papel_chave_limpa cobra, escrito aqui para o campo já
   nascer certo em vez de o banco recusar depois. */
export function chaveLimpa(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
}

export function chaveValida(chave: string): boolean {
  return /^[a-z][a-z0-9_]{1,23}$/.test(chave)
}
