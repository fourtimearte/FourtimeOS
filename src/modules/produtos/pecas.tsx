import type { GrupoDeReferencia, MaterialDoEstoque } from '@dominio/produto'

/* O que a ficha e o editor dividem. Mora aqui para um nao importar do outro. */

export const SEM_ETIQUETA =
  'A etiqueta não entra na referência: ela é escolhida no kit e no orçamento, caso a caso (silk, DTF ou sublimação).'

const NOME_DA_CATEGORIA = { aviamento: 'Aviamento', insumo: 'Insumo' } as const

/** De onde vem o aviamento, em palavras: "Aviamento · Linha", ou que ele não está ligado ao Estoque. */
export function apoioDoMaterial(materialId: string | null, doEstoque: MaterialDoEstoque[]): string {
  if (!materialId) return 'pelo nome, sem ligação com o Estoque'
  const m = doEstoque.find(x => x.id === materialId)
  if (!m) return 'do Estoque'
  return m.grupo ? `${NOME_DA_CATEGORIA[m.categoria]} · ${m.grupo}` : NOME_DA_CATEGORIA[m.categoria]
}

export function Trilha({ grupo, fim }: { grupo: GrupoDeReferencia | null; fim: string }) {
  return (
    <div className="pd-trilha">
      <span className={grupo ? 'pd-cod' : 'pd-cod sem'}>{grupo ? grupo.cod : 'sem'}</span>
      {grupo ? grupo.nome : 'Sem grupo'}
      <span aria-hidden="true">›</span>
      {fim}
    </div>
  )
}
