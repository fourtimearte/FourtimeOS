import { tabela } from '@shared/supabase'

/* ==========================================================================
   QUEM RECEBE O LEAD DO SITE (065, plano 15, decisao 1).

   "Quero opcao configurada aqui, no momento vai para uma pessoa fixa, mas no
   futuro rodizio" (Henrique, 11/10/2026). Uma linha so no banco, que so o
   admin muda; quem mexeu e quando e o banco que anota.

   Pessoa fixa vazia: o lead nasce sem dono e o sino avisa admin e gerente.
   Cliente que ja tem vendedor volta para ele, qualquer que seja a regra.
   ========================================================================== */
export type ModoDoLeadDoSite = 'pessoa_fixa' | 'rodizio'
export type RegraDoLeadDoSite = { modo: ModoDoLeadDoSite; pessoaId: string }

type Linha = { modo: ModoDoLeadDoSite; pessoa_id: string | null }

/** null: a 065 nao rodou ainda */
export async function carregarRegraDoLeadDoSite(): Promise<RegraDoLeadDoSite | null> {
  try {
    const [l] = await tabela<Linha[]>('regra_do_lead_do_site?select=modo,pessoa_id&id=eq.1')
    return l ? { modo: l.modo, pessoaId: l.pessoa_id ?? '' } : null
  } catch (e) {
    if (e instanceof Error && /Não encontrei|regra_do_lead_do_site|PGRST205|schema cache/i.test(e.message)) return null
    throw e
  }
}

export async function salvarRegraDoLeadDoSite(r: RegraDoLeadDoSite): Promise<void> {
  const mudou = await tabela<Linha[]>('regra_do_lead_do_site?id=eq.1', {
    metodo: 'PATCH',
    devolver: true,
    corpo: { modo: r.modo, pessoa_id: r.pessoaId || null },
  })
  /* a regra de acesso devolve zero linhas para quem nao e admin, sem erro */
  if (!mudou.length) throw new Error('Só o administrador muda quem recebe o lead do site.')
}
