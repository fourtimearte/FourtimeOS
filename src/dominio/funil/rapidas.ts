import { tabela } from '@shared/supabase'
import { formatarDinheiroExato } from '@shared'
import { RESPOSTAS, nomeDoLead, type Lead } from './tipos'

/* ==========================================================================
   AS MENSAGENS RAPIDAS (070, pranchas 150 a 152).

   Da equipe (dono vazio: todo mundo ve e usa) ou so minhas. Quem cria, muda e
   apaga e cobrado pelo banco: a da equipe so muda quem escreveu, o admin ou o
   gerente. A tela so esconde o lapis de quem nao pode, por educacao.

   O TEXTO TEM CAMPOS que se preenchem na hora de enviar, com o lead da
   conversa aberta: {nome} o contato, {empresa} o nome do lead, {vendedor}
   quem envia, {cotacao} o numero da cotacao e {total} o valor dela. O
   {contato} das respostas antigas do v5 vale como {nome}.

   ANTES DA 070 RODAR a tabela nao existe: a lista mostra as quatro respostas
   do v5, so para usar, e a tela diz que criar e editar esperam o banco.
   ========================================================================== */

export type MensagemRapida = {
  id: string
  titulo: string
  texto: string
  grupo: string
  /** so minha (true) ou da equipe (false) */
  minha: boolean
  criadoPor: string
  ordem: number
}

type Linha = {
  id: string
  titulo: string
  texto: string
  grupo: string
  dono_id: string | null
  criado_por: string | null
  ordem: number
}

const COLUNAS = 'id,titulo,texto,grupo,dono_id,criado_por,ordem'

export const CAMPOS_DA_MENSAGEM = [
  { campo: 'nome', rotulo: 'nome', explica: 'o contato da conversa' },
  { campo: 'empresa', rotulo: 'empresa', explica: 'o nome do lead' },
  { campo: 'vendedor', rotulo: 'vendedor', explica: 'quem envia' },
  { campo: 'cotacao', rotulo: 'cotação', explica: 'o número da cotação' },
  { campo: 'total', rotulo: 'total', explica: 'o valor da cotação' },
] as const

const semATabela = (e: unknown) =>
  e instanceof Error && /Não encontrei|schema cache|mensagem_rapida|PGRST205|42P01/i.test(e.message)

const deLinha = (l: Linha): MensagemRapida => ({
  id: l.id,
  titulo: l.titulo,
  texto: l.texto,
  grupo: l.grupo || 'Geral',
  minha: !!l.dono_id,
  criadoPor: l.criado_por ?? '',
  ordem: l.ordem ?? 0,
})

/** As da equipe e as minhas, na ordem da tela. `semBanco` antes da 070. */
export async function carregarRapidas(): Promise<{ mensagens: MensagemRapida[]; semBanco: boolean }> {
  try {
    const linhas = await tabela<Linha[]>(`mensagem_rapida?select=${COLUNAS}&order=grupo.asc,ordem.asc,titulo.asc`)
    return { mensagens: linhas.map(deLinha), semBanco: false }
  } catch (e) {
    if (!semATabela(e)) throw e
    return {
      mensagens: RESPOSTAS.map((r, i) => ({
        id: 'v5-' + r.id,
        titulo: r.titulo,
        texto: r.texto,
        grupo: 'Geral',
        minha: false,
        criadoPor: '',
        ordem: i,
      })),
      semBanco: true,
    }
  }
}

/** Cria (sem id) ou grava. `eu` e quem esta escrevendo: o dono quando e so minha. */
export async function salvarRapida(m: MensagemRapida, eu: string): Promise<MensagemRapida> {
  const corpo = {
    titulo: m.titulo.trim(),
    texto: m.texto.trim(),
    grupo: m.grupo.trim() || 'Geral',
    dono_id: m.minha ? eu : null,
    ordem: m.ordem,
  }
  if (m.id) {
    const linhas = await tabela<Linha[]>(`mensagem_rapida?id=eq.${encodeURIComponent(m.id)}&select=${COLUNAS}`, {
      metodo: 'PATCH',
      corpo,
      devolver: true,
    })
    if (!linhas[0]) throw new Error('Só quem escreveu, o admin ou o gerente mudam uma mensagem da equipe.')
    return deLinha(linhas[0])
  }
  const linhas = await tabela<Linha[]>(`mensagem_rapida?select=${COLUNAS}`, {
    metodo: 'POST',
    corpo: [{ ...corpo, criado_por: eu }],
    devolver: true,
  })
  if (!linhas[0]) throw new Error('O banco aceitou mas não devolveu a mensagem.')
  return deLinha(linhas[0])
}

export async function apagarRapida(id: string): Promise<void> {
  const linhas = await tabela<{ id: string }[]>(`mensagem_rapida?id=eq.${encodeURIComponent(id)}&select=id`, {
    metodo: 'DELETE',
    devolver: true,
  })
  if (!linhas.length) throw new Error('Só quem escreveu, o admin ou o gerente apagam uma mensagem da equipe.')
}

/** Quem pode mexer nesta: a minha sempre; a da equipe, quem escreveu ou admin e gerente. */
export function possoMexerNaRapida(m: MensagemRapida, eu: string, chefe: boolean): boolean {
  if (m.id.startsWith('v5-')) return false
  return m.minha || chefe || (!!eu && m.criadoPor === eu)
}

export type DadosDaConversa = {
  lead: Lead | null
  vendedor: string
  /** o total da cotacao do lead, quando a tela ja sabe */
  total?: number
}

/** O texto pronto para ir: os campos trocados pelo que se sabe da conversa. */
export function preencherRapida(texto: string, d: DadosDaConversa): string {
  const l = d.lead
  const nome = (l?.contato || '').trim().split(/\s+/)[0] || ''
  const valores: Record<string, string> = {
    nome,
    contato: nome,
    empresa: l ? nomeDoLead(l) : '',
    vendedor: (d.vendedor || '').trim().split(/\s+/)[0] || '',
    cotacao: l?.cotacaoNumero || '',
    total: d.total ? formatarDinheiroExato(d.total) : '',
  }
  return texto
    .replace(/\{(nome|contato|empresa|vendedor|cotacao|cotação|total)\}/g, (_x, c: string) => valores[c === 'cotação' ? 'cotacao' : c] ?? '')
    .replace(/Oi !/g, 'Oi!')
    .replace(/[ \t]{2,}/g, ' ')
}

/** Os campos que o texto usa e que ficaram vazios nesta conversa. */
export function camposVazios(texto: string, d: DadosDaConversa): string[] {
  const usados = [...texto.matchAll(/\{(nome|contato|empresa|vendedor|cotacao|cotação|total)\}/g)].map((m) => m[1])
  return [...new Set(usados)].filter((c) => !preencherRapida('{' + c + '}', d).trim())
}

/** Agrupa na ordem: os grupos pela primeira aparicao. */
export function porGrupo(ms: MensagemRapida[]): [string, MensagemRapida[]][] {
  const mapa = new Map<string, MensagemRapida[]>()
  ms.forEach((m) => {
    const g = m.grupo || 'Geral'
    if (!mapa.has(g)) mapa.set(g, [])
    mapa.get(g)!.push(m)
  })
  return [...mapa.entries()]
}
