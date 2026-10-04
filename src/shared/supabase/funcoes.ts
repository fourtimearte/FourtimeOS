/* A conversa com as funcoes do Supabase (Edge Functions).

   Uma funcao mora em /functions/v1/<nome> e faz o que o navegador nao pode
   fazer sozinho: falar com um servidor de fora, por exemplo. O cracha de quem
   pediu vai junto, e e a funcao que pergunta ao banco se aquela pessoa pode.

   A resposta de recusa das nossas funcoes traz o motivo no campo `erro`, ja
   escrito para a pessoa ler: e ele que sobe ate a tela. */

import { crachaValido } from './auth'
import { SUPABASE_CHAVE, SUPABASE_URL } from './config'
import { SESSAO_VENCIDA } from './rest'

export async function funcao<T>(nome: string, corpo: unknown = {}): Promise<T> {
  const cracha = await crachaValido()
  if (!cracha) throw new Error(SESSAO_VENCIDA)

  let resposta: Response
  try {
    resposta = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_CHAVE,
        Authorization: `Bearer ${cracha.acesso}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error('Não consegui falar com o servidor. Confira a internet.')
  }

  /* le como texto, pelo mesmo motivo do rest.ts: corpo vazio nao e erro */
  const texto = await resposta.text()
  let lido: unknown = null
  try {
    lido = texto ? JSON.parse(texto) : null
  } catch {
    lido = null
  }
  if (!resposta.ok) {
    const motivo = lido && typeof lido === 'object' ? (lido as { erro?: unknown }).erro : null
    throw new Error(typeof motivo === 'string' && motivo ? motivo : `O servidor recusou o pedido (${resposta.status}).`)
  }
  return lido as T
}
