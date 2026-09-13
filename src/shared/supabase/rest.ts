/* A conversa com as tabelas.

   O Supabase publica cada tabela em /rest/v1/<nome>, e o filtro vai na propria
   URL: `pessoa?select=id,nome&id=eq.<uuid>`. Quem decide o que a pessoa pode
   ver nao e este arquivo: e a regra de acesso escrita no banco. Aqui so vai o
   cracha junto no cabecalho. */

import { crachaValido, renovarAgora } from './auth'
import { SUPABASE_CHAVE, SUPABASE_URL } from './config'

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type Pedido = {
  metodo?: Metodo
  corpo?: unknown
  /** pedir a linha de volta depois de gravar */
  devolver?: boolean
}

export const SESSAO_VENCIDA = 'Sua sessão terminou. Entre de novo.'

function cabecalho(acesso: string, pedido: Pedido): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_CHAVE,
    Authorization: `Bearer ${acesso}`,
    Accept: 'application/json',
  }
  if (pedido.corpo !== undefined) h['Content-Type'] = 'application/json'
  if (pedido.devolver) h['Prefer'] = 'return=representation'
  return h
}

type ErroDoBanco = { message?: string; hint?: string; details?: string; code?: string }

/* O nome que a pessoa entende para os erros que o banco tem nome tecnico. */
function recadoDoBanco(erro: ErroDoBanco, situacao: number): string {
  if (erro.code === '23505') return 'Já existe um cadastro com esse nome.'
  if (erro.code === '42501' || /permission denied/i.test(erro.message ?? '')) {
    return 'Seu acesso não permite fazer isso.'
  }
  if (situacao === 403) return 'Seu acesso não permite fazer isso.'
  if (situacao === 404) return 'Não encontrei esse registro.'
  return erro.message || `O banco recusou o pedido (${situacao}).`
}

/* Nem todo 401 e cracha vencido.

   O PostgREST responde 401 tanto para "seu cracha expirou" quanto para
   "esta tabela nao foi liberada para o seu papel". Tratar os dois igual seria
   o pior tipo de erro: a pessoa levaria "sua sessao terminou" na cara e cairia
   na tela de entrada, entraria de novo, e cairia de novo, sem nunca descobrir
   que o problema e um GRANT faltando no banco. */
function ehCrachaVencido(erro: ErroDoBanco): boolean {
  if (erro.code === '42501') return false
  if (erro.code === 'PGRST301') return true
  return /jwt|token/i.test(erro.message ?? '')
}

export async function tabela<T>(caminho: string, pedido: Pedido = {}): Promise<T> {
  const cracha = await crachaValido()
  if (!cracha) throw new Error(SESSAO_VENCIDA)

  const endereco = `${SUPABASE_URL}/rest/v1/${caminho}`
  const corpo = pedido.corpo === undefined ? undefined : JSON.stringify(pedido.corpo)

  async function disparar(acesso: string): Promise<Response> {
    try {
      return await fetch(endereco, {
        method: pedido.metodo ?? 'GET',
        headers: cabecalho(acesso, pedido),
        body: corpo,
      })
    } catch {
      throw new Error('Não consegui falar com o servidor. Confira a internet.')
    }
  }

  let resposta = await disparar(cracha.acesso)

  /* 401 de cracha vencido: o servidor derrubou a sessao antes da hora prevista.
     Vale uma renovacao e uma segunda tentativa, nunca mais que isso. */
  if (resposta.status === 401) {
    const erro = (await resposta.json().catch(() => ({}))) as ErroDoBanco
    if (!ehCrachaVencido(erro)) throw new Error(recadoDoBanco(erro, 401))

    const novo = await renovarAgora()
    if (!novo) throw new Error(SESSAO_VENCIDA)
    resposta = await disparar(novo.acesso)
    if (resposta.status === 401) throw new Error(SESSAO_VENCIDA)
  }

  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => ({}))) as ErroDoBanco
    throw new Error(recadoDoBanco(erro, resposta.status))
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

/* Uma funcao do banco chamada pelo nome. Serve para o que nao cabe em ler ou
   gravar uma linha: mudar o proprio nome, por exemplo, que precisa tocar uma
   coluna so e nenhuma outra. */
export async function chamar<T>(
  funcao: string,
  argumentos: Record<string, unknown> = {},
): Promise<T> {
  return tabela<T>(`rpc/${funcao}`, { metodo: 'POST', corpo: argumentos })
}
