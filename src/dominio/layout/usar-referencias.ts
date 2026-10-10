import { useEffect, useSyncExternalStore } from 'react'
import { tabela } from '@shared/supabase'
import type { Referencia } from '@ds'

/* ==========================================================================
   AS REFERÊNCIAS DO BANCO (Configurações, Banco de dados, e Fichas técnicas):
   tabela `referencia`, só as ativas, e os grupos de `grupo_de_referencia`
   (010 Camisetas e polos, 020 Raglan, ... KIT Kits).

   ATÉ 11/10/2026 o menu de referência do editor lia a lista de exemplo do
   /kit: 62 referências e 13 categorias de nomes antigos, quando o banco tinha
   122. Referência que só existia no banco não aparecia no menu, e a que
   estava num layout abria sem o nome do grupo.

   Lidas uma vez por visita, como as cores de impressão: o menu abre muitas
   vezes, e cada abertura não pode virar uma ida ao servidor.
   ========================================================================== */

export type ReferenciasDoBanco = {
  fase: 'nada' | 'lendo' | 'pronto' | 'falhou'
  refs: Referencia[]
  /** o nome de cada grupo, pelo código (010, 020, KIT) */
  categorias: Record<string, string>
  /** os códigos dos grupos, na ordem do banco */
  ordem: string[]
  falha: string
}

type LinhaDaReferencia = { cod: string; nome: string; grupo: string | null; genero: string; ordem: number }
type LinhaDoGrupo = { cod: string; nome: string; ordem: number }

/* o banco guarda o gênero numa letra (M, F, C infantil, U unissex); o menu e o
   bloco falam por extenso, e unissex é "sem gênero" */
const GENERO: Record<string, string> = { M: 'masculino', F: 'feminino', C: 'infantil' }

let estado: ReferenciasDoBanco = { fase: 'nada', refs: [], categorias: {}, ordem: [], falha: '' }
const ouvintes = new Set<() => void>()
const guardar = (novo: ReferenciasDoBanco) => {
  estado = novo
  ouvintes.forEach((o) => o())
}

export function carregarReferencias(forcar = false): void {
  if (!forcar && (estado.fase === 'lendo' || estado.fase === 'pronto')) return
  guardar({ ...estado, fase: 'lendo', falha: '' })
  Promise.all([
    tabela<LinhaDoGrupo[]>('grupo_de_referencia?select=cod,nome,ordem&order=ordem.asc'),
    tabela<LinhaDaReferencia[]>(
      'referencia?select=cod,nome,grupo,genero,ordem&ativo=is.true&order=cod.asc,nome.asc',
    ),
  ])
    .then(([grupos, linhas]) => {
      const categorias: Record<string, string> = {}
      for (const g of grupos) categorias[g.cod] = g.nome
      const refs: Referencia[] = linhas.map((l) => ({
        cod: l.cod,
        nome: l.nome,
        genero: GENERO[String(l.genero || '').toUpperCase()] ?? '',
        categoria: l.grupo ?? '',
      }))
      /* referência sem grupo, ou num grupo que não existe mais, cai num
         grupo próprio no fim, para não sumir do menu */
      const ordem = grupos.map((g) => g.cod)
      if (refs.some((r) => !categorias[r.categoria])) {
        for (const r of refs) if (!categorias[r.categoria]) r.categoria = 'SEM'
        categorias.SEM = 'Sem grupo'
        ordem.push('SEM')
      }
      guardar({ fase: 'pronto', refs, categorias, ordem, falha: '' })
    })
    .catch((e: unknown) => {
      guardar({ ...estado, fase: 'falhou', falha: e instanceof Error ? e.message : String(e) })
    })
}

const assinar = (o: () => void) => {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}

/** as referências e os grupos do banco, lidos na primeira vez que alguém pede */
export function usarReferencias(): ReferenciasDoBanco {
  const atual = useSyncExternalStore(assinar, () => estado)
  useEffect(() => {
    if (atual.fase === 'nada' || atual.fase === 'falhou') carregarReferencias(atual.fase === 'falhou')
  }, [atual.fase])
  return atual
}

/** o nome do grupo de uma referência pelo código dela ('' quando não se sabe) */
export function grupoDaReferencia(lidas: ReferenciasDoBanco, cod: string): string {
  const r = lidas.refs.find((x) => x.cod === cod)
  return r ? (lidas.categorias[r.categoria] ?? '') : ''
}
