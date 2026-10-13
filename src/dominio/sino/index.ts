import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   O SINO DO TOPO (064). Cada pessoa lê só os avisos dela: a mensagem nova
   na conversa de um pedido, o pedido que o PCP devolveu ao vendedor e,
   desde a 065, o lead que chegou pelo chat do site; desde a 074, o lead que
   passou a ser seu, a cotacao aprovada que chegou na separacao e o pedido
   pronto para enviar.
   Quem escreve aviso é o banco (função e gatilho), nunca a tela.
   ========================================================================== */

export type TipoDeAviso = 'conversa' | 'devolvido' | 'lead' | 'dono' | 'pedido' | 'pronto'

export type AvisoDoSino = {
  id: string
  tipo: TipoDeAviso
  texto: string
  /** para onde o clique leva, dentro do sistema */
  link: string
  deNome: string
  criadoEm: string
  lido: boolean
}

type LinhaDoAviso = {
  id: string
  tipo: TipoDeAviso
  texto: string
  link: string
  de_nome: string
  criado_em: string
  lido_em: string | null
}

export const AVISOS_A_VISTA = 30

/** null: a 064 não rodou e o sino não tem dados ainda */
export async function carregarMeusAvisos(): Promise<AvisoDoSino[] | null> {
  try {
    const linhas = await tabela<LinhaDoAviso[]>(
      `aviso_na_lista?select=*&order=criado_em.desc&limit=${AVISOS_A_VISTA}`,
    )
    return linhas.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      texto: l.texto,
      link: l.link,
      deNome: l.de_nome || '',
      criadoEm: l.criado_em,
      lido: !!l.lido_em,
    }))
  } catch (e) {
    if (e instanceof Error && /Não encontrei|aviso_na_lista|PGRST205|schema cache/i.test(e.message)) return null
    throw e
  }
}

/** sem ids: todos os da pessoa */
export async function lerAvisos(ids?: string[]): Promise<void> {
  await chamar('ler_avisos', { p_ids: ids && ids.length ? ids : null })
}
