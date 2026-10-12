import { tabela } from '@shared/supabase'

/* ==========================================================================
   O RODIZIO DOS LEADS (011, secao 12; a tela que faltava, 12/10/2026).

   Lead de telefone novo vai para quem levou MENOS ate agora; empate, pela
   ordem da fila. Telefone que ja e cliente de alguem volta para o dono da
   carteira, antes do rodizio. A fila e visivel de proposito: o vendedor tem
   que poder ver que o proximo e dele.

   So o administrador mexe na fila (a regra de acesso da 011); todo mundo
   aprovado ve.
   ========================================================================== */

export type NaFila = { pessoaId: string; ordem: number; ativo: boolean; levou: number; ultimoEm: string }

type Linha = { pessoa_id: string; ordem: number; ativo: boolean; levou: number; ultimo_em: string | null }

export async function carregarRodizio(): Promise<NaFila[]> {
  const linhas = await tabela<Linha[]>('rodizio?select=pessoa_id,ordem,ativo,levou,ultimo_em&order=ordem.asc')
  return linhas.map((l) => ({ pessoaId: l.pessoa_id, ordem: l.ordem, ativo: l.ativo, levou: l.levou, ultimoEm: l.ultimo_em ?? '' }))
}

/** Entra na fila, sai dela ou muda de lugar. Sair e desligar: a contagem fica. */
export async function salvarNaFila(f: Pick<NaFila, 'pessoaId' | 'ordem' | 'ativo'>): Promise<void> {
  const linhas = await tabela<Linha[]>('rodizio?on_conflict=pessoa_id', {
    metodo: 'POST',
    devolver: true,
    mesclar: true,
    corpo: [{ pessoa_id: f.pessoaId, ordem: f.ordem, ativo: f.ativo }],
  })
  if (!linhas.length) throw new Error('Só o administrador mexe na fila do rodízio.')
}

/** Recomeça a contagem de todos: quem ja levou muito deixa de ficar para tras. */
export async function zerarRodizio(): Promise<void> {
  await tabela('rodizio?pessoa_id=not.is.null', { metodo: 'PATCH', corpo: { levou: 0 } })
}

/** De quem e a vez: a mesma conta do banco (dono_do_lead), para a tela mostrar. */
export function daVez(fila: NaFila[], aprovados: Set<string>): string {
  const ativos = fila.filter((f) => f.ativo && aprovados.has(f.pessoaId))
  ativos.sort((a, b) => a.levou - b.levou || a.ordem - b.ordem)
  return ativos[0]?.pessoaId ?? ''
}
