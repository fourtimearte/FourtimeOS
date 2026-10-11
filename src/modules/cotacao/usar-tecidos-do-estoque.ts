import { useEffect, useSyncExternalStore } from 'react'
import type { GrupoDoMenuDeTecido, TecidoDoMenu } from '@ds'
import { carregarHierarquiaDeTecido, carregarMateriais, NOME_DO_SEM_TIPO, type Material } from '@dominio/estoque'

/* ==========================================================================
   OS TECIDOS DO MENU DO EDITOR VÊM DO ESTOQUE (pedido do Henrique,
   11/10/2026): o tecido e a cor são os que estão CADASTRADOS no Estoque, e
   não o catálogo de cores do Banco de dados. Cada material da categoria
   tecido é uma cor de um tecido; o grupo e a ordem do tecido vêm do catálogo
   (grupo_de_tecido e tecido), como na árvore do Estoque.

   Entra a cor cadastrada mesmo com o saldo zerado: o orçamento é feito antes
   da compra, e o apoio de cada cor diz quanto há livre.

   Lido a cada vez que o editor abre (alguém pode ter cadastrado uma cor no
   Estoque agora), sem fazer o menu esperar: ele mostra o que já tinha.
   ========================================================================== */

export type TecidosDoEstoque = { fase: 'nada' | 'lendo' | 'pronto' | 'falhou'; grupos: GrupoDoMenuDeTecido[]; falha: string }

let estado: TecidosDoEstoque = { fase: 'nada', grupos: [], falha: '' }
let lendo = false
const ouvintes = new Set<() => void>()
const guardar = (novo: TecidosDoEstoque) => {
  estado = novo
  ouvintes.forEach((o) => o())
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function montarGrupos(
  materiais: Material[],
  hierarquia: Awaited<ReturnType<typeof carregarHierarquiaDeTecido>>,
): GrupoDoMenuDeTecido[] {
  const doCatalogo = new Map(hierarquia.tecidos.map((t) => [t.id, t]))
  const porTecido = new Map<string, TecidoDoMenu & { grupo: string; ordem: number }>()
  for (const m of materiais) {
    if (m.categoria !== 'tecido') continue
    const chave = m.tecidoId || 'nome:' + m.tecido
    const cat = doCatalogo.get(m.tecidoId)
    let t = porTecido.get(chave)
    if (!t) {
      t = { id: chave, nome: cat?.nome || m.tecido || m.nome, cores: [], grupo: cat?.grupo ?? '', ordem: cat?.ordem ?? 0 }
      porTecido.set(chave, t)
    }
    t.cores.push({
      id: m.id,
      nome: m.cor || m.nome,
      hex: m.corHex,
      nota: m.livre > 0 ? num(m.livre) + ' ' + m.unidade : 'sem saldo',
    })
  }
  const tecidos = [...porTecido.values()]
  tecidos.forEach((t) => t.cores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  const ordenar = (l: typeof tecidos) => l.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  const grupos: GrupoDoMenuDeTecido[] = hierarquia.grupos
    .map((g) => ({ cod: g.cod, nome: g.nome, tecidos: ordenar(tecidos.filter((t) => t.grupo === g.cod)) }))
    .filter((g) => g.tecidos.length)
  const conhecidos = new Set(hierarquia.grupos.map((g) => g.cod))
  const soltos = ordenar(tecidos.filter((t) => !conhecidos.has(t.grupo)))
  if (soltos.length) grupos.push({ cod: '', nome: NOME_DO_SEM_TIPO, tecidos: soltos })
  return grupos.map((g) => ({ ...g, tecidos: g.tecidos.map(({ id, nome, cores }) => ({ id, nome, cores })) }))
}

export function carregarTecidosDoEstoque(): void {
  if (lendo) return
  lendo = true
  if (estado.fase !== 'pronto') guardar({ ...estado, fase: 'lendo', falha: '' })
  Promise.all([carregarMateriais(), carregarHierarquiaDeTecido()])
    .then(([materiais, hierarquia]) => guardar({ fase: 'pronto', grupos: montarGrupos(materiais, hierarquia), falha: '' }))
    .catch((e: unknown) => {
      if (estado.fase !== 'pronto') guardar({ ...estado, fase: 'falhou', falha: e instanceof Error ? e.message : String(e) })
    })
    .finally(() => {
      lendo = false
    })
}

const assinar = (o: () => void) => {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}

export function usarTecidosDoEstoque(): TecidosDoEstoque {
  useEffect(() => {
    carregarTecidosDoEstoque()
  }, [])
  return useSyncExternalStore(assinar, () => estado, () => estado)
}
