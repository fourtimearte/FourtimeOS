import { chamar, tabela } from '@shared/supabase'

/* ==========================================================================
   A CONVERSA DO PEDIDO (064; parte P4 do PCP).

   Uma conversa por pessoa de fora do PCP, dentro do pedido: "o PCP com a
   Dani". Quem é do PCP escreve em todas; a pessoa de fora, só na dela. Cada
   mensagem avisa o outro lado no sino do topo.
   ========================================================================== */

export type MensagemDoPedido = {
  id: string
  /** a pessoa de fora do PCP com quem é a conversa */
  com: string
  comNome: string
  comPapel: string
  quem: string
  quemNome: string
  texto: string
  em: string
}

type LinhaDaMensagem = {
  id: string
  com: string
  com_nome: string
  com_papel: string
  quem: string | null
  quem_nome: string
  texto: string
  em: string
}

export type PessoaDaEquipe = { id: string; nome: string; papel: string }

/** null: a 064 não rodou e a conversa não existe ainda */
export async function carregarConversa(pedidoId: string): Promise<MensagemDoPedido[] | null> {
  try {
    const linhas = await tabela<LinhaDaMensagem[]>(
      `conversa_na_lista?select=*&pedido_id=eq.${encodeURIComponent(pedidoId)}&order=em.asc`,
    )
    return linhas.map((l) => ({
      id: l.id,
      com: l.com,
      comNome: l.com_nome || '',
      comPapel: l.com_papel || '',
      quem: l.quem ?? '',
      quemNome: l.quem_nome || '',
      texto: l.texto,
      em: l.em,
    }))
  } catch (e) {
    if (e instanceof Error && /Não encontrei|conversa_na_lista|PGRST205|schema cache/i.test(e.message)) return null
    throw e
  }
}

export async function falarNoPedido(pedidoId: string, com: string, texto: string): Promise<void> {
  await chamar('falar_no_pedido', { p_pedido: pedidoId, p_com: com, p_texto: texto })
}

/** quem está na equipe, para abrir conversa com outra pessoa */
export async function carregarEquipeParaConversa(): Promise<PessoaDaEquipe[]> {
  return tabela<PessoaDaEquipe[]>('equipe?select=id,nome,papel&situacao=eq.aprovado&order=nome.asc')
}
